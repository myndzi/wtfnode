'use strict';

var wtf = require('../index');

var PassThrough = require('stream').PassThrough,
    assert = require('assert');

(function () {
    var stream = new PassThrough();
    var count = 0;
    stream.once('data', function () {
        count++;
    });
    stream.write('foo');
    stream.write('bar');

    assert.strictEqual(1, count, 'Handler should be called once, got '+count);
})();

(function () {
    var stream = new PassThrough();
    var count = 0;
    stream.on('data', function testonceflowing(chunk) {
        count++;
    });
    stream.write('foo');
    stream.write('bar');

    assert.strictEqual(2, count, 'Handler should be called twice, got '+count);
})();
