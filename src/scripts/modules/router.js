function route(handle, pathname, query, response) {
  //console.log("About to route a request for " + pathname + " with query: " + query);
  if (typeof handle[pathname] === 'function') {
    handle[pathname](response, query);
  } else {
    console.log("No request handler found for " + pathname);
    response.writeHead(404, {"Content-Type": "text/plain"});
    response.write("404 Not found");
    response.end();
  }
}

export default route;


/* ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab: */
