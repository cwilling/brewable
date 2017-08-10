//import gpioworker from "./mod1";
//var cpuInfo = require('./src/scripts/modules/cpuinfo');
var jsogpio = require('./src/scripts/modules/jsogpio');

console.log("Hello World");

//var worker = new gpioworker(1, 2);
//worker.test();

//var cpuinfo = new cpuInfo();
//cpuinfo.showInfo();
//console.log("Hardware = " + cpuinfo.getHardware());
//console.log("Revision = " + cpuinfo.revision);
//console.log("Info = " + JSON.stringify(cpuinfo.getInfo()));

var gpio = new jsogpio();

