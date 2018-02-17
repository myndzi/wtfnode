'use strict';

var wtf = require('../index');

var foo = new Function('setTimeout(function evaled() {}, 100);');
foo();
wtf.dump();