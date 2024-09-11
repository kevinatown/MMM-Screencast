const electron = require('electron');
const Positioner = require('electron-positioner');
const { IpcServer } = require('./ipc.js');
const { POSITIONS } = require('./constants.js');

// more useragents here: https://developers.whatismybrowser.com/useragents/explore/operating_platform/smart-tv/
const userAgent = 'Mozilla/5.0 (SMART-TV; Linux; Tizen 2.4.0) AppleWebkit/538.1 (KHTML, like Gecko) SamsungBrowser/1.1 TV Safari/538.1';
const ipcInstance = new IpcServer();
const app = electron.app;

ipcInstance.on('QUIT', (data, socket) => {
  ipcInstance.emit(socket, 'QUIT_HEARD', {});
  app.quit();
  process.exit();
});

app.once('ready', () => {
  electron.session.defaultSession.setUserAgent(userAgent);

  ipcInstance.on('SEND_CONFIG', (data, socket) => {
    const { url, position, width, height, x, y } = data;

    const usingXY = x && y;

    // electron
    const windowOptions = {
      maxHeight: height,
      maxWidth: width,
      resize: false,
      width: width,
      height: height,
      darkTheme: true,
      alwayOnTop: true,
      show: false,
      frame: false,
      zoomFactor: 1.0,
      focusable: false,
      ...(usingXY ? { x, y } : {})
    };

    const screenCastWindow = new electron.BrowserWindow(windowOptions);

    if (!usingXY && POSITIONS[position]) {
      const positioner = new Positioner(screenCastWindow);
      positioner.move(POSITIONS[position]);
    }

    screenCastWindow.loadURL(url);

     // Show window when page is ready
    screenCastWindow.once('ready-to-show', () => {

      // this is messy for autoplay but youtube, due to chrome no longer supports
      // autoplay
      const autoPlayScript = `
        const videoEle = document.getElementsByTagName('video');
        if (!!videoEle && videoEle.length > 1) videoEle[0].play();
      `;

        //
        // THIS MIGHT NEED WORK
        //
        // maybe something like this:
        //
        // win.webContents.on('console-message', () => {
        //  // do the shit to cloes the window like above
        // })
        //
        // create a specific message or something to know that shit's done, or listen to whatever
        // https://electronjs.org/docs/api/web-contents#event-console-message
        //
        // ipc.server.on('screenCastWindow_config', (data, socket) => {
        //   const { extraScript, closeOnEnd } = data;
        //   const doScript = `${extraScript} ${closeOnEnd ? autoCloseScript : ''}`;
        //   screenCastWindow.webContents.executeJavaScript(doScript, true);

        //   ipc.server.emit(socket, 'quit');
        //   app.quit();
        //   process.exit();
        // });

        // ipc.server.broadcast('screenCastWindow_shown', { show: true });

      const autoCloseScript = `
        let videoEleStop;

       // consistently check the DOM for the video element
        const interval = setInterval(() => {
          videoEleStop = document.getElementsByTagName('video')[0];

         // if the video element exists add an event listener to it and stop the interval
          if (videoEleStop) {
            videoEleStop.addEventListener('ended', (event) => {
              console.log("mmm-screencast.exited");
            });
            clearInterval(interval);
          }
        }, 1000);
      `;

      screenCastWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        if (message === "mmm-screencast.exited") {
           ipcInstance.server.emit(socket, 'quit');
           app.quit();
        }
      });

      screenCastWindow.show();
      // screenCastWindow.webContents.openDevTools();
      screenCastWindow.webContents.executeJavaScript(autoPlayScript, true);
      screenCastWindow.webContents.executeJavaScript(autoCloseScript, true);
      ipcInstance.emit(socket, 'APP_READY', {});
    });
  });
});
