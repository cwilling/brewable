import os from "os";
import path from "path";
import fs from "fs";

import events from "events";
var eventEmitter = new events.EventEmitter();

import ds18b20Device from "./ds18b20";
import fhemDevice from "./fhem";
import iSpindelDevice from "./iSpindel";
import Relay from "./sainsmartrelay";
import Configuration from "./configuration";
import JobProcessor from "./jobprocessor";

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
  var config = this.configObj.getConfiguration();
  this.configuration = config;
  //console.log("configuration: " + JSON.stringify(this.configuration));
  this.jobTemplateDataFile = path.join(this.configObj.dir(), 'jobTemplateData.txt');

  // Relay device
  this.relay = new Relay();
  //this.relay.testConnected();
  for (var i=0;i<this.relay.deviceCount();i++) {
    this.relay.setDelaySetValue(i+1, 'on_time', this.configuration['relayDelayPostON']);
    this.relay.setDelaySetValue(i+1, 'off_time', this.configuration['relayDelayPostOFF']);
  }

  // Temperature sensors
  sensorDevices = this.sensorDevices();
  //console.log("startup: sensorDevices has " + sensorDevices.length + " elements");

  // Update their configuration
  this.configObj.updateFudgeEntry(sensorDevices);
  console.log("Using configuration: " + JSON.stringify(this.configuration));

  // Now set sensor fudge according to updated configuration
  sensorDevices.forEach( function (sensor) {
    sensor.fudge = parseFloat(config['sensorFudgeFactors'][sensor.id]);
  });

  // Populate this.jobs from saved data
  // "Raw" jobs i.e. templates, not instances
  this.jobs = [];
  try {
    var data = fs.readFileSync(this.jobTemplateDataFile);
    var job_data = JSON.parse(data).job_data;
    for (var d=0;d<job_data.length;d++) {
      this.jobs.push(job_data[d]);
    }
    //console.log("this.jobs (from file): " + JSON.stringify(this.jobs));
  }
  catch (err) {
    console.log("No job templates available: " + err);
  }

  /*
    Running & stopped JobProcessor instances

    Since iSpindel support, we have to deal with jobs for
    which the required iSpindel isn't available yet. We'll
    not start those jobs yet but put them into this.waitingJobs[] 
    which can be checked whenever a new iSpindel device becomes available.
  */
  this.runningJobs = [];
  this.stoppedJobs = [];
  this.recoveredJobs = [];
  this.waitingJobs = [];        // Not real jobs, just jobData (headers & updates)

  this.runDir = this.configObj.dir('jobs');
  this.historyDir = this.configObj.dir('history');
  this.archiveDir = this.configObj.dir('archive');
  console.log("HISTORY dir = " + this.historyDir);

  // Look for jobs still running when server last shut down
  fs.readdir(this.runDir, function (err, files) {
    if (err) {
      console.log("Failed to read running jobs directory " + this.runDir);
    } else {
      console.log("job files: " + files);
      //files.forEach( function (file) {
      //files.forEach( function (file, index) {
      files.forEach( function (file) {
        var filePath = path.join(this.runDir, file);
        fs.readFile(filePath, 'utf8', function (err, data) {
          if (err) {
            console.log("Failed to load_saved_job_data from" + filePath + ": " + err);
          } else {
            console.log("Read data from " + filePath + " OK.");
            var lines = data.split(os.EOL);
            var header = JSON.parse(lines[0]);
            console.log("header: " + JSON.stringify(header));

            header['updates'] = [];
            for (var i=0;i<lines.length-1;i++) {
              header['updates'].push(JSON.parse(lines[i]));
            }
            var jobName = header.jobName;
            console.log("job jobName: " + jobName + " has " + header.updates.length + " updates");

            // Check that all sensor devices are available
            console.log("Need devices: " + header.jobSensorIds + " for job: " + jobName);

            var haveAllSensors = false;
            if (haveAllSensors) {
              if ( (! this.setupJobRun({'jobData': header})) ) {
                console.log("Couldn't start job " + jobName);
              } else {
                console.log("Started job " + jobName);
              }
              //console.log(this.recoveredJobs.length + " jobs recovered");
            } else {
              console.log("Can't start job " + jobName + " due to lack of required sensor device(s)");
              this.waitingJobs.push({'jobData': header});
            }
          }
        }.bind(this));
      }.bind(this));
    }
  }.bind(this));

  eventEmitter.on('sensor_read', allSensorsRead);
  eventEmitter.on('msg_waiting', this.processMessage.bind(this));

  /* This was just testing
  eventEmitter.on('fhem_reading', function(obj) {
    this.fhemReading(obj);
  }.bind(this));
  eventEmitter.on('iSpindel_reading', function(obj) {
    this.iSpindelReading(obj);
  }.bind(this));
  */

  /*
    Any time a new device appears, we check if is needed by any job that
    couldn't start due to missing sensor devices (this.waitingJobs[]).

    We also check this.stoppedJobs for jobs that were placed there
    when a sensor became unavailable (have sensorMissing == true).
  */
  eventEmitter.addListener('iSpindel_new_device', function () {
    console.log("NEW NEW NEW NEW NEW NEW iSpindel device ");
    var i = this.waitingJobs.length;
    while (i--) {
      var header = this.waitingJobs[i].jobData;
      var devicesNeeded = header.jobSensorIds.length;
      console.log("Checking: " + header.jobName + ". Needs: " + devicesNeeded + " devices. " + header.jobSensorIds);
      var devices = this.sensorDevices();
      devices.forEach( function (item) {
        console.log("Have device: " + item.chipId + ", type: " + typeof(item.chipId));
        if (header.jobSensorIds.indexOf(item.chipId.toString()) > -1) {
          devicesNeeded -= 1;
          console.log("Still need " + devicesNeeded + " devices");
        }
      });
      console.log("(EOL) still need " + devicesNeeded + " devices");
      if (devicesNeeded < 1) {
        console.log("We could restart this job ...");
        // We should actually check that ALL sensors are now available (not just this particular iSpindel).
        if ( (! this.setupJobRun({'jobData': header})) ) {
          console.log("Couldn't start job " + header.jobName);
        } else {
          console.log("Started job " + header.jobName);
          this.waitingJobs.splice(i, 1);

          // Update job list for clients
          this.load_running_jobs({"type":"run_job"});

          // Process the new job
          for (var j=0;j<this.runningJobs.length;j++) {
            console.log("runningJobs: " + this.runningJobs[j].name());
            if (this.runningJobs[j].name() == header.jobName) {
              this.runningJobs[j].process();
            }
          }
        }
      }
    }
    console.log("waiting jobs = " + this.waitingJobs.length);

    i = this.stoppedJobs.length;
    console.log("Checking stoppedJobs[] for sensorMissing");
    while (i--) {
      console.log("sensorMissing = " + (this.stoppedJobs[i].sensorMissing == true));

      // Check that all sensors are available
      // but assume that's true for now (while testing).
      this.stoppedJobs[i].resume();
    }
    console.log("Finished checking stoppedJobs[] for sensorMissing. " + this.stoppedJobs.length + " stoppedJobs remain.");

  }.bind(this));

  /*
    Anytime a device disappears, we need to suspend any running jobs using it.
  */
  eventEmitter.addListener('iSpindel_reaped', function (device) {
    console.log("DISAPPEARED DISAPPEARED " + device.chipId + " has DISAPPEARED!");
    var msg = {};

    for (var i=0;i<this.runningJobs.length;i++ ) {
      console.log("Suspend: " + Object.keys(this.runningJobs[i]));
      console.log("         " + this.runningJobs[i].jobName);
      console.log("         " + this.runningJobs[i].instanceId);
      console.log("         " + this.runningJobs[i].jobSensorIds);
      if (this.runningJobs[i].jobSensorIds.indexOf(device.chipId.toString()) > -1) {
        console.log("Should suspend job " + this.runningJobs[i].jobName + "_" + this.runningJobs[i].instanceId);
        console.log("(using: " + device.chipId + ")");
        msg.jobName = this.runningJobs[i].jobName;
        msg.longName = this.runningJobs[i].jobName + "-" + this.runningJobs[i].instanceId;
        this.stop_running_job({'msg':{'data':msg}, 'stopStatus':'suspend', 'device':device.chipId.toString()});
      }
    }

  }.bind(this));

} 
//module.exports = gpioWorker;
//export default gpioWorker;
export { gpioWorker, eventEmitter };

/*
  Just for testing.
  We should really just call liveUpdate which should extract data from
  any/all devices (including the one whose data report triggered the
  'fhem_reading' event which is probably what brought us here.
*/
gpioWorker.prototype.iSpindelReading = function (reading) {
  //console.log("iSpindelReading() " + JSON.stringify(reading));
  var name = reading.name;
  var tilt = reading.tilt;
  var temp = reading.temp;
  var batt = reading.batt;
  var grav = reading.grav;
  var chipId = reading.chipId;
  console.log("iSpindelReading() " + chipId + ", " + name + ", " + tilt + ", " + temp + ", " + batt + ", " + grav);
};
gpioWorker.prototype.fhemReading = function (reading) {
  //console.log("fhemReading() " + JSON.stringify(reading));
  var name = reading.name;
  var tilt = reading.tilt;
  var temp = reading.temp;
  var batt = reading.batt;
  var grav = reading.grav;
  var chipId = reading.chipId;
  console.log("fhemReading() " + chipId + ", " + name + ", " + tilt + ", " + temp + ", " + batt + ", " + grav);
};

gpioWorker.prototype.sensorDevices = function () {
  var deviceList = [];
  var z;

  // Obtain list of available sensor ids
  // & keep array (sensorDevices) of sensor objects
  var sensorList = ds18b20Device.sensors();
  for (z=0;z<sensorList.length;z++) {
    deviceList.push(new ds18b20Device(sensorList[z]));
  }

  // Sort the device list by (slightly mangled) id's
  deviceList.sort(function(a, b) {
    var aval = parseInt(a.id.substr(0,a.id.search("-")),16) + parseInt(a.id.substr(a.id.search("-") + 1),16);
    var bval = parseInt(b.id.substr(0,b.id.search("-")),16) + parseInt(b.id.substr(b.id.search("-") + 1),16);
    return aval - bval;
  });

  // Add iSpindel devices
  //console.log("Adding iSpindel devices");
  var iSpindelList = iSpindelDevice.sensors();
  for (z=0;z<iSpindelList.length;z++) {
    //console.log("Adding iSpindel " + iSpindelList[z].chipId);
    deviceList.push(iSpindelList[z]);
  }

  //console.log("deviceList = " + JSON.stringify(deviceList));
  return deviceList;
};

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
    item.getTempAsync(function (result, id) {
      var sensor_result = {id:id,result:result};
      //console.log("BBBB " + id + "  " + result);
      sensorResults.push(sensor_result);
      eventEmitter.emit('sensor_read');
    });
  });

/*
  for (var i=0;i<sensorDevices.length;i++) {
    item = sensorDevices[i];
    item.getTempAsync(function (result, id) {
      var result = {id:id,result:result};
      //console.log("BBBB " + id + "  " + result);
      sensorResults.push(result);
      eventEmitter.emit('sensor_read');
    });
  };
*/
};

gpioWorker.prototype.getSensorResults = function () {
  return sensorResults;
};

gpioWorker.prototype.liveUpdate = function () {
  var sensor_state = [];
  var relay_state = [];

  sensorResults.forEach( function(item) {
    //console.log("liveUpdate(): " + item['id'] + " = " + item['result']);
    sensor_state.push({'sensorId':item['id'], 'temperature':item['result']});
  });
  //console.log("liveUpdate(): " + JSON.stringify(sensor_state));

  var iSpindelDevices = iSpindelDevice.devices();
  iSpindelDevices.forEach( function (item) {
    if (item.fresh) {
      //console.log("iSpindel device: " + item.name + ", " + item.stamp);
      sensor_state.push({'sensorId':item.name, 'chipId':item.chipId, 'temperature':item.temp, 'tilt':item.tilt, 'batt':item.batt, 'grav':item.grav, 'stamp':item.stamp});
    }
  });
  var fhemDevices = fhemDevice.devices();
  fhemDevices.forEach( function (item) {
    if (item.fresh) {
      //console.log("FHEM device: " + item.name + ", " + item.stamp);
      sensor_state.push({'sensorId':item.name, 'temperature':item.temp, 'tilt':item.tilt, 'batt':item.batt, 'grav':item.grav, 'stamp':item.stamp});
    }
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
  //console.log("liveUpdate(): " + jdata);
  this.output_queue.enqueue(jdata);
};

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
};

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
  } else if (msg.type == 'load_jobs') {
    this.load_jobs(msg);
  } else if (msg.type == 'save_job') {
    this.save_job(msg);
  } else if (msg.type == 'replace_job') {
    this.replace_job(msg);
  } else if (msg.type == 'delete_job') {
    this.delete_job(msg);
  } else if (msg.type == 'run_job') {
    this.run_job(msg);
  } else if (msg.type == 'stop_running_job') {
    this.stop_running_job({'msg':msg, 'stopStatus':'stop'});
  } else if (msg.type == 'resume_job') {
    this.resume_job(msg);
  } else if (msg.type == 'remove_running_job') {
    this.remove_running_job(msg);
  } else if (msg.type == 'save_running_job') {
    this.save_running_job(msg);
  } else if (msg.type == 'load_saved_jobs') {
    this.load_saved_jobs(msg);
  } else if (msg.type == 'load_saved_job_data') {
    this.load_saved_job_data(msg);
  } else if (msg.type == 'archive_saved_job') {
    this.archive_saved_job(msg);
  } else if (msg.type == 'delete_saved_job') {
    this.delete_saved_job(msg);
  } else {
    console.log("Unrecognised message:");
    for (var key in msg) {
      console.log("unknown key: " + key + ",  value: " + msg[key]);
    }
  }
};

gpioWorker.prototype.load_startup_data = function (msg) {
  //console.log("load_startup_data():");
  var configObj = new Configuration();

  var jdata = JSON.stringify({
    'type':'startup_data',
    'data': {
      'testing': this.brewtest(),
      'config' : configObj.getConfiguration(),
      'the_end': 'orange'
    }
  });
  console.log("load_startup_data(): " + jdata);
  this.output_queue.enqueue(jdata);

  // Also send these data (each sends own data to output queue)
  this.load_running_jobs(msg);
  this.load_saved_jobs(msg);
  //this.load_profiles();
};

gpioWorker.prototype.toggle_relay = function (msg) {
  console.log("toggle_relay(): " + msg.data);
  var relayId = parseInt(msg.data);
  if (this.relay.isOn(relayId)) {
    this.relay.OFF(relayId);
  } else {
    this.relay.ON(relayId);
  }
  this.relayOnlyUpdate();
};

gpioWorker.prototype.config_change = function (msg) {
  console.log("config_change() Rcvd: " + JSON.stringify(msg.data));
  var i;
  var keys = Object.keys(msg.data);

  if (keys[0] == 'sensorFudgeFactors') {
    console.log("config_change(): " + keys[0] + " = " + msg.data['sensorFudgeFactors'] + " (" + msg.data['fudge'] + ")");
    sensorDevices.forEach( function(item) {
      if (item.id == msg.data['sensorFudgeFactors']) {
        //item.setFudge(msg.data['fudge']);
        item.fudge = msg.data['fudge'];
      }
    });
    //this.configuration.sensorFudgeFactors[msg.data['sensorFudgeFactors']] = msg.data['fudge'];
    this.configObj.setFudgeFactor(msg.data['sensorFudgeFactors'], msg.data['fudge']);

    // Apply to running jobs too
    for (i=0;i<this.runningJobs.length;i++ ) {
      console.log("Dealing with job: " + this.runningJobs[i].name());
      this.runningJobs[i].resetFudges(msg.data);
    }
  } else if (keys[0] == 'iSpindels') {
    console.log("config_change() iSpindels: "  + msg.data['iSpindels'] + " (" + msg.data['timeout'] + ")");

    // First update the configuration
    this.configObj.setIspindelTimeout(msg.data['iSpindels'], msg.data['timeout']);

    // Now apply to the device itself
    var iSpindelDevices = iSpindelDevice.devices();
    iSpindelDevices.forEach( function (item) {
      console.log("reconfig iSpindel device: " + item.name + ", " + item.stamp);
      if (item.name == msg.data['iSpindels']) {
        console.log("Found the right one:" + item.name);
        item.setNewTimeout(msg.data['timeout']);
      }
    });
    var fhemDevices = fhemDevice.devices();
    fhemDevices.forEach( function (item) {
      console.log("reconfig FHEM device: " + item.name + ", " + item.stamp);
      if (item.name == msg.data['iSpindels']) {
        console.log("Found the right one:" + item.name);
        item.setNewTimeout(msg.data['timeout']);
      }
    });

  } else if (keys[0] == 'multiSensorMeanWeight') {
    this.configObj.setMultiSensorMeanWeight(msg.data['multiSensorMeanWeight']);
  } else if (keys[0] == 'relayDelayPostON' || keys[0] == 'relayDelayPostOFF') {
    for (i=0;i<this.relay.deviceCount();i++) {
      if (keys[0] == 'relayDelayPostON') {
        this.relay.setDelaySetValue(i+1, 'on_time', msg.data[keys[0]]);
      } else {
        this.relay.setDelaySetValue(i+1, 'off_time', msg.data[keys[0]]);
      }
    }
    //this.configuration[keys[0]] = msg.data[keys[0]];
    this.configObj.setRelayDelayPost(keys[0], msg.data[keys[0]]);
  } else {
    console.log("config_change(): " + keys[0] + " = " + msg.data[keys[0]]);
  }
  console.log("this.configuration = " + JSON.stringify(this.configuration));
  //this.configObj.saveConfigToFile();
};

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
};

gpioWorker.prototype.list_relays = function (msg) {
  console.log("list_relays() Rcvd: " + JSON.stringify(msg.data));
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
};

gpioWorker.prototype.closeRelays = function () {
  this.relay.closeConnected();
};

/* Save a newly received job template to
   - file of job templates
   - live list of job templates (self.jobs in python version)
*/
gpioWorker.prototype.save_job = function (msg) {
  //console.log("save_job() Rcvd: " + JSON.stringify(msg.data));
  this.jobs.push(msg.data);

  var jobTemplateDataFile = this.jobTemplateDataFile;
  //console.log("JOBS " + JSON.stringify(this.jobs));
  fs.writeFile(jobTemplateDataFile, JSON.stringify({'job_data':this.jobs}),
    function(err) {
      if (err)
        console.log("Failed to write " + jobTemplateDataFile + ": ", err);
      else
        console.log("File " + jobTemplateDataFile + " written OK.");
    });

  /* Maybe thois should be in writeFile's callback? */
  var jdata = JSON.stringify({
    'type':'loaded_jobs',
    'data':this.jobs
  });
  this.output_queue.enqueue(jdata);
  //console.log("this.jobs: " + JSON.stringify(this.jobs));
};

/* Update an existing job template */
gpioWorker.prototype.replace_job = function (msg) {
  var jobName = msg.data["name"];

  /* First find index in this.jobs */
  var targetIndex = -1;
  for (var j=0;j<this.jobs.length;j++ ) {
    if (this.jobs[j].name == jobName ) { targetIndex = j; }
  }
  if (targetIndex > -1) {
    this.jobs[targetIndex] = msg.data;
  } else return;

  console.log("REPLACED: " + JSON.stringify(this.jobs));

  /* Update jobTemplateDataFile */
  var jobTemplateDataFile = this.jobTemplateDataFile;
  fs.writeFile(jobTemplateDataFile, JSON.stringify({'job_data':this.jobs}),
    function(err) {
      if (err)
        console.log("Failed to write " + jobTemplateDataFile + ": ", err);
      else
        console.log("File " + jobTemplateDataFile + " written OK.");
    });

  var jdata = JSON.stringify({
    'type':'loaded_jobs',
    'data':this.jobs
  });
  this.output_queue.enqueue(jdata);
};

/* Remove a job template */
gpioWorker.prototype.delete_job = function (msg) {
  var jobName = msg.data["name"];
  //var jobIndex = msg.data["index"];
  //console.log("delete_job() index = " + jobIndex + ", name = " + jobName);

  /* First find index in this.jobs */
  var targetIndex = -1;
  for (var j=0;j<this.jobs.length;j++ ) {
    if (this.jobs[j].name == jobName ) { targetIndex = j; }
  }
  if (targetIndex > -1) { this.jobs.splice(targetIndex, 1); }

  /* Update jobTemplateDataFile */
  var jobTemplateDataFile = this.jobTemplateDataFile;
  fs.writeFile(jobTemplateDataFile, JSON.stringify({'job_data':this.jobs}),
    function(err) {
      if (err)
        console.log("Failed to write " + jobTemplateDataFile + ": ", err);
      else
        console.log("File " + jobTemplateDataFile + " written OK.");
    });

  var jdata = JSON.stringify({
    'type':'loaded_jobs',
    'data':this.jobs
  });
  this.output_queue.enqueue(jdata);
  //console.log("UPDATED JOBS: " + JSON.stringify(this.jobs));
};

/* Load job templates from jobTemplateData.txt and send to client */
gpioWorker.prototype.load_jobs = function (msg) {
  console.log("load_jobs() Rcvd: " + JSON.stringify(msg.data));
  var jdata = JSON.stringify({
    'type':'loaded_jobs',
    'data':this.jobs
  });
  this.output_queue.enqueue(jdata);
  //console.log("this.jobs: " + JSON.stringify(this.jobs));
};

gpioWorker.prototype.run_job = function (msg) {
  var j;
  var jobIndex = msg.data["index"];
  var jobName = msg.data["name"];
  console.log("run_job() index = " + jobIndex + ", name = " + jobName);

  // First check that this job isn't already running
  var isRunning = false;
  //console.log("Running jobs ... " + JSON.stringify(this.runningJobs));
  for (j=0;j<this.runningJobs.length;j++ ) {
    if (this.runningJobs[j].name == jobName ) {
      isRunning = true;
      console.log("Job " + jobName + " = " + this.runningJobs[j].name + " is already running");
      break;
    }
  }
  var targetIndex = -1;
  if ( ! isRunning ) {
    for (j=0;j<this.jobs.length;j++ ) {
      if (this.jobs[j].name == jobName ) {
        targetIndex = j;
        console.log("Job " + jobName + " is available to run");
        break;
      }
    }
    if (targetIndex < 0 ) {
      console.log("Can't find " + jobName + " to run");
      return;
    }
    console.log("Ready to run " + jobName);

    if ( (! this.setupJobRun({'jobIndex':targetIndex})) ) {
      console.log("Couldn't start job " + jobName);
    } else {
      console.log("Started job " + jobName);
    }
  }
  /* Do an initial processing of the new job */
  //this.runningJobs.forEach( function (job, index) {
  this.runningJobs.forEach( function (job) {
    //console.log("run_job() job.name  1 = " + job.jobName);
    //console.log("run_job() job.name  2 = " + jobName);
    if (job.jobName == jobName) {
      job.process();
      console.log("DONE INITIAL PROCESS() of " + jobName);
    }
  });
  this.load_running_jobs(msg);

};

/*
  Normally, a job instance is created based on the relevant job template,
  using a jobIndex into this.jobs. If jobIndex < 0, it means that instead
  of using basic info from his.jobs to create the instance, we will instead
  supply a suitable object with the required information.

  The first use of this facility is to continue running jobs after a server
  crash/shutdown; in this case we'll supply header information reclaimed
  from the job's history file.
*/

gpioWorker.prototype.setupJobRun = function (options) {
  var jobIndex = (typeof options.jobIndex !== 'undefined') ? options.jobIndex : -1;
  var jobData = (typeof options.jobData !== 'undefined') ? options.jobData : {};

  try {
    if (jobIndex < 0) {
      this.runningJobs.push(new JobProcessor({job:JSON.parse(JSON.stringify(jobData)),parent:this}));
    } else {
      this.runningJobs.push(new JobProcessor({job:JSON.parse(JSON.stringify(this.jobs[jobIndex])),parent:this}));
    }
  }
  catch (err) {
    console.log("Couldn't create JobPocessor for job: " + " ERR: " + err);
    return false;
  }
  return true;
};

gpioWorker.prototype.processRunningJobs = function () {
  //console.log("processRunningJobs()");
  //this.runningJobs.forEach( function (job, index) {
  this.runningJobs.forEach( function (job) {
    //console.log("Process job: " + index + " (" + job.jobName + ")");
    //console.log("Process job: " + index + " " + JSON.stringify(job.jobProfile));
    job.process();
  });
};

/* Send a list of running jobs back to the client */
gpioWorker.prototype.load_running_jobs = function (msg) {
  /* We reach here for a variety of reasons,
    depending on the type of msg
  */
  if (msg['type'] == 'load_running_jobs') {
    console.log("Send running_jobs list after LOAD_RUNNING_JOBS request");
  } else if (msg['type'] == 'run_job') {
    console.log("Send running_jobs list after RUN_JOBS request");
  } else if (msg['type'] == 'load_startup_data') {
    console.log("Send running_jobs list after LOAD_STARTUP_DATA request");
  } else {
    console.log("Send running_jobs list after UNKNOWN request");
  }

  /* We send only job info
    since client doesn't need stuff like local file name etc.
    Also send collected status reports
    (history without "private" header).
  */
  var running_jobs = [];
  if (this.runningJobs.length > 0) {
    console.log("Send list of running jobs here");
    running_jobs = [];
    //this.runningJobs.forEach( function (job, index) {
    this.runningJobs.forEach( function (job) {
      //console.log("runningJobs history 1: " + JSON.stringify(job.history));
      if (msg['type'] == 'run_job') {
        job.process();
      }
      //console.log("runningJobs history 2: " + JSON.stringify(job.history));
      var job_info = {};
      job_info['header'] = job.jobInfo();
      job_info['updates'] = job.history.slice(1);
      running_jobs.push(job_info);
    });
    //console.log("running_jobs list: " + JSON.stringify(running_jobs));
  } else {
    console.log("No jobs running");
  }
  var jdata = JSON.stringify({'type':'running_jobs','data':running_jobs});
  console.log("load_running_jobs() returning: " + jdata);
  this.output_queue.enqueue(jdata);
};

gpioWorker.prototype.stop_running_job = function (options) {
  var i, missingDevice;
  var msg = options.msg;
  var stopStatus = options.stopStatus;
  if (stopStatus == "suspend") {
    missingDevice = options.device;
  }
  //console.log("stop_running_job() options: " + JSON.stringify(options));

  var jobName = msg.data["jobName"];
  var longName = msg.data["longName"];
  var job_index = -1;
  console.log("Rcvd STOP_RUNNING_JOB: " + longName + ", stopStatus = " + stopStatus);

  for (i=0;i<this.runningJobs.length;i++) {
    var jobLongName = this.runningJobs[i].name() + '-' + this.runningJobs[i].instanceId;
    console.log("stop_running_job() Trying: " + jobLongName);
    if (jobLongName == longName) {
      job_index = i;
      console.log("Job " + jobLongName + " running - ready to stop");
      break;
    }
  }
  if ( job_index > -1 ) {
    console.log("Job " + longName + " running - ready to stop");
    this.runningJobs[job_index].stop({'longName':longName, 'stopStatus':stopStatus, 'missingDevice':missingDevice});
  } else {
    // Perhaps the job was already stopped?
    // In which case, ensure it has correct stopStatus
    for (i=0;i<this.stoppedJobs.length;i++) {
      jobLongName = this.stoppedJobs[i].name() + '-' + this.stoppedJobs[i].instanceId;
      if (jobLongName == longName) {
        console.log("Job " + jobLongName + " already stopped");
        this.stoppedJobs[i].stop({'longName':longName, 'stopStatus':stopStatus, 'missingDevice':missingDevice});
        var jdata = JSON.stringify({
          'type':'stopped_job',
          'data':{'longName':longName, 'jobName':jobName, 'reason':{'stopStatus':stopStatus, 'missingDevice':missingDevice}}
        });
        this.output_queue.enqueue(jdata);
        // Reload list of running jobs (triggers display refresh in browser)
        //this.load_running_jobs({"type":"show_running_jobs"});
      }
    }
  }

};

gpioWorker.prototype.resume_job = function (msg) {
  var job_found = false;
  console.log("Rcvd request to RESUME job " + msg.data["jobName"]);

  for (var i=0;i<this.stoppedJobs.length;i++) {
    var job = this.stoppedJobs[i];
    var jobLongName = job.name() + '-' + job.instanceId;
    console.log("stoppedJobs() Trying: " + jobLongName);
    if (jobLongName == msg.data['jobName']) {
      job_found = true;
      console.log("Found stopped job " + job.name() + " - ready to resume");
      break;
    }
  }
  if ( (!job_found) ) {
    console.log("Couldn't find job " + msg['data']['jobName'] + " to resume!");
  } else {
    job.resume();
  }
};

gpioWorker.prototype.load_saved_jobs = function (msg) {
  console.log("Rcvd request to LOAD SAVED JOBS:" + msg);

  fs.readdir(this.historyDir, function (err, files) {
    if (err) {
      console.log("Failed to read history directory " + this.historyDir);
    } else {
      console.log("history files: " + files);
      var goodhistoryfiles = [];

      //files.forEach( function (file, index) {
      files.forEach( function (file) {
        console.log("Reading file " + file);
        console.log("full path: " + this.historyDir);
        console.log("full path: " + file);

        fs.readFile(path.join(this.historyDir, file), 'utf8', function (err, data) {
          var lines = data.split(os.EOL);
          var last_line = JSON.parse(lines[lines.length-2]);
          console.log("last line: " + JSON.stringify(last_line));
          if (last_line['running'] == 'saved') {
            goodhistoryfiles.push(file);
          }
          console.log("good history files: " + goodhistoryfiles);
          var jdata = JSON.stringify({
            'type':'saved_jobs_list',
            'data':{'historyfiles':goodhistoryfiles}
          });
          this.output_queue.enqueue(jdata);
        }.bind(this));
      }.bind(this));
    }
  }.bind(this));

};

gpioWorker.prototype.remove_running_job = function (msg) {
  var jobName = msg.data["jobName"];
  var longName = msg.data["longName"];
  console.log("Rcvd request to REMOVE running job " + jobName + " (" + longName + ")");
  this.stop_running_job({'msg':msg, 'stopStatus':'remove'});

  // Whether previously running or already stopped, it should now be in stoppedJobs
  var job_index = -1;
  for (var i=0;i<this.stoppedJobs.length;i++) {
    var jobLongName = this.stoppedJobs[i].name() + '-' + this.stoppedJobs[i].instanceId;
    if (jobLongName == longName) {
      job_index = i;
      break;
    }
  }
  if ( job_index > -1 ) {
    var job = this.stoppedJobs.splice(job_index, 1)[0];
    var jobRunFilePath = job.runFilePath;
    console.log("Job " + longName + " removed from stoppedJobs");
    var jdata = JSON.stringify({
      'type':'removed_job',
      'data':{'longName':longName, 'jobName':jobName}
    });
    this.output_queue.enqueue(jdata);

    // Remove associated file
    console.log("Removing run file: " + jobRunFilePath);
    fs.unlink(jobRunFilePath, function (err) {
      if (err)
        console.log("Failed to delete file " + jobRunFilePath + ": " + err);
      else
        console.log("File " + jobRunFilePath + " removed OK.");
    });
  } else {
    // This shouldn't be possible
    console.log("Job to remove NOT FOUND! (" + longName + ")");
  }
};

gpioWorker.prototype.save_running_job = function (msg) {
  var jobName = msg.data["jobName"];
  var longName = msg.data["longName"];
  console.log("Rcvd request to SAVE running job " + jobName + " (" + longName + ")");
  this.stop_running_job({'msg':msg, 'stopStatus':'save'});

  // Whether previously running or already stopped, it should now be in stoppedJobs
  var job_index = -1;
  for (var i=0;i<this.stoppedJobs.length;i++) {
    var jobLongName = this.stoppedJobs[i].name() + '-' + this.stoppedJobs[i].instanceId;
    if (jobLongName == longName) {
      job_index = i;
      break;
    }
  }
  if ( job_index > -1 ) {
    var job = this.stoppedJobs.splice(job_index, 1)[0];
    var jobRunFilePath = job.runFilePath;
    var jobHistoryFilePath = job.historyFilePath;
    console.log("Renaming " + jobRunFilePath + " to " + jobHistoryFilePath);
    fs.rename(jobRunFilePath, jobHistoryFilePath, function (err) {
      if (err) {
        console.log("Failed to rename " + jobRunFilePath + " to " + jobHistoryFilePath + ": " + err);
      } else {
        console.log(jobRunFilePath + " renamed to " + jobHistoryFilePath + " OK.");
        var jdata = JSON.stringify({
          'type':'saved_job',
          'data':{'longName':longName, 'jobName':jobName}
        });
        this.output_queue.enqueue(jdata);
      }
    }.bind(this));
  } else {
    var jdata = JSON.stringify({
      'type':'error_saved_job',
      'data':{'longName':longName, 'jobName':jobName}
    });
    this.output_queue.enqueue(jdata);
  }
  this.load_saved_jobs({'type':'load_saved_jobs','data':[]});
};

gpioWorker.prototype.delete_saved_job = function (msg) {
  var jobName = msg.data["jobName"];
  var historyFileName = msg.data["jobName"] + '-' + msg.data["instance"] + '.txt';
  var historyFilePath = path.join(this.historyDir, historyFileName);
  console.log("Rcvd request to DELETE saved job " + jobName + " (" + historyFilePath + ")");

  console.log("Removing run file: " + historyFilePath);
  fs.unlink(historyFilePath, function (err) {
    if (err) {
      console.log("Failed to delete file " + historyFilePath + ": " + err);
    } else {
      console.log("File " + historyFilePath + " removed OK.");
      console.log("jobName = " + jobName + " instance = " + msg.data["instance"]);
      var jdata = JSON.stringify({
        'type':'removed_saved_job',
        'data':{'jobName':jobName, 'instance':msg.data["instance"]}
      });
      this.output_queue.enqueue(jdata);
    }
  }.bind(this));
};

gpioWorker.prototype.archive_saved_job = function (msg) {
  var jobName = msg.data["jobName"];
  var historyFileName = msg.data["jobName"] + '-' + msg.data["instance"] + '.txt';
  var historyFilePath = path.join(this.historyDir, historyFileName);
  var archiveFilePath = path.join(this.archiveDir, historyFileName);
  console.log("Rcvd request to ARCHIVE saved job " + jobName + " (" + historyFilePath + ")");

  console.log("Renaming " + historyFilePath + " to " + archiveFilePath);
  fs.rename(historyFilePath, archiveFilePath, function (err) {
    if (err) {
      console.log("Failed to rename " + historyFilePath + " to " + archiveFilePath + ": " + err);
    } else {
      console.log(historyFilePath + " renamed to " + archiveFilePath + " OK.");
      var jdata = JSON.stringify({
        'type':'archived_job',
        'data':{'jobName':jobName, 'instance':msg.data['instance']}
      });
      this.output_queue.enqueue(jdata);
    }
  }.bind(this));
};

gpioWorker.prototype.load_saved_job_data = function (msg) {
  console.log("Rcvd request to LOAD SAVED JOB DATA " + msg.data["fileName"] + ".txt");

  var fileName = msg.data['fileName'] + '.txt';
  var filepath = path.join(this.historyDir, fileName);
  fs.readFile(filepath, 'utf8', function (err, data) {
    if (err) {
      console.log("Failed to load_saved_job_data from" + filepath + ": " + err);
    } else {
      //console.log("Read data from " + filePath + " OK.");
      var lines = data.split(os.EOL);
      var header = JSON.parse(lines[0]);
      //console.log("header: " + JSON.stringify(header));

      var updates = [];
      for (var i=1;i<lines.length-1;i++) {
        //console.log("-> " + lines[i]);
        updates.push(JSON.parse(lines[i]));
        //console.log("-> " + JSON.stringify(updates[updates.length-1]));
      }
      var jdata = JSON.stringify({
        'type':'saved_job_data',
        'data':{'header':[header], 'updates':updates}
      });
      this.output_queue.enqueue(jdata);
    }
  }.bind(this) );
};



/* ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab: */
