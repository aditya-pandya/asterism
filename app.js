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
        theme: 'light',
        autoSave: true
    },
    debounceTimer: null
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
// Initialization
// ===========================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // Load saved settings and content
    loadSettings();
    loadSavedContent();
    
    // Initialize converters
    initializeConverters();
    
    // Setup event listeners
    setupEventListeners();
    
    // Apply initial theme
    applyTheme();
    
    // Set initial mode
    setConversionMode('rtToMd');
    
    console.log('Rich Text ⇄ Markdown Converter initialized');
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
    document.getElementById('settingsBtn').addEventListener('click', () => openModal('settingsModal'));
    document.getElementById('helpBtn').addEventListener('click', () => openModal('helpModal'));
    
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
    
    // Settings controls
    setupSettingsListeners();
}

function setupToolbarListeners() {
    const toolbar = document.getElementById('richTextToolbar');
    
    // Button commands
    toolbar.querySelectorAll('.toolbar-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const command = btn.dataset.command;
            executeCommand(command);
        });
    });
    
    // Select commands
    toolbar.querySelectorAll('.toolbar-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const command = select.dataset.command;
            const value = select.value;
            if (value) {
                document.execCommand(command, false, value);
                select.value = '';
                document.getElementById('richTextEditor').focus();
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
            localStorage.clear();
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
        btn.classList.toggle('active', btn.dataset.direction === mode);
    });
    
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

function executeCommand(command) {
    const editor = document.getElementById('richTextEditor');
    
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
            const url = prompt('Enter URL:');
            if (url) {
                document.execCommand('createLink', false, url);
            }
            break;
            
        case 'insertImage':
            const imgUrl = prompt('Enter image URL:');
            if (imgUrl) {
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
    handleRichTextInput();
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
    
    if (!turndownService) {
        markdownOutput.value = 'Error: Turndown library not loaded';
        return;
    }
    
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
}

function convertMarkdownToRichText() {
    const markdownInput = document.getElementById('markdownInput');
    const richTextPreview = document.getElementById('richTextPreview');
    
    if (typeof marked === 'undefined') {
        richTextPreview.innerHTML = '<p>Error: Marked library not loaded</p>';
        return;
    }
    
    try {
        const markdown = markdownInput.value;
        const html = marked.parse(markdown);
        richTextPreview.innerHTML = html;
        
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
        const text = await navigator.clipboard.readText();
        if (AppState.conversionMode === 'rtToMd') {
            const editor = document.getElementById('richTextEditor');
            editor.focus();
            document.execCommand('insertText', false, text);
        } else {
            const input = document.getElementById('markdownInput');
            input.value = text;
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
        showToast('Copied to clipboard', 'success');
    } else {
        showToast('Failed to copy to clipboard', 'error');
    }
}

function downloadOutput() {
    let content, filename, mimeType;
    
    if (AppState.conversionMode === 'rtToMd') {
        content = document.getElementById('markdownOutput').value;
        filename = 'output.md';
        mimeType = 'text/markdown';
    } else {
        content = document.getElementById('richTextPreview').innerHTML;
        filename = 'output.html';
        mimeType = 'text/html';
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
        inputText = document.getElementById('richTextEditor').innerText;
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

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// ===========================
// Theme Management
// ===========================

function applyTheme() {
    const theme = AppState.settings.theme;
    
    if (theme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        updateHighlightTheme(prefersDark ? 'dark' : 'light');
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
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (AppState.settings.theme === 'auto') {
        applyTheme();
    }
});

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
        const content = {
            richText: document.getElementById('richTextEditor').innerHTML,
            markdown: document.getElementById('markdownInput').value,
            mode: AppState.conversionMode,
            timestamp: Date.now()
        };
        localStorage.setItem('rtmd_content', JSON.stringify(content));
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
                document.getElementById('richTextEditor').innerHTML = content.richText;
                document.getElementById('markdownInput').value = content.markdown;
                
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

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => {
            container.removeChild(toast);
        }, 300);
    }, 3000);
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
