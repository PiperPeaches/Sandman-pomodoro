// src/content/index.ts

let sleepOverlay: HTMLDivElement | null = null;

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'UPDATE_SLEEP') {
    if (message.isActive && message.isAsleep) {
      showSleepOverlay(message.timeLeft);
    } else {
      removeSleepOverlay();
    }
  } else if (message.type === 'TICK' && sleepOverlay) {
    updateTimer(message.timeLeft);
  }
});

function showSleepOverlay(timeLeft: number) {
  if (sleepOverlay) return;

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
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    backdropFilter: 'grayscale(1) blur(25px) saturate(50%)',
    webkitBackdropFilter: 'grayscale(1) blur(25px) saturate(50%)',
    transition: 'opacity 10s ease-in-out'
  });

  // Layer 1: Dreamy Color Shift Shader
  const shader = document.createElement('div');
  Object.assign(shader.style, {
    position: 'absolute',
    inset: '0',
    background: 'linear-gradient(45deg, rgba(183, 95, 181, 0.1), rgba(124, 58, 237, 0.1), rgba(59, 130, 246, 0.1))',
    animation: 'sandman-drift-bg 15s infinite alternate ease-in-out',
    zIndex: '-1',
    pointerEvents: 'none'
  });

  // Layer 2: Pulsing Vignette
  const vignette = document.createElement('div');
  Object.assign(vignette.style, {
    position: 'absolute',
    inset: '0',
    background: 'radial-gradient(circle, transparent 20%, black 140%)',
    animation: 'sandman-vignette-pulse 10s infinite alternate ease-in-out',
    zIndex: '-1',
    pointerEvents: 'none'
  });

  // Layer 3: Text Content
  const content = document.createElement('div');
  Object.assign(content.style, {
    textAlign: 'center',
    padding: '40px',
    zIndex: '1',
    animation: 'sandman-float 8s infinite alternate ease-in-out'
  });

  const text = document.createElement('h1');
  text.innerText = `${window.location.hostname} was put to sleep by Sandman`;
  Object.assign(text.style, {
    fontSize: '2.8rem',
    fontWeight: '200',
    margin: '0 0 20px 0',
    color: 'white',
    letterSpacing: '-0.04em',
    textShadow: '0 0 40px rgba(0,0,0,0.9)',
    opacity: '0.9'
  });

  const timer = document.createElement('p');
  timer.id = 'sandman-sleep-timer';
  timer.innerText = formatTime(timeLeft);
  Object.assign(timer.style, {
    fontSize: '2rem',
    fontWeight: '400',
    margin: '0',
    color: 'rgba(255, 255, 255, 0.7)',
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '0.05em'
  });

  content.appendChild(text);
  content.appendChild(timer);
  sleepOverlay.appendChild(shader);
  sleepOverlay.appendChild(vignette);
  sleepOverlay.appendChild(content);
  
  document.body.style.overflow = 'hidden';
  document.body.appendChild(sleepOverlay);

  if (!document.getElementById('sandman-dreamy-styles')) {
    const style = document.createElement('style');
    style.id = 'sandman-dreamy-styles';
    style.innerHTML = `
      @keyframes sandman-vignette-pulse {
        0% { opacity: 0.6; }
        100% { opacity: 0.9; }
      }
      @keyframes sandman-drift-bg {
        0% { transform: scale(1) rotate(0deg); }
        100% { transform: scale(1.1) rotate(2deg); }
      }
      @keyframes sandman-float {
        from { transform: translateY(0); }
        to { transform: translateY(-15px); }
      }
    `;
    document.head.appendChild(style);
  }
}

function removeSleepOverlay() {
  if (!sleepOverlay) return;
  document.body.style.overflow = '';
  sleepOverlay.remove();
  sleepOverlay = null;
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
