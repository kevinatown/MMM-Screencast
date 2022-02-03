class Ipc {
  static get config() {
    return {
      id: 'screenCastWindow',
      retry: 1000,
      socketRoot: 'tmp',
      networkHost: 'localhost',
      appSpace:'MMM-Screencast',
      port: 8123,
      silent: true
    };
  }
  
  static get socketId() {
    return 'screenCastWindow';
  }

  static get socketDomain() {
    return `/${Ipc.config.socketRoot}/${Ipc.config.appSpace}.${Ipc.socketId}`;
  }

  constructor() {
    this.instance = require('node-ipc');
    this.instance.config = {
      ...this.instance.config,
      ...Ipc.config
    };
  }
}

class IpcServer extends Ipc {
  constructor() {
    super();
    this.instance.serve(Ipc.socketDomain);
    this.instance.server.start();
  }

  get server() {
    return this.instance.server;
  }

  on(type, cb = (data, socket) => null) {
    return this.server.on(type, (data, socket) => cb(data, socket));
  }

  emit(socket, type, payload) {
    return this.server.emit(socket, type, payload);
  }

  broadcast(type, payload) {
    this.server.broadcast(type, payload);
  }
}

class IpcClient extends Ipc {
  constructor(cb = (self) => null) {
    super();
    this.instance.connectTo(Ipc.socketId, Ipc.socketDomain, () => cb(this));
  }

  get client() {
    return this.instance.of[Ipc.socketId];
  }

  emit(type, payload) {
    this.client.emit(type, payload);
  }

  on(type, cb = (data) => null) {
    this.client.on(type, (data) => cb(data));
  }

  disconnect() {
    this.instance.disconnect(Ipc.socketId);
  }
}

module.exports = {
  IpcServer,
  IpcClient
};
