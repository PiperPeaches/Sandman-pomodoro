import { useState, useEffect } from "react";
import "./App.css";

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
}

function App() {
  const [displayPhrase] = useState(() => {
    const randomIndex = Math.floor(Math.random() * driftPhrases.length);
    return driftPhrases[randomIndex];
  });

  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [blocklist, setBlocklist] = useState<string[]>([]);
  const [newSite, setNewSite] = useState("");

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response: TimerState) => {
      if (response) {
        setTimeLeft(response.timeLeft);
        setIsActive(response.isActive);
        setBlocklist(response.blocklist || []);
      }
    });

    const listener = (message: any) => {
      if (message.type === 'TICK') {
        setTimeLeft(message.timeLeft);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const toggleTimer = () => {
    if (isActive) {
      chrome.runtime.sendMessage({ type: 'PAUSE_TIMER' });
      setIsActive(false);
    } else {
      chrome.runtime.sendMessage({ type: 'START_TIMER' });
      setIsActive(true);
    }
  };
  
  const resetTimer = () => {
    chrome.runtime.sendMessage({ type: 'RESET_TIMER' });
    setIsActive(false);
    setTimeLeft(25 * 60);
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
        <h4>Distractions</h4>
        <form onSubmit={addSite} className="add-site-form">
          <input 
            type="text" 
            placeholder="e.g. youtube.com" 
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
