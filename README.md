# homebridge-openremote

Supports OpenRemote on the HomeBridge Platform and provides a status characteristic to Homekit.

# Installation

1. Install homebridge using: npm install -g homebridge
2. Install this plugin by cloning this repo. 
3. Update your configuration file. See sample-config.json for example

Coming soon....

# Configuration

The configuration for this plugin is simlar to [homebridge-http](https://github.com/rudders/homebridge-http) but includes an additional methods to read the power state of the device and the brightness or volume level. If username and password are required add those fields.

To get the URLs required we use [OpenRemote Controller 2.0 HTTP/REST/XML API] (http://www.openremote.org/display/docs/Controller+2.0+HTTP-REST-XML)

For on or off url we can use ON, OFF or click. If we want to poll if that service is on or off we use a sensor (status_url), only one sensor id is permitted, accepted values are ON or OFF.

We can also use one of two extra services, those being "Light" and "Volume".

Volume has a - + control, while brightness has a slider. 
For these to appear make sure you have the "volumeHandling" or "brightnessHandling" set to "yes"

Volume_url is set to the slider address and only accepts integers, while volumelvl_url is set to the slider sensor url. 