// src/content/index.ts

let sleepOverlay: HTMLDivElement | null = null;
let removalTimeout: number | null = null;
let isFinished = false;

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'UPDATE_SLEEP') {
    if (message.isActive && message.isAsleep) {
      isFinished = false;
      showSleepOverlay(message.timeLeft);
    } else if (!message.isActive && sleepOverlay) {
      if (message.timeLeft === 0) {
        setFinishedState();
      } else {
        removeSleepOverlay();
      }
    }
  } else if (message.type === 'TICK' && sleepOverlay) {
    updateTimer(message.timeLeft);
    if (message.timeLeft === 0) setFinishedState();
  }
});

function showSleepOverlay(timeLeft: number) {
  if (removalTimeout) {
    clearTimeout(removalTimeout);
    removalTimeout = null;
  }

  if (sleepOverlay) return;

  injectStyles();
  pauseAllMedia(); // PAUSE MEDIA IMMEDIATELY

  sleepOverlay = document.createElement('div');
  sleepOverlay.id = 'sandman-sleep-overlay';
  
  Object.assign(sleepOverlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    zIndex: '2147483647',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    pointerEvents: 'all',
    userSelect: 'none',
    backgroundColor: 'rgba(0, 0, 0, 0)',
    backdropFilter: 'grayscale(1) blur(0px) saturate(100%)',
    transition: 'opacity 1.5s ease-in-out, backdrop-filter 1.5s ease-in-out, background-color 1.5s ease-in-out'
  });
  (sleepOverlay.style as any).webkitBackdropFilter = 'grayscale(1) blur(0px) saturate(100%)';

  const shader = document.createElement('div');
  Object.assign(shader.style, {
    position: 'absolute',
    inset: '0',
    background: 'linear-gradient(45deg, rgba(183, 95, 181, 0.1), rgba(124, 58, 237, 0.1), rgba(59, 130, 246, 0.1))',
    animation: 'sandman-drift-bg 15s infinite alternate ease-in-out',
    zIndex: '-1',
    pointerEvents: 'none'
  });

  const vignette = document.createElement('div');
  Object.assign(vignette.style, {
    position: 'absolute',
    inset: '0',
    background: 'radial-gradient(circle, transparent 20%, black 140%)',
    animation: 'sandman-vignette-pulse 10s infinite alternate ease-in-out',
    zIndex: '-1',
    pointerEvents: 'none'
  });

  const content = document.createElement('div');
  content.id = 'sandman-content-container';
  Object.assign(content.style, {
    textAlign: 'center',
    padding: '40px',
    zIndex: '1',
    animation: 'sandman-float 8s infinite alternate ease-in-out'
  });

  const text = document.createElement('h1');
  text.id = 'sandman-main-text';
  text.innerText = `${window.location.hostname} was put to sleep by Sandman`;
  Object.assign(text.style, {
    fontSize: '2.8rem',
    fontWeight: '200',
    margin: '0 0 15px 0',
    color: 'white',
    letterSpacing: '-0.04em',
    textShadow: '0 0 40px rgba(0,0,0,0.9)'
  });

  const timer = document.createElement('p');
  timer.id = 'sandman-sleep-timer';
  timer.innerText = formatTime(timeLeft);
  Object.assign(timer.style, {
    fontSize: '2rem',
    fontWeight: '400',
    margin: '0',
    color: 'rgba(255, 255, 255, 0.7)',
    fontVariantNumeric: 'tabular-nums'
  });

  content.appendChild(text);
  content.appendChild(timer);
  sleepOverlay.appendChild(shader);
  sleepOverlay.appendChild(vignette);
  sleepOverlay.appendChild(content);
  
  document.body.appendChild(sleepOverlay);
  document.body.style.overflow = 'hidden';

  sleepOverlay.offsetHeight; 

  sleepOverlay.style.opacity = '1';
  sleepOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  sleepOverlay.style.backdropFilter = 'grayscale(1) blur(25px) saturate(50%)';
  (sleepOverlay.style as any).webkitBackdropFilter = 'grayscale(1) blur(25px) saturate(50%)';

  // Listen for media trying to play
  document.addEventListener('play', pauseAllMedia, true);
}

function pauseAllMedia() {
  const media = document.querySelectorAll('video, audio');
  media.forEach((m) => {
    if (m instanceof HTMLMediaElement) {
      m.pause();
    }
  });
}

function setFinishedState() {
  if (isFinished || !sleepOverlay) return;
  isFinished = true;

  const text = document.getElementById('sandman-main-text');
  if (text) text.innerText = 'You have finished your focus session';

  const timer = document.getElementById('sandman-sleep-timer');
  if (timer) timer.style.display = 'none';

  const container = document.getElementById('sandman-content-container');
  if (container && !document.getElementById('sandman-wakeup-btn')) {
    const btn = document.createElement('button');
    btn.id = 'sandman-wakeup-btn';
    btn.innerText = 'Wake Up';
    Object.assign(btn.style, {
      marginTop: '30px',
      padding: '16px 48px',
      fontSize: '1.2rem',
      fontWeight: '600',
      color: 'white',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '50px',
      cursor: 'pointer',
      backdropFilter: 'blur(10px)',
      transition: 'all 0.3s ease',
      animation: 'sandman-fade-in 1s ease-out'
    });
    (btn.style as any).webkitBackdropFilter = 'blur(10px)';

    btn.onmouseover = () => btn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    btn.onmouseout = () => btn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    btn.onclick = () => removeSleepOverlay();

    container.appendChild(btn);
  }
}

function removeSleepOverlay() {
  if (!sleepOverlay || removalTimeout) return;

  document.removeEventListener('play', pauseAllMedia, true);
  document.body.style.overflow = '';
  sleepOverlay.style.opacity = '0';
  sleepOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0)';
  sleepOverlay.style.backdropFilter = 'grayscale(1) blur(0px) saturate(100%)';
  (sleepOverlay.style as any).webkitBackdropFilter = 'grayscale(1) blur(0px) saturate(100%)';

  removalTimeout = window.setTimeout(() => {
    if (sleepOverlay) {
      sleepOverlay.remove();
      sleepOverlay = null;
    }
    removalTimeout = null;
  }, 1500);
}

function updateTimer(seconds: number) {
  const timerElement = document.getElementById('sandman-sleep-timer');
  if (timerElement) {
    timerElement.innerText = formatTime(seconds);
  }
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function injectStyles() {
  if (!document.getElementById('sandman-dreamy-styles')) {
    const style = document.createElement('style');
    style.id = 'sandman-dreamy-styles';
    style.innerHTML = `
      @keyframes sandman-vignette-pulse { 0% { opacity: 0.6; } 100% { opacity: 0.9; } }
      @keyframes sandman-drift-bg { 0% { transform: scale(1) rotate(0deg); } 100% { transform: scale(1.1) rotate(2deg); } }
      @keyframes sandman-float { from { transform: translateY(0); } to { transform: translateY(-15px); } }
      @keyframes sandman-fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    `;
    document.head.appendChild(style);
  }
}
