const dial = require("peer-dial");
const http = require('http');
const express = require('express');
const { spawn } = require('cross-spawn');
const ipc = require('node-ipc');
ipc.config.id = 'screenCastWindow';
ipc.config.retry = 1000;
ipc.config.socketRoot = 'tmp';
ipc.config.networkHost = 'localhost';
ipc.config.appSpace = 'MMM-Screencast';
ipc.config.port = 8123;

const socketId = 'screenCastWindow';
const socketDomain = `/${ipc.config.socketRoot}/${ipc.config.appSpace}.${socketId}`;

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
      let url = "http://www.youtube.com/tv?"+launchData;
      
      child = spawn('npm', ['start', url, config.position, config.width, config.height], {
				cwd: 'modules/MMM-Screencast'
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

var dialServer = new dial.Server({
	corsAllowOrigins: true,
	expressApp: app,
	port: PORT,
	prefix: "/dial",
	manufacturer: MANUFACTURER,
	modelName: MODEL_NAME,
	launchFunction: null,
	electronConfig: {},
	delegate: {
		getApp: function(appName){
			var app = apps[appName];
			return app;
		},
		
		launchApp: function(appName, lauchData, callback){
			let app = apps[appName];
			var pid = null;
			if (app) {
				app.pid = "run";
				app.state = "starting";
        app.launch(lauchData, dialServer.electronConfig);
        app.state = "running";
			}


			callback(app.pid);
		},

		stopApp: function(appName, pid, callback) {
      
      console.log("Got request to stop", appName," with pid: ", pid);

			let app = apps[appName];
			
			if (app && app.pid == pid) {
				app.pid = null;
				app.state = "stopped";
				ipc.connectTo(socketId,
					socketDomain,
					() => {

    				ipc.of.screenCastWindow.on('connect',() => {
              ipc.of.screenCastWindow.emit('quit');
            });

        		ipc.of.screenCastWindow.on('quit', () => {
        			ipc.disconnect('screenCastWindow');
        		});
    			}
    		);
    		
    		child = null;
				callback(true);
			}
			else {
				callback(false);
			}
		}
	}
});

var App = function() {
	this.config = {};
	this.server = http.createServer(app);

	this.start = function(config) {
		dialServer.electronConfig = config;

		this.server.listen(PORT, function() {
			dialServer.start();
			console.log("DIAL Server is running on PORT "+PORT);
		});
	};

};

module.exports = new App();
