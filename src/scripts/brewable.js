#!/usr/bin/env node


var events = require('events');

var server = require("./modules/server");
var router = require("./modules/router");
var requestHandlers = require("./modules/requestHandlers");
var Queue = require("./modules/queue.js");
var gpioworker = require("./modules/gpioworker");

global.eventEmitter = new events.EventEmitter();
var clients = [];

// This function passed to output_queue for periodic processing
var updateClients = function () {
  //console.log("updateClients() for " + clients.length + " clients");
  while (output_queue.size() > 0) {
    message = output_queue.dequeue();
    clients.forEach( function(client) {
      //console.log("Sending msg: " + message);
      client.sendUTF(message);
    });
  }
}

// This function passed to input_queue
var messageWaiting = function () {
  if (input_queue.size() > 0 ) {
    eventEmitter.emit('msg_waiting');
  }
}

var input_queue = new Queue({'name':'input_queue','interval':200, 'action':messageWaiting});
//var output_queue = new Queue({'name':'output_queue'});
//var output_queue = new Queue({'action':function(){console.log("SOME action!");}});
var output_queue = new Queue({'name':'output_queue', 'action':updateClients});



eventEmitter.on('temps_ready', function () { worker.liveUpdate(); });
var worker = new gpioworker(input_queue, output_queue);

var handle = {};
handle["/"] = requestHandlers.index;
handle["/index"] = requestHandlers.index;
handle["/index.htm"] = requestHandlers.index;
handle["/index.html"] = requestHandlers.index;
handle["/favicon.ico"] = requestHandlers.favicon;
handle["/status.js"] = requestHandlers.status;
//handle["/d3.v3.min.js"] = requestHandlers.d3;
handle["/brewable.css"] = requestHandlers.css;
handle["/ws"] = requestHandlers.ws;


input_queue.start();
output_queue.start();
server.start(router.route, handle, clients, input_queue);

setInterval( function() {
  //console.log("\nDoing device updates");
  worker.updateDevices();
}, 2000);

/* millseconds i.e.
  10000 = 10s
  30000 = 30s
*/
setInterval( function() {
  worker.processRunningJobs();
}, (30000 + Math.floor((Math.random() * 1000) + 1)));


/* ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab: */
