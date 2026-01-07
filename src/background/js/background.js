/**
 * AI Prompt Manager - Service Worker
 * Handles extension background logic and lifecycle management
 */

'use strict';

// ===== Development Mode Configuration =====
const DEBUG_MODE = false;
const log = DEBUG_MODE ? console.log.bind(console, '[Background]') : () => {};
const error = console.error.bind(console, '[Background]');

// ===== Data Migration: local → sync =====
// Migrate data from chrome.storage.local to chrome.storage.sync
// This ensures data persists after extension reinstall
async function migrateLocalToSync() {
  try {
    // Get data from both storages
    const [localData, syncData] = await Promise.all([
      new Promise(resolve => chrome.storage.local.get(['prompts', 'theme', 'developerMode', 'lastExpandedCategory'], resolve)),
      new Promise(resolve => chrome.storage.sync.get(['prompts', 'theme', 'developerMode', 'lastExpandedCategory'], resolve))
    ]);

    // Check if local has prompts data and sync doesn't (or sync is empty)
    const localHasPrompts = localData.prompts && Array.isArray(localData.prompts) && localData.prompts.length > 0;
    const syncHasPrompts = syncData.prompts && Array.isArray(syncData.prompts) && syncData.prompts.length > 0;

    if (localHasPrompts && !syncHasPrompts) {
      log('Migrating data from local to sync storage...');

      // Prepare data to migrate
      const dataToMigrate = {};
      if (localData.prompts) dataToMigrate.prompts = localData.prompts;
      if (localData.theme) dataToMigrate.theme = localData.theme;
      if (localData.developerMode !== undefined) dataToMigrate.developerMode = localData.developerMode;
      if (localData.lastExpandedCategory) dataToMigrate.lastExpandedCategory = localData.lastExpandedCategory;

      // Check sync storage quota (100KB limit)
      const dataSize = JSON.stringify(dataToMigrate).length;
      if (dataSize > 90000) { // 90KB warning threshold
        error('Data too large for sync storage:', dataSize, 'bytes');
        return false;
      }

      // Migrate to sync storage
      await new Promise((resolve, reject) => {
        chrome.storage.sync.set(dataToMigrate, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });

      log('Migration complete:', Object.keys(dataToMigrate).length, 'keys migrated');

      // Clear migrated data from local storage (keep version info)
      await new Promise(resolve => {
        chrome.storage.local.remove(['prompts', 'theme', 'developerMode', 'lastExpandedCategory'], resolve);
      });

      log('Local storage cleaned up');
      return true;
    } else if (syncHasPrompts) {
      log('Sync storage already has data, no migration needed');
      return false;
    } else {
      log('No data to migrate');
      return false;
    }
  } catch (err) {
    error('Migration failed:', err);
    return false;
  }
}

// ===== Extension Installation and Update =====
chrome.runtime.onInstalled.addListener(async (details) => {
  const currentVersion = chrome.runtime.getManifest().version;

  // Always try to migrate data on install/update
  await migrateLocalToSync();

  if (details.reason === 'install') {
    log('AI Prompt Manager installed, version:', currentVersion);

    // Save installation info (keep in local, not user data)
    chrome.storage.local.set({
      version: currentVersion,
      installedAt: Date.now()
    });

    // Optional: Open welcome page
    // chrome.tabs.create({
    //   url: chrome.runtime.getURL('src/welcome/welcome.html')
    // });

  } else if (details.reason === 'update') {
    const previousVersion = details.previousVersion;
    log(`AI Prompt Manager updated: ${previousVersion} → ${currentVersion}`);

    // Save update info (keep in local, not user data)
    chrome.storage.local.set({
      version: currentVersion,
      lastUpdate: Date.now(),
      previousVersion: previousVersion
    });

    // Check if update notification should be shown (minor version change)
    if (shouldShowUpdateNotification(previousVersion, currentVersion)) {
      log('Important update detected, preparing to show notification');
      // Notification logic can be added here
    }
  }
});

// Determine whether to show update notification
function shouldShowUpdateNotification(prevVersion, currVersion) {
  try {
    const [prevMajor, prevMinor] = prevVersion.split('.').map(Number);
    const [currMajor, currMinor] = currVersion.split('.').map(Number);
    // Notify when major or minor version changes
    return currMajor !== prevMajor || currMinor !== prevMinor;
  } catch (err) {
    error('Version comparison failed:', err);
    return false;
  }
}

// ===== Message Listener =====
// Keep service worker alive, handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  log('Message received:', request.action, 'from:', sender.tab ? 'content' : 'popup');

  // Background message handling logic can be added here
  // For example: cross-tab communication, data synchronization, etc.

  return false; // Synchronous response
});

// ===== Extension Startup =====
chrome.runtime.onStartup.addListener(() => {
  log('Browser started, Service Worker activated');
});

// ===== Error Handling =====
self.addEventListener('error', (event) => {
  error('Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  error('Unhandled Promise rejection:', event.reason);
});

log('Service Worker loaded');
