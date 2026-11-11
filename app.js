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
    flavor: 'GFM',
    readerWidth: '72',
    smartQuotes: true,
    textSize: '16',
    autoSave: true
});

const SETTING_DEFINITIONS = [
    { key: 'appearance', name: 'Appearance', values: ['light', 'dark', 'auto'], labels: ['Light', 'Dark', 'Auto'] },
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
    replaceUndo: document.getElementById('replaceUndo')
};

let turndownService = null;
let highlightLoadPromise = null;
let clearArmTimer = null;
let undoTimer = null;
let copiedTimer = null;
let savedDataTimer = null;
let toastTimer = null;
const localImageCache = new Map();
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
        Array.from(node.attributes).forEach((attribute) => node.removeAttribute(attribute.name));
        if (href) {
            node.setAttribute('href', href);
            node.setAttribute('rel', 'noreferrer');
            node.setAttribute('target', '_blank');
        }
        if (src) node.setAttribute('src', src);
        if (alt) node.setAttribute('alt', alt);
        if (title) node.setAttribute('title', title);
    });

    return template.innerHTML;
}

function createTurndownService() {
    if (typeof TurndownService === 'undefined') return null;
    const fencedPreReplacement = (node, options) => {
        const code = node.textContent.replace(/\n$/, '');
        return `\n\n${options.fence}\n${code}\n${options.fence}\n\n`;
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
            const item = content
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
            return prefix + item + (node.nextSibling && !/\n$/.test(item) ? '\n' : '');
        }
    });

    service.addRule('paperFencedCodeBlock', {
        filter: 'pre',
        replacement(content, node, options) {
            return fencedPreReplacement(node, options);
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
    const lightTheme = document.getElementById('highlight-light');
    const darkTheme = document.getElementById('highlight-dark');
    if (lightTheme) lightTheme.disabled = mode === 'dark';
    if (darkTheme) darkTheme.disabled = mode !== 'dark';
}

function loadHighlightAssets() {
    if (typeof hljs !== 'undefined') return Promise.resolve();
    if (highlightLoadPromise) return highlightLoadPromise;

    ['github.min.css', 'github-dark.min.css'].forEach((fileName, index) => {
        const stylesheet = document.createElement('link');
        stylesheet.rel = 'stylesheet';
        stylesheet.href = `vendor/highlight/${fileName}`;
        stylesheet.id = index === 0 ? 'highlight-light' : 'highlight-dark';
        document.head.appendChild(stylesheet);
    });
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

function renderRichFromMarkdown() {
    elements.richEditor.innerHTML = markdownToHtml(state.markdown);
    hydrateLocalImages(elements.richEditor);
    highlightCode(elements.richEditor);
}

function findSourceOnlyMarkdown(markdown) {
    const lines = String(markdown || '').split('\n');
    const found = { comments: 0, references: 0, footnotes: 0, frontMatter: 0 };
    let fence = '';
    let commentOpen = false;
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
            return;
        }
        if (/^\s{0,3}\[\^[^\]]+\]:/.test(line)) found.footnotes += 1;
        else if (/^\s{0,3}\[[^\]]+\]:/.test(line)) {
            const hasInlineDestination = /^\s{0,3}\[[^\]]+\]:\s*\S/.test(line);
            const hasContinuation = /^\s+\S/.test(lines[index + 1] || '');
            if (hasInlineDestination || hasContinuation) found.references += 1;
        }
        if (commentOpen || line.includes('<!--')) found.comments += (line.match(/<!--/g) || []).length;
        commentOpen = /<!--/.test(line) && !/-->/.test(line.slice(line.indexOf('<!--')));
    });
    return found;
}

function sourceOnlyCount(found) {
    return found.comments + found.references + found.footnotes + found.frontMatter;
}

function sourceOnlyDescription(found) {
    const parts = [];
    [['comments', 'comment', 'comments'], ['references', 'link definition', 'link definitions'], ['footnotes', 'footnote definition', 'footnote definitions']]
        .forEach(([key, singular, plural]) => {
            if (found[key]) parts.push(`${found[key]} ${found[key] === 1 ? singular : plural}`);
        });
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
    detail.textContent = `Editing here would remove ${sourceOnlyDescription(found)}. The Markdown pane keeps everything.`;
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
    if (!sourceOnlyCount(findSourceOnlyMarkdown(state.markdown)) || state.richEditAllowed) return false;
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
    return !state.preferences.autoSave && Boolean(state.markdown) &&
        (!state.currentFileName || state.recoveredDocument || state.markdown !== state.lastSavedMarkdown);
}

function renderStatusHint() {
    window.desktopBridge?.setUnsavedState?.({ needsPrompt: hasUnpersistedDocument() });
    if (state.copied) return;
    elements.reconnectFileButton.hidden = !(state.recoveredDocument && state.recoveredSourcePath &&
        state.recoveryKind === 'markdown' && typeof state.recoveryBaseline === 'string' && window.desktopBridge?.openFile);
    if (state.recoveredDocument) {
        elements.hintText.textContent = state.recoveredSourcePath
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
}

function setDocumentFromText(text) {
    state.richEditAllowed = false;
    state.sourceOnlySnapshot = null;
    hideSourceGuard();
    elements.richEditor.textContent = String(text || '');
    syncFromRich({ flash: true });
    closeReader();
}

function normalizePreferences(candidate = {}) {
    const appearance = ['light', 'dark', 'auto'].includes(candidate.appearance) ? candidate.appearance : DEFAULT_PREFERENCES.appearance;
    const flavor = String(candidate.flavor || '').toLowerCase() === 'commonmark' ? 'CommonMark' : 'GFM';
    const readerWidth = ['60', '72', 'Full'].includes(String(candidate.readerWidth)) ? String(candidate.readerWidth) : DEFAULT_PREFERENCES.readerWidth;
    const textSize = ['14', '16', '18'].includes(String(candidate.textSize)) ? String(candidate.textSize) : DEFAULT_PREFERENCES.textSize;
    return {
        appearance,
        flavor,
        readerWidth,
        smartQuotes: typeof candidate.smartQuotes === 'boolean' ? candidate.smartQuotes : DEFAULT_PREFERENCES.smartQuotes,
        textSize,
        autoSave: typeof candidate.autoSave === 'boolean' ? candidate.autoSave : DEFAULT_PREFERENCES.autoSave
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
    if (animate && document.documentElement.dataset.mode !== mode) animateThemeChange();
    document.documentElement.dataset.mode = mode;
    elements.app.dataset.mode = mode;
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
    if (key === 'appearance') applyTheme({ animate: true });
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
            option.classList.toggle('is-active', state.preferences[definition.key] === value);
            option.setAttribute('aria-pressed', String(state.preferences[definition.key] === value));
            option.addEventListener('click', () => setPreference(definition.key, value));
            options.appendChild(option);
        });

        row.append(name, options);
        elements.settingsRows.appendChild(row);
    });
}

function openSettings() {
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
            return node.parentElement?.closest('code, pre') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
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
}

function openReader() {
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
}

function closeReader() {
    if (state.view !== 'reader') return;
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
    const nativeUndo = document.execCommand('insertText', false, nextMarkdown);
    if (nativeUndo && state.markdown !== nextMarkdown) syncFromMarkdown();
    state.programmaticReplace = false;
    state.replacementNativeUndo = nativeUndo;
    if (!nativeUndo) setDocumentFromMarkdown(nextMarkdown);
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
    if ((dirtyFile || (confirmNew && state.markdown)) &&
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
        if (window.desktopBridge?.saveFile) queuedSave = { saveAs, revision: state.documentRevision };
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

function hydrateLocalImages(root) {
    const baseFilePath = state.currentFilePath;
    if (!baseFilePath || !window.desktopBridge?.readRelativeImage) return;
    const revision = state.documentRevision;
    root.querySelectorAll('img[src]').forEach((image) => {
        const src = image.getAttribute('src');
        if (!isRelativeResource(src)) return;
        image.setAttribute('data-asterism-relative-src', src);
        image.removeAttribute('src');
        const key = `${baseFilePath}\n${src}`;
        if (!localImageCache.has(key)) {
            if (localImageCache.size > 40) localImageCache.clear();
            const request = window.desktopBridge.readRelativeImage({ baseFilePath, src });
            localImageCache.set(key, request);
        }
        localImageCache.get(key).then((dataUrl) => {
            if (state.documentRevision === revision && image.isConnected) image.src = dataUrl;
        }).catch(() => {
            localImageCache.delete(key);
            if (image.isConnected) image.title = 'Local image could not be opened';
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
    if (!state.markdown) return true;
    if (state.currentFilePath && state.markdown === state.lastSavedMarkdown) return true;
    const message = state.currentFilePath && state.markdown !== state.lastSavedMarkdown
        ? `Discard unsaved changes to ${state.currentFileName} and open another file?`
        : 'Replace the current document with another file?';
    return window.confirm(message);
}

function loadDocumentData({ name = '', filePath = '', content = '', kind = '' } = {}) {
    if (!confirmReplaceDocument()) return;
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
        announce('Press ⌘V to paste here');
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

function runFormattingCommand(command) {
    if (blockRichMutation()) return;
    elements.richEditor.focus();
    if (command === 'code') {
        const selection = window.getSelection();
        const selected = selection?.toString() || 'code';
        document.execCommand('insertHTML', false, `<code>${escapeHtml(selected)}</code>`);
    } else if (command === 'quote') {
        document.execCommand('formatBlock', false, 'blockquote');
    } else {
        document.execCommand(command, false, null);
    }
    syncFromRich();
    renderFormatState();
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

function handleGlobalKeydown(event) {
    const modifier = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    const inFindInput = [elements.findInput, elements.replaceInput].includes(document.activeElement);
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
    } else if (modifier && key === 'o') {
        event.preventDefault();
        openDocument();
    } else if (modifier && key === 's') {
        event.preventDefault();
        saveMarkdown({ saveAs: event.shiftKey });
    } else if (modifier && key === 'n') {
        event.preventDefault();
        clearNow({ confirmNew: true });
    } else if (event.key === 'Escape') {
        if (state.findOpen) closeFind();
        else if (state.settingsOpen) closeSettings();
        else if (state.view === 'reader') closeReader();
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
    });

    window.desktopBridge?.onOpenFile?.((fileData) => loadDocumentData(fileData));
}

function bindEvents() {
    elements.richEditor.addEventListener('beforeinput', (event) => blockRichMutation(event));
    elements.richEditor.addEventListener('input', () => {
        if (blockRichMutation()) {
            renderRichFromMarkdown();
            return;
        }
        syncFromRich();
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
    if (savedDocument) openReader();
}

initialize();
