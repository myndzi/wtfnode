'use strict';

// I wasn't able to get output capture from repl to work correctly, presumably
// because of wtfnode capturing and outputting to console. Rather than refactor
// it to work "nicely" in a VM context, I'm relying on require caching: the VM
// appears to receive the same instance that we require here, allowing us to
// hook the output outside of the VM context.

var wtf = require('../index');
var strs = [];
wtf.setLogger('info', function (str) {
    strs.push(str);
});

var repl = require('repl');
var PassThrough = require('stream').PassThrough;
var assert = require('assert');
var path = require('path');

var pt = new PassThrough();

var r = repl.start({
    input: pt,
    output: process.stdout,
    terminal: true,
    useGlobal: false,
});

r.on('exit', function () {
    assert(
        strs.some(function (str) { return /@ repl/i.test(str) }),
        'expected output to match `/@ repl/i`'
    );
});

var wtfnode = path.resolve(__dirname, '..', 'index.js');
var code = "var wtf = require('"+wtfnode+"'); setTimeout(function () {}, 0); wtf.dump();";
pt.write(code+'\n');
pt.write('\u0004');