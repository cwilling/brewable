// Generate a dummy set of profiles to initially populate the profiles table.
// When the websocket to server is established, we can obtain real values.
var profilesTableColumns = 10;
var profilesTableRows = 4;
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

  var received = $('#received');

  //createProfileTableFunction(document.getElementById("profilesTable"));

  // Save button
  var saveProfilesButton = document.getElementById("saveProfiles");
  saveProfilesButton.onclick = function() {
    saveProfiles();
  }

  // Temperature scale
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
var socket = new WebSocket("ws://" + location.host + "/wsProfiles");
 
socket.onopen = function(){  
  console.log("ppp connected"); 

  // Request profiles data
  var argv = [];
  msgobj = {type:'load_profiles', data:argv};
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
    } else if (jmsg.type === 'loaded_profiles' ) {
      console.log('Data length = ' + jmsg.data.length);
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
    } else {
      console.log('Unknown json messsage type: ' + jmsg.type);
    }
  }
  catch (err ) {
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

    // GUI Stuff


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


  // Profiles Table
  function OLDcreateProfileTableFunction(table) {

    for (i=0;i<profilesTableRows;i++) {
      var row = table.insertRow(i);
      var th = row.insertCell(0).appendChild(document.createElement('TH'));
      th.appendChild(document.createTextNode("Profile " + i));
      for (j=0;j<profilesTableColumns;j++) {
         row.insertCell(j+1).appendChild(populateProfilesTableCell(i,j));
      }
    }
  }
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

  function updateProfilesTableData(newData) {
      var i, j, target;

      console.log("New data: " + newData.length + " " + newData);
      for (i=0;i<newData.length;i++) {
        console.log("Profile data " + i + " has " + newData[i].length + " elements");
        for (j=0;j<newData[i].length;j++) {
          console.log("data " + j + ": " + newData[i][j].target + " " + newData[i][j].duration);
          document.getElementById("sp" + i + "_" + j).value = newData[i][j].target;
          document.getElementById("dh" + i + "_" + j).value = newData[i][j].duration;
        }
      }
  }

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


});

// ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab:

