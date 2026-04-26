import { useState, useEffect } from "react";
import "./App.css";

/**
 * Sandman Popup Application
 */

const driftPhrases: string[] = [
  "Time is drifting away...",
  "The sand falls softly...",
  "Moments lost in sleep...",
  "Fading into the mist...",
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
  };
}

function App() {
  const [displayPhrase] = useState(() => {
    const randomIndex = Math.floor(Math.random() * driftPhrases.length);
    return driftPhrases[randomIndex];
  });

  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [blocklist, setBlocklist] = useState<string[]>([]);
  const [mode, setMode] = useState<'blacklist' | 'whitelist'>('blacklist');
  const [newSite, setNewSite] = useState("");

  const [blockAI, setBlockAI] = useState(false);
  const [blockCommon, setBlockCommon] = useState(true);
  const [strictSubdomains, setStrictSubdomains] = useState(false);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response: TimerState) => {
      if (response) {
        setTimeLeft(response.timeLeft);
        setIsActive(response.isActive);
        setBlocklist(response.blocklist || []);
        setMode(response.mode || 'blacklist');
        setEndTime(response.endTime || null);
        if (response.settings) {
          setBlockAI(response.settings.blockAI);
          setBlockCommon(response.settings.blockCommon);
          setStrictSubdomains(response.settings.strictSubdomains);
        }
      }
    });

    const listener = (message: { 
      type: string; 
      timeLeft?: number; 
      isActive: boolean; 
      endTime: number | null; 
      mode: 'blacklist' | 'whitelist'; 
      blocklist: string[]; 
      settings: {
        blockAI: boolean;
        blockCommon: boolean;
        strictSubdomains: boolean;
      }
    }) => {
      if (message.type === 'TICK' && message.timeLeft !== undefined) {
        setTimeLeft(message.timeLeft);
      } else if (message.type === 'UPDATE_SLEEP') {
        setIsActive(message.isActive);
        setEndTime(message.endTime || null);
        if (message.timeLeft !== undefined) setTimeLeft(message.timeLeft);
        setMode(message.mode || 'blacklist');
        if (message.blocklist) setBlocklist(message.blocklist);
        if (message.settings) {
          setBlockAI(message.settings.blockAI);
          setBlockCommon(message.settings.blockCommon);
          setStrictSubdomains(message.settings.strictSubdomains);
        }
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  useEffect(() => {
    if (!isActive || !endTime) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        setIsActive(false);
        setEndTime(null);
        setTimeLeft(0);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive, endTime]);

  const toggleTimer = () => {
    if (isActive) {
      setIsActive(false);
      setEndTime(null);
      chrome.runtime.sendMessage({ type: 'PAUSE_TIMER' });
    } else {
      const newEndTime = Date.now() + (timeLeft * 1000);
      setEndTime(newEndTime);
      setIsActive(true);
      chrome.runtime.sendMessage({ type: 'START_TIMER' });
    }
  };
  
  const resetTimer = () => {
    setIsActive(false);
    setEndTime(null);
    setTimeLeft(25 * 60);
    chrome.runtime.sendMessage({ type: 'RESET_TIMER' });
  };

  const toggleMode = () => {
    const newMode = mode === 'blacklist' ? 'whitelist' : 'blacklist';
    setMode(newMode); // Optimistic UI
    chrome.runtime.sendMessage({ type: 'SET_MODE', mode: newMode });
  };

  const updateSetting = (key: string, value: boolean) => {
    // Optimistic UI updates
    if (key === 'blockAI') setBlockAI(value);
    if (key === 'blockCommon') setBlockCommon(value);
    if (key === 'strictSubdomains') setStrictSubdomains(value);

    chrome.runtime.sendMessage({ 
      type: 'UPDATE_SETTINGS', 
      settings: { [key]: value } 
    });
  };

  const addSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSite.trim()) {
      let site = newSite.trim().toLowerCase();
      try {
        if (site.includes('://')) {
          site = new URL(site).hostname;
        } else if (site.includes('/')) {
          site = site.split('/')[0];
        }
      } catch (err) {
        // use as is
      }
      site = site.replace(/^www\./, '');
      
      if (site && !blocklist.includes(site)) {
        setBlocklist(prev => [...prev, site]); // Optimistic
        chrome.runtime.sendMessage({ type: 'ADD_BLOCK', site });
      }
      setNewSite("");
    }
  };

  const removeSite = (site: string) => {
    setBlocklist(prev => prev.filter(s => s !== site)); // Optimistic
    chrome.runtime.sendMessage({ type: 'REMOVE_BLOCK', site });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const totalSeconds = 25 * 60;
  const circumference = 2 * Math.PI * 90;
  const offset = circumference - (timeLeft / totalSeconds) * circumference;

  return (
    <div className="container">
      <div className="main-view">
        <h1 className="title">The Sandman</h1>
        <h3 className="phrase">{displayPhrase}</h3>
        
        <div className="timer-container">
          <svg width="210" height="210" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="105" cy="105" r="90" fill="transparent" stroke="#1e293b" strokeWidth="8" />
            <circle
              className="progress-ring"
              cx="105" cy="105" r="90" fill="transparent" stroke="#b75fb5" strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
          </svg>
          <div className="timer-text">
            <h2>{formatTime(timeLeft)}</h2>
          </div>
        </div>

        <div className={`controls-wrapper ${isActive ? 'is-active' : ''}`}>
          <button onClick={toggleTimer} className="main-btn">
            {isActive ? "Pause" : "Start"}
          </button>
          <button onClick={resetTimer} className="reset-btn">Reset</button>
        </div>
      </div>

      <div className="settings-section">
        <div className="setting-item">
          <label>
            <input 
              type="checkbox" 
              checked={blockAI} 
              onChange={(e) => updateSetting('blockAI', e.target.checked)} 
            />
            No AI
          </label>
        </div>
        <div className="setting-item">
          <label>
            <input 
              type="checkbox" 
              checked={blockCommon} 
              onChange={(e) => updateSetting('blockCommon', e.target.checked)} 
            />
            Common Distractions
          </label>
        </div>
        <div className="setting-item">
          <label title="If on, blocks site.com and sub.site.com separately. If off, blocking site.com blocks all subdomains.">
            <input 
              type="checkbox" 
              checked={strictSubdomains} 
              onChange={(e) => updateSetting('strictSubdomains', e.target.checked)} 
            />
            Strict Subdomains
          </label>
        </div>
      </div>

      <div className="blocklist-section">
        <div className="section-header">
          <h4>{mode === 'blacklist' ? 'Distractions' : 'Allowed Sites'}</h4>
          <button className="mode-toggle" onClick={toggleMode}>
            {mode === 'blacklist' ? 'Blacklist' : 'Whitelist'}
          </button>
        </div>
        
        <form onSubmit={addSite} className="add-site-form">
          <input 
            type="text" 
            placeholder={mode === 'blacklist' ? "Block a site..." : "Allow a site..."} 
            value={newSite}
            onChange={(e) => setNewSite(e.target.value)}
          />
          <button type="submit">+</button>
        </form>
        <div className="site-list">
          {blocklist.map(site => (
            <div key={site} className="site-item">
              <span>{site}</span>
              <button onClick={() => removeSite(site)}>&times;</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
