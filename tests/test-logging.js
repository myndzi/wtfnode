'use strict';

// verify that logging is set correctly

var consoleCount = 0;

var _unwrap_log = wrap(console, 'log'),
    _unwrap_warn = wrap(console, 'warn'),
    _unwrap_error = wrap(console, 'error')

var wtf = require('../index');
var assert = require('assert');
var util = require('util');

function wrap(obj, fName) {
    var orig = obj[fName];
    function wrapped() {
        var i = arguments.length, args = new Array(i);
        while (i--) { args[i] = arguments[i]; }
        consoleCount++;
        //process.stderr.write("D: " + util.format.apply(util, args) + "\n");
        return orig.apply(this, args);
    }
    function unwrap() {
        obj[fName] = orig;
    }
    obj[fName] = wrapped;
    return unwrap;
}

function test(cb) {
    consoleCount = 0;
    var getCount = cb();
    wtf.dump();
    wtf.resetLoggers();
    return {custom: (getCount && getCount()) || 0, console: consoleCount};
}

function counter() {
    var total = 0;
    function inc() { total++; }
    function count() { return total; }
    return { inc: inc, count: count };
}

var counts = test(function () {
    return null;
});
assert(counts.console > 0, 'console count should be > 0 with no setup');

var counts = test(function () {
    var c = counter();
    wtf.setLogger('info', c.inc)
    wtf.setLogger('warn', c.inc)
    wtf.setLogger('error', c.inc)
    return c.count;
});
assert(counts.console === 0, 'console count should be 0 with custom loggers');
assert(counts.custom > 0, 'custom count should be > 0 with custom loggers');