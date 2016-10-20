//window.onload = function () {
//  console.log("Window.onload()");
//};

var _TESTING_ = false;
var navigationMap = {};
var global_x = 0;

function smallDevice () {
  return window.innerWidth<1000?true:false;
}

var availableSensors = [];

var profileData = [];
var profileDisplayData = [];        // "processed" data for display
var profileLinearScaleY = [];
var profileLinearScaleX = [];
var profileLineColours = ["green", "red", "orange", "blue"];
var pfCtrlKey = false;
var pfCurrentDot = {"id":"none"};

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
    var jobItemsHolder = document.createElement('DIV');
    jobItemsHolder.id = 'jobItemsHolder';
      // Item 1: Save button
      var jobSaveButton = document.createElement('DIV');
      jobSaveButton.id = 'jobSaveButton';
      jobSaveButton.textContent = 'Save';
      jobItemsHolder.appendChild(jobSaveButton);

      // Item 2: Job name
      var jobNameHolder = document.createElement('DIV');
      jobNameHolder.id = 'jobNameHolder';
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
      // Item 4: Profile?

      // Item 5: Sensors
      var jobSensorsHolder = document.createElement('DIV');
      jobSensorsHolder.id = 'jobSensorsHolder';
      jobItemsHolder.appendChild(jobSensorsHolder);

      // Item 6: Relays

      // Item 7: Dismiss
      var dismissJobComposerButton = document.createElement('DIV');
      dismissJobComposerButton.id = 'dismissJobComposerButton';
      dismissJobComposerButton.textContent = 'Dismiss';
      jobItemsHolder.appendChild(dismissJobComposerButton);

    jobComposer.appendChild(jobItemsHolder);

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
    profilesTitle.textContent = 'Profiles';

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
  socket.onmessage = function (message) {
    var jmsg;
    try {
      jmsg = JSON.parse(message.data);
      if (jmsg.type === 'live_update') {
        live_update(jmsg);
      } else if (jmsg.type === 'startup_data') {
        console.log("XXXXX " + message.data);
        startup_data(jmsg);
      } else if (jmsg.type === 'relay_update') {
        relay_update(jmsg);
      } else if (jmsg.type === 'sensor_list' ) {
        console.log("sensor_list " + message.data);
        // Keep a copy for later
        availableSensors = [];
        while (availableSensors.length > 0) {availableSensors.pop();}
        for (var i=0;i<jmsg.data.length;i++) {
          availableSensors.push(jmsg.data[i]);
        }
        createSensorSelector(availableSensors);
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
    updateProfileGraph({data:rawProfileData});
    profileTooltip.transition()
      .duration(200)
      .style("opacity", 0.0);

    d3.select(this).classed("dragging", false);
  }

  /* Return an array of profiles.
     Each profile is an array of setpoints; x (time) & y (temp) fields
  */
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
    profileDisplayData = [];
    var defaultRange = {"min":-5,"max":30};
    var setpoint = {};
    //console.log("At: updateProfileGraph() " + JSON.stringify(profileData));

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
                                  .interpolate("step-after");
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

    updateProfileGraph({data:rawProfileData});
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
    updateProfileGraph({data:rawProfileData});
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
      //profileGraphHeight = window.innerHeight - (profileGraphMargin.top - profileGraphMargin.bottom);
    updateProfileGraph({data:profileData})

  /*
    profileGraphWidth = window.innerWidth - 20 - profileGraphMargin.left - profileGraphMargin.right,
    profileGraphHeight = 400 - profileGraphMargin.top - profileGraphMargin.bottom;
  */
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

//updateProfileGraph({data:getProfileData()});

/* END PROFILES */

/***************** START JOBS Templates/Composer/History  *********************/
  console.log("START JOBS");

  document.addEventListener('profilesLoadedEvent', function (e) {
    //Clear the job name
    //document.getElementById("jobName").value = "";

    // Ask for available sensors & relays
    var msgobj = {type:'list_sensors', data:[]};
    sendMessage({data:JSON.stringify(msgobj)});

//    msgobj = {type:'list_relays', data:[]};
//    sendMessage({data:JSON.stringify(msgobj)});
//
//    // Request job data
//    msgobj = {type:'load_jobs', data:[]};
//    sendMessage({data:JSON.stringify(msgobj)});

  }, false);

  // Display the job Composer
  var jobTemplatesHolder = document.getElementById('jobTemplatesHolder');
  jobTemplatesHolder.onclick = function(e) {
    //console.log('Target: ' + e.target.id);
    if (e.target.id != 'jobTemplatesHolder') return;

    var jobComposer = document.getElementById("jobComposer");
    if ( jobComposer.style.display != 'block') {
      jobComposer.style.display = 'block';
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

  // Create a sensor selector based on data from server (availableSensors)
  function createSensorSelector(sensors) {
    console.log("Reached createSensorSelector() " + sensors);

    var selector = document.getElementById("jobSensorsHolder");

    // First remove existing list elements
    while ( selector.hasChildNodes() ) {
      selector.removeChild(selector.firstChild);
    }

    for(var i=0;i<sensors.length;i++) {
        console.log("Adding sensor: " + sensors[i]);

        var selectorItem = document.createElement("DIV");
        selectorItem.id = 'selectorItem';

        var check = document.createElement("INPUT");
        check.type = "checkbox";
        check.id = "as_" + i;

        var checkLabel = document.createElement("LABEL");
        checkLabel.setAttribute("for", "as_" + i);
        checkLabel.textContent = sensors[i];
        checkLabel.id = "label_as_" + i;

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
