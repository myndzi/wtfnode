'use strict';

// exercise some code that creates stack traces with undefined file/line

var wtf = require('../index');

var foo = new Function('setTimeout(function evaled() {}, 100);');
foo();
wtf.dump();