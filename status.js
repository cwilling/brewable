var _TESTING_ = true;

var availableSensors = [];
var availableRelays = [];
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
        //setpoint = {target: (20.0+j+i), duration: 1};
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

$(document).ready( function(){

  var profilesLoadedEvent = new Event('profilesLoadedEvent');

  var received = $('#received');

/***********************  Jobs Configuration page  ***************************/
  // Refresh job list button ('Jobs' page'
  var refreshJobButton = document.getElementById("refresh_job_button");
  refreshJobButton.onclick = function () {
    console.log("REFRESH job button clicked");

    // Request job data
    msgobj = {type:'load_jobs', data:[]};
    sendMessage({data:JSON.stringify(msgobj)});
  }

  // New jobs button
  var newJobButton = document.getElementById("new_job_button");
  newJobButton.onclick = function () {
    console.log("NEW job button clicked");
  }

  // Edit job button
  var editJobButton = document.getElementById("edit_job_button");
  editJobButton.onclick = function () {
    console.log("EDIT job button clicked");
  }

  // Run job button
  var runJobButton = document.getElementById("run_job_button");
  runJobButton.onclick = function () {
    console.log("RUN job button clicked");
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
    msgobj = {type:'delete_job', data:{ index: jobIndex }};
    sendMessage({data:JSON.stringify(msgobj)});
  }

  // Run job button
  var runJobButton = document.getElementById("run_job_button");
  runJobButton.onclick = function () {
    console.log("RUN job button clicked");
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
      msgobj = {type:'run_job', data:{ index: jobIndex }};
      sendMessage({data:JSON.stringify(msgobj)});
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
    msgobj = {type:'list_sensors', data:[]};
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

    // Collect the job name
    var jobName = document.getElementById("jobName").value;
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
      console.log("msgobj: " + msgobj);
      sendMessage({data:JSON.stringify(msgobj)});
    } else {
      console.log("NOT OKtoSave");
    }



  }





/********************* Profiles Configuration page ***************************/
  // Profiles Save button
  var saveProfilesButton = document.getElementById("saveProfiles");
  saveProfilesButton.onclick = function() {
    saveProfiles();
  }
  var updateProfileGraphButton = document.getElementById("updateProfileGraph");
  updateProfileGraphButton.onclick = function() {
    updateProfileGraph();
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
        console.log("Element has val = " + target + " and " + duration);
        setpoint = {target:target, duration:duration};
        profile.push(setpoint);
      }
      profileSet.push(profile);
    }

    msgobj = {type:'save_profiles', data:profileSet};
    console.log("msgobj: " + msgobj);
    //jmsg = JSON.stringify(msgobj);
    sendMessage({data:JSON.stringify(msgobj)});

  }

  /* Profile Graph */
  function getProfileData() {
    console.log("At: getProfileData()");

    var setpoint = {};
    var profile = [], profileSet = [];
    var target, duration;
    var tempType = document.getElementById("temperatureScaleSelector").value;

    var table = document.getElementById("profilesTable");
    var rows = table.rows;
    for (var i=0;i<rows.length;i++) {
      profile = [];
      for (var j=0;j<rows[i].cells.length-1;j++) {
        setpoint = {};
        target = document.getElementById("sp" + i + "_" + j).value;
        if (tempType == 'F') {
          target = ((target - 32.0)* 5) / 9;
        }
        duration = document.getElementById("dh" + i + "_" + j).value;
        setpoint = {target:target, duration:duration};
        profile.push(setpoint);
      }
      profileSet.push(profile);
    }
    return profileSet;
  }

  function updateProfileGraph() {
    console.log("At: updateProfileGraph()");
    var profileData = getProfileData(); // raw data from Profiles Editor
    var profileDisplayData = [];        // "processed" data for display
    var setpoint = {};
    var lineColours = ["green", "red", "orange", "blue"];

    // Clear any current graph
    profileGraphHolder.selectAll("*").remove();

    /* From the raw profile, generate a dataset that has accumulated times
    */
    console.log("profileData length = " + profileData.length);
    for (var profile=0;profile<profileData.length;profile++) {
      console.log("profile length = " + profileData[profile].length);
      var nextStep = 0.0;
      var lineData = [];
      for (var sp=0;sp<profileData[profile].length;sp++) {
        //console.log("pdata: " + profileData[profile][sp]["duration"] + " : " + profileData[profile][sp]["target"]);
        setpoint = {"x":nextStep,
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
                      .orient("bottom").ticks(20);
    var xAxisGroup = profileGraphHolder.append("g")
                      .attr("transform",
                            "translate(" + profileGraphMargin.left + "," + (profileGraphHeight + profileGraphMargin.top) + ")")
                      .call(xAxis);


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


  var profileGraphMargin = {top: 100, right: 20, bottom: 30, left: 80},
    profileGraphWidth = 1800 - profileGraphMargin.left - profileGraphMargin.right,
    profileGraphHeight = 500 - profileGraphMargin.top - profileGraphMargin.bottom;
  var profileGraphHolder = d3.select("#profilesGraphHolder").append("svg")
                      .attr("id", "profiles_graph")
                      .attr("class", "profiles_graph")
                      .attr("width", profileGraphWidth + profileGraphMargin.right + profileGraphMargin.left)
                      .attr("height", profileGraphHeight + profileGraphMargin.top + profileGraphMargin.bottom)
                      .style("border", "1px solid black")


// END of Profiles Configuration
/*****************************************************************************/

  //var socket = new WebSocket("ws://localhost:8080/ws");
  var socket = new WebSocket("ws://" + location.host + "/wsStatus");
 
  socket.onopen = function(){  
    console.log("sss connected"); 

    // Load any running jobs from server; to show on Status page
    msgobj = {type:'load_running_jobs', data:[]};
    sendMessage({data:JSON.stringify(msgobj)});

    // Request profiles data
    msgobj = {type:'load_profiles', data:[]};
    sendMessage({data:JSON.stringify(msgobj)});
  };

  socket.onmessage = function (message) {

    var jmsg;
    try {
      jmsg = JSON.parse(message.data);
      if ( jmsg.type === 'info' ) {
        received.append('INFO: ');
        received.append(jmsg.data);
        received.append($('<br/>'));
      } else if (jmsg.type === 'sensor_list' ) {
        // Keep a copy for later
        availableSensors = [];
        for (var i=0;i<jmsg.data.length;i++) {
          availableSensors.push(jmsg.data[i]);
        }
        createSensorTableFunction();
      } else if (jmsg.type === 'relay_list' ) {
        console.log("Received relay_list " + jmsg.data);
        // Keep a copy for later
        availableRelays = [];
        for (var i=0;i<jmsg.data.length;i++) {
          availableRelays.push(jmsg.data[i]);
        }
        createRelayTableFunction();
      } else if (jmsg.type === 'loaded_jobs' ) {
        console.log("Received loaded_jobs " + jmsg.data);
        createStoredJobsList(jmsg.data);
      } else if (jmsg.type === 'running_jobs' ) {
        console.log("Received started_job " + jmsg.data);
        createRunningJobsList(jmsg.data);
      } else if (jmsg.type === 'running_job_status' ) {
        updateRunningJob(jmsg.data);
      } else if (jmsg.type === 'loaded_profiles' ) {
        if ( jmsg.data.length == 0 ) {
          received.append('RCVD: EMPTY profiles data');
        } else {
          received.append('RCVD: OK profiles data');
        }
        received.append($('<br/>'));
        //updateProfilesTableData(jmsg.data);
        createProfileTableFunction(jmsg.data);
      } else if (jmsg.type === 'heartbeat' ) {
        received.append('HEARTBEAT: ');
        received.append(jmsg.data);
        received.append($('<br/>'));
      } else if (jmsg.type === 'live_update' ) {
        add_live_data(jmsg.sensorId, jmsg.data);
      } else if (jmsg.type === 'relay_state' ) {
        update_relay_state(jmsg.data);
      } else {
        console.log('Unknown json messsage type: ' + jmsg.type);
      }
    }
    catch(err ) {
      console.log('Non-json msg: ' + message.data);
      //received.append(message.data);
      //received.append($('<br/>'));
    }
    finally {
      received.scrollTop(received.prop('scrollHeight'));
    }

  };

  socket.onclose = function(){
    console.log("disconnected"); 

    /* Display disconnected status */
    var navmenu = document.getElementsByClassName("status_navigation");
    //console.log("Nav Menu has " + navmenu.length + " elements");
    for (var el=0;el<navmenu.length;el++ ) {
      navmenu[el].style.background = 'red';
    }
    for (var el=1;el<navmenu.length;el++ ) {
      navmenu[el].textContent = 'NOT CONNECTED TO PI!';
    }
  };

  var sendMessage = function(message) {
    console.log("sending:" + message.data);
    socket.send(message.data);
  };

  // send a command to the serial port
  $("#cmd_send").click(function(ev){
    ev.preventDefault();
    var cmd = $('#cmd_value').val();
    sendMessage({ 'data' : cmd});
    $('#cmd_value').val("");
  });

  $('#clear').click(function(){
    received.empty();
  });


  $("#relay_btn_1").click(function(ev){
    ev.preventDefault();
    send_relay_cmd(1);
  });
  $("#relay_btn_2").click(function(ev){
    ev.preventDefault();
    send_relay_cmd(2);
  });
  $("#relay_btn_3").click(function(ev){
    ev.preventDefault();
    send_relay_cmd(3);
  });
  $("#relay_btn_4").click(function(ev){
    ev.preventDefault();
    send_relay_cmd(4);
  });

  function send_relay_cmd(data) {
    var cmd = ["toggle_relay",data]
    var msgobj = {type:'CMD', data:cmd};
    sendMessage({data:JSON.stringify(msgobj)});
  }


/* Initial graph for testing. Can be removed!
var margin = {top: 100, right: 20, bottom: 30, left: 80},
    width = 600 - margin.left - margin.right,
    height = 400 - margin.top - margin.bottom;

var minDataPoint = 20;
var maxDataPoint = 80;
var liveLinearScale = d3.scale.linear()
	.domain([minDataPoint, maxDataPoint])
	.range([height, 0]);
var yAxis = d3.svg.axis()
	.scale(liveLinearScale)
	.orient("left").ticks(5);

  function make_x_axis() {		
      return d3.svg.axis()
          .scale(x)
          .orient("bottom")
          .ticks(5)
  }
  function make_y_axis() {		
      return d3.svg.axis()
          .scale(y)
          .orient("left")
          .ticks(5)
  }

var svgContainer = d3.select("#live_updateHolder")
    .append("svg")
        .attr("id", "live_update")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
	.style("border", "1px solid black")
    .append("g")
	.attr("class", "yaxisticks")
        .attr("transform", 
              "translate(" + margin.left + "," + margin.top + ")")
        .call(yAxis);

svgContainer.append("g")
    .attr("class", "axistext")
    .append("text")
	.attr("transform", "rotate(-90)")
	.attr("x", 0 - margin.top)
	.attr("y", 0 - (margin.left/2))
	.attr("dy", "1em")
	.style("text-anchor", "middle")
	.text("Temperature (C)");
*/

//var lineGraph = svgContainer.append("path");

// Container for temperature arrays named by sensor id
var liveTemps = {};

var live_temps = [];
var live_temps_scaled = [];

var liveTempsLineData = {};
var live_temps_lineData = [];
var live_temps_lineData_scaled = [];

var liveLineFunction = d3.svg.line()
	.x(function(d) {return d.time})
	.y(function(d) {return d.temp})
	.interpolate("linear");

// { job1; {}, job2: {}, .... jobn: {} }
// where each job object's value is { linearScaleY: ..., linearScaleX: ..., history: [] }
var runningJobsFunctions = {};


  // Create a table of sensors based on data  from server (availableSensors)
  function createSensorTableFunction() {
    console.log("Reached createSensorTableFunction() " + availableSensors);

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
    console.log("Reached createRelayTableFunction() " + availableRelays);

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
    console.log("Reached createStoredJobsList()");
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
      console.log("loading job: " + description);

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
    console.log("Reached createRunningJobsList(): " + data.length);
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
        console.log("FOUND job history" + " (" + job['history'].length + ")");
        for (var i=0;i<job['history'].length;i++) {
          jobFunctions['history'].push(job['history'][i]);
        }
      } else {
        console.log("NO job history found");
      }

      // Create a div in which to display data
      var adiv = document.createElement("DIV");
      adiv.id = job.jobName
      adiv.appendChild(document.createTextNode('Running Job ' + job_i));
      runningJobsHolder.appendChild(adiv);

      var runningJobsGraphMargin = {top: 60, right: 20, bottom: 50, left: 80},
          runningJobsGraphWidth = 1800 - runningJobsGraphMargin.left - runningJobsGraphMargin.right,
          runningJobsGraphHeight = 300 - runningJobsGraphMargin.top - runningJobsGraphMargin.bottom;
      jobFunctions['runningJobsGraphMargin'] = runningJobsGraphMargin;

      var runningJobsGraphHolder = d3.select("#" + job.jobName).append("svg")
                        .attr("id", "running_job_" + job.jobName)
                        .attr("class", "running_job")
                        .attr("width", runningJobsGraphWidth + runningJobsGraphMargin.right + runningJobsGraphMargin.left)
                        .attr("height", runningJobsGraphHeight + runningJobsGraphMargin.top + runningJobsGraphMargin.bottom)
                        .style("border", "1px solid black")

      // Collect profile data into local array (lineData[])
      var profileData = job.jobProfile
      //console.log("createRunningJobsList(): name: " + job.jobName + " " + profileData.length);

      var nextStep = 0.0;
      var lineData = [];
      var setpoint = {};
      for (var sp=0;sp<profileData.length;sp++) {
        //console.log("rundata A: " + profileData[sp]["duration"] + " : " + profileData[sp]["target"] + " (" + nextStep + ")");
        setpoint = {"x":nextStep,
                    "y":profileData[sp]["target"]};
        lineData.push(setpoint);
        //console.log("rundata B: " + setpoint["x"] + " : " + setpoint["y"]);

        nextStep += parseFloat(profileData[sp]["duration"]);
      }

      // Find extent of values in lineData
      var maxTime = 0.0;
      var maxDataPoint = 0.0;
      var minDataPoint = 1000.0;
      var min = d3.min(lineData, function(d) {return parseFloat(d.y);});
      var max = d3.max(lineData, function(d) {return parseFloat(d.y);}) + 1.0;
      var maxt = d3.max(lineData, function(d) {return parseFloat(d.x);}) + 60;
      if ( min < minDataPoint ) minDataPoint = min;
      if ( max > maxDataPoint ) maxDataPoint = max;
      if ( maxt > maxTime ) maxTime = maxt;
      console.log("minData = " + minDataPoint + ", maxData = " + maxDataPoint + ", maxTime = " + maxTime + "  " + typeof(maxt));

      // Scale & display axes
      //var linearScaleY = d3.scale.linear()
       //                 .domain([minDataPoint,maxDataPoint])
       //                 .range([runningJobsGraphHeight,0]);
      // We want to access this same scale later (for asynchronous temperature update reports)
      // so keep in an object (jobJunctions) which will be stored in a global object (runningJobsFuctions)
      // according to the jobName (since different jobs will have different scales).
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
                        .orient("bottom").ticks(20);
      var xAxisGroup = runningJobsGraphHolder.append("g")
                        .attr("transform",
                              "translate(" + runningJobsGraphMargin.left + "," + (runningJobsGraphHeight + runningJobsGraphMargin.top) + ")")
                        .call(xAxis);

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
                                .text("Elapsed Time");
      var titletext = runningJobsGraphHolder.append("g")
                            .attr("id", "xaxistext_" + job.jobName)
                            .attr("class", "axistext")
                            .append("text")
                            .attr("transform",
                                "translate(" + (runningJobsGraphWidth - runningJobsGraphMargin.left)/2 + "," + runningJobsGraphMargin.top + ")")
                                .attr("dy", "-1em")
                                .style("text-anchor", "middle")
                                .text("Job: " + job.jobName);


      // Scale data
      var scaledLineData = [];
      for ( var sp=0;sp<lineData.length;sp++) {
        //console.log("scaled sp = " + lineData[sp].x + " : " + lineData[sp].y);
        scaledLineData.push({"x":runningJobsFunctions[job.jobName].linearScaleX(lineData[sp].x),
                             "y":runningJobsFunctions[job.jobName].linearScaleY(lineData[sp].y)});
                             //"y":jobFunctions['linearScaleY'](lineData[sp].y)});
      }
      // Draw the graph
      var runningJobsLineFunction = d3.svg.line()
                                .x(function(d) { return d.x; })
                                .y(function(d) { return d.y; })
                                .interpolate("linear");
      var lineGraph = runningJobsGraphHolder.append("path")
                                .attr("transform",
                                      "translate(" + runningJobsGraphMargin.left + "," + runningJobsGraphMargin.top + ")")
                                .attr("d", runningJobsLineFunction(scaledLineData))
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

    // We assume only 1 temperature sensor being used but we could use more.
    // Therefore we keep track of which one(s) in an array data['sensors']

    var scaledLineData = [];
    for (var i=0;i<jobFunctions['history'].length;i++) {
      var sensorName = jobFunctions['history'][i]['sensors'][0];
      //console.log("updateRunningJob(): temp at " + jobFunctions['history'][i]['elapsed'] + " = " + jobFunctions['history'][i][sensorName]);
      scaledLineData.push({"x":jobFunctions['linearScaleX'](parseFloat(jobFunctions['history'][i]['elapsed'])),
                           "y":jobFunctions['linearScaleY'](parseFloat(jobFunctions['history'][i][sensorName]))});
    }
    // Draw the graph
    d3.select("#path_" + data.jobName).remove();
    var runningJobsLineFunction = d3.svg.line()
                              .x(function(d) { return d.x; })
                              .y(function(d) { return d.y; })
                              .interpolate("linear");
    var runningJobsGraphMargin = jobFunctions['runningJobsGraphMargin'];
    var lineGraph = runningJobsGraphHolder.append("path")
                              .attr("id", "path_" + data.jobName)
                              .attr("transform",
                                    "translate(" + runningJobsGraphMargin.left + "," + runningJobsGraphMargin.top + ")")
                              .attr("d", runningJobsLineFunction(scaledLineData))
                              .attr("stroke", "blue")
                              .attr("stroke-width", 4)
                              .attr("fill", "none");
  }

  function add_live_data(sensor, data) {
    return;
  }
  // Initially used for testing - can probably be removed
  function add_live_data_OLD(sensor, data) {
    //svgContainer.selectAll("#"+sensor).remove();
    var liveLineColours = ["green", "blue", "red", "yellow"];
    if ( !(sensor in liveTemps) ) {
      liveTemps[sensor] = [];
      liveTempsLineData[sensor] = [];
      //console.log("add_live_data(): added entry for " + sensor);
    }

    var dataLength = liveTemps[sensor].push(liveLinearScale(data));

    for (var i=0;i<dataLength;i++) {
      liveTempsLineData[sensor][i] = {time:i,temp:liveTemps[sensor][i]};
    }

    var sensor_keys = Object.keys(liveTemps);
    for (var i=0;i<sensor_keys.length;i++) {
      var sensor_key = sensor_keys[i];
      //svgContainer.selectAll("#"+sensor_key).remove();
      //console.log("sensor_key = " + i + " = " + sensor_key);
      var lineGraph = svgContainer.append("path")
            .attr("id", sensor_key)
            .attr("d", liveLineFunction(liveTempsLineData[sensor_key]))
            .attr("stroke", liveLineColours[i])
            .attr("stroke-width", 3)
            .attr("fill", "none");
      if ( dataLength > 500 ) {
        liveTemps[sensor_key].shift();
      }
    }

  }

  function update_relay_state(data) {
    var x = 0;

/* Testing (works)
    for ( var i=0;i<data.length;i++ ) {
      if ( data[i] ) {
        console.log("update_relay_state(): Relay " + (i+1) + " = ON");
      } else {
        console.log("update_relay_state(): Relay " + (i+1) + " = OFF");
      }
    }
*/

  }

});


/*
ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab:
*/
