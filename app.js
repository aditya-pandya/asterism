const STORAGE_KEYS = {
    document: 'inkdown.doc',
    documentMeta: 'inkdown.docMeta',
    draftSnapshot: 'inkdown.draftSnapshot',
    preferences: 'inkdown.prefs',
    oldSettings: 'inkdown_settings',
    oldContent: 'inkdown_content',
    legacySettings: 'rtmd_settings',
    legacyContent: 'rtmd_content'
};

const DEFAULT_PREFERENCES = Object.freeze({
    appearance: 'light',
    lightTheme: 'default',
    darkTheme: 'midnight',
    flavor: 'GFM',
    readerWidth: '72',
    smartQuotes: true,
    textSize: '16',
    autoSave: true,
    outlineHidden: false
});

const SETTING_DEFINITIONS = [
    { key: 'appearance', name: 'Appearance', values: ['light', 'dark', 'auto'], labels: ['Light', 'Dark', 'Auto'] },
    { key: 'lightTheme', name: 'Light theme', values: ['default', 'paper', 'sage'], labels: ['Default', 'Paper', 'Sage'] },
    { key: 'darkTheme', name: 'Dark theme', values: ['midnight', 'onyx', 'ember'], labels: ['Midnight', 'Onyx', 'Ember'] },
    { key: 'flavor', name: 'Markdown', values: ['GFM', 'CommonMark'] },
    { key: 'readerWidth', name: 'Reader width', values: ['60', '72', 'Full'] },
    { key: 'smartQuotes', name: 'Smart quotes', values: [true, false], labels: ['On', 'Off'] },
    { key: 'textSize', name: 'Text size', values: ['14', '16', '18'] },
    { key: 'autoSave', name: 'Auto-save', values: [true, false], labels: ['On', 'Off'] }
];

const ALLOWED_TAGS = new Set([
    'A', 'B', 'BLOCKQUOTE', 'BR', 'CODE', 'DEL', 'DIV', 'EM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'HR', 'I', 'IMG', 'LI', 'OL', 'P', 'PRE', 'S', 'STRIKE', 'STRONG', 'TABLE', 'TBODY', 'TD',
    'TFOOT', 'TH', 'THEAD', 'TR', 'U', 'UL'
]);

const state = {
    preferences: { ...DEFAULT_PREFERENCES },
    markdown: '',
    view: 'edit',
    settingsOpen: false,
    clearArmed: false,
    justCleared: false,
    copied: false,
    currentFileName: '',
    currentFilePath: '',
    currentFileKind: '',
    lastSavedMarkdown: '',
    lastDiskContent: '',
    fileConflict: false,
    recoveredDocument: false,
    recoveredSourcePath: '',
    recoveryBaseline: null,
    recoveryLastSavedMarkdown: '',
    recoveryKind: '',
    documentRevision: 0,
    undoMarkdown: null,
    undoFileName: '',
    undoFilePath: '',
    undoFileKind: '',
    undoLastSavedMarkdown: '',
    undoLastDiskContent: '',
    undoFileConflict: false,
    undoRecoveredDocument: false,
    undoRecoveredSourcePath: '',
    undoRecoveryBaseline: null,
    undoRecoveryLastSavedMarkdown: '',
    undoRecoveryKind: '',
    dragDepth: 0,
    lastFocusedElement: null,
    lastEditor: 'rich',
    findOpen: false,
    replaceOpen: false,
    findQuery: '',
    findMatches: [],
    findIndex: -1,
    findRangeAt: null,
    replacementUndoMarkdown: null,
    replacementRedoMarkdown: null,
    replacementNativeUndo: false,
    programmaticReplace: false,
    richEditAllowed: false,
    sourceOnlySnapshot: null,
    sourceGuardMode: ''
};

const elements = {
    app: document.getElementById('app'),
    wordmarkStrip: document.getElementById('wordmarkStrip'),
    editView: document.getElementById('editView'),
    richPane: document.getElementById('richPane'),
    richEditor: document.getElementById('richEditor'),
    sourceGuard: document.getElementById('sourceGuard'),
    richHelpButton: document.getElementById('richHelpButton'),
    markdownPane: document.getElementById('markdownPane'),
    markdownEditor: document.getElementById('markdownEditor'),
    markdownHighlight: document.getElementById('markdownHighlight'),
    readerView: document.getElementById('readerView'),
    readerContent: document.getElementById('readerContent'),
    documentStats: document.getElementById('documentStats'),
    hintText: document.getElementById('hintText'),
    reconnectFileButton: document.getElementById('reconnectFileButton'),
    clearButton: document.getElementById('clearButton'),
    openButton: document.getElementById('openButton'),
    viewEditButton: document.getElementById('viewEditButton'),
    viewReadButton: document.getElementById('viewReadButton'),
    settingsButton: document.getElementById('settingsButton'),
    settingsClose: document.getElementById('settingsClose'),
    themeButton: document.getElementById('themeButton'),
    pasteButton: document.getElementById('pasteButton'),
    emptyState: document.getElementById('emptyState'),
    emptyPasteButton: document.getElementById('emptyPasteButton'),
    emptyOpenButton: document.getElementById('emptyOpenButton'),
    docName: document.getElementById('docName'),
    toast: document.getElementById('toast'),
    copyButton: document.getElementById('copyButton'),
    downloadButton: document.getElementById('downloadButton'),
    fileInput: document.getElementById('fileInput'),
    dragOverlay: document.getElementById('dragOverlay'),
    settingsOverlay: document.getElementById('settingsOverlay'),
    settingsBackdrop: document.getElementById('settingsBackdrop'),
    settingsRows: document.getElementById('settingsRows'),
    clearSavedButton: document.getElementById('clearSavedButton'),
    statusMessage: document.getElementById('statusMessage'),
    findBar: document.getElementById('findBar'),
    findInput: document.getElementById('findInput'),
    findScope: document.getElementById('findScope'),
    findCount: document.getElementById('findCount'),
    findPrevious: document.getElementById('findPrevious'),
    findNext: document.getElementById('findNext'),
    findClose: document.getElementById('findClose'),
    replaceMain: document.getElementById('replaceMain'),
    replaceInput: document.getElementById('replaceInput'),
    replaceOne: document.getElementById('replaceOne'),
    replaceAll: document.getElementById('replaceAll'),
    replaceUndo: document.getElementById('replaceUndo'),
    linkDialog: document.getElementById('linkDialog'),
    linkInput: document.getElementById('linkInput'),
    linkError: document.getElementById('linkError'),
    linkCancel: document.getElementById('linkCancel'),
    jumpButton: document.getElementById('jumpButton'),
    jumpOverlay: document.getElementById('jumpOverlay'),
    jumpBackdrop: document.getElementById('jumpBackdrop'),
    jumpInput: document.getElementById('jumpInput'),
    jumpList: document.getElementById('jumpList'),
    jumpEmpty: document.getElementById('jumpEmpty'),
    copyFormattedButton: document.getElementById('copyFormattedButton'),
    linkFolderButton: document.getElementById('linkFolderButton'),
    shortcutList: document.getElementById('shortcutList'),
    shortcutsHeading: document.getElementById('shortcutsHeading'),
    outlineButton: document.getElementById('outlineButton'),
    outlinePanel: document.getElementById('outlinePanel'),
    outlineList: document.getElementById('outlineList'),
    outlineEmpty: document.getElementById('outlineEmpty'),
    outlineClose: document.getElementById('outlineClose'),
    outlineBackdrop: document.getElementById('outlineBackdrop')
};

let turndownService = null;
let highlightLoadPromise = null;
let clearArmTimer = null;
let undoTimer = null;
let copiedTimer = null;
let savedDataTimer = null;
let toastTimer = null;
const localImageCache = new Map();
// Browser file access (File System Access API). Handles live only in memory and are never persisted.
const browserFiles = !window.desktopBridge && window.AsterismBrowserFiles?.create ? window.AsterismBrowserFiles.create() : null;
let browserDocument = null;
let undoBrowserDocument = null;
let browserFolderLinked = false;
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const MOTION_EASE = 'cubic-bezier(.4,0,.2,1)';

function softEnter(element, { duration = 180, rise = 4 } = {}) {
    if (reducedMotion.matches || !element?.animate) return;
    element.animate([
        { opacity: 0, transform: `translateY(${rise}px)` },
        { opacity: 1, transform: 'translateY(0)' }
    ], { duration, easing: MOTION_EASE });
}

let themeTransitionTimer = null;

function animateThemeChange() {
    if (reducedMotion.matches) return;
    const root = document.documentElement;
    root.classList.add('theme-transition');
    clearTimeout(themeTransitionTimer);
    themeTransitionTimer = setTimeout(() => root.classList.remove('theme-transition'), 260);
}

let lastStats = null;
let lastStatsNudge = 0;

function nudgeStats(words, characters) {
    const previous = lastStats;
    lastStats = { words, characters };
    if (!previous || reducedMotion.matches || !elements.documentStats.animate) return;
    if (previous.words === words && previous.characters === characters) return;
    // Plain typing changes the character count every keystroke: only nudge on a new word or a bulk change.
    const bulk = Math.abs(characters - previous.characters) > 1;
    if (previous.words === words && !bulk) return;
    const now = performance.now();
    if (now - lastStatsNudge < 400) return;
    lastStatsNudge = now;
    elements.documentStats.animate([
        { opacity: 1 },
        { opacity: 0.5, offset: 0.4 },
        { opacity: 1 }
    ], { duration: 180, easing: MOTION_EASE });
}

let lastSyncPulse = 0;

function pulseSyncMark() {
    if (reducedMotion.matches) return;
    const now = performance.now();
    if (now - lastSyncPulse < 900) return;
    lastSyncPulse = now;
    const mark = document.querySelector('.sync-mark svg');
    mark?.animate?.([
        { opacity: 0.35, transform: 'rotate(-90deg)' },
        { opacity: 1, transform: 'rotate(0)' }
    ], { duration: 220, easing: MOTION_EASE });
}
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function safeUrl(value, image = false) {
    const url = String(value || '').trim();
    if (!url) return '';
    if (url.startsWith('#') || (url.startsWith('/') && !url.startsWith('//'))) return url;
    if (isRelativeResource(url)) return url;
    if (image && /^data:image\/(png|gif|jpe?g|webp);base64,/i.test(url)) return url;
    try {
        const parsed = new URL(url, window.location.href);
        const protocols = image ? ['http:', 'https:', 'file:'] : ['http:', 'https:', 'mailto:'];
        return protocols.includes(parsed.protocol) ? url : '';
    } catch {
        return '';
    }
}

function promoteInlineStyles(root) {
    root.querySelectorAll('[style]').forEach((node) => {
        const style = node.getAttribute('style') || '';
        const wrappers = [];
        if (/font-weight\s*:\s*(bold|[5-9]00)/i.test(style)) wrappers.push('strong');
        if (/font-style\s*:\s*italic/i.test(style)) wrappers.push('em');
        if (/text-decoration[^;]*(line-through|strikethrough)/i.test(style)) wrappers.push('del');
        if (/text-decoration[^;]*underline/i.test(style)) wrappers.push('u');
        wrappers.forEach((tagName) => {
            const wrapper = document.createElement(tagName);
            while (node.firstChild) wrapper.appendChild(node.firstChild);
            node.appendChild(wrapper);
        });
    });
}

function safeCodeLanguage(node) {
    if (node?.tagName !== 'CODE') return '';
    const classes = String(node.getAttribute('class') || '').split(/\s+/);
    const language = classes.find((className) => /^language-[a-z0-9_+#.-]{1,32}$/i.test(className));
    return language || '';
}

function sanitizeHtml(html, { preserveStyles = false } = {}) {
    const template = document.createElement('template');
    template.innerHTML = String(html || '');
    if (preserveStyles) promoteInlineStyles(template.content);

    const nodes = Array.from(template.content.querySelectorAll('*')).reverse();
    nodes.forEach((node) => {
        if (node.tagName === 'INPUT' && node.getAttribute('type')?.toLowerCase() === 'checkbox') {
            const checked = node.hasAttribute('checked');
            Array.from(node.attributes).forEach((attribute) => node.removeAttribute(attribute.name));
            node.setAttribute('type', 'checkbox');
            node.setAttribute('disabled', '');
            if (checked) node.setAttribute('checked', '');
            return;
        }
        if (!ALLOWED_TAGS.has(node.tagName)) {
            if (/^(SCRIPT|STYLE|LINK|META|IFRAME|OBJECT|EMBED|FORM|INPUT|BUTTON|SVG|CANVAS)$/i.test(node.tagName)) {
                node.remove();
            } else {
                node.replaceWith(...node.childNodes);
            }
            return;
        }

        const href = node.tagName === 'A' ? safeUrl(node.getAttribute('href')) : '';
        const src = node.tagName === 'IMG' ? safeUrl(node.getAttribute('src'), true) : '';
        const alt = node.tagName === 'IMG' ? node.getAttribute('alt') : '';
        const title = ['A', 'IMG'].includes(node.tagName) ? node.getAttribute('title') : '';
        const codeLanguage = safeCodeLanguage(node);
        const align = ['TH', 'TD'].includes(node.tagName) ? String(node.getAttribute('align') || '').trim().toLowerCase() : '';
        Array.from(node.attributes).forEach((attribute) => node.removeAttribute(attribute.name));
        if (['left', 'right', 'center'].includes(align)) node.setAttribute('align', align);
        if (href) {
            node.setAttribute('href', href);
            node.setAttribute('rel', 'noreferrer');
            node.setAttribute('target', '_blank');
        }
        if (src) node.setAttribute('src', src);
        if (alt) node.setAttribute('alt', alt);
        if (title) node.setAttribute('title', title);
        if (codeLanguage) node.setAttribute('class', codeLanguage);
    });

    return template.innerHTML;
}

function createTurndownService() {
    if (typeof TurndownService === 'undefined') return null;
    const fencedPreReplacement = (node, options) => {
        const code = node.textContent.replace(/\n$/, '');
        const language = safeCodeLanguage(node.querySelector('code')).replace(/^language-/i, '');
        const longest = Math.max(0, ...(code.match(/`+/g) || []).map((run) => run.length));
        const fence = '`'.repeat(Math.max(3, longest + 1));
        return `\n\n${fence}${language ? ` ${language}` : ''}\n${code}\n${fence}\n\n`;
    };
    const service = new TurndownService({
        headingStyle: 'atx',
        hr: '---',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
        fence: '```',
        emDelimiter: '*',
        strongDelimiter: '**',
        blankReplacement(content, node, options) {
            return node.nodeName === 'PRE' ? fencedPreReplacement(node, options) : (node.isBlock ? '\n\n' : '');
        }
    });

    if (state.preferences.flavor === 'GFM' && typeof turndownPluginGfm !== 'undefined') {
        service.use(turndownPluginGfm.gfm);
    }

    service.addRule('paperListItem', {
        filter: 'li',
        replacement(content, node, options) {
            let item = content
                .replace(/^\n+/, '')
                .replace(/\n+$/, '\n')
                .replace(/\n/g, '\n    ');
            const parent = node.parentNode;
            let prefix = `${options.bulletListMarker} `;
            if (parent.nodeName === 'OL') {
                const start = parent.getAttribute('start');
                const index = Array.prototype.indexOf.call(parent.children, node);
                prefix = `${start ? Number(start) + index : index + 1}. `;
            }
            item = item.replace(/^\[([ xX])\]\s+/, '[$1] ');
            return prefix + item + (node.nextSibling && !/\n$/.test(item) ? '\n' : '');
        }
    });

    service.addRule('paperFencedCodeBlock', {
        filter: 'pre',
        replacement(content, node, options) {
            return fencedPreReplacement(node, options);
        }
    });

    service.addRule('paperTaskCheckbox', {
        filter(node) {
            return node.nodeName === 'INPUT' && String(node.getAttribute('type')).toLowerCase() === 'checkbox' &&
                node.parentNode?.nodeName === 'LI';
        },
        replacement(content, node) {
            return node.checked || node.hasAttribute('checked') ? '[x] ' : '[ ] ';
        }
    });

    service.addRule('underline', {
        filter: 'u',
        replacement(content) {
            return content.trim() ? `<u>${content}</u>` : content;
        }
    });

    service.addRule('paperStrikethrough', {
        filter: ['del', 's', 'strike'],
        replacement(content) {
            if (!content.trim()) return content;
            return state.preferences.flavor === 'GFM' ? `~~${content}~~` : `<del>${content}</del>`;
        }
    });

    return service;
}

function configureConverters() {
    turndownService = createTurndownService();
    if (typeof marked !== 'undefined') {
        const isGfm = state.preferences.flavor === 'GFM';
        marked.setOptions({
            gfm: isGfm,
            breaks: isGfm,
            mangle: false,
            headerIds: false
        });
    }
}

function markdownToHtml(markdown) {
    if (typeof marked === 'undefined') return '<p>Marked failed to load.</p>';
    try {
        return sanitizeHtml(marked.parse(String(markdown || '')));
    } catch (error) {
        console.error('Markdown conversion failed:', error);
        return '<p>Unable to render this Markdown.</p>';
    }
}

function richHtmlToMarkdown() {
    if (!turndownService) return elements.richEditor.innerText || '';
    const source = elements.richEditor.cloneNode(true);
    source.querySelectorAll('img[data-asterism-relative-src]').forEach((image) => {
        image.setAttribute('src', image.getAttribute('data-asterism-relative-src'));
        image.removeAttribute('data-asterism-relative-src');
    });
    const normalized = sanitizeHtml(source.innerHTML, { preserveStyles: true });
    try {
        return turndownService.turndown(normalized).trim();
    } catch (error) {
        console.error('Rich text conversion failed:', error);
        return elements.richEditor.innerText || '';
    }
}

function applyHighlightTheme() {
    const mode = resolvedTheme();
    const stylesheet = document.getElementById('highlight-theme');
    if (!stylesheet) return;
    const fileName = mode === 'dark' ? 'github-dark.min.css' : 'github.min.css';
    const href = `vendor/highlight/${fileName}`;
    if (stylesheet.getAttribute('href') !== href) stylesheet.setAttribute('href', href);
}

function loadHighlightAssets() {
    if (typeof hljs !== 'undefined') return Promise.resolve();
    if (highlightLoadPromise) return highlightLoadPromise;

    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.id = 'highlight-theme';
    stylesheet.href = `vendor/highlight/${resolvedTheme() === 'dark' ? 'github-dark.min.css' : 'github.min.css'}`;
    document.head.appendChild(stylesheet);
    applyHighlightTheme();

    highlightLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'vendor/highlight.min.js';
        script.async = true;
        script.addEventListener('load', resolve, { once: true });
        script.addEventListener('error', () => reject(new Error('Unable to load highlight.js')), { once: true });
        document.head.appendChild(script);
    });
    return highlightLoadPromise;
}

function applyCodeHighlighting(root) {
    root.querySelectorAll('pre code').forEach((block) => {
        try {
            hljs.highlightElement(block);
        } catch (error) {
            console.warn('Code highlighting failed:', error);
        }
    });
}

function highlightCode(root) {
    if (!root.querySelector('pre code')) return;
    if (typeof hljs !== 'undefined') {
        applyCodeHighlighting(root);
        return;
    }
    loadHighlightAssets()
        .then(() => applyCodeHighlighting(root))
        .catch((error) => console.warn('Code highlighting unavailable:', error));
}

function renderInlineMarkers(text) {
    return escapeHtml(text).replace(/(\*\*|__|~~|`+)/g, '<span class="syntax-marker">$1</span>');
}

function renderMarkdownLine(line) {
    if (/^\s*```/.test(line) || /^\s*(---+|___+|\*\*\*+)\s*$/.test(line)) {
        return `<span class="syntax-marker">${escapeHtml(line)}</span>`;
    }

    const prefix = line.match(/^(\s*(?:#{1,6}\s+|>\s+|[-+*]\s+|\d+[.)]\s+))/);
    if (!prefix) return renderInlineMarkers(line);
    return `<span class="syntax-marker">${escapeHtml(prefix[0])}</span>${renderInlineMarkers(line.slice(prefix[0].length))}`;
}

function renderMarkdownHighlight() {
    elements.markdownHighlight.innerHTML = state.markdown.split('\n').map(renderMarkdownLine).join('\n');
    syncMarkdownScroll();
}

function syncMarkdownScroll() {
    elements.markdownHighlight.scrollTop = elements.markdownEditor.scrollTop;
    elements.markdownHighlight.scrollLeft = elements.markdownEditor.scrollLeft;
}

function getMarkdownEditorText() {
    const text = (elements.markdownEditor.innerText || '').replace(/\r/g, '');
    return text === '\n' ? '' : text;
}

// The sanitizer emits disabled checkboxes; only the rich pane makes list-item ones interactive.
function enableRichTasks() {
    elements.richEditor.querySelectorAll('li > input[type="checkbox"]').forEach((box) => {
        box.removeAttribute('disabled');
        box.setAttribute('aria-label', 'Task done');
    });
}

function toggleRichTask(box) {
    const next = !box.hasAttribute('checked');
    const selection = window.getSelection();
    const saved = selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
    elements.richEditor.focus({ preventScroll: true });
    const target = document.createRange();
    target.selectNode(box);
    selection.removeAllRanges();
    selection.addRange(target);
    const done = document.execCommand('insertHTML', false,
        `<input type="checkbox" aria-label="Task done"${next ? ' checked=""' : ''}>`);
    if (!done) {
        // Fallback without native history: mutate directly and sync.
        selection.removeAllRanges();
        if (next) box.setAttribute('checked', '');
        else box.removeAttribute('checked');
        box.checked = next;
        syncFromRich();
    }
    enableRichTasks();
    if (saved && saved.startContainer.isConnected && saved.endContainer.isConnected) {
        selection.removeAllRanges();
        selection.addRange(saved);
    }
}

function renderRichFromMarkdown() {
    elements.richEditor.innerHTML = markdownToHtml(state.markdown);
    enableRichTasks();
    hydrateLocalImages(elements.richEditor);
    highlightCode(elements.richEditor);
}

let sourceOnlyCacheText = null;
let sourceOnlyCacheResult = null;

function findSourceOnlyMarkdown(markdown) {
    const source = String(markdown || '');
    if (source === sourceOnlyCacheText && sourceOnlyCacheResult) return sourceOnlyCacheResult;
    const lines = source.split('\n');
    const found = { comments: 0, references: 0, footnotes: 0, frontMatter: 0, html: 0, fenceInfo: 0 };
    let fence = '';
    let frontMatterEnd = -1;
    if (/^---\s*$/.test(lines[0] || '')) {
        const end = lines.slice(1).findIndex((part) => /^(---|\.\.\.)\s*$/.test(part));
        if (end >= 0) {
            found.frontMatter = 1;
            frontMatterEnd = end + 1;
        }
    }
    lines.forEach((line, index) => {
        if (index <= frontMatterEnd) return;
        const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
        if (fence) {
            const close = line.match(/^ {0,3}(`+|~+)[ ]*$/);
            if (close && close[1][0] === fence[0] && close[1].length >= fence.length) fence = '';
            return;
        }
        if (fenceMatch) {
            fence = fenceMatch[1];
            const info = fenceMatch[2].trim();
            if (info && !/^[A-Za-z0-9_+#.-]{1,32}$/.test(info)) found.fenceInfo += 1;
            return;
        }
        if (/^(?: {4,}|\t)/.test(line)) return;
        if (/^\s{0,3}\[\^[^\]]+\]:/.test(line)) found.footnotes += 1;
        else if (/^\s{0,3}\[[^\]]+\]:/.test(line)) {
            const hasInlineDestination = /^\s{0,3}\[[^\]]+\]:\s*\S/.test(line);
            const hasContinuation = /^\s+\S/.test(lines[index + 1] || '');
            if (hasInlineDestination || hasContinuation) found.references += 1;
        }
    });
    if (typeof marked !== 'undefined' && typeof marked.lexer === 'function') {
        const markdownBody = frontMatterEnd >= 0 ? lines.slice(frontMatterEnd + 1).join('\n') : source;
        const countHtmlTokens = (value) => {
            if (Array.isArray(value)) {
                value.forEach(countHtmlTokens);
                return;
            }
            if (!value || typeof value !== 'object') return;
            if (value.type === 'html') {
                const raw = String(value.raw || value.text || '');
                found.comments += (raw.match(/<!--/g) || []).length;
                if (raw.replace(/<!--[\s\S]*?-->/g, '').trim()) found.html += 1;
            }
            Object.values(value).forEach((child) => {
                if (Array.isArray(child) || (child && typeof child === 'object')) countHtmlTokens(child);
            });
        };
        try {
            countHtmlTokens(marked.lexer(markdownBody));
        } catch (error) {
            console.warn('Unable to inspect Markdown HTML tokens:', error);
        }
    }
    sourceOnlyCacheText = source;
    sourceOnlyCacheResult = found;
    return found;
}

function sourceOnlyCount(found) {
    return found.comments + found.references + found.footnotes + found.frontMatter + found.html + found.fenceInfo;
}

function sourceOnlyDescription(found) {
    const parts = [];
    [['comments', 'comment', 'comments'], ['references', 'link definition', 'link definitions'], ['footnotes', 'footnote definition', 'footnote definitions']]
        .forEach(([key, singular, plural]) => {
            if (found[key]) parts.push(`${found[key]} ${found[key] === 1 ? singular : plural}`);
        });
    if (found.html) parts.push(`${found.html} HTML fragment${found.html === 1 ? '' : 's'}`);
    if (found.fenceInfo) parts.push(`${found.fenceInfo} code fence option${found.fenceInfo === 1 ? '' : 's'}`);
    if (found.frontMatter) parts.push(`${found.frontMatter} YAML front matter block${found.frontMatter === 1 ? '' : 's'}`);
    return parts.join(', ').replace(/, ([^,]*)$/, ' and $1');
}

function hideSourceGuard() {
    elements.richHelpButton.setAttribute('aria-expanded', 'false');
    elements.sourceGuard.hidden = true;
    elements.sourceGuard.replaceChildren();
    state.sourceGuardMode = '';
}

function showSourceGuard(mode, { focus = false } = {}) {
    const found = findSourceOnlyMarkdown(state.markdown);
    if (!sourceOnlyCount(found) && mode !== 'help' && mode !== 'converted') {
        hideSourceGuard();
        return;
    }
    const guard = elements.sourceGuard;
    guard.replaceChildren();
    guard.hidden = false;
    guard.className = `source-guard${mode === 'help' ? ' is-help' : ''}${mode === 'converted' ? ' is-converted' : ''}`;
    guard.setAttribute('role', mode === 'warning' ? 'alert' : 'status');
    guard.setAttribute('aria-live', mode === 'warning' ? 'assertive' : 'polite');
    elements.richHelpButton.setAttribute('aria-expanded', 'false');
    if (mode === 'help') {
        const text = document.createElement('p');
        text.textContent = 'Formatted edits can simplify comments, link and footnote definitions, and YAML front matter. The Markdown pane preserves exact source.';
        guard.append(text);
        state.sourceGuardMode = mode;
        return;
    }
    if (mode === 'converted') {
        const text = document.createElement('p');
        text.textContent = 'The formatted view has converted some Markdown syntax. Restore replaces all formatted edits made since conversion.';
        const restore = document.createElement('button');
        restore.type = 'button';
        restore.className = 'button source-guard-primary';
        restore.textContent = 'Restore original Markdown';
        restore.addEventListener('click', () => {
            const original = state.sourceOnlySnapshot;
            state.sourceOnlySnapshot = null;
            state.richEditAllowed = false;
            hideSourceGuard();
            if (original !== null) setDocumentFromMarkdown(original);
            elements.markdownEditor.focus();
        });
        guard.append(text, restore);
        state.sourceGuardMode = mode;
        return;
    }
    const title = document.createElement('strong');
    title.textContent = 'The formatted view can’t keep some of this document’s syntax.';
    const detail = document.createElement('p');
    detail.textContent = `Editing here may remove or rewrite ${sourceOnlyDescription(found)}. The Markdown pane keeps everything.`;
    const copy = document.createElement('div');
    copy.className = 'source-guard-copy';
    copy.append(title, detail);
    const actions = document.createElement('div');
    actions.className = 'source-guard-actions';
    const safe = document.createElement('button');
    safe.type = 'button';
    safe.className = 'button button-primary source-guard-primary';
    safe.textContent = 'Edit in Markdown';
    safe.addEventListener('click', () => {
        hideSourceGuard();
        elements.markdownEditor.focus();
    });
    const anyway = document.createElement('button');
    anyway.type = 'button';
    anyway.className = 'button source-guard-secondary';
    anyway.textContent = 'Edit here anyway';
    anyway.addEventListener('click', () => {
        state.richEditAllowed = true;
        hideSourceGuard();
        elements.richEditor.focus();
    });
    actions.append(safe, anyway);
    guard.append(copy, actions);
    state.sourceGuardMode = mode;
    elements.richHelpButton.setAttribute('aria-expanded', 'false');
    if (focus) safe.focus();
}

function blockRichMutation(event) {
    if (state.richEditAllowed || !sourceOnlyCount(findSourceOnlyMarkdown(state.markdown))) return false;
    if (event?.cancelable) event.preventDefault();
    if (state.sourceGuardMode !== 'warning') showSourceGuard('warning', { focus: true });
    return true;
}

// aria-disabled instead of the disabled attribute: a disabled button drops keyboard focus to <body>.
// Handlers already no-op (or announce) on an empty document.
function setActionEnabled(button, enabled) {
    if (enabled) button.removeAttribute('aria-disabled');
    else button.setAttribute('aria-disabled', 'true');
}

function updateStats() {
    const text = elements.richEditor.innerText || '';
    const words = (text.trim().match(/\S+/g) || []).length;
    const characters = text.replace(/\n/g, '').length;
    elements.documentStats.textContent = `${words.toLocaleString()} ${words === 1 ? 'word' : 'words'} · ${characters.toLocaleString()} ${characters === 1 ? 'character' : 'characters'}`;
    nudgeStats(words, characters);
    setActionEnabled(elements.copyButton, Boolean(state.markdown));
    setActionEnabled(elements.downloadButton, Boolean(state.markdown || state.currentFilePath));
    renderEmptyState();
    renderClearState();
    scheduleOutline();
}

let emptyShown = false;
let emptyWasEmpty = false;
let emptyEntrancePending = true;

function playEmptyEntrance() {
    if (reducedMotion.matches) return;
    const empty = elements.emptyState;
    empty.classList.remove('is-entering');
    void empty.offsetWidth;
    empty.classList.add('is-entering');
}

function renderEmptyState() {
    const isEmpty = !state.markdown && !elements.richEditor.innerText.trim();
    const show = isEmpty && !elements.richPane.classList.contains('is-focused');
    // Staggered entrance on first load and when the document becomes empty, not on every focus/blur.
    if (isEmpty && !emptyWasEmpty) emptyEntrancePending = true;
    if (!isEmpty) emptyEntrancePending = false;
    emptyWasEmpty = isEmpty;
    elements.emptyState.hidden = !show;
    if (!show) {
        elements.emptyState.classList.remove('is-entering');
    } else if (!emptyShown && emptyEntrancePending) {
        emptyEntrancePending = false;
        playEmptyEntrance();
    }
    emptyShown = show;
}

function renderDocName() {
    elements.docName.textContent = state.currentFileName + (state.recoveredDocument ? ' (recovered)' : state.currentFilePath &&
        (state.markdown !== state.lastSavedMarkdown || state.fileConflict) ? ' •' : '');
    elements.docName.hidden = !state.currentFileName;
    document.title = state.currentFileName ? `${state.currentFileName} · Asterism` : 'Asterism';
    const savesToSource = Boolean(state.currentFilePath && state.currentFileKind === 'markdown');
    elements.downloadButton.title = savesToSource ? 'Save  ⌘S' : 'Save as .md  ⌘S';
    elements.downloadButton.setAttribute('aria-label', savesToSource ? 'Save file' : 'Save Markdown');
}

function hasUnpersistedDocument() {
    if (state.preferences.autoSave) return false;
    if (state.currentFileName) return state.recoveredDocument || state.markdown !== state.lastSavedMarkdown;
    return Boolean(state.markdown);
}

function renderStatusHint() {
    window.desktopBridge?.setUnsavedState?.({ needsPrompt: hasUnpersistedDocument() });
    if (state.copied) return;
    elements.reconnectFileButton.hidden = !(state.recoveredDocument && state.recoveredSourcePath &&
        state.recoveryKind === 'markdown' && typeof state.recoveryBaseline === 'string' && window.desktopBridge?.openFile);
    if (state.recoveredDocument) {
        elements.hintText.textContent = state.recoveredSourcePath && window.desktopBridge
            ? 'Recovered draft · reconnect the original file or Save As'
            : 'Recovered draft · Save As to keep it';
    } else if (state.fileConflict) {
        elements.hintText.textContent = 'File changed outside Asterism · Save to resolve';
    } else if (state.currentFilePath && state.currentFileKind !== 'markdown') {
        elements.hintText.textContent = 'Imported document · save as Markdown to keep edits';
    } else if (state.currentFilePath && state.markdown !== state.lastSavedMarkdown) {
        elements.hintText.textContent = state.preferences.autoSave
            ? 'Unsaved file changes · recovery saved on this device'
            : 'Unsaved file changes';
    } else if (state.currentFilePath) {
        elements.hintText.textContent = 'File saved';
    } else {
        elements.hintText.textContent = state.preferences.autoSave ? 'Saved on this device'
            : state.markdown ? 'Unsaved document · Save to keep it' : 'Auto-save off';
    }
}

function persistDocument() {
    if (!state.preferences.autoSave) return;
    try {
        localStorage.setItem(STORAGE_KEYS.document, state.markdown);
        localStorage.setItem(STORAGE_KEYS.documentMeta, JSON.stringify({ name: state.currentFileName }));
        const snapshot = {
            version: 1,
            markdown: state.markdown,
            name: state.currentFileName,
            filePath: state.currentFilePath || state.recoveredSourcePath,
            kind: state.recoveredDocument ? state.recoveryKind : state.currentFileKind,
            lastSavedMarkdown: state.recoveredDocument ? state.recoveryLastSavedMarkdown : state.lastSavedMarkdown,
            lastDiskContent: state.recoveredDocument ? state.recoveryBaseline : state.lastDiskContent
        };
        localStorage.setItem(STORAGE_KEYS.draftSnapshot, JSON.stringify(snapshot));
    } catch (error) {
        console.warn('Unable to save the document:', error);
    }
}

function cancelUndoOnEdit() {
    if (!state.justCleared) return;
    clearTimeout(undoTimer);
    state.justCleared = false;
    state.undoMarkdown = null;
    renderClearState();
}

function syncFromRich({ flash = false } = {}) {
    if (!state.richEditAllowed && sourceOnlyCount(findSourceOnlyMarkdown(state.markdown))) {
        renderRichFromMarkdown();
        showSourceGuard('warning', { focus: true });
        return;
    }
    if (state.richEditAllowed && state.sourceOnlySnapshot === null && sourceOnlyCount(findSourceOnlyMarkdown(state.markdown))) {
        state.sourceOnlySnapshot = state.markdown;
    }
    // A guarded edit passed: keep this rich session editable even if it generates source-only syntax.
    state.richEditAllowed = true;
    cancelUndoOnEdit();
    clearReplacementUndo();
    if (!elements.richEditor.innerText.trim() && !elements.richEditor.querySelector('img, hr')) {
        elements.richEditor.innerHTML = '';
    }
    state.markdown = richHtmlToMarkdown();
    elements.markdownEditor.textContent = state.markdown;
    renderMarkdownHighlight();
    updateStats();
    persistDocument();
    renderDocName();
    renderStatusHint();
    refreshFind();
    pulseSyncMark();
    if (state.sourceOnlySnapshot !== null) showSourceGuard('converted');
    if (flash) {
        elements.markdownHighlight.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'cubic-bezier(.4,0,.2,1)' });
    }
}

function syncFromMarkdown() {
    state.richEditAllowed = false;
    state.sourceOnlySnapshot = null;
    hideSourceGuard();
    cancelUndoOnEdit();
    if (!state.programmaticReplace) clearReplacementUndo();
    state.markdown = getMarkdownEditorText();
    if (!state.markdown) elements.markdownEditor.textContent = '';
    renderMarkdownHighlight();
    renderRichFromMarkdown();
    pulseSyncMark();
    updateStats();
    persistDocument();
    renderDocName();
    renderStatusHint();
    refreshFind();
}

function setDocumentFromMarkdown(markdown, { persist = true } = {}) {
    state.richEditAllowed = false;
    state.sourceOnlySnapshot = null;
    hideSourceGuard();
    state.markdown = String(markdown || '').replace(/\r\n?/g, '\n');
    elements.markdownEditor.textContent = state.markdown;
    renderMarkdownHighlight();
    renderRichFromMarkdown();
    updateStats();
    if (persist) persistDocument();
    closeReader();
    renderDocName();
    renderStatusHint();
    refreshFind();
    refreshOutline();
}

function bodyHtmlFromDocument(html) {
    const parsed = new DOMParser().parseFromString(String(html || ''), 'text/html');
    return parsed.body ? parsed.body.innerHTML : String(html || '');
}

function setDocumentFromHtml(html) {
    state.richEditAllowed = false;
    state.sourceOnlySnapshot = null;
    hideSourceGuard();
    elements.richEditor.innerHTML = sanitizeHtml(bodyHtmlFromDocument(html), { preserveStyles: true });
    syncFromRich({ flash: true });
    closeReader();
    refreshOutline();
}

function setDocumentFromText(text) {
    state.richEditAllowed = false;
    state.sourceOnlySnapshot = null;
    hideSourceGuard();
    elements.richEditor.textContent = String(text || '');
    syncFromRich({ flash: true });
    closeReader();
    refreshOutline();
}

function normalizePreferences(candidate = {}) {
    const appearance = ['light', 'dark', 'auto'].includes(candidate.appearance) ? candidate.appearance : DEFAULT_PREFERENCES.appearance;
    const lightTheme = ['default', 'paper', 'sage'].includes(candidate.lightTheme) ? candidate.lightTheme : DEFAULT_PREFERENCES.lightTheme;
    const legacyDark = candidate.darkTheme === 'default' ? 'onyx' : candidate.darkTheme;
    const darkTheme = ['midnight', 'onyx', 'ember'].includes(legacyDark) ? legacyDark : DEFAULT_PREFERENCES.darkTheme;
    const flavor = String(candidate.flavor || '').toLowerCase() === 'commonmark' ? 'CommonMark' : 'GFM';
    const readerWidth = ['60', '72', 'Full'].includes(String(candidate.readerWidth)) ? String(candidate.readerWidth) : DEFAULT_PREFERENCES.readerWidth;
    const textSize = ['14', '16', '18'].includes(String(candidate.textSize)) ? String(candidate.textSize) : DEFAULT_PREFERENCES.textSize;
    return {
        appearance,
        lightTheme,
        darkTheme,
        flavor,
        readerWidth,
        smartQuotes: typeof candidate.smartQuotes === 'boolean' ? candidate.smartQuotes : DEFAULT_PREFERENCES.smartQuotes,
        textSize,
        autoSave: typeof candidate.autoSave === 'boolean' ? candidate.autoSave : DEFAULT_PREFERENCES.autoSave,
        outlineHidden: typeof candidate.outlineHidden === 'boolean' ? candidate.outlineHidden : DEFAULT_PREFERENCES.outlineHidden
    };
}

function migrateOldPreferences(old = {}) {
    const themeMap = { system: 'auto', auto: 'auto', light: 'light', dark: 'dark', black: 'dark' };
    const maxWidth = Number(old.contentMaxWidth);
    const readerWidth = maxWidth >= 1100 ? 'Full' : (maxWidth && maxWidth <= 700 ? '60' : '72');
    const size = Number(old.contentFontSize || 16);
    const textSize = String([14, 16, 18].reduce((best, value) => Math.abs(value - size) < Math.abs(best - size) ? value : best, 16));
    return normalizePreferences({
        appearance: themeMap[old.themeMode || old.theme] || 'auto',
        flavor: String(old.markdownFlavor || 'gfm').toLowerCase() === 'gfm' ? 'GFM' : 'CommonMark',
        readerWidth,
        smartQuotes: typeof old.smartQuotes === 'boolean' ? old.smartQuotes : true,
        textSize,
        autoSave: typeof old.autoSave === 'boolean' ? old.autoSave : true
    });
}

function readJsonStorage(keys) {
    for (const key of keys) {
        try {
            const raw = localStorage.getItem(key);
            if (raw) return JSON.parse(raw);
        } catch (error) {
            console.warn(`Unable to read ${key}:`, error);
        }
    }
    return null;
}

function loadPreferences() {
    const current = readJsonStorage([STORAGE_KEYS.preferences]);
    if (current) {
        state.preferences = normalizePreferences(current);
        return;
    }
    const old = readJsonStorage([STORAGE_KEYS.oldSettings, STORAGE_KEYS.legacySettings]);
    state.preferences = old ? migrateOldPreferences(old) : { ...DEFAULT_PREFERENCES };
    savePreferences();
}

function loadDocument() {
    try {
        const current = localStorage.getItem(STORAGE_KEYS.document);
        if (current !== null) return current;
    } catch (error) {
        console.warn('Unable to read the current document:', error);
    }

    const old = readJsonStorage([STORAGE_KEYS.oldContent, STORAGE_KEYS.legacyContent]);
    if (!old) return '';
    let migrated = '';
    if (old.mode !== 'rtToMd' && typeof old.markdown === 'string') migrated = old.markdown;
    if ((old.mode === 'rtToMd' || !migrated) && old.richText && turndownService) {
        migrated = turndownService.turndown(sanitizeHtml(old.richText, { preserveStyles: true })).trim();
    }
    if (!migrated && typeof old.markdown === 'string') migrated = old.markdown;
    if (state.preferences.autoSave) {
        try {
            localStorage.setItem(STORAGE_KEYS.document, migrated);
        } catch (error) {
            console.warn('Unable to migrate the saved document:', error);
        }
    }
    return migrated;
}

function savePreferences() {
    try {
        localStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify(state.preferences));
    } catch (error) {
        console.warn('Unable to save preferences:', error);
    }
}

function resolvedTheme() {
    if (state.preferences.appearance === 'auto') return systemTheme.matches ? 'dark' : 'light';
    return state.preferences.appearance;
}

function applyTheme({ animate = false } = {}) {
    const mode = resolvedTheme();
    const palette = `${mode}-${state.preferences[mode === 'dark' ? 'darkTheme' : 'lightTheme']}`;
    if (animate && (document.documentElement.dataset.mode !== mode || document.documentElement.dataset.palette !== palette)) animateThemeChange();
    document.documentElement.dataset.mode = mode;
    elements.app.dataset.mode = mode;
    document.documentElement.dataset.palette = palette;
    elements.app.dataset.palette = palette;
    const label = { light: 'Light', dark: 'Dark', auto: 'Auto (match system)' }[state.preferences.appearance];
    elements.themeButton.dataset.appearance = state.preferences.appearance;
    elements.themeButton.title = `Appearance: ${label}. Click to change`;
    elements.themeButton.setAttribute('aria-label', `Appearance: ${label}`);
    applyHighlightTheme();
}

function applyTextSize() {
    elements.app.style.setProperty('--document-text-size', `${state.preferences.textSize}px`);
}

function setPreference(key, value) {
    state.preferences[key] = value;
    savePreferences();
    if (['appearance', 'lightTheme', 'darkTheme'].includes(key)) applyTheme({ animate: true });
    if (key === 'textSize') applyTextSize();
    if (key === 'flavor') {
        configureConverters();
        renderRichFromMarkdown();
        updateStats();
    }
    if (key === 'autoSave') {
        persistDocument();
        renderStatusHint();
    }
    if (state.view === 'reader' && ['readerWidth', 'smartQuotes', 'flavor'].includes(key)) renderReader();
    if (key === 'flavor' || key === 'smartQuotes') refreshFind({ reset: true });
    renderSettingsRows();
}

function renderSettingsRows() {
    elements.settingsRows.replaceChildren();
    SETTING_DEFINITIONS.forEach((definition) => {
        const row = document.createElement('div');
        row.className = 'setting-row';
        const name = document.createElement('span');
        name.textContent = definition.name;
        const options = document.createElement('span');
        options.className = 'setting-options';
        options.setAttribute('role', 'group');
        options.setAttribute('aria-label', definition.name);

        definition.values.forEach((value, index) => {
            const option = document.createElement('button');
            option.className = 'setting-option';
            option.textContent = definition.labels ? definition.labels[index] : String(value);
            option.dataset.settingKey = definition.key;
            option.dataset.settingValue = String(value);
            option.classList.toggle('is-active', state.preferences[definition.key] === value);
            option.setAttribute('aria-pressed', String(state.preferences[definition.key] === value));
            option.addEventListener('click', () => {
                const restoreFocus = state.settingsOpen;
                setPreference(definition.key, value);
                if (restoreFocus) {
                    const selected = [...elements.settingsRows.querySelectorAll('.setting-option')]
                        .find((button) => button.dataset.settingKey === definition.key && button.dataset.settingValue === String(value));
                    selected?.focus();
                }
            });
            options.appendChild(option);
        });

        row.append(name, options);
        elements.settingsRows.appendChild(row);
    });
}

function openSettings() {
    closeOutlineDrawer({ restore: false });
    state.settingsOpen = true;
    state.lastFocusedElement = document.activeElement;
    renderSettingsRows();
    elements.settingsOverlay.getAnimations?.().forEach((animation) => animation.cancel());
    elements.settingsOverlay.classList.remove('is-closing');
    elements.settingsOverlay.hidden = false;
    requestAnimationFrame(() => elements.settingsRows.querySelector('.setting-option.is-active')?.focus());
}

function closeSettings() {
    if (!state.settingsOpen) return;
    state.settingsOpen = false;
    const overlay = elements.settingsOverlay;
    const panel = overlay.querySelector('.settings-panel');
    overlay.classList.add('is-closing');
    if (reducedMotion.matches || !overlay.animate) {
        overlay.hidden = true;
    } else {
        panel?.animate([
            { transform: 'translateY(0)' },
            { transform: 'translateY(4px)' }
        ], { duration: 140, easing: MOTION_EASE });
        overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: MOTION_EASE, fill: 'forwards' });
        setTimeout(() => {
            if (state.settingsOpen) return;
            overlay.hidden = true;
            overlay.getAnimations().forEach((animation) => animation.cancel());
        }, 140);
    }
    state.lastFocusedElement?.focus?.();
}

function toggleSettings() {
    if (state.settingsOpen) closeSettings();
    else openSettings();
}

function smartenText(text) {
    return String(text)
        .replace(/(^|[\s([{—-])"/g, '$1“')
        .replace(/"/g, '”')
        .replace(/(^|[\s([{—-])'/g, '$1‘')
        .replace(/'/g, '’');
}

function applySmartQuotes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (node.parentElement?.closest('code, pre')) return NodeFilter.FILTER_REJECT;
            const link = node.parentElement?.closest('a');
            if (link && /^(?:[a-z][a-z\d+.-]*:|www\.)/i.test(link.textContent.trim())) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        }
    });
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach((node) => { node.nodeValue = smartenText(node.nodeValue); });
}

function addReaderHeadingAnchors() {
    const counts = new Map();
    elements.readerContent.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((heading) => {
        const slug = heading.textContent.toLowerCase().trim()
            .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '')
            .replace(/\s/g, '-') || 'section';
        const count = counts.get(slug) || 0;
        counts.set(slug, count + 1);
        heading.id = count ? `${slug}-${count}` : slug;
    });
}

function renderReader() {
    if (!state.markdown) {
        elements.readerContent.innerHTML = '<p class="empty-reader">Nothing to read yet.</p>';
    } else {
        elements.readerContent.innerHTML = markdownToHtml(state.markdown);
        addReaderHeadingAnchors();
        hydrateLocalImages(elements.readerContent);
        if (state.preferences.smartQuotes) applySmartQuotes(elements.readerContent);
        highlightCode(elements.readerContent);
    }
    elements.readerContent.classList.toggle('is-width-60', state.preferences.readerWidth === '60');
    elements.readerContent.classList.toggle('is-width-full', state.preferences.readerWidth === 'Full');
    scheduleOutlineActive();
}

function openReader() {
    closeOutlineDrawer({ restore: false });
    closeSettings();
    state.view = 'reader';
    renderReader();
    elements.editView.hidden = true;
    elements.readerView.hidden = false;
    softEnter(elements.readerView);
    renderViewSwitch();
    refreshFind({ reset: true });
}

function renderViewSwitch() {
    const reading = state.view === 'reader';
    elements.viewEditButton.classList.toggle('is-active', !reading);
    elements.viewReadButton.classList.toggle('is-active', reading);
    elements.viewEditButton.setAttribute('aria-pressed', String(!reading));
    elements.viewReadButton.setAttribute('aria-pressed', String(reading));
    elements.viewEditButton.parentElement?.classList.toggle('is-reading', reading);
    outlineLastScroll = '';
    scheduleOutlineActive();
}

function closeReader() {
    if (state.view !== 'reader') return;
    closeOutlineDrawer({ restore: false });
    state.view = 'edit';
    elements.readerView.hidden = true;
    elements.editView.hidden = false;
    softEnter(elements.editView, { rise: 0 });
    renderViewSwitch();
    refreshFind({ reset: true });
}

function toggleReader() {
    if (state.view === 'reader') closeReader();
    else openReader();
}

function clearFindHighlights() {
    window.CSS?.highlights?.delete('asterism-find');
    window.CSS?.highlights?.delete('asterism-find-active');
}

function clearReplacementUndo() {
    state.replacementUndoMarkdown = null;
    state.replacementRedoMarkdown = null;
    state.replacementNativeUndo = false;
    elements.replaceUndo.hidden = true;
}

function findTarget() {
    if (state.view === 'reader') return 'reader';
    if (state.replaceOpen) return 'markdown';
    return state.lastEditor;
}

function findRoot(target) {
    if (target === 'reader') return elements.readerContent;
    if (target === 'markdown') return elements.markdownHighlight;
    return elements.richEditor;
}

function createFindRangeMapper(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let position = 0;
    while (walker.nextNode()) {
        const node = walker.currentNode;
        const length = node.nodeValue.length;
        if (!length) continue;
        nodes.push({ node, start: position, end: position + length });
        position += length;
    }

    function pointAt(offset) {
        let low = 0;
        let high = nodes.length - 1;
        while (low <= high) {
            const mid = (low + high) >> 1;
            const item = nodes[mid];
            if (offset < item.start) high = mid - 1;
            else if (offset > item.end) low = mid + 1;
            else return { node: item.node, offset: offset - item.start };
        }
        return null;
    }

    return (start, end) => {
        const first = pointAt(start);
        const last = pointAt(end);
        if (!first || !last) return null;
        const range = document.createRange();
        range.setStart(first.node, first.offset);
        range.setEnd(last.node, last.offset);
        return range;
    };
}

function matchOffsets(text, query) {
    if (!query) return [];
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const expression = new RegExp(escaped, 'gi');
    const matches = [];
    for (const match of text.matchAll(expression)) {
        matches.push({ start: match.index, end: match.index + match[0].length });
    }
    return matches;
}

function scrollToFindMatch() {
    const match = state.findMatches[state.findIndex];
    const range = match && state.findRangeAt?.(match.start, match.end);
    if (!range) return;
    const target = findTarget();
    const scroller = target === 'reader' ? elements.readerView
        : target === 'markdown' ? elements.markdownEditor : elements.richEditor;
    const rect = range.getBoundingClientRect();
    const viewport = scroller.getBoundingClientRect();
    if (rect.top < viewport.top + 24 || rect.bottom > viewport.bottom - 24) {
        scroller.scrollTop += rect.top - viewport.top - viewport.height / 3;
    }
}

const MAX_VISIBLE_FIND_HIGHLIGHTS = 300;

function paintFind({ scroll = false } = {}) {
    clearFindHighlights();
    const target = findTarget();
    elements.findScope.textContent = { reader: 'Read', rich: 'Formatted', markdown: 'Markdown' }[target];
    elements.findCount.textContent = !state.findQuery ? ''
        : state.findMatches.length ? `${state.findIndex + 1} of ${state.findMatches.length}` : 'No matches';
    elements.findPrevious.disabled = !state.findMatches.length;
    elements.findNext.disabled = !state.findMatches.length;
    elements.replaceOne.disabled = !state.replaceOpen || !state.findMatches.length;
    elements.replaceAll.disabled = !state.replaceOpen || !state.findMatches.length;

    if (window.CSS?.highlights && window.Highlight) {
        const first = Math.max(0, state.findIndex - MAX_VISIBLE_FIND_HIGHLIGHTS / 2);
        const visible = state.findMatches.slice(first, first + MAX_VISIBLE_FIND_HIGHLIGHTS);
        const all = visible.map((match) => state.findRangeAt?.(match.start, match.end)).filter(Boolean);
        if (all.length) window.CSS.highlights.set('asterism-find', new window.Highlight(...all));
        const activeMatch = state.findMatches[state.findIndex];
        const active = activeMatch && state.findRangeAt?.(activeMatch.start, activeMatch.end);
        if (active) window.CSS.highlights.set('asterism-find-active', new window.Highlight(active));
    }
    if (scroll) scrollToFindMatch();
}

function refreshFind({ reset = false, scroll = false } = {}) {
    if (!state.findOpen) return;
    const target = findTarget();
    const root = findRoot(target);
    const text = target === 'markdown' ? state.markdown : root.textContent || '';
    state.findMatches = matchOffsets(text, state.findQuery);
    state.findRangeAt = createFindRangeMapper(root);
    if (reset) state.findIndex = state.findMatches.length ? 0 : -1;
    else if (state.findIndex >= state.findMatches.length) state.findIndex = state.findMatches.length - 1;
    else if (state.findIndex < 0 && state.findMatches.length) state.findIndex = 0;
    paintFind({ scroll });
}

function openFind({ replace = false } = {}) {
    closeOutlineDrawer({ restore: false });
    if (replace && state.view === 'reader') closeReader();
    if (replace) state.lastEditor = 'markdown';
    const selected = window.getSelection()?.toString() || '';
    if (!state.findOpen && selected && selected.length <= 100 && !selected.includes('\n')) {
        elements.findInput.value = selected;
    }
    state.findOpen = true;
    state.replaceOpen = replace;
    state.findQuery = elements.findInput.value;
    elements.findBar.hidden = false;
    elements.replaceMain.hidden = !replace;
    refreshFind({ reset: true, scroll: true });
    requestAnimationFrame(() => {
        elements.findInput.focus();
        elements.findInput.select();
    });
}

function closeFind() {
    if (!state.findOpen) return;
    state.findOpen = false;
    state.replaceOpen = false;
    state.findMatches = [];
    state.findIndex = -1;
    state.findRangeAt = null;
    elements.findBar.hidden = true;
    clearFindHighlights();
    if (state.view === 'reader') elements.viewReadButton.focus();
    else (state.lastEditor === 'markdown' ? elements.markdownEditor : elements.richEditor).focus();
}

function moveFind(direction) {
    if (!state.findOpen) {
        openFind();
        return;
    }
    if (!state.findMatches.length) return;
    state.findIndex = (state.findIndex + direction + state.findMatches.length) % state.findMatches.length;
    paintFind({ scroll: true });
}

function replaceMarkdown(nextMarkdown, message) {
    if (nextMarkdown === state.markdown) return;
    state.replacementUndoMarkdown = state.markdown;
    state.replacementRedoMarkdown = null;
    elements.replaceUndo.hidden = false;
    const editor = elements.markdownEditor;
    editor.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection.removeAllRanges();
    selection.addRange(range);
    state.programmaticReplace = true;
    let nativeUndo = document.execCommand('insertText', false, nextMarkdown);
    state.programmaticReplace = false;
    // Native insertText can add div/br newline artifacts; the source must equal the requested string.
    // When it does not, restore the exact value and fall back to the custom snapshot undo.
    if (!nativeUndo || state.markdown !== nextMarkdown) {
        nativeUndo = false;
        setDocumentFromMarkdown(nextMarkdown);
    }
    state.replacementNativeUndo = nativeUndo;
    refreshFind();
    announce(message);
}

function replaceOneMatch() {
    const match = state.findMatches[state.findIndex];
    if (!state.replaceOpen || !match) return;
    const replacement = elements.replaceInput.value;
    replaceMarkdown(
        state.markdown.slice(0, match.start) + replacement + state.markdown.slice(match.end),
        'Replaced one match'
    );
}

function replaceAllMatches() {
    if (!state.replaceOpen || !state.findMatches.length) return;
    let updated = state.markdown;
    const replacement = elements.replaceInput.value;
    for (const match of [...state.findMatches].reverse()) {
        updated = updated.slice(0, match.start) + replacement + updated.slice(match.end);
    }
    replaceMarkdown(updated, `Replaced ${state.findMatches.length} matches`);
}

function undoReplacement() {
    if (state.replacementUndoMarkdown === null) return;
    if (state.replacementNativeUndo) {
        const previous = state.replacementUndoMarkdown;
        elements.markdownEditor.focus();
        document.execCommand('undo');
        if (state.markdown !== previous) setDocumentFromMarkdown(previous);
        clearReplacementUndo();
        announce('Replacement undone');
        return;
    }
    state.replacementRedoMarkdown = state.markdown;
    const previous = state.replacementUndoMarkdown;
    state.replacementUndoMarkdown = null;
    elements.replaceUndo.hidden = true;
    setDocumentFromMarkdown(previous);
    announce('Replacement undone');
}

function redoReplacement() {
    if (state.replacementRedoMarkdown === null) return;
    state.replacementUndoMarkdown = state.markdown;
    const next = state.replacementRedoMarkdown;
    state.replacementRedoMarkdown = null;
    elements.replaceUndo.hidden = false;
    setDocumentFromMarkdown(next);
    announce('Replacement redone');
}

function renderClearState() {
    const button = elements.clearButton;
    button.classList.toggle('is-emphasized', state.justCleared);
    button.classList.toggle('is-armed', state.clearArmed && !state.justCleared);
    if (state.justCleared) button.textContent = 'Undo clear';
    else if (state.clearArmed) button.textContent = 'Click again to clear';
    else button.textContent = 'Clear';
    setActionEnabled(button, state.justCleared || Boolean(state.markdown));
}

const CLEAR_FADE_MS = 140;

// Old content is cloned into inert ghosts that fade out on top while the real panes are already cleared.
function snapshotPaneGhosts() {
    if (reducedMotion.matches || state.view !== 'edit' || !state.markdown) return [];
    const sources = [
        { source: elements.richEditor, host: elements.richPane.querySelector('.pane-body') },
        { source: elements.markdownHighlight, host: elements.markdownPane.querySelector('.pane-body') }
    ];
    return sources.map(({ source, host }) => {
        const ghost = document.createElement('div');
        ghost.className = 'clear-ghost';
        ghost.setAttribute('aria-hidden', 'true');
        ghost.inert = true;
        const copy = source.cloneNode(true);
        ['id', 'contenteditable', 'role', 'aria-labelledby', 'aria-hidden', 'data-placeholder'].forEach((name) => copy.removeAttribute(name));
        ghost.appendChild(copy);
        return { ghost, host, copy, scrollTop: source.scrollTop, scrollLeft: source.scrollLeft };
    });
}

function playClearFade(ghosts) {
    document.querySelectorAll('.clear-ghost').forEach((node) => node.remove());
    ghosts.forEach(({ ghost, host, copy, scrollTop, scrollLeft }) => {
        host.appendChild(ghost);
        copy.scrollTop = scrollTop;
        copy.scrollLeft = scrollLeft;
        const remove = () => ghost.remove();
        const animation = ghost.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: CLEAR_FADE_MS, easing: MOTION_EASE, fill: 'forwards' });
        if (animation) animation.addEventListener('finish', remove, { once: true });
        setTimeout(remove, CLEAR_FADE_MS + 200);
    });
}

function clearNow({ withUndo = true, confirmNew = false } = {}) {
    const dirtyFile = state.currentFilePath && state.markdown !== state.lastSavedMarkdown;
    if ((dirtyFile || (confirmNew && hasUnpersistedDocument())) &&
        !window.confirm(dirtyFile
            ? `Discard unsaved changes to ${state.currentFileName}?`
            : 'Start a new document and replace the current one?')) return;
    const ghosts = snapshotPaneGhosts();
    clearTimeout(clearArmTimer);
    clearTimeout(undoTimer);
    state.clearArmed = false;
    state.richEditAllowed = false;
    state.sourceOnlySnapshot = null;
    hideSourceGuard();
    state.undoMarkdown = withUndo ? state.markdown : null;
    state.undoFileName = withUndo ? state.currentFileName : '';
    state.undoFilePath = withUndo ? state.currentFilePath : '';
    state.undoFileKind = withUndo ? state.currentFileKind : '';
    state.undoLastSavedMarkdown = withUndo ? state.lastSavedMarkdown : '';
    state.undoLastDiskContent = withUndo ? state.lastDiskContent : '';
    state.undoFileConflict = withUndo ? state.fileConflict : false;
    state.undoRecoveredDocument = withUndo ? state.recoveredDocument : false;
    state.undoRecoveredSourcePath = withUndo ? state.recoveredSourcePath : '';
    state.undoRecoveryBaseline = withUndo ? state.recoveryBaseline : null;
    state.undoRecoveryLastSavedMarkdown = withUndo ? state.recoveryLastSavedMarkdown : '';
    state.undoRecoveryKind = withUndo ? state.recoveryKind : '';
    undoBrowserDocument = withUndo ? browserDocument : null;
    browserDocument = null;
    state.justCleared = withUndo && Boolean(state.markdown);
    state.markdown = '';
    state.documentRevision += 1;
    state.currentFileName = '';
    state.currentFilePath = '';
    state.currentFileKind = '';
    state.lastSavedMarkdown = '';
    state.lastDiskContent = '';
    state.fileConflict = false;
    state.recoveredDocument = false;
    state.recoveredSourcePath = '';
    state.recoveryBaseline = null;
    state.recoveryLastSavedMarkdown = '';
    state.recoveryKind = '';
    localImageCache.clear();
    clearReplacementUndo();
    renderDocName();
    elements.richEditor.innerHTML = '';
    elements.markdownEditor.textContent = '';
    renderMarkdownHighlight();
    updateStats();
    closeReader();
    refreshOutline();
    try {
        localStorage.removeItem(STORAGE_KEYS.document);
        localStorage.removeItem(STORAGE_KEYS.documentMeta);
        localStorage.removeItem(STORAGE_KEYS.draftSnapshot);
    } catch (error) {
        console.warn('Unable to clear the saved document:', error);
    }
    if (state.justCleared) {
        undoTimer = setTimeout(() => {
            state.justCleared = false;
            state.undoMarkdown = null;
            renderClearState();
        }, 8000);
    }
    renderClearState();
    playClearFade(ghosts);
    renderStatusHint();
    refreshFind({ reset: true });
}

function undoClear() {
    clearTimeout(undoTimer);
    const markdown = state.undoMarkdown || '';
    state.justCleared = false;
    state.undoMarkdown = null;
    state.currentFileName = state.undoFileName;
    state.documentRevision += 1;
    state.currentFilePath = state.undoFilePath;
    state.currentFileKind = state.undoFileKind;
    state.lastSavedMarkdown = state.undoLastSavedMarkdown;
    state.lastDiskContent = state.undoLastDiskContent;
    state.fileConflict = state.undoFileConflict;
    state.recoveredDocument = state.undoRecoveredDocument;
    state.recoveredSourcePath = state.undoRecoveredSourcePath;
    state.recoveryBaseline = state.undoRecoveryBaseline;
    state.recoveryLastSavedMarkdown = state.undoRecoveryLastSavedMarkdown;
    state.recoveryKind = state.undoRecoveryKind;
    browserDocument = undoBrowserDocument;
    undoBrowserDocument = null;
    renderDocName();
    renderClearState();
    setDocumentFromMarkdown(markdown);
    [elements.richPane, elements.markdownPane].forEach((pane) => softEnter(pane.querySelector('.pane-body'), { duration: 160, rise: 3 }));
}

function handleClear() {
    if (state.justCleared) {
        undoClear();
        return;
    }
    if (!state.markdown) return;
    if (!state.clearArmed) {
        state.clearArmed = true;
        renderClearState();
        clearTimeout(clearArmTimer);
        clearArmTimer = setTimeout(() => {
            state.clearArmed = false;
            renderClearState();
        }, 3500);
        return;
    }
    clearNow();
}

function clearSavedData() {
    try {
        Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    } catch (error) {
        console.warn('Unable to clear saved data:', error);
    }
    elements.clearSavedButton.textContent = 'Cleared ✓';
    clearTimeout(savedDataTimer);
    savedDataTimer = setTimeout(() => { elements.clearSavedButton.textContent = 'Clear all'; }, 1600);
    announce('Saved data cleared');
}

function announce(message, { toast = true } = {}) {
    elements.statusMessage.textContent = '';
    requestAnimationFrame(() => { elements.statusMessage.textContent = message; });
    if (!toast) return;
    elements.toast.textContent = message;
    elements.toast.classList.remove('is-leaving');
    elements.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        if (reducedMotion.matches) {
            elements.toast.hidden = true;
            return;
        }
        elements.toast.classList.add('is-leaving');
        toastTimer = setTimeout(() => {
            elements.toast.hidden = true;
            elements.toast.classList.remove('is-leaving');
        }, 160);
    }, 1800);
}

async function copyMarkdown() {
    if (!state.markdown) {
        announce('Nothing to copy yet');
        return;
    }
    let copied = false;
    try {
        await navigator.clipboard.writeText(state.markdown);
        copied = true;
    } catch {
        const textarea = document.createElement('textarea');
        textarea.value = state.markdown;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        copied = document.execCommand('copy');
        textarea.remove();
    }
    if (!copied) return;
    state.copied = true;
    const label = elements.copyButton.querySelector('.copy-label');
    label.textContent = 'Copied';
    softEnter(label, { duration: 160, rise: 3 });
    elements.copyButton.classList.add('is-copied');
    elements.hintText.textContent = 'Markdown copied to clipboard';
    announce('Markdown copied to clipboard', { toast: false });
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
        state.copied = false;
        label.textContent = 'Copy';
        softEnter(label, { duration: 160, rise: 3 });
        elements.copyButton.classList.remove('is-copied');
        renderStatusHint();
    }, 1400);
}

function deriveFileName() {
    if (state.currentFileName) return state.currentFileName.replace(/\.(html?|txt|markdown)$/i, '.md');
    const heading = state.markdown.match(/^#{1,6}\s+(.+)$/m)?.[1] || 'untitled';
    const slug = heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
    return `${slug || 'untitled'}.md`;
}

function markFileSaved(filePath, savedMarkdown, documentRevision) {
    if (state.documentRevision !== documentRevision) return;
    state.currentFilePath = filePath;
    state.currentFileName = filePath.split(/[\\/]/).pop();
    state.currentFileKind = /\.(md|markdown)$/i.test(filePath) ? 'markdown' : 'text';
    state.lastSavedMarkdown = savedMarkdown;
    state.lastDiskContent = savedMarkdown;
    state.fileConflict = false;
    state.recoveredDocument = false;
    state.recoveredSourcePath = '';
    state.recoveryBaseline = null;
    state.recoveryLastSavedMarkdown = '';
    state.recoveryKind = '';
    renderDocName();
    renderStatusHint();
    persistDocument();
}

function fileErrorMessage(error, action) {
    if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return `Permission to ${action} this file was not granted · try Save As`;
    if (error?.name === 'NotFoundError') return 'That file is no longer available · use Save As';
    return `Could not ${action} this file`;
}

// Returns true when a browser file operation handled the request (including cancel or failure).
async function performBrowserSave({ saveAs, filename, content, documentRevision }) {
    const doc = browserDocument;
    const stale = () => state.documentRevision !== documentRevision || browserDocument !== doc;
    try {
        if (!saveAs && doc && state.currentFileKind === 'markdown' && !state.recoveredDocument) {
            let result = await browserFiles.save({ document: doc, content, expectedContent: state.lastDiskContent });
            if (result?.conflict) {
                if (stale()) return true;
                state.fileConflict = true;
                renderDocName();
                renderStatusHint();
                if (result.requiresSaveAs && !result.missing) {
                    announce('Choose where to save this file');
                    return await saveBrowserCopy();
                }
                if (result.missing) {
                    queuedSave = null;
                    announce('That file is no longer available · use Save As');
                    return true;
                }
                const message = 'This file changed outside Asterism. Overwrite the disk version with your current document?';
                if (!window.confirm(message)) {
                    queuedSave = null;
                    announce('File not saved');
                    return true;
                }
                result = await browserFiles.save({ document: doc, content: state.markdown, expectedContent: state.lastDiskContent, force: true });
            }
            if (result?.canceled) return true;
            if (result && !result.unavailable && !result.requiresSaveAs) {
                if (stale()) {
                    announce('Saved · the open document changed meanwhile');
                    return true;
                }
                browserDocument = { ...doc, expectedContent: result.expectedContent };
                markFileSaved(result.filePath || doc.filePath, result.content, documentRevision);
                announce(state.markdown !== result.content ? 'Saved previous edits · newer changes remain' : 'File saved');
                return true;
            }
        }
        return await saveBrowserCopy();
    } catch (error) {
        console.error('Save failed:', error);
        queuedSave = null;
        announce(fileErrorMessage(error, 'save'));
        return true;
    }
    async function saveBrowserCopy() {
        const saved = await browserFiles.saveAs({ content, suggestedName: filename });
        if (saved?.canceled) {
            queuedSave = null;
            return true;
        }
        if (!saved || saved.unavailable) return false;
        if (stale()) {
            announce('Saved a copy · the open document changed meanwhile');
            return true;
        }
        browserDocument = saved;
        checkFolderForDocument();
        markFileSaved(saved.filePath, saved.content, documentRevision);
        announce(state.markdown !== saved.content ? 'Saved previous edits · newer changes remain' : 'File saved');
        return true;
    }
}

let activeSavePromise = null;
let queuedSave = null;

async function performSaveMarkdown({ saveAs = false } = {}) {
    if (!state.markdown && !state.currentFilePath) {
        announce('Nothing to save yet');
        return;
    }
    const filename = deriveFileName();
    const content = state.markdown;
    const documentRevision = state.documentRevision;
    if (!window.desktopBridge && browserFiles?.supported && await performBrowserSave({ saveAs, filename, content, documentRevision })) return;
    if (!saveAs && state.currentFilePath && state.currentFileKind === 'markdown' && window.desktopBridge?.writeFile) {
        try {
            const filePath = state.currentFilePath;
            const options = { filePath, content, expectedContent: state.lastDiskContent };
            let savedContent = content;
            let result = await window.desktopBridge.writeFile(options);
            if (result?.conflict) {
                if (state.documentRevision !== documentRevision) return;
                state.fileConflict = true;
                renderDocName();
                renderStatusHint();
                if (!window.confirm('This file changed outside Asterism. Overwrite the disk version with your current document?')) {
                    queuedSave = null;
                    announce('File not saved');
                    return;
                }
                savedContent = state.markdown;
                result = await window.desktopBridge.writeFile({ ...options, content: savedContent, force: true });
            }
            if (!result?.canceled && state.documentRevision === documentRevision) {
                markFileSaved(result.filePath || filePath, savedContent, documentRevision);
                announce(state.markdown !== savedContent ? 'Saved previous edits · newer changes remain' : 'File saved');
            }
        } catch (error) {
            console.error('Save failed:', error);
            announce('Could not save this file');
        }
        return;
    }
    if (window.desktopBridge?.saveFile) {
        try {
            const result = await window.desktopBridge.saveFile({
                content,
                defaultPath: filename,
                filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
            });
            if (result?.canceled) queuedSave = null;
            else if (state.documentRevision === documentRevision) {
                markFileSaved(result.filePath, content, documentRevision);
                announce(state.markdown !== content ? 'Saved previous edits · newer changes remain' : 'File saved');
            }
        } catch (error) {
            console.error('Save failed:', error);
            announce('Could not save this file');
        }
        return;
    }
    const blob = new Blob([content], { type: 'text/markdown' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    announce(`Downloaded ${filename}`);
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function saveMarkdown({ saveAs = false } = {}) {
    if (activeSavePromise) {
        if (window.desktopBridge?.saveFile || (!window.desktopBridge && browserFiles?.supported)) queuedSave = { saveAs, revision: state.documentRevision };
        return activeSavePromise;
    }
    const operation = performSaveMarkdown({ saveAs });
    activeSavePromise = operation;
    try {
        await operation;
    } finally {
        activeSavePromise = null;
        const next = queuedSave;
        queuedSave = null;
        if (next && next.revision === state.documentRevision &&
            (next.saveAs || state.markdown !== state.lastSavedMarkdown || state.fileConflict)) {
            void saveMarkdown({ saveAs: next.saveAs });
        }
    }
}

function inferDocumentKind(name, content, explicitKind) {
    if (explicitKind) return explicitKind;
    if (/\.html?$/i.test(name || '')) return 'html';
    if (/\.(md|markdown)$/i.test(name || '')) return 'markdown';
    if (/<(html|body|p|div|h1|h2|blockquote|ul|ol)\b/i.test(content || '')) return 'html';
    return 'text';
}

function isRelativeResource(value) {
    const source = String(value || '').trim();
    return Boolean(source && !source.startsWith('#') && !source.startsWith('/') && !source.includes('\\') &&
        !source.startsWith('//') && !/^[a-z][a-z\d+.-]*:/i.test(source));
}

function requestLocalImage(baseFilePath, src) {
    if (window.desktopBridge?.readRelativeImage) return window.desktopBridge.readRelativeImage({ baseFilePath, src });
    if (browserFiles && browserFolderLinked && browserDocument) return browserFiles.readRelativeImage({ document: browserDocument, src });
    return null;
}

function hydrateLocalImages(root) {
    const baseFilePath = state.currentFilePath;
    if (!baseFilePath || !(window.desktopBridge?.readRelativeImage || (browserFiles && browserFolderLinked && browserDocument))) return;
    const revision = state.documentRevision;
    root.querySelectorAll('img[src]').forEach((image) => {
        const src = image.getAttribute('src');
        if (!isRelativeResource(src)) return;
        image.setAttribute('data-asterism-relative-src', src);
        image.removeAttribute('src');
        const key = `${baseFilePath}\n${src}`;
        if (!localImageCache.has(key)) {
            if (localImageCache.size > 40) localImageCache.clear();
            try {
                localImageCache.set(key, Promise.resolve(requestLocalImage(baseFilePath, src)));
            } catch (error) {
                localImageCache.set(key, Promise.reject(error));
            }
        }
        localImageCache.get(key).then((dataUrl) => {
            if (state.documentRevision === revision && image.isConnected && dataUrl) image.src = dataUrl;
        }).catch((error) => {
            localImageCache.delete(key);
            if (image.isConnected) image.title = error?.message || 'Local image could not be opened';
        });
    });
}

async function handleDocumentLinkClick(event) {
    const anchor = event.target.closest?.('a[href]');
    if (!anchor) return;
    if (!elements.readerContent.contains(anchor) && !elements.richEditor.contains(anchor)) return;
    if (state.view === 'edit' && !event.metaKey && !event.ctrlKey) return;
    const href = anchor.getAttribute('href');
    if (href.startsWith('#')) {
        event.preventDefault();
        if (state.view === 'edit') openReader();
        let fragment;
        try { fragment = decodeURIComponent(href.slice(1)); } catch { fragment = href.slice(1); }
        const target = Array.from(elements.readerContent.querySelectorAll('[id]')).find((node) => node.id === fragment);
        if (target) target.scrollIntoView({ block: 'start' });
        else if (!fragment) elements.readerView.scrollTop = 0;
        else announce('Heading not found');
        return;
    }
    if (!isRelativeResource(href)) return;
    event.preventDefault();
    if (!/\.(md|markdown|txt|html?)$/i.test(href.split(/[?#]/)[0])) {
        announce('This linked file type cannot be opened here');
        return;
    }
    if (!window.desktopBridge && browserFiles?.supported) {
        if (!browserFolderLinked || !browserDocument) {
            announce('Use Link folder… to open nearby documents');
            return;
        }
        try {
            const documentRevision = state.documentRevision;
            const result = await browserFiles.openRelative({ document: browserDocument, href });
            if (result && !result.canceled && state.documentRevision === documentRevision) loadDocumentData(result);
        } catch (error) {
            console.error('Linked document could not be opened:', error);
            announce(error?.message || 'Linked document could not be opened');
        }
        return;
    }
    if (!state.currentFilePath || !window.desktopBridge?.openRelativeFile) {
        announce('Open local document links in the Mac app');
        return;
    }
    try {
        const documentRevision = state.documentRevision;
        const result = await window.desktopBridge.openRelativeFile({ baseFilePath: state.currentFilePath, href });
        if (result && !result.canceled && state.documentRevision === documentRevision) loadDocumentData(result);
    } catch (error) {
        console.error('Linked document could not be opened:', error);
        announce('Linked document could not be opened');
    }
}

function confirmReplaceDocument() {
    if (!state.markdown && !(state.currentFilePath && state.markdown !== state.lastSavedMarkdown)) return true;
    if (state.currentFilePath && state.markdown === state.lastSavedMarkdown) return true;
    const message = state.currentFilePath && state.markdown !== state.lastSavedMarkdown
        ? `Discard unsaved changes to ${state.currentFileName} and open another file?`
        : 'Replace the current document with another file?';
    return window.confirm(message);
}

function loadDocumentData(data = {}) {
    const { name = '', filePath = '', content = '', kind = '' } = data;
    if (!confirmReplaceDocument()) return;
    browserDocument = browserFiles && data.browserFile && data.handle ? data : null;
    if (!browserDocument && browserFolderLinked) {
        browserFolderLinked = false;
        elements.linkFolderButton.textContent = 'Link folder…';
    }
    checkFolderForDocument();
    localImageCache.clear();
    state.documentRevision += 1;
    state.currentFileName = name;
    state.currentFilePath = filePath;
    state.recoveredDocument = false;
    state.recoveredSourcePath = '';
    state.recoveryBaseline = null;
    state.recoveryLastSavedMarkdown = '';
    state.recoveryKind = '';
    renderDocName();
    const resolvedKind = inferDocumentKind(name, content, kind);
    state.currentFileKind = resolvedKind;
    if (resolvedKind === 'html') setDocumentFromHtml(content);
    else if (resolvedKind === 'markdown') setDocumentFromMarkdown(content);
    else setDocumentFromText(content);
    state.lastSavedMarkdown = state.markdown;
    state.lastDiskContent = String(content || '');
    state.fileConflict = false;
    renderDocName();
    renderStatusHint();
    persistDocument();
    openReader();
    announce(name ? `Opened ${name}` : 'Document opened');
}

async function openDocument() {
    if (window.desktopBridge?.openFile) {
        try {
            const result = await window.desktopBridge.openFile();
            if (result && !result.canceled) loadDocumentData(result);
        } catch (error) {
            console.error('Open failed:', error);
        }
        return;
    }
    if (!window.desktopBridge && browserFiles?.supported) {
        try {
            const result = await browserFiles.openMarkdown();
            if (result?.canceled) return;
            if (result && !result.unavailable) {
                loadDocumentData(result);
                return;
            }
        } catch (error) {
            console.error('Open failed:', error);
            announce(fileErrorMessage(error, 'open'));
            return;
        }
    }
    elements.fileInput.value = '';
    elements.fileInput.click();
}

async function reconnectRecoveredFile() {
    if (!state.recoveredDocument || !state.recoveredSourcePath || !window.desktopBridge?.openFile) return;
    const documentRevision = state.documentRevision;
    const expectedPath = state.recoveredSourcePath;
    const expectedBaseline = state.recoveryBaseline;
    try {
        const result = await window.desktopBridge.openFile();
        if (!result || result.canceled) return;
        if (state.documentRevision !== documentRevision || !state.recoveredDocument ||
            state.recoveredSourcePath !== expectedPath || state.recoveryBaseline !== expectedBaseline) return;
        const kind = inferDocumentKind(result.name, result.content, result.kind);
        if (result.filePath !== expectedPath) {
            announce('That is a different file · use Save As');
            return;
        }
        if (kind !== 'markdown') {
            announce('That file is not Markdown · use Save As');
            return;
        }
        if (result.content !== expectedBaseline) {
            announce('The original file has changed · use Save As');
            return;
        }
        state.currentFilePath = result.filePath;
        state.currentFileName = result.name || result.filePath.split(/[\\/]/).pop();
        state.currentFileKind = 'markdown';
        state.lastSavedMarkdown = state.recoveryLastSavedMarkdown;
        state.lastDiskContent = state.recoveryBaseline;
        state.fileConflict = false;
        state.recoveredDocument = false;
        state.recoveredSourcePath = '';
        state.recoveryBaseline = null;
        state.recoveryLastSavedMarkdown = '';
        state.recoveryKind = '';
        renderDocName();
        renderStatusHint();
        persistDocument();
        announce('File reconnected');
    } catch (error) {
        console.error('Reconnect failed:', error);
        announce('Could not reconnect this file · use Save As');
    }
}

function loadBrowserFile(file) {
    if (!file) return;
    if (!/\.(md|markdown|txt|html|htm)$/i.test(file.name)) {
        announce('Choose a .md, .txt, or .html file');
        return;
    }
    const reader = new FileReader();
    reader.addEventListener('load', () => loadDocumentData({ name: file.name, content: String(reader.result || '') }));
    reader.readAsText(file);
}

async function pasteFromClipboard() {
    try {
        let html = '';
        if (navigator.clipboard?.read) {
            const items = await navigator.clipboard.read();
            for (const item of items) {
                if (item.types.includes('text/html')) {
                    html = await (await item.getType('text/html')).text();
                    break;
                }
            }
        }
        const text = html ? '' : await navigator.clipboard.readText();
        if (!html && !text) {
            announce('Clipboard is empty');
            return;
        }
        if (!confirmReplaceDocument()) return;
        state.documentRevision += 1;
        browserDocument = null;
        state.currentFileName = '';
        state.currentFilePath = '';
        state.currentFileKind = '';
        state.lastSavedMarkdown = '';
        state.lastDiskContent = '';
        state.fileConflict = false;
        state.recoveredDocument = false;
        renderDocName();
        if (html) setDocumentFromHtml(html);
        else setDocumentFromMarkdown(text);
        elements.richEditor.focus();
    } catch {
        elements.richEditor.focus();
        announce(`Press ${platformLabel('⌘')}V to paste here`);
    }
}

function insertRichClipboard(event) {
    if (blockRichMutation(event)) return;
    event.preventDefault();
    const html = event.clipboardData?.getData('text/html');
    if (html) {
        document.execCommand('insertHTML', false, sanitizeHtml(html, { preserveStyles: true }));
    } else {
        document.execCommand('insertText', false, event.clipboardData?.getData('text/plain') || '');
    }
    syncFromRich({ flash: true });
}

function insertPlainClipboard(event) {
    event.preventDefault();
    document.execCommand('insertText', false, event.clipboardData?.getData('text/plain') || '');
    syncFromMarkdown();
}

const FORMAT_STATE_COMMANDS = ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList'];
function renderFormatState() {
    const selection = window.getSelection();
    const inEditor = selection?.rangeCount && elements.richEditor.contains(selection.anchorNode);
    document.querySelectorAll('.format-tool').forEach((button) => {
        const command = button.dataset.command;
        let active = false;
        if (inEditor && FORMAT_STATE_COMMANDS.includes(command)) {
            try { active = document.queryCommandState(command); } catch { active = false; }
        }
        button.classList.toggle('is-active', Boolean(active));
    });
}

function cycleTheme() {
    const choices = ['light', 'dark', 'auto'];
    const next = choices[(choices.indexOf(state.preferences.appearance) + 1) % choices.length];
    setPreference('appearance', next);
    const icon = elements.themeButton.querySelector(`.theme-${next}`);
    if (!reducedMotion.matches && icon?.animate) {
        icon.animate([
            { opacity: 0, transform: 'rotate(-60deg)' },
            { opacity: 1, transform: 'rotate(0)' }
        ], { duration: 200, easing: MOTION_EASE });
    }
}

// ---- Editing commands (shared by shortcuts, toolbar and native menu actions) ----

const TOOLBAR_COMMAND_IDS = {
    bold: 'bold', italic: 'italic', underline: 'underline', strikeThrough: 'strike', code: 'code',
    quote: 'blockquote', insertUnorderedList: 'bulletList', insertOrderedList: 'orderedList', insertHorizontalRule: 'rule'
};
const RICH_EXEC = { bold: 'bold', italic: 'italic', underline: 'underline', strike: 'strikeThrough', bulletList: 'insertUnorderedList', orderedList: 'insertOrderedList', rule: 'insertHorizontalRule', indent: 'indent', outdent: 'outdent' };
let tabReleased = false;

function markdownSelectionOffsets() {
    const editor = elements.markdownEditor;
    const length = getMarkdownEditorText().length;
    const selection = window.getSelection();
    if (!selection?.rangeCount || !editor.contains(selection.anchorNode) || !editor.contains(selection.focusNode)) {
        return { start: length, end: length };
    }
    const offset = (node, at) => {
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.setEnd(node, at);
        return Math.min(range.toString().length, length);
    };
    const a = offset(selection.anchorNode, selection.anchorOffset);
    const b = offset(selection.focusNode, selection.focusOffset);
    return { start: Math.min(a, b), end: Math.max(a, b) };
}

function setMarkdownSelection(start, end = start) {
    const range = createFindRangeMapper(elements.markdownEditor)(start, end);
    const selection = window.getSelection();
    selection.removeAllRanges();
    if (range) selection.addRange(range);
    else {
        const empty = document.createRange();
        empty.selectNodeContents(elements.markdownEditor);
        empty.collapse(true);
        selection.addRange(empty);
    }
}

function scrollMarkdownTo(start, end) {
    const range = createFindRangeMapper(elements.markdownEditor)(start, end);
    if (!range) return;
    const rect = range.getBoundingClientRect();
    const viewport = elements.markdownEditor.getBoundingClientRect();
    if (rect.top < viewport.top + 24 || rect.bottom > viewport.bottom - 24) {
        elements.markdownEditor.scrollTop += rect.top - viewport.top - viewport.height / 3;
    }
}

function applySourceEdit(text, out) {
    let prefix = 0;
    const max = Math.min(text.length, out.markdown.length);
    while (prefix < max && text[prefix] === out.markdown[prefix]) prefix += 1;
    if (prefix > 0 && /[\ud800-\udbff]/.test(text[prefix - 1])) prefix -= 1;
    let suffix = 0;
    while (suffix < max - prefix && text[text.length - 1 - suffix] === out.markdown[out.markdown.length - 1 - suffix]) suffix += 1;
    if (suffix > 0 && /[\udc00-\udfff]/.test(text[text.length - suffix])) suffix -= 1;
    const insert = out.markdown.slice(prefix, out.markdown.length - suffix);
    elements.markdownEditor.focus();
    setMarkdownSelection(prefix, text.length - suffix);
    // execCommand keeps the native undo stack intact; typing and command undo share it.
    const done = insert ? document.execCommand('insertText', false, insert) : document.execCommand('delete');
    if (!done || getMarkdownEditorText() !== out.markdown) {
        elements.markdownEditor.textContent = out.markdown;
        syncFromMarkdown();
    }
    setMarkdownSelection(out.selectionStart, out.selectionEnd);
}

function runSourceCommand(id, { quiet = false } = {}) {
    const api = window.AsterismCommands;
    const command = { quote: 'blockquote', rule: '' }[id] ?? id;
    if (!api?.applyCommand || !command) {
        if (!quiet) announce('That formatting is not available in Markdown');
        return false;
    }
    const text = getMarkdownEditorText();
    const { start, end } = markdownSelectionOffsets();
    let out;
    try {
        out = api.applyCommand(text, start, end, command);
    } catch {
        if (!quiet) announce('That formatting is not available in Markdown');
        return false;
    }
    if (!out || typeof out.markdown !== 'string' || out.markdown === text) return false;
    applySourceEdit(text, out);
    return true;
}

function richSelectionRange() {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !elements.richEditor.contains(selection.anchorNode)) return null;
    return selection.getRangeAt(0).cloneRange();
}

const linkDialogState = { range: null, revision: 0, opener: null };

function linkDialogOpen() {
    return !elements.linkDialog.hidden;
}

function closeLinkDialog({ restore = true } = {}) {
    if (!linkDialogOpen()) return;
    const opener = linkDialogState.opener;
    elements.linkDialog.hidden = true;
    elements.linkError.hidden = true;
    elements.linkError.textContent = '';
    linkDialogState.range = null;
    linkDialogState.opener = null;
    if (restore) {
        if (opener && document.contains(opener) && opener !== document.body) opener.focus({ preventScroll: true });
        else elements.richEditor.focus({ preventScroll: true });
    }
}

function openLinkDialog(range) {
    linkDialogState.range = range.cloneRange();
    linkDialogState.revision = state.documentRevision;
    linkDialogState.opener = document.activeElement;
    const anchor = range.commonAncestorContainer;
    const link = (anchor.nodeType === 1 ? anchor : anchor.parentElement)?.closest('a[href]');
    elements.linkInput.value = link && elements.richEditor.contains(link) ? link.getAttribute('href') || '' : '';
    elements.linkError.hidden = true;
    elements.linkError.textContent = '';
    const rect = range.getBoundingClientRect();
    const dialog = elements.linkDialog;
    dialog.hidden = false;
    const width = dialog.offsetWidth || 340;
    const height = dialog.offsetHeight || 120;
    const left = Math.max(12, Math.min(rect.left || 12, window.innerWidth - width - 12));
    let top = (rect.bottom || 60) + 8;
    if (top + height > window.innerHeight - 12) top = Math.max(12, (rect.top || 60) - height - 8);
    dialog.style.left = `${left}px`;
    dialog.style.top = `${top}px`;
    elements.linkInput.focus();
    elements.linkInput.select();
}

function submitLinkDialog() {
    const range = linkDialogState.range;
    const href = safeUrl(elements.linkInput.value);
    if (!href) {
        elements.linkError.textContent = elements.linkInput.value.trim() ? 'That link address is not allowed' : 'Enter a link address';
        elements.linkError.hidden = false;
        elements.linkInput.focus();
        return;
    }
    const valid = range && linkDialogState.revision === state.documentRevision && range.startContainer.isConnected &&
        range.endContainer.isConnected && !range.collapsed && elements.richEditor.contains(range.commonAncestorContainer);
    if (!valid) {
        closeLinkDialog({ restore: false });
        announce('Selection changed · select the text again to add a link');
        return;
    }
    if (blockRichMutation()) {
        closeLinkDialog({ restore: false });
        return;
    }
    closeLinkDialog({ restore: false });
    elements.richEditor.focus();
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('createLink', false, href);
    syncFromRich();
    renderFormatState();
}

function richTaskItems(range) {
    const within = (node) => (node.nodeType === 1 ? node : node.parentElement);
    const candidates = Array.from(elements.richEditor.querySelectorAll('li')).filter((li) => range.intersectsNode(li));
    const start = within(range.startContainer)?.closest('li');
    if (range.collapsed) return start && elements.richEditor.contains(start) ? [start] : [];
    return candidates.filter((li) => !candidates.some((other) => other !== li && li.contains(other)));
}

function toggleRichTaskList() {
    const range = richSelectionRange();
    if (!range) {
        announce('Place the cursor in the formatted pane first');
        return false;
    }
    elements.richEditor.focus();
    const selection = window.getSelection();
    let items = richTaskItems(range);
    if (!items.length) {
        document.execCommand('insertUnorderedList');
        const after = richSelectionRange();
        items = after ? richTaskItems(after) : [];
        if (!items.length) {
            announce('Could not make a list here · use the Markdown pane');
            syncFromRich();
            return false;
        }
    }
    const saved = richSelectionRange();
    const boxOf = (li) => Array.from(li.children).find((child) => child.matches('input[type="checkbox"]'));
    const removing = items.every(boxOf);
    items.forEach((li) => {
        const box = boxOf(li);
        const target = document.createRange();
        selection.removeAllRanges();
        if (removing) {
            target.setStartBefore(box);
            const next = box.nextSibling;
            if (next?.nodeType === 3 && /^[  ]/.test(next.data)) target.setEnd(next, 1);
            else target.setEndAfter(box);
            selection.addRange(target);
            document.execCommand('delete');
        } else if (!box) {
            target.setStart(li, 0);
            target.collapse(true);
            selection.addRange(target);
            document.execCommand('insertHTML', false, '<input type="checkbox">&nbsp;');
        }
    });
    if (saved?.startContainer.isConnected && saved.endContainer.isConnected) {
        selection.removeAllRanges();
        selection.addRange(saved);
    }
    syncFromRich();
    enableRichTasks();
    renderFormatState();
    return true;
}

// True when `offset` sits inside a fenced code block (including its opening and closing lines).
function insideFencedCode(text, offset) {
    let pos = 0;
    let open = null;
    for (const line of text.split('\n')) {
        const lineStart = pos;
        pos += line.length + 1;
        const fence = line.match(/^ {0,3}(?:\s*(?:[-*+]|\d+[.)])\s+)?(`{3,}|~{3,})(.*)$/) || line.match(/^\s*(`{3,}|~{3,})(.*)$/);
        if (!open) {
            if (fence && !(fence[1][0] === '`' && fence[2].includes('`'))) {
                open = { char: fence[1][0], length: fence[1].length, start: lineStart };
                if (offset >= lineStart && offset <= lineStart + line.length) return true;
            }
            continue;
        }
        const closes = fence && fence[1][0] === open.char && fence[1].length >= open.length && !fence[2].trim();
        if (closes) {
            if (offset > open.start && offset <= lineStart) return true;
            open = null;
        }
    }
    return Boolean(open && offset > open.start);
}

function runRichCommand(id) {
    if (blockRichMutation()) return false;
    if (id === 'link') {
        const range = richSelectionRange();
        if (!range || range.collapsed) {
            announce('Select text in the formatted pane to add a link');
            return false;
        }
        openLinkDialog(range);
        return true;
    }
    if (id === 'taskList') return toggleRichTaskList();
    elements.richEditor.focus();
    const selected = window.getSelection()?.toString() || '';
    if (id === 'code') {
        document.execCommand('insertHTML', false, `<code>${escapeHtml(selected || 'code')}</code>`);
    } else if (id === 'fencedCode') {
        document.execCommand('insertHTML', false, `<pre><code>${escapeHtml(selected || 'code')}</code></pre>`);
    } else if (id === 'blockquote') {
        document.execCommand('formatBlock', false, 'blockquote');
    } else if (/^h[1-6]$/.test(id)) {
        let current = '';
        try { current = String(document.queryCommandValue('formatBlock')).toLowerCase().replace(/[<>]/g, ''); } catch { current = ''; }
        document.execCommand('formatBlock', false, current === id ? 'p' : id);
    } else if (id === 'paragraph') {
        document.execCommand('formatBlock', false, 'p');
    } else if (RICH_EXEC[id]) {
        document.execCommand(RICH_EXEC[id], false, null);
    } else {
        return false;
    }
    syncFromRich();
    renderFormatState();
    return true;
}

function runEditorCommand(id, { pane } = {}) {
    if (state.view === 'reader') return false;
    const active = document.activeElement;
    if (active && active !== elements.markdownEditor && active !== elements.richEditor &&
        (active.matches?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])') || active.closest?.('dialog, [role="dialog"]'))) return false;
    const target = pane || (active === elements.markdownEditor ? 'markdown'
        : active === elements.richEditor ? 'rich' : state.lastEditor);
    return target === 'markdown' ? runSourceCommand(id) : runRichCommand(id);
}

function runFormattingCommand(command) {
    runEditorCommand(TOOLBAR_COMMAND_IDS[command] || command, { pane: 'rich' });
}

function editorCommandFor(event) {
    if (event.altKey && !event.shiftKey) {
        if (event.code === 'KeyC') return 'code';
        if (/^Digit[1-6]$/.test(event.code)) return `h${event.code.slice(5)}`;
        return event.code === 'Digit0' ? 'paragraph' : '';
    }
    if (event.altKey) return '';
    const key = event.key.toLowerCase();
    if (!event.shiftKey) return { b: 'bold', i: 'italic', k: 'link' }[key] || '';
    if (key === 'x') return 'strike';
    if (key === 'k') return 'fencedCode';
    return { Digit7: 'orderedList', Digit8: 'bulletList', Digit9: 'taskList' }[event.code] || '';
}

// ---- Jump to heading ----

let jumpItems = [];
let jumpVisible = [];
let jumpIndex = 0;
let jumpReturnFocus = null;

function headingLabel(token) {
    try {
        const html = sanitizeHtml(marked.parseInline(token.text || ''));
        const text = new DOMParser().parseFromString(html, 'text/html').body.textContent;
        return text.replace(/\s+/g, ' ').trim() || 'Untitled heading';
    } catch {
        return String(token.text || '').trim() || 'Untitled heading';
    }
}

// Headings come from the Markdown parser, so code blocks never contribute.
function parseHeadings(markdown) {
    if (typeof marked === 'undefined' || typeof marked.lexer !== 'function' || !markdown) return [];
    let tokens;
    try { tokens = marked.lexer(markdown); } catch { return []; }
    const found = [];
    let line = 0;
    const visit = (token, context) => {
        if (token.type === 'heading') {
            let at = context ? -1 : line;
            if (context) {
                const needle = String(token.raw).split('\n')[0].trim();
                for (let i = context.from; i < context.lines.length; i += 1) {
                    if (context.lines[i].includes(needle)) {
                        at = context.start + i;
                        context.from = i + 1;
                        break;
                    }
                }
            }
            found.push({ index: found.length, level: token.depth, label: headingLabel(token), line: at });
        } else if (token.type === 'blockquote' || token.type === 'list') {
            const inner = context || { start: line, lines: String(token.raw).split('\n'), from: 0 };
            const children = token.type === 'list' ? token.items.flatMap((item) => item.tokens || []) : token.tokens || [];
            children.forEach((child) => visit(child, inner));
        }
    };
    tokens.forEach((token) => {
        visit(token, null);
        line += (String(token.raw).match(/\n/g) || []).length;
    });
    return found;
}

function jumpOpen() {
    return !elements.jumpOverlay.hidden;
}

function normalizeSearch(value) {
    return String(value || '').normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase();
}

function renderJumpList() {
    const query = normalizeSearch(elements.jumpInput.value.trim());
    jumpVisible = query ? jumpItems.filter((item) => normalizeSearch(item.label).includes(query)) : jumpItems.slice();
    jumpIndex = Math.min(jumpIndex, Math.max(0, jumpVisible.length - 1));
    elements.jumpList.replaceChildren();
    jumpVisible.forEach((item, position) => {
        const option = document.createElement('li');
        option.className = 'jump-item';
        option.id = `jumpOption${position}`;
        option.setAttribute('role', 'option');
        option.dataset.level = String(item.level);
        option.textContent = item.label;
        option.addEventListener('mousedown', (event) => event.preventDefault());
        option.addEventListener('click', () => chooseJump(position));
        elements.jumpList.appendChild(option);
    });
    elements.jumpEmpty.hidden = jumpVisible.length > 0;
    if (!jumpVisible.length) {
        elements.jumpEmpty.textContent = jumpItems.length ? 'No headings match your filter.' : 'This document has no headings yet.';
    }
    markJumpSelection();
}

function markJumpSelection() {
    [...elements.jumpList.children].forEach((option, position) => {
        option.setAttribute('aria-selected', String(position === jumpIndex));
        if (position === jumpIndex) option.scrollIntoView({ block: 'nearest' });
    });
    if (jumpVisible.length) elements.jumpInput.setAttribute('aria-activedescendant', `jumpOption${jumpIndex}`);
    else elements.jumpInput.removeAttribute('aria-activedescendant');
}

function openJump() {
    closeOutlineDrawer({ restore: false });
    if (jumpOpen()) return;
    if (state.settingsOpen) closeSettings();
    jumpReturnFocus = document.activeElement;
    jumpItems = parseHeadings(state.markdown);
    jumpIndex = 0;
    elements.jumpInput.value = '';
    elements.jumpOverlay.hidden = false;
    renderJumpList();
    elements.jumpInput.focus();
}

function closeJump({ restore = true } = {}) {
    if (!jumpOpen()) return;
    elements.jumpOverlay.hidden = true;
    if (restore && jumpReturnFocus?.isConnected) jumpReturnFocus.focus?.();
    jumpReturnFocus = null;
}

function toggleJump() {
    if (jumpOpen()) closeJump();
    else openJump();
}

function chooseJump(position) {
    const item = jumpVisible[position];
    if (!item) return;
    const returnFocus = jumpReturnFocus;
    closeJump({ restore: false });
    jumpToHeading(item, returnFocus);
}

function jumpToHeading(item, returnFocus, list = jumpItems) {
    if (state.view === 'reader') {
        const headings = [...elements.readerContent.querySelectorAll('h1, h2, h3, h4, h5, h6')];
        let target = headings.length === list.length ? headings[item.index] : null;
        if (!target) {
            const nth = list.filter((other) => other.index < item.index && other.label === item.label).length;
            target = headings.filter((heading) => heading.textContent.replace(/\s+/g, ' ').trim() === item.label)[nth];
        }
        if (!target) {
            announce('Heading not found');
            returnFocus?.focus?.();
            return;
        }
        target.scrollIntoView({ block: 'start' });
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
        return;
    }
    const lines = getMarkdownEditorText().split('\n');
    let line = item.line;
    if (line < 0 || line >= lines.length) {
        const needle = item.label;
        line = lines.findIndex((text) => /^\s{0,3}#{1,6}\s/.test(text) && text.includes(needle));
    }
    if (line < 0) {
        announce('Could not locate that heading in the Markdown');
        returnFocus?.focus?.();
        return;
    }
    let start = 0;
    for (let i = 0; i < line; i += 1) start += lines[i].length + 1;
    const end = start + lines[line].length;
    elements.markdownEditor.focus();
    setMarkdownSelection(start, end);
    scrollMarkdownTo(start, end);
    elements.richEditor.querySelectorAll('h1, h2, h3, h4, h5, h6')[item.index]?.scrollIntoView({ block: 'start' });
}

function handleJumpKeydown(event) {
    if (event.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!jumpVisible.length) return;
        jumpIndex = (jumpIndex + (event.key === 'ArrowDown' ? 1 : -1) + jumpVisible.length) % jumpVisible.length;
        markJumpSelection();
    } else if (event.key === 'Enter') {
        event.preventDefault();
        chooseJump(jumpIndex);
    } else if (event.key === 'Tab') {
        event.preventDefault();
    }
}

// ---- Document outline ----
// A quiet left rail built from parseHeadings(); clicks reuse jumpToHeading() so Reader, rich and
// Markdown stay on the same heading identity. Rebuilds only when the heading list changes.

const OUTLINE_QUERY = window.matchMedia('(min-width: 900px)');
let outlineItems = [];
let outlineSignature = null;
let outlineTimer = null;
let outlineForced = false;
let outlineDrawerOpen = false;
let outlineReturnFocus = null;
let outlineLastScroll = '';
let outlineMapper = null;
let outlineMapperObserver = null;
let outlineFrame = 0;
let outlineActive = -1;
let outlineOffsets = null;
let outlineOffsetsFor = null;

function outlineWide() {
    return OUTLINE_QUERY.matches;
}

function outlineNeeded() {
    return outlineWide() ? !state.preferences.outlineHidden : outlineDrawerOpen;
}

function outlineBackground() {
    return [document.getElementById('wordmarkStrip'), elements.findBar, document.querySelector('.doc-stage'), document.querySelector('.statusbar')].filter(Boolean);
}

function outlineVisible() {
    if (!outlineWide()) return outlineDrawerOpen;
    return !state.preferences.outlineHidden && (outlineItems.length > 0 || outlineForced);
}

function renderOutlineChrome() {
    const visible = outlineVisible();
    elements.outlinePanel.hidden = !visible;
    const modal = visible && !outlineWide();
    elements.outlineBackdrop.hidden = !modal;
    const panel = elements.outlinePanel;
    if (modal) {
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-label', 'Document outline');
    } else {
        panel.removeAttribute('role');
        panel.removeAttribute('aria-modal');
        panel.removeAttribute('aria-label');
    }
    for (const el of outlineBackground()) el.inert = modal;
    elements.outlineButton.setAttribute('aria-expanded', String(visible));
    elements.outlineButton.title = platformLabel(`${visible ? 'Hide' : 'Show'} outline  ⌘⌥O`);
}

function renderOutlineList() {
    const list = elements.outlineList;
    const focusedIndex = list.contains(document.activeElement) ? Number(document.activeElement.dataset.index) : -1;
    const minLevel = outlineItems.reduce((min, item) => Math.min(min, item.level), 6);
    list.replaceChildren(...outlineItems.map((item) => {
        const row = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'outline-item';
        button.dataset.level = String(item.level);
        button.dataset.depth = String(Math.min(5, item.level - minLevel));
        button.dataset.index = String(item.index);
        button.title = item.label;
        button.textContent = item.label;
        row.appendChild(button);
        return row;
    }));
    list.hidden = outlineItems.length === 0;
    elements.outlineEmpty.hidden = outlineItems.length > 0;
    outlineActive = -1;
    if (focusedIndex >= 0) list.querySelector(`[data-index="${Math.min(focusedIndex, outlineItems.length - 1)}"]`)?.focus({ preventScroll: true });
}

function refreshOutline() {
    clearTimeout(outlineTimer);
    outlineTimer = null;
    if (!outlineNeeded()) {
        outlineSignature = null;
        renderOutlineChrome();
        return;
    }
    outlineItems = parseHeadings(state.markdown);
    const signature = outlineItems.map((item) => `${item.level}:${item.label}`).join('\n');
    if (signature !== outlineSignature) {
        outlineSignature = signature;
        renderOutlineList();
    }
    renderOutlineChrome();
    scheduleOutlineActive();
}

function scheduleOutline() {
    if (!outlineNeeded()) return;
    clearTimeout(outlineTimer);
    outlineTimer = setTimeout(refreshOutline, 160);
}

function outlineSource() {
    if (state.view === 'reader') return 'reader';
    return outlineLastScroll || (state.lastEditor === 'markdown' ? 'markdown' : 'rich');
}

function outlineMarkdownOffsets() {
    if (outlineOffsetsFor === state.markdown && outlineOffsets) return outlineOffsets;
    const lines = state.markdown.split('\n');
    const starts = [];
    let at = 0;
    lines.forEach((text) => { starts.push(at); at += text.length + 1; });
    outlineOffsets = outlineItems.map((item) => (item.line >= 0 && item.line < lines.length ? starts[item.line] : -1));
    outlineOffsetsFor = state.markdown;
    return outlineOffsets;
}

function computeOutlineActive() {
    const source = outlineSource();
    const container = source === 'reader' ? elements.readerView : source === 'markdown' ? elements.markdownEditor : elements.richEditor;
    const box = container.getBoundingClientRect();
    if (!box.height) return -1;
    const line = box.top + Math.min(96, box.height * 0.25);
    let tops;
    if (source === 'markdown') {
        if (outlineMapperObserver) {
            if (outlineMapperObserver.takeRecords().length) outlineMapper = null;
        } else outlineMapper = null;
        if (!outlineMapper) outlineMapper = createFindRangeMapper(elements.markdownEditor);
        const mapper = outlineMapper;
        tops = outlineMarkdownOffsets().map((start) => {
            const range = start >= 0 ? mapper(start, start + 1) : null;
            return range ? range.getBoundingClientRect().top : Infinity;
        });
    } else {
        const root = source === 'reader' ? elements.readerContent : elements.richEditor;
        const headings = root.querySelectorAll('h1, h2, h3, h4, h5, h6');
        if (headings.length !== outlineItems.length) return -1;
        tops = Array.from(headings, (heading) => heading.getBoundingClientRect().top);
    }
    let active = -1;
    for (let i = 0; i < tops.length; i += 1) if (tops[i] <= line) active = i;
    if (container.scrollTop > 0 && container.scrollTop + container.clientHeight >= container.scrollHeight - 2 && tops.length) active = tops.length - 1;
    return active;
}

function setOutlineActive(index) {
    if (index === outlineActive) return;
    const buttons = elements.outlineList.children;
    if (buttons[outlineActive]) buttons[outlineActive].firstChild.removeAttribute('aria-current');
    outlineActive = index;
    const button = buttons[index]?.firstChild;
    if (!button) return;
    button.setAttribute('aria-current', 'true');
    const list = elements.outlineList.getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    if (rect.top < list.top) elements.outlineList.scrollTop -= list.top - rect.top + 8;
    else if (rect.bottom > list.bottom) elements.outlineList.scrollTop += rect.bottom - list.bottom + 8;
}

function updateOutlineActive() {
    outlineFrame = 0;
    if (!outlineVisible() || !outlineItems.length) return;
    setOutlineActive(computeOutlineActive());
}

function scheduleOutlineActive() {
    if (outlineFrame || !outlineVisible()) return;
    outlineFrame = requestAnimationFrame(updateOutlineActive);
}

function openOutlineDrawer() {
    if (outlineDrawerOpen) return;
    outlineReturnFocus = document.activeElement;
    outlineDrawerOpen = true;
    refreshOutline();
    updateOutlineActive();
    (elements.outlineList.querySelector('[aria-current="true"]') || elements.outlineList.querySelector('button') || elements.outlineClose).focus();
}

function closeOutlineDrawer({ restore = true } = {}) {
    if (!outlineDrawerOpen) return;
    outlineDrawerOpen = false;
    renderOutlineChrome();
    const target = outlineReturnFocus?.isConnected && outlineReturnFocus !== document.body ? outlineReturnFocus : elements.outlineButton;
    outlineReturnFocus = null;
    if (restore) target.focus?.();
}

function toggleOutline() {
    if (!outlineWide()) {
        if (outlineDrawerOpen) closeOutlineDrawer();
        else openOutlineDrawer();
        return;
    }
    if (outlineVisible()) {
        state.preferences.outlineHidden = true;
    } else {
        state.preferences.outlineHidden = false;
        outlineForced = true;
    }
    savePreferences();
    refreshOutline();
}

function chooseOutline(index) {
    const item = outlineItems[index];
    if (!item) return;
    setOutlineActive(index);
    if (!outlineWide()) closeOutlineDrawer({ restore: false });
    jumpToHeading(item, elements.outlineButton, outlineItems);
}

function bindOutlineEvents() {
    elements.outlineButton.addEventListener('click', toggleOutline);
    elements.outlineClose.addEventListener('click', () => closeOutlineDrawer());
    elements.outlineBackdrop.addEventListener('click', () => closeOutlineDrawer());
    elements.outlineList.addEventListener('click', (event) => {
        const button = event.target.closest('.outline-item');
        if (button) chooseOutline(Number(button.dataset.index));
    });
    elements.outlinePanel.addEventListener('keydown', (event) => {
        if (event.key !== 'Tab' || !outlineDrawerOpen) return;
        const focusable = [...elements.outlinePanel.querySelectorAll('button')].filter((b) => !b.disabled && b.offsetParent !== null);
        if (!focusable.length) return;
        const at = focusable.indexOf(document.activeElement);
        const next = focusable[(at + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length];
        event.preventDefault();
        next.focus();
    });
    elements.outlineList.addEventListener('keydown', (event) => {
        const keys = { ArrowDown: 1, ArrowUp: -1, Home: 'first', End: 'last' };
        if (!(event.key in keys) || event.altKey || event.metaKey || event.ctrlKey) return;
        const buttons = [...elements.outlineList.querySelectorAll('.outline-item')];
        const at = buttons.indexOf(document.activeElement);
        if (at < 0) return;
        event.preventDefault();
        const move = keys[event.key];
        const next = move === 'first' ? 0 : move === 'last' ? buttons.length - 1 : Math.min(buttons.length - 1, Math.max(0, at + move));
        buttons[next].focus();
    });
    elements.readerView.addEventListener('scroll', scheduleOutlineActive, { passive: true });
    elements.editView.addEventListener('scroll', (event) => {
        if (event.target === elements.markdownEditor) outlineLastScroll = 'markdown';
        else if (event.target === elements.richEditor) outlineLastScroll = 'rich';
        else return;
        scheduleOutlineActive();
    }, { capture: true, passive: true });
    if (typeof MutationObserver === 'function') {
        outlineMapperObserver = new MutationObserver(() => { outlineMapper = null; });
        outlineMapperObserver.observe(elements.markdownEditor, { childList: true, characterData: true, subtree: true });
    }
    elements.editView.addEventListener('focusin', (event) => {
        if (event.target === elements.markdownEditor) outlineLastScroll = 'markdown';
        else if (event.target === elements.richEditor) outlineLastScroll = 'rich';
        else return;
        scheduleOutlineActive();
    });
    OUTLINE_QUERY.addEventListener?.('change', () => {
        const hadFocus = elements.outlinePanel.contains(document.activeElement);
        outlineDrawerOpen = false;
        refreshOutline();
        if (hadFocus) elements.outlineButton.focus();
    });
}

// ---- Copy formatted, print, shortcut help ----

async function copyFormatted() {
    if (!state.markdown) {
        announce('Nothing to copy yet');
        return;
    }
    if (state.view !== 'reader') renderReader();
    const clone = elements.readerContent.cloneNode(true);
    clone.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
    clone.querySelectorAll('img[data-asterism-relative-src]').forEach((image) => {
        if (!image.getAttribute('src')) image.setAttribute('src', image.getAttribute('data-asterism-relative-src'));
    });
    const html = sanitizeHtml(clone.innerHTML);
    const text = elements.readerContent.innerText || elements.readerContent.textContent || '';
    try {
        if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
            await navigator.clipboard.write([new ClipboardItem({
                'text/html': new Blob([html], { type: 'text/html' }),
                'text/plain': new Blob([text], { type: 'text/plain' })
            })]);
            announce('Formatted text copied');
            return;
        }
    } catch (error) {
        console.warn('Rich clipboard write failed:', error);
    }
    const selection = window.getSelection();
    const saved = selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
    const focused = document.activeElement;
    let copied = false;
    const holder = document.createElement('div');
    holder.setAttribute('aria-hidden', 'true');
    holder.style.cssText = 'position:fixed;left:-9999px;top:0;width:40rem;user-select:text;-webkit-user-select:text;';
    holder.innerHTML = html;
    document.body.append(holder);
    try {
        const range = document.createRange();
        range.selectNodeContents(holder);
        selection.removeAllRanges();
        selection.addRange(range);
        copied = document.execCommand('copy');
    } catch {
        copied = false;
    }
    holder.remove();
    selection.removeAllRanges();
    if (focused && focused !== document.body && document.contains(focused)) focused.focus({ preventScroll: true });
    if (saved) selection.addRange(saved);
    announce(copied ? 'Formatted text copied' : 'Could not copy formatted text · select the text and copy it, or use Copy Markdown');
}

function printDocument() {
    if (!state.markdown) {
        announce('Nothing to print yet');
        return;
    }
    const previousView = state.view;
    if (previousView !== 'reader') renderReader();
    const restore = () => {
        window.removeEventListener('afterprint', restore);
        if (previousView !== 'reader' && state.view === previousView) renderViewSwitch();
    };
    window.addEventListener('afterprint', restore);
    window.print();
}

const SHORTCUTS = [
    ['Bold', ['Mod', 'B']], ['Italic', ['Mod', 'I']], ['Link', ['Mod', 'K']],
    ['Strikethrough', ['Mod', 'Shift', 'X']], ['Inline code', ['Mod', 'Alt', 'C']], ['Code block', ['Mod', 'Shift', 'K']],
    ['Heading 1–6', ['Mod', 'Alt', '1–6']], ['Paragraph', ['Mod', 'Alt', '0']],
    ['Numbered list', ['Mod', 'Shift', '7']], ['Bulleted list', ['Mod', 'Shift', '8']], ['Task list', ['Mod', 'Shift', '9']],
    ['Indent / outdent', ['Tab', 'Shift+Tab']],
    ['Find', ['Mod', 'F']], ['Next / previous', ['Mod', 'G']], ['Replace', ['Alt', 'Mod', 'F']],
    ['Jump to heading', ['Mod', 'Shift', 'O']], ['Toggle outline', ['Mod', 'Alt', 'O']], ['Read / Edit', ['Mod', 'E']],
    ['Open file', ['Mod', 'O']], ['Save', ['Mod', 'S']], ['Save As', ['Mod', 'Shift', 'S']],
    ['Copy Markdown', ['Mod', 'Shift', 'C']], ['Print', ['Mod', 'P']], ['New document', ['Mod', 'N']],
    ['Settings', ['Mod', ',']], ['Shortcut help', ['Mod', '/']]
];

function platformKey(token) {
    if (IS_MAC) return { Mod: '⌘', Shift: '⇧', Alt: '⌥' }[token] || token;
    return { Mod: 'Ctrl' }[token] || token;
}

function platformLabel(text) {
    return IS_MAC ? text : String(text).replace(/⌘/g, 'Ctrl+').replace(/⇧/g, 'Shift+').replace(/⌥/g, 'Alt+');
}

function renderShortcutList() {
    elements.shortcutList.replaceChildren();
    SHORTCUTS.forEach(([name, keys]) => {
        const row = document.createElement('div');
        const term = document.createElement('dt');
        term.textContent = name;
        const definition = document.createElement('dd');
        keys.forEach((token) => {
            const key = document.createElement('kbd');
            key.textContent = platformKey(token);
            definition.appendChild(key);
        });
        row.append(term, definition);
        elements.shortcutList.appendChild(row);
    });
    if (!IS_MAC) {
        document.querySelectorAll('[title]').forEach((node) => { node.title = platformLabel(node.title); });
        elements.emptyPasteButton.querySelectorAll('kbd').forEach((node) => { node.textContent = platformLabel(node.textContent); });
    }
}

function showShortcutHelp() {
    closeJump({ restore: false });
    if (!state.settingsOpen) openSettings();
    requestAnimationFrame(() => {
        elements.shortcutsHeading.scrollIntoView({ block: 'start' });
        elements.shortcutsHeading.focus({ preventScroll: true });
    });
}

async function checkFolderForDocument() {
    if (!browserFolderLinked || !browserDocument) return;
    const doc = browserDocument;
    try {
        if (await browserFiles.pathForDocument(doc)) return;
    } catch { /* treat as outside the folder */ }
    if (browserDocument !== doc) return;
    browserFolderLinked = false;
    localImageCache.clear();
    elements.linkFolderButton.textContent = 'Link folder…';
    announce('This document is outside the linked folder · link its folder again');
}

async function linkFolder() {
    if (!browserFiles?.chooseFolder) return;
    try {
        const result = await browserFiles.chooseFolder();
        if (!result || result.canceled || result.unavailable) return;
        if (browserDocument) {
            const relative = await browserFiles.pathForDocument(browserDocument);
            if (!relative) {
                browserFolderLinked = false;
                elements.linkFolderButton.textContent = 'Link folder…';
                announce('That folder does not contain this document · choose its folder or a parent');
                return;
            }
        }
        browserFolderLinked = true;
        localImageCache.clear();
        renderRichFromMarkdown();
        if (state.view === 'reader') renderReader();
        elements.linkFolderButton.textContent = 'Folder linked';
        announce(browserDocument ? 'Folder linked · nearby images and links can open' : 'Folder linked · open or save a file inside it to use nearby images');
    } catch (error) {
        console.error('Folder link failed:', error);
        announce(fileErrorMessage(error, 'read'));
    }
}

function isTypingTarget(target) {
    return Boolean(target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])'));
}

function handleEscape(event) {
    if (linkDialogOpen()) {
        event.preventDefault();
        closeLinkDialog();
        return;
    }
    if (document.activeElement === elements.markdownEditor) tabReleased = true;
    if (jumpOpen()) closeJump();
    else if (state.settingsOpen) closeSettings();
    else if (outlineDrawerOpen) {
        event.preventDefault();
        closeOutlineDrawer();
    }
    else if (state.findOpen) closeFind();
    else if (state.view === 'reader' && !event.defaultPrevented) closeReader();
}

function handleGlobalKeydown(event) {
    if (event.isComposing) return;
    if (event.key === 'Escape') {
        handleEscape(event);
        return;
    }
    if (linkDialogOpen()) {
        if (event.key === 'Tab') {
            const focusable = Array.from(elements.linkDialog.querySelectorAll('input, button'));
            const index = focusable.indexOf(document.activeElement);
            const next = focusable[(index + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length];
            event.preventDefault();
            next.focus();
        }
        return;
    }
    const wasReleased = tabReleased;
    tabReleased = false;
    const modifier = event.metaKey || event.ctrlKey;
    const platformMod = IS_MAC ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
    const key = event.key.toLowerCase();
    const dialogOpen = state.settingsOpen || jumpOpen();

    if (platformMod && !event.altKey && (event.key === '/' || event.code === 'Slash') && !event.shiftKey) {
        event.preventDefault();
        showShortcutHelp();
        return;
    }
    if (!modifier && !event.altKey && event.key === '?' && !dialogOpen && !isTypingTarget(event.target)) {
        event.preventDefault();
        showShortcutHelp();
        return;
    }
    if (platformMod && event.shiftKey && !event.altKey && key === 'o') {
        event.preventDefault();
        toggleJump();
        return;
    }
    if (dialogOpen) {
        if (modifier && key === ',' && !jumpOpen()) {
            event.preventDefault();
            toggleSettings();
        }
        return;
    }

    if (modifier && event.altKey && !event.shiftKey && event.code === 'KeyO' && !event.getModifierState?.('AltGraph')) {
        event.preventDefault();
        toggleOutline();
        return;
    }

    const inFindInput = [elements.findInput, elements.replaceInput].includes(document.activeElement);
    const inEditor = document.activeElement === elements.richEditor || document.activeElement === elements.markdownEditor;
    if (platformMod && inEditor && state.view === 'edit') {
        const command = editorCommandFor(event);
        if (command) {
            event.preventDefault();
            runEditorCommand(command);
            return;
        }
    }
    if (event.key === 'Enter' && !modifier && !event.altKey && !event.shiftKey && !event.isComposing && event.keyCode !== 229 &&
        document.activeElement === elements.markdownEditor && state.view === 'edit') {
        const { start, end } = markdownSelectionOffsets();
        const text = getMarkdownEditorText();
        if (insideFencedCode(text, start) || insideFencedCode(text, end)) return;
        if (runSourceCommand('continueList', { quiet: true })) event.preventDefault();
        return;
    }
    if (event.key === 'Tab' && !modifier && !event.altKey && document.activeElement === elements.markdownEditor && !wasReleased) {
        if (runSourceCommand(event.shiftKey ? 'outdent' : 'indent', { quiet: true })) event.preventDefault();
        return;
    }
    if (modifier && key === 'z' && !inFindInput && !state.replacementNativeUndo && event.shiftKey && state.replacementRedoMarkdown !== null) {
        event.preventDefault();
        redoReplacement();
    } else if (modifier && key === 'z' && !inFindInput && !state.replacementNativeUndo && !event.shiftKey && state.replacementUndoMarkdown !== null) {
        event.preventDefault();
        undoReplacement();
    } else if (modifier && key === 'f') {
        event.preventDefault();
        openFind({ replace: event.altKey });
    } else if (modifier && key === 'g') {
        event.preventDefault();
        moveFind(event.shiftKey ? -1 : 1);
    } else if (modifier && event.shiftKey && key === 'c') {
        event.preventDefault();
        copyMarkdown();
    } else if (modifier && key === ',') {
        event.preventDefault();
        toggleSettings();
    } else if (modifier && key === 'e') {
        event.preventDefault();
        toggleReader();
    } else if (platformMod && !event.shiftKey && !event.altKey && key === 'p') {
        event.preventDefault();
        printDocument();
    } else if (modifier && key === 'o') {
        event.preventDefault();
        openDocument();
    } else if (modifier && key === 's') {
        event.preventDefault();
        saveMarkdown({ saveAs: event.shiftKey });
    } else if (modifier && key === 'n') {
        event.preventDefault();
        clearNow({ confirmNew: true });
    }
}

function setDragOverlay(visible) {
    elements.dragOverlay.hidden = !visible;
}

function setupDragAndDrop() {
    window.addEventListener('dragenter', (event) => {
        event.preventDefault();
        state.dragDepth += 1;
        setDragOverlay(true);
    });
    window.addEventListener('dragover', (event) => event.preventDefault());
    window.addEventListener('dragleave', (event) => {
        event.preventDefault();
        state.dragDepth = Math.max(0, state.dragDepth - 1);
        if (state.dragDepth === 0) setDragOverlay(false);
    });
    window.addEventListener('drop', (event) => {
        if (event.defaultPrevented) return;
        event.preventDefault();
        state.dragDepth = 0;
        setDragOverlay(false);
        loadBrowserFile(event.dataTransfer?.files?.[0]);
    });
}

const NATIVE_FORMAT_IDS = { paragraph: 'paragraph', blockquote: 'blockquote', fencedCode: 'fencedCode', strike: 'strike' };

function setupDesktopIntegration() {
    if (window.desktopBridge?.isElectron) document.body.classList.add('is-desktop');
    if (window.desktopBridge?.isTauri) {
        document.body.classList.add('is-tauri');
        elements.wordmarkStrip.addEventListener('mousedown', (event) => {
            if (event.button === 0 && !event.target.closest('button')) window.desktopBridge.startDragging?.();
        });
    }

    window.desktopBridge?.onMenuAction?.((action) => {
        if (action === 'open-settings') openSettings();
        else if (action === 'new-document') clearNow({ confirmNew: true });
        else if (action === 'open-document') openDocument();
        else if (action === 'save-output') saveMarkdown();
        else if (action === 'save-as') saveMarkdown({ saveAs: true });
        else if (action === 'find') openFind();
        else if (action === 'replace') openFind({ replace: true });
        else if (action === 'find-next') moveFind(1);
        else if (action === 'find-previous') moveFind(-1);
        else if (action === 'jump-heading' || action === 'jump-to-heading') toggleJump();
        else if (action === 'toggle-outline') {
            if (!jumpOpen() && !state.settingsOpen) toggleOutline();
        }
        else if (action === 'toggle-reader') toggleReader();
        else if (action === 'print-document' || action === 'print') printDocument();
        else if (action === 'copy-formatted') copyFormatted();
        else if (action === 'show-shortcuts') showShortcutHelp();
        else if (typeof action === 'string' && (action.startsWith('format-') || action.startsWith('format:'))) {
            const id = NATIVE_FORMAT_IDS[action.slice(7)] || action.slice(7);
            if (!jumpOpen() && !state.settingsOpen) runEditorCommand(id);
        }
    });

    window.desktopBridge?.onOpenFile?.((fileData) => loadDocumentData(fileData));
}

function bindEvents() {
    elements.linkDialog.addEventListener('submit', (event) => {
        event.preventDefault();
        submitLinkDialog();
    });
    elements.linkCancel.addEventListener('click', () => closeLinkDialog());
    document.addEventListener('pointerdown', (event) => {
        if (linkDialogOpen() && !elements.linkDialog.contains(event.target)) closeLinkDialog({ restore: false });
    });
    elements.richEditor.addEventListener('beforeinput', (event) => blockRichMutation(event));
    elements.richEditor.addEventListener('input', (event) => {
        if (event.target?.matches?.('input[type="checkbox"]')) return;
        if (blockRichMutation()) {
            renderRichFromMarkdown();
            return;
        }
        syncFromRich();
        enableRichTasks();
    });
    elements.richEditor.addEventListener('click', (event) => {
        const box = event.target;
        if (!box?.matches?.('li > input[type="checkbox"]')) return;
        if (blockRichMutation(event)) return;
        // Cancel the native toggle (keeps property and attribute in agreement) and replace the
        // box in one native edit transaction so undo/redo restore it.
        event.preventDefault();
        toggleRichTask(box);
    });
    elements.richEditor.addEventListener('compositionstart', (event) => blockRichMutation(event));
    elements.richEditor.addEventListener('drop', (event) => {
        if (blockRichMutation(event)) {
            state.dragDepth = 0;
            setDragOverlay(false);
        }
    });
    elements.richEditor.addEventListener('paste', insertRichClipboard);
    elements.richEditor.addEventListener('focus', () => {
        state.lastEditor = 'rich';
        refreshFind({ reset: true });
        elements.richPane.classList.add('is-focused');
        renderEmptyState();
    });
    elements.richEditor.addEventListener('blur', () => setTimeout(() => {
        if (document.activeElement === elements.richEditor) return;
        elements.richPane.classList.remove('is-focused');
        renderEmptyState();
    }, 120));
    elements.markdownEditor.addEventListener('input', syncFromMarkdown);
    elements.markdownEditor.addEventListener('paste', insertPlainClipboard);
    elements.markdownEditor.addEventListener('scroll', syncMarkdownScroll);
    elements.markdownEditor.addEventListener('focus', () => {
        state.lastEditor = 'markdown';
        refreshFind({ reset: true });
        elements.markdownPane.classList.add('is-focused');
    });
    elements.markdownEditor.addEventListener('blur', () => elements.markdownPane.classList.remove('is-focused'));
    elements.richHelpButton.addEventListener('click', () => {
        const open = elements.richHelpButton.getAttribute('aria-expanded') === 'true';
        elements.richHelpButton.setAttribute('aria-expanded', String(!open));
        if (open) {
            if (state.sourceGuardMode === 'converted') elements.sourceGuard.querySelector('.guard-help-note')?.remove();
            else hideSourceGuard();
        }
        else if (state.sourceGuardMode === 'converted') {
            const note = document.createElement('p');
            note.className = 'guard-help-note';
            note.textContent = 'Formatted edits can simplify comments, link and footnote definitions, and YAML front matter. The Markdown pane preserves exact source.';
            elements.sourceGuard.prepend(note);
        }
        else showSourceGuard('help');
    });
    elements.sourceGuard.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && state.sourceGuardMode === 'warning') {
            event.preventDefault();
            hideSourceGuard();
            elements.richEditor.focus();
        }
    });

    document.querySelectorAll('.format-tool').forEach((button) => {
        button.addEventListener('mousedown', (event) => event.preventDefault());
        button.addEventListener('click', () => runFormattingCommand(button.dataset.command));
    });

    [elements.pasteButton, elements.emptyPasteButton].forEach((button) => {
        button.addEventListener('mousedown', (event) => event.preventDefault());
        button.addEventListener('click', pasteFromClipboard);
    });
    elements.emptyOpenButton.addEventListener('click', openDocument);
    elements.copyButton.addEventListener('click', copyMarkdown);
    elements.copyFormattedButton.addEventListener('click', copyFormatted);
    elements.jumpButton.addEventListener('click', toggleJump);
    bindOutlineEvents();
    elements.jumpBackdrop.addEventListener('click', () => closeJump());
    elements.jumpInput.addEventListener('input', () => { jumpIndex = 0; renderJumpList(); });
    elements.jumpInput.addEventListener('keydown', handleJumpKeydown);
    elements.linkFolderButton.addEventListener('click', linkFolder);
    elements.linkFolderButton.hidden = !(browserFiles && typeof window.showDirectoryPicker === 'function' && browserFiles.chooseFolder);
    elements.downloadButton.addEventListener('click', saveMarkdown);
    elements.clearButton.addEventListener('click', handleClear);
    elements.openButton.addEventListener('click', openDocument);
    elements.viewEditButton.addEventListener('click', closeReader);
    elements.viewReadButton.addEventListener('click', openReader);
    elements.settingsButton.addEventListener('click', openSettings);
    elements.settingsClose.addEventListener('click', closeSettings);
    elements.themeButton.addEventListener('click', cycleTheme);
    elements.settingsBackdrop.addEventListener('click', closeSettings);
    elements.clearSavedButton.addEventListener('click', clearSavedData);
    elements.reconnectFileButton.addEventListener('click', reconnectRecoveredFile);
    elements.fileInput.addEventListener('change', () => loadBrowserFile(elements.fileInput.files?.[0]));
    elements.readerContent.addEventListener('click', handleDocumentLinkClick);
    elements.richEditor.addEventListener('click', handleDocumentLinkClick);
    elements.findInput.addEventListener('input', () => {
        state.findQuery = elements.findInput.value;
        refreshFind({ reset: true, scroll: true });
    });
    elements.findInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            moveFind(event.shiftKey ? -1 : 1);
        }
    });
    elements.findPrevious.addEventListener('click', () => moveFind(-1));
    elements.findNext.addEventListener('click', () => moveFind(1));
    elements.findClose.addEventListener('click', closeFind);
    elements.replaceOne.addEventListener('click', replaceOneMatch);
    elements.replaceAll.addEventListener('click', replaceAllMatches);
    elements.replaceUndo.addEventListener('click', undoReplacement);
    document.addEventListener('keydown', handleGlobalKeydown);
    if (!window.desktopBridge) {
        window.addEventListener('beforeunload', (event) => {
            if (!hasUnpersistedDocument()) return;
            event.preventDefault();
            event.returnValue = '';
        });
    }
    document.addEventListener('selectionchange', renderFormatState);
    systemTheme.addEventListener?.('change', () => {
        if (state.preferences.appearance === 'auto') applyTheme({ animate: true });
    });
}

function initialize() {
    loadPreferences();
    configureConverters();
    applyTheme();
    applyTextSize();
    renderSettingsRows();
    renderShortcutList();
    renderStatusHint();
    const snapshot = readJsonStorage([STORAGE_KEYS.draftSnapshot]);
    const legacyMeta = readJsonStorage([STORAGE_KEYS.documentMeta]);
    const legacyDocument = loadDocument();
    const validSnapshot = snapshot?.version === 1 && typeof snapshot.markdown === 'string';
    const savedDocument = validSnapshot ? snapshot.markdown : legacyDocument;
    if (validSnapshot) {
        state.currentFileName = typeof snapshot.name === 'string' ? snapshot.name : '';
        state.recoveredDocument = true;
        state.recoveredSourcePath = typeof snapshot.filePath === 'string' ? snapshot.filePath : '';
        state.recoveryBaseline = typeof snapshot.lastDiskContent === 'string' ? snapshot.lastDiskContent : null;
        state.recoveryLastSavedMarkdown = typeof snapshot.lastSavedMarkdown === 'string' ? snapshot.lastSavedMarkdown : '';
        state.recoveryKind = typeof snapshot.kind === 'string' ? snapshot.kind : '';
    } else if (typeof legacyMeta?.name === 'string' && legacyMeta.name) {
        // Legacy local drafts did not preserve a safe disk baseline; keep them detached.
        state.currentFileName = legacyMeta.name;
        state.recoveredDocument = true;
    }
    setDocumentFromMarkdown(savedDocument, { persist: false });
    if (validSnapshot) {
        state.lastSavedMarkdown = state.recoveryLastSavedMarkdown;
        state.lastDiskContent = state.recoveryBaseline ?? '';
    }
    renderDocName();
    renderStatusHint();
    bindEvents();
    setupDragAndDrop();
    setupDesktopIntegration();
    renderOutlineChrome();
    if (savedDocument) openReader();
}

initialize();
