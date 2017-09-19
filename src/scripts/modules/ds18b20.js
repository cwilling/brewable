import fs from 'fs';
import Sensor from './sensor';

//const NAME = Symbol();
const FUDGE = Symbol();

// ds18b20Device object
class ds18b20Device extends Sensor {
  constructor (val) {
    super(val);
    //this[NAME] = val;
    this[FUDGE] = parseFloat(0.0);

    console.log('New ds18b20Device with id = ' + this.id + ', fudge = ' + this.fudge);
  }

  // Return a list of sensor devices
  static sensors() {
    var deviceDirectory = '/sys/bus/w1/devices/w1_bus_master1/w1_master_slaves';
    var returnList = [];
    var data = fs.readFileSync(deviceDirectory, 'utf8');
    var devs = data.split('\n');
    devs.pop();
    for (var i=0;i<devs.length;i++) {
      //console.log("substr = " + devs[i].substr(-8));
      if (devs[i].substr(-8) != "00000000") returnList.push(devs[i]);
    }
    return returnList;
  }

  //set name (val) {}
  //get name () { return this[NAME]; }
  //set id (val) {}
  //get id () { return this[NAME]; }

  set fudge (fudgeFactor) {
    this[FUDGE] = parseFloat(fudgeFactor);
  }
  get fudge () {
    return this[FUDGE];
  }

  getTemp () {
    var dpath = '/sys/bus/w1/devices/' + this.id + '/w1_slave';
    var data = fs.readFileSync(dpath, 'utf8');
    return parseFloat(this.fudge) + parseFloat(data.split(' ')[20].split('=')[1]) / 1000;
  }

  getTempAsync (callback) {
    if (!arguments.length || arguments.length && typeof arguments[0] !== "function") {
      return this.getTemp();
    }
    var dpath = '/sys/bus/w1/devices/' + this.id + '/w1_slave';
    var id = this.id;
    var fudge = this.fudge;
    fs.readFile(dpath, 'utf8', function (err, data) {
      if (err) {
        console.log('Error reading device data: ' + dpath);
      } else {
        var result = parseFloat(fudge) + parseFloat(data.split(' ')[20].split('=')[1]) / 1000;
        callback(result, id);
      }
    });
  }

  get temp () {
    return this.getTemp();
  }

}
export default ds18b20Device;


/* ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab: */
