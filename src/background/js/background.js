/**
 * AI Prompt Manager - Service Worker
 * Handles extension background logic and lifecycle management
 */

'use strict';

// ===== Development Mode Configuration =====
const DEBUG_MODE = false;
const log = DEBUG_MODE ? console.log.bind(console, '[Background]') : () => {};
const error = console.error.bind(console, '[Background]');

// ===== Extension Installation and Update =====
chrome.runtime.onInstalled.addListener((details) => {
  const currentVersion = chrome.runtime.getManifest().version;

  if (details.reason === 'install') {
    log('AI Prompt Manager installed, version:', currentVersion);

    // Save installation info
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

    // Save update info
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
