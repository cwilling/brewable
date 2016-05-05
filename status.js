var _TESTING_ = false;

var navigationMap = {};
var global_x = 0;

var availableSensors = [];
var availableRelays = [];
var temperatureColours = ["blue", "green", "red", "orange"];
var profileLineColours = ["green", "red", "orange", "blue"];
/*
For now, hard code the number of profiles (profilesTableRows)
and number of steps per profile (profilesTableColumns).
Eventually we'll make these settings dynamic.
*/
var profilesTableColumns = 10;
var profilesTableRows = 4;

/* Save JobHistory data here */
var historyData = {}
var runningData = {}

/*
In case we can't load saved profiles (first time use, botched file etc.),
generate a dummy set of profiles to initially populate the profiles table.
*/
var dummyProfileSet = generateDummyProfileSet(profilesTableRows, profilesTableColumns);

function generateDummyProfileSet(profiles, setpoints) {
  var i, j;
  var setpoint = {};
  var profile = [], profileSet = [];

  for (i=0;i<profiles;i++) {
    profile = [];
    for (j=0;j<setpoints;j++) {
        setpoint = {target: 0, duration: 0};
        profile.push(setpoint);
    }
    profileSet.push(profile);
  }
  return profileSet;
}

/* Convert text from profile editor into time units.
*/
function resolveGraphTimeValue(rawval) {
  var pieces = rawval.split(".");
  if (pieces.length > 1 ) {
    result = 60 * parseInt(pieces[0])
                + parseInt(pieces[1]/60)
                + parseInt(pieces[1]%60);
  } else {
    result = 60 * parseInt(pieces[0]);
  }
  //console.log("resolveGraphTimeValue(): " + result);
  return result;
}

var isNumeric = function (n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
};

/* Some javascript implementations don't have string.includes()
   so provide one
*/
if (!String.prototype.includes) {
  String.prototype.includes = function(search, start) {
    'use strict';
    if (typeof start !== 'number') {
      start = 0;
    }

    if (start + search.length > this.length) {
      return false;
    } else {
      return this.indexOf(search, start) !== -1;
    }
  };
}

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


var domReady = function(callback) {
  document.readyState === "interactive" ||
  document.readyState === "complete" ? callback() : document.addEventListener("DOMContentLoaded", callback);
};

// From http://www.rgagnon.com/jsdetails/js-0024.html
function beep() {
  (new
    Audio(
      "data:audio/wav;base64,//uQRAAAAWMSLwUIYAAsYkXgoQwAEaYLWfkWgAI0wWs/ItAAAGDgYtAgAyN+QWaAAihwMWm4G8QQRDiMcCBcH3Cc+CDv/7xA4Tvh9Rz/y8QADBwMWgQAZG/ILNAARQ4GLTcDeIIIhxGOBAuD7hOfBB3/94gcJ3w+o5/5eIAIAAAVwWgQAVQ2ORaIQwEMAJiDg95G4nQL7mQVWI6GwRcfsZAcsKkJvxgxEjzFUgfHoSQ9Qq7KNwqHwuB13MA4a1q/DmBrHgPcmjiGoh//EwC5nGPEmS4RcfkVKOhJf+WOgoxJclFz3kgn//dBA+ya1GhurNn8zb//9NNutNuhz31f////9vt///z+IdAEAAAK4LQIAKobHItEIYCGAExBwe8jcToF9zIKrEdDYIuP2MgOWFSE34wYiR5iqQPj0JIeoVdlG4VD4XA67mAcNa1fhzA1jwHuTRxDUQ//iYBczjHiTJcIuPyKlHQkv/LHQUYkuSi57yQT//uggfZNajQ3Vmz+ Zt//+mm3Wm3Q576v////+32///5/EOgAAADVghQAAAAA//uQZAUAB1WI0PZugAAAAAoQwAAAEk3nRd2qAAAAACiDgAAAAAAABCqEEQRLCgwpBGMlJkIz8jKhGvj4k6jzRnqasNKIeoh5gI7BJaC1A1AoNBjJgbyApVS4IDlZgDU5WUAxEKDNmmALHzZp0Fkz1FMTmGFl1FMEyodIavcCAUHDWrKAIA4aa2oCgILEBupZgHvAhEBcZ6joQBxS76AgccrFlczBvKLC0QI2cBoCFvfTDAo7eoOQInqDPBtvrDEZBNYN5xwNwxQRfw8ZQ5wQVLvO8OYU+mHvFLlDh05Mdg7BT6YrRPpCBznMB2r//xKJjyyOh+cImr2/4doscwD6neZjuZR4AgAABYAAAABy1xcdQtxYBYYZdifkUDgzzXaXn98Z0oi9ILU5mBjFANmRwlVJ3/6jYDAmxaiDG3/6xjQQCCKkRb/6kg/wW+kSJ5//rLobkLSiKmqP/0ikJuDaSaSf/6JiLYLEYnW/+kXg1WRVJL/9EmQ1YZIsv/6Qzwy5qk7/+tEU0nkls3/zIUMPKNX/6yZLf+kFgAfgGyLFAUwY//uQZAUABcd5UiNPVXAAAApAAAAAE0VZQKw9ISAAACgAAAAAVQIygIElVrFkBS+Jhi+EAuu+lKAkYUEIsmEAEoMeDmCETMvfSHTGkF5RWH7kz/ESHWPAq/kcCRhqBtMdokPdM7vil7RG98A2sc7zO6ZvTdM7pmOUAZTnJW+NXxqmd41dqJ6mLTXxrPpnV8avaIf5SvL7pndPvPpndJR9Kuu8fePvuiuhorgWjp7Mf/PRjxcFCPDkW31srioCExivv9lcwKEaHsf/7ow2Fl1T/9RkXgEhYElAoCLFtMArxwivDJJ+bR1HTKJdlEoTELCIqgEwVGSQ+hIm0NbK8WXcTEI0UPoa2NbG4y2K00JEWbZavJXkYaqo9CRHS55FcZTjKEk3NKoCYUnSQ 0rWxrZbFKbKIhOKPZe1cJKzZSaQrIyULHDZmV5K4xySsDRKWOruanGtjLJXFEmwaIbDLX0hIPBUQPVFVkQkDoUNfSoDgQGKPekoxeGzA4DUvnn4bxzcZrtJyipKfPNy5w+9lnXwgqsiyHNeSVpemw4bWb9psYeq//uQZBoABQt4yMVxYAIAAAkQoAAAHvYpL5m6AAgAACXDAAAAD59jblTirQe9upFsmZbpMudy7Lz1X1DYsxOOSWpfPqNX2WqktK0DMvuGwlbNj44TleLPQ+Gsfb+GOWOKJoIrWb3cIMeeON6lz2umTqMXV8Mj30yWPpjoSa9ujK8SyeJP5y5mOW1D6hvLepeveEAEDo0mgCRClOEgANv3B9a6fikgUSu/DmAMATrGx7nng5p5iimPNZsfQLYB2sDLIkzRKZOHGAaUyDcpFBSLG9MCQALgAIgQs2YunOszLSAyQYPVC2YdGGeHD2dTdJk1pAHGAWDjnkcLKFymS3RQZTInzySoBwMG0QueC3gMsCEYxUqlrcxK6k1LQQcsmyYeQPdC2YfuGPASCBkcVMQQqpVJshui1tkXQJQV0OXGAZMXSOEEBRirXbVRQW7ugq7IM7rPWSZyDlM3IuNEkxzCOJ0ny2ThNkyRai1b6ev//3dzNGzNb//4uAvHT5sURcZCFcuKLhOFs8mLAAEAt4UWAAIABAAAAAB4qbHo0tIjVkUU//uQZAwABfSFz3ZqQAAAAAngwAAAE1HjMp2qAAAAACZDgAAAD5UkTE1UgZEUExqYynN1qZvqIOREEFmBcJQkwdxiFtw0qEOkGYfRDifBui9MQg4QAHAqWtAWHoCxu1Yf4VfWLPIM2mHDFsbQEVGwyqQoQcwnfHeIkNt9YnkiaS1oizycqJrx4KOQjahZxWbcZgztj2c49nKmkId44S71j0c8eV9yDK6uPRzx5X18eDvjvQ6yKo9ZSS6l//8elePK/Lf//IInrOF/FvDoADYAGBMGb7 FtErm5MXMlmPAJQVgWta7Zx2go+8xJ0UiCb8LHHdftWyLJE0QIAIsI+UbXu67dZMjmgDGCGl1H+vpF4NSDckSIkk7Vd+sxEhBQMRU8j/12UIRhzSaUdQ+rQU5kGeFxm+hb1oh6pWWmv3uvmReDl0UnvtapVaIzo1jZbf/pD6ElLqSX+rUmOQNpJFa/r+sa4e/pBlAABoAAAAA3CUgShLdGIxsY7AUABPRrgCABdDuQ5GC7DqPQCgbbJUAoRSUj+NIEig0YfyWUho1VBBBA//uQZB4ABZx5zfMakeAAAAmwAAAAF5F3P0w9GtAAACfAAAAAwLhMDmAYWMgVEG1U0FIGCBgXBXAtfMH10000EEEEEECUBYln03TTTdNBDZopopYvrTTdNa325mImNg3TTPV9q3pmY0xoO6bv3r00y+IDGid/9aaaZTGMuj9mpu9Mpio1dXrr5HERTZSmqU36A3CumzN/9Robv/Xx4v9ijkSRSNLQhAWumap82WRSBUqXStV/YcS+XVLnSS+WLDroqArFkMEsAS+eWmrUzrO0oEmE40RlMZ5+ODIkAyKAGUwZ3mVKmcamcJnMW26MRPgUw6j+LkhyHGVGYjSUUKNpuJUQoOIAyDvEyG8S5yfK6dhZc0Tx1KI/gviKL6qvvFs1+bWtaz58uUNnryq6kt5RzOCkPWlVqVX2a/EEBUdU1KrXLf40GoiiFXK///qpoiDXrOgqDR38JB0bw7SoL+ZB9o1RCkQjQ2CBYZKd/+VJxZRRZlqSkKiws0WFxUyCwsKiMy7hUVFhIaCrNQsKkTIsLivwKKigsj8XYlwt/WKi2N4d//uQRCSAAjURNIHpMZBGYiaQPSYyAAABLAAAAAAAACWAAAAApUF/Mg+0aohSIRobBAsMlO//Kk4soosy1JSFRYWaLC4qZBYWFRGZdwqKiwkNBVmoWFSJkWFxX4FFRQWR+LsS4W/rFRb//////////////////////////// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////VEFHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAU291bmRib3kuZGUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMjAwNGh0dHA6Ly93d3cuc291bmRib3kuZGUAAAAAAAAAACU="
        )).play();
}

//main()
domReady( function(){
//$(document).ready( function(){

  var profilesLoadedEvent = new Event('profilesLoadedEvent');


/*******************  Swipe between pages  ***************************/

  // Navigate by swipe
  var swipeDeltaMin = 50;
  var pageSwipeZone = document.getElementsByClassName("page_title");
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
            history.style.height = '21em';
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
            history.style.height = '21em';
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


/*******************  Popup instead of a main menu bar ***************************/
  // Popup menu
  var masterPageMenu = [{
    title: 'Status',
    action: function(elm, data, index) {
      console.log('menu item #1 from ' + elm.id + " " + data.title + " " + index);
      location.href = "#content_1";
    }
  }, {
    title: 'Jobs',
    action: function(elm, data, index) {
      console.log('menu item #2 from ' + elm.id + " " + data.title + " " + index);
      location.href = "#content_2";
    }
  }, {
    title: 'Profiles',
    action: function(elm, data, index) {
      console.log('menu item #3 from ' + elm.id + " " + data.title + " " + index);
      location.href = "#content_3";
    }
  }, {
    title: 'Configuration',
    action: function(elm, data, index) {
      console.log('menu item #4 from ' + elm.id + " " + data.title + " " + index);
      location.href = "#content_4";
    }
  }];
  // End of popup menu

  //d3.select("#statusTitle").on("click", function(data, index) {
  d3.selectAll(".navigation_button").on("click", function(data, index) {
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
                                              .html('<center><p><b>GO TO</b></p></center><hr>')
                                              .append('ul')
                                              .selectAll('li')
                                              .data(masterPageMenu).enter()
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
                                              .style('left', (d3.event.pageX - 100) + 'px')
                                              .style('top', (d3.event.pageY - 2) + 'px')
                                              .style('display', 'block');
                                            d3.event.preventDefault();

                                            d3.event.stopPropagation();
                                        });


/***********************  Jobs Configuration page  ***************************/

  //Clear the job name
  document.getElementById("jobName").value = "";
  // When profiles have been loaded from server, populate the profile selector
  var jobProfileSelector = document.getElementById("jobProfileSelector");
  document.addEventListener('profilesLoadedEvent', function (e) {
    console.log("profilesLoadedEvent happened!"); 
    var table = document.getElementById("profilesTable");
    var option;

    for (var i=0;i<table.rows.length;i++) {
      option = document.createElement('OPTION');
      option.text = table.rows[i].cells[0].textContent;
      option.value = i;
      jobProfileSelector.add(option);
    }
    updateProfileGraph();

    // Since profiles are available, ask for available sensors & relays too
    var msgobj = {type:'list_sensors', data:[]};
    sendMessage({data:JSON.stringify(msgobj)});

    msgobj = {type:'list_relays', data:[]};
    sendMessage({data:JSON.stringify(msgobj)});

    // Request job data
    msgobj = {type:'load_jobs', data:[]};
    sendMessage({data:JSON.stringify(msgobj)});

  }, false);


  // Dismiss the job composer
  var dismissJobComposerButton = document.getElementById('dismissJobComposerButton');
  dismissJobComposerButton.onclick = function() {
    var jobComposer = document.getElementById("jobComposer");
    if ( jobComposer.style.display != 'none') {
      jobComposer.style.display = 'none';
    }
  }

  // Save a new job
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
    if ( selectedJobName(jobName) ) {
      alert("Duplicate job name - please change it");
      return
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

    // Collect which profile to use
    var jobSelectId = document.getElementById("jobProfileSelector").value;
    var table = document.getElementById("profilesTable");
    var jobProfile = table.rows[jobSelectId];

    // Extract the time/temp steps from profiles table
    var tempType = document.getElementById("temperatureScaleSelector").value;
    var saveJobProfile = [];
    for (var j=0;j<table.rows[jobSelectId].cells.length - 1;j++) {
      var setpoint = {};
      //console.log("target = " + "sp" + jobSelectId + "_" + j);
      var target = document.getElementById("sp" + jobSelectId + "_" + j).value;
      if (tempType == 'F') {
        target = ((target - 32.0)* 5) / 9;
      }
      var duration = document.getElementById("dh" + jobSelectId + "_" + j).value;
      //console.log("Element has val = " + target + " and " + duration);
      setpoint = {target:target, duration:duration};
      saveJobProfile.push(setpoint);
    }
    // Add a "zero,zero" setpoint.
    if (tempType == 'F') {
        setpoint = {target:32.0, duration:'0.0'};
    } else {
        setpoint = {target:0.0, duration:'0.0'};
    }
    saveJobProfile.push(setpoint);
    console.log("Added setpoint " + setpoint);


    // Collect which sensor(s) to use
    var table = document.getElementById("jobSensorsTable");
    var useSensors = [];

    for (var i=0;i<table.rows.length;i++) {
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
    var table = document.getElementById("jobRelaysTable");
    var useRelays = [];

    for (var i=0;i<table.rows.length;i++) {
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
    } else {
      console.log("NOT OKtoSave");
    }
  }

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
    var historyJobsGraphMargin = {top: 20, right: 40, bottom: 50, left: 60},
        historyJobsGraphWidth = graphWidthScale*1800 - historyJobsGraphMargin.left - historyJobsGraphMargin.right,
        historyJobsGraphHeight = 256 - historyJobsGraphMargin.top - historyJobsGraphMargin.bottom;

    // Draw the graph of job history
    d3.select("#history_" + longName).remove();
    var historyJobsGraphHolder = d3.select("#jobElementGraph_" + longName).append("svg")
                      .attr("id", "history_" + longName)
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
      // N.B. could probaby do this while populating the *LineData arrays
      var maxTime = 0.0;
      var maxDataPoint = 0.0;
      var minDataPoint = 1000.0;
      var minProfile = d3.min(profileLineData, function(d) {return parseFloat(d.y);});
      var maxProfile = d3.max(profileLineData, function(d) {return parseFloat(d.y);}) + 1.0;
      var maxProfileTime = d3.max(profileLineData, function(d) {return parseFloat(d.x);}) + 60;

      if ( minProfile < minDataPoint ) minDataPoint = minProfile;
      if ( maxProfile > maxDataPoint ) maxDataPoint = maxProfile;
      if ( maxProfileTime > maxTime ) maxTime = maxProfileTime;

      for (var sensor_instance=0;sensor_instance<header[0]['jobSensorIds'].length;sensor_instance++) {
        var temperature = d3.min(temperatureLineDataHolder[sensor_instance], function(d) {return parseFloat(d.y);});
        if (temperature < minDataPoint ) minDataPoint = temperature;
        temperature = d3.max(temperatureLineDataHolder[sensor_instance], function(d) {return parseFloat(d.y);}) + 1.0;
        if (temperature > maxDataPoint ) maxDataPoint = temperature;
        temperature = d3.max(temperatureLineDataHolder[sensor_instance], function(d) {return parseFloat(d.x);}) + 60;
        if ( temperature > maxTime ) maxTime = temperature;
      }


      // Sanity check
      //minDataPoint = (minDataPoint<0)?0:minDataPoint;
      //maxDataPoint = (maxDataPoint>60)?60:maxDataPoint;
      //console.log("**** minDataPoint = " + minDataPoint + ", maxDataPoint = " + maxDataPoint + ", maxTime = " + maxTime);


      // Scale & axes
      var historyLinearScaleY = d3.scale.linear()
                        .domain([minDataPoint,maxDataPoint])
                        .range([historyJobsGraphHeight,0]);
      var historyYAxis = d3.svg.axis()
                        .scale(historyLinearScaleY)
                        .orient("left")
                        .tickValues(makeTickValues(maxDataPoint,4));
                        //.ticks(4);
      var historyYAxisGroup = historyJobsGraphHolder.append("g")
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
                        .attr('class', 'x historyAxis')
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
                                .interpolate("linear");
      var lineGraph = historyJobsGraphHolder.append("path")
                                .attr("transform",
                                      "translate(" + historyJobsGraphMargin.left + "," + historyJobsGraphMargin.top + ")")
                                .attr("d", historyProfileLineFunction(scaledProfileLineData))
                                .attr("stroke", "gray")
                                .attr("stroke-width", 2)
                                .attr("fill", "none");

      for (var sensor_instance=0;sensor_instance<header[0]['jobSensorIds'].length;sensor_instance++) {
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

  // WAS function updateJobHistoryListNew(historyfiles, holder) {
  // FROM function updateJobHistoryList(data) {
  function updateJobsList(jobfiles, holder) {

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
      var jobName = jobfiles[i].slice(0,(jobFiles[i].indexOf(jobInstance)-1));
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
      jobItemHZoomBox.appendChild(jobItemHZBInput);
      jobItemHZoomBox.appendChild(jobItemHZDown);
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
          title: 'Delete',
          action: function(elm, data, index) {
          console.log('menu item #2 from ' + elm.id + " " + data.title + " " + index);
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
            var msgobj = {type:'stop_running_job', data:{'jobName':nodeName}};
            sendMessage({data:JSON.stringify(msgobj)});
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
              var msgobj = {type:'remove_running_job', data:{'jobName':nodeName}};
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




/********************* Profiles Configuration page ***************************/
  // Profiles Save button
  var saveProfilesButton = document.getElementById("saveProfiles");
  saveProfilesButton.onclick = function() {
    saveProfiles();
  }

  // Profiles temperature scale
  var temperatureScaleSelector = document.getElementById("temperatureScaleSelector");
  temperatureScaleSelector.name = "temperatureScaleSelector";
  var optionC = document.createElement('OPTION');
  var optionF = document.createElement('OPTION');
  optionC.selected = "";
  optionC.text = "Celsius";
  optionC.value = "C";
  optionF.text = "Fahrenheit";
  optionF.value = "F";
  temperatureScaleSelector.add(optionC);
  temperatureScaleSelector.add(optionF);
  temperatureScaleSelector.onchange = function() {
  var select = document.getElementById("temperatureScaleSelector");
    updateProfilesTableTempScale(select.value);
  }

  // Create a profiles table based on some data (loadedProfileData)
  function createProfileTableFunction(loadedProfileData) {
    var pdata;
    table = document.getElementById("profilesTable");

    // First remove existing list elements
    while ( table.hasChildNodes() ) {
      table.removeChild(table.firstChild);
    }

    if( loadedProfileData.length == 0 ) {
      pdata = dummyProfileSet;
    } else {
      pdata = loadedProfileData;
    }
    for (i=0;i<pdata.length;i++) {
      var row = table.insertRow(i);
      //var th = row.insertCell(0).appendChild(document.createElement('TH'));
      //th.appendChild(document.createTextNode("Profile " + i));
      var cell = document.createElement("TD");
      var cellText = document.createTextNode("Profile " + i);
      cell.appendChild(cellText);
      cell.className = 'profileLabelText';
      cell.style.color = profileLineColours[i];
      var th = row.insertCell(0).appendChild(cell);
      th.parentNode.className = 'profileLabel';
      for (j=0;j<pdata[i].length;j++) {
         row.insertCell(j+1).appendChild(populateProfilesTableCell(i,j,pdata[i]));
      }
    }
    document.dispatchEvent(profilesLoadedEvent);
  }
  function populateProfilesTableCell(rowNumber, cellNumber, rowData) {
    var cell = document.createElement('TABLE');
    var row = cell.insertRow(0);

    row.appendChild(document.createTextNode("sp" + cellNumber));

    var tempInput = document.createElement('INPUT');
    tempInput.id = "sp" + rowNumber + "_" + cellNumber;
    tempInput.className = "setpoint";
    tempInput.type = "text";
    tempInput.size = 2;
    tempInput.onkeyup = function() {updateProfileGraph();};
    //tempInput.value = "21.0";
    tempInput.value = rowData[cellNumber].target;
    row.appendChild(tempInput);

    tscale = document.createElement('SPAN');
    tscale.className = "tscale";
    tscale.textContent = "[C]";
    row.appendChild(tscale);

    row.appendChild(document.createTextNode("  dh" + cellNumber));

    var timeInput = document.createElement('INPUT');
    timeInput.id = "dh" + rowNumber + "_" + cellNumber;
    timeInput.className = "durpoint";
    timeInput.type = "text";
    timeInput.size = 2;
    //timeInput.value = 1.0;
    timeInput.value = rowData[cellNumber].duration;
    timeInput.onkeyup = function() {
                          if (timeInput.value.charAt(0) == '.') {
                            timeInput.value = "0" + timeInput.value;
                          }
                          updateProfileGraph();
                        };
    if ( cellNumber == (profilesTableColumns - 1) ) timeInput.readOnly = true;
    row.appendChild(timeInput);

    durUnit = document.createElement('SPAN');
    durUnit.className = "durUnit";
    durUnit.textContent = "H";
    row.appendChild(durUnit);

    return cell;
  }

  // Change temperature scale in the profiled table
  function updateProfilesTableTempScale(tempType) {
    var tscales = document.getElementsByClassName("tscale");
    var setpoints = document.getElementsByClassName("setpoint");
    var  tscale, setpoint;

    // Change label
    for (tscale=0;tscale<tscales.length;tscale++)
      tscales[tscale].textContent = "[" + tempType + "]";

    // Now the actual temp conversion too!
    // °F to °C 	Deduct 32, then multiply by 5, then divide by 9
    // °C to °F 	Multiply by 9, then divide by 5, then add 32
    for (setpoint=0;setpoint<setpoints.length;setpoint++)
      if (tempType == "C") {
        setpoints[setpoint].value = ((setpoints[setpoint].value - 32.0)* 5) / 9;
      } else {
        setpoints[setpoint].value = ((setpoints[setpoint].value * 9) / 5) + 32;
      }
  }

  // Send profiles table back to server for saving
  function saveProfiles() {
    console.log("Saving profile table");
    // Collect data from current profile table,
    // converting into default units (Celsius, minutes).
    // Send it server as type:"save_profile"
    var i, j;
    var setpoint = {};
    var setpoints = [], profile = [], profileSet = [];
    var tempType = document.getElementById("temperatureScaleSelector").value;
    var target, duration;
    var msgobj, jmsg;


    var table = document.getElementById("profilesTable");
    var rows = table.rows;

    for (i=0;i<rows.length;i++) {
      profile = [];
      for (j=0;j<rows[i].cells.length-1;j++) {
        setpoint = {};
        target = document.getElementById("sp" + i + "_" + j).value;
        if (tempType == 'F') {
          target = ((target - 32.0)* 5) / 9;
        }
        duration = document.getElementById("dh" + i + "_" + j).value;
        //console.log("Element has val = " + target + " and " + duration);
        setpoint = {target:target, duration:duration};
        profile.push(setpoint);
      }
      // Add a "zero,zero" setpoint.
      if (tempType == 'F') {
          if ( profile[(profile.length-1)].target != 32 ) {
            setpoint = {target:32.0, duration:'0.0'};
            profile.push(setpoint);
          }
      } else {
          if ( profile[(profile.length-1)].target != 0 ) {
            //console.log("Adding tail setpoint to profile");
            setpoint = {target:0.0, duration:'0.0'};
            profile.push(setpoint);
          }
      }

      profileSet.push(profile);
    }

    msgobj = {type:'save_profiles', data:profileSet};
    //jmsg = JSON.stringify(msgobj);
    sendMessage({data:JSON.stringify(msgobj)});

  }

  /* Profile Graph */
  function getProfileData() {
    //console.log("At: getProfileData()");

    var setpoint = {};
    var profile = [], profileSet = [];
    var target, duration;
    var tempType = document.getElementById("temperatureScaleSelector").value;

    var table = document.getElementById("profilesTable");
    var rows = table.rows;
    for (var i=0;i<rows.length;i++) {
      // Replace blank & non-numeric durations with a zero
      // Replace blank & non-numeric temp values with a zero (or 32)
      for (var k=rows[i].cells.length-2;k>=0;k--) {
        var dhCell = document.getElementById("dh" + i + "_" + k);
        var spCell = document.getElementById("sp" + i + "_" + k);
        var cellDur = dhCell.value.trim();
        var cellVal = spCell.value.trim();
        if ( (!isNumeric(cellDur)) || (parseFloat(cellDur) < 0.0)  ) {
          dhCell.value = 0;
        }
        if ( !isNumeric(cellVal) ) {
          if (tempType == 'F') {
            spCell.value = 32;
          } else {
            spCell.value = 0;
          }
        }
      }

      // Massage final entry to produce vertical cliff denoting end of profile.
      for (var k=rows[i].cells.length-2;k>0;k--) {
        var dhCell = document.getElementById('dh' + i + '_' + k);
        var dhCellPrev = document.getElementById('dh' + i + '_' + (k-1));
        var dur = parseFloat(dhCell.value.trim());
        var durPrev = parseFloat(dhCellPrev.value.trim());
        if ( dur > 0 ) break;
        if ( durPrev == 0 ) continue;
        // By now we have a cell with zero duration
        // while previous cell has nonzero duration
        var spCell = document.getElementById('sp' + i + '_' + k);
        var spCellPrev = document.getElementById('sp' + i + '_' + (k-1));
        var cellVal = parseFloat(spCell.value.trim());
        if ( cellVal == 0 ) {
          var cellValPrev = parseFloat(spCellPrev.value.trim());
          spCell.value = cellValPrev;
        }
      }
    }

    // Collect profile graph data to return
    for (var i=0;i<rows.length;i++) {
      profile = [];
      for (var j=0;j<rows[i].cells.length-1;j++) {
        setpoint = {};
        try {
          target = document.getElementById("sp" + i + "_" + j).value;
        }
        catch(err) {
          console.log("*** Caught error: " + err);
          console.log("*** Setting target as 1.0");
          target = "1.0";
        }
        if (tempType == 'F') {
          target = ((target - 32.0)* 5) / 9;
        }
        duration = document.getElementById("dh" + i + "_" + j).value;
        setpoint = {target:target, duration:duration};
        profile.push(setpoint);
      }
      // Add a "zero,zero" setpoint.
      if (tempType == 'F') {
          setpoint = {target:32.0, duration:'0.0'};
      } else {
          setpoint = {target:0.0, duration:'0.0'};
      }
      profile.push(setpoint);

      profileSet.push(profile);
    }

    return profileSet;
  }

  function updateProfileGraph() {
    //console.log("At: updateProfileGraph()");
    var profileData = getProfileData(); // raw data from Profiles Editor
    var profileDisplayData = [];        // "processed" data for display
    var setpoint = {};

    // Clear any current graph
    profileGraphHolder.selectAll("*").remove();

    /* From the raw profile, generate a dataset that has accumulated times
    */
    //console.log("profileData length = " + profileData.length);
    for (var profile=0;profile<profileData.length;profile++) {
      //console.log("profile length = " + profileData[profile].length);
      var nextStep = 0.0;
      var lineData = [];
      for (var sp=0;sp<profileData[profile].length;sp++) {
        //console.log("pdata: " + profileData[profile][sp]["duration"] + " : " + profileData[profile][sp]["target"]);
        setpoint = {"x":_TESTING_?nextStep:60*nextStep,
                    "y":profileData[profile][sp]["target"]};
        lineData.push(setpoint);
        //console.log("pdata: " + setpoint["x"] + " : " + setpoint["y"]);

        nextStep += resolveGraphTimeValue(profileData[profile][sp]["duration"]);
      }
      profileDisplayData.push(lineData);
    }

    // First find extent of data
    var maxTime = 0.0;
    var maxDataPoint = 0.0;
    var minDataPoint = 1000.0;
    for ( var profile=0;profile<profileDisplayData.length;profile++) {
      var lineData = profileDisplayData[profile];
      var max = 0.0;
      var min = 1000.0;
      var maxt = 0.0;

      min = d3.min(lineData, function(d) {return parseFloat(d.y);});
      max = d3.max(lineData, function(d) {return parseFloat(d.y);});
      if ( min < minDataPoint ) {
        //console.log("new min = " + min);
        minDataPoint = min;
      }
      if ( max > maxDataPoint ) {
        //console.log("new max = " + max);
        maxDataPoint = max;
      }

      maxt = d3.max(lineData, function(d) {return parseFloat(d.x);});
      if ( maxt > maxTime ) {
        maxTime = maxt;
      }
    }
    console.log("minData = " + minDataPoint + ", maxData = " + maxDataPoint + ", maxTime = " + maxTime);

    // Scale & display data
    if ( _TESTING_ ) {
      var formatTime = d3.time.format("%H:%M.%S");
    } else {
      var formatTime = d3.time.format("%-j:%H.%M");
    }
    var formatSeconds = function(d) { return formatTime(new Date(1955,0, 0,0,0,d)); };
    var linearScaleY = d3.scale.linear()
                      .domain([minDataPoint,maxDataPoint])
                      .range([profileGraphHeight,0]);
    var yAxis = d3.svg.axis()
                      .scale(linearScaleY)
                      .orient("left").ticks(5);
    var yAxisGroup = profileGraphHolder.append("g")
                      .attr("transform",
                            "translate(" + profileGraphMargin.left + "," + profileGraphMargin.top + ")")
                      .call(yAxis);
    var linearScaleX = d3.scale.linear()
                      .domain([0,maxTime])
                      .range([0,profileGraphWidth]);
    var xAxis = d3.svg.axis()
                      .scale(linearScaleX)
                      .orient("bottom")
                      .tickValues(makeTickValues(maxTime,18));
                      //.ticks(18);
                      //.tickFormat(formatSeconds);
    var xAxisGroup = profileGraphHolder.append("g")
                      .attr('class', 'x profileAxis')
                      .attr("transform",
                            "translate(" + profileGraphMargin.left + "," + (profileGraphHeight + profileGraphMargin.top) + ")")
                      .call(xAxis);

    // Custom tick format
    profileGraphHolder.selectAll('.x.profileAxis text').text(function(d) { return tickText(d) });

    var xaxistext = profileGraphHolder.append("g")
                          .attr("id", "xaxistext_profileGraph")
                          .attr("class", "axistext")
                          .append("text")
                          .attr("transform",
                              "translate(" + (profileGraphWidth - profileGraphMargin.left)/2 + "," + (profileGraphHeight+ profileGraphMargin.top + profileGraphMargin.bottom) + ")")
                              .attr("dy", "-0.35em")
                              .style("text-anchor", "middle")
                              .text("Duration (" + (_TESTING_?'mins:secs':'days.hours:mins') + ")");

    for ( var profile=0;profile<profileDisplayData.length;profile++) {
      var scaledLineData = [];
      var lineData = profileDisplayData[profile];
      for ( var sp=0;sp<lineData.length;sp++) {
        //console.log("scaled sp = " + lineData[sp].x + " : " + lineData[sp].y);
        scaledLineData.push({"x":linearScaleX(lineData[sp].x),
                             "y":linearScaleY(lineData[sp].y)});
      }
      var profileLineFunction = d3.svg.line()
                                .x(function(d) { return d.x; })
                                .y(function(d) { return d.y; })
                                .interpolate("linear");
      var lineGraph = profileGraphHolder.append("path")
                                .attr("transform",
                                      "translate(" + profileGraphMargin.left + "," + profileGraphMargin.top + ")")
                                .attr("d", profileLineFunction(scaledLineData))
                                .attr("stroke", profileLineColours[profile])
                                .attr("stroke-width", 3)
                                .attr("fill", "none");
    }

  }

  function makeTickValues(maxValue, tickCount) {
    var result = [];
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


  var profileGraphMargin = {top: 50, right: 40, bottom: 60, left: 80},
    profileGraphWidth = 1800 - profileGraphMargin.left - profileGraphMargin.right,
    profileGraphHeight = 400 - profileGraphMargin.top - profileGraphMargin.bottom;
  var profileGraphHolder = d3.select("#profilesGraphHolder").append("svg")
                      .attr("id", "profiles_graph")
                      .attr("class", "generic_graph")
                      .attr("width", profileGraphWidth + profileGraphMargin.right + profileGraphMargin.left)
                      .attr("height", profileGraphHeight + profileGraphMargin.top + profileGraphMargin.bottom)
                      .style("border", "1px solid black")


// END of Profiles Page
/*****************************************************************************/



// START of Configuration Page
/*****************************************************************************/

  var configEntryHolder = document.getElementById("configEntryHolder");

  var fudgeLabel = document.createElement("LABEL");
  fudgeLabel.className = 'config_label';
  fudgeLabel.textContent = 'Sensor Fudge Factor';
  var fudgeInput = document.createElement("INPUT");
  fudgeInput.id = 'sensorFudgeFactor';
  fudgeInput.className = 'config_input';
  fudgeInput.type = 'text';
  fudgeInput.onblur = function() {
      msgobj = {type:'config_change', data:{'sensorFudgeFactor':this.value}};
      sendMessage({data:JSON.stringify(msgobj)});
    }

  var multiSensorMeanWeightLabel = document.createElement("LABEL");
  multiSensorMeanWeightLabel.className = 'config_label';
  multiSensorMeanWeightLabel.textContent = 'Multi Sensor Mean Weight';
  var multiSensorMeanWeightInput = document.createElement("INPUT");
  multiSensorMeanWeightInput.id = 'multiSensorMeanWeight';
  multiSensorMeanWeightInput.className = 'config_input';
  multiSensorMeanWeightInput.type = 'text';
  multiSensorMeanWeightInput.onblur = function() {
      msgobj = {type:'config_change', data:{'multiSensorMeanWeight':this.value}};
      sendMessage({data:JSON.stringify(msgobj)});
    }

  var delayOffLabel = document.createElement("LABEL");
  delayOffLabel.className = 'config_label';
  delayOffLabel.textContent = 'Relay Delay (post OFF)';
  var delayOffInput = document.createElement("INPUT");
  delayOffInput.id = 'relayDelayPostOFF';
  delayOffInput.className = 'config_input';
  delayOffInput.type = 'text';
  delayOffInput.onblur = function() {
      msgobj = {type:'config_change', data:{'relayDelayPostOFF':this.value}};
      sendMessage({data:JSON.stringify(msgobj)});
    }

  var delayOnLabel = document.createElement("LABEL");
  delayOnLabel.className = 'config_label';
  delayOnLabel.textContent = 'Relay Delay (post ON)';
  var delayOnInput = document.createElement("INPUT");
  delayOnInput.id = 'relayDelayPostON';
  delayOnInput.className = 'config_input';
  delayOnInput.type = 'text';
  delayOnInput.onblur = function() {
      msgobj = {type:'config_change', data:{'relayDelayPostON':this.value}};
      sendMessage({data:JSON.stringify(msgobj)});
    }



  configEntryHolder.appendChild(fudgeLabel);
  configEntryHolder.appendChild(fudgeInput);
  configEntryHolder.appendChild(multiSensorMeanWeightLabel);
  configEntryHolder.appendChild(multiSensorMeanWeightInput);
  configEntryHolder.appendChild(delayOffLabel);
  configEntryHolder.appendChild(delayOffInput);
  configEntryHolder.appendChild(delayOnLabel);
  configEntryHolder.appendChild(delayOnInput);

// END of Configuration Page
/*****************************************************************************/


  //var socket = new WebSocket("ws://localhost:8080/ws");
  var socket = new WebSocket("ws://" + location.host + "/wsStatus");
 
  socket.onopen = function(){  
    console.log("sss connected"); 

    // Ask for whatever is needed to startup
    msgobj = {type:'load_startup_data', data:[]};
    sendMessage({data:JSON.stringify(msgobj)});
  };

  socket.onmessage = function (message) {

    var jmsg;
    try {
      jmsg = JSON.parse(message.data);
      if ( jmsg.type === 'startup_data' ) {
        startupData(jmsg.data);
      } else if (jmsg.type === 'info' ) {
        console.log('INFO: ' + jmsg.data);
      } else if (jmsg.type === 'sensor_list' ) {
        // Keep a copy for later
        availableSensors = [];
        while (availableSensors.length > 0) {availableSensors.pop();}
        for (var i=0;i<jmsg.data.length;i++) {
          availableSensors.push(jmsg.data[i]);
        }
        createSensorTableFunction();
      } else if (jmsg.type === 'relay_list' ) {
        // Keep a copy for later
        while (availableRelays.length > 0) {availableRelays.pop();}
        for (var i=0;i<jmsg.data.length;i++) {
          availableRelays.push(jmsg.data[i]);
        }
        createRelayTableFunction();
      } else if (jmsg.type === 'loaded_jobs' ) {
        //createStoredJobsList(jmsg.data);
        createJobTemplatesList(jmsg.data);
      } else if (jmsg.type === 'running_jobs' ) {
        createRunningJobsList(jmsg.data);
      } else if (jmsg.type === 'running_job_status' ) {
        updateRunningJob(jmsg.data);
      } else if (jmsg.type === 'loaded_profiles' ) {
        if ( jmsg.data.length == 0 ) {
          console.log('RCVD: EMPTY profiles data');
        }
        createProfileTableFunction(jmsg.data);
      } else if (jmsg.type === 'heartbeat' ) {
        console.log('HEARTBEAT: ' + jmsg.data);
      } else if (jmsg.type === 'live_update' ) {
        add_live_data(jmsg.sensor_state, jmsg.relay_state);
      } else if (jmsg.type === 'stopped_job' ) {
        jobStopped(jmsg.data);
      } else if (jmsg.type === 'removed_job' ) {
        jobRemoved(jmsg.data);
      } else if (jmsg.type === 'saved_job' ) {
        jobSaved(jmsg.data);
      } else if (jmsg.type === 'saved_jobs_list' ) {
        // Just the list of saved jobs - not any job data
        updateJobsList(jmsg.data['historyfiles'], 'historyListJobsHolder');
      } else if (jmsg.type === 'saved_job_data' ) {
        // Data for a particular saved job
        updateJobHistoryData(jmsg.data);
      } else {
        console.log('Unknown json messsage type: ' + jmsg.type);
      }
    }
    catch(err ) {
      console.log('Non-json msg: ' + message.data);
    }

  };

  socket.onclose = function(){
    console.log("disconnected"); 

    /* Display disconnected status */
    var pageTitles = document.getElementsByClassName("page_title");
    for (var page=0;page<pageTitles.length;page++ ) {
      pageTitles[page].style.background = 'red';
      pageTitles[page].textContent = 'NOT CONNECTED TO PI!';
    }

  };

  var sendMessage = function(message) {
    console.log("sending:" + message.data);
    socket.send(message.data);
  };

  function startupData(data) {
    var data_keys = Object.keys(data)
    //console.log('STARTUP DATA keys: ' + data_keys);
    for (var k in data_keys)  {
      //console.log('             key : ' + data_keys[k] + " = " + data[data_keys[k]]);
      if (data_keys[k] == 'testing') {
        _TESTING_ = data[data_keys[k]]
      } else if (data_keys[k] == 'config') {
        var configItemsKeys = data[data_keys[k]]
        for (var confkey in configItemsKeys) {
          console.log("configItem: " + confkey + " = " + data[data_keys[k]][confkey]);
          document.getElementById(confkey).value = data[data_keys[k]][confkey];
        }
      } else if (data_keys[k] == 'the_end') {
        var the_end_unused = data[data_keys[k]];
      } else {
        console.log("Unknown entry in startupData()! " + data_keys[k] + ":" + data[data_keys[k]]);
      }

    }
    console.log("_TESTING_ is " + _TESTING_);
  }

  function send_relay_cmd(data) {
    var cmd = ["toggle_relay",data]
    var msgobj = {type:'CMD', data:cmd};
    sendMessage({data:JSON.stringify(msgobj)});
  }


// { job1; {}, job2: {}, .... jobn: {} }
// where each job object's value is { linearScaleY: ..., linearScaleX: ..., history: [] }
var runningJobsFunctions = {};


  // Create a table of sensors based on data  from server (availableSensors)
  function createSensorTableFunction() {
    //console.log("Reached createSensorTableFunction() " + availableSensors);

    var table = document.getElementById("jobSensorsTable");

    // First remove existing list elements
    while ( table.hasChildNodes() ) {
      table.removeChild(table.firstChild);
    }

    for(var i=0;i<availableSensors.length;i++) {
        //console.log("Adding sensor: " + availableSensors[i]);
        var row = table.insertRow(i);

        var checkLabel = document.createElement("LABEL");
        checkLabel.setAttribute("for", "as_" + i);
        checkLabel.textContent = availableSensors[i];
        checkLabel.id = "label_as_" + i;

        var check = document.createElement("INPUT");
        check.type = "checkbox";
        check.id = "as_" + i;

        row.appendChild(check);
        row.appendChild(checkLabel);
    }

  }
  // Create a table of relays based on data  from server (availableRelays)
  function createRelayTableFunction() {
    //console.log("Reached createRelayTableFunction() " + availableRelays);

    var table = document.getElementById("jobRelaysTable");

    // First remove existing list elements
    while ( table.hasChildNodes() ) {
      table.removeChild(table.firstChild);
    }

    for(var i=0;i<availableRelays.length;i++) {
        //console.log("Adding relay: " + availableRelays[i]);
        var row = table.insertRow(i);

        var checkLabel = document.createElement("LABEL");
        checkLabel.setAttribute("for", "ar_" + i);      // ar for avail. relays
        checkLabel.textContent = availableRelays[i];
        checkLabel.id = "label_ar_" + i;

        var check = document.createElement("INPUT");
        check.type = "checkbox";
        //check.id = availableRelays[i];
        check.id = "ar_" + i;

        row.appendChild(check);
        row.appendChild(checkLabel);
    }
  }


  // Return index of selected job (or -1 if none is selected)
  function selectedJobIndex() {
    var templatesList = document.getElementsByName("templatesList");
    //console.log(templatesList.length + " jobs found");
    for ( var i=0; i<templatesList.length;i++) {
      if ( templatesList[i].type == "radio" && templatesList[i].checked ) {
        //console.log("selected job: " + i);
        return i;
      }
    }
    //console.log("No job selected");
    return -1;
  }

  // Return true/false whether target name is found in templatesList
  function selectedJobName(target) {
    var templatesList = document.getElementsByName("templatesList");
    console.log(templatesList.length + " jobs found");
    for ( var i=0; i<templatesList.length;i++) {
      var jobLabel = document.getElementById("label_jl_" + i);
      // jobName is 1st field of textContent with all '.' removed
      var jobName = jobLabel.textContent.split(" ")[0].replace(/\./g, "");
      console.log("jobName: " + jobName + " looking for " + target);
      if ( jobName === target ) {
        return true;
      } 
    }
    //console.log("No job selected");
    return false;
  }

  // Generate a display listing of running jobs on front Status page
  function createRunningJobsList(data) {
    console.log("Reached createRunningJobsList(): " + data.length);
    if ( data.length < 1 ) {
      document.getElementById("no_running_jobs").style.display = 'flex';
      document.getElementById("no_running_jobs").style.display = '-webkit-flex';
    } else {
      document.getElementById("no_running_jobs").style.display = 'none';
    }

    // Clean out any existing stuff in the running_jobsHolder div.
    var runningJobsHolder = document.getElementById("running_jobsHolder");
    var last;
    while (last = runningJobsHolder.lastChild) runningJobsHolder.removeChild(last);

    longJobNames = []
    var job_i = 0;
    for (job_i=0;job_i<data.length;job_i++) {
      var job = data[job_i];
      var header = job['header'];
      var updates = job['updates']
      var longName = header['jobName'] + '-' + header['jobInstance'];
      var saveData = {};

      console.log("Creating listing for job: " + job_i + " (" + longName + ")");
      longJobNames.push(longName);


      // Save the data for later use. It should consist of two arrays,
      // 1st with just the job header and 2nd with an array of status updates
      // (for a running job, updates will periodically be added to
      saveData['header'] = [header];
      saveData['updates'] = updates;
      runningData[longName] = saveData;
    }
    updateJobsList(longJobNames, 'running_jobsHolder');
  }
  function createRunningJobsList_OLD(data) {
    //console.log("Reached createRunningJobsList(): " + data.length);
    if ( data.length < 1 ) {
      document.getElementById("no_running_jobs").style.display = 'flex';
      document.getElementById("no_running_jobs").style.display = '-webkit-flex';
    } else {
      document.getElementById("no_running_jobs").style.display = 'none';
    }
    var runningJobsHolder = document.getElementById("running_jobsHolder");

    // Clean out any existing stuff in the running_jobsHolder div.
    var last;
    while (last = runningJobsHolder.lastChild) runningJobsHolder.removeChild(last);

    var job_i = 0;
    for (job_i=0;job_i<data.length;job_i++) {
      var job = data[job_i];
      var jobFunctions = {};
      jobFunctions['history'] = [];
      console.log("Creating graph for job: " + job_i + " (" + job.jobName + ")");

      // If available, save any job history that has been sent
      if ( 'history' in job ) {
        //console.log("FOUND job history" + " (" + job['history'].length + ")");
        for (var i=0;i<job['history'].length;i++) {
          jobFunctions['history'].push(job['history'][i]);
        }
      } else {
        console.log("NO job history found");
      }

      // Create a div in which to display data
      var adiv = document.createElement("DIV");
      adiv.id = job.jobName
      runningJobsHolder.appendChild(adiv);

      var runningJobsGraphMargin = {top: 60, right: 40, bottom: 50, left: 80},
          runningJobsGraphWidth = 1800 - runningJobsGraphMargin.left - runningJobsGraphMargin.right,
          runningJobsGraphHeight = 300 - runningJobsGraphMargin.top - runningJobsGraphMargin.bottom;
      jobFunctions['runningJobsGraphMargin'] = runningJobsGraphMargin;

      //var runningJobsGraphHolder = d3.select(adiv).append("svg")
      var runningJobsGraphHolder = d3.select("#" + job.jobName).append("svg")
                        .attr("id", "running_job_" + job.jobName)
                        .attr("class", "running_job")
                        .attr("width", runningJobsGraphWidth + runningJobsGraphMargin.right + runningJobsGraphMargin.left)
                        .attr("height", runningJobsGraphHeight + runningJobsGraphMargin.top + runningJobsGraphMargin.bottom)
                        .style("border", "1px solid black")

      // Popup menu
      var runningJobPopupMenu = [{
        title: 'STOP job',
        action: function(elm, data, index) {
          console.log('menu item #1 from ' + elm.id + " " + data.title + " " + index);
          //var nodeName = elm.id.replace('running_job_', '');
          var nodeName = elm.id.replace('title_text_', '');
          var msgobj = {type:'stop_running_job', data:{'jobName':nodeName}};
          sendMessage({data:JSON.stringify(msgobj)});

          // Update status
          d3.select('#title_text_' + nodeName).text("Job: " + nodeName + " (stopping)");
        }
      }, {
        title: 'REMOVE job',
        action: function(elm, data, index) {
          console.log('menu item #2 from ' + elm.id + " " + data.title + " " + index);
          //var nodeName = elm.id.replace('running_job_', '');
          var nodeName = elm.id.replace('title_text_', '');
          var confirmRemove = confirm("Remove job " + nodeName + "?");
          if ( confirmRemove == true ) {
            // OK button pressed
            var msgobj = {type:'remove_running_job', data:{'jobName':nodeName}};
            sendMessage({data:JSON.stringify(msgobj)});
            // Update status
            d3.select('#title_text_' + nodeName).text("Job: " + nodeName + " (removing)");
          }
        }
      }, {
        title: 'SAVE job',
        action: function(elm, data, index) {
          console.log('menu item #3 from ' + elm.id + " " + data.title + " " + index);
          //var nodeName = elm.id.replace('running_job_', '');
          var nodeName = elm.id.replace('title_text_', '');
          var msgobj = {type:'save_running_job', data:{'jobName':nodeName}};
          sendMessage({data:JSON.stringify(msgobj)});
          // Update status
          d3.select('#title_text_' + nodeName).text("Job: " + nodeName + " (saving)");
        }
      }];
      // End of popup menu


      // Collect profile data into local array (profileLineData[])
      var profileData = job.jobProfile
      var nextStep = 0.0;
      var profileLineData = [];
      var setpoint = {};
      for (var sp=0;sp<profileData.length;sp++) {
        setpoint = {"x":nextStep,
                    "y":profileData[sp]["target"]};
        profileLineData.push(setpoint);
        //console.log("**** rundata B: " + setpoint["x"] + " : " + setpoint["y"]);

        nextStep += parseFloat(profileData[sp]["duration"]);
      }

      // Find extent of values in profileLineData
      var maxTime = 0.0;
      var maxDataPoint = 0.0;
      var minDataPoint = 1000.0;
      var min = d3.min(profileLineData, function(d) {return parseFloat(d.y);});
      var max = d3.max(profileLineData, function(d) {return parseFloat(d.y);}) + 1.0;
      var maxt = d3.max(profileLineData, function(d) {return parseFloat(d.x);}) + 60;
      if ( min < minDataPoint ) minDataPoint = min;
      if ( max > maxDataPoint ) maxDataPoint = max;
      if ( maxt > maxTime ) maxTime = maxt;
      // Sanity check
      minDataPoint = (minDataPoint<0)?minDataPoint:0;
      maxDataPoint = (maxDataPoint>30)?maxDataPoint:30;
      //console.log("**** minData = " + minDataPoint + ", maxData = " + maxDataPoint + ", maxTime = " + maxTime + "  " + typeof(maxt));

      // Scale & display axes
      //var linearScaleY = d3.scale.linear()
       //                 .domain([minDataPoint,maxDataPoint])
       //                 .range([runningJobsGraphHeight,0]);
      // We want to access this same scale later (for asynchronous temperature update reports)
      // so keep in an object (jobJunctions) which will be stored in some
      // global object i.e. runningJobsFuctions, according to the jobName
      // (since different jobs will have different scales).
      jobFunctions['linearScaleY'] = d3.scale.linear()
                        .domain([minDataPoint,maxDataPoint])
                        .range([runningJobsGraphHeight,0]);
      var yAxis = d3.svg.axis()
                        .scale(jobFunctions['linearScaleY'])
                        .orient("left").ticks(5);
      var yAxisGroup = runningJobsGraphHolder.append("g")
                        .attr("transform",
                              "translate(" + runningJobsGraphMargin.left + "," + runningJobsGraphMargin.top + ")")
                        .call(yAxis);
      //var linearScaleX = d3.scale.linear()
       //                 .domain([0,maxTime])
       //                 .range([0,runningJobsGraphWidth]);
      jobFunctions['linearScaleX'] = d3.scale.linear()
                        .domain([0,maxTime])
                        .range([0,runningJobsGraphWidth]);
      var xAxis = d3.svg.axis()
                        .scale(jobFunctions['linearScaleX'])
                        .orient("bottom")
                        .tickValues(makeTickValues(maxTime,18));
                        //.ticks(20);
      var xAxisGroup = runningJobsGraphHolder.append("g")
                        .attr('class', 'x runningAxis')
                        .attr("transform",
                              "translate(" + runningJobsGraphMargin.left + "," + (runningJobsGraphHeight + runningJobsGraphMargin.top) + ")")
                        .call(xAxis);
      // Custom tick format
      runningJobsGraphHolder.selectAll('.x.runningAxis text').text(function(d) { return tickText(d) });

      // Keep jobFunctions beyond this function for a rainy day
      // e.g. periodic updates about this job from the server
      runningJobsFunctions[job.jobName] = jobFunctions;

      // Axis Labels
      var yaxistext = runningJobsGraphHolder.append("g")
                            .attr("id", "yaxistext_" + job.jobName)
                            .attr("class", "axistext")
                            .append("text")
                                .attr("transform", "rotate(-90)")
                                .attr("x", 0 - (runningJobsGraphHeight - runningJobsGraphMargin.top))
                                .attr("y", runningJobsGraphMargin.left)
                                .attr("dy", "-2.4em")
                                .style("text-anchor", "middle")
                                .text("Temperature (C)");
      var xaxistext = runningJobsGraphHolder.append("g")
                            .attr("id", "xaxistext_" + job.jobName)
                            .attr("class", "axistext")
                            .append("text")
                            .attr("transform",
                                "translate(" + (runningJobsGraphWidth - runningJobsGraphMargin.left)/2 + "," + (runningJobsGraphHeight+ runningJobsGraphMargin.top + runningJobsGraphMargin.bottom) + ")")
                                .attr("dy", "-0.35em")
                                .style("text-anchor", "middle")
                                .text("Elapsed Time (" + (_TESTING_?'mins:secs':'hours:mins') + ")");

      var titletext = runningJobsGraphHolder
                            .append("text")
                            .attr("transform",
                                "translate(" + (runningJobsGraphWidth - runningJobsGraphMargin.left)/2 + "," + runningJobsGraphMargin.top + ")")
                                .attr("dy", "-1em")
                                .attr("id", "title_text_" + job.jobName)
                                .attr("class", "title_Text")
                                .style("text-anchor", "middle")
                                .on("click", function(data, index) {
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
                                    .html('')
                                    .append('ul')
                                    .selectAll('li')
                                    .data(runningJobPopupMenu).enter()
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
                                    .style('left', (d3.event.pageX - 2) + 'px')
                                    .style('top', (d3.event.pageY - 2) + 'px')
                                    .style('display', 'block');
                                  d3.event.preventDefault();

                                  d3.event.stopPropagation();
                                })
                                .text("Job: " + job.jobName);


      // Scale data
      var scaledProfileLineData = [];
      for ( var sp=0;sp<profileLineData.length;sp++) {
        //console.log("scaled sp = " + profileLineData[sp].x + " : " + profileLineData[sp].y);
        scaledProfileLineData.push({"x":runningJobsFunctions[job.jobName].linearScaleX(profileLineData[sp].x),
                             "y":runningJobsFunctions[job.jobName].linearScaleY(profileLineData[sp].y)});
                             //"y":jobFunctions['linearScaleY'](profileLineData[sp].y)});
      }
      // Draw the graph
      var runningJobsLineFunction = d3.svg.line()
                                .x(function(d) { return d.x; })
                                .y(function(d) { return d.y; })
                                .interpolate("linear");
      var lineGraph = runningJobsGraphHolder.append("path")
                                .attr("transform",
                                      "translate(" + runningJobsGraphMargin.left + "," + runningJobsGraphMargin.top + ")")
                                .attr("d", runningJobsLineFunction(scaledProfileLineData))
                                .attr("stroke", "gray")
                                .attr("stroke-width", 2)
                                .attr("fill", "none");


      // Send a dummy update to trigger immediate redraw of temperature trace
      updateRunningJob({'jobName':job.jobName,'type':'dummy'});
    }

  }

  function updateRunningJob(data) {
    if ( 'sensors' in data ) {
      var longJobName = data['jobName'] + '-' + data['jobInstance'];
      runningData[longJobName]['updates'].push(data);
      //console.log("Received running_job_status for " + longJobName + " (" + runningData[longJobName]['updates'].length + ")");
      updateJobHistoryData(0, longJobName)
    } else {
      console.log("Received dummy update for " + data.jobName);
    }
  }
  function updateRunningJob_OLD(data) {
    var runningJobsGraphHolder = d3.select("#running_job_" + data.jobName);
    var jobFunctions = runningJobsFunctions[data.jobName];
    if ( 'sensors' in data ) {
      jobFunctions['history'].push(data);
      //console.log("Received running_job_status for " + data.jobName);
    } else {
      console.log("Received dummy update for " + data.jobName);
    }

    // We keep track of which sensor(s) being used in the array data['sensors']

    // First figure out names of sensors - should be available from first history entry
    for (var sensor_instance=0;sensor_instance<jobFunctions['history'][0]['sensors'].length;sensor_instance++) {
        var sensorName = jobFunctions['history'][0]['sensors'][sensor_instance];
        //console.log("updateRunningJob(): found sensor: " + sensorName);

        // Now build a path for this sensor by going through all the history entries
        var scaledLineData = [];
        for (var i=0;i<jobFunctions['history'].length;i++) {
          //console.log("updateRunningJob(): temp at " + jobFunctions['history'][i]['elapsed'] + " = " + jobFunctions['history'][i][sensorName]);
          scaledLineData.push({"x":jobFunctions['linearScaleX'](parseFloat(jobFunctions['history'][i]['elapsed'])),
                               "y":jobFunctions['linearScaleY'](parseFloat(jobFunctions['history'][i][sensorName]))});
        }

        // Draw the graph
        d3.select("#path_" + data.jobName + "_" + sensorName).remove();
        var runningJobsLineFunction = d3.svg.line()
                                  .x(function(d) { return d.x; })
                                  .y(function(d) { return d.y; })
                                  .interpolate("linear");
        var runningJobsGraphMargin = jobFunctions['runningJobsGraphMargin'];
        var lineGraph = runningJobsGraphHolder.append("path")
                                  .attr("id", "path_" + data.jobName + "_" + sensorName)
                                  .attr("transform",
                                        "translate(" + runningJobsGraphMargin.left + "," + runningJobsGraphMargin.top + ")")
                                  .attr("d", runningJobsLineFunction(scaledLineData))
                                  .attr("stroke", temperatureColours[sensor_instance])
                                  .attr("stroke-width", 4)
                                  .attr("fill", "none");
    }
  }

  function add_live_data(sensor_state, relay_state) {
    //console.log("live_update: " + sensor_state + ", " + relay_state);

    var elementName = 'sensor_update_title';
    if ( ! document.body.contains(document.getElementById(elementName)) ) {
      sensor_updateHolder = document.getElementById('sensor_updateHolder');
      var asensor = document.createElement("DIV");
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
              send_relay_cmd(parseInt(this.id.charAt(this.id.length-1)) + 1);
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
        if (document.getElementById(elementName).textContent == 'OFF') {
          // Must be changing off->on
          beep();
        }
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

/*
    // Set size of live_updateHolder so it can be centered in its container
    document.getElementById('live_updateHolder').style.width = '1200px'; 
    var sensorWidth = parseInt(document.getElementById('sensor_updateHolder').style.width.replace(/\D+/g, ''));
    var relayWidth = parseInt(document.getElementById('relay_updateHolder').style.width.replace(/\D+/g, ''));
    document.getElementById('live_updateHolder').style.width =
        (sensorWidth + relayWidth + 6) + 'px'; 
*/
  }

  function sensorClickHandler(ev) {
    console.log("Pressed button " + ev.button);
  }

  function jobStopped(data) {
/*
    var jobName = data['jobName']
    //console.log("Received stopped_job message " + jobName);
    d3.select('#title_text_' + jobName).text("Job: " + jobName + " (stopped)");
*/
    jobFinishedWith(data, 'stopped');
  }

  function jobRemoved(data) {
    jobFinishedWith(data, 'removed');
  }

  function jobSaved(data) {
    jobFinishedWith(data, 'saved');
  }

  /*
    Remove jobElement_<jobName> & jobElementGraph_<jobName> from running_jobsHolder.
    Show the No Jobs running notice, if that is the case.
    Move data associated with jobName from runningData to historyData
  */
  function jobFinishedWith(data, endStatus) {
    if (endStatus === undefined) endStatus='removed';

    var jobName = data['jobName']
    console.log("Received " + endStatus + "_job message " + jobName);
    var instancePattern = /-[0-9]{8}_[0-9]{6}/;

    // Remove graph from status (running jobs) page
    var running_jobsHolder = document.getElementById('running_jobsHolder');
    var children = document.getElementById("running_jobsHolder").children
    for (var i=0;i<children.length;i++) {
      //console.log("Child: " + children[i].id);
      var thisJobInstance = instancePattern.exec(children[i].id);
      var thisJobName = children[i].id.slice(0,(children[i].id.indexOf(thisJobInstance)));
      //console.log("jobName: " + thisJobName);
      //console.log("Instance: " + thisJobInstance);
      if (thisJobName === 'jobElement_' + jobName ) {
        //console.log("Ready to remove " + thisJobName);
        if ( endStatus !== 'stopped' ) {
          var rem = document.getElementById('jobElement_' + jobName + thisJobInstance);
          rem.parentNode.removeChild(rem);

          rem = document.getElementById('jobElementGraph_' + jobName + thisJobInstance);
          rem.parentNode.removeChild(rem);
        }

        if ( endStatus === 'saved' ) {
          // Move associated data
          historyData[jobName + thisJobInstance] = runningData[jobName + thisJobInstance];
          //Not sure how to effectively remove old version - maybe just leave it?
          //del(historyData[jobName + thisJobInstance]);

          // If necessary, show "no jobs running" notice
          if ( running_jobsHolder.children.length == 0 ) {
            var no_running_jobs = document.getElementById("no_running_jobs");
            //no_running_jobs.innerHTML = "No jobs are currently running";
            no_running_jobs.innerHTML = "<center>" + jobName + " was saved to <a href=#content_2 >Job History</a> <br>No other jobs are currently running</center>";
            no_running_jobs.style.display = 'flex';
            no_running_jobs.style.display = '-webkit-flex';
          }

        } else if ( endStatus === 'stopped' ) {
          console.log('job stopped');

        } else if ( endStatus === 'removed' ) {
          //Not sure how to effectively remove old version - maybe just leave it?
          //del(historyData[jobName + thisJobInstance]);

          // If no more running jobs, reinstate "No running jobs" status
          if ( running_jobsHolder.children.length == 0 ) {
            var no_running_jobs = document.getElementById("no_running_jobs");
            no_running_jobs.innerHTML = "<p>No <a href=#content_2>jobs</a> are currently running</p>";
            no_running_jobs.style.display = 'flex';
            no_running_jobs.style.display = '-webkit-flex';
          }
        }
      }
    }
  }

/************************* Test Area **********************/


  // To replace function createStoredJobsList(data)
  // Generate a listing of stored job templates
  function createJobTemplatesList(data) {
    console.log("Reached createJobTemplatesList() ...");
    var jobTemplatesListHolder = document.getElementById("jobTemplatesListHolder");
    var toolTipDiv = d3.select("body").append("div")
                                      .attr('class', 'templateItemTooltip')
                                      .style('opacity', 0.0);
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
      templateItemName.id = 'tiName_' + name;
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


      templateItem.appendChild(templateItemName);
      templateItem.appendChild(templateItemPreheat);
      templateItem.appendChild(templateItemSensors);
      templateItem.appendChild(templateItemRelays);
      templateItem.appendChild(templateItemProfile);

      jobTemplatesListHolder.appendChild(templateItem);

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
            var msgobj = {type:'delete_job', data:{ index: parseInt(templateItemIndex) }};
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
            var msgobj = {type:'run_job', data:{ index: parseInt(templateItemIndex) }};
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


/*
      // templateItemPreheat tooltip
      d3.selectAll('.templateItemPreheat').on('mouseover', function() {
                                      if (this.getAttribute('isSet') === 'true') {
                                        var preheatText = '<center>Preset Heat/Cool<br/><b>ON</b></center>';
                                      } else {
                                        var preheatText = '<center>Preset Heat/Cool<br/><b>OFF</b></center>';
                                      }
                                      //toolTipDiv.style('display', 'block')
                                      toolTipDiv.style('opacity', 0.9)
                                          .html(preheatText)
                                          .style('left', (getOffsetRect(this).left - 34) + 'px')
                                          .style('top', (getOffsetRect(this).top + 12) + 'px');

                                    })
                                      .on('mouseout', function() {
                                      //toolTipDiv.style('display', 'none');
                                      toolTipDiv.style('opacity', 0.0);
                                    });
*/

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

  } // End function createJobTemplatesList()


/********************** END Test Area **********************/
});


/*
ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab:
*/
