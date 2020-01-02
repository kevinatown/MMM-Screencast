const dial = require("peer-dial");
const http = require('http');
const express = require('express');
const { spawn } = require('cross-spawn');
const { IpcClient } = require('./ipc.js');

const app = express();
const server = http.createServer(app);
const PORT = 8569;
const MANUFACTURER = "Kevin Townsend";
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
    this.config = {};
    this.server = http.createServer(app);
    this.dialServer = new dial.Server({
      corsAllowOrigins: true,
      expressApp: app,
      port: PORT,
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
            castApp.pid = "run";
            castApp.state = "starting";
            castApp.launch(lauchData, this.config);

            // this.mmSendSocket('MMM-Screencast:LAUNCH-APP', { app: app.name, state: app.state });

            castApp.ipc.on('APP_READY', () => {
              castApp.state = "running";
              // this.mmSendSocket('MMM-Screencast:RUN-APP', { app: app.name, state: app.state });
            });
            
          }

          callback(app.pid);
        },

        stopApp: function(appName, pid, callback) {
          console.log("Got request to stop", appName," with pid: ", pid);
          const app = apps[appName];
          
          if (app && app.pid == pid) {
            app.pid = null;
            app.state = "stopped";
            app.ipc.on('quit', (data) => {
              app.ipc.disconnect();
            });
            app.ipc.emit('quit');

            // this.mmSendSocket('MMM-Screencast:STOP-APP', { app: app.name, state: app.state });
            child = null;

            callback(true);
          } else {
            callback(false);
          }
        }
      }
    });
  }

  start() {
    const { castName, port } = this.config;

    if (!!castName) {
      this.dialServer.friendlyName = castName;
    }

    let usePort = PORT;
    if (!!port) {
      usePort = port;
      this.dialServer.port = port;
    }

    this.server.listen(usePort, () => {
      this.dialServer.start();
      console.log("DIAL Server is running on PORT "+usePort);
    });
  }

  setConfig(_c) {
    this.config = _c;
  }

}

module.exports = DialServer;
