var wtf = require('./index');

var fs = require('fs'),
    cp = require('child_process'),
    net = require('net'),
    tls = require('tls'),
    http = require('http'),
    https = require('https'),
    dgram = require('dgram');

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

  wtf.dump();
  process.exit();
}

// child processes
var proc = cp.spawn('cat');

// udp servers
var unboundUdpServer = dgram.createSocket('udp4');

var udpServer = dgram.createSocket('udp4');
udpServer.on('message', function udpMessageListener() { });
udpServer.on('listening', function () {
  // open socket
  var socket = net.connect(80, 'www.google.com', doStuff);
});

udpServer.bind();