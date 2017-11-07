// Import styles (automatically injected into <head>).
import "../../styles/brewable.css";

import { select, selectAll, event, mouse } from "d3-selection";
import { max, min } from "d3-array";
import { scaleLinear, scaleTime } from "d3-scale";
import { drag } from "d3-drag";
import { zoom } from "d3-zoom";
import { axisBottom, axisLeft } from "d3-axis";
import { line } from "d3-shape";
//import { timeFormat } from "d3-time-format";

//window.onload = function () {
//  console.log("Window.onload()");
//};

var _TESTING_ = false;
var navigationMap = {};
var global_x = 0;

var availableSensors = [];
var availableRelays  = [];
var iSpindelDevices = [];
var iSpindelWaitTimes = {};

var profileData = [];
var profileDisplayData = [];        // "processed" data for display
var profileLinearScaleY = [];
var profileLinearScaleX = [];
var temperatureStrokeWidth = 2;
var gravityStrokeWidth = 3;
var temperatureColours = ["blue", "green", "red", "fuchsia"];
//var gravityColours = ["blue", "green", "red", "fuchsia"];
var gravityColours = ["navy", "teal", "maroon", "purple"];
var profileLineColours = ["green", "red", "orange", "blue"];
var pfCtrlKey = false;
var pfCurrentDot = {"id":"none"};
var profileOwner;

/* Save JobHistory data here */
var historyData = {};
var runningData = {};
var unStartedJobs = [];

/*
  Running, stopped, suspended etc.
  Each jobStatus entry is a jobLongName:{item0:val0, item1:val1, ...}
*/
var jobStatus = {};

var msgobj = {};

function smallDevice () {
  return window.innerWidth<1000?true:false;
}

/* Convert text from profile editor into time units.
*/
function resolveGraphTimeValue(rawval) {
  var pieces = rawval.split(".");
  var result;
  if (pieces.length > 1 ) {
    //console.log("resolve: " + pieces[0] + " and " + pieces[1]);
    result = 60 * parseInt(pieces[0])
    + parseInt(pieces[1]/60)
    + parseInt(pieces[1]%60);
  } else {
    //console.log("resolve: " + pieces[0]);
    result = 60 * parseInt(pieces[0]);
  }
  //console.log("resolveGraphTimeValue(): " + result);
  return result;
}
/* Convert time units (seconds) back to text format.
*/
function invertGraphTimeValue(val) {
  var minutes = Math.round(val/60);
  var hours = parseInt(minutes/60);
  minutes = minutes%60;
  if (hours == 0 && minutes == 0 ) { minutes = 1; }
  //console.log("HRS: " + hours + ", MINS: " + minutes);
  //console.log("result: " + hours + "." + minutes);
  return hours + "." + minutes;
}

/*
var domReady = function(callback) {
  document.readyState === "interactive" ||
  document.readyState === "complete" ? callback() : document.addEventListener("DOMContentLoaded", callback);
};
*/


/* Return top left corner of enclosing element
   From: http://javascript.info/tutorial/coordinates
*/
function getOffsetRect(elem) {
  // (1)
  var box = elem.getBoundingClientRect();

  var body = document.body;
  var docElem = document.documentElement;

  // (2)
  var scrollTop = window.pageYOffset || docElem.scrollTop || body.scrollTop;
  var scrollLeft = window.pageXOffset || docElem.scrollLeft || body.scrollLeft;

  // (3)
  var clientTop = docElem.clientTop || body.clientTop || 0;
  var clientLeft = docElem.clientLeft || body.clientLeft || 0;

  // (4)
  var top  = box.top +  scrollTop - clientTop;
  var left = box.left + scrollLeft - clientLeft;

  return { top: Math.round(top), left: Math.round(left) };
}

// https://github.com/uxitten/polyfill/blob/master/string.polyfill.js
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padStart
if (!String.prototype.padStart) {
  String.prototype.padStart = function padStart(targetLength,padString) {
    targetLength = targetLength>>0; //floor if number or convert non-number to 0;
    padString = String(padString || ' ');
    if (this.length > targetLength) {
      return String(this);
    }
    else {
      targetLength = targetLength-this.length;
      if (targetLength > padString.length) {
        padString += padString.repeat(targetLength/padString.length); //append to original to ensure we are longer than needed
      }
      return padString.slice(0,targetLength) + String(this);
    }
  };
}

/**
* From https://stackoverflow.com/questions/8211744/convert-time-interval-given-in-seconds-into-more-human-readable-form
*
* Translates seconds into human readable format of seconds, minutes, hours, days, and years
* 
* @param  {number} seconds The number of seconds to be processed
* @return {string}         The phrase describing the the amount of time
*/
function forHumans ( seconds ) {
  var levels = [
    [Math.floor(seconds / 31536000), 'Y'], /* years */
    [Math.floor((seconds % 31536000) / 86400), 'd'], /*days */
    [Math.floor(((seconds % 31536000) % 86400) / 3600), 'h'], /*hours*/
    [Math.floor((((seconds % 31536000) % 86400) % 3600) / 60), 'm'], /*mins*/
    [(((seconds % 31536000) % 86400) % 3600) % 60, 's'], /* seconds */
  ];
  var returntext = '';

  for (var i = 0, max = levels.length; i < max; i++) {
    if ( levels[i][0] === 0 ) continue;
    returntext += ' ' + levels[i][0] + ' ' + (levels[i][0] === 1 ? levels[i][1].substr(0, levels[i][1].length-1): levels[i][1]);
  }
  return returntext.trim();
} 

var searchDeviceListByChipId = function (Id) {
  var duplicates = 0;
  var i, duplicate, result;
  do {
    for (i=0;i<iSpindelDevices.length;i++) {
      if (iSpindelDevices[i].chipId == Id) {
        if (result) {
          duplicate = i;
          duplicates += 1;
        } else {
          result = iSpindelDevices[i];
        }
      }
    }
    if (duplicates > 0) {
      console.log("Removing duplicate device: " + iSpindelDevices[duplicate].raw.chipId);
      iSpindelDevices.splice(duplicate, 1);
      duplicates -= 1;
    }
  } while (duplicates > 0);

  return result;
};


class Ispindel {
  constructor (report, parent) {
    this.name = report.sensorId;
    this.chipId = report.chipId;
    this.tilt = report.tilt;
    this.temp = report.temperature;
    this.grav = report.grav;
    //this.plato = report.plato;
    this.batt = report.batt;
    this.stamp = report.stamp;
    this.parent = parent;
    this.elementName = 'sensor_update_' + this.name;

    // How long to wait (ms) after last report before removing this device
    // 61 * 60 * 1000 = 3660000 (61 minutes)
    var defaultWaitTime = 60000;     // 60000 = 1min
    //if (iSpindelWaitTimes[report.sensorId]) {
    console.log("iSpindelWaitTimes has keys: " + JSON.stringify(Object.keys(iSpindelWaitTimes)));
    console.log("iSpindelWaitTimes has " + JSON.stringify(iSpindelWaitTimes));
    console.log("report.sensorId = " + report.sensorId);
    console.log("waitTime should be = " + iSpindelWaitTimes[report.sensorId]);
    this.waitTime = 1000 * iSpindelWaitTimes[report.sensorId] || defaultWaitTime;

    var isp_temp, isp_grav;
    /*
    var isp_batt, isp_stamp, isp_tilt;

    isp_tilt = document.createElement("DIV");
    isp_tilt.id = this.elementName + "_tilt";
    isp_tilt.className = "isp_entry";
    this.parent.appendChild(isp_tilt);
    */

    isp_temp = document.createElement("DIV");
    isp_temp.id = this.elementName + "_temp";
    isp_temp.className = "isp_entry";
    this.parent.appendChild(isp_temp);

    isp_grav = document.createElement("DIV");
    isp_grav.id = this.elementName + "_grav";
    isp_grav.className = "isp_entry";
    this.parent.appendChild(isp_grav);

    this.ispindelUpdateInterval = setInterval(this.checkIspindelTimeout, 1000, this);
    console.log("A new Ispindel device for " + this.parent.id);
  }

  set_contents (state, tempScale) {
    //console.log("set_contents() state: " + JSON.stringify(state));

    this.temp = state.temperature;
    this.grav = state.grav;
    this.tilt = state.tilt;
    this.batt = state.batt;
    this.stamp = state.stamp;

    //console.log("set_contents() elementName: " + this.elementName);
    var have_isp_temp = document.getElementById(this.elementName + "_temp");
    if (! have_isp_temp) {
      var isp_temp, isp_grav;

      isp_temp = document.createElement("DIV");
      isp_temp.id = this.elementName + "_temp";
      isp_temp.className = "isp_entry";
      document.getElementById(this.elementName).appendChild(isp_temp);

      isp_grav = document.createElement("DIV");
      isp_grav.id = this.elementName + "_grav";
      isp_grav.className = "isp_entry";
      document.getElementById(this.elementName).appendChild(isp_grav);
    }
    try {
      if (tempScale == 'F') {
        document.getElementById(this.elementName + "_temp").textContent = ((state.temperature * 9 / 5 ) + 32).toFixed(2);
      } else {
        document.getElementById(this.elementName + "_temp").textContent = (state.temperature).toFixed(2);
      }
      document.getElementById(this.elementName + "_grav").textContent = (state.grav).toFixed(2);
    }
    catch (err) {
      console.log("set_contents() caught " + err);
    }

  }

  setNewWaitTime(val) {
    console.log("Setting new timeout (" + val + ") for " + this.chipId);

    var newWaitTime = parseInt(val);
    if (newWaitTime < 10) return;
    this.waitTime = 1000 * newWaitTime;
  }

  checkIspindelTimeout(ispindel) {
    //console.log("Checking iSpindel timeout " + ispindel.waitTime);

    var elapsed = new Date() - new Date(ispindel.stamp);
    if (elapsed > ispindel.waitTime ) {
      clearInterval(ispindel.ispindelUpdateInterval);
      console.log("Toooo long since last report");
      ispindel.removeOverlay();
      var x = document.getElementById(ispindel.elementName);
      if (x) x.parentNode.removeChild(x);

      var itemToRemove = -1;
      iSpindelDevices.forEach( function (item, index) {
        //if (item.name == ispindel.name) {
        if (item.chipId == ispindel.chipId) {
          itemToRemove = index;
        }
      });
      console.log("Removing item " + itemToRemove + " from " + JSON.stringify(iSpindelDevices));
      if (itemToRemove > -1 ) iSpindelDevices.splice(itemToRemove,1);
      console.log("Changed iSpindelDevices: " + JSON.stringify(iSpindelDevices));
      return;
    }
  }

  showOverlay () {
    var el = document.getElementById(this.elementName);

    // Size of enclosing DIV (css isp_sensor_update)
    var els = {"w":128, "h":64};
    // Size of overlay (css .isp_sol)
    var ols = {"w":168, "h":152};

    this.overlay = document.createElement("DIV");
    this.overlay.id = this.elementName + "_overlay";
    this.overlay.className = "isp_sol unselectable";
    this.overlay.style.position = "fixed";
    this.overlay.style.top = getOffsetRect(el).top - (ols.h - els.h)/2 + 'px';
    this.overlay.style.left = getOffsetRect(el).left - (ols.w - els.w)/2 + 'px';
    document.body.appendChild(this.overlay);

    // Overlay contents
    var olTitle = document.createElement("DIV");
    olTitle.id = this.elementName + "_overlay_title";
    olTitle.className = "isp_sol_title unselectable";
    //olTitle.textContent = this.name;
    olTitle.textContent = this.chipId;
    this.overlay.appendChild(olTitle);

    var olTilt = document.createElement("DIV");
    olTilt.id = this.elementName + "_overlay_tilt";
    olTilt.className = "isp_sol_detail unselectable";
    var olTiltKey = document.createElement("DIV");
    olTiltKey.id = this.elementName + "_overlay_tilt_key";
    olTiltKey.className = "isp_sol_key unselectable";
    olTiltKey.textContent = "Tilt:";
    var olTiltVal = document.createElement("DIV");
    olTiltVal.id = this.elementName + "_overlay_tilt_val";
    olTiltVal.className = "isp_sol_val unselectable";
    olTiltVal.textContent = this.tilt + "\u00B0";
    olTilt.appendChild(olTiltKey);
    olTilt.appendChild(olTiltVal);
    this.overlay.appendChild(olTilt);

    var olTemp = document.createElement("DIV");
    olTemp.id = this.elementName + "_overlay_temp";
    olTemp.className = "isp_sol_detail unselectable";
    var olTempKey = document.createElement("DIV");
    olTempKey.id = this.elementName + "_overlay_temp_key";
    olTempKey.className = "isp_sol_key unselectable";
    olTempKey.textContent = "Temp:";
    var olTempVal = document.createElement("DIV");
    olTempVal.id = this.elementName + "_overlay_temp_val";
    olTempVal.className = "isp_sol_val unselectable";
    olTempVal.textContent = this.temp + "\u00B0";
    olTemp.appendChild(olTempKey);
    olTemp.appendChild(olTempVal);
    this.overlay.appendChild(olTemp);

    var olGrav = document.createElement("DIV");
    olGrav.id = this.elementName + "_overlay_grav";
    olGrav.className = "isp_sol_detail unselectable";
    var olGravKey = document.createElement("DIV");
    olGravKey.id = this.elementName + "_overlay_grav_key";
    olGravKey.className = "isp_sol_key unselectable";
    olGravKey.textContent = "Grav:";
    var olGravVal = document.createElement("DIV");
    olGravVal.id = this.elementName + "_overlay_grav_val";
    olGravVal.className = "isp_sol_val unselectable";
    olGravVal.textContent = this.grav.toFixed(2);
    olGrav.appendChild(olGravKey);
    olGrav.appendChild(olGravVal);
    this.overlay.appendChild(olGrav);

    /*
    var olPlato = document.createElement("DIV");
    olPlato.id = this.elementName + "_overlay_plato";
    olPlato.className = "isp_sol_detail unselectable";
    var olPlatoKey = document.createElement("DIV");
    olPlatoKey.id = this.elementName + "_overlay_plato_key";
    olPlatoKey.className = "isp_sol_key unselectable";
    olPlatoKey.textContent = "Plato:";
    var olPlatoVal = document.createElement("DIV");
    olPlatoVal.id = this.elementName + "_overlay_plato_val";
    olPlatoVal.className = "isp_sol_val unselectable";
    olPlatoVal.textContent = this.plato.toFixed(2);
    olPlato.appendChild(olPlatoKey);
    olPlato.appendChild(olPlatoVal);
    this.overlay.appendChild(olPlato);
    */

    var olBatt = document.createElement("DIV");
    olBatt.id = this.elementName + "_overlay_batt";
    olBatt.className = "isp_sol_detail unselectable";
    var olBattKey = document.createElement("DIV");
    olBattKey.id = this.elementName + "_overlay_batt_key";
    olBattKey.className = "isp_sol_key unselectable";
    olBattKey.textContent = "Batt:";
    var olBattVal = document.createElement("DIV");
    olBattVal.id = this.elementName + "_overlay_batt_val";
    olBattVal.className = "isp_sol_val unselectable";
    olBattVal.textContent = this.batt + "v";
    olBatt.appendChild(olBattKey);
    olBatt.appendChild(olBattVal);
    this.overlay.appendChild(olBatt);

    var olLast = document.createElement("DIV");
    olLast.id = this.elementName + "_overlay_last";
    olLast.className = "isp_sol_detail unselectable";
    var olLastKey = document.createElement("DIV");
    olLastKey.id = this.elementName + "_overlay_last_key";
    olLastKey.className = "isp_sol_key unselectable";
    olLastKey.textContent = "Last:";
    var olLastVal = document.createElement("DIV");
    olLastVal.id = this.elementName + "_overlay_last_val";
    olLastVal.className = "isp_sol_val unselectable";
    olLastVal.textContent = forHumans(parseInt((new Date() - new Date(this.stamp))/1000));
    olLast.appendChild(olLastKey);
    olLast.appendChild(olLastVal);
    this.overlay.appendChild(olLast);

    this.overlayUpdateInterval = setInterval(this.checkOverlayTimeout, 1000, this);

    this.overlay.addEventListener("mouseout", function () {
      this.removeOverlay();
    }.bind(this));

    this.overlay.addEventListener("dblclick", function (e) {
      console.log("Pressed button " + e.button + " at " + this.chipId);
      this.configureIspindel(this);
    }.bind(this));

  }

  configureIspindel (ispindel) {
    console.log("configureIspindel() " + ispindel.name);
    ispindel.removeOverlay();
    location.href = '#content_4';
  }

  checkOverlayTimeout (ispindel) {
    //console.log("checkOverlayTimeout() " + ispindel.stamp);

    var elapsed = new Date() - new Date(ispindel.stamp);
    if (elapsed > ispindel.waitTime ) {
      console.log("Too long since last report");
      ispindel.removeOverlay();
      var x = document.getElementById(ispindel.elementName);
      if (x) x.parentNode.removeChild(x);
      return;
    }

    var olLastVal = document.getElementById(ispindel.elementName + "_overlay_last_val");
    if (olLastVal) {
      olLastVal.textContent = forHumans(parseInt((new Date() - new Date(ispindel.stamp))/1000));
    }
  }
  removeOverlay () {
    var x = document.getElementById(this.elementName + "_overlay");
    if (x) document.body.removeChild(x);
    if (this.overlayUpdateInterval) clearInterval(this.overlayUpdateInterval);
  }
}

// main()
//domReady( function(){
//$(document).ready( function()
window.onload = function () {

  var profilesLoadedEvent = new Event('profilesLoadedEvent');
  var foundNewSensor = new Event('foundNewSensor');

  // Layout skeleton
  var main_content = document.createElement('DIV');
  main_content.id = 'main_content';

  var content_1 = document.createElement('DIV');
  content_1.id = 'content_1';
  content_1.className = 'content';
  main_content.appendChild(content_1);
  var statusTitle = document.createElement('DIV');
  statusTitle.id = 'statusTitle';
  statusTitle.className = 'page_title unselectable';
  statusTitle.textContent = 'Current Status';
  content_1.appendChild(statusTitle);

  var live_updateHolderContainer = document.createElement('DIV');
  live_updateHolderContainer.id = 'live_updateHolderContainer';
  content_1.appendChild(live_updateHolderContainer);
  var live_updateHolder = document.createElement('DIV');
  live_updateHolder.id = 'live_updateHolder';
  live_updateHolderContainer.appendChild(live_updateHolder);

  var sensor_updateHolder = document.createElement('DIV');
  sensor_updateHolder.id = 'sensor_updateHolder';
  var relay_updateHolder = document.createElement('DIV');
  relay_updateHolder.id = 'relay_updateHolder';
  live_updateHolder.appendChild(sensor_updateHolder);
  live_updateHolder.appendChild(relay_updateHolder);

  var no_running_jobs = document.createElement('DIV');
  no_running_jobs.id = 'no_running_jobs';
  no_running_jobs.innerHTML = "No &nbsp<a href=#content_2>jobs</a>&nbsp are currently running";
  content_1.appendChild(no_running_jobs);

  var running_jobsHolder = document.createElement('DIV');
  running_jobsHolder.id = 'running_jobsHolder';
  content_1.appendChild(running_jobsHolder);



  var content_2 = document.createElement('DIV');
  content_2.id = 'content_2';
  content_2.className = 'content';
  main_content.appendChild(content_2);
  var jobTemplatesTitle = document.createElement('DIV');
  jobTemplatesTitle.id = 'jobTemplatesTitle';
  jobTemplatesTitle.className = 'page_title unselectable';
  jobTemplatesTitle.textContent = 'Job Templates';

  var jobTemplatesHolder = document.createElement('DIV');
  jobTemplatesHolder.id = 'jobTemplatesHolder'; var jobTemplatesListHolder = document.createElement('DIV');
  jobTemplatesListHolder.id = 'jobTemplatesListHolder';
  jobTemplatesHolder.appendChild(jobTemplatesListHolder);

  var jobComposer = document.createElement('DIV');
  jobComposer.id = 'jobComposer';
  var jobComposerTitle = document.createElement('DIV');
  jobComposerTitle.id = 'jobComposerTitle';
  jobComposerTitle.className = 'section_title unselectable';
  jobComposerTitle.textContent = 'Job Composer';
  jobComposer.appendChild(jobComposerTitle);

  var jobItemsHolderContainer = document.createElement('DIV');
  jobItemsHolderContainer.id = 'jobItemsHolderContainer';

  var jobItemsHolder = document.createElement('DIV');
  jobItemsHolder.id = 'jobItemsHolder';
  // Item 1: Save button
  var jobSaveButton = document.createElement('DIV');
  jobSaveButton.id = 'jobSaveButton';
  jobSaveButton.className = 'unselectable';
  jobSaveButton.textContent = 'Save';
  jobItemsHolder.appendChild(jobSaveButton);

  // Item 2: Job name
  var jobNameHolder = document.createElement('DIV');
  jobNameHolder.id = 'jobNameHolder';
  jobNameHolder.className = 'unselectable';
  jobNameHolder.text = 'jobNameHolder';
  var jobNameLabel = document.createElement('LABEL');
  jobNameLabel.for = 'jobName';
  jobNameLabel.textContent = 'Job Name';
  var jobName = document.createElement('INPUT');
  jobName.id = 'jobName';
  jobName.type = 'text';
  jobNameHolder.appendChild(jobNameLabel);
  jobNameHolder.appendChild(jobName);
  jobItemsHolder.appendChild(jobNameHolder);

  // Item 3: Preheat
  var jobPreHeat = document.createElement('DIV');
  jobPreHeat.id = 'jobPreHeat';

  var selectPreHeat = document.createElement("INPUT");
  selectPreHeat.type = "checkbox";
  selectPreHeat.id = 'selectPreHeat';
  selectPreHeat.name = 'selectPreHeat';

  var selectPreHeatLabel = document.createElement("LABEL");
  selectPreHeatLabel.className = 'unselectable';
  selectPreHeatLabel.setAttribute("for", "selectPreHeat");
  selectPreHeatLabel.textContent = 'Pre Heat/Cool';

  jobPreHeat.appendChild(selectPreHeat);
  jobPreHeat.appendChild(selectPreHeatLabel);
  jobItemsHolder.appendChild(jobPreHeat);

  // Item 4: Profile?
  var jobProfileHolder = document.createElement('DIV');
  jobProfileHolder.id = 'jobProfileHolder';
  jobProfileHolder.className = 'unselectable';
  var jobProfileHolderLabel = document.createElement("LABEL");
  jobProfileHolderLabel.id = 'jobProfileHolderLabel';
  jobProfileHolderLabel.innerHTML = '<center>Profile</center>';
  /* setAttribute wants value to be a string */
  jobProfileHolder.setAttribute('pdata', JSON.stringify(defaultJobProfileData()));
  //jobProfileHolder.onclick = function (e) {
  jobProfileHolder.onclick = function () {
    console.log("Edit the profile");
    location.href = '#content_3';

    /* updateProfileGraph() wants data to be an object */
    updateProfileGraph({
      data:JSON.parse(document.getElementById("jobProfileHolder").getAttribute('pdata')),
      owner:'jobProfileHolder'
    });
  };

  jobProfileHolder.appendChild(jobProfileHolderLabel);
  jobItemsHolder.appendChild(jobProfileHolder);

  // Item 5: Sensors
  var jobSensorsHolder = document.createElement('DIV');
  jobSensorsHolder.id = 'jobSensorsHolder';
  jobSensorsHolder.className = 'jobDevicesHolder';
  jobSensorsHolder.addEventListener('foundNewSensor', function () {
    createSensorSelector();
  });
  jobItemsHolder.appendChild(jobSensorsHolder);

  // Item 6: Relays
  var jobRelaysHolder = document.createElement('DIV');
  jobRelaysHolder.id = 'jobRelaysHolder';
  jobRelaysHolder.className = 'jobDevicesHolder';
  jobItemsHolder.appendChild(jobRelaysHolder);

  // Item 7: Dismiss
  var dismissJobComposerButton = document.createElement('DIV');
  dismissJobComposerButton.id = 'dismissJobComposerButton';
  dismissJobComposerButton.className = 'unselectable';
  dismissJobComposerButton.textContent = 'Dismiss';
  jobItemsHolder.appendChild(dismissJobComposerButton);

  jobItemsHolderContainer.appendChild(jobItemsHolder);
  jobComposer.appendChild(jobItemsHolderContainer);

  var jobsHistory = document.createElement('DIV');
  jobsHistory.id = 'jobsHistory';
  var jobsHistoryTitle = document.createElement('DIV');
  jobsHistoryTitle.id = 'jobsHistoryTitle';
  jobsHistoryTitle.className = 'section_title unselectable';
  jobsHistoryTitle.textContent = 'Job History';
  var historyList = document.createElement('DIV');
  historyList.id = 'historyList';
  historyList.className = 'historyList';
  var historyListJobsHolder = document.createElement('DIV');
  historyListJobsHolder.id = 'historyListJobsHolder';
  historyListJobsHolder.className = 'historyListJobsHolder';
  historyList.appendChild(historyListJobsHolder);
  jobsHistory.appendChild(jobsHistoryTitle);
  jobsHistory.appendChild(historyList);

  content_2.appendChild(jobTemplatesTitle);
  content_2.appendChild(jobTemplatesHolder);
  content_2.appendChild(jobComposer);
  content_2.appendChild(jobsHistory);

  var content_3 = document.createElement('DIV');
  content_3.id = 'content_3';
  content_3.className = 'content';
  main_content.appendChild(content_3);
  var profilesTitle = document.createElement('DIV');
  profilesTitle.id = 'profilesTitle';
  profilesTitle.className = 'page_title unselectable';
  profilesTitle.textContent = 'Profile Editor';

  var profilesGraphHolder = document.createElement('DIV');
  profilesGraphHolder.id = 'profilesGraphHolder';

  content_3.appendChild(profilesTitle);
  content_3.appendChild(profilesGraphHolder);

  var content_4 = document.createElement('DIV');
  content_4.id = 'content_4';
  content_4.className = 'content';
  main_content.appendChild(content_4);
  var configTitle = document.createElement('DIV');
  configTitle.id = 'configTitle';
  configTitle.className = 'page_title unselectable';
  configTitle.textContent = 'Configuration';

  var configHolder = document.createElement('DIV');
  configHolder.id = 'configHolder';

  var testHolder = document.createElement('DIV');
  testHolder.id = 'testHolder';
  content_4.appendChild(configTitle);
  content_4.appendChild(configHolder);
  content_4.appendChild(testHolder);


  document.body.appendChild(main_content);

  /* popups */
  var profileTooltip = select("body")
    .append("div")
    .attr("id", "dotTooltip")
    .attr("class", "tooltip")
    .style("opacity", 0)
    .style("left",  "0px")
    .style("top", "0px");

  /*******************  Swipe between pages  ***************************/

  // Navigate by swipe
  var swipeDeltaMin = 50;
  var pageSwipeZone = document.getElementsByClassName('page_title');
  //console.log('number of page_title elements = ' + pageSwipeZone.length);
  for (var el=0;el<pageSwipeZone.length;el++ ) {
    //console.log(pageSwipeZone[el].id + ' is Title element ' + el);

    // Set up a dictionary of last & next targets for each page
    var nextValue = el + 2;
    if (nextValue > pageSwipeZone.length ) {
      nextValue = 1;
    }
    var lastValue = el;
    if (lastValue < 1 ) {
      lastValue = pageSwipeZone.length;
    }
    var navMapEntry = {'last':'content_' + lastValue, 'next':'content_' + nextValue};
    navigationMap[pageSwipeZone[el].id] = navMapEntry;

    // Event handlers for mouse down/up events and touch start/end events
    pageSwipeZone[el].onmousedown = function(e) {
      global_x = e.pageX;
      //console.log("down at x = " + e.pageX + " " + this.id);

      e.preventDefault();
      return false;
    };
    pageSwipeZone[el].ontouchstart = function(e) {
      global_x = e.touches[0].pageX;

      e.preventDefault();
      return false;
    };

    pageSwipeZone[el].ontouchend = function (e) {
      if (e.changedTouches[0].pageX > (global_x + swipeDeltaMin)) {
        location.href = '#' + navigationMap[this.id]['next'];
      } else if (e.changedTouches[0].pageX < (global_x - swipeDeltaMin) ) {
        location.href = '#' + navigationMap[this.id]['last'];
      } else {
        // Special case where 'click' shows/hides job templates
        if (this.id === 'jobTemplatesTitle') {
          var templates = document.getElementById("jobTemplatesHolder");
          var history = document.getElementById("historyListJobsHolder");
          if (!templates.style.display.includes('flex')) {
            // Must be hidden, so display it
            templates.style.display = 'flex';
            templates.style.display = '-webkit-flex';
            history.style.height = '22em';
          } else {
            templates.style.display = 'none';
            history.style.height = '35em';
          }
        }
      }
      e.preventDefault();
      return false;
    };
    pageSwipeZone[el].onmouseup = function (e) {
      //console.log("Mouse at x = " + e.pageX + ":" + e.pageY);
      if (e.pageX > (global_x + swipeDeltaMin)) {
        location.href = '#' + navigationMap[this.id]['next'];
      } else if (e.pageX < (global_x - swipeDeltaMin) ) {
        location.href = '#' + navigationMap[this.id]['last'];
      } else {
        // Special case where 'click' shows/hides job templates
        if (this.id === 'jobTemplatesTitle') {
          var templates = document.getElementById("jobTemplatesHolder");
          var history = document.getElementById("historyListJobsHolder");
          if (!templates.style.display.includes('flex')) {
            // Must be hidden, so display it
            templates.style.display = 'flex';
            templates.style.display = '-webkit-flex';
            history.style.height = '22em';
          } else {
            templates.style.display = 'none';
            history.style.height = '35em';
          }
        }
      }
      e.preventDefault();
      return false;
    };
  }

  /*******************  Do some configuration ***************************/

  // END of Configuration Page
  /**********************************************************************/

  //var socket = new WebSocket("ws://localhost:8080/ws");
  //var socket = new WebSocket("ws://" + location.host + "/ws");
  var socket = new WebSocket("ws://" + location.host);


  socket.onerror = function(){  
    console.log('Connection Error');
  };
  socket.onopen = function(){  
    console.log("websocket connected"); 

    // Ask for whatever is needed to startup
    msgobj = {type:'load_startup_data', data:[]};
    sendMessage({data:JSON.stringify(msgobj)});
  };

  // Handle received messages
  socket.onmessage = function (message) {
    var i, jmsg;
    try {
      jmsg = JSON.parse(message.data);
      if (jmsg.type === 'live_update') {
        //console.log("RCVD live_update " + message.data);
        live_update(jmsg);
      } else if (jmsg.type === 'startup_data') {
        console.log("RCVD startup_data " + message.data);
        startup_data(jmsg);
      } else if (jmsg.type === 'running_jobs') {
        console.log("RCVD running_jobs " + message.data);
        createRunningJobsList(jmsg.data);
      } else if (jmsg.type === 'saved_job') {
        jobSaved(jmsg.data);
      } else if (jmsg.type === 'saved_jobs_list') {
        // This is a listing, not the data
        console.log("RCVD saved_jobs_list " + message.data);
        updateJobsList(jmsg.data['historyfiles'], 'historyListJobsHolder');
      } else if (jmsg.type === 'saved_job_data') {
        // Data for a particular saved job
        console.log("RCVD saved_job_data ");
        updateJobHistoryData(jmsg.data);
      } else if (jmsg.type === 'archived_job') {
        console.log("RCVD archived_job " + message.data);
        jobHistoryItemRemoved(jmsg);
      } else if (jmsg.type === 'removed_saved_job') {
        console.log("RCVD removed_saved_job " + message.data);
        jobHistoryItemRemoved(jmsg);
      } else if (jmsg.type === 'running_job_status') {
        console.log("RCVD running_job_status " + message.data);
        updateRunningJob(jmsg.data);
      } else if (jmsg.type === 'stopped_job') {
        console.log("RCVD stopped_job " + message.data);
        jobStopped(jmsg.data);
      } else if (jmsg.type === 'resumed_job') {
        console.log("RCVD resumed_job " + message.data);
        console.log("RCVD resumed_job " + jmsg.data.longName);
        jobStatus[jmsg.data.longName]["running"] = "running";
        console.log("RCVD resumed_job done");
      } else if (jmsg.type === 'removed_job') {
        console.log("RCVD removed_job " + message.data);
        jobRemoved(jmsg.data);
      } else if (jmsg.type === 'relay_update') {
        //console.log("RCVD relay_update " + message.data);
        relay_update(jmsg);
      } else if (jmsg.type === 'sensor_list' ) {
        console.log("RCVD sensor_list " + message.data);
        // Keep a copy for later
        availableSensors = [];
        while (availableSensors.length > 0) {availableSensors.pop();}
        for (i=0;i<jmsg.data.length;i++) {
          availableSensors.push(jmsg.data[i]);
        }
        createSensorSelector();
        //jobSensorsHolder.dispatchEvent(foundNewSensor);
      } else if (jmsg.type === 'relay_list' ) {
        console.log("RCVD relay_list " + message.data);
        availableRelays = [];
        while (availableRelays.length > 0) {availableRelays.pop();}
        for (i=0;i<jmsg.data.length;i++) {
          availableRelays.push(jmsg.data[i]);
        }
        createRelaySelector(availableRelays);
      } else if (jmsg.type === 'loaded_jobs' ) {
        //console.log("RCVD loaded_jobs " + message.data);
        createJobTemplatesList(jmsg.data);
      }
      else
      {
        console.log("Unrecognised message type: " + message.data);
      }
    }
    catch (err) {
      console.log("Unrecognised message: " + message.data);
    }
  };

  socket.onclose = function () {
    // Display disconnected status
    var pageTitles = document.getElementsByClassName('page_title');
    for (var page=0;page<pageTitles.length;page++) {
      pageTitles[page].style.background = 'red';
      pageTitles[page].textContent = 'NOT CONNECTED';
    }
    console.log("Disconnected at " + new Date().toLocaleString());
  };

  var sendMessage = function(message) {
    console.log("sending:" + message.data);
    socket.send(message.data);
  };

 
  function live_update(data) {
    var sensor_state = data.sensor_state;
    var relay_state = data.relay_state;
    var i;
    //console.log("Rcvd live_update " + JSON.stringify(data));

    // Label for Sensors
    var elementName = 'sensor_update_title';
    if ( ! document.body.contains(document.getElementById(elementName)) ) {
      var sensor_updateHolder = document.getElementById('sensor_updateHolder');
      var asensor = document.createElement('DIV');
      asensor.id = elementName;
      asensor.className = 'sensor_update';
      asensor.style.width = '128px';
      asensor.setAttribute('tempScale', 'C');
      //asensor.oncontextmenu = function(e) { return false; };
      asensor.oncontextmenu = function() { return false; };
      asensor.onmousedown = function(e) {
        switch (e.button) {
        case 0:
          if (this.getAttribute('tempScale') == 'C') {
            this.setAttribute('tempScale', 'F');
          } else {
            this.setAttribute('tempScale', 'C');
          }
          break;
        default:
          console.log("Pressed button " + e.button + " at " + this.id);
          break;
        }
      };
      sensor_updateHolder.appendChild(asensor);
    }
    var el = document.getElementById(elementName);
    var tempScale = el.getAttribute('tempScale');
    el.textContent = 'Temp. (' + tempScale + '):';

    var isp;
    for (i=0;i<sensor_state.length;i++) {
      //console.log("sensor_state: " + sensor_state[i].sensorId + " = " + sensor_state[i].temperature);
      elementName = 'sensor_update_' + sensor_state[i].sensorId;
      if ( ! document.body.contains(document.getElementById(elementName)) ) {
        sensor_updateHolder = document.getElementById('sensor_updateHolder');
        asensor = document.createElement("DIV");
        asensor.id = elementName;
        asensor.oncontextmenu = function() { return false; };
        if (sensor_state[i].tilt) {
          console.log("We have an iSpindel!");
          console.log("iSpindelDevices was: " + JSON.stringify(iSpindelDevices));
          asensor.className = 'isp_sensor_update';

          var device;
          try {
            device = searchDeviceListByChipId(sensor_state[i].chipId);
          }
          catch (err) {
            console.log("Couldn't searchDeviceListByChipId() for some reason; " + err);
          }
          if (device) {
            console.log("Already have device: " + device.chipId);
          } else {
            console.log("Adding new device");
            isp = new Ispindel(sensor_state[i], asensor);
            iSpindelDevices.push(isp);
            addIspindelConfigData({data:{"chipId":isp.chipId, "name":isp.name, "timeout":parseInt(isp.waitTime/1000)}});
            var selector = document.getElementById("jobSensorsHolder");
            selector.dispatchEvent(foundNewSensor);
          }

          console.log("iSpindelDevices now: " + JSON.stringify(iSpindelDevices));
          asensor.onmouseover = function(e) {
            isp.showOverlay(e);
          };
        } else {
          // Not an iSpindel
          asensor.className = 'sensor_update';
          asensor.title = sensor_state[i].sensorId;
          asensor.onmousedown = function(e) {
            console.log("Pressed button " + e.button + " at " + this.id);
          };
        }
        sensor_updateHolder.appendChild(asensor);
      }
      if (sensor_state[i].tilt) {
        isp = undefined;
        for (var j=0;j<iSpindelDevices.length;j++) {
          //console.log(iSpindelDevices[j].name + ", " + sensor_state[i].sensorId);
          //if (iSpindelDevices[j].name == sensor_state[i].sensorId) {
          if (iSpindelDevices[j].chipId == sensor_state[i].chipId) {
            isp = iSpindelDevices[j];
            break;
          }
        }
        if (isp) {
          isp.set_contents(sensor_state[i], tempScale);
        }
      } else {
        if (tempScale == 'F') {
          document.getElementById(elementName).textContent = ((parseFloat(sensor_state[i].temperature) * 9 / 5 ) + 32).toFixed(2);
        } else {
          document.getElementById(elementName).textContent = (sensor_state[i].temperature).toFixed(2);
        }
      }
    }
    // Set width of bounding box
    //document.getElementById('sensor_updateHolder').style.width = (128 + 128*sensor_state.length) + "px";

    // Label for Relays
    elementName = 'relay_update_title';
    if ( ! document.body.contains(document.getElementById(elementName)) ) {
      relay_updateHolder = document.getElementById('relay_updateHolder');
      var arelay = document.createElement("DIV");
      arelay.id = elementName;
      arelay.className = 'relay_update';
      arelay.style.width = '128px';
      //arelay.oncontextmenu = function(e) { return false; };
      arelay.oncontextmenu = function() { return false; };
      arelay.onmousedown = function(e) {
        switch (e.button) {
        default:
          console.log("Pressed button " + e.button + " at " + this.id);
          break;
        }
      };
      relay_updateHolder.appendChild(arelay);
    }
    document.getElementById(elementName).textContent = 'Relays:';

    // Status of Relays
    for (i=0;i<relay_state.length;i++) {
      elementName = 'relay_update_' + i;
      if ( ! document.body.contains(document.getElementById(elementName)) ) {
        relay_updateHolder = document.getElementById('relay_updateHolder');
        arelay = document.createElement("DIV");
        arelay.id = elementName;
        arelay.className = 'relay_update';
        arelay.style.width = '128px';
        //arelay.oncontextmenu = function(e) { return false; };
        arelay.oncontextmenu = function() { return false; };
        arelay.onmousedown = function(e) {
          switch (e.button) {
          case 0:
            //send_relay_cmd(parseInt(this.id.charAt(this.id.length-1)) + 1);
            msgobj = {
              type:'toggle_relay',
              data:[parseInt(this.id.charAt(this.id.length-1)) + 1]
            };
            sendMessage({data:JSON.stringify(msgobj)});
            break;
          default:
            console.log("Pressed button " + e.button + " at " + this.id);
            break;
          }
        };
        relay_updateHolder.appendChild(arelay);
      }
      // relay_state is a list of tuples each with 2 True/False entries
      // 1st True/False indicates whether relay is On/Off
      if ( relay_state[i][0] ) {
        //if (document.getElementById(elementName).textContent == 'OFF') {
        // Must be changing off->on
        //  beep();
        //}
        document.getElementById(elementName).textContent = 'ON';
        document.getElementById(elementName).className = 'relay_update relay_ison';
      } else {
        document.getElementById(elementName).textContent = 'OFF';
        document.getElementById(elementName).className = 'relay_update relay_isoff';
      }
      //console.log("Relay state of " + i + ": " + relay_state[i]);
      // 2nd True/False indicates whether relay switching is Delayed/notDelayed
      if ( relay_state[i][1] ) {
        document.getElementById(elementName).style.background = '#777';
      } else {
        document.getElementById(elementName).style.background = '';
      }
    }
    // Set width of bounding box
    //document.getElementById('relay_updateHolder').style.width = (128 + 128*relay_state.length) + "px";

  }

  /* relay_update() is like live_update but just for the relays
  */
  function relay_update(data) {
    var relay_state = data.relay_state;
    console.log("Rcvd relay_update");

    // Status of Relays
    for (var i=0;i<relay_state.length;i++) {
      var elementName = 'relay_update_' + i;

      if ( ! document.body.contains(document.getElementById(elementName)) ) {
        continue;
      }
      // relay_state is a list of tuples each with 2 True/False entries
      // 1st True/False indicates whether relay is On/Off
      if ( relay_state[i][0] ) {
        //if (document.getElementById(elementName).textContent == 'OFF') {
        // Must be changing off->on
        //  beep();
        //}
        document.getElementById(elementName).textContent = 'ON';
        document.getElementById(elementName).className = 'relay_update relay_ison';
      } else {
        document.getElementById(elementName).textContent = 'OFF';
        document.getElementById(elementName).className = 'relay_update relay_isoff';
      }
      //console.log("Relay state of " + i + ": " + relay_state[i]);
      // 2nd True/False indicates whether relay switching is Delayed/notDelayed
      if ( relay_state[i][1] ) {
        document.getElementById(elementName).style.background = '#777';
      } else {
        document.getElementById(elementName).style.background = '';
      }
    }
  }

  function startup_data(jmsg) {
    var data = jmsg.data;
    var data_keys = Object.keys(data);
    console.log("Rcvd startup data with keys: " + data_keys);

    var configEntryHolder;
    for (var k in data_keys ) {
      if (data_keys[k] == 'testing') {
        _TESTING_ = data[data_keys[k]];
        console.log("_TESTING_ mode is " + _TESTING_);
      } else if (data_keys[k] == 'config') {
        // If configEntryHolder exists, remove all child nodes; otherwise create configEntryHolder
        if ( document.body.contains(document.getElementById('configEntryHolder')) ) {
          configEntryHolder = document.getElementById('configEntryHolder');
          var last;
          while ((last = configEntryHolder.lastChild)) configEntryHolder.removeChild(last);
        } else {
          configEntryHolder = document.createElement('DIV');
          configEntryHolder.id = 'configEntryHolder';
          document.getElementById('configHolder').appendChild(configEntryHolder);
        }
        build_config_entries(data[data_keys[k]]);
        //var configKeys = data[data_keys[k]];
        //for (var key in configKeys) {
        //  console.log("configKey: " + key);
        //}
      } else if (data_keys[k] == 'the_end') {
        console.log("the_end of startup_data");
      } else {
        console.log("Unknown startup_data key: " + data_keys[k] + " = " + data[data_keys[k]]);
      }
    }
    document.dispatchEvent(profilesLoadedEvent);
  }

  /* Generate a display listing of running jobs for front Status page */
  function createRunningJobsList (data) {
    console.log("Reached createRunningJobsList(): " + data.length);
    if ( data.length < 1 ) {
      document.getElementById("no_running_jobs").style.display = 'flex';
      document.getElementById("no_running_jobs").style.display = '-webkit-flex';
    } else {
      document.getElementById("no_running_jobs").style.display = 'none';
    }

    /* Clean out any existing stuff in the running_jobsHolder div. */
    var runningJobsHolder = document.getElementById("running_jobsHolder");
    var last;
    while ((last = runningJobsHolder.lastChild)) runningJobsHolder.removeChild(last);

    var longJobNames = [];
    data.forEach( function (job, index) {
      console.log("createRunningJobsList() handling job: " + index);

      var longName;
      if (job['waiting']) {
        longName = job['jobData'].jobName + "-" + job['jobData'].jobInstance;

        //console.log("Job waiting: " + JSON.stringify(job));
        //console.log("Job waiting: " + Object.keys(job));
        //console.log(job['jobData'].jobName + "-" + job['jobData'].jobInstance + " is waiting.");
        //console.log(job['jobData'].jobName + "-" + job['jobData'].jobInstance + " is waiting. Needs " + JSON.stringify(job['jobData'].jobSensorIds));

        // Add this job to unStartedJobs list
        unStartedJobs[longName] = job;

      } else {
        var header = job['header'];
        var updates = job['updates'];
        var saveData = {};

        longName = header['jobName'] + '-' + header['jobInstance'];

        // If previously unstarted, remove it from list
        if (unStartedJobs[longName]) delete unStartedJobs[longName];

        console.log("Creating listing for running job: " + index + " (" + longName + ")");
        longJobNames.push(longName);

        // Save the data for later use. It should consist of two arrays,
        // 1st with just the job header and 2nd with an array of status updates
        // (for a running job, updates will periodically be added to
        saveData['header'] = [header];
        saveData['updates'] = updates;
        runningData[longName] = saveData;
      }
      //console.log("ZZZ");
      updateJobsList(longJobNames, 'running_jobsHolder');
    });
  }

  function updateRunningJob(data) {
    //console.log("updateRunningJob() " + JSON.stringify(data));
    if ( data.type == 'status' ) {
      var longJobName = data['jobName'] + '-' + data['jobInstance'];
      //console.log("updateRunningJob() longJobName " + longJobName);
      if (!runningData.hasOwnProperty(longJobName)) {
        console.log("No job " + longJobName + " yet");
        return;
      }
      runningData[longJobName]['updates'].push(data);
      //console.log("updateRunningJob() longJobName 2 " + longJobName);
      updateJobHistoryData(0, longJobName);
    } else if ( data.type == 'header' ) {
      console.log("Received header update for " + data.jobName + "-" + data.jobInstance);
    } else {
      console.log("Received dummy update for " + data.jobName);
    }
  }

  /*
    Ispindel config data can come from saved data
    or from new instances appearing on the network.
  */
  function addIspindelConfigData(passedArgs) {
    var isp_sensor = passedArgs.data;
    var configItemData = passedArgs.branch || document.getElementById("configItemData_iSpindels");
    console.log("addIspindelConfigData() args: " + JSON.stringify(passedArgs));

    iSpindelWaitTimes[isp_sensor.chipId] = parseInt(isp_sensor.timeout);

    if (configItemData.querySelector("#configItemDataValue_" + isp_sensor.name)) {
      console.log("Already have #configItemDataValue_" + isp_sensor.name);
      return;
    }
    var configItemDataValue = document.createElement('DIV');
    configItemDataValue.id = 'configItemDataValue_' + isp_sensor.name;
    configItemDataValue.className = 'configItemDataValue';

    var configItemSensorName = document.createElement('DIV');
    configItemSensorName.id = 'configItemSensorName_' + isp_sensor.name;
    configItemSensorName.className = 'configItemSensorName unselectable';
    configItemSensorName.textContent = isp_sensor.name;
    var configItemSensorIspindel = document.createElement('INPUT');
    configItemSensorIspindel.id = 'configItemSensorIspindel_' + isp_sensor.name;
    configItemSensorIspindel.className = 'configItemSensorIspindel';
    configItemSensorIspindel.setAttribute('type', 'text');
    configItemSensorIspindel.value = isp_sensor.timeout;

    // Let server know about it
    msgobj = {
      type:'config_change',
      data:{
        'iSpindels':isp_sensor.name,
        'chipId':isp_sensor.chipId,
        'timeout':isp_sensor.timeout
      }
    };
    sendMessage({data:JSON.stringify(msgobj)});

    configItemSensorIspindel.onblur = function () {
      console.log("key: " + this.id + "  " + this.id.replace(/.+_/,''));
      var idata = {};
      idata['iSpindels'] = this.id.substring(this.id.indexOf("_") + 1);
      idata['timeout'] = this.value;
      msgobj = {type:'config_change', data:idata};
      sendMessage({data:JSON.stringify(msgobj)});

      // Apply to local instances
      iSpindelWaitTimes[idata['iSpindels']] = idata['timeout'];
      console.log("Set: " + JSON.stringify(iSpindelWaitTimes));
      console.log("Have " + iSpindelDevices.length + " iSpindelDevices to reconfigure");
      iSpindelDevices.forEach( function (item) {
        console.log("name " + item.name);
        if (item.name == idata['iSpindels']) {
          console.log("Found " + item.name);
          item.setNewWaitTime(idata['timeout']);
        }
      });
    };


    configItemDataValue.appendChild(configItemSensorName);
    configItemDataValue.appendChild(configItemSensorIspindel);
    configItemData.appendChild(configItemDataValue);
  }

  function build_config_entries(configItems) {
    var configEntryHolder = document.getElementById('configEntryHolder');
    for (var key in configItems) {
      //console.log("configKey: " + key);
      var configItem = document.createElement('DIV');
      configItem.id = 'configItem_' + key;
      configItem.className = 'configItem';

      var configItemName = document.createElement('DIV');
      configItemName.id = 'configItemName_' + key;
      configItemName.className = 'configItemName';
      configItemName.textContent = key;
      var configItemData = document.createElement('DIV');
      configItemData.id = 'configItemData_' + key;
      configItemData.className = 'configItemData';

      if (key == 'sensorFudgeFactors') {
        console.log("Do sensorFudgeFactors here");
        var configItemDataValue;
        for (var sensor in configItems[key]) {
          //console.log("Sensor: " + sensor + " = " + configItems[key][sensor]);
          configItemDataValue = document.createElement('DIV');
          configItemDataValue.id = 'configItemDataValue_' + sensor;
          configItemDataValue.className = 'configItemDataValue';

          var configItemSensorName = document.createElement('DIV');
          configItemSensorName.id = 'configItemSensorName_' + sensor;
          configItemSensorName.className = 'configItemSensorName';
          configItemSensorName.textContent = sensor;
          var configItemSensorFudge = document.createElement('INPUT');
          configItemSensorFudge.id = 'configItemSensorFudge_' + sensor;
          configItemSensorFudge.className = 'configItemSensorFudge';
          configItemSensorFudge.setAttribute('type', 'text');
          configItemSensorFudge.value = configItems[key][sensor];
          configItemSensorFudge.onblur = function () {
            if (isNaN(this.value)) {
              console.log("Bad value: " + this.value);
            } else {
              console.log("key: " + this.id + "  " + this.id.replace(/.+_/,''));
              var idata = {};
              idata['sensorFudgeFactors'] = this.id.replace(/.+_/,'');
              idata['fudge'] = this.value;
              msgobj = {type:'config_change', data:idata};
              sendMessage({data:JSON.stringify(msgobj)});
            }
          };

          configItemDataValue.appendChild(configItemSensorName);
          configItemDataValue.appendChild(configItemSensorFudge);
          configItemData.appendChild(configItemDataValue);

          configItemDataValue.blur();
        }
      } else if (key == "iSpindels") {
        console.log("Configure ISpindels");
        var isp_sensor;
        for (var i in configItems[key]) {
          isp_sensor = configItems[key][i];
          console.log("isp: " + JSON.stringify(isp_sensor));
          addIspindelConfigData({"branch":configItemData, "data":isp_sensor});

          /*
          iSpindelWaitTimes[isp_sensor.name] = parseInt(isp_sensor.timeout);

          configItemDataValue = document.createElement('DIV');
          configItemDataValue.id = 'configItemDataValue_' + isp_sensor.name;
          configItemDataValue.className = 'configItemDataValue';

          configItemSensorName = document.createElement('DIV');
          configItemSensorName.id = 'configItemSensorName_' + isp_sensor.name;
          configItemSensorName.className = 'configItemSensorName';
          configItemSensorName.textContent = isp_sensor.name;
          var configItemSensorIspindel = document.createElement('INPUT');
          configItemSensorIspindel.id = 'configItemSensorIspindel_' + isp_sensor.name;
          configItemSensorIspindel.className = 'configItemSensorIspindel';
          configItemSensorIspindel.setAttribute('type', 'text');
          configItemSensorIspindel.value = isp_sensor.timeout;
          configItemSensorIspindel.onblur = function () {
            console.log("key: " + this.id + "  " + this.id.replace(/.+_/,''));
            var idata = {};
            idata['iSpindels'] = this.id.substring(this.id.indexOf("_") + 1);
            idata['timeout'] = this.value;
            msgobj = {type:'config_change', data:idata};
            sendMessage({data:JSON.stringify(msgobj)});

            // Apply to local instances
            iSpindelWaitTimes[idata['iSpindels']] = idata['timeout'];
            console.log("Set: " + JSON.stringify(iSpindelWaitTimes));
            console.log("Have " + iSpindelDevices.length + " iSpindelDevices to reconfigure");
            iSpindelDevices.forEach( function (item) {
              console.log("name " + item.name);
              if (item.name == idata['iSpindels']) {
                console.log("Found " + item.name);
                item.setNewWaitTime(idata['timeout']);
              }
            });
          };


          configItemDataValue.appendChild(configItemSensorName);
          configItemDataValue.appendChild(configItemSensorIspindel);
          configItemData.appendChild(configItemDataValue);
          */
        }

        configItemName.classList.add("unselectable");
        configItemName.title = "Double click to configure new iSpindel device";
        configItemName.addEventListener("dblclick", function() {
          console.log("Add new iSpindel configuration");
        });
      } else {
        configItemDataValue = document.createElement('DIV');
        configItemDataValue.id = 'configItemDataValue_' + key;
        configItemDataValue.className = 'configItemDataValue';

        var configItemDataValueInput = document.createElement('INPUT');
        configItemDataValueInput.id = 'configItemDataValueInput_' + key;
        configItemDataValueInput.className = 'configItemDataValueInput';
        configItemDataValueInput.setAttribute('type', 'text');
        configItemDataValueInput.value = configItems[key];

        configItemDataValueInput.onblur = function() {
          //console.log("key: " + this.id + "  " + this.id.replace(/.+_/,''));
          var idata = {};
          idata[this.id.replace(/.+_/,'')] = this.value;
          msgobj = {type:'config_change', data:idata};
          sendMessage({data:JSON.stringify(msgobj)});
        };

        configItemDataValue.appendChild(configItemDataValueInput);
        configItemData.appendChild(configItemDataValue);
      }


      configItem.appendChild(configItemName);
      configItem.appendChild(configItemData);

      configEntryHolder.appendChild(configItem);
    }
  }

  /* START RUNNING/HISTORY */

  /* This is where a graph is (re)drawn.
    We can arrive here for a number of reasons:
      - a graph needs to ber drawn for the first time
      - a graph needs to be redrawn because something has changed
        e.g. additional data e.g. zoomed view requested
    In any case, its cheap enough to just (re)draw everything,
    the main difference between cases is how to determine which
    graph is to be (re)drawn, as well as which data is to be used
    (so that the 'header' and 'updates' variables can be set).
  */
  function updateJobHistoryData(data, jobLongName) {
    // data should consist of  two arrays,
    // 1st with just the job header and 2nd with an array of status updates
    //console.log("Received msg: saved_job_data " + data);
    //console.log("updateJobHistoryData(): jobLongName " + jobLongName);

    // Is it new (via data parameter) or are we redrawing stored data?
    var header, updates, longName;
    if ( jobLongName === undefined ) {
      // We must have data supplied by parameter
      console.log("updateJobHistoryData() New job");
      header = data['header'];
      updates = data['updates'];
      longName = header[0]['jobName'] + '-' + header[0]['jobInstance'];
      historyData[longName] = data;
    } else {
      // Must have previously saved data

      if ( historyData.hasOwnProperty(jobLongName) ) {
        // It's a saved job
        header = historyData[jobLongName]['header'];
        updates = historyData[jobLongName]['updates'];
        longName = header[0]['jobName'] + '-' + header[0]['jobInstance'];
      } else if (runningData.hasOwnProperty(jobLongName)) {
        // Must be a running job
        header = runningData[jobLongName]['header'] || [];
        updates = runningData[jobLongName]['updates'];
        longName = header[0]['jobName'] + '-' + header[0]['jobInstance'];
        //console.log("updateJobHistoryData() 1 longName: " + longName);
        //console.log("updateJobHistoryData() 2 updates =  " + updates.length);
        //console.log("updateJobHistoryData() 3 updates =  " + JSON.stringify(updates));
      } else {
        // Nothing to do here
        return;
      }
      //var longName = header[0]['jobName'] + '-' + header[0]['jobInstance'];
    }
    //console.log("updateJobHistoryData() longName: " + longName);

    /* Examples of extracting various fields
    console.log("updateJobHistoryData() jobProfile: " + header[0]['jobProfile'] + " " + header[0]['jobProfile'].length);
    console.log("updateJobHistoryData() jobName: " + header[0]['jobName'] + " " + header.length);
    console.log("updateJobHistoryData() updates: " + updates + " " + updates.length);
    for (var i=0;i<updates.length;i++) {
      //console.log("updateJobHistoryData() temp at " + parseFloat(updates[i]['elapsed']).toFixed(2) + " = " + updates[i][updates[i]['sensors'][0]]);
      console.log("updateJobHistoryData() temp at " + parseFloat(updates[i]['elapsed']).toFixed(2) + " = " + updates[i][updates[i]['sensors'][1]]['temp']);
    }
    console.log("updateJobHistoryData() grav at " + parseFloat(updates[updates.length - 1]['elapsed']).toFixed(2) + " = " + updates[updates.length - 1][updates[updates.length - 1]['sensors'][1]]['grav']);
    */

    var holderNode = document.getElementById('jobElementGraph_' + longName);
    if (holderNode == null) {
      console.log('updateJobHistoryData(): jobElementGraph_' + longName + ' does not exist');
      return;
    }
    var holderName = holderNode.getAttribute('holderName');
    //console.log('Scale widget has holderName: ' + holderName);
    var graphWidthScale = parseInt(document.getElementById('jobItemHZBInput_' + holderName + '_' + longName).value);
    if (graphWidthScale < 1 ) {
      graphWidthScale = 1;
      document.getElementById('jobItemHZBInput_' + holderName + '_' + longName).value = 1;
    }

    var historyJobsGraphMargin;
    var historyJobsGraphHeight;
    if ( smallDevice() ) {
      //console.log("smallDevice is TRUE");
      historyJobsGraphMargin = {top: 24, right: 40, bottom: 60, left: 40};
      historyJobsGraphHeight = 192 - (historyJobsGraphMargin.top + historyJobsGraphMargin.bottom);
    } else {
      //console.log("smallDevice is FALSE");
      historyJobsGraphMargin = {top: 32, right: 40, bottom: 60, left: 80};
      historyJobsGraphHeight = 256 - (historyJobsGraphMargin.top + historyJobsGraphMargin.bottom);
    }
    var historyJobsGraphWidth = graphWidthScale*window.innerWidth - (historyJobsGraphMargin.left + historyJobsGraphMargin.right) - 20;

    // Draw the graph of job history
    select("#history_" + longName.replace('%', '\\%')).remove();
    var historyJobsGraphHolder = select("#jobElementGraph_" + longName.replace('%', '\\%'))
      .append("svg")
      //.attr("id", "history_" + longName.replace('%', '\%'))
      .attr("id", "history_" + longName.replace('%', '\\%'))
      .attr("class", "history_job")
      .attr("width", historyJobsGraphWidth + historyJobsGraphMargin.right + historyJobsGraphMargin.left)
      .attr("height", historyJobsGraphHeight + historyJobsGraphMargin.top + historyJobsGraphMargin.bottom)
      .style("border", "1px solid black");

    // Extract profile & temperature data into local arrays
    var profileData = header[0]['jobProfile'];
    var profileLineData = [];
    var temperatureLineDataHolder = [];
    var gravityLineDataHolder = [];
    var temperatureLineData = [];
    var gravityLineData = [];
    var setpoint = {};
    var gsetpoint = {};
    var nextStep = 0.0;
    for (var sp=0;sp<profileData.length;sp++) {
      setpoint = {"x":nextStep, "y":profileData[sp]["target"]};
      profileLineData.push(setpoint);
      nextStep += parseFloat(profileData[sp]["duration"]);
      //console.log("**** updateJobHistoryData() profile: " + setpoint["x"] + " : " + setpoint["y"]);
    }
    // Extract temperature data for all sensors
    var sensor_instance;
    for (sensor_instance=0;sensor_instance<header[0]['jobSensorIds'].length;sensor_instance++) {
      //console.log("updateJobHistoryData() sensor name: " + header[0]['jobSensorIds'][sensor_instance]);
      //var sensorName = header[0]['jobSensorIds'][sensor_instance];

      temperatureLineData = [];
      gravityLineData = [];
      for (var i=0;i<updates.length;i++) {
        if (updates[i][updates[i]['sensors'][sensor_instance]]['temp']) {
          //setpoint = {"x":parseFloat(updates[i]['elapsed']).toFixed(2), "y":updates[i][updates[i]['sensors'][sensor_instance]]};
          setpoint = {"x":parseFloat(updates[i]['elapsed']).toFixed(2), "y":updates[i][updates[i]['sensors'][sensor_instance]]['temp']};
          // Now build a path for this sensor by going through all the history entries
          temperatureLineData.push(setpoint);
          //console.log("**** updateJobHistoryData() temperature: " + setpoint["x"] + " : " + setpoint["y"]);
        }
        if (updates[i][updates[i]['sensors'][sensor_instance]]['grav']) {
          gsetpoint = {"x":parseFloat(updates[i]['elapsed']).toFixed(2), "y":updates[i][updates[i]['sensors'][sensor_instance]]['grav']};
          gravityLineData.push(gsetpoint);
        }
      }
      temperatureLineDataHolder[sensor_instance] = temperatureLineData;
      gravityLineDataHolder[sensor_instance] = gravityLineData;
    }

    // Find extent of values in both profileLineData & all the temperatureLineData arrays (1 for each sensor)
    // N.B. could maybe do this while populating the *LineData arrays
    var minDataPoint = min(profileLineData, function(d) {return parseFloat(d.y);});
    var maxDataPoint = max(profileLineData, function(d) {return parseFloat(d.y);});
    var maxTime = max(profileLineData, function(d) {return parseFloat(d.x);});

    for (sensor_instance=0;sensor_instance<header[0]['jobSensorIds'].length;sensor_instance++) {
      if (temperatureLineDataHolder[sensor_instance].length > 0) {
        var temperature = min(temperatureLineDataHolder[sensor_instance], function(d) {return parseFloat(d.y);});
        if (temperature < minDataPoint ) minDataPoint = temperature;
        temperature = max(temperatureLineDataHolder[sensor_instance], function(d) {return parseFloat(d.y);});
        if (temperature > maxDataPoint ) maxDataPoint = temperature;
        temperature = max(temperatureLineDataHolder[sensor_instance], function(d) {return parseFloat(d.x);});
        if ( temperature > maxTime ) maxTime = temperature;
      }

      if (gravityLineDataHolder[sensor_instance].length > 0) {
        var gravity = min(gravityLineDataHolder[sensor_instance], function(d) {return parseFloat(d.y);});
        if (gravity < minDataPoint ) minDataPoint = gravity;
        gravity = max(gravityLineDataHolder[sensor_instance], function(d) {return parseFloat(d.y);});
        if (gravity > maxDataPoint ) maxDataPoint = gravity;
        gravity = max(gravityLineDataHolder[sensor_instance], function(d) {return parseFloat(d.x);});
        if ( gravity > maxTime ) maxTime = gravity;
      }
    }
    // Add some clearance
    minDataPoint -= 5;
    maxDataPoint += 5;
    maxTime += 60;

    //console.log("Min = " + minDataPoint + " Max = " + maxDataPoint);
    var historyLinearScaleY = scaleLinear()
      .domain([minDataPoint, maxDataPoint])
      .range([historyJobsGraphHeight,0]);
    var historyYAxis = axisLeft(historyLinearScaleY).ticks(5);
    //var historyYAxisGroup = historyJobsGraphHolder.append("g")
    historyJobsGraphHolder.append("g")
      .attr('class', 'y historyAxis unselectable')
      .attr("transform", "translate(" + historyJobsGraphMargin.left + "," + historyJobsGraphMargin.top + ")")
      .call(historyYAxis);
    var historyLinearScaleX = scaleTime()
      .domain([0,maxTime])
      .range([0,historyJobsGraphWidth]);
    var xAxis = axisBottom(historyLinearScaleX).tickValues(makeTickValues(maxTime,18*graphWidthScale));
    //.ticks(20);
    //var xAxisGroup = historyJobsGraphHolder.append("g")
    historyJobsGraphHolder.append("g")
      .attr('class', 'x historyAxis unselectable')
      .attr("transform", "translate(" + historyJobsGraphMargin.left + "," + (historyJobsGraphHeight + historyJobsGraphMargin.top) + ")")
      .call(xAxis);

    // Custom tick format
    historyJobsGraphHolder.selectAll('.x.historyAxis text')
      .text(function(d) { return tickText(d); });

    // Scale profile data
    var scaledProfileLineData = [];
    for ( sp=0;sp<profileLineData.length;sp++) {
      //console.log("scaled sp = " + profileLineData[sp].x + " : " + profileLineData[sp].y);
      scaledProfileLineData.push({
        "x":historyLinearScaleX(profileLineData[sp].x),
        "y":historyLinearScaleY(profileLineData[sp].y)
      });
    }
    // Draw profile graph
    var historyProfileLineFunction = line()
      .x(function(d) { return d.x; })
      .y(function(d) { return d.y; });
    //var lineGraph = historyJobsGraphHolder.append("path")
    historyJobsGraphHolder.append("path")
      .attr("transform", "translate(" + historyJobsGraphMargin.left + "," + historyJobsGraphMargin.top + ")")
      .attr("d", historyProfileLineFunction(scaledProfileLineData))
      .attr("stroke", "gray")
      .attr("stroke-width", 2)
      .attr("fill", "none");

    for (sensor_instance=0;sensor_instance<header[0]['jobSensorIds'].length;sensor_instance++) {
      //console.log("updateJobHistoryData() sensor data: " + sensor_instance);

      // Scale temperature data
      if (temperatureLineDataHolder[sensor_instance].length > 0) {
        var scaledTemperatureLineData = [];
        temperatureLineData = temperatureLineDataHolder[sensor_instance];
        for ( sp=0;sp<temperatureLineData.length;sp++) {
          //console.log("scaled sp = " + temperatureLineData[sp].x + " : " + temperatureLineData[sp].y);
          scaledTemperatureLineData.push({
            "x":historyLinearScaleX(temperatureLineData[sp].x),
            "y":historyLinearScaleY(temperatureLineData[sp].y)
          });
        }
        // Draw temperature graph
        var historyTemperatureLineFunction = line()
          .x(function(d) { return d.x; })
          .y(function(d) { return d.y; });
        //var lineGraph = historyJobsGraphHolder.append("path")
        historyJobsGraphHolder.append("path")
          .attr("transform",
            "translate(" + historyJobsGraphMargin.left + "," + historyJobsGraphMargin.top + ")")
          .attr("d", historyTemperatureLineFunction(scaledTemperatureLineData))
          .attr("stroke", temperatureColours[sensor_instance])
          .attr("stroke-width", temperatureStrokeWidth)
          .attr("fill", "none")
          .on("mouseover", function() {
            //console.log("in container: " + longName + " at: " + mouse(this)[0] + "," + mouse(this)[1]);
            //console.log("X: " + tickText(historyLinearScaleX.invert(mouse(this)[0])));
            //console.log("Y: " + historyLinearScaleY.invert(mouse(this)[1]));


            /* Set the tooltip text, then move it into position and display it.
            */
            select("#detailTooltipText_" + longName.replace('%', '\\%'))
              .append("tspan").attr("x",0).attr("y",0).attr('dx', '0.3em').attr('dy', '1.1em').text("Time: " + tickText(historyLinearScaleX.invert(mouse(this)[0])))
              .append("tspan").attr("x",0).attr("y",18).attr('dx','0.3em').attr('dy', '1.1em').text("Temp:" + (historyLinearScaleY.invert(mouse(this)[1])).toFixed(2));

            select("#detailTooltipGroup_" + longName.replace('%', '\\%'))
              .attr("transform",
                "translate(" + (historyJobsGraphMargin.left + mouse(this)[0]) + "," + (historyJobsGraphMargin.top + mouse(this)[1]) + ")")
              .style("opacity", 0.9);

          })
          .on("mouseout", function() {
            //console.log("out");

            select("#detailTooltipGroup_" + longName.replace('%', '\\%'))
              .transition()
              .duration(200)
              .style("opacity", 0.0);

            // Remove previous entry
            select("#detailTooltipGroup_" + longName.replace('%', '\\%'))
              .selectAll("tspan").remove();

          });
      }
      // Scale gravity data
      if (gravityLineDataHolder[sensor_instance].length > 0) {
        var scaledGravityLineData = [];
        gravityLineData = gravityLineDataHolder[sensor_instance];
        for (sp=0;sp<gravityLineData.length;sp++) {
          //console.log("scaled sp = " + gravityLineData[sp].x + " : " + gravityLineData[sp].y);
          scaledGravityLineData.push({
            "x":historyLinearScaleX(gravityLineData[sp].x),
            "y":historyLinearScaleY(gravityLineData[sp].y)
          });
        }
        // Draw gravity graph
        var historyGravityLineFunction = line()
          .x(function(d) { return d.x; })
          .y(function(d) { return d.y; });
        //var lineGraph = historyJobsGraphHolder.append("path")
        historyJobsGraphHolder.append("path")
          .attr("transform",
            "translate(" + historyJobsGraphMargin.left + "," + historyJobsGraphMargin.top + ")")
          .attr("d", historyGravityLineFunction(scaledGravityLineData))
          .attr("stroke", gravityColours[sensor_instance])
          .attr("stroke-width", gravityStrokeWidth)
          .attr("fill", "none")
          .on("mouseover", function() {
            //console.log("gravity in");

            /* Set the tooltip text, then move it into position and display it.
            */
            select("#detailTooltipText_" + longName.replace('%', '\\%'))
              .append("tspan").attr("x",0).attr("y",0).attr('dx', '0.3em').attr('dy', '1.1em').text("Time: " + tickText(historyLinearScaleX.invert(mouse(this)[0])))
              .append("tspan").attr("x",0).attr("y",18).attr('dx','0.3em').attr('dy', '1.1em').text("Grav: " + (historyLinearScaleY.invert(mouse(this)[1])).toFixed(2));

            select("#detailTooltipGroup_" + longName.replace('%', '\\%'))
              .attr("transform",
                "translate(" + (historyJobsGraphMargin.left + mouse(this)[0]) + "," + (historyJobsGraphMargin.top + mouse(this)[1]) + ")")
              .style("opacity", 0.9);

          })
          .on("mouseout", function() {
            //console.log("gravity out");

            select("#detailTooltipGroup_" + longName.replace('%', '\\%')).transition()
              .duration(200)
              .style("opacity", 0.0);

            // Remove previous entry
            select("#detailTooltipGroup_" + longName.replace('%', '\\%'))
              .selectAll("tspan").remove();

          });
      }
    }

    /* Show time & value as a tooltip
      at any particular point of the graph
    */
    historyJobsGraphHolder.append("g")
      .attr("id", "detailTooltipGroup_" + longName.replace('%', '\\%'))
      .attr("class", "detailtooltipgroup")
      .attr("transform",
        "translate(" + historyJobsGraphMargin.left + "," + historyJobsGraphMargin.top + ")")
      .style("opacity", 0.0);

    select("#detailTooltipGroup_" + longName.replace('%', '\\%'))
      .append("rect")
      .attr('id', 'detailTooltipBox_' + longName.replace('%', '\\%'))
      .attr('class', 'detailtooltipbox')
      .attr('width', 96) .attr('height', 40)
      .attr('rx', 6).attr('ry', 4);

    select("#detailTooltipGroup_" + longName.replace('%', '\\%'))
      .append("text")
      .attr('id', 'detailTooltipText_' + longName.replace('%', '\\%'))
      .attr('class', 'detailtooltip');


    // Group for Resume/Waiting button & text
    var lastUpdate = updates[updates.length - 1];
    //console.log("lastUpdate = " + JSON.stringify(lastUpdate));
    //console.log("jobStatus = " + JSON.stringify(jobStatus));
    historyJobsGraphHolder.append("g")
      .attr("id", "runningButtonGroup_" + longName.replace('%', '\\%'))
      .attr("class", "runningButtonGroup")
      .attr("transform",
        "translate(" +
        (smallDevice()?historyJobsGraphWidth-20:historyJobsGraphWidth-40) + "," + 40 + ")")
      .style('display', (lastUpdate.running=='stopped'?'block':'none'));

    // Only show this button if this job is stopped or waiting
    select("#runningButtonGroup_" + longName.replace('%', '\\%'))
      .append("rect")
      .attr('id', 'runningResumeButton_' + longName.replace('%', '\\%'))
      .attr('class', 'runningResumeButton')
      .attr('x', 0) .attr('y', 0)
      .attr('width', 96).attr('height', 40)
      .on("click", function() {
        //console.log("RESUME running " + longName.replace('%', '\\%'));
        //console.log("RESUME running jobStatus: " + jobStatus[longName.replace('%', '\\%')].running);
        if (jobStatus[longName.replace('%', '\\%')].running == "stop") {
          // Request job resume
          var msgobj = {
            'type':'resume_job',
            'data':{'jobName': longName.replace('%', '\\%')}
          };
          sendMessage({data:JSON.stringify(msgobj)});
        } else {
          // Otherwise presume we're suspended so don't restart explicitly
          // (rather wait until "lost" sensor device is rediscovered)
          alert("Job " + longName.replace('%', '\\%') + " waiting for missing sensor device");
        }
      });

    if (jobStatus[longName.replace('%', '\\%')]) {
      console.log("END of running_job_status jobStatus: " + jobStatus[longName.replace('%', '\\%')].running);
      if (jobStatus[longName.replace('%', '\\%')].running == "stop") {
        select("#runningButtonGroup_" + longName.replace('%', '\\%'))
          .append("text")
          .attr('class', 'runningResumeButtonText')
          .attr('dx', '1.5em')
          .attr('dy', '1.7em')
          .text("Resume");
      } else {
        select("#runningButtonGroup_" + longName.replace('%', '\\%'))
          .append("text")
          .attr('class', 'runningResumeButtonText')
          .attr('dx', '1.5em')
          .attr('dy', '1.7em')
          .text("Waiting");
      }
    } else {
      select("#runningButtonGroup_" + longName.replace('%', '\\%'))
        .append("text")
        .attr('class', 'runningResumeButtonText')
        .attr('dx', '1.5em')
        .attr('dy', '1.7em')
        .text("Resume");
    }
  }

  function jobStopped(data) {
    console.log("jobStopped() data: " + JSON.stringify(data));
    if (data.reason ) {
      jobStatus[data.longName] = {'running':data.reason.stopStatus};
    } else {
      jobStatus[data.longName] = {'running':'stop'};
    }
    console.log("jobStopped() jobStatus: " + JSON.stringify(jobStatus));
    jobFinishedWith(data);
  }

  function jobRemoved(data) {
    console.log("jobRemoved() data: " + JSON.stringify(data));
    jobStatus[data.longName] = {'running':'remove'};
    jobFinishedWith(data, 'remove');
  }

  function jobSaved(data) {
    console.log("jobSaved() data: " + JSON.stringify(data));
    jobStatus[data.longName] = {'running':'save'};
    // Ensure data contains a reason
    if (! data.reason) {
      data["reason"] = {"stopStatus":"save"};
    }
    jobFinishedWith(data);
  }

  /*
    Remove jobElement_<jobName> & jobElementGraph_<jobName> from running_jobsHolder.
    Show the No Jobs running notice, if that is the case.
    Move data associated with jobName from runningData to historyData
  */
  function jobFinishedWith(data) {
    var endStatus;
    if (data.reason) {
      console.log("jobFinishedWith() reason: " + data.reason.stopStatus);
      endStatus = data.reason.stopStatus;
    } else {
      console.log("jobFinishedWith() No reason => plain stop");
      endStatus = "stop";
    }

    var jobName = data['jobName'];
    var longName = data['longName'];
    //console.log("Received " + endStatus + "_job message " + jobName + " : " + longName);

    // Remove graph from status (running jobs) page
    var running_jobsHolder = document.getElementById('running_jobsHolder');
    var children = document.getElementById("running_jobsHolder").children;
    for (var i=0;i<children.length;i++) {
      //console.log("Child: " + children[i].id);
      if (children[i].id.endsWith(longName) ) {
        console.log("jobFinishedWith() ready to " + endStatus + " " + longName);
        if (!(endStatus == 'stop' || endStatus == 'suspend')) {
          var rem = document.getElementById('jobElement_' + longName);
          rem.parentNode.removeChild(rem);

          rem = document.getElementById('jobElementGraph_' + longName);
          rem.parentNode.removeChild(rem);
        }

        if ( endStatus === 'save' ) {
          // Move associated data
          historyData[longName] = runningData[longName];
          //Not sure how to effectively remove old version - maybe just leave it?
          //del(historyData[longName]);

          // If necessary, show "no jobs running" notice
          var no_running_jobs;
          if ( running_jobsHolder.children.length == 0 ) {
            no_running_jobs = document.getElementById("no_running_jobs");
            //no_running_jobs.innerHTML = "No jobs are currently running";
            no_running_jobs.innerHTML = "<center>" + jobName + " was saved to <a href=#content_2 >Job History</a> <br>No other jobs are currently running</center>";
            no_running_jobs.style.display = 'flex';
            no_running_jobs.style.display = '-webkit-flex';
          }

        } else if ( endStatus === 'suspend' ) {
          console.log('job suspended ' + longName);
        } else if ( endStatus === 'stop' ) {
          console.log('job stopped ' + longName);

        } else if ( endStatus === 'remove' ) {
          //Not sure how to effectively remove old version - maybe just leave it?
          //del(historyData[longName]);

          // If no more running jobs, reinstate "No running jobs" status
          if ( running_jobsHolder.children.length == 0 ) {
            no_running_jobs = document.getElementById("no_running_jobs");
            no_running_jobs.innerHTML = "<p>No <a href=#content_2>jobs</a> are currently running</p>";
            no_running_jobs.style.display = 'flex';
            no_running_jobs.style.display = '-webkit-flex';
          }
        }
      }
    }
  }

  function jobHistoryItemRemoved (jmsg) {
    var jobName = jmsg.data['jobName'];
    var jobInstance = jmsg.data['instance'];
    //console.log("Received " + jmsg.type + " message for: " + jobName + '-' + jobInstance);

    // Remove the jobElement_<jobName>-<jobInstance> element
    // Also (if it has been displayed) jobElementGraph_<jobName>-<jobInstance>
    var jobElement = document.getElementById('jobElement_' + jobName + '-' + jobInstance);
    while ( jobElement.hasChildNodes() ) {
      jobElement.removeChild(jobElement.firstChild);
    }
    jobElement.parentNode.removeChild(jobElement);

    var jobElementGraph = document.getElementById('jobElementGraph_' + jobName + '-' + jobInstance);
    if (typeof(jobElementGraph) != 'undefined' && jobElementGraph != null) {
      while (jobElementGraph.hasChildNodes() ) {
        jobElementGraph.removeChild(jobElementGraph.firstChild);
      }
      jobElementGraph.parentNode.removeChild(jobElementGraph);
    }
  }


  /* START JOBS (page 2) */

  function updateJobsList(jobfiles, holder) {
    //console.log("Reached updateJobsList()");
    var jobFiles = jobfiles;
    var jobsListHolder = document.getElementById(holder);
    var instancePattern = /[0-9]{8}_[0-9]{6}/;

    // First remove existing items
    while ( jobsListHolder.hasChildNodes() ) {
      jobsListHolder.removeChild(jobsListHolder.firstChild);
    }
    //console.log("XXX " + holder);

    // Reverse sort the received list (by instancePattern)
    jobFiles.sort(function(a,b) {
      var to_sort = [instancePattern.exec(a),instancePattern.exec(b)];
      var to_sort_orig = to_sort.slice();
      to_sort.sort();
      if (to_sort_orig[0] == to_sort[0]) {
        return 1;
      } else {
        return -1;
      }
    });

    /*
      Before drawing the running jobs, look for any non starters 
      (perhaps due to unavailability of a required sensor)
      and set up a notification.
    */
    var unStartedJobsKeys = Object.keys(unStartedJobs);
    //console.log("unstarted job(s): " + unStartedJobsKeys);

    unStartedJobsKeys.forEach( function (key) {
      //console.log("Advising of unstarted job: " + key + " --- " + JSON.stringify(unStartedJobs[key]));

      var sensorIds = unStartedJobs[key]['jobData'].jobSensorIds;
      //console.log("Needs sensor" + (sensorIds.length>1?"s":"") + ": " + sensorIds);

      var jobElement = document.createElement('DIV');
      jobElement.id = 'jobElement_' + key;
      jobElement.className = 'jobCantStart';

      var jobItemName = document.createElement('DIV');
      jobItemName.id = 'jobItemName_' + i;
      jobItemName.className = 'jobCantStartName';
      jobItemName.innerHTML = "<html>Job " + key + " can't start yet. Needs sensor" + (sensorIds.length>1?"s":"") + ": " + sensorIds + "</html>";

      jobElement.appendChild(jobItemName);
      jobsListHolder.appendChild(jobElement);
    });

    /* Now the jobs running normally
    */
    for (var i=0;i<jobFiles.length;i++) {
      //console.log("              " + jobFiles[i]);
      // Extract some identifiers from the filename
      var jobInstance = instancePattern.exec(jobFiles[i]);
      //console.log("updateJobsList() jobInstance = " + jobInstance);
      var jobName = jobfiles[i].slice(0,(jobFiles[i].indexOf(jobInstance)-1));
      //console.log("updateJobsList() jobName = " + jobName);
      var jobNameFull = jobName + '-' + jobInstance;
      //console.log(jobFiles[i] + ': ' + jobName + ' ' + jobInstance);

      var jobElement = document.createElement('DIV');
      jobElement.id = 'jobElement_' + jobNameFull;
      jobElement.className = 'jobElement';

      var jobElementGraph = document.createElement('DIV');
      jobElementGraph.id = 'jobElementGraph_' + jobNameFull;
      jobElementGraph.className = 'jobElementGraph';
      jobElementGraph.setAttribute('holderName', holder);

      var jobItemName = document.createElement('DIV');
      jobItemName.id = 'jobItemName_' + i;
      jobItemName.className = 'jobItemName';
      jobItemName.innerHTML = "<html>" + jobName + "</html>";

      var jobItemInstance = document.createElement('DIV');
      jobItemInstance.id = 'jobItemInstance_' + jobNameFull;
      jobItemInstance.className = 'jobItemInstance jobItemInstance_' + holder;
      jobItemInstance.innerHTML = "<html>" + jobInstance + "</html>";

      // Horizontal Zoom box
      var jobItemHZoomBox = document.createElement('DIV');
      jobItemHZoomBox.id = 'jobItemHZoomBox_' + jobNameFull;
      jobItemHZoomBox.className = 'zoomBox';
      jobItemHZoomBox.title = 'Horizontal Zoom Factor';
      var jobItemHZBLabel = document.createElement('LABEL');
      jobItemHZBLabel.for = 'jobItemHZBInput_'+ holder + '_' + jobNameFull;
      jobItemHZBLabel.className = 'zoomBoxLabel';
      var jobItemHZBInput = document.createElement('INPUT');
      jobItemHZBInput.id = 'jobItemHZBInput_'+ holder + '_' + jobNameFull;
      jobItemHZBInput.className = 'zoomBoxInput';
      jobItemHZBInput.value = 1;
      jobItemHZBInput.onblur = function() {
        var jobLongName = this.id.replace("jobItemHZBInput_" + holder + '_', "");
        //console.log('INPUT ' + this.id + " : " + this.value + " : " + jobLongName);
        //if ( historyData.hasOwnProperty(jobLongName) ) {
        //  updateJobHistoryData(0, jobLongName);
        //}
        updateJobHistoryData(0, jobLongName);
      };
      jobItemHZBInput.addEventListener('keypress', function(event) {
        if (event.keyCode == 13) {
          this.onblur();
        }
      });

      var jobItemHZDown = document.createElement('Button');
      jobItemHZDown.id = 'jobItemHZDown_' + jobNameFull;
      jobItemHZDown.className = 'zoomBoxButton';
      jobItemHZDown.textContent = '-';
      jobItemHZDown.onclick = function() {
        var hsinput = document.getElementById(this.id.replace("jobItemHZDown", "jobItemHZBInput_" + holder));
        hsinput.value -=  parseInt(hsinput.value)>1?1:0;
        var jobLongName = this.id.replace("jobItemHZDown_", "");
        //console.log('DOWN ' + this.id + " : " + hsinput.value + " : " + jobLongName);
        //if ( historyData.hasOwnProperty(jobLongName) ) {
        //  updateJobHistoryData(0, jobLongName);
        //}
        updateJobHistoryData(0, jobLongName);
      };
      var jobItemHZUp = document.createElement('Button');
      jobItemHZUp.id = 'jobItemHZUp_' + jobNameFull;
      jobItemHZUp.className = 'zoomBoxButton';
      jobItemHZUp.textContent = '+';
      jobItemHZUp.onclick = function() {
        var hsinput = document.getElementById(this.id.replace("jobItemHZUp", "jobItemHZBInput_" + holder));
        hsinput.value = parseInt(hsinput.value,10) + 1;
        var jobLongName = this.id.replace("jobItemHZUp_", "");
        //console.log('UP ' + this.id + " : " + hsinput.value + " : " + jobLongName);
        //if ( historyData.hasOwnProperty(jobLongName) ) {
        //  updateJobHistoryData(0, jobLongName);
        //}
        updateJobHistoryData(0, jobLongName);
      };
      //jobItemHZoomBox.appendChild(jobItemHZBLabel);
      jobItemHZoomBox.appendChild(jobItemHZDown);
      jobItemHZoomBox.appendChild(jobItemHZBInput);
      jobItemHZoomBox.appendChild(jobItemHZUp);


      jobElement.appendChild(jobItemName);
      jobElement.appendChild(jobItemInstance);
      jobElement.appendChild(jobItemHZoomBox);
      jobsListHolder.appendChild(jobElement);
      jobsListHolder.appendChild(jobElementGraph);

      if (holder === 'running_jobsHolder') {
        jobElementGraph.style.display = 'block';
        updateJobHistoryData(0, jobNameFull);
      }
    }

    // Popup menu - content could vary depending on where the jobs list is parented
    var jobElementMenu = [];
    if (holder === 'historyListJobsHolder' ) {
      // Start of popup menu
      jobElementMenu = [{
        title: 'Display',
        action: function(elm, data, index) {
          console.log('menu item #1 from ' + elm.id + " " + data.title + " " + index);
          var jobElementGraphName = 'jobElementGraph_' + elm.id.slice('jobItemInstance_'.length);
          var jobLongName = elm.id.slice('jobItemInstance_'.length);
          //console.log('jobElementGraphName = ' + jobElementGraphName);
          var jobElementGraph = document.getElementById(jobElementGraphName);
          if ( jobElementGraph.style.display == 'block') {
            jobElementGraph.style.display = 'none';
          } else {
            jobElementGraph.style.display = 'block';

            // Only download job data if we don't already have it
            if ( (!historyData.hasOwnProperty(jobLongName)) ) {
              msgobj = {       
                type:'load_saved_job_data',
                data:{'fileName':jobElementGraphName.slice('jobElementGraph_'.length)}
              };
              sendMessage({data:JSON.stringify(msgobj)});
            } else {
              updateJobHistoryData(0, jobLongName);
            }
          }
        }
      }, {
        // At the server, move from history to archive directory
        // In the browser, remove item from list
        title: 'Archive',
        action: function(elm, data, index) {
          console.log('menu item #2 from ' + elm.id + " " + data.title + " " + index);
          var longName = elm.id.replace('jobItemInstance_', '');
          var jobName = longName.slice(0, (longName.length - 16)); // e.g. '-20160504_103213'
          var jobInstance = longName.replace(jobName + '-', '');
          var confirmArchive = confirm("Archive job: " + jobName + "?");
          if ( confirmArchive == true ) {
            var msgobj = {
              type:'archive_saved_job',
              data:{'jobName':jobName, 'instance':jobInstance}
            };
            sendMessage({data:JSON.stringify(msgobj)});
          }
        }
      }, {
        title: 'Delete',
        action: function(elm, data, index) {
          console.log('menu item #3 from ' + elm.id + " " + data.title + " " + index);
          var longName = elm.id.replace('jobItemInstance_', '');
          var jobName = longName.slice(0, (longName.length - 16)); // e.g. '-20160504_103213'
          var jobInstance = longName.replace(jobName + '-', '');
          console.log('menu jobName ' + jobName + ' instance: ' + jobInstance);
          var confirmDelete = confirm("Completely DELETE job: " + jobName + " from the system?");
          if ( confirmDelete == true ) {
            var msgobj = {
              type:'delete_saved_job',
              data:{'jobName':jobName, 'instance':jobInstance}
            };
            sendMessage({data:JSON.stringify(msgobj)});
          }
        }
      }];
      // End of popup menu
    } else if (holder === 'running_jobsHolder') {
      // Start of popup menu
      jobElementMenu = [{
        title: 'Hide/Display',
        action: function(elm, data, index) {
          console.log('menu item #1 from ' + elm.id + " " + data.title + " " + index);
          var jobElementGraphName = 'jobElementGraph_' +
                                  elm.id.slice('jobItemInstance_'.length);
          var jobLongName = elm.id.slice('jobItemInstance_'.length);
          //console.log('jobElementGraphName = ' + jobElementGraphName);
          var jobElementGraph = document.getElementById(jobElementGraphName);
          if ( jobElementGraph.style.display == 'block') {
            jobElementGraph.style.display = 'none';
          } else {
            jobElementGraph.style.display = 'block';
            updateJobHistoryData(0, jobLongName);
          }
        }
      }, {
        title: 'Stop',
        action: function(elm, data, index) {
          console.log('menu item #2 from ' + elm.id + " " + data.title + " " + index);
          var longJobName = elm.id.replace('jobItemInstance_', '');
          var jobInstance = instancePattern.exec(longJobName);
          var nodeName = longJobName.slice(0,(longJobName.indexOf(jobInstance)-1));
          if (jobStatus[longJobName]) {
            console.log("At STOP menu: " + jobStatus[longJobName].running);
            if (jobStatus[longJobName].running == "suspend") {
              alert("Already Waiting");
              return;
            }
          }
          var confirmStop = confirm("Stop job " + nodeName + "?");
          if ( confirmStop == true ) {
            var msgobj = {
              type:'stop_running_job',
              data:{'jobName':nodeName, 'longName':longJobName}
            };
            sendMessage({data:JSON.stringify(msgobj)});
          }
        }
      }, {
        title: 'Remove',
        action: function(elm, data, index) {
          console.log('menu item #3 from ' + elm.id + " " + data.title + " " + index);
          var longJobName = elm.id.replace('jobItemInstance_', '');
          var jobInstance = instancePattern.exec(longJobName);
          var nodeName = longJobName.slice(0,(longJobName.indexOf(jobInstance)-1));
          var confirmRemove = confirm("Remove job " + nodeName + "?");
          if ( confirmRemove == true ) {
            var msgobj = {
              type:'remove_running_job',
              data:{'jobName':nodeName, 'longName':longJobName}
            };
            sendMessage({data:JSON.stringify(msgobj)});
          }
        }
      }, {
        title: 'Save',
        action: function(elm, data, index) {
          console.log('menu item #4 from ' + elm.id + " " + data.title + " " + index);
          var longJobName = elm.id.replace('jobItemInstance_', '');
          var jobInstance = instancePattern.exec(longJobName);
          var nodeName = longJobName.slice(0,(longJobName.indexOf(jobInstance)-1));
          var msgobj = {
            type:'save_running_job',
            data:{'jobName':nodeName, 'longName':longJobName}
          };
          sendMessage({data:JSON.stringify(msgobj)});
        }
      }];
      // End of popup menu
    } else if (holder === 'testHolder') {
      // Start of popup menu
      jobElementMenu = [{
        title: 'Display',
        action: function(elm, data, index) {
          console.log('menu item #1 from ' + elm.id + " " + data.title + " " + index);
          var jobElementGraphName = 'jobElementGraph_' +
                                  elm.id.slice('jobItemInstance_'.length);
          var jobLongName = elm.id.slice('jobItemInstance_'.length);
          //console.log('jobElementGraphName = ' + jobElementGraphName);
          var jobElementGraph = document.getElementById(jobElementGraphName);
          if ( jobElementGraph.style.display == 'block') {
            jobElementGraph.style.display = 'none';
          } else {
            jobElementGraph.style.display = 'block';

            // Only download job data if we don't already have it
            if ( (!historyData.hasOwnProperty(jobLongName)) ) {
              msgobj = {
                type:'load_saved_job_data',
                data:{'fileName':jobElementGraphName.slice('jobElementGraph_'.length)}
              };
              sendMessage({data:JSON.stringify(msgobj)});
            } else {
              updateJobHistoryData(0, jobLongName);
            }
          }
        }
      }, {
        title: 'Delete',
        action: function(elm, data, index) {
          console.log('menu item #2 from ' + elm.id + " " + data.title + " " + index);
        }
      }, {
        title: 'Is this the Status Page?',
        action: function(elm, data, index) {
          console.log('menu item #3 from ' + elm.id + " " + data.title + " " + index);
        }
      }];
      // End of popup menu
    }

    selectAll('.jobItemInstance_' + holder)
      //.on('click', function(data, index) {
      .on('click', function() {
        var elm = this;

        // create the div element that will hold the context menu
        selectAll('.context-menu').data([1])
          .enter()
          .append('div')
          .attr('class', 'context-menu');

        // an ordinary click anywhere closes menu
        select('body').on('click.context-menu', function() {
          select('.context-menu').style('display', 'none');
        });

        // this is executed when a contextmenu event occurs
        selectAll('.context-menu')
          .html('<center><p><b>Job Options</b></p></center><hr>')
          .append('ul')
          .selectAll('li')
          .data(jobElementMenu).enter()
          .append('li')
          .on('click',function(d) {
            console.log('popup selected: ' + d.title);
            d.action(elm, d, i);
            select('.context-menu')
              .style('display', 'none');
            return d;
          })
          .text(function(d) {return d.title;});
        select('.context-menu').style('display', 'none');

        // show the context menu
        select('.context-menu')
          .style('left', (event.pageX - 12) + 'px')
          .style('top', (event.pageY - 72) + 'px')
          .style('display', 'block');
        event.preventDefault();

        event.stopPropagation();
      });

    console.log("End of updateJobsList()");
  }



  /* START PROFILES */

  var profileGraphMargin;
  var profileGraphHeight;
  if ( smallDevice() ) {
    //console.log("smallDevice is TRUE");
    profileGraphMargin = {top: 50, right: 40, bottom: 60, left: 40};
    profileGraphHeight = 300 - (profileGraphMargin.top + profileGraphMargin.bottom);
  } else {
    //console.log("smallDevice is FALSE");
    profileGraphMargin = {top: 50, right: 40, bottom: 60, left: 80};
    profileGraphHeight = 400 - (profileGraphMargin.top + profileGraphMargin.bottom);
  }
  var profileGraphWidth = window.innerWidth - (profileGraphMargin.left + profileGraphMargin.right) - 20;

  var pfZoom = zoom()
    .scaleExtent([1,10])
    .on("zoom", zoomed);

  function zoomed () {
    if (event.ctrlKey) {
      console.log("zoomed(): CTRL key pressed");
      //return;
    }
    /*
    select("#profilesGraphHolder")
     .attr("transform", "translate(" + event.translate + ")scale(" + event.scale + ")");
    */
  }

  /*
  var pfDrag = drag()
    .subject(function () { return {x:event.x, y:event.y}; })
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended);
  */

  function dragstarted (d) {
    //console.log("dragstarted() " + JSON.stringify(d));
    event.sourceEvent.stopPropagation();
    // event.ctrlKey is masked by something
    // i.e. doesn't work here so use our own pfCtrlKey instead
    if (pfCtrlKey) {
      // if ctrl key is down, we're not dragging (actually deleting)
      //console.log("dragstarted(): CTRL key is down");
      return;
    }
    if (event.ctrlKey) {
      console.log("dragstarted(): CTRL key is down");
      return;
    }

    profileTooltip.transition()
      .duration(200)
      .style("opacity", 0.9);

    profileTooltip.text(tickText(profileLinearScaleX.invert(d.x)) + "," + parseInt(profileLinearScaleY.invert(d.y))) 
      .style("left", (d.x + profileGraphMargin.left - 67) + "px")
      .style("top", (d.y + profileGraphMargin.top + 43) + "px");

    select(this).classed("dragging", true);
  }
  function dragged (d) {
    select(this).attr("cx", d.x = event.x).attr("cy", d.y = event.y);

    profileTooltip.html(tickText(profileLinearScaleX.invert(d.x)) + ", " + parseInt(profileLinearScaleY.invert(d.y)))
      .style("opacity", 0.9)
      .style("left", (d.x + profileGraphMargin.left - 67) + "px")
      .style("top", (d.y + profileGraphMargin.top + 43) + "px");

    select(this).classed("dragging", true);
  }
  function dragended (d) {
    if (event.ctrlKey) {
      console.log("dragended(): CTRL key pressed");
    }
    if ( !(select(this).classed("dragging")) ) {
      console.log("dragended(): should be a click");
      removeSetPoint(this);
      return;
    }

    //var datum = select(this).datum();
    //console.log("dragended() " + JSON.stringify(datum));

    var index = this.id.split('_')[1];
    console.log("this.id = " + this.id);
    console.log("index = " + index);

    //var pos = mouse(this);
    //console.log("dragended() pos: " + (pos[0]-profileGraphMargin.left) + "," + (pos[1]-profileGraphMargin.top));
    var sp = {
      //x:parseInt(profileLinearScaleX.invert(pos[0]-profileGraphMargin.left)),
      //y:parseInt(profileLinearScaleY.invert(pos[1]-profileGraphMargin.top))
      //x:parseInt(profileLinearScaleX.invert(pos[0])),
      //y:parseInt(profileLinearScaleY.invert(pos[1]))
      //x:parseInt(profileLinearScaleX.invert(parseInt(d.x))),
      //y:parseInt(profileLinearScaleY.invert(parseInt(d.y)))
      x:profileLinearScaleX.invert(parseInt(d.x)),
      y:profileLinearScaleY.invert(parseInt(d.y))
    };
    profileDisplayData[0][index].x = sp.x;
    profileDisplayData[0][index].y = sp.y;
    //console.log("dragended() new pos: " + sp.x + "," + sp.y);
    var rawProfileData = convertDisplayToRawProfileData();
    //console.log("dragended = " + JSON.stringify(rawProfileData));
    rawProfileData.forEach( function (item) {
      if ( ! (item.duration == 0) ) {
        item.duration = invertGraphTimeValue(item.duration);
      } else {
        item.duration = "0";
      }
    });
    updateProfileGraph({data:rawProfileData, owner:profileOwner});
    profileTooltip.transition()
      .duration(200)
      .style("opacity", 0.0);

    select(this).classed("dragging", false);
  }

  /* Return an array of profiles.
     Each profile is an array of setpoints; x (time) & y (temp) fields
  */
  function defaultJobProfileData () {
    //console.log("Here is some data");
    var p1 = [
      {'duration':'25.10','target':'2'},
      {'duration':'0','target':'2'}
    ];
    return p1;
  }
  /*
  function getProfileData () {
    // Just dummy data for now
    console.log("Here is some data");
    var p1 = [
      {'duration':'7.10','target':'5'},
      {'duration':'8.10','target':'10'},
      {'duration':'9.10','target':'1'},
      {'duration':'0','target':'5'}
    ];
    return p1;
  }
  function getProfileData2 () {
    // Just dummy data for now
    console.log("Here is some data");
    var p1 = [
      {'duration':'0.10','target':'-15'},
      {'duration':'0.20','target':'40'},
      {'duration':'0.10','target':'20'},
      {'duration':'0.20','target':'30'},
      {'duration':'0.10','target':'35'},
      {'duration':'0.20','target':'40'},
      {'duration':'0.10','target':'30'},
      {'duration':'0.30','target':'40'}
    ];
    return p1;
  }
  */

  function updateProfileGraph (argOptions) {
    var options = argOptions || {};
    profileData = options.data || [];
    profileOwner = options.owner || 'unknown';
    profileDisplayData = [];
    var defaultRange = {"min":-5,"max":30};
    var setpoint = {};
    console.log("At: updateProfileGraph() " + JSON.stringify(profileData) + " for owner " + profileOwner);

    // Clear any current graph
    select("#profilesGraphHolder").selectAll("*").remove();
    var profileGraphHolder = select("#profilesGraphHolder")
      .append("svg")
      .attr("id", "profiles_graph")
      .attr("class", "generic_graph")
      .attr("width", profileGraphWidth + profileGraphMargin.right + profileGraphMargin.left)
      .attr("height", profileGraphHeight + profileGraphMargin.top + profileGraphMargin.bottom)
      .style("border", "1px solid black")
      .on("click", newSetPoint)
      .call(pfZoom);

    /* From the raw profile, generate a dataset that has accumulated times
    */
    //console.log("profileData length = " + profileData.length);
    var nextStep = 0.0;
    var lineData = [];
    for (var sp=0;sp<profileData.length;sp++) {
      //console.log("pdata: " + profileData[sp]["duration"] + " : " + profileData[sp]["target"]);
      setpoint = {"x":_TESTING_?nextStep:60*nextStep, "y":profileData[sp]["target"]};
      lineData.push(setpoint);
      //console.log("pdata: " + setpoint["x"] + " : " + setpoint["y"]);

      nextStep += resolveGraphTimeValue(profileData[sp]["duration"]);
    }
    profileDisplayData.push(lineData);

    // Find extent of data.
    // Then add some percentage to allow for expansion
    // due to new data points outside the data
    var minDataPoint = min(profileDisplayData[0], function(d) {return parseFloat(d.y)-5;});
    minDataPoint = minDataPoint<defaultRange.min?minDataPoint:defaultRange.min;
    var maxDataPoint = max(profileDisplayData[0], function(d) {return parseFloat(d.y)+5;});
    maxDataPoint = maxDataPoint>defaultRange.max?maxDataPoint:defaultRange.max;
    var maxTime = max(profileDisplayData[0], function(d) {return parseFloat(d.x) * 1.3 ;});
    //console.log("minData = " + minDataPoint + ", maxData = " + maxDataPoint + ", maxTime = " + maxTime);

    /*
    // Scale & display data
    if ( _TESTING_ ) {
      var formatTime = timeFormat("%H:%M.%S");
    } else {
      var formatTime = timeFormat("%-j:%H.%M");
    }
    */
    profileLinearScaleY = scaleLinear()
      .domain([minDataPoint,maxDataPoint])
      .range([profileGraphHeight,0]);
    var yAxis = axisLeft(profileLinearScaleY).ticks(5);
    //var yAxisGroup = profileGraphHolder.append("g")
    profileGraphHolder.append("g")
      .attr('class', 'y profileAxis unselectable')
      .attr("transform", "translate(" + profileGraphMargin.left + "," + profileGraphMargin.top + ")")
      .call(yAxis);
    profileLinearScaleX = scaleTime()
      .domain([0,maxTime])
      .range([0,profileGraphWidth]);
    var xAxis = axisBottom(profileLinearScaleX).tickValues(makeTickValues(maxTime,18));
    //var xAxisGroup = profileGraphHolder.append("g")
    profileGraphHolder.append("g")
      .attr('class', 'x profileAxis unselectable')
      .attr("transform", "translate(" + profileGraphMargin.left + "," + (profileGraphHeight + profileGraphMargin.top) + ")")
      .call(xAxis);

    // Custom tick format
    profileGraphHolder.selectAll('.x.profileAxis text')
      .text(function(d) {
        return tickText(d) ;
      });

    //var xaxistext = profileGraphHolder
    profileGraphHolder
      .append("g")
      .attr("id", "xaxistext_profileGraph")
      .attr("class", "axistext unselectable")
      .append("text")
      .attr("transform",
        "translate(" + ((profileGraphWidth - profileGraphMargin.left)/2 + profileGraphMargin.left) + "," + (profileGraphHeight+ profileGraphMargin.top + profileGraphMargin.bottom) + ")")
      .attr("dy", "-0.35em")
      .style("text-anchor", "middle")
      .text("Duration (" + (_TESTING_?'mins:secs':'days.hours:mins') + ")");

    for ( var profile=0;profile<profileDisplayData.length;profile++) {
      var scaledLineData = [];
      lineData = profileDisplayData[profile];

      //Scale each x & y in lineData, push result into new scaledLineData array
      lineData.forEach( function (d) {
        scaledLineData.push({"x":profileLinearScaleX(d.x), "y":profileLinearScaleY(d.y)});
      });
      var profileLineFunction = line()
        .x(function(d) { return d.x; })
        .y(function(d) { return d.y; });
      //var lineGraph = profileGraphHolder.append("path")
      profileGraphHolder.append("path")
        .attr("transform", "translate(" + profileGraphMargin.left + "," + profileGraphMargin.top + ")")
        .attr("d", profileLineFunction(scaledLineData))
        .attr("stroke", profileLineColours[profile])
        .attr("stroke-width", 2)
        .attr("fill", "none");
      //var dotGraphText = profileGraphHolder.selectAll('dotText')
      profileGraphHolder.selectAll('dotText')
        .data(scaledLineData)
        .enter().append("text")
        .attr("id", function(d,i){return "setpointText_" + i ;})
        .attr("class", "profileSetPointText")
        .attr('x', function(d) { return d.x + 1; })
        .attr('y', function(d) { return d.y - 5; })
        .attr("transform", "translate(" + profileGraphMargin.left + "," + profileGraphMargin.top + ")")
        .text(function(d) {return tickText(profileLinearScaleX.invert(d.x))
          + ", " + parseInt(profileLinearScaleY.invert(d.y)); } );

      //var dotGraph = profileGraphHolder.selectAll('dot')
      profileGraphHolder.selectAll('dot')
        .data(scaledLineData)
        .enter().append("circle")
        .attr("id", function(d,i){return "setpoint_" + i ;})
        .attr("class", "profileSetPoint")
        .attr("transform", "translate(" + profileGraphMargin.left + "," + profileGraphMargin.top + ")")
        .attr('r', 3.5)
        .attr('cx', function(d) { return d.x; })
        .attr('cy', function(d) { return d.y; })
        //.on("mouseover", function(d) {
        .on("mouseover", function() {
          // event.ctrlKey is masked from pfDrag
          // so set our own pfCtrlKey instead
          if (event.ctrlKey) {
            //console.log("mouseover + ctrl key");
            pfCtrlKey = true;
            return;
          }
          pfCurrentDot = this;
        })
        //.on("mouseout", function(d) {
        .on("mouseout", function() {
          if ( !(select(this).classed("dragging")) ) {
            profileTooltip.transition()
              .duration(500)
              .style("opacity", 0);
          }
          pfCurrentDot = {"id":"none"};
        })
        //.on("click", function(d) {
        .on("click", function() {
          if (event.defaultPrevented) {
            console.log("PREVENTED");
            return;
          }
          console.log("CLICK");
          event.sourceEvent.stopPropagation();
          removeSetPoint(this);
        })
        //.call(pfDrag);
        .call(drag()
          .container(function container() { return this; })
          .subject(function () { return {x:event.x, y:event.y}; })
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended));

    }
    //var profileButtonGroup = profileGraphHolder.append("g")
    profileGraphHolder.append("g")
      .attr("id", "profileButtonGroup")
      .attr("class", "profileButtonGroup")
      .attr("transform",
        "translate(" +
        (smallDevice()?profileGraphWidth-20:profileGraphWidth-40) + "," + 40 + ")");


    // Save & Return button
    //var profileSaveCancelButton = select("#profileButtonGroup")
    select("#profileButtonGroup")
      .append("rect")
      .attr('id', 'profileSaveButton')
      .attr('class', 'profileSaveCancelButton')
      .attr('x', 0) .attr('y', 0)
      .attr('width', 96).attr('height', 40)
      .on("click", function() {
        //console.log("SAVE & RETURN to " + profileOwner);
        select("#profilesGraphHolder").selectAll("*").remove();
        location.href = '#content_2';
        if (profileOwner == "jobProfileHolder") {
          jobProfileHolder.setAttribute('pdata', JSON.stringify(profileData));
        } else if (profileOwner.search("tiProfile_") == 0) {
          document.getElementById(profileOwner).setAttribute('pdata', JSON.stringify(profileData));
          updateTemplateProfile({owner:profileOwner});
          replace_job(profileOwner);
        }
      });

    select("#profileButtonGroup")
      .append("text")
      .attr('class', 'profileSaveCancelButtonText')
      .attr('dx', '0.1em')
      .attr('dy', '1.6em')
      .text("Save & Return");


    // Cancel button
    //var profileCancelButton = select("#profileButtonGroup")
    select("#profileButtonGroup")
      .append("rect")
      .attr('id', 'profileCancelButton')
      .attr('class', 'profileSaveCancelButton')
      .attr('x', 0) .attr('y', '3.6em')
      .attr('width', 96).attr('height', 40)
      .on("click", function() {
        //console.log("CANCEL to " + profileOwner);
        select("#profilesGraphHolder").selectAll("*").remove();
        location.href = '#content_2';
      });

    //var profileCancelButtonText = select("#profileButtonGroup")
    select("#profileButtonGroup")
      .append("text")
      .attr('class', 'profileSaveCancelButtonText')
      .attr('dx', '1.8em')
      .attr('dy', '5.6em')
      .text("Cancel");

  }

  function makeTickValues(maxValue, tickCount) {
    var result = [];
    if (window.innerWidth < 1000 ) {
      tickCount = 9;
    } else {
      tickCount = 18;
    }
    for (var i=0;i<tickCount;i++) {
      result.push(Math.floor(i*maxValue/tickCount));
    }
    result.push(maxValue);
    return result;
  }
  function tickText(d) {
    var secs = (d%60);
    var hrs =  Math.floor(d/60/60);
    var mins = Math.floor(d/60) - hrs * 60;
    var days = Math.floor(hrs/24);
    //return mins + ":" + secs;
    if (_TESTING_) {
      if (hrs < 1) {
        //return sprintf("%d:%02d", mins, secs);
        return mins.toString() + ":" + secs.toString().padStart(2,"0");
      } else {
        //return sprintf("%d.%02d:%02d", hrs, mins, secs);
        return hrs.toString() + "." + mins.toString().padStart(2,"0") + ":" + secs.toString().padStart(2,"0");
      }
    } else {
      if (days < 1 ) {
        //return sprintf("%d:%02d", hrs, mins);
        return hrs.toString() + ":" + mins.toString().padStart(2,"0");
      } else {
        hrs -= days*24;
        //return sprintf("%d.%02d:%02d", days, hrs, mins);
        return days.toString() + "." + hrs.toString().padStart(2,"0") + ":" + mins.toString().padStart(2,"0");
      } }
  }

  function newSetPoint () {
    if ( ! (event.shiftKey)) {
      return;
    }
    console.log("newSetPoint()");
    var pos = mouse(this);
    //console.log("newSetPoint() raw pos: " + pos[0] + "," + pos[1]);
    //console.log("newSetPoint() pos: " + (pos[0]-profileGraphMargin.left) + "," + (pos[1]-profileGraphMargin.top));
    //console.log("newSetPoint() " + JSON.stringify(profileDisplayData));

    var sp = {
      x:parseInt(profileLinearScaleX.invert(pos[0]-profileGraphMargin.left).valueOf()),
      y:parseInt(profileLinearScaleY.invert(pos[1]-profileGraphMargin.top))
    };
    console.log("newSetPoint(): " + sp.x + "," + sp.y);
    insertSetPoint(sp);
    var rawProfileData = convertDisplayToRawProfileData();
    console.log("rawProfileData = " + JSON.stringify(rawProfileData));
    rawProfileData.forEach( function (item) {
      if ( ! (item.duration == 0) ) {
        item.duration = invertGraphTimeValue(item.duration);
      } else {
        item.duration = "0";
      }
    });

    updateProfileGraph({data:rawProfileData,owner:profileOwner});
  }
  function insertSetPoint (sp) {
    //console.log("insertSetPoint(): " + sp.x + "," + sp.y);
    var index = 0;
    while ( index < profileDisplayData[0].length &&
            parseInt(sp.x) > parseInt(profileDisplayData[0][index].x) ) {

      index += 1;
    }
    profileDisplayData[0].splice(index, 0, sp);
    //console.log("insertSetPoint() " + JSON.stringify(profileDisplayData));
  }
  function convertDisplayToRawProfileData () {
    var rawSetPoints = [];
    var runningTime = 0;

    for (var i=0;i<profileDisplayData[0].length;i++) {
      var sp = profileDisplayData[0][i];
      //console.log(JSON.stringify(sp));
      var newSp = {"target":sp.y, "duration":0};
      if ( rawSetPoints.length > 0 ) {
        rawSetPoints[i-1]["duration"] = sp.x - runningTime;
        runningTime += sp.x - runningTime;
      }
      rawSetPoints.push(newSp);

    }
    //console.log("rawSetPoints = " + JSON.stringify(rawSetPoints));
    return rawSetPoints;
  }

  /* To maintain the overall profile duration,
     we add the removed setpoint's duration
     to the previous setpoint's duration
  */
  function removeSetPoint (e) {
    //if ( ! (event.ctrlKey)) {
    //  return;
    //}

    //var datum = select(e).datum();
    //console.log("removeSetPoint() " + JSON.stringify(datum));

    /* element index in profileData & profileDisplayData
    */
    var index = e.id.split('_')[1];
    if (index == 0 || index == (profileData.length - 1)) return;

    profileDisplayData[0].splice(index, 1);
    var rawProfileData = convertDisplayToRawProfileData();
    rawProfileData.forEach( function (item) {
      if ( ! (item.duration == 0) ) {
        item.duration = invertGraphTimeValue(item.duration);
      } else {
        item.duration = "0";
      }
    });

    /* Updating graph display also updates profileData to rawProfileData
    */
    updateProfileGraph({data:rawProfileData, owner:profileOwner});
    profileTooltip.transition()
      .duration(200)
      .style("opacity", 0);
  }


  window.onresize = function() {
    console.log("Window resize to: " + window.innerWidth + " x " + window.innerHeight);
    if ( smallDevice() ) {
      console.log("smallDevice is TRUE");
      profileGraphMargin = {top: 30, right: 40, bottom: 60, left: 40};
      profileGraphHeight = 300 - (profileGraphMargin.top + profileGraphMargin.bottom);
    } else {
      //console.log("smallDevice is FALSE");
      profileGraphMargin = {top: 50, right: 40, bottom: 60, left: 80};
      profileGraphHeight = 400 - (profileGraphMargin.top + profileGraphMargin.bottom);
    }
    profileGraphWidth = window.innerWidth - (profileGraphMargin.left + profileGraphMargin.right) -20;

    // Redraw profile editor
    updateProfileGraph({data:profileData, owner:profileOwner});

    //Redraw running jobs
    var runningJobs = document.getElementsByClassName("jobElementGraph");
    for (var i=0;i<runningJobs.length;i++) {
      var jobLongName = runningJobs[i].id.replace("jobElementGraph_", "");
      //console.log("Redraw " + jobLongName);
      updateJobHistoryData(0, jobLongName);
    }

  };

  select("body").on("keydown", function () {
    //console.log("KEY DOWN");
    if ( event.shiftKey) {
      //console.log("SHIFT KEY");
    }
    if ( event.ctrlKey) {
      //console.log("CTRL KEY pfCurrentDot = " + pfCurrentDot.id);
      //selectAll('.profileSetPoint').each( function(d, i) {
      selectAll('.profileSetPoint').each( function() {
        if (this.id == pfCurrentDot.id) { pfCtrlKey = true; }
      });

    }
  });
  select("body").on("keyup", function () {
    //console.log("KEY UP");
    if ( event.ctrlKey) {
      //console.log("CTRL KEY UP");
      pfCtrlKey = false;
    }
  });


  /* "Display only" some profile (not editable)
    probably job template (or even composer?)
  */
  //function updateTemplateProfile(profileData, profileDivName) {
  function updateTemplateProfile(options) {
    var profileOwner = options.owner || 'unknown';
    //console.log("Reached updateTemplateProfile(): " + profileOwner);
    profileData = JSON.parse(document.getElementById(profileOwner).getAttribute('pdata'));
    var sp;

    var templateProfileGraphMargin = {top: 2, right: 4, bottom: 1, left: 1},
      templateProfileGraphWidth = 576 - templateProfileGraphMargin.left - templateProfileGraphMargin.right,
      templateProfileGraphHeight = 40 - templateProfileGraphMargin.top - templateProfileGraphMargin.bottom;

    // Draw the graph of profile
    select('#profile_' + profileOwner).remove();
    var templateProfileGraphHolder = select('#' + profileOwner)
      .append("svg")
      .attr("id", "profile_" + profileOwner)
      .attr("class", "template_profileGraph")
      .attr("width", templateProfileGraphWidth + templateProfileGraphMargin.right + templateProfileGraphMargin.left)
      .attr("height", templateProfileGraphHeight + templateProfileGraphMargin.top + templateProfileGraphMargin.bottom)
      .style("border", "1px solid black");

    // Extract profileData into local array
    var profileLineData = [];
    var setpoint = {};
    var nextStep = 0.0;
    /*
    for (sp=0;sp<profileData.length;sp++) {
      setpoint = {"x":nextStep.toFixed(2),
                  "y":profileData[sp]["target"]};
      profileLineData.push(setpoint);
      nextStep += parseFloat(profileData[sp]["duration"]);
      //nextStep += resolveGraphTimeValue(parseFloat(profileData[sp]["duration"]));
      console.log("*** updateTemplateProfile() profile: " + setpoint["x"] + "(" + profileData[sp]["duration"] + "): " + setpoint["y"]);
    }
    */
    for (sp=0;sp<profileData.length;sp++) {
      //console.log("pdata: " + profileData[sp]["duration"] + " : " + profileData[sp]["target"]);
      setpoint = {
        "x":_TESTING_?nextStep:60*nextStep,
        "y":profileData[sp]["target"]
      };
      profileLineData.push(setpoint);
      //console.log("pdata: " + setpoint["x"] + " : " + setpoint["y"]);

      nextStep += resolveGraphTimeValue(profileData[sp]["duration"]);
    }
    //console.log("profileLineData: " + JSON.stringify(profileLineData));

    // Find extent of values in profileLineData
    var maxTime = 0.0;
    //var maxDataPoint = 0.0;
    //var minDataPoint = 1000.0;
    //var minProfile = min(profileLineData, function(d) {return parseFloat(d.y);});
    //var maxProfile = max(profileLineData, function(d) {return parseFloat(d.y);}) + 1.0;
    var maxProfileTime = max(profileLineData, function(d) {return parseFloat(d.x);});

    var maxDataPoint = max(profileLineData, function(d) {
      return parseFloat(d.y) + 5;
    });
    var minDataPoint = min(profileLineData, function(d) {
      return parseFloat(d.y) - 5;
    });
    //if ( minProfile < minDataPoint ) minDataPoint = minProfile;
    //if ( maxProfile > maxDataPoint ) maxDataPoint = maxProfile;
    if ( maxProfileTime > maxTime ) maxTime = maxProfileTime;

    // Scale & axes
    var templateLinearScaleY = scaleLinear()
      .domain([minDataPoint,maxDataPoint])
      .range([templateProfileGraphHeight,0]);
    var templateYAxis = axisLeft(templateLinearScaleY)
      .tickSize(-4)
      .ticks(2);
      //.tickValues(makeTickValues(maxDataPoint,4));
    //var templateYAxisGroup = templateProfileGraphHolder.append("g")
    templateProfileGraphHolder.append("g")
      .attr("transform", "translate(" + templateProfileGraphMargin.left + "," + templateProfileGraphMargin.top + ")")
      .attr('stroke-width', 2)
      .attr('stroke', 'black')
      .attr('fill', 'none')
      .call(templateYAxis);
    var templateLinearScaleX = scaleTime()
      .domain([0,maxTime])
      .range([0,templateProfileGraphWidth]);
    var templateXAxis = axisBottom(templateLinearScaleX)
      .tickSize(-4)
      .ticks(5);
      //.tickValues(makeTickValues(maxTime,18*graphWidthScale));
    //var templateXAxisGroup = templateProfileGraphHolder.append("g")
    templateProfileGraphHolder.append("g")
      .attr('class', 'x templateAxis')
      .attr("transform", "translate(" + templateProfileGraphMargin.left + "," + (templateProfileGraphHeight + templateProfileGraphMargin.top) + ")")
      .attr('stroke-width', 2)
      .attr('stroke', 'black')
      .attr('fill', 'none')
      .call(templateXAxis);
    // Custom tick format
    //templateProfileGraphHolder.selectAll('.x.templateAxis text').text(function(d) { return tickText(d) });

    // Scale profile data
    var scaledProfileLineData = [];
    for (sp=0;sp<profileLineData.length;sp++) {
      //console.log("scaled sp = " + profileLineData[sp].x + " : " + profileLineData[sp].y);
      scaledProfileLineData.push({
        "x":templateLinearScaleX(profileLineData[sp].x),
        "y":templateLinearScaleY(profileLineData[sp].y)});
    }
    // Draw profile graph
    var templateProfileLineFunction = line()
      .x(function(d) { return d.x; })
      .y(function(d) { return d.y; });

    //var lineGraph = templateProfileGraphHolder.append("path")
    templateProfileGraphHolder.append("path")
      .attr("transform", "translate(" + templateProfileGraphMargin.left + "," + templateProfileGraphMargin.top + ")")
      .attr("d", templateProfileLineFunction(scaledProfileLineData))
      .attr("stroke", "gray")
      .attr("stroke-width", 2)
      .attr("fill", "none");
  }

  function replace_job(profileOwner) {
    console.log("Don't forget to save the changed job!");
    var i;
    var elemId = profileOwner.replace('tiProfile_', '');
    console.log("template id = " + elemId);

    var jobName = document.getElementById('tiName_' + elemId).innerHTML;
    var jobPreHeat = document.getElementById('tiPreheat_' + elemId).getAttribute('isset')=="true"?true:false;
    var saveJobProfile = JSON.parse(document.getElementById(profileOwner).getAttribute('pdata'));

    var sensors = document.getElementById('tiSensors_' + elemId).getAttribute ('sensors').split(',');
    var useSensors = [];
    for (i=0;i<sensors.length;i++) { useSensors.push(sensors[i]); }

    var relays = document.getElementById('tiRelays_' + elemId).getAttribute ('relays').split(',');
    var useRelays = [];
    for (i=0;i<relays.length;i++) { useRelays.push(relays[i]); }

    var jobData = {
      name: jobName,
      preheat: jobPreHeat,
      profile: saveJobProfile,
      sensors: useSensors,
      relays:	useRelays
    };
    console.log("jobData = " + JSON.stringify(jobData));
    var msgobj = {type:'replace_job', data:jobData};
    sendMessage({data:JSON.stringify(msgobj)});
  }


  /* END PROFILES */

  /***************** START JOBS Templates/Composer/History  *******************/
  console.log("START JOBS");

  //document.addEventListener('profilesLoadedEvent', function (e) {
  document.addEventListener('profilesLoadedEvent', function () {
    //Clear the job name
    //document.getElementById("jobName").value = "";

    // Ask for available sensors & relays
    var msgobj = {type:'list_sensors', data:[]};
    sendMessage({data:JSON.stringify(msgobj)});

    msgobj = {type:'list_relays', data:[]};
    sendMessage({data:JSON.stringify(msgobj)});

    // Request job data
    msgobj = {type:'load_jobs', data:[]};
    sendMessage({data:JSON.stringify(msgobj)});

  }, false);

  // Generate a listing of stored job templates
  function createJobTemplatesList(data) {
    console.log("Reached createJobTemplatesList() ...");
    var j;
    var jobTemplatesListHolder = document.getElementById("jobTemplatesListHolder");
    var toolTipDiv = select("body")
      .append("div")
      .attr('class', 'templateItemTooltip')
      .style('opacity', 0.0)
      .style('left', '200px')
      .style('top', '200px');
      //.style('display', 'none');

    // First remove existing list elements
    while ( jobTemplatesListHolder.hasChildNodes() ) {
      jobTemplatesListHolder.removeChild(jobTemplatesListHolder.firstChild);
    }

    for (var i=0;i<data.length;i++) {
      var thisJob = data[i];
      var name = thisJob['name'];
      //var preheat = "Preheat OFF";
      //if ( thisJob['preheat'] ) {
      //  preheat = "Preheat  ON";
      //}

      var templateItem = document.createElement('DIV');
      templateItem.id = 'ti_' + i;
      templateItem.className = 'templateItem';


      var templateItemName = document.createElement('LABEL');
      templateItemName.id = 'tiName_' + i;
      templateItemName.className = 'templateItemName unselectable';
      templateItemName.textContent = name;
      templateItemName.setAttribute('templateItemIndex', i);

      var templateItemPreheat = document.createElement('LABEL');
      templateItemPreheat.id = 'tiPreheat_' + i;
      templateItemPreheat.className = 'templateItemPreheat unselectable';
      templateItemPreheat.innerHTML = '<center>Preset<br>Heat/Cool</center>';
      templateItemPreheat.setAttribute('isSet', thisJob['preheat']);
      if (templateItemPreheat.getAttribute('isSet') === 'true') {
        templateItemPreheat.innerHTML = '<center>Pre Heat<br><b>ON</b></center>';
      } else {
        templateItemPreheat.innerHTML = '<center>Pre Heat<br><b>OFF</b></center>';
      }

      var templateItemSensors = document.createElement('LABEL');
      templateItemSensors.id = 'tiSensors_' + i;
      templateItemSensors.className = 'templateItemSensors unselectable';
      templateItemSensors.textContent = 'Sensors';
      var loadedSensors = [];
      for (j=0;j<thisJob['sensors'].length;j++) {
        loadedSensors.push(thisJob['sensors'][j]);
      }
      //console.log(name + ' sensors: ' + loadedSensors);
      templateItemSensors.setAttribute('sensors', loadedSensors);

      var templateItemRelays = document.createElement('LABEL');
      templateItemRelays.id = 'tiRelays_' + i;
      templateItemRelays.className = 'templateItemRelays unselectable';
      templateItemRelays.textContent = 'Relays';
      var loadedRelays = [];
      for (j=0;j<thisJob['relays'].length;j++) {
        loadedRelays.push(thisJob['relays'][j]);
      }
      //console.log(name + ' relays: ' + loadedRelays);
      templateItemRelays.setAttribute('relays', loadedRelays);

      var templateItemProfile = document.createElement('DIV');
      templateItemProfile.id = 'tiProfile_' + i;
      templateItemProfile.className = 'templateItemProfile generic_graph';
      var loadedProfile = [];
      for (var k=0;k<thisJob['profile'].length;k++) {
        //console.log('profile step for ' + name + ': ' + thisJob['profile'][k].target + ' . ' + thisJob['profile'][k].duration);
        loadedProfile.push({'target':thisJob['profile'][k].target,'duration':thisJob['profile'][k].duration});
      }
      //console.log("Proposed pdata = " + JSON.stringify(loadedProfile));
      templateItemProfile.setAttribute('pdata', JSON.stringify(loadedProfile));


      templateItem.appendChild(templateItemName);
      templateItem.appendChild(templateItemPreheat);
      templateItem.appendChild(templateItemSensors);
      templateItem.appendChild(templateItemRelays);
      templateItem.appendChild(templateItemProfile);

      jobTemplatesListHolder.appendChild(templateItem);

      // Draw the profile graph for this template item
      updateTemplateProfile({owner:templateItemProfile.id});

      // Start of templateItemName menu
      var templateItemNameMenu = [{
        title: 'Delete',
        action: function(elm, data, index) {
          console.log('menu item #3 from ' + elm.id + " " + data.title + " " + index);
          var templateItemIndex = elm.getAttribute('templateItemIndex');
          var jobName = elm.textContent;

          if ( templateItemIndex < 0 )
            return;

          var confirmDelete = confirm("Delete job " + jobName + "?");
          if ( confirmDelete == true ) {
            // Request job deletion
            //var jobData = { index: parseInt(templateItemIndex) };
            var msgobj = {
              type:'delete_job',
              data:{
                index: parseInt(templateItemIndex),
                name: jobName
              }
            };
            sendMessage({data:JSON.stringify(msgobj)});
          } else {
            return;
          }
        }
      }, {
        title: 'New',
        action: function(elm, data, index) {
          console.log('menu item #2 from ' + elm.id + " " + data.title + " " + index);

          var jobComposer = document.getElementById("jobComposer");
          if ( jobComposer.style.display == 'block') {
            jobComposer.style.display = 'none';
          } else {
            jobComposer.style.display = 'block';
            var c = document.getElementById("jobItemsHolder").children;
            //var itemsWidth = 0;
            var tallest = 0;
            for (var i=0;i<c.length;i++) {
              //itemsWidth += parseInt(window.getComputedStyle(c[i]).width.replace(/\D+/g, ''));
              var itemHeight = parseInt(window.getComputedStyle(c[i]).height.replace(/\D+/g, ''));
              if (itemHeight > tallest ) tallest = itemHeight;
            }
          }
        }
      }, {
        title: 'Refresh',
        action: function(elm, data, index) {
          console.log('menu item #1 from ' + elm.id + " " + data.title + " " + index);
          console.log("REFRESH job button clicked");

          // Request job data
          var msgobj = {type:'load_jobs', data:[]};
          sendMessage({data:JSON.stringify(msgobj)});
        }
      }, {
        title: 'Run',
        //action: function(elm, data, index) {
        action: function(elm) {
          //console.log('menu item #4 from ' + elm.id + " " + data.title + " " + index);
          var templateItemIndex = elm.getAttribute('templateItemIndex');
          var jobName = elm.textContent;

          var confirmRun = confirm("Run job " + jobName + "?");
          if ( confirmRun == true ) {
            // Request job run
            var msgobj = {
              type:'run_job',
              data:{index: parseInt(templateItemIndex), name: jobName }
            };
            sendMessage({data:JSON.stringify(msgobj)});

            // Now go to status page to view job progress
            document.getElementById("no_running_jobs").innerHTML = "Waiting for job " + jobName + " to start";
            location.href = "#content_1";
          } else {
            return;
          }
        }
      }];
      // End of popup menu

      selectAll('.templateItemName')
        //.on('click', function(data, index) {
        .on('click', function() {
          var elm = this;

          // create the div element that will hold the context menu
          selectAll('.context-menu').data([1])
            .enter()
            .append('div')
            .attr('class', 'context-menu');

          // an ordinary click anywhere closes menu
          select('body').on('click.context-menu', function() {
            select('.context-menu').style('display', 'none');
          });

          // this is executed when a contextmenu event occurs
          selectAll('.context-menu')
            .html('<center><p><b>Template Options</b></p></center><hr>')
            .append('ul')
            .selectAll('li')
            .data(templateItemNameMenu).enter()
            .append('li')
            .on('click',function(d) {
              console.log('popup selected: ' + d.title);
              d.action(elm, d, i);
              select('.context-menu')
                .style('display', 'none');
              return d;
            })
            .text(function(d) {return d.title;});
          select('.context-menu').style('display', 'none');

          // show the context menu
          select('.context-menu')
            .style('left', (event.pageX - 96) + 'px')
            .style('top', (event.pageY - 148) + 'px')
            .style('display', 'block');
          event.preventDefault();

          event.stopPropagation();
        });


      // templateItemSensors tooltip
      selectAll('.templateItemSensors')
        .on('click', function() {
          //console.log('click on Sensors');
          if (toolTipDiv.style('opacity') == 0.0) {
            var sensors = this.getAttribute('sensors').split(',');
            var sensorsText = '<center>';
            for (var i=0;i<sensors.length;i++) {
              sensorsText = sensorsText + sensors[i] + '<br>';
            }
            sensorsText = sensorsText + '</center>';
            toolTipDiv.style('opacity', 0.9)
              .html(sensorsText)
              .style('left', (getOffsetRect(this).left - 34) + 'px')
              .style('top', (getOffsetRect(this).top + 12) + 'px');
          } else {
            toolTipDiv.style('opacity', 0.0);
          }
        });

      // templateItemRelays tooltip
      selectAll('.templateItemRelays')
        .on('click', function() {
          //console.log('click on Relays');
          if (toolTipDiv.style('opacity') == 0.0) {
            var relays = this.getAttribute('relays').split(',');
            var relaysText = '<center>';
            for (var i=0;i<relays.length;i++) {
              relaysText = relaysText + relays[i] + '<br>';
            }
            relaysText = relaysText + '</center>';
            toolTipDiv.style('opacity', 0.9)
              .html(relaysText)
              .style('left', (getOffsetRect(this).left - 34) + 'px')
              .style('top', (getOffsetRect(this).top + 12) + 'px');
          } else {
            toolTipDiv.style('opacity', 0.0);
          }
        });
    }
    for (var f=0;f<data.length;f++) {
      (function(f) {
        document.getElementById("tiProfile_" + f).onclick = function() {
          location.href = '#content_3';
          var templateItemProfile = document.getElementById("tiProfile_" + f);
          //console.log("XXXX: " + templateItemProfile.getAttribute('pdata'));
          updateProfileGraph(
            {data:JSON.parse(templateItemProfile.getAttribute('pdata')),
              owner:templateItemProfile.id});
        };
      })(f);
    }

  } // End function createJobTemplatesList()

  // Display the job Composer
  //var jobTemplatesHolder = document.getElementById('jobTemplatesHolder');
  jobTemplatesHolder = document.getElementById('jobTemplatesHolder');
  jobTemplatesHolder.onclick = function(e) {
    //console.log('Target: ' + e.target.id);
    if (e.target.id != 'jobTemplatesHolder') return;

    var jobComposer = document.getElementById("jobComposer");
    if ( jobComposer.style.display != 'block') {
      jobComposer.style.display = 'block';
      // Reset jobName & profile data
      document.getElementById("jobName").value = "";
      document.getElementById("jobProfileHolder").setAttribute('pdata', JSON.stringify(defaultJobProfileData()));
      // Reset Sensors selector
      var sensorItems = document.getElementsByClassName("sensorSelectorItem");
      for (var i=0;i<sensorItems.length;i++ ) {
        document.getElementById("as_" + i).checked = false;
      }
      // Reset Relays selector
      var relayItems = document.getElementsByClassName("relaySelectorItem");
      for (var ii=0;ii<relayItems.length;ii++ ) {
        document.getElementById("ar_" + ii).checked = false;
      }
    }
    e.stopPropagation();
    return false;
  };

  // Dismiss the job composer
  //var dismissJobComposerButton = document.getElementById('dismissJobComposerButton');
  dismissJobComposerButton = document.getElementById('dismissJobComposerButton');
  dismissJobComposerButton.onclick = function() {
    var jobComposer = document.getElementById("jobComposer");
    if ( jobComposer.style.display != 'none') {
      jobComposer.style.display = 'none';
    }
  };

  // Save a new job from job composer
  var saveNewJobButton = document.getElementById("jobSaveButton");
  saveNewJobButton.onclick = function() {
    console.log("SAVE new job");
    var OKtoSave = true;

    // Collect the job name, substituting whitespaces with single underscores
    var jobName = document.getElementById('jobName')
      .value
      .trim()
      .replace(/\s+/g, '_');
    if ( jobName.length == 0 ) {
      OKtoSave = false;
      alert("Please set a name for this job");
      return;
    }
    // Check for name duplication
    // TODO
    var tiNames = document.getElementsByClassName("templateItemName");
    for (var i=0;i<tiNames.length;i++) {
      if ( tiNames[i].innerHTML == jobName ) {
        alert("The name " + jobName + " is already used. Please choose a new name");
        return;
      }
    }

    // Disallowed characters in job name?
    if ( /\./g.test(jobName) ) {
      alert("\".\" character not allowed in job name - please change it");
      return;
    }

    // Collect whether to preheat/cool
    //var jobPreHeat = false;
    //if (document.getElementById("selectPreHeat").checked) {
    //  jobPreHeat = true;
    //}

    // Collect time/temp steps from job composer profile.
    var saveJobProfile = JSON.parse(document.getElementById("jobProfileHolder").getAttribute("pdata"));

    /*
    // Add a "zero,zero" setpoint.
    if (tempType == 'F') {
      setpoint = {target:32.0, duration:'0.0'};
    } else {
      setpoint = {target:0.0, duration:'0.0'};
    }
    saveJobProfile.push(setpoint);
    console.log("Added setpoint " + setpoint);
    */

    // Collect which sensor(s) to use
    var table = document.getElementsByClassName("sensorSelectorItem");
    var useSensors = [];

    for (var ii=0;ii<table.length;ii++) {
      var cell = document.getElementById("as_" + ii);
      //console.log("checking " + document.getElementById("label_as_" + ii).textContent);
      if ( cell.checked ) {
        //useSensors.push(document.getElementById("label_as_" + ii).textContent);
        useSensors.push(document.getElementById("label_as_" + ii).textContent.toString().split(" ").pop());
      }
    }
    //console.log("Sensors checked: " + useSensors);
    if ( useSensors.length == 0 ) {
      OKtoSave = false;
      alert("Please select a temperature sensor");
      return;
    }

    // Collect which relay(s) to use
    var useRelays = [];

    table = document.getElementsByClassName("relaySelectorItem");
    for (var iii=0;iii<table.length;iii++) {
      cell = document.getElementById("ar_" + iii);
      //console.log("checking " + document.getElementById("label_ar_" + iii).textContent);
      if ( cell.checked ) {
        useRelays.push(document.getElementById("label_ar_" + iii).textContent);
      }
    }
    //console.log("Relays checked: " + useRelays);
    if ( useRelays.length == 0 ) {
      OKtoSave = false;
      alert("Please select a relay");
      return;
    }

    if ( OKtoSave ) {
      var jobData = {
        name: jobName,
        preheat: jobPreHeat,
        profile: saveJobProfile,
        sensors: useSensors,
        relays:	useRelays
      };
      var msgobj = {type:'save_job', data:jobData};
      sendMessage({data:JSON.stringify(msgobj)});

      // Dismiss the composer
      var jobComposer = document.getElementById("jobComposer");
      if ( jobComposer.style.display != 'none') {
        jobComposer.style.display = 'none';
      }
    } else {
      console.log("NOT OKtoSave");
    }
  };

  // Create a sensor selector based on data from server (availableSensors)
  function createSensorSelector() {
    console.log("Reached createSensorSelector() " + availableSensors);

    var i, selectorItem, check, checkLabel;
    var selector = document.getElementById("jobSensorsHolder");

    // First remove existing list elements
    while ( selector.hasChildNodes() ) {
      selector.removeChild(selector.firstChild);
    }

    var sensorSelectorLabel = document.createElement("LABEL");
    sensorSelectorLabel.textContent = "Sensors";
    sensorSelectorLabel.id = 'sensorSelectorLabel';
    sensorSelectorLabel.className = 'selectorLabel unselectable';

    selector.appendChild(sensorSelectorLabel);

    for(i=0;i<availableSensors.length;i++) {
      console.log("Adding sensor: " + availableSensors[i]);

      selectorItem = document.createElement("DIV");
      selectorItem.id = 'sensorSelectorItem_' + i;
      selectorItem.className = 'sensorSelectorItem';

      check = document.createElement("INPUT");
      check.type = "checkbox";
      check.id = "as_" + i;

      checkLabel = document.createElement("LABEL");
      checkLabel.setAttribute("for", "as_" + i);
      checkLabel.textContent = availableSensors[i];
      checkLabel.id = "label_as_" + i;
      checkLabel.className = "unselectable";

      selectorItem.appendChild(check);
      selectorItem.appendChild(checkLabel);

      selector.appendChild(selectorItem);
    }
    var base = i;
    // Add iSpindels
    console.log("Have " + iSpindelDevices.length + " iSpindels to add");
    for(i=0;i<iSpindelDevices.length;i++) {
      console.log("Adding iSpindel sensor: " + iSpindelDevices[i].chipId);

      selectorItem = document.createElement("DIV");
      selectorItem.id = 'sensorSelectorItem_' + (i + base);
      selectorItem.className = 'sensorSelectorItem';

      check = document.createElement("INPUT");
      check.type = "checkbox";
      check.id = "as_" + (i+base);

      checkLabel = document.createElement("LABEL");
      checkLabel.setAttribute("for", "as_" + (i+base));
      checkLabel.textContent = "iSpindel " + iSpindelDevices[i].chipId;
      checkLabel.title = iSpindelDevices[i].name;
      checkLabel.id = "label_as_" + (i+base);
      checkLabel.className = "unselectable";

      selectorItem.appendChild(check);
      selectorItem.appendChild(checkLabel);

      selector.appendChild(selectorItem);
    }
  }

  // Create a relay selector based on data from server
  function createRelaySelector(relays) {
    console.log("Reached createRelaySelector() " + relays);

    var selector = document.getElementById("jobRelaysHolder");

    // First remove existing list elements
    while ( selector.hasChildNodes() ) {
      selector.removeChild(selector.firstChild);
    }

    var relaySelectorLabel = document.createElement("LABEL");
    relaySelectorLabel.textContent = "Relays";
    relaySelectorLabel.id = 'relaySelectorLabel';
    relaySelectorLabel.className = 'selectorLabel unselectable';

    selector.appendChild(relaySelectorLabel);

    for(var i=0;i<relays.length;i++) {
      console.log("Adding relay: " + relays[i]);

      var selectorItem = document.createElement("DIV");
      selectorItem.id = 'relaySelectorItem_' + i;
      selectorItem.className = 'relaySelectorItem';

      var check = document.createElement("INPUT");
      check.type = "checkbox";
      check.id = "ar_" + i;

      var checkLabel = document.createElement("LABEL");
      checkLabel.setAttribute("for", "ar_" + i);
      checkLabel.textContent = relays[i];
      checkLabel.id = "label_ar_" + i;
      checkLabel.className = "unselectable";

      selectorItem.appendChild(check);
      selectorItem.appendChild(checkLabel);

      selector.appendChild(selectorItem);
    }
  }


/* END PROFILES */

//});
};

/*
ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab:
*/
