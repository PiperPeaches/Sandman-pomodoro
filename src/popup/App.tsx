import { useState, useEffect } from "react";
import "./App.css";

/**
 * Sandman Popup Application
 * 
 * Provides the user interface for controlling the timer, managing the
 * site list, and toggling between Blacklist and Whitelist modes.
 * Uses a local ticker to keep the UI live and in sync with the background.
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

  /**
   * Initialize state from background script on mount.
   */
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response: TimerState) => {
      if (response) {
        setTimeLeft(response.timeLeft);
        setIsActive(response.isActive);
        setBlocklist(response.blocklist || []);
        setMode(response.mode || 'blacklist');
        setEndTime(response.endTime || null);
      }
    });

    const listener = (message: any) => {
      if (message.type === 'TICK') {
        setTimeLeft(message.timeLeft);
      } else if (message.type === 'UPDATE_SLEEP') {
        // Sync state when broadcast occurs
        setIsActive(message.isActive);
        setEndTime(message.endTime || null);
        setTimeLeft(message.timeLeft);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  /**
   * Local Ticker: Updates the UI every second based on endTime
   */
  useEffect(() => {
    if (!isActive || !endTime) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
      setTimeLeft(remaining);

      if (remaining === 0) {
        setIsActive(false);
        setEndTime(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, endTime]);

  const toggleTimer = () => {
    if (isActive) {
      chrome.runtime.sendMessage({ type: 'PAUSE_TIMER' });
      setIsActive(false);
      setEndTime(null);
    } else {
      // Optimistically start locally
      const newEndTime = Date.now() + (timeLeft * 1000);
      setEndTime(newEndTime);
      setIsActive(true);
      chrome.runtime.sendMessage({ type: 'START_TIMER' });
    }
  };
  
  const resetTimer = () => {
    chrome.runtime.sendMessage({ type: 'RESET_TIMER' });
    setIsActive(false);
    setEndTime(null);
    setTimeLeft(25 * 60);
  };

  /**
   * Toggles between Blacklist (block listed) and Whitelist (allow listed).
   */
  const toggleMode = () => {
    const newMode = mode === 'blacklist' ? 'whitelist' : 'blacklist';
    chrome.runtime.sendMessage({ type: 'SET_MODE', mode: newMode }, (res) => {
      if (res?.mode) setMode(res.mode);
    });
  };

  const addSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSite.trim()) {
      chrome.runtime.sendMessage({ type: 'ADD_BLOCK', site: newSite.trim().toLowerCase() }, (res) => {
        if (res?.blocklist) setBlocklist(res.blocklist);
        setNewSite("");
      });
    }
  };

  const removeSite = (site: string) => {
    chrome.runtime.sendMessage({ type: 'REMOVE_BLOCK', site }, (res) => {
      if (res?.blocklist) setBlocklist(res.blocklist);
    });
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
