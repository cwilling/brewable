/*
  The only communication from an iSpindel device is its periodic data report.
  We have no way of determining whether an iSpindel device is being used
  (or multiple devices) other than the data reports. We therefore start out
  assuming there are no iSPindel devices. As each device submits a data report,
  we instantiate an iSpindelDevice object and add it to iSpindelDeviceList.

  The iSpindelDevice object maintains a record of the last received data report
  along with the time it was received. If we haven't heard from a device for
  some predermined time, it is removed from iSpindelDeviceList by deviceReaper()
  which runs periodically (started when the first iSpindel is detected).

  Data reports are not frequent - the isPindel documentation mentions:
    "With an update interval of 30min it was possible to achive a
    battery lifetime of almost 3 months!" (sic).
  Therefore when each data report is received, we emit "iSpindel_reading" so that
  any interested modules can immediately do something with the newly received
  data.
*/
import { eventEmitter } from "./gpioworker";
import Configuration from "./configuration";
import Sensor from './sensor';


var iSpindelDeviceList = [];
var searchDeviceListByChipId = function (Id) {
  var duplicates = 0;
  var i, duplicate, result;
  do {
    for (i=0;i<iSpindelDeviceList.length;i++) {
      if (iSpindelDeviceList[i].raw.chipId == Id) {
        if (result) {
          duplicate = i;
          duplicates += 1;
        } else {
          result = iSpindelDeviceList[i];
        }
      }
    }
    if (duplicates > 0) {
      console.log("Removing duplicate device: " + iSpindelDeviceList[duplicate].raw.chipId);
      iSpindelDeviceList.splice(duplicate, 1);
      duplicates -= 1;
    }
  } while (duplicates > 0);

  return result;
};
/*
var searchDeviceListByName = function (name) {
  var result;
  for (var i=0;i<iSpindelDeviceList.length;i++) {
    if (iSpindelDeviceList[i].name == name) {
      return iSpindelDeviceList[i];
    }
  }
  return result;
};
*/

class iSpindelDevice extends Sensor {
  constructor (raw) {
    console.log("Creating new iSpindelDevice object from: " + JSON.stringify(raw));
    super(raw.name);
    this.raw = raw;
    //this.name = raw.name;
    //this.chipId = raw.chipId;
    this.date = new Date();

    // Check for existing configuration
    var configObj = new Configuration();
    var config = configObj.getConfiguration();

    this.timeout;
    if (config.iSpindel ) {
      for (var i=0;i<config.iSpindels.length;i++) {
        //console.log("Comparing " + config.iSpindels[i].name + " vs. " + raw.name);
        if (config.iSpindels[i].name == raw.name) {
          this.timeout = 1000 * parseInt(config.iSpindels[i].timeout);
          //console.log("Comparing was OK");
          break;
        }
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

  static iSpindelCount () {
    console.log("iSpindelCount(): " + iSpindelDeviceList.length); 
  }

  static newReading (reading) {
    console.log("New iSpindel reading: " + reading);
    var obj = {};

    try {
      var data = JSON.parse(reading);
      /*
      console.log("name = " + data.name);
      console.log("  ID = " + data.ID);
      console.log("token = " + data.token);
      console.log("angle = " + data.angle);
      console.log(" temp = " + data.temperature);
      console.log(" batt = " + data.battery);
      console.log(" grav = " + data.gravity);
      console.log(" next = " + data.next);
      */
    } catch (err) {
      console.log("newReading() Can't parse " + reading);
      return;
    }

    obj.chipId = data.ID;
    obj.name = data.name;
    obj.tilt = data.angle;
    obj.temp = data.temperature;
    obj.batt = data.battery;
    obj.grav = data.gravity;
    obj.interval = data.interval;

    var device = searchDeviceListByChipId(obj.chipId);
    if (device) {
      //console.log("Already have device: " + device.raw.chipId + " at " + device.stamp);
      device.update(obj);
    } else {
      //console.log("Adding new iSpindel device (" + obj.chipId + ")");
      iSpindelDeviceList.push(new iSpindelDevice(obj));
      eventEmitter.emit('iSpindel_new_device');
    }

    eventEmitter.emit("iSpindel_reading", obj);
  }

  // Return a list of chip ids
  static sensors () {
    var returnList = [];
    iSpindelDeviceList.forEach( function (sensor) {
      returnList.push(sensor);
    });
    return returnList;
  }

  update (raw) {
    this.raw = raw;
    this.name = raw.name;
    this.date = new Date();
    //console.log("update(raw) grav = " + this.raw.grav);
  }

  static devices () {
    return iSpindelDeviceList;
  }

  get stamp () {
    return this.date;
  }

  get chipId () {
    return this.raw.chipId;
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
  get interval () {
    return this.raw.interval;
  }

  /*
    If the device is in the first x% of its life (time to be reaped)
    then fresh is true, otherwise false
  */
  get fresh () {
    var device = searchDeviceListByChipId(this.raw.chipId);
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
    for (i=0;i<iSpindelDeviceList.length;i++) {
      if (iSpindelDeviceList[i].name == caller.name ) {
        //console.log("dur: " + (new Date() - new Date(iSpindelDeviceList[i].stamp)));
        //console.log("timeout = " + caller.timeout);
        if ((new Date() - new Date(iSpindelDeviceList[i].stamp)) > caller.timeout ) {
          //console.log("Planning removal of " + iSpindelDeviceList[i].name + ", caller = " + caller.name);
          reap = true;
        }
        break;
      }
    }
    if (reap ) {
      console.log("Reaping " + iSpindelDeviceList[i].chipId + ", caller = " + caller.name);
      clearInterval(caller.reaper);
      iSpindelDeviceList.splice(i, 1);
      /*
        Others (running jobs using this device) may be interested thath it's gone
      */
      eventEmitter.emit("iSpindel_reaped", caller);
    }
  }

}

export default iSpindelDevice;
export const newReading = iSpindelDevice.newReading;
export const iSpindelCount = iSpindelDevice.iSpindelCount;

/* ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab: */

