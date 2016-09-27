var _TESTING_ = false;
var navigationMap = {};
var global_x = 0;

/*
For now, hard code the number of profiles (profilesTableRows)
and number of steps per profile (profilesTableColumns).
Eventually we'll make these settings dynamic.
*/
var profilesTableColumns = 10;
var profilesTableRows = 4;

var domReady = function(callback) {
  document.readyState === "interactive" ||
  document.readyState === "complete" ? callback() : document.addEventListener("DOMContentLoaded", callback);
};

// main()
domReady( function(){
//$(document).ready( function()

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
  jobTemplatesHolder.id = 'jobTemplatesHolder';
    var jobTemplatesListHolder = document.createElement('DIV');
    jobTemplatesListHolder.id = 'jobTemplatesListHolder';
    jobTemplatesHolder.appendChild(jobTemplatesListHolder);

  var jobComposer = document.createElement('DIV');
  jobComposer.id = 'jobComposer';
    var jobComposerTitle = document.createElement('DIV');
    jobComposerTitle.id = 'jobComposerTitle';
    jobComposerTitle.className = 'section_title unselectable';
    jobComposerTitle.textContent = 'Job Composer';
    jobComposer.appendChild(jobComposerTitle);

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
  content_3.appendChild(profilesTitle);

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
  content_4.appendChild(configTitle);
  content_4.appendChild(configHolder);


  document.body.appendChild(main_content);


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
      }
    }
    catch (err) {
      console.log("Unrecognised message: " + message.data);
    }
  }
  socket.onclose = function () {
    console.log("Disconnected");

    // Display disconnected status
    var pageTitles = document.getElementsByClassName('page_title');
    for (var page=0;page<pageTitles.length;page++) {
      pageTitles[page].style.background = 'red';
      pageTitles[page].textContent = 'NOT CONNECTED';
    }
  };

  var sendMessage = function(message) {
    console.log("sending:" + message.data);
    socket.send(message.data);
  };

  function live_update(data) {
    var sensor_state = data.sensor_state;
    var relay_state = data.relay_state;
    console.log("Rcvd live_update");

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
    document.getElementById('sensor_updateHolder').style.width = (128 + 128*sensor_state.length) + "px";

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
    document.getElementById('relay_updateHolder').style.width = (128 + 128*relay_state.length) + "px";

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
        var configKeys = data[data_keys[k]];
        for (var key in configKeys) {
          console.log("configKey: " + key);
        }
      } else if (data_keys[k] == 'the_end') {
        var the_end_unused = data[data_keys[k]];
        console.log("the_end: " + the_end_unused);
      } else {
        console.log("Unknown startup_data key: " + data_keys[k] + " = " + data[data_keys[k]]);
      }
    }
  }


});

/*
ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab:
*/
