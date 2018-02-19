'use strict';

// exercise some code that creates stack traces with null file/line

var wtf = require('../index');

if (typeof Promise === 'undefined') { process.exit(); }

new Promise(function (resolve, reject) {
    setTimeout(function () {}, 0);
});