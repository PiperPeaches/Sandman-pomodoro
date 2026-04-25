// src/background/index.ts

let timeLeft = 25 * 60;
let isActive = false;
let isAsleep = false;
let timerInterval: number | null = null;

interface TimerMessage {
  type: 'GET_STATE' | 'START_TIMER' | 'PAUSE_TIMER' | 'RESET_TIMER' | 'TICK' | 'TOGGLE_SLEEP' | 'UPDATE_SLEEP';
  timeLeft?: number;
  isActive?: boolean;
  isAsleep?: boolean;
}

chrome.runtime.onMessage.addListener((message: TimerMessage, _sender, sendResponse) => {
  if (message.type === 'GET_STATE') {
    sendResponse({ timeLeft, isActive, isAsleep });
  } else if (message.type === 'START_TIMER') {
    isActive = true;
    startCounting();
    broadcastSleep(); // Update tabs when starting
  } else if (message.type === 'PAUSE_TIMER') {
    isActive = false;
    stopCounting();
    broadcastSleep(); // Update tabs when pausing
  } else if (message.type === 'RESET_TIMER') {
    isActive = false;
    timeLeft = 25 * 60;
    stopCounting();
    broadcastSleep(); // Update tabs when resetting
  } else if (message.type === 'TOGGLE_SLEEP') {
    isAsleep = !isAsleep;
    broadcastSleep();
    sendResponse({ isAsleep });
  }
  return true;
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
  broadcastToTabs({ type: 'UPDATE_SLEEP', isAsleep, isActive, timeLeft });
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
