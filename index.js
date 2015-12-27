var Service, Characteristic, VolumeCharacteristic;
var request = require("request");
var inherits = require('util').inherits;
var xpath = require('xpath'), dom = require('xmldom').DOMParser;

module.exports = function(homebridge){
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  makeVolumeCharacteristic();
  homebridge.registerAccessory("homebridge-openremote", "openremote", OpenRemoteStatusAccessory);
}


function OpenRemoteStatusAccessory(log, config) {
  this.log = log;

// url info
  this.on_url                 = config["on_url"];
  this.on_body                = config["on_body"];
  this.off_url                = config["off_url"];
  this.off_body               = config["off_body"];
  this.status_url             = config["status_url"];
  this.volume_url             = config["volume_url"];
  this.brightness_url         = config["brightness_url"];
  this.volumelvl_url          = config["volumelvl_url"];
  this.brightnesslvl_url      = config["brightnesslvl_url"];
  this.http_method            = config["http_method"] 		 || "GET";
  this.http_brightness_method = config["http_brightness_method"] || this.http_method;
  this.http_volume_method     = config["http_brightness_method"] || this.http_method;
  this.username               = config["username"] 	  	 || "" ;
  this.password               = config["password"] 	  	 || "";
  this.sendimmediately        = config["sendimmediately"] 	 || "";
  this.service                = config["service"] 		 || "Switch";
  this.name                   = config["name"];
  this.brightnessHandling     = config["brightnessHandling"] || "no";
  this.volumeHandling         = config["volumeHandling"]     || "no";
  this.switchHandling         = config["switchHandling"]     || "no";

}

OpenRemoteStatusAccessory.prototype = {

  
  httpRequest: function(url, body, method, username, password, sendimmediately, callback) {
    request({
      url: url,
      body: body,
      method: method,
      auth: {
        user: username,
        pass: password,
        sendImmediately: sendimmediately
      }
    },
    function(error, response, body) {
      callback(error, response, body)
    })
  },

  setPowerState: function(powerOn, callback) {
    var url;
    var body;

    if (powerOn) {
      url = this.on_url;
      body = this.on_body;
      this.log("Setting power state to on");
    } else {
      url = this.off_url;
      body = this.off_body;
      this.log("Setting power state to off");
    }

    this.httpRequest(url, body, this.http_method, this.username, this.password, this.sendimmediately, function(error, response, responseBody) {
      if (error) {
        this.log('HTTP set power function failed: %s', error.message);
        callback(error);
      } else {
        this.log('HTTP set power function succeeded!');
        // this.log(response);
        // this.log(responseBody);
        callback();
      }
    }.bind(this));
  },
  
  getPowerState: function(callback) {
    if (!this.status_url) { callback(null); }
    
    var url = this.status_url;
    this.log("Getting power state");

    this.httpRequest(url, "", "GET", this.username, this.password, this.sendimmediately, function(error, response, responseBody) {
      if (error) {
        this.log('HTTP get power function failed: %s', error.message);
        callback(error);
      } else {
        var powerState = parseInt(responseBody);
			var select = xpath.useNamespaces({"openremote": "http://www.openremote.org"});
			var doc = new dom().parseFromString(responseBody)			
			var powerState = (select('//openremote:status/text()', doc)[0].nodeValue).toUpperCase();
			var mapObj = {ON:1,OFF:0};
			var re = new RegExp(Object.keys(mapObj).join("|"),"gi");
			powerState  = parseInt(powerState.replace(re, function(matched){return mapObj[matched];}));
        var powerOn = powerState > 0;
        this.log("Power state is currently %s", powerState);
        callback(null, powerOn);
      }
    }.bind(this));
  },

getBrightness: function(callback) {
		if (!this.brightnesslvl_url) { callback(null); }
		
		var url = this.brightnesslvl_url;
		this.log("Getting Brightness level");

		this.httpRequest(url, "", "GET", this.username, this.password, this.sendimmediately, function(error, response, responseBody) {
		  if (error) {
			this.log('HTTP get brightness function failed: %s', error.message);
			callback(error);
		  } else {			
		    	var select = xpath.useNamespaces({"openremote": "http://www.openremote.org"});
					var doc = new dom().parseFromString(responseBody)			
					var level = parseInt(select('//openremote:status/text()', doc)[0].nodeValue);
		        this.log("Brightness level is currently %s", level );
			callback(null, level);
		  }
		}.bind(this));
	  },

  setBrightness: function(level, callback) {
    var url = this.brightness_url.replace("%b", level)

    this.log("Setting brightness to %s", level);

    this.httpRequest(url, "", this.http_brightness_method, this.username, this.password, this.sendimmediately, function(error, response, body) {
      if (error) {
        this.log('HTTP brightness function failed: %s', error);
        callback(error);
      } else {
        this.log('HTTP Brightness function succeeded!');
        callback();
      }
    }.bind(this));
  },
getVolume: function(callback) {
		if (!this.volumelvl_url) { callback(null); }
		
		var url = this.volumelvl_url;
		this.log("Getting volume level");

		this.httpRequest(url, "", "GET", this.username, this.password, this.sendimmediately, function(error, response, responseBody) {
		  if (error) {
			this.log('HTTP get volume function failed: %s', error.message);
			callback(error);
		  } else {			
		    	var select = xpath.useNamespaces({"openremote": "http://www.openremote.org"});
					var doc = new dom().parseFromString(responseBody)			
					var level = parseInt(select('//openremote:status/text()', doc)[0].nodeValue);
		        this.log("volume level is currently %s", level );
			callback(null, level);
		  }
		}.bind(this));
	  },

  setVolume: function(level, callback) {
    var url = this.volume_url.replace("%b", level)

    this.log("Setting volume to %s", level);

    this.httpRequest(url, "", this.http_volume_method, this.username, this.password, this.sendimmediately, function(error, response, body) {
      if (error) {
        this.log('HTTP volume function failed: %s', error);
        callback(error);
      } else {
        this.log('HTTP volume function succeeded!');
        callback();
      }
    }.bind(this));
  },
  identify: function(callback) {
    this.log("Identify requested!");
    callback(); // success
  },

  getServices: function() {

    // you can OPTIONALLY create an information service if you wish to override
    // the default values for things like serial number, model, etc.
    var informationService = new Service.AccessoryInformation();

    informationService
    .setCharacteristic(Characteristic.Manufacturer, "OpenRemote")
    .setCharacteristic(Characteristic.Model, "Controller")
    .setCharacteristic(Characteristic.SerialNumber, "Openremote Serial");

  if (this.service == "Switch") {
      var switchService = new Service.Switch(this.name);

		  if (this.switchHandling == "yes") {
			switchService
			.getCharacteristic(Characteristic.On)
			.on('get', this.getPowerState.bind(this))
			.on('set', this.setPowerState.bind(this));
		  } else {
			switchService
			.getCharacteristic(Characteristic.On)	
			.on('set', this.setPowerState.bind(this));
		  }
      return [switchService]
    } else if (this.service == "Volume") {
      var volumeService = new Service.Switch(this.name);

  		if (this.switchHandling == "yes") {
			volumeService
			.getCharacteristic(Characteristic.On)
			.on('get', this.getPowerState.bind(this))
			.on('set', this.setPowerState.bind(this));
		  } else {
			volumeService
			.getCharacteristic(Characteristic.On)	
			.on('set', this.setPowerState.bind(this));
		  }

		  if (this.volumeHandling == "yes") {

			volumeService
			.addCharacteristic(new VolumeCharacteristic())
			.on('get', this.getVolume.bind(this))
			.on('set', this.setVolume.bind(this));

		  }	
	  

      return [informationService, volumeService];
      } else if (this.service == "Light") {
      var lightbulbService = new Service.Lightbulb(this.name);
      
     		 if (this.switchHandling == "yes") {
			lightbulbService
			.getCharacteristic(Characteristic.On)
			.on('get', this.getPowerState.bind(this))
			.on('set', this.setPowerState.bind(this));
		  } else {
			lightbulbService
			.getCharacteristic(Characteristic.On)	
			.on('set', this.setPowerState.bind(this));
		  }


      if (this.brightnessHandling == "yes") {

        lightbulbService
        .addCharacteristic(new Characteristic.Brightness())
        .on('get', this.getBrightness.bind(this))
        .on('set', this.setBrightness.bind(this));
      }

      return [informationService, lightbulbService];
    }
  }
};

// Custom Characteristic for Volume

function makeVolumeCharacteristic() {

  VolumeCharacteristic = function() {
    Characteristic.call(this, 'Volume', 'F75A142E-2E3A-4944-A1DA-18393727F289');
  this.setProps({
    format: Characteristic.Formats.INT,
    unit: Characteristic.Units.PERCENTAGE,
    maxValue: 100,
    minValue: 0,
    minStep: 1,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
  });
  this.value = this.getDefaultValue();
  };

  inherits(VolumeCharacteristic, Characteristic);
}
