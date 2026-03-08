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
        theme: 'dark',
        autoSave: true
    },
    conversionTimer: null,
    statsTimer: null,
    saveTimer: null,
    activityTimer: null,
    activeModalId: null,
    lastFocusedElement: null,
    desktopMenuCleanup: null,
    lastSavedSignature: null,
    savedSelection: null,
    commandInputResolve: null
};

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
    applyRuntimeEnvironment();
    handleStartupActions();

    // Load saved settings and content
    loadSettings();
    loadSavedContent();

    // Initialize converters
    initializeConverters();

    // Setup event listeners
    setupEventListeners();
    normalizeTooltipBehavior();
    setupDesktopIntegration();

    // Apply initial theme
    applyTheme();

    // Set initial mode
    setConversionMode(AppState.conversionMode);

    // Setup theme toggle button in header
    setupThemeToggle();
    setupGlobalShortcuts();

    console.log('Rich Text ⇄ Markdown Converter initialized');
}

function normalizeTooltipBehavior() {
    document.querySelectorAll('[data-tooltip][title]').forEach((element) => {
        element.removeAttribute('title');
    });
}

function applyRuntimeEnvironment() {
    const isElectron = Boolean(window.desktopBridge?.isElectron) || /Electron/i.test(navigator.userAgent);
    document.body.classList.toggle('is-electron', isElectron);
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
    const markdownFlavor = AppState.settings.markdownFlavor === 'commonmark' ? 'commonmark' : 'gfm';

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

        // Add GFM plugin when GitHub Flavored Markdown is selected.
        if (markdownFlavor === 'gfm' && typeof turndownPluginGfm !== 'undefined') {
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
            gfm: markdownFlavor === 'gfm',
            breaks: markdownFlavor === 'gfm',
            headerIds: true,
            mangle: false,
            tables: markdownFlavor === 'gfm'
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
            const modalId = e.target.closest('.modal').id;
            if (modalId === 'commandInputModal') {
                resolveCommandInput(null);
                return;
            }
            closeModal(modalId);
        });
    });
    
    // Click outside modal to close
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                if (modal.id === 'commandInputModal') {
                    resolveCommandInput(null);
                    return;
                }
                closeModal(modal.id);
            }
        });
    });

    document.querySelectorAll('[data-settings-tab-trigger]').forEach(tabButton => {
        tabButton.addEventListener('click', () => {
            setSettingsTab(tabButton.dataset.settingsTabTrigger);
        });
    });

    setupCommandInputModal();
    
    // Settings controls
    setupSettingsListeners();
}

function setupCommandInputModal() {
    const form = document.getElementById('commandInputForm');
    const cancelButton = document.getElementById('commandInputCancel');
    const modal = document.getElementById('commandInputModal');

    if (!form || !cancelButton || !modal) return;

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const input = document.getElementById('commandInputField');
        resolveCommandInput(input?.value?.trim() || '');
    });

    cancelButton.addEventListener('click', () => {
        resolveCommandInput(null);
    });

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            resolveCommandInput(null);
        }
    });
}

function setupToolbarListeners() {
    const toolbar = document.getElementById('richTextToolbar');

    // Button commands
    toolbar.querySelectorAll('.toolbar-btn').forEach(btn => {
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            saveEditorSelection();
        });

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            addRipple(btn, e);
            const command = btn.dataset.command;
            executeCommand(command);
        });
    });
    
    // Select commands
    toolbar.querySelectorAll('.toolbar-select').forEach(select => {
        select.addEventListener('mousedown', () => {
            saveEditorSelection();
        });

        select.addEventListener('change', (e) => {
            const command = select.dataset.command;
            const value = select.value;
            if (value) {
                restoreEditorSelection();
                document.execCommand(command, false, value);
                select.value = '';
                document.getElementById('richTextEditor').focus();
                saveEditorSelection();
            }
        });
    });
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
        initializeConverters();
        saveSettings();
        runConversionNow();
        showToast(
            AppState.settings.markdownFlavor === 'commonmark'
                ? 'CommonMark mode enabled'
                : 'GitHub Flavored Markdown enabled',
            'info'
        );
    });
    
    // Syntax highlighting
    document.getElementById('syntaxHighlighting').addEventListener('change', (e) => {
        AppState.settings.syntaxHighlighting = e.target.checked;
        saveSettings();
        if (AppState.conversionMode === 'mdToRt') {
            convertMarkdownToRichText();
        }
    });
    
    // Theme
    document.getElementById('themeSelect').addEventListener('change', (e) => {
        AppState.settings.theme = e.target.value;
        saveSettings();
        applyTheme();
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

    if (AppState.settings.autoSave) {
        scheduleSaveContent();
    }
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
    if (AppState.settings.realtimeConversion) {
        scheduleConversion(() => convertRichTextToMarkdown());
    }
    scheduleStatsUpdate();
    if (AppState.settings.autoSave) {
        scheduleSaveContent();
    }
}

function handleMarkdownInput() {
    if (AppState.settings.realtimeConversion) {
        scheduleConversion(() => convertMarkdownToRichText());
    }
    scheduleStatsUpdate();
    if (AppState.settings.autoSave) {
        scheduleSaveContent();
    }
}

function scheduleConversion(callback) {
    clearTimeout(AppState.conversionTimer);
    AppState.conversionTimer = setTimeout(callback, AppState.settings.debounceDelay);
}

function scheduleStatsUpdate() {
    clearTimeout(AppState.statsTimer);
    AppState.statsTimer = setTimeout(() => {
        updateStats();
    }, 120);
}

function scheduleSaveContent() {
    clearTimeout(AppState.saveTimer);
    AppState.saveTimer = setTimeout(() => {
        saveContent();
    }, 900);
}

function runConversionNow() {
    clearTimeout(AppState.conversionTimer);
    if (AppState.conversionMode === 'rtToMd') {
        convertRichTextToMarkdown();
    } else {
        convertMarkdownToRichText();
    }
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

    if (!turndownService) {
        markdownOutput.value = 'Error: Turndown library not loaded';
        return;
    }

    setOutputActivity(true);

    try {
        const rawHtml = richTextEditor.innerHTML;
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
    setOutputActivity(false);
}

function convertMarkdownToRichText() {
    const markdownInput = document.getElementById('markdownInput');
    const richTextPreview = document.getElementById('richTextPreview');

    if (typeof marked === 'undefined') {
        richTextPreview.innerHTML = '<p>Error: Marked library not loaded</p>';
        return;
    }

    setOutputActivity(true);

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

    setOutputActivity(false);
}

// ===========================
// Action Functions
// ===========================

function clearInput() {
    if (AppState.conversionMode === 'rtToMd') {
        document.getElementById('richTextEditor').innerHTML = '<p>Start typing or paste your rich text here...</p>';
        document.getElementById('markdownOutput').value = '';
    } else {
        document.getElementById('markdownInput').value = '';
        document.getElementById('richTextPreview').innerHTML = '';
    }
    updateStats();
    saveContent();
}

async function pasteFromClipboard() {
    try {
        if (AppState.conversionMode === 'rtToMd') {
            const editor = document.getElementById('richTextEditor');
            editor.focus();
            const richClipboardHtml = await readRichClipboardHtml();

            if (richClipboardHtml) {
                insertHtmlAtCursor(sanitizeHtml(richClipboardHtml, { allowStyles: true }));
            } else {
                const text = await navigator.clipboard.readText();
                document.execCommand('insertText', false, text);
            }

            handleRichTextInput();
        } else {
            const text = await navigator.clipboard.readText();
            const input = document.getElementById('markdownInput');
            input.value = text;
            handleMarkdownInput();
        }
        showToast('Pasted from clipboard', 'success');
    } catch (error) {
        showToast('Failed to paste from clipboard', 'error');
    }
}

async function readRichClipboardHtml() {
    try {
        if (!navigator.clipboard?.read) return null;

        const items = await navigator.clipboard.read();
        for (const item of items) {
            if (!item.types.includes('text/html')) continue;
            const blob = await item.getType('text/html');
            return await blob.text();
        }
    } catch (error) {
        console.debug('Rich clipboard read unavailable:', error);
    }

    return null;
}

function insertHtmlAtCursor(html) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
        document.execCommand('insertHTML', false, html);
        return;
    }

    const range = selection.getRangeAt(0);
    range.deleteContents();

    const temp = document.createElement('div');
    temp.innerHTML = html;
    const fragment = document.createDocumentFragment();
    let node;
    let lastNode = null;

    while ((node = temp.firstChild)) {
        lastNode = fragment.appendChild(node);
    }

    range.insertNode(fragment);

    if (lastNode) {
        range.setStartAfter(lastNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
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

function buildStandaloneHtmlDocument(bodyHtml) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rich Text Export</title>
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
        filename = 'output.md';
        mimeType = 'text/markdown';
    } else {
        content = buildStandaloneHtmlDocument(document.getElementById('richTextPreview').innerHTML);
        filename = 'output.html';
        mimeType = 'text/html';
    }
    return { content, filename, mimeType };
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

// ===========================
// Statistics
// ===========================

function updateStats() {
    let inputText, outputText;
    
    if (AppState.conversionMode === 'rtToMd') {
        inputText = document.getElementById('richTextEditor').textContent || '';
        outputText = document.getElementById('markdownOutput').value;
    } else {
        inputText = document.getElementById('markdownInput').value;
        outputText = document.getElementById('richTextPreview').textContent || '';
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

function setOutputActivity(isActive) {
    const outputPanel = document.querySelector('.output-panel');
    if (!outputPanel) return;

    clearTimeout(AppState.activityTimer);

    if (isActive) {
        outputPanel.classList.add('converting');
        return;
    }

    AppState.activityTimer = setTimeout(() => {
        outputPanel.classList.remove('converting');
    }, 240);
}

// ===========================
// Modal Management
// ===========================

function setSettingsTab(tabName = 'settings') {
    const tabs = document.querySelectorAll('[data-settings-tab-trigger]');
    const panels = document.querySelectorAll('[data-settings-tab-panel]');
    const activeTab = tabName === 'reference' ? 'reference' : 'settings';

    tabs.forEach(tab => {
        const isActive = tab.dataset.settingsTabTrigger === activeTab;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        tab.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    panels.forEach(panel => {
        panel.classList.toggle('active', panel.dataset.settingsTabPanel === activeTab);
    });
}

function getFocusableElements(container) {
    return Array.from(
        container.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
    ).filter(element => element.offsetParent !== null);
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
    const theme = AppState.settings.theme;

    if (theme === 'auto') {
        const prefersDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : false;
        const resolved = prefersDark ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', resolved);
        updateHighlightTheme(resolved);
    } else {
        document.documentElement.setAttribute('data-theme', theme);
        updateHighlightTheme(theme);
    }
}

function updateHighlightTheme(theme) {
    const lightTheme = document.getElementById('highlight-light');
    const darkTheme = document.getElementById('highlight-dark');
    
    if (lightTheme && darkTheme) {
        if (theme === 'dark') {
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
        if (AppState.settings.theme === 'auto') {
            applyTheme();
        }
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
        localStorage.setItem('rtmd_settings', JSON.stringify(AppState.settings));
    } catch (error) {
        console.error('Failed to save settings:', error);
    }
}

function clearStoredData() {
    try {
        localStorage.removeItem('rtmd_settings');
        localStorage.removeItem('rtmd_content');
    } catch (error) {
        console.error('Failed to clear storage:', error);
    }
}

function loadSettings() {
    try {
        const saved = localStorage.getItem('rtmd_settings');
        if (saved) {
            AppState.settings = { ...AppState.settings, ...JSON.parse(saved) };
            
            // Update UI controls
            document.getElementById('realtimeConversion').checked = AppState.settings.realtimeConversion;
            document.getElementById('debounceDelay').value = AppState.settings.debounceDelay;
            document.getElementById('debounceValue').textContent = `${AppState.settings.debounceDelay}ms`;
            document.getElementById('markdownFlavor').value = AppState.settings.markdownFlavor;
            document.getElementById('syntaxHighlighting').checked = AppState.settings.syntaxHighlighting;
            document.getElementById('themeSelect').value = AppState.settings.theme;
            document.getElementById('autoSave').checked = AppState.settings.autoSave;
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

function saveContent() {
    if (!AppState.settings.autoSave) return;
    
    try {
        const signature = JSON.stringify({
            richText: document.getElementById('richTextEditor').innerHTML,
            markdown: document.getElementById('markdownInput').value,
            mode: AppState.conversionMode
        });

        if (signature === AppState.lastSavedSignature) return;

        const content = {
            richText: document.getElementById('richTextEditor').innerHTML,
            markdown: document.getElementById('markdownInput').value,
            mode: AppState.conversionMode,
            timestamp: Date.now()
        };
        localStorage.setItem('rtmd_content', JSON.stringify(content));
        AppState.lastSavedSignature = signature;
    } catch (error) {
        console.error('Failed to save content:', error);
    }
}

function loadSavedContent() {
    try {
        const saved = localStorage.getItem('rtmd_content');
        if (saved) {
            const content = JSON.parse(saved);
            
            // Only restore if saved within last 24 hours
            if (Date.now() - content.timestamp < 24 * 60 * 60 * 1000) {
                document.getElementById('richTextEditor').innerHTML = sanitizeHtml(content.richText, { allowStyles: true });
                document.getElementById('markdownInput').value = content.markdown;
                AppState.lastSavedSignature = JSON.stringify({
                    richText: content.richText,
                    markdown: content.markdown,
                    mode: content.mode || AppState.conversionMode
                });
                
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
    success: `<i class="ph ph-check"></i>`,
    error:   `<i class="ph ph-x"></i>`,
    warning: `<i class="ph ph-warning"></i>`,
    info:    `<i class="ph ph-info"></i>`,
};

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = TOAST_ICONS[type] || TOAST_ICONS.info;
    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <span class="toast-message">${message}</span>
        <div class="toast-progress"></div>
    `;

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

function setupDesktopIntegration() {
    if (!window.desktopBridge?.onMenuAction) return;

        AppState.desktopMenuCleanup = window.desktopBridge.onMenuAction(async (action) => {
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
        const editor = document.getElementById('richTextEditor');
        editor.textContent = result.content;
    }

    setConversionMode('rtToMd');
    handleRichTextInput();
    showToast(`Opened ${result.name}`, 'success');
}

// ===========================
// Theme Toggle Button
// ===========================

function setupThemeToggle() {
    const btn = document.getElementById('themeToggleBtn');
    if (!btn) return;

    btn.addEventListener('click', () => {
        const current = AppState.settings.theme;
        // Cycle: light → dark → black → auto → light
        const next =
            current === 'light' ? 'dark' :
            current === 'dark' ? 'black' :
            current === 'black' ? 'auto' :
            'light';
        AppState.settings.theme = next;
        const select = document.getElementById('themeSelect');
        if (select) select.value = next;
        saveSettings();
        applyTheme();

        const labels = {
            light: 'Light theme',
            dark: 'Dark theme',
            black: 'Pure black theme',
            auto: 'Auto (system) theme'
        };
        showToast(labels[next] || 'Theme updated', 'info');
    });

    // Sync icon visibility with theme attribute
    syncThemeToggleIcon();
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

function syncThemeToggleIcon() {
    const html = document.documentElement;
    const theme = html.getAttribute('data-theme') || 'light';
    // CSS handles sun/moon visibility via [data-theme] selectors
    // We just ensure the attribute is in sync
    if (!['light', 'dark', 'black'].includes(theme)) {
        // auto mode — show neither (could add a third icon, but moon is a fine fallback)
        html.setAttribute('data-theme', window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    }
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
setInterval(() => {
    if (AppState.settings.autoSave) {
        saveContent();
    }
}, 30000); // Every 30 seconds
