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

## Screenshots

<p align="middle">
<img src="/screenshots/screenshot.png" width="400">
<img src="/screenshots/screenshot1.png" width="400">
<img src="/screenshots/screenshot2.jpg" width="400">
</p>

## Special Thanks!
* [@Podgrade](https://github.com/Podgrade) - for the user agent fix
* [@Poolitzer](https://github.com/Poolitzer) - for the screenshots