let timeLeft = 25 * 60; 
let defaultTime = 25 * 60;
let endTime: number | null = null; 
let isActive = false;
let mode: 'blacklist' | 'whitelist' = 'blacklist';
let blocklist: string[] = [];

// Settings
let blockAI = false;
let blockCommon = true;
let strictSubdomains = false;
let blockYouTube = false;
let noBreaks = false;

const commonDistractions = [
  'facebook.com', 'twitter.com', 'x.com', 'youtube.com', 
  'instagram.com', 'reddit.com', 'netflix.com', 'twitch.tv', 'tiktok.com','news.google.com'
];

const aiSites = [
  'chatgpt.com', 'openai.com', 'claude.ai', 'gemini.google.com', 
  'perplexity.ai', 'deepseek.com', 'mistral.ai', 'anthropic.com','kimi.com','ai.hackclub.com'
];

/**
 * Sandman Background Script
 */

let isInitialized = false;
const initPromise = new Promise<void>((resolve) => {
  chrome.storage.local.get([
    'blocklist', 'mode', 'timeLeft', 'isActive', 'endTime', 
    'blockAI', 'blockCommon', 'strictSubdomains', 'blockYouTube',
    'noBreaks', 'defaultTime'
  ], (result) => {
    if (Array.isArray(result.blocklist)) blocklist = result.blocklist;
    if (result.mode === 'blacklist' || result.mode === 'whitelist') mode = result.mode;
    if (typeof result.defaultTime === 'number') defaultTime = result.defaultTime;
    if (typeof result.timeLeft === 'number') timeLeft = result.timeLeft;
    if (typeof result.isActive === 'boolean') isActive = result.isActive;
    if (typeof result.endTime === 'number') endTime = result.endTime;
    if (typeof result.blockAI === 'boolean') blockAI = result.blockAI;
    if (typeof result.blockCommon === 'boolean') blockCommon = result.blockCommon;
    if (typeof result.strictSubdomains === 'boolean') strictSubdomains = result.strictSubdomains;
    if (typeof result.blockYouTube === 'boolean') blockYouTube = result.blockYouTube;
    if (typeof result.noBreaks === 'boolean') noBreaks = result.noBreaks;

    if (isActive && endTime) {
      const now = Date.now();
      if (now < endTime) {
        timeLeft = Math.ceil((endTime - now) / 1000);
        startAlarm();
      } else {
        isActive = false; endTime = null; timeLeft = defaultTime;
        saveState();
      }
    }
    isInitialized = true;
    resolve();
  });
});

async function ensureInit() {
  if (!isInitialized) await initPromise;
}

interface TimerMessage {
  type: string;
  timeLeft?: number;
  endTime?: number | null;
  isActive?: boolean;
  site?: string;
  mode?: 'blacklist' | 'whitelist';
  settings?: {
    blockAI?: boolean;
    blockCommon?: boolean;
    strictSubdomains?: boolean;
    blockYouTube?: boolean;
    noBreaks?: boolean;
    defaultTime?: number;
  };
}

chrome.runtime.onMessage.addListener((message: TimerMessage, _sender, sendResponse) => {
  ensureInit().then(() => {
    switch (message.type) {
      case 'GET_STATE': {
        const currentRemaining = isActive && endTime ? Math.max(0, Math.ceil((endTime - Date.now()) / 1000)) : timeLeft;
        sendResponse({ 
          timeLeft: currentRemaining, isActive, blocklist, mode, endTime,
          settings: { blockAI, blockCommon, strictSubdomains, blockYouTube, noBreaks, defaultTime }
        });
        break;
      }
      case 'START_TIMER':
        isActive = true;
        endTime = Date.now() + (timeLeft * 1000);
        saveState(); startAlarm(); broadcastSleep();
        sendResponse({ success: true, endTime });
        break;
      case 'PAUSE_TIMER':
        if (noBreaks && isActive) {
          sendResponse({ success: false, error: 'No Breaks mode is active' });
          break;
        }
        if (isActive && endTime) timeLeft = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
        isActive = false; endTime = null;
        saveState(); stopAlarm(); broadcastSleep();
        sendResponse({ success: true, timeLeft });
        break;
      case 'RESET_TIMER':
        if (noBreaks && isActive) {
          sendResponse({ success: false, error: 'No Breaks mode is active' });
          break;
        }
        isActive = false; timeLeft = defaultTime; endTime = null;
        saveState(); stopAlarm(); broadcastSleep();
        sendResponse({ success: true });
        break;
      case 'SET_MODE':
        if (noBreaks && isActive) {
          sendResponse({ success: false, error: 'No Breaks mode is active' });
          break;
        }
        if (message.mode) { mode = message.mode; saveState(); broadcastSleep(); }
        sendResponse({ mode });
        break;
      case 'UPDATE_SETTINGS':
        if (message.settings) {
          // If noBreaks is on and timer is running, block all setting changes except maybe noBreaks itself?
          // Usually "lock in" means you can't even turn it off.
          if (noBreaks && isActive) {
             sendResponse({ success: false, error: 'No Breaks mode is active' });
             break;
          }

          if (message.settings.blockAI !== undefined) blockAI = message.settings.blockAI;
          if (message.settings.blockCommon !== undefined) blockCommon = message.settings.blockCommon;
          if (message.settings.strictSubdomains !== undefined) strictSubdomains = message.settings.strictSubdomains;
          if (message.settings.blockYouTube !== undefined) blockYouTube = message.settings.blockYouTube;
          if (message.settings.noBreaks !== undefined) noBreaks = message.settings.noBreaks;
          if (message.settings.defaultTime !== undefined) {
             defaultTime = message.settings.defaultTime;
             if (!isActive) timeLeft = defaultTime;
          }
          saveState(); 
          broadcastSleep();
        }
        sendResponse({ success: true });
        break;
      case 'ADD_BLOCK':
        if (noBreaks && isActive) {
          sendResponse({ success: false, error: 'No Breaks mode is active' });
          break;
        }
        if (message.site) {
          const normalized = normalizeSite(message.site);
          if (normalized && !blocklist.includes(normalized)) {
            blocklist.push(normalized); saveState(); broadcastSleep();
          }
        }
        sendResponse({ blocklist });
        break;
      case 'REMOVE_BLOCK':
        if (noBreaks && isActive) {
          sendResponse({ success: false, error: 'No Breaks mode is active' });
          break;
        }
        if (message.site) {
          blocklist = blocklist.filter(s => s !== message.site); saveState(); broadcastSleep();
        }
        sendResponse({ blocklist });
        break;
      case 'FINISH_TIMER':
        if (isActive) {
          isActive = false; endTime = null; timeLeft = defaultTime;
          saveState(); stopAlarm(); broadcastSleep();
          showCompletionNotification();
        }
        sendResponse({ success: true });
        break;
    }
  });
  return true;
});

function normalizeSite(site: string): string {
  let res = site.trim().toLowerCase();
  try {
    if (res.includes('://')) {
      res = new URL(res).hostname;
    } else if (res.includes('/')) {
      res = res.split('/')[0];
    }
  } catch {
    // Keep as is if parsing fails
  }
  return res.replace(/^www\./, '');
}

function saveState() {
  chrome.storage.local.set({ 
    blocklist, mode, timeLeft, isActive, endTime,
    blockAI, blockCommon, strictSubdomains, blockYouTube,
    noBreaks, defaultTime
  });
}

function startAlarm() {
  chrome.alarms.create('sandman-heartbeat', { periodInMinutes: 1 });
}

function stopAlarm() {
  chrome.alarms.clear('sandman-heartbeat');
}

chrome.alarms.onAlarm.addListener(() => {
  ensureInit().then(() => {
    if (isActive && endTime) {
      const now = Date.now();
      if (now >= endTime - 500) { // Buffer to account for timer precision
        isActive = false; endTime = null; timeLeft = defaultTime;
        saveState(); stopAlarm(); broadcastSleep();
        showCompletionNotification();
      } else {
        timeLeft = Math.max(0, Math.ceil((endTime - now) / 1000));
        saveState(); broadcastSleep();
      }
    }
  });
});

function showCompletionNotification() {
  chrome.notifications.create({
    type: 'basic', iconUrl: '/favicon.svg',
    title: 'Time is up!', message: 'Your focus session has ended.', priority: 2
  });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if ((changeInfo.status === 'complete' || changeInfo.url) && tab.url) {
    ensureInit().then(() => {
      const isDistracting = checkIsDistracting(tab.url);
      const currentRemaining = isActive && endTime ? Math.max(0, Math.ceil((endTime - Date.now()) / 1000)) : timeLeft;
      chrome.tabs.sendMessage(tabId, { 
        type: 'UPDATE_SLEEP', isAsleep: isDistracting, isActive, timeLeft: currentRemaining,
        endTime, blocklist, mode, settings: { blockAI, blockCommon, strictSubdomains, blockYouTube, noBreaks, defaultTime }
      }).catch(() => {});
    });
  }
});

function checkIsDistracting(url: string | undefined): boolean {
  if (!url) return false;
  let hostname = '';
  try { hostname = new URL(url).hostname; } catch { hostname = url; }
  if (!hostname || hostname.startsWith('chrome') || hostname.startsWith('about') || hostname.startsWith('edge') || hostname.startsWith('chrome-extension')) return false;

  const normalizedHostname = hostname.replace(/^www\./, '');

  const isMatch = (site: string) => {
    const normalizedSite = site.replace(/^www\./, '');
    if (strictSubdomains) {
      return normalizedHostname === normalizedSite;
    } else {
      return normalizedHostname === normalizedSite || normalizedHostname.endsWith('.' + normalizedSite);
    }
  };

  if (mode === 'whitelist') {
    return !blocklist.some(isMatch);
  } else {
    const isSpecialDistraction = (blockCommon && commonDistractions.some(isMatch)) || (blockAI && aiSites.some(isMatch));
    const isCustomMatch = blocklist.some(isMatch);
    return isSpecialDistraction || isCustomMatch;
  }
}

let lastBroadcastTime = 0;
function broadcastSleep() {
  const now = Date.now();
  const currentRemaining = isActive && endTime ? Math.max(0, Math.ceil((endTime - now) / 1000)) : timeLeft;
  const stateUpdate = { 
    type: 'UPDATE_SLEEP', isActive, timeLeft: currentRemaining, endTime,
    mode, blocklist, settings: { blockAI, blockCommon, strictSubdomains, blockYouTube, noBreaks, defaultTime }
  };

  // Only broadcast if something changed or it's been a while (reduce jitter)
  chrome.runtime.sendMessage(stateUpdate).catch(() => {});
  
  // Throttle TICK messages to once per second roughly
  if (now - lastBroadcastTime > 900) {
    chrome.runtime.sendMessage({ type: 'TICK', timeLeft: currentRemaining }).catch(() => {});
    lastBroadcastTime = now;
  }
  
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (!tab.id) return;
      const isDistracting = checkIsDistracting(tab.url);
      chrome.tabs.sendMessage(tab.id, { ...stateUpdate, isAsleep: isDistracting }).catch(() => {});
    });
  });
}
