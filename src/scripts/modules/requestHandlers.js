var fs = require("fs");
var path = require('path');

function index(response) {
  console.log("Request handler 'index' was called.");
  var indexData = " <!doctype HTML> <html> <head> <meta name=\"viewport\" content=\"width=device-width,user-scalable=no\" /> <meta charset=\"UTF-8\"> </head> <body class=\"status\"> <script type=\"text/javascript\" src=\"status.js\"></script> </body> </html>";
  console.log("DATA: " + indexData);
  response.writeHead(200, {"Content-Type": "text/html"});
  response.write(indexData);
  response.end();
  /*
  // index.html in same directory alongside server bundle
  console.log("index.html at " + path.join(__dirname, "./index.html"));
  fs.readFile(path.join(__dirname, "index.html"), function (err, data) {
    if(err){
      response.writeHead(404);
      response.write("Not Found!");
    } else {
      response.writeHead(200, {"Content-Type": "text/html"});
      response.write(data);
    }
    response.end();
  });
  */
}

function favicon(response) {
  console.log("Request handler 'favicon' was called.");
  fs.readFile(path.join(__dirname, "../../../favicon.ico"), function (err, data) {
    if(err){
      response.writeHead(404);
      response.write("Not Found!");
    } else {
      response.writeHead(200, {"Content-Type": "image/x-icon"});
      response.write(data);
    }
    response.end();
  });
}

function status(response) {
  console.log("Request handler 'status' was called.");
  //fs.readFile(path.join(__dirname, "../../../status.js"), function (err, data) {
  // client bundle in same directory alongside server bundle
  //console.log("currently at " + process.cwd());
  //console.log("brewableclientbundle.js at " + path.join(__dirname, "./brewableclientbundle.js"));
  //fs.readFile(path.join(__dirname, "../../../build/js/brewableclientbundle.js"), function (err, data) {
  fs.readFile(path.join(__dirname, "brewableclientbundle.js"), function (err, data) {
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

function css(response) {
  console.log("Request handler 'css' was called.");
  fs.readFile(path.join(__dirname, "../../../styles/brewable.css"), function (err, data) {
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

export { status, css, index, favicon, ws };

/* ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab: */
