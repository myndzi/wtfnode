'use strict';

var wtf = require('../index');

var PassThrough = require('stream').PassThrough,
    assert = require('assert');

var stream = new PassThrough();

(function () {
    var count = 0;
    stream.once('data', function () {
        count++;
    });
    stream.write('foo');
    stream.write('bar');

    assert.equal(1, count, 'Handler should be called once');
})();

(function () {
    var count = 0;
    stream.on('data', function () {
        count++;
    });
    stream.write('foo');
    stream.write('bar');

    assert.equal(2, count, 'Handler should be called twice');
})();
