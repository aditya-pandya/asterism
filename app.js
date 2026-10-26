const STORAGE_KEYS = {
    document: 'inkdown.doc',
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
    textSize: '15',
    autoSave: true
});

const SETTING_DEFINITIONS = [
    { key: 'appearance', name: 'Appearance', values: ['light', 'dark', 'auto'], labels: ['Light', 'Dark', 'Auto'] },
    { key: 'flavor', name: 'Markdown', values: ['GFM', 'CommonMark'] },
    { key: 'readerWidth', name: 'Reader width', values: ['60', '72', 'Full'] },
    { key: 'smartQuotes', name: 'Smart quotes', values: [true, false], labels: ['On', 'Off'] },
    { key: 'textSize', name: 'Text size', values: ['14', '15', '16'] },
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
    undoMarkdown: null,
    undoFileName: '',
    dragDepth: 0,
    lastFocusedElement: null
};

const elements = {
    app: document.getElementById('app'),
    wordmarkStrip: document.getElementById('wordmarkStrip'),
    editView: document.getElementById('editView'),
    richPane: document.getElementById('richPane'),
    richEditor: document.getElementById('richEditor'),
    markdownPane: document.getElementById('markdownPane'),
    markdownEditor: document.getElementById('markdownEditor'),
    markdownHighlight: document.getElementById('markdownHighlight'),
    readerView: document.getElementById('readerView'),
    readerContent: document.getElementById('readerContent'),
    documentStats: document.getElementById('documentStats'),
    hintText: document.getElementById('hintText'),
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
    statusMessage: document.getElementById('statusMessage')
};

let turndownService = null;
let highlightLoadPromise = null;
let clearArmTimer = null;
let undoTimer = null;
let copiedTimer = null;
let savedDataTimer = null;
let toastTimer = null;
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
    if (url.startsWith('#') || url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) return url;
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
    const normalized = sanitizeHtml(elements.richEditor.innerHTML, { preserveStyles: true });
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
    highlightCode(elements.richEditor);
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
    setActionEnabled(elements.downloadButton, Boolean(state.markdown));
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
    elements.docName.textContent = state.currentFileName;
    elements.docName.hidden = !state.currentFileName;
    document.title = state.currentFileName ? `${state.currentFileName} · Asterism` : 'Asterism';
}

function renderStatusHint() {
    if (state.copied) return;
    elements.hintText.textContent = state.preferences.autoSave
        ? 'Converts as you type · saved on this device'
        : 'Converts as you type · auto-save off';
}

function persistDocument() {
    if (!state.preferences.autoSave) return;
    try {
        localStorage.setItem(STORAGE_KEYS.document, state.markdown);
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
    cancelUndoOnEdit();
    if (!elements.richEditor.innerText.trim() && !elements.richEditor.querySelector('img, hr')) {
        elements.richEditor.innerHTML = '';
    }
    state.markdown = richHtmlToMarkdown();
    elements.markdownEditor.textContent = state.markdown;
    renderMarkdownHighlight();
    updateStats();
    persistDocument();
    pulseSyncMark();
    if (flash) {
        elements.markdownHighlight.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'cubic-bezier(.4,0,.2,1)' });
    }
}

function syncFromMarkdown() {
    cancelUndoOnEdit();
    state.markdown = getMarkdownEditorText();
    if (!state.markdown) elements.markdownEditor.textContent = '';
    renderMarkdownHighlight();
    renderRichFromMarkdown();
    pulseSyncMark();
    updateStats();
    persistDocument();
}

function setDocumentFromMarkdown(markdown, { persist = true } = {}) {
    state.markdown = String(markdown || '').replace(/\r\n?/g, '\n');
    elements.markdownEditor.textContent = state.markdown;
    renderMarkdownHighlight();
    renderRichFromMarkdown();
    updateStats();
    if (persist) persistDocument();
    closeReader();
}

function bodyHtmlFromDocument(html) {
    const parsed = new DOMParser().parseFromString(String(html || ''), 'text/html');
    return parsed.body ? parsed.body.innerHTML : String(html || '');
}

function setDocumentFromHtml(html) {
    elements.richEditor.innerHTML = sanitizeHtml(bodyHtmlFromDocument(html), { preserveStyles: true });
    syncFromRich({ flash: true });
    closeReader();
}

function setDocumentFromText(text) {
    elements.richEditor.textContent = String(text || '');
    syncFromRich({ flash: true });
    closeReader();
}

function normalizePreferences(candidate = {}) {
    const appearance = ['light', 'dark', 'auto'].includes(candidate.appearance) ? candidate.appearance : DEFAULT_PREFERENCES.appearance;
    const flavor = String(candidate.flavor || '').toLowerCase() === 'commonmark' ? 'CommonMark' : 'GFM';
    const readerWidth = ['60', '72', 'Full'].includes(String(candidate.readerWidth)) ? String(candidate.readerWidth) : DEFAULT_PREFERENCES.readerWidth;
    const textSize = ['14', '15', '16'].includes(String(candidate.textSize)) ? String(candidate.textSize) : DEFAULT_PREFERENCES.textSize;
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
    const size = Number(old.contentFontSize || 15);
    const textSize = String([14, 15, 16].reduce((best, value) => Math.abs(value - size) < Math.abs(best - size) ? value : best, 15));
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
    elements.richEditor.style.setProperty('--rich-text-size', `${state.preferences.textSize}px`);
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
        if (value) persistDocument();
        renderStatusHint();
    }
    if (state.view === 'reader' && ['readerWidth', 'smartQuotes', 'flavor'].includes(key)) renderReader();
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

function renderReader() {
    if (!state.markdown) {
        elements.readerContent.innerHTML = '<p class="empty-reader">Nothing to read yet.</p>';
    } else {
        elements.readerContent.innerHTML = markdownToHtml(state.markdown);
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
}

function toggleReader() {
    if (state.view === 'reader') closeReader();
    else openReader();
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

function clearNow({ withUndo = true } = {}) {
    const ghosts = snapshotPaneGhosts();
    clearTimeout(clearArmTimer);
    clearTimeout(undoTimer);
    state.clearArmed = false;
    state.undoMarkdown = withUndo ? state.markdown : null;
    state.undoFileName = withUndo ? state.currentFileName : '';
    state.justCleared = withUndo && Boolean(state.markdown);
    state.markdown = '';
    state.currentFileName = '';
    renderDocName();
    elements.richEditor.innerHTML = '';
    elements.markdownEditor.textContent = '';
    renderMarkdownHighlight();
    updateStats();
    closeReader();
    try {
        localStorage.removeItem(STORAGE_KEYS.document);
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
}

function undoClear() {
    clearTimeout(undoTimer);
    const markdown = state.undoMarkdown || '';
    state.justCleared = false;
    state.undoMarkdown = null;
    state.currentFileName = state.undoFileName;
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

async function saveMarkdown() {
    if (!state.markdown) {
        announce('Nothing to save yet');
        return;
    }
    const filename = deriveFileName();
    if (window.desktopBridge?.saveFile) {
        try {
            const result = await window.desktopBridge.saveFile({
                content: state.markdown,
                defaultPath: filename,
                filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]
            });
            if (!result?.canceled) announce(`Saved ${result.filePath?.split(/[\\/]/).pop() || filename}`);
        } catch (error) {
            console.error('Save failed:', error);
        }
        return;
    }
    const blob = new Blob([state.markdown], { type: 'text/markdown' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    announce(`Downloaded ${filename}`);
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function inferDocumentKind(name, content, explicitKind) {
    if (explicitKind) return explicitKind;
    if (/\.html?$/i.test(name || '')) return 'html';
    if (/\.(md|markdown)$/i.test(name || '')) return 'markdown';
    if (/<(html|body|p|div|h1|h2|blockquote|ul|ol)\b/i.test(content || '')) return 'html';
    return 'text';
}

function loadDocumentData({ name = '', content = '', kind = '' } = {}) {
    state.currentFileName = name;
    renderDocName();
    const resolvedKind = inferDocumentKind(name, content, kind);
    if (resolvedKind === 'html') setDocumentFromHtml(content);
    else if (resolvedKind === 'markdown') setDocumentFromMarkdown(content);
    else setDocumentFromText(content);
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
    state.currentFileName = '';
    renderDocName();
    try {
        if (navigator.clipboard?.read) {
            const items = await navigator.clipboard.read();
            for (const item of items) {
                if (item.types.includes('text/html')) {
                    const html = await (await item.getType('text/html')).text();
                    setDocumentFromHtml(html);
                    elements.richEditor.focus();
                    return;
                }
            }
        }
        const text = await navigator.clipboard.readText();
        if (text) setDocumentFromMarkdown(text);
        else announce('Clipboard is empty');
        elements.richEditor.focus();
    } catch {
        elements.richEditor.focus();
        announce('Press ⌘V to paste here');
    }
}

function insertRichClipboard(event) {
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
    if (modifier && event.shiftKey && key === 'c') {
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
        saveMarkdown();
    } else if (modifier && key === 'n') {
        event.preventDefault();
        clearNow();
    } else if (event.key === 'Escape') {
        if (state.settingsOpen) closeSettings();
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
        else if (action === 'new-document') clearNow();
        else if (action === 'open-document') openDocument();
        else if (action === 'save-output') saveMarkdown();
    });

    window.desktopBridge?.onOpenFile?.((fileData) => loadDocumentData(fileData));
}

function bindEvents() {
    elements.richEditor.addEventListener('input', () => syncFromRich());
    elements.richEditor.addEventListener('paste', insertRichClipboard);
    elements.richEditor.addEventListener('focus', () => {
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
    elements.markdownEditor.addEventListener('focus', () => elements.markdownPane.classList.add('is-focused'));
    elements.markdownEditor.addEventListener('blur', () => elements.markdownPane.classList.remove('is-focused'));

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
    elements.fileInput.addEventListener('change', () => loadBrowserFile(elements.fileInput.files?.[0]));
    document.addEventListener('keydown', handleGlobalKeydown);
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
    setDocumentFromMarkdown(loadDocument(), { persist: false });
    bindEvents();
    setupDragAndDrop();
    setupDesktopIntegration();
}

initialize();
