var events = require('events');
var server = require("./server");
var router = require("./router");
var requestHandlers = require("./requestHandlers");
var Queue = require("./queue.js");
var gpioworker = require("./gpioworker");

global.eventEmitter = new events.EventEmitter();
var clients = [];

// This function passed to output_queue for periodic processing
var updateClients = function () {
  console.log("updateClients() for " + clients.length + " clients");
  if (output_queue.size() > 0) {
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

var input_queue = new Queue({'name':'input_queue','interval':400, 'action':messageWaiting});
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
handle["/status.js"] = requestHandlers.status;
handle["/sprintf.js"] = requestHandlers.sprintf;
handle["/d3.v3.min.js"] = requestHandlers.d3;
handle["/brewable.css"] = requestHandlers.css;
handle["/ws"] = requestHandlers.ws;


input_queue.start();
output_queue.start();
server.start(router.route, handle, clients, input_queue);

setInterval( function() {
  console.log("\nDoing updates");
  worker.updateDevices();
}, 2000);


/* ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab: */
