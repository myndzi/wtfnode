'use strict';

// Don't require these until we've hooked certain builtins
var ChildProcess,
    dgramSocket,
    HttpServer,
    HttpsServer,
    child_process,
    cluster,
    path,
    Server,
    Socket,
    Timer,
    TlsServer;

var NODE_VERSION = process.version.slice(1).split('.').map(function (v) { return parseInt(v, 10); });

var DONT_INSTRUMENT = {
    'ChildProcess': NODE_VERSION[0] === 0 && NODE_VERSION[1] <= 10
};

function timerCallback(thing) {
    if (typeof thing._repeat === 'function') { return '_repeat'; }
    if (typeof thing._onTimeout === 'function') { return '_onTimeout'; }
    if (typeof thing._onImmediate === 'function') { return '_onImmediate'; }
}

function setPrototypeOf(obj, proto) {
    if (Object.setPrototypeOf) {
        return Object.setPrototypeOf(obj, proto);
    } else {
        obj.__proto__ = proto;
        return obj;
    }
}

// hook stuff
(function () {
    var _Error_prepareStackTrace = Error.prepareStackTrace;
    var hooked = function (_, stack) { return stack; };

    function getStack() {
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

    function findCallsite(stack) {
        for (var i = 0; i < stack.length; i++) {
            // Ignore frames from:
            //  - wtfnode by excluding __filename
            //  - builtins by excluding files with no path separator
            //  - internal builtins by excluding files beginning with 'internal/'
            //    (even on windows, the stack trace uses unix separators for these)
            if (stack[i].file !== __filename &&
                stack[i].file.indexOf(path.sep) !== -1 &&
                stack[i].file.slice(0, 9) !== 'internal/'
            ) {
              return stack[i];
            }
        }
        return null;
    }

    function copyProperties(source, target) {
        // this should inherit 'name' and 'length' and any other properties that have been assigned
        Object.getOwnPropertyNames(source).forEach(function (key) {
            try {
                Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
            } catch (e) {
                // some properties cannot be redefined, not much we can do about it
            }
        });
        if (!Object.getOwnPropertySymbols) { return; }
        Object.getOwnPropertySymbols(source).forEach(function (sym) {
            try {
                Object.defineProperty(target, sym, Object.getOwnPropertyDescriptor(source, sym));
            } catch (e) {
                // some properties cannot be redefined, not much we can do about it
            }
        });
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

        var stack = getStack();

        // this should inherit 'name' and 'length' and any other properties that have been assigned
        copyProperties(fn, wrapped);

        // we use these later to identify the source information about an open handle
        if (!wrapped.hasOwnProperty('__callSite')) {
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
        }
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
        copyProperties(GLOBALS[type], global[type]);
    };
    wrapTimer('setTimeout', false);
    wrapTimer('setInterval', true);

    var EventEmitter = require('events').EventEmitter;
    var _EventEmitter_addListener = EventEmitter.prototype.addListener;
    var _EventEmitter_init = EventEmitter.init;

    if (!DONT_INSTRUMENT['ChildProcess']) {
        // this will conveniently be run on new child processes
        EventEmitter.init = function () {
            var callSite = findCallsite(getStack());
            if (callSite && !this.hasOwnProperty('__callSite')) {
                Object.defineProperties(this, {
                    __callSite: {
                        enumerable: false,
                        configurable: false,
                        writable: false,
                        value: findCallsite(getStack())
                    }
                });
            }

            return _EventEmitter_init.apply(this, arguments);
        };
    }

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

            // the above causes a problem in node v7: EventEmitter.prototype.listeners
            // unwraps the functions before returning them, so we lose our wrapper and
            // its associated data. I've tried to avoid mutating things that are not
            // mine, and use the Node API where I can, but it seems somewhat unavoidable
            // here
            Object.defineProperties(arguments[1], {
                __callSite: {
                    enumerable: false,
                    configurable: false,
                    writable: false,
                    value: args[1].__callSite
                }
            });
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
            Object.defineProperties(arguments[1], {
                __callSite: {
                    enumerable: false,
                    configurable: false,
                    writable: false,
                    value: args[1].__callSite
                }
            });
        }

        return _EventEmitter_addListener.apply(this, args);
    };

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
            var cp = require('child_process').spawn('true', [], { stdio: 'ignore' });
            ChildProcess = cp.constructor;
        }

        return ChildProcess;
    })();

    cluster = require('cluster');
    var _cluster_fork = cluster.fork;
    cluster.fork = function (/*env*/) {
        var worker = _cluster_fork.apply(this, arguments);

        // we get an open handle for a pipe, but no reference to the
        // worker itself, so we add one, as well as the call site info
        if (worker && worker.process && worker.process._channel) {
            Object.defineProperties(worker.process._channel, {
                __callSite: {
                    enumerable: false,
                    configurable: false,
                    writable: false,
                    value: findCallsite(getStack())
                },
                __worker: {
                    enumerable: false,
                    configurable: false,
                    writable: false,
                    value: worker
                }
            });
        }

        return worker;
    };
})();

function formatTime(t) {
    var labels = ['ms', 's', 'min', 'hr'],
        units = [1, 1000, 60, 60],
        i = 0;

    while (i < units.length && t / units[i] > 1) { t /= units[i++]; }
    return Math.floor(t) + ' ' + labels[i-1];
};

var count = 0;
function getCallsite(thing) {
    if (!thing.__callSite) {
        var name = ((thing.name ? thing.name : thing.constructor.name) || 'unknown').trim();
        if (!DONT_INSTRUMENT[name]) {
            console.warn('Unable to determine callsite for "'+name+'". Did you require `wtfnode` at the top of your entry point?');
        }
        return { file: 'unknown', line: 0 };
    }
    return thing.__callSite;
};

function dump() {
    console.log('[WTF Node?] open handles:');

    // sort the active handles into different types for logging
    var sockets = [ ], fds = [ ], servers = [ ], _timers = [ ], processes = [ ], clusterWorkers = [ ], other = [ ];
    process._getActiveHandles().forEach(function (h) {
        // handles can be null now? early exit to guard against this
        if (!h) { return; }

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
        else if (h.hasOwnProperty('__worker')) { clusterWorkers.push(h); }

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

    // remove cluster workers from child process list
    clusterWorkers.forEach(function (p) {
        if (!p.__worker || !p.__worker.process) { return; }
        var cw = p.__worker.process,
            idx = processes.indexOf(cw);

        if (idx > -1) { processes.splice(idx, 1); }
    });

    if (processes.length) {
        console.log('- Child processes');
        processes.forEach(function (cp) {
            var fds = [ ];
            console.log('  - PID %s', cp.pid);
            if (!DONT_INSTRUMENT['ChildProcess']) {
                var callSite = getCallsite(cp);
                console.log('    - Entry point: %s:%d', callSite.file, callSite.line);
            }
            if (cp.stdio && cp.stdio.length) {
                cp.stdio.forEach(function (s) {
                    if (s && s._handle && (s._handle.fd != null)) { fds.push(s._handle.fd); }
                    var idx = sockets.indexOf(s);
                    if (idx > -1) {
                        sockets.splice(idx, 1);
                    }
                });
                if (fds && fds.length) {
                    console.log('    - STDIO file descriptors:', fds.join(', '));
                }
            }
        });
    }

    if (clusterWorkers.length) {
        console.log('- Cluster workers');
        clusterWorkers.forEach(function (cw) {
            var fds = [ ], cp = cw.__worker.process;
            console.log('  - PID %s', cp.pid);
            var callSite = getCallsite(cw);
            console.log('    - Entry point: %s:%d', callSite.file, callSite.line);
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

            if (a) {
                console.log('  - %s:%s (%s)', a.address, a.port, type);
            } else {
                console.log('  - <unknown address>'); // closed / race condition?
            }

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
        // let other potential handlers run before exiting
        process.nextTick(function () {
            try { dump(); }
            catch (e) { console.error(e); }
            process.exit();
        });
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
    var newArgv = parseArgs(process.argv);
    var Module = require('module');
    process.argv = newArgv;
    Module.runMain();
}
