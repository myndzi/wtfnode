var sms = require('source-map-support');
// we set the function to something that throws
// if the api changes, we want to ensure we don't break too
sms.wrapCallSite = null;

var wtf = require('../index');

var timer = setTimeout(function noop() { }, 1000);

wtf.dump();

clearTimeout(timer);