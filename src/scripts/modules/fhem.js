/*
  The only communication from an iSpindel device is its periodic data report.
  We have no way of determining whether an iSpindel device is being used
  (or multiple devices) other than the data reports. We therefore start out
  assuming there are no iSPindel devices. As each device submits a data report,
  we instantiate an fhemDevice object and add it to fhemDeviceList.

  The fhemDevice object maintains a record of the last received data report
  along with the time it was received. If we haven't heard from a device for
  some predermined time, it is removed from fhemDeviceList by deviceReaper()
  which runs periodically (started when the first iSpindel is detected).

  Data reports are not frequent - the isPindel documentation mentions:
    "With an update interval of 30min it was possible to achive a
    battery lifetime of almost 3 months!" (sic).
  Therefore when each data report is received, we emit "fhem_reading" so that
  any interested modules can immediately do something with the newly received
  data.
*/
import querystring from "querystring";
import { eventEmitter } from "./gpioworker";
import Configuration from "./configuration";
import Sensor from './sensor';


/*
  FHEM arithmetic from
  https://github.com/universam1/iSpindel/blob/master/docs/upload-FHEM_en.md
*/
var correctPlato = function (plato, temp) {
  var k;

  if (plato < 5)         k = [56.084,    -0.17885,   -0.13063];
  else if (plato >= 5)   k = [69.685,    -1.367,     -0.10621];
  else if (plato >= 10)  k = [77.782,    -1.7288,    -0.10822];
  else if (plato >= 15)  k = [87.895,    -2.3601,    -0.10285];
  else if (plato >= 20)  k = [97.052,    -2.7729,    -0.10596];

  var cPlato = k[0] + k[1] * temp + k[2] * temp*temp;
  return plato - cPlato/100;
};
var calcPlato = function (tilt, temp) {
  // Get this from Excel Calibration at 20 Degrees
  var plato=0.00438551*tilt*tilt + 0.13647658*tilt - 6.968821422;

  return correctPlato(plato, temp);
};

var fhemDeviceList = [];
var searchDeviceListByName = function (name) {
  var result;
  for (var i=0;i<fhemDeviceList.length;i++) {
    if (fhemDeviceList[i].name == name) {
      return fhemDeviceList[i];
    }
  }
  return result;
};

class fhemDevice extends Sensor {
  constructor (raw) {
    console.log("Creating new fhemDevice object from: " + JSON.stringify(raw));
    super(raw.name);
    this.raw = raw;
    //this.name = raw.name;
    this.date = new Date();

    // Check for existing configuration
    var configObj = new Configuration();
    var config = configObj.getConfiguration();

    this.timeout;
    for (var i=0;i<config.iSpindels.length;i++) {
      //console.log("Comparing " + config.iSpindels[i].name + " vs. " + raw.name);
      if (config.iSpindels[i].name == raw.name) {
        this.timeout = 1000 * parseInt(config.iSpindels[i].timeout);
        //console.log("Comparing was OK");
        break;
      }
    }
    if (! this.timeout) {
      // No timeout from configuration so need to make one up
      // We expect reports (at least) every 30mins,
      // so a check every 10mins chould be plenty.
      // 10 * 60 * 1000 = 600000
      configObj.newIspindel(raw.name);
      this.timeout = raw.timeout || 600000;
      console.log("Couldn't find " + raw.name + ". Using default timeout (" + (this.timeout/1000) + "s).");
    }

    // Periodically check whether to remove this device
    this.reaper = setInterval(this.deviceReaper,parseInt(this.timeout/10),this);
  }

  static newReading (reading) {
    //console.log("New reading: " + reading);
    var obj = {};

    try {
      var parsed = querystring.parse(reading);
      //console.log("= " + JSON.stringify(parsed));

      var command = parsed["cmd.Test"].split(" ");
      //console.log("command = " + command);
    } catch (err) {
      console.log("newReading() Can't parse " + reading);
      return;
    }

    if (command.length != 6 ) {
      console.log("newReading() Incorrect element count while parsing object: " + JSON.stringify(command));
      return;
    }
    obj.name = command[1];
    obj.tilt = parseFloat(command[2]);
    obj.temp = parseFloat(command[3]);
    obj.batt = parseFloat(command[4]);
    obj.grav = parseFloat(command[5]);
    obj.plato = calcPlato(obj.tilt, obj.temp);

    var device = searchDeviceListByName(obj.name);
    if (device) {
      console.log("Already have device: " + device.name + " at " + device.stamp);
      device.update(obj);
    } else {
      console.log("Adding new device");
      fhemDeviceList.push(new fhemDevice(obj));
    }

    eventEmitter.emit("fhem_reading", obj);
  }

  update (raw) {
    this.raw = raw;
    this.name = raw.name;
    this.date = new Date();
  }

  static devices () {
    return fhemDeviceList;
  }

  get stamp () {
    return this.date;
  }

  get tilt () {
    return this.raw.tilt;
  }
  get temp () {
    return this.raw.temp;
  }
  get batt () {
    return this.raw.batt;
  }
  get grav () {
    return this.raw.grav;
  }
  get plato () {
    return calcPlato(this.raw.tilt, this.raw.temp);
  }

  /*
    If the device is in the first x% of its life (time to be reaped)
    then fresh is true, otherwise false
  */
  get fresh () {
    var device = searchDeviceListByName(this.name);
    if (! device) return false;

    if ((new Date() - new Date(device.stamp)) < parseInt(device.timeout/5) ) {
      return true;
    } else {
      return false;
    }
  }

  /* val seconds */
  setNewTimeout (val) {
    var newTimeout = parseInt(val);
    if (newTimeout < 10) return;
    this.timeout = 1000 * newTimeout;
    if (this.reaper) clearInterval(this.reaper);

    this.reaper = setInterval(this.deviceReaper, this.timeout/10, this);
  }

  /*
    We expect reports (at least) every 30mins,
    so if nothing heard from a device for twice that time, remove it.
    60 * 60 * 1000 = 3600000
  */
  deviceReaper (caller) {
    var reap = false;
    var i;
    for (i=0;i<fhemDeviceList.length;i++) {
      if (fhemDeviceList[i].name == caller.name ) {
        //console.log("dur: " + (new Date() - new Date(fhemDeviceList[i].stamp)));
        //console.log("timeout = " + caller.timeout);
        if ((new Date() - new Date(fhemDeviceList[i].stamp)) > caller.timeout ) {
          //console.log("Planning removal of " + fhemDeviceList[i].name + ", caller = " + caller.name);
          reap = true;
        }
        break;
      }
    }
    if (reap ) {
      console.log("Reaping " + fhemDeviceList[i].name + ", caller = " + caller.name);
      clearInterval(caller.reaper);
      fhemDeviceList.splice(i, 1);
    }
  }

}

export default fhemDevice;
export const newReading = fhemDevice.newReading;

/* ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab: */

