var wtf = require('../index');

var assert = require('assert');
    cp = require('child_process'),
    dgram = require('dgram'),
    EventEmitter = require('events'),
    fs = require('fs'),
    http = require('http'),
    https = require('https'),
    net = require('net'),
    readline = require('readline'),
    tls = require('tls');

function foo() { };

function doStuff() {
  // timers
  setTimeout(foo, 1000);
  setInterval(foo, 1000);
  setTimeout(function inlineNamed() { }, 1000);
  setTimeout(function () { }, 1000);

  // servers
  var httpServer = http.createServer(function httpRequestListener() { }).listen();

  var httpsServer = https.createServer({
      key: fs.readFileSync('./key.pem'),
      cert: fs.readFileSync('./key-cert.pem')
  }, function httpsRequestListener() { }).listen();

  var tcpServer = net.createServer(function netConnectionListener() { })
      .listen(function netListenListener() { });

  var tlsServer = tls.createServer({
      key: fs.readFileSync('./key.pem'),
      cert: fs.readFileSync('./key-cert.pem')
  }, function tlsConnectionListener() { })
      .listen(function tlsListenListener() { });

  http.createServer();
  net.createServer();

  // ipc socket
  net.createServer(function ipcListener() {
  }).listen('/tmp/wtfnode-test');

  readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  wtf.dump();

  try {
    fs.unlinkSync('/tmp/wtfnode-test');
  } catch {
  }

  console.error('Argv[2..]:', process.argv.slice(2));
  process.exit();
}

// child processes
var proc = cp.spawn('cat');

// udp servers
var unboundUdpServer = dgram.createSocket('udp4');

var udpServer = dgram.createSocket('udp4');
udpServer.on('message', function udpMessageListener() { });
udpServer.once('message', function onceHandler() { });
udpServer.on('listening', function () {
  // open socket
  var socket = net.connect(80, 'www.google.com', doStuff);
});

udpServer.bind();
