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
  assert.equal(1, numTimesEventHandlerWasCalled, 'Handler should be called once');
  // Check that removeListener still works:
  emitter.removeListener('myEvent', myEventHandler);
  emitter.emit('myEvent');
  assert.equal(1, numTimesEventHandlerWasCalled, 'Handler should not be called after removing');

  // Check that .once works
  numTimesEventHandlerWasCalled = 0;
  emitter.once('myEvent', myEventHandler);
  emitter.emit('myEvent');

  assert.equal(1, numTimesEventHandlerWasCalled, 'Handler should be called once');
  assert.equal(0, emitter.listeners('myEvent').length, 'Listener should not exist anymore');

  emitter.emit('myEvent');
  assert.equal(1, numTimesEventHandlerWasCalled, 'Handler should not be called after removing');

  // Check that removeListener works on a .once handler before it is called
  numTimesEventHandlerWasCalled = 0;
  emitter.once('myEvent', myEventHandler);
  emitter.removeListener('myEvent', myEventHandler);
  emitter.emit('myEvent');
  assert.equal(0, numTimesEventHandlerWasCalled, 'Handler should not be called');
}

testEventEmitter();
