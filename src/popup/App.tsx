import { useState, useEffect } from "react";
import "./App.css";

const driftPhrases: string[] = [
  "Time is drifting away...",
  "The sand falls softly...",
  "Moments lost in sleep...",
  "Fading into the mist...",
];

function App() {
  const [displayPhrase] = useState(() => {
    const randomIndex = Math.floor(Math.random() * driftPhrases.length);
    return driftPhrases[randomIndex];
  });

  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    let interval: number | undefined;

    if (isActive && timeLeft > 0) {
      interval = window.setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
    }

    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const toggleTimer = () => setIsActive(!isActive);
  
  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(25 * 60);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // SVG Progress calculation
  const totalSeconds = 25 * 60;
  const circumference = 2 * Math.PI * 90; // 565.48
  const offset = circumference - (timeLeft / totalSeconds) * circumference;

  return (
    <div className="container">
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
            cx="100"
            cy="100"
            r="90"
            fill="transparent"
            stroke="#b75fb5"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div className="timer-text">
          <h2>{formatTime(timeLeft)}</h2>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button onClick={toggleTimer}>
          {isActive ? "Pause" : "Start"}
        </button>
        <button onClick={resetTimer} className="reset-btn">
          Reset
        </button>
      </div>
    </div>
  );
}

export default App;
