/*
  This is a subset of the rpio module (https://www.npmjs.com/package/rpio)
  using the /sys interface, therefore having no other dependencies (except
  nodefs internal fs interface).
*/

//const cpuInfo = require('./cpuinfo');
import cpuInfo from './cpuinfo';
var fs = require('fs');


var cpuinfo = new cpuInfo();
//var rev = cpuinfo.info.p1_revision;
var gpiomap;
function setup_board()
{
  var boardrev, match;

  var revision = cpuinfo.getRevision();
  match = revision.match(/^.*(.{4})/);
  if (match) {
    boardrev = parseInt(match[1], 16);
  }

  switch (boardrev) {
  case 0x2:
  case 0x3:
    gpiomap = "v1rev1";
    break;
  case 0x4:
  case 0x5:
  case 0x6:
  case 0x7:
  case 0x8:
  case 0x9:
  case 0xd:
  case 0xe:
  case 0xf:
    gpiomap = "v1rev2";
    break;
  case 0x10:
  case 0x12:
  case 0x13:
  case 0x15:
  case 0x92:
  case 0x93:
  case 0xc1:
  case 0x1041:
  case 0x2042:
  case 0x2082:
    gpiomap = "v2plus";
    break;
  default:
    throw "Unable to determine board revision";
  }
  //console.log("gpiomap = " + gpiomap);
}
setup_board();

/*
* Default pin mode is 'physical'.  Other option is 'gpio'
*/
var gpio_inited = false;
var gpio_options = {
  gpiomem: 'unused',
  mapping: 'physical'   // 'physical' or 'gpio' (BCM)
};

/*
* Valid GPIO pins, using GPIOxx BCM numbering.
*/
var validgpio = {
  'v1rev1': [
    0, 1, 4, 7, 8, 9, 10, 11, 14, 15, 17, 18, 21, 22, 23, 24, 25
  ],
  'v1rev2': [
    2, 3, 4, 7, 8, 9, 10, 11, 14, 15, 17, 18, 22, 23, 24, 25, 27, 28, 29, 30, 31
  ],
  'v2plus': [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27
  ]
};

var pincache = {};
var pinmap = {
  'v1rev1': {
    3: 0,
    5: 1,
    7: 4,
    8: 14,
    10: 15,
    11: 17,
    12: 18,
    13: 21,
    15: 22,
    16: 23,
    18: 24,
    19: 10,
    21: 9,
    22: 25,
    23: 11,
    24: 8,
    26: 7
  },
  'v1rev2': {
    3: 2,
    5: 3,
    7: 4,
    8: 14,
    10: 15,
    11: 17,
    12: 18,
    13: 27,
    15: 22,
    16: 23,
    18: 24,
    19: 10,
    21: 9,
    22: 25,
    23: 11,
    24: 8,
    26: 7
    /* XXX: no support for the P5 header pins. */
  },
  'v2plus': {
    3: 2,
    5: 3,
    7: 4,
    8: 14,
    10: 15,
    11: 17,
    12: 18,
    13: 27,
    15: 22,
    16: 23,
    18: 24,
    19: 10,
    21: 9,
    22: 25,
    23: 11,
    24: 8,
    26: 7,
    27: 0,
    28: 1,
    29: 5,
    31: 6,
    32: 12,
    33: 13,
    35: 19,
    36: 16,
    37: 26,
    38: 20,
    40: 21
  },
};

function pin_to_gpio(pin)
{

  //console.log("pin_to_gpio(1) pincache: " + JSON.stringify(pincache));
  if (pincache[pin])
    return pincache[pin];

  switch (gpio_options.mapping) {
  case 'physical':
    if (!(pin in pinmap[gpiomap])) throw "Invalid pin";
    pincache[pin] = pinmap[gpiomap][pin];
    break;
  case 'gpio':
    if (validgpio[gpiomap].indexOf(pin) === -1) throw "Invalid pin";
    pincache[pin] = pin;
    break;
  default:
    throw "Unsupported GPIO mode";
  }

  //console.log("pin_to_gpio(2) pincache: " + JSON.stringify(pincache));
  return pincache[pin];
}

function check_sys_gpio(pin, base)
{
  //console.log("check_sys_gpio() base = " + base);
  if (fs.existsSync( base + '/gpio' + pin))
    //throw "GPIO" + pin + " is currently in use by " + base;
    console.log( "GPIO" + pin + " is currently in use by " + base);
}



function JSoGPIO () {
  cpuinfo.showInfo();

  this.sysFsPath;
  this.exportDelay; // msec


}
//module.exports = JSoGPIO;
export default new JSoGPIO;

/* Constants. */
JSoGPIO.prototype.LOW = 0;
JSoGPIO.prototype.HIGH = 1;

/*
* Supported function select modes.  INPUT and OUTPUT match the bcm2835
* function select integers.  PWM is handled specially but not implemented here.
*/
JSoGPIO.prototype.INPUT = "in";
JSoGPIO.prototype.OUTPUT = "out";
JSoGPIO.prototype.PWM = "pwm";

/*
* Reset pin status on close (default), or preserve current status.
*/
JSoGPIO.prototype.PIN_PRESERVE = 0x0;
JSoGPIO.prototype.PIN_RESET = 0x1;



JSoGPIO.prototype.init = function (opts) {
  var options = opts || {};
  //console.log("JSoGPIO init options: " + JSON.stringify(options));

  for (var k in gpio_options ) {
    if (k in options)
      gpio_options[k] = options[k];
  }
  this.exportDelay = options.exportDelay || 20;

  /* Invalidate the pin cache as we may have changed mapping. */
  pincache = {};

  var sysFsPath_old = "/sys/devices/virtual/gpio";
  var sysFsPath_new = "/sys/class/gpio";
  if ( fs.existsSync(sysFsPath_new) ) {
    this.sysFsPath = sysFsPath_new;
  } else {
    this.sysFsPath = sysFsPath_old;
  }

  gpio_inited = true;
};

JSoGPIO.prototype.mode = function (pin, mode) {
  //console.log("mode() " + mode + " for pin " + pin);

  var gpiopin = pin_to_gpio(pin);

  switch (mode) {
  case JSoGPIO.prototype.INPUT:
  case JSoGPIO.prototype.OUTPUT:
    if (fs.existsSync(this.sysFsPath + '/gpio' + gpiopin)) {
      fs.writeFileSync(this.sysFsPath + '/gpio' + gpiopin + "/direction", mode);
    }
    break;
  /*
  case rpio.prototype.PWM:
    return set_pin_pwm(pin);
  */
  default:
    throw "Unsupported mode " + mode;
  }

};

JSoGPIO.prototype.open = function (pin, mode, hilo) {
  //console.log("open() pin " + pin + ", mode: " + mode + ", hilo: " + hilo);
  var gpiopin = pin_to_gpio(pin);

  if (!gpio_inited) {
    this.init();
  }

  check_sys_gpio(gpiopin, this.sysFsPath);

  switch (mode) {
  case JSoGPIO.prototype.INPUT:
    fs.writeFileSync(this.sysFsPath + '/export', gpiopin);
    fs.writeFileSync(this.sysFsPath + '/gpio' + gpiopin + '/direction', mode);
    break;
  case JSoGPIO.prototype.OUTPUT:
    fs.writeFileSync(this.sysFsPath + '/export', gpiopin);
    for (var retries=1;;retries++) {
      try {
        fs.writeFileSync(this.sysFsPath + '/gpio' + gpiopin + '/direction', mode);
        fs.writeFileSync(this.sysFsPath + '/gpio' + gpiopin + '/value', hilo);
        break;
      } catch (e) {
        if (retries > 6) throw e;

        // Wait a little longer each time
        //console.log("Trying to set direction again ...");
        this.msleep(retries * this.exportDelay);
      }
    }
    break;
  default:
    throw "Unsupported mode " + mode;
  }
};

JSoGPIO.prototype.close = function (pin, reset) {
  //console.log("JSoGPIO close pin " + pin);

  var gpiopin = pin_to_gpio(pin);

  if (reset === undefined)
    reset = JSoGPIO.prototype.PIN_RESET;

  if (!pincache[pin]) {
    return;
  }

  if (fs.existsSync(this.sysFsPath + '/gpio' + gpiopin)) {
    fs.writeFileSync(this.sysFsPath + "/unexport", gpiopin);
  }

  if (reset) {
    /*
    if (!rpio_options.gpiomem)
      rpio.prototype.pud(pin, rpio.prototype.PULL_OFF);
    */
    this.mode(pin, JSoGPIO.prototype.INPUT);
  }
};

JSoGPIO.prototype.read = function (pin) {
  //console.log("JSoGPIO read from pin " + pin);

  var gpiopin = pin_to_gpio(pin);
  return fs.readFileSync(this.sysFsPath + '/gpio' + gpiopin + '/value', { encoding: 'utf-8' });
};

JSoGPIO.prototype.write = function (pin, value) {
  //console.log("JSoGPIO write " + value + " to pin " + pin);

  var gpiopin = pin_to_gpio(pin);
  try {
    fs.writeFileSync(this.sysFsPath + '/gpio' + gpiopin + '/value', value);
  } catch (e) {
    console.log("Couldn't write to " + this.sysFsPath + '/gpio' + gpiopin + '/value' + " e: " + e);
  }
};

JSoGPIO.prototype.sleep = function (seconds) {
  //console.log("JSoGPIO sleep for " + seconds + " seconds");

  var start = new Date().getTime();
  for (var i=0;i<1e7;i++) {
    if ((new Date().getTime() - start) > seconds * 1000) {
      break;
    }
  }
};

JSoGPIO.prototype.msleep = function (milliseconds) {
  //console.log("JSoGPIO msleep for " + milliseconds + " milliseconds");

  var start = new Date().getTime();
  for (var i=0;i<1e7;i++) {
    if ((new Date().getTime() - start) > milliseconds) {
      break;
    }
  }
};


/* ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab: */
