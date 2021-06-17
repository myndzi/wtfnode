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

    assert.strictEqual(count, 1, 'Handler should be called once, got ' + count);
    count = 0;

    // Node 16.2(?) evidences some odd behavior here. Streams don't write synchronously
    // the ... second time?
    stream.once('data', function (c) {
        count++;
    });
    stream.write('baz');

    setImmediate(function () {
        // but they do get written eventually
        assert.strictEqual(count, 1, 'Handler should be called once, got ' + count);
    });
})();

(function () {
    var stream = new PassThrough();
    var count = 0;
    stream.on('data', function testonceflowing(chunk) {
        count++;
    });
    stream.write('foo');
    stream.write('bar');

    assert.strictEqual(count, 2, 'Handler should be called twice, got ' + count);
})();
