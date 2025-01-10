var wtf = require("../index");

var assert = require("assert");
(cp = require("child_process")),
  (dgram = require("dgram")),
  (EventEmitter = require("events")),
  (fs = require("fs")),
  (http = require("http")),
  (https = require("https")),
  (net = require("net")),
  (readline = require("readline")),
  (tls = require("tls")),
  (path = require("path"));

function foo() {}

function doStuff() {
  // timers
  setTimeout(foo, 550);
  setInterval(foo, 2500);
  setTimeout(function inlineNamed() {}, 90*1000);
  setTimeout(function () {}, 2.5*3600*1000);

  // servers
  var httpServer = http
    .createServer(function httpRequestListener() {})
    .listen();

  var httpsServer = https
    .createServer(
      {
        key: fs.readFileSync(path.join(__dirname, "key.pem")),
        cert: fs.readFileSync(path.join(__dirname, "cert.pem")),
      },
      function httpsRequestListener() {}
    )
    .listen();

  var tcpServer = net
    .createServer(function netConnectionListener() {})
    .listen(function netListenListener() {});

  var tlsServer = tls
    .createServer(
      {
        key: fs.readFileSync(path.join(__dirname, "key.pem")),
        cert: fs.readFileSync(path.join(__dirname, "cert.pem")),
      },
      function tlsConnectionListener() {}
    )
    .listen(function tlsListenListener() {});

  http.createServer();
  net.createServer();

  // ipc socket
  net.createServer(function ipcListener() {}).listen("/tmp/wtfnode-test");

  readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  wtf.dump({
    fullStacks: true,
  });
  wtf.dump();

  try {
    fs.unlinkSync("/tmp/wtfnode-test");
  } catch (e) {}

  console.error("Argv[2..]:", process.argv.slice(2));
  process.exit();
}

// child processes
var proc = cp.spawn("cat");

// udp servers
var unboundUdpServer = dgram.createSocket("udp4");

var udpServer = dgram.createSocket("udp4");
udpServer.on("message", function udpMessageListener() {});
udpServer.once("message", function onceHandler() {});
udpServer.on("listening", function () {
  // open socket
  var socket = net.connect(80, "www.google.com", doStuff);
});

udpServer.bind();
