// we set the module's export to the same value that we use to indicate
// "we failed to require it", to verify that nothing breaks even when it's present
try {
    require('source-map-support');
    require.cache[require.resolve('source-map-support')] = false;
} catch (e) {

}

var wtf = require('../index');

var timer = setTimeout(function noop() { }, 1000);

wtf.dump();

clearTimeout(timer);