'use strict';

var wtf = require('../index');

var EventEmitter = require('events').EventEmitter,
    assert = require('assert');

function testEventEmitter() {
  var emitter = new EventEmitter(), em;
  var numTimesEventHandlerWasCalled = 0;
  var myEventHandler = function() {
    numTimesEventHandlerWasCalled += 1;
  };
  em = emitter.addListener('myEvent', myEventHandler);
  assert.strictEqual(emitter, em, 'emitter.addListener should return `this`');
  emitter.emit('myEvent');
  assert.strictEqual(numTimesEventHandlerWasCalled, 1, 'Handler should be called once');
  // Check that removeListener still works:
  emitter.removeListener('myEvent', myEventHandler);
  emitter.emit('myEvent');
  assert.strictEqual(numTimesEventHandlerWasCalled, 1, 'Handler should not be called after removing');

  // Check that .once works
  numTimesEventHandlerWasCalled = 0;
  em = emitter.once('myEvent', myEventHandler);
  assert.strictEqual(emitter, em, 'emitter.once should return `this`');
  emitter.emit('myEvent');

  assert.strictEqual(numTimesEventHandlerWasCalled, 1, 'Handler should be called once');
  assert.strictEqual(emitter.listeners('myEvent').length, 0, 'Listener should not exist anymore');

  emitter.emit('myEvent');
  assert.strictEqual(numTimesEventHandlerWasCalled, 1, 'Handler should not be called after removing');

  // Check that removeListener works on a .once handler before it is called
  numTimesEventHandlerWasCalled = 0;
  emitter.once('myEvent', myEventHandler);
  emitter.removeListener('myEvent', myEventHandler);
  emitter.emit('myEvent');
  assert.strictEqual(numTimesEventHandlerWasCalled, 0, 'Handler should not be called');
}

testEventEmitter();

function testInterval() {
  var timer;

  timer = setInterval(function () {
    throw new Error('Timer callback should not run');
  }, 0);
  clearInterval(timer);

  timer = setTimeout(function () {
    throw new Error('Timer callback should not run');
  }, 0);
  clearTimeout(timer);

  if (typeof setImmediate === 'undefined') { return; }
  timer = setImmediate(function () {
    throw new Error('Timer callback should not run');
  }, 0);
  clearImmediate(timer);
}

testInterval();
