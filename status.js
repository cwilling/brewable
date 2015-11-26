
// Show/Hide stuff
function toggle_visibility(id) {
  var e = document.getElementById(id);
  if(e.style.display == 'none')
    e.style.display = 'block';
  else
    e.style.display = 'none';
}
function switch_visibility(id1, id2, id3) {
  var e1 = document.getElementById(id1);
  var e2 = document.getElementById(id2);
  var e3 = document.getElementById(id3);
  if(e1.style.display == 'none') {
    e1.style.display = 'block';
    e2.style.display = 'none';
    e3.style.display = 'none';
  }
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

/*
var svgContainer = d3.select("body")
    .append("svg")
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
*/


});


/*
ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab:
*/
