// src/content/index.ts

let sleepOverlay: HTMLDivElement | null = null;

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'UPDATE_SLEEP') {
    // Only show if both are true: timer is active AND sleep is enabled
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

  // Create the main container
  sleepOverlay = document.createElement('div');
  sleepOverlay.id = 'sandman-sleep-overlay';
  
  // Apply backdrop-filter to the overlay itself so it blurs what's BEHIND it
  // but keeps its own children (the text) sharp.
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
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    backdropFilter: 'grayscale(1) blur(15px)',
    webkitBackdropFilter: 'grayscale(1) blur(15px)',
    transition: 'opacity 1s ease-in-out'
  });

  // Layer 1: Vignette (Pulsing background)
  const vignette = document.createElement('div');
  Object.assign(vignette.style, {
    position: 'absolute',
    inset: '0',
    background: 'radial-gradient(circle, transparent 20%, black 150%)',
    animation: 'sandman-pulse 6s infinite alternate ease-in-out',
    zIndex: '-1', // Behind the content
    pointerEvents: 'none'
  });

  // Layer 2: Text Content (Sharp on top)
  const content = document.createElement('div');
  Object.assign(content.style, {
    textAlign: 'center',
    padding: '40px',
    zIndex: '1'
  });

  const text = document.createElement('h1');
  text.innerText = `${window.location.hostname} was put to sleep by Sandman`;
  Object.assign(text.style, {
    fontSize: '2.5rem',
    fontWeight: '200',
    margin: '0 0 15px 0',
    color: 'white',
    textShadow: '0 0 20px rgba(0,0,0,0.8)'
  });

  const timer = document.createElement('p');
  timer.id = 'sandman-sleep-timer';
  timer.innerText = formatTime(timeLeft);
  Object.assign(timer.style, {
    fontSize: '1.8rem',
    fontWeight: '400',
    margin: '0',
    color: 'rgba(255, 255, 255, 0.9)',
    fontVariantNumeric: 'tabular-nums'
  });

  content.appendChild(text);
  content.appendChild(timer);
  sleepOverlay.appendChild(vignette);
  sleepOverlay.appendChild(content);
  
  // Prevent scrolling on the body
  document.body.style.overflow = 'hidden';
  document.body.appendChild(sleepOverlay);

  // Add the pulse animation
  if (!document.getElementById('sandman-pulse-style')) {
    const style = document.createElement('style');
    style.id = 'sandman-pulse-style';
    style.innerHTML = `
      @keyframes sandman-pulse {
        from { opacity: 0.4; }
        to { opacity: 0.8; }
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
