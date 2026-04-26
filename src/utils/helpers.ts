import { COMMON_DISTRACTIONS, AI_SITES } from './constants';

export function normalizeSite(site: string): string {
  let res = site.trim().toLowerCase();
  try {
    if (res.includes('://')) {
      res = new URL(res).hostname;
    } else if (res.includes('/')) {
      res = res.split('/')[0];
    }
  } catch {
    /* ignore URL parsing errors */
  }
  return res.replace(/^www\./, '');
}

export interface BlockSettings {
  blockAI: boolean;
  blockCommon: boolean;
  strictSubdomains: boolean;
  blockYouTube: boolean;
}

export function checkIsDistracting(
  url: string, 
  blocklist: string[], 
  mode: 'blacklist' | 'whitelist', 
  settings: BlockSettings,
  isEducational: boolean = false
): boolean {
  if (!url) return false;
  
  const hostname = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  })();

  if (!hostname || 
      hostname.startsWith('chrome') || 
      hostname.startsWith('about') || 
      hostname.startsWith('edge') || 
      hostname.startsWith('chrome-extension')) {
    return false;
  }

  const normalizedHostname = hostname.replace(/^www\./, '');

  if (normalizedHostname === 'youtube.com' && isEducational) {
    return false;
  }

  const isMatch = (site: string) => {
    const normalizedSite = site.replace(/^www\./, '');
    if (settings.strictSubdomains) {
      return normalizedHostname === normalizedSite;
    } else {
      return normalizedHostname === normalizedSite || normalizedHostname.endsWith('.' + normalizedSite);
    }
  };

  if (mode === 'whitelist') {
    return !blocklist.some(isMatch);
  } else {
    const isSpecialDistraction = (settings.blockCommon && COMMON_DISTRACTIONS.some(isMatch)) || 
                                 (settings.blockAI && AI_SITES.some(isMatch));
    const isCustomMatch = blocklist.some(isMatch);
    return isSpecialDistraction || isCustomMatch;
  }
}

export function formatTime(s: number): string {
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function hexToVec4(hex: string): [number, number, number, number] {
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
