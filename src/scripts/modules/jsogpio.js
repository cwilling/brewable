var cpuInfo = require('./cpuinfo');


function JSoGPIO () {
  console.log("Hello from JSoGPIO");
  var cpuinfo = new cpuInfo();
  cpuinfo.showInfo();
}
module.exports = JSoGPIO;



/* ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab: */
