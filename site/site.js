/* Asterism concept: real Markdown characters travel from source to typeset page, and the paper follows the wave.
   Parsing uses the vendored marked lexer. Output is built only with createElement/textContent. */
(function () {
  'use strict';
  var root = document.documentElement;
  var DEFAULT_MD = [
    '# Asterism',
    '',
    'A **local** Markdown reader and editor for the browser and Apple Silicon Macs, with a *source* pane that stays in sync.',
    '',
    '## Shortcuts',
    '',
    '| Key | Action |',
    '| --- | --- |',
    '| Cmd F | Find |',
    '| Cmd S | Save |',
    '| Cmd E | Read / Edit |',
    '',
    '## Read & revise',
    '',
    'Markdown opens as a formatted page. Source and formatted text stay together while you edit.',
    '',
    'Files open and save on your machine. Nothing is uploaded.',
    '',
    '***'
  ].join('\n');

  var stage = document.getElementById('stage');
  var paper = document.getElementById('paper');
  var spread = document.getElementById('spread');
  var doc = document.getElementById('doc');
  var lcSrc = document.getElementById('lcSrc'), lcRead = document.getElementById('lcRead');
  if (!stage || !paper || !spread || !doc || !window.marked) { root.classList.remove('js'); return; }
  var range = document.getElementById('range');
  var replay = document.getElementById('replay'), btnSrc = document.getElementById('toSrc'), btnRead = document.getElementById('toRead');
  var staticDoc = document.getElementById('static');
  var editToggle = document.getElementById('editToggle');
  var editPanel = document.getElementById('editPanel');
  var editArea = document.getElementById('editArea');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var W_WIN = 0.32;

  /* ---------- Markdown -> flat blocks of characters ---------- */
  function ch(c, o) { var r = { ch: c }; for (var k in o) r[k] = o[k]; return r; }
  function marks(str, kind, out) { Array.from(str).forEach(function (c) { out.push(ch(c, { mark: true, kind: kind })); }); }
  function text(str, st, out) {
    Array.from(str).forEach(function (c) { out.push(ch(c, { st: st, nl: c === '\n' })); });
  }
  function sub(st, k) { var n = {}; for (var a in st) n[a] = st[a]; n[k] = true; return n; }
  function rawOf(tokens) { return (tokens || []).map(function (t) { return t.raw; }).join(''); }

  function inline(tokens, st, out) {
    (tokens || []).forEach(function (t) {
      var raw = t.raw || '', inner, n;
      switch (t.type) {
        case 'strong': case 'em': case 'del':
          inner = rawOf(t.tokens); n = (raw.length - inner.length) / 2;
          if (n !== Math.floor(n) || n < 1) { text(raw, st, out); break; }
          marks(raw.slice(0, n), 'e', out);
          inline(t.tokens, sub(st, t.type === 'em' ? 'i' : t.type === 'strong' ? 'b' : 'd'), out);
          marks(raw.slice(raw.length - n), 'e', out);
          break;
        case 'codespan':
          n = (raw.match(/^`+/) || [''])[0].length;
          marks(raw.slice(0, n), 'c', out); text(raw.slice(n, raw.length - n), sub(st, 'c'), out); marks(raw.slice(raw.length - n), 'c', out);
          break;
        case 'link':
          inner = rawOf(t.tokens);
          if (raw.charAt(0) !== '[') { text(raw, st, out); break; }
          var ls = sub(st, 'l'); if (/^https?:\/\//i.test(t.href || '')) ls.href = t.href;
          marks('[', 'k', out); inline(t.tokens, ls, out); marks(raw.slice(1 + inner.length), 'k', out);
          break;
        case 'escape': marks('\\', 'e', out); text(raw.slice(1), st, out); break;
        case 'br': text('\n', st, out); break;
        default:
          if (t.type === 'text' && t.tokens) inline(t.tokens, st, out); else text(raw, st, out);
      }
    });
  }

  function walk(tokens, blocks, q) {
    var b;
    (tokens || []).forEach(function (t) {
      var chars = [], m;
      switch (t.type) {
        case 'space': return;
        case 'heading':
          m = (t.raw.match(/^#{1,6}[ \t]+/) || [''])[0];
          marks(m, 'h', chars); inline(t.tokens, {}, chars);
          blocks.push({ type: 'h', lvl: t.depth, chars: chars }); return;
        case 'paragraph':
          if (q) marks('> ', 'q', chars);
          inline(t.tokens, {}, chars);
          blocks.push({ type: q ? 'q' : 'p', chars: chars }); return;
        case 'blockquote': walk(t.tokens, blocks, true); return;
        case 'list':
          var first = blocks.length;
          t.items.forEach(function (it) {
            var c = [], mm = it.raw.match(/^(\s*)([-*+]|\d+[.)])([ \t]+)/);
            if (mm) {
              marks(mm[1], 'l', c);
              if (/\d/.test(mm[2])) { text(mm[2] + mm[3], { }, c); }
              else { c.push(ch(mm[2], { mark: true, kind: 'l', rg: '•', bullet: true })); marks(mm[3], 'l', c); }
            }
            var nested = [];
            it.tokens.forEach(function (x) {
              if (x.type === 'text') inline(x.tokens || [{ type: 'text', raw: x.raw }], {}, c);
              else if (x.type === 'list') walk([x], nested, false);
            });
            blocks.push({ type: 'p', li: true, chars: c });
            nested.forEach(function (nb) { blocks.push(nb); });
          });
          for (var i = blocks.length - 1; i >= first; i--) if (blocks[i].li) { blocks[i].lend = true; break; }
          return;
        case 'code':
          var open = (t.raw.match(/^ {0,3}(```|~~~)[^\n]*\n/) || [''])[0];
          if (open) marks(open, 'c', chars);
          var cs = chars.length; text(t.text, { c: true }, chars);
          for (var q2 = cs; q2 < chars.length; q2++) chars[q2].keepnl = true;
          if (open) marks(t.raw.slice(open.length + t.text.length), 'c', chars);
          blocks.push({ type: 'code', chars: chars }); return;
        case 'table':
          var rows = t.raw.replace(/\s+$/, '').split('\n');
          rows.forEach(function (line, li) {
            var c = [], delim = li === 1;
            line.split('|').forEach(function (seg, pi) {
              var cell = Math.max(0, pi - 1), from = c.length;
              if (pi > 0) marks('|', 'x', c);
              var mid = seg.trim();
              if (delim || !mid) marks(seg, 'x', c);
              else {
                var lead = seg.match(/^\s*/)[0], trail = seg.match(/\s*$/)[0];
                marks(lead, 'x', c); text(mid, {}, c); marks(trail, 'x', c);
              }
              for (var z = from; z < c.length; z++) c[z].cell = cell;
            });
            blocks.push({ type: 'tr', head: li === 0, delim: delim, lend: li === rows.length - 1, chars: c });
          });
          return;
        case 'hr':
          var k = 0;
          Array.from(t.raw.replace(/\s+$/, '')).forEach(function (c) {
            if (/\s/.test(c)) { chars.push(ch(c, { mark: true, kind: 'x' })); return; }
            k++;
            chars.push(ch(c, { mark: true, kind: 'x', rg: k <= 3 ? '*' : null, hrs: Math.min(k, 3), merge: k > 3 }));
          });
          blocks.push({ type: 'hr', chars: chars }); return;
        default:
          text((t.raw || '').replace(/\s+$/, ''), {}, chars);
          if (chars.length) blocks.push({ type: 'p', chars: chars });
      }
    });
  }

  function parse(src) {
    var blocks = [];
    try { walk(window.marked.lexer(src), blocks, false); } catch (e) { blocks = []; }
    return blocks;
  }

  /* ---------- helpers ---------- */
  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function rnd(i, k) { var x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); }
  function r2(n) { return Math.round(n * 100) / 100; }
  function rsClass(b, c) {
    var s = b.type === 'tr' ? (b.head ? 'rs-th' : c.cell === 0 ? 'rs-kc' : 'rs-p') : 'rs-' + (b.type === 'code' ? 'c' : b.li ? 'l' : b.type);
    if (b.type === 'h') s += ' lv' + b.lvl;
    if (b.lede) s += ' rs-lede';
    if (c.st) for (var k in c.st) s += ' st-' + k;
    if (c.bullet) s += ' bl';
    if (c.hrs) s += ' hrs hrs' + c.hrs;
    return s;
  }
  function readText(c) { return c.mark ? (c.rg || '') : c.nl && !c.keepnl ? ' ' : c.ch; }

  /* Roles for the read layout: headline, deck, the star mark, then two lanes balanced by weight. */
  function assign(list) {
    var i, units = [], cur = null, prev = '', total = 0, acc = 0;
    list.forEach(function (b) { b.role = null; b.lede = false; });
    var head = list[0] && list[0].type === 'h' && list[0].lvl === 1;
    if (head) list[0].role = 'head';
    if (head && list[1] && list[1].type === 'p' && !list[1].li) { list[1].role = 'lede'; list[1].lede = true; }
    for (i = 0; i < list.length; i++) if (list[i].type === 'hr') { list[i].role = 'star'; break; }
    list.forEach(function (b) {
      if (b.role) return;
      var kind = b.type === 'tr' ? 't' : b.li ? 'l' : b.type;
      if (!(cur && (cur.head || (kind === prev && (kind === 't' || kind === 'l'))))) { cur = { items: [], w: 0, head: false }; units.push(cur); }
      cur.items.push(b); cur.w += b.chars.length + 40; cur.head = b.type === 'h' && cur.items.length === 1; prev = kind;
    });
    units.forEach(function (u) { total += u.w; });
    units.forEach(function (u) { var lane = acc < total / 2 ? 'A' : 'B'; acc += u.w; u.items.forEach(function (b) { b.role = lane; }); });
  }

  function ghost(blocks, mode, w) {
    var g = el('div', 'ghost g-' + mode), spans = [], divs = [], lanes = null, laneEl = {};
    g.setAttribute('aria-hidden', 'true'); g.style.width = w + 'px';
    blocks.forEach(function (b) {
      var d = el('div', 'b b-' + b.type + (b.lvl ? ' lv' + b.lvl : '') + (b.li ? ' li' : '') + (b.lend ? ' lend' : '') + (b.head ? ' hd' : '') + (b.delim ? ' dl' : '') +
        (mode === 'read' && b.role ? ' rh-' + b.role : '') + (mode === 'read' && b.type === 'hr' && b.role !== 'star' ? ' sm' : '')), cells = [], par = g;
      b.chars.forEach(function (c) {
        var s = document.createElement('span'), t = mode === 'src' ? c.ch : readText(c), host = d;
        s.textContent = t;
        s.className = mode === 'read' ? rsClass(b, c) + (t === '' ? ' x' : '') : '';
        if (mode === 'read' && c.cell != null) { host = cells[c.cell] || (cells[c.cell] = d.appendChild(el('span', 'cell'))); }
        host.appendChild(s); spans.push(s);
      });
      if (mode === 'read' && (b.role === 'A' || b.role === 'B')) {
        if (!lanes) lanes = g.appendChild(el('div', 'rh-lanes'));
        par = laneEl[b.role] || (laneEl[b.role] = lanes.appendChild(el('div', 'lane lane-' + b.role)));
      }
      par.appendChild(d); divs.push(d);
    });
    return { g: g, spans: spans, divs: divs };
  }

  /* ---------- layout & live characters ---------- */
  var blocks = [], p = 0, anim = 0, ro = 0, geo = null;
  function pos(e) { var x = 0, y = 0; while (e && e !== spread) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; } return [x, y]; }
  function clearGhosts() { [lcSrc, lcRead].forEach(function (h) { Array.prototype.slice.call(h.querySelectorAll('.ghost')).forEach(function (n) { h.removeChild(n); }); }); }

  function build() {
    clearGhosts(); doc.textContent = '';
    var w1 = lcSrc.clientWidth || 400, w2 = lcRead.clientWidth || 500;
    var gs = ghost(blocks, 'src', w1), gr = ghost(blocks, 'read', w2);
    lcSrc.appendChild(gs.g); lcRead.appendChild(gr.g);
    var Hs = Math.max(gs.g.offsetHeight, 40), Hr = Math.max(gr.g.offsetHeight, 40);
    spread.style.height = Math.max(Math.max(Hs, Hr) + lcSrc.offsetTop + 28, 340) + 'px';
    var SW = Math.max(stage.offsetWidth, 1), SH = Math.max(stage.offsetHeight, 1), ox = spread.offsetLeft, oy = spread.offsetTop;
    var fsSrc = parseFloat(getComputedStyle(gs.g).fontSize) || 14;
    var frag = document.createDocumentFragment(), decoFrag = document.createDocumentFragment();
    var idx = 0, stars = {}, items = [], decos = [];
    blocks.forEach(function (b, bi) {
      var firstT = null, gdiv = gr.divs[bi];
      b.chars.forEach(function (c) {
        var i = idx++, sSpan = gs.spans[i], rSpan = gr.spans[i];
        var ps = pos(sSpan), xs = ps[0], ys = ps[1];
        var t = ((xs + ox) / SW + (ys + oy) / SH) / 2;
        if (firstT === null) firstT = t;
        if (c.hrs && !c.merge) stars[c.hrs] = i;
        var dx = 0, dy = 0, s = 1, hidden = !readText(c);
        if (c.merge && stars[3] != null) { rSpan = gr.spans[stars[3]]; hidden = false; }
        if (!hidden) {
          var pr = pos(rSpan);
          dx = pr[0] - xs; dy = pr[1] - ys;
          s = (parseFloat(getComputedStyle(rSpan).fontSize) || fsSrc) / fsSrc;
        }
        if (c.nl || /^\s$/.test(c.ch)) return;
        var e = el('span', 'c' + (c.mark && !c.rg ? ' mk' : '') + (c.merge ? ' mg' : '') + (c.kind ? ' k-' + c.kind : ''));
        e.style.cssText = 'left:' + r2(xs) + 'px;top:' + r2(ys) + 'px;--dx:' + r2(dx) + ';--dy:' + r2(dy) + ';--s:' + r2(s) +
          ';--rot:' + r2((rnd(i, 1) - .5) * 60) + ';--lift:' + r2(18 + rnd(i, 2) * 70) +
          ';--rx:' + r2((rnd(i, 3) - .5) * 90) + ';--ry:' + r2(-40 - rnd(i, 4) * 90);
        var m = el('i', 'm'); m.textContent = c.ch; e.appendChild(m);
        if (!c.mark || c.rg) { var r = el('i', 'r ' + rsClass(b, c)); r.textContent = c.mark ? c.rg : c.ch; e.appendChild(r); }
        frag.appendChild(e); items.push({ e: e, t: t });
      });
      if ((b.type === 'code' || (b.type === 'tr' && !b.delim)) && gdiv) {
        var pb = pos(gdiv), dc = el('div', b.type === 'code' ? 'deco cb' : 'deco rl' + (b.head ? ' hd' : ''));
        dc.style.cssText = 'left:' + r2(pb[0]) + 'px;top:' + r2(pb[1] + (b.type === 'code' ? 0 : gdiv.offsetHeight - 1)) + 'px;width:' + r2(gdiv.offsetWidth) + 'px;' +
          (b.type === 'code' ? 'height:' + r2(gdiv.offsetHeight) + 'px;' : '');
        decoFrag.appendChild(dc); decos.push({ e: dc, t: firstT || 0 });
      }
    });
    /* normalise the wave over the source's own extent so the whole timeline is used */
    var dmin = 1, dmax = 0;
    items.forEach(function (it) { dmin = Math.min(dmin, it.t); dmax = Math.max(dmax, it.t); });
    if (!items.length) { dmin = 0; dmax = 1; }
    var span = Math.max(dmax - dmin, .001);
    items.concat(decos).forEach(function (it) { it.e.style.setProperty('--d', r2(((it.t - dmin) / span) * 1000) / 1000); });
    geo = { W: SW, H: SH, dmin: dmin, dmax: dmax };
    doc.appendChild(decoFrag); doc.appendChild(frag);
    apply();
  }

  /* ---------- progress: a wavefront sweeps the source; characters leave in that order, and the paper follows it ---------- */
  function frontT(c) {
    var h = W_WIN / 2;
    if (c <= 0) return -.03 + (Math.max(c, -h) + h) / h * (geo.dmin + .03);
    if (c <= 1) return geo.dmin + (geo.dmax - geo.dmin) * c;
    return geo.dmax + (Math.min(c, 1 + h) - 1) / h * (1.04 - geo.dmax);
  }
  function clipFor(T) {
    var W = geo.W, H = geo.H, k = 2 * T, pts = [[0, 0], [W, 0], [W, H], [0, H]], out = [];
    function f(q) { return q[0] / W + q[1] / H - k; }
    for (var i = 0; i < 4; i++) {
      var a = pts[i], b = pts[(i + 1) % 4], fa = f(a), fb = f(b);
      if (fa <= 0) out.push(a);
      if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) { var u = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]); }
    }
    if (out.length < 3) return 'polygon(0 0,0 0,0 0)';
    return 'polygon(' + out.map(function (q) { return r2(q[0]) + 'px ' + r2(q[1]) + 'px'; }).join(',') + ')';
  }
  function apply() {
    var c = -W_WIN / 2 + p * (1 + W_WIN);
    spread.style.setProperty('--c', c);
    spread.style.setProperty('--w', W_WIN);
    if (geo) paper.style.clipPath = clipFor(frontT(c));
    range.value = Math.round(p * 1000);
    range.style.setProperty('--fill', (p * 100) + '%');
    range.setAttribute('aria-valuetext', p < .03 ? 'Markdown source' : p > .97 ? 'Typeset page' : Math.round(p * 100) + ' percent typeset');
    btnSrc.classList.toggle('on', p < .5); btnRead.classList.toggle('on', p >= .5);
  }

  function tween(to, ms) {
    cancelAnimationFrame(anim);
    if (reduce.matches || ms <= 0) { p = to; apply(); return; }
    var from = p, t0 = performance.now();
    (function step(now) {
      var t = Math.min(1, (now - t0) / ms), e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      p = from + (to - from) * e; apply();
      if (t < 1) anim = requestAnimationFrame(step);
    })(t0);
  }

  /* ---------- screen-reader copy (safe DOM) ---------- */
  function inlineInto(parent, chars) {
    var runs = [];
    chars.forEach(function (c) {
      if (c.mark && c.rg !== '\u2042') return;
      var st = c.st || {}, key = (st.href || '') + '|' + (st.b ? 1 : 0) + (st.i ? 1 : 0), t = readText(c), last = runs[runs.length - 1];
      if (last && last.key === key) last.t += t; else runs.push({ key: key, t: t, st: st });
    });
    runs.forEach(function (r) {
      var n = document.createTextNode(r.t);
      if (r.st.i) { var e = el('em'); e.appendChild(n); n = e; }
      if (r.st.b) { var s = el('strong'); s.appendChild(n); n = s; }
      if (r.st.href) { var a = el('a'); a.href = r.st.href; a.appendChild(n); n = a; }
      parent.appendChild(n);
    });
  }
  function cellsOf(b) {
    var out = [];
    b.chars.forEach(function (c) { if (c.cell == null || c.mark) return; out[c.cell] = (out[c.cell] || '') + readText(c); });
    return out;
  }
  function semantic() {
    staticDoc.textContent = '';
    var list = null, tbl = null, body = null;
    blocks.forEach(function (b) {
      var e;
      if (b.type === 'tr') {
        if (b.delim) return;
        if (!tbl) { tbl = el('table'); body = null; staticDoc.appendChild(tbl); }
        var tr = el('tr'), head = b.head;
        cellsOf(b).forEach(function (t) { var cell = el(head ? 'th' : 'td'); cell.textContent = t; tr.appendChild(cell); });
        if (head) { var th = el('thead'); th.appendChild(tr); tbl.appendChild(th); }
        else { if (!body) { body = el('tbody'); tbl.appendChild(body); } body.appendChild(tr); }
        if (b.lend) tbl = null;
        return;
      }
      if (b.li) {
        if (!list) { list = el('ul'); staticDoc.appendChild(list); }
        e = el('li'); inlineInto(e, b.chars); list.appendChild(e); if (b.lend) list = null; return;
      }
      list = null;
      if (b.type === 'hr') return;
      e = el(b.type === 'h' ? 'h' + Math.min(6, (b.lvl || 1) + 1) : b.type === 'q' ? 'blockquote' : b.type === 'code' ? 'pre' : 'p');
      if (b.type === 'q') { var qp = el('p'); inlineInto(qp, b.chars.filter(function (c) { return !(c.mark && c.kind === 'q'); })); e.appendChild(qp); }
      else if (b.type === 'code') e.textContent = b.chars.filter(function (c) { return !c.mark; }).map(function (c) { return c.ch; }).join('');
      else inlineInto(e, b.chars);
      staticDoc.appendChild(e);
    });
  }

  function load(src) { blocks = parse(src); assign(blocks); semantic(); build(); }

  /* ---------- wiring ---------- */
  range.addEventListener('input', function () { cancelAnimationFrame(anim); p = range.value / 1000; apply(); });
  document.getElementById('toSrc').addEventListener('click', function () { tween(0, 1800); });
  document.getElementById('toRead').addEventListener('click', function () { tween(1, 1800); });
  replay.addEventListener('click', function () { cancelAnimationFrame(anim); p = 0; apply(); if (reduce.matches) { p = 1; apply(); } else setTimeout(function () { tween(1, 3400); }, 250); });
  var editTimer = 0;
  editToggle.addEventListener('click', function () {
    var open = editPanel.hidden; editPanel.hidden = !open; editToggle.setAttribute('aria-expanded', String(open));
    if (open) editArea.focus();
  });
  editPanel.addEventListener('keydown', function (e) { if (e.key === 'Escape') { editToggle.click(); editToggle.focus(); } });
  editArea.addEventListener('input', function () { clearTimeout(editTimer); editTimer = setTimeout(function () { load(editArea.value); }, 200); });
  document.getElementById('editReset').addEventListener('click', function () { editArea.value = DEFAULT_MD; load(DEFAULT_MD); });
  window.addEventListener('resize', function () { clearTimeout(ro); ro = setTimeout(function () { build(); }, 150); });

  var fonts = document.fonts && document.fonts.load ? Promise.all([
    document.fonts.load('300 40px Newsreader'), document.fonts.load('400 20px Newsreader'),
    document.fonts.load('italic 300 40px Newsreader'), document.fonts.load('700 20px Newsreader'),
    document.fonts.load('800 100px "Bricolage Grotesque"'), document.fonts.load('600 14px "Bricolage Grotesque"')
  ]).catch(function () {}) : Promise.resolve();
  var timeout = new Promise(function (r) { setTimeout(r, 1500); });

  Promise.race([fonts.then(function () { return document.fonts.ready; }), timeout]).then(function () {
    try {
      editArea.value = DEFAULT_MD;
      load(DEFAULT_MD);
      root.classList.add('ready');
      if (reduce.matches) { p = 1; apply(); }
      else { p = 0; apply(); setTimeout(function () { tween(1, 3400); }, 450); }
    } catch (e) { root.classList.remove('js'); root.classList.remove('ready'); paper.style.clipPath = ''; if (window.console) console.error(e); }
  });
})();
