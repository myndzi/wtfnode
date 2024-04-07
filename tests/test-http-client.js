"use strict";
var wtf = require("../index");
var http = require("http");

var logs = [];

wtf.setLogger("info", function (log) {
  logs.push(log);
});

var server = http.createServer(function (req, res) {
  res.writeHead(200);
  res.end();
});

server.listen(0, function () {
  var port = server.address().port;
  http.get(
    { method: "POST", host: "localhost", port: port, path: "/the-path" },
    function () {
      wtf.dump();
      if (
        logs.some(function (l) {
          return l === "    - POST http://localhost:" + port + "/the-path";
        })
      ) {
        process.exit(0);
      } else {
        throw new Error("Expected detailed http log");
      }
    }
  );
});
