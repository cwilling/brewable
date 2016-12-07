var osenv = require('osenv');
var path = require('path');
var fs = require('fs');
var events = require('events');
var sensordevice = require("./sensor");
var sensorLister = require("./sensorLister");
var Relay = require("./sainsmartrelay");
var Configuration = require("./configuration");
var JobProcessor = require("./jobprocessor");

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

  // Temperature sensors
  sensorDevices = this.sensorDevices();
  //console.log("startup: sensorDevices has " + sensorDevices.length + " elements");

  // Update their configuration
  this.configObj.updateFudgeEntry(sensorDevices);
  console.log("Using configuration: " + JSON.stringify(this.configuration));

  // Set sensor fudge according to configuration
  sensorDevices.forEach( function (sensor) {
    sensor.setFudge(parseFloat(config['sensorFudgeFactors'][sensor.getId()]));
  });

  // Populate this.jobs from saved data
  // "Raw" jobs i.e. templates, not instances
  this.jobs = [];
  var data = fs.readFileSync(this.jobTemplateDataFile);
  var job_data = JSON.parse(data).job_data;
  for (var d=0;d<job_data.length;d++) {
    this.jobs.push(job_data[d]);
  }
  //console.log("this.jobs (from file): " + JSON.stringify(this.jobs));

  // Running & stopped JobProcessor instances
  this.runningJobs = []
  this.stoppedJobs = []

console.log("WORK DIR = " + this.configObj.dir('history'));

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
  //console.log("liveUpdate(): " + jdata);
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
  } else if (msg.type == 'save_job') {
    this.save_job(msg);
  } else if (msg.type == 'replace_job') {
    this.replace_job(msg);
  } else if (msg.type == 'delete_job') {
    this.delete_job(msg);
  } else if (msg.type == 'run_job') {
    this.run_job(msg);
  } else if (msg.type == 'load_jobs') {
    this.load_jobs(msg);
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
  this.load_running_jobs(msg);
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
  } else if (keys[0] == 'multiSensorMeanWeight') {
    this.configObj.setMultiSensorMeanWeight(msg.data['multiSensorMeanWeight']);
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
}

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
}

/* Remove a job template */
gpioWorker.prototype.delete_job = function (msg) {
  var jobIndex = msg.data["index"];
  var jobName = msg.data["name"];
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
}

/* Load job templates from jobTemplateData.txt and send to client */
gpioWorker.prototype.load_jobs = function (msg) {
  var jdata = JSON.stringify({
    'type':'loaded_jobs',
    'data':this.jobs
  });
  this.output_queue.enqueue(jdata);
  console.log("this.jobs: " + JSON.stringify(this.jobs));
}

gpioWorker.prototype.run_job = function (msg) {
  var jobIndex = msg.data["index"];
  var jobName = msg.data["name"];
  console.log("run_job() index = " + jobIndex + ", name = " + jobName);

  // First check that this job isn't already running
  var isRunning = false;
  //console.log("Running jobs ... " + JSON.stringify(this.runningJobs));
  for (var j=0;j<this.runningJobs.length;j++ ) {
    if (this.runningJobs[j].name == jobName ) {
      isRunning = true;
      console.log("Job " + jobName + " = " + this.runningJobs[j].name + " is already running");
      break;
    }
  }
  var targetIndex = -1;
  if ( ! isRunning ) {
    for (var j=0;j<this.jobs.length;j++ ) {
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

    if ( (! this.setupJobRun(targetIndex)) ) {
      console.log("Couldn't start job " + jobName);
    } else {
      console.log("Started job " + jobName);
    }
  }
  /* Do an initial processing of the new job */
  this.runningJobs.forEach( function (job, index) {
    //console.log("run_job() job.name  1 = " + job.jobName);
    //console.log("run_job() job.name  2 = " + jobName);
    if (job.jobName == jobName) {
      job.process();
      console.log("DONE INITIAL PROCESS() of " + jobName);
    }
  });
  this.load_running_jobs(msg);

}

gpioWorker.prototype.setupJobRun = function (jobIndex) {
//  var jobInstance = new JobProcessor({job:JSON.parse(JSON.stringify(this.jobs[jobIndex])),parent:this});

  try {
    this.runningJobs.push(new JobProcessor({job:JSON.parse(JSON.stringify(this.jobs[jobIndex])),parent:this}));
    //return true;
  }
  catch (err) {
    console.log("Couldn't create JobPocessor for job " + this.jobs[jobIndex].name + " ERR: " + err);
    return false;
  }
  return true;
}

gpioWorker.prototype.processRunningJobs = function () {
  console.log("processRunningJobs()");
  this.runningJobs.forEach( function (job, index) {
    console.log("Process job: " + index + " (" + job.jobName + ")");
    //console.log("Process job: " + index + " " + JSON.stringify(job.jobProfile));
    job.process();
  });
}

/* Send a list of running jobs back to the client */
gpioWorker.prototype.load_running_jobs = function (jmsg) {
  /* We reach here for a variety of reasons,
    depending on the type of jmsg
  */
  if (jmsg['type'] == 'load_running_jobs') {
    console.log("Send running_jobs list after LOAD_RUNNING_JOBS request");
  } else if (jmsg['type'] == 'run_job') {
    console.log("Send running_jobs list after RUN_JOBS request");
  } else if (jmsg['type'] == 'load_startup_data') {
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
    this.runningJobs.forEach( function (job, index) {
      console.log("runningJobs history 1: " + JSON.stringify(job.history));
      if (jmsg['type'] == 'run_job') {
        job.process();
      }
      console.log("runningJobs history 2: " + JSON.stringify(job.history));
      var job_info = {};
      job_info['header'] = job.jobInfo();
      job_info['updates'] = job.history.slice(1);
      running_jobs.push(job_info);
    });
    console.log("running_jobs list: " + JSON.stringify(running_jobs));
  } else {
    console.log("No jobs running");
  }
  var jdata = JSON.stringify({'type':'running_jobs','data':running_jobs});
  console.log("load_running_jobs() returning: " + jdata);
  this.output_queue.enqueue(jdata);
}

/* ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab: */
