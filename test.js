'use strict';

var wtf = require('./index');

var EventEmitter = require('events').EventEmitter,
    assert = require('assert');

function testEventEmitter() {
  var emitter = new EventEmitter();
  var numTimesEventHandlerWasCalled = 0;
  var myEventHandler = function() {
    numTimesEventHandlerWasCalled += 1;
  };
  emitter.addListener('myEvent', myEventHandler);
  emitter.emit('myEvent');
  assert(numTimesEventHandlerWasCalled === 1);
  // Check that removeListener still works:
  emitter.removeListener('myEvent', myEventHandler);
  emitter.emit('myEvent');
  assert(numTimesEventHandlerWasCalled === 1);

  numTimesEventHandlerWasCalled = 0;
  emitter.once('myEvent', myEventHandler);
  emitter.emit('myEvent');
  assert(numTimesEventHandlerWasCalled === 1);
  // Check that removeListener still works:
  assert(emitter.listeners('myEvent').length === 1);
}

testEventEmitter();
