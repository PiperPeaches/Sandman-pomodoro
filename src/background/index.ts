// src/background/index.ts

let timeLeft = 25 * 60;
let isActive = false;
let timerInterval: number | null = null;
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

// Initialize from storage
chrome.storage.local.get(['blocklist'], (result) => {
  if (result.blocklist && Array.isArray(result.blocklist)) {
    blocklist = result.blocklist;
  } else {
    chrome.storage.local.set({ blocklist });
  }
});

interface TimerMessage {
  type: string;
  timeLeft?: number;
  isActive?: boolean;
  site?: string;
}

chrome.runtime.onMessage.addListener((message: TimerMessage, _sender, sendResponse) => {
  if (message.type === 'GET_STATE') {
    sendResponse({ timeLeft, isActive, blocklist });
  } else if (message.type === 'START_TIMER') {
    isActive = true;
    startCounting();
    broadcastSleep();
  } else if (message.type === 'PAUSE_TIMER') {
    isActive = false;
    stopCounting();
    broadcastSleep();
  } else if (message.type === 'RESET_TIMER') {
    isActive = false;
    timeLeft = 25 * 60;
    stopCounting();
    broadcastSleep();
  } else if (message.type === 'ADD_BLOCK') {
    if (message.site && !blocklist.includes(message.site)) {
      blocklist.push(message.site);
      chrome.storage.local.set({ blocklist });
      broadcastSleep();
      sendResponse({ blocklist });
    }
  } else if (message.type === 'REMOVE_BLOCK') {
    if (message.site) {
      blocklist = blocklist.filter(s => s !== message.site);
      chrome.storage.local.set({ blocklist });
      broadcastSleep();
      sendResponse({ blocklist });
    }
  }
  return true;
});

// Ensure tabs stay asleep on refresh or new navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const isDistracting = blocklist.some(site => tab.url?.includes(site));
    chrome.tabs.sendMessage(tabId, { 
      type: 'UPDATE_SLEEP', 
      isAsleep: isDistracting, 
      isActive, 
      timeLeft 
    }).catch(() => {});
  }
});

function startCounting() {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    if (timeLeft > 0) {
      timeLeft--;
      chrome.runtime.sendMessage({ type: 'TICK', timeLeft }).catch(() => {});
      broadcastToTabs({ type: 'TICK', timeLeft });
    } else {
      stopCounting();
      isActive = false;
      broadcastSleep();
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '/favicon.svg',
        title: 'Time is up!',
        message: 'Your focus session has ended.',
        priority: 2
      });
    }
  }, 1000) as unknown as number;
}

function stopCounting() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function broadcastSleep() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id && tab.url) {
        const isDistracting = blocklist.some(site => tab.url?.includes(site));
        chrome.tabs.sendMessage(tab.id, { 
          type: 'UPDATE_SLEEP', 
          isAsleep: isDistracting, 
          isActive, 
          timeLeft 
        }).catch(() => {});
      }
    });
  });
}

function broadcastToTabs(message: any) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {});
      }
    });
  });
}
