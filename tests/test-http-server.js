"use strict";
var wtf = require("../index");
var http = require("http");

var logs = [];

wtf.setLogger("info", function (log) {
  logs.push(log);
});

var server = http.createServer(function (req) {
  wtf.dump();
  const lines = logs.join("\t");
  if (/Servers:.*?(HTTP).*?Listeners:.*?request:.*http-server.js/.test(lines)) {
    process.exit(0);
  } else {
    throw new Error("Expected detailed http log");
  }
});

server.listen(0, function () {
  var port = server.address().port;
  http.get({
    method: "POST",
    host: "localhost",
    port: port,
    path: "/the-path",
  });
});
