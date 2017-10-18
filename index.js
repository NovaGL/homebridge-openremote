var Service, Characteristic, VolumeCharacteristic;
var request = require("request");
var inherits = require('util').inherits;
var pollingtoevent = require('polling-to-event');
var xpath = require('xpath'), dom = require('xmldom').DOMParser;

module.exports = function(homebridge){
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  makeVolumeCharacteristic();
  homebridge.registerAccessory("homebridge-openremote", "openremote", OpenRemoteStatusAccessory);
}


function OpenRemoteStatusAccessory(log, config) {
	this.log = log;

	// url config info
	this.on_url                 = config["on_url"];
	this.on_body                = config["on_body"];
	this.off_url                = config["off_url"];
	this.off_body               = config["off_body"];
	this.up_url                 = config["up_url"];
	this.down_url               = config["down_url"];
	this.stop_url               = config["stop_url"];
	this.lock_url               = config["lock_url"]; 
	this.lock_body              = config["lock_body"];
	this.unlock_url             = config["unlock_url"]  			|| this.lock_url;
	this.unlock_body            = config["unlock_body"] 			|| this.lock_body;
	this.status_url             = config["status_url"];
	this.volume_url             = config["volume_url"];
	this.brightness_url         = config["brightness_url"];
	this.volumelvl_url          = config["volumelvl_url"];
	this.brightnesslvl_url      = config["brightnesslvl_url"];
	this.http_method            = config["http_method"] 			|| "GET";
	this.http_brightness_method = config["http_brightness_method"] 	|| this.http_method;
	this.http_volume_method     = config["http_brightness_method"] 	|| this.http_method;
	this.username               = config["username"] 	  	 		|| "";
	this.password               = config["password"] 	  	 		|| "";
	this.sendimmediately        = config["sendimmediately"] 		|| "";
	this.service                = config["service"] 		 		|| "Switch";
	this.name                   = config["name"];		
	this.brightnessHandling     = config["brightnessHandling"] 		|| "no";
	this.volumeHandling         = config["volumeHandling"]     		|| "no";
	this.switchHandling         = config["switchHandling"]     		|| "no";
	this.motionHandling	    	= config["motionHandling"] 		 	|| "no"; 
	this.state = false;

	// State variables
	this.lastPosition = 0 //Blind closed by default
	this.lastPositionState = 2 //Blind stopped by default
	
	this.currentlevel = 0;
    	var that = this;

	// Status Polling
	if ((this.status_url && this.switchHandling =="realtime") || (this.service=="Smoke" || this.service=="Motion")|| (this.status_url && this.motionHandling=="yes")) {
		var powerurl = this.status_url;
		var statusemitter = pollingtoevent(function(done) {
	        	that.httpRequest(powerurl, "", "GET", that.username, that.password, that.sendimmediately, function(error, response, body) {
            		if (error) {
                		that.log('HTTP get power function failed: %s', error.message);
		                callback(error);
            		} else {               				    
				done(null, body);
            		}
        		})
    	}, {longpolling:true,interval:300,longpollEventName:"statuspoll"});

	statusemitter.on("statuspoll", function(data) {       
        	var powerState = parseInt(data);
			var select = xpath.useNamespaces({"openremote": "http://www.openremote.org"});
			var doc = new dom().parseFromString(data)			
			var powerState = (select('//openremote:status/text()', doc)[0].nodeValue).toUpperCase();
			var mapObj = {ON:1,OFF:0, SECURE:0, 'NOT READY':1};
			var re = new RegExp(Object.keys(mapObj).join("|"),"gi");
			powerState  = parseInt(powerState.replace(re, function(matched){return mapObj[matched];}));
			that.state = powerState > 0;
			that.log(that.service, "received status",that.status_url, "state is currently", powerState); 

		switch (that.service) {
			case "Switch":
				if (that.switchService ) {
					that.switchService .getCharacteristic(Characteristic.On)
					.setValue(that.state);
				}
				break;
			case "Light":
				if (that.lightbulbService) {
					that.lightbulbService.getCharacteristic(Characteristic.On)
					.setValue(that.state);
				}		
				break;
			case "Smoke":
				if (that.smokeService) {
					that.smokeService.getCharacteristic(Characteristic.SmokeDetected)
					.setValue(that.state);
				}
				break;
			case "Motion":
				if (that.motionService) {
					that.motionService.getCharacteristic(Characteristic.MotionDetected)
					.setValue(that.state);
				}		
			break;
			case "Door":
				if (that.lockService) {
					that.lockService.getCharacteristic(Characteristic.MotionDetected)
					.setValue(that.state);
				}	
				break;
			}        
    	});
	}

	// Brightness Polling
	if (this.brightnesslvl_url && this.brightnessHandling =="realtime") {
		var brightnessurl = this.brightnesslvl_url;
		var levelemitter = pollingtoevent(function(done) {
	        	that.httpRequest(brightnessurl , "", "GET", that.username, that.password, that.sendimmediately, function(error, response, responseBody) {
            		if (error) {
                			that.log('HTTP get power function failed: %s', error.message);
							return;
            		} else {               				    
						done(null, responseBody);
            		}
        		})
    	}, {longpolling:true,interval:2000,longpollEventName:"levelpoll"});

		levelemitter.on("levelpoll", function(data) {  
			
			var select = xpath.useNamespaces({"openremote": "http://www.openremote.org"});
					var doc = new dom().parseFromString(responseBody)			
					that.currentlevel = parseInt(select('//openremote:status/text()', doc)[0].nodeValue);

			if (that.lightbulbService) {				
				that.log(that.service, "received data:"+that.brightnesslvl_url, "level is currently", that.currentlevel); 		        
				that.lightbulbService.getCharacteristic(Characteristic.Brightness)
				.setValue(that.currentlevel);
			}        
    	});
	}
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
		
		if (!this.on_url || !this.off_url) {
			this.log.warn("Ignoring request; No power url defined.");
			callback(new Error("No power url defined."));
			return;
		}

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
				callback();
			}
		}.bind(this));
	},

	getPowerState: function(callback) {
		if (!this.status_url) {
			this.log.warn("Ignoring request; No status url defined.");
			callback(new Error("No status url defined."));
			return;
		}   
    
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
			var mapObj = {ON:1,OFF:0, SECURE:0, 'NOT READY':1};
			var re = new RegExp(Object.keys(mapObj).join("|"),"gi");
			powerState  = parseInt(powerState.replace(re, function(matched){return mapObj[matched];}));
			var powerOn = powerState > 0;
			this.log("Power state is currently %s", powerState);
			callback(null, powerOn);
			}
		}.bind(this));
  	},

	setTargetPosition: function(pos, callback) {
		this.log("Set TargetPosition: %s", pos);
		var url;
		var body;
		if (!this.up_url || !this.down_url) {
			this.log.warn("Ignoring request; No up/down url defined.");
			callback(new Error("No up/down url defined."));
			return;
		}

		if (pos > 0) {
			url = this.up_url;
			this.log("Setting target position to up");
		} else {
			url = this.down_url;
			this.log("Setting target position to down");
		}

		this.blindService.setCharacteristic(Characteristic.PositionState, (pos>0 ? 1 : 0));

		this.httpRequest(url, body, this.http_method, this.username, this.password, this.sendimmediately, function(error, response, responseBody) {
			if (error) {
				this.log('HTTP set target position function failed: %s', error.message);
				callback(error);
			} else {
				this.blindService.setCharacteristic(Characteristic.CurrentPosition, pos);
				this.blindService.setCharacteristic(Characteristic.PositionState, 2);
				this.log('HTTP set target position function succeeded!');
				this.lastPosition = pos;
				callback();
			}
		}.bind(this));
	},

	getTargetPosition: function(callback) {
		callback(null, this.lastPosition);
	},

	getCurrentPosition: function(callback) {
		callback(null, this.lastPosition);
	},

	getStatePosition: function(callback) {
		callback(null, this.lastPositionState);
	},

	getBrightness: function(callback) {
		if (!this.brightnesslvl_url) {
    	    	this.log.warn("Ignoring request; No brightness level url defined.");
	    		callback(new Error("No brightness level url defined."));
	    		return;
	 	}	
		
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
		if (!this.brightness_url) {
			this.log.warn("Ignoring request; No brightness url defined.");
			callback(new Error("No brightness url defined."));
			return;
		}
		
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
	
	getLockCurrentState: function(callback){
		this.log("Get Lock current state");
		callback(null, 1); //Not possible with my setup
	},
	
	setLockCurrentState: function(callback){
		this.log("Set Lock Target state");
		callback(null, 1); //Not possible with my setup
	},
	
	getLockTargetState: function(callback){
		this.log("Get Lock Target State");
		callback(null, 1); //Not possible with my setup
	},
	
	setLockTargetState: function(powerOn,callback) {
		var url;
		var body;

		    if (!this.unlock_url || !this.lock_url) {
		    	this.log.warn("Ignoring request; No Door url defined.");
			    callback(new Error("No Door url defined."));
		    	return;
		    }

	    if (powerOn) {
	      url = this.lock_url;
	      body = this.lock_body;
	      this.log("Locking Door");
	    } else {
      		url = this.unlock_url;
               body = this.unlock_body;
      		this.log("Unlocking Door");
	    }
		this.httpRequest(url, body, this.http_method, this.username, this.password, this.sendimmediately, function(error, response, responseBody) {
			if (error) {
				this.log('HTTP Door function failed: %s', error.message);
				callback(error);
			} else {
				this.log('HTTP Door function succeeded!');
				this.log(response);
				this.log(responseBody);
	
				callback();
			}
		}.bind(this));
	},

	getVolume: function(callback) {
		if (!this.volumelvl_url) {
    	    	this.log.warn("Ignoring request; No volume level url defined.");
	    		callback(new Error("No volume level url defined."));
	    		return;
	 	}  
		
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
		if (!this.volumelvl_url) {
    	    this.log.warn("Ignoring request; No volume url defined.");
			callback(new Error("No volume level url defined."));
			return;
		} 
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
	var that = this;
	
    informationService
    .setCharacteristic(Characteristic.Manufacturer, "OpenRemote")
    .setCharacteristic(Characteristic.Model, "Controller")
    .setCharacteristic(Characteristic.SerialNumber, "Openremote Serial");

	switch (this.service) {
		case "Switch":
			this.switchService = new Service.Switch(this.name);
			switch (this.switchHandling) {			
				case "yes":					
					this.switchService
					.getCharacteristic(Characteristic.On)
					.on('get', this.getPowerState.bind(this))
					.on('set', this.setPowerState.bind(this));
					return [this.switchService];	
					break;
				case "realtime":				
					this.switchService
					.getCharacteristic(Characteristic.On)
					.on('get', function(callback) {callback(null, that.state)})
					.on('set', this.setPowerState.bind(this));
					return [this.switchService];
					break;
				default	:	
					this.switchService
					.getCharacteristic(Characteristic.On)	
					.on('set', this.setPowerState.bind(this));
					return [this.switchService];	
					break;}
		case "Volume":
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
			return [volumeService];
			break;
		case "Light":
			this.lightbulbService = new Service.Lightbulb(this.name);			
			switch (this.switchHandling) {
	
			case "yes" :
				this.lightbulbService
				.getCharacteristic(Characteristic.On)
				.on('get', this.getPowerState.bind(this))
				.on('set', this.setPowerState.bind(this));
				break;
			case "realtime":
				this.lightbulbService
				.getCharacteristic(Characteristic.On)
				.on('get', function(callback) {callback(null, that.state)})
				.on('set', this.setPowerState.bind(this));
				break;
			default:		
				this.lightbulbService
				.getCharacteristic(Characteristic.On)	
				.on('set', this.setPowerState.bind(this));
				break;
			}
			if (this.brightnessHandling == "realtime") {
				this.lightbulbService 
				.addCharacteristic(new Characteristic.Brightness())
				.on('get', function(callback) {callback(null, that.currentlevel)})
				.on('set', this.setBrightness.bind(this));
			} else if (this.brightnessHandling == "yes") {
				this.lightbulbService
				.addCharacteristic(new Characteristic.Brightness())
				.on('get', this.getBrightness.bind(this))
				.on('set', this.setBrightness.bind(this));							
			}
	
			return [informationService, this.lightbulbService];
			break;
		case "Door":
			this.lockService = new Service.LockMechanism(this.name);
	
			this.lockService 
			.getCharacteristic(Characteristic.LockCurrentState)
			.on('get', this.getLockCurrentState.bind(this))
			.on('set', this.setLockCurrentState.bind(this));
	
			this.lockService 
			.getCharacteristic(Characteristic.LockTargetState)
			.on('get', this.getLockTargetState.bind(this))
			.on('set', this.setLockTargetState.bind(this));
			
			if (this.motionHandling == "yes") {
				this.lockService 
				.addCharacteristic(new Characteristic.MotionDetected())
				.on('get', function(callback) {callback(null, that.state)});
			}
			return [this.lockService];
			break;
		case "Smoke":
			this.smokeService = new Service.SmokeSensor(this.name);
				
			this.smokeService
			.getCharacteristic(Characteristic.SmokeDetected)
			.on('get', function(callback) {callback(null, that.state)});
	
			return [this.smokeService];
			break;
		case "Motion":
			this.motionService = new Service.MotionSensor(this.name);
						
			this.motionService
			.getCharacteristic(Characteristic.MotionDetected)
			.on('get', function(callback) {callback(null, that.state)});
	
			return [this.motionService];
			break;
		case "Blind":
			this.blindService = new Service.WindowCovering(this.name);

			// the current position (0-100%)
			this.blindService
			.getCharacteristic(Characteristic.CurrentPosition)
			.on('get', this.getCurrentPosition.bind(this));

			// the target position (0-100%)
			this.blindService
			.getCharacteristic(Characteristic.TargetPosition)
			.on('get', this.getTargetPosition.bind(this))
			.on('set', this.setTargetPosition.bind(this));

			// the position state
			// 0 = DECREASING; 1 = INCREASING; 2 = STOPPED;
			this.blindService
			.getCharacteristic(Characteristic.PositionState)
			.on('get', this.getStatePosition.bind(this));

			return [informationService, this.blindService];
			break;
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
