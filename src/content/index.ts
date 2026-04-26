// src/content/index.ts

/**
 * Sandman Content Script
 * 
 * This script is responsible for managing the "Sleep Overlay" that covers
 * distracting websites. It uses WebGL for a smooth, dreamy background effect
 * and a local ticker for a "live" timer that stays in sync with the background.
 */

let sleepOverlay: HTMLDivElement | null = null;
let removalTimeout: number | null = null;
let isFinished = false;
let lastTimeLeft = 0;
let lastEndTime: number | null = null;
let isActiveState = false;
let isAsleepState = false;

// WebGL Variables
let gl: WebGLRenderingContext | null = null;
let program: WebGLProgram | null = null;
let animationFrameId: number | null = null;
let startTime = Date.now();
let mousePos = { x: 0.5, y: 0.5 };

// Local Ticker
let tickerInterval: number | null = null;

/**
 * Local helper to check if the current site should be blocked.
 * This mirrors the background script's logic for immediate verification.
 */
function checkIsDistracting(blocklist: string[], mode: 'blacklist' | 'whitelist'): boolean {
  const url = window.location.href;
  const isOnList = blocklist.some(site => url.includes(site));
  return mode === 'blacklist' ? isOnList : !isOnList;
}

/**
 * Handle state updates from both initial load and background broadcasts.
 */
function handleStateUpdate(data: any) {
  isActiveState = data.isActive;
  lastTimeLeft = data.timeLeft;
  lastEndTime = data.endTime || null;
  
  // Verify distraction status locally if blocklist/mode are provided, 
  // otherwise fallback to the background's determination.
  if (data.blocklist && data.mode) {
    isAsleepState = checkIsDistracting(data.blocklist, data.mode);
  } else {
    isAsleepState = data.isAsleep;
  }

  if (isActiveState && isAsleepState) {
    isFinished = false;
    showSleepOverlay(lastTimeLeft);
    startLocalTicker();
  } else if (sleepOverlay) {
    if (isActiveState && lastTimeLeft === 0) {
      setFinishedState();
    } else {
      removeSleepOverlay();
      stopLocalTicker();
    }
  }
}

/**
 * Listen for messages from the background script.
 */
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'UPDATE_SLEEP') {
    handleStateUpdate(message);
  } else if (message.type === 'TICK') {
    lastTimeLeft = message.timeLeft;
    if (!tickerInterval && isActiveState && isAsleepState) {
      startLocalTicker();
    }
  }
});

/**
 * Initialization: Request state from background immediately on script load.
 */
chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
  if (response) {
    handleStateUpdate(response);
  }
});

/**
 * Starts a local interval to update the timer display every second.
 * This makes the timer feel "live" even if the background script is throttled.
 */
function startLocalTicker() {
  if (tickerInterval) return;
  
  tickerInterval = window.setInterval(() => {
    if (!isActiveState || !isAsleepState) {
      stopLocalTicker();
      return;
    }

    let displayTime = lastTimeLeft;
    
    if (lastEndTime) {
      const now = Date.now();
      displayTime = Math.max(0, Math.ceil((lastEndTime - now) / 1000));
    } else {
      // Fallback to simple decrement if no end time (shouldn't happen)
      if (lastTimeLeft > 0) lastTimeLeft--;
      displayTime = lastTimeLeft;
    }

    updateTimer(displayTime);

    if (displayTime === 0) {
      setFinishedState();
      stopLocalTicker();
    }
  }, 1000);
}

function stopLocalTicker() {
  if (tickerInterval) {
    clearInterval(tickerInterval);
    tickerInterval = null;
  }
}

/**
 * Creates and shows the full-screen sleep overlay.
 */
function showSleepOverlay(timeLeft: number) {
  if (removalTimeout) {
    clearTimeout(removalTimeout);
    removalTimeout = null;
  }

  if (sleepOverlay && document.body.contains(sleepOverlay)) return;

  injectStyles();
  pauseAllMedia();

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
    fontFamily: 'Montserrat Alternates, system-ui, -apple-system, sans-serif',
    pointerEvents: 'all',
    userSelect: 'none',
    backgroundColor: 'rgba(0, 0, 0, 0)',
    backdropFilter: 'grayscale(1) blur(0px) saturate(100%)',
    transition: 'opacity 1.5s ease-in-out, backdrop-filter 1.5s ease-in-out, background-color 1.5s ease-in-out'
  });
  (sleepOverlay.style as any).webkitBackdropFilter = 'grayscale(1) blur(0px) saturate(100%)';

  const canvas = document.createElement('canvas');
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.zIndex = '-1';
  canvas.style.filter = 'blur(20px)';
  canvas.style.transform = 'scale(1.1)';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  sleepOverlay.appendChild(canvas);

  initWebGL(canvas);

  sleepOverlay.addEventListener('mousemove', (e) => {
    mousePos.x = e.clientX / window.innerWidth;
    mousePos.y = 1.0 - (e.clientY / window.innerHeight);
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
    fontWeight: '600',
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
  sleepOverlay.appendChild(content);
  
  document.body.appendChild(sleepOverlay);
  document.body.style.overflow = 'hidden';

  sleepOverlay.offsetHeight; 

  sleepOverlay.style.opacity = '1';
  sleepOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  sleepOverlay.style.backdropFilter = 'grayscale(1) blur(25px) saturate(50%)';
  (sleepOverlay.style as any).webkitBackdropFilter = 'grayscale(1) blur(25px) saturate(50%)';

  document.addEventListener('play', pauseAllMedia, true);
}

function initWebGL(canvas: HTMLCanvasElement) {
  gl = canvas.getContext('webgl');
  if (!gl) return;

  const vsSource = `
    attribute vec2 position;
    attribute vec2 uv;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 0, 1);
    }
  `;

  const fsSource = `
    precision highp float;
    #define PI 3.14159265359
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform vec2 u_mouse;
    vec4 uColor1 = vec4(0.02, 0.01, 0.05, 1.0);
    vec4 uColor2 = vec4(0.1, 0.05, 0.2, 1.0);
    vec4 uColor3 = vec4(0.05, 0.1, 0.2, 1.0);
    float uSpinRotation = -1.0;
    float uSpinSpeed = 1.5;
    float uContrast = 2.5;
    float uLighting = 0.2;
    float uSpinAmount = 0.2;
    float uPixelFilter = 1200.0;
    float uSpinEase = 1.0;
    varying vec2 vUv;
    vec4 effect(vec2 screenSize, vec2 screen_coords) {
        float pixel_size = length(screenSize.xy) / uPixelFilter;
        vec2 uv = (floor(screen_coords.xy * (1.0 / pixel_size)) * pixel_size - 0.5 * screenSize.xy) / length(screenSize.xy);
        float uv_len = length(uv);
        float speed = (uSpinRotation * uSpinEase * 0.2) + 302.2;
        float mouseInfluence = (u_mouse.x * 2.0 - 1.0);
        speed += mouseInfluence * 0.05;
        float new_pixel_angle = atan(uv.y, uv.x) + speed - uSpinEase * 20.0 * (uSpinAmount * uv_len + (1.0 - uSpinAmount));
        vec2 mid = (screenSize.xy / length(screenSize.xy)) / 2.0;
        uv = (vec2(uv_len * cos(new_pixel_angle) + mid.x, uv_len * sin(new_pixel_angle) + mid.y) - mid);
        uv *= 20.0;
        float baseSpeed = u_time * uSpinSpeed;
        speed = baseSpeed + mouseInfluence * 1.0;
        vec2 uv2 = vec2(uv.x + uv.y);
        for(int i = 0; i < 5; i++) {
            uv2 += sin(max(uv.x, uv.y)) + uv;
            uv += 0.5 * vec2(
                cos(5.1123314 + 0.353 * uv2.y + speed * 0.131121),
                sin(uv2.x - 0.113 * speed)
            );
            uv -= cos(uv.x + uv.y) - sin(uv.x * 0.711 - uv.y);
        }
        float contrast_mod = (0.25 * uContrast + 0.5 * uSpinAmount + 1.2);
        float paint_res = min(2.0, max(0.0, length(uv) * 0.035 * contrast_mod));
        float c1p = max(0.0, 1.0 - contrast_mod * abs(1.0 - paint_res));
        float c2p = max(0.0, 1.0 - contrast_mod * abs(paint_res));
        float c3p = 1.0 - min(1.0, c1p + c2p);
        float light = (uLighting - 0.2) * max(c1p * 5.0 - 4.0, 0.0) + uLighting * max(c2p * 5.0 - 4.0, 0.0);
        vec4 col = (0.3 / uContrast) * uColor1 + (1.0 - 0.3 / uContrast) * (uColor1 * c1p + uColor2 * c2p + vec4(c3p * uColor3.rgb, c3p * uColor1.a)) + light;
        float dist = distance(vUv, vec2(0.5));
        col.rgb *= 1.0 - smoothstep(0.4, 1.2, dist);
        return col;
    }
    void main() {
        gl_FragColor = effect(u_resolution, gl_FragCoord.xy);
    }
  `;

  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  if (!vertexShader || !fragmentShader) return;

  program = createProgram(gl, vertexShader, fragmentShader);
  if (!program) return;

  const positionAttributeLocation = gl.getAttribLocation(program, "position");
  const uvAttributeLocation = gl.getAttribLocation(program, "uv");
  
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1,  1, -1, -1,  1, -1,  1,  1, -1,  1,  1]), gl.STATIC_DRAW);

  const uvBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0,  1, 0,  0, 1, 0, 1,  1, 0,  1, 1]), gl.STATIC_DRAW);

  const render = () => {
    if (!gl || !program) return;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(uvAttributeLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    gl.vertexAttribPointer(uvAttributeLocation, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(gl.getUniformLocation(program, "u_time"), (Date.now() - startTime) * 0.001);
    gl.uniform2f(gl.getUniformLocation(program, "u_resolution"), gl.canvas.width, gl.canvas.height);
    gl.uniform2f(gl.getUniformLocation(program, "u_mouse"), mousePos.x, mousePos.y);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    animationFrameId = requestAnimationFrame(render);
  };
  render();
}

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext, vs: WebGLShader, fs: WebGLShader) {
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function pauseAllMedia() {
  const media = document.querySelectorAll('video, audio');
  media.forEach((m) => { if (m instanceof HTMLMediaElement) m.pause(); });
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
      marginTop: '30px', padding: '16px 48px', fontSize: '1.2rem', fontWeight: '600',
      color: 'white', backgroundColor: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '50px', cursor: 'pointer', backdropFilter: 'blur(10px)', transition: 'all 0.3s ease',
      animation: 'sandman-fade-in 1s ease-out'
    });
    btn.onmouseover = () => btn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    btn.onmouseout = () => btn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    btn.onclick = () => removeSleepOverlay();
    container.appendChild(btn);
  }
}

function removeSleepOverlay() {
  if (!sleepOverlay || removalTimeout) return;
  stopLocalTicker();
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  document.removeEventListener('play', pauseAllMedia, true);
  document.body.style.overflow = '';
  sleepOverlay.style.opacity = '0';
  sleepOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0)';
  sleepOverlay.style.backdropFilter = 'grayscale(1) blur(0px) saturate(100%)';
  removalTimeout = window.setTimeout(() => {
    if (sleepOverlay) { sleepOverlay.remove(); sleepOverlay = null; }
    removalTimeout = null;
  }, 1500);
}

function updateTimer(seconds: number) {
  const timerElement = document.getElementById('sandman-sleep-timer');
  if (timerElement) timerElement.innerText = formatTime(seconds);
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
      @keyframes sandman-float { from { transform: translateY(0); } to { transform: translateY(-15px); } }
      @keyframes sandman-fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    `;
    document.head.appendChild(style);
  }
}

const observer = new MutationObserver(() => {
  if (isActiveState && isAsleepState && !isFinished && !removalTimeout) {
    if (sleepOverlay && !document.body.contains(sleepOverlay)) {
      sleepOverlay = null;
      showSleepOverlay(lastTimeLeft);
      startLocalTicker();
    }
  }
});
observer.observe(document.body, { childList: true });

window.addEventListener('resize', () => {
  if (sleepOverlay) {
    const canvas = sleepOverlay.querySelector('canvas');
    if (canvas) { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  }
});
