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

// WebGL Variables (Global for main overlay)
let mainAnimationFrameId: number | null = null;
const startTime = Date.now();
const mousePos = { x: 0.5, y: 0.5 };

// Local State Cache
let tickerInterval: number | null = null;
let lastKnownTitle = '';
let currentBlocklist: string[] = [];
let currentMode: 'blacklist' | 'whitelist' = 'blacklist';
let currentSettings: Settings = { blockAI: false, blockCommon: true, strictSubdomains: false, blockYouTube: false };

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
  blockYouTube: boolean;
}

function hexToVec4(hex: string): [number, number, number, number] {
  const hexStr = hex.replace('#', '');
  let r = 0, g = 0, b = 0, a = 1;
  if (hexStr.length === 6) {
    r = parseInt(hexStr.slice(0, 2), 16) / 255;
    g = parseInt(hexStr.slice(2, 4), 16) / 255;
    b = parseInt(hexStr.slice(4, 6), 16) / 255;
  } else if (hexStr.length === 8) {
    r = parseInt(hexStr.slice(0, 2), 16) / 255;
    g = parseInt(hexStr.slice(2, 4), 16) / 255;
    b = parseInt(hexStr.slice(4, 6), 16) / 255;
    a = parseInt(hexStr.slice(6, 8), 16) / 255;
  }
  return [r, g, b, a];
}

function checkTitleEducational(title: string): boolean {
  const eduKeywords = [
    'tutorial', 'lesson', 'course', 'how to', 'explained', 'science', 'math', 
    'history', 'coding', 'programming', 'lecture', 'documentary', 'physics', 
    'chemistry', 'biology', 'engineering', 'academic', 'talk', 'university',
    'khan academy', 'veritasium', 'vsauce', 'ted talk', 'ted-ed', '3blue1brown',
    'crashcourse', 'kurzgesagt'
  ];
  
  const brainrotKeywords = [
    'brainrot', 'skibidi', 'sigma', 'rizz', 'gyatt', 'fanum', 'challenge', 
    'prank', 'reacting to', 'mrbeast', 'among us', 'minecraft manhunt', 
    'unboxing', 'haul', 'vlog', 'daily life', 'asrm', 'satisfying', 'compilation',
    'shorts', 'funny moments', 'meme', 'troll'
  ];

  const hasBrainrot = brainrotKeywords.some(k => title.includes(k));
  if (hasBrainrot) return false;

  const hasEdu = eduKeywords.some(k => title.includes(k));
  return hasEdu;
}

function isEducationalYouTube(): boolean {
  if (!window.location.hostname.includes('youtube.com')) return false;
  
  // Respect the "Block all YouTube" setting
  if (currentSettings.blockYouTube) return false;

  // Allow home page and search results for navigation, but we will filter them in updateYouTubeUI
  if (window.location.pathname === '/' || window.location.pathname === '/results') return true;

  // YouTube Shorts are strictly forbidden
  if (window.location.pathname.includes('/shorts/')) return false;
  
  // Browsing (trending, subs) is forbidden
  if (window.location.pathname.startsWith('/feed/')) return false;

  const selectors = [
    'h1.ytd-video-primary-info-renderer',
    '#title h1',
    'yt-formatted-string.ytd-video-primary-info-renderer',
    '#container > h1 > yt-formatted-string'
  ];
  
  let title = '';
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el?.textContent?.trim()) {
      title = el.textContent.trim().toLowerCase();
      break;
    }
  }
  
  if (!title && document.title.includes(' - YouTube')) {
    title = document.title.replace(' - YouTube', '').toLowerCase();
  }
  
  if (!title) return true; // Leniency during initial load to prevent flicker

  return checkTitleEducational(title);
}

function updateYouTubeUI() {
  if (!window.location.hostname.includes('youtube.com')) return;
  
  const isEdu = isEducationalYouTube();
  
  const elementsToHide = [
    '#secondary', // Sidebar suggestions
    'ytd-watch-next-secondary-results-renderer', // More sidebar
    '#comments', // Comments
    '.ytd-companion-slot-renderer', // Ads
    '.ytd-player-ads', // Ads
    'ytd-merch-shelf-renderer', // Shops/Merch
    '#shopping-reel', // Shops
    '#panels-container', // Side panels
    'ytd-browse[page-subtype="home"] #header', // Home feed header
    '#guide', // Side guide (subs/home/etc)
    'ytd-rich-section-renderer', // Shorts shelf on home, etc.
    'ytd-reel-shelf-renderer', // More shorts
  ];

  if (isActiveState && isEdu) {
    elementsToHide.forEach(selector => {
      const el = document.querySelector(selector) || document.getElementById(selector.replace('#', ''));
      if (el) (el as HTMLElement).style.display = 'none';
    });
    
    // FILTER HOME FEED AND SEARCH RESULTS
    if (window.location.pathname === '/' || window.location.pathname === '/results') {
       const videoItems = document.querySelectorAll('ytd-rich-item-renderer, ytd-video-renderer');
       videoItems.forEach(item => {
         const titleElem = item.querySelector('#video-title, #video-title-link');
         const title = titleElem?.textContent?.toLowerCase() || '';
         if (title) {
           const isItemEdu = checkTitleEducational(title);
           (item as HTMLElement).style.display = isItemEdu ? '' : 'none';
         }
       });
    }

    if (window.location.pathname === '/') {
       const masthead = document.getElementById('masthead-container');
       if (masthead) masthead.style.display = ''; 
    }

    const columns = document.getElementById('columns');
    const primary = document.getElementById('primary');
    if (columns) {
      columns.style.display = 'flex';
      columns.style.flexDirection = 'column';
      columns.style.alignItems = 'center';
      if (primary) {
        primary.style.width = '100%';
        primary.style.maxWidth = '1200px';
        primary.style.padding = '0 20px';
      }
    }
  } else {
    elementsToHide.forEach(selector => {
      const el = document.querySelector(selector) || document.getElementById(selector.replace('#', ''));
      if (el) (el as HTMLElement).style.display = '';
    });
    
    const columns = document.getElementById('columns');
    if (columns) {
      columns.style.display = '';
      columns.style.flexDirection = '';
      columns.style.alignItems = '';
    }
    
    const videoItems = document.querySelectorAll('ytd-rich-item-renderer, ytd-video-renderer');
    videoItems.forEach(item => { (item as HTMLElement).style.display = ''; });
  }
}

function checkIsDistracting(blocklist: string[], mode: 'blacklist' | 'whitelist', settings: Settings): boolean {
  const hostname = window.location.hostname;
  const normalizedHostname = hostname.replace(/^www\./, '');

  if (normalizedHostname === 'youtube.com') {
    return !isEducationalYouTube();
  }

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
  
  if (data.blocklist) currentBlocklist = data.blocklist;
  if (data.mode) currentMode = data.mode;
  if (data.settings) currentSettings = data.settings;

  isAsleepState = checkIsDistracting(currentBlocklist, currentMode, currentSettings);

  if (isActiveState && isAsleepState) {
    if (lastTimeLeft > 0) isFinished = false;
    showSleepOverlay(lastTimeLeft);
    startLocalTicker();
  } else if (sleepOverlay) {
    if (lastTimeLeft === 0) {
      setFinishedState();
    } else {
      removeSleepOverlay();
    }
  }
  
  updateYouTubeUI();
}

chrome.runtime.onMessage.addListener((message: StateUpdateData & { type: string; timeLeft?: number }) => {
  if (message.type === 'UPDATE_SLEEP') {
    handleStateUpdate(message);
  } else if (message.type === 'TICK' && message.timeLeft !== undefined) {
    lastTimeLeft = message.timeLeft;
    if (!tickerInterval && isActiveState && isAsleepState) startLocalTicker();
    updateYouTubeUI();
  }
});

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
    if (displayTime === 0) { 
      setFinishedState(); 
      stopLocalTicker(); 
      chrome.runtime.sendMessage({ type: 'FINISH_TIMER' }).catch(() => {});
    }
  }, 1000);
}

function stopLocalTicker() {
  if (tickerInterval) { clearInterval(tickerInterval); tickerInterval = null; }
}

function showSleepOverlay(timeLeft: number) {
  if (removalTimeout) { clearTimeout(removalTimeout); removalTimeout = null; }

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
    Object.assign(canvas.style, { position: 'absolute', inset: '0', zIndex: '-1', filter: 'blur(15px)', transform: 'scale(1.1)', opacity: '1.0' });
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    sleepOverlay.appendChild(canvas);
    
    const result = initWebGL(canvas);
    if (result) {
      mainAnimationFrameId = result.animationFrameId;
    }

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
    
    const subtext = document.createElement('h3');
    subtext.id = 'sandman-sub-phrase';
    const randomPhrase = driftPhrases[Math.floor(Math.random() * driftPhrases.length)];
    subtext.innerText = randomPhrase;
    Object.assign(subtext.style, { fontSize: '1.2rem', fontWeight: '400', margin: '0 0 25px 0', opacity: '0.8', fontStyle: 'italic' });

    const timer = document.createElement('p');
    timer.id = 'sandman-sleep-timer';
    timer.innerText = formatTime(timeLeft);
    Object.assign(timer.style, { fontSize: '2rem', color: 'rgba(255, 255, 255, 0.7)', fontVariantNumeric: 'tabular-nums' });
    content.appendChild(text); 
    content.appendChild(subtext);
    content.appendChild(timer); 
    sleepOverlay.appendChild(content);
    document.body.appendChild(sleepOverlay);
  }

  Object.assign(sleepOverlay.style, {
    display: 'flex',
    opacity: '1',
    pointerEvents: 'all',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    backdropFilter: 'blur(10px) saturate(100%)'
  });
  (sleepOverlay.style as any).webkitBackdropFilter = 'blur(10px) saturate(100%)';

  document.body.style.overflow = 'hidden';
  document.addEventListener('play', pauseAllMedia, true);
  updateTimer(timeLeft);
}

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
  uniform float iTime;
  uniform vec3 iResolution;
  uniform vec4 uColor1;
  uniform vec4 uColor2;
  uniform vec4 uColor3;
  uniform vec2 uMouse;
  const float uSpinRotation = -2.0;
  const float uSpinSpeed = 7.0;
  const vec2 uOffset = vec2(0.0, 0.0);
  const float uContrast = 3.5;
  const float uLighting = 0.4;
  const float uSpinAmount = 0.25;
  const float uPixelFilter = 700.0;
  const float uSpinEase = 1.0;
  const bool uIsRotate = false;
  varying vec2 vUv;
  vec4 effect(vec2 screenSize, vec2 screen_coords) {
      float pixel_size = length(screenSize.xy) / uPixelFilter;
      vec2 uv = (floor(screen_coords.xy * (1.0 / pixel_size)) * pixel_size - 0.5 * screenSize.xy) / length(screenSize.xy) - uOffset;
      float uv_len = length(uv);
      float speed = (uSpinRotation * uSpinEase * 0.2) + 302.2;
      float mouseInfluence = (uMouse.x * 2.0 - 1.0);
      speed += mouseInfluence * 0.1;
      float new_pixel_angle = atan(uv.y, uv.x) + speed - uSpinEase * 20.0 * (uSpinAmount * uv_len + (1.0 - uSpinAmount));
      vec2 mid = (screenSize.xy / length(screenSize.xy)) / 2.0;
      uv = (vec2(uv_len * cos(new_pixel_angle) + mid.x, uv_len * sin(new_pixel_angle) + mid.y) - mid);
      uv *= 30.0;
      float baseSpeed = iTime * uSpinSpeed;
      speed = baseSpeed + mouseInfluence * 2.0;
      vec2 uv2 = vec2(uv.x + uv.y);
      for(int i = 0; i < 5; i++) {
          uv2 += sin(max(uv.x, uv.y)) + uv;
          uv += 0.5 * vec2(cos(5.1123314 + 0.353 * uv2.y + speed * 0.131121), sin(uv2.x - 0.113 * speed));
          uv -= cos(uv.x + uv.y) - sin(uv.x * 0.711 - uv.y);
      }
      float contrast_mod = (0.25 * uContrast + 0.5 * uSpinAmount + 1.2);
      float paint_res = min(2.0, max(0.0, length(uv) * 0.035 * contrast_mod));
      float c1p = max(0.0, 1.0 - contrast_mod * abs(1.0 - paint_res));
      float c2p = max(0.0, 1.0 - contrast_mod * abs(paint_res));
      float c3p = 1.0 - min(1.0, c1p + c2p);
      float light = (uLighting - 0.2) * max(c1p * 5.0 - 4.0, 0.0) + uLighting * max(c2p * 5.0 - 4.0, 0.0);
      return (0.3 / uContrast) * uColor1 + (1.0 - 0.3 / uContrast) * (uColor1 * c1p + uColor2 * c2p + vec4(c3p * uColor3.rgb, c3p * uColor1.a)) + light;
  }
  void main() {
      vec2 uv = vUv * iResolution.xy;
      gl_FragColor = effect(iResolution.xy, uv);
  }
`;

function initWebGL(canvas: HTMLCanvasElement, colors?: { c1: string, c2: string, c3: string }) {
  const gl = canvas.getContext('webgl'); if (!gl) return null;
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  if (!vs || !fs) return null;
  const program = createProgram(gl, vs, fs); if (!program) return null;

  const pLoc = gl.getAttribLocation(program, "position");
  const uLoc = gl.getAttribLocation(program, "uv");
  const pBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, pBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const uBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);

  const iTimeLoc = gl.getUniformLocation(program, "iTime");
  const iResLoc = gl.getUniformLocation(program, "iResolution");
  const uCol1Loc = gl.getUniformLocation(program, "uColor1");
  const uCol2Loc = gl.getUniformLocation(program, "uColor2");
  const uCol3Loc = gl.getUniformLocation(program, "uColor3");
  const uMouseLoc = gl.getUniformLocation(program, "uMouse");

  const c1 = hexToVec4(colors?.c1 || '#0f172a');
  const c2 = hexToVec4(colors?.c2 || '#b75fb5');
  const c3 = hexToVec4(colors?.c3 || '#1e293b');

  let animationFrameId: number = 0;
  const render = () => {
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.useProgram(program);
    gl.enableVertexAttribArray(pLoc); gl.bindBuffer(gl.ARRAY_BUFFER, pBuf); gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(uLoc); gl.bindBuffer(gl.ARRAY_BUFFER, uBuf); gl.vertexAttribPointer(uLoc, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(iTimeLoc, (Date.now() - startTime) * 0.001);
    gl.uniform3f(iResLoc, gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height);
    gl.uniform4fv(uCol1Loc, new Float32Array(c1));
    gl.uniform4fv(uCol2Loc, new Float32Array(c2));
    gl.uniform4fv(uCol3Loc, new Float32Array(c3));
    gl.uniform2f(uMouseLoc, mousePos.x, mousePos.y);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    animationFrameId = requestAnimationFrame(render);
  };
  render();
  return { gl, program, animationFrameId };
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

function blockEmbeds() {
  if (!isActiveState) return;
  const embeds = document.querySelectorAll('iframe[src*="youtube.com/embed"], iframe[src*="youtube-nocookie.com/embed"], iframe[src*="youtu.be/"]');
  embeds.forEach((iframe) => {
    if (iframe instanceof HTMLIFrameElement) {
      if (iframe.parentElement?.classList.contains('sandman-placeholder-container')) return;
      
      const originalSrc = iframe.src;
      const container = document.createElement('div');
      container.className = 'sandman-placeholder-container';
      const width = iframe.offsetWidth ? iframe.offsetWidth + 'px' : '100%';
      const height = iframe.offsetHeight ? iframe.offsetHeight + 'px' : '300px';
      
      Object.assign(container.style, {
        width: width, height: height, position: 'relative', display: 'inline-flex',
        borderRadius: '12px', overflow: 'hidden', margin: '10px 0', boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
      });

      const canvas = document.createElement('canvas');
      Object.assign(canvas.style, { position: 'absolute', inset: '0', zIndex: '1', filter: 'blur(10px)', transform: 'scale(1.1)', opacity: '0.6' });
      canvas.width = iframe.offsetWidth || 400; canvas.height = iframe.offsetHeight || 300;
      container.appendChild(canvas);
      initWebGL(canvas);

      const glass = document.createElement('div');
      Object.assign(glass.style, { position: 'absolute', inset: '0', backgroundColor: 'rgba(15, 23, 42, 0.25)', zIndex: '2' });
      container.appendChild(glass);

      const content = document.createElement('div');
      Object.assign(content.style, {
        position: 'absolute', inset: '0', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', color: 'white',
        fontFamily: "'Montserrat Alternates', sans-serif", textAlign: 'center', padding: '20px', zIndex: '3'
      });

      const text = document.createElement('div');
      text.innerText = 'Embed put to sleep by sandman';
      Object.assign(text.style, { fontSize: '1.2rem', fontWeight: '600', textShadow: '0 2px 10px rgba(0,0,0,0.5)', marginBottom: '15px' });

      const btn = document.createElement('button');
      btn.innerText = 'Try on youtube';
      Object.assign(btn.style, {
        padding: '10px 24px', fontSize: '0.9rem', fontWeight: '600', color: 'white',
        backgroundColor: 'rgba(255, 255, 255, 0.15)', border: '1px solid rgba(255, 255, 255, 0.3)',
        borderRadius: '50px', cursor: 'pointer', backdropFilter: 'blur(10px)', transition: 'all 0.3s ease'
      });
      btn.onmouseover = () => btn.style.backgroundColor = 'rgba(255, 255, 255, 0.25)';
      btn.onmouseout = () => btn.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
      btn.onclick = () => {
        let watchUrl = originalSrc.replace('/embed/', '/watch?v=');
        if (watchUrl.includes('?')) watchUrl = watchUrl.split('?')[0] + '?' + watchUrl.split('?')[1];
        window.open(watchUrl, '_blank');
      };

      content.appendChild(text); content.appendChild(btn); container.appendChild(content);
      iframe.parentNode?.replaceChild(container, iframe);
    }
  });
}

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
  stopLocalTicker(); if (mainAnimationFrameId) cancelAnimationFrame(mainAnimationFrameId);
  document.removeEventListener('play', pauseAllMedia, true); document.body.style.overflow = '';
  
  sleepOverlay.style.opacity = '0';
  sleepOverlay.style.pointerEvents = 'none';
  sleepOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0)';
  sleepOverlay.style.backdropFilter = 'grayscale(1) blur(0px) saturate(100%)';
  (sleepOverlay.style as any).webkitBackdropFilter = 'grayscale(1) blur(0px) saturate(100%)';

  removalTimeout = window.setTimeout(() => {
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
    s.innerHTML = `
      @font-face {
        font-family: 'MontserratAlternates';
        src: url('${chrome.runtime.getURL('fonts/MontserratAlternates-SemiBold.ttf')}') format('truetype');
        font-weight: 600;
        font-style: normal;
      }
      @keyframes sandman-float { from { transform: translateY(0); } to { transform: translateY(-15px); } }
      @keyframes sandman-fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes sandman-gradient {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
    `;
    document.head.appendChild(s);
  }
}

const observer = new MutationObserver(() => {
  if (isActiveState && isAsleepState && !isFinished && !removalTimeout) {
    if (sleepOverlay && !document.body.contains(sleepOverlay)) {
      sleepOverlay = null; showSleepOverlay(lastTimeLeft); startLocalTicker();
    }
  }

  if (window.location.hostname.includes('youtube.com')) {
    const titleElem = document.querySelector('h1.ytd-video-primary-info-renderer, #title h1, yt-formatted-string.ytd-video-primary-info-renderer');
    const currentTitle = titleElem?.textContent || '';
    if (currentTitle && currentTitle !== lastKnownTitle) {
      lastKnownTitle = currentTitle;
      chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response: StateUpdateData) => {
        if (response) handleStateUpdate(response);
      });
    }
    updateYouTubeUI();
  }

  blockEmbeds();
});
observer.observe(document.body, { childList: true, subtree: true });

setInterval(blockEmbeds, 2000);

let lastUrl = window.location.href;
setInterval(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    if (window.location.hostname.includes('youtube.com')) {
      chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response: StateUpdateData) => {
        if (response) handleStateUpdate(response);
      });
    }
  }
}, 1000);

window.addEventListener('resize', () => { if (sleepOverlay) { const c = sleepOverlay.querySelector('canvas'); if (c) { c.width = window.innerWidth; c.height = window.innerHeight; } } });
