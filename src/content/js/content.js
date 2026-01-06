'use strict';

// ===== Development Mode Configuration =====
// Set to false in production to reduce console output and improve performance
const DEBUG_MODE = false;

// Log wrapper - automatically disable non-error logs in production
const log = DEBUG_MODE ? console.log.bind(console, '[AI Prompt]') : () => {};
const warn = DEBUG_MODE ? console.warn.bind(console, '[AI Prompt]') : () => {};
const error = console.error.bind(console, '[AI Prompt]'); // Error logs are always preserved

// ===== Timer Manager =====
// Centralized management of all setTimeout calls to prevent memory leaks
const TimerManager = {
  timers: new Set(),

  set(callback, delay) {
    const id = setTimeout(() => {
      callback();
      this.timers.delete(id);
    }, delay);
    this.timers.add(id);
    return id;
  },

  clear(id) {
    if (id) {
      clearTimeout(id);
      this.timers.delete(id);
    }
  },

  clearAll() {
    this.timers.forEach(id => clearTimeout(id));
    this.timers.clear();
    log('All timers cleared, total:', this.timers.size);
  }
};

// Clean up all timers when page unloads
window.addEventListener('beforeunload', () => {
  TimerManager.clearAll();
});

// Configuration object
const CONFIG = {
  triggerButtonClass: 'ai-prompt-trigger',
  sideMenuClass: 'ai-prompt-side-menu',
  promptItemClass: 'prompt-item',
  animationDuration: 300,
  menuWidth: '320px',
  maxCategoryItems: 10,
  collapsedWidth: '40px'
};

// Preset prompt examples, categorized version
const DEFAULT_PROMPTS = [
  {
    id: 'prompt-summary',
    title: '概括总结',
    category: 'general',
    content: '请帮我总结以下内容的要点：'
  },
  {
    id: 'prompt-code-explain',
    title: '代码解释',
    category: 'coding',
    content: '请解释以下代码的功能和实现原理：'
  },
  {
    id: 'prompt-translate',
    title: '中英互译',
    category: 'translation',
    content: '请将以下内容翻译成{目标语言}，保持原意并使表达自然流畅：'
  },
  {
    id: 'prompt-improve',
    title: '改进建议',
    category: 'writing',
    content: '请对以下内容提出改进建议，使其更加清晰、专业：'
  },
  {
    id: 'prompt-brainstorm',
    title: '头脑风暴',
    category: 'creativity',
    content: '请针对"{主题}"提供10个创新的想法：'
  }
];

// Global variables
let availablePrompts = [];

// Check if marked library is loaded
let markedLoaded = false;

// Dynamically load Marked.js library
function loadMarkedJS() {
  if (markedLoaded) {
    return Promise.resolve();
  }
  
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('src/lib/marked.min.js');
    script.onload = () => {
      console.log('Marked.js library loaded successfully');
      markedLoaded = true;
      resolve();
    };
    script.onerror = (err) => {
      console.error('Failed to load Marked.js library:', err);
      reject(err);
    };
    document.head.appendChild(script);
  });
}

// DOM element references
let triggerButton = null;
let sideMenu = null;
let isMenuOpen = false;
let isButtonCollapsed = true; // Button is collapsed by default
let autoCollapseTimer = null; // Auto-collapse timer
let isUserInteracting = false; // Whether user is interacting

// Initialization info
log('AI Prompt Manager loaded');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[AI Prompt] Message received:', request.action);

  try {
    if (request.action === 'testInject') {
      console.log('Received test inject message');
      injectTriggerButton();
      sendResponse({success: true, message: 'Test injection successful'});
      return true;
    }

    if (request.action === 'insertPrompt') {
      console.log('Received insert prompt message:', request.prompt);
      insertPromptText(request.prompt)
        .then(() => {
          console.log('Prompt inserted successfully');
          sendResponse({success: true, message: 'Prompt inserted successfully'});
        })
        .catch(err => {
          console.error('Failed to insert prompt:', err);
          sendResponse({success: false, error: err.message || 'Unknown error'});
        });
      return true;
    }

    if (request.action === 'refreshPrompts') {
      console.log('Received refresh prompts message');
      loadPrompts()
        .then(() => {
          if (sideMenu) {
            console.log('Re-rendering side menu');
            renderSideMenu();
          }
          sendResponse({success: true, message: 'Prompts refreshed successfully'});
        })
        .catch(err => {
          console.error('Failed to refresh prompts:', err);
          sendResponse({success: false, error: err.message || 'Unknown error'});
        });
      return true;
    }

    if (request.action === 'addPrompt') {
      console.log('Received add prompt message:', request.prompt);
      addPrompt(request.prompt)
        .then(() => {
          sendResponse({success: true, message: 'Prompt added successfully'});
        })
        .catch(err => {
          console.error('Failed to add prompt:', err);
          sendResponse({success: false, error: err.message || 'Unknown error'});
        });
      return true;
    }

    if (request.action === 'updatePrompt') {
      console.log('Received update prompt message:', request.id, request.prompt);
      updatePrompt(request.id, request.prompt)
        .then(() => {
          sendResponse({success: true, message: 'Prompt updated successfully'});
        })
        .catch(err => {
          console.error('Failed to update prompt:', err);
          sendResponse({success: false, error: err.message || 'Unknown error'});
        });
      return true;
    }

    if (request.action === 'deletePrompt') {
      console.log('Received delete prompt message:', request.id);
      deletePrompt(request.id)
        .then(() => {
          sendResponse({success: true, message: 'Prompt deleted successfully'});
        })
        .catch(err => {
          console.error('Failed to delete prompt:', err);
          sendResponse({success: false, error: err.message || 'Unknown error'});
        });
      return true;
    }

    if (request.action === 'getPrompts') {
      console.log('Received get prompts list message');
      sendResponse({success: true, prompts: availablePrompts});
      return true;
    }

    // Unknown message
    console.warn('Received unknown message type:', request.action);
    sendResponse({success: false, error: 'Unknown message type'});
    return true;
  } catch (error) {
    console.error('Error processing message:', error);
    sendResponse({success: false, error: error.message || 'Error processing message'});
    return true;
  }
});

// Load prompts
async function loadPrompts() {
  try {
    console.log('Starting to load prompts...');

    return new Promise((resolve, reject) => {
      // Load prompts from sync storage (persists after reinstall)
      chrome.storage.sync.get('prompts', (result) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to load prompts from storage:', chrome.runtime.lastError);
          // Use default prompts on failure
          availablePrompts = DEFAULT_PROMPTS;
          resolve(availablePrompts);
          return;
        }

        // If there are saved prompts, use them
        if (result.prompts && Array.isArray(result.prompts) && result.prompts.length > 0) {
          availablePrompts = result.prompts;
          console.log(`Loaded ${availablePrompts.length} prompts from sync storage`);
        } else {
          // Otherwise use default prompts
          availablePrompts = DEFAULT_PROMPTS;
          // Save default prompts to sync storage
          savePromptsToStorage(DEFAULT_PROMPTS)
            .then(() => console.log('Default prompts saved to sync storage'))
            .catch(err => console.error('Failed to save default prompts:', err));
          console.log('Using default prompts');
        }
        resolve(availablePrompts);
      });
    });
  } catch (error) {
    console.error('Failed to load prompts:', error);
    // Use default prompts on error
    availablePrompts = DEFAULT_PROMPTS;
    return Promise.resolve(availablePrompts);
  }
}

// Save prompts to storage
function savePromptsToStorage(prompts) {
  return new Promise((resolve, reject) => {
    try {
      // Check if extension context is still valid
      if (!chrome.runtime?.id) {
        console.warn('Extension context invalidated, skipping save');
        resolve();
        return;
      }

      console.log('[AI Prompt] Saving', prompts.length, 'prompts to sync storage...');

      chrome.storage.sync.set({ prompts: prompts }, () => {
        if (chrome.runtime.lastError) {
          console.error('Failed to save prompts to storage:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }
        console.log(`[AI Prompt] Saved ${prompts.length} prompts to sync storage successfully`);

        // Verify the save by reading back
        chrome.storage.sync.get('prompts', (result) => {
          console.log('[AI Prompt] Verification - prompts in sync:', result.prompts?.length || 0);
        });

        resolve();
      });
    } catch (error) {
      // Silently handle extension context errors
      if (error.message?.includes('Extension context invalidated')) {
        resolve();
      } else {
        console.error('Error occurred while saving prompts:', error);
        reject(error);
      }
    }
  });
}

// Inject trigger button
function injectTriggerButton() {
  try {
    // If button already exists, ensure it's visible
    if (triggerButton) {
      triggerButton.style.display = 'flex';
      return triggerButton;
    }

    // Check if document.body exists
    if (!document.body) {
      console.warn('document.body not ready, delaying injection');
      return null;
    }

    console.log('Starting to inject prompt trigger button');

    // Create trigger button
    triggerButton = document.createElement('div');
    triggerButton.className = CONFIG.triggerButtonClass;

  // Add expand/collapse icon and text
  triggerButton.innerHTML = `
    <div class="trigger-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
        <line x1="15" x2="15" y1="3" y2="21"/>
        <path d="M3 9h18"/>
      </svg>
    </div>
    <div class="trigger-text">提示词库</div>
  `;

  // Add external stylesheet instead of inline styles
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('src/content/css/content.css');
  document.head.appendChild(link);

  document.body.appendChild(triggerButton);

  // Set initial state to collapsed
  collapseButton();

  // When mouse hovers over button, expand immediately
  triggerButton.addEventListener('mouseenter', () => {
    isUserInteracting = true;
    clearAutoCollapseTimer(); // Clear any pending collapse immediately
    expandButton();
  });

  triggerButton.addEventListener('mouseleave', () => {
    isUserInteracting = false;
    // If menu is not open, collapse quickly (300ms debounce)
    if (!isMenuOpen) {
      setAutoCollapseTimer(300); // Collapse after 300ms for smoother experience
    }
  });

  // Add click event
  triggerButton.addEventListener('click', handleTriggerClick);

  // Make button draggable
  makeDraggableSmooth(triggerButton);

  // Add global click listener
  document.addEventListener('click', handleGlobalClick, { passive: true });

  console.log('Prompt trigger button injected successfully');
  return triggerButton;
  } catch (err) {
    console.warn('Failed to inject trigger button:', err.message);
    return null;
  }
}

// Handle trigger button click
function handleTriggerClick(event) {
  // Prevent event bubbling
  event.stopPropagation();

  // Toggle side menu visibility
  toggleSideMenu();
}

// Make element smoothly draggable
function makeDraggableSmooth(element) {
  let isDragging = false;
  let startPosY = 0;
  let startMouseY = 0;
  let lastMouseY = 0;
  let lastTimestamp = 0;
  let currentPosY = 50; // Default position
  let velocity = 0;
  let animationFrameId = null;
  let translateY = 0;

  // Initialize hardware acceleration
  element.style.willChange = 'transform';
  element.style.transform = 'translate3d(0, 0, 0)';

  // Start dragging
  const startDrag = (e) => {
    // Only start dragging when clicking on element, not on menu
    if (isDragging || isMenuOpen) return;

    // Cancel any ongoing animation
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    isDragging = true;
    startMouseY = e.clientY;
    lastMouseY = startMouseY;
    lastTimestamp = performance.now();
    startPosY = currentPosY;

    // Add dragging style
    element.classList.add('dragging');

    // Prevent text selection, improve drag experience
    e.preventDefault();

    // Use passive: false to ensure preventDefault works
    document.addEventListener('mousemove', onDrag, { passive: false });
    document.addEventListener('mouseup', stopDrag);

    // Notify click event that dragging has started
    e.stopPropagation();
  };

  // During drag - optimize rendering with RAF
  let lastDragEvent = null;

  const onDrag = (e) => {
    if (!isDragging) return;

    // Save latest event and request animation frame
    lastDragEvent = e;

    // Prevent browser default behavior
    e.preventDefault();
    e.stopPropagation();

    // If no active animation frame, request one
    if (!animationFrameId) {
      animationFrameId = requestAnimationFrame(updateDragPosition);
    }
  };

  // Update position in animation frame
  const updateDragPosition = () => {
    // Reset animationFrameId
    animationFrameId = null;

    if (!lastDragEvent || !isDragging) return;

    const e = lastDragEvent;

    // Calculate movement distance
    const deltaY = e.clientY - startMouseY;

    // Calculate velocity (use performance.now for more precise timing)
    const now = performance.now();
    const timeDelta = now - lastTimestamp;

    if (timeDelta > 0) {
      velocity = (e.clientY - lastMouseY) / timeDelta * 16.67; // Normalize to 60fps velocity
    }

    lastMouseY = e.clientY;
    lastTimestamp = now;

    // Update current position
    currentPosY = startPosY + deltaY;

    // Ensure button doesn't move off screen
    const maxY = window.innerHeight - element.offsetHeight;
    currentPosY = Math.max(20, Math.min(currentPosY, maxY - 20));

    // Set new position
    updateElementPosition();

    // If still dragging, request next frame
    if (isDragging && lastDragEvent) {
      animationFrameId = requestAnimationFrame(updateDragPosition);
    }
  };

  // Stop dragging, add inertia effect
  const stopDrag = () => {
    if (!isDragging) return;

    isDragging = false;
    lastDragEvent = null;

    // Remove dragging style
    element.classList.remove('dragging');

    // Remove event listeners
    document.removeEventListener('mousemove', onDrag, { passive: false });
    document.removeEventListener('mouseup', stopDrag);

    // Add inertia effect
    if (Math.abs(velocity) > 0.1) {
      // Ensure previous animation frame request is cancelled
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      animationFrameId = requestAnimationFrame(applyInertia);
    }
  };

  // Apply inertia sliding effect
  const applyInertia = () => {
    // Friction coefficient - lower for smoother feel
    const friction = 0.92;

    // Ignore tiny velocity
    if (Math.abs(velocity) < 0.5) {
      velocity = 0;
      // End animation loop
      animationFrameId = null;
      return;
    }

    // Update position
    currentPosY += velocity;

    // Boundary check
    const maxY = window.innerHeight - element.offsetHeight;
    if (currentPosY < 20) {
      currentPosY = 20;
      velocity = -velocity * 0.3; // Slight bounce effect
    } else if (currentPosY > maxY - 20) {
      currentPosY = maxY - 20;
      velocity = -velocity * 0.3; // Slight bounce effect
    }

    // Update position
    updateElementPosition();

    // Reduce velocity
    velocity *= friction;

    // Continue animation
    animationFrameId = requestAnimationFrame(applyInertia);
  };

  // Update element position - use transform instead of top
  const updateElementPosition = () => {
    // Use transform instead of modifying top property
    translateY = currentPosY - window.innerHeight / 2;
    element.style.transform = `translate3d(0, ${translateY}px, 0)`;
    element.style.top = '50%';
  };

  // Add mousedown event
  element.addEventListener('mousedown', startDrag, { passive: false });

  // Handle window resize event
  const handleResize = debounce(() => {
    const maxY = window.innerHeight - element.offsetHeight;
    currentPosY = Math.max(20, Math.min(currentPosY, maxY - 20));
    updateElementPosition();
  }, 100);

  window.addEventListener('resize', handleResize, { passive: true });

  // Set initial position
  currentPosY = window.innerHeight / 2;
  updateElementPosition();

  // Return cleanup function
  return () => {
    element.removeEventListener('mousedown', startDrag);
    window.removeEventListener('resize', handleResize);
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
  };
}

// Toggle side menu show/hide
function toggleSideMenu(event) {
  // Prevent event bubbling to avoid immediately triggering handleOutsideClick
  if (event) {
    event.stopPropagation();
  }

  if (isMenuOpen) {
    closeSideMenu();
  } else {
    openSideMenu();
  }
}

// Open side menu
function openSideMenu() {
  console.log('Starting to open side menu...');

  // Set user interaction state
  isUserInteracting = true;

  // Clear auto-collapse timer
  clearAutoCollapseTimer();

  // Ensure button is expanded
  if (isButtonCollapsed) {
    expandButton();
  }

  if (sideMenu) {
    sideMenu.classList.add('open');
    isMenuOpen = true;
    console.log('Side menu reopened');
    return;
  }

  // Create side menu
  sideMenu = document.createElement('div');
  sideMenu.className = CONFIG.sideMenuClass;

  // Render menu content
  renderSideMenu();

  // Add to document
  document.body.appendChild(sideMenu);

  // Delay adding open class to trigger animation
  setTimeout(() => {
    sideMenu.classList.add('open');
  }, 10);

  isMenuOpen = true;

  // Delay adding outside click close event to prevent open button click from bubbling and triggering close
  setTimeout(() => {
    document.addEventListener('click', handleOutsideClick);
  }, 100);

  console.log('Side menu opened');
}

// Render side menu content
async function renderSideMenu() {
  if (!sideMenu) {
    console.warn('Failed to render side menu: side menu does not exist');
    return;
  }

  // Get last expanded category
  const lastExpandedCategory = await getLastExpandedCategory();

  // Clear current content
  sideMenu.innerHTML = '';

  // Menu header
  const header = document.createElement('div');
  header.className = 'menu-header';
  header.innerHTML = `
    <h2 class="menu-title">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="m16 6 4 14"/>
        <path d="M12 6v14"/>
        <path d="M8 8v12"/>
        <path d="M4 4v16"/>
      </svg>
      提示词管理
    </h2>
    <button class="close-menu" aria-label="关闭菜单">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 6 6 18"/>
        <path d="m6 6 12 12"/>
      </svg>
    </button>
  `;
  sideMenu.appendChild(header);

  // Search box
  const searchContainer = document.createElement('div');
  searchContainer.className = 'search-container';
  searchContainer.innerHTML = `
    <input type="search" class="search-input" placeholder="搜索提示词..." aria-label="搜索提示词" autocomplete="off">
  `;
  sideMenu.appendChild(searchContainer);

  // Category tags
  const categoriesContainer = document.createElement('div');
  categoriesContainer.className = 'categories-container';

  // Add "All" category tag
  const allCategoriesTag = document.createElement('div');
  allCategoriesTag.className = 'category-tag active';
  allCategoriesTag.textContent = '全部';
  allCategoriesTag.dataset.category = 'all';
  categoriesContainer.appendChild(allCategoriesTag);

  // Get all unique categories
  const categories = getUniqueCategories();

  // Create tag for each category
  categories.forEach(category => {
    const categoryTag = document.createElement('div');
    categoryTag.className = 'category-tag';
    categoryTag.textContent = formatCategoryName(category);
    categoryTag.dataset.category = category;
    categoriesContainer.appendChild(categoryTag);
  });

  // Add global fold button
  const foldButton = document.createElement('button');
  foldButton.className = 'global-fold-button';
  foldButton.textContent = '全部折叠';
  foldButton.dataset.action = 'fold';
  foldButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" class="mr-1">
      <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"></path>
    </svg>
    全部折叠
  `;
  categoriesContainer.appendChild(foldButton);

  sideMenu.appendChild(categoriesContainer);

  // Prompts container
  const promptsContainer = document.createElement('div');
  promptsContainer.className = 'prompts-container';
  sideMenu.appendChild(promptsContainer);

  // Render prompts (pass in last expanded category)
  renderPromptsByCategory(lastExpandedCategory);

  // Add event listeners
  const searchInput = sideMenu.querySelector('.search-input');
  if (searchInput) {
    searchInput.addEventListener('input', handleSearch);
  }

  // Add click events for category tags
  const categoryTags = sideMenu.querySelectorAll('.category-tag');
  categoryTags.forEach(tag => {
    tag.addEventListener('click', function(e) {
      // Add Ripple effect
      createRipple(e);

      // Remove previous active state
      categoryTags.forEach(t => t.classList.remove('active'));
      // Add current active state
      this.classList.add('active');
      // Filter prompts
      filterPromptsByCategory(this.dataset.category);
    });
  });

  // Initialize folding functionality
  initializeCategoryFolding();

  // Add event listener for close button
  const closeButton = sideMenu.querySelector('.close-menu');
  if (closeButton) {
    closeButton.addEventListener('click', closeSideMenu);
  }

  // Add events for prompt items
  attachPromptItemEvents();
}

// Get last expanded category
async function getLastExpandedCategory() {
  return new Promise((resolve) => {
    try {
      // Check if extension context is still valid
      if (!chrome.runtime?.id) {
        console.warn('Extension context invalidated, skipping storage access');
        resolve(null);
        return;
      }

      chrome.storage.sync.get('lastExpandedCategory', (result) => {
        if (chrome.runtime.lastError) {
          console.warn('Failed to get last expanded category:', chrome.runtime.lastError);
          resolve(null);
          return;
        }
        resolve(result.lastExpandedCategory || null);
      });
    } catch (err) {
      // Silently handle extension context errors
      if (!err.message?.includes('Extension context invalidated')) {
        console.warn('Error getting last expanded category:', err);
      }
      resolve(null);
    }
  });
}

// Save expanded category
function saveExpandedCategory(category) {
  try {
    // Check if extension context is still valid
    if (!chrome.runtime?.id) {
      return;
    }

    chrome.storage.sync.set({ lastExpandedCategory: category }, () => {
      if (chrome.runtime.lastError) {
        console.warn('Failed to save expanded category:', chrome.runtime.lastError);
      }
    });
  } catch (err) {
    // Silently handle extension context errors
    if (!err.message?.includes('Extension context invalidated')) {
      console.warn('Error saving expanded category:', err);
    }
  }
}

// Expand single category (without affecting other categories)
function expandSingleCategory(group) {
  const header = group.querySelector('.accordion-header');
  const panel = group.querySelector('.accordion-panel');
  const toggle = group.querySelector('.category-toggle');
  
  if (!header || !panel || !toggle) {
    return;
  }
  
  const prompts = panel.querySelectorAll('.prompt-item');
  const targetHeight = prompts.length * 140;
  
  group.classList.add('expanded');
  header.classList.add('active');
  header.setAttribute('aria-expanded', 'true');
  toggle.classList.add('expanded');
  panel.classList.add('expanded');
  panel.style.maxHeight = targetHeight + 'px';
}

// Collapse single category (without affecting other categories)
function collapseSingleCategory(group) {
  const header = group.querySelector('.accordion-header');
  const panel = group.querySelector('.accordion-panel');
  const toggle = group.querySelector('.category-toggle');
  
  if (!header || !panel || !toggle) {
    return;
  }
  
  group.classList.remove('expanded');
  header.classList.remove('active');
  header.setAttribute('aria-expanded', 'false');
  toggle.classList.remove('expanded');
  panel.classList.remove('expanded');
  panel.style.maxHeight = '0px';
}

// Expand specified category (by category name)
function expandCategory(categoryToExpand, animate = true) {
  if (!sideMenu) {
    return;
  }
  
  const group = sideMenu.querySelector(`.category-group.accordion-item[data-category="${categoryToExpand}"]`);
  if (!group) {
    return;
  }
  
  const header = group.querySelector('.accordion-header');
  const panel = group.querySelector('.accordion-panel');
  const toggle = group.querySelector('.category-toggle');
  
  if (!header || !panel || !toggle) {
    return;
  }
  
  const prompts = panel.querySelectorAll('.prompt-item');
  const targetHeight = prompts.length * 140;
  
  group.classList.add('expanded');
  header.classList.add('active');
  header.setAttribute('aria-expanded', 'true');
  toggle.classList.add('expanded');
  panel.classList.add('expanded');
  
  if (animate) {
    panel.style.maxHeight = targetHeight + 'px';
  } else {
    panel.style.transition = 'none';
    panel.style.maxHeight = targetHeight + 'px';
    // Force reflow then restore transition
    panel.offsetHeight; // eslint-disable-line no-unused-expressions
    panel.style.transition = '';
  }

  // Save expanded state
  saveExpandedCategory(categoryToExpand);
}

// Collapse all categories
function collapseAllCategories() {
  if (!sideMenu) {
    return;
  }
  
  const allGroups = sideMenu.querySelectorAll('.category-group.accordion-item');
  
  allGroups.forEach(group => {
    const header = group.querySelector('.accordion-header');
    const panel = group.querySelector('.accordion-panel');
    const toggle = group.querySelector('.category-toggle');
    
    if (!header || !panel || !toggle) {
      return;
    }
    
    group.classList.remove('expanded');
    header.classList.remove('active');
    header.setAttribute('aria-expanded', 'false');
    toggle.classList.remove('expanded');
    panel.classList.remove('expanded');
    panel.style.maxHeight = '0px';
  });

  // Clear saved expanded state
  saveExpandedCategory(null);
}

// Expand all categories (for expand all button)
function expandAllCategories() {
  if (!sideMenu) {
    return;
  }
  
  const allGroups = sideMenu.querySelectorAll('.category-group.accordion-item');
  
  allGroups.forEach(group => {
    const header = group.querySelector('.accordion-header');
    const panel = group.querySelector('.accordion-panel');
    const toggle = group.querySelector('.category-toggle');
    
    if (!header || !panel || !toggle) {
      return;
    }
    
    const prompts = panel.querySelectorAll('.prompt-item');
    const targetHeight = prompts.length * 140;
    
    group.classList.add('expanded');
    header.classList.add('active');
    header.setAttribute('aria-expanded', 'true');
    toggle.classList.add('expanded');
    panel.classList.add('expanded');
    panel.style.maxHeight = targetHeight + 'px';
  });
}

// Initialize category folding functionality (Accordion mode)
function initializeCategoryFolding() {
  try {
    // Set up global fold button
    const globalFoldButton = sideMenu.querySelector('.global-fold-button');
    if (globalFoldButton) {
      globalFoldButton.addEventListener('click', () => {
        const action = globalFoldButton.dataset.action;

        if (action === 'fold') {
          // Fold all
          collapseAllCategories();

          globalFoldButton.dataset.action = 'expand';
          globalFoldButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" class="mr-1">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7"></path>
            </svg>
            全部展开
          `;
        } else {
          // Expand all categories
          expandAllCategories();

          globalFoldButton.dataset.action = 'fold';
          globalFoldButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" class="mr-1">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"></path>
            </svg>
            全部折叠
          `;
        }
      });
    }

    // Add expand/collapse interaction for each category header (allows multiple to be expanded simultaneously)
    const categoryHeaders = sideMenu.querySelectorAll('.accordion-header');
    categoryHeaders.forEach(header => {
      // Click event
      header.addEventListener('click', (e) => {
        e.preventDefault();
        const group = header.closest('.category-group');
        const category = group.dataset.category;
        const isCurrentlyExpanded = header.getAttribute('aria-expanded') === 'true';

        if (isCurrentlyExpanded) {
          // Collapse current category
          collapseSingleCategory(group);
        } else {
          // Expand current category (without affecting others)
          expandSingleCategory(group);
          // Save last expanded category
          saveExpandedCategory(category);
        }
      });

      // Keyboard event (accessibility)
      header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          header.click();
        }
      });
    });
  } catch (error) {
    console.error('Failed to initialize category folding functionality:', error);
  }
}

// Get all unique categories
function getUniqueCategories() {
  const categories = new Set();
  availablePrompts.forEach(prompt => {
    if (prompt.category) {
      categories.add(prompt.category);
    }
  });
  return Array.from(categories);
}

// Render prompts by category (Accordion style)
function renderPromptsByCategory(expandedCategory = null) {
  const promptsContainer = sideMenu.querySelector('.prompts-container');
  if (!promptsContainer) {
    return;
  }

  // Clear container
  promptsContainer.innerHTML = '';

  // If no prompts, show empty state
  if (!availablePrompts || availablePrompts.length === 0) {
    promptsContainer.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="8" y1="12" x2="16" y2="12"></line>
        </svg>
        <div>暂无提示词</div>
        <div>请先在插件中添加提示词</div>
      </div>
    `;
    return;
  }

  // Group by category
  const promptsByCategory = {};
  for (const prompt of availablePrompts) {
    const category = prompt.category || 'uncategorized';
    if (!promptsByCategory[category]) {
      promptsByCategory[category] = [];
    }
    promptsByCategory[category].push(prompt);
  }

  const categoryKeys = Object.keys(promptsByCategory);

  // Render each category as Accordion Item in order
  categoryKeys.forEach((category, index) => {
    const prompts = promptsByCategory[category];
    const formattedCategory = formatCategoryName(category);
    const isExpanded = expandedCategory === category;
    const accordionId = `accordion-panel-${category}`;
    const headerId = `accordion-header-${category}`;

    // Create Accordion Item for each category
    const categoryGroup = document.createElement('div');
    categoryGroup.className = `category-group accordion-item${isExpanded ? ' expanded' : ''}`;
    categoryGroup.dataset.category = category;

    // Add category header and fold icon (with aria attributes)
    categoryGroup.innerHTML = `
      <button class="category-header accordion-header${isExpanded ? ' active' : ''}"
              id="${headerId}"
              aria-expanded="${isExpanded}"
              aria-controls="${accordionId}"
              tabindex="0"
              role="button">
        <div class="accordion-header-content">
          <span class="category-name">${formattedCategory}</span>
          <span class="category-badge">${prompts.length}</span>
        </div>
        <div class="category-toggle${isExpanded ? ' expanded' : ''}">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </div>
      </button>
      <div class="category-items accordion-panel${isExpanded ? ' expanded' : ''}"
           id="${accordionId}"
           role="region"
           aria-labelledby="${headerId}"
           style="max-height: ${isExpanded ? prompts.length * 140 + 'px' : '0px'};">
        <div class="accordion-panel-inner">
          ${prompts.map(prompt => createPromptItemHTML(prompt)).join('')}
        </div>
      </div>
    `;

    promptsContainer.appendChild(categoryGroup);
  });

  return promptsContainer.innerHTML;
}

// Collapse button (optimized version)
function collapseButton() {
  if (!triggerButton) return;

  // Remove menu open restriction, allow more flexible collapse
  triggerButton.classList.add('collapsed');
  isButtonCollapsed = true;
  console.log('Button collapsed');
}

// Expand button (optimized version)
function expandButton() {
  if (!triggerButton) return;

  triggerButton.classList.remove('collapsed');
  isButtonCollapsed = false;

  // Clear auto-collapse timer
  clearAutoCollapseTimer();

  // No longer set auto timer, completely controlled by mouse events for smoother experience

  console.log('Button expanded');
}

// Set auto-collapse timer
function setAutoCollapseTimer(delay = 2000) {
  clearAutoCollapseTimer();

  autoCollapseTimer = setTimeout(() => {
    // Only auto-collapse when user is not interacting and menu is not open
    if (!isUserInteracting && !isMenuOpen && !isButtonCollapsed) {
      collapseButton();
      console.log('Button auto-collapsed');
    }
  }, delay);
}

// Clear auto-collapse timer
function clearAutoCollapseTimer() {
  if (autoCollapseTimer) {
    clearTimeout(autoCollapseTimer);
    autoCollapseTimer = null;
  }
}

// Smart collapse button (called after completing operations)
function smartCollapseButton(immediate = false) {
  if (immediate) {
    // Collapse immediately
    collapseButton();
  } else {
    // Delayed collapse, give user some reaction time
    setTimeout(() => {
      if (!isMenuOpen && !isUserInteracting) {
        collapseButton();
      }
    }, 500);
  }
}

// Handle global click event (optimized version)
function handleGlobalClick(event) {
  // Check if click is outside button or menu
  const isClickOnButton = triggerButton && (event.target === triggerButton || triggerButton.contains(event.target));
  const isClickOnMenu = sideMenu && sideMenu.contains(event.target);

  if (!isClickOnButton && !isClickOnMenu) {
    // Click is outside, close menu and collapse button
    if (isMenuOpen) {
      closeSideMenu();
    }

    // Delayed button collapse to avoid flicker
    setTimeout(() => {
      if (!isMenuOpen) {
        collapseButton();
      }
    }, 100);
  }
}

// Create prompt item HTML
function createPromptItemHTML(prompt) {
  const id = prompt.id;
  const title = escapeHtml(prompt.title);
  const content = escapeHtml(prompt.content);
  // Truncate content to fit UI
  const truncatedContent = content.length > 150 ? content.substring(0, 150) + '...' : content;

  // Check if Markdown rendering is needed
  const isMarkdown = content.includes('#') || content.includes('*') || content.includes('```') || content.includes('[');

  return `
    <div class="prompt-item" data-id="${id}" data-is-markdown="${isMarkdown}">
      <div class="prompt-title">${title}</div>
      <div class="prompt-content">${truncatedContent}</div>
      <div class="prompt-actions">
        <button class="action-button edit" title="编辑/插入">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
            <path d="m15 5 4 4"/>
          </svg>
          编辑
        </button>
        <button class="action-button send" title="发送">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m22 2-7 20-4-9-9-4Z"/>
            <path d="M22 2 11 13"/>
          </svg>
          发送
        </button>
      </div>
    </div>
  `;
}

// HTML escape function to prevent XSS attacks
function escapeHtml(html) {
  return html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Handle search in prompt menu
function handleSearch(event) {
  if (!sideMenu) {
    console.warn('Search operation failed: side menu does not exist');
    return;
  }

  try {
    const query = event.target.value.trim().toLowerCase();

    if (!query) {
      // If search box is empty, restore default display
      const allCategoryTag = sideMenu.querySelector('.category-tag[data-category="all"]');
      if (allCategoryTag) {
        allCategoryTag.click();
      }
      return;
    }

    // Search in all prompts
    const filteredPrompts = availablePrompts.filter(prompt =>
      prompt.title.toLowerCase().includes(query) ||
      prompt.content.toLowerCase().includes(query)
    );

    const promptsContainer = sideMenu.querySelector('.prompts-container');
    if (!promptsContainer) {
      console.warn('Cannot find prompts container element');
      return;
    }

    if (filteredPrompts.length === 0) {
      promptsContainer.innerHTML = `
        <div class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.3-4.3"></path>
          </svg>
          <p>没有找到匹配的提示词</p>
          <div>尝试其他关键词</div>
        </div>
      `;
      return;
    }

    // Display search results (as an expanded Accordion item)
    promptsContainer.innerHTML = `
      <div class="category-group accordion-item search-results expanded" data-category="search">
        <div class="category-header accordion-header active search-header"
             aria-expanded="true"
             role="button">
          <div class="accordion-header-content">
            <span class="category-name">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; vertical-align: -2px;">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.3-4.3"></path>
              </svg>
              搜索结果
            </span>
            <span class="category-badge">${filteredPrompts.length}</span>
          </div>
        </div>
        <div class="category-items accordion-panel expanded"
             role="region"
             style="max-height: ${filteredPrompts.length * 140}px;">
          <div class="accordion-panel-inner">
            ${filteredPrompts.map(prompt => createPromptItemHTML(prompt)).join('')}
          </div>
        </div>
      </div>
    `;

    // Rebind events
    attachPromptItemEvents();
  } catch (error) {
    console.error('Search processing failed:', error);
  }
}

// Filter prompts by category
async function filterPromptsByCategory(category) {
  if (!sideMenu) {
    console.warn('Filter category failed: side menu does not exist');
    return;
  }

  try {
    const promptsContainer = sideMenu.querySelector('.prompts-container');
    if (!promptsContainer) {
      console.warn('Cannot find prompts container element');
      return;
    }

    if (category === 'all') {
      // Animated transition: all categories (restore Accordion mode)
      const lastExpandedCategory = await getLastExpandedCategory();

      animateListTransition(promptsContainer, () => {
        renderPromptsByCategory(lastExpandedCategory);
        // Rebind events
        initializeCategoryFolding();
        attachPromptItemEvents();
      });
    } else {
      // Animated transition: filter specified category (single category expanded display)
      const filteredPrompts = availablePrompts.filter(prompt => prompt.category === category);

      animateListTransition(promptsContainer, () => {
        if (filteredPrompts.length === 0) {
          promptsContainer.innerHTML = `
            <div class="empty-state">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
              <p>该分类下没有提示词</p>
            </div>
          `;
          return;
        }

        const formattedCategory = formatCategoryName(category);
        const accordionId = `accordion-panel-${category}`;
        const headerId = `accordion-header-${category}`;

        // Single category view: always expanded
        promptsContainer.innerHTML = `
          <div class="category-group accordion-item expanded" data-category="${category}">
            <button class="category-header accordion-header active"
                    id="${headerId}"
                    aria-expanded="true"
                    aria-controls="${accordionId}"
                    tabindex="0"
                    role="button">
              <div class="accordion-header-content">
                <span class="category-name">${formattedCategory}</span>
                <span class="category-badge">${filteredPrompts.length}</span>
              </div>
              <div class="category-toggle expanded">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </div>
            </button>
            <div class="category-items accordion-panel expanded"
                 id="${accordionId}"
                 role="region"
                 aria-labelledby="${headerId}"
                 style="max-height: ${filteredPrompts.length * 140}px;">
              <div class="accordion-panel-inner">
                ${filteredPrompts.map(prompt => createPromptItemHTML(prompt)).join('')}
              </div>
            </div>
          </div>
        `;

        // Rebind events
        attachPromptItemEvents();
        // Single category mode doesn't need Accordion interaction
      });
    }
  } catch (error) {
    console.error('Category filter failed:', error);
  }
}

// List transition animation
function animateListTransition(container, updateContentFn) {
  // 1. Fade out
  container.classList.add('fading-out');

  // 2. Wait for animation to end
  setTimeout(() => {
    // Update content
    updateContentFn();

    // Remove fade out, add fade in
    container.classList.remove('fading-out');
    container.classList.add('fading-in');

    // 3. Clean up fade in class
    setTimeout(() => {
      container.classList.remove('fading-in');
    }, 300);
  }, 200);
}

// Bind prompt item events
function attachPromptItemEvents() {
  if (!sideMenu) {
    console.warn('Failed to bind prompt events: side menu does not exist');
    return;
  }

  try {
    // First remove all existing event listeners
    const oldItems = sideMenu.querySelectorAll(`.${CONFIG.promptItemClass}`);
    if (oldItems && oldItems.length > 0) {
      oldItems.forEach(item => {
        if (item && item.parentNode) {
          const newItem = item.cloneNode(true);
          item.parentNode.replaceChild(newItem, item);
        }
      });
    }

    // Rebind new events
    const promptItems = sideMenu.querySelectorAll(`.${CONFIG.promptItemClass}`);
    if (!promptItems || promptItems.length === 0) {
      return; // No prompt items found
    }

    promptItems.forEach(item => {
      if (!item || !item.dataset || !item.dataset.id) return;

      const id = item.dataset.id;
      const prompt = availablePrompts.find(p => p.id === id);
      const isMarkdown = item.dataset.isMarkdown === 'true';

      if (!prompt) return;

      // Edit button
      const editBtn = item.querySelector('.action-button.edit');
      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          createRipple(e); // Add Ripple effect
          // Insert into input box but don't send
          insertPromptText(prompt.content).then(() => {
            // Close side menu
            closeSideMenu();
            // Ensure button collapses (extra safeguard)
            setTimeout(() => smartCollapseButton(), 200);
            console.log('Prompt inserted into input box');
          }).catch(err => {
            console.error('Error inserting prompt:', err);
            // Collapse button even on error
            smartCollapseButton();
          });
        });
      }

      // Send button
      const sendBtn = item.querySelector('.action-button.send');
      if (sendBtn) {
        sendBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          // Insert then send immediately
          insertPromptText(prompt.content)
            .then(() => {
              // Ensure text is fully inserted, add short delay before sending
              return new Promise(resolve => setTimeout(resolve, 100));
            })
            .then(() => {
              // Send prompt
              return sendPrompt();
            })
            .then(() => {
              // Close side menu
              closeSideMenu();
              // Ensure button collapses (extra safeguard)
              setTimeout(() => smartCollapseButton(), 200);
              console.log('Prompt sent');
            })
            .catch(err => {
              console.error('Error sending prompt:', err);
              // Show error notification only when send fails
              if (err.message.includes('未找到输入框')) {
                // Already shown in insertPromptText
              } else {
                showUserNotification(
                  '提示词已插入，请手动发送',
                  'info',
                  2500
                );
              }
              // Close menu and collapse button even on error
              closeSideMenu();
              smartCollapseButton();
            });
        });
      }
    });
  } catch (error) {
    console.error('Failed to bind prompt events:', error);
  }
}

// Close side menu
function closeSideMenu() {
  if (!sideMenu) return;

  console.log('Starting to close side menu...');

  sideMenu.classList.remove('open');
  isMenuOpen = false;

  // Reset user interaction state
  isUserInteracting = false;

  // Remove outside click close listener
  document.removeEventListener('click', handleOutsideClick);

  // Add transition end listener to remove menu after animation completes
  const transitionEndHandler = () => {
    // Fix: Check if sideMenu exists before accessing properties or methods
    if (sideMenu) {
      if (sideMenu.parentNode) {
        sideMenu.parentNode.removeChild(sideMenu);
      }
      // Check again if sideMenu exists before removing listener
      if (sideMenu) {
        sideMenu.removeEventListener('transitionend', transitionEndHandler);
      }
      // Finally set to null
      sideMenu = null;
    }

    // After menu closes, smart collapse button
    smartCollapseButton();
  };

  // Save a reference to sideMenu in case it's set to null elsewhere before event fires
  const menuElement = sideMenu;
  try {
    menuElement.addEventListener('transitionend', transitionEndHandler);
  } catch (error) {
    console.error('Failed to add transition end event listener:', error);
    // If adding event fails, directly remove DOM
    if (menuElement && menuElement.parentNode) {
      menuElement.parentNode.removeChild(menuElement);
    }
    sideMenu = null;
    // Trigger button collapse even if event fails
    smartCollapseButton();
  }

  console.log('Side menu closed');
}

// Handle outside click to close menu
function handleOutsideClick(event) {
  // Ensure trigger button and menu itself are not clicked
  if (sideMenu && !sideMenu.contains(event.target) && event.target !== triggerButton && !triggerButton.contains(event.target)) {
    closeSideMenu();
  }
}

// Format category name
function formatCategoryName(category) {
  const categoryMap = {
    'general': '通用',
    'writing': '写作',
    'coding': '编程',
    'translation': '翻译',
    'creativity': '创意',
    'analysis': '分析',
    'uncategorized': '未分类'
  };
  
  return categoryMap[category] || category;
}

// Find ChatGPT input container
function findInputContainer() {
  // Try different selectors to find input container
  const selectors = [
    // New ChatGPT input area container
    '.flex.flex-col.w-full.py-2.flex-grow.md\\:py-3.md\\:pl-4',
    // Chat bottom area
    'form .relative.flex.h-full.flex-1.flex-col',
    // More general selectors
    'form div[class*="flex-col"]',
    'form .w-full',
    'main form',
    // Fallback to last form element
    'form'
  ];

  for (const selector of selectors) {
    const containers = document.querySelectorAll(selector);
    for (const container of containers) {
      // Ensure container is visible and contains an input-like element
      if (container.offsetParent !== null &&
          (container.querySelector('textarea') || container.querySelector('[contenteditable="true"]'))) {
        return container;
      }
    }
  }

  // If container not found, try to find textarea's parent container directly
  const textarea = findChatGPTInput();
  if (textarea && textarea.parentElement) {
    let parent = textarea.parentElement;
    // Search up two levels to find a large enough container
    for (let i = 0; i < 2; i++) {
      if (parent && parent.offsetWidth > 300) {
        return parent;
      }
      if (parent) parent = parent.parentElement;
    }
    return textarea.parentElement;
  }

  console.error('Cannot find input container');
  return null;
}

// Find AI input box (supports multiple AI platforms)
function findAIInput() {
  // Select different selectors based on current page
  let selectors = [];

  if (isChatGPTPage()) {
    // ChatGPT input selectors - 2025 latest version
    selectors = [
      '#prompt-textarea',                                    // Main textarea
      'textarea[data-id="root"]',                           // data-id attribute
      'textarea[placeholder*="Send"]',                       // Placeholder containing Send
      'textarea[placeholder*="Message"]',                    // Placeholder containing Message
      'textarea[placeholder*="发送"]',                       // Chinese: Send
      'textarea[placeholder*="消息"]',                       // Chinese: Message
      'main textarea',                                       // textarea in main area
      'form textarea',                                       // textarea in form
      '[contenteditable="true"][data-testid*="composer"]',  // composer component
      'div[contenteditable="true"][role="textbox"]',        // contenteditable textbox
      '[role="textbox"]',                                   // Generic textbox role
      'textarea',                                           // Any textarea (last resort)
      'div[contenteditable="true"]'                         // Any contenteditable (last resort)
    ];
  } else if (isClaudePage()) {
    // Claude input selectors
    selectors = [
      'div[contenteditable="true"][enterkeyhint="enter"]',  // Claude main input
      'div.ProseMirror[contenteditable="true"]',            // Claude editor
      'div[contenteditable="true"]',                        // Generic contenteditable
      'fieldset div[contenteditable="true"]',               // Input in fieldset
      '[role="textbox"]',                                   // Textbox role
      'textarea'                                            // Fallback textarea
    ];
  } else if (isGeminiPage()) {
    // Gemini input selectors - Quill editor based
    selectors = [
      'rich-textarea .ql-editor[contenteditable="true"]',   // Quill editor inside rich-textarea (primary)
      'rich-textarea div[contenteditable="true"]',          // Any contenteditable inside rich-textarea
      'div.ql-editor[contenteditable="true"]',              // Quill editor directly
      'div[contenteditable="true"][role="textbox"]',        // Editable div with textbox role
      '[role="textbox"][contenteditable="true"]',           // Textbox role with contenteditable
      'div[contenteditable="true"]',                        // Generic contenteditable
      'textarea',                                           // Fallback textarea
    ];
  } else if (isGrokPage()) {
    // Grok input selectors - uses TipTap/ProseMirror editor
    selectors = [
      'div.ProseMirror[contenteditable="true"]',            // ProseMirror editor (primary)
      'div.tiptap[contenteditable="true"]',                 // TipTap editor
      'div[contenteditable="true"][role="textbox"]',        // Editable textbox
      'div[contenteditable="true"]',                        // Generic contenteditable
      '[role="textbox"]',                                   // Textbox role
      'textarea'                                            // Fallback textarea
    ];
  } else if (isPerplexityPage()) {
    // Perplexity input selectors - uses contenteditable div
    selectors = [
      'div[contenteditable="true"][role="textbox"]',        // Primary contenteditable textbox
      'div[contenteditable="true"].overflow-auto',          // Overflow auto contenteditable
      'div[contenteditable="true"]',                        // Generic contenteditable
      '[role="textbox"]',                                   // Textbox role
      'textarea[placeholder*="Ask"]',                       // Ask anything input
      'textarea[placeholder*="Follow"]',                    // Follow up input
      'textarea',                                           // Generic textarea
    ];
  } else if (isDeepSeekPage()) {
    // DeepSeek input selectors
    selectors = [
      'textarea[placeholder*="输入"]',                       // Chinese input
      'textarea.el-textarea__inner',                        // Element UI style
      'div[contenteditable="true"]',                        // contenteditable
      '[role="textbox"]',                                   // Textbox role
      'textarea',                                           // Generic textarea
      'input[type="text"]'                                  // Fallback input
    ];
  } else if (isDoubaoPage()) {
    // Doubao input selectors
    selectors = [
      'textarea[placeholder*="输入"]',                       // Chinese input
      'textarea[placeholder*="请输入"]',                     // Please input prompt
      'div[contenteditable="true"][role="textbox"]',        // Editable textbox
      'div.editor-content[contenteditable="true"]',         // Editor content
      '[role="textbox"]',                                   // Textbox role
      'textarea',                                           // Generic textarea
      'div[contenteditable="true"]'                         // Generic contenteditable
    ];
  } else if (isQwenPage()) {
    // Qwen input selectors
    selectors = [
      'textarea[placeholder*="输入"]',                       // Chinese input
      'textarea[placeholder*="问我"]',                       // Ask me anything
      'div[contenteditable="true"][role="textbox"]',        // Editable textbox
      'textarea.ant-input',                                 // Ant Design style
      '[role="textbox"]',                                   // Textbox role
      'textarea',                                           // Generic textarea
      'div[contenteditable="true"]'                         // Generic contenteditable
    ];
  }

  // Try each selector
  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        // Check if element is visible
        if (el.offsetParent !== null) {
          console.log(`Found input: ${selector}`);
          return el;
        }
      }
    } catch (err) {
      console.warn(`Selector search failed: ${selector}`, err);
    }
  }

  console.error('Cannot find input');
  return null;
}

// Backward compatibility alias
function findChatGPTInput() {
  return findAIInput();
}

// Unified cursor positioning function
function setCursorToEnd(element, textLength) {
  try {
    // Ensure element has focus
    element.focus();

    if (element.tagName.toLowerCase() === 'textarea' || element.tagName.toLowerCase() === 'input') {
      // For textarea and input elements
      element.selectionStart = textLength;
      element.selectionEnd = textLength;
      console.log('Cursor positioned at textarea end');
    } else if (element.isContentEditable) {
      // For contentEditable elements
      const range = document.createRange();
      const selection = window.getSelection();

      // If element has child nodes, position at end of last text node
      if (element.childNodes.length > 0) {
        const lastNode = element.childNodes[element.childNodes.length - 1];
        if (lastNode.nodeType === Node.TEXT_NODE) {
          range.setStart(lastNode, lastNode.textContent.length);
          range.setEnd(lastNode, lastNode.textContent.length);
        } else {
          range.setStartAfter(lastNode);
          range.setEndAfter(lastNode);
        }
      } else {
        // If no child nodes, position at element end
        range.selectNodeContents(element);
        range.collapse(false); // collapse to end
      }

      selection.removeAllRanges();
      selection.addRange(range);
      console.log('Cursor positioned at contentEditable element end');
    }

    // Ensure element keeps focus
    element.focus();

    // Scroll to cursor position
    if (element.scrollIntoView) {
      element.scrollTop = element.scrollHeight;
    }

  } catch (error) {
    console.warn('Failed to set cursor position:', error);
  }
}

// Smart variable filling: check and prompt user to input variables
async function insertPromptText(text) {
  try {
    console.log('Starting to process prompt insertion...');

    // 1. Check variables (format: {variable})
    // Exclude {} in LaTeX formulas or code blocks, here we simply assume {var} doesn't contain newlines
    const variableRegex = /\{([^{}\n]+)\}/g;
    const variables = new Set();
    let match;

    while ((match = variableRegex.exec(text)) !== null) {
      // Filter out cases that might be code format, like { } empty object
      if (match[1].trim()) {
        variables.add(match[1]);
      }
    }

    let textToInsert = text;

    if (variables.size > 0) {
      console.log('Variables detected:', Array.from(variables));
      try {
        // Close sidebar to show Modal
        // closeSideMenu(); // Keeping sidebar open might be better UX, Modal overlays on top

        // Show modal for user to input
        const filledVariables = await showVariableInputModal(Array.from(variables), text);

        // Replace variables
        for (const [key, value] of Object.entries(filledVariables)) {
          // Escape regex special characters
          const safeKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`\\{${safeKey}\\}`, 'g');
          textToInsert = textToInsert.replace(regex, value);
        }
      } catch (error) {
        if (error.message === 'User cancelled') {
          console.log('User cancelled variable input');
          return;
        }
        throw error;
      }
    }

    // 2. Execute actual insertion
    return _performInsertion(textToInsert);

  } catch (error) {
    console.error('Error in prompt insertion flow:', error);
    throw error;
  }
}

// Show variable input modal
function showVariableInputModal(variables, originalText) {
  return new Promise((resolve, reject) => {
    // Ensure old Modal is removed
    const oldOverlay = document.querySelector('.apm-variable-modal-overlay');
    if (oldOverlay) oldOverlay.remove();

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'apm-variable-modal-overlay';

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'apm-variable-modal';

    // Title
    const title = document.createElement('h3');
    title.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--apm-primary);">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
      填写变量
    `;
    modal.appendChild(title);

    // Form container
    const form = document.createElement('div');
    form.className = 'apm-variable-form';

    // Create input for each variable
    const inputs = {};
    variables.forEach((variable, index) => {
      const field = document.createElement('div');
      field.className = 'apm-variable-field';

      const label = document.createElement('label');
      label.textContent = variable;
      field.appendChild(label);

      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = `请输入 ${variable}`;
      // Auto-focus first input
      if (index === 0) input.autofocus = true;

      // Bind Enter key to submit
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          // If not last one, focus next
          const nextVariable = variables[index + 1];
          if (nextVariable && inputs[nextVariable]) {
            inputs[nextVariable].focus();
          } else {
            // Last one, submit
            submitBtn.click();
          }
        }
      });

      field.appendChild(input);
      form.appendChild(field);
      inputs[variable] = input;
    });

    modal.appendChild(form);

    // Button area
    const actions = document.createElement('div');
    actions.className = 'apm-modal-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'apm-btn apm-btn-secondary';
    cancelBtn.textContent = '取消';
    cancelBtn.onclick = () => {
      cleanup();
      reject(new Error('User cancelled'));
    };

    const submitBtn = document.createElement('button');
    submitBtn.className = 'apm-btn apm-btn-primary';
    submitBtn.textContent = '插入';
    submitBtn.onclick = () => {
      const values = {};

      for (const [v, input] of Object.entries(inputs)) {
        // If user didn't fill, keep original variable name {variable}
        // Or we can choose to keep empty, or use placeholder
        // Here we choose: if empty, use empty string to replace, or keep original?
        // For better UX, keeping original if empty might be better, or don't replace
        // But usually user clicking insert wants to replace, so we use input value directly
        values[v] = input.value;
      }

      cleanup();
      resolve(values);
    };

    actions.appendChild(cancelBtn);
    actions.appendChild(submitBtn);
    modal.appendChild(actions);

    overlay.appendChild(modal);

    // If sidebar is open, add to sidebar, otherwise add to body
    if (sideMenu && sideMenu.classList.contains('open')) {
      sideMenu.appendChild(overlay);
    } else {
      document.body.appendChild(overlay);
    }

    // Focus first input (needs slight delay)
    setTimeout(() => {
      const firstInput = form.querySelector('input');
      if (firstInput) firstInput.focus();
    }, 50);

    // Click overlay to cancel
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup();
        reject(new Error('User cancelled'));
      }
    });

    function cleanup() {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }
  });
}

// Create real Ripple effect
function createRipple(event) {
  const button = event.currentTarget;

  const circle = document.createElement('span');
  const diameter = Math.max(button.clientWidth, button.clientHeight);
  const radius = diameter / 2;

  // Get click position relative to button
  const rect = button.getBoundingClientRect();
  const x = event.clientX - rect.left - radius;
  const y = event.clientY - rect.top - radius;

  circle.style.width = circle.style.height = `${diameter}px`;
  circle.style.left = `${x}px`;
  circle.style.top = `${y}px`;
  circle.classList.add('apm-ripple');

  // Remove old ripple
  const existingRipple = button.querySelector('.apm-ripple');
  if (existingRipple) {
    existingRipple.remove();
  }

  button.appendChild(circle);

  // Remove after animation ends
  setTimeout(() => {
    circle.remove();
  }, 600);
}

function _performInsertion(text) {
  return new Promise((resolve, reject) => {
    try {
      console.log('Starting low-level insertion...');

      const textarea = findChatGPTInput();
      if (!textarea) {
        console.error('Input not found, cannot insert prompt');
        showUserNotification(
          '未找到输入框。请确保您在ChatGPT对话页面，或尝试手动复制粘贴提示词。',
          'error',
          5000
        );
        return reject(new Error('未找到输入框'));
      }

      // Ensure original Markdown format is preserved
      // Handle newlines to ensure correct display in different environments
      const textToInsert = text;

      console.log('Input found, preparing to insert prompt');

      // Ensure input has focus
      textarea.focus();

      // Method priority:
      // 1. Clipboard API (closest to user manual copy-paste)
      // 2. Directly set textarea value

      // Use Clipboard API - closest to user manual copy-paste behavior
      if (navigator.clipboard && navigator.clipboard.writeText) {
        console.log('Using Clipboard API method for insertion');

        // Save original content first for recovery on failure
        const originalContent = textarea.value || textarea.textContent || '';

        // Copy to clipboard
        navigator.clipboard.writeText(textToInsert)
          .then(() => {
            // Try three paste methods:

            // 1. Use document.execCommand('paste')
            try {
              // Clear current content
              if (textarea.tagName.toLowerCase() === 'textarea') {
                textarea.value = '';
              } else if (textarea.isContentEditable) {
                textarea.textContent = '';
              }

              // Focus input and paste
              textarea.focus();
              const pasteSuccess = document.execCommand('paste');
              console.log('execCommand paste result:', pasteSuccess ? 'success' : 'failed');

              // Check if paste was successful
              setTimeout(() => {
                const hasContent = (textarea.value && textarea.value.length > 0) ||
                                  (textarea.textContent && textarea.textContent.length > 0);

                if (hasContent) {
                  console.log('Clipboard paste successful');
                  // Set cursor to end
                  setCursorToEnd(textarea, textToInsert.length);
                  // Trigger necessary events
                  textarea.dispatchEvent(new Event('input', { bubbles: true }));
                  textarea.dispatchEvent(new Event('change', { bubbles: true }));
                  resolve();
                } else {
                  // Try method 2
                  console.log('execCommand paste failed, trying direct value method');
                  insertWithDirectMethod();
                }
              }, 50);
            } catch (execError) {
              console.warn('execCommand paste failed:', execError);
              insertWithDirectMethod();
            }
          })
          .catch(err => {
            // Clipboard API failure is normal fallback behavior, no warning needed
            console.log('Using direct insertion method (Clipboard API unavailable or permission denied)');
            insertWithDirectMethod();
          });
      } else {
        console.log('Clipboard API unavailable, using direct method');
        insertWithDirectMethod();
      }

      // Direct value setting method
      function insertWithDirectMethod() {
        let success = false;

        // Method 1: Directly set value (most reliable method)
        if (textarea.tagName.toLowerCase() === 'textarea') {
          console.log('Using textarea.value direct setting method');

          // Set text content, ensure newlines are handled correctly
          textarea.value = textToInsert;

          // Set cursor to text end
          setCursorToEnd(textarea, textToInsert.length);

          // Trigger necessary events
          const inputEvent = new Event('input', { bubbles: true });
          textarea.dispatchEvent(inputEvent);

          const changeEvent = new Event('change', { bubbles: true });
          textarea.dispatchEvent(changeEvent);

          // Simulate keyboard event to ensure ChatGPT interface captures change
          const keyEvent = new KeyboardEvent('keydown', {
            bubbles: true,
            cancelable: true,
            key: ' ',
            keyCode: 32
          });
          textarea.dispatchEvent(keyEvent);

          success = true;
        }
        // Method 2: contentEditable element
        else if (textarea.isContentEditable) {
          console.log('Using contentEditable method');

          // Try InputEvent first (works for Perplexity and similar frameworks)
          try {
            // Clear existing content first
            textarea.innerHTML = '';
            textarea.focus();

            // Use InputEvent with insertText type
            const inputEvent = new InputEvent('input', {
              bubbles: true,
              cancelable: true,
              inputType: 'insertText',
              data: textToInsert
            });
            textarea.dispatchEvent(inputEvent);

            // Check if it worked
            const currentContent = textarea.textContent || textarea.innerText || '';
            if (currentContent.length > 0) {
              console.log('InputEvent method successful');
              setCursorToEnd(textarea, textToInsert.length);
              success = true;
            }
          } catch (inputEventError) {
            console.log('InputEvent method failed, trying direct textContent');
          }

          // Fallback: Set text content directly
          if (!success) {
            textarea.textContent = textToInsert;

            // Set cursor to text end
            setCursorToEnd(textarea, textToInsert.length);

            // Trigger necessary events
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            textarea.dispatchEvent(new Event('change', { bubbles: true }));

            success = true;
          }
        }

        // Method 3: Use execCommand as last resort
        if (!success) {
          console.log('Trying execCommand method');
          try {
            // Select all text in input
            if (textarea.select) {
              textarea.select();
            } else {
              const range = document.createRange();
              range.selectNodeContents(textarea);
              const selection = window.getSelection();
              selection.removeAllRanges();
              selection.addRange(range);
            }

            // Use execCommand to replace selected text
            const inserted = document.execCommand('insertText', false, textToInsert);
            if (inserted) {
              console.log('execCommand method insertion successful');
              success = true;

              // Set cursor to text end
              setCursorToEnd(textarea, textToInsert.length);

              // Trigger events
              textarea.dispatchEvent(new Event('input', { bubbles: true }));
              textarea.dispatchEvent(new Event('change', { bubbles: true }));
            }
          } catch (commandError) {
            console.warn('execCommand method failed:', commandError);
          }
        }

        // Method 4: Try React-specific method
        if (!success) {
          // Trigger React component's onChange event (if exists)
          try {
            // Set value first
            if (textarea.tagName.toLowerCase() === 'textarea') {
              textarea.value = textToInsert;
            } else if (textarea.isContentEditable) {
              textarea.textContent = textToInsert;
            }

            // Set cursor to text end
            setCursorToEnd(textarea, textToInsert.length);

            const reactKey = Object.keys(textarea).find(key => key.startsWith('__reactProps$') || key.startsWith('__reactEventHandlers$'));

            if (reactKey && textarea[reactKey].onChange) {
              console.log('Triggering React onChange event');
              const syntheticEvent = {
                target: textarea,
                currentTarget: textarea,
                preventDefault: () => {},
                stopPropagation: () => {},
                persist: () => {}
              };

              // Before React event, ensure DOM is updated
              setTimeout(() => {
                textarea[reactKey].onChange(syntheticEvent);
                // Ensure cursor position again
                setCursorToEnd(textarea, textToInsert.length);
              }, 0);

              success = true;
            }
          } catch (reactError) {
            console.warn('Failed to trigger React event:', reactError);
          }
        }

        // Regardless of success, try one last time to set cursor position
        setTimeout(() => {
          setCursorToEnd(textarea, textToInsert.length);
        }, 100);

        console.log(`Prompt insertion ${success ? 'successful' : 'may have failed'}`);
        resolve();
      }
    } catch (error) {
      console.error('Error inserting prompt:', error);

      // Fallback: try to copy to clipboard
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
          .then(() => {
            showUserNotification(
              '插入失败，但提示词已复制到剪贴板。请手动粘贴到输入框（Ctrl+V 或 Cmd+V）。',
              'info',
              5000
            );
            resolve(); // Although insertion failed, copy succeeded
          })
          .catch(copyErr => {
            console.error('Copy to clipboard also failed:', copyErr);
            showUserNotification(
              '插入和复制都失败了。请尝试刷新页面或手动复制提示词。',
              'error',
              6000
            );
            reject(error);
          });
      } else {
        reject(error);
      }
    }
  });
}

// Send prompt (simulate pressing Enter)
function sendPrompt() {
  return new Promise((resolve, reject) => {
    try {
      const textarea = findChatGPTInput();
      if (!textarea) {
        console.error('Input not found, cannot send');
        return reject(new Error('未找到输入框'));
      }

      console.log('Attempting to send prompt...');

      // For Claude and Doubao, prioritize keyboard events as they don't have standard send buttons
      const useKeyboardFirst = isClaudePage() || isDoubaoPage();

      if (useKeyboardFirst) {
        console.log('Using keyboard-first strategy for this platform');
        sendViaKeyboard(textarea, resolve, reject);
        return;
      }

      // Get platform-specific send button selectors
      let sendButtonSelectors = [];

      if (isChatGPTPage()) {
        sendButtonSelectors = [
          'button[data-testid="send-button"]',
          'button[aria-label="Send prompt"]',
          'button[aria-label="发送提示"]',
          'form button[type="submit"]',
          'button.absolute.p-1.rounded-md',
        ];
      } else if (isGeminiPage()) {
        sendButtonSelectors = [
          'button[aria-label="Send message"]',
          'button[aria-label="发送消息"]',
          'button.send-button',
          'button[mattooltip*="Send"]',
          'button[mattooltip*="发送"]',
          '.input-area-container button[aria-label*="send" i]',
          'button[jsname][data-idom-class*="send"]',
        ];
      } else if (isGrokPage()) {
        sendButtonSelectors = [
          'button[aria-label="Send"]',
          'button[aria-label="发送"]',
          'button[data-testid="send-button"]',
          'form button[type="submit"]',
        ];
      } else if (isPerplexityPage()) {
        sendButtonSelectors = [
          'button[aria-label="Submit"]',
          'button[aria-label="提交"]',
          'button.bg-super',
          'button[type="submit"]',
        ];
      } else if (isDeepSeekPage()) {
        sendButtonSelectors = [
          'button[aria-label="发送"]',
          'button[aria-label="Send"]',
          'div[role="button"][aria-label*="发送"]',
          'button.el-button--primary',
          'form button[type="submit"]',
        ];
      } else if (isQwenPage()) {
        sendButtonSelectors = [
          'button[aria-label="发送"]',
          'button[aria-label="Send"]',
          'button.ant-btn-primary',
          'button[type="submit"]',
        ];
      } else {
        // Generic fallback selectors
        sendButtonSelectors = [
          'button[type="submit"]',
          'button[aria-label*="send" i]',
          'button[aria-label*="发送"]',
          'form button:last-of-type',
        ];
      }

      // Try to find send button
      let sendButton = null;
      for (const selector of sendButtonSelectors) {
        try {
          const btn = document.querySelector(selector);
          if (btn && btn.offsetParent !== null) {
            sendButton = btn;
            console.log(`Found send button: ${selector}`);
            break;
          }
        } catch (e) {
          // Ignore invalid selector errors
        }
      }

      if (sendButton && !sendButton.disabled) {
        // Use fixed delay to ensure framework has processed input state change
        setTimeout(() => {
          sendButton.click();
          console.log('Sent successfully by clicking send button');
          resolve();
        }, 50);
        return;
      }

      console.log('Send button not found or disabled, trying keyboard events');
      sendViaKeyboard(textarea, resolve, reject);

    } catch (error) {
      console.error('Error sending prompt:', error);
      reject(error);
    }
  });
}

// Helper function to send via keyboard events
function sendViaKeyboard(textarea, resolve, reject) {
  try {
    textarea.focus();

    // Create complete keyboard event sequence
    const eventOptions = {
      bubbles: true,
      cancelable: true,
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      charCode: 13,
      view: window
    };

    // Dispatch keydown
    const keydownEvent = new KeyboardEvent('keydown', eventOptions);
    textarea.dispatchEvent(keydownEvent);

    // Dispatch keypress (some frameworks listen to this)
    const keypressEvent = new KeyboardEvent('keypress', eventOptions);
    textarea.dispatchEvent(keypressEvent);

    // Small delay then keyup
    setTimeout(() => {
      const keyupEvent = new KeyboardEvent('keyup', eventOptions);
      textarea.dispatchEvent(keyupEvent);

      // Also try triggering input event
      textarea.dispatchEvent(new Event('input', { bubbles: true }));

      console.log('Sent via keyboard event sequence');
      resolve();
    }, 10);

  } catch (err) {
    console.error('Keyboard send failed:', err);
    reject(err);
  }
}

// Add slash command functionality
function setupSlashCommands() {
  // Listen for keyboard input, detect slash commands
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || isMenuOpen) return;

    // Check if current focus is in input
    const textarea = findChatGPTInput();
    if (!textarea || document.activeElement !== textarea) return;

    // Check if input is empty or only has whitespace
    if ((textarea.value && textarea.value.trim()) ||
        (textarea.textContent && textarea.textContent.trim())) {
      return;
    }

    // Prevent default behavior to stop slash from being typed
    e.preventDefault();

    // Open prompt menu
    openSideMenu();
  });
}

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Initialize
function initialize() {
  try {
    console.log('Starting to initialize AI Prompt Manager...');

    // Try to load Marked.js library
    loadMarkedJS().catch(err => {
      console.warn('Failed to load Markdown parsing library, prompts will display as plain text:', err);
    });

    // Listen for storage changes, auto-update prompt list
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'sync' && changes.prompts) {
        console.log('Detected prompt storage change, refreshing prompt list');

        // Update local prompt data
        availablePrompts = changes.prompts.newValue || [];

        // If side menu exists, update UI
        if (sideMenu) {
          console.log('Re-rendering side menu');
          renderSideMenu();
        }
      }
    });

    // Load prompts first
    loadPrompts().then(() => {
      // If on supported AI page, create trigger button
      if (isSupportedAIPage()) {
        console.log('Currently on supported AI page, preparing to inject button');
        // Wait for DOM to fully load
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => {
            // Use setTimeout to ensure page is fully loaded
            console.log('DOM loading, setting injection in 2 seconds');
            setTimeout(() => {
              try {
                injectTriggerButton();
                setupSlashCommands();
              } catch (err) {
                console.error('Failed to inject button or setup slash commands:', err);
              }
            }, 2000);
          });
        } else {
          // If DOM already loaded, initialize directly
          console.log('DOM already loaded, setting injection in 2 seconds');
          setTimeout(() => {
            try {
              injectTriggerButton();
              setupSlashCommands();
            } catch (err) {
              console.error('Failed to inject button or setup slash commands:', err);
            }
          }, 2000);
        }

        // Listen for page changes to re-inject on SPA navigation
        console.log('Setting up page change listener');
        const observer = new MutationObserver(debounce(() => {
          try {
            // Check if document.body exists before querying
            if (!document.body) return;

            if (isSupportedAIPage() && !document.querySelector(`.${CONFIG.triggerButtonClass}`)) {
              console.log('Detected page change, re-injecting button');
              injectTriggerButton();
            }
          } catch (err) {
            // Only log if it's not a common extension context error
            if (!err.message?.includes('Extension context invalidated')) {
              console.warn('Re-inject check skipped:', err.message);
            }
          }
        }, 1000));

        // Only observe if document.body exists
        if (document.body) {
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
        }
      } else {
        console.log('Not on supported AI page, not injecting button');
      }
    }).catch(err => {
      console.error('Failed to load prompts:', err);
    });
  } catch (error) {
    console.error('Failed to initialize AI Prompt Manager:', error);
  }
}

// Check if on supported AI page
function isSupportedAIPage() {
  return isChatGPTPage() ||
         isClaudePage() ||
         isGeminiPage() ||
         isGrokPage() ||
         isPerplexityPage() ||
         isDeepSeekPage() ||
         isDoubaoPage() ||
         isQwenPage();
}

// Check if on ChatGPT page
function isChatGPTPage() {
  return window.location.href.includes('chat.openai.com') ||
         window.location.href.includes('chatgpt.com');
}

// Check if on Claude page
function isClaudePage() {
  return window.location.href.includes('claude.ai');
}

// Check if on Gemini page
function isGeminiPage() {
  return window.location.href.includes('gemini.google.com');
}

// Check if on Grok page
function isGrokPage() {
  return window.location.href.includes('grok.com') ||
         (window.location.href.includes('x.com') && window.location.pathname.includes('/i/grok'));
}

// Check if on Perplexity page
function isPerplexityPage() {
  return window.location.href.includes('perplexity.ai');
}

// Check if on DeepSeek page
function isDeepSeekPage() {
  return window.location.href.includes('chat.deepseek.com');
}

// Check if on Doubao page
function isDoubaoPage() {
  return window.location.href.includes('doubao.com');
}

// Check if on Qwen page
function isQwenPage() {
  return window.location.href.includes('chat.qwen.ai') ||
         window.location.href.includes('qianwen.aliyun.com');
}

// Find input area
function findInputArea() {
  console.log('Finding input area...');

  // Latest ChatGPT input area selectors
  const selectors = [
    'textarea[data-id]',
    'textarea[placeholder="发送消息"]',
    'textarea.ChatMessageInputFooter__TextArea',
    '.ProseMirror',
    'textarea[placeholder="Message ChatGPT…"]',
    'textarea[placeholder="Send a message"]',
    'textarea',
    '[contenteditable="true"]',
    'div[role="textbox"]'
  ];

  for (const selector of selectors) {
    const inputElem = document.querySelector(selector);
    if (inputElem) {
      console.log(`Found input area: ${selector}`);
      return inputElem;
    }
  }

  console.log('Input area not found');
  return null;
}

// Add new prompt
async function addPrompt(newPrompt) {
  try {
    console.log('[AI Prompt] addPrompt called with:', newPrompt.title);

    // Ensure newPrompt has id
    if (!newPrompt.id) {
      newPrompt.id = 'prompt-' + Date.now();
    }

    // Add to in-memory array
    availablePrompts.push(newPrompt);

    // Save to sync storage
    await savePromptsToStorage(availablePrompts);
    console.log('[AI Prompt] New prompt added and saved to sync storage:', newPrompt.title);

    // If sidebar is open, refresh display
    if (sideMenu) {
      renderSideMenu();
    }

    return true;
  } catch (error) {
    console.error('Failed to add prompt:', error);
    throw error;
  }
}

// Update prompt
async function updatePrompt(id, updatedPrompt) {
  try {
    // Find prompt index
    const index = availablePrompts.findIndex(p => p.id === id);
    if (index === -1) {
      const error = new Error(`Prompt with ID ${id} not found`);
      console.warn(error.message);
      throw error;
    }

    // Update prompt in memory
    availablePrompts[index] = {
      ...availablePrompts[index],
      ...updatedPrompt,
      id // Ensure ID doesn't change
    };

    // Save to local storage
    await savePromptsToStorage(availablePrompts);
    console.log(`Prompt with ID ${id} updated and saved to storage`);

    // If sidebar is open, refresh display
    if (sideMenu) {
      renderSideMenu();
    }

    return true;
  } catch (error) {
    console.error('Failed to update prompt:', error);
    throw error;
  }
}

// Delete prompt
async function deletePrompt(id) {
  try {
    // Filter out prompt to delete
    const newPrompts = availablePrompts.filter(p => p.id !== id);

    // If length is same, prompt with that ID was not found
    if (newPrompts.length === availablePrompts.length) {
      const error = new Error(`Prompt with ID ${id} not found`);
      console.warn(error.message);
      throw error;
    }

    // Update in-memory array
    availablePrompts = newPrompts;

    // Save to local storage
    await savePromptsToStorage(availablePrompts);
    console.log(`Prompt with ID ${id} deleted and removed from storage`);

    // If sidebar is open, refresh display
    if (sideMenu) {
      renderSideMenu();
    }

    return true;
  } catch (error) {
    console.error('Failed to delete prompt:', error);
    throw error;
  }
}

// Show user notification (floating toast)
function showUserNotification(message, type = 'info', duration = 3000) {
  // Remove existing notification
  const existingNotif = document.querySelector('.ai-prompt-user-notification');
  if (existingNotif) {
    existingNotif.remove();
  }

  const notification = document.createElement('div');
  notification.className = 'ai-prompt-user-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 999999;
    max-width: 350px;
    padding: 16px 20px;
    background: ${type === 'error' ? '#fee2e2' : type === 'success' ? '#d1fae5' : '#dbeafe'};
    border-left: 4px solid ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
    border-radius: 8px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: ${type === 'error' ? '#991b1b' : type === 'success' ? '#065f46' : '#1e40af'};
    animation: slideInRight 0.3s ease-out;
  `;

  notification.innerHTML = `
    <div style="display: flex; align-items: flex-start; gap: 12px;">
      <span style="font-size: 20px; flex-shrink: 0;">
        ${type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'}
      </span>
      <div style="flex: 1;">
        <div style="font-weight: 600; margin-bottom: 4px;">
          ${type === 'error' ? '插入失败' : type === 'success' ? '操作成功' : '提示'}
        </div>
        <div>${message}</div>
      </div>
      <button onclick="this.parentElement.parentElement.remove()" style="
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        margin-left: 8px;
        color: inherit;
        opacity: 0.6;
        line-height: 1;
      ">×</button>
    </div>
  `;

  // Add animation styles
  if (!document.querySelector('#ai-prompt-notification-styles')) {
    const style = document.createElement('style');
    style.id = 'ai-prompt-notification-styles';
    style.textContent = `
      @keyframes slideInRight {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(notification);

  // Auto remove
  if (duration > 0) {
    setTimeout(() => {
      notification.style.animation = 'slideInRight 0.3s ease-out reverse';
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }
}

// Cleanup function to prevent memory leaks
function cleanup() {
  try {
    console.log('Starting to cleanup AI Prompt Manager...');

    // Clear timers
    clearAutoCollapseTimer();

    // Remove global event listeners
    document.removeEventListener('click', handleGlobalClick);
    document.removeEventListener('click', handleOutsideClick);

    // Reset state variables
    isMenuOpen = false;
    isButtonCollapsed = true;
    isUserInteracting = false;

    // Remove DOM elements
    if (triggerButton && triggerButton.parentNode) {
      triggerButton.parentNode.removeChild(triggerButton);
    }

    if (sideMenu && sideMenu.parentNode) {
      sideMenu.parentNode.removeChild(sideMenu);
    }

    // Reset references
    triggerButton = null;
    sideMenu = null;

    console.log('AI Prompt Manager cleanup complete');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// Cleanup on page unload (only use beforeunload, unload is restricted in modern browsers)
window.addEventListener('beforeunload', cleanup);

// Start initialization
initialize(); 