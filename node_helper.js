const NodeHelper = require("node_helper");
const DialServer = require("./DialServer.js");
const { MODULE_NOTIFICATIONS, POSITIONS } = require('./constants.js');

module.exports = NodeHelper.create({
	dialServer: new DialServer(),
	start: function() {
		this.dialServer.mmSendSocket = (n,p) => this.sendSocketNotification(n,p);
	},
	stop: function() {
		this.dialServer.stopCast();
	},
	socketNotificationReceived: function(notification, payload) {
		switch (notification) {
			case 'SET_CONFIG':
				const { x, y, position } = payload;

				if (!(x && y) && !POSITIONS[position]) {
					const message = 'There was an error with your positioning config. Please check your config.'
					console.error(`${MODULE_NOTIFICATIONS.config_error}: ${message}`);
					this.sendSocketNotification(MODULE_NOTIFICATIONS.config_error, { message });
				};

				this.dialServer.setConfig(payload);
				this.dialServer.start();
				break;
			case MODULE_NOTIFICATIONS.close:
				this.dialServer.stopCast();
			default:
				break;
		}
	}
});
