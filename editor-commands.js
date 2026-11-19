'use strict';

function applyCommand(source, selectionStart, selectionEnd, command) {
  const text = String(source ?? '');
  let start = clamp(selectionStart, text.length), end = clamp(selectionEnd, text.length);
  if (end < start) [start, end] = [end, start];
  if (['bold', 'italic', 'strike', 'code'].includes(command)) return inlineCommand(text, start, end, command);
  if (command === 'link') {
    const label = text.slice(start, end) || 'link text';
    const replacement = `[${label}](https://)`;
    const a = start + label.length + 3;
    return result(replaceRange(text, start, end, replacement), a, a + 8);
  }
  if (command === 'fencedCode') return fenceCommand(text, start, end);
  if (command === 'continueList') return continueAtCaret(text, start, end);
  const spec = parseLineCommand(command);
  if (!spec) throw new Error(`Unknown Markdown command: ${command}`);
  return transformSelectedLines(text, start, end, spec);
}

function inlineCommand(text, start, end, kind) {
  const pair = { bold: ['**', '**'], italic: ['*', '*'], strike: ['~~', '~~'], code: null }[kind];
  const selected = text.slice(start, end);
  if (kind === 'code') {
    const delim = '`'.repeat(Math.max(1, maxRun(selected, '`') + 1));
    const runBefore = text.slice(0, start).match(/(`+)$/)?.[1] || '';
    const runAfter = text.slice(end).match(/^(`+)/)?.[1] || '';
    if (runBefore.length && runBefore === runAfter && !selected.includes(runBefore)) {
      let body = selected;
      if (body.startsWith(' ') && body.endsWith(' ') && (body[1] === '`' || body.at(-2) === '`')) body = body.slice(1, -1);
      const innerStart = start - runBefore.length, innerEnd = end + runAfter.length;
      return result(replaceRange(text, innerStart, innerEnd, body), innerStart, innerStart + body.length);
    }
    const body = selected || 'code';
    const pad = body.startsWith('`') || body.endsWith('`') || (/^ .* $/.test(body) && body.trim()) ? ' ' : '';
    const wrapped = `${delim}${pad}${body}${pad}${delim}`;
    return result(replaceRange(text, start, end, wrapped), start + delim.length, start + delim.length + pad.length + body.length + pad.length);
  }
  const [left, right] = pair;
  const leftMatches = start >= left.length && text.slice(start - left.length, start) === left;
  const rightMatches = text.slice(end, end + right.length) === right;
  const exactRuns = kind !== 'italic' || (text[start - 2] !== '*' && text[end + 1] !== '*');
  if (leftMatches && rightMatches && exactRuns && end > start) {
    const before = start - left.length, after = end + right.length;
    return result(replaceRange(text, before, after, selected), before, before + selected.length);
  }
  const body = selected || kind;
  return result(replaceRange(text, start, end, left + body + right), start + left.length, start + left.length + body.length);
}

function fenceCommand(text, start, end) {
  const selected = text.slice(start, end);
  const previousNewline = start > 0 && text[start - 1] === '\n' ? start - 1 : -1;
  const openStart = previousNewline >= 0 ? text.lastIndexOf('\n', previousNewline - 1) + 1 : -1;
  const open = openStart >= 0 ? text.slice(openStart, previousNewline) : '';
  const nextNewline = text[end] === '\n' ? end : -1;
  const closeEnd = nextNewline >= 0 ? text.indexOf('\n', nextNewline + 1) < 0 ? text.length : text.indexOf('\n', nextNewline + 1) : -1;
  const close = closeEnd >= 0 ? text.slice(nextNewline + 1, closeEnd) : '';
  const fenceMatch = open.match(/^(`{3,})(.*)$/);
  if (fenceMatch && close === fenceMatch[1]) {
    const body = selected;
    const removeEnd = closeEnd;
    const markdown = replaceRange(text, openStart, removeEnd, body);
    return result(markdown, openStart, openStart + body.length);
  }
  const match = selected.match(/^(`{3,})([^\n]*)\n([\s\S]*)\n\1$/);
  if (match) return result(replaceRange(text, start, end, match[3]), start, start + match[3].length);
  const body = selected || 'code';
  const fence = '`'.repeat(Math.max(3, maxRun(body, '`') + 1));
  const replacement = `${fence}\n${body}\n${fence}`;
  return result(replaceRange(text, start, end, replacement), start + fence.length + 1, start + fence.length + 1 + body.length);
}

function parseLineCommand(command) {
  if (/^h[1-6]$/.test(command)) return { type: 'heading', level: Number(command[1]) };
  if (command === 'paragraph') return { type: 'paragraph' };
  if (command === 'blockquote') return { type: 'blockquote' };
  if (['bulletList', 'orderedList', 'taskList'].includes(command)) return { type: command };
  if (command === 'indent' || command === 'outdent') return { type: command };
  return null;
}

function continueAtCaret(text, start, end) {
  const lineStart = text.lastIndexOf('\n', Math.max(-1, start - 1)) + 1;
  let lineEnd = text.indexOf('\n', start); if (lineEnd < 0) lineEnd = text.length;
  const line = text.slice(lineStart, lineEnd);
  const before = text.slice(lineStart, start), after = text.slice(start, lineEnd);
  const task = before.match(/^(\s*[-*+]\s+\[[ xX]\]\s*)$/);
  const bullet = before.match(/^(\s*[-*+]\s*)$/);
  const ordered = before.match(/^(\s*)(\d+)([.)]\s*)$/);
  const current = classify(line);
  const marker = task?.[1] || bullet?.[1] || (ordered ? ordered[1] + `${Number(ordered[2]) + 1}${ordered[3]}` : null) ||
    (current.kind === 'task' ? `${current.indent}- [ ] ` : current.kind === 'bullet' ? `${current.indent}- ` : current.kind === 'ordered' ? `${current.indent}1. ` : null);
  const isEmptyEntry = (task || bullet || ordered) && !after.trim();
  if (isEmptyEntry) {
    const replacement = before.replace(/(?:[-*+]\s+\[[ xX]\]|[-*+]|\d+[.)])\s*$/, '');
    const markdown = replaceRange(text, lineStart, lineEnd, replacement);
    return result(markdown, lineStart + replacement.length, lineStart + replacement.length);
  }
  let prefix = marker || '';
  if (!task && !bullet && !ordered && current.kind === 'ordered') {
    const number = line.match(/^(\s*)(\d+)([.)])/);
    if (number) prefix = `${number[1]}${Number(number[2]) + 1}${number[3]} `;
  }
  const insertion = `\n${prefix}`;
  const markdown = replaceRange(text, start, start, insertion);
  const caret = start + insertion.length;
  return result(markdown, caret, caret);
}

function transformSelectedLines(text, start, end, spec) {
  const first = text.lastIndexOf('\n', Math.max(-1, start - 1)) + 1;
  const lastSelectedChar = end > start ? end - 1 : end;
  let last = text.indexOf('\n', lastSelectedChar);
  if (last < 0) last = text.length;
  const chunk = text.slice(first, last);
  const lines = chunk.split('\n');
  const starts = [];
  let pos = first;
  for (const line of lines) { starts.push(pos); pos += line.length + 1; }
  const converted = convertLines(lines, spec);
  let output = '';
  const maps = [];
  for (let i = 0; i < lines.length; i++) {
    const before = lines[i], after = converted[i], abs = starts[i];
    const oldPrefix = before.length - classify(before).body.length;
    const newPrefix = after.length - classify(after).body.length;
    output += after + (i < lines.length - 1 ? '\n' : '');
    maps.push({ abs, before, after, oldPrefix, newPrefix });
  }
  const markdown = replaceRange(text, first, last, output);
  const mapOffset = offset => {
    let priorDelta = 0;
    for (const map of maps) {
      const { abs, before, after, oldPrefix, newPrefix } = map;
      const lineEnd = abs + before.length;
      if (offset <= lineEnd) {
        const relative = Math.max(0, offset - abs);
        const mapped = relative <= oldPrefix ? newPrefix : newPrefix + relative - oldPrefix;
        return abs + priorDelta + Math.min(after.length, mapped);
      }
      priorDelta += after.length - before.length;
    }
    return offset + priorDelta;
  };
  const mappedStart = mapOffset(start), mappedEnd = mapOffset(end);
  return result(markdown, clamp(mappedStart, markdown.length), clamp(mappedEnd, markdown.length));
}

function convertLines(lines, spec) {
  if (spec.type === 'continueList') return continueLines(lines);
  const classifiers = lines.map(classify);
  const toggle = spec.type === 'heading' ? classifiers.every(x => x.kind === 'heading' && x.level === spec.level)
    : spec.type === 'blockquote' ? classifiers.every(x => x.kind === 'quote')
      : spec.type === 'bulletList' ? classifiers.every(x => x.kind === 'bullet')
        : spec.type === 'orderedList' ? classifiers.every(x => x.kind === 'ordered')
          : spec.type === 'taskList' ? classifiers.every(x => x.kind === 'task') : false;
  return lines.map((line, i) => {
    const c = classifiers[i], indent = c.indent, body = c.body;
    if (spec.type === 'indent') return line ? `  ${line}` : line;
    if (spec.type === 'outdent') return line.replace(/^(?: {1,2}|\t)/, '');
    if (toggle && ['heading', 'blockquote', 'bulletList', 'orderedList', 'taskList'].includes(spec.type)) return `${indent}${body}`;
    if (spec.type === 'paragraph') return `${indent}${body}`;
    if (spec.type === 'heading') return body ? `${indent}${'#'.repeat(spec.level)} ${body}` : '';
    if (spec.type === 'blockquote') return `${indent}> ${body}`;
    if (spec.type === 'bulletList') return `${indent}- ${body}`;
    if (spec.type === 'orderedList') return `${indent}1. ${body}`;
    if (spec.type === 'taskList') return `${indent}- [ ] ${body}`;
    return line;
  });
}

function classify(line) {
  const m = line.match(/^([ \t]*)(.*)$/); const indent = m[1], content = m[2];
  let x;
  if ((x = content.match(/^#{1,6}\s+(.*)$/))) return { kind: 'heading', level: content.match(/^#+/)[0].length, indent, body: x[1] };
  if ((x = content.match(/^>\s?(.*)$/))) return { kind: 'quote', indent, body: x[1] };
  if ((x = content.match(/^[-*+]\s+\[([ xX])\]\s+(.*)$/))) return { kind: 'task', checked: x[1].toLowerCase() === 'x', indent, body: x[2] };
  if ((x = content.match(/^[-*+]\s+(.*)$/))) return { kind: 'bullet', indent, body: x[1] };
  if ((x = content.match(/^\d+[.)]\s+(.*)$/))) return { kind: 'ordered', indent, body: x[1] };
  return { kind: 'plain', indent, body: content };
}
function maxRun(value, char) { const matches = value.match(new RegExp(`${char === '`' ? '`' : '-'}+`, 'g')) || []; return matches.reduce((n, x) => Math.max(n, x.length), 0); }
function clamp(n, max) { return Math.max(0, Math.min(Number.isFinite(n) ? n : 0, max)); }
function replaceRange(text, start, end, replacement) { return text.slice(0, start) + replacement + text.slice(end); }
function result(markdown, selectionStart, selectionEnd) { return { markdown, selectionStart, selectionEnd }; }
const api = { applyCommand };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.AsterismCommands = api;
