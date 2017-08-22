
//var events = require('events');
//import events from 'events';

//var server = require("./modules/server");
//var router = require("./modules/router");
//var requestHandlers = require("./modules/requestHandlers");
//var Queue = require("./modules/queue.js");
//var gpioworker = require("./modules/gpioworker");

import start from "./modules/server";
//import router from "./modules/router";
import route from "./modules/router";
import { index as rhindex } from "./modules/requestHandlers";
import { favicon as rhfavicon } from "./modules/requestHandlers";
import { status as rhstatus } from "./modules/requestHandlers";
import { ws as rhws } from "./modules/requestHandlers";
import Queue from "./modules/queue";
import { gpioWorker as gpioworker } from "./modules/gpioworker";


// Command line options
var options = {};
//process.argv.forEach((val, index) => {
process.argv.forEach((val) => {
  //console.log(`${index}: ${val}`);
  if (val.indexOf('=') > -1) {
    var opt = val.split('=');
    options[opt[0]] = opt[1];
  }
  if (val == "help") {
    showUsage();
    process.exit();
  }
});

if ("port" in options) {
  options.port = parseInt(options.port);
} else {
  options.port = 8888;
}
//console.log("options: " + JSON.stringify(options));

if ("interval" in options) {
  options.jobCheckInterval = parseInt(options.interval);
} else {
  options.jobCheckInterval = 30; // seconds
}
//console.log("options: " + JSON.stringify(options));

function showUsage() {
  console.log("\nUsage:");
  console.log("    brewable [options]");
  console.log("\nOptions:");
  console.log("    port=<n>");
  console.log("    where <n> is a valid port number (default is 8888)");
  console.log("\n    interval=<n>");
  console.log("    where <n> is the interval, in seconds, between processings of current jobs");
  console.log("    (default is 60)");
  console.log("\nExample:");
  console.log("    brewable port=8686 interval=30\n");
}

//global.eventEmitter = new events.EventEmitter();
import { eventEmitter } from "./modules/gpioworker";
var clients = [];

// This function passed to output_queue for periodic processing
var updateClients = function () {
  //console.log("updateClients() for " + clients.length + " clients");
  var message;
  while (output_queue.size() > 0) {
    message = output_queue.dequeue();
    clients.forEach( function(client) {
      //console.log("Sending msg: " + message);
      client.sendUTF(message);
    });
  }
};

// This function passed to input_queue
var messageWaiting = function () {
  if (input_queue.size() > 0 ) {
    eventEmitter.emit('msg_waiting');
  }
};

var input_queue = new Queue({'name':'input_queue','interval':200, 'action':messageWaiting});
//var output_queue = new Queue({'name':'output_queue'});
//var output_queue = new Queue({'action':function(){console.log("SOME action!");}});
var output_queue = new Queue({'name':'output_queue', 'action':updateClients});



eventEmitter.on('temps_ready', function () { worker.liveUpdate(); });
var worker = new gpioworker(input_queue, output_queue);

var handle = {};
handle["/"] = rhindex;
handle["/index"] = rhindex;
handle["/index.htm"] = rhindex;
handle["/index.html"] = rhindex;
handle["/favicon.ico"] = rhfavicon;
handle["/status.js"] = rhstatus;
handle["/ws"] = rhws;


input_queue.start();
output_queue.start();
start(route, handle, clients, input_queue, options);

setInterval( function() {
  //console.log("\nDoing device updates");
  worker.updateDevices();
}, 2000);

/* millseconds i.e.
  10000 = 10s
  30000 = 30s
*/
setInterval( function() {
  console.log("jobCheckInterval = " + new Date());
  worker.processRunningJobs();
//}, (30000 + Math.floor((Math.random() * 1000) + 1)));
}, ((1000 * options.jobCheckInterval) + Math.floor((Math.random() * 1000) + 1)));

process.on('SIGHUP', () => {
  console.log(`\nExit ...`);
  worker.closeRelays();
  process.exit();
});
process.on('SIGINT', () => {
  console.log(`\nExit ...`);
  worker.closeRelays();
  process.exit();
});
process.on('SIGTERM', () => {
  console.log(`\nExit ...`);
  worker.closeRelays();
  process.exit();
});



/* ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab: */
