var fs = require('fs');
var path = require('path');
var os = require('os');


function JobProcessor(options) {
  this.rawJobInfo = options.job;
  this.parent = options.parent;

  this.configObj = options.parent.configObj;
  this.sensorDevices = options.parent.sensorDevices;
  this.runningJobs = options.parent.runningJobs;
  this.stoppedJobs = options.parent.stoppedJobs;
  this.output_queue = options.parent.output_queue;
  this.jobName = options.job['name'];
  this.jobPreHeat = options.job['preheat'];
  this.jobProfile = this.convertProfileTimes(this.rawJobInfo['profile']);

  var jsIds = this.validateSensors(options.job['sensors']);
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
  var jRelays = options.job['relays'];
  this.jobRelays = jRelays;

  this.jsDate = new Date();
  this.startTime = this.jsDate.getTime();

  this.instanceId = this.makeStamp(this.jsDate);
  this.processing = false;
  this.relay = options.parent.relay;

////  console.log("Processing " + JSON.stringify(options.parent));

  /*
    Start a history file for this job.
    The history file consists of a 'header' and periodic 'status' updates.
  */
  this.history = [];
  this.historyFileName = this.jobName + '-' + this.instanceId + '.txt';
  this.historyFilePath = path.join(options.parent.configObj.dir('history'), this.historyFileName);
  //console.log("historyFilePath: " + historyFilePath);

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
                    'sensors'    : []
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
  job_status['running'] = 'startup';
  console.log("job_status: " + JSON.stringify(job_status));
  this.history.push(job_status);


  fs.appendFileSync(this.historyFilePath, JSON.stringify(header) + os.EOL);
  fs.appendFileSync(this.historyFilePath, JSON.stringify(job_status) + os.EOL);

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

JobProcessor.prototype.jobStatus = function (nowTime, obj) {
  console.log("At jobStatus(): name = " + obj.jobName);
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
  var hrs, mins, secs = '0';
  var durMins = 0;
  profile.forEach( function (item, index) {
    console.log("duration = " + item.duration + ", target = " + item.target);
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
  //console.log("VALIDATE: " + JSON.stringify(valid_sensorIds));

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
}

JobProcessor.prototype.process = function () {
  console.log("Processing job: " + this.jobName);
  this.report();
  this.processing = true;
  var accumulatedTime = 0.0;
  var now = new Date().getTime();

  var target_temp = this.target_temperature(now);
  //console.log("target_temp = " + JSON.stringify(target_temp));
  this.temperatureAdjust(target_temp.target);

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
  fs.appendFileSync(this.historyFilePath, JSON.stringify(status) + os.EOL);

  this.processing = false;
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
    console.log("temperatureAdjust() mswm = " + mswm);
    temp = (temp1 * mswm + temp0 * (100-mswm))/100.0;
  } else {
    console.log("No recipe for " + this.jobSensors.length + " sensors");
    /* That's not quite true; for any number greater than two,
      we use the first two and ignore the rest.
    */
  }
  //console.log("temperatureAdjust() calculated temp = " + temp);
}


/* ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab: */
