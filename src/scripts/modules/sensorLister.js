import fs from "fs";

// Return a list of sensor devices
export default function sensors() {
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


/* ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab: */
