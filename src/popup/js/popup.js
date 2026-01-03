'use strict';

// ===== Development Mode Configuration =====
// Set to false in production to reduce console output and improve performance
const DEBUG_MODE = false;

// Log wrapper - automatically disable non-error logs in production
const log = DEBUG_MODE ? console.log.bind(console, '[AI Prompt Popup]') : () => {};
const warn = DEBUG_MODE ? console.warn.bind(console, '[AI Prompt Popup]') : () => {};
const error = console.error.bind(console, '[AI Prompt Popup]'); // Error logs always enabled

// Global error handling
window.addEventListener('error', (event) => {
  error('Caught unhandled error:', event.error);

  // Display error notification to UI
  try {
    const notification = document.getElementById('notification');
    if (notification) {
      notification.textContent = '发生错误: ' + (event.error ? event.error.message : '未知错误');
      notification.className = 'notification error show';
      setTimeout(() => {
        notification.classList.remove('show');
      }, 5000);
    }
  } catch (e) {
    console.error('Unable to display error notification:', e);
  }

  return false;
});

// Global variables
let currentTab = null;
let allPrompts = [];
let activeCategory = 'all';

// Validate if DOM element exists
function validateDOMElement(element, name) {
  if (!element) {
    console.warn(`DOM element not found: ${name}`);
    return false;
  }
  return true;
}

// DOM element cache
const DOM = {
  // Tab related
  tabs: document.querySelectorAll('.tab'),
  promptsSection: document.getElementById('promptsSection'),
  addSection: document.getElementById('addSection'),
  settingsSection: document.getElementById('settingsSection'),

  // Prompt list related
  promptList: document.getElementById('promptList'),
  emptyState: document.getElementById('emptyState'),
  searchPrompt: document.getElementById('searchPrompt'),
  categoriesContainer: document.getElementById('categories'),

  // Form related
  promptTitle: document.getElementById('promptTitle'),
  promptCategory: document.getElementById('promptCategory'),
  promptContent: document.getElementById('promptContent'),
  customCategoryGroup: document.getElementById('customCategoryGroup'),
  customCategory: document.getElementById('customCategory'),

  // Buttons
  addPromptBtn: document.getElementById('addPromptBtn'),
  cancelAddBtn: document.getElementById('cancelAddBtn'),
  testInjectBtn: null, // Will be initialized in initUI
  exportBtn: null, // Will be initialized in initUI
  importFile: null, // Will be initialized in initUI

  // Developer mode related
  developerModeToggle: document.getElementById('developerModeToggle'),
  developerOptions: document.getElementById('developerOptions'),

  // Others
  debugInfo: document.getElementById('debugInfo'),
  notification: document.getElementById('notification'), // Use element from HTML
  themeSelect: null // Will be initialized in initUI
};

// Initialize potentially missing elements in DOM object
function initializeDOMElements() {
  try {
    // Try to get notification element
    if (!DOM.notification) {
      console.log('Notification element does not exist, attempting to create');
      const notificationElement = document.getElementById('notification');
      if (notificationElement) {
        DOM.notification = notificationElement;
      } else {
        // Create one if it doesn't exist
        DOM.notification = document.createElement('div');
        DOM.notification.id = 'notification';
        DOM.notification.className = 'notification';
        document.body.appendChild(DOM.notification);
      }
    }

    // Try to get debugInfo element
    if (!DOM.debugInfo) {
      console.log('Debug info element does not exist, attempting to create');
      const debugInfoElement = document.getElementById('debugInfo');
      if (debugInfoElement) {
        DOM.debugInfo = debugInfoElement;
      } else {
        // Create one if it doesn't exist
        DOM.debugInfo = document.createElement('div');
        DOM.debugInfo.id = 'debugInfo';
        DOM.debugInfo.className = 'debug-info';
        const debugContent = document.createElement('div');
        debugContent.className = 'debug-content';
        DOM.debugInfo.appendChild(debugContent);
        document.body.appendChild(DOM.debugInfo);
      }
    }

    console.log('DOM elements initialization complete');
  } catch (error) {
    console.error('Error initializing DOM elements:', error);
  }
}

// Initialize current tab info
async function initCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;

    if (!tab) {
      console.warn('Unable to get current tab info');
      return;
    }

    console.log('Current tab:', tab.url);
    console.log('Is supported AI page:', isSupportedAIPage(tab.url));
  } catch (error) {
    console.error('Failed to get current tab:', error);
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM loaded, starting initialization...');

  // Initialize potentially missing elements in DOM object
  initializeDOMElements();

  // Validate critical DOM elements
  const criticalElements = [
    {element: DOM.tabs, name: 'tabs'},
    {element: DOM.promptsSection, name: 'promptsSection'},
    {element: DOM.addSection, name: 'addSection'},
    {element: DOM.settingsSection, name: 'settingsSection'},
    {element: DOM.addPromptBtn, name: 'addPromptBtn'},
    {element: DOM.cancelAddBtn, name: 'cancelAddBtn'}
  ];

  let allValid = true;
  criticalElements.forEach(item => {
    if (!validateDOMElement(item.element, item.name)) {
      allValid = false;
    }
  });

  if (!allValid) {
    console.error('Some critical DOM elements not found, UI may not work properly');
  }

  // ⭐ First get current tab info (bug fix: previously only got in developer mode)
  await initCurrentTab();

  // Initialize UI
  initUI();

  // Load all prompts
  loadPrompts();

  // Initialize developer mode
  initDeveloperMode();

  // Set theme
  loadTheme();
});

// Initialize UI and event listeners
function initUI() {
  try {
    // Add debug code
    console.log('Initializing UI...');

    // Get themeSelect element
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
      DOM.themeSelect = themeSelect;
    }

    // Tab switching
    if (DOM.tabs && DOM.tabs.length > 0) {
      DOM.tabs.forEach(tab => {
        if (!tab) return; // Safety check

        console.log('Binding event to tab:', tab);
        tab.addEventListener('click', (e) => {
          e.preventDefault();
          const targetTab = tab.dataset.tab;
          switchTab(targetTab);
        });
      });
    } else {
      console.error('Tab elements do not exist or are empty');
    }

    // Search functionality
    if (DOM.searchPrompt) {
      DOM.searchPrompt.addEventListener('input', debounce(filterPrompts, 300));
    }

    // Category selection
    if (DOM.categoriesContainer) {
      DOM.categoriesContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('category')) {
          const category = e.target.dataset.category;
          changeCategory(category);
        }
      });
    }

    // Prompt category selection change
    if (DOM.promptCategory && DOM.customCategoryGroup) {
      DOM.promptCategory.addEventListener('change', () => {
        if (DOM.promptCategory.value === 'custom') {
          DOM.customCategoryGroup.classList.remove('hidden');
        } else {
          DOM.customCategoryGroup.classList.add('hidden');
        }
      });
    }

    // Prompt content input real-time Markdown preview
    if (DOM.promptContent) {
      DOM.promptContent.addEventListener('input', debounce(() => {
        updateMarkdownPreview(DOM.promptContent.value);
      }, 300));
    }

    // Button events
    if (DOM.addPromptBtn) {
      DOM.addPromptBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Add button clicked');
        addPrompt();
      });
      console.log('Add button event bound');
    }

    if (DOM.cancelAddBtn) {
      DOM.cancelAddBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Cancel button clicked');
        switchTab('prompts');
      });
      console.log('Cancel button event bound');
    }

    // Test inject button - safety check
    const testInjectBtn = document.getElementById('testInjectBtn');
    if (testInjectBtn) {
      DOM.testInjectBtn = testInjectBtn;
      testInjectBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Test button clicked');
        testInject();
      });
      console.log('Test button event bound');
    }

    // Export button - safety check
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
      DOM.exportBtn = exportBtn;
      exportBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Export button clicked');
        exportPrompts();
      });
      console.log('Export button event bound');
    }

    // Import file - safety check
    const importFile = document.getElementById('importFile');
    if (importFile) {
      DOM.importFile = importFile;
      importFile.addEventListener('change', (e) => {
        console.log('Import file changed');
        importPrompts(e);
      });
      console.log('Import file event bindied');
    }
    
    // Theme switching - safety check
    if (DOM.themeSelect) {
      DOM.themeSelect.addEventListener('change', () => {
        setTheme(DOM.themeSelect.value);
      });
    }
    
    // Prompt list click event (using event delegation)
    if (DOM.promptList) {
      DOM.promptList.addEventListener('click', handlePromptListClick);
    }
    
    console.log('UI initialization complete');
  } catch (error) {
    console.error('UI initialization error:', error);
  }
}

// Switch tab
function switchTab(tabName) {
  // Update tab styles
  DOM.tabs.forEach(tab => {
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
  
  // Show/hide corresponding content
  DOM.promptsSection.classList.toggle('active', tabName === 'prompts');
  DOM.addSection.classList.toggle('active', tabName === 'add');
  DOM.settingsSection.classList.toggle('active', tabName === 'settings');
  
  // Clear form when switching to add prompt tab
  if (tabName === 'add') {
    resetAddForm();
  }
}

// Reset add prompt form
function resetAddForm() {
  DOM.promptTitle.value = '';
  DOM.promptCategory.value = 'general';
  DOM.promptContent.value = '';
  DOM.customCategory.value = '';
  DOM.customCategoryGroup.classList.add('hidden');
  
  // Clear edit state
  if (DOM.addPromptBtn.dataset.editId) {
    delete DOM.addPromptBtn.dataset.editId;
    DOM.addPromptBtn.textContent = '添加提示词';
  }
  
  // Remove Markdown preview (if exists)
  const previewContainer = document.getElementById('markdown-preview');
  if (previewContainer) {
    previewContainer.remove();
  }
}


// Initialize developer mode
function initDeveloperMode() {
  const toggle = DOM.developerModeToggle;
  const options = DOM.developerOptions;
  
  if (!toggle || !options) {
    console.warn("Developer mode elements not found");
    return;
  }
  
  // Load developer mode state from storage
  chrome.storage.local.get(["developerMode"], (result) => {
    const isDeveloperMode = result.developerMode || false;
    
    // Support two toggle types: checkbox and custom div.toggle
    if (toggle.type === 'checkbox') {
    toggle.checked = isDeveloperMode;
    } else {
      // Custom toggle div uses active class
      toggle.classList.toggle('active', isDeveloperMode);
    }
    
    options.classList.toggle('hidden', !isDeveloperMode);
    
    // Show or hide debug info based on developer mode state
    if (isDeveloperMode) {
      showDebugInfo();
    }
  });
  
  // Listen for developer mode toggle
  toggle.addEventListener("click", () => {
    let isEnabled;
    
    // Support two toggle types
    if (toggle.type === 'checkbox') {
      isEnabled = toggle.checked;
    } else {
      // Custom toggle div toggles active class
      toggle.classList.toggle('active');
      isEnabled = toggle.classList.contains('active');
    }
    
    options.classList.toggle('hidden', !isEnabled);
    
    // Save state
    chrome.storage.local.set({ developerMode: isEnabled });
    
    // Show or hide debug info
    const debugInfo = document.getElementById("debugInfo");
    if (debugInfo) {
      if (isEnabled) {
        debugInfo.classList.add("show");
        showDebugInfo();
      } else {
        debugInfo.classList.remove("show");
      }
    }
  });
}

// Show debug info
async function showDebugInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;
    
    // Check if tab exists
    if (!tab) {
      console.warn('Unable to get current tab info');
      return;
    }
    
    const isChatGPT = isChatGPTPage(tab.url);
    const isClaude = isClaudePage(tab.url);
    const isGemini = isGeminiPage(tab.url);
    const isGrok = isGrokPage(tab.url);
    const isPerplexity = isPerplexityPage(tab.url);
    const isDeepSeek = isDeepSeekPage(tab.url);
    const isDoubao = isDoubaoPage(tab.url);
    const isQwen = isQwenPage(tab.url);
    const isSupportedAI = isSupportedAIPage(tab.url);

    // Safety check for debugInfo element
    if (!DOM.debugInfo) {
      console.warn('Debug info element does not exist');
      return;
    }

    const debugElement = DOM.debugInfo.querySelector('.debug-content');

    // Safety check for debugElement
    if (!debugElement) {
      console.warn('Debug content element does not exist');
      // Try to create debug-content element
      const newDebugElement = document.createElement('div');
      newDebugElement.className = 'debug-content';
      DOM.debugInfo.appendChild(newDebugElement);

      newDebugElement.innerHTML = `
        <div style="margin-bottom: 8px; font-weight: bold;">当前页面检测</div>
        <div>URL: ${tab.url.substring(0, 50)}...</div>
        <div style="margin-top: 8px;">支持的AI平台:</div>
        <div>ChatGPT: ${isChatGPT ? '✅' : '❌'}</div>
        <div>Claude: ${isClaude ? '✅' : '❌'}</div>
        <div>Gemini: ${isGemini ? '✅' : '❌'}</div>
        <div>Grok: ${isGrok ? '✅' : '❌'}</div>
        <div>Perplexity: ${isPerplexity ? '✅' : '❌'}</div>
        <div>DeepSeek: ${isDeepSeek ? '✅' : '❌'}</div>
        <div>豆包: ${isDoubao ? '✅' : '❌'}</div>
        <div>千问: ${isQwen ? '✅' : '❌'}</div>
        <div style="margin-top: 8px; font-weight: bold;">总计: ${isSupportedAI ? '✅ 支持' : '❌ 不支持'}</div>
        <div>提示词数量: ${allPrompts.length}</div>
        <div>插件版本: 1.2.0</div>
      `;
    } else {
    debugElement.innerHTML = `
      <div style="margin-bottom: 8px; font-weight: bold;">当前页面检测</div>
      <div>URL: ${tab.url.substring(0, 50)}...</div>
      <div style="margin-top: 8px;">支持的AI平台:</div>
      <div>ChatGPT: ${isChatGPT ? '✅' : '❌'}</div>
      <div>Claude: ${isClaude ? '✅' : '❌'}</div>
      <div>Gemini: ${isGemini ? '✅' : '❌'}</div>
      <div>Grok: ${isGrok ? '✅' : '❌'}</div>
      <div>Perplexity: ${isPerplexity ? '✅' : '❌'}</div>
      <div>DeepSeek: ${isDeepSeek ? '✅' : '❌'}</div>
      <div>豆包: ${isDoubao ? '✅' : '❌'}</div>
      <div>千问: ${isQwen ? '✅' : '❌'}</div>
      <div style="margin-top: 8px; font-weight: bold;">总计: ${isSupportedAI ? '✅ 支持' : '❌ 不支持'}</div>
      <div>提示词数量: ${allPrompts.length}</div>
      <div>插件版本: 1.2.0</div>
    `;
    }

    // Find test inject button
    const testInjectBtn = document.getElementById('testInjectBtn');

    // Only set properties when test button is found
    if (testInjectBtn) {
      DOM.testInjectBtn = testInjectBtn;
    // Disable test button if not on a supported AI page
      testInjectBtn.disabled = !isSupportedAI;
      testInjectBtn.style.opacity = isSupportedAI ? '1' : '0.5';
    if (!isSupportedAI) {
        testInjectBtn.title = '请在支持的AI页面使用此功能';
      }
    } else {
      console.warn('Test inject button element does not exist');
    }
  } catch (error) {
    console.error('Failed to get debug info:', error);
    // Print error directly without using showNotification
    console.error('Debug info retrieval failure details:', error);

    // Check developer mode state and control debug info display
    chrome.storage.local.get(["developerMode"], (result) => {
      const isDeveloperMode = result.developerMode || false;
      const debugInfo = document.getElementById("debugInfo");
      if (debugInfo) {
        if (isDeveloperMode) {
          debugInfo.classList.add("show");
        } else {
          debugInfo.classList.remove("show");
        }
      }
    });
  }
}

// Check if it's a supported AI page
function isSupportedAIPage(url) {
  return isChatGPTPage(url) ||
         isClaudePage(url) ||
         isGeminiPage(url) ||
         isGrokPage(url) ||
         isPerplexityPage(url) ||
         isDeepSeekPage(url) ||
         isDoubaoPage(url) ||
         isQwenPage(url);
}

// Check if it's a ChatGPT page
function isChatGPTPage(url) {
  return url.includes('chat.openai.com') || url.includes('chatgpt.com');
}

// Check if it's a Claude page
function isClaudePage(url) {
  return url.includes('claude.ai');
}

// Check if it's a Gemini page
function isGeminiPage(url) {
  return url.includes('gemini.google.com');
}

// Check if it's a Grok page
function isGrokPage(url) {
  return url.includes('grok.com') || (url.includes('x.com') && url.includes('/i/grok'));
}

// Check if it's a Perplexity page
function isPerplexityPage(url) {
  return url.includes('perplexity.ai');
}

// Check if it's a DeepSeek page
function isDeepSeekPage(url) {
  return url.includes('chat.deepseek.com');
}

// Check if it's a Doubao page
function isDoubaoPage(url) {
  return url.includes('doubao.com');
}

// Check if it's a Qwen page
function isQwenPage(url) {
  return url.includes('chat.qwen.ai') || url.includes('qianwen.aliyun.com');
}

// Test inject button on current page
async function testInject() {
  try {
    // Re-fetch current tab before each test to ensure latest info
    await initCurrentTab();

    if (!currentTab) {
      console.error('Current tab does not exist, cannot test inject');
      showNotification('无法获取当前标签页信息', 'error');
      return;
    }

    if (!isSupportedAIPage(currentTab.url)) {
      showNotification('请在支持的AI页面使用此功能', 'error');
      return;
    }
    
    try {
    await chrome.tabs.sendMessage(currentTab.id, { action: 'testInject' });
    showNotification('测试注入成功', 'success');
    } catch (err) {
      console.error('Failed to send message:', err);
      showNotification('测试注入失败，请刷新页面重试', 'error');
    }
  } catch (error) {
    console.error('Test inject failed:', error);
    showNotification('测试注入失败，请刷新页面重试', 'error');
  }
}

// Load prompts from storage
async function loadPrompts() {
  try {
    const data = await new Promise((resolve, reject) => {
      chrome.storage.local.get('prompts', (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(result);
      });
    });
    
    allPrompts = data.prompts || [];
    console.log(`Loaded ${allPrompts.length} prompts from storage`);

    // Update UI
    renderPromptList();
    updateCategoryTabs();
    updateEmptyState();
    
  } catch (error) {
    console.error('Failed to load prompts:', error);
    showNotification('加载提示词失败', 'error');

    // Use empty array on error
    allPrompts = [];
    renderPromptList();
    updateCategoryTabs();
    updateEmptyState(true);
  }
}

// Update category tabs
function updateCategoryTabs() {
  // Get all unique categories
  const categories = new Set();
  allPrompts.forEach(prompt => {
    if (prompt.category) {
      categories.add(prompt.category);
    }
  });
  
  // Clear existing categories (keep "All")
  const allCategoryTab = DOM.categoriesContainer.querySelector('[data-category="all"]');
  DOM.categoriesContainer.innerHTML = '';
  DOM.categoriesContainer.appendChild(allCategoryTab);
  
  // Add category tabs
  categories.forEach(category => {
    const categoryElement = document.createElement('div');
    categoryElement.classList.add('category');
    categoryElement.textContent = formatCategoryName(category);
    categoryElement.dataset.category = category;
    if (category === activeCategory) {
      categoryElement.classList.add('active');
    }
    DOM.categoriesContainer.appendChild(categoryElement);
  });
}

// Format category name for display
function formatCategoryName(category) {
  const categoryMap = {
    'general': '通用',
    'writing': '写作',
    'coding': '编程',
    'translation': '翻译',
    'creativity': '创意',
    'analysis': '分析'
  };
  
  return categoryMap[category] || category;
}

// Switch category filter
function changeCategory(category) {
  activeCategory = category;

  // Update category tab styles
  const categoryTabs = document.querySelectorAll('.category');
  categoryTabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.category === category);
  });
  
  // Re-render prompt list
  renderPromptList();
}

// Render prompt list
function renderPromptList() {
  // Clear list
  DOM.promptList.innerHTML = '';

  // Add empty state first, will be overwritten if there's content
  DOM.promptList.appendChild(DOM.emptyState);

  // Filter prompts
  let filteredPrompts = allPrompts;
  
  // Filter by category
  if (activeCategory !== 'all') {
    filteredPrompts = filteredPrompts.filter(prompt => prompt.category === activeCategory);
  }
  
  // Filter by search keyword
  const searchTerm = DOM.searchPrompt.value.trim().toLowerCase();
  if (searchTerm) {
    filteredPrompts = filteredPrompts.filter(prompt => 
      prompt.title.toLowerCase().includes(searchTerm) ||
      prompt.content.toLowerCase().includes(searchTerm)
    );
  }
  
  // Update empty state display
  updateEmptyState(filteredPrompts.length === 0);
  
  // Add filtered prompts
  filteredPrompts.forEach(prompt => {
    const promptElement = createPromptElement(prompt);
    DOM.promptList.appendChild(promptElement);
  });
}

// Update empty state display
function updateEmptyState(isEmpty = false) {
  if (isEmpty || allPrompts.length === 0) {
    DOM.emptyState.classList.remove('hidden');
  } else {
    DOM.emptyState.classList.add('hidden');
  }
}

// Create prompt element
function createPromptElement(prompt) {
  const promptElement = document.createElement('div');
  promptElement.classList.add('prompt-item', 'fade-in');
  promptElement.dataset.id = prompt.id;
  
  const promptInfo = document.createElement('div');
  promptInfo.classList.add('prompt-info');
  
  const titleElement = document.createElement('div');
  titleElement.classList.add('prompt-title');
  titleElement.textContent = prompt.title;
  promptInfo.appendChild(titleElement);
  
  if (prompt.category) {
    const categoryElement = document.createElement('div');
    categoryElement.classList.add('prompt-category');
    categoryElement.textContent = formatCategoryName(prompt.category);
    promptInfo.appendChild(categoryElement);
  }
  
  const contentElement = document.createElement('div');
  contentElement.classList.add('prompt-content');
  
  // Check if content is Markdown
  const isMarkdown = prompt.content.includes('#') || 
                     prompt.content.includes('*') || 
                     prompt.content.includes('```') || 
                     prompt.content.includes('[') ||
                     prompt.content.includes('\n');
  
  // Use simple truncation to prevent overly long content
  const truncatedContent = prompt.content.length > 200 
    ? prompt.content.substring(0, 200) + '...' 
    : prompt.content;
      
  // Apply ellipsis effect in list view
  contentElement.style.whiteSpace = 'nowrap';
  contentElement.style.overflow = 'hidden';
  contentElement.style.textOverflow = 'ellipsis';
      
  // Display content as plain text to preserve original style
  contentElement.textContent = truncatedContent;
  
  // Add a small badge if content is Markdown
  if (isMarkdown) {
    const markdownBadge = document.createElement('span');
    markdownBadge.textContent = 'MD';
    markdownBadge.style.cssText = 'font-size: 10px; background-color: #4285f4; color: white; padding: 1px 4px; border-radius: 3px; margin-left: 6px; vertical-align: middle;';
    contentElement.appendChild(markdownBadge);
  }
  
  promptInfo.appendChild(contentElement);
  
  const actionsElement = document.createElement('div');
  actionsElement.classList.add('prompt-actions');
  
  // Copy button
  const copyButton = document.createElement('button');
  copyButton.classList.add('btn-action', 'copy-prompt');
  copyButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
    </svg>
  `;
  copyButton.title = '复制提示词';
  actionsElement.appendChild(copyButton);
  
  // Use button
  const useButton = document.createElement('button');
  useButton.classList.add('btn-action', 'use-prompt');
  useButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="m22 2-7 20-4-9-9-4Z"/>
      <path d="M22 2 11 13"/>
    </svg>
  `;
  useButton.title = '使用此提示词';
  actionsElement.appendChild(useButton);
  
  // Edit button
  const editButton = document.createElement('button');
  editButton.classList.add('btn-action', 'edit-prompt');
  editButton.innerHTML = `
    <svg class="icon" viewBox="0 0 24 24">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
    </svg>
  `;
  editButton.title = '编辑提示词';
  actionsElement.appendChild(editButton);
  
  // Delete button
  const deleteButton = document.createElement('button');
  deleteButton.classList.add('btn-action', 'delete-prompt');
  deleteButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 6h18"/>
      <path d="M19 6v14c0 1.1-.9 2-2 2H7c-1.1 0-2-.9-2-2V6"/>
      <path d="M8 6V4c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2v2"/>
      <line x1="10" x2="10" y1="11" y2="17"/>
      <line x1="14" x2="14" y1="11" y2="17"/>
    </svg>
  `;
  deleteButton.title = '删除提示词';
  actionsElement.appendChild(deleteButton);
  
  promptElement.appendChild(promptInfo);
  promptElement.appendChild(actionsElement);
  
  // Save prompt content and Markdown status to data attributes for later operations
  promptElement.dataset.isMarkdown = isMarkdown.toString();
  
  return promptElement;
}

// Handle prompt list click events
function handlePromptListClick(e) {
  const promptItem = e.target.closest('.prompt-item');
  if (!promptItem) return;
  
  const promptId = promptItem.dataset.id;
  const prompt = allPrompts.find(p => p.id === promptId);
  if (!prompt) return;
  
  // Copy prompt
  if (e.target.closest('.copy-prompt')) {
    copyToClipboard(prompt.content);
    showNotification('提示词已复制到剪贴板', 'success');
    return;
  }
  
  // Use prompt
  if (e.target.closest('.use-prompt')) {
    usePrompt(prompt);
    return;
  }
  
  // Edit prompt
  if (e.target.closest('.edit-prompt')) {
    editPrompt(prompt);
    return;
  }
  
  // Delete prompt
  if (e.target.closest('.delete-prompt')) {
    if (confirm(`确定要删除"${prompt.title}"吗？`)) {
      deletePrompt(promptId);
    }
    return;
  }
}

// Add prompt
async function addPrompt() {
  try {
    const title = DOM.promptTitle.value.trim();
    let category = DOM.promptCategory.value;
    const content = DOM.promptContent.value.trim();
    
    // Validate input
    if (!title || !content) {
      showNotification('请填写标题和内容', 'error');
      return;
    }
    
    // Handle custom category
    if (category === 'custom') {
      category = DOM.customCategory.value.trim();
      if (!category) {
        showNotification('请输入自定义分类名称', 'error');
        return;
      }
    }
    
    // Check if in edit mode
    const editId = DOM.addPromptBtn.dataset.editId;
    if (editId) {
      // Perform update operation
      const promptIndex = allPrompts.findIndex(p => p.id === editId);
      if (promptIndex === -1) {
        throw new Error('找不到要编辑的提示词');
      }
      
      const updatedPrompt = {
        ...allPrompts[promptIndex],
        title,
        category,
        content,
        updatedAt: new Date().toISOString()
      };
      
      if (currentTab && isSupportedAIPage(currentTab.url)) {
        try {
          // Use content.js updatePrompt function
          await chrome.tabs.sendMessage(currentTab.id, {
            action: 'updatePrompt',
            id: editId,
            prompt: updatedPrompt
          });
        } catch (err) {
          console.warn('通过content.js更新提示词失败，使用本地更新:', err);
          // Fallback to directly updating local array
          allPrompts[promptIndex] = updatedPrompt;
          await savePrompts();
        }
      } else {
        // Directly update local array
        allPrompts[promptIndex] = updatedPrompt;
        await savePrompts();
      }
      
      // Reset form and button
      resetAddForm();
      DOM.addPromptBtn.textContent = '添加提示词';
      delete DOM.addPromptBtn.dataset.editId;
      
      // Show success notification
      showNotification('提示词更新成功', 'success');
    } else {
      // Create new prompt object
      const newPrompt = {
        id: generateId(),
        title,
        category,
        content,
        createdAt: new Date().toISOString()
      };
      
      if (currentTab && isSupportedAIPage(currentTab.url)) {
        try {
          // Use content.js addPrompt function
          await chrome.tabs.sendMessage(currentTab.id, {
            action: 'addPrompt',
            prompt: newPrompt
          });
        } catch (err) {
          console.warn('通过content.js添加提示词失败，使用本地添加:', err);
          // Fallback to directly adding to local array
          allPrompts.push(newPrompt);
          await savePrompts();
        }
      } else {
        // Directly add to local array
        allPrompts.push(newPrompt);
        await savePrompts();
      }
      
      // Show success notification
      showNotification('提示词添加成功', 'success');
    }
    
    // Reset form and switch to list page
    resetAddForm();
    switchTab('prompts');
    
    // Update UI
    renderPromptList();
    updateCategoryTabs();
    
  } catch (error) {
    console.error('添加/更新提示词失败:', error);
    showNotification('添加/更新提示词失败', 'error');
  }
}

// Edit prompt
function editPrompt(prompt) {
  // Switch to add prompt page
  switchTab('add');
  
  // Fill form
  DOM.promptTitle.value = prompt.title;
  
  // Handle category
  const isDefaultCategory = ['general', 'writing', 'coding', 'translation', 'creativity', 'analysis'].includes(prompt.category);
  
  if (isDefaultCategory) {
    DOM.promptCategory.value = prompt.category;
    DOM.customCategoryGroup.classList.add('hidden');
  } else {
    DOM.promptCategory.value = 'custom';
    DOM.customCategory.value = prompt.category;
    DOM.customCategoryGroup.classList.remove('hidden');
  }
  
  // Set prompt content
  DOM.promptContent.value = prompt.content;
  
  // Check if content is Markdown
  const isMarkdown = prompt.content.includes('#') || 
                     prompt.content.includes('*') || 
                     prompt.content.includes('```') || 
                     prompt.content.includes('[') ||
                     prompt.content.includes('\n');
  
  // If Markdown format, show preview below
  if (isMarkdown) {
    // Call Markdown preview update function
    updateMarkdownPreview(prompt.content);
  } else {
    // If not Markdown or cannot parse, remove preview
    const previewContainer = document.getElementById('markdown-preview');
    if (previewContainer) {
      previewContainer.remove();
    }
  }
  
  // Change "Add" button to "Update"
  DOM.addPromptBtn.textContent = '更新提示词';
  
  // Temporarily store the ID of the prompt being edited
  DOM.addPromptBtn.dataset.editId = prompt.id;
}

// Delete prompt
async function deletePrompt(promptId) {
  try {
    if (currentTab && isChatGPTPage(currentTab.url)) {
      try {
        // Use content.js deletePrompt function
        await chrome.tabs.sendMessage(currentTab.id, {
          action: 'deletePrompt',
          id: promptId
        });
        
        // Update local array to keep in sync
        const index = allPrompts.findIndex(p => p.id === promptId);
        if (index !== -1) {
          allPrompts.splice(index, 1);
        }
      } catch (err) {
        console.warn('通过content.js删除提示词失败，使用本地删除:', err);
        // Fallback to directly deleting from local array
        const index = allPrompts.findIndex(p => p.id === promptId);
        if (index !== -1) {
          allPrompts.splice(index, 1);
          await savePrompts();
        }
      }
    } else {
      // Directly delete from local array
      const index = allPrompts.findIndex(p => p.id === promptId);
      if (index !== -1) {
        allPrompts.splice(index, 1);
        await savePrompts();
      }
    }
    
    // Update UI
    renderPromptList();
    updateCategoryTabs();
    showNotification('提示词已删除', 'success');
  } catch (error) {
    console.error('删除提示词失败:', error);
    showNotification('删除提示词失败', 'error');
  }
}

// Use prompt (send to AI page)
async function usePrompt(prompt) {
  try {
    // Re-fetch current tab before each use to ensure latest info
    await initCurrentTab();

    if (!currentTab || !isSupportedAIPage(currentTab.url)) {
      showNotification('请在支持的AI页面使用此功能', 'error');
      return;
    }

    // Try to send message to content.js
    try {
      await chrome.tabs.sendMessage(currentTab.id, {
        action: 'insertPrompt',
        prompt: prompt.content
      });

      // Close popup after success, let user return to AI page
      window.close();
    } catch (sendError) {
      // If connection error, content script may not be loaded yet
      if (sendError.message && sendError.message.includes('Receiving end does not exist')) {
        console.warn('Content script未准备好，尝试重新注入...');

        // Try to refresh page or notify user
        showNotification('页面未准备好，正在尝试重新加载...', 'info');

        // Try to reload tab's content script
        try {
          await chrome.scripting.executeScript({
            target: { tabId: currentTab.id },
            files: ['src/content/js/content.js']
          });

          // Wait for content script to initialize
          await new Promise(resolve => setTimeout(resolve, 500));

          // Try sending message again
          await chrome.tabs.sendMessage(currentTab.id, {
            action: 'insertPrompt',
            prompt: prompt.content
          });

          window.close();
        } catch (retryError) {
          console.error('重试失败:', retryError);
          showNotification('插入失败，请刷新页面后重试', 'error');
        }
      } else {
        throw sendError; // Re-throw other errors
      }
    }
  } catch (error) {
    console.error('使用提示词失败:', error);
    showNotification('使用提示词失败，请刷新页面重试', 'error');
  }
}

// Save prompts to storage
async function savePrompts() {
  try {
    // Send message to content.js to refresh prompts
    if (currentTab && isSupportedAIPage(currentTab.url)) {
      chrome.tabs.sendMessage(currentTab.id, { 
        action: 'refreshPrompts' 
      }).catch(err => {
        console.log('刷新提示词时出错，可能页面未加载完成:', err);
      });
    }
    
    // Save to local storage
    await chrome.storage.local.set({ prompts: allPrompts });
  } catch (error) {
    console.error('保存提示词失败:', error);
    throw error;
  }
}

// Export prompts to JSON file
function exportPrompts() {
  try {
    if (allPrompts.length === 0) {
      showNotification('没有提示词可导出', 'error');
      return;
    }
    
    const dataStr = JSON.stringify(allPrompts, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `ai-prompts-${formatDate(new Date())}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    showNotification('提示词导出成功', 'success');
  } catch (error) {
    console.error('导出提示词失败:', error);
    showNotification('导出提示词失败', 'error');
  }
}

// Import prompts
function importPrompts(event) {
  try {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedPrompts = JSON.parse(e.target.result);
        
        // Validate imported data format
        if (!Array.isArray(importedPrompts)) {
          throw new Error('导入的文件格式不正确');
        }
        
        // Add ID to imported prompts (if missing)
        importedPrompts.forEach(prompt => {
          if (!prompt.id) {
            prompt.id = generateId();
          }
          if (!prompt.createdAt) {
            prompt.createdAt = new Date().toISOString();
          }
        });
        
        // Merge imported prompts with existing prompts
        const mergedPrompts = [...allPrompts];
        
        // Check for duplicates, skip by ID or update by content
        importedPrompts.forEach(importedPrompt => {
          const existingIndex = mergedPrompts.findIndex(p => p.id === importedPrompt.id);
          if (existingIndex !== -1) {
            // Update existing item
            mergedPrompts[existingIndex] = {
              ...importedPrompt,
              updatedAt: new Date().toISOString()
            };
          } else {
            // Add new item
            mergedPrompts.push(importedPrompt);
          }
        });
        
        // Update data and UI
        allPrompts = mergedPrompts;
        await savePrompts();
        renderPromptList();
        updateCategoryTabs();
        
        showNotification(`成功导入 ${importedPrompts.length} 个提示词`, 'success');
        
        // Reset file input
        event.target.value = '';
      } catch (error) {
        console.error('解析导入文件失败:', error);
        showNotification('导入失败: ' + (error.message || '文件格式不正确'), 'error');
      }
    };
    
    reader.readAsText(file);
  } catch (error) {
    console.error('导入提示词失败:', error);
    showNotification('导入提示词失败', 'error');
  }
}

// Load theme settings
function loadTheme() {
  try {
  chrome.storage.local.get('theme', (data) => {
    const theme = data.theme || 'light';
      if (DOM.themeSelect) {
    DOM.themeSelect.value = theme;
      }
    setTheme(theme);
  });
  } catch (error) {
    console.error('Failed to load theme settings:', error);
    // Use default light theme
    setTheme('light');
  }
}

// Set theme
function setTheme(theme) {
  try {
    // Save theme settings
    chrome.storage.local.set({ theme });

    // Remove old theme setting method, use data-theme attribute instead
    // This way all style definitions can be managed in CSS, avoiding hardcoded colors in JS
    document.documentElement.setAttribute('data-theme', theme);

    // If following system, we need to detect current system preference
    if (theme === 'system') {
      const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');

      // Listen for system changes
      if (!window.themeMediaListener) {
        window.themeMediaListener = window.matchMedia('(prefers-color-scheme: dark)');
        window.themeMediaListener.addEventListener('change', (e) => {
          // Only respond when current setting is system
          chrome.storage.local.get('theme', (data) => {
            if (data.theme === 'system') {
              document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
            }
          });
        });
      }
    }
  } catch (error) {
    console.error('Failed to set theme:', error);
  }
}

// Filter prompt list
function filterPrompts() {
  renderPromptList();
}

// Copy text to clipboard
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(err => {
    console.error('Failed to copy to clipboard:', err);
    // Fallback method
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = 0;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  });
}

// Show notification
function showNotification(message, type = 'default') {
  try {
  const notification = DOM.notification;
    if (!notification) {
      console.warn('Notification element does not exist, cannot show notification:', message);
      return;
    }

  notification.textContent = message;
  notification.className = 'notification';
  notification.classList.add(type);
  notification.classList.add('show');

  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
  } catch (error) {
    console.error('Failed to show notification:', error);
  }
}

// Format date as YYYY-MM-DD
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Generate unique ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Update Markdown preview
function updateMarkdownPreview(content) {
  // If content is empty or doesn't look like Markdown, don't show preview
  const isMarkdown = content && (
    content.includes('#') ||
    content.includes('*') ||
    content.includes('```') ||
    content.includes('[') ||
    content.includes('\n')  // Also consider newlines as part of Markdown
  );

  if (!isMarkdown) {
    const existingPreview = document.getElementById('markdown-preview');
    if (existingPreview) {
      existingPreview.remove();
    }
    return;
  }

  try {
    // Create or get preview container
    let previewContainer = document.getElementById('markdown-preview');
    if (!previewContainer) {
      previewContainer = document.createElement('div');
      previewContainer.id = 'markdown-preview';
      previewContainer.className = 'markdown-preview';
      previewContainer.style.cssText = 'margin-top: 12px; padding: 12px; background-color: var(--card-bg); border: 1px solid var(--border-color); border-radius: var(--radius-md); max-height: 200px; overflow-y: auto;';

      // Add title
      const previewTitle = document.createElement('div');
      previewTitle.style.cssText = 'font-weight: 500; margin-bottom: 8px; color: var(--text-secondary); font-size: 13px;';
      previewTitle.textContent = 'Markdown 预览';
      previewContainer.appendChild(previewTitle);

      // Add content container
      const previewContent = document.createElement('div');
      previewContent.className = 'markdown-content';
      previewContent.id = 'markdown-content';
      previewContainer.appendChild(previewContent);

      // Add preview to DOM
      const promptContentParent = DOM.promptContent.parentNode;
      promptContentParent.appendChild(previewContainer);
    }

    // Update preview content
    const previewContent = document.getElementById('markdown-content');

    // Try to use marked library to render Markdown
    if (typeof marked !== 'undefined') {
      try {
        // Set marked configuration to safe options to prevent XSS attacks
        marked.setOptions({
          gfm: true,  // Use GitHub Flavored Markdown
          breaks: true, // Allow newlines to become <br>
          pedantic: false,
          sanitize: true, // Perform security sanitization
          smartLists: true,
          smartypants: false
        });

        // Ensure newlines are handled correctly
        const renderedHtml = marked.parse(content);
        previewContent.innerHTML = renderedHtml;
      } catch (err) {
        console.error('Markdown parsing failed:', err);

        // Use simple HTML replacement to display some basic Markdown syntax
        const htmlContent = content
          .replace(/\n/g, '<br>')  // Replace newlines with <br>
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/```(.*?)```/gs, '<pre><code>$1</code></pre>');

        previewContent.innerHTML = htmlContent;
      }
    } else {
      // If marked is not available, show error message and use simple HTML replacement
      console.warn('Marked library not available, using simple HTML replacement');

      // Use simple HTML replacement to display some basic Markdown syntax
      const htmlContent = content
        .replace(/\n/g, '<br>')  // Replace newlines with <br>
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/```(.*?)```/gs, '<pre><code>$1</code></pre>');

      previewContent.innerHTML = htmlContent;
    }
  } catch (err) {
    console.error('Failed to update Markdown preview:', err);
  }
} 
