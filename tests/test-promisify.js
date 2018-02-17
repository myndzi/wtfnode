'use strict';

var wtf = require('../index'),
    util = require('util');

if (util.promisify) {
    var sleep = util.promisify(setTimeout);

    sleep(10).then(function () {
        console.log('ok');
    }).catch(function (e) {
        console.log(e);
    });
}