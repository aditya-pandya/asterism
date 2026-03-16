// ===========================
// Application State
// ===========================

const AppState = {
    conversionMode: 'rtToMd', // 'rtToMd' or 'mdToRt'
    settings: {
        realtimeConversion: true,
        debounceDelay: 300,
        markdownFlavor: 'gfm',
        syntaxHighlighting: true,
        themeMode: 'system',
        themePalette: 'black-ledger',
        autoSave: true
    },
    debounceTimer: null,
    activeModalId: null,
    lastFocusedElement: null,
    savedSelection: null,
    commandInputResolve: null,
    themeAssetSignature: null
};

const DEFAULT_THEME_MODE = 'system';
const DEFAULT_THEME_PALETTE = 'black-ledger';
const APP_NAME = 'Inkdown';
const STORAGE_KEYS = {
    settings: 'inkdown_settings',
    content: 'inkdown_content',
    legacySettings: 'rtmd_settings',
    legacyContent: 'rtmd_content'
};
const THEME_PALETTES = new Set([
    'pure-black',
    'black-ledger',
    'copper-press',
    'graphite-modern',
    'ember-manuscript',
    'ultramarine-margin',
    'verdant-notes'
]);

const LEGACY_THEME_PALETTE_MAP = {
    'monochrome-signal': 'verdant-notes'
};

const THEME_MODES = new Set(['light', 'dark', 'system']);
let syncFormatPickerWithSelection = () => {};

const THEME_PALETTE_LABELS = {
    'pure-black': 'Pure Black / White',
    'black-ledger': 'Black Ledger',
    'copper-press': 'Copper Press',
    'graphite-modern': 'Graphite Modern',
    'ember-manuscript': 'Ember Manuscript',
    'ultramarine-margin': 'Ultramarine Margin',
    'verdant-notes': 'Verdant Notes'
};

const THEME_MODE_LABELS = {
    light: 'Light',
    dark: 'Dark',
    system: 'System'
};

const LEGACY_THEME_MAP = {
    light: { themeMode: 'light', themePalette: 'black-ledger' },
    dark: { themeMode: 'dark', themePalette: 'black-ledger' },
    auto: { themeMode: 'system', themePalette: 'black-ledger' },
    black: { themeMode: 'dark', themePalette: 'pure-black' }
};

function normalizeThemePalette(palette) {
    const migratedPalette = LEGACY_THEME_PALETTE_MAP[palette] || palette;
    return THEME_PALETTES.has(migratedPalette) ? migratedPalette : DEFAULT_THEME_PALETTE;
}

function normalizeThemeMode(mode) {
    return THEME_MODES.has(mode) ? mode : DEFAULT_THEME_MODE;
}

function resolveLegacyTheme(theme) {
    if (!theme) return null;
    if (LEGACY_THEME_MAP[theme]) return LEGACY_THEME_MAP[theme];

    const match = String(theme).match(/^(.*)-(light|dark)$/);
    if (!match) return null;

    const [, themePalette, themeMode] = match;
    if (!THEME_PALETTES.has(themePalette) || !THEME_MODES.has(themeMode)) return null;
    return { themePalette, themeMode };
}

function normalizeThemeSettings(settings = {}) {
    const migrated = resolveLegacyTheme(settings.theme);
    return {
        themePalette: normalizeThemePalette(settings.themePalette || migrated?.themePalette),
        themeMode: normalizeThemeMode(settings.themeMode || migrated?.themeMode)
    };
}

function getThemeMeta(settings = AppState.settings) {
    const themePalette = normalizeThemePalette(settings.themePalette);
    const requestedMode = normalizeThemeMode(settings.themeMode);
    const prefersDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : true;
    const mode = requestedMode === 'system' ? (prefersDark ? 'dark' : 'light') : requestedMode;
    const key = `${themePalette}-${mode}`;
    return { key, palette: themePalette, mode, requestedMode };
}

// ===========================
// HTML Normalization Helpers
// ===========================

function normalizeHtmlForMarkdown(html) {
    if (!html) return '';
    const container = document.createElement('div');
    container.innerHTML = html;
    transformStyledElements(container);
    return container.innerHTML;
}

function transformStyledElements(root) {
    const elements = Array.from(root.querySelectorAll('*'));
    elements.forEach(element => {
        const styleAttr = element.getAttribute('style');
        if (!styleAttr) return;

        const style = styleAttr.toLowerCase();
        const tagName = element.tagName.toLowerCase();

        const isBold = /font-weight\s*:\s*(bold|[5-9]00)/.test(style) && !['strong', 'b'].includes(tagName);
        const isItalic = /font-style\s*:\s*italic/.test(style) && !['em', 'i'].includes(tagName);
        const hasUnderline = /text-decoration[^;]*underline/.test(style) && tagName !== 'u';
        const hasStrike = /text-decoration[^;]*(line-through|strikethrough)/.test(style) && !['del', 's', 'strike'].includes(tagName);

        if (isBold) applyFormattingWrapper(element, 'strong');
        if (isItalic) applyFormattingWrapper(element, 'em');
        if (hasStrike) applyFormattingWrapper(element, 'del');
        if (hasUnderline) applyFormattingWrapper(element, 'u');

        if (isBold) element.style.fontWeight = '';
        if (isItalic) element.style.fontStyle = '';
        if (hasStrike || hasUnderline) {
            element.style.textDecoration = '';
            if (element.style.textDecorationLine !== undefined) {
                element.style.textDecorationLine = '';
            }
        }

        if (element.getAttribute('style') && element.getAttribute('style').trim() === '') {
            element.removeAttribute('style');
        } else if (element.style && element.style.length === 0) {
            element.removeAttribute('style');
        }
    });
}

function applyFormattingWrapper(element, tagName) {
    const doc = element.ownerDocument || document;
    const currentTag = element.tagName.toLowerCase();

    if (currentTag === tagName) return;
    if (tagName === 'strong' && currentTag === 'b') return;
    if (tagName === 'em' && currentTag === 'i') return;
    if (tagName === 'del' && (currentTag === 's' || currentTag === 'strike')) return;
    if (tagName === 'u' && currentTag === 'u') return;

    if (element.childNodes.length === 1) {
        const child = element.firstChild;
        if (child.nodeType === Node.ELEMENT_NODE) {
            const childTag = child.tagName.toLowerCase();
            if (childTag === tagName) return;
            if (tagName === 'strong' && childTag === 'b') return;
            if (tagName === 'em' && childTag === 'i') return;
            if (tagName === 'del' && (childTag === 's' || childTag === 'strike')) return;
            if (tagName === 'u' && childTag === 'u') return;
        }
    }

    const wrapper = doc.createElement(tagName);
    while (element.firstChild) {
        wrapper.appendChild(element.firstChild);
    }
    element.appendChild(wrapper);
}

// ===========================
// HTML Sanitization
// ===========================

const SANITIZE_ALLOWED_TAGS = new Set([
    'a','abbr','b','blockquote','br','code','del','div','em','h1','h2','h3','h4','h5','h6',
    'hr','i','img','kbd','li','ol','p','pre','span','strong','sub','sup','table','tbody',
    'td','tfoot','th','thead','tr','u','ul'
]);
const SANITIZE_DROP_TAGS = new Set(['script','style','iframe','object','embed','link','meta']);
const SANITIZE_GLOBAL_ATTRS = new Set(['class','title']);
const SANITIZE_TAG_ATTRS = {
    a: new Set(['href','title','target','rel']),
    img: new Set(['src','alt','title']),
    td: new Set(['colspan','rowspan']),
    th: new Set(['colspan','rowspan'])
};
const SANITIZE_URL_ATTRS = new Set(['href','src']);
const SANITIZE_SAFE_URL_PATTERN = /^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i;
const SANITIZE_ALLOWED_STYLES = new Set(['font-weight','font-style','text-decoration']);

function sanitizeStyle(styleText) {
    if (!styleText) return '';
    const safeParts = [];
    styleText.split(';').forEach(part => {
        const [rawProp, rawValue] = part.split(':');
        if (!rawProp || !rawValue) return;
        const prop = rawProp.trim().toLowerCase();
        const value = rawValue.trim().toLowerCase();
        if (!SANITIZE_ALLOWED_STYLES.has(prop)) return;

        if (prop === 'font-weight') {
            if (!/^(normal|bold|bolder|[1-9]00)$/.test(value)) return;
        }
        if (prop === 'font-style') {
            if (!/^(normal|italic)$/.test(value)) return;
        }
        if (prop === 'text-decoration') {
            if (!/^(none|underline|line-through)$/.test(value)) return;
        }

        safeParts.push(`${prop}: ${value}`);
    });
    return safeParts.join('; ');
}

function isSafeUrl(value) {
    if (!value) return false;
    return SANITIZE_SAFE_URL_PATTERN.test(value.trim());
}

function isAllowedAttribute(tagName, attrName) {
    if (SANITIZE_GLOBAL_ATTRS.has(attrName)) return true;
    const tagAttrs = SANITIZE_TAG_ATTRS[tagName];
    if (!tagAttrs) return false;
    return tagAttrs.has(attrName);
}

function sanitizeHtml(html, options = {}) {
    if (!html) return '';
    const allowStyles = options.allowStyles === true;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT, null);
    const nodes = [];
    while (walker.nextNode()) {
        nodes.push(walker.currentNode);
    }

    nodes.forEach(node => {
        const tagName = node.tagName.toLowerCase();
        if (!SANITIZE_ALLOWED_TAGS.has(tagName)) {
            if (SANITIZE_DROP_TAGS.has(tagName)) {
                node.remove();
                return;
            }
            const fragment = doc.createDocumentFragment();
            while (node.firstChild) {
                fragment.appendChild(node.firstChild);
            }
            node.replaceWith(fragment);
            return;
        }

        Array.from(node.attributes).forEach(attr => {
            const name = attr.name.toLowerCase();
            const value = attr.value;
            if (name.startsWith('on')) {
                node.removeAttribute(attr.name);
                return;
            }
            if (name === 'style') {
                if (allowStyles) {
                    const safeStyle = sanitizeStyle(value);
                    if (safeStyle) {
                        node.setAttribute('style', safeStyle);
                    } else {
                        node.removeAttribute('style');
                    }
                } else {
                    node.removeAttribute('style');
                }
                return;
            }
            if (!isAllowedAttribute(tagName, name)) {
                node.removeAttribute(attr.name);
                return;
            }
            if (SANITIZE_URL_ATTRS.has(name) && !isSafeUrl(value)) {
                node.removeAttribute(attr.name);
                return;
            }
            if (tagName === 'a' && name === 'target' && value === '_blank') {
                const relValue = node.getAttribute('rel') || '';
                if (!/\bnoopener\b/i.test(relValue)) {
                    node.setAttribute('rel', `${relValue} noopener noreferrer`.trim());
                }
            }
        });
    });

    return doc.body.innerHTML;
}

// ===========================
// Initialization
// ===========================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    if (window.desktopBridge?.isElectron) {
        document.documentElement.setAttribute('data-platform', 'electron');
    }

    handleStartupActions();

    // Load saved settings and content
    loadSettings();
    loadSavedContent();

    // Initialize converters
    initializeConverters();

    // Setup event listeners
    setupEventListeners();
    setupDesktopIntegration();
    setupGlobalShortcuts();

    // Apply initial theme
    applyTheme();

    // Set initial mode
    setConversionMode(AppState.conversionMode);

    // Setup theme toggle button in header
    setupThemeToggle();

}

function getRichTextEditor() {
    return document.getElementById('richTextEditor');
}

function isRichTextEditorEmpty(editor = getRichTextEditor()) {
    return !editor || editor.textContent.trim() === '';
}

function clearEmptyRichTextMarkup(editor = getRichTextEditor()) {
    if (!editor || !isRichTextEditorEmpty(editor)) return;

    const hasNonTextContent = editor.querySelector('img, video, audio, iframe, canvas, svg, hr, table');
    if (!hasNonTextContent) {
        editor.innerHTML = '';
    }
}

function getRichTextEditorHtml(editor = getRichTextEditor()) {
    clearEmptyRichTextMarkup(editor);
    return editor ? editor.innerHTML : '';
}

function getRichTextEditorText(editor = getRichTextEditor()) {
    clearEmptyRichTextMarkup(editor);
    return editor ? editor.innerText : '';
}

function normalizeFormatBlockValue(value) {
    const normalized = String(value || '')
        .replace(/[<>]/g, '')
        .trim()
        .toLowerCase();

    if (!normalized || ['default', 'div', 'normal', 'p'].includes(normalized)) {
        return 'p';
    }

    const headingMatch = normalized.match(/heading\s*([1-6])/);
    if (headingMatch) {
        return `h${headingMatch[1]}`;
    }

    return normalized;
}

function handleStartupActions() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('clearStorage') || params.has('reset')) {
        clearStoredData();

        params.delete('clearStorage');
        params.delete('reset');
        const query = params.toString();
        const newUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
        history.replaceState(null, '', newUrl);
        showToast('Saved data cleared', 'success');
    }
}

// ===========================
// Converter Initialization
// ===========================

let turndownService;
let markedInstance;

function initializeConverters() {
    // Initialize Turndown (HTML to Markdown)
    if (typeof TurndownService !== 'undefined') {
        turndownService = new TurndownService({
            headingStyle: 'atx',
            hr: '---',
            bulletListMarker: '-',
            codeBlockStyle: 'fenced',
            emDelimiter: '*',
            strongDelimiter: '**'
        });

        // Add GFM plugin if available (includes table support)
        if (typeof turndownPluginGfm !== 'undefined') {
            const gfm = turndownPluginGfm.gfm;
            turndownService.use(gfm);
        }

        const hasStyle = (node, pattern) => {
            if (!node || typeof node.getAttribute !== 'function') return false;
            const style = node.getAttribute('style');
            if (!style) return false;
            return pattern.test(style);
        };

        const BLOCK_TAGS = new Set([
            'address','article','aside','blockquote','canvas','dd','div','dl','dt','fieldset','figcaption','figure','footer','form','h1','h2','h3','h4','h5','h6','header','hr','li','main','nav','noscript','ol','p','pre','section','table','tfoot','ul','video'
        ]);

        const isBlockElement = (node) => {
            if (!node || node.nodeType !== 1) return false;
            return BLOCK_TAGS.has(node.tagName.toLowerCase());
        };

        const hasBlockDescendants = (node) => {
            if (!node || node.nodeType !== 1) return false;
            return Array.from(node.children).some(child => isBlockElement(child));
        };

        // Ensure bold/strong is handled correctly
        turndownService.addRule('bold', {
            filter: ['strong', 'b'],
            replacement: function(content) {
                if (!content.trim()) return '';
                return '**' + content + '**';
            }
        });

        turndownService.addRule('styledBold', {
            filter: function(node) {
                if (node.nodeType !== 1) return false;
                if (!hasStyle(node, /font-weight\s*:\s*(bold|[6-9]00)/i)) return false;
                if (isBlockElement(node) && hasBlockDescendants(node)) return false;
                return true;
            },
            replacement: function(content) {
                if (!content.trim()) return '';
                return '**' + content + '**';
            }
        });

        // Ensure italic/emphasis is handled correctly
        turndownService.addRule('italic', {
            filter: ['em', 'i'],
            replacement: function(content) {
                if (!content.trim()) return '';
                return '*' + content + '*';
            }
        });

        turndownService.addRule('styledItalic', {
            filter: function(node) {
                if (node.nodeType !== 1) return false;
                if (!hasStyle(node, /font-style\s*:\s*italic/i)) return false;
                if (isBlockElement(node) && hasBlockDescendants(node)) return false;
                return true;
            },
            replacement: function(content) {
                if (!content.trim()) return '';
                return '*' + content + '*';
            }
        });

        // Custom rules for better conversion
        turndownService.addRule('strikethrough', {
            filter: ['del', 's', 'strike'],
            replacement: (content) => {
                if (!content.trim()) return '';
                return '~~' + content + '~~';
            }
        });

        turndownService.addRule('styledStrikethrough', {
            filter: function(node) {
                if (node.nodeType !== 1) return false;
                if (!hasStyle(node, /text-decoration\s*:\s*(line-through|strikethrough)/i)) return false;
                if (isBlockElement(node) && hasBlockDescendants(node)) return false;
                return true;
            },
            replacement: function(content) {
                if (!content.trim()) return '';
                return '~~' + content + '~~';
            }
        });

        turndownService.addRule('underline', {
            filter: 'u',
            replacement: (content) => {
                if (!content.trim()) return '';
                return '<u>' + content + '</u>';
            }
        });

        turndownService.addRule('styledUnderline', {
            filter: function(node) {
                if (node.nodeType !== 1) return false;
                if (!hasStyle(node, /text-decoration\s*:\s*underline/i)) return false;
                if (isBlockElement(node) && hasBlockDescendants(node)) return false;
                return true;
            },
            replacement: function(content) {
                if (!content.trim()) return '';
                return '<u>' + content + '</u>';
            }
        });
    }

    // Add custom table handling after initialization
    if (turndownService) {
        // Store reference to turndown service for use in table rule
        const td = turndownService;
        
        // Override table handling to preserve formatting
        turndownService.addRule('customTable', {
            filter: 'table',
            replacement: function(content, node) {
                const rows = Array.from(node.querySelectorAll('tr'));
                if (rows.length === 0) return '';
                
                let markdown = '\n';
                
                rows.forEach((row, rowIndex) => {
                    const cells = Array.from(row.querySelectorAll('th, td'));
                    markdown += '| ';
                    
                    cells.forEach(cell => {
                        // Use turndown to convert cell content, preserving all formatting
                        const cellHtml = cell.innerHTML;
                        const cellMarkdown = td.turndown(cellHtml).trim().replace(/\n/g, ' ');
                        markdown += cellMarkdown + ' | ';
                    });
                    
                    markdown += '\n';
                    
                    // Add separator after first row (header)
                    if (rowIndex === 0) {
                        markdown += '| ';
                        cells.forEach(() => {
                            markdown += '--- | ';
                        });
                        markdown += '\n';
                    }
                });
                
                return markdown + '\n';
            }
        });
    }
    
    // Configure Marked (Markdown to HTML)
    if (typeof marked !== 'undefined') {
        marked.setOptions({
            gfm: true,
            breaks: true,
            headerIds: true,
            mangle: false,
            tables: true
        });
    }
}

// ===========================
// Event Listeners Setup
// ===========================

function setupEventListeners() {
    // Conversion mode toggle
    document.getElementById('rtToMdBtn').addEventListener('click', () => setConversionMode('rtToMd'));
    document.getElementById('mdToRtBtn').addEventListener('click', () => setConversionMode('mdToRt'));
    
    // Rich text editor
    const richTextEditor = document.getElementById('richTextEditor');
    richTextEditor.addEventListener('input', handleRichTextInput);
    richTextEditor.addEventListener('paste', handlePaste);
    richTextEditor.addEventListener('keydown', handleKeyboardShortcuts);
    richTextEditor.addEventListener('keyup', saveEditorSelection);
    richTextEditor.addEventListener('mouseup', saveEditorSelection);
    
    // Markdown input
    const markdownInput = document.getElementById('markdownInput');
    markdownInput.addEventListener('input', handleMarkdownInput);
    markdownInput.addEventListener('paste', handlePaste);
    
    // Toolbar buttons
    setupToolbarListeners();
    
    // Action buttons
    document.getElementById('clearInputBtn').addEventListener('click', clearInput);
    document.getElementById('pasteBtn').addEventListener('click', pasteFromClipboard);
    document.getElementById('copyBtn').addEventListener('click', copyToClipboard);
    document.getElementById('downloadBtn').addEventListener('click', downloadOutput);
    
    // Modal controls
    document.getElementById('settingsBtn').addEventListener('click', () => openModal('settingsModal', { settingsTab: 'settings' }));
    
    // Close buttons for modals
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            closeModal(e.target.closest('.modal').id);
        });
    });
    
    // Click outside modal to close
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });

    document.querySelectorAll('[data-settings-tab-trigger]').forEach(tabButton => {
        tabButton.addEventListener('click', () => {
            setSettingsTab(tabButton.dataset.settingsTabTrigger);
        });
    });

    const commandInputForm = document.getElementById('commandInputForm');
    const commandInputCancel = document.getElementById('commandInputCancel');
    if (commandInputForm) {
        commandInputForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const input = document.getElementById('commandInputField');
            resolveCommandInput(input?.value?.trim() || '');
        });
    }
    if (commandInputCancel) {
        commandInputCancel.addEventListener('click', () => {
            resolveCommandInput(null);
        });
    }
    
    // Settings controls
    setupSettingsListeners();
}

function setupToolbarListeners() {
    const toolbar = document.getElementById('richTextToolbar');
    const richTextEditor = getRichTextEditor();

    // Button commands
    toolbar.querySelectorAll('.toolbar-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            addRipple(btn, e);
            const command = btn.dataset.command;
            executeCommand(command);
        });
    });

    const formatPicker = document.getElementById('formatPicker');
    const formatPickerBtn = document.getElementById('formatPickerBtn');
    const formatPickerLabel = document.getElementById('formatPickerLabel');
    const formatPickerDropdown = document.getElementById('formatPickerDropdown');

    if (!formatPicker || !formatPickerBtn || !formatPickerLabel || !formatPickerDropdown || !richTextEditor) {
        syncFormatPickerWithSelection = () => {};
        return;
    }

    const getFormatOptions = () => [...formatPickerDropdown.querySelectorAll('[role="option"]')];
    const getFormatOptionByValue = (value) =>
        formatPickerDropdown.querySelector(`[data-format-value="${value}"]`);

    function updateFormatSelection(selectedOption) {
        getFormatOptions().forEach((option) => {
            const isSelected = option === selectedOption;
            option.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        });
    }

    function focusFormatOption(option) {
        (option || formatPickerDropdown).focus();
    }

    function getSelectedFormatOption() {
        const block = normalizeFormatBlockValue(document.queryCommandValue('formatBlock'));
        return getFormatOptionByValue(block) || getFormatOptionByValue('p');
    }

    function openFormatPicker() {
        formatPickerBtn.setAttribute('aria-expanded', 'true');
        formatPickerDropdown.classList.add('open');
        focusFormatOption(getSelectedFormatOption());
    }

    function closeFormatPicker() {
        formatPickerBtn.setAttribute('aria-expanded', 'false');
        formatPickerDropdown.classList.remove('open');
    }

    function syncFormatLabel() {
        const match = getSelectedFormatOption();
        formatPickerLabel.textContent = match ? match.textContent : 'Normal';
        updateFormatSelection(match || getFormatOptionByValue('p'));
    }

    function applyFormatSelection(option) {
        if (!option) return;

        const value = option.dataset.formatValue || 'p';
        restoreEditorSelection();
        document.execCommand('formatBlock', false, `<${value}>`);
        formatPickerLabel.textContent = option.textContent;
        updateFormatSelection(option);
        closeFormatPicker();
        richTextEditor.focus();
        saveEditorSelection();
        handleRichTextInput();
        syncFormatLabel();
    }

    formatPickerBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        formatPickerBtn.getAttribute('aria-expanded') === 'true'
            ? closeFormatPicker()
            : openFormatPicker();
    });

    formatPickerBtn.addEventListener('keydown', (event) => {
        if (!['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Escape'].includes(event.key)) return;

        event.preventDefault();
        event.stopPropagation();

        if (event.key === 'Escape') {
            closeFormatPicker();
            return;
        }

        if (formatPickerBtn.getAttribute('aria-expanded') !== 'true') {
            openFormatPicker();
        }
    });

    formatPickerDropdown.addEventListener('click', (event) => {
        const option = event.target.closest('[role="option"]');
        if (!option) return;
        applyFormatSelection(option);
    });

    formatPickerDropdown.addEventListener('keydown', (event) => {
        const options = getFormatOptions();
        const focusedOption = document.activeElement?.closest?.('[role="option"]');
        const currentIndex = options.indexOf(focusedOption);

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            focusFormatOption(options[Math.min(currentIndex + 1, options.length - 1)] || options[0]);
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            focusFormatOption(options[Math.max(currentIndex - 1, 0)] || options[0]);
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            closeFormatPicker();
            formatPickerBtn.focus();
        }
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            focusedOption?.click();
        }
    });

    document.addEventListener('click', (event) => {
        if (!formatPicker.contains(event.target)) closeFormatPicker();
    });

    richTextEditor.addEventListener('keyup', syncFormatLabel);
    richTextEditor.addEventListener('mouseup', syncFormatLabel);
    richTextEditor.addEventListener('focus', syncFormatLabel);
    document.addEventListener('selectionchange', () => {
        const activeElement = document.activeElement;
        if (activeElement === richTextEditor || richTextEditor.contains(activeElement)) {
            syncFormatLabel();
        }
    });

    syncFormatPickerWithSelection = syncFormatLabel;
    syncFormatLabel();
}

function setupSettingsListeners() {
    // Real-time conversion toggle
    document.getElementById('realtimeConversion').addEventListener('change', (e) => {
        AppState.settings.realtimeConversion = e.target.checked;
        saveSettings();
    });
    
    // Debounce delay
    const debounceSlider = document.getElementById('debounceDelay');
    const debounceValue = document.getElementById('debounceValue');
    debounceSlider.addEventListener('input', (e) => {
        const value = e.target.value;
        debounceValue.textContent = `${value}ms`;
        AppState.settings.debounceDelay = parseInt(value);
        saveSettings();
    });
    
    // Markdown flavor
    document.getElementById('markdownFlavor').addEventListener('change', (e) => {
        AppState.settings.markdownFlavor = e.target.value;
        saveSettings();
        // Re-convert with new flavor
        if (AppState.conversionMode === 'mdToRt') {
            convertMarkdownToRichText();
        }
    });
    
    // Syntax highlighting
    document.getElementById('syntaxHighlighting').addEventListener('change', (e) => {
        AppState.settings.syntaxHighlighting = e.target.checked;
        saveSettings();
        if (AppState.conversionMode === 'mdToRt') {
            convertMarkdownToRichText();
        }
    });
    
    // Theme mode
    const themeModeSelect = document.getElementById('themeModeSelect');
    themeModeSelect.addEventListener('change', (e) => {
        AppState.settings.themeMode = normalizeThemeMode(e.target.value);
        saveSettings();
        applyTheme();
    });

    document.querySelectorAll('[data-theme-mode-value]').forEach((button) => {
        button.addEventListener('click', () => {
            const nextMode = button.dataset.themeModeValue;
            if (!nextMode) return;
            AppState.settings.themeMode = normalizeThemeMode(nextMode);
            themeModeSelect.value = AppState.settings.themeMode;
            saveSettings();
            applyTheme();
            showToast(`${THEME_MODE_LABELS[AppState.settings.themeMode]} mode selected`, 'theme');
        });
    });

    // Theme palette
    const themePaletteSelect = document.getElementById('themePaletteSelect');
    themePaletteSelect.addEventListener('change', (e) => {
        AppState.settings.themePalette = normalizeThemePalette(e.target.value);
        saveSettings();
        applyTheme();
    });

    document.querySelectorAll('[data-theme-palette-value]').forEach((button) => {
        button.addEventListener('click', () => {
            const nextPalette = button.dataset.themePaletteValue;
            if (!nextPalette) return;
            AppState.settings.themePalette = normalizeThemePalette(nextPalette);
            themePaletteSelect.value = AppState.settings.themePalette;
            saveSettings();
            applyTheme();
            showToast(`${THEME_PALETTE_LABELS[AppState.settings.themePalette] || 'Palette'} selected`, 'theme');
        });
    });
    
    // Auto-save
    document.getElementById('autoSave').addEventListener('change', (e) => {
        AppState.settings.autoSave = e.target.checked;
        saveSettings();
    });
    
    // Clear storage
    document.getElementById('clearStorageBtn').addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all saved data?')) {
            clearStoredData();
            showToast('All saved data cleared', 'success');
            setTimeout(() => location.reload(), 1000);
        }
    });
}

// ===========================
// Conversion Mode Management
// ===========================

function setConversionMode(mode) {
    AppState.conversionMode = mode;

    // Update toggle buttons
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        const isActive = btn.dataset.direction === mode;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    // Animate segmented control indicator
    const toggle = document.getElementById('conversionToggle');
    if (toggle) toggle.dataset.active = mode;
    
    // Show/hide appropriate editors
    const richTextToolbar = document.getElementById('richTextToolbar');
    const richTextEditor = document.getElementById('richTextEditor');
    const markdownInput = document.getElementById('markdownInput');
    const markdownOutput = document.getElementById('markdownOutput');
    const richTextPreview = document.getElementById('richTextPreview');
    
    if (mode === 'rtToMd') {
        // Rich Text to Markdown
        document.getElementById('inputLabel').textContent = 'Rich Text Input';
        document.getElementById('outputLabel').textContent = 'Markdown Output';
        
        richTextToolbar.classList.remove('hidden');
        richTextEditor.classList.remove('hidden');
        markdownInput.classList.add('hidden');
        markdownOutput.classList.remove('hidden');
        richTextPreview.classList.add('hidden');
        
        // Convert current content
        convertRichTextToMarkdown();
    } else {
        // Markdown to Rich Text
        document.getElementById('inputLabel').textContent = 'Markdown Input';
        document.getElementById('outputLabel').textContent = 'Rich Text Preview';
        
        richTextToolbar.classList.add('hidden');
        richTextEditor.classList.add('hidden');
        markdownInput.classList.remove('hidden');
        markdownOutput.classList.add('hidden');
        richTextPreview.classList.remove('hidden');
        
        // Convert current content
        convertMarkdownToRichText();
    }
    
    updateStats();
}

// ===========================
// Rich Text Editor Commands
// ===========================

async function executeCommand(command) {
    const editor = document.getElementById('richTextEditor');
    restoreEditorSelection();
    
    switch (command) {
        case 'bold':
        case 'italic':
        case 'underline':
        case 'strikeThrough':
            document.execCommand(command, false, null);
            break;
            
        case 'insertUnorderedList':
        case 'insertOrderedList':
            document.execCommand(command, false, null);
            break;
            
        case 'blockquote':
            document.execCommand('formatBlock', false, 'blockquote');
            break;
            
        case 'createLink':
            saveEditorSelection();
            const url = await showCommandInputDialog({
                title: 'Insert link',
                label: 'URL',
                help: 'Paste the full URL you want to attach to the selected text.',
                placeholder: 'https://example.com',
                submitLabel: 'Insert link',
                iconClass: 'ph-link-simple'
            });
            if (url) {
                restoreEditorSelection();
                document.execCommand('createLink', false, url);
            }
            break;
            
        case 'insertImage':
            saveEditorSelection();
            const imgUrl = await showCommandInputDialog({
                title: 'Insert image',
                label: 'Image URL',
                help: 'Paste a direct image URL to embed it into the rich text editor.',
                placeholder: 'https://example.com/image.png',
                submitLabel: 'Insert image',
                iconClass: 'ph-image-square'
            });
            if (imgUrl) {
                restoreEditorSelection();
                document.execCommand('insertImage', false, imgUrl);
            }
            break;
            
        case 'insertCode':
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const code = document.createElement('code');
                code.textContent = range.toString() || 'code';
                range.deleteContents();
                range.insertNode(code);
            }
            break;
            
        case 'insertHR':
            document.execCommand('insertHorizontalRule', false, null);
            break;
    }
    
    editor.focus();
    saveEditorSelection();
    handleRichTextInput();
}

function saveEditorSelection() {
    const editor = document.getElementById('richTextEditor');
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;
    AppState.savedSelection = range.cloneRange();
}

function restoreEditorSelection() {
    const selection = window.getSelection();
    if (!selection || !AppState.savedSelection) return;

    selection.removeAllRanges();
    selection.addRange(AppState.savedSelection);
}

function showCommandInputDialog(options) {
    const modal = document.getElementById('commandInputModal');
    const title = document.getElementById('commandInputTitle');
    const label = document.getElementById('commandInputLabel');
    const input = document.getElementById('commandInputField');
    const help = document.getElementById('commandInputHelp');
    const submit = document.getElementById('commandInputSubmit');
    const icon = document.getElementById('commandInputIcon');

    if (!modal || !title || !label || !input || !help || !submit || !icon) {
        return Promise.resolve(window.prompt(options?.title || 'Enter value:') || null);
    }

    title.textContent = options.title || 'Insert value';
    label.textContent = options.label || 'Value';
    input.value = options.value || '';
    input.placeholder = options.placeholder || '';
    help.textContent = options.help || '';
    submit.textContent = options.submitLabel || 'Insert';
    icon.className = `ph ${options.iconClass || 'ph-link-simple'}`;

    openModal('commandInputModal');

    return new Promise((resolve) => {
        AppState.commandInputResolve = resolve;
        requestAnimationFrame(() => input.focus());
    });
}

function resolveCommandInput(value) {
    if (!AppState.commandInputResolve) {
        closeModal('commandInputModal');
        return;
    }

    const resolve = AppState.commandInputResolve;
    AppState.commandInputResolve = null;
    closeModal('commandInputModal');
    resolve(value);
}

function handleKeyboardShortcuts(e) {
    if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
            case 'b':
                e.preventDefault();
                executeCommand('bold');
                break;
            case 'i':
                e.preventDefault();
                executeCommand('italic');
                break;
            case 'u':
                e.preventDefault();
                executeCommand('underline');
                break;
            case 'k':
                e.preventDefault();
                executeCommand('createLink');
                break;
        }
    }
}

// ===========================
// Input Handlers
// ===========================

function handleRichTextInput() {
    clearEmptyRichTextMarkup();
    syncFormatPickerWithSelection();
    if (AppState.settings.realtimeConversion) {
        debounceConversion(() => convertRichTextToMarkdown());
    }
    updateStats();
    if (AppState.settings.autoSave) {
        saveContent();
    }
}

function handleMarkdownInput() {
    if (AppState.settings.realtimeConversion) {
        debounceConversion(() => convertMarkdownToRichText());
    }
    updateStats();
    if (AppState.settings.autoSave) {
        saveContent();
    }
}

function debounceConversion(callback) {
    clearTimeout(AppState.debounceTimer);
    AppState.debounceTimer = setTimeout(callback, AppState.settings.debounceDelay);
}

function handlePaste(e) {
    // Allow default paste behavior
    setTimeout(() => {
        if (AppState.conversionMode === 'rtToMd') {
            handleRichTextInput();
        } else {
            handleMarkdownInput();
        }
    }, 10);
}

// ===========================
// Conversion Functions
// ===========================

function convertRichTextToMarkdown() {
    const richTextEditor = document.getElementById('richTextEditor');
    const markdownOutput = document.getElementById('markdownOutput');
    const outputPanel = document.querySelector('.output-panel');

    if (!turndownService) {
        markdownOutput.value = 'Error: Turndown library not loaded';
        return;
    }

    if (outputPanel) outputPanel.classList.add('converting');

    try {
        const rawHtml = getRichTextEditorHtml(richTextEditor);
        const normalizedHtml = normalizeHtmlForMarkdown(rawHtml);
        const markdown = turndownService.turndown(normalizedHtml);
        markdownOutput.value = markdown;
        updateStats();
    } catch (error) {
        console.error('Conversion error:', error);
        console.error('Error details:', error.message, error.stack);
        markdownOutput.value = 'Error converting to markdown: ' + error.message;
    }

    // Remove indicator after brief delay
    if (outputPanel) {
        setTimeout(() => outputPanel.classList.remove('converting'), 600);
    }
}

function convertMarkdownToRichText() {
    const markdownInput = document.getElementById('markdownInput');
    const richTextPreview = document.getElementById('richTextPreview');
    const outputPanel = document.querySelector('.output-panel');

    if (typeof marked === 'undefined') {
        richTextPreview.innerHTML = '<p>Error: Marked library not loaded</p>';
        return;
    }

    if (outputPanel) outputPanel.classList.add('converting');

    try {
        const markdown = markdownInput.value;
        const html = marked.parse(markdown);
        richTextPreview.innerHTML = sanitizeHtml(html);

        // Apply syntax highlighting if enabled
        if (AppState.settings.syntaxHighlighting && typeof hljs !== 'undefined') {
            richTextPreview.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        }

        updateStats();
    } catch (error) {
        console.error('Conversion error:', error);
        richTextPreview.innerHTML = '<p>Error converting markdown</p>';
    }

    if (outputPanel) {
        setTimeout(() => outputPanel.classList.remove('converting'), 600);
    }
}

// ===========================
// Action Functions
// ===========================

function clearInput() {
    const hasContent = AppState.conversionMode === 'rtToMd'
        ? !isRichTextEditorEmpty()
        : document.getElementById('markdownInput').value.trim() !== '';
    if (hasContent && !confirm('Clear all input?')) return;

    if (AppState.conversionMode === 'rtToMd') {
        document.getElementById('richTextEditor').innerHTML = '';
        document.getElementById('markdownOutput').value = '';
        syncFormatPickerWithSelection();
    } else {
        document.getElementById('markdownInput').value = '';
        document.getElementById('richTextPreview').innerHTML = '';
    }
    updateStats();
    saveContent();
}

function buildStandaloneHtmlDocument(bodyHtml) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${APP_NAME} Export</title>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

function getOutputPayload() {
    let content;
    let filename;
    let mimeType;

    if (AppState.conversionMode === 'rtToMd') {
        content = document.getElementById('markdownOutput').value;
        filename = 'inkdown-output.md';
        mimeType = 'text/markdown';
    } else {
        content = buildStandaloneHtmlDocument(document.getElementById('richTextPreview').innerHTML);
        filename = 'inkdown-output.html';
        mimeType = 'text/html';
    }

    return { content, filename, mimeType };
}

async function pasteFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        if (AppState.conversionMode === 'rtToMd') {
            const editor = document.getElementById('richTextEditor');
            editor.focus();
            document.execCommand('insertText', false, text);
        } else {
            const input = document.getElementById('markdownInput');
            const start = input.selectionStart;
            const end = input.selectionEnd;
            input.value = input.value.slice(0, start) + text + input.value.slice(end);
            input.selectionStart = input.selectionEnd = start + text.length;
            handleMarkdownInput();
        }
        showToast('Pasted from clipboard', 'success');
    } catch (error) {
        showToast('Failed to paste from clipboard', 'error');
    }
}

async function writePlainTextToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            const successful = document.execCommand('copy');
            document.body.removeChild(textarea);
            return successful;
        } catch (fallbackError) {
            console.error('Plain text copy failed:', fallbackError);
            return false;
        }
    }
}

async function writeHtmlToClipboard(html, plainText) {
    try {
        if (navigator.clipboard && window.ClipboardItem) {
            const clipboardItem = new ClipboardItem({
                'text/html': new Blob([html], { type: 'text/html' }),
                'text/plain': new Blob([plainText], { type: 'text/plain' })
            });
            await navigator.clipboard.write([clipboardItem]);
            return true;
        }
        throw new Error('ClipboardItem API not supported');
    } catch (error) {
        try {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            tempDiv.style.position = 'fixed';
            tempDiv.style.pointerEvents = 'none';
            tempDiv.style.opacity = '0';
            tempDiv.style.zIndex = '-1';
            document.body.appendChild(tempDiv);

            const range = document.createRange();
            range.selectNodeContents(tempDiv);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            const successful = document.execCommand('copy');
            selection.removeAllRanges();
            document.body.removeChild(tempDiv);
            return successful;
        } catch (fallbackError) {
            console.error('HTML copy fallback failed:', fallbackError);
            return false;
        }
    }
}

async function copyToClipboard() {
    let success = false;
    if (AppState.conversionMode === 'rtToMd') {
        const markdownText = document.getElementById('markdownOutput').value;
        success = await writePlainTextToClipboard(markdownText);
    } else {
        const preview = document.getElementById('richTextPreview');
        const htmlContent = preview.innerHTML;
        const plainText = preview.innerText;
        success = await writeHtmlToClipboard(htmlContent, plainText);
    }

    if (success) {
        // Animate copy button to show success
        const btn = document.getElementById('copyBtn');
        if (btn) {
            const iconCopy  = btn.querySelector('.icon-copy');
            const iconCheck = btn.querySelector('.icon-check');
            const label     = btn.querySelector('.copy-label');
            btn.classList.add('copied');
            if (iconCopy)  iconCopy.style.display  = 'none';
            if (iconCheck) iconCheck.style.display = '';
            if (label)     label.textContent = 'Copied!';
            setTimeout(() => {
                btn.classList.remove('copied');
                if (iconCopy)  iconCopy.style.display  = '';
                if (iconCheck) iconCheck.style.display = 'none';
                if (label)     label.textContent = 'Copy';
            }, 2000);
        }
        showToast('Copied to clipboard', 'success');
    } else {
        showToast('Failed to copy to clipboard', 'error');
    }
}

async function downloadOutput() {
    const { content, filename, mimeType } = getOutputPayload();

    if (window.desktopBridge?.saveFile) {
        const result = await window.desktopBridge.saveFile({
            content,
            defaultPath: filename,
            filters: AppState.conversionMode === 'rtToMd'
                ? [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]
                : [{ name: 'HTML', extensions: ['html', 'htm'] }]
        });

        if (!result?.canceled) {
            showToast(`Saved ${result.filePath.split('/').pop()}`, 'success');
        }
        return;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast(`Downloaded ${filename}`, 'success');
}

function setupDesktopIntegration() {
    if (!window.desktopBridge?.onMenuAction) return;

    window.desktopBridge.onMenuAction(async (action) => {
        if (action === 'open-settings') {
            openModal('settingsModal', { settingsTab: 'settings' });
        } else if (action === 'new-document') {
            clearInput();
        } else if (action === 'open-document') {
            await openDocumentFromDesktop();
        } else if (action === 'save-output') {
            await downloadOutput();
        }
    });
}

async function openDocumentFromDesktop() {
    if (!window.desktopBridge?.openFile) return;

    const result = await window.desktopBridge.openFile();
    if (!result || result.canceled) return;

    if (result.kind === 'markdown') {
        document.getElementById('markdownInput').value = result.content;
        setConversionMode('mdToRt');
        handleMarkdownInput();
        showToast(`Opened ${result.name}`, 'success');
        return;
    }

    if (result.kind === 'html') {
        const parser = new DOMParser();
        const doc = parser.parseFromString(result.content, 'text/html');
        const html = doc.body ? doc.body.innerHTML : result.content;
        document.getElementById('richTextEditor').innerHTML = sanitizeHtml(html, { allowStyles: true });
    } else {
        document.getElementById('richTextEditor').textContent = result.content;
    }

    clearEmptyRichTextMarkup();
    syncFormatPickerWithSelection();
    setConversionMode('rtToMd');
    handleRichTextInput();
    showToast(`Opened ${result.name}`, 'success');
}

// ===========================
// Statistics
// ===========================

function updateStats() {
    let inputText, outputText;
    
    if (AppState.conversionMode === 'rtToMd') {
        inputText = getRichTextEditorText();
        outputText = document.getElementById('markdownOutput').value;
    } else {
        inputText = document.getElementById('markdownInput').value;
        outputText = document.getElementById('richTextPreview').innerText;
    }
    
    const inputWords = inputText.trim() ? inputText.trim().split(/\s+/).length : 0;
    const inputChars = inputText.length;
    const outputWords = outputText.trim() ? outputText.trim().split(/\s+/).length : 0;
    const outputChars = outputText.length;
    
    document.getElementById('inputStats').textContent = 
        `${inputWords} words, ${inputChars} characters`;
    document.getElementById('outputStats').textContent = 
        `${outputWords} words, ${outputChars} characters`;
}

// ===========================
// Modal Management
// ===========================

function setSettingsTab(tabName = 'settings') {
    const tabs = document.querySelectorAll('[data-settings-tab-trigger]');
    const panels = document.querySelectorAll('[data-settings-tab-panel]');
    const activeTab = tabName === 'reference' ? 'reference' : 'settings';

    tabs.forEach((tab) => {
        const isActive = tab.dataset.settingsTabTrigger === activeTab;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        tab.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    panels.forEach((panel) => {
        panel.classList.toggle('active', panel.dataset.settingsTabPanel === activeTab);
    });
}

function getFocusableElements(container) {
    return Array.from(
        container.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
    ).filter((element) => element.offsetParent !== null);
}

function openModal(modalId, options = {}) {
    if (modalId === 'settingsModal') {
        setSettingsTab(options.settingsTab);
    }

    const modal = document.getElementById(modalId);
    if (!modal) return;

    AppState.lastFocusedElement = document.activeElement;
    AppState.activeModalId = modalId;
    modal.classList.add('active');

    const preferredFocus = modal.querySelector(
        modalId === 'settingsModal'
            ? `[data-settings-tab-trigger="${options.settingsTab === 'reference' ? 'reference' : 'settings'}"]`
            : '.close-btn'
    );
    const focusableElements = getFocusableElements(modal);
    (preferredFocus || focusableElements[0] || modal).focus();
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.remove('active');
    if (AppState.activeModalId === modalId) {
        AppState.activeModalId = null;
    }

    if (AppState.lastFocusedElement && typeof AppState.lastFocusedElement.focus === 'function') {
        AppState.lastFocusedElement.focus();
        AppState.lastFocusedElement = null;
    }
}

function handleModalKeydown(event) {
    const activeModalId = AppState.activeModalId;
    if (!activeModalId) return;

    const modal = document.getElementById(activeModalId);
    if (!modal) return;

    if (event.key === 'Escape') {
        event.preventDefault();
        if (activeModalId === 'commandInputModal') {
            resolveCommandInput(null);
            return;
        }
        closeModal(activeModalId);
        return;
    }

    if (event.key === 'Tab') {
        const focusableElements = getFocusableElements(modal);
        if (focusableElements.length === 0) return;

        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
        return;
    }

    const activeTab = document.activeElement?.closest?.('[data-settings-tab-trigger]');
    if (!activeTab) return;

    const tabs = Array.from(document.querySelectorAll('[data-settings-tab-trigger]'));
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex === -1) return;

    let nextIndex = null;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;

    if (nextIndex !== null) {
        event.preventDefault();
        const nextTab = tabs[nextIndex];
        setSettingsTab(nextTab.dataset.settingsTabTrigger);
        nextTab.focus();
    }
}

// ===========================
// Theme Management
// ===========================

function applyTheme() {
    const themeMeta = getThemeMeta(AppState.settings);
    const html = document.documentElement;

    html.setAttribute('data-theme', themeMeta.key);
    html.setAttribute('data-theme-palette', themeMeta.palette);
    html.setAttribute('data-theme-mode', themeMeta.mode);
    html.setAttribute('data-theme-source', themeMeta.requestedMode);

    updateHighlightTheme(themeMeta.mode);
    updateThemeToggleState(themeMeta);
    updateThemeModeSelection(themeMeta.requestedMode);
    updateThemePaletteSelection(themeMeta.palette);
    applyThemeAssets(themeMeta);
}

function encodeSvgDataUrl(svg) {
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function svgDataUrlToPngDataUrl(svgDataUrl, size = 512) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;

            const context = canvas.getContext('2d');
            if (!context) {
                reject(new Error('Canvas 2D context unavailable'));
                return;
            }

            context.clearRect(0, 0, size, size);
            context.drawImage(image, 0, 0, size, size);
            resolve(canvas.toDataURL('image/png'));
        };
        image.onerror = () => reject(new Error('Failed to rasterize themed icon'));
        image.src = svgDataUrl;
    });
}

function buildInkdownMarkSvg({ gradientStart, gradientEnd, inkColor }) {
    return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-labelledby="title desc">
  <title id="title">Inkdown mark</title>
  <desc id="desc">Rounded square badge with the Inkdown ladder mark monogram.</desc>
  <defs>
    <linearGradient id="badge" x1="10%" y1="8%" x2="90%" y2="92%">
      <stop offset="0%" stop-color="${gradientStart}"/>
      <stop offset="55%" stop-color="${gradientEnd}"/>
      <stop offset="100%" stop-color="${gradientEnd}"/>
    </linearGradient>
  </defs>
  <rect x="1" y="1" width="62" height="62" rx="19" fill="url(#badge)"/>
  <g transform="translate(-0.9 -0.6)">
    <path d="M22.5 13.5H30.5V53.5H22.5V13.5Z" fill="${inkColor}"/>
    <path d="M35.5 13.5H43.5V23.8C43.5 26.22 44.86 28.31 47.08 30.17L50.85 33.4L47.2 36.45L43.5 33.72V53.5H35.5V13.5Z" fill="${inkColor}"/>
  </g>
</svg>`.trim();
}

function buildInkdownAppIconSvg({ gradientStart, gradientEnd, inkColor, shadowColor }) {
    return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-labelledby="title desc">
  <title id="title">Inkdown app icon</title>
  <desc id="desc">Themed app icon for Inkdown with a centered palette-aware badge and ladder mark.</desc>
  <defs>
    <linearGradient id="badge" x1="18%" y1="12%" x2="82%" y2="88%">
      <stop offset="0%" stop-color="${gradientStart}"/>
      <stop offset="56%" stop-color="${gradientEnd}"/>
      <stop offset="100%" stop-color="${gradientEnd}"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="28" stdDeviation="34" flood-color="${shadowColor}" flood-opacity="0.22"/>
    </filter>
  </defs>
  <g filter="url(#shadow)">
    <rect x="112" y="112" width="800" height="800" rx="248" fill="url(#badge)"/>
    <g transform="translate(-14 -10)">
      <path d="M376 278H480V748H376V278Z" fill="${inkColor}"/>
      <path d="M545 278H649V400C649 427 664 451 690 473L740 516L690 558L649 526V748H545V278Z" fill="${inkColor}"/>
    </g>
  </g>
</svg>`.trim();
}

function getThemeAssetPalette() {
    const styles = getComputedStyle(document.documentElement);
    const themeMode = document.documentElement.getAttribute('data-theme-mode') || 'dark';
    const accentColor = styles.getPropertyValue('--accent-primary').trim() || '#B68543';

    return {
        gradientStart: styles.getPropertyValue('--logo-gradient-start').trim() || '#F3D089',
        gradientEnd: styles.getPropertyValue('--logo-gradient-end').trim() || '#B68543',
        inkColor: themeMode === 'dark' ? '#17120C' : '#1A1410',
        shadowColor: accentColor
    };
}

function applyThemeAssets(themeMeta) {
    const logoBadge = document.getElementById('logoBadge');
    const favicon = document.getElementById('appFavicon');
    const palette = getThemeAssetPalette();
    const signature = [
        themeMeta.key,
        palette.gradientStart,
        palette.gradientEnd,
        palette.inkColor
    ].join('|');

    if (AppState.themeAssetSignature === signature) return;
    AppState.themeAssetSignature = signature;

    const markDataUrl = encodeSvgDataUrl(buildInkdownMarkSvg(palette));
    const appIconDataUrl = encodeSvgDataUrl(buildInkdownAppIconSvg(palette));

    if (logoBadge) {
        logoBadge.src = markDataUrl;
    }

    if (favicon) {
        favicon.href = appIconDataUrl;
    }

    if (window.desktopBridge?.setAppIconTheme) {
        svgDataUrlToPngDataUrl(appIconDataUrl)
            .then((pngDataUrl) => {
                if (AppState.themeAssetSignature !== signature) return;
                window.desktopBridge.setAppIconTheme(pngDataUrl);
            })
            .catch((error) => {
                console.error('Failed to rasterize themed app icon:', error);
            });
    }
}

function updateHighlightTheme(mode) {
    const lightTheme = document.getElementById('highlight-light');
    const darkTheme = document.getElementById('highlight-dark');
    
    if (lightTheme && darkTheme) {
        if (mode === 'dark') {
            lightTheme.disabled = true;
            darkTheme.disabled = false;
        } else {
            lightTheme.disabled = false;
            darkTheme.disabled = true;
        }
    }
}

// Listen for system theme changes
const themeMediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
if (themeMediaQuery) {
    const handleThemeChange = () => {
        if (AppState.settings.themeMode === 'system') applyTheme();
    };

    if (typeof themeMediaQuery.addEventListener === 'function') {
        themeMediaQuery.addEventListener('change', handleThemeChange);
    } else if (typeof themeMediaQuery.addListener === 'function') {
        themeMediaQuery.addListener(handleThemeChange);
    }
}

// ===========================
// Local Storage
// ===========================

function saveSettings() {
    try {
        const settingsToSave = { ...AppState.settings };
        delete settingsToSave.theme;
        localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settingsToSave));
    } catch (error) {
        console.error('Failed to save settings:', error);
    }
}

function clearStoredData() {
    try {
        localStorage.removeItem(STORAGE_KEYS.settings);
        localStorage.removeItem(STORAGE_KEYS.content);
        localStorage.removeItem(STORAGE_KEYS.legacySettings);
        localStorage.removeItem(STORAGE_KEYS.legacyContent);
    } catch (error) {
        console.error('Failed to clear storage:', error);
    }
}

function loadSettings() {
    try {
        const saved = localStorage.getItem(STORAGE_KEYS.settings) || localStorage.getItem(STORAGE_KEYS.legacySettings);
        if (saved) {
            AppState.settings = { ...AppState.settings, ...JSON.parse(saved) };
        }
        AppState.settings = { ...AppState.settings, ...normalizeThemeSettings(AppState.settings) };
        
        // Update UI controls
        document.getElementById('realtimeConversion').checked = AppState.settings.realtimeConversion;
        document.getElementById('debounceDelay').value = AppState.settings.debounceDelay;
        document.getElementById('debounceValue').textContent = `${AppState.settings.debounceDelay}ms`;
        document.getElementById('markdownFlavor').value = AppState.settings.markdownFlavor;
        document.getElementById('syntaxHighlighting').checked = AppState.settings.syntaxHighlighting;
        document.getElementById('themeModeSelect').value = AppState.settings.themeMode;
        document.getElementById('themePaletteSelect').value = AppState.settings.themePalette;
        document.getElementById('autoSave').checked = AppState.settings.autoSave;
        updateThemeModeSelection(AppState.settings.themeMode);
        updateThemePaletteSelection(AppState.settings.themePalette);
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

function saveContent() {
    if (!AppState.settings.autoSave) return;
    
    try {
        const content = {
            richText: getRichTextEditorHtml(),
            markdown: document.getElementById('markdownInput').value,
            mode: AppState.conversionMode,
            timestamp: Date.now()
        };
        localStorage.setItem(STORAGE_KEYS.content, JSON.stringify(content));
    } catch (error) {
        console.error('Failed to save content:', error);
    }
}

function loadSavedContent() {
    try {
        const saved = localStorage.getItem(STORAGE_KEYS.content) || localStorage.getItem(STORAGE_KEYS.legacyContent);
        if (saved) {
            const content = JSON.parse(saved);
            
            // Only restore if saved within last 24 hours
            if (Date.now() - content.timestamp < 24 * 60 * 60 * 1000) {
                document.getElementById('richTextEditor').innerHTML = sanitizeHtml(content.richText, { allowStyles: true });
                clearEmptyRichTextMarkup();
                document.getElementById('markdownInput').value = content.markdown;
                syncFormatPickerWithSelection();
                
                // Restore mode if needed
                if (content.mode) {
                    AppState.conversionMode = content.mode;
                }
            }
        }
    } catch (error) {
        console.error('Failed to load content:', error);
    }
}

// ===========================
// Toast Notifications
// ===========================

const TOAST_ICONS = {
    success: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    warning: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    theme:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M12 2v2.5"/><path d="M12 19.5V22"/><path d="M2 12h2.5"/><path d="M19.5 12H22"/></svg>`,
};

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = TOAST_ICONS[type] || TOAST_ICONS.info;
    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <span class="toast-message"></span>
        <div class="toast-progress"></div>
    `;
    toast.querySelector('.toast-message').textContent = message;

    container.appendChild(toast);

    const removeToast = () => {
        if (!toast.parentNode) return;
        toast.classList.add('removing');
        setTimeout(() => {
            if (toast.parentNode) container.removeChild(toast);
        }, 320);
    };

    // Auto-dismiss after 3s
    setTimeout(removeToast, 3000);

    // Click to dismiss early
    toast.addEventListener('click', removeToast);
}

// ===========================
// Theme Toggle Button
// ===========================

function setupThemeToggle() {
    const btn = document.getElementById('themeToggleBtn');
    if (!btn) return;

    btn.addEventListener('click', () => {
        const current = getThemeMeta(AppState.settings);
        const next =
            current.requestedMode === 'light' ? 'dark' :
            current.requestedMode === 'dark' ? 'system' :
            'light';
        AppState.settings.themeMode = next;
        const select = document.getElementById('themeModeSelect');
        if (select) select.value = next;
        saveSettings();
        applyTheme();
        showToast(`${THEME_MODE_LABELS[next] || 'Theme'} mode selected`, 'theme');
    });
    updateThemeToggleState(getThemeMeta(AppState.settings));
}

function updateThemeToggleState(themeMeta) {
    const btn = document.getElementById('themeToggleBtn');
    if (!btn) return;
    const targetMode =
        themeMeta.requestedMode === 'light' ? 'dark' :
        themeMeta.requestedMode === 'dark' ? 'system' :
        'light';
    const label = `Switch to ${THEME_MODE_LABELS[targetMode]} mode`;
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
}

function updateThemeModeSelection(mode) {
    document.querySelectorAll('[data-theme-mode-value]').forEach((button) => {
        const isSelected = button.dataset.themeModeValue === mode;
        button.classList.toggle('is-selected', isSelected);
        button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });
}

function updateThemePaletteSelection(palette) {
    document.querySelectorAll('[data-theme-palette-value]').forEach((button) => {
        const isSelected = button.dataset.themePaletteValue === palette;
        button.classList.toggle('is-selected', isSelected);
        button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });
}

function setupGlobalShortcuts() {
    document.addEventListener('keydown', (event) => {
        handleModalKeydown(event);

        if ((event.metaKey || event.ctrlKey) && event.key === ',') {
            event.preventDefault();
            openModal('settingsModal', { settingsTab: 'settings' });
        }
    });
}

// ===========================
// Toolbar Ripple Effect
// ===========================

function addRipple(btn, e) {
    const existing = btn.querySelector('.ripple');
    if (existing) existing.remove();
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 400);
}

// ===========================
// Error Handling
// ===========================

window.addEventListener('error', (event) => {
    console.error('Application error:', event.error);
    showToast('An error occurred. Please refresh the page.', 'error');
});

// ===========================
// Utility Functions
// ===========================

// Prevent data loss on page unload
window.addEventListener('beforeunload', (e) => {
    if (AppState.settings.autoSave) {
        saveContent();
    }
});

// Auto-save periodically
AppState.autoSaveIntervalId = setInterval(() => {
    if (AppState.settings.autoSave) {
        saveContent();
    }
}, 30000); // Every 30 seconds
