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


$(document).ready( function(){

  var profilesLoadedEvent = new Event('profilesLoadedEvent');

  var received = $('#received');

/***********************  Jobs Configuration page  ***************************/
  // Refresh job list button
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





/********************** Profiles Configuration page ***************************/
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


  //var socket = new WebSocket("ws://localhost:8080/ws");
  var socket = new WebSocket("ws://" + location.host + "/wsStatus");
 
  socket.onopen = function(){  
    console.log("sss connected"); 

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
        add_live_data(jmsg.data);
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


var margin = {top: 100, right: 20, bottom: 30, left: 80},
    width = 600 - margin.left - margin.right,
    height = 400 - margin.top - margin.bottom;

var minDataPoint = 20;
var maxDataPoint = 80;
var linearScale = d3.scale.linear()
	.domain([minDataPoint, maxDataPoint])
	.range([height, 0]);
var yAxis = d3.svg.axis()
	.scale(linearScale)
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
    .attr("class", "yaxistext")
    .append("text")
	.attr("transform", "rotate(-90)")
	.attr("x", 0 - margin.top)
	.attr("y", 0 - (margin.left/2))
	.attr("dy", "lem")
	.style("text-anchor", "middle")
	.text("Temperature (C)");


var lineGraph = svgContainer.append("path");

var live_temps = [];
var live_temps_scaled = [];

var live_temps_lineData = [];
var live_temps_lineData_scaled = [];

var lineFunction = d3.svg.line()
	.x(function(d) {return d.time})
	.y(function(d) {return d.temp})
	.interpolate("linear");


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
    var idName, target, duration;
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

  // Generate a table of stored jobs
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
      //var description = "________________".slice(name.length) + name;
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

  function add_live_data(data) {
    //d3.select('#received').append('li').text("live_data: " + data);
    var l = live_temps.push(linearScale(data));

    for (i=0;i<l;i++) {
      live_temps_lineData[i] = {time:i,temp:live_temps[i]};
    }

    svgContainer.selectAll('#live').remove();
    lineGraph = svgContainer.append("path")
          .attr("id", "live")
          .attr("d", lineFunction(live_temps_lineData))
          .attr("stroke", "blue")
          .attr("stroke-width", 2)
          .attr("fill", "none");
    if ( l > 500 ) {
      live_temps.shift();
    }
  }


});


/*
ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab:
*/
