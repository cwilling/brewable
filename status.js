//window.onload = function () {
//  console.log("Window.onload()");
//};

var _TESTING_ = false;
var navigationMap = {};
var global_x = 0;

var INTERPOLATE_profile_template = "step-after";
var INTERPOLATE_profile_editor = "step-after";
var INTERPOLATE_profile_history = "step-after";

var availableSensors = [];
var availableRelays  = [];

var profileData = [];
var profileDisplayData = [];        // "processed" data for display
var profileLinearScaleY = [];
var profileLinearScaleX = [];
var temperatureColours = ["blue", "green", "red", "orange"];
var profileLineColours = ["green", "red", "orange", "blue"];
var pfCtrlKey = false;
var pfCurrentDot = {"id":"none"};

/* Save JobHistory data here */
var historyData = {};
var runningData = {};

function smallDevice () {
  return window.innerWidth<1000?true:false;
}

/* Convert text from profile editor into time units.
*/
function resolveGraphTimeValue(rawval) {
  var pieces = rawval.split(".");
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

var domReady = function(callback) {
  document.readyState === "interactive" ||
  document.readyState === "complete" ? callback() : document.addEventListener("DOMContentLoaded", callback);
};

/* Return top left corner of enclosing element
   From: http://javascript.info/tutorial/coordinates
*/
function getOffsetRect(elem) {
  // (1)
  var box = elem.getBoundingClientRect()

  var body = document.body
  var docElem = document.documentElement

  // (2)
  var scrollTop = window.pageYOffset || docElem.scrollTop || body.scrollTop
  var scrollLeft = window.pageXOffset || docElem.scrollLeft || body.scrollLeft

  // (3)
  var clientTop = docElem.clientTop || body.clientTop || 0
  var clientLeft = docElem.clientLeft || body.clientLeft || 0

  // (4)
  var top  = box.top +  scrollTop - clientTop
  var left = box.left + scrollLeft - clientLeft

  return { top: Math.round(top), left: Math.round(left) }
}


// main()
//domReady( function(){
//$(document).ready( function()
window.onload = function () {

  var profilesLoadedEvent = new Event('profilesLoadedEvent');

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
    no_running_jobs.innerHTML = "No &nbsp<a href=#content_2>jobs</a>&nbsp are currently running"
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
      jobProfileHolder.onclick = function (e) {
        console.log("Edit the profile");
        location.href = '#content_3';

        /* updateProfileGraph() wants data to be an object */
        updateProfileGraph({
            data:JSON.parse(document.getElementById("jobProfileHolder").getAttribute('pdata')),
            owner:'jobProfileHolder'
        });
      }

      jobProfileHolder.appendChild(jobProfileHolderLabel);
      jobItemsHolder.appendChild(jobProfileHolder);

      // Item 5: Sensors
      var jobSensorsHolder = document.createElement('DIV');
      jobSensorsHolder.id = 'jobSensorsHolder';
      jobSensorsHolder.className = 'jobDevicesHolder';
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

  content_2.appendChild(jobTemplatesTitle);
  content_2.appendChild(jobTemplatesHolder);
  content_2.appendChild(jobComposer);

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
  var profileTooltip = d3.select("body").append("div")
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
  }
  socket.onopen = function(){  
    console.log("websocket connected"); 

    // Ask for whatever is needed to startup
    msgobj = {type:'load_startup_data', data:[]};
    sendMessage({data:JSON.stringify(msgobj)});
  };

  // Handle received messages
  socket.onmessage = function (message) {
    var jmsg;
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
      } else if (jmsg.type === 'running_job_status') {
        console.log("RCVD running_job_status " + message.data);
        updateRunningJob(jmsg.data);
      } else if (jmsg.type === 'relay_update') {
        //console.log("RCVD relay_update " + message.data);
        relay_update(jmsg);
      } else if (jmsg.type === 'sensor_list' ) {
        console.log("RCVD sensor_list " + message.data);
        // Keep a copy for later
        availableSensors = [];
        while (availableSensors.length > 0) {availableSensors.pop();}
        for (var i=0;i<jmsg.data.length;i++) {
          availableSensors.push(jmsg.data[i]);
        }
        createSensorSelector(availableSensors);
      } else if (jmsg.type === 'relay_list' ) {
        console.log("RCVD relay_list " + message.data);
        availableRelays = [];
        while (availableRelays.length > 0) {availableRelays.pop();}
        for (var i=0;i<jmsg.data.length;i++) {
          availableRelays.push(jmsg.data[i]);
        }
        createRelaySelector(availableRelays);
      } else if (jmsg.type === 'loaded_jobs' ) {
        console.log("RCVD loaded_jobs " + message.data);
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
  }

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
    //console.log("Rcvd live_update");

    // Label for Sensors
    var elementName = 'sensor_update_title';
    if ( ! document.body.contains(document.getElementById(elementName)) ) {
      var sensor_updateHolder = document.getElementById('sensor_updateHolder');
      var asensor = document.createElement('DIV');
      asensor.id = elementName;
      asensor.className = 'sensor_update';
      asensor.style.width = '128px';
      asensor.setAttribute('tempScale', 'C');
      asensor.oncontextmenu = function(e) { return false; };
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

    for (var i=0;i<sensor_state.length;i++) {
      //console.log("sensor_state: " + sensor_state[i].sensorId + " = " + sensor_state[i].temperature);
      var elementName = 'sensor_update_' + sensor_state[i].sensorId;
      if ( ! document.body.contains(document.getElementById(elementName)) ) {
        sensor_updateHolder = document.getElementById('sensor_updateHolder');
        var asensor = document.createElement("DIV");
        asensor.id = elementName;
        asensor.title = sensor_state[i].sensorId;
        asensor.className = 'sensor_update';
        asensor.style.width = '128px';
        asensor.oncontextmenu = function(e) { return false; };
        asensor.onmousedown = function(e) {
          console.log("Pressed button " + e.button + " at " + this.id);
        };
        sensor_updateHolder.appendChild(asensor);
      }
      if (tempScale == 'F') {
        document.getElementById(elementName).textContent = ((parseFloat(sensor_state[i].temperature) * 9 / 5 ) + 32).toFixed(2);
      } else {
        document.getElementById(elementName).textContent = (sensor_state[i].temperature).toFixed(2);
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
      arelay.oncontextmenu = function(e) { return false; };
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
    for (var i=0;i<relay_state.length;i++) {
      var elementName = 'relay_update_' + i;
      if ( ! document.body.contains(document.getElementById(elementName)) ) {
        relay_updateHolder = document.getElementById('relay_updateHolder');
        var arelay = document.createElement("DIV");
        arelay.id = elementName;
        arelay.className = 'relay_update';
        arelay.style.width = '128px';
        arelay.oncontextmenu = function(e) { return false; };
        arelay.onmousedown = function(e) {
          switch (e.button) {
            case 0:
              //send_relay_cmd(parseInt(this.id.charAt(this.id.length-1)) + 1);
    msgobj = {type:'toggle_relay', data:[parseInt(this.id.charAt(this.id.length-1)) + 1]};
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

    for (var k in data_keys ) {
      if (data_keys[k] == 'testing') {
        _TESTING_ = data[data_keys[k]];
        console.log("_TESTING_ mode is " + _TESTING_);
      } else if (data_keys[k] == 'config') {
        // If configEntryHolder exists, remove all child nodes; otherwise create configEntryHolder
        if ( document.body.contains(document.getElementById('configEntryHolder')) ) {
          var configEntryHolder = document.getElementById('configEntryHolder');
          var last;
          while (last = configEntryHolder.lastChild) configEntryHolder.removeChild(last);
        } else {
          var configEntryHolder = document.createElement('DIV');
          configEntryHolder.id = 'configEntryHolder';
          document.getElementById('configHolder').appendChild(configEntryHolder);
        }
        build_config_entries(data[data_keys[k]]);
        //var configKeys = data[data_keys[k]];
        //for (var key in configKeys) {
        //  console.log("configKey: " + key);
        //}
      } else if (data_keys[k] == 'the_end') {
        var the_end_unused = data[data_keys[k]];
        //console.log("the_end: " + the_end_unused);
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
    while (last = runningJobsHolder.lastChild) runningJobsHolder.removeChild(last);

    var longJobNames = [];
    data.forEach( function (job, index) {
      console.log("WWW");
      var header = job['header'];
      var updates = job['updates'];
      var longName = header['jobName'] + '-' + header['jobInstance'];
      var saveData = {};

      console.log("Creating listing for job: " + index + " (" + longName + ")");
      longJobNames.push(longName);

      // Save the data for later use. It should consist of two arrays,
      // 1st with just the job header and 2nd with an array of status updates
      // (for a running job, updates will periodically be added to
      saveData['header'] = [header];
      saveData['updates'] = updates;
      runningData[longName] = saveData;
      console.log("XXX " + JSON.stringify(runningData[longName]));
    });
    console.log("ZZZ");
    updateJobsList(longJobNames, 'running_jobsHolder');
  }

  function updateRunningJob(data) {
    console.log("updateRunningJob() " + JSON.stringify(data));
    if ( 'sensors' in data ) {
      var longJobName = data['jobName'] + '-' + data['jobInstance'];
      console.log("updateRunningJob() longJobName " + longJobName);
      runningData[longJobName]['updates'].push(data);
      console.log("updateRunningJob() longJobName 2 " + longJobName);
      updateJobHistoryData(0, longJobName)
    } else {
      console.log("Received dummy update for " + data.jobName);
    }
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
        for (var sensor in configItems[key]) {
          //console.log("Sensor: " + sensor + " = " + configItems[key][sensor]);
          var configItemDataValue = document.createElement('DIV');
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
            console.log("key: " + this.id + "  " + this.id.replace(/.+_/,''));
            var idata = {};
            idata['sensorFudgeFactors'] = this.id.replace(/.+_/,'');
            idata['fudge'] = this.value;
            msgobj = {type:'config_change', data:idata};
            sendMessage({data:JSON.stringify(msgobj)});
          }

          configItemDataValue.appendChild(configItemSensorName);
          configItemDataValue.appendChild(configItemSensorFudge);
          configItemData.appendChild(configItemDataValue);
        }
      } else {
        var configItemDataValue = document.createElement('DIV');
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
        }

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
    console.log("updateJobHistoryData(): jobLongName " + jobLongName);

    // Is it new (via data parameter) or are we redrawing stored data?
    if ( jobLongName === undefined ) {
      // We must have data supplied by parameter
      var header = data['header'];
      var updates = data['updates'];
      var longName = header[0]['jobName'] + '-' + header[0]['jobInstance'];
      historyData[longName] = data;
    } else {
      // Must have previously saved data

      if ( historyData.hasOwnProperty(jobLongName) ) {
        // It's a saved job
        var header = historyData[jobLongName]['header'];
        var updates = historyData[jobLongName]['updates'];
        var longName = header[0]['jobName'] + '-' + header[0]['jobInstance'];
      } else {
        // Must be a running job
        var header = runningData[jobLongName]['header'];
        var updates = runningData[jobLongName]['updates'];
        var longName = header[0]['jobName'] + '-' + header[0]['jobInstance'];
        //console.log("updateJobHistoryData() 1 longName: " + longName);
        //console.log("updateJobHistoryData() 2 updates =  " + updates.length);
        console.log("updateJobHistoryData() 3 updates =  " + JSON.stringify(updates));
      }
      //var longName = header[0]['jobName'] + '-' + header[0]['jobInstance'];
    }
    //console.log("updateJobHistoryData() longName: " + longName);

/* Examples of extracting various fields
    console.log("updateJobHistoryData() jobProfile: " + header[0]['jobProfile'] + " " + header[0]['jobProfile'].length);
    console.log("updateJobHistoryData() jobName: " + header[0]['jobName'] + " " + header.length);
    console.log("updateJobHistoryData() updates: " + updates + " " + updates.length);
    for (var i=0;i<updates.length;i++) {
      console.log("updateJobHistoryData() temp at " + parseFloat(updates[i]['elapsed']).toFixed(2) + " = " + updates[i][updates[i]['sensors'][0]]);
    }
*/

    var holderNode = document.getElementById('jobElementGraph_' + longName)
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

    if ( smallDevice() ) {
      console.log("smallDevice is TRUE");
      var historyJobsGraphMargin = {top: 24, right: 40, bottom: 60, left: 40};
      var historyJobsGraphHeight = 192 - (historyJobsGraphMargin.top + historyJobsGraphMargin.bottom);
    } else {
      console.log("smallDevice is FALSE");
      var historyJobsGraphMargin = {top: 32, right: 40, bottom: 60, left: 80};
      var historyJobsGraphHeight = 256 - (historyJobsGraphMargin.top + historyJobsGraphMargin.bottom);
    }
    var historyJobsGraphWidth = graphWidthScale*window.innerWidth - (historyJobsGraphMargin.left + historyJobsGraphMargin.right) - 20;
/* (original)
    var historyJobsGraphMargin = {top: 20, right: 40, bottom: 50, left: 60},
        historyJobsGraphWidth = graphWidthScale*1800 - historyJobsGraphMargin.left - historyJobsGraphMargin.right,
        historyJobsGraphHeight = 256 - historyJobsGraphMargin.top - historyJobsGraphMargin.bottom;
*/

    // Draw the graph of job history
    d3.select("#history_" + longName.replace('%', '\\%')).remove();
    var historyJobsGraphHolder = d3.select("#jobElementGraph_" + longName.replace('%', '\\%')).append("svg")
                      .attr("id", "history_" + longName.replace('%', '\%'))
                      .attr("class", "history_job")
                      .attr("width", historyJobsGraphWidth + historyJobsGraphMargin.right + historyJobsGraphMargin.left)
                      .attr("height", historyJobsGraphHeight + historyJobsGraphMargin.top + historyJobsGraphMargin.bottom)
                      .style("border", "1px solid black")

    // Extract profile & temperature data into local arrays
    var profileData = header[0]['jobProfile'];
    var profileLineData = [];
    var temperatureLineDataHolder = []
    var temperatureLineData = []
    var setpoint = {};
    var nextStep = 0.0;
    for (var sp=0;sp<profileData.length;sp++) {
      setpoint = {"x":nextStep,
                  "y":profileData[sp]["target"]};
      profileLineData.push(setpoint);
      nextStep += parseFloat(profileData[sp]["duration"]);
      //console.log("**** updateJobHistoryData() profile: " + setpoint["x"] + " : " + setpoint["y"]);
    }
    // Extract temperature data for all sensors
    for (var sensor_instance=0;sensor_instance<header[0]['jobSensorIds'].length;sensor_instance++) {
      //console.log("updateJobHistoryData() sensor name: " + header[0]['jobSensorIds'][sensor_instance]);
      var sensorName = header[0]['jobSensorIds'][sensor_instance];

      temperatureLineData = [];
      for (var i=0;i<updates.length;i++) {
        setpoint = {"x":parseFloat(updates[i]['elapsed']).toFixed(2),
                    "y":updates[i][updates[i]['sensors'][sensor_instance]]};
        // Now build a path for this sensor by going through all the history entries
        temperatureLineData.push(setpoint);
        //console.log("**** updateJobHistoryData() temperature: " + setpoint["x"] + " : " + setpoint["y"]);
      }
      temperatureLineDataHolder[sensor_instance] = temperatureLineData;
    }

    // Find extent of values in both profileLineData & all the temperatureLineData arrays (1 for each sensor)
    // N.B. could maybe do this while populating the *LineData arrays
    var minDataPoint = d3.min(profileLineData, function(d) {return parseFloat(d.y);});
    var maxDataPoint = d3.max(profileLineData, function(d) {return parseFloat(d.y);});
    var maxTime = d3.max(profileLineData, function(d) {return parseFloat(d.x);});

    for (var sensor_instance=0;sensor_instance<header[0]['jobSensorIds'].length;sensor_instance++) {
      var temperature = d3.min(temperatureLineDataHolder[sensor_instance], function(d) {return parseFloat(d.y);});
      if (temperature < minDataPoint ) minDataPoint = temperature;
      temperature = d3.max(temperatureLineDataHolder[sensor_instance], function(d) {return parseFloat(d.y);});
      if (temperature > maxDataPoint ) maxDataPoint = temperature;
      temperature = d3.max(temperatureLineDataHolder[sensor_instance], function(d) {return parseFloat(d.x);});
      if ( temperature > maxTime ) maxTime = temperature;
    }
    // Add some clearance
    minDataPoint -= 5;
    maxDataPoint += 5;
    maxTime += 60;


//                      .domain([minDataPoint,maxDataPoint])
    console.log("Min = " + minDataPoint + " Max = " + maxDataPoint);
    var historyLinearScaleY = d3.scale.linear()
                      .domain([minDataPoint, maxDataPoint])
                      .range([historyJobsGraphHeight,0]);
    var historyYAxis = d3.svg.axis()
                      .scale(historyLinearScaleY)
                      .orient("left")
                      .ticks(5);
    var historyYAxisGroup = historyJobsGraphHolder.append("g")
                      .attr('class', 'y historyAxis unselectable')
                      .attr("transform",
                            "translate(" + historyJobsGraphMargin.left + "," + historyJobsGraphMargin.top + ")")
                      .call(historyYAxis);
    var historyLinearScaleX = d3.scale.linear()
                      .domain([0,maxTime])
                      .range([0,historyJobsGraphWidth]);
    var xAxis = d3.svg.axis()
                      .scale(historyLinearScaleX)
                      .orient("bottom")
                      .tickValues(makeTickValues(maxTime,18*graphWidthScale));
                      //.ticks(20);
    var xAxisGroup = historyJobsGraphHolder.append("g")
                      .attr('class', 'x historyAxis unselectable')
                      .attr("transform",
                            "translate(" + historyJobsGraphMargin.left + "," + (historyJobsGraphHeight + historyJobsGraphMargin.top) + ")")
                      .call(xAxis);

    // Custom tick format
    historyJobsGraphHolder.selectAll('.x.historyAxis text').text(function(d) { return tickText(d) });

    // Scale profile data
    var scaledProfileLineData = [];
    for ( var sp=0;sp<profileLineData.length;sp++) {
      //console.log("scaled sp = " + profileLineData[sp].x + " : " + profileLineData[sp].y);
      scaledProfileLineData.push({"x":historyLinearScaleX(profileLineData[sp].x),
                           "y":historyLinearScaleY(profileLineData[sp].y)});
    }
    // Draw profile graph
    var historyProfileLineFunction = d3.svg.line()
                              .x(function(d) { return d.x; })
                              .y(function(d) { return d.y; })
                              .interpolate(INTERPOLATE_profile_history);
    var lineGraph = historyJobsGraphHolder.append("path")
                              .attr("transform",
                                    "translate(" + historyJobsGraphMargin.left + "," + historyJobsGraphMargin.top + ")")
                              .attr("d", historyProfileLineFunction(scaledProfileLineData))
                              .attr("stroke", "gray")
                              .attr("stroke-width", 2)
                              .attr("fill", "none");

      console.log("pre sensor data: ");
      for (var sensor_instance=0;sensor_instance<header[0]['jobSensorIds'].length;sensor_instance++) {
        console.log("sensor data: " + sensor_instance);
        // Scale temperature data
        var scaledTemperatureLineData = [];
        var temperatureLineData = temperatureLineDataHolder[sensor_instance];
        for ( var sp=0;sp<temperatureLineData.length;sp++) {
          //console.log("scaled sp = " + temperatureLineData[sp].x + " : " + temperatureLineData[sp].y);
          scaledTemperatureLineData.push({"x":historyLinearScaleX(temperatureLineData[sp].x),
                                          "y":historyLinearScaleY(temperatureLineData[sp].y)});
        }
        // Draw temperature graph
        var historyTemperatureLineFunction = d3.svg.line()
                                  .x(function(d) { return d.x; })
                                  .y(function(d) { return d.y; })
                                  .interpolate("linear");
        var lineGraph = historyJobsGraphHolder.append("path")
                                  .attr("transform",
                                        "translate(" + historyJobsGraphMargin.left + "," + historyJobsGraphMargin.top + ")")
                                  .attr("d", historyTemperatureLineFunction(scaledTemperatureLineData))
                                  .attr("stroke", temperatureColours[sensor_instance])
                                  .attr("stroke-width", 2)
                                  .attr("fill", "none");
    }
  }

  function updateJobsList(jobfiles, holder) {
    console.log("Reached updateJobsList()");
    var jobFiles = jobfiles;
    var jobsListHolder = document.getElementById(holder);
    var instancePattern = /[0-9]{8}_[0-9]{6}/;

    // First remove existing items
    while ( jobsListHolder.hasChildNodes() ) {
      jobsListHolder.removeChild(jobsListHolder.firstChild);
    }

    // Reverse sort the received list (by instancePattern)
    sortedJobFiles = jobFiles.sort(function(a,b) {
                    var to_sort = [instancePattern.exec(a),instancePattern.exec(b)];
                    var to_sort_orig = to_sort.slice();
                    to_sort.sort();
                    if (to_sort_orig[0] == to_sort[0]) {
                      return 1;
                    } else {
                      return -1;
                    }
                  });

    for (var i=0;i<jobFiles.length;i++) {
      //console.log("              " + jobFiles[i]);
      // Extract some identifiers from the filename
      var jobInstance = instancePattern.exec(jobFiles[i]);
      console.log("updateJobsList() jobInstance = " + jobInstance);
      var jobName = jobfiles[i].slice(0,(jobFiles[i].indexOf(jobInstance)-1));
      console.log("updateJobsList() jobName = " + jobName);
      var jobNameFull = jobName + '-' + jobInstance;
      console.log(jobFiles[i] + ': ' + jobName + ' ' + jobInstance);

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
      jobItemName.innerHTML = "<html>" + jobName + "</html>"

      var jobItemInstance = document.createElement('DIV');
      jobItemInstance.id = 'jobItemInstance_' + jobNameFull;
      jobItemInstance.className = 'jobItemInstance jobItemInstance_' + holder;
      jobItemInstance.innerHTML = "<html>" + jobInstance + "</html>"

      // Horizontal Zoom box
      var jobItemHZoomBox = document.createElement('DIV');
        jobItemHZoomBox.id = 'jobItemHZoomBox_' + jobNameFull;
        jobItemHZoomBox.className = 'zoomBox'
        jobItemHZoomBox.title = 'Horizontal Zoom Factor'
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
              }
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
              }
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
              }
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
    if (holder === 'historyListJobsHolder' ) {
      // Start of popup menu
      var jobElementMenu = [{
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
              msgobj = {type:'load_saved_job_data', data:{'fileName':jobElementGraphName.slice('jobElementGraph_'.length)}};
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
            var msgobj = {type:'archive_saved_job',
                          data:{'jobName':jobName, 'instance':jobInstance}};
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
            var msgobj = {type:'delete_saved_job',
                          data:{'jobName':jobName, 'instance':jobInstance}};
            sendMessage({data:JSON.stringify(msgobj)});
          }
        }
      }];
      // End of popup menu
    } else if (holder === 'running_jobsHolder') {
      // Start of popup menu
      var jobElementMenu = [{
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
          var confirmStop = confirm("Stop job " + nodeName + "?");
          if ( confirmStop == true ) {
            var msgobj = {type:'stop_running_job', data:{'jobName':nodeName}};
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
            var msgobj = {type:'remove_running_job',
                          data:{'jobName':nodeName,'longName':longJobName}};
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
          var msgobj = {type:'save_running_job', data:{'jobName':nodeName}};
          sendMessage({data:JSON.stringify(msgobj)});
        }
      }];
      // End of popup menu
    } else if (holder === 'testHolder') {
      // Start of popup menu
      var jobElementMenu = [{
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
              msgobj = {type:'load_saved_job_data', data:{'fileName':jobElementGraphName.slice('jobElementGraph_'.length)}};
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

    d3.selectAll('.jobItemInstance_' + holder).on('click', function(data, index) {
                                        var elm = this;

                                        // create the div element that will hold the context menu
                                        d3.selectAll('.context-menu').data([1])
                                          .enter()
                                          .append('div')
                                          .attr('class', 'context-menu');

                                          // an ordinary click anywhere closes menu
                                          d3.select('body').on('click.context-menu', function() {
                                            d3.select('.context-menu').style('display', 'none');
                                          });

                                          // this is executed when a contextmenu event occurs
                                          d3.selectAll('.context-menu')
                                            .html('<center><p><b>Job Options</b></p></center><hr>')
                                            .append('ul')
                                            .selectAll('li')
                                            .data(jobElementMenu).enter()
                                            .append('li')
                                            .on('click',function(d) {
                                                        console.log('popup selected: ' + d.title);
                                                        d.action(elm, d, i);
                                                        d3.select('.context-menu')
                                                          .style('display', 'none');
                                                        return d;
                                                      })
                                            .text(function(d) {return d.title;});
                                          d3.select('.context-menu').style('display', 'none');

                                          // show the context menu
                                          d3.select('.context-menu')
                                            .style('left', (d3.event.pageX - 12) + 'px')
                                            .style('top', (d3.event.pageY - 72) + 'px')
                                            .style('display', 'block');
                                          d3.event.preventDefault();

                                          d3.event.stopPropagation();
                                      });

  }



/* START PROFILES */

  if ( smallDevice() ) {
    console.log("smallDevice is TRUE");
    var profileGraphMargin = {top: 50, right: 40, bottom: 60, left: 40};
    var profileGraphHeight = 300 - (profileGraphMargin.top + profileGraphMargin.bottom);
  } else {
    console.log("smallDevice is FALSE");
    var profileGraphMargin = {top: 50, right: 40, bottom: 60, left: 80};
    var profileGraphHeight = 400 - (profileGraphMargin.top + profileGraphMargin.bottom);
  }
  var profileGraphWidth = window.innerWidth - (profileGraphMargin.left + profileGraphMargin.right) - 20;
    //profileGraphHeight = 400 - profileGraphMargin.top - profileGraphMargin.bottom;
  //profileGraphWidth = 1800 - profileGraphMargin.left - profileGraphMargin.right,
  //profileGraphWidth = window.innerWidth - 20 - profileGraphMargin.left - profileGraphMargin.right,

  var pfZoom = d3.behavior.zoom()
    .scaleExtent([1,10])
    .on("zoom", zoomed);

  function zoomed () {
    if (d3.event.ctrlKey) {
      console.log("zoomed(): CTRL key pressed");
      //return;
    }
    profileGraphHolder.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
  }

  var pfDrag = d3.behavior.drag()
    .origin(function (d) { return d; })
    .on("dragstart", dragstarted)
    .on("drag", dragged)
    .on("dragend", dragended);

  function dragstarted (d) {
    //console.log("dragstarted() " + JSON.stringify(d));
    d3.event.sourceEvent.stopPropagation();
    // d3.event.ctrlKey is masked by something
    // i.e. doesn't work here so use our own pfCtrlKey instead
    if (pfCtrlKey) {
      // if ctrl key is down, we're not dragging (actually deleting)
      //console.log("dragstarted(): CTRL key is down");
      return;
    }
    if (d3.event.ctrlKey) {
      console.log("dragstarted(): CTRL key is down");
      return;
    }

    profileTooltip.transition()
      .duration(200)
      .style("opacity", 0.9);

    profileTooltip.text(tickText(profileLinearScaleX.invert(d.x)) + "," + parseInt(profileLinearScaleY.invert(d.y))) 
      .style("left", (d.x + profileGraphMargin.left - 67) + "px")
      .style("top", (d.y + profileGraphMargin.top + 43) + "px");

    d3.select(this).classed("dragging", true);
  }
  function dragged (d) {
    d3.select(this).attr("cx", d.x = d3.event.x).attr("cy", d.y = d3.event.y);

    profileTooltip.html(tickText(profileLinearScaleX.invert(d.x)) + ", " + parseInt(profileLinearScaleY.invert(d.y)))
    .style("opacity", 0.9)
    .style("left", (d.x + profileGraphMargin.left - 67) + "px")
    .style("top", (d.y + profileGraphMargin.top + 43) + "px");

    d3.select(this).classed("dragging", true);
  }
  function dragended (d) {
    if (d3.event.ctrlKey) {
      console.log("dragended(): CTRL key pressed");
    }
    if ( !(d3.select(this).classed("dragging")) ) {
      console.log("dragended(): should be a click");
      removeSetPoint(this);
      return;
    }

    //var datum = d3.select(this).datum();
    //console.log("dragended() " + JSON.stringify(datum));

    var index = this.id.split('_')[1];

    //var pos = d3.mouse(this);
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
    rawProfileData = convertDisplayToRawProfileData();
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

    d3.select(this).classed("dragging", false);
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

  function updateProfileGraph (options) {
    var options = options || {};
    profileData = options.data || [];
    profileOwner = options.owner || 'unknown';
    profileDisplayData = [];
    var defaultRange = {"min":-5,"max":30};
    var setpoint = {};
    console.log("At: updateProfileGraph() " + JSON.stringify(profileData) + " for owner " + profileOwner);

    // Clear any current graph
    d3.select("#profilesGraphHolder").selectAll("*").remove();
    profileGraphHolder = d3.select("#profilesGraphHolder").append("svg")
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
      setpoint = {"x":_TESTING_?nextStep:60*nextStep,
                  "y":profileData[sp]["target"]};
      lineData.push(setpoint);
      //console.log("pdata: " + setpoint["x"] + " : " + setpoint["y"]);

      nextStep += resolveGraphTimeValue(profileData[sp]["duration"]);
    }
    profileDisplayData.push(lineData);

    // Find extent of data.
    // Then add some percentage to allow for expansion
    // due to new data points outside the data
    var minDataPoint = d3.min(profileDisplayData[0],
                              function(d) {return parseFloat(d.y)-5;});
    minDataPoint = minDataPoint<defaultRange.min?minDataPoint:defaultRange.min
    var maxDataPoint = d3.max(profileDisplayData[0],
                              function(d) {return parseFloat(d.y)+5;});
    maxDataPoint = maxDataPoint>defaultRange.max?maxDataPoint:defaultRange.max
    var maxTime = d3.max(profileDisplayData[0], function(d)
                                            {return parseFloat(d.x) * 1.3 ;});
    //console.log("minData = " + minDataPoint + ", maxData = " + maxDataPoint + ", maxTime = " + maxTime);

    // Scale & display data
    if ( _TESTING_ ) {
      var formatTime = d3.time.format("%H:%M.%S");
    } else {
      var formatTime = d3.time.format("%-j:%H.%M");
    }
    profileLinearScaleY = d3.scale.linear()
                      .domain([minDataPoint,maxDataPoint])
                      .range([profileGraphHeight,0]);
    var yAxis = d3.svg.axis()
                      .scale(profileLinearScaleY)
                      .orient("left").ticks(5);
    var yAxisGroup = profileGraphHolder.append("g")
                      .attr('class', 'y profileAxis unselectable')
                      .attr("transform",
                            "translate(" + profileGraphMargin.left + "," + profileGraphMargin.top + ")")
                      .call(yAxis);
    profileLinearScaleX = d3.scale.linear()
                      .domain([0,maxTime])
                      .range([0,profileGraphWidth]);
    var xAxis = d3.svg.axis()
                      .scale(profileLinearScaleX)
                      .orient("bottom")
                      .tickValues(makeTickValues(maxTime,18));
    var xAxisGroup = profileGraphHolder.append("g")
                      .attr('class', 'x profileAxis unselectable')
                      .attr("transform",
                            "translate(" + profileGraphMargin.left + "," + (profileGraphHeight + profileGraphMargin.top) + ")")
                      .call(xAxis);

    // Custom tick format
      profileGraphHolder.selectAll('.x.profileAxis text').text(function(d) { return tickText(d) });

      var xaxistext = profileGraphHolder.append("g")
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
        var lineData = profileDisplayData[profile];

        //Scale each x & y in lineData, push result into new scaledLineData array
        lineData.forEach( function (d) {
          scaledLineData.push({"x":profileLinearScaleX(d.x),
                               "y":profileLinearScaleY(d.y)});
        });
        var profileLineFunction = d3.svg.line()
                                  .x(function(d) { return d.x; })
                                  .y(function(d) { return d.y; })
                                  .interpolate(INTERPOLATE_profile_editor);
                        var lineGraph = profileGraphHolder.append("path")
                                  .attr("transform",
                                        "translate(" + profileGraphMargin.left + "," + profileGraphMargin.top + ")")
                                  .attr("d", profileLineFunction(scaledLineData))
                                  .attr("stroke", profileLineColours[profile])
                                  .attr("stroke-width", 2)
                                  .attr("fill", "none");
        var dotGraphText = profileGraphHolder.selectAll('dotText')
                          .data(scaledLineData)
                        .enter().append("text")
                        .attr("id", function(d,i){return "setpointText_" + i ;})
                        .attr("class", "profileSetPointText")
                        .attr('x', function(d) { return d.x + 1; })
                        .attr('y', function(d) { return d.y - 5; })
                        .attr("transform",
                              "translate(" + profileGraphMargin.left + "," + profileGraphMargin.top + ")")
                        .text(function(d) {return tickText(profileLinearScaleX.invert(d.x))
                          + ", " + parseInt(profileLinearScaleY.invert(d.y)); } );

        var dotGraph = profileGraphHolder.selectAll('dot')
                          .data(scaledLineData)
                        .enter().append("circle")
                        .attr("id", function(d,i){return "setpoint_" + i ;})
                        .attr("class", "profileSetPoint")
                        .attr("transform",
                              "translate(" + profileGraphMargin.left + "," + profileGraphMargin.top + ")")
                        .attr('r', 3.5)
                        .attr('cx', function(d) { return d.x; })
                        .attr('cy', function(d) { return d.y; })
                        .on("mouseover", function(d) {
                          // d3.event.ctrlKey is masked from pfDrag
                          // so set our own pfCtrlKey instead
                          if (d3.event.ctrlKey) {
                            //console.log("mouseover + ctrl key");
                            pfCtrlKey = true;
                            return
                          }
                          pfCurrentDot = this;
                        })
                        .on("mouseout", function(d) {
                          if ( !(d3.select(this).classed("dragging")) ) {
                            profileTooltip.transition()
                              .duration(500)
                              .style("opacity", 0);
                          }
                          pfCurrentDot = {"id":"none"};
                        })
                        .on("click", function(d) {
                          if (d3.event.defaultPrevented) {
                            console.log("PREVENTED");
                            return
                          }
                          console.log("CLICK");
                          d3.event.sourceEvent.stopPropagation();
                          removeSetPoint(this);
                        })
                        .call(pfDrag);

    }
    profileButtonGroup = profileGraphHolder.append("g")
                              .attr("id", "profileButtonGroup")
                              .attr("class", "profileButtonGroup")
                              .attr("transform",
                                "translate(" +
                                (smallDevice()?profileGraphWidth-20:profileGraphWidth-40) + "," + 40 + ")")


    // Save & Return button
    profileSaveButton = d3.select("#profileButtonGroup")
                        .append("rect")
                          .attr('id', 'profileSaveButton')
                          .attr('class', 'profileSaveButton')
                          .attr('x', 0) .attr('y', 0)
                          .attr('width', 96).attr('height', 40)
                          .attr('rx', 6).attr('ry', 6)
                          .on("click", function() {
                                //console.log("SAVE & RETURN to " + profileOwner);
                                d3.select("#profilesGraphHolder").selectAll("*").remove();
                                location.href = '#content_2';
                                if (profileOwner == "jobProfileHolder") {
                                  jobProfileHolder.setAttribute('pdata', JSON.stringify(profileData));
                                } else if (profileOwner.search("tiProfile_") == 0) {
                                  document.getElementById(profileOwner).setAttribute('pdata', JSON.stringify(profileData));
                                  updateTemplateProfile({owner:profileOwner});
                                  replace_job(profileOwner);
                                }

                              })

    profileSaveButtonText = d3.select("#profileButtonGroup")
                                .append("text")
                                .attr('class', 'profileSaveButtonText')
                                .attr('dx', '0.1em')
                                .attr('dy', '1.6em')
                                .text("Save & Return")

    // Cancel button
    profileSaveButton = d3.select("#profileButtonGroup")
                        .append("rect")
                          .attr('id', 'profileSaveButton')
                          .attr('class', 'profileSaveButton')
                          .attr('x', 0) .attr('y', '3.6em')
                          .attr('width', 96).attr('height', 40)
                          .attr('rx', 6).attr('ry', 6)
                          .on("click", function() {
                                //console.log("CANCEL to " + profileOwner);
                                d3.select("#profilesGraphHolder").selectAll("*").remove();
                                location.href = '#content_2';
                              })

    profileSaveButtonText = d3.select("#profileButtonGroup")
                                .append("text")
                                .attr('class', 'profileSaveButtonText')
                                .attr('dx', '1.8em')
                                .attr('dy', '5.6em')
                                .text("Cancel")

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
        return sprintf("%d:%02d", mins, secs);
      } else {
        return sprintf("%d.%02d:%02d", hrs, mins, secs);
      }
    } else {
      if (days < 1 ) {
        return sprintf("%d:%02d", hrs, mins);
      } else {
        hrs -= days*24;
        return sprintf("%d.%02d:%02d", days, hrs, mins);
      }
    }
  }


  function newSetPoint () {
    if ( ! (d3.event.shiftKey)) {
      return;
    }
    console.log("newSetPoint()");
    var pos = d3.mouse(this);
    //console.log("newSetPoint() pos: " + (pos[0]-profileGraphMargin.left) + "," + (pos[1]-profileGraphMargin.top));
    //console.log("newSetPoint() " + JSON.stringify(profileDisplayData));

    var sp = {
      x:parseInt(profileLinearScaleX.invert(pos[0]-profileGraphMargin.left)),
      y:parseInt(profileLinearScaleY.invert(pos[1]-profileGraphMargin.top))
    };
    //console.log("newSetPoint(): " + sp.x + "," + sp.y);
    insertSetPoint(sp);
    rawProfileData = convertDisplayToRawProfileData();
    //console.log("rawProfileData = " + JSON.stringify(rawProfileData));
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
      sp = profileDisplayData[0][i];
      //console.log(JSON.stringify(sp));
      var newSp = {"target":sp.y, "duration":0};
      if ( rawSetPoints.length > 0 ) {
        rawSetPoints[i-1]["duration"] = sp.x - runningTime;
        runningTime += sp.x - runningTime;
      }
      rawSetPoints.push(newSp);

    };
    //console.log("rawSetPoints = " + JSON.stringify(rawSetPoints));
    return rawSetPoints;
  }

  /* To maintain the overall profile duration,
     we add the removed setpoint's duration
     to the previous setpoint's duration
  */
  function removeSetPoint (e) {
    //if ( ! (d3.event.ctrlKey)) {
    //  return;
    //}
    var datum = d3.select(e).datum();
    //console.log("removeSetPoint() " + JSON.stringify(datum));

    /* element index in profileData & profileDisplayData
    */
    var index = e.id.split('_')[1];
    if (index == 0 || index == (profileData.length - 1)) return;

    profileDisplayData[0].splice(index, 1);
    rawProfileData = convertDisplayToRawProfileData();
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
      console.log("smallDevice is FALSE");
      profileGraphMargin = {top: 50, right: 40, bottom: 60, left: 80};
      profileGraphHeight = 400 - (profileGraphMargin.top + profileGraphMargin.bottom);
    }
    profileGraphWidth = window.innerWidth - (profileGraphMargin.left + profileGraphMargin.right) -20;

    // Redraw profile editor
    updateProfileGraph({data:profileData, owner:profileOwner})

    //Redraw running jobs
    var runningJobs = document.getElementsByClassName("jobElementGraph");
    for (var i=0;i<runningJobs.length;i++) {
      var jobLongName = runningJobs[i].id.replace("jobElementGraph_", "");
      //console.log("Redraw " + jobLongName);
      updateJobHistoryData(0, jobLongName);
    };

  };

d3.select("body").on("keydown", function () {
  //console.log("KEY DOWN");
  if ( d3.event.shiftKey) {
    //console.log("SHIFT KEY");
  }
  if ( d3.event.ctrlKey) {
    //console.log("CTRL KEY pfCurrentDot = " + pfCurrentDot.id);
    d3.selectAll('.profileSetPoint').each( function(d, i) {
      if (this.id == pfCurrentDot.id) { pfCtrlKey = true; }
    });

  }
})
d3.select("body").on("keyup", function () {
  //console.log("KEY UP");
  if ( d3.event.ctrlKey) {
    //console.log("CTRL KEY UP");
    pfCtrlKey = false;
  }
})


  /* "Display only" some profile (not editable)
    probably job template (or even composer?)
  */
  //function updateTemplateProfile(profileData, profileDivName) {
  function updateTemplateProfile(options) {
    profileOwner = options.owner || 'unknown';
    //console.log("Reached updateTemplateProfile(): " + profileOwner);
    profileData = JSON.parse(document.getElementById(profileOwner).getAttribute('pdata'));

    var templateProfileGraphMargin = {top: 2, right: 4, bottom: 1, left: 1},
        templateProfileGraphWidth = 576 - templateProfileGraphMargin.left - templateProfileGraphMargin.right,
        templateProfileGraphHeight = 40 - templateProfileGraphMargin.top - templateProfileGraphMargin.bottom;

    // Draw the graph of profile
    d3.select('#profile_' + profileOwner).remove();
    var templateProfileGraphHolder = d3.select('#' + profileOwner).append("svg")
                      .attr("id", "profile_" + profileOwner)
                      .attr("class", "template_profileGraph")
                      .attr("width", templateProfileGraphWidth + templateProfileGraphMargin.right + templateProfileGraphMargin.left)
                      .attr("height", templateProfileGraphHeight + templateProfileGraphMargin.top + templateProfileGraphMargin.bottom)
                      .style("border", "1px solid black")

    // Extract profileData into local array
    var profileLineData = [];
    var setpoint = {};
    var nextStep = 0.0;
/*
    for (var sp=0;sp<profileData.length;sp++) {
      setpoint = {"x":nextStep.toFixed(2),
                  "y":profileData[sp]["target"]};
      profileLineData.push(setpoint);
      nextStep += parseFloat(profileData[sp]["duration"]);
      //nextStep += resolveGraphTimeValue(parseFloat(profileData[sp]["duration"]));
      console.log("*** updateTemplateProfile() profile: " + setpoint["x"] + "(" + profileData[sp]["duration"] + "): " + setpoint["y"]);
    }
*/
    for (var sp=0;sp<profileData.length;sp++) {
      //console.log("pdata: " + profileData[sp]["duration"] + " : " + profileData[sp]["target"]);
      setpoint = {"x":_TESTING_?nextStep:60*nextStep,
                  "y":profileData[sp]["target"]};
      profileLineData.push(setpoint);
      //console.log("pdata: " + setpoint["x"] + " : " + setpoint["y"]);

      nextStep += resolveGraphTimeValue(profileData[sp]["duration"]);
    }
    //console.log("profileLineData: " + JSON.stringify(profileLineData));

    // Find extent of values in profileLineData
    var maxTime = 0.0;
    //var maxDataPoint = 0.0;
    //var minDataPoint = 1000.0;
    //var minProfile = d3.min(profileLineData, function(d) {return parseFloat(d.y);});
    //var maxProfile = d3.max(profileLineData, function(d) {return parseFloat(d.y);}) + 1.0;
    var maxProfileTime = d3.max(profileLineData, function(d) {return parseFloat(d.x);});

    var maxDataPoint = d3.max(profileLineData, function(d) {
                                                  return parseFloat(d.y) + 5;
                                                });
    var minDataPoint = d3.min(profileLineData, function(d) {
                                                  return parseFloat(d.y) - 5;
                                                });
    //if ( minProfile < minDataPoint ) minDataPoint = minProfile;
    //if ( maxProfile > maxDataPoint ) maxDataPoint = maxProfile;
    if ( maxProfileTime > maxTime ) maxTime = maxProfileTime;

    // Scale & axes
    var templateLinearScaleY = d3.scale.linear()
                      .domain([minDataPoint,maxDataPoint])
                      .range([templateProfileGraphHeight,0]);
    var templateYAxis = d3.svg.axis()
                      .scale(templateLinearScaleY)
                      .orient("left")
                      .tickSize(-4)
                      .ticks(2);
                      //.tickValues(makeTickValues(maxDataPoint,4));
    var templateYAxisGroup = templateProfileGraphHolder.append("g")
                      .attr("transform",
                            "translate(" + templateProfileGraphMargin.left + "," + templateProfileGraphMargin.top + ")")
                      .attr('stroke-width', 2)
                      .attr('stroke', 'black')
                      .attr('fill', 'none')
                      .call(templateYAxis);
    var templateLinearScaleX = d3.scale.linear()
                      .domain([0,maxTime])
                      .range([0,templateProfileGraphWidth]);
    var templateXAxis = d3.svg.axis()
                      .scale(templateLinearScaleX)
                      .orient("bottom")
                      .tickSize(-4)
                      .ticks(5);
                      //.tickValues(makeTickValues(maxTime,18*graphWidthScale));
    var templateXAxisGroup = templateProfileGraphHolder.append("g")
                      .attr('class', 'x templateAxis')
                      .attr("transform",
                            "translate(" + templateProfileGraphMargin.left + "," + (templateProfileGraphHeight + templateProfileGraphMargin.top) + ")")
                      .attr('stroke-width', 2)
                      .attr('stroke', 'black')
                      .attr('fill', 'none')
                      .call(templateXAxis);
    // Custom tick format
    //templateProfileGraphHolder.selectAll('.x.templateAxis text').text(function(d) { return tickText(d) });

    // Scale profile data
    var scaledProfileLineData = [];
    for (var sp=0;sp<profileLineData.length;sp++) {
      //console.log("scaled sp = " + profileLineData[sp].x + " : " + profileLineData[sp].y);
      scaledProfileLineData.push({"x":templateLinearScaleX(profileLineData[sp].x),
                                  "y":templateLinearScaleY(profileLineData[sp].y)});
    }
    // Draw profile graph
    var templateProfileLineFunction = d3.svg.line()
                              .x(function(d) { return d.x; })
                              .y(function(d) { return d.y; })
                              .interpolate(INTERPOLATE_profile_template);
    var lineGraph = templateProfileGraphHolder.append("path")
                              .attr("transform",
                                    "translate(" + templateProfileGraphMargin.left + "," + templateProfileGraphMargin.top + ")")
                              .attr("d", templateProfileLineFunction(scaledProfileLineData))
                              .attr("stroke", "gray")
                              .attr("stroke-width", 2)
                              .attr("fill", "none");


  }

  function replace_job(profileOwner) {
    console.log("Don't forget to save the changed job!");
    var elemId = profileOwner.replace('tiProfile_', '');
    console.log("template id = " + elemId);

    var jobName = document.getElementById('tiName_' + elemId).innerHTML;
    var jobPreHeat = document.getElementById('tiPreheat_' + elemId).getAttribute('isset')=="true"?true:false;
    var saveJobProfile = JSON.parse(document.getElementById(profileOwner).getAttribute('pdata'));

    var sensors = document.getElementById('tiSensors_' + elemId).getAttribute ('sensors').split(',');
    var useSensors = [];
    for (var i=0;i<sensors.length;i++) { useSensors.push(sensors[i]); }

    var relays = document.getElementById('tiRelays_' + elemId).getAttribute ('relays').split(',');
    var useRelays = [];
    for (var i=0;i<relays.length;i++) { useRelays.push(relays[i]); }

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

/***************** START JOBS Templates/Composer/History  *********************/
  console.log("START JOBS");

  document.addEventListener('profilesLoadedEvent', function (e) {
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
    var jobTemplatesListHolder = document.getElementById("jobTemplatesListHolder");
    var toolTipDiv = d3.select("body").append("div")
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
      var preheat = "Preheat OFF";
      if ( thisJob['preheat'] ) {
        preheat = "Preheat  ON";
      }

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
      for (var j=0;j<thisJob['sensors'].length;j++) {
        loadedSensors.push(thisJob['sensors'][j]);
      }
      //console.log(name + ' sensors: ' + loadedSensors);
      templateItemSensors.setAttribute('sensors', loadedSensors);

      var templateItemRelays = document.createElement('LABEL');
      templateItemRelays.id = 'tiRelays_' + i;
      templateItemRelays.className = 'templateItemRelays unselectable';
      templateItemRelays.textContent = 'Relays';
      var loadedRelays = [];
      for (var j=0;j<thisJob['relays'].length;j++) {
        loadedRelays.push(thisJob['relays'][j]);
      }
      //console.log(name + ' relays: ' + loadedRelays);
      templateItemRelays.setAttribute('relays', loadedRelays);

      var templateItemProfile = document.createElement('DIV');
      templateItemProfile.id = 'tiProfile_' + i;
      templateItemProfile.className = 'templateItemProfile generic_graph';
      var loadedProfile = [];
      for (k=0;k<thisJob['profile'].length;k++) {
        //console.log('profile step for ' + name + ': ' + thisJob['profile'][k].target + ' . ' + thisJob['profile'][k].duration);
        //loadedProfile.push({'target':parseFloat(thisJob['profile'][k].target),'duration':parseFloat(thisJob['profile'][k].duration)});
        loadedProfile.push({'target':thisJob['profile'][k].target,'duration':thisJob['profile'][k].duration});
      }
      //templateItemProfile.setAttribute('profile', loadedProfile);
      console.log("Proposed pdata = " + JSON.stringify(loadedProfile));
      templateItemProfile.setAttribute('pdata', JSON.stringify(loadedProfile));


      templateItem.appendChild(templateItemName);
      templateItem.appendChild(templateItemPreheat);
      templateItem.appendChild(templateItemSensors);
      templateItem.appendChild(templateItemRelays);
      templateItem.appendChild(templateItemProfile);

      jobTemplatesListHolder.appendChild(templateItem);

      // Draw the profile graph for this template item
      //updateTemplateProfile(loadedProfile, templateItemProfile.id);
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
            var msgobj = {type:'delete_job',
                    data:{index: parseInt(templateItemIndex), name: jobName }};
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
            var itemsWidth = 0;
            var tallest = 0;
            for (var i=0;i<c.length;i++) {
              itemsWidth += parseInt(window.getComputedStyle(c[i]).width.replace(/\D+/g, ''));
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
        action: function(elm, data, index) {
          //console.log('menu item #4 from ' + elm.id + " " + data.title + " " + index);
          var templateItemIndex = elm.getAttribute('templateItemIndex');
          var jobName = elm.textContent;

          var confirmRun = confirm("Run job " + jobName + "?");
          if ( confirmRun == true ) {
            // Request job run
            var msgobj = {type:'run_job',
                    data:{index: parseInt(templateItemIndex), name: jobName }};
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

      d3.selectAll('.templateItemName').on('click', function(data, index) {
                                          var elm = this;

                                          // create the div element that will hold the context menu
                                          d3.selectAll('.context-menu').data([1])
                                            .enter()
                                            .append('div')
                                            .attr('class', 'context-menu');

                                            // an ordinary click anywhere closes menu
                                            d3.select('body').on('click.context-menu', function() {
                                              d3.select('.context-menu').style('display', 'none');
                                            });

                                            // this is executed when a contextmenu event occurs
                                            d3.selectAll('.context-menu')
                                              .html('<center><p><b>Template Options</b></p></center><hr>')
                                              .append('ul')
                                              .selectAll('li')
                                              .data(templateItemNameMenu).enter()
                                              .append('li')
                                              .on('click',function(d) {
                                                          console.log('popup selected: ' + d.title);
                                                          d.action(elm, d, i);
                                                          d3.select('.context-menu')
                                                            .style('display', 'none');
                                                          return d;
                                                        })
                                              .text(function(d) {return d.title;});
                                            d3.select('.context-menu').style('display', 'none');

                                            // show the context menu
                                            d3.select('.context-menu')
                                              .style('left', (d3.event.pageX - 96) + 'px')
                                              .style('top', (d3.event.pageY - 148) + 'px')
                                              .style('display', 'block');
                                            d3.event.preventDefault();

                                            d3.event.stopPropagation();
                                        });


      // templateItemSensors tooltip
      d3.selectAll('.templateItemSensors').on('click', function() {
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
                                    })

      // templateItemRelays tooltip
      d3.selectAll('.templateItemRelays').on('click', function() {
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
                                    })



    }
    for (var i=0;i<data.length;i++) {
      (function(i) {
        document.getElementById("tiProfile_" + i).onclick = function() {
          location.href = '#content_3';
          var templateItemProfile = document.getElementById("tiProfile_" + i);
          console.log("XXXX: " + templateItemProfile.getAttribute('pdata'));
          updateProfileGraph(
              {data:JSON.parse(templateItemProfile.getAttribute('pdata')),
              owner:templateItemProfile.id});
        };
      })(i);
    }

  } // End function createJobTemplatesList()

  // Display the job Composer
  var jobTemplatesHolder = document.getElementById('jobTemplatesHolder');
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
      for (var i=0;i<relayItems.length;i++ ) {
        document.getElementById("ar_" + i).checked = false;
      }
    }
    e.stopPropagation();
    return false;
  }

  // Dismiss the job composer
  var dismissJobComposerButton = document.getElementById('dismissJobComposerButton');
  dismissJobComposerButton.onclick = function() {
    var jobComposer = document.getElementById("jobComposer");
    if ( jobComposer.style.display != 'none') {
      jobComposer.style.display = 'none';
    }
  }

  // Save a new job from job composer
  var saveNewJobButton = document.getElementById("jobSaveButton");
  saveNewJobButton.onclick = function() {
    console.log("SAVE new job");
    var OKtoSave = true;

    // Collect the job name, substituting whitespaces with single underscores
    var jobName = document.getElementById('jobName').value
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
    var jobPreHeat = false;
    if (document.getElementById("selectPreHeat").checked) {
      jobPreHeat = true;
    }

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

    for (var i=0;i<table.length;i++) {
      var cell = document.getElementById("as_" + i);
      //console.log("checking " + document.getElementById("label_as_" + i).textContent);
      if ( cell.checked ) {
        useSensors.push(document.getElementById("label_as_" + i).textContent);
      }
    }
    //console.log("Sensors checked: " + useSensors);
    if ( useSensors.length == 0 ) {
      OKtoSave = false;
      alert("Please select a temperature sensor");
      return;
    }

    // Collect which relay(s) to use
    var table = document.getElementsByClassName("relaySelectorItem");
    var useRelays = [];

    for (var i=0;i<table.length;i++) {
      var cell = document.getElementById("ar_" + i);
      //console.log("checking " + document.getElementById("label_ar_" + i).textContent);
      if ( cell.checked ) {
        useRelays.push(document.getElementById("label_ar_" + i).textContent);
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
  }

  // Create a sensor selector based on data from server (availableSensors)
  function createSensorSelector(sensors) {
    console.log("Reached createSensorSelector() " + sensors);

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

    for(var i=0;i<sensors.length;i++) {
        console.log("Adding sensor: " + sensors[i]);

        var selectorItem = document.createElement("DIV");
        selectorItem.id = 'sensorSelectorItem_' + i;
        selectorItem.className = 'sensorSelectorItem';

        var check = document.createElement("INPUT");
        check.type = "checkbox";
        check.id = "as_" + i;

        var checkLabel = document.createElement("LABEL");
        checkLabel.setAttribute("for", "as_" + i);
        checkLabel.textContent = sensors[i];
        checkLabel.id = "label_as_" + i;
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
