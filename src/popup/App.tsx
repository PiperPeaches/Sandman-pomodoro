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
  isAsleep: boolean;
}

interface TimerMessage {
  type: string;
  timeLeft: number;
  isAsleep?: boolean;
}

function App() {
  const [displayPhrase] = useState(() => {
    const randomIndex = Math.floor(Math.random() * driftPhrases.length);
    return driftPhrases[randomIndex];
  });

  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isAsleep, setIsAsleep] = useState(false);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response: TimerState) => {
      if (response) {
        setTimeLeft(response.timeLeft);
        setIsActive(response.isActive);
        setIsAsleep(response.isAsleep);
      }
    });

    const listener = (message: TimerMessage) => {
      if (message.type === 'TICK') {
        setTimeLeft(message.timeLeft);
      } else if (message.type === 'UPDATE_SLEEP') {
        setIsAsleep(!!message.isAsleep);
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

  const toggleSleep = () => {
    chrome.runtime.sendMessage({ type: 'TOGGLE_SLEEP' }, (response) => {
      if (response) setIsAsleep(response.isAsleep);
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
      <div className="content">
        <h1 className="title">The Sandman</h1>
        <h3 className="phrase">{displayPhrase}</h3>
        
        <div className="timer-container">
          <svg width="200" height="200" style={{ transform: 'rotate(-90deg)' }}>
            <circle
              cx="100"
              cy="100"
              r="90"
              fill="transparent"
              stroke="#1e293b"
              strokeWidth="8"
            />
            <circle
              className="progress-ring"
              cx="100"
              cy="100"
              r="90"
              fill="transparent"
              stroke="#b75fb5"
              strokeWidth="8"
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
          <button onClick={resetTimer} className="reset-btn">
            Reset
          </button>
        </div>

        <button 
          onClick={toggleSleep} 
          style={{ 
            marginTop: '20px', 
            width: '100%', 
            backgroundColor: isAsleep ? '#ef4444' : '#1e293b' 
          }}
        >
          {isAsleep ? 'Wake Up Tabs' : 'Enable Sleep Tabs'}
        </button>
      </div>
    </div>
  );
}

export default App;
