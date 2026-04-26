import { supabase } from '../utils/supabase';

let timeLeft = 25 * 60; 
let defaultTime = 25 * 60;
let endTime: number | null = null; 
let isActive = false;
let mode: 'blacklist' | 'whitelist' = 'blacklist';
let blocklist: string[] = [];

// Settings & Profile
let blockAI = false;
let blockCommon = true;
let strictSubdomains = false;
let blockYouTube = false;
let noBreaks = false;
let username = 'Dreamer';
let totalFocusTime = 0; // in seconds

let backgroundAudio: HTMLAudioElement | null = null;

async function createOffscreen() {
  if (typeof chrome.offscreen === 'undefined') return;
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
    justification: 'Playback of timer start/end sounds'
  });
}

async function playAudio(url: string) {
  if (typeof chrome.offscreen !== 'undefined') {
    try {
      await createOffscreen();
      setTimeout(() => {
        chrome.runtime.sendMessage({ type: 'PLAY_AUDIO', url }).catch(() => {});
      }, 200);
    } catch (e) {
      console.error('Failed to create offscreen document for audio', e);
      fallbackPlayAudio(url);
    }
  } else {
    fallbackPlayAudio(url);
  }
}

function fallbackPlayAudio(url: string) {
  try {
    if (backgroundAudio) {
      backgroundAudio.pause();
      backgroundAudio = null;
    }
    backgroundAudio = new Audio(url);
    backgroundAudio.play().catch(err => {
      console.warn("Autoplay blocked in background. Audio will play upon next interaction.", err);
    });
  } catch (e) {
    console.error("Audio playback error:", e);
  }
}

async function stopAudio() {
  if (backgroundAudio) {
    backgroundAudio.pause();
    backgroundAudio.currentTime = 0;
    backgroundAudio = null;
  }

  if (typeof chrome.offscreen !== 'undefined' && await chrome.offscreen.hasDocument()) {
    chrome.runtime.sendMessage({ type: 'STOP_AUDIO' }).catch(() => {});
  }
}

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
    'noBreaks', 'defaultTime', 'username', 'totalFocusTime'
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
    if (typeof result.username === 'string') username = result.username;
    if (typeof result.totalFocusTime === 'number') totalFocusTime = result.totalFocusTime;

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
    syncProfileToSupabase();
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
    username?: string;
    idleInterval?: number;
  };
}

chrome.runtime.onMessage.addListener((message: TimerMessage, _sender, sendResponse) => {
  ensureInit().then(() => {
    switch (message.type) {
      case 'GET_STATE': {
        const currentRemaining = isActive && endTime ? Math.max(0, Math.ceil((endTime - Date.now()) / 1000)) : timeLeft;
        sendResponse({ 
          timeLeft: currentRemaining, isActive, blocklist, mode, endTime,
          settings: { 
            blockAI, blockCommon, strictSubdomains, blockYouTube, 
            noBreaks, defaultTime, username, totalFocusTime 
          }
        });
        break;
      }
      case 'START_TIMER':
        if (!hasActiveBlocks()) {
          sendResponse({ success: false, error: 'Anti-Cheat: You must have at least one block active to start focusing.' });
          break;
        }
        
        isActive = true;
        endTime = Date.now() + (timeLeft * 1000);
        saveState(); startAlarm(); broadcastSleep();
        updatePresence(true);
        playAudio(chrome.runtime.getURL('audio/start.mp3'));
        sendResponse({ success: true, endTime });
        break;
      case 'PAUSE_TIMER':
        if (noBreaks && isActive) {
          sendResponse({ success: false, error: 'No Breaks mode is active' });
          break;
        }
        pauseTimerInternal();
        stopAudio();
        sendResponse({ success: true, timeLeft });
        break;
      case 'STOP_AUDIO':
        stopAudio();
        broadcastHideStopPopup();
        sendResponse({ success: true });
        break;
      case 'RESET_TIMER':
        if (noBreaks && isActive) {
          sendResponse({ success: false, error: 'No Breaks mode is active' });
          break;
        }
        isActive = false; timeLeft = defaultTime; endTime = null;
        saveState(); stopAlarm(); broadcastSleep();
        updatePresence(false);
        stopAudio();
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
          if (noBreaks && isActive && (message.settings.noBreaks === undefined)) {
             sendResponse({ success: false, error: 'No Breaks mode is active' });
             break;
          }

          if (message.settings.blockAI !== undefined) blockAI = message.settings.blockAI;
          if (message.settings.blockCommon !== undefined) blockCommon = message.settings.blockCommon;
          if (message.settings.strictSubdomains !== undefined) strictSubdomains = message.settings.strictSubdomains;
          if (message.settings.blockYouTube !== undefined) blockYouTube = message.settings.blockYouTube;
          if (message.settings.noBreaks !== undefined) noBreaks = message.settings.noBreaks;
          if (message.settings.username !== undefined) {
             username = message.settings.username;
             syncProfileToSupabase();
          }
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
          finishTimerInternal();
        }
        sendResponse({ success: true });
        break;
      case 'SIGN_OUT':
        supabase?.auth.signOut().then(() => {
          broadcastSleep();
        });
        sendResponse({ success: true });
        break;
      case 'GET_ONLINE_DATA':
        fetchOnlineData().then(data => sendResponse(data));
        return true; 
    }
  });
  return true;
});

function finishTimerInternal() {
  const sessionTime = defaultTime;
  totalFocusTime += sessionTime;
  isActive = false; endTime = null; timeLeft = defaultTime;
  saveState(); stopAlarm(); broadcastSleep();
  updatePresence(false);
  syncProfileToSupabase();
  showCompletionNotification();
  playAudio(chrome.runtime.getURL('audio/end.mp3'));
  broadcastSessionComplete();
}

function pauseTimerInternal() {
  if (isActive && endTime) timeLeft = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
  isActive = false; endTime = null;
  saveState(); stopAlarm(); broadcastSleep();
  updatePresence(false);
}

if (supabase) {
  supabase.auth.onAuthStateChange((_event, session) => {
    broadcastSleep();
    if (session?.user) {
      syncProfileToSupabase();
    }
  });
}

async function syncProfileToSupabase() {
  if (!supabase) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;

  try {
    const { data: existingUser } = await supabase
      .from('users')
      .select('username, total_focus_time')
      .eq('id', session.user.id)
      .maybeSingle();

    let finalUsername = username;
    let finalTotalTime = totalFocusTime;

    if (existingUser) {
      finalUsername = existingUser.username || session.user.user_metadata?.username || username;
      finalTotalTime = Math.max(totalFocusTime, existingUser.total_focus_time || 0);
      
      if (finalUsername !== username || finalTotalTime !== totalFocusTime) {
        username = finalUsername;
        totalFocusTime = finalTotalTime;
        saveState();
        broadcastSleep();
      }
    } else if (session.user.user_metadata?.username) {
      username = session.user.user_metadata.username;
      finalUsername = username;
      saveState();
      broadcastSleep();
    }

    await supabase
      .from('users')
      .upsert({ 
        id: session.user.id, 
        username: finalUsername, 
        total_focus_time: finalTotalTime,
        is_active: isActive,
        last_active: new Date().toISOString(),
        last_seen: new Date().toISOString()
      }, { onConflict: 'id' });
  } catch (e) {
    console.error('Supabase Sync Exception:', e);
  }
}

async function updatePresence(is_active: boolean) {
  if (!supabase) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;

  try {
    await supabase
      .from('users')
      .update({ 
        is_active, 
        last_active: new Date().toISOString(),
        last_seen: new Date().toISOString()
      })
      .eq('id', session.user.id);
  } catch {
    /* ignore activity update errors */
  }
}

async function fetchOnlineData() {
  if (!supabase) return { liveUsers: [], leaderboard: [], status: 'no_config', userRank: 0 };
  const { data: { session } } = await supabase.auth.getSession();

  try {
    // 1. Fetch Leaderboard
    const { data: leaderboard, error: lError } = await supabase
      .from('users')
      .select('username, total_focus_time, is_active, last_seen')
      .order('total_focus_time', { ascending: false })
      .limit(10);
    
    if (lError) throw new Error(`Leaderboard: ${lError.message}`);

    // 2. Fetch Recent/Live Users
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: allUsers, error: vError } = await supabase
      .from('users')
      .select('username, is_active, last_seen')
      .order('last_seen', { ascending: false })
      .limit(20);
    
    if (vError) throw new Error(`Live Users: ${vError.message}`);

    const liveUsers = (allUsers || []).map(u => ({
       username: u.username,
       status: u.is_active ? 'focused' : (u.last_seen > fiveMinsAgo ? 'online' : 'offline')
    }));

    // 3. Calculate Rank
    let userRank = 0;
    if (session?.user) {
      const { count, error: rError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gt('total_focus_time', totalFocusTime);
      
      if (!rError) userRank = (count || 0) + 1;
      
      // Auto-sync heartbeat while page is open
      updatePresence(isActive);
    }

    return { 
      leaderboard: (leaderboard || []).map(u => ({
        ...u,
        status: u.is_active ? 'focused' : (u.last_seen > fiveMinsAgo ? 'online' : 'offline')
      })), 
      liveUsers,
      status: 'ok',
      session,
      userRank
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('Online Fetch Error:', message);
    return { liveUsers: [], leaderboard: [], status: 'error', errorMessage: message, session, userRank: 0 };
  }
}

function normalizeSite(site: string): string {
  let res = site.trim().toLowerCase();
  try {
    if (res.includes('://')) {
      res = new URL(res).hostname;
    } else if (res.includes('/')) {
      res = res.split('/')[0];
    }
  } catch {
    /* ignore URL parsing errors */
  }
  return res.replace(/^www\./, '');
}

function saveState() {
  chrome.storage.local.set({ 
    blocklist, mode, timeLeft, isActive, endTime,
    blockAI, blockCommon, strictSubdomains, blockYouTube,
    noBreaks, defaultTime, username, totalFocusTime
  });
}

function startAlarm() {
  chrome.alarms.create('sandman-heartbeat', { periodInMinutes: 1 });
}

function stopAlarm() {
  chrome.alarms.clear('sandman-heartbeat');
}

function checkTimer() {
  if (isActive && endTime) {
    const now = Date.now();

    if (now >= endTime - 500) { 
      finishTimerInternal();
    } else {
      timeLeft = Math.max(0, Math.ceil((endTime - now) / 1000));
      saveState(); broadcastSleep();
    }
  }
}

setInterval(checkTimer, 1000);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'sandman-heartbeat') {
    ensureInit().then(() => {
      updatePresence(isActive);
      checkTimer();
    });
  }
});

function showCompletionNotification() {
  chrome.notifications.create({
    type: 'basic', iconUrl: '/favicon.svg',
    title: 'Time is up!', message: 'Your focus session has ended.', priority: 2
  });
}

function broadcastSessionComplete() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'SESSION_COMPLETE' }).catch(() => {});
      }
    });
  });
}

function broadcastHideStopPopup() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'HIDE_STOP_POPUP' }).catch(() => {});
      }
    });
  });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if ((changeInfo.status === 'complete' || changeInfo.url) && tab.url) {
    ensureInit().then(() => {
      const isDistracting = checkIsDistracting(tab.url);
      const currentRemaining = isActive && endTime ? Math.max(0, Math.ceil((endTime - Date.now()) / 1000)) : timeLeft;
      chrome.tabs.sendMessage(tabId, { 
        type: 'UPDATE_SLEEP', isAsleep: isDistracting, isActive, timeLeft: currentRemaining,
        endTime, blocklist, mode, settings: { 
          blockAI, blockCommon, strictSubdomains, blockYouTube, 
          noBreaks, defaultTime, username, totalFocusTime 
        }
      }).catch(() => {});
    });
  }
});

function checkIsDistracting(url: string | undefined): boolean {
  if (!url) return false;
  const hostname = (() => {
    try { return new URL(url).hostname; } catch { return url; }
  })();
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

// ANTI-CHEAT: Ensure at least one block is active
function hasActiveBlocks(): boolean {
  if (blockYouTube || blockAI || blockCommon) return true;
  if (mode === 'whitelist') return true;
  if (mode === 'blacklist' && blocklist.length > 0) return true;
  return false;
}

let lastBroadcastTime = 0;
function broadcastSleep() {
  const now = Date.now();
  const currentRemaining = isActive && endTime ? Math.max(0, Math.ceil((endTime - now) / 1000)) : timeLeft;
  const stateUpdate = { 
    type: 'UPDATE_SLEEP', isActive, timeLeft: currentRemaining, endTime,
    mode, blocklist, settings: { 
      blockAI, blockCommon, strictSubdomains, blockYouTube, 
      noBreaks, defaultTime, username, totalFocusTime 
    }
  };

  chrome.runtime.sendMessage(stateUpdate).catch(() => {});
  
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
