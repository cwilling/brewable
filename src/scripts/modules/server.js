//var WebSocketServer = require('websocket').server;
//var createServer = require("http").createServer;
import http from "http";
import url from "url";
import { server as WebSocketServer } from "websocket";

function start(route, handle, clients, msgQueue, opts) {
  var options = opts || {};
  var port = options.port || 8888;

  function onRequest(request, response) {
    var query = '';
    var pathname = url.parse(request.url).pathname;
    //console.log("Request for " + pathname + " received from " + request.connection.remoteAddress + " at: " + (new Date()));

    if (request.method == 'POST') {
      //console.log("Process POST!");
      request.addListener("data", function(postDataChunk) {
        query += postDataChunk;
        //console.log("Received POST data chunk '"+ postDataChunk + "'.");
        if (query.length > 1e6) {
          query = '';
          response.writeHead(413, {'Content-Type': 'text/plain'}).end();
          request.connection.destroy();
        }
      });
      request.addListener("end", function() {
        //console.log("Request query (POST) = " + query);
        route(handle, pathname, query, response);
      });
    } else {
      // Hopefully a GET
      query = url.parse(request.url).query;
      //console.log("Request query = " + query);
      route(handle, pathname, query, response);
    }

  }

  var server = http.createServer(onRequest).listen(port);
  //var server = createServer(onRequest).listen(port);
  console.log("Server has started at port " + port);

  server.wsServer = new WebSocketServer({
    httpServer: server,
    autoAcceptConnections: false,
    clients: clients,
    msgQueue: msgQueue
  });

  //function originIsAllowed(origin) {
  //  // put logic here to detect whether the specified origin is allowed.
  //  console.log("XXXXX " + origin);
  //  return true;
  //}

  server.wsServer.on('request', function(request) {
    var connection = request.accept(null, request.origin);
    clients.push(connection);

    console.log("wsServer on " + server.wsServer.connections.length + " connections");
    //console.log("ws request from " + request.connection.remoteAddress);

    connection.on('message', function(message) {
      console.log("Rcvd message: " + JSON.stringify(message));
      msgQueue.enqueue(message);
    });

    connection.on('close', function(reason, description) {
      for (var i=clients.length;i--;) {
        if (clients[i] === connection) {
          console.log("Removing connection " + connection.remoteAddress + ":" + description);
          clients.splice(i, 1);
        }
      }
    });

  });
}

//exports.start = start;
export default start;

/* ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab: */
