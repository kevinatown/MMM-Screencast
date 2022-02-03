const dial = require("peer-dial");
const http = require('http');
const express = require('express');
const { spawn } = require('cross-spawn');
const { IpcClient } = require('./ipc.js');
const { MODULE_NOTIFICATIONS } = require('./constants.js');

const app = express();
const server = http.createServer(app);
const PORT = 8569;
const MANUFACTURER = "MMM-Screencast";
const MODEL_NAME = "DIAL Server";
let child = null;

const apps = {
  "YouTube": {
    name: "YouTube",
    state: "stopped",
    allowStop: true,
    pid: null,
    launch: function (launchData, config) {
      const url = "https://www.youtube.com/tv?"+launchData;
      
      child = spawn('npm', ['start'], {
        cwd: 'modules/MMM-Screencast'
      });

      this.ipc = new IpcClient((self) => {
        self.on('connect', (data) => {
          self.emit('SEND_CONFIG', { ...config, url });
        });
      });

      child.stdout.on('data', function(data) {
         console.log('screencast stdout: ' + data);
      });

      child.stderr.on('data', function(data) {
         console.log('screencast stderr: ' + data);
      });

      child.on('close', function(code) {
         console.log('closing code: ' + code);
      });
    }
  }
};

class DialServer {
  constructor() {
    this.dialServer;
    this._mmSendSocket;
    this._castAppName = null;
    this.config = {};
    this.server = http.createServer(app);
  }

  initDialServer(port) {
    this.dialServer = new dial.Server({
      port,
      corsAllowOrigins: true,
      expressApp: app,
      prefix: "/dial",
      manufacturer: MANUFACTURER,
      modelName: MODEL_NAME,
      launchFunction: null,
      delegate: {
        getApp: function(appName) {
          return apps[appName];
        },
        
        launchApp: (appName, lauchData, callback) => {
          const castApp = apps[appName];
          if (!!castApp) {
            castApp.pid = 'run';
            castApp.state = 'starting';
            castApp.launch(lauchData, this.config);

            this.mmSendSocket(MODULE_NOTIFICATIONS.launch_app, { app: app.name, state: app.state });

            castApp.ipc.on('APP_READY', () => {
              castApp.state = 'running';
              this._castAppName = appName;
              this.mmSendSocket(MODULE_NOTIFICATIONS.run_app, { app: app.name, state: app.state });
              callback(app.pid);
            });
          }
        },
        stopApp: (appName, pid, callback) => {
          console.log("Got request to stop", appName," with pid: ", pid);
          const castApp = apps[appName];
          
          if (castApp && castApp.pid == pid) {
            castApp.ipc.on('QUIT_HEARD', (data) => {
              castApp.ipc.disconnect();
              castApp.state = 'stopped';
              castApp.pid = null;
              child = null;
              this._castAppName = null;
              this.mmSendSocket(MODULE_NOTIFICATIONS.stop_app, { app: app.name, state: app.state });
              callback(true);
            });

            castApp.ipc.emit('QUIT');
          } else {
            callback(false);
          }
        }
      }
    });
  }

  start() {
    const { castName, port, useIPv6 = false } = this.config;
    const usePort = !!port ? port : PORT;

    this.initDialServer(usePort);

    if (!!castName) {
      this.dialServer.friendlyName = castName;
    }

    this.server.listen(usePort,
      useIPv6 ? '::' : '0.0.0.0',
      () => {
        this.dialServer.start();
        this.mmSendSocket(MODULE_NOTIFICATIONS.start_dial, { port: usePort });
      });
  }

  stopCast() {
    if (this._castAppName) {
      this.dialServer.delegate.stopApp(this._castAppName, 'run', (e) => false);
    }
  }

  get castSocket() {
    return apps[this._castAppName].ipc;
  }

  get mmSendSocket() {
    return this._mmSendSocket;
  }

  set mmSendSocket(socket) {
    return this._mmSendSocket = socket;
  }

  setConfig(_c) {
    this.config = _c;
  }

}

module.exports = DialServer;
