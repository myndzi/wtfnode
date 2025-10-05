'use strict';

var wtf = require('../index');
var strs = [];
wtf.setLogger('info', function (str) {
    strs.push(str);
});

var vm = require('vm');
var assert = require('assert');

var context = vm.createContext(global);
context.require = require;

var code = "var wtf = require('../index.js'); setTimeout(function () {}, 0); wtf.dump();";
vm.runInContext(code, context);

assert(
    strs.some(function (str) { return /@ evalmachine/.test(str) }),
    'expected output to include `@ evalmachine`'
);