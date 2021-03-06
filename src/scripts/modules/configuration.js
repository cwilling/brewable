import fs from "fs";
import mkdirp from "mkdirp";
import path from 'path';
import os from 'os';

//var home = os.homedir();

var defaultConfigValues = function() {
  return {
    'sensorFudgeFactors'     : {},
    'multiSensorMeanWeight' : parseInt(50),
    'relayDelayPostON'      : parseInt(180),
    'relayDelayPostOFF'     : parseInt(480),
    /*
    'iSpindels'             : [
      { "name":"iSpindel", "timeout":120 }
    ]
    */
  };
};

function Configuration (passed_options) {
  var options = passed_options || {};
  this._project = options.name || 'brewable';
  this._projectConfigDir = path.join(os.homedir(), this._project);
  this.topicDirs = ['jobs', 'history', 'archive'];
  this._configFileName = path.join(this._projectConfigDir, this._project + '.conf');
  this._configuration = {};

  //console.log("this._projectConfigDir: " + this._projectConfigDir);
  mkdirp(this._projectConfigDir, function (err) {
    if (err) {
      console.log("Problem making directory:" + this._projectConfigDir);
    }
    //console.log("Make " + target + " OK");
    return;
  });

  this.topicDirs.forEach(function (dir) {
    var target = path.join(this._projectConfigDir, dir);
    //console.log("Creating topic dir path : " + target);
    mkdirp(target, function (err) {
      if (err) {
        console.log("Problem making directory:" + target);
      }
      //console.log("Make " + target + " OK");
      return;
    });
  }.bind(this));

  // Populate ._configuration
  this.loadConfigFromFile();
}
export default Configuration;

/* Read the user's configuration (or generate a new one)
*/
Configuration.prototype.loadConfigFromFile = function () {
  console.log("conf file: " + path.join(this._projectConfigDir, this._project + ".conf"));
  try {
    this._configuration = JSON.parse(fs.readFileSync(this._configFileName, 'utf8'));
    console.log("config from file: " + JSON.stringify(this._configuration));
  }
  catch (err) {
    console.log("Error reading " + this._configFileName + ". Using default configuration");
    this._configuration = JSON.parse(JSON.stringify(defaultConfigValues()));
    fs.writeFileSync(this._configFileName, JSON.stringify(this._configuration));
  }
};

/* Save the user's configuration
*/
Configuration.prototype.saveConfigToFile = function () {
  console.log("saveConfigToFile()");
  fs.writeFileSync(this._configFileName, JSON.stringify(this._configuration));
};

Configuration.prototype.getConfiguration = function () {
  return this._configuration;
};

Configuration.prototype.dir = function (topic) {
  if ( topic == '' ) {
    return this._projectConfigDir;
  } else if ( typeof topic == 'undefined' ) {
    return this._projectConfigDir;
  } else if ( topic == 'jobs' ) {
    return path.join(this._projectConfigDir, 'jobs');
  } else if ( topic == 'history' ) {
    return path.join(this._projectConfigDir, 'history');
  } else if ( topic == 'archive' ) {
    return path.join(this._projectConfigDir, 'archive');
  } else {
    return '/tmp';
  }
};

Configuration.prototype.updateFudgeEntry = function (sensorIds) {
  console.log("updateFudgeEntry()");

  var config = this._configuration;
  /* Case 1 - Simple conversion
     from: single 'global' fudge factor (applying to all sensors)
     to:   individual fudges for each sensor.
  */
  if ('sensorFudgeFactor' in this._configuration) {
    console.log("OLD STYLE sensorFudgeFactor");
    var val = this._configuration['sensorFudgeFactor'];
    delete this._configuration['sensorFudgeFactor'];
    var newFudges = {};
    sensorIds.forEach( function (sensor) {
      console.log(sensor.id + " : " + parseFloat(val));
      newFudges[sensor.id] = parseFloat(val);
    });
    this._configuration['sensorFudgeFactors'] = newFudges;
    //console.log("updateFudgeEntry(): " + JSON.stringify(this._configuration));
    fs.writeFileSync(this._configFileName, JSON.stringify(this._configuration));
    return;
  }

  /* Case 2 - first use
     sensorFudgeFactors is empty.
  */
  if (Object.keys(this._configuration['sensorFudgeFactors']).length == 0) {
    // First use - no fudges exist
    newFudges = {};
    sensorIds.forEach( function (sensor) {
      newFudges[sensor.id] = parseFloat(0.0);
    });
    this._configuration['sensorFudgeFactors'] = newFudges;
    fs.writeFileSync(this._configFileName, JSON.stringify(this._configuration));
    return;
  }

  /* Case 3 - Changed sensors
     i.e. saved sensors don't match detected sensors.
  */
  // Step 1 - discard fudge entries for nonexistent (undiscovered) sensors
  newFudges = {};
  sensorIds.forEach( function (sensor) {
    if (sensor.id in config.sensorFudgeFactors ) {
      // A Match
      newFudges[sensor.id] = config.sensorFudgeFactors[sensor.id];
      //console.log("Found a match for " + sensor.id);
    } else {
      // New sensor has been discovered
      newFudges[sensor.id] = parseFloat(0.0);
      //console.log("New sensor " + sensor.id + " found");
    }
  });
  config.sensorFudgeFactors = newFudges;
  fs.writeFileSync(this._configFileName, JSON.stringify(config));
  return;
};

Configuration.prototype.setMultiSensorMeanWeight = function (value) {
  console.log("setMultiSensorMeanWeight(" + value + ")");
  var config = this._configuration;
  if (value < 0 ) {
    value = 0;
  } else if (value > 100 ) {
    value = 100;
  }
  config['multiSensorMeanWeight'] = value;
  fs.writeFileSync(this._configFileName, JSON.stringify(config));
};

Configuration.prototype.setRelayDelayPost = function (onoff, value) {
  console.log("setRelayDelayPost(" + onoff + ", " + value + ")");
  if (onoff == 'relayDelayPostON' || onoff == 'relayDelayPostOFF' ) {
    var config = this._configuration;
    config[onoff] = value;
    fs.writeFileSync(this._configFileName, JSON.stringify(config));
  } else {
    console.log("Unkown config item (" + onoff + ")");
  }
};

Configuration.prototype.setFudgeFactor = function (key, val) {
  //console.log("setFudgeFactor() " + key + ", val " + val);

  var config = this._configuration;
  config.sensorFudgeFactors[key] = val;
  fs.writeFileSync(this._configFileName, JSON.stringify(config));
};

//Configuration.prototype.setIspindelTimeout = function (key, val) {
Configuration.prototype.setIspindelTimeout = function () {
  //console.log("setIspindelTimeout() " + key + ", val " + val);
  console.log("setIspindelTimeout() not used at the moment");

  /*
  var config = this._configuration;
  var found = false;
  if (config.iSpindels) {
    config.iSpindels.forEach( function(item) {
      if (item.name == key ) {
        found = true;
        item.timeout = val;
      }
    });
  }
  if (!found) {
    if (config.iSpindels) {
      config.iSpindels.push({"name":key, "timeout":val});
    } else {
      config.iSpindels = [];
      config.iSpindels.push({"name":key, "timeout":val});
    }
  }
  fs.writeFileSync(this._configFileName, JSON.stringify(config));
  */
};

Configuration.prototype.newIspindel = function () {
/*
Configuration.prototype.newIspindel = function (name) {
  var config = this._configuration;
  var defaultTimeout = defaultConfigValues().iSpindels[0].timeout;
  if (config.iSpindels) {
    config.iSpindels.push({"name":name, "timeout":defaultTimeout});
  } else {
    config.iSpindels = [];
    config.iSpindels.push({"name":name, "timeout":defaultTimeout});
  }
  fs.writeFileSync(this._configFileName, JSON.stringify(config));
*/
  this.loadConfigFromFile();
};

/********
atest = new Configuration();
var config = atest.getConfiguration();
console.log("Read configuration: " + JSON.stringify(config));
*/

/* ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab: */
