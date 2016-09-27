var fs = require("fs");
var osenv = require("osenv");
var mkdirp = require("mkdirp");
const path = require('path');
//const xdgBasedir = require('xdg-basedir');


var defaultConfigValues = function() {
  return {
    'sensorFudgeFactors'     : {},
    'multiSensorMeanWeight' : parseInt(50),
    'relayDelayPostON'      : parseInt(180),
    'relayDelayPostOFF'     : parseInt(480)
  }
}

function Configuration (options) {
    var options = options || {};
    this._project = options.name || 'brewable';
    this._projectConfigDir = osenv.home() + '/' + this._project;
    this.topicDirs = ['jobs', 'history', 'archive'];
    this._configFileName = this._projectConfigDir + '/' + this._project + '.conf';
    this._configuration = {};

    //console.log("this._projectConfigDir: " + this._projectConfigDir);

    this.topicDirs.forEach(function (dir) {
      var target = this._projectConfigDir + '/' + dir;
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
module.exports = Configuration;

/* Read the user's configuration (or generate a new one)
*/
Configuration.prototype.loadConfigFromFile = function () {
  console.log("conf file: " + this._projectConfigDir + "/" + this._project + ".conf");
  try {
    this._configuration = JSON.parse(fs.readFileSync(this._configFileName, 'utf8'));
  }
  catch (err) {
    console.log("Error reading " + this._configFileName + ". Using default configuration");
    this._configuration = JSON.parse(JSON.stringify(defaultConfigValues()));
    fs.writeFileSync(this._configFileName, JSON.stringify(this._configuration));
  }
}

Configuration.prototype.getConfiguration = function () {
  return this._configuration;
}

Configuration.prototype.updateFudgeEntry = function (sensorIds) {
  var config = this._configuration;
  /* Case 1 - Simple conversion
     from: single 'global' fudge factor (applying to all sensors)
     to:   individual fudges for each sensor.
  */
  if ('sensorFudgeFactor' in this._configuration) {
    console.log("OLD STYLE sensorFudgeFactor");
    var val = this._configuration['sensorFudgeFactor'];
    delete this._configuration['sensorFudgeFactor'];
    newFudges = {};
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
}


/********
atest = new Configuration();
var config = atest.getConfiguration();
console.log("Read configuration: " + JSON.stringify(config));
*/

/* ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab: */