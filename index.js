#!/usr/bin/env node

'use strict';
// Don't require these until we've hooked certain builtins
var ChildProcess,
    dgramSocket,
    HttpServer,
    HttpsServer,
    path,
    Server,
    Socket,
    Timer,
    TlsServer;

function timerCallback(thing) {
    if (typeof thing._repeat === 'function') { return '_repeat'; }
    if (typeof thing._onTimeout === 'function') { return '_onTimeout'; }
    if (typeof thing._onImmediate === 'function') { return '_onImmediate'; }
}

// hook stuff
(function () {
    var _Error_prepareStackTrace = Error.prepareStackTrace;
    var hooked = function (_, stack) { return stack; };

    Object.defineProperty(global, '__stack', {
        get: function(){
            Error.prepareStackTrace = hooked
            var err = new Error();
            var stack = err.stack.map(function (item) {
                return {
                    file: item.getFileName(),
                    line: item.getLineNumber()
                };
            });
            Error.prepareStackTrace = _Error_prepareStackTrace;
            return stack;
        }
    });

    function findCallsite(stack) {
        for (var i = 0; i < stack.length; i++) {
            // Ignore frames from:
            //  - wtfnode by excluding __filename
            //  - builtins by excluding files with no path separator
            if (stack[i].file !== __filename && stack[i].file.indexOf(path.sep) !== -1) {
              return stack[i];
            }
        }
        return null;
    }

    // wraps a function with a proxy function holding the first userland call
    // site in the stack and some other information, for later display
    // this will probably screw up any code that depends on the callbacks having
    // a 'name' or 'length' property that is accurate, but there doesn't appear
    // to be a way around that :(
    var consolelog = console.log.bind(console);
    function wrapFn(fn, name, isInterval, callback) {
        if (typeof fn !== 'function') { return fn; }

        var wrapped = (
            typeof callback === 'function' ?
            function () {
                callback.call(this, wrapped);
                return fn.apply(this, arguments);
            }
            :
            function () {
                return fn.apply(this, arguments);
            }
        );

        var stack = __stack;

        // this should inherit 'name' and 'length' and any other properties that have been assigned
        Object.getOwnPropertyNames(fn).forEach(function (key) {
            try {
                Object.defineProperty(wrapped, key, Object.getOwnPropertyDescriptor(fn, key));
            } catch (e) {
                // some properties cannot be redefined, not much we can do about it
            }
        });

        // we use these later to identify the source information about an open handle
        Object.defineProperties(wrapped, {
            __fullStack: {
                enumerable: false,
                configurable: false,
                writable: false,
                value: stack
            },
            __name: {
                enumerable: false,
                configurable: false,
                writable: false,
                value: name || '(anonymous)'
            },
            __callSite: {
                enumerable: false,
                configurable: false,
                writable: false,
                value: findCallsite(stack)
            },
            __isInterval: {
                enumerable: false,
                configurable: false,
                writable: false,
                value: isInterval
            }
        });
        return wrapped;
    }

    var GLOBALS = { };
    function wrapTimer(type, isInterval) {
        GLOBALS[type] = global[type];
        global[type] = function () {
            var args = [ ], i = arguments.length;
            while (i--) { args[i] = arguments[i]; }

            var ret = GLOBALS[type].apply(this, args);
            var cbkey = timerCallback(ret);
            if (ret[cbkey]) {
                ret[cbkey] = wrapFn(ret[cbkey], args[0].name, isInterval);
            }

            return ret;
        };
    };
    wrapTimer('setTimeout', false);
    wrapTimer('setInterval', true);

    var EventEmitter = require('events').EventEmitter;
    var _EventEmitter_addListener = EventEmitter.prototype.addListener;

    EventEmitter.prototype.on =
    EventEmitter.prototype.addListener = function (/*type, listener*/) {
        var args = [ ], i = arguments.length, fn;
        while (i--) { args[i] = arguments[i]; }

        if (typeof args[1] === 'function') {
            args[1] = wrapFn(args[1], args[1].name, null);
            // This is intended to interact "cleverly" with node's EventEmitter logic.
            // EventEmitter itself sometimes wraps the event handler callbacks to implement
            // things such as once(). See https://github.com/nodejs/node/blob/v6.0.0/lib/events.js#L280
            // In order for removeListener to still work when called with the original unwrapped function
            // a .listener member is added to the callback which references the original unwrapped function
            // and the removeListener logic checks this member as well to match wrapped listeners.
            args[1].listener = arguments[1];
        }

        return _EventEmitter_addListener.apply(this, args);
    };

    EventEmitter.prototype.once = function (/*type, listener*/) {
        var args = [ ], i = arguments.length, fn;
        while (i--) { args[i] = arguments[i]; }

        var type = args[0], fn = args[1];
        if (typeof fn === 'function') {
            args[1] = wrapFn(fn, fn.name, null, function () {
                this.removeListener(type, fn);
            });
            args[1].listener = arguments[1];
        }

        return _EventEmitter_addListener.apply(this, args);
    };
})();

// path must be required before the rest of these
// as some of them invoke our hooks on load which
// requires path to be available to the above code
path = require('path');

dgramSocket = require('dgram').Socket;
HttpServer = require('http').Server;
HttpsServer = require('https').Server;
Server = require('net').Server;
Socket = require('net').Socket;
Timer = process.binding('timer_wrap').Timer;
TlsServer = require('tls').Server;

ChildProcess = (function () {
    var ChildProcess = require('child_process').ChildProcess;

    if (typeof ChildProcess !== 'function') {
        // node 0.10 doesn't expose the ChildProcess constructor, so we have to get it on the sly
        var cp = require('child_process').spawn('true', { stdio: 'ignore' });
        ChildProcess = cp.constructor;
    }

    return ChildProcess;
})();

function formatTime(t) {
    var labels = ['ms', 's', 'min', 'hr'],
        units = [1, 1000, 60, 60],
        i = 0;

    while (i < units.length && t / units[i] > 1) { t /= units[i++]; }
    return Math.floor(t) + ' ' + labels[i-1];
};

function getCallsite(fn) {
    if (!fn.__callSite) {
        console.warn('Unable to determine callsite for function "'+(fn.name.trim() || 'unknown')+'". Did you require `wtfnode` at the top of your entry point?');
        return { file: 'unknown', line: 'unknown' };
    }
    return fn.__callSite;
};

function dump() {
    console.log('[WTF Node?] open handles:');

    // sort the active handles into different types for logging
    var sockets = [ ], fds = [ ], servers = [ ], _timers = [ ], processes = [ ], other = [ ];
    process._getActiveHandles().forEach(function (h) {
        if (h instanceof Socket) {
            // stdin, stdout, etc. are now instances of socket and get listed in open handles
            // todo: a more specific/better way to identify them than the 'fd' property
            if ((h.fd != null)) { fds.push(h); }
            else { sockets.push(h); }
        }
        else if (h instanceof Server) { servers.push(h); }
        else if (h instanceof dgramSocket) { servers.push(h); }
        else if (h instanceof Timer) { _timers.push(h); }
        else if (h instanceof ChildProcess) { processes.push(h); }

        // catchall
        else { other.push(h); }
    });

    if (fds.length) {
        console.log('- File descriptors: (note: stdio always exists)');
        fds.forEach(function (s) {
            var str = '  - fd '+s.fd;
            if (s.isTTY) { str += ' (tty)'; }
            if (s._isStdio) { str += ' (stdio)'; }
            if (s.destroyed) { str += ' (destroyed)'; }
            console.log(str);

            // this event will source the origin of a readline instance, kind of indirectly
            var keypressListeners = s.listeners('keypress');
            if (keypressListeners && keypressListeners.length) {
                console.log('    - Listeners:');
                keypressListeners.forEach(function (fn) {
                    var callSite = getCallsite(fn);
                    console.log('      - %s: %s @ %s:%d', 'keypress', fn.name || '(anonymous)', callSite.file, callSite.line);
                });
            }
        });
    }

    if (processes.length) {
        console.log('- Child processes');
        processes.forEach(function (cp) {
            var fds = [ ];
            console.log('  - PID %s', cp.pid);
            if (cp.stdio && cp.stdio.length) {
                cp.stdio.forEach(function (s) {
                    if (s && s._handle && (s._handle.fd != null)) { fds.push(s._handle.fd); }
                    var idx = sockets.indexOf(s);
                    if (idx > -1) {
                        sockets.splice(idx, 1);
                    }
                });
                console.log('    - STDIO file descriptors:', fds.join(', '));
            }
        });
    }

    if (sockets.length) {
        console.log('- Sockets:');
        sockets.forEach(function (s) {
            if (s.destroyed) {
                console.log('  - (?:?) -> %s:? (destroyed)', s._host);
            } else if (s.localAddress) {
                console.log('  - %s:%s -> %s:%s', s.localAddress, s.localPort, s.remoteAddress, s.remotePort);
            } else if (s._handle && (s._handle.fd != null)) {
                console.log('  - fd %s', s._handle.fd);
            } else {
                console.log('  - unknown socket');
            }
            var connectListeners = s.listeners('connect');
            if (connectListeners && connectListeners.length) {
                console.log('    - Listeners:');
                connectListeners.forEach(function (fn) {
                    var callSite = getCallsite(fn);
                    console.log('      - %s: %s @ %s:%d', 'connect', fn.name || '(anonymous)', callSite.file, callSite.line);
                });
            }
        });
    }

    if (servers.length) {
        console.log('- Servers:');
        servers.forEach(function (s) {
            var type = 'unknown type';
            if (s instanceof HttpServer) { type = 'HTTP'; }
            else if (s instanceof HttpsServer) { type = 'HTTPS'; }
            else if (s instanceof TlsServer) { type = 'TLS'; }
            else if (s instanceof Server) { type = 'TCP'; }
            else if (s instanceof dgramSocket) { type = 'UDP'; }

            try {
                var a = s.address();
            } catch (e) {
                if (type === 'UDP') {
                    // udp sockets that haven't been bound will throw, but won't prevent exit
                    return;
                }
                throw e;
            }

            console.log('  - %s:%s (%s)', a.address, a.port, type);

            var eventType = (
              type === 'HTTP' || type === 'HTTPS' ? 'request' :
              type === 'TCP' || type === 'TLS' ? 'connection' :
              type === 'UDP' ? 'message' :
              'connection'
            );

            var listeners = s.listeners(eventType);

            if (listeners && listeners.length) {
                console.log('    - Listeners:');
                listeners.forEach(function (fn) {
                    var callSite = getCallsite(fn);
                    console.log('      - %s: %s @ %s:%d', eventType, fn.__name || fn.name || '(anonymous)', callSite.file, callSite.line);
                });
            }
        });
    }

    var timers = [ ], intervals = [ ];
    _timers.forEach(function (t) {
        var timer = t._list, cb, cbkey;
        if (t._list) {
            // node v5ish behavior
            do {
                cbkey = timerCallback(timer);
                if (cbkey && timers.indexOf(timer) === -1) {
                    cb = timer[cbkey];
                    if (cb.__isInterval || cbkey === '_repeat') {
                        intervals.push(timer);
                    } else {
                        timers.push(timer);
                    }
                }
                timer = timer._idleNext;
            } while (!timer.constructor || timer !== t._list);
        } else {
            // node 0.12ish behavior
            _timers.forEach(function (t) {
                var timer = t;
                while ((timer = timer._idleNext)) {
                    if (timer === t) {
                        break;
                    }
                    cbkey = timerCallback(timer);
                    if (cbkey && timers.indexOf(timer) === -1) {
                        cb = timer[cbkey]
                        if (cb.__isInterval) {
                            intervals.push(timer);
                        } else {
                            timers.push(timer);
                        }
                    }
                }

            });
        }
    });

    if (timers.length) {
        console.log('- Timers:');

        timers.forEach(function (t) {
            var fn = t[timerCallback(t)],
                callSite = getCallsite(fn);
            if (fn.__name) {
                console.log('  - (%d ~ %s) %s @ %s:%d', t._idleTimeout, formatTime(t._idleTimeout), fn.__name, callSite.file, callSite.line);
            } else {
                console.log('  - (%d ~ %s) %s @ %s:%d', t._idleTimeout, formatTime(t._idleTimeout), fn.name, callSite.file, callSite.line);
            }
        });
    }

    if (intervals.length) {
        console.log('- Intervals:');

        intervals.forEach(function (t) {
            var fn = t[timerCallback(t)],
                callSite = getCallsite(fn);
            if (fn.__name) {
                console.log('  - (%d ~ %s) %s @ %s:%d', t._idleTimeout, formatTime(t._idleTimeout), fn.__name, callSite.file, callSite.line);
            } else {
                console.log('  - (%d ~ %s) %s @ %s:%d', t._idleTimeout, formatTime(t._idleTimeout), fn.name, callSite.file, callSite.line);
            }
        });
    }

    if (other.length) {
        console.log('- Others:');
        other.forEach(function (o) {
            if (!o) { return; }
            if (o.constructor) { console.log('  - %s', o.constructor.name); }
            else { console.log('  - %s', o); }
        });
    }
}

function init() {
    process.on('SIGINT', function () {
        try { dump(); }
        catch (e) { console.error(e); }
        process.exit();
    });
}

module.exports = {
    dump: dump,
    init: init
};

function parseArgs() {
    if (process.argv.length < 3) {
        console.error('Usage: wtfnode <yourscript> <yourargs> ...');
        process.exit(1);
    }
    var moduleParams = process.argv.slice(3);
    var modulePath = path.resolve(process.cwd(), process.argv[2]);
    return [].concat(process.argv[0], modulePath, moduleParams);
}

if (module === require.main) {
    init();
    // The goal here is to invoke the given module in a form that is as
    // identical as possible to invoking `node <the_module>` directly.
    // This means massaging process.argv and using Module.runMain to convince
    // the module that it is the 'main' module.
    var newArgv = parseArgs(process.argv)
    var Module = require('module');
    process.argv = newArgv;
    Module.runMain();
}
