var exec = require("child_process").exec;
var fs = require("fs");
const path = require('path');

function start(response) {
  console.log("Request handler 'start' was called.");

  exec("find /", {timeout:10000, macBuffer: 20000*1024 },
    function (error, stdout, stderr) {
      response.writeHead(200, {"Content-Type": "text/plain"});
      response.write(stdout);
      response.end();
    });
}

function index(response) {
  console.log("Request handler 'index' was called.");
  fs.readFile(path.join(__dirname, "/index.html"), function (err, data) {
    if(err){
      response.writeHead(404);
      response.write("Not Found!");
    } else {
      response.writeHead(200, {"Content-Type": "text/html"});
      response.write(data);
    }
    response.end();
  });
}

function status(response) {
  console.log("Request handler 'status' was called.");
  fs.readFile(path.join(__dirname, "/status.js"), function (err, data) {
    if(err){
      response.writeHead(404);
      response.write("Not Found!");
      console.log("status.js not found");
    } else {
      response.writeHead(200, {"Content-Type": "text/plain"});
      response.write(data);
    }
    response.end();
  });
}

function sprintf(response) {
  console.log("Request handler 'sprintf' was called.");
  fs.readFile(path.join(__dirname, "/sprintf.js"), function (err, data) {
    if(err){
      response.writeHead(404);
      response.write("Not Found!");
      console.log("sprintf.js not found");
    } else {
      response.writeHead(200, {"Content-Type": "text/plain"});
      response.write(data);
    }
    response.end();
  });
}

function d3(response) {
  console.log("Request handler 'd3' was called.");
  fs.readFile(path.join(__dirname, "/d3.v3.min.js"), function (err, data) {
    if(err){
      response.writeHead(404);
      response.write("Not Found!");
      console.log("d3.js not found");
    } else {
      response.writeHead(200, {"Content-Type": "text/plain"});
      response.write(data);
    }
    response.end();
  });
}

function css(response) {
  console.log("Request handler 'css' was called.");
  fs.readFile(path.join(__dirname, "/brewable.css"), function (err, data) {
    if(err){
      response.writeHead(404);
      response.write("Not Found!");
      console.log("brewable.js not found");
    } else {
      response.writeHead(200, {"Content-Type": "text/css"});
      response.write(data);
    }
    response.end();
  });
}

function ws(response) {
  console.log("Request handler 'ws' was called.");
  response.writeHead(200, {"Content-Type": "text/plain"});
  response.write("Hello ws");
  response.end();
}

exports.status = status;
exports.sprintf = sprintf;
exports.d3 = d3;
exports.css = css;
exports.index = index;
exports.ws = ws;

/* ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab: */
