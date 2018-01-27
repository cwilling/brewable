#!/usr/bin/env node

const os = require('os');
const path = require('path');
const readline = require('readline');
const fs = require('fs');

/*
  1. Obtain names of all files in current directory.
  2. For each file:
      - if first line type != header, leave file alone
        (& deal with next file)
      - if second line type != status, leave file alone
        (& deal with next file)
      - for second & following lines,
          if typeof sensor == Object, leave file alone
          else
          foreach sensor, if typeof sensor == number,
            convert it to object e.g.
            was: '28-87321': 23.4
            now: '28-87321': { 'temp':23.4 }
  3. Any processed file,
      name as "oldname.new"
      rename "oldname" as oldname.orig
      rename "oldname.new" as "oldname"
  4. Move *.orig somewhere else
*/

var BREWDIR = path.join(os.homedir(), "brewable");
var targetDir = path.join(BREWDIR, "history");
var oldDir = path.join(BREWDIR, "oldFiles");
var status;

/* Accept non-default target directory to process */
//console.log(process.argv);
if (process.argv.length > 2) {
  targetDir = path.join(BREWDIR, process.argv[2]);
}

try {
  status = fs.statSync(targetDir);
  if (! status.isDirectory()) {
    console.log("Target " + targetDir + " isn't a directory. Exiting now ...");
    process.exit();
  }
}
catch (err) {
  if (err.code === 'ENOENT') {
    console.log("No such directory as " + targetDir);
  } else {
    console.log(err);
  }
  process.exit();
}

/* Directory for original version of processed files */
try {
  fs.mkdirSync(oldDir);
}
catch (err) {
  if (err.code === 'EEXIST') {
    // Don't care if it already exists
  } else {
    console.log(err);
    process.exit();
  }
}

var files = fs.readdirSync(targetDir, 'utf8');
for (var i=0;i<files.length;i++) {
  var item = files[i];
  var lineNum = 0;

  var matched = item.match(/\.txt$/);
  if (matched) {
    console.log("\nTrying file: " + item);

    var data = fs.readFileSync(path.join(targetDir, item), 'utf8').toString().split(/\r?\n/);

    var hdata;  // header line data
    var sdata;  // status line data
    var dirty;  // Whether to wite new (converted) file
    //console.log("data.length = " + data.length);
    for (var j=0;j<data.length-1;j++) {
      dirty = false;
      // First line of file
      // Must have a "type" field with value "header"
      if (j == 0) {
        //console.log("First line of " + item + ": " + data[j]);
        try {
          hdata = JSON.parse(data[j]);
          if (hdata.hasOwnProperty('type')) {
            //console.log("Type = " + hdata.type);
            if (hdata.type != "header") {
              console.log(item + " is not a valid brewable history file: wrong type (" + hdata.type + ")");
              break;
            }
          } else {
            console.log(item + " is not a valid brewable history file: no \"type\" field");
            break;
          }
        }
        catch (err) {
          console.log(item + " JSON error: " + err);
          break;
        }
      } else {
        try {
          sdata = JSON.parse(data[j]);
          //console.log("sensors = " + sdata.sensors);
          sdata.sensors.forEach( function (sensor, index) {
            //console.log("typeof sensor " + sensor + " is " + typeof(sdata[sensor]));
            //console.log("sensor " + sensor + " = " + sdata[sensor]);
            if (typeof(sdata[sensor]) == 'number') {
              // Convert this field to new format
              sdata[sensor] = {"temp":sdata[sensor]};
              data[j] = JSON.stringify(sdata);
              dirty = true;
            } else {
              console.log("Nothing to do - already have correct format");
            }
          });
        }
        catch (err) {
          console.log(item + " line=" + j + " JSON error: " + err);
          break;
        }
        if (! dirty) break;
        //console.log("line " + j + " of " + item + ": " + data[j]);
      }
    }
    if (dirty) {
      // Write array with converted sensor fields to new file.
      //var newFileName = item + ".new";
      var newFileName = path.join(targetDir, (item + ".new"));
      try {
        fs.unlinkSync(newFileName);
      }
      catch (err) {}

      console.log("Writing new file: " + newFileName);
      for (j=0;j<data.length-1;j++) {
        fs.appendFileSync(newFileName, data[j]+"\n");
      }

      console.log("Renaming file " + path.join(targetDir,item) + " to: " + path.join(oldDir,(item + ".orig")));
      fs.renameSync(path.join(targetDir, item), path.join(oldDir, (item + ".orig")));
      console.log("Renaming file " + newFileName + " to: " + path.join(targetDir, item));
      fs.renameSync(newFileName, path.join(targetDir, item));
    }

  }

};


/*
ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab:
*/

