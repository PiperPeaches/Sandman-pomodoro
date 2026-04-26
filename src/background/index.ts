let timeLeft = 25 * 60; // Remaining seconds when paused
let endTime: number | null = null; // Timestamp when the session should end
let isActive = false;
let mode: 'blacklist' | 'whitelist' = 'blacklist';
let blocklist: string[] = [
  'facebook.com',
  'twitter.com',
  'x.com',
  'youtube.com',
  'instagram.com',
  'reddit.com',
  'netflix.com',
  'twitch.tv'
];

/**
 * Sandman Background Script
 * 
 * Uses an "End Time" approach for maximum reliability in Manifest V3.
 */

// Initialize state from storage
chrome.storage.local.get(['blocklist', 'mode', 'timeLeft', 'isActive', 'endTime'], (result) => {
  if (result.blocklist && Array.isArray(result.blocklist)) {
    blocklist = result.blocklist;
  }
  if (result.mode === 'blacklist' || result.mode === 'whitelist') {
    mode = result.mode;
  }
  if (typeof result.timeLeft === 'number') {
    timeLeft = result.timeLeft;
  }
  if (typeof result.isActive === 'boolean') {
    isActive = result.isActive;
  }
  if (typeof result.endTime === 'number') {
    endTime = result.endTime;
  }

  if (isActive && endTime) {
    const now = Date.now();
    if (now < endTime) {
      timeLeft = Math.ceil((endTime - now) / 1000);
      startAlarm();
    } else {
      timeLeft = 0;
      isActive = false;
      saveState();
    }
  }
});

interface TimerMessage {
  type: string;
  timeLeft?: number;
  endTime?: number | null;
  isActive?: boolean;
  site?: string;
  mode?: 'blacklist' | 'whitelist';
}

/**
 * Global message listener
 */
chrome.runtime.onMessage.addListener((message: TimerMessage, _sender, sendResponse) => {
  if (message.type === 'GET_STATE') {
    const currentRemaining = isActive && endTime ? Math.max(0, Math.ceil((endTime - Date.now()) / 1000)) : timeLeft;
    sendResponse({ timeLeft: currentRemaining, isActive, blocklist, mode, endTime });
  } else if (message.type === 'START_TIMER') {
    isActive = true;
    endTime = Date.now() + (timeLeft * 1000);
    saveState();
    startAlarm();
    broadcastSleep();
  } else if (message.type === 'PAUSE_TIMER') {
    if (isActive && endTime) {
      timeLeft = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    }
    isActive = false;
    endTime = null;
    saveState();
    stopAlarm();
    broadcastSleep();
  } else if (message.type === 'RESET_TIMER') {
    isActive = false;
    timeLeft = 25 * 60;
    endTime = null;
    saveState();
    stopAlarm();
    broadcastSleep();
  } else if (message.type === 'SET_MODE') {
    if (message.mode) {
      mode = message.mode;
      saveState();
      broadcastSleep();
      sendResponse({ mode });
    }
  } else if (message.type === 'ADD_BLOCK') {
    if (message.site && !blocklist.includes(message.site)) {
      blocklist.push(message.site);
      saveState();
      broadcastSleep();
      sendResponse({ blocklist });
    }
  } else if (message.type === 'REMOVE_BLOCK') {
    if (message.site) {
      blocklist = blocklist.filter(s => s !== message.site);
      saveState();
      broadcastSleep();
      sendResponse({ blocklist });
    }
  }
  return true;
});

function saveState() {
  chrome.storage.local.set({ blocklist, mode, timeLeft, isActive, endTime });
}

function startAlarm() {
  chrome.alarms.create('sandman-heartbeat', { periodInMinutes: 1 });
}

function stopAlarm() {
  chrome.alarms.clear('sandman-heartbeat');
}

/**
 * Handle alarm firing (session end or heartbeat)
 */
chrome.alarms.onAlarm.addListener((_alarm) => {
  if (isActive && endTime) {
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
    
    if (remaining <= 0) {
      isActive = false;
      endTime = null;
      timeLeft = 0;
      saveState();
      stopAlarm();
      broadcastSleep();
      showCompletionNotification();
    } else {
      timeLeft = remaining;
      saveState();
      broadcastSleep(); // Regular sync pulse
    }
  }
});

function showCompletionNotification() {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: '/favicon.svg',
    title: 'Time is up!',
    message: 'Your focus session has ended.',
    priority: 2
  });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if ((changeInfo.status === 'complete' || changeInfo.url) && tab.url) {
    const isDistracting = checkIsDistracting(tab.url);
    const currentRemaining = isActive && endTime ? Math.max(0, Math.ceil((endTime - Date.now()) / 1000)) : timeLeft;
    chrome.tabs.sendMessage(tabId, { 
      type: 'UPDATE_SLEEP', 
      isAsleep: isDistracting, 
      isActive, 
      timeLeft: currentRemaining,
      endTime
    }).catch(() => {});
  }
});

function checkIsDistracting(url: string | undefined): boolean {
  if (!url) return false;
  if (url.startsWith('chrome://') || url.startsWith('about:') || url.startsWith('chrome-extension://')) return false;
  const isOnList = blocklist.some(site => url.includes(site));
  return mode === 'blacklist' ? isOnList : !isOnList;
}

/**
 * Updates the sleep state for all open tabs and the popup.
 */
function broadcastSleep() {
  const currentRemaining = isActive && endTime ? Math.max(0, Math.ceil((endTime - Date.now()) / 1000)) : timeLeft;
  const stateUpdate = { 
    type: 'UPDATE_SLEEP', 
    isActive, 
    timeLeft: currentRemaining,
    endTime,
    mode
  };

  // Notify Popup
  chrome.runtime.sendMessage(stateUpdate).catch(() => {});

  // Notify Tabs
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      const isDistracting = checkIsDistracting(tab.url);
      chrome.tabs.sendMessage(tab.id!, { 
        ...stateUpdate,
        isAsleep: isDistracting
      }).catch(() => {});
    });
  });
}
