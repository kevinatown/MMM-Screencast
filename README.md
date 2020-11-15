# MMM-Screencast
A module to cast to the [MagicMirror²](https://github.com/MichMich/MagicMirror/). Currently, only YouTube casting is supported. Hopefully, I will have time to add more casting options.

**NOTE: MMM-Screencast has been updated to deal with new support, please pull from master to ensure that you have the most up-to-date version. Thanks!**

## Using the module

* Navigate to the modules directory via the follow command: `cd MagicMirror/modules`
* Clone the module from github: `git clone https://github.com/kevinatown/MMM-Screencast.git`
* Navigate to the MMM-Screencast directory: `cd MMM-Screencast`
* Install the dependencies: `npm install`
* Add the following configuration to the modules array in the `config/config.js` file:
```js
var config = {
    modules: [
        {
		module: 'MMM-Screencast',
		position: 'bottom_right', // This position is for a hidden <div /> and not the screencast window
		config: {
			position: 'bottomRight',
			height: 300,
			width: 500,
		}
        }
    ]
}
```

## Configuration options for MMM-Screencast

| Option    | Description
|---------- |-----------
| `position`| *Required* The position of the screencast window. <br>**Options:** `['bottomRight', 'bottomCenter', 'bottomLeft', 'center',  'topRight', 'topCenter', 'topLeft']` <br>**Type:** `string` <br>**Note:** This module config actual sets the location, not the magic mirror position config.
| `height`  | *Required* Height of the screencast window. <br>**Type:** `number` (pixels)
| `width`   | *Required* Width of the screencast window. <br>**Type:** `number` (pixels)
| `castName`| *Optional* The title to display in your device's cast list. <br>**Type** `string` defalt `os.hostname`
| `port`    | *Optional* A port to run the dialserver on **Type** `number` default `8569`

## Notifications
MMM-Screencast can communicate with other modules through notifications.

### Emmited Notifications
These notifications are emitted by MMM-Screencast.

| Notification | Payload   | Description
|------------- |-----------|------------
| `MMM-Screencast:START-DIAL` | `{ port: <ORT_USED> }`  | Emitted when the DIAL server is running and the port it can be found on. The cast icon should be visible in your app now.
| `MMM-Screencast:LAUNCH-APP` | `{ app: <APP_NAME>, state: <APP_STATE> }` | Emitted when an app is intializing
| `MMM-Screencast:RUN-APP` | `{ app: <APP_NAME>, state: <APP_STATE> }` | Emitted when the app is intialized and running
| `MMM-Screencast:STOP-APP` | `{ app: <APP_NAME>, state: <APP_STATE> }` | Emitted when the app is stopped.

### Listening Notifications
These are the notifications that can be sent to MMM-Screencast in order to control it in some way.

| Notification | Expected Payload | Description
|------------- |------------------|------------
| `MMM-Screencast:CLOSE` | none | This informs MMM-Screencast to close the currently running app. 


## Screenshots

<p align="middle">
<img src="/screenshots/screenshot.png" width="400">
<img src="/screenshots/screenshot1.png" width="400">
<img src="/screenshots/screenshot2.jpg" width="400">
</p>

## Special Thanks and Contributors!
* [@Podgrade](https://github.com/Podgrade) - for the user agent fix
* [@Poolitzer](https://github.com/Poolitzer) - for the screenshots
