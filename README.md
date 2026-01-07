# Rich Text ⇄ Markdown Converter

A powerful, standalone HTML/JavaScript application for bidirectional conversion between rich text and markdown formats. Runs entirely in your browser with no server required.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

### Core Functionality
- **Bidirectional Conversion**: Convert between rich text and markdown in both directions
- **Real-time Preview**: See your converted output as you type
- **WYSIWYG Editor**: Full-featured rich text editor with formatting toolbar
- **Markdown Support**: Complete support for CommonMark and GitHub Flavored Markdown (GFM)

### Rich Text Formatting
- **Text Styling**: Bold, italic, strikethrough, underline
- **Headings**: H1 through H6
- **Lists**: Ordered and unordered lists
- **Links**: Hyperlinks with custom text
- **Images**: Image insertion with URLs
- **Blockquotes**: Quoted text blocks
- **Code**: Inline code and code blocks
- **Horizontal Rules**: Visual dividers

### User Experience
- **Split View**: Side-by-side input and output panels
- **Copy to Clipboard**: One-click copying of converted content
- **Download Files**: Save output as .md or .html files
- **Keyboard Shortcuts**: Quick formatting with Ctrl+B, Ctrl+I, etc.
- **Dark Mode**: Light and dark themes with auto-detection
- **Auto-save**: Automatically saves your work to browser storage
- **Responsive Design**: Works on desktop, tablet, and mobile

### Advanced Features
- **Syntax Highlighting**: Code blocks with syntax highlighting
- **Configurable Conversion**: Adjust debounce delay and markdown flavor
- **Statistics**: Real-time word and character counts
- **Privacy-Focused**: All processing happens locally—no data sent to servers
- **Offline Capable**: Works without internet connection (after initial load)

## 🚀 Getting Started

### Quick Start

1. **Download the files**:
   - `index.html`
   - `styles.css`
   - `app.js`

2. **Open in browser**:
   - Simply double-click `index.html` or open it in any modern web browser
   - No installation or server setup required!

### Using the Application

#### Rich Text to Markdown Mode
1. Click "Rich Text → Markdown" at the top
2. Type or paste formatted text in the left panel
3. Use the toolbar to format your text
4. View the markdown output in the right panel
5. Copy or download the result

#### Markdown to Rich Text Mode
1. Click "Markdown → Rich Text" at the top
2. Enter markdown syntax in the left panel
3. View the formatted preview in the right panel
4. Copy or download the HTML output

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+B` / `Cmd+B` | Bold |
| `Ctrl+I` / `Cmd+I` | Italic |
| `Ctrl+U` / `Cmd+U` | Underline |
| `Ctrl+K` / `Cmd+K` | Insert Link |

## 🎨 Markdown Syntax Reference

| Element | Markdown Syntax |
|---------|----------------|
| Heading 1 | `# Heading 1` |
| Heading 2 | `## Heading 2` |
| Bold | `**bold text**` |
| Italic | `*italic text*` |
| Strikethrough | `~~strikethrough~~` |
| Link | `[text](url)` |
| Image | `![alt text](url)` |
| Unordered List | `- item` or `* item` |
| Ordered List | `1. item` |
| Blockquote | `> quote` |
| Inline Code | `` `code` `` |
| Code Block | ` ```language` <br> `code` <br> ` ``` ` |
| Horizontal Rule | `---` or `***` |

## ⚙️ Settings

Access settings by clicking the gear icon in the header.

### Available Settings

- **Real-time Conversion**: Toggle automatic conversion as you type
- **Conversion Delay**: Adjust debounce delay (100-2000ms) to optimize performance
- **Markdown Flavor**: Choose between GitHub Flavored Markdown (GFM) or CommonMark
- **Syntax Highlighting**: Enable/disable code syntax highlighting
- **Theme**: Choose light, dark, or auto (system preference)
- **Auto-save**: Automatically save your work to browser storage

## 🔧 Technical Details

### Dependencies

The application uses these libraries (loaded from CDN):
- **Marked.js** (v11.1.1): Markdown to HTML conversion
- **Turndown.js** (v7.1.2): HTML to Markdown conversion
- **Turndown Plugin GFM** (v1.0.2): GitHub Flavored Markdown support
- **Highlight.js** (v11.9.0): Syntax highlighting for code blocks

### Browser Compatibility

Works in all modern browsers:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

### Local Storage

The application uses browser localStorage to save:
- User preferences and settings
- Draft content (auto-saved every 30 seconds)
- Last working session (restored on reload)

Data is stored locally and never sent to external servers.

## 📝 Use Cases

- **Documentation**: Convert between markdown and rich text for documentation
- **Content Creation**: Write in your preferred format and convert as needed
- **Note Taking**: Take notes in markdown or rich text
- **Blog Posts**: Prepare content in markdown for static site generators
- **Email Drafts**: Convert rich text to markdown for plain text emails
- **GitHub README**: Preview and edit README files
- **Technical Writing**: Format technical documentation with code blocks

## 🔒 Privacy & Security

- **100% Client-Side**: All processing happens in your browser
- **No Server Communication**: No data is sent to external servers
- **No Tracking**: No analytics or tracking scripts
- **No Cookies**: Only uses localStorage for saving preferences
- **Open Source**: Full source code available for inspection

## 🐛 Troubleshooting

### Conversion Not Working
- Check browser console for errors
- Ensure JavaScript is enabled
- Try refreshing the page
- Clear browser cache and reload

### Content Not Saving
- Check if auto-save is enabled in settings
- Ensure browser allows localStorage
- Check available storage space

### Styling Issues
- Try clearing browser cache
- Check if CSS file is loaded properly
- Try a different browser

## 📄 File Structure

```
rich-text-markdown-converter/
├── index.html          # Main HTML structure
├── styles.css          # All styling and themes
├── app.js             # Application logic
└── README.md          # This file
```

## 🎯 Future Enhancements

Potential features for future versions:
- Table support in rich text editor
- Task list support (checkboxes)
- Export to PDF
- Import from files
- Multiple document tabs
- Custom keyboard shortcuts
- Markdown templates
- Find and replace
- Spell checker integration

## 🤝 Contributing

This is a standalone application. Feel free to:
- Fork and modify for your needs
- Report bugs or issues
- Suggest new features
- Submit improvements

## 📜 License

MIT License - Feel free to use, modify, and distribute.

## 🙏 Acknowledgments

Built with:
- [Marked.js](https://marked.js.org/) - Markdown parser
- [Turndown](https://github.com/mixmark-io/turndown) - HTML to Markdown converter
- [Highlight.js](https://highlightjs.org/) - Syntax highlighting

## 📞 Support

For issues or questions:
1. Check the Help section in the app (? icon)
2. Review this README
3. Check browser console for errors
4. Try the troubleshooting section above

---

**Made with ❤️ for developers, writers, and content creators**

*Last updated: 2025*
