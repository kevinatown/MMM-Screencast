const electron, { session } = require('electron');
const Positioner = require('electron-positioner');
const ipc = require('node-ipc');
ipc.config.id = 'screenCastWindow';
ipc.config.retry = 1500;
ipc.config.socketRoot = 'tmp';
ipc.config.networkHost = 'localhost';
ipc.config.appSpace = 'MMM-Screencast';
const url = process.argv[2];
const position = process.argv[3];
const width = parseInt(process.argv[4], 10);
const height = parseInt(process.argv[5], 10);

// more useragents here: https://developers.whatismybrowser.com/useragents/explore/operating_platform/smart-tv/
const userAgent = 'Mozilla/5.0 (SMART-TV; X11; Linux armv7l) AppleWebKit/537.42 (KHTML, like Gecko) Chromium/25.0.1349.2 Chrome/25.0.1349.2 Safari/537.42';


ipc.serve(`/${ipc.config.socketRoot}/${ipc.config.appSpace}.${ipc.config.id}`, () => {
  ipc.server.on('quit', (data, socket) => {
    ipc.server.emit(socket, 'quit');
    app.quit();
    process.exit();
  });
});



const app = electron.app;
session.defaultSession.setUserAgent(userAgent);

app.once('ready', function () {
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
    focusable: false
  };

  const screenCastWindow = new electron.BrowserWindow(windowOptions);

  const positioner = new Positioner(screenCastWindow)
  positioner.move(position)

  screenCastWindow.loadURL(url)

  // Show window when page is ready
  screenCastWindow.once('ready-to-show', function () {
    screenCastWindow.show();
  });

});

ipc.server.start();
