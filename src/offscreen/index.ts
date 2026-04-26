let audio: HTMLAudioElement | null = null;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'PLAY_AUDIO') {
    if (audio) {
      audio.pause();
      audio = null;
    }
    audio = new Audio(message.url);
    audio.play().catch(err => console.error('Offscreen audio play error:', err));
    sendResponse({ success: true });
  } else if (message.type === 'STOP_AUDIO') {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio = null;
    }
    sendResponse({ success: true });
  }
});
