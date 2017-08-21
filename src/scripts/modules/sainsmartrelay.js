//var rpio = require('rpio');
//import rpio from 'rpio';
import { default as rpio } from './jsogpio';


/* BCM numbering
var PossibleRelayPins = [
  18, 17, 27, 22,
  23, 24, 10, 9,
  11, 25, 8, 7,
  26, 16, 20, 21
];
var PIN_NUMBERING_MODE = 'gpio';
*/

/* Physical numbering */
var PossibleRelayPins = [
  12, 11, 13, 15,
  16, 18, 19, 21,
  22, 23, 32, 33,
  36, 37, 38, 40
];
var PIN_NUMBERING_MODE = 'physical';

//var RELAY_COUNT_MAX = PossibleRelayPins.length;

var RELAY_ON  = rpio.LOW;
var RELAY_OFF = rpio.HIGH;

var RelayPins = {};

var BREWTEST_DELAY_SET = {'on_time':3, 'off_time':12, 'isset':false};
var NORMAL_DELAY_SET = {'on_time':180, 'off_time':480, 'isset':false};
//var DEFAULT_DELAY_SET = NORMAL_DELAY_SET;

function Relay () {
  console.log("New Relay instance - available pins: " + PossibleRelayPins);

  this.brewtest = false;
  if (typeof process.env.BREWTEST !== 'undefined' && process.env.BREWTEST == 'true') {
    console.log("BREWTEST mode (" + process.env.BREWTEST + ")");
    this.brewtest = true;
  }

  var showConnectedPins = function () {
    var pins = [];
    for (var x in RelayPins) {pins.push(RelayPins[x]);}
    return pins;
  };

  var connectedRelays = function () {
    var counted = 0;

    for (var i=0;i<PossibleRelayPins.length;i++) {
      rpio.close(PossibleRelayPins[i]);
      //console.log("Pins: " + PossibleRelayPins[i]);
      rpio.open(PossibleRelayPins[i], rpio.OUTPUT, rpio.LOW);
    }
    for (i=0;i<PossibleRelayPins.length;i++) {
      rpio.mode(PossibleRelayPins[i], rpio.INPUT);
      //console.log("Pin %d = %d", PossibleRelayPins[i], rpio.read(PossibleRelayPins[i]));
      if (rpio.read(PossibleRelayPins[i]) == 1) {
        counted += 1;
        RelayPins['PIN_RELAY_' + counted] = PossibleRelayPins[i];
      }
    }
    // Reset for normal use - leave only connected pins open
    var connectedPins = showConnectedPins();
    for (i=0;i<PossibleRelayPins.length;i++) {
      rpio.close(PossibleRelayPins[i]);
      if (connectedPins.indexOf(PossibleRelayPins[i]) > -1) {
        rpio.open(PossibleRelayPins[i], rpio.OUTPUT, RELAY_OFF);
      }
    }
    return counted;
  };

  //rpio.init({gpiomem: true, mapping: PIN_NUMBERING_MODE, exportDelay: 8});
  rpio.init({gpiomem: true, mapping: PIN_NUMBERING_MODE});

  // Look for connected pins (populates RelayPins)
  this.relayCount = connectedRelays();

  // Delay sets
  this.delayset = [];
  for (var i=0;i<this.relayCount;i++) {
    this.delayset.push(JSON.parse(JSON.stringify(NORMAL_DELAY_SET)));
  }
  //console.log("DelaySets: " + JSON.stringify(this.delayset));

  console.log("Relay setup done. Using connected pins: " + showConnectedPins());
} 
export default Relay;

Relay.prototype.closeConnected = function () {
  var pins = [];
  for (var x in RelayPins) {pins.push(RelayPins[x]);}
  pins.forEach(function (item) {
    rpio.close(item);
  });
};

// Switch each connected pin on for 1 second
Relay.prototype.testConnected = function () {
  var pins = [];
  for (var x in RelayPins) {pins.push(RelayPins[x]);}
  pins.forEach(function (item) {
    //console.log("RRRR " + item)
    rpio.open(item, rpio.OUTPUT, RELAY_OFF);
    rpio.msleep(100);
    rpio.write(item, RELAY_ON);
    rpio.sleep(2);
    rpio.write(item, RELAY_OFF);
  });
};

Relay.prototype.deviceCount = function () {
  return this.relayCount;
};

Relay.prototype.isOn = function (id) {
  //if (this.state()[id-1][0] == RELAY_ON) {
  if (rpio.read(RelayPins['PIN_RELAY_'+id]) == RELAY_ON) {
    return true;
  } else {
    return false;
  }
};

Relay.prototype.isDelayed = function (id) {
  // Should first check if id-1 is valid!
  return this.delayset[id-1]['isset'];
};

Relay.prototype.ON = function (id) {
  if (this.isDelayed(id)) {
    return;
  }
  rpio.write(RelayPins['PIN_RELAY_'+id], RELAY_ON);
  this.setOnDelay(id);
};

Relay.prototype.OFF = function (id) {
  if (this.isDelayed(id)) {
    //console.log("Relay delayed");
    return;
  }
  rpio.write(RelayPins['PIN_RELAY_'+id], RELAY_OFF);
  this.setOffDelay(id);
};

Relay.prototype.unsetDelay = function (id) {
  this.delayset[id-1]['isset'] = false;
};

Relay.prototype.setOnDelay = function (id) {
  if (this.brewtest) {
    //console.log("setOnDelay() BREWTEST mode (" + BREWTEST_DELAY_SET['on_time'] + "secs)");
    setTimeout( function () { this.unsetDelay(id); }.bind(this), parseInt(BREWTEST_DELAY_SET['on_time'])*1000);
  } else {
    setTimeout( function () { this.unsetDelay(id); }.bind(this), parseInt(this.delayset[id-1]['on_time'])*1000);
  }
  this.delayset[id-1]['isset'] = true;
};

Relay.prototype.setOffDelay = function (id) {
  if (this.brewtest) {
    //console.log("setOffDelay() BREWTEST mode (" + BREWTEST_DELAY_SET['off_time'] + "secs)");
    setTimeout( function () { this.unsetDelay(id); }.bind(this), parseInt(BREWTEST_DELAY_SET['off_time'])*1000);
  } else {
    setTimeout( function () { this.unsetDelay(id); }.bind(this), parseInt(this.delayset[id-1]['off_time'])*1000);
  }
  this.delayset[id-1]['isset'] = true;
};

Relay.prototype.setDelaySetValue = function (id, key, val) {
  this.delayset[id-1][key] = val;
};

Relay.prototype.getDelaySetValue = function (id, key) {
  return this.delayset[id-1][key];
};

Relay.prototype.state = function () {
  var result = [];
  for (var i=0;i<this.relayCount;i++) {
    result.push([rpio.read(RelayPins['PIN_RELAY_'+parseInt(i+1)]), this.isDelayed(i+1)]);
  }
  return result;
};



/* ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab: */
