import events from 'events';
var fs = require('fs');

// SensorDevice object
function SensorDevice (id) {
  this.id = id;
  this.fudge = parseFloat(0.7);
  events.EventEmitter.call(this);
  SensorDevice.prototype.__proto__ = events.EventEmitter.prototype;

  //console.log('New SensorDevice with id = ' + this.id + ', fudge = ' + this.fudge);

}
export default SensorDevice;

SensorDevice.prototype.getId = function () {
  return this.id;
};

SensorDevice.prototype.getTempAsync = function (callback) {
  var dpath = '/sys/bus/w1/devices/' + this.id + '/w1_slave';
  var id = this.id;
  fs.readFile(dpath, 'utf8', function (err, data) {
    if (err) {
      console.log('Error reading device data: ' + dpath);
    } else {
      var result = parseFloat(data.split(' ')[20].split('=')[1]) / 1000;
      callback(id, result);
    }
  });
};

SensorDevice.prototype.getTemp = function () {
  var dpath = '/sys/bus/w1/devices/' + this.id + '/w1_slave';
  var data = fs.readFileSync(dpath, 'utf8');
  //console.log('(SensorDevice)' + this.id + ' data = ' + data);
  return parseFloat(data.split(' ')[20].split('=')[1]) / 1000;
};

SensorDevice.prototype.setFudge = function (fudgeFactor) {
  console.log("setFudge(): for " + this.id + " (" + fudgeFactor + ")");
  this.fudge = parseFloat(fudgeFactor);
};

SensorDevice.prototype.getFudge = function () {
  return this.fudge;
};




/* ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab: */
