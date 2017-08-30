import { default as gpio } from './src/scripts/modules/jsogpio';

console.log("pid=" + process.pid);

var options = {};
process.argv.forEach((val, index) => {
  //console.log(`${index}: ${val}`);
  if (val.indexOf('=') > -1) {
    console.log("val: " + val);
    var opt = val.split('=');
    console.log("opt 0 : " + opt[0]);
    console.log("opt 1 : " + opt[1]);
    options[opt[0]] = opt[1];
  }
});
console.log("raw options: " + process.argv);
console.log("options: " + JSON.stringify(options));

if ("port" in options) options.port = parseInt(options.port);
console.log("options: " + JSON.stringify(options));

class Rectangle {
  constructor(height, width) {
    this.height = height;
    this.width = width;
  }

  get area() {
    return this.height * this.width;
  }

  speak() {
    console.log("I am not an animal");
  }
}

var square = new Rectangle(10,10);
console.log("Area = " + square.area);

class Dog extends Rectangle {
  constructor (w,h) {
    super(w,h);
  }
  speak() {
    super.speak();
    console.log("Woof " + this.area);
  }
}
var d = new Dog(5,5);
d.speak();


process.exit();

/* Physical numbering */
var PossibleRelayPins = [
  12, 11, 13, 15,
  16, 18, 19, 21,
  22, 23, 32, 33,
  36, 37, 38, 40
];
var PIN_NUMBERING_MODE = 'physical';

var RELAY_ON  = gpio.LOW;
var RELAY_OFF = gpio.HIGH;

var RelayPins = {};


function testConnected () {
  var pins = [];
  for (var x in RelayPins) {pins.push(RelayPins[x]);}
  pins.forEach(function (item) {
    //console.log("RRRR " + item)
    gpio.open(item, gpio.OUTPUT, RELAY_OFF);
    gpio.write(item, RELAY_ON);
    gpio.msleep(500);
    gpio.write(item, RELAY_OFF);
    gpio.close(item);
    gpio.msleep(200);
  });
}

var connectedRelays = function () {
  var counted = 0;

  for (var i=0;i<PossibleRelayPins.length;i++) {
    gpio.close(PossibleRelayPins[i]);
    //console.log("Pins: " + PossibleRelayPins[i]);
    gpio.open(PossibleRelayPins[i], gpio.OUTPUT, gpio.LOW);
  }
  for (i=0;i<PossibleRelayPins.length;i++) {
    gpio.mode(PossibleRelayPins[i], gpio.INPUT);
    //console.log("Pin %d = %d", PossibleRelayPins[i], gpio.read(PossibleRelayPins[i]));
    if (gpio.read(PossibleRelayPins[i]) == 1) {
      counted += 1;
      RelayPins['PIN_RELAY_' + counted] = PossibleRelayPins[i];
    }
  }
  // Reset for normal use
  for (i=0;i<PossibleRelayPins.length;i++) {
    gpio.close(PossibleRelayPins[i]);
    //gpio.open(PossibleRelayPins[i], gpio.OUTPUT, RELAY_OFF);
  }
  return counted;
};

gpio.init({gpiomem: true, mapping: PIN_NUMBERING_MODE, exportDelay: 30});

// Look for connected pins (populates RelayPins)
var relayCount = connectedRelays();
console.log("relayCount =  " + relayCount + ". " + JSON.stringify(RelayPins));

console.log("\n\n\n");
gpio.sleep(1);
testConnected();

//gpio.init({mapping: PIN_NUMBERING_MODE});
/*
gpio.close(11);
console.log("closed 1");
gpio.open(11, gpio.OUTPUT, RELAY_OFF);
console.log("open 1");
gpio.write(11, RELAY_ON);
console.log("read = " + gpio.read(11));


gpio.close(11);
console.log("closed 2");
*/


/* ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab: */

