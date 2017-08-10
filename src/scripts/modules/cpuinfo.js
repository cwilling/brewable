const readline = require('readline');
const fs = require("fs");

function cpuinfo () {
  this.possibleHardware = [
    'BCM2708',
    'BCM27089',
    'BCM2835',
    'BCM2836',
    'BCM2837'
  ];
  this.info = {};
  var split, rlen;

  var lines = fs.readFileSync("/proc/cpuinfo", 'utf-8').split(/[\n\r]/);
  lines.forEach( function (line, index) {
    split = line.split(" ");
    if (split[0].search("Hardware") == 0) {
      this.info.hardware = split[1];
    }
    if (split[0].search("Revision") == 0) {
      this.info.revision = split[1];
    }
    if (split[0].search("Serial") == 0) {
      this.info.serial = split[1];
    }
  }.bind(this));
  //console.log("Hardware = " + this.info.hardware);
  //console.log("Serial = " + this.info.serial);

  if (this.possibleHardware.indexOf(this.info.hardware) < 0) {
    throw new Error("Unsupported hardware (" + this.info.hardware + ")");
  }
  /*
  else {
    console.log("Hardware " + this.info.hardware + " looks OK");
  }
  */

  rlen = this.info.revision.length;
  if (rlen == 0) {
    throw new Error("Unsupported revision (" + this.info.revision + ")");
  }

  //console.log("Revision: " + this.info.revision);
  if ((rlen>=6) && ((parseInt(this.info.revision[rlen-6],16) & 8) == 8 )) {
    //console.log("Revision scheme B");

    //console.log("switch: " + this.info.revision[rlen-2]);
    switch(this.info.revision[rlen-2]) {
      case '0':
        this.info.type = "Model A";
        this.info.p1_revision = 2;
        break;
      case '1':
        this.info.type = "Model B";
        this.info.p1_revision = 2;
        break;
      case '2':
        this.info.type = "Model A+";
        this.info.p1_revision = 3;
        break;
      case '3':
        this.info.type = "Model B+";
        this.info.p1_revision = 3;
        break;
      case '4':
        this.info.type = "Pi 2 Model B";
        this.info.p1_revision = 3;
        break;
      case '5':
        this.info.type = "Alpha";
        this.info.p1_revision = 3;
        break;
      case '6':
        this.info.type = "Compute";
        this.info.p1_revision = 0;
        break;
      case '8':
        this.info.type = "Pi 3 Model B";
        this.info.p1_revision = 3;
        break;
      case '9':
        this.info.type = "Zero";
        this.info.p1_revision = 3;
        break;
      case 'c':
        this.info.type = "Zero W";
        this.info.p1_revision = 3;
        break;
      default:
        this.info.type = "Unknown";
        this.info.p1_revision = 3;
        break;
    }
    //console.log("type: " + this.info.type);

    switch (this.info.revision[rlen-4]) {
      case '0':
       this. info.processor = "BCM2835";
        break;
      case '1':
        this.info.processor = "BCM2836";
        break;
      case '2':
        this.info.processor = "BCM2837";
        break;
      default :
        this.info.processor = "Unknown";
        break;
    }
    //console.log("processor: " + this.info.processor);

    switch (this.info.revision[rlen-5]) {
      case '0':
        this.info.manufacturer = "Sony";
        break;
      case '1':
        this.info.manufacturer = "Egoman";
        break;
      case '2':
        this.info.manufacturer = "Embest";
        break;
      case '4':
        this.info.manufacturer = "Embest";
        break;
      default :
        this.info.manufacturer = "Unknown";
        break;
    }
    //console.log("manufacturer: " + this.info.manufacturer);

    switch (parseInt(this.info.revision[rlen-6],16) & 7) {
      case 0:
        this.info.ram = "256M";
        break;
      case 1:
        this.info.ram = "512M";
        break;
      case 2:
        this.info.ram = "1024M";
        break;
      default:
        this.info.ram = "Unknown";
        break;
    }
    //console.log("ram: " + this.info.ram);
  }
  else {
    console.log("Revision scheme A");
    this.info.ram = "Unknown";
    this.info.manufacturer = "Unknown";
    this.info.processor = "Unknown";
    this.info.type = "Unknown";

    // get last four characters (ignore preceeding 1000 for overvolt)
    var rev;
    if (rlen > 4) {
      rev = this.info.revision.slice(rlen-4);
    } else {
      rev = this.info.revision;
    }
    if (rev == "0002" || rev == "0003") {
      this.info.type = "Model B";
      this.info.p1_revision = 1;
      this.info.ram = "256M";
      this.info.processor = "BCM2835";
    }
    else if (rev == "0004") {
      this.info.type = "Model B";
      this.info.p1_revision = 2;
      this.info.ram = "256M";
      this.info.manufacturer = "Sony";
      this.info.processor = "BCM2835";
    }
    else if (rev == "0005") {
      this.info.type = "Model B";
      this.info.p1_revision = 2;
      this.info.ram = "256M";
      this.info.manufacturer = "Qisda";
      this.info.processor = "BCM2835";
    }
    else if (rev == "0006") {
      this.info.type = "Model B";
      this.info.p1_revision = 2;
      this.info.ram = "256M";
      this.info.manufacturer = "Egoman";
      this.info.processor = "BCM2835";
    }
    else if (rev == "0007") {
      this.info.type = "Model A";
      this.info.p1_revision = 2;
      this.info.ram = "256M";
      this.info.manufacturer = "Egoman";
      this.info.processor = "BCM2835";
    }
    else if (rev == "0008") {
      this.info.type = "Model A";
      this.info.p1_revision = 2;
      this.info.ram = "256M";
      this.info.manufacturer = "Sony";
      this.info.processor = "BCM2835";
    }
    else if (rev == "0009") {
      this.info.type = "Model A";
      this.info.p1_revision = 2;
      this.info.ram = "256M";
      this.info.manufacturer = "Qisda";
      this.info.processor = "BCM2835";
    }
    else if (rev == "000d") {
      this.info.type = "Model B";
      this.info.p1_revision = 2;
      this.info.ram = "512M";
      this.info.manufacturer = "Egoman";
      this.info.processor = "BCM2835";
    }
    else if (rev == "000e") {
      this.info.type = "Model B";
      this.info.p1_revision = 2;
      this.info.ram = "512M";
      this.info.manufacturer = "Sony";
      this.info.processor = "BCM2835";
    }
    else if (rev == "000f") {
      this.info.type = "Model B";
      this.info.p1_revision = 2;
      this.info.ram = "512M";
      this.info.manufacturer = "Qisda";
      this.info.processor = "BCM2835";
    }
    else if (rev == "0011" || rev == "0014") {
      this.info.type = "Compute Module";
      this.info.p1_revision = 0;
      this.info.ram = "512M";
      this.info.processor = "BCM2835";
    }
    else if (rev == "0012") {
      this.info.type = "Model A+";
      this.info.p1_revision = 3;
      this.info.ram = "256M";
      this.info.processor = "BCM2835";
    }
    else if (rev == "0010" || rev == "0013") {
      this.info.type = "Model B+";
      this.info.p1_revision = 3;
      this.info.ram = "512M";
      this.info.processor = "BCM2835";
    }
    else {
      // don't know - assume revision 3 p1 connector
      this.info.p1_revision = 3;
    }


  }


}
module.exports = cpuinfo;

cpuinfo.prototype.showInfo = function () {
  console.log("Hardware = " + this.info.hardware);
  console.log("Serial = " + this.info.serial);
  console.log("Revision: " + this.info.revision);
  console.log("Type: " + this.info.type);
  console.log("Processor: " + this.info.processor);
  console.log("RAM: " + this.info.ram);
  console.log("Manufacturer: " + this.info.manufacturer);
};

cpuinfo.prototype.getInfo = function () {
  return this.info;
};

cpuinfo.prototype.getHardware = function () {
  return this.info.hardware;
};

cpuinfo.prototype.getRevision = function () {
  return this.info.revision;
};

cpuinfo.prototype.getSerial = function () {
  return this.info.serial;
};

/* ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab: */
