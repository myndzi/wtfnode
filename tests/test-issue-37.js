var wtf = require('../index');

var EventEmitter = require('events').EventEmitter;

var ee = new EventEmitter();
ee.listeners = [];
ee.on('foo', function () { });
