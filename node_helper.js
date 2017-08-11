module.exports = NodeHelper.create({
	dialServer: require("./DialServer.js"),
	config: {},

	start: function() {
	},

	socketNotificationReceived: function(notification, payload) {
		console.log(notification, payload);
		switch (notification) {
			case 'SET_CONFIG':
				this.config = payload;
				this.dialServer.start(payload);
				break;
			default:
				break;
		}
	}
});
