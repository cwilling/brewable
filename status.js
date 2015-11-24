
// Show/Hide stuff
function toggle_visibility(id) {
   var e = document.getElementById(id);
   if(e.style.display == 'none')
      e.style.display = 'block';
   else
      e.style.display = 'none';
}


$(document).ready( function(){


var profileLink = document.querySelector('#open_profiles');
var gmyWin = null;
var received = $('#received');

//var socket = new WebSocket("ws://localhost:8080/ws");
var socket = new WebSocket("ws://" + location.host + "/wsStatus");
 
socket.onopen = function(){  
  console.log("sss connected"); 
};

socket.onmessage = function (message) {

  received.append(message.data);
  received.append($('<br/>'));
  received.scrollTop(received.prop('scrollHeight'));

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



  // Open Profiles page
  profileLink.onclick = function() {
    gmyWin = myOpenWindow("/profile", "Profiles", "height=0", gmyWin );
    console.log('Profiles button clicked');
  }

//myOpenWindow from http://www.joemarini.com/tutorials/tutorialpages/window1.php
function myOpenWindow(winURL, winName, winFeatures, winObj)
{
  var theWin; // this will hold our opened window
console.log("XXX %s", winName);

  // first check to see if the window already exists
  if (winObj != null)
  {
    // the window has already been created, but did the user close it?
    // if so, then reopen it. Otherwise make it the active window.
    if (!winObj.closed) {
      winObj.focus();
      return winObj;
    }
    // otherwise fall through to the code below to re-open the window
  }

  // if we get here, then the window hasn't been created yet, or it
  // was closed by the user.
  theWin = window.open(winURL, winName, winFeatures);
  return theWin;
}


});
