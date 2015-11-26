$(document).ready(function(){


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

//svgContainer.append("g")			
//        .attr("class", "grid")
//        .attr("transform", "translate(0," + height + ")")
//        .call(make_x_axis()
//            .tickSize(-height, 0, 0)
//            .tickFormat("")
//        )
//svgContainer.append("g")			
//        .attr("class", "grid")
//        .call(make_y_axis()
//            .tickSize(-width, 0, 0)
//            .tickFormat("")
//        )


var lineGraph = svgContainer.append("path");

var live_temps = [];
var live_temps_scaled = [];

var live_temps_lineData = [];
var live_temps_lineData_scaled = [];

var lineFunction = d3.svg.line()
	.x(function(d) {return d.time})
	.y(function(d) {return d.temp})
	.interpolate("linear");

var received = $('#received');
//var received = d3.select('#received');
console.log("XXX " + received);

//var socket = new WebSocket("ws://localhost:8080/ws");
var socket = new WebSocket("ws://" + location.host + "/wsStatus");
 
socket.onopen = function(){  
  console.log("connected"); 
}; 

socket.onmessage = function (message) {
  var jmsg;

  try {
    jmsg = JSON.parse(message.data);
    if ( jmsg.type === 'info' ) {
      d3.select('#received').append('li').text('info: ' + jmsg.data);
    } else if (jmsg.type === 'live_update' ) {
      add_live_data(jmsg.data);
    }
  }
  catch (err) {
    console.log('Non-json message: ' + message);
  }
  finally {
    received.scrollTop(received.prop('scrollHeight'));
  }

//d3.select('#received').append('li').text("> " + message.data);
received.scrollTop(received.prop('scrollHeight'));
//  received.append(message.data);
//  received.append($('<br/>'));

};

socket.onclose = function(){
  console.log("disconnected"); 
};

var sendMessage = function(message) {
  console.log("sending:" + message.data);
  //socket.send(message.data);
  socket.send(message);
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
  var argv = [data,93,"Fred"]
  var msgobj = {type:'CMD',command:"toggle_relay",argc:argv.length,args:argv};
  var jmsg = JSON.stringify(msgobj)
  sendMessage(jmsg);
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

// ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab:
