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
		console.log(notification, payload)
		this.sendNotification(notification, payload);
	},
	notificationReceived: function(notification, payload, sender) {
    switch(notification) {
      default:
      	console.log(notification, payload, sender)
      	break;
    }
  },
});
