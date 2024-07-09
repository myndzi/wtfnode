"use strict";
var wtf = require("../index");
var http = require("http");
var https = require("https");
var fs = require("fs");
var path = require("path");

if (/^v0\.10\./.test(process.version)) {
  // by the source, this doesn't seem to be entirely true, but whatever instance we receive
  // from process._getActiveHandles does not contain that property
  console.log(
    "Skipped: version " +
      process.version +
      " does not expose socket._httpMessage"
  );
  process.exit(0);
}

var logs = [];
wtf.setLogger("info", function (log) {
  logs.push(log);
});

function testHttp(cb) {
  var httpServer = http.createServer(function (req, res) {
    res.writeHead(200);
    res.end();
  });

  httpServer.listen(0, function () {
    var port = httpServer.address().port;
    http
      .request(
        { method: "POST", host: "localhost", port: port, path: "/the-path" },
        function () {
          wtf.dump();
          if (
            logs.some(function (l) {
              return l === "    - POST http://localhost:" + port + "/the-path";
            })
          ) {
            httpServer.close();
            cb();
          } else {
            throw new Error("Expected detailed http log");
          }
        }
      )
      .end();
  });
}

var cert = fs.readFileSync(path.join(__dirname, "cert.pem"));
function testHttps(cb) {
  var httpsServer = https.createServer(
    {
      key: fs.readFileSync(path.join(__dirname, "key.pem")),
      cert: cert,
    },
    function httpsRequestListener(req, res) {
      res.writeHead(200);
      res.end();
    }
  );

  httpsServer.listen(0, function () {
    var port = httpsServer.address().port;
    https
      .request(
        {
          method: "POST",
          host: "localhost",
          port: port,
          path: "/the-path",
          ca: [cert],
        },
        function () {
          wtf.dump();
          if (
            logs.some(function (l) {
              return l === "    - POST https://localhost:" + port + "/the-path";
            })
          ) {
            httpsServer.close();
            cb();
          } else {
            throw new Error("Expected detailed http log");
          }
        }
      )
      .end();
  });
}

function testDefaultPortHttp(cb) {
  http.get("http://google.com/", function () {
    wtf.dump();
    if (
      logs.some(function (l) {
        return l === "    - GET http://google.com/";
      })
    ) {
      cb();
    } else {
      throw new Error("Expected detailed http log");
    }
  });
}

function testDefaultPortHttps(cb) {
  https.get("https://google.com/", function () {
    wtf.dump();
    if (
      logs.some(function (l) {
        return l === "    - GET https://google.com/";
      })
    ) {
      cb();
    } else {
      throw new Error("Expected detailed http log");
    }
  });
}

[testDefaultPortHttp, testDefaultPortHttps, testHttp, testHttps].reduce(
  function (acc, cur) {
    return function () {
      process.stdout.write(cur.name + ": ");
      cur(acc);
      console.log("ok");
    };
  },
  function () {
    console.log("done");
    process.exit();
  }
)();
