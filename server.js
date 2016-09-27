var WebSocketServer = require('websocket').server;
var http = require("http");
var url = require("url");

function start(route, handle, clients, msgQueue) {
  function onRequest(request, response) {
    var pathname = url.parse(request.url).pathname;
    console.log("Request for " + pathname + " received from " + request.connection.remoteAddress);

    route(handle, pathname, response);
  }

  var server = http.createServer(onRequest).listen(8888);
  console.log("Server has started.");

  server.wsServer = new WebSocketServer({
    httpServer: server,
    autoAcceptConnections: false,
    clients: clients,
    msgQueue: msgQueue
  });

  function originIsAllowed(origin) {
    // put logic here to detect whether the specified origin is allowed.
    console.log("XXXXX " + origin);
    return true;
  }

  server.wsServer.on('request', function(request) {
    var connection = request.accept(null, request.origin);
    clients.push(connection);

    console.log("wsServer on " + server.wsServer.connections.length + " connections");
    //console.log("ws request from " + request.connection.remoteAddress);

    connection.on('message', function(message) {
      console.log("Rcvd message: " + message);
      msgQueue.enqueue(message);
    });

    connection.on('close', function(reason, description) {
      for (var i=clients.length;i--;) {
        if (clients[i] === connection) {
          console.log("Removing connection " + connection.remoteAddress);
          clients.splice(i, 1);
        }
      }
    });

  });
}

exports.start = start;

/* ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab: */
