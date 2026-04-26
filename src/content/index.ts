// src/content/index.ts

/**
 * Sandman Content Script
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
const startTime = Date.now();
const mousePos = { x: 0.5, y: 0.5 };

// Local Ticker
let tickerInterval: number | null = null;

const commonDistractions = [
  'facebook.com', 'twitter.com', 'x.com', 'youtube.com', 
  'instagram.com', 'reddit.com', 'netflix.com', 'twitch.tv', 'tiktok.com'
];

const aiSites = [
  'chatgpt.com', 'openai.com', 'claude.ai', 'gemini.google.com', 
  'perplexity.ai', 'deepseek.com', 'mistral.ai', 'anthropic.com'
];

interface Settings {
  blockAI: boolean;
  blockCommon: boolean;
  strictSubdomains: boolean;
}

function checkIsDistracting(blocklist: string[], mode: 'blacklist' | 'whitelist', settings: Settings): boolean {
  const hostname = window.location.hostname;
  const normalizedHostname = hostname.replace(/^www\./, '');

  const isMatch = (site: string) => {
    const normalizedSite = site.replace(/^www\./, '');
    if (settings?.strictSubdomains) {
      return normalizedHostname === normalizedSite;
    } else {
      return normalizedHostname === normalizedSite || normalizedHostname.endsWith('.' + normalizedSite);
    }
  };

  if (mode === 'whitelist') {
    return !blocklist.some(isMatch);
  } else {
    const isSpecialDistraction = (settings?.blockCommon && commonDistractions.some(isMatch)) || 
                                 (settings?.blockAI && aiSites.some(isMatch));
    const isCustomMatch = blocklist.some(isMatch);
    return isSpecialDistraction || isCustomMatch;
  }
}

interface StateUpdateData {
  isActive: boolean;
  timeLeft: number;
  endTime: number | null;
  isAsleep?: boolean;
  blocklist?: string[];
  mode?: 'blacklist' | 'whitelist';
  settings: Settings;
}

function handleStateUpdate(data: StateUpdateData) {
  isActiveState = data.isActive;
  lastTimeLeft = data.timeLeft;
  lastEndTime = data.endTime || null;
  
  if (data.isAsleep !== undefined) {
    isAsleepState = data.isAsleep;
  } else if (data.blocklist && data.mode) {
    isAsleepState = checkIsDistracting(data.blocklist, data.mode, data.settings);
  }

  if (isActiveState && isAsleepState) {
    isFinished = false;
    showSleepOverlay(lastTimeLeft);
    startLocalTicker();
  } else if (sleepOverlay) {
    // If not active or not asleep, but overlay exists, we need to remove it
    if (isActiveState && lastTimeLeft === 0) {
      setFinishedState();
    } else {
      removeSleepOverlay();
    }
  }
}

chrome.runtime.onMessage.addListener((message: StateUpdateData & { type: string; timeLeft?: number }) => {
  if (message.type === 'UPDATE_SLEEP') {
    handleStateUpdate(message);
  } else if (message.type === 'TICK' && message.timeLeft !== undefined) {
    lastTimeLeft = message.timeLeft;
    if (!tickerInterval && isActiveState && isAsleepState) startLocalTicker();
  }
});

// Initialization
chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response: StateUpdateData) => {
  if (response) handleStateUpdate(response);
});

function startLocalTicker() {
  if (tickerInterval) return;
  tickerInterval = window.setInterval(() => {
    if (!isActiveState || !isAsleepState) { stopLocalTicker(); return; }
    let displayTime = lastTimeLeft;
    if (lastEndTime) {
      displayTime = Math.max(0, Math.ceil((lastEndTime - Date.now()) / 1000));
    } else if (lastTimeLeft > 0) {
      lastTimeLeft--;
      displayTime = lastTimeLeft;
    }
    updateTimer(displayTime);
    if (displayTime === 0) { setFinishedState(); stopLocalTicker(); }
  }, 1000);
}

function stopLocalTicker() {
  if (tickerInterval) { clearInterval(tickerInterval); tickerInterval = null; }
}

function showSleepOverlay(timeLeft: number) {
  if (removalTimeout) { clearTimeout(removalTimeout); removalTimeout = null; }

  // If overlay doesn't exist, create it
  if (!sleepOverlay || !document.body.contains(sleepOverlay)) {
    injectStyles();
    pauseAllMedia();
    sleepOverlay = document.createElement('div');
    sleepOverlay.id = 'sandman-sleep-overlay';
    Object.assign(sleepOverlay.style, {
      position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh', zIndex: '2147483647',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontFamily: 'Montserrat Alternates, system-ui, sans-serif', pointerEvents: 'all',
      userSelect: 'none', transition: 'opacity 1.5s ease-in-out, backdrop-filter 1.5s ease-in-out, background-color 1.5s ease-in-out'
    });
    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, { position: 'absolute', inset: '0', zIndex: '-1', filter: 'blur(40px)', transform: 'scale(1.1)' });
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    sleepOverlay.appendChild(canvas);
    initWebGL(canvas);
    sleepOverlay.addEventListener('mousemove', (e) => {
      mousePos.x = e.clientX / window.innerWidth;
      mousePos.y = 1.0 - (e.clientY / window.innerHeight);
    });
    const content = document.createElement('div');
    content.id = 'sandman-content-container';
    Object.assign(content.style, { textAlign: 'center', padding: '40px', zIndex: '1', animation: 'sandman-float 8s infinite alternate ease-in-out' });
    const text = document.createElement('h1');
    text.id = 'sandman-main-text';
    text.innerText = `${window.location.hostname} was put to sleep by Sandman`;
    Object.assign(text.style, { fontSize: '2.8rem', fontWeight: '600', margin: '0 0 15px 0', textShadow: '0 0 40px rgba(0,0,0,0.9)' });
    const timer = document.createElement('p');
    timer.id = 'sandman-sleep-timer';
    timer.innerText = formatTime(timeLeft);
    Object.assign(timer.style, { fontSize: '2rem', color: 'rgba(255, 255, 255, 0.7)', fontVariantNumeric: 'tabular-nums' });
    content.appendChild(text); content.appendChild(timer); sleepOverlay.appendChild(content);
    document.body.appendChild(sleepOverlay);
  }

  // FORCE VISIBILITY: This ensures the overlay snaps back if it was in the middle of a fade-out
  Object.assign(sleepOverlay.style, {
    display: 'flex',
    opacity: '1',
    pointerEvents: 'all',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'grayscale(1) blur(25px) saturate(50%)'
  });
  (sleepOverlay.style as any).webkitBackdropFilter = 'grayscale(1) blur(25px) saturate(50%)';

  document.body.style.overflow = 'hidden';
  document.addEventListener('play', pauseAllMedia, true);
  updateTimer(timeLeft);
}

function initWebGL(canvas: HTMLCanvasElement) {
  gl = canvas.getContext('webgl'); if (!gl) return;
  const vs = createShader(gl, gl.VERTEX_SHADER, `attribute vec2 position; attribute vec2 uv; varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 0, 1); }`);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, `precision highp float; #define PI 3.14159265359\n uniform float u_time; uniform vec2 u_resolution; uniform vec2 u_mouse; vec4 uColor1 = vec4(0.02, 0.01, 0.05, 1.0); vec4 uColor2 = vec4(0.1, 0.05, 0.2, 1.0); vec4 uColor3 = vec4(0.05, 0.1, 0.2, 1.0); float uSpinRotation = -1.0; float uSpinSpeed = 1.5; float uContrast = 2.5; float uLighting = 0.2; float uSpinAmount = 0.2; float uPixelFilter = 1200.0; float uSpinEase = 1.0; varying vec2 vUv; vec4 effect(vec2 screenSize, vec2 screen_coords) { float pixel_size = length(screenSize.xy) / uPixelFilter; vec2 uv = (floor(screen_coords.xy * (1.0 / pixel_size)) * pixel_size - 0.5 * screenSize.xy) / length(screenSize.xy); float uv_len = length(uv); float speed = (uSpinRotation * uSpinEase * 0.2) + 302.2; float mouseInfluence = (u_mouse.x * 2.0 - 1.0); speed += mouseInfluence * 0.05; float new_pixel_angle = atan(uv.y, uv.x) + speed - uSpinEase * 20.0 * (uSpinAmount * uv_len + (1.0 - uSpinAmount)); vec2 mid = (screenSize.xy / length(screenSize.xy)) / 2.0; uv = (vec2(uv_len * cos(new_pixel_angle) + mid.x, uv_len * sin(new_pixel_angle) + mid.y) - mid); uv *= 20.0; float baseSpeed = u_time * uSpinSpeed; speed = baseSpeed + mouseInfluence * 1.0; vec2 uv2 = vec2(uv.x + uv.y); for(int i = 0; i < 5; i++) { uv2 += sin(max(uv.x, uv.y)) + uv; uv += 0.5 * vec2(cos(5.1123314 + 0.353 * uv2.y + speed * 0.131121), sin(uv2.x - 0.113 * speed)); uv -= cos(uv.x + uv.y) - sin(uv.x * 0.711 - uv.y); } float contrast_mod = (0.25 * uContrast + 0.5 * uSpinAmount + 1.2); float paint_res = min(2.0, max(0.0, length(uv) * 0.035 * contrast_mod)); float c1p = max(0.0, 1.0 - contrast_mod * abs(1.0 - paint_res)); float c2p = max(0.0, 1.0 - contrast_mod * abs(paint_res)); float c3p = 1.0 - min(1.0, c1p + c2p); float light = (uLighting - 0.2) * max(c1p * 5.0 - 4.0, 0.0) + uLighting * max(c2p * 5.0 - 4.0, 0.0); vec4 col = (0.3 / uContrast) * uColor1 + (1.0 - 0.3 / uContrast) * (uColor1 * c1p + uColor2 * c2p + vec4(c3p * uColor3.rgb, c3p * uColor1.a)) + light; float dist = distance(vUv, vec2(0.5)); col.rgb *= 1.0 - smoothstep(0.4, 1.2, dist); return col; } void main() { gl_FragColor = effect(u_resolution, gl_FragCoord.xy); }`);
  if (!vs || !fs) return;
  program = createProgram(gl, vs, fs); if (!program) return;
  const pLoc = gl.getAttribLocation(program, "position"); const uLoc = gl.getAttribLocation(program, "uv");
  const pBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const uBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, uBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
  const render = () => {
    if (!gl || !program) return; gl.viewport(0, 0, gl.canvas.width, gl.canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.useProgram(program);
    gl.enableVertexAttribArray(pLoc); gl.bindBuffer(gl.ARRAY_BUFFER, pBuf); gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(uLoc); gl.bindBuffer(gl.ARRAY_BUFFER, uBuf); gl.vertexAttribPointer(uLoc, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(gl.getUniformLocation(program, "u_time"), (Date.now() - startTime) * 0.001);
    gl.uniform2f(gl.getUniformLocation(program, "u_resolution"), gl.canvas.width, gl.canvas.height);
    gl.uniform2f(gl.getUniformLocation(program, "u_mouse"), mousePos.x, mousePos.y);
    gl.drawArrays(gl.TRIANGLES, 0, 6); animationFrameId = requestAnimationFrame(render);
  };
  render();
}

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const s = gl.createShader(type); if (!s) return null; gl.shaderSource(s, source); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); gl.deleteShader(s); return null; }
  return s;
}

function createProgram(gl: WebGLRenderingContext, vs: WebGLShader, fs: WebGLShader) {
  const p = gl.createProgram(); if (!p) return null; gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(p)); gl.deleteProgram(p); return null; }
  return p;
}

function pauseAllMedia() { document.querySelectorAll('video, audio').forEach((m) => { if (m instanceof HTMLMediaElement) m.pause(); }); }

function setFinishedState() {
  if (isFinished || !sleepOverlay) return; isFinished = true;
  const t = document.getElementById('sandman-main-text'); if (t) t.innerText = 'You have finished your focus session';
  const tm = document.getElementById('sandman-sleep-timer'); if (tm) tm.style.display = 'none';
  const c = document.getElementById('sandman-content-container');
  if (c && !document.getElementById('sandman-wakeup-btn')) {
    const b = document.createElement('button'); b.id = 'sandman-wakeup-btn'; b.innerText = 'Wake Up';
    Object.assign(b.style, { marginTop: '30px', padding: '16px 48px', fontSize: '1.2rem', fontWeight: '600', color: 'white', backgroundColor: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '50px', cursor: 'pointer', backdropFilter: 'blur(10px)', transition: 'all 0.3s ease', animation: 'sandman-fade-in 1s ease-out' });
    b.onmouseover = () => b.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'; b.onmouseout = () => b.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    b.onclick = () => removeSleepOverlay(); c.appendChild(b);
  }
}

function removeSleepOverlay() {
  if (!sleepOverlay || removalTimeout) return;
  stopLocalTicker(); if (animationFrameId) cancelAnimationFrame(animationFrameId);
  document.removeEventListener('play', pauseAllMedia, true); document.body.style.overflow = '';
  
  sleepOverlay.style.opacity = '0';
  sleepOverlay.style.pointerEvents = 'none';
  sleepOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0)';
  sleepOverlay.style.backdropFilter = 'grayscale(1) blur(0px) saturate(100%)';
  (sleepOverlay.style as any).webkitBackdropFilter = 'grayscale(1) blur(0px) saturate(100%)';

  removalTimeout = window.setTimeout(() => {
    // Only remove if we haven't restarted in the meantime
    if (sleepOverlay && (!isActiveState || !isAsleepState)) {
      sleepOverlay.remove();
      sleepOverlay = null;
    }
    removalTimeout = null;
  }, 1500);
}

function updateTimer(s: number) { const te = document.getElementById('sandman-sleep-timer'); if (te) te.innerText = formatTime(s); }
function formatTime(s: number) { return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`; }
function injectStyles() {
  if (!document.getElementById('sandman-dreamy-styles')) {
    const s = document.createElement('style'); s.id = 'sandman-dreamy-styles';
    s.innerHTML = `@keyframes sandman-float { from { transform: translateY(0); } to { transform: translateY(-15px); } } @keyframes sandman-fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`;
    document.head.appendChild(s);
  }
}

const observer = new MutationObserver(() => {
  if (isActiveState && isAsleepState && !isFinished && !removalTimeout) {
    if (sleepOverlay && !document.body.contains(sleepOverlay)) {
      sleepOverlay = null; showSleepOverlay(lastTimeLeft); startLocalTicker();
    }
  }
});
observer.observe(document.body, { childList: true });

window.addEventListener('resize', () => { if (sleepOverlay) { const c = sleepOverlay.querySelector('canvas'); if (c) { c.width = window.innerWidth; c.height = window.innerHeight; } } });
