import { useState, useEffect, useCallback } from "react";
import "./App.css";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { 
  faYoutube 
} from '@fortawesome/free-brands-svg-icons';
import { 
  faRobot, 
  faChartLine, 
  faLock, 
  faMoon, 
  faPlay, 
  faPause, 
  faUndo, 
  faTimes,
  faClock,
  faLockOpen,
  faLock as faLockSolid,
  faUser,
  faUsers,
  faHouse,
  faRightFromBracket,
  faArrowsRotate,
  faBug
} from '@fortawesome/free-solid-svg-icons';

/**
 * Sandman Popup Application - Samsung One UI Style
 */

const driftPhrases: string[] = [
  "Time is drifting away...",
  "The sand falls softly...",
  "Moments lost in sleep...",
  "Fading into the mist...",
  "Quiet your mind, sharpen your soul...",
  "The dream world is calling, but focus remains...",
  "Let the world fade into the background...",
  "One grain of sand at a time...",
  "Floating in the sea of deep work...",
  "The stars are aligning for your productivity...",
  "Embrace the silence of the mist...",
  "A dream within a focus session...",
  "Soft echoes of a distant goal...",
  "Wrapped in a blanket of stillness...",
  "The mist clears only for your progress...",
  "Drifting through the ocean of thought...",
  "Your journey through the sand begins...",
  "Wait for the sand to settle...",
  "Focus is the bridge to your dreams...",
];

interface TimerState {
  timeLeft: number;
  isActive: boolean;
  blocklist: string[];
  mode: 'blacklist' | 'whitelist';
  endTime: number | null;
  settings?: {
    blockAI: boolean;
    blockCommon: boolean;
    strictSubdomains: boolean;
    blockYouTube: boolean;
    noBreaks: boolean;
    defaultTime: number;
    username: string;
    totalFocusTime: number;
  };
}

interface OnlineData {
  leaderboard: { username: string; total_focus_time: number; status?: 'focused' | 'online' | 'offline' }[];
  liveUsers: { username: string; status: 'focused' | 'online' | 'offline' }[];
  status: string;
  session?: { user: { id: string; email?: string } }; 
  userRank?: number;
  errorMessage?: string;
}

const SettingItem = ({ label, icon, value, onToggle, disabled }: { label: string, icon: IconDefinition, value: boolean, onToggle: () => void, disabled?: boolean }) => (
  <div className={`setting-list-item ${disabled ? 'disabled-item' : ''}`} onClick={disabled ? undefined : onToggle}>
    <div className="setting-info">
      <div className={`icon-squircle ${(value && !disabled) ? 'icon-squircle-active' : ''}`}>
        <FontAwesomeIcon icon={icon} fixedWidth />
      </div>
      <span className="setting-label">{label}</span>
    </div>
    <div className={`toggle ${(value && !disabled) ? 'toggle-active' : ''}`} />
  </div>
);

function App() {
  const [activeTab, setActiveTab] = useState<'focus' | 'community' | 'debug'>('focus');
  const [debugClicks, setDebugClicks] = useState(0);
  const [isDebugUnlocked, setDebugUnlocked] = useState(false);

  const [displayPhrase] = useState(() => {
    const randomIndex = Math.floor(Math.random() * driftPhrases.length);
    return driftPhrases[randomIndex];
  });

  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [defaultTime, setDefaultTime] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [blocklist, setBlocklist] = useState<string[]>([]);
  const [mode, setMode] = useState<'blacklist' | 'whitelist'>('blacklist');
  const [newSite, setNewSite] = useState("");

  const [blockAI, setBlockAI] = useState(false);
  const [blockCommon, setBlockCommon] = useState(true);
  const [strictSubdomains, setStrictSubdomains] = useState(false);
  const [blockYouTube, setBlockYouTube] = useState(false);
  const [noBreaks, setNoBreaks] = useState(false);
  const [username, setUsername] = useState('Dreamer');
  const [totalFocusTime, setTotalFocusTime] = useState(0);

  const [onlineData, setOnlineData] = useState<OnlineData>({ leaderboard: [], liveUsers: [], status: 'loading' });

  const isLocked = isActive && noBreaks;
  const isSignedIn = !!onlineData.session;

  const fetchOnline = useCallback(() => {
    setOnlineData(prev => ({ ...prev, status: 'loading' }));
    chrome.runtime.sendMessage({ type: 'GET_ONLINE_DATA' }, (response: OnlineData) => {
      if (response) setOnlineData(response);
    });
  }, []);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response: TimerState) => {
      if (response) {
        setTimeLeft(response.timeLeft);
        setIsActive(response.isActive);
        setBlocklist(response.blocklist || []);
        setMode(response.mode || 'blacklist');
        setEndTime(response.endTime || null);
        if (response.settings) {
          setBlockAI(!!response.settings.blockAI);
          setBlockCommon(!!response.settings.blockCommon);
          setStrictSubdomains(!!response.settings.strictSubdomains);
          setBlockYouTube(!!response.settings.blockYouTube);
          setNoBreaks(!!response.settings.noBreaks);
          setDefaultTime(response.settings.defaultTime || 25 * 60);
          setUsername(response.settings.username || 'Dreamer');
          setTotalFocusTime(response.settings.totalFocusTime || 0);
        }
      }
    });

    const listener = (message: { 
      type: string; 
      timeLeft?: number; 
      isActive?: boolean; 
      endTime?: number | null; 
      mode?: 'blacklist' | 'whitelist'; 
      blocklist?: string[]; 
      settings?: TimerState['settings'];
    }) => {
      if (message.type === 'TICK' && message.timeLeft !== undefined) {
        setTimeLeft(message.timeLeft);
      } else if (message.type === 'UPDATE_SLEEP') {
        setIsActive(!!message.isActive);
        setEndTime(message.endTime || null);
        if (message.timeLeft !== undefined) setTimeLeft(message.timeLeft);
        setMode(message.mode || 'blacklist');
        if (message.blocklist) setBlocklist(message.blocklist);
        if (message.settings) {
          setBlockAI(!!message.settings.blockAI);
          setBlockCommon(!!message.settings.blockCommon);
          setStrictSubdomains(!!message.settings.strictSubdomains);
          setBlockYouTube(!!message.settings.blockYouTube);
          setNoBreaks(!!message.settings.noBreaks);
          setDefaultTime(message.settings.defaultTime || 25 * 60);
          setUsername(message.settings.username || 'Dreamer');
          setTotalFocusTime(message.settings.totalFocusTime || 0);
        }
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchOnline();
    }, 0);
    const interval = setInterval(fetchOnline, 10000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [fetchOnline]);

  useEffect(() => {
    if (!isActive || !endTime) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        setIsActive(false);
        setEndTime(null);
        setTimeLeft(defaultTime);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive, endTime, defaultTime]);

  const toggleTimer = () => {
    if (isActive) {
      if (isLocked) return;
      setIsActive(false);
      setEndTime(null);
      chrome.runtime.sendMessage({ type: 'PAUSE_TIMER' });
    } else {
      const newEndTime = Date.now() + (timeLeft * 1000);
      chrome.runtime.sendMessage({ type: 'START_TIMER' }, (response: { success: boolean; error?: string }) => {
        if (response && response.success) {
          setEndTime(newEndTime);
          setIsActive(true);
        } else if (response && response.error) {
          alert(response.error);
        }
      });
    }
  };
  
  const resetTimer = () => {
    if (isLocked) return;
    setIsActive(false);
    setEndTime(null);
    setTimeLeft(defaultTime);
    chrome.runtime.sendMessage({ type: 'RESET_TIMER' });
  };

  const toggleMode = () => {
    if (isLocked) return;
    const newMode = mode === 'blacklist' ? 'whitelist' : 'blacklist';
    setMode(newMode);
    chrome.runtime.sendMessage({ type: 'SET_MODE', mode: newMode });
  };

  const updateSetting = (key: string, value: string | number | boolean) => {
    if (isLocked) return;
    if (key === 'blockAI' && typeof value === 'boolean') setBlockAI(value);
    if (key === 'blockCommon' && typeof value === 'boolean') setBlockCommon(value);
    if (key === 'strictSubdomains' && typeof value === 'boolean') setStrictSubdomains(value);
    if (key === 'blockYouTube' && typeof value === 'boolean') setBlockYouTube(value);
    if (key === 'noBreaks' && typeof value === 'boolean') setNoBreaks(value);
    if (key === 'username' && typeof value === 'string') setUsername(value);
    if (key === 'defaultTime' && typeof value === 'number') {
      setDefaultTime(value);
      if (!isActive) setTimeLeft(value);
    }

    chrome.runtime.sendMessage({ 
      type: 'UPDATE_SETTINGS', 
      settings: { [key]: value } 
    });
  };

  const handleProfileClick = () => {
    const newCount = debugClicks + 1;
    setDebugClicks(newCount);
    if (newCount === 10) {
      setDebugUnlocked(true);
      alert("Debug Mode Unlocked!");
    }
  };

  const openAuthPage = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('auth.html') });
  };

  const signOut = () => {
    chrome.runtime.sendMessage({ type: 'SIGN_OUT' });
  };

  const addSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;
    if (newSite.trim()) {
      let site = newSite.trim().toLowerCase();
      try {
        if (site.includes('://')) {
          site = new URL(site).hostname;
        } else if (site.includes('/')) {
          site = site.split('/')[0];
        }
      } catch {
        // Fallback to raw input
      }
      site = site.replace(/^www\./, '');
      
      if (site && !blocklist.includes(site)) {
        setBlocklist(prev => [...prev, site]);
        chrome.runtime.sendMessage({ type: 'ADD_BLOCK', site });
      }
      setNewSite("");
    }
  };

  const removeSite = (site: string) => {
    if (isLocked) return;
    setBlocklist(prev => prev.filter(s => s !== site));
    chrome.runtime.sendMessage({ type: 'REMOVE_BLOCK', site });
  };

  const formatTime = (seconds: number, padHours = false) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0 || padHours) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="container">
      {/* Header Bar */}
      <div className="header-bar">
        <span>THE SANDMAN</span>
        <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      <div className="content-scroll-area">
        {activeTab === 'focus' ? (
          <>
            {/* Viewing Area */}
            <div className="viewing-area">
              <h1 className="header-title">Lock In</h1>
              <div className="timer-display">
                {formatTime(timeLeft)}
              </div>
              <div className="phrase-display">
                {isLocked ? "Session Locked" : displayPhrase}
              </div>
            </div>

            {/* Interaction Area */}
            <div className="interaction-area">
              {/* Main Actions Card */}
              <div className="main-action-area">
                <button 
                  onClick={toggleTimer} 
                  className={`btn-pill ${isLocked ? 'btn-gray disabled-btn' : 'btn-blue'}`}
                  disabled={isLocked}
                >
                  <FontAwesomeIcon icon={isActive ? faPause : faPlay} style={{ marginRight: '8px' }} />
                  {isActive ? "Pause Focus" : "Start Session"}
                </button>
                <button 
                  onClick={resetTimer} 
                  className={`btn-pill btn-gray ${isLocked ? 'disabled-btn' : ''}`}
                  disabled={isLocked}
                >
                  <FontAwesomeIcon icon={faUndo} style={{ marginRight: '8px' }} />
                  Reset Timer
                </button>
              </div>

              {/* Custom Time Card */}
              <div className={`card ${isLocked ? 'card-disabled' : ''}`}>
                <h3 className="card-title">Timer Duration</h3>
                <div className="setting-list-item" style={{ cursor: 'default' }}>
                  <div className="setting-info">
                    <div className="icon-squircle">
                      <FontAwesomeIcon icon={faClock} fixedWidth />
                    </div>
                    <span className="setting-label">Minutes</span>
                  </div>
                  <input 
                    type="number" 
                    min="1" 
                    max="180"
                    value={Math.floor(defaultTime / 60)}
                    onChange={(e) => updateSetting('defaultTime', parseInt(e.target.value || '1') * 60)}
                    className="time-input"
                    disabled={isActive}
                  />
                </div>
              </div>

              {/* Preferences Card */}
              <div className={`card ${isLocked ? 'card-disabled' : ''}`}>
                <h3 className="card-title">Preferences</h3>
                <SettingItem 
                  label="No Breaks (Lock-in)" 
                  icon={noBreaks ? faLockSolid : faLockOpen} 
                  value={noBreaks} 
                  onToggle={() => updateSetting('noBreaks', !noBreaks)} 
                  disabled={isActive}
                />
                <SettingItem 
                  label="Block all YouTube" 
                  icon={faYoutube} 
                  value={blockYouTube} 
                  onToggle={() => updateSetting('blockYouTube', !blockYouTube)} 
                  disabled={isLocked}
                />
                <SettingItem 
                  label="No AI Assistants" 
                  icon={faRobot} 
                  value={blockAI} 
                  onToggle={() => updateSetting('blockAI', !blockAI)} 
                  disabled={isLocked}
                />
                <SettingItem 
                  label="Common Distractions" 
                  icon={faChartLine} 
                  value={blockCommon} 
                  onToggle={() => updateSetting('blockCommon', !blockCommon)} 
                  disabled={isLocked}
                />
                <SettingItem 
                  label="Strict Subdomains" 
                  icon={faLock} 
                  value={strictSubdomains} 
                  onToggle={() => updateSetting('strictSubdomains', !strictSubdomains)} 
                  disabled={isLocked} 
                />
              </div>

              {/* Mode Card */}
              <div className={`card ${isLocked ? 'card-disabled' : ''}`}>
                <h3 className="card-title">Filter Mode</h3>
                <div className="setting-list-item" onClick={toggleMode}>
                  <div className="setting-info">
                    <div className="icon-squircle icon-squircle-active">
                      <FontAwesomeIcon icon={faMoon} fixedWidth />
                    </div>
                    <span className="setting-label">{mode === 'blacklist' ? 'Distractions' : 'Allowed Only'}</span>
                  </div>
                  <span style={{ color: isLocked ? '#8E8E93' : 'var(--accent-color)', fontWeight: '700', fontSize: '0.8rem' }}>
                    {isLocked ? 'LOCKED' : 'CHANGE'}
                  </span>
                </div>
              </div>

              {/* Blocklist Card */}
              <div className={`card blocklist-card ${isLocked ? 'card-disabled' : ''}`}>
                <div className="blocklist-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 className="card-title" style={{ margin: 0 }}>{mode === 'blacklist' ? 'Blocklist' : 'Whitelist'}</h3>
                  {!isLocked && (
                    <button onClick={toggleMode} style={{ background: 'transparent', border: 'none', color: 'var(--accent-color)', fontWeight: '800', fontSize: '0.75rem', cursor: 'pointer' }}>
                      SWITCH
                    </button>
                  )}
                </div>
                
                {!isLocked && (
                  <form onSubmit={addSite} className="add-input-row" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    <input 
                      type="text" 
                      placeholder="Add site..." 
                      value={newSite}
                      onChange={(e) => setNewSite(e.target.value)}
                      style={{ flex: 1, padding: '10px', borderRadius: '12px', background: '#2C2C2E', border: 'none', color: 'white' }}
                    />
                    <button type="submit" style={{ background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '12px', width: '40px', cursor: 'pointer' }}>+</button>
                  </form>
                )}

                <div className="site-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {blocklist.map(site => (
                    <div key={site} className="site-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: '14px' }}>
                      <span style={{ fontSize: '0.9rem' }}>{site}</span>
                      <button onClick={() => removeSite(site)} disabled={isLocked} style={{ background: 'transparent', border: 'none', color: '#FF453A', cursor: 'pointer' }}>
                        <FontAwesomeIcon icon={faTimes} />
                      </button>
                    </div>
                  ))}
                  {blocklist.length === 0 && <div style={{ fontSize: '0.8rem', opacity: 0.4, textAlign: 'center', padding: '10px' }}>List is empty</div>}
                </div>
              </div>
            </div>
          </>
        ) : activeTab === 'community' ? (
          <div className="interaction-area" style={{ paddingTop: '24px' }}>
            <h1 className="header-title" style={{ marginBottom: '24px' }}>Community</h1>
            
            {/* Auth / Profile Card */}
            <div className="card">
              {!isSignedIn ? (
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <div 
                    className="icon-squircle" 
                    style={{ margin: '0 auto 16px auto', width: '64px', height: '64px', fontSize: '1.8rem', cursor: 'pointer' }}
                    onClick={handleProfileClick}
                  >
                    <FontAwesomeIcon icon={faUser} />
                  </div>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '1.25rem' }}>Join the Dream</h3>
                  <p style={{ margin: '0 0 24px 0', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    Connect with other focusers and track progress.
                  </p>
                  <button onClick={openAuthPage} className="btn-pill btn-blue">
                     Sign In / Up
                  </button>
                </div>
              ) : (
                <>
                  <div className="setting-list-item" style={{ cursor: 'default' }}>
                    <div className="setting-info">
                      <div className="icon-squircle icon-squircle-active" onClick={handleProfileClick} style={{ cursor: 'pointer' }}>
                        <FontAwesomeIcon icon={faUser} fixedWidth />
                      </div>
                      <input 
                        type="text" 
                        value={username}
                        onChange={(e) => updateSetting('username', e.target.value)}
                        className="username-input"
                        placeholder="Username"
                        disabled={isLocked}
                      />
                    </div>
                    <button onClick={signOut} style={{ background: 'transparent', border: 'none', color: '#FF453A', padding: '10px', cursor: 'pointer' }}>
                       <FontAwesomeIcon icon={faRightFromBracket} />
                    </button>
                  </div>
                  <div className="community-stats-row">
                    <div className="stat-box">
                      <span className="stat-label">Focused</span>
                      <span className="stat-value">{formatTime(totalFocusTime)}</span>
                    </div>
                    <div className="stat-box">
                      <span className="stat-label">Rank</span>
                      <span className="stat-value">#{onlineData.userRank || '--'}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Honor System Policy */}
            <div className="card">
               <h3 className="card-title">Lock-in Guidelines</h3>
               <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: '0' }}>
                 Sandman is built on trust. Please don't ruin the fun by farming focus time while AFK. Real progress comes from real work.
               </p>
            </div>

            {/* Live Presence Card */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 className="card-title" style={{ margin: 0 }}>Live Presence</h3>
                <span style={{ fontSize: '0.7rem', color: '#34C759', fontWeight: 800 }}>
                  {onlineData.liveUsers.filter(u => u.status !== 'offline').length} ACTIVE
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {onlineData.liveUsers.length > 0 ? onlineData.liveUsers.map(u => (
                  <div key={u.username} className="live-user-tag">
                    <div style={{ 
                      width: '6px', height: '6px', borderRadius: '50%',
                      backgroundColor: u.status === 'focused' ? '#34C759' : (u.status === 'online' ? 'var(--accent-color)' : '#8E8E93')
                    }}></div>
                    {u.username}
                  </div>
                )) : <div style={{ fontSize: '0.8rem', opacity: 0.4 }}>Quiet...</div>}
              </div>
            </div>

            {/* Leaderboard Card */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 className="card-title" style={{ margin: 0 }}>Global Rankings</h3>
                <FontAwesomeIcon icon={faArrowsRotate} style={{ fontSize: '0.9rem', opacity: 0.5, cursor: 'pointer' }} onClick={fetchOnline} spin={onlineData.status === 'loading'} />
              </div>
              <div className="leaderboard-list">
                {onlineData.leaderboard.length > 0 ? onlineData.leaderboard.map((user, i) => (
                  <div key={user.username} className="leader-item">
                    <span className="leader-rank">{i + 1}</span>
                    <span className="leader-name">{user.username}</span>
                    <span className="leader-time">{formatTime(user.total_focus_time)}</span>
                  </div>
                )) : <div style={{ padding: '10px', textAlign: 'center', fontSize: '0.85rem' }}>No data</div>}
              </div>
            </div>
          </div>
        ) : (
          <div className="interaction-area" style={{ paddingTop: '24px' }}>
            <h1 className="header-title" style={{ marginBottom: '24px' }}>Debug Console</h1>
            <div className="card">
               <h3 className="card-title">Timer Actions</h3>
               <button onClick={() => chrome.runtime.sendMessage({ type: 'FINISH_TIMER' }).then(() => { setEndTime(null); setIsActive(false); setTimeLeft(defaultTime); })} className="btn-pill btn-gray" style={{ padding: '10px', backgroundColor: 'rgba(255, 69, 58, 0.15)', color: '#FF453A', border: '1px solid rgba(255, 69, 58, 0.3)' }}>
                 Stop Now (Test Finish)
               </button>
            </div>
            <div className="card">
               <h3 className="card-title">Presence Sync</h3>
               <button onClick={fetchOnline} className="btn-pill btn-gray" style={{ padding: '10px' }}>
                 Force Sync Presence
               </button>
            </div>
            <div className="card">
               <h3 className="card-title">System Status</h3>
               <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>State:</span>
                  <span style={{ color: isActive ? '#34C759' : 'var(--text-secondary)' }}>{isActive ? 'Active' : 'Idle'}</span>
               </div>
               <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>User:</span>
                  <span>{username}</span>
               </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Bottom Nav Bar */}
      <div className="bottom-nav">
        <div 
          className={`nav-item ${activeTab === 'focus' ? 'nav-item-active' : ''}`} 
          onClick={() => setActiveTab('focus')}
        >
          <FontAwesomeIcon icon={faHouse} size="lg" />
          <span>Focus</span>
        </div>
        <div 
          className={`nav-item ${activeTab === 'community' ? 'nav-item-active' : ''}`} 
          onClick={() => setActiveTab('community')}
        >
          <FontAwesomeIcon icon={faUsers} size="lg" />
          <span>Community</span>
        </div>
        {isDebugUnlocked && (
          <div 
            className={`nav-item ${activeTab === 'debug' ? 'nav-item-active' : ''}`} 
            onClick={() => setActiveTab('debug')}
          >
            <FontAwesomeIcon icon={faBug} size="lg" />
            <span>Debug</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
