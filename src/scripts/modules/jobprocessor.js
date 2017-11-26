import os from 'os';
import fs from 'fs';
import path from 'path';


function JobProcessor(options) {
  var isNewJob = true;
  if (options.job.hasOwnProperty('type')) {
    // This is not a new job rather a recovered job,
    // comprising a header with an additional array  of 'updates'
    isNewJob = false;
    console.log("JobProcessor(): RECOVERING job " + options.job.jobName + '-' + options.job.jobInstance);
  }
  this.parent = options.parent;
  if (isNewJob) {
    this.rawJobInfo = options.job;
    console.log("rawJobInfo (new): preheat type = " + typeof(this.rawJobInfo['preheat']));
    if (typeof(this.rawJobInfo['preheat']) === 'boolean') {
      console.log("Changing preheat!");
      var newPreheat = {};
      newPreheat['on'] = this.rawJobInfo['preheat'];
      this.rawJobInfo['preheat'] = newPreheat;
    }
    console.log("rawJobInfo (new): " + JSON.stringify(this.rawJobInfo));
  } else {
    this.rawJobInfo = {};
    this.rawJobInfo['name'] = options.job['jobName'];
    // Preheat not implemented yet.
    // Expect it to be an object with at least an 'on' field which is either true or false;
    if ( (!options.job.hasOwnProperty('preheat')) ) {
      this.rawJobInfo['preheat'] = {};
      this.rawJobInfo['preheat']['on'] = false;
    } else {
      this.rawJobInfo['preheat'] = options.job['preheat'];
    }
    this.rawJobInfo['profile'] = options.job['jobProfile'];
    if (options.job.hasOwnProperty('sensors')) {
      this.rawJobInfo['sensors'] = options.job['sensors'];
    } else {
      this.rawJobInfo['sensors'] = options.job['jobSensorIds'];
    }
    this.rawJobInfo['relays'] = options.job['jobRelays'];
    console.log("rawJobInfo (rec): " + JSON.stringify(this.rawJobInfo));
  }
  this.sensors = this.rawJobInfo['sensors'];


  this.configObj = options.parent.configObj;
  this.sensorDevices = options.parent.sensorDevices;
  this.runningJobs = options.parent.runningJobs;
  this.stoppedJobs = options.parent.stoppedJobs;
  this.output_queue = options.parent.output_queue;


  // A job could have been stopped by user interaction
  // or by a sensor becoming unavailable e.g. iSpindel does down
  // this.sensorMissing should be set when adding to this.stoppedJobs
  // where it will be checked when sensors (re)appear.
  this.sensorMissing = false;

  if (isNewJob) {
    this.jobName = options.job['name'];
    this.jobPreHeat = options.job['preheat'];
    this.jobProfile = this.convertProfileTimes(this.rawJobInfo['profile']);
  } else {
    this.jobName = options.job['jobName'];
    this.jobPreHeat = this.rawJobInfo['preheat'];
    this.jobProfile = this.rawJobInfo['profile'];
  }

  var jsIds;
  if ( (isNewJob) )
    jsIds = this.validateSensors(options.job['sensors']);
  else
    jsIds = this.validateSensors(options.job['jobSensorIds']);
  this.jobSensorIds = jsIds;

  var jSensors = this.MatchSensorsToIds(options.parent.sensorDevices(), jsIds);
  this.jobSensors = jSensors;
  //console.log("jobSensors: " + JSON.stringify(this.jobSensors));

  var jRelays;
  if ( (isNewJob) )
    jRelays = options.job['relays'];
  else
    jRelays = options.job['jobRelays'];
  this.jobRelays = jRelays;

  if ( (isNewJob) ) {
    this.jsDate = new Date();
    this.startTime = this.jsDate.getTime();
  } else {
    this.startTime = options.job['startTime'];
  }

  if ( (isNewJob) ) {
    this.instanceId = this.makeStamp(this.jsDate);
  } else {
    this.instanceId = options.job['jobInstance'];
  }

  this.relay = options.parent.relay;


  this.processing = false;

  //  console.log("Processing " + JSON.stringify(options.parent));

  /*
    Start a history file for this job.
    The history file consists of a 'header' and periodic 'status' updates.
  */
  if ( (isNewJob) )
    this.history = [];
  else
    this.history = options.job['updates'];
  //console.log("New history: " + JSON.stringify(this.history));

  this.historyFileName = this.jobName + '-' + this.instanceId + '.txt';
  this.runFilePath = path.join(options.parent.configObj.dir('jobs'), this.historyFileName);
  this.historyFilePath = path.join(options.parent.configObj.dir('history'), this.historyFileName);

  // Only for new jobs (not recovered jobs)
  var header = {
    'type':'header',
    'jobName':this.jobName,
    'jobInstance':this.instanceId,
    'jobPreheat':this.jobPreheat,
    'jobProfile':this.jobProfile,
    'jobSensorIds':this.jobSensorIds,
    'sensors':this.sensors,
    'jobRelays':this.jobRelays,
    'startTime':this.startTime,
    'historyFileName':this.historyFileName
  };
  //console.log("header: " + JSON.stringify(header));

  //var status = this.jobStatus(this.startTime)
  /* Initial "startup" status report */
  var job_status = {
    'jobName'    :this.jobName,
    'jobInstance':this.instanceId,
    'type'       :'status',
    'elapsed'    : Math.floor((this.startTime - this.startTime)/1000),
    'sensors'    : [],
    'running'    :'startup'
  };
  if ( (!isNewJob) ) {
    job_status['elapsed'] = Math.floor((new Date().getTime() - this.startTime)/1000),
    job_status['running'] = 'recovered';
  }

  // Apply fudges to job configuration
  var fudges = options.parent.configObj.getConfiguration()['sensorFudgeFactors'];
  var keys = Object.keys(fudges);
  this.jobSensorIds.forEach( function (sensor) {
    for (var sensorKey in keys) {
      if (keys[sensorKey] == jSensors[sensor].name) {
        console.log("Setting fudge of " + keys[sensorKey] + " to " + fudges[keys[sensorKey]]);
        jSensors[sensor].fudge = fudges[keys[sensorKey]];
      }
    }
    job_status['sensors'].push(sensor);
    var sensorValue = {};
    sensorValue["temp"] = jSensors[sensor].temp;
    if (jSensors[sensor].grav) {
      sensorValue["grav"] = jSensors[sensor].grav;
    }
    job_status[sensor] = sensorValue;
  });
  console.log("job_status: " + JSON.stringify(job_status));
  //console.log("jobRelays: " + JSON.stringify(this.jobRelays));
  //this.jobRelays.forEach( function (relay, index) {
  this.jobRelays.forEach( function (relay) {
    if (options.parent.relay.isOn(parseInt(relay.split(' ')[1])) ) {
      job_status[relay] = 'ON';
    } else {
      job_status[relay] = 'OFF';
    }
  });
  if (this.jobSensorIds.length > 1) {
    job_status['msmw'] = options.parent.configObj.getConfiguration()['multiSensorMeanWeight'];
  }
  console.log("job_status: " + JSON.stringify(job_status));
  this.history.push(job_status);


  if ( (isNewJob) )
    fs.appendFileSync(this.runFilePath, JSON.stringify(header) + os.EOL);
  fs.appendFileSync(this.runFilePath, JSON.stringify(job_status) + os.EOL);

  // Interpolation choices are "linear" or "step-after"
  this.target_interpolation = 'linear';

  //if ( (!isNewJob) ) return;

}
export default JobProcessor;

JobProcessor.prototype.jobInfo = function () {
  var info = {
    'type':'jobData',
    'jobName':this.jobName,
    'jobInstance':this.instanceId,
    'jobPreheat':this.jobPreheat,
    'jobProfile':this.jobProfile,
    'jobSensorIds':this.jobSensorIds,
    'sensors':this.sensors,
    'jobRelays':this.jobRelays,
  };
  //console.log("jobInfo(): " + JSON.stringify(info));
  //console.log("jobInfo() sensors: " + info.sensors);
  return info;
};

JobProcessor.prototype.name = function () {
  return this.jobName;
};

JobProcessor.prototype.MatchSensorsToIds = function (sensorDevices, jsIds) {
  //console.log("MatchSensorsToIds(): " + sensorDevices + " " + jsIds);

  var result = {};
  sensorDevices.forEach( function (sensor) {
    //console.log("ID = " + sensor.chipId);
    //console.log("jobSensorIds (jsIds): " + JSON.stringify(jsIds));
    if (jsIds.indexOf(sensor.chipId.toString()) > -1 ) {
      //console.log("Matched: " + sensor.chipId.toString());
      result[sensor.chipId] = sensor;
    }
  });
  return result;
};

JobProcessor.prototype.jobStatus = function (nowTime, obj) {
  //console.log("At jobStatus(): name = " + obj.jobName);
  var job_status = {
    'jobName'    :obj.jobName,
    'jobInstance':obj.instanceId,
    'type'       :'status',
    'elapsed'    : Math.floor((nowTime - obj.startTime)/1000),
    'sensors'    : []
  };
  obj.jobSensorIds.forEach( function (sensor) {
    job_status['sensors'].push(sensor);
    //job_status[sensor] = obj.jobSensors[sensor].temp;
    job_status[sensor] = {};
    try {
      job_status[sensor]['temp'] = obj.jobSensors[sensor].temp;
      var grav = obj.jobSensors[sensor].grav;
      if (grav) {
        job_status[sensor]['grav'] = grav;
      }
    }
    catch (err) {
      console.log("Sensor " + sensor.name + " unavailable");
    }
  });
  //console.log("job_status: " + JSON.stringify(job_status));
  obj.jobRelays.forEach( function (relay) {
    if (obj.relay.isOn(parseInt(relay.split(' ')[1])) ) {
      job_status[relay] = 'ON';
    } else {
      job_status[relay] = 'OFF';
    }
  });
  if (obj.jobSensorIds.length > 1) {
    job_status['msmw'] = obj.parent.configuration['multiSensorMeanWeight'];
  }
  //console.log("job_status: " + JSON.stringify(job_status));
  return job_status;
};

/* Convert profile's duration fields into seconds */
JobProcessor.prototype.convertProfileTimes = function (profile) {
  //console.log("convertProfileTimes()  in: " + JSON.stringify(profile));
  //var hrs, mins, secs = '0';
  //profile.forEach( function (item) {
  //profile.forEach( function (item, index) {
  profile.forEach( function (item) {
    var durMins = 0;
    //console.log("duration = " + item.duration + ", target = " + item.target);
    var hrsmins = item.duration.split('.');
    if (parseInt(hrsmins[0]) > 0 ) { durMins = 60 * parseInt(hrsmins[0]); }
    if (parseInt(hrsmins[1]) > 0 ) { durMins += parseInt(hrsmins[1]); }
    //if ( _TESTING_ ) {
    //  item.duration = durMins.toString();
    //} else {
    item.duration = (durMins * 60).toString();
    //}
  });
  //console.log("new profile: " + JSON.stringify(profile));

  //console.log("convertProfileTimes() out: " + JSON.stringify(profile));
  return profile;
};

/* Confirm specified sensors exist in the system */
JobProcessor.prototype.validateSensors = function (sensorIds) {
  var valid_ids = [];
  var valid_sensorIds = [];
  console.log("Validate " + sensorIds);

  //console.log("sensorDevices = " + JSON.stringify(this.sensorDevices()));
  this.sensorDevices().forEach( function (item) {
    //console.log("Considering A sensor: " + item.chipId);
    var sid = item.chipId.toString();
    //console.log("Considering B sensor: " + sid + " (" + typeof(sid) + ")");
    valid_ids.push(sid);
    //console.log("Found sensor: " + sid);
    if (sensorIds.indexOf(sid) > -1) {
      valid_sensorIds.push(sid);
    }
  });
  console.log("VALIDATED: " + JSON.stringify(valid_sensorIds));

  return valid_sensorIds;
};

JobProcessor.prototype.makeStamp = function (now) {
  var timestamp = now.getFullYear();
  timestamp = timestamp + '' + ("00" + (now.getMonth() + 1)).slice(-2);
  timestamp = timestamp + '' + ("00" + now.getDate()).slice(-2);
  timestamp = timestamp + '_' + ("00" + now.getHours()).slice(-2);
  timestamp = timestamp + '' + ("00" + now.getMinutes()).slice(-2);
  timestamp = timestamp + '' + ("00" + now.getSeconds()).slice(-2);

  //console.log("Time stamp: " + timestamp);
  return timestamp;
};

JobProcessor.prototype.report = function () {
  console.log("REPORT time for job " + this.jobName + "-" + this.instanceId + ": " + new Date().toString());
  //console.log(JSON.stringify(this.history));

  // Ensure sensor objects are fresh
  // (in case an iSpindel has reappeared)
  //console.log("report() jobSensorIds = " + this.jobSensorIds);
  this.jobSensors = this.MatchSensorsToIds(this.parent.sensorDevices(), this.jobSensorIds);

};

JobProcessor.prototype.resetFudges = function (data) {
  //console.log("Resetting fudges for job: " + this.name() + " with data: " + JSON.stringify(data));
  for (var sensor in this.jobSensors) {
    if (this.jobSensors[sensor].name == data["sensorFudgeFactors"]) {
      this.jobSensors[sensor].fudge = data["fudge"];
      console.log("resetFudges() reset = " + this.jobSensors[sensor].name + " with " + data["fudge"]);
    }
  }
};

/* Return the target temperature for a given time */
JobProcessor.prototype.target_temperature = function (current_time) {
  /* First generate an array of target temps at accumulated time */
  var control_steps = [];
  var cumulative_time = 0.0;
  var step, i;
  //console.log("At target_temperature(), jobProfile = " + JSON.stringify(this.jobProfile));
  //this.jobProfile.forEach( function (step, index) {
  this.jobProfile.forEach( function (step) {
    var entry = [];
    entry.push(parseFloat(step.duration));
    entry.push(parseFloat(step.target));
    entry.push(cumulative_time);
    //console.log("entry: " + JSON.stringify(entry));
    control_steps.push(entry);
    cumulative_time += entry[0];
  });

  var elapsed_time = Math.floor((current_time - this.startTime)/1000);
  //console.log("elapsed_time = " + elapsed_time);
  //console.log("control_steps = " + JSON.stringify(control_steps));

  /* If we're past the last step, return the last valid temperature target */
  if (elapsed_time > control_steps[control_steps.length - 1][2]) {
    //console.log("done!: ");
    //console.log("Returning " + JSON.stringify({job_done:true, target:control_steps[control_steps.length - 1][1]}));
    return {job_done:true, target:control_steps[control_steps.length - 1][1]};
  }

  var previous_setpoint;
  if (this.target_interpolation == 'step-after') {
    //console.log("target_interpolation = STEP-AFTER");
    /* In simplest case (no easing into next change point)
      just choose temperature from previous set point.
    */
    previous_setpoint = control_steps[0];
    for (i=0;i<control_steps.length;i++) {
      step = control_steps[i];
      if (step[2] > elapsed_time) {
        //console.log("Returning " + JSON.stringify({job_done:false, target:previous_setpoint[1]}));
        return {job_done:false, target:previous_setpoint[1]};
      }
      previous_setpoint = step;
    }
  } if (this.target_interpolation == 'linear') {
    //console.log("target_interpolation = LINEAR");
    /* Follow linear path between set points
      i.e. find slope between previous & next set points,
      then extract temperature at current_time
    */
    previous_setpoint = control_steps[0];
    for (i=0;i<control_steps.length;i++) {
      step = control_steps[i];
      if (step[2] > elapsed_time) {
        var slope = (step[1] - previous_setpoint[1])/(step[2] - previous_setpoint[2]);
        var intercept = step[1] - slope*step[2];
        var target = slope*elapsed_time + intercept;
        //console.log("returning target = " + target);
        return {job_done:false, target:target};
      }
      previous_setpoint = step;
    }
  } else {
    console.log("UNKNOWN target_interpolation = " + this.target_interpolation);
    return {job_done:false, target:'18.0'};
  }
};

/*
  A job may be stopped due to user interaction
  or because a necessary device (e.g. iSpindel) has become "lost".
  The reason is given in options.stopStatus which can be:
    'stop' (user interaction)
    'suspend' (missing device)

  In the latter case, we need to remove any reference to that device from this job
  (also generate new reference if it becomes available again later).
*/
JobProcessor.prototype.stop = function (options) {
  var stopStatus = (typeof options.stopStatus !== 'undefined') ? options.stopStatus : 'stop';
  var missingDevice = options.missingDevice;
  var longName = options.longName;
  console.log("stop() options: " + JSON.stringify(options));
  console.log("Stopping job: " + this.jobName + " with stopStatus = " + stopStatus);
  try {
    // Check whether previously stopped
    var status = this.jobStatus(new Date().getTime(), this);
    for (var i=0;i<this.stoppedJobs.length;i++) {
      var job = this.stoppedJobs[i];
      if (job.jobName == this.jobName) {
        // Finalise the run file
        status = this.jobStatus(new Date().getTime(), this);
        if (stopStatus == 'save') {
          status['running'] = 'saved';
        } else if (stopStatus == 'remove') {
          status['running'] = 'removable';
        } else {
          status['running'] = 'stopped';
        }
        var jdata = JSON.stringify({'type':'running_job_status', 'data':status});
        this.output_queue.enqueue(jdata);

        this.history.push(status);
        fs.appendFileSync(this.runFilePath, JSON.stringify(status) + os.EOL);
      }
    }
    var job_index = -1;
    for (i=0;i<this.runningJobs.length;i++) {
      job = this.runningJobs[i];
      if (longName == job.jobName + '-' + job.instanceId) {
        console.log("stop() found job " + longName + " to stop: ");
        job_index = i;
        break;
      }
    }
    if (job_index > -1) {
      console.log("FOUND job " + this.jobName + " to stop running. sensorMissing = " + (stopStatus == "suspend"));
      this.runningJobs[job_index].sensorMissing = (stopStatus == "suspend");
      this.stoppedJobs.push((this.runningJobs.splice(job_index, 1)[0]));

      jdata = JSON.stringify({
        'type':'stopped_job',
        'data':{'longName':longName, 'jobName':job.jobName, 'reason':{'stopStatus':stopStatus, 'missingDevice':missingDevice}}
      });
      console.log("stop() sending: " + jdata);
      this.output_queue.enqueue(jdata);

      // Finalise the run file
      status = this.jobStatus(new Date().getTime(), this);
      if (stopStatus == 'save') {
        status['running'] = 'saved';
      } else if (stopStatus == 'remove') {
        status['running'] = 'removable';
      } else {
        status['running'] = 'stopped';
      }
      jdata = JSON.stringify({'type':'running_job_status', 'data':status});
      this.output_queue.enqueue(jdata);

      this.history.push(status);
      fs.appendFileSync(this.runFilePath, JSON.stringify(status) + os.EOL);
    }
  }
  catch (err) {
    console.log("Trouble stopping job " + this.jobName + ": " + err);
  }
};

JobProcessor.prototype.resume = function () {
  console.log("resume(): resuming job: " + this.name() + "-" + this.instanceId);
  var job_index = -1;
  for (var i=0;i<this.stoppedJobs.length;i++) {
    var job = this.stoppedJobs[i];
    if (job.jobName == this.jobName) {
      job_index = i;
      break;
    }
  }
  if (job_index > -1) {
    console.log("FOUND job " + this.jobName + " to resume running");
    this.runningJobs.push((this.stoppedJobs.splice(i,1)[0]));

    var jdata = JSON.stringify({'type':'resumed_job', 'data':{'longName':this.jobName + "-" + this.instanceId}});
    this.output_queue.enqueue(jdata);

    // Resume the run file
    var status = this.jobStatus(new Date().getTime(), this);
    status['running'] = 'resumed';

    jdata = JSON.stringify({'type':'running_job_status', 'data':status});
    this.output_queue.enqueue(jdata);

    this.history.push(status);
    fs.appendFileSync(this.runFilePath, JSON.stringify(status) + os.EOL);
  }
};

JobProcessor.prototype.process = function () {
  //console.log("Processing job: " + this.jobName);
  this.report();
  this.processing = true;
  var now = new Date().getTime();

  try {
    var target_temp = this.target_temperature(now);
    //console.log("target_temp = " + JSON.stringify(target_temp));
    this.temperatureAdjust(target_temp.target);
  }
  catch (err) {
    console.log("Couldn't find target_temp! " + err);
    // Maybe reaching here implies a missing sensor so we should
    // perhaps suspend the job?
    this.stop({"stopStatus":"suspend", "longName":this.jobName + '-' + this.instanceId});

    return;
  }

  /*
    jobStatus() doesn't seem to know what 'this' is
    so pass it as an argument
  */
  var status = this.jobStatus(now, this);
  if (target_temp.job_done) {
    status['running'] = 'done';
  } else {
    status['running'] = 'running';
  }
  //console.log("process() status: " + JSON.stringify(status));

  var jdata = JSON.stringify({
    'type':'running_job_status',
    'data':status
  });
  this.output_queue.enqueue(jdata);
  this.history.push(status);
  fs.appendFileSync(this.runFilePath, JSON.stringify(status) + os.EOL);

  this.processing = false;

  if (target_temp.job_done) {
    // What to do if we're finished?
    // Maintain last target?
    // Do nothing (return)?
    // Send some sort of alert?
    // Turn everything off?

    console.log("Job " + this.jobName + " DONE!");
  }
};

/* Switch relays on/off based on current and target temperature.
*/
JobProcessor.prototype.temperatureAdjust = function (target) {
  //console.log("temperatureAdjust(" + target + ")");
  //console.log("temperatureAdjust(" + target + "), " + JSON.stringify(this.jobSensors) + " (" + this.jobSensors.length + ")");
  var relayIds = [];
  var temp = target;

  this.jobRelays.forEach( function (relay) {
    relayIds.push(parseInt(relay.split(' ')[1]));
  });

  /* If only one sensor has been specified, use its temperature.
    If more than one sensor has been specified, we use temperatures
    from only the first two. In this case, we calculate a weighted
    mean of the two sensors' temperatures. The actual weighting
    is specified by the user in the UI Configuration page, the
    weighting number indicating "how much" of the second sensor's
    reading to factor in. A weight of 0 means to not take the second
    sensor into account at all. A weight of 50 means to take equal
    account of both sensors (a simple arithmetic mean of the two).
    A weight of 100 means to use the second sensor "as is" and not
    take the first sensor's reading into account at all.
  */
  if (this.jobSensorIds.length == 1) {
    try {
      temp = this.jobSensors[this.jobSensorIds[0]].temp;
    }
    catch (err) {
      console.log("Error with single sensor: " + err);
    }
  } else if (this.jobSensorIds.length > 1) {
    var temp0, temp1;
    var temp0_OK = false;
    var temp1_OK = false;
    try {
      temp0 = parseFloat(this.jobSensors[this.jobSensorIds[0]].temp);
      temp0_OK = true;
    }
    catch (err) {
      console.log("Error with first of two sensors: " + err);
    }
    try {
      temp1 = parseFloat(this.jobSensors[this.jobSensorIds[1]].temp);
      temp1_OK = true;
    }
    catch (err) {
      console.log("Error with second of two sensors: " + err);
    }
    var mswm = parseFloat(this.parent.configuration['multiSensorMeanWeight']);
    //console.log("temperatureAdjust() mswm = " + mswm);
    if ( temp0_OK && temp1_OK ) {
      temp = (temp1 * mswm + temp0 * (100-mswm))/100.0;
    } else if (temp0_OK) {
      temp = temp0;
    } else { //temp1_OK
      temp = temp1;
    }
  } else {
    console.log("No recipe for " + this.jobSensors.length + " sensors");
    /* That's not quite true; for any number greater than two,
      we use the first two and ignore the rest.
    */
  }
  //console.log("temperatureAdjust() calculated temp = " + temp);

  /* Now (de)activate relays */
  var coolerRelay;
  if (this.jobRelays.length == 1) {
    // Single relay for COOL method
    coolerRelay = relayIds[0];

    if (parseFloat(temp) > parseFloat(target) ) {
      // Turn on the cooler relay
      if ( (! this.relay.isOn(coolerRelay)) ) {
        this.relay.ON(coolerRelay);
        this.parent.liveUpdate();
        console.log(this.jobName + '-' + this.instanceId + ": START COOLING");
      }
    } else if (parseFloat(temp) < parseFloat(target) ) {
      // Turn off the cooler relay
      if ( this.relay.isOn(coolerRelay) ) {
        this.relay.OFF(coolerRelay);
        this.parent.liveUpdate();
        console.log(this.jobName + '-' + this.instanceId + ": STOP COOLING");
      }
    } else {
      if ( this.relay.isOn(coolerRelay) ) {
        this.relay.OFF(coolerRelay);
        this.parent.liveUpdate();
      }
    }
  } else if (this.jobRelays.length == 2) {
    //Assume 1st is the cooler relay, 2nd is the heater
    coolerRelay = relayIds[0];
    var heaterRelay = relayIds[1];

    if (parseFloat(temp) > parseFloat(target) ) {
      // Turn on the cooler relay
      if ( (! this.relay.isOn(coolerRelay)) ) {
        this.relay.ON(coolerRelay);
        this.parent.liveUpdate();
      }
      // Turn off the heater relay
      if ( this.relay.isOn(heaterRelay) ) {
        this.relay.OFF(heaterRelay);
        this.parent.liveUpdate();
      }
      console.log(this.jobName + '-' + this.instanceId + ": START COOLING");
    } else if (parseFloat(temp) < parseFloat(target) ) {
      // Turn off the cooler relay
      if ( this.relay.isOn(coolerRelay) ) {
        this.relay.OFF(coolerRelay);
        this.parent.liveUpdate();
      }
      // Turn on the heater relay
      if ( (! this.relay.isOn(heaterRelay)) ) {
        this.relay.ON(heaterRelay);
        this.parent.liveUpdate();
      }
      console.log(this.jobName + '-' + this.instanceId + ": START HEATING");
    } else {
      if ( this.relay.isOn(coolerRelay) ) {
        this.relay.OFF(coolerRelay);
        this.parent.liveUpdate();
      }
      if ( this.relay.isOn(heaterRelay) ) {
        this.relay.OFF(heaterRelay);
        this.parent.liveUpdate();
      }
    }
  } else {
    console.log("No recipe for " + this.jobRelays.length + " relays");
  }

};


/* ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab: */
