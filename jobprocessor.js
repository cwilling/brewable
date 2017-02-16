var fs = require('fs');
var path = require('path');
var os = require('os');


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
    this.rawJobInfo['sensors'] = options.job['jobSensorIds'];
    this.rawJobInfo['relays'] = options.job['jobRelays'];
    console.log("rawJobInfo (rec): " + JSON.stringify(this.rawJobInfo));
  }


  this.configObj = options.parent.configObj;
  this.sensorDevices = options.parent.sensorDevices;
  this.runningJobs = options.parent.runningJobs;
  this.stoppedJobs = options.parent.stoppedJobs;
  this.output_queue = options.parent.output_queue;

  if (isNewJob) {
    this.jobName = options.job['name'];
    this.jobPreHeat = options.job['preheat'];
    this.jobProfile = this.convertProfileTimes(this.rawJobInfo['profile']);
  } else {
    this.jobName = options.job['jobName'];
    this.jobPreHeat = this.rawJobInfo['preheat'];
    this.jobProfile = this.rawJobInfo['profile'];
  }

  if ( (isNewJob) )
    var jsIds = this.validateSensors(options.job['sensors']);
  else
    var jsIds = this.validateSensors(options.job['jobSensorIds']);
  this.jobSensorIds = jsIds;

  var jSensors = {};
  options.parent.sensorDevices().forEach( function (sensor, index) {
    //console.log("ID = " + sensor.getId());
    //console.log("jobSensorIds (jsIds): " + JSON.stringify(jsIds));
    if (jsIds.indexOf(sensor.getId()) > -1 ) {
      jSensors[sensor.getId()] = sensor;
    }
  });
  this.jobSensors = jSensors;
  //console.log("jobSensors: " + JSON.stringify(this.jobSensors));

  if ( (isNewJob) )
    var jRelays = options.job['relays'];
  else
    var jRelays = options.job['jobRelays'];
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

////  console.log("Processing " + JSON.stringify(options.parent));

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
  var header = {'type':'header',
              'jobName':this.jobName,
              'jobInstance':this.instanceId,
              'jobPreheat':this.jobPreheat,
              'jobProfile':this.jobProfile,
              'jobSensorIds':this.jobSensorIds,
              'jobRelays':this.jobRelays,
              'startTime':this.startTime,
              'historyFileName':this.historyFileName
             }
  //console.log("header: " + JSON.stringify(header));

  //var status = this.jobStatus(this.startTime)
  /* Initial "startup" status report */
  var job_status = {'jobName'    :this.jobName,
                    'jobInstance':this.instanceId,
                    'type'       :'status',
                    'elapsed'    : Math.floor((this.startTime - this.startTime)/1000),
                    'sensors'    : [],
                    'running'    :'startup'
                   }
  if ( (!isNewJob) ) {
    job_status['elapsed'] = Math.floor((new Date().getTime() - this.startTime)/1000),
    job_status['running'] = 'recovered';
  }

  this.jobSensorIds.forEach( function (sensor, index) {
    job_status['sensors'].push(sensor);
    //console.log("jobStatus(): " + JSON.stringify(jSensors));
    job_status[sensor] = jSensors[sensor].getTemp();
  });
  //console.log("job_status: " + JSON.stringify(job_status));
  //console.log("jobRelays: " + JSON.stringify(this.jobRelays));
  this.jobRelays.forEach( function (relay, index) {
    if (options.parent.relay.isOn(parseInt(relay.split(' ')[1])) ) {
      job_status[relay] = 'ON';
    } else {
      job_status[relay] = 'OFF';
    }
  });
  if (this.jobSensorIds.length > 1) {
    job_status['msmw'] = options.parent.configObj.getConfiguration()['multiSensorMeanWeight']
  }
  console.log("job_status: " + JSON.stringify(job_status));
  this.history.push(job_status);


  if ( (isNewJob) )
    fs.appendFileSync(this.runFilePath, JSON.stringify(header) + os.EOL);
  fs.appendFileSync(this.runFilePath, JSON.stringify(job_status) + os.EOL);

  // Interpolation choices are "linear" or "step-after"
  this.target_interpolation = 'linear';

//  if ( (!isNewJob) ) return;
}
module.exports = JobProcessor;

JobProcessor.prototype.jobInfo = function () {
  var info = {'type':'jobData',
              'jobName':this.jobName,
              'jobInstance':this.instanceId,
              'jobPreheat':this.jobPreheat,
              'jobProfile':this.jobProfile,
              'jobSensorIds':this.jobSensorIds,
              'jobRelays':this.jobRelays,
  };
  //console.log("jobInfo(): " + JSON.stringify(info));
  return info;
}

JobProcessor.prototype.name = function () {
  return this.jobName;
}

JobProcessor.prototype.jobStatus = function (nowTime, obj) {
  //console.log("At jobStatus(): name = " + obj.jobName);
  var job_status = {'jobName'    :obj.jobName,
                    'jobInstance':obj.instanceId,
                    'type'       :'status',
                    'elapsed'    : Math.floor((nowTime - obj.startTime)/1000),
                    'sensors'    : []
                   }
  obj.jobSensorIds.forEach( function (sensor, index) {
    job_status['sensors'].push(sensor);
    job_status[sensor] = obj.jobSensors[sensor].getTemp();
  });
  //console.log("job_status: " + JSON.stringify(job_status));
  obj.jobRelays.forEach( function (relay, index) {
    if (obj.relay.isOn(parseInt(relay.split(' ')[1])) ) {
      job_status[relay] = 'ON';
    } else {
      job_status[relay] = 'OFF';
    }
  });
  if (obj.jobSensorIds.length > 1) {
    job_status['msmw'] = obj.parent.configuration['multiSensorMeanWeight']
  }
  //console.log("job_status: " + JSON.stringify(job_status));
  return job_status;
}

/* Convert profile's duration fields into seconds */
JobProcessor.prototype.convertProfileTimes = function (profile) {
  //console.log("convertProfileTimes()  in: " + JSON.stringify(profile));
  var hrs, mins, secs = '0';
  profile.forEach( function (item, index) {
  var durMins = 0;
    //console.log("duration = " + item.duration + ", target = " + item.target);
    var hrsmins = item.duration.split('.');
    if (parseInt(hrsmins[0]) > 0 ) { durMins = 60 * parseInt(hrsmins[0]); }
    if (parseInt(hrsmins[1]) > 0 ) { durMins += parseInt(hrsmins[1]); }
//    if ( _TESTING_ ) {
//      item.duration = durMins.toString();
//    } else {
      item.duration = (durMins * 60).toString();
//    }
  });
  //console.log("new profile: " + JSON.stringify(profile));

  //console.log("convertProfileTimes() out: " + JSON.stringify(profile));
  return profile;
}

/* Confirm specififed sensors exist in the system */
JobProcessor.prototype.validateSensors = function (sensorIds) {
  var valid_ids = [];
  var valid_sensorIds = [];
  console.log("Validate " + sensorIds);

  //console.log("sensorDevices = " + JSON.stringify(this.sensorDevices()));
  this.sensorDevices().forEach( function (item, index) {
    var sid = item.getId();
    valid_ids.push(sid);
    //console.log("Found sensor: " + sid);
    if (sensorIds.indexOf(sid) > -1) {
      valid_sensorIds.push(sid);
    }
  });
  //console.log("VALIDATE: " + valid_sensorIds);
  console.log("VALIDATE: " + JSON.stringify(valid_sensorIds));

  return valid_sensorIds;
}

JobProcessor.prototype.makeStamp = function (now) {
  var timestamp = now.getFullYear();
      timestamp = timestamp + '' + ("00" + (now.getMonth() + 1)).slice(-2);
      timestamp = timestamp + '' + ("00" + now.getDate()).slice(-2);
      timestamp = timestamp + '_' + ("00" + now.getHours()).slice(-2);
      timestamp = timestamp + '' + ("00" + now.getMinutes()).slice(-2);
      timestamp = timestamp + '' + ("00" + now.getSeconds()).slice(-2);

  //console.log("Time stamp: " + timestamp);
return timestamp;
}

JobProcessor.prototype.report = function () {
  console.log("REPORT time for job " + this.jobName + ": " + new Date().toString());
  //console.log(JSON.stringify(this.history));
}

/* Return the target temperature for a given time */
JobProcessor.prototype.target_temperature = function (current_time) {
  /* First generate an array of target temps at accumulated time */
  var control_steps = [];
  var cumulative_time = 0.0;
  //console.log("At target_temperature(), jobProfile = " + JSON.stringify(this.jobProfile));
  this.jobProfile.forEach( function (step, index) {
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

  if (this.target_interpolation == 'step-after') {
    //console.log("target_interpolation = STEP-AFTER");
    /* In simplest case (no easing into next change point)
      just choose temperature from previous set point.
    */
    var previous_setpoint = control_steps[0];
    for (var i=0;i<control_steps.length;i++) {
      var step = control_steps[i];
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
    var previous_setpoint = control_steps[0];
    for (var i=0;i<control_steps.length;i++) {
      var step = control_steps[i];
      if (step[2] > elapsed_time) {
        var slope = (step[1] - previous_setpoint[1])/(step[2] - previous_setpoint[2]);
        var intercept = step[1] - slope*step[2];
        var target = slope*elapsed_time + intercept;
        console.log("returning target = " + target);
        return {job_done:false, target:target};
      }
      previous_setpoint = step;
    }
  } else {
    console.log("UNKNOWN target_interpolation = " + this.target_interpolation);
        return {job_done:false, target:'18.0'};
  }
}

JobProcessor.prototype.stop = function (options) {
  var stopStatus = (typeof options.stopStatus !== 'undefined') ? options.stopStatus : 'stop';
  var longName = options.longName;
  console.log("stop() options: " + JSON.stringify(options));
  console.log("Stopping job: " + this.jobName + " with stopStatus = " + stopStatus);
  try {
    // Check whether previously stopped
    for (var i=0;i<this.stoppedJobs.length;i++) {
      var job = this.stoppedJobs[i];
      if (job.jobName == this.jobName) {
        // Finalise the run file
        var status = this.jobStatus(new Date().getTime(), this);
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
    for (var i=0;i<this.runningJobs.length;i++) {
      var job = this.runningJobs[i];
      if (longName == job.jobName + '-' + job.instanceId) {
        console.log("stop() found job " + longName + " to stop: ");
        job_index = i;
        break;
      }
    }
    if (job_index > -1) {
      console.log("FOUND job " + this.jobName + " to stop running");
      this.stoppedJobs.push((this.runningJobs.splice(job_index, 1)[0]));

      var jdata = JSON.stringify({'type':'stopped_job',
                                  'data':{'longName':longName, 'jobName':job.jobName}
                                });
      console.log("stop() sending: " + jdata);
      this.output_queue.enqueue(jdata);

      // Finalise the run file
      var status = this.jobStatus(new Date().getTime(), this);
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
  catch (err) {
    console.log("Trouble stopping job " + this.jobName + ": " + err);
  }
}

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

    var jdata = JSON.stringify({'type':'resumed_job', 'data':{'jobName':this.jobName}});
    this.output_queue.enqueue(jdata);

    // Resume the run file
    var status = this.jobStatus(new Date().getTime(), this);
    status['running'] = 'resumed';

    var jdata = JSON.stringify({'type':'running_job_status', 'data':status});
    this.output_queue.enqueue(jdata);

    this.history.push(status);
    fs.appendFileSync(this.runFilePath, JSON.stringify(status) + os.EOL);
  }
}

JobProcessor.prototype.process = function () {
  //console.log("Processing job: " + this.jobName);
  this.report();
  this.processing = true;
  var accumulatedTime = 0.0;
  var now = new Date().getTime();

  try {
    var target_temp = this.target_temperature(now);
    //console.log("target_temp = " + JSON.stringify(target_temp));
    this.temperatureAdjust(target_temp.target);
  }
  catch (err) {
    console.log("Couldn't find target_temp! " + err);
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
}

/* Switch relays on/off based on current and target temperature.
*/
JobProcessor.prototype.temperatureAdjust = function (target) {
  //console.log("temperatureAdjust(" + target + ")");
  //console.log("temperatureAdjust(" + target + "), " + JSON.stringify(this.jobSensors) + " (" + this.jobSensors.length + ")");
  var relayIds = [];
  var temp = target;

  this.jobRelays.forEach( function (relay, index) {
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
    temp = this.jobSensors[this.jobSensorIds[0]].getTemp();
  } else if (this.jobSensorIds.length > 1) {
    var temp0 = parseFloat(this.jobSensors[this.jobSensorIds[0]].getTemp());
    var temp1 = parseFloat(this.jobSensors[this.jobSensorIds[1]].getTemp());
    var mswm = parseFloat(this.parent.configuration['multiSensorMeanWeight']);
    //console.log("temperatureAdjust() mswm = " + mswm);
    temp = (temp1 * mswm + temp0 * (100-mswm))/100.0;
  } else {
    console.log("No recipe for " + this.jobSensors.length + " sensors");
    /* That's not quite true; for any number greater than two,
      we use the first two and ignore the rest.
    */
  }
  //console.log("temperatureAdjust() calculated temp = " + temp);

  /* Now (de)activate relays */
  if (this.jobRelays.length == 1) {
    // Single relay for COOL method
    var coolerRelay = relayIds[0];

    if (parseFloat(temp) > parseFloat(target) ) {
      // Turn on the cooler relay
      if ( (! this.relay.isOn(coolerRelay)) ) {
        this.relay.ON(coolerRelay);
        this.parent.liveUpdate();
        console.log("START COOLING");
      }
    } else if (parseFloat(temp) < parseFloat(target) ) {
      // Turn off the cooler relay
      if ( this.relay.isOn(coolerRelay) ) {
        this.relay.OFF(coolerRelay);
        this.parent.liveUpdate();
        console.log("STOP COOLING");
      }
    } else {
      if ( this.relay.isOn(coolerRelay) ) {
        this.relay.OFF(coolerRelay);
        this.parent.liveUpdate();
      }
    }
  } else if (this.jobRelays.length == 2) {
    //Assume 1st is the cooler relay, 2nd is the heater
    var coolerRelay = relayIds[0];
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
      console.log("START COOLING");
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
      console.log("START HEATING");
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

}


/* ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab: */
