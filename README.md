# AI Prompt Manager

English | [简体中文](README.zh-CN.md)

A powerful Chrome browser extension that supports efficient management and quick insertion of preset prompts on 8 major AI platforms including ChatGPT, Claude, Gemini, Grok, Perplexity, DeepSeek, Doubao, and Qwen.

## ✨ Features

### 🎯 Core Functions
- **Smart Side Menu**: Floating trigger button that expands into a complete prompt management interface
- **One-Click Insert**: Click prompts to directly insert them into AI input box with cursor auto-positioned at text end
- **Category Management**: Support custom categories to organize prompts systematically
- **Quick Search**: Real-time search functionality to quickly locate needed prompts
- **Category Folding**: Support expanding/collapsing categories for better browsing and management

### 💡 Advanced Features
- **Multi-Platform Support**: Perfect compatibility with ChatGPT, Claude, Gemini, Grok, Perplexity, DeepSeek, Doubao, Qwen and other 8 major AI platforms
- **Drag Positioning**: Trigger button supports free dragging for personalized interface layout
- **Smart Button Management**: Intelligent collapse mechanism with multiple auto-collapse trigger conditions
- **Precise Cursor Positioning**: Automatically positions cursor at optimal location after text insertion for easy editing
- **Local Storage**: All data saved locally ensuring privacy and security
- **Import/Export**: Support backup and migration of prompt data

### 🎨 User Experience
- **Modern Interface**: Beautiful UI design following modern aesthetics
- **Smooth Animations**: Fluid transition effects and interactive feedback
- **Smart Interactions**: Auto-collapse, delayed collapse, click outside to close and other intelligent interactions
- **Responsive Design**: Adapts to different screen sizes
- **Optimized for Efficiency**: Streamlined workflow for maximum productivity

## 🚀 Installation

### Developer Mode Installation
1. Clone or download this repository to your local machine
```bash
git clone https://github.com/aaronyang-ai/ai-prompt-manager.git
```
2. Open Chrome browser and navigate to extensions page: `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" button
5. Select the project folder

### Chrome Web Store Installation
> Coming soon to Chrome Web Store

## 📖 Usage Guide

### Getting Started
1. After installing the extension, visit [ChatGPT](https://chat.openai.com/) or [Claude](https://claude.ai/)
2. A floating prompt trigger button will appear on the right side of the page (collapsed by default)
3. Hover over the button to auto-expand, click to open the side menu
4. Button supports smart collapse: auto-collapse after use, collapse when clicking outside, or auto-collapse after 3 seconds of inactivity

### Managing Prompts
- **Add Prompts**: Click the "Add" button in the popup interface or side menu
- **Organize Categories**: Set category tags for prompts for better organization
- **Edit & Modify**: Click the edit button on prompt cards to make changes
- **Quick Search**: Use the search box to quickly locate specific prompts
- **Import/Export**: Support JSON format data backup and migration

### Using Prompts
1. On ChatGPT/Claude input box, click the prompt trigger button
2. Select the desired prompt from the side menu
3. The prompt will be automatically inserted into the input box with cursor positioned at text end
4. You can directly continue typing additional content or send immediately
5. After completion, the button and menu will intelligently collapse to keep the interface clean

## 🛠️ Tech Stack

- **Frontend Framework**: Vanilla JavaScript (ES6+)
- **Browser API**: Chrome Extension API v3
- **Storage Solution**: Chrome Storage API
- **Styling Technology**: CSS3 + Modern Animations
- **Interaction Technology**: DOM Selection API, Event Delegation, State Management
- **Performance Optimization**: Debounce techniques, Memory management, Hardware-accelerated animations
- **Build Tools**: Native development, no complex build process required

## 📁 Project Structure

```
ai-prompt-manager/
├── manifest.json          # Extension configuration
├── src/
│   ├── content/           # Content scripts
│   │   ├── js/           # JavaScript logic
│   │   └── css/          # Style files
│   ├── popup/            # Popup interface
│   │   ├── popup.html    # Popup page
│   │   ├── popup.js      # Popup logic
│   │   └── popup.css     # Popup styles
│   ├── background/       # Background scripts
│   ├── welcome/          # Welcome page
│   └── lib/              # Third-party libraries
├── assets/               # Static resources
│   └── icons/           # Icon files
└── docs/                # Documentation
```

## 🎮 Development Guide

### Local Development
1. After modifying code, click "Reload" button on Chrome extensions management page
2. Refresh relevant web pages to load the latest content scripts
3. Use browser developer tools for debugging

### Code Standards
- Follow ES6+ standards
- Use single quotes for strings
- Keep code clean and readable
- Add necessary comments

### Contributing
1. Fork this repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push branch: `git push origin feature/new-feature`
5. Submit Pull Request

## 🔧 Configuration Options

Configure in the extension popup:
- Interface theme settings
- Prompt category management
- Trigger button position preferences
- Data import/export

## 🚦 Version History

### v1.2.0 (Current Version)
- ✅ **Code Optimization**: Added DEBUG_MODE switch to optimize console log output
- ✅ **Performance Enhancement**: New TimerManager for unified timer management, preventing memory leaks
- ✅ **Permission Streamlining**: Removed unused management permission, following minimum privilege principle
- ✅ **Service Worker Enhancement**: Added extension lifecycle management and version tracking
- ✅ **Project Optimization**: Cleaned up redundant files, reducing project size by 25.6%
- ✅ **Developer Experience**: Added 9 useful npm script commands

### v1.1.0
- ✅ **Cursor Positioning Optimization**: Automatically positions cursor at text end after prompt insertion for easy editing
- ✅ **Smart Button Management**: Added 5 auto-collapse trigger conditions, significantly improving user experience
- ✅ **Technical Architecture Upgrade**: Added state management, memory cleanup, debounce optimization and other technical improvements
- ✅ **Enhanced Interaction Experience**: Comprehensive error handling and fault tolerance mechanisms

### v1.0.0
- ✅ Complete prompt management system
- ✅ ChatGPT and Claude dual platform support
- ✅ Smart side menu design
- ✅ Category and search functionality
- ✅ Drag positioning feature

## 🛣️ Roadmap

### Coming Soon
- [ ] Cloud synchronization feature
- [ ] Team collaboration version
- [ ] Prompt template marketplace
- [ ] Mobile device support
- [ ] Multi-language interface

### Long-term Plans
- [ ] AI-driven prompt recommendations
- [ ] Prompt effectiveness analysis
- [ ] Support for more AI platforms
- [ ] Enterprise-level permission management

## 🤝 Support & Feedback

- **Bug Reports**: [GitHub Issues](https://github.com/aaronyang-ai/ai-prompt-manager/issues)
- **Feature Requests**: Welcome suggestions in Issues
- **Community Discussion**: Join our community discussions

## 📄 License

This project is licensed under the [MIT License](LICENSE).

## 💝 Acknowledgments

Thanks to all users who provided feedback and suggestions for this project, and the support from the open source community.

---

**⭐ If this project helps you, please give it a Star!** 