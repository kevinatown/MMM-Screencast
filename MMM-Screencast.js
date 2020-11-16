/* global Module */

/* Magic Mirror
 * Module: MMM-Screencast
 *
 * By Kevin Townsend
 * MIT Licensed.
 */

Module.register("MMM-Screencast", {

	requiresVersion: "2.1.0", // Required version of MagicMirror

	start: function() {
		Log.info("Starting module: " + this.name);
		this.sendSocketNotification('SET_CONFIG', this.config);
	},

	getDom: function() {
		// load fake div
		const div = document.createElement("div");
		return div;
	},
	socketNotificationReceived: function(notification, payload) {
		if (notification.includes('ERROR')) {
			const { message } = payload;
			Log.error(`${notification}: ${message}`);
		}
		this.sendNotification(notification, payload);
	},
	notificationReceived: function(notification, payload, sender) {
		if (notification.includes('MMM-Screencast')) {
			this.sendSocketNotification(notification);
		}
  },
});
