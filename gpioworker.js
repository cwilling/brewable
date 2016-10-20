var events = require('events');
var sensordevice = require("./sensor");
var sensorLister = require("./sensorLister");
var Relay = require("./sainsmartrelay");
var Configuration = require("./configuration");

var sensorDevices = [];
var sensorResults = [];
var sensorsRead = 0;

function gpioWorker (input_queue, output_queue) {
  this.input_queue = input_queue;
  this.output_queue = output_queue;

  gpioWorker.prototype.__proto__ = events.EventEmitter.prototype;

  this.brewtest = function () {
    if (typeof process.env.BREWTEST !== 'undefined' && process.env.BREWTEST == 'true') {
      console.log("BREWTEST mode");
      return true;
    } else {
      return false;
    }
  };

  // Configuration
  this.configObj = new Configuration();
  var configuration = this.configObj.getConfiguration();
  //console.log("configuration: " + JSON.stringify(configuration));

  // Relay device
  this.relay = new Relay();
  //this.relay.testConnected();

  // Temperature sensors
  sensorDevices = this.sensorDevices();
  //console.log("startup: sensorDevices has " + sensorDevices.length + " elements");

  // Update their configuration
  this.configObj.updateFudgeEntry(sensorDevices);
  console.log("Using configuration: " + JSON.stringify(configuration));

  // Set sensor fudge according to configuration
  sensorDevices.forEach( function (sensor) {
    sensor.setFudge(parseFloat(configuration['sensorFudgeFactors'][sensor.getId()]));
  });

  // eventEmitter is global (from index.js)
  eventEmitter.on('sensor_read', allSensorsRead);
  eventEmitter.on('msg_waiting', this.processMessage.bind(this));

} 
module.exports = gpioWorker;

gpioWorker.prototype.sensorDevices = function () {
  var deviceList = [];

  // Obtain list of available sensor ids
  // & keep array (sensorDevices) of sensor objects
  var sensorList = sensorLister.sensors();
  for (var z=0;z<sensorList.length;z++) {
    deviceList.push(new sensordevice(sensorList[z]));
  }
  return deviceList;
}

var allSensorsRead = function() {
  sensorsRead += 1;
  //console.log("READY with sensor " + sensorsRead + " (out of " + sensorDevices.length + ")");
  if (sensorsRead == sensorDevices.length) {
    //console.log("reached item: " + sensorDevices.length + ". Should have " + sensorResults.length + " results");
    sensorsRead = 0;
    eventEmitter.emit('temps_ready');
  }
};

gpioWorker.prototype.updateDevices = function () {
  sensorResults.length = 0;

  sensorDevices.forEach( function(item) {
    //console.log("EEEEE " + item.id);
    item.getTempAsync(function (id, result) {
      var result = {id:id,result:result};
      //console.log("BBBB " + id + "  " + result);
      sensorResults.push(result);
      eventEmitter.emit('sensor_read');
    });
  });

/*
  for (var i=0;i<sensorDevices.length;i++) {
    item = sensorDevices[i];
    item.getTempAsync(function (id, result) {
      var result = {id:id,result:result};
      //console.log("BBBB " + id + "  " + result);
      sensorResults.push(result);
      eventEmitter.emit('sensor_read');
    });
  };
*/
}

gpioWorker.prototype.getSensorResults = function () {
  return sensorResults;
}

gpioWorker.prototype.liveUpdate = function () {
  var sensor_state = [];
  var relay_state = [];

  sensorResults.forEach( function(item) {
    //console.log("liveUpdate(): " + item['id'] + " = " + item['result']);
    sensor_state.push({'sensorId':item['id'], 'temperature':item['result']});
  });
  //console.log("liveUpdate(): " + JSON.stringify(sensor_state));

  for (var i=0;i<this.relay.deviceCount();i++) {
    relay_state.push([this.relay.isOn(i+1), this.relay.isDelayed(i+1)]);
  }
  //console.log("liveUpdate(): " + JSON.stringify(relay_state));

  var jdata = JSON.stringify({
    'type':'live_update',
    'sensor_state':sensor_state,
    'relay_state':relay_state
  });
  console.log("liveUpdate(): " + jdata);
  this.output_queue.enqueue(jdata);
}

/* Like a liveUpdate but no sensor information; just relays
*/
gpioWorker.prototype.relayOnlyUpdate = function () {
  var relay_state = [];

  for (var i=0;i<this.relay.deviceCount();i++) {
    relay_state.push([this.relay.isOn(i+1), this.relay.isDelayed(i+1)]);
  }
  //console.log("relayUpdate(): " + JSON.stringify(relay_state));

  var jdata = JSON.stringify({
    'type':'relay_update',
    'relay_state':relay_state
  });
  //console.log("relayUpdate(): " + jdata);
  this.output_queue.enqueue(jdata);
}

gpioWorker.prototype.processMessage = function () {
  console.log("Processing message " + this.input_queue._name);
  var utf8Data = this.input_queue.dequeue().utf8Data;
  var msg = JSON.parse(utf8Data);

  if (msg.type == 'load_startup_data') {
    this.load_startup_data(msg);
  } else if (msg.type == 'toggle_relay') {
    this.toggle_relay(msg);
  } else if (msg.type == 'config_change') {
    this.config_change(msg);
  } else if (msg.type == 'list_sensors') {
    this.list_sensors(msg);
  } else if (msg.type == 'list_relays') {
    this.list_relays(msg);
  } else {
    console.log("Unrecognised message:");
    for (var key in msg) {
      console.log("unknown key: " + key + ",  value: " + msg[key]);
    }
  }
}

gpioWorker.prototype.load_startup_data = function (msg) {
  //console.log("load_startup_data():");

  var jdata = JSON.stringify({
    'type':'startup_data',
    'data': {
      'testing': this.brewtest(),
      'config' : this.configObj.getConfiguration(),
      'the_end': 'orange'
    }
  });
  console.log("load_startup_data(): " + jdata);
  this.output_queue.enqueue(jdata);

  // Also send these data (each sends own data to output queue)
  //this.load_running_jobs();
  //this.load_saved_jobs();
  //this.load_profiles();
}

gpioWorker.prototype.toggle_relay = function (msg) {
  console.log("toggle_relay(): " + msg.data);
  var relayId = parseInt(msg.data);
  if (this.relay.isOn(relayId)) {
    this.relay.OFF(relayId);
  } else {
    this.relay.ON(relayId);
  }
  this.relayOnlyUpdate();
}

gpioWorker.prototype.config_change = function (msg) {
  console.log("config_change() Rcvd: " + JSON.stringify(msg.data));
  var keys = Object.keys(msg.data);
  if (keys[0] == 'sensorFudgeFactors') {
    console.log("config_change(): " + keys[0] + " = " + msg.data['sensorFudgeFactors'] + " (" + msg.data['fudge'] + ")");
    sensorDevices.forEach( function(item) {
      if (item.getId() == msg.data['sensorFudgeFactors']) {
        item.setFudge(msg.data['fudge']);
      }
    });
  } else {
    console.log("config_change(): " + keys[0] + " = " + msg.data[keys[0]]);
  }
}

gpioWorker.prototype.list_sensors = function (msg) {
  console.log("list_sensors() Rcvd: " + JSON.stringify(msg.data));
  var sensor_ids = [];

  sensorDevices.forEach( function(item) {
    sensor_ids.push(item['id']);
  });

  var jdata = JSON.stringify({
    'type':'sensor_list',
    'data':sensor_ids
  });
  this.output_queue.enqueue(jdata);
  console.log("list_sensors(): " + jdata);
}

gpioWorker.prototype.list_relays = function (msg) {
  var relay_ids = [];

  for (var i=0;i<this.relay.deviceCount();i++) {
    relay_ids.push('Relay ' + ((i+1)/100).toString().split('.')[1]);
  }

  var jdata = JSON.stringify({
    'type':'relay_list',
    'data':relay_ids
  });
  this.output_queue.enqueue(jdata);
  console.log("list_relays(): " + jdata);
}



/* ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab: */
