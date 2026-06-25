const electron = require('electron');
const Positioner = require('electron-positioner');
const { IpcServer } = require('./ipc.js');
const { POSITIONS } = require('./constants.js');

const { app, BrowserWindow, ipcMain } = electron;

// More user agents here:
// https://developers.whatismybrowser.com/useragents/explore/operating_platform/smart-tv/
const userAgent = 'Mozilla/5.0 (SMART-TV; Linux; Tizen 2.4.0) AppleWebkit/538.1 (KHTML, like Gecko) SamsungBrowser/1.1 TV Safari/538.1';

const DEBUG = process.env.DEBUG === '1' || process.env.DEBUG === 'true';
const LOG_FRAMES = process.env.LOG_FRAMES === '1' || process.env.LOG_FRAMES === 'true';
const LOG_BIND_BODIES = process.env.LOG_BIND_BODIES === '1' || process.env.LOG_BIND_BODIES === 'true';
const DISCONNECT_GRACE_MS = Number(process.env.DISCONNECT_GRACE_MS || 2500);
const LIVENESS_TIMEOUT_MS = Number(process.env.LIVENESS_TIMEOUT_MS || 20000);

const ipcInstance = new IpcServer();

let screenCastWindow = null;
let activeSocket = null;
let livenessTimer = null;
let terminateTimer = null;
let terminateArmedAt = 0;
let lastActivityAt = Date.now();
let lastPlaybackAt = 0;
let lastStrongResumeAt = 0;

function dlog(...args) {
  if (DEBUG) console.log('[MMM-Screencast]', ...args);
}

function ilog(...args) {
  console.log('[MMM-Screencast]', ...args);
}

function markActivity(kind = 'net') {
  lastActivityAt = Date.now();
  dlog('activity:', kind);
}

function notifyQuit(reason) {
  if (!activeSocket) return;

  try { ipcInstance.server.emit(activeSocket, 'quit', { reason }); } catch (_) {}
  try { ipcInstance.emit(activeSocket, 'QUIT_HEARD', { reason }); } catch (_) {}
}

function closeWindow(reason = 'disconnect') {
  if (!screenCastWindow || screenCastWindow.isDestroyed()) {
    notifyQuit(reason);
    setTimeout(() => app.quit(), 100);
    return;
  }

  dlog(`closing window: ${reason}`);
  notifyQuit(reason);

  try {
    screenCastWindow.removeAllListeners('close');
    screenCastWindow.close();
  } catch (error) {
    dlog('error closing window:', error && error.message ? error.message : error);
  } finally {
    setTimeout(() => app.quit(), 750);
  }
}

function scheduleLivenessCheck() {
  if (livenessTimer) clearInterval(livenessTimer);

  livenessTimer = setInterval(() => {
    if (!screenCastWindow || screenCastWindow.isDestroyed()) {
      clearInterval(livenessTimer);
      livenessTimer = null;
      return;
    }

    const idleFor = Date.now() - lastActivityAt;
    if (idleFor > LIVENESS_TIMEOUT_MS) {
      closeWindow(`liveness-timeout-${idleFor}`);
    }
  }, Math.min(5000, Math.max(1000, LIVENESS_TIMEOUT_MS / 4)));
}

function armTerminate(reason) {
  terminateArmedAt = Date.now();

  if (terminateTimer) clearTimeout(terminateTimer);
  dlog(`disconnect signal armed: ${reason}`);

  terminateTimer = setTimeout(() => {
    const resumedRecently =
      Date.now() - lastPlaybackAt < DISCONNECT_GRACE_MS ||
      Date.now() - lastStrongResumeAt < DISCONNECT_GRACE_MS;

    if (resumedRecently) {
      dlog('disconnect signal canceled after playback resumed');
      terminateTimer = null;
      return;
    }

    closeWindow(`armed-${reason}`);
  }, DISCONNECT_GRACE_MS);
}

function cancelTerminate(reason = 'resume') {
  if (!terminateTimer) return;

  clearTimeout(terminateTimer);
  terminateTimer = null;
  dlog(`disconnect signal canceled: ${reason}`);
}

function notePlayback() {
  lastPlaybackAt = Date.now();
  cancelTerminate('playback');
}

function noteStrongResume() {
  lastStrongResumeAt = Date.now();
  cancelTerminate('resume');
}

function parseUrl(value) {
  try {
    return new URL(value);
  } catch (_) {
    return null;
  }
}

function isYouTube(url) {
  return /(^|\.)youtube\.com$/.test(url.hostname);
}

function isGoogleVideo(url) {
  return /(^|\.)googlevideo\.com$/.test(url.hostname);
}

function looksLikeBind(value) {
  const url = parseUrl(value);
  return !!url && isYouTube(url) && /\/api\/lounge\/bc\/bind/.test(url.pathname);
}

function looksLikeTerminate(value) {
  const url = parseUrl(value);
  return !!url && looksLikeBind(value) && /[?&]TYPE=terminate(&|$)/i.test(url.search || '');
}

function looksLikeHandoff(value) {
  const url = parseUrl(value);
  return !!url && isYouTube(url) && /\/youtubei\/v1\/mdx\/handoff/.test(url.pathname);
}

function looksLikeAccountSwitch(value) {
  const url = parseUrl(value);
  return !!url && isYouTube(url) && url.pathname === '/tv' && url.searchParams.get('is_account_switch') === '1';
}

function looksLikePlaylistOrNext(value) {
  const url = parseUrl(value);
  return !!url && isYouTube(url) && (
    /\/youtubei\/v1\/next$/.test(url.pathname) ||
    /\/s\/player\/.*\/tv-player-ias\./.test(url.pathname)
  );
}

function looksLikePlayback(value) {
  const url = parseUrl(value);
  return !!url && isGoogleVideo(url) && (
    /\/videoplayback/.test(url.pathname) ||
    /\/initplayback/.test(url.pathname)
  );
}

function sanitize(value) {
  const url = parseUrl(value);
  if (!url) return value;

  const query = Array.from(url.searchParams.keys())
    .slice(0, 8)
    .map((key) => `${key}${url.searchParams.get(key) ? '=...' : ''}`)
    .join('&');

  return `${url.origin}${url.pathname}${query ? '?' + query : ''}`;
}

function wireNetworkDetectors(session) {
  session.webRequest.onBeforeRequest(
    { urls: ['*://*.youtube.com/*', '*://*.googlevideo.com/*'] },
    (details, callback) => {
      const { url, id: requestId } = details;
      markActivity('request');

      if (looksLikeTerminate(url)) {
        ilog('frame: pending-terminate', sanitize(url));
        armTerminate('mdx-terminate');
      }

      if (looksLikeHandoff(url)) {
        armTerminate('mdx-handoff');
      }

      if (looksLikePlaylistOrNext(url)) {
        noteStrongResume();
      }

      if (looksLikePlayback(url)) {
        notePlayback();
      }

      if (LOG_BIND_BODIES && looksLikeBind(url) && typeof session.webRequest.filterResponseData === 'function') {
        try {
          const filter = session.webRequest.filterResponseData(requestId);
          let total = 0;
          let captured = Buffer.alloc(0);

          filter.on('data', (chunk) => {
            total += chunk.length;

            if (captured.length < 32768) {
              const slice = chunk.slice(0, Math.max(0, 32768 - captured.length));
              captured = Buffer.concat([captured, slice], captured.length + slice.length);
            }

            filter.write(chunk);
          });

          filter.on('end', () => {
            try {
              const text = captured.toString('utf8');

              if (text.includes('"remoteDisconnected"') || text.includes('["remoteDisconnected"')) {
                armTerminate('remoteDisconnected');
              }

              if (text.includes('"remoteConnected"') || text.includes('["remoteConnected"')) {
                noteStrongResume();
              }

              dlog('bind body bytes:', total);
            } catch (_) {}

            filter.end();
          });
        } catch (error) {
          dlog('bind body sniff error:', error && error.message ? error.message : error);
        }
      }

      callback({});
    }
  );

  session.webRequest.onCompleted(
    { urls: ['*://*.youtube.com/*', '*://*.googlevideo.com/*'] },
    (details) => {
      markActivity('complete');

      if (LOG_FRAMES) {
        ilog('frame:', details.statusCode, sanitize(details.url));
      }

      if (looksLikeAccountSwitch(details.url)) {
        noteStrongResume();
      }
    }
  );
}

function buildDisconnectWatcherScript() {
  return `
    (function () {
      const TAG = 'MMMSC:DISCONNECT:';
      let everConnected = false;

      function hasValue(value) {
        return value && value.replace(/[["\\\\]\\s]/g, '') !== '';
      }

      function wasEverConnected() {
        try {
          return !!(
            localStorage.getItem('yt-remote-session-app') ||
            localStorage.getItem('yt-remote-session-name') ||
            hasValue(localStorage.getItem('yt-remote-connected-devices'))
          );
        } catch (e) {}

        return false;
      }

      function isDisconnectedNow() {
        try {
          const sessionApp = localStorage.getItem('yt-remote-session-app');
          const sessionName = localStorage.getItem('yt-remote-session-name');
          const devices = localStorage.getItem('yt-remote-connected-devices');

          return !sessionApp && !sessionName && !hasValue(devices);
        } catch (e) {}

        return false;
      }

      const originalSet = localStorage.setItem.bind(localStorage);
      const originalRemove = localStorage.removeItem.bind(localStorage);
      const originalClear = localStorage.clear.bind(localStorage);

      function check(source) {
        if (!everConnected && wasEverConnected()) everConnected = true;

        if (everConnected && isDisconnectedNow()) {
          try { console.log(TAG + source); } catch (e) {}
        }
      }

      localStorage.setItem = function (key, value) {
        originalSet(key, value);
        check('set:' + key);
      };

      localStorage.removeItem = function (key) {
        originalRemove(key);
        check('remove:' + key);
      };

      localStorage.clear = function () {
        originalClear();
        check('clear');
      };

      const observer = new MutationObserver(function () { check('dom'); });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      check('bootstrap');
    })();
  `;
}

function buildAutoPlayScript() {
  return `
    const videoEle = document.getElementsByTagName('video');
    if (!!videoEle && videoEle.length > 1) videoEle[0].play();
  `;
}

function buildAutoCloseScript() {
  return `
    let videoEleStop;

    const interval = setInterval(() => {
      videoEleStop = document.getElementsByTagName('video')[0];

      if (videoEleStop) {
        videoEleStop.addEventListener('ended', () => {
          console.log('mmm-screencast.exited');
        });
        clearInterval(interval);
      }
    }, 1000);
  `;
}

function createWindow(data, socket) {
  const { url, position, width, height, x, y } = data;
  const usingXY = x && y;

  activeSocket = socket;
  lastActivityAt = Date.now();
  lastPlaybackAt = 0;
  lastStrongResumeAt = 0;
  terminateArmedAt = 0;
  cancelTerminate('new-window');

  if (screenCastWindow && !screenCastWindow.isDestroyed()) {
    screenCastWindow.close();
  }

  screenCastWindow = new BrowserWindow({
    maxHeight: height,
    maxWidth: width,
    resize: false,
    width,
    height,
    darkTheme: true,
    alwayOnTop: true,
    show: false,
    frame: false,
    zoomFactor: 1.0,
    focusable: false,
    ...(usingXY ? { x, y } : {})
  });

  screenCastWindow.webContents.session.setUserAgent(userAgent);

  if (!usingXY && POSITIONS[position]) {
    const positioner = new Positioner(screenCastWindow);
    positioner.move(POSITIONS[position]);
  }

  screenCastWindow.webContents.on('console-message', (_event, _level, message) => {
    if (message === 'mmm-screencast.exited') {
      closeWindow('video-ended');
      return;
    }

    if (typeof message === 'string' && message.startsWith('MMMSC:DISCONNECT:')) {
      armTerminate(message.slice('MMMSC:DISCONNECT:'.length) || 'localStorage');
      return;
    }

    dlog('console:', message);
  });

  screenCastWindow.once('ready-to-show', () => {
    screenCastWindow.show();
    screenCastWindow.webContents.executeJavaScript(buildAutoPlayScript(), true);
    screenCastWindow.webContents.executeJavaScript(buildDisconnectWatcherScript(), true);
    screenCastWindow.webContents.executeJavaScript(buildAutoCloseScript(), true);
    ipcInstance.emit(socket, 'APP_READY', {});
  });

  screenCastWindow.on('closed', () => {
    screenCastWindow = null;
    if (livenessTimer) {
      clearInterval(livenessTimer);
      livenessTimer = null;
    }
  });

  wireNetworkDetectors(screenCastWindow.webContents.session);
  scheduleLivenessCheck();
  screenCastWindow.loadURL(url);
}

ipcInstance.on('QUIT', (_data, socket) => {
  activeSocket = socket || activeSocket;
  ipcInstance.emit(socket, 'QUIT_HEARD', {});
  app.quit();
  process.exit();
});

app.once('ready', () => {
  electron.session.defaultSession.setUserAgent(userAgent);

  ipcInstance.on('SEND_CONFIG', (data, socket) => {
    createWindow(data, socket);
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

ipcMain.on('media-idle', () => {
  if (Date.now() - terminateArmedAt < 15000) {
    closeWindow('terminate-media-idle');
  }
});

process.on('SIGINT', () => closeWindow('sigint'));
process.on('SIGTERM', () => closeWindow('sigterm'));
