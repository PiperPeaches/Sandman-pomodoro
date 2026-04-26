import { useState, useEffect } from "react";
import "./App.css";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
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
  faPlus, 
  faTimes,
  faShieldHalved,
  faStar
} from '@fortawesome/free-solid-svg-icons';

/**
 * Sandman Popup Application - Samsung One UI Style with Squarkles
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
  const [blockYouTube, setBlockYouTube] = useState(false);

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
        }
      }
    });

    const listener = (message: any) => {
      if (message.type === 'TICK' && message.timeLeft !== undefined) {
        setTimeLeft(message.timeLeft);
      } else if (message.type === 'UPDATE_SLEEP') {
        setIsActive(message.isActive);
        setEndTime(message.endTime || null);
        if (message.timeLeft !== undefined) setTimeLeft(message.timeLeft);
        setMode(message.mode || 'blacklist');
        if (message.blocklist) setBlocklist(message.blocklist);
        if (message.settings) {
          setBlockAI(!!message.settings.blockAI);
          setBlockCommon(!!message.settings.blockCommon);
          setStrictSubdomains(!!message.settings.strictSubdomains);
          setBlockYouTube(!!message.settings.blockYouTube);
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
    setMode(newMode);
    chrome.runtime.sendMessage({ type: 'SET_MODE', mode: newMode });
  };

  const updateSetting = (key: string, value: boolean) => {
    if (key === 'blockAI') setBlockAI(value);
    if (key === 'blockCommon') setBlockCommon(value);
    if (key === 'strictSubdomains') setStrictSubdomains(value);
    if (key === 'blockYouTube') setBlockYouTube(value);

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
      } catch (err) {}
      site = site.replace(/^www\./, '');
      
      if (site && !blocklist.includes(site)) {
        setBlocklist(prev => [...prev, site]);
        chrome.runtime.sendMessage({ type: 'ADD_BLOCK', site });
      }
      setNewSite("");
    }
  };

  const removeSite = (site: string) => {
    setBlocklist(prev => prev.filter(s => s !== site));
    chrome.runtime.sendMessage({ type: 'REMOVE_BLOCK', site });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const SettingItem = ({ label, icon, value, onToggle }: { label: string, icon: any, value: boolean, onToggle: () => void }) => (
    <div className="setting-list-item" onClick={onToggle}>
      <div className="setting-info">
        <div className={`icon-squircle ${value ? 'icon-squircle-active' : ''}`}>
          <FontAwesomeIcon icon={icon} fixedWidth />
        </div>
        <span className="setting-label">{label}</span>
      </div>
      <div className={`toggle ${value ? 'toggle-active' : ''}`} />
    </div>
  );

  return (
    <div className="container">
      {/* Viewing Area with Squarkles */}
      <div className="viewing-area">
        <div className="squarkle-container">
          <FontAwesomeIcon icon={faStar} className="squarkle sq-1" />
          <FontAwesomeIcon icon={faStar} className="squarkle sq-2" />
          <FontAwesomeIcon icon={faStar} className="squarkle sq-3" />
        </div>
        <h1 className="header-title">The Sandman</h1>
        <div className="timer-display">
          {formatTime(timeLeft)}
        </div>
        <div className="phrase-display">
          {displayPhrase}
        </div>
      </div>

      {/* Interaction Area */}
      <div className="interaction-area">
        
        {/* Main Actions Card */}
        <div className="main-action-area">
          <button onClick={toggleTimer} className={`btn-pill btn-blue`}>
            <FontAwesomeIcon icon={isActive ? faPause : faPlay} style={{ marginRight: '8px' }} />
            {isActive ? "Pause Focus" : "Start Focus Session"}
          </button>
          <button onClick={resetTimer} className="btn-pill btn-gray">
            <FontAwesomeIcon icon={faUndo} style={{ marginRight: '8px' }} />
            Reset Timer
          </button>
        </div>

        {/* Mode Card */}
        <div className="card">
          <h3 className="card-title">Filter Mode</h3>
          <div className="setting-list-item" onClick={toggleMode}>
            <div className="setting-info">
              <div className="icon-squircle icon-squircle-active">
                <FontAwesomeIcon icon={faMoon} fixedWidth />
              </div>
              <span className="setting-label">{mode === 'blacklist' ? 'Distractions' : 'Allowed Only'}</span>
            </div>
            <span style={{ color: '#3E91FF', fontWeight: '600', fontSize: '0.85rem' }}>CHANGE</span>
          </div>
        </div>

        {/* Settings Card */}
        <div className="card">
          <h3 className="card-title">Preferences</h3>
          <SettingItem 
            label="Block all YouTube" 
            icon={faYoutube} 
            value={blockYouTube} 
            onToggle={() => updateSetting('blockYouTube', !blockYouTube)} 
          />
          <SettingItem 
            label="No AI Assistants" 
            icon={faRobot} 
            value={blockAI} 
            onToggle={() => updateSetting('blockAI', !blockAI)} 
          />
          <SettingItem 
            label="Common Distractions" 
            icon={faChartLine} 
            value={blockCommon} 
            onToggle={() => updateSetting('blockCommon', !blockCommon)} 
          />
          <SettingItem 
            label="Strict Subdomains" 
            icon={faLock} 
            value={strictSubdomains} 
            onToggle={() => updateSetting('strictSubdomains', !strictSubdomains)} 
          />
        </div>

        {/* Blocklist Card */}
        <div className="card blocklist-card">
          <div className="blocklist-header">
            <h4><FontAwesomeIcon icon={faShieldHalved} style={{ marginRight: '8px', opacity: 0.7 }} />{mode === 'blacklist' ? 'Blocklist' : 'Whitelist'}</h4>
            <span style={{ fontSize: '0.85rem', color: '#8E8E93' }}>{blocklist.length} sites</span>
          </div>
          
          <form onSubmit={addSite} className="add-input-row">
            <input 
              type="text" 
              placeholder="Add a website..." 
              value={newSite}
              onChange={(e) => setNewSite(e.target.value)}
            />
            <button type="submit"><FontAwesomeIcon icon={faPlus} /></button>
          </form>

          <div className="site-list">
            {blocklist.map(site => (
              <div key={site} className="site-item">
                <span>{site}</span>
                <button onClick={() => removeSite(site)}><FontAwesomeIcon icon={faTimes} /></button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
