var _TESTING_ = false;

var availableSensors = [];
var availableRelays = [];
var temperatureColours = ["blue", "green", "red", "orange"];
/*
For now, hard code the number of profiles (profilesTableRows)
and number of steps per profile (profilesTableColumns).
Eventually we'll make these settings dynamic.
*/
var profilesTableColumns = 10;
var profilesTableRows = 4;

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

var domReady = function(callback) {
  document.readyState === "interactive" ||
  document.readyState === "complete" ? callback() : document.addEventListener("DOMContentLoaded", callback);
};

domReady( function(){
//$(document).ready( function(){

  var profilesLoadedEvent = new Event('profilesLoadedEvent');


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
                                          console.log("CLICK");
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
  // Refresh job list button ('Jobs' page'
  var refreshJobButton = document.getElementById("refresh_job_button");
  refreshJobButton.onclick = function () {
    console.log("REFRESH job button clicked");

    // Request job data
    var msgobj = {type:'load_jobs', data:[]};
    sendMessage({data:JSON.stringify(msgobj)});
  }

  // New jobs button
  var newJobButton = document.getElementById("new_job_button");
  newJobButton.onclick = function () {
    var jobComposer = document.getElementById("jobComposer");
    if ( jobComposer.style.display == 'block') {
      jobComposer.style.display = 'none';
    } else {
      jobComposer.style.display = 'block';
      console.log("YYY");
      var c = document.getElementById("jobItemsHolder").children;
      var itemsWidth = 0;
      var tallest = 0;
      for (var i=0;i<c.length;i++) {
        itemsWidth += parseInt(window.getComputedStyle(c[i]).width.replace(/\D+/g, ''));
        var itemHeight = parseInt(window.getComputedStyle(c[i]).height.replace(/\D+/g, ''));
        if (itemHeight > tallest ) tallest = itemHeight;
      }
      var jobItemsHolder = document.getElementById('jobItemsHolder');
      jobItemsHolder.style.width = (38 + itemsWidth) + 'px';

      // Use height of tallest item to set height of jobItemsHolder
      jobItemsHolder.style.height = (30 + tallest) + 'px';

    }
  }

  // Delete job button
  var deleteJobButton = document.getElementById("delete_job_button");
  deleteJobButton.onclick = function () {
    console.log("DELETE job button clicked");
    var jobIndex = selectedJobIndex();
    if ( jobIndex < 0 )
        return;
    // else confirmation dialog?

    // Request job deletion
    //var jobData = { index: jobIndex };
    var msgobj = {type:'delete_job', data:{ index: jobIndex }};
    sendMessage({data:JSON.stringify(msgobj)});
  }

  // Run job button
  var runJobButton = document.getElementById("run_job_button");
  runJobButton.onclick = function () {
    //console.log("RUN job button clicked");
    var jobIndex = selectedJobIndex();
    if ( jobIndex < 0 )
        return;

    // We want the jobName to use for user confirmation
    var jobLabel = document.getElementById("label_jl_" + jobIndex);
    // jobName is 1st field of textContent with all '.' removed
    var jobName = jobLabel.textContent.split(" ")[0].replace(/\./g, "");

    var confirmRun = confirm("Run job " + jobName + "?");
    if ( confirmRun == true ) {
      //alert("You pressed OK");

      // Request job run
      var msgobj = {type:'run_job', data:{ index: jobIndex }};
      sendMessage({data:JSON.stringify(msgobj)});

      // Now go to status page to view job progress
      document.getElementById("no_running_jobs").innerHTML = "Waiting for job " + jobName + " to start";
      location.href = "#content_1";
    } else {
      return;
    }
  }


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

  function updateJobHistoryData(data) {
    // data should consist of  two arrays,
    // 1st with just the job header and 2nd with an array of status updates
    //console.log("Received msg: saved_job_data " + data);
    var header = data['header'];
    var updates = data['updates'];
    var longName = header[0]['jobName'] + '-' + header[0]['jobInstance'];
    //console.log("longName: " + longName);

/* Examples of extracting various fields
    console.log("updateJobHistoryData() jobProfile: " + header[0]['jobProfile'] + " " + header[0]['jobProfile'].length);
    console.log("updateJobHistoryData() jobName: " + header[0]['jobName'] + " " + header.length);
    console.log("updateJobHistoryData() updates: " + updates + " " + updates.length);
    for (var i=0;i<updates.length;i++) {
      console.log("updateJobHistoryData() temp at " + parseFloat(updates[i]['elapsed']).toFixed(2) + " = " + updates[i][updates[i]['sensors'][0]]);
    }
*/
    var historyJobsGraphMargin = {top: 20, right: 40, bottom: 50, left: 60},
        historyJobsGraphWidth = 1800 - historyJobsGraphMargin.left - historyJobsGraphMargin.right,
        historyJobsGraphHeight = 256 - historyJobsGraphMargin.top - historyJobsGraphMargin.bottom;

    // Draw the graph of job history
    d3.select("#history_" + longName).remove();
    var historyJobsGraphHolder = d3.select("#historyElementGraph_" + longName).append("svg")
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
      for (var sensor_instance=0;sensor_instance<header[0]['jobSensors'].length;sensor_instance++) {
        console.log("updateJobHistoryData() sensor name: " + header[0]['jobSensors'][sensor_instance]);
        var sensorName = header[0]['jobSensors'][sensor_instance];

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

      for (var sensor_instance=0;sensor_instance<header[0]['jobSensors'].length;sensor_instance++) {
        var temperature = d3.min(temperatureLineDataHolder[sensor_instance], function(d) {return parseFloat(d.y);});
        if (temperature < minDataPoint ) minDataPoint = temperature;
        temperature = d3.max(temperatureLineData[sensor_instance], function(d) {return parseFloat(d.y);}) + 1.0;
        if (temperature > maxDataPoint ) maxDataPoint = temperature;
        temperature = d3.max(temperatureLineData[sensor_instance], function(d) {return parseFloat(d.x);}) + 60;
        if ( temperature > maxTime ) maxTime = temperature;
      }


      // Sanity check
      minDataPoint = (minDataPoint<0)?minDataPoint:0;
      maxDataPoint = (maxDataPoint>30)?maxDataPoint:30;
      //console.log("**** minDataPoint = " + minDataPoint + ", maxDataPoint = " + maxDataPoint + ", maxTime = " + maxTim);


      // Scale & axes
      var historyLinearScaleY = d3.scale.linear()
                        .domain([minDataPoint,maxDataPoint])
                        .range([historyJobsGraphHeight,0]);
      var historyYAxis = d3.svg.axis()
                        .scale(historyLinearScaleY)
                        .orient("left").ticks(4);
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
                        .tickValues(makeTickValues(maxTime,18));
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

      for (var sensor_instance=0;sensor_instance<header[0]['jobSensors'].length;sensor_instance++) {
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

  function updateJobHistoryList(data) {
      //console.log("Received msg: saved_jobs_list");
      var historyfiles = data['historyfiles']
      var historyListJobsHolder = document.getElementById("historyListJobsHolder");
      var instancePattern = /[0-9]{8}_[0-9]{6}/;

      // First remove existing items
      while ( historyListJobsHolder.hasChildNodes() ) {
        historyListJobsHolder.removeChild(historyListJobsHolder.firstChild);
      }


      for (var i=0;i<historyfiles.length;i++) {
        //console.log("              " + historyfiles[i]);
        // Extract some identifiers from the filename
        var jobInstance = instancePattern.exec(historyfiles[i]);
        var jobName = historyfiles[i].slice(0,(historyfiles[i].indexOf(jobInstance)-1));

        var historyElement = document.createElement('DIV');
        historyElement.id = 'historyElement_' + jobName + '-' + jobInstance;
        historyElement.className = 'historyElement';

        var historyElementGraph = document.createElement('DIV');
        historyElementGraph.id = 'historyElementGraph_' + jobName + '-' + jobInstance;
        historyElementGraph.className = 'historyElementGraph';

        var historyItemName = document.createElement('DIV');
        historyItemName.id = 'historyItemName' + i;
        historyItemName.className = 'historyItemName';
        historyItemName.innerHTML = "<html>" + jobName + "</html>"

        var historyItemInstance = document.createElement('DIV');
        historyItemInstance.id = 'historyItemInstance_' + jobName + '-' + jobInstance;
        historyItemInstance.className = 'historyItemInstance';
        historyItemInstance.innerHTML = "<html>" + jobInstance + "</html>"
/*
        historyItemInstance.onclick = function() {
          var historyElementGraphName = 'historyElementGraph_' +
                                  this.id.slice('historyElementGraph_'.length);
          //console.log('historyElementGraphName = ' + historyElementGraphName);
          var historyElementGraph = document.getElementById(historyElementGraphName);
          if ( historyElementGraph.style.display == 'block') {
            historyElementGraph.style.display = 'none';
          } else {
            historyElementGraph.style.display = 'block';

            // Only download history data if we don't already have it
            if ( (!historyElementGraph.hasChildNodes()) ) {
              msgobj = {type:'load_saved_job_data', data:{'fileName':historyElementGraphName.slice('historyElementGraph_'.length)}};
              sendMessage({data:JSON.stringify(msgobj)});
            }
          }
        }
*/

        historyElement.appendChild(historyItemName);
        historyElement.appendChild(historyItemInstance);
        historyListJobsHolder.appendChild(historyElement);
        historyListJobsHolder.appendChild(historyElementGraph);
      }

      // Popup menu
      var historyElementMenu = [{
        title: 'Display',
        action: function(elm, data, index) {
          console.log('menu item #1 from ' + elm.id + " " + data.title + " " + index);
          var historyElementGraphName = 'historyElementGraph_' +
                                  elm.id.slice('historyElementGraph_'.length);
          console.log('historyElementGraphName = ' + historyElementGraphName);
          var historyElementGraph = document.getElementById(historyElementGraphName);
          if ( historyElementGraph.style.display == 'block') {
            historyElementGraph.style.display = 'none';
          } else {
            historyElementGraph.style.display = 'block';

            // Only download history data if we don't already have it
            if ( (!historyElementGraph.hasChildNodes()) ) {
              msgobj = {type:'load_saved_job_data', data:{'fileName':historyElementGraphName.slice('historyElementGraph_'.length)}};
              sendMessage({data:JSON.stringify(msgobj)});
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

      d3.selectAll(".historyItemInstance").on("click", function(data, index) {
                                              console.log("CLICK");
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
                                                  .data(historyElementMenu).enter()
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

    if( loadedProfileData.length == 0 ) {
      pdata = dummyProfileSet;
    } else {
      pdata = loadedProfileData;
    }
    for (i=0;i<pdata.length;i++) {
      var row = table.insertRow(i);
      var th = row.insertCell(0).appendChild(document.createElement('TH'));
      th.appendChild(document.createTextNode("Profile " + i));
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
    var lineColours = ["green", "red", "orange", "blue"];

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
                                .attr("stroke", lineColours[profile])
                                .attr("stroke-width", 3)
                                .attr("fill", "none");
    }

  }

  function makeTickValues(maxValue, tickCount) {
    var result = [];
    var width = Math.floor(maxValue/tickCount)
    for (var i=0;i<tickCount;i++) {
      result.push(i*width);
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


// END of Profiles Configuration
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
        createStoredJobsList(jmsg.data);
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
        updateJobHistoryList(jmsg.data);
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
    var navmenu = document.getElementsByClassName("nav_bar");
    //console.log("Nav Menu has " + navmenu.length + " elements");
    for (var el=0;el<navmenu.length;el++ ) {
      navmenu[el].style.background = 'red';
    }
    for (var el=1;el<navmenu.length;el++ ) {
      navmenu[el].textContent = 'NOT CONNECTED TO PI!';
    }

    d3.selectAll(".page_title").style("background", "red")
                              .text('NOT CONNECTED TO SERVER!');
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

  // Generate a listing of stored jobs
  function createStoredJobsList(data) {
    //console.log("Reached createStoredJobsList()");
    var table = document.getElementById("jobsListJobs");

    // First remove existing list elements
    while ( table.hasChildNodes() ) {
      table.removeChild(table.firstChild);
    }


    for (var i=0;i<data.length;i++) {
      var thisJob = data[i];
      var name = thisJob['name'];
      var preheat = "Preheat OFF";
      var description = name + '................'.slice(name.length);
      if ( thisJob['preheat'] ) {
        preheat = "Preheat  ON";
      }
      description = description + "    " + preheat + "    " + thisJob['profile'] + "    " + thisJob['sensors'] + "    " + thisJob['relays'];
      //console.log("loading job: " + description);

      var row = table.insertRow(i);
      var radioLabel = document.createElement("LABEL");
      radioLabel.setAttribute("for", "jl_" + i);      // jl for jobs list
      radioLabel.textContent = description;
      radioLabel.id = "label_jl_" + i;

      var radio = document.createElement("INPUT");
      radio.setAttribute("type", "radio");
      radio.setAttribute("name", "jobsList");
      radio.id = "jl_" + i;

      row.appendChild(radio);
      row.appendChild(radioLabel);
    }
  }

  // Return index of selected job (or -1 if none is selected)
  function selectedJobIndex() {
    var jobsList = document.getElementsByName("jobsList");
    //console.log(jobsList.length + " jobs found");
    for ( var i=0; i<jobsList.length;i++) {
      if ( jobsList[i].type == "radio" && jobsList[i].checked ) {
        //console.log("selected job: " + i);
        return i;
      }
    }
    //console.log("No job selected");
    return -1;
  }

  // Return true/false whether target name is found in jobsList
  function selectedJobName(target) {
    var jobsList = document.getElementsByName("jobsList");
    console.log(jobsList.length + " jobs found");
    for ( var i=0; i<jobsList.length;i++) {
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
    //console.log("Reached createRunningJobsList(): " + data.length);
    if ( data.length < 1 ) {
      document.getElementById("no_running_jobs").style.display = 'flex';
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

/*
                                .on("click", function() {
                                  onRunningJobTitleClick(this.id)
                                }
*/
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
        document.getElementById(elementName).textContent = 'ON';
      } else {
        document.getElementById(elementName).textContent = 'OFF';
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

    // Set size of live_updateHolder so it can be centered in its container
    //document.getElementById('live_updateHolder').style.width = '1200px'; 
    var sensorWidth = parseInt(document.getElementById('sensor_updateHolder').style.width.replace(/\D+/g, ''));
    var relayWidth = parseInt(document.getElementById('relay_updateHolder').style.width.replace(/\D+/g, ''));
    document.getElementById('live_updateHolder').style.width =
        (sensorWidth + relayWidth + 6 /* borders fudge factor*/) + 'px'; 
  }

  function sensorClickHandler(ev) {
    console.log("Pressed button " + ev.button);
  }

  function jobStopped(data) {
    var jobName = data['jobName']
    //console.log("Received stopped_job message " + jobName);
    d3.select('#title_text_' + jobName).text("Job: " + jobName + " (stopped)");
  }

  function jobRemoved(data) {
    var jobName = data['jobName']
    //console.log("Received removed_job message " + jobName);
    d3.select('#title_text_' + jobName).text("Job: " + jobName + " (removed)");

    var jobDiv = document.getElementById(jobName);
    while (jobDiv.firstChild) {
      jobDiv.removeChild(jobDiv.firstChild);
    }
    jobDiv.remove();

    // If no more running jobs, reinstate "No running jobs" status
    var running_jobsHolder = document.getElementById('running_jobsHolder');
    if ( running_jobsHolder.children.length == 0 ) {
      var no_running_jobs = document.getElementById("no_running_jobs");
      no_running_jobs.innerHTML = "<p>No jobs are currently running</p>";
      no_running_jobs.style.display = 'flex';
    }

  }

  function jobSaved(data) {
    var jobName = data['jobName']
    //console.log("Received saved_job message " + jobName);
    d3.select('#title_text_' + jobName).text("Job: " + jobName + " (saved)");

    var jobDiv = document.getElementById(jobName);
    while (jobDiv.firstChild) {
      jobDiv.removeChild(jobDiv.firstChild);
    }
    jobDiv.remove();

    var running_jobsHolder = document.getElementById('running_jobsHolder');
    if ( running_jobsHolder.children.length == 0 ) {
      var no_running_jobs = document.getElementById("no_running_jobs");
      //no_running_jobs.innerHTML = "No jobs are currently running";
      no_running_jobs.innerHTML = "<center>" + jobName + " was saved to <a href=#content_2 >Job History</a> <br>No other jobs are currently running</center>";
      no_running_jobs.style.display = 'flex';
    }
  }

  function onRunningJobTitleClick(id) {
    var textName = id.replace('title_text_', '');
    console.log("CLICK " + textName);

      //d3.event.stopPropagation();
  }

});


/*
ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab:
*/
