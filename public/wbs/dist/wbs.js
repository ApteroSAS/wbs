(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.WBS = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var R = typeof Reflect === 'object' ? Reflect : null
var ReflectApply = R && typeof R.apply === 'function'
  ? R.apply
  : function ReflectApply(target, receiver, args) {
    return Function.prototype.apply.call(target, receiver, args);
  }

var ReflectOwnKeys
if (R && typeof R.ownKeys === 'function') {
  ReflectOwnKeys = R.ownKeys
} else if (Object.getOwnPropertySymbols) {
  ReflectOwnKeys = function ReflectOwnKeys(target) {
    return Object.getOwnPropertyNames(target)
      .concat(Object.getOwnPropertySymbols(target));
  };
} else {
  ReflectOwnKeys = function ReflectOwnKeys(target) {
    return Object.getOwnPropertyNames(target);
  };
}

function ProcessEmitWarning(warning) {
  if (console && console.warn) console.warn(warning);
}

var NumberIsNaN = Number.isNaN || function NumberIsNaN(value) {
  return value !== value;
}

function EventEmitter() {
  EventEmitter.init.call(this);
}
module.exports = EventEmitter;
module.exports.once = once;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._eventsCount = 0;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

function checkListener(listener) {
  if (typeof listener !== 'function') {
    throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof listener);
  }
}

Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
  enumerable: true,
  get: function() {
    return defaultMaxListeners;
  },
  set: function(arg) {
    if (typeof arg !== 'number' || arg < 0 || NumberIsNaN(arg)) {
      throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' + arg + '.');
    }
    defaultMaxListeners = arg;
  }
});

EventEmitter.init = function() {

  if (this._events === undefined ||
      this._events === Object.getPrototypeOf(this)._events) {
    this._events = Object.create(null);
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
};

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || NumberIsNaN(n)) {
    throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received ' + n + '.');
  }
  this._maxListeners = n;
  return this;
};

function _getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return _getMaxListeners(this);
};

EventEmitter.prototype.emit = function emit(type) {
  var args = [];
  for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
  var doError = (type === 'error');

  var events = this._events;
  if (events !== undefined)
    doError = (doError && events.error === undefined);
  else if (!doError)
    return false;

  // If there is no 'error' event listener then throw.
  if (doError) {
    var er;
    if (args.length > 0)
      er = args[0];
    if (er instanceof Error) {
      // Note: The comments on the `throw` lines are intentional, they show
      // up in Node's output if this results in an unhandled exception.
      throw er; // Unhandled 'error' event
    }
    // At least give some kind of context to the user
    var err = new Error('Unhandled error.' + (er ? ' (' + er.message + ')' : ''));
    err.context = er;
    throw err; // Unhandled 'error' event
  }

  var handler = events[type];

  if (handler === undefined)
    return false;

  if (typeof handler === 'function') {
    ReflectApply(handler, this, args);
  } else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      ReflectApply(listeners[i], this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  checkListener(listener);

  events = target._events;
  if (events === undefined) {
    events = target._events = Object.create(null);
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener !== undefined) {
      target.emit('newListener', type,
                  listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (existing === undefined) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
        prepend ? [listener, existing] : [existing, listener];
      // If we've already got an array, just append.
    } else if (prepend) {
      existing.unshift(listener);
    } else {
      existing.push(listener);
    }

    // Check for listener leak
    m = _getMaxListeners(target);
    if (m > 0 && existing.length > m && !existing.warned) {
      existing.warned = true;
      // No error code for this since it is a Warning
      // eslint-disable-next-line no-restricted-syntax
      var w = new Error('Possible EventEmitter memory leak detected. ' +
                          existing.length + ' ' + String(type) + ' listeners ' +
                          'added. Use emitter.setMaxListeners() to ' +
                          'increase limit');
      w.name = 'MaxListenersExceededWarning';
      w.emitter = target;
      w.type = type;
      w.count = existing.length;
      ProcessEmitWarning(w);
    }
  }

  return target;
}

EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    if (arguments.length === 0)
      return this.listener.call(this.target);
    return this.listener.apply(this.target, arguments);
  }
}

function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  var wrapped = onceWrapper.bind(state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
  checkListener(listener);
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      checkListener(listener);
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      checkListener(listener);

      events = this._events;
      if (events === undefined)
        return this;

      list = events[type];
      if (list === undefined)
        return this;

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = Object.create(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (position === 0)
          list.shift();
        else {
          spliceOne(list, position);
        }

        if (list.length === 1)
          events[type] = list[0];

        if (events.removeListener !== undefined)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.off = EventEmitter.prototype.removeListener;

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events, i;

      events = this._events;
      if (events === undefined)
        return this;

      // not listening for removeListener, no need to emit
      if (events.removeListener === undefined) {
        if (arguments.length === 0) {
          this._events = Object.create(null);
          this._eventsCount = 0;
        } else if (events[type] !== undefined) {
          if (--this._eventsCount === 0)
            this._events = Object.create(null);
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = Object.keys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = Object.create(null);
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners !== undefined) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }

      return this;
    };

function _listeners(target, type, unwrap) {
  var events = target._events;

  if (events === undefined)
    return [];

  var evlistener = events[type];
  if (evlistener === undefined)
    return [];

  if (typeof evlistener === 'function')
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];

  return unwrap ?
    unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}

EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};

EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events !== undefined) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener !== undefined) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? ReflectOwnKeys(this._events) : [];
};

function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}

function spliceOne(list, index) {
  for (; index + 1 < list.length; index++)
    list[index] = list[index + 1];
  list.pop();
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

function once(emitter, name) {
  return new Promise(function (resolve, reject) {
    function errorListener(err) {
      emitter.removeListener(name, resolver);
      reject(err);
    }

    function resolver() {
      if (typeof emitter.removeListener === 'function') {
        emitter.removeListener('error', errorListener);
      }
      resolve([].slice.call(arguments));
    };

    eventTargetAgnosticAddListener(emitter, name, resolver, { once: true });
    if (name !== 'error') {
      addErrorHandlerIfEventEmitter(emitter, errorListener, { once: true });
    }
  });
}

function addErrorHandlerIfEventEmitter(emitter, handler, flags) {
  if (typeof emitter.on === 'function') {
    eventTargetAgnosticAddListener(emitter, 'error', handler, flags);
  }
}

function eventTargetAgnosticAddListener(emitter, name, listener, flags) {
  if (typeof emitter.on === 'function') {
    if (flags.once) {
      emitter.once(name, listener);
    } else {
      emitter.on(name, listener);
    }
  } else if (typeof emitter.addEventListener === 'function') {
    // EventTarget does not have `error` event semantics like Node
    // EventEmitters, we do not listen for `error` events here.
    emitter.addEventListener(name, function wrapListener(arg) {
      // IE does not have builtin `{ once: true }` support so we
      // have to do it manually.
      if (flags.once) {
        emitter.removeEventListener(name, wrapListener);
      }
      listener(arg);
    });
  } else {
    throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type ' + typeof emitter);
  }
}

},{}],3:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],4:[function(require,module,exports){
var css = "@keyframes vex-pulse {\n  0% {\n    -moz-box-shadow: inset 0 0 0 300px transparent;\n    -webkit-box-shadow: inset 0 0 0 300px transparent;\n    box-shadow: inset 0 0 0 300px transparent;\n  }\n\n  70% {\n    -moz-box-shadow: inset 0 0 0 300px rgba(255, 255, 255, 0.25);\n    -webkit-box-shadow: inset 0 0 0 300px rgba(255, 255, 255, 0.25);\n    box-shadow: inset 0 0 0 300px rgba(255, 255, 255, 0.25);\n  }\n\n  100% {\n    -moz-box-shadow: inset 0 0 0 300px transparent;\n    -webkit-box-shadow: inset 0 0 0 300px transparent;\n    box-shadow: inset 0 0 0 300px transparent;\n  }\n}\n@-webkit-keyframes vex-pulse {\n  0% {\n    -moz-box-shadow: inset 0 0 0 300px transparent;\n    -webkit-box-shadow: inset 0 0 0 300px transparent;\n    box-shadow: inset 0 0 0 300px transparent;\n  }\n\n  70% {\n    -moz-box-shadow: inset 0 0 0 300px rgba(255, 255, 255, 0.25);\n    -webkit-box-shadow: inset 0 0 0 300px rgba(255, 255, 255, 0.25);\n    box-shadow: inset 0 0 0 300px rgba(255, 255, 255, 0.25);\n  }\n\n  100% {\n    -moz-box-shadow: inset 0 0 0 300px transparent;\n    -webkit-box-shadow: inset 0 0 0 300px transparent;\n    box-shadow: inset 0 0 0 300px transparent;\n  }\n}\n@-moz-keyframes vex-pulse {\n  0% {\n    -moz-box-shadow: inset 0 0 0 300px transparent;\n    -webkit-box-shadow: inset 0 0 0 300px transparent;\n    box-shadow: inset 0 0 0 300px transparent;\n  }\n\n  70% {\n    -moz-box-shadow: inset 0 0 0 300px rgba(255, 255, 255, 0.25);\n    -webkit-box-shadow: inset 0 0 0 300px rgba(255, 255, 255, 0.25);\n    box-shadow: inset 0 0 0 300px rgba(255, 255, 255, 0.25);\n  }\n\n  100% {\n    -moz-box-shadow: inset 0 0 0 300px transparent;\n    -webkit-box-shadow: inset 0 0 0 300px transparent;\n    box-shadow: inset 0 0 0 300px transparent;\n  }\n}\n@-ms-keyframes vex-pulse {\n  0% {\n    -moz-box-shadow: inset 0 0 0 300px transparent;\n    -webkit-box-shadow: inset 0 0 0 300px transparent;\n    box-shadow: inset 0 0 0 300px transparent;\n  }\n\n  70% {\n    -moz-box-shadow: inset 0 0 0 300px rgba(255, 255, 255, 0.25);\n    -webkit-box-shadow: inset 0 0 0 300px rgba(255, 255, 255, 0.25);\n    box-shadow: inset 0 0 0 300px rgba(255, 255, 255, 0.25);\n  }\n\n  100% {\n    -moz-box-shadow: inset 0 0 0 300px transparent;\n    -webkit-box-shadow: inset 0 0 0 300px transparent;\n    box-shadow: inset 0 0 0 300px transparent;\n  }\n}\n@-o-keyframes vex-pulse {\n  0% {\n    -moz-box-shadow: inset 0 0 0 300px transparent;\n    -webkit-box-shadow: inset 0 0 0 300px transparent;\n    box-shadow: inset 0 0 0 300px transparent;\n  }\n\n  70% {\n    -moz-box-shadow: inset 0 0 0 300px rgba(255, 255, 255, 0.25);\n    -webkit-box-shadow: inset 0 0 0 300px rgba(255, 255, 255, 0.25);\n    box-shadow: inset 0 0 0 300px rgba(255, 255, 255, 0.25);\n  }\n\n  100% {\n    -moz-box-shadow: inset 0 0 0 300px transparent;\n    -webkit-box-shadow: inset 0 0 0 300px transparent;\n    box-shadow: inset 0 0 0 300px transparent;\n  }\n}\n.vex.vex-theme-plain {\n  padding-top: 160px;\n  padding-bottom: 160px;\n}\n.vex.vex-theme-plain .vex-content {\n  font-family: \"Helvetica Neue\", sans-serif;\n  background: #fff;\n  color: #444;\n  padding: 1em;\n  position: relative;\n  margin: 0 auto;\n  max-width: 100%;\n  width: 450px;\n  font-size: 1.1em;\n  line-height: 1.5em;\n}\n.vex.vex-theme-plain .vex-content h1,\n.vex.vex-theme-plain .vex-content h2,\n.vex.vex-theme-plain .vex-content h3,\n.vex.vex-theme-plain .vex-content h4,\n.vex.vex-theme-plain .vex-content h5,\n.vex.vex-theme-plain .vex-content h6,\n.vex.vex-theme-plain .vex-content p,\n.vex.vex-theme-plain .vex-content ul,\n.vex.vex-theme-plain .vex-content li {\n  color: inherit;\n}\n.vex.vex-theme-plain .vex-close {\n  position: absolute;\n  top: 0;\n  right: 0;\n  cursor: pointer;\n}\n.vex.vex-theme-plain .vex-close:before {\n  position: absolute;\n  content: \"\\00D7\";\n  font-size: 26px;\n  font-weight: normal;\n  line-height: 31px;\n  height: 30px;\n  width: 30px;\n  text-align: center;\n  top: 3px;\n  right: 3px;\n  color: #bbb;\n  background: transparent;\n}\n.vex.vex-theme-plain .vex-close:hover:before,\n.vex.vex-theme-plain .vex-close:active:before {\n  color: #777;\n  background: #e0e0e0;\n}\n.vex.vex-theme-plain .vex-dialog-form .vex-dialog-message {\n  margin-bottom: .5em;\n}\n.vex.vex-theme-plain .vex-dialog-form .vex-dialog-input {\n  margin-bottom: 1em;\n}\n.vex.vex-theme-plain .vex-dialog-form .vex-dialog-input select,\n.vex.vex-theme-plain .vex-dialog-form .vex-dialog-input textarea,\n.vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type=\"date\"],\n.vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type=\"datetime\"],\n.vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type=\"datetime-local\"],\n.vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type=\"email\"],\n.vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type=\"month\"],\n.vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type=\"number\"],\n.vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type=\"password\"],\n.vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type=\"search\"],\n.vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type=\"tel\"],\n.vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type=\"text\"],\n.vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type=\"time\"],\n.vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type=\"url\"],\n.vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type=\"week\"] {\n  background: #f0f0f0;\n  width: 100%;\n  padding: .25em .67em;\n  border: 0;\n  font-family: inherit;\n  font-weight: inherit;\n  font-size: inherit;\n  min-height: 2.5em;\n  margin: 0 0 .25em;\n}\n.vex.vex-theme-plain .vex-dialog-form .vex-dialog-input select:focus,\n.vex.vex-theme-plain .vex-dialog-form .vex-dialog-input textarea:focus,\n.vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type=\"date\"]:focus,\n.vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type=\"datetime\"]:focus,\n.vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type=\"datetime-local\"]:focus,\n.vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type=\"email\"]:focus,\n.vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type=\"month\"]:focus,\n.vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type=\"number\"]:focus,\n.vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type=\"password\"]:focus,\n.vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type=\"search\"]:focus,\n.vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type=\"tel\"]:focus,\n.vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type=\"text\"]:focus,\n.vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type=\"time\"]:focus,\n.vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type=\"url\"]:focus,\n.vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type=\"week\"]:focus {\n  -moz-box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.2);\n  -webkit-box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.2);\n  box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.2);\n  outline: none;\n}\n.vex.vex-theme-plain .vex-dialog-form .vex-dialog-buttons {\n  *zoom: 1;\n}\n.vex.vex-theme-plain .vex-dialog-form .vex-dialog-buttons:after {\n  content: \"\";\n  display: table;\n  clear: both;\n}\n.vex.vex-theme-plain .vex-dialog-button {\n  -moz-border-radius: 0;\n  -webkit-border-radius: 0;\n  border-radius: 0;\n  border: 0;\n  float: right;\n  margin: 0 0 0 .5em;\n  font-family: inherit;\n  text-transform: uppercase;\n  letter-spacing: .1em;\n  font-size: .8em;\n  line-height: 1em;\n  padding: .75em 2em;\n}\n.vex.vex-theme-plain .vex-dialog-button.vex-last {\n  margin-left: 0;\n}\n.vex.vex-theme-plain .vex-dialog-button:focus {\n  animation: vex-pulse 1.1s infinite;\n  -webkit-animation: vex-pulse 1.1s infinite;\n  -moz-animation: vex-pulse 1.1s infinite;\n  -ms-animation: vex-pulse 1.1s infinite;\n  -o-animation: vex-pulse 1.1s infinite;\n  -webkit-backface-visibility: hidden;\n  outline: none;\n}\n@media (max-width: 568px) {\n  .vex.vex-theme-plain .vex-dialog-button:focus {\n    animation: none;\n    -webkit-animation: none;\n    -moz-animation: none;\n    -ms-animation: none;\n    -o-animation: none;\n    -webkit-backface-visibility: hidden;\n  }\n}\n.vex.vex-theme-plain .vex-dialog-button.vex-dialog-button-primary {\n  background: #3288e6;\n  color: #fff;\n}\n.vex.vex-theme-plain .vex-dialog-button.vex-dialog-button-secondary {\n  background: #e0e0e0;\n  color: #777;\n}\n.vex-loading-spinner.vex-theme-plain {\n  height: 2.5em;\n  width: 2.5em;\n}\n"; (require("browserify-css").createStyle(css, { "href": "less\\vex-theme-plain.css" }, { "insertAt": "bottom" })); module.exports = css;
},{"browserify-css":8}],5:[function(require,module,exports){
var css = "@keyframes vex-fadein {\n  0% {\n    opacity: 0;\n  }\n\n  100% {\n    opacity: 1;\n  }\n}\n@-webkit-keyframes vex-fadein {\n  0% {\n    opacity: 0;\n  }\n\n  100% {\n    opacity: 1;\n  }\n}\n@-moz-keyframes vex-fadein {\n  0% {\n    opacity: 0;\n  }\n\n  100% {\n    opacity: 1;\n  }\n}\n@-ms-keyframes vex-fadein {\n  0% {\n    opacity: 0;\n  }\n\n  100% {\n    opacity: 1;\n  }\n}\n@-o-keyframes vex-fadein {\n  0% {\n    opacity: 0;\n  }\n\n  100% {\n    opacity: 1;\n  }\n}\n@keyframes vex-fadeout {\n  0% {\n    opacity: 1;\n  }\n\n  100% {\n    opacity: 0;\n  }\n}\n@-webkit-keyframes vex-fadeout {\n  0% {\n    opacity: 1;\n  }\n\n  100% {\n    opacity: 0;\n  }\n}\n@-moz-keyframes vex-fadeout {\n  0% {\n    opacity: 1;\n  }\n\n  100% {\n    opacity: 0;\n  }\n}\n@-ms-keyframes vex-fadeout {\n  0% {\n    opacity: 1;\n  }\n\n  100% {\n    opacity: 0;\n  }\n}\n@-o-keyframes vex-fadeout {\n  0% {\n    opacity: 1;\n  }\n\n  100% {\n    opacity: 0;\n  }\n}\n@keyframes vex-rotation {\n  0% {\n    transform: rotate(0deg);\n    -webkit-transform: rotate(0deg);\n    -moz-transform: rotate(0deg);\n    -ms-transform: rotate(0deg);\n    -o-transform: rotate(0deg);\n  }\n\n  100% {\n    transform: rotate(359deg);\n    -webkit-transform: rotate(359deg);\n    -moz-transform: rotate(359deg);\n    -ms-transform: rotate(359deg);\n    -o-transform: rotate(359deg);\n  }\n}\n@-webkit-keyframes vex-rotation {\n  0% {\n    transform: rotate(0deg);\n    -webkit-transform: rotate(0deg);\n    -moz-transform: rotate(0deg);\n    -ms-transform: rotate(0deg);\n    -o-transform: rotate(0deg);\n  }\n\n  100% {\n    transform: rotate(359deg);\n    -webkit-transform: rotate(359deg);\n    -moz-transform: rotate(359deg);\n    -ms-transform: rotate(359deg);\n    -o-transform: rotate(359deg);\n  }\n}\n@-moz-keyframes vex-rotation {\n  0% {\n    transform: rotate(0deg);\n    -webkit-transform: rotate(0deg);\n    -moz-transform: rotate(0deg);\n    -ms-transform: rotate(0deg);\n    -o-transform: rotate(0deg);\n  }\n\n  100% {\n    transform: rotate(359deg);\n    -webkit-transform: rotate(359deg);\n    -moz-transform: rotate(359deg);\n    -ms-transform: rotate(359deg);\n    -o-transform: rotate(359deg);\n  }\n}\n@-ms-keyframes vex-rotation {\n  0% {\n    transform: rotate(0deg);\n    -webkit-transform: rotate(0deg);\n    -moz-transform: rotate(0deg);\n    -ms-transform: rotate(0deg);\n    -o-transform: rotate(0deg);\n  }\n\n  100% {\n    transform: rotate(359deg);\n    -webkit-transform: rotate(359deg);\n    -moz-transform: rotate(359deg);\n    -ms-transform: rotate(359deg);\n    -o-transform: rotate(359deg);\n  }\n}\n@-o-keyframes vex-rotation {\n  0% {\n    transform: rotate(0deg);\n    -webkit-transform: rotate(0deg);\n    -moz-transform: rotate(0deg);\n    -ms-transform: rotate(0deg);\n    -o-transform: rotate(0deg);\n  }\n\n  100% {\n    transform: rotate(359deg);\n    -webkit-transform: rotate(359deg);\n    -moz-transform: rotate(359deg);\n    -ms-transform: rotate(359deg);\n    -o-transform: rotate(359deg);\n  }\n}\n.vex,\n.vex *,\n.vex *:before,\n.vex *:after {\n  -moz-box-sizing: border-box;\n  -webkit-box-sizing: border-box;\n  box-sizing: border-box;\n}\n.vex {\n  position: fixed;\n  overflow: auto;\n  -webkit-overflow-scrolling: touch;\n  z-index: 1111;\n  top: 0;\n  right: 0;\n  bottom: 0;\n  left: 0;\n}\n.vex-scrollbar-measure {\n  position: absolute;\n  top: -9999px;\n  width: 50px;\n  height: 50px;\n  overflow: scroll;\n}\n.vex-overlay {\n  background: #000;\n  filter: alpha(opacity=40);\n  -ms-filter: \"progid:DXImageTransform.Microsoft.Alpha(Opacity=40)\";\n}\n.vex-overlay {\n  animation: vex-fadein 0.5s;\n  -webkit-animation: vex-fadein 0.5s;\n  -moz-animation: vex-fadein 0.5s;\n  -ms-animation: vex-fadein 0.5s;\n  -o-animation: vex-fadein 0.5s;\n  -webkit-backface-visibility: hidden;\n  position: fixed;\n  background: rgba(0, 0, 0, 0.4);\n  top: 0;\n  right: 0;\n  bottom: 0;\n  left: 0;\n}\n.vex.vex-closing .vex-overlay {\n  animation: vex-fadeout 0.5s;\n  -webkit-animation: vex-fadeout 0.5s;\n  -moz-animation: vex-fadeout 0.5s;\n  -ms-animation: vex-fadeout 0.5s;\n  -o-animation: vex-fadeout 0.5s;\n  -webkit-backface-visibility: hidden;\n}\n.vex-content {\n  animation: vex-fadein 0.5s;\n  -webkit-animation: vex-fadein 0.5s;\n  -moz-animation: vex-fadein 0.5s;\n  -ms-animation: vex-fadein 0.5s;\n  -o-animation: vex-fadein 0.5s;\n  -webkit-backface-visibility: hidden;\n  background: #fff;\n}\n.vex.vex-closing .vex-content {\n  animation: vex-fadeout 0.5s;\n  -webkit-animation: vex-fadeout 0.5s;\n  -moz-animation: vex-fadeout 0.5s;\n  -ms-animation: vex-fadeout 0.5s;\n  -o-animation: vex-fadeout 0.5s;\n  -webkit-backface-visibility: hidden;\n}\n.vex-close:before {\n  font-family: Arial, sans-serif;\n  content: \"\\00D7\";\n}\n.vex-dialog-form {\n  margin: 0;\n}\n.vex-dialog-button {\n  text-rendering: optimizeLegibility;\n  -moz-appearance: none;\n  -webkit-appearance: none;\n  cursor: pointer;\n  -webkit-tap-highlight-color: transparent;\n}\n.vex-loading-spinner {\n  animation: vex-rotation 0.7s linear infinite;\n  -webkit-animation: vex-rotation 0.7s linear infinite;\n  -moz-animation: vex-rotation 0.7s linear infinite;\n  -ms-animation: vex-rotation 0.7s linear infinite;\n  -o-animation: vex-rotation 0.7s linear infinite;\n  -webkit-backface-visibility: hidden;\n  -moz-box-shadow: 0 0 1em rgba(0, 0, 0, 0.1);\n  -webkit-box-shadow: 0 0 1em rgba(0, 0, 0, 0.1);\n  box-shadow: 0 0 1em rgba(0, 0, 0, 0.1);\n  position: fixed;\n  z-index: 1112;\n  margin: auto;\n  top: 0;\n  right: 0;\n  bottom: 0;\n  left: 0;\n  height: 2em;\n  width: 2em;\n  background: #fff;\n}\nbody.vex-open {\n  overflow: hidden;\n}\n"; (require("browserify-css").createStyle(css, { "href": "less\\vex.css" }, { "insertAt": "bottom" })); module.exports = css;
},{"browserify-css":8}],6:[function(require,module,exports){
var css = "/* Generated by less 2.5.1 */\n.JumpStreamer {\n  height: 100%;\n  width: 100%;\n  position: relative;\n  background: #ececec;\n  font-size: 14px;\n  font-weight: 500;\n  font-family: -apple-system, BlinkMacSystemFont, \"Helvetica Neue\", \"Helvetica\", sans-serif;\n}\n.JumpStreamer button,\n.JumpStreamer label,\n.JumpStreamer .option,\n.JumpStreamer span {\n  -webkit-touch-callout: none;\n  -webkit-user-select: none;\n  -khtml-user-select: none;\n  -moz-user-select: none;\n  -ms-user-select: none;\n  user-select: none;\n}\n.JumpStreamer button {\n  font-size: 14px;\n  font-weight: 500;\n  font-family: -apple-system, BlinkMacSystemFont, \"Helvetica Neue\", \"Helvetica\", sans-serif;\n  background: #D9D9D9;\n  border: none;\n  padding: 10px;\n  cursor: pointer;\n  outline: none;\n}\n.JumpStreamer button:hover {\n  background: #aaaaaa;\n}\n.JumpStreamer button:active {\n  transform: scale(0.95);\n}\n.JumpStreamer .view {\n  position: absolute;\n  top: 10px;\n  left: 10px;\n  right: 10px;\n  bottom: 180px;\n  background: #4c4c4c;\n  overflow: hidden;\n  text-align: center;\n}\n.JumpStreamer .view video {\n  height: 100%;\n  display: inline-block;\n  background: black;\n}\n.JumpStreamer .view .mover {\n  height: 100px;\n  width: 100px;\n  position: absolute;\n  border: solid #2651e0 2px;\n}\n.JumpStreamer .view .mover .corner {\n  pointer-events: none;\n  width: 0px;\n  height: 0px;\n  border-radius: 100%;\n  border: solid #2651e0 6px;\n  position: absolute;\n}\n.JumpStreamer .view .mover .corner.top {\n  top: -6px;\n}\n.JumpStreamer .view .mover .corner.left {\n  left: -7px;\n}\n.JumpStreamer .view .mover .corner.bottom {\n  top: calc(98%);\n}\n.JumpStreamer .view .mover .corner.right {\n  left: calc(99%);\n}\n.JumpStreamer .toolbar {\n  height: 170px;\n  display: flex;\n  position: absolute;\n  left: 5px;\n  right: 5px;\n  bottom: 5px;\n}\n.JumpStreamer .toolbar label,\n.JumpStreamer .toolbar br {\n  margin-bottom: 10px;\n}\n.JumpStreamer .toolbar .list {\n  margin-top: 10px;\n}\n.JumpStreamer .toolbar > div {\n  display: inline-block;\n  margin: 5px;\n}\n.JumpStreamer .toolbar .scenes {\n  float: left;\n  width: 150px;\n}\n.JumpStreamer .toolbar .sources {\n  float: left;\n  width: 150px;\n}\n.JumpStreamer .toolbar .mixer {\n  flex-grow: 1;\n  display: none;\n}\n@media only screen and (min-width : 800px) {\n  .JumpStreamer .toolbar .mixer {\n    display: inherit;\n  }\n}\n.JumpStreamer .toolbar .mixer > label {\n  position: absolute;\n}\n.JumpStreamer .toolbar .mixer > div {\n  margin-top: 27px;\n  width: 100%;\n  height: 125px;\n  overflow-y: scroll;\n  background: white;\n  padding: 5px;\n}\n.JumpStreamer .toolbar .mixer .meter {\n  height: 5px;\n  background: #00be00;\n}\n.JumpStreamer .toolbar .transitions {\n  float: right;\n  width: 150px;\n  display: none;\n}\n@media only screen and (min-width : 620px) {\n  .JumpStreamer .toolbar .transitions {\n    display: inherit;\n  }\n}\n.JumpStreamer .toolbar .controls {\n  float: right;\n  width: 150px;\n}\n.JumpStreamer .toolbar .controls button {\n  display: block;\n  width: 100%;\n  margin-bottom: 5px;\n}\n.JumpStreamer .toolbar .controls button.stopped {\n  background-color: #2ddd5c;\n  color: white;\n}\n.JumpStreamer .toolbar .controls button.started {\n  background-color: #ed2d2d;\n  color: white;\n}\n.JumpStreamer .list .select {\n  background: white;\n  height: 100px;\n  overflow-x: hidden;\n  overflow-y: scroll;\n}\n.JumpStreamer .list .select .option {\n  padding: 3px;\n  cursor: default;\n}\n.JumpStreamer .list .select .option.selected {\n  background: #D4D4D4;\n}\n.JumpStreamer .list .controls {\n  background: #D9D9D9;\n  padding-bottom: 10px;\n}\n.JumpStreamer .list .controls div {\n  width: 32px;\n  display: inline-block;\n}\n.JumpStreamer .list .controls button {\n  display: inline-block;\n  width: 20px;\n  height: 20px;\n  text-align: center;\n  background: none;\n  padding: 0;\n  border: none;\n  font-size: 18px;\n  margin-left: 5px;\n  cursor: pointer;\n  outline: none;\n}\n.JumpStreamer .list .controls button.disabled {\n  pointer-events: none;\n  color: #898989;\n}\n.JumpStreamer .list .controls button:hover {\n  color: #454545;\n}\n.JumpStreamer .list .controls button.plus,\n.JumpStreamer .list .controls button.minus {\n  font-size: 26px;\n}\n"; (require("browserify-css").createStyle(css, { "href": "less\\wbs.css" }, { "insertAt": "bottom" })); module.exports = css;
},{"browserify-css":8}],7:[function(require,module,exports){
/*!
 * Cross-Browser Split 1.1.1
 * Copyright 2007-2012 Steven Levithan <stevenlevithan.com>
 * Available under the MIT License
 * ECMAScript compliant, uniform cross-browser split method
 */

/**
 * Splits a string into an array of strings using a regex or string separator. Matches of the
 * separator are not included in the result array. However, if `separator` is a regex that contains
 * capturing groups, backreferences are spliced into the result each time `separator` is matched.
 * Fixes browser bugs compared to the native `String.prototype.split` and can be used reliably
 * cross-browser.
 * @param {String} str String to split.
 * @param {RegExp|String} separator Regex or string to use for separating the string.
 * @param {Number} [limit] Maximum number of items to include in the result array.
 * @returns {Array} Array of substrings.
 * @example
 *
 * // Basic use
 * split('a b c d', ' ');
 * // -> ['a', 'b', 'c', 'd']
 *
 * // With limit
 * split('a b c d', ' ', 2);
 * // -> ['a', 'b']
 *
 * // Backreferences in result array
 * split('..word1 word2..', /([a-z]+)(\d+)/i);
 * // -> ['..', 'word', '1', ' ', 'word', '2', '..']
 */
module.exports = (function split(undef) {

  var nativeSplit = String.prototype.split,
    compliantExecNpcg = /()??/.exec("")[1] === undef,
    // NPCG: nonparticipating capturing group
    self;

  self = function(str, separator, limit) {
    // If `separator` is not a regex, use `nativeSplit`
    if (Object.prototype.toString.call(separator) !== "[object RegExp]") {
      return nativeSplit.call(str, separator, limit);
    }
    var output = [],
      flags = (separator.ignoreCase ? "i" : "") + (separator.multiline ? "m" : "") + (separator.extended ? "x" : "") + // Proposed for ES6
      (separator.sticky ? "y" : ""),
      // Firefox 3+
      lastLastIndex = 0,
      // Make `global` and avoid `lastIndex` issues by working with a copy
      separator = new RegExp(separator.source, flags + "g"),
      separator2, match, lastIndex, lastLength;
    str += ""; // Type-convert
    if (!compliantExecNpcg) {
      // Doesn't need flags gy, but they don't hurt
      separator2 = new RegExp("^" + separator.source + "$(?!\\s)", flags);
    }
    /* Values for `limit`, per the spec:
     * If undefined: 4294967295 // Math.pow(2, 32) - 1
     * If 0, Infinity, or NaN: 0
     * If positive number: limit = Math.floor(limit); if (limit > 4294967295) limit -= 4294967296;
     * If negative number: 4294967296 - Math.floor(Math.abs(limit))
     * If other: Type-convert, then use the above rules
     */
    limit = limit === undef ? -1 >>> 0 : // Math.pow(2, 32) - 1
    limit >>> 0; // ToUint32(limit)
    while (match = separator.exec(str)) {
      // `separator.lastIndex` is not reliable cross-browser
      lastIndex = match.index + match[0].length;
      if (lastIndex > lastLastIndex) {
        output.push(str.slice(lastLastIndex, match.index));
        // Fix browsers whose `exec` methods don't consistently return `undefined` for
        // nonparticipating capturing groups
        if (!compliantExecNpcg && match.length > 1) {
          match[0].replace(separator2, function() {
            for (var i = 1; i < arguments.length - 2; i++) {
              if (arguments[i] === undef) {
                match[i] = undef;
              }
            }
          });
        }
        if (match.length > 1 && match.index < str.length) {
          Array.prototype.push.apply(output, match.slice(1));
        }
        lastLength = match[0].length;
        lastLastIndex = lastIndex;
        if (output.length >= limit) {
          break;
        }
      }
      if (separator.lastIndex === match.index) {
        separator.lastIndex++; // Avoid an infinite loop
      }
    }
    if (lastLastIndex === str.length) {
      if (lastLength || !separator.test("")) {
        output.push("");
      }
    } else {
      output.push(str.slice(lastLastIndex));
    }
    return output.length > limit ? output.slice(0, limit) : output;
  };

  return self;
})();

},{}],8:[function(require,module,exports){
'use strict';
// For more information about browser field, check out the browser field at https://github.com/substack/browserify-handbook#browser-field.

var styleElementsInsertedAtTop = [];

var insertStyleElement = function(styleElement, options) {
    var head = document.head || document.getElementsByTagName('head')[0];
    var lastStyleElementInsertedAtTop = styleElementsInsertedAtTop[styleElementsInsertedAtTop.length - 1];

    options = options || {};
    options.insertAt = options.insertAt || 'bottom';

    if (options.insertAt === 'top') {
        if (!lastStyleElementInsertedAtTop) {
            head.insertBefore(styleElement, head.firstChild);
        } else if (lastStyleElementInsertedAtTop.nextSibling) {
            head.insertBefore(styleElement, lastStyleElementInsertedAtTop.nextSibling);
        } else {
            head.appendChild(styleElement);
        }
        styleElementsInsertedAtTop.push(styleElement);
    } else if (options.insertAt === 'bottom') {
        head.appendChild(styleElement);
    } else {
        throw new Error('Invalid value for parameter \'insertAt\'. Must be \'top\' or \'bottom\'.');
    }
};

module.exports = {
    // Create a <link> tag with optional data attributes
    createLink: function(href, attributes) {
        var head = document.head || document.getElementsByTagName('head')[0];
        var link = document.createElement('link');

        link.href = href;
        link.rel = 'stylesheet';

        for (var key in attributes) {
            if ( ! attributes.hasOwnProperty(key)) {
                continue;
            }
            var value = attributes[key];
            link.setAttribute('data-' + key, value);
        }

        head.appendChild(link);
    },
    // Create a <style> tag with optional data attributes
    createStyle: function(cssText, attributes, extraOptions) {
        extraOptions = extraOptions || {};

        var style = document.createElement('style');
        style.type = 'text/css';

        for (var key in attributes) {
            if ( ! attributes.hasOwnProperty(key)) {
                continue;
            }
            var value = attributes[key];
            style.setAttribute('data-' + key, value);
        }

        if (style.sheet) { // for jsdom and IE9+
            style.innerHTML = cssText;
            style.sheet.cssText = cssText;
            insertStyleElement(style, { insertAt: extraOptions.insertAt });
        } else if (style.styleSheet) { // for IE8 and below
            insertStyleElement(style, { insertAt: extraOptions.insertAt });
            style.styleSheet.cssText = cssText;
        } else { // for Chrome, Firefox, and Safari
            style.appendChild(document.createTextNode(cssText));
            insertStyleElement(style, { insertAt: extraOptions.insertAt });
        }
    }
};

},{}],9:[function(require,module,exports){
// contains, add, remove, toggle
var indexof = require('indexof')

module.exports = ClassList

function ClassList(elem) {
    var cl = elem.classList

    if (cl) {
        return cl
    }

    var classList = {
        add: add
        , remove: remove
        , contains: contains
        , toggle: toggle
        , toString: $toString
        , length: 0
        , item: item
    }

    return classList

    function add(token) {
        var list = getTokens()
        if (indexof(list, token) > -1) {
            return
        }
        list.push(token)
        setTokens(list)
    }

    function remove(token) {
        var list = getTokens()
            , index = indexof(list, token)

        if (index === -1) {
            return
        }

        list.splice(index, 1)
        setTokens(list)
    }

    function contains(token) {
        return indexof(getTokens(), token) > -1
    }

    function toggle(token) {
        if (contains(token)) {
            remove(token)
            return false
        } else {
            add(token)
            return true
        }
    }

    function $toString() {
        return elem.className
    }

    function item(index) {
        var tokens = getTokens()
        return tokens[index] || null
    }

    function getTokens() {
        var className = elem.className

        return filter(className.split(" "), isTruthy)
    }

    function setTokens(list) {
        var length = list.length

        elem.className = list.join(" ")
        classList.length = length

        for (var i = 0; i < list.length; i++) {
            classList[i] = list[i]
        }

        delete list[length]
    }
}

function filter (arr, fn) {
    var ret = []
    for (var i = 0; i < arr.length; i++) {
        if (fn(arr[i])) ret.push(arr[i])
    }
    return ret
}

function isTruthy(value) {
    return !!value
}

},{"indexof":21}],10:[function(require,module,exports){
/*
 * classList.js: Cross-browser full element.classList implementation.
 * 2014-07-23
 *
 * By Eli Grey, http://eligrey.com
 * Public Domain.
 * NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.
 */

/*global self, document, DOMException */

/*! @source http://purl.eligrey.com/github/classList.js/blob/master/classList.js*/

/* Copied from MDN:
 * https://developer.mozilla.org/en-US/docs/Web/API/Element/classList
 */

if ("document" in window.self) {

  // Full polyfill for browsers with no classList support
  // Including IE < Edge missing SVGElement.classList
  if (!("classList" in document.createElement("_"))
    || document.createElementNS && !("classList" in document.createElementNS("http://www.w3.org/2000/svg","g"))) {

  (function (view) {

    "use strict";

    if (!('Element' in view)) return;

    var
        classListProp = "classList"
      , protoProp = "prototype"
      , elemCtrProto = view.Element[protoProp]
      , objCtr = Object
      , strTrim = String[protoProp].trim || function () {
        return this.replace(/^\s+|\s+$/g, "");
      }
      , arrIndexOf = Array[protoProp].indexOf || function (item) {
        var
            i = 0
          , len = this.length
        ;
        for (; i < len; i++) {
          if (i in this && this[i] === item) {
            return i;
          }
        }
        return -1;
      }
      // Vendors: please allow content code to instantiate DOMExceptions
      , DOMEx = function (type, message) {
        this.name = type;
        this.code = DOMException[type];
        this.message = message;
      }
      , checkTokenAndGetIndex = function (classList, token) {
        if (token === "") {
          throw new DOMEx(
              "SYNTAX_ERR"
            , "An invalid or illegal string was specified"
          );
        }
        if (/\s/.test(token)) {
          throw new DOMEx(
              "INVALID_CHARACTER_ERR"
            , "String contains an invalid character"
          );
        }
        return arrIndexOf.call(classList, token);
      }
      , ClassList = function (elem) {
        var
            trimmedClasses = strTrim.call(elem.getAttribute("class") || "")
          , classes = trimmedClasses ? trimmedClasses.split(/\s+/) : []
          , i = 0
          , len = classes.length
        ;
        for (; i < len; i++) {
          this.push(classes[i]);
        }
        this._updateClassName = function () {
          elem.setAttribute("class", this.toString());
        };
      }
      , classListProto = ClassList[protoProp] = []
      , classListGetter = function () {
        return new ClassList(this);
      }
    ;
    // Most DOMException implementations don't allow calling DOMException's toString()
    // on non-DOMExceptions. Error's toString() is sufficient here.
    DOMEx[protoProp] = Error[protoProp];
    classListProto.item = function (i) {
      return this[i] || null;
    };
    classListProto.contains = function (token) {
      token += "";
      return checkTokenAndGetIndex(this, token) !== -1;
    };
    classListProto.add = function () {
      var
          tokens = arguments
        , i = 0
        , l = tokens.length
        , token
        , updated = false
      ;
      do {
        token = tokens[i] + "";
        if (checkTokenAndGetIndex(this, token) === -1) {
          this.push(token);
          updated = true;
        }
      }
      while (++i < l);

      if (updated) {
        this._updateClassName();
      }
    };
    classListProto.remove = function () {
      var
          tokens = arguments
        , i = 0
        , l = tokens.length
        , token
        , updated = false
        , index
      ;
      do {
        token = tokens[i] + "";
        index = checkTokenAndGetIndex(this, token);
        while (index !== -1) {
          this.splice(index, 1);
          updated = true;
          index = checkTokenAndGetIndex(this, token);
        }
      }
      while (++i < l);

      if (updated) {
        this._updateClassName();
      }
    };
    classListProto.toggle = function (token, force) {
      token += "";

      var
          result = this.contains(token)
        , method = result ?
          force !== true && "remove"
        :
          force !== false && "add"
      ;

      if (method) {
        this[method](token);
      }

      if (force === true || force === false) {
        return force;
      } else {
        return !result;
      }
    };
    classListProto.toString = function () {
      return this.join(" ");
    };

    if (objCtr.defineProperty) {
      var classListPropDesc = {
          get: classListGetter
        , enumerable: true
        , configurable: true
      };
      try {
        objCtr.defineProperty(elemCtrProto, classListProp, classListPropDesc);
      } catch (ex) { // IE 8 doesn't support enumerable:true
        if (ex.number === -0x7FF5EC54) {
          classListPropDesc.enumerable = false;
          objCtr.defineProperty(elemCtrProto, classListProp, classListPropDesc);
        }
      }
    } else if (objCtr[protoProp].__defineGetter__) {
      elemCtrProto.__defineGetter__(classListProp, classListGetter);
    }

    }(window.self));

    } else {
    // There is full or partial native classList support, so just check if we need
    // to normalize the add/remove and toggle APIs.

    (function () {
      "use strict";

      var testElement = document.createElement("_");

      testElement.classList.add("c1", "c2");

      // Polyfill for IE 10/11 and Firefox <26, where classList.add and
      // classList.remove exist but support only one argument at a time.
      if (!testElement.classList.contains("c2")) {
        var createMethod = function(method) {
          var original = DOMTokenList.prototype[method];

          DOMTokenList.prototype[method] = function(token) {
            var i, len = arguments.length;

            for (i = 0; i < len; i++) {
              token = arguments[i];
              original.call(this, token);
            }
          };
        };
        createMethod('add');
        createMethod('remove');
      }

      testElement.classList.toggle("c3", false);

      // Polyfill for IE 10 and Firefox <24, where classList.toggle does not
      // support the second argument.
      if (testElement.classList.contains("c3")) {
        var _toggle = DOMTokenList.prototype.toggle;

        DOMTokenList.prototype.toggle = function(token, force) {
          if (1 in arguments && !this.contains(token) === !force) {
            return force;
          } else {
            return _toggle.call(this, token);
          }
        };

      }

      testElement = null;
    }());
  }
}

},{}],11:[function(require,module,exports){
/**
 * cuid.js
 * Collision-resistant UID generator for browsers and node.
 * Sequential for fast db lookups and recency sorting.
 * Safe for element IDs and server-side lookups.
 *
 * Extracted from CLCTR
 *
 * Copyright (c) Eric Elliott 2012
 * MIT License
 */

var fingerprint = require('./lib/fingerprint.js');
var pad = require('./lib/pad.js');
var getRandomValue = require('./lib/getRandomValue.js');

var c = 0,
  blockSize = 4,
  base = 36,
  discreteValues = Math.pow(base, blockSize);

function randomBlock () {
  return pad((getRandomValue() *
    discreteValues << 0)
    .toString(base), blockSize);
}

function safeCounter () {
  c = c < discreteValues ? c : 0;
  c++; // this is not subliminal
  return c - 1;
}

function cuid () {
  // Starting with a lowercase letter makes
  // it HTML element ID friendly.
  var letter = 'c', // hard-coded allows for sequential access

    // timestamp
    // warning: this exposes the exact date and time
    // that the uid was created.
    timestamp = (new Date().getTime()).toString(base),

    // Prevent same-machine collisions.
    counter = pad(safeCounter().toString(base), blockSize),

    // A few chars to generate distinct ids for different
    // clients (so different computers are far less
    // likely to generate the same id)
    print = fingerprint(),

    // Grab some more chars from Math.random()
    random = randomBlock() + randomBlock();

  return letter + timestamp + counter + print + random;
}

cuid.slug = function slug () {
  var date = new Date().getTime().toString(36),
    counter = safeCounter().toString(36).slice(-4),
    print = fingerprint().slice(0, 1) +
      fingerprint().slice(-1),
    random = randomBlock().slice(-2);

  return date.slice(-2) +
    counter + print + random;
};

cuid.isCuid = function isCuid (stringToCheck) {
  if (typeof stringToCheck !== 'string') return false;
  if (stringToCheck.startsWith('c')) return true;
  return false;
};

cuid.isSlug = function isSlug (stringToCheck) {
  if (typeof stringToCheck !== 'string') return false;
  var stringLength = stringToCheck.length;
  if (stringLength >= 7 && stringLength <= 10) return true;
  return false;
};

cuid.fingerprint = fingerprint;

module.exports = cuid;

},{"./lib/fingerprint.js":12,"./lib/getRandomValue.js":13,"./lib/pad.js":14}],12:[function(require,module,exports){
var pad = require('./pad.js');

var env = typeof window === 'object' ? window : self;
var globalCount = Object.keys(env).length;
var mimeTypesLength = navigator.mimeTypes ? navigator.mimeTypes.length : 0;
var clientId = pad((mimeTypesLength +
  navigator.userAgent.length).toString(36) +
  globalCount.toString(36), 4);

module.exports = function fingerprint () {
  return clientId;
};

},{"./pad.js":14}],13:[function(require,module,exports){

var getRandomValue;

var crypto = typeof window !== 'undefined' &&
  (window.crypto || window.msCrypto) ||
  typeof self !== 'undefined' &&
  self.crypto;

if (crypto) {
    var lim = Math.pow(2, 32) - 1;
    getRandomValue = function () {
        return Math.abs(crypto.getRandomValues(new Uint32Array(1))[0] / lim);
    };
} else {
    getRandomValue = Math.random;
}

module.exports = getRandomValue;

},{}],14:[function(require,module,exports){
module.exports = function pad (num, size) {
  var s = '000000000' + num;
  return s.substr(s.length - size);
};

},{}],15:[function(require,module,exports){

/**
 * Expose `parse`.
 */

module.exports = parse;

/**
 * Tests for browser support.
 */

var innerHTMLBug = false;
var bugTestDiv;
if (typeof document !== 'undefined') {
  bugTestDiv = document.createElement('div');
  // Setup
  bugTestDiv.innerHTML = '  <link/><table></table><a href="/a">a</a><input type="checkbox"/>';
  // Make sure that link elements get serialized correctly by innerHTML
  // This requires a wrapper element in IE
  innerHTMLBug = !bugTestDiv.getElementsByTagName('link').length;
  bugTestDiv = undefined;
}

/**
 * Wrap map from jquery.
 */

var map = {
  legend: [1, '<fieldset>', '</fieldset>'],
  tr: [2, '<table><tbody>', '</tbody></table>'],
  col: [2, '<table><tbody></tbody><colgroup>', '</colgroup></table>'],
  // for script/link/style tags to work in IE6-8, you have to wrap
  // in a div with a non-whitespace character in front, ha!
  _default: innerHTMLBug ? [1, 'X<div>', '</div>'] : [0, '', '']
};

map.td =
map.th = [3, '<table><tbody><tr>', '</tr></tbody></table>'];

map.option =
map.optgroup = [1, '<select multiple="multiple">', '</select>'];

map.thead =
map.tbody =
map.colgroup =
map.caption =
map.tfoot = [1, '<table>', '</table>'];

map.polyline =
map.ellipse =
map.polygon =
map.circle =
map.text =
map.line =
map.path =
map.rect =
map.g = [1, '<svg xmlns="http://www.w3.org/2000/svg" version="1.1">','</svg>'];

/**
 * Parse `html` and return a DOM Node instance, which could be a TextNode,
 * HTML DOM Node of some kind (<div> for example), or a DocumentFragment
 * instance, depending on the contents of the `html` string.
 *
 * @param {String} html - HTML string to "domify"
 * @param {Document} doc - The `document` instance to create the Node for
 * @return {DOMNode} the TextNode, DOM Node, or DocumentFragment instance
 * @api private
 */

function parse(html, doc) {
  if ('string' != typeof html) throw new TypeError('String expected');

  // default to the global `document` object
  if (!doc) doc = document;

  // tag name
  var m = /<([\w:]+)/.exec(html);
  if (!m) return doc.createTextNode(html);

  html = html.replace(/^\s+|\s+$/g, ''); // Remove leading/trailing whitespace

  var tag = m[1];

  // body support
  if (tag == 'body') {
    var el = doc.createElement('html');
    el.innerHTML = html;
    return el.removeChild(el.lastChild);
  }

  // wrap map
  var wrap = map[tag] || map._default;
  var depth = wrap[0];
  var prefix = wrap[1];
  var suffix = wrap[2];
  var el = doc.createElement('div');
  el.innerHTML = prefix + html + suffix;
  while (depth--) el = el.lastChild;

  // one element
  if (el.firstChild == el.lastChild) {
    return el.removeChild(el.firstChild);
  }

  // several elements
  var fragment = doc.createDocumentFragment();
  while (el.firstChild) {
    fragment.appendChild(el.removeChild(el.firstChild));
  }

  return fragment;
}

},{}],16:[function(require,module,exports){
module.exports = function (cb) {
    if (typeof Promise !== 'function') {
      var err = new Error('Device enumeration not supported.');
      err.kind = 'METHOD_NOT_AVAILABLE';
      if (cb) {
          console.warn('module now uses promise based api - callback is deprecated');
          return cb(err);
      }
      throw err;
    }

    return new Promise(function(resolve, reject) {
        var processDevices = function (devices) {
            var normalizedDevices = [];
            for (var i = 0; i < devices.length; i++) {
                var device = devices[i];
                //make chrome values match spec
                var kind = device.kind || null;
                if (kind && kind.toLowerCase() === 'audio') {
                    kind = 'audioinput';
                } else if (kind && kind.toLowerCase() === 'video') {
                    kind = 'videoinput';
                }
                normalizedDevices.push({
                    facing: device.facing || null,
                    deviceId: device.id || device.deviceId || null,
                    label: device.label || null,
                    kind: kind,
                    groupId: device.groupId || null
                });
            }
            resolve(normalizedDevices);
            if (cb) {
                console.warn('module now uses promise based api - callback is deprecated');
                cb(null, normalizedDevices);
            }
        };

        if (window.navigator && window.navigator.mediaDevices && window.navigator.mediaDevices.enumerateDevices) {
            window.navigator.mediaDevices.enumerateDevices().then(processDevices);
        } else if (window.MediaStreamTrack && window.MediaStreamTrack.getSources) {
            window.MediaStreamTrack.getSources(processDevices);
        } else {
            var err = new Error('Device enumeration not supported.');
            err.kind = 'METHOD_NOT_AVAILABLE';
            reject(err);
            if (cb) {
                console.warn('module now uses promise based api - callback is deprecated');
                cb(err);
            }
        }
    });
};

},{}],17:[function(require,module,exports){
/**
 * Code refactored from Mozilla Developer Network:
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign
 */

'use strict';

function assign(target, firstSource) {
  if (target === undefined || target === null) {
    throw new TypeError('Cannot convert first argument to object');
  }

  var to = Object(target);
  for (var i = 1; i < arguments.length; i++) {
    var nextSource = arguments[i];
    if (nextSource === undefined || nextSource === null) {
      continue;
    }

    var keysArray = Object.keys(Object(nextSource));
    for (var nextIndex = 0, len = keysArray.length; nextIndex < len; nextIndex++) {
      var nextKey = keysArray[nextIndex];
      var desc = Object.getOwnPropertyDescriptor(nextSource, nextKey);
      if (desc !== undefined && desc.enumerable) {
        to[nextKey] = nextSource[nextKey];
      }
    }
  }
  return to;
}

function polyfill() {
  if (!Object.assign) {
    Object.defineProperty(Object, 'assign', {
      enumerable: false,
      configurable: true,
      writable: true,
      value: assign
    });
  }
}

module.exports = {
  assign: assign,
  polyfill: polyfill
};

},{}],18:[function(require,module,exports){
// get successful control from form and assemble into object
// http://www.w3.org/TR/html401/interact/forms.html#h-17.13.2

// types which indicate a submit action and are not successful controls
// these will be ignored
var k_r_submitter = /^(?:submit|button|image|reset|file)$/i;

// node names which could be successful controls
var k_r_success_contrls = /^(?:input|select|textarea|keygen)/i;

// Matches bracket notation.
var brackets = /(\[[^\[\]]*\])/g;

// serializes form fields
// @param form MUST be an HTMLForm element
// @param options is an optional argument to configure the serialization. Default output
// with no options specified is a url encoded string
//    - hash: [true | false] Configure the output type. If true, the output will
//    be a js object.
//    - serializer: [function] Optional serializer function to override the default one.
//    The function takes 3 arguments (result, key, value) and should return new result
//    hash and url encoded str serializers are provided with this module
//    - disabled: [true | false]. If true serialize disabled fields.
//    - empty: [true | false]. If true serialize empty fields
function serialize(form, options) {
    if (typeof options != 'object') {
        options = { hash: !!options };
    }
    else if (options.hash === undefined) {
        options.hash = true;
    }

    var result = (options.hash) ? {} : '';
    var serializer = options.serializer || ((options.hash) ? hash_serializer : str_serialize);

    var elements = form && form.elements ? form.elements : [];

    //Object store each radio and set if it's empty or not
    var radio_store = Object.create(null);

    for (var i=0 ; i<elements.length ; ++i) {
        var element = elements[i];

        // ingore disabled fields
        if ((!options.disabled && element.disabled) || !element.name) {
            continue;
        }
        // ignore anyhting that is not considered a success field
        if (!k_r_success_contrls.test(element.nodeName) ||
            k_r_submitter.test(element.type)) {
            continue;
        }

        var key = element.name;
        var val = element.value;

        // we can't just use element.value for checkboxes cause some browsers lie to us
        // they say "on" for value when the box isn't checked
        if ((element.type === 'checkbox' || element.type === 'radio') && !element.checked) {
            val = undefined;
        }

        // If we want empty elements
        if (options.empty) {
            // for checkbox
            if (element.type === 'checkbox' && !element.checked) {
                val = '';
            }

            // for radio
            if (element.type === 'radio') {
                if (!radio_store[element.name] && !element.checked) {
                    radio_store[element.name] = false;
                }
                else if (element.checked) {
                    radio_store[element.name] = true;
                }
            }

            // if options empty is true, continue only if its radio
            if (!val && element.type == 'radio') {
                continue;
            }
        }
        else {
            // value-less fields are ignored unless options.empty is true
            if (!val) {
                continue;
            }
        }

        // multi select boxes
        if (element.type === 'select-multiple') {
            val = [];

            var selectOptions = element.options;
            var isSelectedOptions = false;
            for (var j=0 ; j<selectOptions.length ; ++j) {
                var option = selectOptions[j];
                var allowedEmpty = options.empty && !option.value;
                var hasValue = (option.value || allowedEmpty);
                if (option.selected && hasValue) {
                    isSelectedOptions = true;

                    // If using a hash serializer be sure to add the
                    // correct notation for an array in the multi-select
                    // context. Here the name attribute on the select element
                    // might be missing the trailing bracket pair. Both names
                    // "foo" and "foo[]" should be arrays.
                    if (options.hash && key.slice(key.length - 2) !== '[]') {
                        result = serializer(result, key + '[]', option.value);
                    }
                    else {
                        result = serializer(result, key, option.value);
                    }
                }
            }

            // Serialize if no selected options and options.empty is true
            if (!isSelectedOptions && options.empty) {
                result = serializer(result, key, '');
            }

            continue;
        }

        result = serializer(result, key, val);
    }

    // Check for all empty radio buttons and serialize them with key=""
    if (options.empty) {
        for (var key in radio_store) {
            if (!radio_store[key]) {
                result = serializer(result, key, '');
            }
        }
    }

    return result;
}

function parse_keys(string) {
    var keys = [];
    var prefix = /^([^\[\]]*)/;
    var children = new RegExp(brackets);
    var match = prefix.exec(string);

    if (match[1]) {
        keys.push(match[1]);
    }

    while ((match = children.exec(string)) !== null) {
        keys.push(match[1]);
    }

    return keys;
}

function hash_assign(result, keys, value) {
    if (keys.length === 0) {
        result = value;
        return result;
    }

    var key = keys.shift();
    var between = key.match(/^\[(.+?)\]$/);

    if (key === '[]') {
        result = result || [];

        if (Array.isArray(result)) {
            result.push(hash_assign(null, keys, value));
        }
        else {
            // This might be the result of bad name attributes like "[][foo]",
            // in this case the original `result` object will already be
            // assigned to an object literal. Rather than coerce the object to
            // an array, or cause an exception the attribute "_values" is
            // assigned as an array.
            result._values = result._values || [];
            result._values.push(hash_assign(null, keys, value));
        }

        return result;
    }

    // Key is an attribute name and can be assigned directly.
    if (!between) {
        result[key] = hash_assign(result[key], keys, value);
    }
    else {
        var string = between[1];
        // +var converts the variable into a number
        // better than parseInt because it doesn't truncate away trailing
        // letters and actually fails if whole thing is not a number
        var index = +string;

        // If the characters between the brackets is not a number it is an
        // attribute name and can be assigned directly.
        if (isNaN(index)) {
            result = result || {};
            result[string] = hash_assign(result[string], keys, value);
        }
        else {
            result = result || [];
            result[index] = hash_assign(result[index], keys, value);
        }
    }

    return result;
}

// Object/hash encoding serializer.
function hash_serializer(result, key, value) {
    var matches = key.match(brackets);

    // Has brackets? Use the recursive assignment function to walk the keys,
    // construct any missing objects in the result tree and make the assignment
    // at the end of the chain.
    if (matches) {
        var keys = parse_keys(key);
        hash_assign(result, keys, value);
    }
    else {
        // Non bracket notation can make assignments directly.
        var existing = result[key];

        // If the value has been assigned already (for instance when a radio and
        // a checkbox have the same name attribute) convert the previous value
        // into an array before pushing into it.
        //
        // NOTE: If this requirement were removed all hash creation and
        // assignment could go through `hash_assign`.
        if (existing) {
            if (!Array.isArray(existing)) {
                result[key] = [ existing ];
            }

            result[key].push(value);
        }
        else {
            result[key] = value;
        }
    }

    return result;
}

// urlform encoding serializer
function str_serialize(result, key, value) {
    // encode newlines as \r\n cause the html spec says so
    value = value.replace(/(\r)?\n/g, '\r\n');
    value = encodeURIComponent(value);

    // spaces should be '+' rather than '%20'.
    value = value.replace(/%20/g, '+');
    return result + (result ? '&' : '') + encodeURIComponent(key) + '=' + value;
}

module.exports = serialize;

},{}],19:[function(require,module,exports){
// getUserMedia helper by @HenrikJoreteg used for navigator.getUserMedia shim
var adapter = require('webrtc-adapter');

module.exports = function (constraints, cb) {
    var error;
    var haveOpts = arguments.length === 2;
    var defaultOpts = {video: true, audio: true};

    var denied = 'PermissionDeniedError';
    var altDenied = 'PERMISSION_DENIED';
    var notSatisfied = 'ConstraintNotSatisfiedError';

    // make constraints optional
    if (!haveOpts) {
        cb = constraints;
        constraints = defaultOpts;
    }

    // treat lack of browser support like an error
    if (typeof navigator === 'undefined' || !navigator.getUserMedia) {
        // throw proper error per spec
        error = new Error('MediaStreamError');
        error.name = 'NotSupportedError';

        // keep all callbacks async
        return setTimeout(function () {
            cb(error);
        }, 0);
    }

    // normalize error handling when no media types are requested
    if (!constraints.audio && !constraints.video) {
        error = new Error('MediaStreamError');
        error.name = 'NoMediaRequestedError';

        // keep all callbacks async
        return setTimeout(function () {
            cb(error);
        }, 0);
    }

    navigator.mediaDevices.getUserMedia(constraints)
    .then(function (stream) {
        cb(null, stream);
    }).catch(function (err) {
        var error;
        // coerce into an error object since FF gives us a string
        // there are only two valid names according to the spec
        // we coerce all non-denied to "constraint not satisfied".
        if (typeof err === 'string') {
            error = new Error('MediaStreamError');
            if (err === denied || err === altDenied) {
                error.name = denied;
            } else {
                error.name = notSatisfied;
            }
        } else {
            // if we get an error object make sure '.name' property is set
            // according to spec: http://dev.w3.org/2011/webrtc/editor/getusermedia.html#navigatorusermediaerror-and-navigatorusermediaerrorcallback
            error = err;
            if (!error.name) {
                // this is likely chrome which
                // sets a property called "ERROR_DENIED" on the error object
                // if so we make sure to set a name
                if (error[denied]) {
                    err.name = denied;
                } else {
                    err.name = notSatisfied;
                }
            }
        }

        cb(error);
    });
};

},{"webrtc-adapter":31}],20:[function(require,module,exports){
var split = require('browser-split')
var ClassList = require('class-list')

var w = typeof window === 'undefined' ? require('html-element') : window
var document = w.document
var Text = w.Text

function context () {

  var cleanupFuncs = []

  function h() {
    var args = [].slice.call(arguments), e = null
    function item (l) {
      var r
      function parseClass (string) {
        // Our minimal parser doesn’t understand escaping CSS special
        // characters like `#`. Don’t use them. More reading:
        // https://mathiasbynens.be/notes/css-escapes .

        var m = split(string, /([\.#]?[^\s#.]+)/)
        if(/^\.|#/.test(m[1]))
          e = document.createElement('div')
        forEach(m, function (v) {
          var s = v.substring(1,v.length)
          if(!v) return
          if(!e)
            e = document.createElement(v)
          else if (v[0] === '.')
            ClassList(e).add(s)
          else if (v[0] === '#')
            e.setAttribute('id', s)
        })
      }

      if(l == null)
        ;
      else if('string' === typeof l) {
        if(!e)
          parseClass(l)
        else
          e.appendChild(r = document.createTextNode(l))
      }
      else if('number' === typeof l
        || 'boolean' === typeof l
        || l instanceof Date
        || l instanceof RegExp ) {
          e.appendChild(r = document.createTextNode(l.toString()))
      }
      //there might be a better way to handle this...
      else if (isArray(l))
        forEach(l, item)
      else if(isNode(l))
        e.appendChild(r = l)
      else if(l instanceof Text)
        e.appendChild(r = l)
      else if ('object' === typeof l) {
        for (var k in l) {
          if('function' === typeof l[k]) {
            if(/^on\w+/.test(k)) {
              (function (k, l) { // capture k, l in the closure
                if (e.addEventListener){
                  e.addEventListener(k.substring(2), l[k], false)
                  cleanupFuncs.push(function(){
                    e.removeEventListener(k.substring(2), l[k], false)
                  })
                }else{
                  e.attachEvent(k, l[k])
                  cleanupFuncs.push(function(){
                    e.detachEvent(k, l[k])
                  })
                }
              })(k, l)
            } else {
              // observable
              e[k] = l[k]()
              cleanupFuncs.push(l[k](function (v) {
                e[k] = v
              }))
            }
          }
          else if(k === 'style') {
            if('string' === typeof l[k]) {
              e.style.cssText = l[k]
            }else{
              for (var s in l[k]) (function(s, v) {
                if('function' === typeof v) {
                  // observable
                  e.style.setProperty(s, v())
                  cleanupFuncs.push(v(function (val) {
                    e.style.setProperty(s, val)
                  }))
                } else
                  var match = l[k][s].match(/(.*)\W+!important\W*$/);
                  if (match) {
                    e.style.setProperty(s, match[1], 'important')
                  } else {
                    e.style.setProperty(s, l[k][s])
                  }
              })(s, l[k][s])
            }
          } else if(k === 'attrs') {
            for (var v in l[k]) {
              e.setAttribute(v, l[k][v])
            }
          }
          else if (k.substr(0, 5) === "data-") {
            e.setAttribute(k, l[k])
          } else {
            e[k] = l[k]
          }
        }
      } else if ('function' === typeof l) {
        //assume it's an observable!
        var v = l()
        e.appendChild(r = isNode(v) ? v : document.createTextNode(v))

        cleanupFuncs.push(l(function (v) {
          if(isNode(v) && r.parentElement)
            r.parentElement.replaceChild(v, r), r = v
          else
            r.textContent = v
        }))
      }

      return r
    }
    while(args.length)
      item(args.shift())

    return e
  }

  h.cleanup = function () {
    for (var i = 0; i < cleanupFuncs.length; i++){
      cleanupFuncs[i]()
    }
    cleanupFuncs.length = 0
  }

  return h
}

var h = module.exports = context()
h.context = context

function isNode (el) {
  return el && el.nodeName && el.nodeType
}

function forEach (arr, fn) {
  if (arr.forEach) return arr.forEach(fn)
  for (var i = 0; i < arr.length; i++) fn(arr[i], i)
}

function isArray (arr) {
  return Object.prototype.toString.call(arr) == '[object Array]'
}



},{"browser-split":7,"class-list":9,"html-element":1}],21:[function(require,module,exports){

var indexOf = [].indexOf;

module.exports = function(arr, obj){
  if (indexOf) return arr.indexOf(obj);
  for (var i = 0; i < arr.length; ++i) {
    if (arr[i] === obj) return i;
  }
  return -1;
};
},{}],22:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    if (superCtor) {
      ctor.super_ = superCtor
      ctor.prototype = Object.create(superCtor.prototype, {
        constructor: {
          value: ctor,
          enumerable: false,
          writable: true,
          configurable: true
        }
      })
    }
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    if (superCtor) {
      ctor.super_ = superCtor
      var TempCtor = function () {}
      TempCtor.prototype = superCtor.prototype
      ctor.prototype = new TempCtor()
      ctor.prototype.constructor = ctor
    }
  }
}

},{}],23:[function(require,module,exports){
(function (global){(function (){
/* interact.js 1.10.8 | https://interactjs.io/license */
!function(t){"object"==typeof exports&&"undefined"!=typeof module?module.exports=t():"function"==typeof define&&define.amd?define([],t):("undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this).interact=t()}((function(){var t={};Object.defineProperty(t,"__esModule",{value:!0}),t.default=void 0,t.default=function(t){return!(!t||!t.Window)&&t instanceof t.Window};var e={};Object.defineProperty(e,"__esModule",{value:!0}),e.init=i,e.getWindow=function(e){return(0,t.default)(e)?e:(e.ownerDocument||e).defaultView||r.window},e.window=e.realWindow=void 0;var n=void 0;e.realWindow=n;var r=void 0;function i(t){e.realWindow=n=t;var i=t.document.createTextNode("");i.ownerDocument!==t.document&&"function"==typeof t.wrap&&t.wrap(i)===i&&(t=t.wrap(t)),e.window=r=t}e.window=r,"undefined"!=typeof window&&window&&i(window);var o={};Object.defineProperty(o,"__esModule",{value:!0}),o.default=void 0;var a=function(t){return!!t&&"object"==typeof t},s=function(t){return"function"==typeof t},l={window:function(n){return n===e.window||(0,t.default)(n)},docFrag:function(t){return a(t)&&11===t.nodeType},object:a,func:s,number:function(t){return"number"==typeof t},bool:function(t){return"boolean"==typeof t},string:function(t){return"string"==typeof t},element:function(t){if(!t||"object"!=typeof t)return!1;var n=e.getWindow(t)||e.window;return/object|function/.test(typeof n.Element)?t instanceof n.Element:1===t.nodeType&&"string"==typeof t.nodeName},plainObject:function(t){return a(t)&&!!t.constructor&&/function Object\b/.test(t.constructor.toString())},array:function(t){return a(t)&&void 0!==t.length&&s(t.splice)}};o.default=l;var c={};function u(t){var e=t.interaction;if("drag"===e.prepared.name){var n=e.prepared.axis;"x"===n?(e.coords.cur.page.y=e.coords.start.page.y,e.coords.cur.client.y=e.coords.start.client.y,e.coords.velocity.client.y=0,e.coords.velocity.page.y=0):"y"===n&&(e.coords.cur.page.x=e.coords.start.page.x,e.coords.cur.client.x=e.coords.start.client.x,e.coords.velocity.client.x=0,e.coords.velocity.page.x=0)}}function d(t){var e=t.iEvent,n=t.interaction;if("drag"===n.prepared.name){var r=n.prepared.axis;if("x"===r||"y"===r){var i="x"===r?"y":"x";e.page[i]=n.coords.start.page[i],e.client[i]=n.coords.start.client[i],e.delta[i]=0}}}Object.defineProperty(c,"__esModule",{value:!0}),c.default=void 0;var f={id:"actions/drag",install:function(t){var e=t.actions,n=t.Interactable,r=t.defaults;n.prototype.draggable=f.draggable,e.map.drag=f,e.methodDict.drag="draggable",r.actions.drag=f.defaults},listeners:{"interactions:before-action-move":u,"interactions:action-resume":u,"interactions:action-move":d,"auto-start:check":function(t){var e=t.interaction,n=t.interactable,r=t.buttons,i=n.options.drag;if(i&&i.enabled&&(!e.pointerIsDown||!/mouse|pointer/.test(e.pointerType)||0!=(r&n.options.drag.mouseButtons)))return t.action={name:"drag",axis:"start"===i.lockAxis?i.startAxis:i.lockAxis},!1}},draggable:function(t){return o.default.object(t)?(this.options.drag.enabled=!1!==t.enabled,this.setPerAction("drag",t),this.setOnEvents("drag",t),/^(xy|x|y|start)$/.test(t.lockAxis)&&(this.options.drag.lockAxis=t.lockAxis),/^(xy|x|y)$/.test(t.startAxis)&&(this.options.drag.startAxis=t.startAxis),this):o.default.bool(t)?(this.options.drag.enabled=t,this):this.options.drag},beforeMove:u,move:d,defaults:{startAxis:"xy",lockAxis:"xy"},getCursor:function(){return"move"}},p=f;c.default=p;var v={};Object.defineProperty(v,"__esModule",{value:!0}),v.default=void 0;var h={init:function(t){var e=t;h.document=e.document,h.DocumentFragment=e.DocumentFragment||g,h.SVGElement=e.SVGElement||g,h.SVGSVGElement=e.SVGSVGElement||g,h.SVGElementInstance=e.SVGElementInstance||g,h.Element=e.Element||g,h.HTMLElement=e.HTMLElement||h.Element,h.Event=e.Event,h.Touch=e.Touch||g,h.PointerEvent=e.PointerEvent||e.MSPointerEvent},document:null,DocumentFragment:null,SVGElement:null,SVGSVGElement:null,SVGElementInstance:null,Element:null,HTMLElement:null,Event:null,Touch:null,PointerEvent:null};function g(){}var m=h;v.default=m;var y={};Object.defineProperty(y,"__esModule",{value:!0}),y.default=void 0;var b={init:function(t){var n=v.default.Element,r=e.window.navigator;b.supportsTouch="ontouchstart"in t||o.default.func(t.DocumentTouch)&&v.default.document instanceof t.DocumentTouch,b.supportsPointerEvent=!1!==r.pointerEnabled&&!!v.default.PointerEvent,b.isIOS=/iP(hone|od|ad)/.test(r.platform),b.isIOS7=/iP(hone|od|ad)/.test(r.platform)&&/OS 7[^\d]/.test(r.appVersion),b.isIe9=/MSIE 9/.test(r.userAgent),b.isOperaMobile="Opera"===r.appName&&b.supportsTouch&&/Presto/.test(r.userAgent),b.prefixedMatchesSelector="matches"in n.prototype?"matches":"webkitMatchesSelector"in n.prototype?"webkitMatchesSelector":"mozMatchesSelector"in n.prototype?"mozMatchesSelector":"oMatchesSelector"in n.prototype?"oMatchesSelector":"msMatchesSelector",b.pEventTypes=b.supportsPointerEvent?v.default.PointerEvent===t.MSPointerEvent?{up:"MSPointerUp",down:"MSPointerDown",over:"mouseover",out:"mouseout",move:"MSPointerMove",cancel:"MSPointerCancel"}:{up:"pointerup",down:"pointerdown",over:"pointerover",out:"pointerout",move:"pointermove",cancel:"pointercancel"}:null,b.wheelEvent="onmousewheel"in v.default.document?"mousewheel":"wheel"},supportsTouch:null,supportsPointerEvent:null,isIOS7:null,isIOS:null,isIe9:null,isOperaMobile:null,prefixedMatchesSelector:null,pEventTypes:null,wheelEvent:null},x=b;y.default=x;var w={};function _(t){var e=t.parentNode;if(o.default.docFrag(e)){for(;(e=e.host)&&o.default.docFrag(e););return e}return e}function P(t,n){return e.window!==e.realWindow&&(n=n.replace(/\/deep\//g," ")),t[y.default.prefixedMatchesSelector](n)}Object.defineProperty(w,"__esModule",{value:!0}),w.nodeContains=function(t,e){if(t.contains)return t.contains(e);for(;e;){if(e===t)return!0;e=e.parentNode}return!1},w.closest=function(t,e){for(;o.default.element(t);){if(P(t,e))return t;t=_(t)}return null},w.parentNode=_,w.matchesSelector=P,w.indexOfDeepestElement=function(t){for(var n,r=[],i=0;i<t.length;i++){var o=t[i],a=t[n];if(o&&i!==n)if(a){var s=E(o),l=E(a);if(s!==o.ownerDocument)if(l!==o.ownerDocument)if(s!==l){r=r.length?r:O(a);var c=void 0;if(a instanceof v.default.HTMLElement&&o instanceof v.default.SVGElement&&!(o instanceof v.default.SVGSVGElement)){if(o===l)continue;c=o.ownerSVGElement}else c=o;for(var u=O(c,a.ownerDocument),d=0;u[d]&&u[d]===r[d];)d++;var f=[u[d-1],u[d],r[d]];if(f[0])for(var p=f[0].lastChild;p;){if(p===f[1]){n=i,r=u;break}if(p===f[2])break;p=p.previousSibling}}else h=o,g=a,void 0,void 0,(parseInt(e.getWindow(h).getComputedStyle(h).zIndex,10)||0)>=(parseInt(e.getWindow(g).getComputedStyle(g).zIndex,10)||0)&&(n=i);else n=i}else n=i}var h,g;return n},w.matchesUpTo=function(t,e,n){for(;o.default.element(t);){if(P(t,e))return!0;if((t=_(t))===n)return P(t,e)}return!1},w.getActualElement=function(t){return t.correspondingUseElement||t},w.getScrollXY=M,w.getElementClientRect=S,w.getElementRect=function(t){var n=S(t);if(!y.default.isIOS7&&n){var r=M(e.getWindow(t));n.left+=r.x,n.right+=r.x,n.top+=r.y,n.bottom+=r.y}return n},w.getPath=function(t){for(var e=[];t;)e.push(t),t=_(t);return e},w.trySelector=function(t){return!!o.default.string(t)&&(v.default.document.querySelector(t),!0)};var E=function(t){return t.parentNode||t.host};function O(t,e){for(var n,r=[],i=t;(n=E(i))&&i!==e&&n!==i.ownerDocument;)r.unshift(i),i=n;return r}function M(t){return{x:(t=t||e.window).scrollX||t.document.documentElement.scrollLeft,y:t.scrollY||t.document.documentElement.scrollTop}}function S(t){var e=t instanceof v.default.SVGElement?t.getBoundingClientRect():t.getClientRects()[0];return e&&{left:e.left,right:e.right,top:e.top,bottom:e.bottom,width:e.width||e.right-e.left,height:e.height||e.bottom-e.top}}var T={};Object.defineProperty(T,"__esModule",{value:!0}),T.default=function(t,e){for(var n in e)t[n]=e[n];return t};var I={};function j(t,e,n){return"parent"===t?(0,w.parentNode)(n):"self"===t?e.getRect(n):(0,w.closest)(n,t)}Object.defineProperty(I,"__esModule",{value:!0}),I.getStringOptionResult=j,I.resolveRectLike=function(t,e,n,r){var i=t;return o.default.string(i)?i=j(i,e,n):o.default.func(i)&&(i=i.apply(void 0,r)),o.default.element(i)&&(i=(0,w.getElementRect)(i)),i},I.rectToXY=function(t){return t&&{x:"x"in t?t.x:t.left,y:"y"in t?t.y:t.top}},I.xywhToTlbr=function(t){return!t||"left"in t&&"top"in t||((t=(0,T.default)({},t)).left=t.x||0,t.top=t.y||0,t.right=t.right||t.left+t.width,t.bottom=t.bottom||t.top+t.height),t},I.tlbrToXywh=function(t){return!t||"x"in t&&"y"in t||((t=(0,T.default)({},t)).x=t.left||0,t.y=t.top||0,t.width=t.width||(t.right||0)-t.x,t.height=t.height||(t.bottom||0)-t.y),t},I.addEdges=function(t,e,n){t.left&&(e.left+=n.x),t.right&&(e.right+=n.x),t.top&&(e.top+=n.y),t.bottom&&(e.bottom+=n.y),e.width=e.right-e.left,e.height=e.bottom-e.top};var D={};Object.defineProperty(D,"__esModule",{value:!0}),D.default=function(t,e,n){var r=t.options[n],i=r&&r.origin||t.options.origin,o=(0,I.resolveRectLike)(i,t,e,[t&&e]);return(0,I.rectToXY)(o)||{x:0,y:0}};var z={};function A(t){return t.trim().split(/ +/)}Object.defineProperty(z,"__esModule",{value:!0}),z.default=function t(e,n,r){if(r=r||{},o.default.string(e)&&-1!==e.search(" ")&&(e=A(e)),o.default.array(e))return e.reduce((function(e,i){return(0,T.default)(e,t(i,n,r))}),r);if(o.default.object(e)&&(n=e,e=""),o.default.func(n))r[e]=r[e]||[],r[e].push(n);else if(o.default.array(n))for(var i=0;i<n.length;i++){var a;a=n[i],t(e,a,r)}else if(o.default.object(n))for(var s in n){var l=A(s).map((function(t){return""+e+t}));t(l,n[s],r)}return r};var C={};Object.defineProperty(C,"__esModule",{value:!0}),C.default=void 0,C.default=function(t,e){return Math.sqrt(t*t+e*e)};var R={};function k(t,e){for(var n in e){var r=k.prefixedPropREs,i=!1;for(var o in r)if(0===n.indexOf(o)&&r[o].test(n)){i=!0;break}i||"function"==typeof e[n]||(t[n]=e[n])}return t}Object.defineProperty(R,"__esModule",{value:!0}),R.default=void 0,k.prefixedPropREs={webkit:/(Movement[XY]|Radius[XY]|RotationAngle|Force)$/,moz:/(Pressure)$/};var F=k;R.default=F;var X={};function Y(t){return t instanceof v.default.Event||t instanceof v.default.Touch}function W(t,e,n){return t=t||"page",(n=n||{}).x=e[t+"X"],n.y=e[t+"Y"],n}function B(t,e){return e=e||{x:0,y:0},y.default.isOperaMobile&&Y(t)?(W("screen",t,e),e.x+=window.scrollX,e.y+=window.scrollY):W("page",t,e),e}function L(t,e){return e=e||{},y.default.isOperaMobile&&Y(t)?W("screen",t,e):W("client",t,e),e}function V(t){var e=[];return o.default.array(t)?(e[0]=t[0],e[1]=t[1]):"touchend"===t.type?1===t.touches.length?(e[0]=t.touches[0],e[1]=t.changedTouches[0]):0===t.touches.length&&(e[0]=t.changedTouches[0],e[1]=t.changedTouches[1]):(e[0]=t.touches[0],e[1]=t.touches[1]),e}function N(t){for(var e={pageX:0,pageY:0,clientX:0,clientY:0,screenX:0,screenY:0},n=0;n<t.length;n++){var r=t[n];for(var i in e)e[i]+=r[i]}for(var o in e)e[o]/=t.length;return e}Object.defineProperty(X,"__esModule",{value:!0}),X.copyCoords=function(t,e){t.page=t.page||{},t.page.x=e.page.x,t.page.y=e.page.y,t.client=t.client||{},t.client.x=e.client.x,t.client.y=e.client.y,t.timeStamp=e.timeStamp},X.setCoordDeltas=function(t,e,n){t.page.x=n.page.x-e.page.x,t.page.y=n.page.y-e.page.y,t.client.x=n.client.x-e.client.x,t.client.y=n.client.y-e.client.y,t.timeStamp=n.timeStamp-e.timeStamp},X.setCoordVelocity=function(t,e){var n=Math.max(e.timeStamp/1e3,.001);t.page.x=e.page.x/n,t.page.y=e.page.y/n,t.client.x=e.client.x/n,t.client.y=e.client.y/n,t.timeStamp=n},X.setZeroCoords=function(t){t.page.x=0,t.page.y=0,t.client.x=0,t.client.y=0},X.isNativePointer=Y,X.getXY=W,X.getPageXY=B,X.getClientXY=L,X.getPointerId=function(t){return o.default.number(t.pointerId)?t.pointerId:t.identifier},X.setCoords=function(t,e,n){var r=e.length>1?N(e):e[0];B(r,t.page),L(r,t.client),t.timeStamp=n},X.getTouchPair=V,X.pointerAverage=N,X.touchBBox=function(t){if(!t.length)return null;var e=V(t),n=Math.min(e[0].pageX,e[1].pageX),r=Math.min(e[0].pageY,e[1].pageY),i=Math.max(e[0].pageX,e[1].pageX),o=Math.max(e[0].pageY,e[1].pageY);return{x:n,y:r,left:n,top:r,right:i,bottom:o,width:i-n,height:o-r}},X.touchDistance=function(t,e){var n=e+"X",r=e+"Y",i=V(t),o=i[0][n]-i[1][n],a=i[0][r]-i[1][r];return(0,C.default)(o,a)},X.touchAngle=function(t,e){var n=e+"X",r=e+"Y",i=V(t),o=i[1][n]-i[0][n],a=i[1][r]-i[0][r];return 180*Math.atan2(a,o)/Math.PI},X.getPointerType=function(t){return o.default.string(t.pointerType)?t.pointerType:o.default.number(t.pointerType)?[void 0,void 0,"touch","pen","mouse"][t.pointerType]:/touch/.test(t.type||"")||t instanceof v.default.Touch?"touch":"mouse"},X.getEventTargets=function(t){var e=o.default.func(t.composedPath)?t.composedPath():t.path;return[w.getActualElement(e?e[0]:t.target),w.getActualElement(t.currentTarget)]},X.newCoords=function(){return{page:{x:0,y:0},client:{x:0,y:0},timeStamp:0}},X.coordsToEvent=function(t){return{coords:t,get page(){return this.coords.page},get client(){return this.coords.client},get timeStamp(){return this.coords.timeStamp},get pageX(){return this.coords.page.x},get pageY(){return this.coords.page.y},get clientX(){return this.coords.client.x},get clientY(){return this.coords.client.y},get pointerId(){return this.coords.pointerId},get target(){return this.coords.target},get type(){return this.coords.type},get pointerType(){return this.coords.pointerType},get buttons(){return this.coords.buttons},preventDefault:function(){}}},Object.defineProperty(X,"pointerExtend",{enumerable:!0,get:function(){return R.default}});var q={};function U(t,e,n){return e in t?Object.defineProperty(t,e,{value:n,enumerable:!0,configurable:!0,writable:!0}):t[e]=n,t}Object.defineProperty(q,"__esModule",{value:!0}),q.BaseEvent=void 0;var G=function(){function t(t){U(this,"type",void 0),U(this,"target",void 0),U(this,"currentTarget",void 0),U(this,"interactable",void 0),U(this,"_interaction",void 0),U(this,"timeStamp",void 0),U(this,"immediatePropagationStopped",!1),U(this,"propagationStopped",!1),this._interaction=t}var e=t.prototype;return e.preventDefault=function(){},e.stopPropagation=function(){this.propagationStopped=!0},e.stopImmediatePropagation=function(){this.immediatePropagationStopped=this.propagationStopped=!0},t}();q.BaseEvent=G,Object.defineProperty(G.prototype,"interaction",{get:function(){return this._interaction._proxy},set:function(){}});var H={};Object.defineProperty(H,"__esModule",{value:!0}),H.find=H.findIndex=H.from=H.merge=H.remove=H.contains=void 0,H.contains=function(t,e){return-1!==t.indexOf(e)},H.remove=function(t,e){return t.splice(t.indexOf(e),1)};var $=function(t,e){for(var n=0;n<e.length;n++){var r=e[n];t.push(r)}return t};H.merge=$,H.from=function(t){return $([],t)};var K=function(t,e){for(var n=0;n<t.length;n++)if(e(t[n],n,t))return n;return-1};H.findIndex=K,H.find=function(t,e){return t[K(t,e)]};var Z={};function J(t){if(void 0===t)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return t}function Q(t,e){return(Q=Object.setPrototypeOf||function(t,e){return t.__proto__=e,t})(t,e)}function tt(t,e,n){return e in t?Object.defineProperty(t,e,{value:n,enumerable:!0,configurable:!0,writable:!0}):t[e]=n,t}Object.defineProperty(Z,"__esModule",{value:!0}),Z.DropEvent=void 0;var et=function(t){var e,n;function r(e,n,r){var i;tt(J(i=t.call(this,n._interaction)||this),"target",void 0),tt(J(i),"dropzone",void 0),tt(J(i),"dragEvent",void 0),tt(J(i),"relatedTarget",void 0),tt(J(i),"draggable",void 0),tt(J(i),"timeStamp",void 0),tt(J(i),"propagationStopped",!1),tt(J(i),"immediatePropagationStopped",!1);var o="dragleave"===r?e.prev:e.cur,a=o.element,s=o.dropzone;return i.type=r,i.target=a,i.currentTarget=a,i.dropzone=s,i.dragEvent=n,i.relatedTarget=n.target,i.draggable=n.interactable,i.timeStamp=n.timeStamp,i}n=t,(e=r).prototype=Object.create(n.prototype),e.prototype.constructor=e,Q(e,n);var i=r.prototype;return i.reject=function(){var t=this,e=this._interaction.dropState;if("dropactivate"===this.type||this.dropzone&&e.cur.dropzone===this.dropzone&&e.cur.element===this.target)if(e.prev.dropzone=this.dropzone,e.prev.element=this.target,e.rejected=!0,e.events.enter=null,this.stopImmediatePropagation(),"dropactivate"===this.type){var n=e.activeDrops,i=H.findIndex(n,(function(e){var n=e.dropzone,r=e.element;return n===t.dropzone&&r===t.target}));e.activeDrops.splice(i,1);var o=new r(e,this.dragEvent,"dropdeactivate");o.dropzone=this.dropzone,o.target=this.target,this.dropzone.fire(o)}else this.dropzone.fire(new r(e,this.dragEvent,"dragleave"))},i.preventDefault=function(){},i.stopPropagation=function(){this.propagationStopped=!0},i.stopImmediatePropagation=function(){this.immediatePropagationStopped=this.propagationStopped=!0},r}(q.BaseEvent);Z.DropEvent=et;var nt={};function rt(t,e){for(var n=0;n<t.slice().length;n++){var r=t.slice()[n],i=r.dropzone,o=r.element;e.dropzone=i,e.target=o,i.fire(e),e.propagationStopped=e.immediatePropagationStopped=!1}}function it(t,e){for(var n=function(t,e){for(var n=t.interactables,r=[],i=0;i<n.list.length;i++){var a=n.list[i];if(a.options.drop.enabled){var s=a.options.drop.accept;if(!(o.default.element(s)&&s!==e||o.default.string(s)&&!w.matchesSelector(e,s)||o.default.func(s)&&!s({dropzone:a,draggableElement:e})))for(var l=o.default.string(a.target)?a._context.querySelectorAll(a.target):o.default.array(a.target)?a.target:[a.target],c=0;c<l.length;c++){var u=l[c];u!==e&&r.push({dropzone:a,element:u,rect:a.getRect(u)})}}}return r}(t,e),r=0;r<n.length;r++){var i=n[r];i.rect=i.dropzone.getRect(i.element)}return n}function ot(t,e,n){for(var r=t.dropState,i=t.interactable,o=t.element,a=[],s=0;s<r.activeDrops.length;s++){var l=r.activeDrops[s],c=l.dropzone,u=l.element,d=l.rect;a.push(c.dropCheck(e,n,i,o,u,d)?u:null)}var f=w.indexOfDeepestElement(a);return r.activeDrops[f]||null}function at(t,e,n){var r=t.dropState,i={enter:null,leave:null,activate:null,deactivate:null,move:null,drop:null};return"dragstart"===n.type&&(i.activate=new Z.DropEvent(r,n,"dropactivate"),i.activate.target=null,i.activate.dropzone=null),"dragend"===n.type&&(i.deactivate=new Z.DropEvent(r,n,"dropdeactivate"),i.deactivate.target=null,i.deactivate.dropzone=null),r.rejected||(r.cur.element!==r.prev.element&&(r.prev.dropzone&&(i.leave=new Z.DropEvent(r,n,"dragleave"),n.dragLeave=i.leave.target=r.prev.element,n.prevDropzone=i.leave.dropzone=r.prev.dropzone),r.cur.dropzone&&(i.enter=new Z.DropEvent(r,n,"dragenter"),n.dragEnter=r.cur.element,n.dropzone=r.cur.dropzone)),"dragend"===n.type&&r.cur.dropzone&&(i.drop=new Z.DropEvent(r,n,"drop"),n.dropzone=r.cur.dropzone,n.relatedTarget=r.cur.element),"dragmove"===n.type&&r.cur.dropzone&&(i.move=new Z.DropEvent(r,n,"dropmove"),i.move.dragmove=n,n.dropzone=r.cur.dropzone)),i}function st(t,e){var n=t.dropState,r=n.activeDrops,i=n.cur,o=n.prev;e.leave&&o.dropzone.fire(e.leave),e.enter&&i.dropzone.fire(e.enter),e.move&&i.dropzone.fire(e.move),e.drop&&i.dropzone.fire(e.drop),e.deactivate&&rt(r,e.deactivate),n.prev.dropzone=i.dropzone,n.prev.element=i.element}function lt(t,e){var n=t.interaction,r=t.iEvent,i=t.event;if("dragmove"===r.type||"dragend"===r.type){var o=n.dropState;e.dynamicDrop&&(o.activeDrops=it(e,n.element));var a=r,s=ot(n,a,i);o.rejected=o.rejected&&!!s&&s.dropzone===o.cur.dropzone&&s.element===o.cur.element,o.cur.dropzone=s&&s.dropzone,o.cur.element=s&&s.element,o.events=at(n,0,a)}}Object.defineProperty(nt,"__esModule",{value:!0}),nt.default=void 0;var ct={id:"actions/drop",install:function(t){var e=t.actions,n=t.interactStatic,r=t.Interactable,i=t.defaults;t.usePlugin(c.default),r.prototype.dropzone=function(t){return function(t,e){if(o.default.object(e)){if(t.options.drop.enabled=!1!==e.enabled,e.listeners){var n=(0,z.default)(e.listeners),r=Object.keys(n).reduce((function(t,e){return t[/^(enter|leave)/.test(e)?"drag"+e:/^(activate|deactivate|move)/.test(e)?"drop"+e:e]=n[e],t}),{});t.off(t.options.drop.listeners),t.on(r),t.options.drop.listeners=r}return o.default.func(e.ondrop)&&t.on("drop",e.ondrop),o.default.func(e.ondropactivate)&&t.on("dropactivate",e.ondropactivate),o.default.func(e.ondropdeactivate)&&t.on("dropdeactivate",e.ondropdeactivate),o.default.func(e.ondragenter)&&t.on("dragenter",e.ondragenter),o.default.func(e.ondragleave)&&t.on("dragleave",e.ondragleave),o.default.func(e.ondropmove)&&t.on("dropmove",e.ondropmove),/^(pointer|center)$/.test(e.overlap)?t.options.drop.overlap=e.overlap:o.default.number(e.overlap)&&(t.options.drop.overlap=Math.max(Math.min(1,e.overlap),0)),"accept"in e&&(t.options.drop.accept=e.accept),"checker"in e&&(t.options.drop.checker=e.checker),t}return o.default.bool(e)?(t.options.drop.enabled=e,t):t.options.drop}(this,t)},r.prototype.dropCheck=function(t,e,n,r,i,a){return function(t,e,n,r,i,a,s){var l=!1;if(!(s=s||t.getRect(a)))return!!t.options.drop.checker&&t.options.drop.checker(e,n,l,t,a,r,i);var c=t.options.drop.overlap;if("pointer"===c){var u=(0,D.default)(r,i,"drag"),d=X.getPageXY(e);d.x+=u.x,d.y+=u.y;var f=d.x>s.left&&d.x<s.right,p=d.y>s.top&&d.y<s.bottom;l=f&&p}var v=r.getRect(i);if(v&&"center"===c){var h=v.left+v.width/2,g=v.top+v.height/2;l=h>=s.left&&h<=s.right&&g>=s.top&&g<=s.bottom}return v&&o.default.number(c)&&(l=Math.max(0,Math.min(s.right,v.right)-Math.max(s.left,v.left))*Math.max(0,Math.min(s.bottom,v.bottom)-Math.max(s.top,v.top))/(v.width*v.height)>=c),t.options.drop.checker&&(l=t.options.drop.checker(e,n,l,t,a,r,i)),l}(this,t,e,n,r,i,a)},n.dynamicDrop=function(e){return o.default.bool(e)?(t.dynamicDrop=e,n):t.dynamicDrop},(0,T.default)(e.phaselessTypes,{dragenter:!0,dragleave:!0,dropactivate:!0,dropdeactivate:!0,dropmove:!0,drop:!0}),e.methodDict.drop="dropzone",t.dynamicDrop=!1,i.actions.drop=ct.defaults},listeners:{"interactions:before-action-start":function(t){var e=t.interaction;"drag"===e.prepared.name&&(e.dropState={cur:{dropzone:null,element:null},prev:{dropzone:null,element:null},rejected:null,events:null,activeDrops:[]})},"interactions:after-action-start":function(t,e){var n=t.interaction,r=(t.event,t.iEvent);if("drag"===n.prepared.name){var i=n.dropState;i.activeDrops=null,i.events=null,i.activeDrops=it(e,n.element),i.events=at(n,0,r),i.events.activate&&(rt(i.activeDrops,i.events.activate),e.fire("actions/drop:start",{interaction:n,dragEvent:r}))}},"interactions:action-move":lt,"interactions:after-action-move":function(t,e){var n=t.interaction,r=t.iEvent;"drag"===n.prepared.name&&(st(n,n.dropState.events),e.fire("actions/drop:move",{interaction:n,dragEvent:r}),n.dropState.events={})},"interactions:action-end":function(t,e){if("drag"===t.interaction.prepared.name){var n=t.interaction,r=t.iEvent;lt(t,e),st(n,n.dropState.events),e.fire("actions/drop:end",{interaction:n,dragEvent:r})}},"interactions:stop":function(t){var e=t.interaction;if("drag"===e.prepared.name){var n=e.dropState;n&&(n.activeDrops=null,n.events=null,n.cur.dropzone=null,n.cur.element=null,n.prev.dropzone=null,n.prev.element=null,n.rejected=!1)}}},getActiveDrops:it,getDrop:ot,getDropEvents:at,fireDropEvents:st,defaults:{enabled:!1,accept:null,overlap:"pointer"}},ut=ct;nt.default=ut;var dt={};function ft(t){var e=t.interaction,n=t.iEvent,r=t.phase;if("gesture"===e.prepared.name){var i=e.pointers.map((function(t){return t.pointer})),a="start"===r,s="end"===r,l=e.interactable.options.deltaSource;if(n.touches=[i[0],i[1]],a)n.distance=X.touchDistance(i,l),n.box=X.touchBBox(i),n.scale=1,n.ds=0,n.angle=X.touchAngle(i,l),n.da=0,e.gesture.startDistance=n.distance,e.gesture.startAngle=n.angle;else if(s){var c=e.prevEvent;n.distance=c.distance,n.box=c.box,n.scale=c.scale,n.ds=0,n.angle=c.angle,n.da=0}else n.distance=X.touchDistance(i,l),n.box=X.touchBBox(i),n.scale=n.distance/e.gesture.startDistance,n.angle=X.touchAngle(i,l),n.ds=n.scale-e.gesture.scale,n.da=n.angle-e.gesture.angle;e.gesture.distance=n.distance,e.gesture.angle=n.angle,o.default.number(n.scale)&&n.scale!==1/0&&!isNaN(n.scale)&&(e.gesture.scale=n.scale)}}Object.defineProperty(dt,"__esModule",{value:!0}),dt.default=void 0;var pt={id:"actions/gesture",before:["actions/drag","actions/resize"],install:function(t){var e=t.actions,n=t.Interactable,r=t.defaults;n.prototype.gesturable=function(t){return o.default.object(t)?(this.options.gesture.enabled=!1!==t.enabled,this.setPerAction("gesture",t),this.setOnEvents("gesture",t),this):o.default.bool(t)?(this.options.gesture.enabled=t,this):this.options.gesture},e.map.gesture=pt,e.methodDict.gesture="gesturable",r.actions.gesture=pt.defaults},listeners:{"interactions:action-start":ft,"interactions:action-move":ft,"interactions:action-end":ft,"interactions:new":function(t){t.interaction.gesture={angle:0,distance:0,scale:1,startAngle:0,startDistance:0}},"auto-start:check":function(t){if(!(t.interaction.pointers.length<2)){var e=t.interactable.options.gesture;if(e&&e.enabled)return t.action={name:"gesture"},!1}}},defaults:{},getCursor:function(){return""}},vt=pt;dt.default=vt;var ht={};function gt(t,e,n,r,i,a,s){if(!e)return!1;if(!0===e){var l=o.default.number(a.width)?a.width:a.right-a.left,c=o.default.number(a.height)?a.height:a.bottom-a.top;if(s=Math.min(s,Math.abs(("left"===t||"right"===t?l:c)/2)),l<0&&("left"===t?t="right":"right"===t&&(t="left")),c<0&&("top"===t?t="bottom":"bottom"===t&&(t="top")),"left"===t)return n.x<(l>=0?a.left:a.right)+s;if("top"===t)return n.y<(c>=0?a.top:a.bottom)+s;if("right"===t)return n.x>(l>=0?a.right:a.left)-s;if("bottom"===t)return n.y>(c>=0?a.bottom:a.top)-s}return!!o.default.element(r)&&(o.default.element(e)?e===r:w.matchesUpTo(r,e,i))}function mt(t){var e=t.iEvent,n=t.interaction;if("resize"===n.prepared.name&&n.resizeAxes){var r=e;n.interactable.options.resize.square?("y"===n.resizeAxes?r.delta.x=r.delta.y:r.delta.y=r.delta.x,r.axes="xy"):(r.axes=n.resizeAxes,"x"===n.resizeAxes?r.delta.y=0:"y"===n.resizeAxes&&(r.delta.x=0))}}Object.defineProperty(ht,"__esModule",{value:!0}),ht.default=void 0;var yt={id:"actions/resize",before:["actions/drag"],install:function(t){var e=t.actions,n=t.browser,r=t.Interactable,i=t.defaults;yt.cursors=function(t){return t.isIe9?{x:"e-resize",y:"s-resize",xy:"se-resize",top:"n-resize",left:"w-resize",bottom:"s-resize",right:"e-resize",topleft:"se-resize",bottomright:"se-resize",topright:"ne-resize",bottomleft:"ne-resize"}:{x:"ew-resize",y:"ns-resize",xy:"nwse-resize",top:"ns-resize",left:"ew-resize",bottom:"ns-resize",right:"ew-resize",topleft:"nwse-resize",bottomright:"nwse-resize",topright:"nesw-resize",bottomleft:"nesw-resize"}}(n),yt.defaultMargin=n.supportsTouch||n.supportsPointerEvent?20:10,r.prototype.resizable=function(e){return function(t,e,n){return o.default.object(e)?(t.options.resize.enabled=!1!==e.enabled,t.setPerAction("resize",e),t.setOnEvents("resize",e),o.default.string(e.axis)&&/^x$|^y$|^xy$/.test(e.axis)?t.options.resize.axis=e.axis:null===e.axis&&(t.options.resize.axis=n.defaults.actions.resize.axis),o.default.bool(e.preserveAspectRatio)?t.options.resize.preserveAspectRatio=e.preserveAspectRatio:o.default.bool(e.square)&&(t.options.resize.square=e.square),t):o.default.bool(e)?(t.options.resize.enabled=e,t):t.options.resize}(this,e,t)},e.map.resize=yt,e.methodDict.resize="resizable",i.actions.resize=yt.defaults},listeners:{"interactions:new":function(t){t.interaction.resizeAxes="xy"},"interactions:action-start":function(t){!function(t){var e=t.iEvent,n=t.interaction;if("resize"===n.prepared.name&&n.prepared.edges){var r=e,i=n.rect;n._rects={start:(0,T.default)({},i),corrected:(0,T.default)({},i),previous:(0,T.default)({},i),delta:{left:0,right:0,width:0,top:0,bottom:0,height:0}},r.edges=n.prepared.edges,r.rect=n._rects.corrected,r.deltaRect=n._rects.delta}}(t),mt(t)},"interactions:action-move":function(t){!function(t){var e=t.iEvent,n=t.interaction;if("resize"===n.prepared.name&&n.prepared.edges){var r=e,i=n.interactable.options.resize.invert,o="reposition"===i||"negate"===i,a=n.rect,s=n._rects,l=s.start,c=s.corrected,u=s.delta,d=s.previous;if((0,T.default)(d,c),o){if((0,T.default)(c,a),"reposition"===i){if(c.top>c.bottom){var f=c.top;c.top=c.bottom,c.bottom=f}if(c.left>c.right){var p=c.left;c.left=c.right,c.right=p}}}else c.top=Math.min(a.top,l.bottom),c.bottom=Math.max(a.bottom,l.top),c.left=Math.min(a.left,l.right),c.right=Math.max(a.right,l.left);for(var v in c.width=c.right-c.left,c.height=c.bottom-c.top,c)u[v]=c[v]-d[v];r.edges=n.prepared.edges,r.rect=c,r.deltaRect=u}}(t),mt(t)},"interactions:action-end":function(t){var e=t.iEvent,n=t.interaction;if("resize"===n.prepared.name&&n.prepared.edges){var r=e;r.edges=n.prepared.edges,r.rect=n._rects.corrected,r.deltaRect=n._rects.delta}},"auto-start:check":function(t){var e=t.interaction,n=t.interactable,r=t.element,i=t.rect,a=t.buttons;if(i){var s=(0,T.default)({},e.coords.cur.page),l=n.options.resize;if(l&&l.enabled&&(!e.pointerIsDown||!/mouse|pointer/.test(e.pointerType)||0!=(a&l.mouseButtons))){if(o.default.object(l.edges)){var c={left:!1,right:!1,top:!1,bottom:!1};for(var u in c)c[u]=gt(u,l.edges[u],s,e._latestPointer.eventTarget,r,i,l.margin||yt.defaultMargin);c.left=c.left&&!c.right,c.top=c.top&&!c.bottom,(c.left||c.right||c.top||c.bottom)&&(t.action={name:"resize",edges:c})}else{var d="y"!==l.axis&&s.x>i.right-yt.defaultMargin,f="x"!==l.axis&&s.y>i.bottom-yt.defaultMargin;(d||f)&&(t.action={name:"resize",axes:(d?"x":"")+(f?"y":"")})}return!t.action&&void 0}}}},defaults:{square:!1,preserveAspectRatio:!1,axis:"xy",margin:NaN,edges:null,invert:"none"},cursors:null,getCursor:function(t){var e=t.edges,n=t.axis,r=t.name,i=yt.cursors,o=null;if(n)o=i[r+n];else if(e){for(var a="",s=["top","bottom","left","right"],l=0;l<s.length;l++){var c=s[l];e[c]&&(a+=c)}o=i[a]}return o},defaultMargin:null},bt=yt;ht.default=bt;var xt={};Object.defineProperty(xt,"__esModule",{value:!0}),xt.default=void 0;var wt={id:"actions",install:function(t){t.usePlugin(dt.default),t.usePlugin(ht.default),t.usePlugin(c.default),t.usePlugin(nt.default)}};xt.default=wt;var _t={};Object.defineProperty(_t,"__esModule",{value:!0}),_t.default=void 0;var Pt,Et,Ot=0,Mt={request:function(t){return Pt(t)},cancel:function(t){return Et(t)},init:function(t){if(Pt=t.requestAnimationFrame,Et=t.cancelAnimationFrame,!Pt)for(var e=["ms","moz","webkit","o"],n=0;n<e.length;n++){var r=e[n];Pt=t[r+"RequestAnimationFrame"],Et=t[r+"CancelAnimationFrame"]||t[r+"CancelRequestAnimationFrame"]}Pt=Pt&&Pt.bind(t),Et=Et&&Et.bind(t),Pt||(Pt=function(e){var n=Date.now(),r=Math.max(0,16-(n-Ot)),i=t.setTimeout((function(){e(n+r)}),r);return Ot=n+r,i},Et=function(t){return clearTimeout(t)})}};_t.default=Mt;var St={};Object.defineProperty(St,"__esModule",{value:!0}),St.getContainer=It,St.getScroll=jt,St.getScrollSize=function(t){return o.default.window(t)&&(t=window.document.body),{x:t.scrollWidth,y:t.scrollHeight}},St.getScrollSizeDelta=function(t,e){var n=t.interaction,r=t.element,i=n&&n.interactable.options[n.prepared.name].autoScroll;if(!i||!i.enabled)return e(),{x:0,y:0};var o=It(i.container,n.interactable,r),a=jt(o);e();var s=jt(o);return{x:s.x-a.x,y:s.y-a.y}},St.default=void 0;var Tt={defaults:{enabled:!1,margin:60,container:null,speed:300},now:Date.now,interaction:null,i:0,x:0,y:0,isScrolling:!1,prevTime:0,margin:0,speed:0,start:function(t){Tt.isScrolling=!0,_t.default.cancel(Tt.i),t.autoScroll=Tt,Tt.interaction=t,Tt.prevTime=Tt.now(),Tt.i=_t.default.request(Tt.scroll)},stop:function(){Tt.isScrolling=!1,Tt.interaction&&(Tt.interaction.autoScroll=null),_t.default.cancel(Tt.i)},scroll:function(){var t=Tt.interaction,e=t.interactable,n=t.element,r=t.prepared.name,i=e.options[r].autoScroll,a=It(i.container,e,n),s=Tt.now(),l=(s-Tt.prevTime)/1e3,c=i.speed*l;if(c>=1){var u={x:Tt.x*c,y:Tt.y*c};if(u.x||u.y){var d=jt(a);o.default.window(a)?a.scrollBy(u.x,u.y):a&&(a.scrollLeft+=u.x,a.scrollTop+=u.y);var f=jt(a),p={x:f.x-d.x,y:f.y-d.y};(p.x||p.y)&&e.fire({type:"autoscroll",target:n,interactable:e,delta:p,interaction:t,container:a})}Tt.prevTime=s}Tt.isScrolling&&(_t.default.cancel(Tt.i),Tt.i=_t.default.request(Tt.scroll))},check:function(t,e){var n;return null==(n=t.options[e].autoScroll)?void 0:n.enabled},onInteractionMove:function(t){var e=t.interaction,n=t.pointer;if(e.interacting()&&Tt.check(e.interactable,e.prepared.name))if(e.simulation)Tt.x=Tt.y=0;else{var r,i,a,s,l=e.interactable,c=e.element,u=e.prepared.name,d=l.options[u].autoScroll,f=It(d.container,l,c);if(o.default.window(f))s=n.clientX<Tt.margin,r=n.clientY<Tt.margin,i=n.clientX>f.innerWidth-Tt.margin,a=n.clientY>f.innerHeight-Tt.margin;else{var p=w.getElementClientRect(f);s=n.clientX<p.left+Tt.margin,r=n.clientY<p.top+Tt.margin,i=n.clientX>p.right-Tt.margin,a=n.clientY>p.bottom-Tt.margin}Tt.x=i?1:s?-1:0,Tt.y=a?1:r?-1:0,Tt.isScrolling||(Tt.margin=d.margin,Tt.speed=d.speed,Tt.start(e))}}};function It(t,n,r){return(o.default.string(t)?(0,I.getStringOptionResult)(t,n,r):t)||(0,e.getWindow)(r)}function jt(t){return o.default.window(t)&&(t=window.document.body),{x:t.scrollLeft,y:t.scrollTop}}var Dt={id:"auto-scroll",install:function(t){var e=t.defaults,n=t.actions;t.autoScroll=Tt,Tt.now=function(){return t.now()},n.phaselessTypes.autoscroll=!0,e.perAction.autoScroll=Tt.defaults},listeners:{"interactions:new":function(t){t.interaction.autoScroll=null},"interactions:destroy":function(t){t.interaction.autoScroll=null,Tt.stop(),Tt.interaction&&(Tt.interaction=null)},"interactions:stop":Tt.stop,"interactions:action-move":function(t){return Tt.onInteractionMove(t)}}};St.default=Dt;var zt={};Object.defineProperty(zt,"__esModule",{value:!0}),zt.warnOnce=function(t,n){var r=!1;return function(){return r||(e.window.console.warn(n),r=!0),t.apply(this,arguments)}},zt.copyAction=function(t,e){return t.name=e.name,t.axis=e.axis,t.edges=e.edges,t},zt.sign=void 0,zt.sign=function(t){return t>=0?1:-1};var At={};function Ct(t){return o.default.bool(t)?(this.options.styleCursor=t,this):null===t?(delete this.options.styleCursor,this):this.options.styleCursor}function Rt(t){return o.default.func(t)?(this.options.actionChecker=t,this):null===t?(delete this.options.actionChecker,this):this.options.actionChecker}Object.defineProperty(At,"__esModule",{value:!0}),At.default=void 0;var kt={id:"auto-start/interactableMethods",install:function(t){var e=t.Interactable;e.prototype.getAction=function(e,n,r,i){var o=function(t,e,n,r,i){var o=t.getRect(r),a={action:null,interactable:t,interaction:n,element:r,rect:o,buttons:e.buttons||{0:1,1:4,3:8,4:16}[e.button]};return i.fire("auto-start:check",a),a.action}(this,n,r,i,t);return this.options.actionChecker?this.options.actionChecker(e,n,o,this,i,r):o},e.prototype.ignoreFrom=(0,zt.warnOnce)((function(t){return this._backCompatOption("ignoreFrom",t)}),"Interactable.ignoreFrom() has been deprecated. Use Interactble.draggable({ignoreFrom: newValue})."),e.prototype.allowFrom=(0,zt.warnOnce)((function(t){return this._backCompatOption("allowFrom",t)}),"Interactable.allowFrom() has been deprecated. Use Interactble.draggable({allowFrom: newValue})."),e.prototype.actionChecker=Rt,e.prototype.styleCursor=Ct}};At.default=kt;var Ft={};function Xt(t,e,n,r,i){return e.testIgnoreAllow(e.options[t.name],n,r)&&e.options[t.name].enabled&&Lt(e,n,t,i)?t:null}function Yt(t,e,n,r,i,o,a){for(var s=0,l=r.length;s<l;s++){var c=r[s],u=i[s],d=c.getAction(e,n,t,u);if(d){var f=Xt(d,c,u,o,a);if(f)return{action:f,interactable:c,element:u}}}return{action:null,interactable:null,element:null}}function Wt(t,e,n,r,i){var a=[],s=[],l=r;function c(t){a.push(t),s.push(l)}for(;o.default.element(l);){a=[],s=[],i.interactables.forEachMatch(l,c);var u=Yt(t,e,n,a,s,r,i);if(u.action&&!u.interactable.options[u.action.name].manualStart)return u;l=w.parentNode(l)}return{action:null,interactable:null,element:null}}function Bt(t,e,n){var r=e.action,i=e.interactable,o=e.element;r=r||{name:null},t.interactable=i,t.element=o,(0,zt.copyAction)(t.prepared,r),t.rect=i&&r.name?i.getRect(o):null,qt(t,n),n.fire("autoStart:prepared",{interaction:t})}function Lt(t,e,n,r){var i=t.options,o=i[n.name].max,a=i[n.name].maxPerElement,s=r.autoStart.maxInteractions,l=0,c=0,u=0;if(!(o&&a&&s))return!1;for(var d=0;d<r.interactions.list.length;d++){var f=r.interactions.list[d],p=f.prepared.name;if(f.interacting()){if(++l>=s)return!1;if(f.interactable===t){if((c+=p===n.name?1:0)>=o)return!1;if(f.element===e&&(u++,p===n.name&&u>=a))return!1}}}return s>0}function Vt(t,e){return o.default.number(t)?(e.autoStart.maxInteractions=t,this):e.autoStart.maxInteractions}function Nt(t,e,n){var r=n.autoStart.cursorElement;r&&r!==t&&(r.style.cursor=""),t.ownerDocument.documentElement.style.cursor=e,t.style.cursor=e,n.autoStart.cursorElement=e?t:null}function qt(t,e){var n=t.interactable,r=t.element,i=t.prepared;if("mouse"===t.pointerType&&n&&n.options.styleCursor){var a="";if(i.name){var s=n.options[i.name].cursorChecker;a=o.default.func(s)?s(i,n,r,t._interacting):e.actions.map[i.name].getCursor(i)}Nt(t.element,a||"",e)}else e.autoStart.cursorElement&&Nt(e.autoStart.cursorElement,"",e)}Object.defineProperty(Ft,"__esModule",{value:!0}),Ft.default=void 0;var Ut={id:"auto-start/base",before:["actions"],install:function(t){var e=t.interactStatic,n=t.defaults;t.usePlugin(At.default),n.base.actionChecker=null,n.base.styleCursor=!0,(0,T.default)(n.perAction,{manualStart:!1,max:1/0,maxPerElement:1,allowFrom:null,ignoreFrom:null,mouseButtons:1}),e.maxInteractions=function(e){return Vt(e,t)},t.autoStart={maxInteractions:1/0,withinInteractionLimit:Lt,cursorElement:null}},listeners:{"interactions:down":function(t,e){var n=t.interaction,r=t.pointer,i=t.event,o=t.eventTarget;n.interacting()||Bt(n,Wt(n,r,i,o,e),e)},"interactions:move":function(t,e){!function(t,e){var n=t.interaction,r=t.pointer,i=t.event,o=t.eventTarget;"mouse"!==n.pointerType||n.pointerIsDown||n.interacting()||Bt(n,Wt(n,r,i,o,e),e)}(t,e),function(t,e){var n=t.interaction;if(n.pointerIsDown&&!n.interacting()&&n.pointerWasMoved&&n.prepared.name){e.fire("autoStart:before-start",t);var r=n.interactable,i=n.prepared.name;i&&r&&(r.options[i].manualStart||!Lt(r,n.element,n.prepared,e)?n.stop():(n.start(n.prepared,r,n.element),qt(n,e)))}}(t,e)},"interactions:stop":function(t,e){var n=t.interaction,r=n.interactable;r&&r.options.styleCursor&&Nt(n.element,"",e)}},maxInteractions:Vt,withinInteractionLimit:Lt,validateAction:Xt};Ft.default=Ut;var Gt={};Object.defineProperty(Gt,"__esModule",{value:!0}),Gt.default=void 0;var Ht={id:"auto-start/dragAxis",listeners:{"autoStart:before-start":function(t,e){var n=t.interaction,r=t.eventTarget,i=t.dx,a=t.dy;if("drag"===n.prepared.name){var s=Math.abs(i),l=Math.abs(a),c=n.interactable.options.drag,u=c.startAxis,d=s>l?"x":s<l?"y":"xy";if(n.prepared.axis="start"===c.lockAxis?d[0]:c.lockAxis,"xy"!==d&&"xy"!==u&&u!==d){n.prepared.name=null;for(var f=r,p=function(t){if(t!==n.interactable){var i=n.interactable.options.drag;if(!i.manualStart&&t.testIgnoreAllow(i,f,r)){var o=t.getAction(n.downPointer,n.downEvent,n,f);if(o&&"drag"===o.name&&function(t,e){if(!e)return!1;var n=e.options.drag.startAxis;return"xy"===t||"xy"===n||n===t}(d,t)&&Ft.default.validateAction(o,t,f,r,e))return t}}};o.default.element(f);){var v=e.interactables.forEachMatch(f,p);if(v){n.prepared.name="drag",n.interactable=v,n.element=f;break}f=(0,w.parentNode)(f)}}}}}};Gt.default=Ht;var $t={};function Kt(t){var e=t.prepared&&t.prepared.name;if(!e)return null;var n=t.interactable.options;return n[e].hold||n[e].delay}Object.defineProperty($t,"__esModule",{value:!0}),$t.default=void 0;var Zt={id:"auto-start/hold",install:function(t){var e=t.defaults;t.usePlugin(Ft.default),e.perAction.hold=0,e.perAction.delay=0},listeners:{"interactions:new":function(t){t.interaction.autoStartHoldTimer=null},"autoStart:prepared":function(t){var e=t.interaction,n=Kt(e);n>0&&(e.autoStartHoldTimer=setTimeout((function(){e.start(e.prepared,e.interactable,e.element)}),n))},"interactions:move":function(t){var e=t.interaction,n=t.duplicate;e.autoStartHoldTimer&&e.pointerWasMoved&&!n&&(clearTimeout(e.autoStartHoldTimer),e.autoStartHoldTimer=null)},"autoStart:before-start":function(t){var e=t.interaction;Kt(e)>0&&(e.prepared.name=null)}},getHoldDuration:Kt};$t.default=Zt;var Jt={};Object.defineProperty(Jt,"__esModule",{value:!0}),Jt.default=void 0;var Qt={id:"auto-start",install:function(t){t.usePlugin(Ft.default),t.usePlugin($t.default),t.usePlugin(Gt.default)}};Jt.default=Qt;var te={};function ee(t){return/^(always|never|auto)$/.test(t)?(this.options.preventDefault=t,this):o.default.bool(t)?(this.options.preventDefault=t?"always":"never",this):this.options.preventDefault}function ne(t){var e=t.interaction,n=t.event;e.interactable&&e.interactable.checkAndPreventDefault(n)}function re(t){var n=t.Interactable;n.prototype.preventDefault=ee,n.prototype.checkAndPreventDefault=function(n){return function(t,n,r){var i=t.options.preventDefault;if("never"!==i)if("always"!==i){if(n.events.supportsPassive&&/^touch(start|move)$/.test(r.type)){var a=(0,e.getWindow)(r.target).document,s=n.getDocOptions(a);if(!s||!s.events||!1!==s.events.passive)return}/^(mouse|pointer|touch)*(down|start)/i.test(r.type)||o.default.element(r.target)&&(0,w.matchesSelector)(r.target,"input,select,textarea,[contenteditable=true],[contenteditable=true] *")||r.preventDefault()}else r.preventDefault()}(this,t,n)},t.interactions.docEvents.push({type:"dragstart",listener:function(e){for(var n=0;n<t.interactions.list.length;n++){var r=t.interactions.list[n];if(r.element&&(r.element===e.target||(0,w.nodeContains)(r.element,e.target)))return void r.interactable.checkAndPreventDefault(e)}}})}Object.defineProperty(te,"__esModule",{value:!0}),te.install=re,te.default=void 0;var ie={id:"core/interactablePreventDefault",install:re,listeners:["down","move","up","cancel"].reduce((function(t,e){return t["interactions:"+e]=ne,t}),{})};te.default=ie;var oe,ae={};Object.defineProperty(ae,"__esModule",{value:!0}),ae.default=void 0,function(t){t.touchAction="touchAction",t.boxSizing="boxSizing",t.noListeners="noListeners"}(oe||(oe={}));oe.touchAction,oe.boxSizing,oe.noListeners;var se={id:"dev-tools",install:function(){}};ae.default=se;var le={};Object.defineProperty(le,"__esModule",{value:!0}),le.default=function t(e){var n={};for(var r in e){var i=e[r];o.default.plainObject(i)?n[r]=t(i):o.default.array(i)?n[r]=H.from(i):n[r]=i}return n};var ce={};function ue(t,e,n){return e in t?Object.defineProperty(t,e,{value:n,enumerable:!0,configurable:!0,writable:!0}):t[e]=n,t}Object.defineProperty(ce,"__esModule",{value:!0}),ce.getRectOffset=pe,ce.default=void 0;var de=function(){function t(t){ue(this,"states",[]),ue(this,"startOffset",{left:0,right:0,top:0,bottom:0}),ue(this,"startDelta",void 0),ue(this,"result",void 0),ue(this,"endResult",void 0),ue(this,"edges",void 0),ue(this,"interaction",void 0),this.interaction=t,this.result=fe()}var e=t.prototype;return e.start=function(t,e){var n=t.phase,r=this.interaction,i=function(t){var e=t.interactable.options[t.prepared.name],n=e.modifiers;return n&&n.length?n:["snap","snapSize","snapEdges","restrict","restrictEdges","restrictSize"].map((function(t){var n=e[t];return n&&n.enabled&&{options:n,methods:n._methods}})).filter((function(t){return!!t}))}(r);this.prepareStates(i),this.edges=(0,T.default)({},r.edges),this.startOffset=pe(r.rect,e),this.startDelta={x:0,y:0};var o=this.fillArg({phase:n,pageCoords:e,preEnd:!1});return this.result=fe(),this.startAll(o),this.result=this.setAll(o)},e.fillArg=function(t){var e=this.interaction;return t.interaction=e,t.interactable=e.interactable,t.element=e.element,t.rect=t.rect||e.rect,t.edges=this.edges,t.startOffset=this.startOffset,t},e.startAll=function(t){for(var e=0;e<this.states.length;e++){var n=this.states[e];n.methods.start&&(t.state=n,n.methods.start(t))}},e.setAll=function(t){var e=t.phase,n=t.preEnd,r=t.skipModifiers,i=t.rect;t.coords=(0,T.default)({},t.pageCoords),t.rect=(0,T.default)({},i);for(var o=r?this.states.slice(r):this.states,a=fe(t.coords,t.rect),s=0;s<o.length;s++){var l,c=o[s],u=c.options,d=(0,T.default)({},t.coords),f=null;null!=(l=c.methods)&&l.set&&this.shouldDo(u,n,e)&&(t.state=c,f=c.methods.set(t),I.addEdges(this.interaction.edges,t.rect,{x:t.coords.x-d.x,y:t.coords.y-d.y})),a.eventProps.push(f)}a.delta.x=t.coords.x-t.pageCoords.x,a.delta.y=t.coords.y-t.pageCoords.y,a.rectDelta.left=t.rect.left-i.left,a.rectDelta.right=t.rect.right-i.right,a.rectDelta.top=t.rect.top-i.top,a.rectDelta.bottom=t.rect.bottom-i.bottom;var p=this.result.coords,v=this.result.rect;if(p&&v){var h=a.rect.left!==v.left||a.rect.right!==v.right||a.rect.top!==v.top||a.rect.bottom!==v.bottom;a.changed=h||p.x!==a.coords.x||p.y!==a.coords.y}return a},e.applyToInteraction=function(t){var e=this.interaction,n=t.phase,r=e.coords.cur,i=e.coords.start,o=this.result,a=this.startDelta,s=o.delta;"start"===n&&(0,T.default)(this.startDelta,o.delta);for(var l=0;l<[[i,a],[r,s]].length;l++){var c=[[i,a],[r,s]][l],u=c[0],d=c[1];u.page.x+=d.x,u.page.y+=d.y,u.client.x+=d.x,u.client.y+=d.y}var f=this.result.rectDelta,p=t.rect||e.rect;p.left+=f.left,p.right+=f.right,p.top+=f.top,p.bottom+=f.bottom,p.width=p.right-p.left,p.height=p.bottom-p.top},e.setAndApply=function(t){var e=this.interaction,n=t.phase,r=t.preEnd,i=t.skipModifiers,o=this.setAll(this.fillArg({preEnd:r,phase:n,pageCoords:t.modifiedCoords||e.coords.cur.page}));if(this.result=o,!o.changed&&(!i||i<this.states.length)&&e.interacting())return!1;if(t.modifiedCoords){var a=e.coords.cur.page,s={x:t.modifiedCoords.x-a.x,y:t.modifiedCoords.y-a.y};o.coords.x+=s.x,o.coords.y+=s.y,o.delta.x+=s.x,o.delta.y+=s.y}this.applyToInteraction(t)},e.beforeEnd=function(t){var e=t.interaction,n=t.event,r=this.states;if(r&&r.length){for(var i=!1,o=0;o<r.length;o++){var a=r[o];t.state=a;var s=a.options,l=a.methods,c=l.beforeEnd&&l.beforeEnd(t);if(c)return this.endResult=c,!1;i=i||!i&&this.shouldDo(s,!0,t.phase,!0)}i&&e.move({event:n,preEnd:!0})}},e.stop=function(t){var e=t.interaction;if(this.states&&this.states.length){var n=(0,T.default)({states:this.states,interactable:e.interactable,element:e.element,rect:null},t);this.fillArg(n);for(var r=0;r<this.states.length;r++){var i=this.states[r];n.state=i,i.methods.stop&&i.methods.stop(n)}this.states=null,this.endResult=null}},e.prepareStates=function(t){this.states=[];for(var e=0;e<t.length;e++){var n=t[e],r=n.options,i=n.methods,o=n.name;this.states.push({options:r,methods:i,index:e,name:o})}return this.states},e.restoreInteractionCoords=function(t){var e=t.interaction,n=e.coords,r=e.rect,i=e.modification;if(i.result){for(var o=i.startDelta,a=i.result,s=a.delta,l=a.rectDelta,c=[[n.start,o],[n.cur,s]],u=0;u<c.length;u++){var d=c[u],f=d[0],p=d[1];f.page.x-=p.x,f.page.y-=p.y,f.client.x-=p.x,f.client.y-=p.y}r.left-=l.left,r.right-=l.right,r.top-=l.top,r.bottom-=l.bottom}},e.shouldDo=function(t,e,n,r){return!(!t||!1===t.enabled||r&&!t.endOnly||t.endOnly&&!e||"start"===n&&!t.setStart)},e.copyFrom=function(t){this.startOffset=t.startOffset,this.startDelta=t.startDelta,this.edges=t.edges,this.states=t.states.map((function(t){return(0,le.default)(t)})),this.result=fe((0,T.default)({},t.result.coords),(0,T.default)({},t.result.rect))},e.destroy=function(){for(var t in this)this[t]=null},t}();function fe(t,e){return{rect:e,coords:t,delta:{x:0,y:0},rectDelta:{left:0,right:0,top:0,bottom:0},eventProps:[],changed:!0}}function pe(t,e){return t?{left:e.x-t.left,top:e.y-t.top,right:t.right-e.x,bottom:t.bottom-e.y}:{left:0,top:0,right:0,bottom:0}}ce.default=de;var ve={};function he(t){var e=t.iEvent,n=t.interaction.modification.result;n&&(e.modifiers=n.eventProps)}Object.defineProperty(ve,"__esModule",{value:!0}),ve.makeModifier=function(t,e){var n=t.defaults,r={start:t.start,set:t.set,beforeEnd:t.beforeEnd,stop:t.stop},i=function(t){var i=t||{};for(var o in i.enabled=!1!==i.enabled,n)o in i||(i[o]=n[o]);var a={options:i,methods:r,name:e,enable:function(){return i.enabled=!0,a},disable:function(){return i.enabled=!1,a}};return a};return e&&"string"==typeof e&&(i._defaults=n,i._methods=r),i},ve.addEventModifiers=he,ve.default=void 0;var ge={id:"modifiers/base",before:["actions"],install:function(t){t.defaults.perAction.modifiers=[]},listeners:{"interactions:new":function(t){var e=t.interaction;e.modification=new ce.default(e)},"interactions:before-action-start":function(t){var e=t.interaction.modification;e.start(t,t.interaction.coords.start.page),t.interaction.edges=e.edges,e.applyToInteraction(t)},"interactions:before-action-move":function(t){return t.interaction.modification.setAndApply(t)},"interactions:before-action-end":function(t){return t.interaction.modification.beforeEnd(t)},"interactions:action-start":he,"interactions:action-move":he,"interactions:action-end":he,"interactions:after-action-start":function(t){return t.interaction.modification.restoreInteractionCoords(t)},"interactions:after-action-move":function(t){return t.interaction.modification.restoreInteractionCoords(t)},"interactions:stop":function(t){return t.interaction.modification.stop(t)}}};ve.default=ge;var me={};Object.defineProperty(me,"__esModule",{value:!0}),me.defaults=void 0,me.defaults={base:{preventDefault:"auto",deltaSource:"page"},perAction:{enabled:!1,origin:{x:0,y:0}},actions:{}};var ye={};function be(t){if(void 0===t)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return t}function xe(t,e){return(xe=Object.setPrototypeOf||function(t,e){return t.__proto__=e,t})(t,e)}function we(t,e,n){return e in t?Object.defineProperty(t,e,{value:n,enumerable:!0,configurable:!0,writable:!0}):t[e]=n,t}Object.defineProperty(ye,"__esModule",{value:!0}),ye.InteractEvent=void 0;var _e=function(t){var e,n;function r(e,n,r,i,o,a,s){var l;we(be(l=t.call(this,e)||this),"target",void 0),we(be(l),"currentTarget",void 0),we(be(l),"relatedTarget",null),we(be(l),"screenX",void 0),we(be(l),"screenY",void 0),we(be(l),"button",void 0),we(be(l),"buttons",void 0),we(be(l),"ctrlKey",void 0),we(be(l),"shiftKey",void 0),we(be(l),"altKey",void 0),we(be(l),"metaKey",void 0),we(be(l),"page",void 0),we(be(l),"client",void 0),we(be(l),"delta",void 0),we(be(l),"rect",void 0),we(be(l),"x0",void 0),we(be(l),"y0",void 0),we(be(l),"t0",void 0),we(be(l),"dt",void 0),we(be(l),"duration",void 0),we(be(l),"clientX0",void 0),we(be(l),"clientY0",void 0),we(be(l),"velocity",void 0),we(be(l),"speed",void 0),we(be(l),"swipe",void 0),we(be(l),"timeStamp",void 0),we(be(l),"axes",void 0),we(be(l),"preEnd",void 0),o=o||e.element;var c=e.interactable,u=(c&&c.options||me.defaults).deltaSource,d=(0,D.default)(c,o,r),f="start"===i,p="end"===i,v=f?be(l):e.prevEvent,h=f?e.coords.start:p?{page:v.page,client:v.client,timeStamp:e.coords.cur.timeStamp}:e.coords.cur;return l.page=(0,T.default)({},h.page),l.client=(0,T.default)({},h.client),l.rect=(0,T.default)({},e.rect),l.timeStamp=h.timeStamp,p||(l.page.x-=d.x,l.page.y-=d.y,l.client.x-=d.x,l.client.y-=d.y),l.ctrlKey=n.ctrlKey,l.altKey=n.altKey,l.shiftKey=n.shiftKey,l.metaKey=n.metaKey,l.button=n.button,l.buttons=n.buttons,l.target=o,l.currentTarget=o,l.preEnd=a,l.type=s||r+(i||""),l.interactable=c,l.t0=f?e.pointers[e.pointers.length-1].downTime:v.t0,l.x0=e.coords.start.page.x-d.x,l.y0=e.coords.start.page.y-d.y,l.clientX0=e.coords.start.client.x-d.x,l.clientY0=e.coords.start.client.y-d.y,l.delta=f||p?{x:0,y:0}:{x:l[u].x-v[u].x,y:l[u].y-v[u].y},l.dt=e.coords.delta.timeStamp,l.duration=l.timeStamp-l.t0,l.velocity=(0,T.default)({},e.coords.velocity[u]),l.speed=(0,C.default)(l.velocity.x,l.velocity.y),l.swipe=p||"inertiastart"===i?l.getSwipe():null,l}n=t,(e=r).prototype=Object.create(n.prototype),e.prototype.constructor=e,xe(e,n);var i=r.prototype;return i.getSwipe=function(){var t=this._interaction;if(t.prevEvent.speed<600||this.timeStamp-t.prevEvent.timeStamp>150)return null;var e=180*Math.atan2(t.prevEvent.velocityY,t.prevEvent.velocityX)/Math.PI;e<0&&(e+=360);var n=112.5<=e&&e<247.5,r=202.5<=e&&e<337.5;return{up:r,down:!r&&22.5<=e&&e<157.5,left:n,right:!n&&(292.5<=e||e<67.5),angle:e,speed:t.prevEvent.speed,velocity:{x:t.prevEvent.velocityX,y:t.prevEvent.velocityY}}},i.preventDefault=function(){},i.stopImmediatePropagation=function(){this.immediatePropagationStopped=this.propagationStopped=!0},i.stopPropagation=function(){this.propagationStopped=!0},r}(q.BaseEvent);ye.InteractEvent=_e,Object.defineProperties(_e.prototype,{pageX:{get:function(){return this.page.x},set:function(t){this.page.x=t}},pageY:{get:function(){return this.page.y},set:function(t){this.page.y=t}},clientX:{get:function(){return this.client.x},set:function(t){this.client.x=t}},clientY:{get:function(){return this.client.y},set:function(t){this.client.y=t}},dx:{get:function(){return this.delta.x},set:function(t){this.delta.x=t}},dy:{get:function(){return this.delta.y},set:function(t){this.delta.y=t}},velocityX:{get:function(){return this.velocity.x},set:function(t){this.velocity.x=t}},velocityY:{get:function(){return this.velocity.y},set:function(t){this.velocity.y=t}}});var Pe={};function Ee(t,e,n){return e in t?Object.defineProperty(t,e,{value:n,enumerable:!0,configurable:!0,writable:!0}):t[e]=n,t}Object.defineProperty(Pe,"__esModule",{value:!0}),Pe.PointerInfo=void 0,Pe.PointerInfo=function(t,e,n,r,i){Ee(this,"id",void 0),Ee(this,"pointer",void 0),Ee(this,"event",void 0),Ee(this,"downTime",void 0),Ee(this,"downTarget",void 0),this.id=t,this.pointer=e,this.event=n,this.downTime=r,this.downTarget=i};var Oe,Me,Se={};function Te(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,r.key,r)}}function Ie(t,e,n){return e in t?Object.defineProperty(t,e,{value:n,enumerable:!0,configurable:!0,writable:!0}):t[e]=n,t}Object.defineProperty(Se,"__esModule",{value:!0}),Object.defineProperty(Se,"PointerInfo",{enumerable:!0,get:function(){return Pe.PointerInfo}}),Se.default=Se.Interaction=Se._ProxyMethods=Se._ProxyValues=void 0,Se._ProxyValues=Oe,function(t){t.interactable="",t.element="",t.prepared="",t.pointerIsDown="",t.pointerWasMoved="",t._proxy=""}(Oe||(Se._ProxyValues=Oe={})),Se._ProxyMethods=Me,function(t){t.start="",t.move="",t.end="",t.stop="",t.interacting=""}(Me||(Se._ProxyMethods=Me={}));var je=0,De=function(){function t(t){var e=this,n=t.pointerType,r=t.scopeFire;Ie(this,"interactable",null),Ie(this,"element",null),Ie(this,"rect",void 0),Ie(this,"_rects",void 0),Ie(this,"edges",void 0),Ie(this,"_scopeFire",void 0),Ie(this,"prepared",{name:null,axis:null,edges:null}),Ie(this,"pointerType",void 0),Ie(this,"pointers",[]),Ie(this,"downEvent",null),Ie(this,"downPointer",{}),Ie(this,"_latestPointer",{pointer:null,event:null,eventTarget:null}),Ie(this,"prevEvent",null),Ie(this,"pointerIsDown",!1),Ie(this,"pointerWasMoved",!1),Ie(this,"_interacting",!1),Ie(this,"_ending",!1),Ie(this,"_stopped",!0),Ie(this,"_proxy",null),Ie(this,"simulation",null),Ie(this,"doMove",(0,zt.warnOnce)((function(t){this.move(t)}),"The interaction.doMove() method has been renamed to interaction.move()")),Ie(this,"coords",{start:X.newCoords(),prev:X.newCoords(),cur:X.newCoords(),delta:X.newCoords(),velocity:X.newCoords()}),Ie(this,"_id",je++),this._scopeFire=r,this.pointerType=n;var i=this;this._proxy={};var o=function(t){Object.defineProperty(e._proxy,t,{get:function(){return i[t]}})};for(var a in Oe)o(a);var s=function(t){Object.defineProperty(e._proxy,t,{value:function(){return i[t].apply(i,arguments)}})};for(var l in Me)s(l);this._scopeFire("interactions:new",{interaction:this})}var e,n,r=t.prototype;return r.pointerDown=function(t,e,n){var r=this.updatePointer(t,e,n,!0),i=this.pointers[r];this._scopeFire("interactions:down",{pointer:t,event:e,eventTarget:n,pointerIndex:r,pointerInfo:i,type:"down",interaction:this})},r.start=function(t,e,n){return!(this.interacting()||!this.pointerIsDown||this.pointers.length<("gesture"===t.name?2:1)||!e.options[t.name].enabled)&&((0,zt.copyAction)(this.prepared,t),this.interactable=e,this.element=n,this.rect=e.getRect(n),this.edges=this.prepared.edges?(0,T.default)({},this.prepared.edges):{left:!0,right:!0,top:!0,bottom:!0},this._stopped=!1,this._interacting=this._doPhase({interaction:this,event:this.downEvent,phase:"start"})&&!this._stopped,this._interacting)},r.pointerMove=function(t,e,n){this.simulation||this.modification&&this.modification.endResult||this.updatePointer(t,e,n,!1);var r,i,o=this.coords.cur.page.x===this.coords.prev.page.x&&this.coords.cur.page.y===this.coords.prev.page.y&&this.coords.cur.client.x===this.coords.prev.client.x&&this.coords.cur.client.y===this.coords.prev.client.y;this.pointerIsDown&&!this.pointerWasMoved&&(r=this.coords.cur.client.x-this.coords.start.client.x,i=this.coords.cur.client.y-this.coords.start.client.y,this.pointerWasMoved=(0,C.default)(r,i)>this.pointerMoveTolerance);var a=this.getPointerIndex(t),s={pointer:t,pointerIndex:a,pointerInfo:this.pointers[a],event:e,type:"move",eventTarget:n,dx:r,dy:i,duplicate:o,interaction:this};o||X.setCoordVelocity(this.coords.velocity,this.coords.delta),this._scopeFire("interactions:move",s),o||this.simulation||(this.interacting()&&(s.type=null,this.move(s)),this.pointerWasMoved&&X.copyCoords(this.coords.prev,this.coords.cur))},r.move=function(t){t&&t.event||X.setZeroCoords(this.coords.delta),(t=(0,T.default)({pointer:this._latestPointer.pointer,event:this._latestPointer.event,eventTarget:this._latestPointer.eventTarget,interaction:this},t||{})).phase="move",this._doPhase(t)},r.pointerUp=function(t,e,n,r){var i=this.getPointerIndex(t);-1===i&&(i=this.updatePointer(t,e,n,!1));var o=/cancel$/i.test(e.type)?"cancel":"up";this._scopeFire("interactions:"+o,{pointer:t,pointerIndex:i,pointerInfo:this.pointers[i],event:e,eventTarget:n,type:o,curEventTarget:r,interaction:this}),this.simulation||this.end(e),this.removePointer(t,e)},r.documentBlur=function(t){this.end(t),this._scopeFire("interactions:blur",{event:t,type:"blur",interaction:this})},r.end=function(t){var e;this._ending=!0,t=t||this._latestPointer.event,this.interacting()&&(e=this._doPhase({event:t,interaction:this,phase:"end"})),this._ending=!1,!0===e&&this.stop()},r.currentAction=function(){return this._interacting?this.prepared.name:null},r.interacting=function(){return this._interacting},r.stop=function(){this._scopeFire("interactions:stop",{interaction:this}),this.interactable=this.element=null,this._interacting=!1,this._stopped=!0,this.prepared.name=this.prevEvent=null},r.getPointerIndex=function(t){var e=X.getPointerId(t);return"mouse"===this.pointerType||"pen"===this.pointerType?this.pointers.length-1:H.findIndex(this.pointers,(function(t){return t.id===e}))},r.getPointerInfo=function(t){return this.pointers[this.getPointerIndex(t)]},r.updatePointer=function(t,e,n,r){var i=X.getPointerId(t),o=this.getPointerIndex(t),a=this.pointers[o];return r=!1!==r&&(r||/(down|start)$/i.test(e.type)),a?a.pointer=t:(a=new Pe.PointerInfo(i,t,e,null,null),o=this.pointers.length,this.pointers.push(a)),X.setCoords(this.coords.cur,this.pointers.map((function(t){return t.pointer})),this._now()),X.setCoordDeltas(this.coords.delta,this.coords.prev,this.coords.cur),r&&(this.pointerIsDown=!0,a.downTime=this.coords.cur.timeStamp,a.downTarget=n,X.pointerExtend(this.downPointer,t),this.interacting()||(X.copyCoords(this.coords.start,this.coords.cur),X.copyCoords(this.coords.prev,this.coords.cur),this.downEvent=e,this.pointerWasMoved=!1)),this._updateLatestPointer(t,e,n),this._scopeFire("interactions:update-pointer",{pointer:t,event:e,eventTarget:n,down:r,pointerInfo:a,pointerIndex:o,interaction:this}),o},r.removePointer=function(t,e){var n=this.getPointerIndex(t);if(-1!==n){var r=this.pointers[n];this._scopeFire("interactions:remove-pointer",{pointer:t,event:e,eventTarget:null,pointerIndex:n,pointerInfo:r,interaction:this}),this.pointers.splice(n,1),this.pointerIsDown=!1}},r._updateLatestPointer=function(t,e,n){this._latestPointer.pointer=t,this._latestPointer.event=e,this._latestPointer.eventTarget=n},r.destroy=function(){this._latestPointer.pointer=null,this._latestPointer.event=null,this._latestPointer.eventTarget=null},r._createPreparedEvent=function(t,e,n,r){return new ye.InteractEvent(this,t,this.prepared.name,e,this.element,n,r)},r._fireEvent=function(t){this.interactable.fire(t),(!this.prevEvent||t.timeStamp>=this.prevEvent.timeStamp)&&(this.prevEvent=t)},r._doPhase=function(t){var e=t.event,n=t.phase,r=t.preEnd,i=t.type,o=this.rect;if(o&&"move"===n&&(I.addEdges(this.edges,o,this.coords.delta[this.interactable.options.deltaSource]),o.width=o.right-o.left,o.height=o.bottom-o.top),!1===this._scopeFire("interactions:before-action-"+n,t))return!1;var a=t.iEvent=this._createPreparedEvent(e,n,r,i);return this._scopeFire("interactions:action-"+n,t),"start"===n&&(this.prevEvent=a),this._fireEvent(a),this._scopeFire("interactions:after-action-"+n,t),!0},r._now=function(){return Date.now()},e=t,(n=[{key:"pointerMoveTolerance",get:function(){return 1}}])&&Te(e.prototype,n),t}();Se.Interaction=De;var ze=De;Se.default=ze;var Ae={};function Ce(t){t.pointerIsDown&&(Xe(t.coords.cur,t.offset.total),t.offset.pending.x=0,t.offset.pending.y=0)}function Re(t){ke(t.interaction)}function ke(t){if(!function(t){return!(!t.offset.pending.x&&!t.offset.pending.y)}(t))return!1;var e=t.offset.pending;return Xe(t.coords.cur,e),Xe(t.coords.delta,e),I.addEdges(t.edges,t.rect,e),e.x=0,e.y=0,!0}function Fe(t){var e=t.x,n=t.y;this.offset.pending.x+=e,this.offset.pending.y+=n,this.offset.total.x+=e,this.offset.total.y+=n}function Xe(t,e){var n=t.page,r=t.client,i=e.x,o=e.y;n.x+=i,n.y+=o,r.x+=i,r.y+=o}Object.defineProperty(Ae,"__esModule",{value:!0}),Ae.addTotal=Ce,Ae.applyPending=ke,Ae.default=void 0,Se._ProxyMethods.offsetBy="";var Ye={id:"offset",before:["modifiers","pointer-events","actions","inertia"],install:function(t){t.Interaction.prototype.offsetBy=Fe},listeners:{"interactions:new":function(t){t.interaction.offset={total:{x:0,y:0},pending:{x:0,y:0}}},"interactions:update-pointer":function(t){return Ce(t.interaction)},"interactions:before-action-start":Re,"interactions:before-action-move":Re,"interactions:before-action-end":function(t){var e=t.interaction;if(ke(e))return e.move({offset:!0}),e.end(),!1},"interactions:stop":function(t){var e=t.interaction;e.offset.total.x=0,e.offset.total.y=0,e.offset.pending.x=0,e.offset.pending.y=0}}};Ae.default=Ye;var We={};function Be(t,e,n){return e in t?Object.defineProperty(t,e,{value:n,enumerable:!0,configurable:!0,writable:!0}):t[e]=n,t}Object.defineProperty(We,"__esModule",{value:!0}),We.default=We.InertiaState=void 0;var Le=function(){function t(t){Be(this,"active",!1),Be(this,"isModified",!1),Be(this,"smoothEnd",!1),Be(this,"allowResume",!1),Be(this,"modification",void 0),Be(this,"modifierCount",0),Be(this,"modifierArg",void 0),Be(this,"startCoords",void 0),Be(this,"t0",0),Be(this,"v0",0),Be(this,"te",0),Be(this,"targetOffset",void 0),Be(this,"modifiedOffset",void 0),Be(this,"currentOffset",void 0),Be(this,"lambda_v0",0),Be(this,"one_ve_v0",0),Be(this,"timeout",void 0),Be(this,"interaction",void 0),this.interaction=t}var e=t.prototype;return e.start=function(t){var e=this.interaction,n=Ve(e);if(!n||!n.enabled)return!1;var r=e.coords.velocity.client,i=(0,C.default)(r.x,r.y),o=this.modification||(this.modification=new ce.default(e));if(o.copyFrom(e.modification),this.t0=e._now(),this.allowResume=n.allowResume,this.v0=i,this.currentOffset={x:0,y:0},this.startCoords=e.coords.cur.page,this.modifierArg=o.fillArg({pageCoords:this.startCoords,preEnd:!0,phase:"inertiastart"}),this.t0-e.coords.cur.timeStamp<50&&i>n.minSpeed&&i>n.endSpeed)this.startInertia();else{if(o.result=o.setAll(this.modifierArg),!o.result.changed)return!1;this.startSmoothEnd()}return e.modification.result.rect=null,e.offsetBy(this.targetOffset),e._doPhase({interaction:e,event:t,phase:"inertiastart"}),e.offsetBy({x:-this.targetOffset.x,y:-this.targetOffset.y}),e.modification.result.rect=null,this.active=!0,e.simulation=this,!0},e.startInertia=function(){var t=this,e=this.interaction.coords.velocity.client,n=Ve(this.interaction),r=n.resistance,i=-Math.log(n.endSpeed/this.v0)/r;this.targetOffset={x:(e.x-i)/r,y:(e.y-i)/r},this.te=i,this.lambda_v0=r/this.v0,this.one_ve_v0=1-n.endSpeed/this.v0;var o=this.modification,a=this.modifierArg;a.pageCoords={x:this.startCoords.x+this.targetOffset.x,y:this.startCoords.y+this.targetOffset.y},o.result=o.setAll(a),o.result.changed&&(this.isModified=!0,this.modifiedOffset={x:this.targetOffset.x+o.result.delta.x,y:this.targetOffset.y+o.result.delta.y}),this.onNextFrame((function(){return t.inertiaTick()}))},e.startSmoothEnd=function(){var t=this;this.smoothEnd=!0,this.isModified=!0,this.targetOffset={x:this.modification.result.delta.x,y:this.modification.result.delta.y},this.onNextFrame((function(){return t.smoothEndTick()}))},e.onNextFrame=function(t){var e=this;this.timeout=_t.default.request((function(){e.active&&t()}))},e.inertiaTick=function(){var t,e,n,r,i,o=this,a=this.interaction,s=Ve(a).resistance,l=(a._now()-this.t0)/1e3;if(l<this.te){var c,u=1-(Math.exp(-s*l)-this.lambda_v0)/this.one_ve_v0;this.isModified?(0,0,t=this.targetOffset.x,e=this.targetOffset.y,n=this.modifiedOffset.x,r=this.modifiedOffset.y,c={x:Ne(i=u,0,t,n),y:Ne(i,0,e,r)}):c={x:this.targetOffset.x*u,y:this.targetOffset.y*u};var d={x:c.x-this.currentOffset.x,y:c.y-this.currentOffset.y};this.currentOffset.x+=d.x,this.currentOffset.y+=d.y,a.offsetBy(d),a.move(),this.onNextFrame((function(){return o.inertiaTick()}))}else a.offsetBy({x:this.modifiedOffset.x-this.currentOffset.x,y:this.modifiedOffset.y-this.currentOffset.y}),this.end()},e.smoothEndTick=function(){var t=this,e=this.interaction,n=e._now()-this.t0,r=Ve(e).smoothEndDuration;if(n<r){var i={x:qe(n,0,this.targetOffset.x,r),y:qe(n,0,this.targetOffset.y,r)},o={x:i.x-this.currentOffset.x,y:i.y-this.currentOffset.y};this.currentOffset.x+=o.x,this.currentOffset.y+=o.y,e.offsetBy(o),e.move({skipModifiers:this.modifierCount}),this.onNextFrame((function(){return t.smoothEndTick()}))}else e.offsetBy({x:this.targetOffset.x-this.currentOffset.x,y:this.targetOffset.y-this.currentOffset.y}),this.end()},e.resume=function(t){var e=t.pointer,n=t.event,r=t.eventTarget,i=this.interaction;i.offsetBy({x:-this.currentOffset.x,y:-this.currentOffset.y}),i.updatePointer(e,n,r,!0),i._doPhase({interaction:i,event:n,phase:"resume"}),(0,X.copyCoords)(i.coords.prev,i.coords.cur),this.stop()},e.end=function(){this.interaction.move(),this.interaction.end(),this.stop()},e.stop=function(){this.active=this.smoothEnd=!1,this.interaction.simulation=null,_t.default.cancel(this.timeout)},t}();function Ve(t){var e=t.interactable,n=t.prepared;return e&&e.options&&n.name&&e.options[n.name].inertia}function Ne(t,e,n,r){var i=1-t;return i*i*e+2*i*t*n+t*t*r}function qe(t,e,n,r){return-n*(t/=r)*(t-2)+e}We.InertiaState=Le;var Ue={id:"inertia",before:["modifiers","actions"],install:function(t){var e=t.defaults;t.usePlugin(Ae.default),t.usePlugin(ve.default),t.actions.phases.inertiastart=!0,t.actions.phases.resume=!0,e.perAction.inertia={enabled:!1,resistance:10,minSpeed:100,endSpeed:10,allowResume:!0,smoothEndDuration:300}},listeners:{"interactions:new":function(t){var e=t.interaction;e.inertia=new Le(e)},"interactions:before-action-end":function(t){var e=t.interaction,n=t.event;return(!e._interacting||e.simulation||!e.inertia.start(n))&&null},"interactions:down":function(t){var e=t.interaction,n=t.eventTarget,r=e.inertia;if(r.active)for(var i=n;o.default.element(i);){if(i===e.element){r.resume(t);break}i=w.parentNode(i)}},"interactions:stop":function(t){var e=t.interaction.inertia;e.active&&e.stop()},"interactions:before-action-resume":function(t){var e=t.interaction.modification;e.stop(t),e.start(t,t.interaction.coords.cur.page),e.applyToInteraction(t)},"interactions:before-action-inertiastart":function(t){return t.interaction.modification.setAndApply(t)},"interactions:action-resume":ve.addEventModifiers,"interactions:action-inertiastart":ve.addEventModifiers,"interactions:after-action-inertiastart":function(t){return t.interaction.modification.restoreInteractionCoords(t)},"interactions:after-action-resume":function(t){return t.interaction.modification.restoreInteractionCoords(t)}}};We.default=Ue;var Ge={};function He(t,e,n){return e in t?Object.defineProperty(t,e,{value:n,enumerable:!0,configurable:!0,writable:!0}):t[e]=n,t}function $e(t,e){for(var n=0;n<e.length;n++){var r=e[n];if(t.immediatePropagationStopped)break;r(t)}}Object.defineProperty(Ge,"__esModule",{value:!0}),Ge.Eventable=void 0;var Ke=function(){function t(t){He(this,"options",void 0),He(this,"types",{}),He(this,"propagationStopped",!1),He(this,"immediatePropagationStopped",!1),He(this,"global",void 0),this.options=(0,T.default)({},t||{})}var e=t.prototype;return e.fire=function(t){var e,n=this.global;(e=this.types[t.type])&&$e(t,e),!t.propagationStopped&&n&&(e=n[t.type])&&$e(t,e)},e.on=function(t,e){var n=(0,z.default)(t,e);for(t in n)this.types[t]=H.merge(this.types[t]||[],n[t])},e.off=function(t,e){var n=(0,z.default)(t,e);for(t in n){var r=this.types[t];if(r&&r.length)for(var i=0;i<n[t].length;i++){var o=n[t][i],a=r.indexOf(o);-1!==a&&r.splice(a,1)}}},e.getRect=function(t){return null},t}();Ge.Eventable=Ke;var Ze={};Object.defineProperty(Ze,"__esModule",{value:!0}),Ze.default=function(t,e){if(e.phaselessTypes[t])return!0;for(var n in e.map)if(0===t.indexOf(n)&&t.substr(n.length)in e.phases)return!0;return!1};var Je={};Object.defineProperty(Je,"__esModule",{value:!0}),Je.createInteractStatic=function(t){var e=function e(n,r){var i=t.interactables.get(n,r);return i||((i=t.interactables.new(n,r)).events.global=e.globalEvents),i};return e.getPointerAverage=X.pointerAverage,e.getTouchBBox=X.touchBBox,e.getTouchDistance=X.touchDistance,e.getTouchAngle=X.touchAngle,e.getElementRect=w.getElementRect,e.getElementClientRect=w.getElementClientRect,e.matchesSelector=w.matchesSelector,e.closest=w.closest,e.globalEvents={},e.version="1.10.8",e.scope=t,e.use=function(t,e){return this.scope.usePlugin(t,e),this},e.isSet=function(t,e){return!!this.scope.interactables.get(t,e&&e.context)},e.on=(0,zt.warnOnce)((function(t,e,n){if(o.default.string(t)&&-1!==t.search(" ")&&(t=t.trim().split(/ +/)),o.default.array(t)){for(var r=0;r<t.length;r++){var i=t[r];this.on(i,e,n)}return this}if(o.default.object(t)){for(var a in t)this.on(a,t[a],e);return this}return(0,Ze.default)(t,this.scope.actions)?this.globalEvents[t]?this.globalEvents[t].push(e):this.globalEvents[t]=[e]:this.scope.events.add(this.scope.document,t,e,{options:n}),this}),"The interact.on() method is being deprecated"),e.off=(0,zt.warnOnce)((function(t,e,n){if(o.default.string(t)&&-1!==t.search(" ")&&(t=t.trim().split(/ +/)),o.default.array(t)){for(var r=0;r<t.length;r++){var i=t[r];this.off(i,e,n)}return this}if(o.default.object(t)){for(var a in t)this.off(a,t[a],e);return this}var s;return(0,Ze.default)(t,this.scope.actions)?t in this.globalEvents&&-1!==(s=this.globalEvents[t].indexOf(e))&&this.globalEvents[t].splice(s,1):this.scope.events.remove(this.scope.document,t,e,n),this}),"The interact.off() method is being deprecated"),e.debug=function(){return this.scope},e.supportsTouch=function(){return y.default.supportsTouch},e.supportsPointerEvent=function(){return y.default.supportsPointerEvent},e.stop=function(){for(var t=0;t<this.scope.interactions.list.length;t++)this.scope.interactions.list[t].stop();return this},e.pointerMoveTolerance=function(t){return o.default.number(t)?(this.scope.interactions.pointerMoveTolerance=t,this):this.scope.interactions.pointerMoveTolerance},e.addDocument=function(t,e){this.scope.addDocument(t,e)},e.removeDocument=function(t){this.scope.removeDocument(t)},e};var Qe={};function tn(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,r.key,r)}}function en(t,e,n){return e in t?Object.defineProperty(t,e,{value:n,enumerable:!0,configurable:!0,writable:!0}):t[e]=n,t}Object.defineProperty(Qe,"__esModule",{value:!0}),Qe.Interactable=void 0;var nn=function(){function t(t,n,r,i){en(this,"options",void 0),en(this,"_actions",void 0),en(this,"target",void 0),en(this,"events",new Ge.Eventable),en(this,"_context",void 0),en(this,"_win",void 0),en(this,"_doc",void 0),en(this,"_scopeEvents",void 0),en(this,"_rectChecker",void 0),this._actions=n.actions,this.target=t,this._context=n.context||r,this._win=(0,e.getWindow)((0,w.trySelector)(t)?this._context:t),this._doc=this._win.document,this._scopeEvents=i,this.set(n)}var n,r,i=t.prototype;return i.setOnEvents=function(t,e){return o.default.func(e.onstart)&&this.on(t+"start",e.onstart),o.default.func(e.onmove)&&this.on(t+"move",e.onmove),o.default.func(e.onend)&&this.on(t+"end",e.onend),o.default.func(e.oninertiastart)&&this.on(t+"inertiastart",e.oninertiastart),this},i.updatePerActionListeners=function(t,e,n){(o.default.array(e)||o.default.object(e))&&this.off(t,e),(o.default.array(n)||o.default.object(n))&&this.on(t,n)},i.setPerAction=function(t,e){var n=this._defaults;for(var r in e){var i=r,a=this.options[t],s=e[i];"listeners"===i&&this.updatePerActionListeners(t,a.listeners,s),o.default.array(s)?a[i]=H.from(s):o.default.plainObject(s)?(a[i]=(0,T.default)(a[i]||{},(0,le.default)(s)),o.default.object(n.perAction[i])&&"enabled"in n.perAction[i]&&(a[i].enabled=!1!==s.enabled)):o.default.bool(s)&&o.default.object(n.perAction[i])?a[i].enabled=s:a[i]=s}},i.getRect=function(t){return t=t||(o.default.element(this.target)?this.target:null),o.default.string(this.target)&&(t=t||this._context.querySelector(this.target)),(0,w.getElementRect)(t)},i.rectChecker=function(t){var e=this;return o.default.func(t)?(this._rectChecker=t,this.getRect=function(t){var n=(0,T.default)({},e._rectChecker(t));return"width"in n||(n.width=n.right-n.left,n.height=n.bottom-n.top),n},this):null===t?(delete this.getRect,delete this._rectChecker,this):this.getRect},i._backCompatOption=function(t,e){if((0,w.trySelector)(e)||o.default.object(e)){for(var n in this.options[t]=e,this._actions.map)this.options[n][t]=e;return this}return this.options[t]},i.origin=function(t){return this._backCompatOption("origin",t)},i.deltaSource=function(t){return"page"===t||"client"===t?(this.options.deltaSource=t,this):this.options.deltaSource},i.context=function(){return this._context},i.inContext=function(t){return this._context===t.ownerDocument||(0,w.nodeContains)(this._context,t)},i.testIgnoreAllow=function(t,e,n){return!this.testIgnore(t.ignoreFrom,e,n)&&this.testAllow(t.allowFrom,e,n)},i.testAllow=function(t,e,n){return!t||!!o.default.element(n)&&(o.default.string(t)?(0,w.matchesUpTo)(n,t,e):!!o.default.element(t)&&(0,w.nodeContains)(t,n))},i.testIgnore=function(t,e,n){return!(!t||!o.default.element(n))&&(o.default.string(t)?(0,w.matchesUpTo)(n,t,e):!!o.default.element(t)&&(0,w.nodeContains)(t,n))},i.fire=function(t){return this.events.fire(t),this},i._onOff=function(t,e,n,r){o.default.object(e)&&!o.default.array(e)&&(r=n,n=null);var i="on"===t?"add":"remove",a=(0,z.default)(e,n);for(var s in a){"wheel"===s&&(s=y.default.wheelEvent);for(var l=0;l<a[s].length;l++){var c=a[s][l];(0,Ze.default)(s,this._actions)?this.events[t](s,c):o.default.string(this.target)?this._scopeEvents[i+"Delegate"](this.target,this._context,s,c,r):this._scopeEvents[i](this.target,s,c,r)}}return this},i.on=function(t,e,n){return this._onOff("on",t,e,n)},i.off=function(t,e,n){return this._onOff("off",t,e,n)},i.set=function(t){var e=this._defaults;for(var n in o.default.object(t)||(t={}),this.options=(0,le.default)(e.base),this._actions.methodDict){var r=n,i=this._actions.methodDict[r];this.options[r]={},this.setPerAction(r,(0,T.default)((0,T.default)({},e.perAction),e.actions[r])),this[i](t[r])}for(var a in t)o.default.func(this[a])&&this[a](t[a]);return this},i.unset=function(){if(o.default.string(this.target))for(var t in this._scopeEvents.delegatedEvents)for(var e=this._scopeEvents.delegatedEvents[t],n=e.length-1;n>=0;n--){var r=e[n],i=r.selector,a=r.context,s=r.listeners;i===this.target&&a===this._context&&e.splice(n,1);for(var l=s.length-1;l>=0;l--)this._scopeEvents.removeDelegate(this.target,this._context,t,s[l][0],s[l][1])}else this._scopeEvents.remove(this.target,"all")},n=t,(r=[{key:"_defaults",get:function(){return{base:{},perAction:{},actions:{}}}}])&&tn(n.prototype,r),t}();Qe.Interactable=nn;var rn={};function on(t,e,n){return e in t?Object.defineProperty(t,e,{value:n,enumerable:!0,configurable:!0,writable:!0}):t[e]=n,t}Object.defineProperty(rn,"__esModule",{value:!0}),rn.InteractableSet=void 0;var an=function(){function t(t){var e=this;on(this,"list",[]),on(this,"selectorMap",{}),on(this,"scope",void 0),this.scope=t,t.addListeners({"interactable:unset":function(t){var n=t.interactable,r=n.target,i=n._context,a=o.default.string(r)?e.selectorMap[r]:r[e.scope.id],s=H.findIndex(a,(function(t){return t.context===i}));a[s]&&(a[s].context=null,a[s].interactable=null),a.splice(s,1)}})}var e=t.prototype;return e.new=function(t,e){e=(0,T.default)(e||{},{actions:this.scope.actions});var n=new this.scope.Interactable(t,e,this.scope.document,this.scope.events),r={context:n._context,interactable:n};return this.scope.addDocument(n._doc),this.list.push(n),o.default.string(t)?(this.selectorMap[t]||(this.selectorMap[t]=[]),this.selectorMap[t].push(r)):(n.target[this.scope.id]||Object.defineProperty(t,this.scope.id,{value:[],configurable:!0}),t[this.scope.id].push(r)),this.scope.fire("interactable:new",{target:t,options:e,interactable:n,win:this.scope._win}),n},e.get=function(t,e){var n=e&&e.context||this.scope.document,r=o.default.string(t),i=r?this.selectorMap[t]:t[this.scope.id];if(!i)return null;var a=H.find(i,(function(e){return e.context===n&&(r||e.interactable.inContext(t))}));return a&&a.interactable},e.forEachMatch=function(t,e){for(var n=0;n<this.list.length;n++){var r=this.list[n],i=void 0;if((o.default.string(r.target)?o.default.element(t)&&w.matchesSelector(t,r.target):t===r.target)&&r.inContext(t)&&(i=e(r)),void 0!==i)return i}},t}();rn.InteractableSet=an;var sn={};function ln(t,e,n){return e in t?Object.defineProperty(t,e,{value:n,enumerable:!0,configurable:!0,writable:!0}):t[e]=n,t}Object.defineProperty(sn,"__esModule",{value:!0}),sn.default=void 0;var cn=function(){function t(t){ln(this,"currentTarget",void 0),ln(this,"originalEvent",void 0),ln(this,"type",void 0),this.originalEvent=t,(0,R.default)(this,t)}var e=t.prototype;return e.preventOriginalDefault=function(){this.originalEvent.preventDefault()},e.stopPropagation=function(){this.originalEvent.stopPropagation()},e.stopImmediatePropagation=function(){this.originalEvent.stopImmediatePropagation()},t}();function un(t){if(!o.default.object(t))return{capture:!!t,passive:!1};var e=(0,T.default)({},t);return e.capture=!!t.capture,e.passive=!!t.passive,e}var dn={id:"events",install:function(t){var e=[],n={},r=[],i={add:a,remove:s,addDelegate:function(t,e,i,o,s){var u=un(s);if(!n[i]){n[i]=[];for(var d=0;d<r.length;d++){var f=r[d];a(f,i,l),a(f,i,c,!0)}}var p=n[i],v=H.find(p,(function(n){return n.selector===t&&n.context===e}));v||(v={selector:t,context:e,listeners:[]},p.push(v)),v.listeners.push([o,u])},removeDelegate:function(t,e,r,i,o){var a,u=un(o),d=n[r],f=!1;if(d)for(a=d.length-1;a>=0;a--){var p=d[a];if(p.selector===t&&p.context===e){for(var v=p.listeners,h=v.length-1;h>=0;h--){var g=v[h],m=g[0],y=g[1],b=y.capture,x=y.passive;if(m===i&&b===u.capture&&x===u.passive){v.splice(h,1),v.length||(d.splice(a,1),s(e,r,l),s(e,r,c,!0)),f=!0;break}}if(f)break}}},delegateListener:l,delegateUseCapture:c,delegatedEvents:n,documents:r,targets:e,supportsOptions:!1,supportsPassive:!1};function a(t,n,r,o){var a=un(o),s=H.find(e,(function(e){return e.eventTarget===t}));s||(s={eventTarget:t,events:{}},e.push(s)),s.events[n]||(s.events[n]=[]),t.addEventListener&&!H.contains(s.events[n],r)&&(t.addEventListener(n,r,i.supportsOptions?a:a.capture),s.events[n].push(r))}function s(t,n,r,o){var a=un(o),l=H.findIndex(e,(function(e){return e.eventTarget===t})),c=e[l];if(c&&c.events)if("all"!==n){var u=!1,d=c.events[n];if(d){if("all"===r){for(var f=d.length-1;f>=0;f--)s(t,n,d[f],a);return}for(var p=0;p<d.length;p++)if(d[p]===r){t.removeEventListener(n,r,i.supportsOptions?a:a.capture),d.splice(p,1),0===d.length&&(delete c.events[n],u=!0);break}}u&&!Object.keys(c.events).length&&e.splice(l,1)}else for(n in c.events)c.events.hasOwnProperty(n)&&s(t,n,"all")}function l(t,e){for(var r=un(e),i=new cn(t),a=n[t.type],s=X.getEventTargets(t)[0],l=s;o.default.element(l);){for(var c=0;c<a.length;c++){var u=a[c],d=u.selector,f=u.context;if(w.matchesSelector(l,d)&&w.nodeContains(f,s)&&w.nodeContains(f,l)){var p=u.listeners;i.currentTarget=l;for(var v=0;v<p.length;v++){var h=p[v],g=h[0],m=h[1],y=m.capture,b=m.passive;y===r.capture&&b===r.passive&&g(i)}}}l=w.parentNode(l)}}function c(t){return l(t,!0)}return t.document.createElement("div").addEventListener("test",null,{get capture(){return i.supportsOptions=!0},get passive(){return i.supportsPassive=!0}}),t.events=i,i}};sn.default=dn;var fn={};Object.defineProperty(fn,"__esModule",{value:!0}),fn.default=void 0;var pn={methodOrder:["simulationResume","mouseOrPen","hasPointer","idle"],search:function(t){for(var e=0;e<pn.methodOrder.length;e++){var n;n=pn.methodOrder[e];var r=pn[n](t);if(r)return r}return null},simulationResume:function(t){var e=t.pointerType,n=t.eventType,r=t.eventTarget,i=t.scope;if(!/down|start/i.test(n))return null;for(var o=0;o<i.interactions.list.length;o++){var a=i.interactions.list[o],s=r;if(a.simulation&&a.simulation.allowResume&&a.pointerType===e)for(;s;){if(s===a.element)return a;s=w.parentNode(s)}}return null},mouseOrPen:function(t){var e,n=t.pointerId,r=t.pointerType,i=t.eventType,o=t.scope;if("mouse"!==r&&"pen"!==r)return null;for(var a=0;a<o.interactions.list.length;a++){var s=o.interactions.list[a];if(s.pointerType===r){if(s.simulation&&!vn(s,n))continue;if(s.interacting())return s;e||(e=s)}}if(e)return e;for(var l=0;l<o.interactions.list.length;l++){var c=o.interactions.list[l];if(!(c.pointerType!==r||/down/i.test(i)&&c.simulation))return c}return null},hasPointer:function(t){for(var e=t.pointerId,n=t.scope,r=0;r<n.interactions.list.length;r++){var i=n.interactions.list[r];if(vn(i,e))return i}return null},idle:function(t){for(var e=t.pointerType,n=t.scope,r=0;r<n.interactions.list.length;r++){var i=n.interactions.list[r];if(1===i.pointers.length){var o=i.interactable;if(o&&(!o.options.gesture||!o.options.gesture.enabled))continue}else if(i.pointers.length>=2)continue;if(!i.interacting()&&e===i.pointerType)return i}return null}};function vn(t,e){return t.pointers.some((function(t){return t.id===e}))}var hn=pn;fn.default=hn;var gn={};function mn(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,r.key,r)}}function yn(t,e){return(yn=Object.setPrototypeOf||function(t,e){return t.__proto__=e,t})(t,e)}Object.defineProperty(gn,"__esModule",{value:!0}),gn.default=void 0;var bn=["pointerDown","pointerMove","pointerUp","updatePointer","removePointer","windowBlur"];function xn(t,e){return function(n){var r=e.interactions.list,i=X.getPointerType(n),o=X.getEventTargets(n),a=o[0],s=o[1],l=[];if(/^touch/.test(n.type)){e.prevTouchTime=e.now();for(var c=0;c<n.changedTouches.length;c++){var u=n.changedTouches[c],d={pointer:u,pointerId:X.getPointerId(u),pointerType:i,eventType:n.type,eventTarget:a,curEventTarget:s,scope:e},f=wn(d);l.push([d.pointer,d.eventTarget,d.curEventTarget,f])}}else{var p=!1;if(!y.default.supportsPointerEvent&&/mouse/.test(n.type)){for(var v=0;v<r.length&&!p;v++)p="mouse"!==r[v].pointerType&&r[v].pointerIsDown;p=p||e.now()-e.prevTouchTime<500||0===n.timeStamp}if(!p){var h={pointer:n,pointerId:X.getPointerId(n),pointerType:i,eventType:n.type,curEventTarget:s,eventTarget:a,scope:e},g=wn(h);l.push([h.pointer,h.eventTarget,h.curEventTarget,g])}}for(var m=0;m<l.length;m++){var b=l[m],x=b[0],w=b[1],_=b[2];b[3][t](x,n,w,_)}}}function wn(t){var e=t.pointerType,n=t.scope,r={interaction:fn.default.search(t),searchDetails:t};return n.fire("interactions:find",r),r.interaction||n.interactions.new({pointerType:e})}function _n(t,e){var n=t.doc,r=t.scope,i=t.options,o=r.interactions.docEvents,a=r.events,s=a[e];for(var l in r.browser.isIOS&&!i.events&&(i.events={passive:!1}),a.delegatedEvents)s(n,l,a.delegateListener),s(n,l,a.delegateUseCapture,!0);for(var c=i&&i.events,u=0;u<o.length;u++){var d=o[u];s(n,d.type,d.listener,c)}}var Pn={id:"core/interactions",install:function(t){for(var e={},n=0;n<bn.length;n++){var r=bn[n];e[r]=xn(r,t)}var i,o=y.default.pEventTypes;function a(){for(var e=0;e<t.interactions.list.length;e++){var n=t.interactions.list[e];if(n.pointerIsDown&&"touch"===n.pointerType&&!n._interacting)for(var r=function(){var e=n.pointers[i];t.documents.some((function(t){var n=t.doc;return(0,w.nodeContains)(n,e.downTarget)}))||n.removePointer(e.pointer,e.event)},i=0;i<n.pointers.length;i++)r()}}(i=v.default.PointerEvent?[{type:o.down,listener:a},{type:o.down,listener:e.pointerDown},{type:o.move,listener:e.pointerMove},{type:o.up,listener:e.pointerUp},{type:o.cancel,listener:e.pointerUp}]:[{type:"mousedown",listener:e.pointerDown},{type:"mousemove",listener:e.pointerMove},{type:"mouseup",listener:e.pointerUp},{type:"touchstart",listener:a},{type:"touchstart",listener:e.pointerDown},{type:"touchmove",listener:e.pointerMove},{type:"touchend",listener:e.pointerUp},{type:"touchcancel",listener:e.pointerUp}]).push({type:"blur",listener:function(e){for(var n=0;n<t.interactions.list.length;n++)t.interactions.list[n].documentBlur(e)}}),t.prevTouchTime=0,t.Interaction=function(e){var n,r,i,o;function a(){return e.apply(this,arguments)||this}return r=e,(n=a).prototype=Object.create(r.prototype),n.prototype.constructor=n,yn(n,r),a.prototype._now=function(){return t.now()},i=a,(o=[{key:"pointerMoveTolerance",get:function(){return t.interactions.pointerMoveTolerance},set:function(e){t.interactions.pointerMoveTolerance=e}}])&&mn(i.prototype,o),a}(Se.default),t.interactions={list:[],new:function(e){e.scopeFire=function(e,n){return t.fire(e,n)};var n=new t.Interaction(e);return t.interactions.list.push(n),n},listeners:e,docEvents:i,pointerMoveTolerance:1},t.usePlugin(te.default)},listeners:{"scope:add-document":function(t){return _n(t,"add")},"scope:remove-document":function(t){return _n(t,"remove")},"interactable:unset":function(t,e){for(var n=t.interactable,r=e.interactions.list.length-1;r>=0;r--){var i=e.interactions.list[r];i.interactable===n&&(i.stop(),e.fire("interactions:destroy",{interaction:i}),i.destroy(),e.interactions.list.length>2&&e.interactions.list.splice(r,1))}}},onDocSignal:_n,doOnInteractions:xn,methodNames:bn};gn.default=Pn;var En={};function On(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,r.key,r)}}function Mn(t,e){return(Mn=Object.setPrototypeOf||function(t,e){return t.__proto__=e,t})(t,e)}function Sn(t,e,n){return e in t?Object.defineProperty(t,e,{value:n,enumerable:!0,configurable:!0,writable:!0}):t[e]=n,t}Object.defineProperty(En,"__esModule",{value:!0}),En.initScope=In,En.Scope=void 0;var Tn=function(){function t(){var t=this;Sn(this,"id","__interact_scope_"+Math.floor(100*Math.random())),Sn(this,"isInitialized",!1),Sn(this,"listenerMaps",[]),Sn(this,"browser",y.default),Sn(this,"defaults",(0,le.default)(me.defaults)),Sn(this,"Eventable",Ge.Eventable),Sn(this,"actions",{map:{},phases:{start:!0,move:!0,end:!0},methodDict:{},phaselessTypes:{}}),Sn(this,"interactStatic",(0,Je.createInteractStatic)(this)),Sn(this,"InteractEvent",ye.InteractEvent),Sn(this,"Interactable",void 0),Sn(this,"interactables",new rn.InteractableSet(this)),Sn(this,"_win",void 0),Sn(this,"document",void 0),Sn(this,"window",void 0),Sn(this,"documents",[]),Sn(this,"_plugins",{list:[],map:{}}),Sn(this,"onWindowUnload",(function(e){return t.removeDocument(e.target)}));var e=this;this.Interactable=function(t){var n,r;function i(){return t.apply(this,arguments)||this}r=t,(n=i).prototype=Object.create(r.prototype),n.prototype.constructor=n,Mn(n,r);var o,a,s=i.prototype;return s.set=function(n){return t.prototype.set.call(this,n),e.fire("interactable:set",{options:n,interactable:this}),this},s.unset=function(){t.prototype.unset.call(this),e.interactables.list.splice(e.interactables.list.indexOf(this),1),e.fire("interactable:unset",{interactable:this})},o=i,(a=[{key:"_defaults",get:function(){return e.defaults}}])&&On(o.prototype,a),i}(Qe.Interactable)}var n=t.prototype;return n.addListeners=function(t,e){this.listenerMaps.push({id:e,map:t})},n.fire=function(t,e){for(var n=0;n<this.listenerMaps.length;n++){var r=this.listenerMaps[n].map[t];if(r&&!1===r(e,this,t))return!1}},n.init=function(t){return this.isInitialized?this:In(this,t)},n.pluginIsInstalled=function(t){return this._plugins.map[t.id]||-1!==this._plugins.list.indexOf(t)},n.usePlugin=function(t,e){if(!this.isInitialized)return this;if(this.pluginIsInstalled(t))return this;if(t.id&&(this._plugins.map[t.id]=t),this._plugins.list.push(t),t.install&&t.install(this,e),t.listeners&&t.before){for(var n=0,r=this.listenerMaps.length,i=t.before.reduce((function(t,e){return t[e]=!0,t[jn(e)]=!0,t}),{});n<r;n++){var o=this.listenerMaps[n].id;if(i[o]||i[jn(o)])break}this.listenerMaps.splice(n,0,{id:t.id,map:t.listeners})}else t.listeners&&this.listenerMaps.push({id:t.id,map:t.listeners});return this},n.addDocument=function(t,n){if(-1!==this.getDocIndex(t))return!1;var r=e.getWindow(t);n=n?(0,T.default)({},n):{},this.documents.push({doc:t,options:n}),this.events.documents.push(t),t!==this.document&&this.events.add(r,"unload",this.onWindowUnload),this.fire("scope:add-document",{doc:t,window:r,scope:this,options:n})},n.removeDocument=function(t){var n=this.getDocIndex(t),r=e.getWindow(t),i=this.documents[n].options;this.events.remove(r,"unload",this.onWindowUnload),this.documents.splice(n,1),this.events.documents.splice(n,1),this.fire("scope:remove-document",{doc:t,window:r,scope:this,options:i})},n.getDocIndex=function(t){for(var e=0;e<this.documents.length;e++)if(this.documents[e].doc===t)return e;return-1},n.getDocOptions=function(t){var e=this.getDocIndex(t);return-1===e?null:this.documents[e].options},n.now=function(){return(this.window.Date||Date).now()},t}();function In(t,n){return t.isInitialized=!0,e.init(n),v.default.init(n),y.default.init(n),_t.default.init(n),t.window=n,t.document=n.document,t.usePlugin(gn.default),t.usePlugin(sn.default),t}function jn(t){return t&&t.replace(/\/.*$/,"")}En.Scope=Tn;var Dn={};Object.defineProperty(Dn,"__esModule",{value:!0}),Dn.init=Dn.default=void 0;var zn=new En.Scope,An=zn.interactStatic;Dn.default=An;var Cn=function(t){return zn.init(t)};Dn.init=Cn,"object"==typeof window&&window&&Cn(window);var Rn={};Object.defineProperty(Rn,"__esModule",{value:!0}),Rn.default=void 0,Rn.default=function(){};var kn={};Object.defineProperty(kn,"__esModule",{value:!0}),kn.default=void 0,kn.default=function(){};var Fn={};Object.defineProperty(Fn,"__esModule",{value:!0}),Fn.default=void 0,Fn.default=function(t){var e=[["x","y"],["left","top"],["right","bottom"],["width","height"]].filter((function(e){var n=e[0],r=e[1];return n in t||r in t})),n=function(n,r){for(var i=t.range,o=t.limits,a=void 0===o?{left:-1/0,right:1/0,top:-1/0,bottom:1/0}:o,s=t.offset,l=void 0===s?{x:0,y:0}:s,c={range:i,grid:t,x:null,y:null},u=0;u<e.length;u++){var d=e[u],f=d[0],p=d[1],v=Math.round((n-l.x)/t[f]),h=Math.round((r-l.y)/t[p]);c[f]=Math.max(a.left,Math.min(a.right,v*t[f]+l.x)),c[p]=Math.max(a.top,Math.min(a.bottom,h*t[p]+l.y))}return c};return n.grid=t,n.coordFields=e,n};var Xn={};Object.defineProperty(Xn,"__esModule",{value:!0}),Object.defineProperty(Xn,"edgeTarget",{enumerable:!0,get:function(){return Rn.default}}),Object.defineProperty(Xn,"elements",{enumerable:!0,get:function(){return kn.default}}),Object.defineProperty(Xn,"grid",{enumerable:!0,get:function(){return Fn.default}});var Yn={};Object.defineProperty(Yn,"__esModule",{value:!0}),Yn.default=void 0;var Wn={id:"snappers",install:function(t){var e=t.interactStatic;e.snappers=(0,T.default)(e.snappers||{},Xn),e.createSnapGrid=e.snappers.grid}};Yn.default=Wn;var Bn={};function Ln(){return(Ln=Object.assign||function(t){for(var e=1;e<arguments.length;e++){var n=arguments[e];for(var r in n)Object.prototype.hasOwnProperty.call(n,r)&&(t[r]=n[r])}return t}).apply(this,arguments)}Object.defineProperty(Bn,"__esModule",{value:!0}),Bn.aspectRatio=Bn.default=void 0;var Vn={start:function(t){var e=t.state,n=t.rect,r=t.edges,i=t.pageCoords,o=e.options.ratio,a=e.options,s=a.equalDelta,l=a.modifiers;"preserve"===o&&(o=n.width/n.height),e.startCoords=(0,T.default)({},i),e.startRect=(0,T.default)({},n),e.ratio=o,e.equalDelta=s;var c=e.linkedEdges={top:r.top||r.left&&!r.bottom,left:r.left||r.top&&!r.right,bottom:r.bottom||r.right&&!r.top,right:r.right||r.bottom&&!r.left};if(e.xIsPrimaryAxis=!(!r.left&&!r.right),e.equalDelta)e.edgeSign=(c.left?1:-1)*(c.top?1:-1);else{var u=e.xIsPrimaryAxis?c.top:c.left;e.edgeSign=u?-1:1}if((0,T.default)(t.edges,c),l&&l.length){var d=new ce.default(t.interaction);d.copyFrom(t.interaction.modification),d.prepareStates(l),e.subModification=d,d.startAll(Ln({},t))}},set:function(t){var e=t.state,n=t.rect,r=t.coords,i=(0,T.default)({},r),o=e.equalDelta?Nn:qn;if(o(e,e.xIsPrimaryAxis,r,n),!e.subModification)return null;var a=(0,T.default)({},n);(0,I.addEdges)(e.linkedEdges,a,{x:r.x-i.x,y:r.y-i.y});var s=e.subModification.setAll(Ln({},t,{rect:a,edges:e.linkedEdges,pageCoords:r,prevCoords:r,prevRect:a})),l=s.delta;return s.changed&&(o(e,Math.abs(l.x)>Math.abs(l.y),s.coords,s.rect),(0,T.default)(r,s.coords)),s.eventProps},defaults:{ratio:"preserve",equalDelta:!1,modifiers:[],enabled:!1}};function Nn(t,e,n){var r=t.startCoords,i=t.edgeSign;e?n.y=r.y+(n.x-r.x)*i:n.x=r.x+(n.y-r.y)*i}function qn(t,e,n,r){var i=t.startRect,o=t.startCoords,a=t.ratio,s=t.edgeSign;if(e){var l=r.width/a;n.y=o.y+(l-i.height)*s}else{var c=r.height*a;n.x=o.x+(c-i.width)*s}}Bn.aspectRatio=Vn;var Un=(0,ve.makeModifier)(Vn,"aspectRatio");Bn.default=Un;var Gn={};Object.defineProperty(Gn,"__esModule",{value:!0}),Gn.default=void 0;var Hn=function(){};Hn._defaults={};var $n=Hn;Gn.default=$n;var Kn={};Object.defineProperty(Kn,"__esModule",{value:!0}),Object.defineProperty(Kn,"default",{enumerable:!0,get:function(){return Gn.default}});var Zn={};function Jn(t,e,n){return o.default.func(t)?I.resolveRectLike(t,e.interactable,e.element,[n.x,n.y,e]):I.resolveRectLike(t,e.interactable,e.element)}Object.defineProperty(Zn,"__esModule",{value:!0}),Zn.getRestrictionRect=Jn,Zn.restrict=Zn.default=void 0;var Qn={start:function(t){var e=t.rect,n=t.startOffset,r=t.state,i=t.interaction,o=t.pageCoords,a=r.options,s=a.elementRect,l=(0,T.default)({left:0,top:0,right:0,bottom:0},a.offset||{});if(e&&s){var c=Jn(a.restriction,i,o);if(c){var u=c.right-c.left-e.width,d=c.bottom-c.top-e.height;u<0&&(l.left+=u,l.right+=u),d<0&&(l.top+=d,l.bottom+=d)}l.left+=n.left-e.width*s.left,l.top+=n.top-e.height*s.top,l.right+=n.right-e.width*(1-s.right),l.bottom+=n.bottom-e.height*(1-s.bottom)}r.offset=l},set:function(t){var e=t.coords,n=t.interaction,r=t.state,i=r.options,o=r.offset,a=Jn(i.restriction,n,e);if(a){var s=I.xywhToTlbr(a);e.x=Math.max(Math.min(s.right-o.right,e.x),s.left+o.left),e.y=Math.max(Math.min(s.bottom-o.bottom,e.y),s.top+o.top)}},defaults:{restriction:null,elementRect:null,offset:null,endOnly:!1,enabled:!1}};Zn.restrict=Qn;var tr=(0,ve.makeModifier)(Qn,"restrict");Zn.default=tr;var er={};Object.defineProperty(er,"__esModule",{value:!0}),er.restrictEdges=er.default=void 0;var nr={top:1/0,left:1/0,bottom:-1/0,right:-1/0},rr={top:-1/0,left:-1/0,bottom:1/0,right:1/0};function ir(t,e){for(var n=["top","left","bottom","right"],r=0;r<n.length;r++){var i=n[r];i in t||(t[i]=e[i])}return t}var or={noInner:nr,noOuter:rr,start:function(t){var e,n=t.interaction,r=t.startOffset,i=t.state,o=i.options;if(o){var a=(0,Zn.getRestrictionRect)(o.offset,n,n.coords.start.page);e=I.rectToXY(a)}e=e||{x:0,y:0},i.offset={top:e.y+r.top,left:e.x+r.left,bottom:e.y-r.bottom,right:e.x-r.right}},set:function(t){var e=t.coords,n=t.edges,r=t.interaction,i=t.state,o=i.offset,a=i.options;if(n){var s=(0,T.default)({},e),l=(0,Zn.getRestrictionRect)(a.inner,r,s)||{},c=(0,Zn.getRestrictionRect)(a.outer,r,s)||{};ir(l,nr),ir(c,rr),n.top?e.y=Math.min(Math.max(c.top+o.top,s.y),l.top+o.top):n.bottom&&(e.y=Math.max(Math.min(c.bottom+o.bottom,s.y),l.bottom+o.bottom)),n.left?e.x=Math.min(Math.max(c.left+o.left,s.x),l.left+o.left):n.right&&(e.x=Math.max(Math.min(c.right+o.right,s.x),l.right+o.right))}},defaults:{inner:null,outer:null,offset:null,endOnly:!1,enabled:!1}};er.restrictEdges=or;var ar=(0,ve.makeModifier)(or,"restrictEdges");er.default=ar;var sr={};Object.defineProperty(sr,"__esModule",{value:!0}),sr.restrictRect=sr.default=void 0;var lr=(0,T.default)({get elementRect(){return{top:0,left:0,bottom:1,right:1}},set elementRect(t){}},Zn.restrict.defaults),cr={start:Zn.restrict.start,set:Zn.restrict.set,defaults:lr};sr.restrictRect=cr;var ur=(0,ve.makeModifier)(cr,"restrictRect");sr.default=ur;var dr={};Object.defineProperty(dr,"__esModule",{value:!0}),dr.restrictSize=dr.default=void 0;var fr={width:-1/0,height:-1/0},pr={width:1/0,height:1/0},vr={start:function(t){return er.restrictEdges.start(t)},set:function(t){var e=t.interaction,n=t.state,r=t.rect,i=t.edges,o=n.options;if(i){var a=I.tlbrToXywh((0,Zn.getRestrictionRect)(o.min,e,t.coords))||fr,s=I.tlbrToXywh((0,Zn.getRestrictionRect)(o.max,e,t.coords))||pr;n.options={endOnly:o.endOnly,inner:(0,T.default)({},er.restrictEdges.noInner),outer:(0,T.default)({},er.restrictEdges.noOuter)},i.top?(n.options.inner.top=r.bottom-a.height,n.options.outer.top=r.bottom-s.height):i.bottom&&(n.options.inner.bottom=r.top+a.height,n.options.outer.bottom=r.top+s.height),i.left?(n.options.inner.left=r.right-a.width,n.options.outer.left=r.right-s.width):i.right&&(n.options.inner.right=r.left+a.width,n.options.outer.right=r.left+s.width),er.restrictEdges.set(t),n.options=o}},defaults:{min:null,max:null,endOnly:!1,enabled:!1}};dr.restrictSize=vr;var hr=(0,ve.makeModifier)(vr,"restrictSize");dr.default=hr;var gr={};Object.defineProperty(gr,"__esModule",{value:!0}),Object.defineProperty(gr,"default",{enumerable:!0,get:function(){return Gn.default}});var mr={};Object.defineProperty(mr,"__esModule",{value:!0}),mr.snap=mr.default=void 0;var yr={start:function(t){var e,n=t.interaction,r=t.interactable,i=t.element,o=t.rect,a=t.state,s=t.startOffset,l=a.options,c=l.offsetWithOrigin?function(t){var e=t.interaction.element;return(0,I.rectToXY)((0,I.resolveRectLike)(t.state.options.origin,null,null,[e]))||(0,D.default)(t.interactable,e,t.interaction.prepared.name)}(t):{x:0,y:0};if("startCoords"===l.offset)e={x:n.coords.start.page.x,y:n.coords.start.page.y};else{var u=(0,I.resolveRectLike)(l.offset,r,i,[n]);(e=(0,I.rectToXY)(u)||{x:0,y:0}).x+=c.x,e.y+=c.y}var d=l.relativePoints;a.offsets=o&&d&&d.length?d.map((function(t,n){return{index:n,relativePoint:t,x:s.left-o.width*t.x+e.x,y:s.top-o.height*t.y+e.y}})):[{index:0,relativePoint:null,x:e.x,y:e.y}]},set:function(t){var e=t.interaction,n=t.coords,r=t.state,i=r.options,a=r.offsets,s=(0,D.default)(e.interactable,e.element,e.prepared.name),l=(0,T.default)({},n),c=[];i.offsetWithOrigin||(l.x-=s.x,l.y-=s.y);for(var u=0;u<a.length;u++)for(var d=a[u],f=l.x-d.x,p=l.y-d.y,v=0,h=i.targets.length;v<h;v++){var g,m=i.targets[v];(g=o.default.func(m)?m(f,p,e._proxy,d,v):m)&&c.push({x:(o.default.number(g.x)?g.x:f)+d.x,y:(o.default.number(g.y)?g.y:p)+d.y,range:o.default.number(g.range)?g.range:i.range,source:m,index:v,offset:d})}for(var y={target:null,inRange:!1,distance:0,range:0,delta:{x:0,y:0}},b=0;b<c.length;b++){var x=c[b],w=x.range,_=x.x-l.x,P=x.y-l.y,E=(0,C.default)(_,P),O=E<=w;w===1/0&&y.inRange&&y.range!==1/0&&(O=!1),y.target&&!(O?y.inRange&&w!==1/0?E/w<y.distance/y.range:w===1/0&&y.range!==1/0||E<y.distance:!y.inRange&&E<y.distance)||(y.target=x,y.distance=E,y.range=w,y.inRange=O,y.delta.x=_,y.delta.y=P)}return y.inRange&&(n.x=y.target.x,n.y=y.target.y),r.closest=y,y},defaults:{range:1/0,targets:null,offset:null,offsetWithOrigin:!0,origin:null,relativePoints:null,endOnly:!1,enabled:!1}};mr.snap=yr;var br=(0,ve.makeModifier)(yr,"snap");mr.default=br;var xr={};Object.defineProperty(xr,"__esModule",{value:!0}),xr.snapSize=xr.default=void 0;var wr={start:function(t){var e=t.state,n=t.edges,r=e.options;if(!n)return null;t.state={options:{targets:null,relativePoints:[{x:n.left?0:1,y:n.top?0:1}],offset:r.offset||"self",origin:{x:0,y:0},range:r.range}},e.targetFields=e.targetFields||[["width","height"],["x","y"]],mr.snap.start(t),e.offsets=t.state.offsets,t.state=e},set:function(t){var e=t.interaction,n=t.state,r=t.coords,i=n.options,a=n.offsets,s={x:r.x-a[0].x,y:r.y-a[0].y};n.options=(0,T.default)({},i),n.options.targets=[];for(var l=0;l<(i.targets||[]).length;l++){var c=(i.targets||[])[l],u=void 0;if(u=o.default.func(c)?c(s.x,s.y,e):c){for(var d=0;d<n.targetFields.length;d++){var f=n.targetFields[d],p=f[0],v=f[1];if(p in u||v in u){u.x=u[p],u.y=u[v];break}}n.options.targets.push(u)}}var h=mr.snap.set(t);return n.options=i,h},defaults:{range:1/0,targets:null,offset:null,endOnly:!1,enabled:!1}};xr.snapSize=wr;var _r=(0,ve.makeModifier)(wr,"snapSize");xr.default=_r;var Pr={};Object.defineProperty(Pr,"__esModule",{value:!0}),Pr.snapEdges=Pr.default=void 0;var Er={start:function(t){var e=t.edges;return e?(t.state.targetFields=t.state.targetFields||[[e.left?"left":"right",e.top?"top":"bottom"]],xr.snapSize.start(t)):null},set:xr.snapSize.set,defaults:(0,T.default)((0,le.default)(xr.snapSize.defaults),{targets:null,range:null,offset:{x:0,y:0}})};Pr.snapEdges=Er;var Or=(0,ve.makeModifier)(Er,"snapEdges");Pr.default=Or;var Mr={};Object.defineProperty(Mr,"__esModule",{value:!0}),Object.defineProperty(Mr,"default",{enumerable:!0,get:function(){return Gn.default}});var Sr={};Object.defineProperty(Sr,"__esModule",{value:!0}),Object.defineProperty(Sr,"default",{enumerable:!0,get:function(){return Gn.default}});var Tr={};Object.defineProperty(Tr,"__esModule",{value:!0}),Tr.default=void 0;var Ir={aspectRatio:Bn.default,restrictEdges:er.default,restrict:Zn.default,restrictRect:sr.default,restrictSize:dr.default,snapEdges:Pr.default,snap:mr.default,snapSize:xr.default,spring:Mr.default,avoid:Kn.default,transform:Sr.default,rubberband:gr.default};Tr.default=Ir;var jr={};Object.defineProperty(jr,"__esModule",{value:!0}),jr.default=void 0;var Dr={id:"modifiers",install:function(t){var e=t.interactStatic;for(var n in t.usePlugin(ve.default),t.usePlugin(Yn.default),e.modifiers=Tr.default,Tr.default){var r=Tr.default[n],i=r._defaults,o=r._methods;i._methods=o,t.defaults.perAction[n]=i}}};jr.default=Dr;var zr={};function Ar(t){if(void 0===t)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return t}function Cr(t,e){return(Cr=Object.setPrototypeOf||function(t,e){return t.__proto__=e,t})(t,e)}function Rr(t,e,n){return e in t?Object.defineProperty(t,e,{value:n,enumerable:!0,configurable:!0,writable:!0}):t[e]=n,t}Object.defineProperty(zr,"__esModule",{value:!0}),zr.PointerEvent=zr.default=void 0;var kr=function(t){var e,n;function r(e,n,r,i,o,a){var s;if(Rr(Ar(s=t.call(this,o)||this),"type",void 0),Rr(Ar(s),"originalEvent",void 0),Rr(Ar(s),"pointerId",void 0),Rr(Ar(s),"pointerType",void 0),Rr(Ar(s),"double",void 0),Rr(Ar(s),"pageX",void 0),Rr(Ar(s),"pageY",void 0),Rr(Ar(s),"clientX",void 0),Rr(Ar(s),"clientY",void 0),Rr(Ar(s),"dt",void 0),Rr(Ar(s),"eventable",void 0),X.pointerExtend(Ar(s),r),r!==n&&X.pointerExtend(Ar(s),n),s.timeStamp=a,s.originalEvent=r,s.type=e,s.pointerId=X.getPointerId(n),s.pointerType=X.getPointerType(n),s.target=i,s.currentTarget=null,"tap"===e){var l=o.getPointerIndex(n);s.dt=s.timeStamp-o.pointers[l].downTime;var c=s.timeStamp-o.tapTime;s.double=!!(o.prevTap&&"doubletap"!==o.prevTap.type&&o.prevTap.target===s.target&&c<500)}else"doubletap"===e&&(s.dt=n.timeStamp-o.tapTime);return s}n=t,(e=r).prototype=Object.create(n.prototype),e.prototype.constructor=e,Cr(e,n);var i=r.prototype;return i._subtractOrigin=function(t){var e=t.x,n=t.y;return this.pageX-=e,this.pageY-=n,this.clientX-=e,this.clientY-=n,this},i._addOrigin=function(t){var e=t.x,n=t.y;return this.pageX+=e,this.pageY+=n,this.clientX+=e,this.clientY+=n,this},i.preventDefault=function(){this.originalEvent.preventDefault()},r}(q.BaseEvent);zr.PointerEvent=zr.default=kr;var Fr={};Object.defineProperty(Fr,"__esModule",{value:!0}),Fr.default=void 0;var Xr={id:"pointer-events/base",before:["inertia","modifiers","auto-start","actions"],install:function(t){t.pointerEvents=Xr,t.defaults.actions.pointerEvents=Xr.defaults,(0,T.default)(t.actions.phaselessTypes,Xr.types)},listeners:{"interactions:new":function(t){var e=t.interaction;e.prevTap=null,e.tapTime=0},"interactions:update-pointer":function(t){var e=t.down,n=t.pointerInfo;!e&&n.hold||(n.hold={duration:1/0,timeout:null})},"interactions:move":function(t,e){var n=t.interaction,r=t.pointer,i=t.event,o=t.eventTarget;t.duplicate||n.pointerIsDown&&!n.pointerWasMoved||(n.pointerIsDown&&Br(t),Yr({interaction:n,pointer:r,event:i,eventTarget:o,type:"move"},e))},"interactions:down":function(t,e){!function(t,e){for(var n=t.interaction,r=t.pointer,i=t.event,o=t.eventTarget,a=t.pointerIndex,s=n.pointers[a].hold,l=w.getPath(o),c={interaction:n,pointer:r,event:i,eventTarget:o,type:"hold",targets:[],path:l,node:null},u=0;u<l.length;u++){var d=l[u];c.node=d,e.fire("pointerEvents:collect-targets",c)}if(c.targets.length){for(var f=1/0,p=0;p<c.targets.length;p++){var v=c.targets[p].eventable.options.holdDuration;v<f&&(f=v)}s.duration=f,s.timeout=setTimeout((function(){Yr({interaction:n,eventTarget:o,pointer:r,event:i,type:"hold"},e)}),f)}}(t,e),Yr(t,e)},"interactions:up":function(t,e){Br(t),Yr(t,e),function(t,e){var n=t.interaction,r=t.pointer,i=t.event,o=t.eventTarget;n.pointerWasMoved||Yr({interaction:n,eventTarget:o,pointer:r,event:i,type:"tap"},e)}(t,e)},"interactions:cancel":function(t,e){Br(t),Yr(t,e)}},PointerEvent:zr.PointerEvent,fire:Yr,collectEventTargets:Wr,defaults:{holdDuration:600,ignoreFrom:null,allowFrom:null,origin:{x:0,y:0}},types:{down:!0,move:!0,up:!0,cancel:!0,tap:!0,doubletap:!0,hold:!0}};function Yr(t,e){var n=t.interaction,r=t.pointer,i=t.event,o=t.eventTarget,a=t.type,s=t.targets,l=void 0===s?Wr(t,e):s,c=new zr.PointerEvent(a,r,i,o,n,e.now());e.fire("pointerEvents:new",{pointerEvent:c});for(var u={interaction:n,pointer:r,event:i,eventTarget:o,targets:l,type:a,pointerEvent:c},d=0;d<l.length;d++){var f=l[d];for(var p in f.props||{})c[p]=f.props[p];var v=(0,D.default)(f.eventable,f.node);if(c._subtractOrigin(v),c.eventable=f.eventable,c.currentTarget=f.node,f.eventable.fire(c),c._addOrigin(v),c.immediatePropagationStopped||c.propagationStopped&&d+1<l.length&&l[d+1].node!==c.currentTarget)break}if(e.fire("pointerEvents:fired",u),"tap"===a){var h=c.double?Yr({interaction:n,pointer:r,event:i,eventTarget:o,type:"doubletap"},e):c;n.prevTap=h,n.tapTime=h.timeStamp}return c}function Wr(t,e){var n=t.interaction,r=t.pointer,i=t.event,o=t.eventTarget,a=t.type,s=n.getPointerIndex(r),l=n.pointers[s];if("tap"===a&&(n.pointerWasMoved||!l||l.downTarget!==o))return[];for(var c=w.getPath(o),u={interaction:n,pointer:r,event:i,eventTarget:o,type:a,path:c,targets:[],node:null},d=0;d<c.length;d++){var f=c[d];u.node=f,e.fire("pointerEvents:collect-targets",u)}return"hold"===a&&(u.targets=u.targets.filter((function(t){var e;return t.eventable.options.holdDuration===(null==(e=n.pointers[s])?void 0:e.hold.duration)}))),u.targets}function Br(t){var e=t.interaction,n=t.pointerIndex,r=e.pointers[n].hold;r&&r.timeout&&(clearTimeout(r.timeout),r.timeout=null)}var Lr=Xr;Fr.default=Lr;var Vr={};function Nr(t){var e=t.interaction;e.holdIntervalHandle&&(clearInterval(e.holdIntervalHandle),e.holdIntervalHandle=null)}Object.defineProperty(Vr,"__esModule",{value:!0}),Vr.default=void 0;var qr={id:"pointer-events/holdRepeat",install:function(t){t.usePlugin(Fr.default);var e=t.pointerEvents;e.defaults.holdRepeatInterval=0,e.types.holdrepeat=t.actions.phaselessTypes.holdrepeat=!0},listeners:["move","up","cancel","endall"].reduce((function(t,e){return t["pointerEvents:"+e]=Nr,t}),{"pointerEvents:new":function(t){var e=t.pointerEvent;"hold"===e.type&&(e.count=(e.count||0)+1)},"pointerEvents:fired":function(t,e){var n=t.interaction,r=t.pointerEvent,i=t.eventTarget,o=t.targets;if("hold"===r.type&&o.length){var a=o[0].eventable.options.holdRepeatInterval;a<=0||(n.holdIntervalHandle=setTimeout((function(){e.pointerEvents.fire({interaction:n,eventTarget:i,type:"hold",pointer:r,event:r},e)}),a))}}})};Vr.default=qr;var Ur={};function Gr(t){return(0,T.default)(this.events.options,t),this}Object.defineProperty(Ur,"__esModule",{value:!0}),Ur.default=void 0;var Hr={id:"pointer-events/interactableTargets",install:function(t){var e=t.Interactable;e.prototype.pointerEvents=Gr;var n=e.prototype._backCompatOption;e.prototype._backCompatOption=function(t,e){var r=n.call(this,t,e);return r===this&&(this.events.options[t]=e),r}},listeners:{"pointerEvents:collect-targets":function(t,e){var n=t.targets,r=t.node,i=t.type,o=t.eventTarget;e.interactables.forEachMatch(r,(function(t){var e=t.events,a=e.options;e.types[i]&&e.types[i].length&&t.testIgnoreAllow(a,r,o)&&n.push({node:r,eventable:e,props:{interactable:t}})}))},"interactable:new":function(t){var e=t.interactable;e.events.getRect=function(t){return e.getRect(t)}},"interactable:set":function(t,e){var n=t.interactable,r=t.options;(0,T.default)(n.events.options,e.pointerEvents.defaults),(0,T.default)(n.events.options,r.pointerEvents||{})}}};Ur.default=Hr;var $r={};Object.defineProperty($r,"__esModule",{value:!0}),$r.default=void 0;var Kr={id:"pointer-events",install:function(t){t.usePlugin(Fr),t.usePlugin(Vr.default),t.usePlugin(Ur.default)}};$r.default=Kr;var Zr={};function Jr(t){var e=t.Interactable;t.actions.phases.reflow=!0,e.prototype.reflow=function(e){return function(t,e,n){for(var r=o.default.string(t.target)?H.from(t._context.querySelectorAll(t.target)):[t.target],i=n.window.Promise,a=i?[]:null,s=function(){var o=r[l],s=t.getRect(o);if(!s)return"break";var c=H.find(n.interactions.list,(function(n){return n.interacting()&&n.interactable===t&&n.element===o&&n.prepared.name===e.name})),u=void 0;if(c)c.move(),a&&(u=c._reflowPromise||new i((function(t){c._reflowResolve=t})));else{var d=(0,I.tlbrToXywh)(s),f={page:{x:d.x,y:d.y},client:{x:d.x,y:d.y},timeStamp:n.now()},p=X.coordsToEvent(f);u=function(t,e,n,r,i){var o=t.interactions.new({pointerType:"reflow"}),a={interaction:o,event:i,pointer:i,eventTarget:n,phase:"reflow"};o.interactable=e,o.element=n,o.prevEvent=i,o.updatePointer(i,i,n,!0),X.setZeroCoords(o.coords.delta),(0,zt.copyAction)(o.prepared,r),o._doPhase(a);var s=t.window.Promise,l=s?new s((function(t){o._reflowResolve=t})):void 0;return o._reflowPromise=l,o.start(r,e,n),o._interacting?(o.move(a),o.end(i)):(o.stop(),o._reflowResolve()),o.removePointer(i,i),l}(n,t,o,e,p)}a&&a.push(u)},l=0;l<r.length&&"break"!==s();l++);return a&&i.all(a).then((function(){return t}))}(this,e,t)}}Object.defineProperty(Zr,"__esModule",{value:!0}),Zr.install=Jr,Zr.default=void 0;var Qr={id:"reflow",install:Jr,listeners:{"interactions:stop":function(t,e){var n=t.interaction;"reflow"===n.pointerType&&(n._reflowResolve&&n._reflowResolve(),H.remove(e.interactions.list,n))}}};Zr.default=Qr;var ti={exports:{}};Object.defineProperty(ti.exports,"__esModule",{value:!0}),ti.exports.default=void 0,Dn.default.use(te.default),Dn.default.use(Ae.default),Dn.default.use($r.default),Dn.default.use(We.default),Dn.default.use(jr.default),Dn.default.use(Jt.default),Dn.default.use(xt.default),Dn.default.use(St.default),Dn.default.use(Zr.default);var ei=Dn.default;if(ti.exports.default=ei,ti)try{ti.exports=Dn.default}catch(t){}Dn.default.default=Dn.default,ti=ti.exports;var ni={exports:{}};Object.defineProperty(ni.exports,"__esModule",{value:!0}),ni.exports.default=void 0;var ri=ti.default;if(ni.exports.default=ri,ni)try{ni.exports=ti.default}catch(t){}return ti.default.default=ti.default,ni.exports}));


}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],24:[function(require,module,exports){
(function (process){(function (){
// Generated by CoffeeScript 1.12.2
(function() {
  var getNanoSeconds, hrtime, loadTime, moduleLoadTime, nodeLoadTime, upTime;

  if ((typeof performance !== "undefined" && performance !== null) && performance.now) {
    module.exports = function() {
      return performance.now();
    };
  } else if ((typeof process !== "undefined" && process !== null) && process.hrtime) {
    module.exports = function() {
      return (getNanoSeconds() - nodeLoadTime) / 1e6;
    };
    hrtime = process.hrtime;
    getNanoSeconds = function() {
      var hr;
      hr = hrtime();
      return hr[0] * 1e9 + hr[1];
    };
    moduleLoadTime = getNanoSeconds();
    upTime = process.uptime() * 1e9;
    nodeLoadTime = moduleLoadTime - upTime;
  } else if (Date.now) {
    module.exports = function() {
      return Date.now() - loadTime;
    };
    loadTime = Date.now();
  } else {
    module.exports = function() {
      return new Date().getTime() - loadTime;
    };
    loadTime = new Date().getTime();
  }

}).call(this);



}).call(this)}).call(this,require('_process'))
},{"_process":3}],25:[function(require,module,exports){
(function (global){(function (){
var now = require('performance-now')
  , root = typeof window === 'undefined' ? global : window
  , vendors = ['moz', 'webkit']
  , suffix = 'AnimationFrame'
  , raf = root['request' + suffix]
  , caf = root['cancel' + suffix] || root['cancelRequest' + suffix]

for(var i = 0; !raf && i < vendors.length; i++) {
  raf = root[vendors[i] + 'Request' + suffix]
  caf = root[vendors[i] + 'Cancel' + suffix]
      || root[vendors[i] + 'CancelRequest' + suffix]
}

// Some versions of FF have rAF but not cAF
if(!raf || !caf) {
  var last = 0
    , id = 0
    , queue = []
    , frameDuration = 1000 / 60

  raf = function(callback) {
    if(queue.length === 0) {
      var _now = now()
        , next = Math.max(0, frameDuration - (_now - last))
      last = next + _now
      setTimeout(function() {
        var cp = queue.slice(0)
        // Clear queue here to prevent
        // callbacks from appending listeners
        // to the current frame's queue
        queue.length = 0
        for(var i = 0; i < cp.length; i++) {
          if(!cp[i].cancelled) {
            try{
              cp[i].callback(last)
            } catch(e) {
              setTimeout(function() { throw e }, 0)
            }
          }
        }
      }, Math.round(next))
    }
    queue.push({
      handle: ++id,
      callback: callback,
      cancelled: false
    })
    return id
  }

  caf = function(handle) {
    for(var i = 0; i < queue.length; i++) {
      if(queue[i].handle === handle) {
        queue[i].cancelled = true
      }
    }
  }
}

module.exports = function(fn) {
  // Wrap in a new function to prevent
  // `cancel` potentially being assigned
  // to the native rAF function
  return raf.call(root, fn)
}
module.exports.cancel = function() {
  caf.apply(root, arguments)
}
module.exports.polyfill = function(object) {
  if (!object) {
    object = root;
  }
  object.requestAnimationFrame = raf
  object.cancelAnimationFrame = caf
}

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"performance-now":24}],26:[function(require,module,exports){
 /* eslint-env node */
'use strict';

// SDP helpers.
var SDPUtils = {};

// Generate an alphanumeric identifier for cname or mids.
// TODO: use UUIDs instead? https://gist.github.com/jed/982883
SDPUtils.generateIdentifier = function() {
  return Math.random().toString(36).substr(2, 10);
};

// The RTCP CNAME used by all peerconnections from the same JS.
SDPUtils.localCName = SDPUtils.generateIdentifier();

// Splits SDP into lines, dealing with both CRLF and LF.
SDPUtils.splitLines = function(blob) {
  return blob.trim().split('\n').map(function(line) {
    return line.trim();
  });
};
// Splits SDP into sessionpart and mediasections. Ensures CRLF.
SDPUtils.splitSections = function(blob) {
  var parts = blob.split('\nm=');
  return parts.map(function(part, index) {
    return (index > 0 ? 'm=' + part : part).trim() + '\r\n';
  });
};

// Returns lines that start with a certain prefix.
SDPUtils.matchPrefix = function(blob, prefix) {
  return SDPUtils.splitLines(blob).filter(function(line) {
    return line.indexOf(prefix) === 0;
  });
};

// Parses an ICE candidate line. Sample input:
// candidate:702786350 2 udp 41819902 8.8.8.8 60769 typ relay raddr 8.8.8.8
// rport 55996"
SDPUtils.parseCandidate = function(line) {
  var parts;
  // Parse both variants.
  if (line.indexOf('a=candidate:') === 0) {
    parts = line.substring(12).split(' ');
  } else {
    parts = line.substring(10).split(' ');
  }

  var candidate = {
    foundation: parts[0],
    component: parts[1],
    protocol: parts[2].toLowerCase(),
    priority: parseInt(parts[3], 10),
    ip: parts[4],
    port: parseInt(parts[5], 10),
    // skip parts[6] == 'typ'
    type: parts[7]
  };

  for (var i = 8; i < parts.length; i += 2) {
    switch (parts[i]) {
      case 'raddr':
        candidate.relatedAddress = parts[i + 1];
        break;
      case 'rport':
        candidate.relatedPort = parseInt(parts[i + 1], 10);
        break;
      case 'tcptype':
        candidate.tcpType = parts[i + 1];
        break;
      default: // extension handling, in particular ufrag
        candidate[parts[i]] = parts[i + 1];
        break;
    }
  }
  return candidate;
};

// Translates a candidate object into SDP candidate attribute.
SDPUtils.writeCandidate = function(candidate) {
  var sdp = [];
  sdp.push(candidate.foundation);
  sdp.push(candidate.component);
  sdp.push(candidate.protocol.toUpperCase());
  sdp.push(candidate.priority);
  sdp.push(candidate.ip);
  sdp.push(candidate.port);

  var type = candidate.type;
  sdp.push('typ');
  sdp.push(type);
  if (type !== 'host' && candidate.relatedAddress &&
      candidate.relatedPort) {
    sdp.push('raddr');
    sdp.push(candidate.relatedAddress); // was: relAddr
    sdp.push('rport');
    sdp.push(candidate.relatedPort); // was: relPort
  }
  if (candidate.tcpType && candidate.protocol.toLowerCase() === 'tcp') {
    sdp.push('tcptype');
    sdp.push(candidate.tcpType);
  }
  return 'candidate:' + sdp.join(' ');
};

// Parses an ice-options line, returns an array of option tags.
// a=ice-options:foo bar
SDPUtils.parseIceOptions = function(line) {
  return line.substr(14).split(' ');
}

// Parses an rtpmap line, returns RTCRtpCoddecParameters. Sample input:
// a=rtpmap:111 opus/48000/2
SDPUtils.parseRtpMap = function(line) {
  var parts = line.substr(9).split(' ');
  var parsed = {
    payloadType: parseInt(parts.shift(), 10) // was: id
  };

  parts = parts[0].split('/');

  parsed.name = parts[0];
  parsed.clockRate = parseInt(parts[1], 10); // was: clockrate
  // was: channels
  parsed.numChannels = parts.length === 3 ? parseInt(parts[2], 10) : 1;
  return parsed;
};

// Generate an a=rtpmap line from RTCRtpCodecCapability or
// RTCRtpCodecParameters.
SDPUtils.writeRtpMap = function(codec) {
  var pt = codec.payloadType;
  if (codec.preferredPayloadType !== undefined) {
    pt = codec.preferredPayloadType;
  }
  return 'a=rtpmap:' + pt + ' ' + codec.name + '/' + codec.clockRate +
      (codec.numChannels !== 1 ? '/' + codec.numChannels : '') + '\r\n';
};

// Parses an a=extmap line (headerextension from RFC 5285). Sample input:
// a=extmap:2 urn:ietf:params:rtp-hdrext:toffset
// a=extmap:2/sendonly urn:ietf:params:rtp-hdrext:toffset
SDPUtils.parseExtmap = function(line) {
  var parts = line.substr(9).split(' ');
  return {
    id: parseInt(parts[0], 10),
    direction: parts[0].indexOf('/') > 0 ? parts[0].split('/')[1] : 'sendrecv',
    uri: parts[1]
  };
};

// Generates a=extmap line from RTCRtpHeaderExtensionParameters or
// RTCRtpHeaderExtension.
SDPUtils.writeExtmap = function(headerExtension) {
  return 'a=extmap:' + (headerExtension.id || headerExtension.preferredId) +
      (headerExtension.direction && headerExtension.direction !== 'sendrecv'
          ? '/' + headerExtension.direction
          : '') +
      ' ' + headerExtension.uri + '\r\n';
};

// Parses an ftmp line, returns dictionary. Sample input:
// a=fmtp:96 vbr=on;cng=on
// Also deals with vbr=on; cng=on
SDPUtils.parseFmtp = function(line) {
  var parsed = {};
  var kv;
  var parts = line.substr(line.indexOf(' ') + 1).split(';');
  for (var j = 0; j < parts.length; j++) {
    kv = parts[j].trim().split('=');
    parsed[kv[0].trim()] = kv[1];
  }
  return parsed;
};

// Generates an a=ftmp line from RTCRtpCodecCapability or RTCRtpCodecParameters.
SDPUtils.writeFmtp = function(codec) {
  var line = '';
  var pt = codec.payloadType;
  if (codec.preferredPayloadType !== undefined) {
    pt = codec.preferredPayloadType;
  }
  if (codec.parameters && Object.keys(codec.parameters).length) {
    var params = [];
    Object.keys(codec.parameters).forEach(function(param) {
      params.push(param + '=' + codec.parameters[param]);
    });
    line += 'a=fmtp:' + pt + ' ' + params.join(';') + '\r\n';
  }
  return line;
};

// Parses an rtcp-fb line, returns RTCPRtcpFeedback object. Sample input:
// a=rtcp-fb:98 nack rpsi
SDPUtils.parseRtcpFb = function(line) {
  var parts = line.substr(line.indexOf(' ') + 1).split(' ');
  return {
    type: parts.shift(),
    parameter: parts.join(' ')
  };
};
// Generate a=rtcp-fb lines from RTCRtpCodecCapability or RTCRtpCodecParameters.
SDPUtils.writeRtcpFb = function(codec) {
  var lines = '';
  var pt = codec.payloadType;
  if (codec.preferredPayloadType !== undefined) {
    pt = codec.preferredPayloadType;
  }
  if (codec.rtcpFeedback && codec.rtcpFeedback.length) {
    // FIXME: special handling for trr-int?
    codec.rtcpFeedback.forEach(function(fb) {
      lines += 'a=rtcp-fb:' + pt + ' ' + fb.type +
      (fb.parameter && fb.parameter.length ? ' ' + fb.parameter : '') +
          '\r\n';
    });
  }
  return lines;
};

// Parses an RFC 5576 ssrc media attribute. Sample input:
// a=ssrc:3735928559 cname:something
SDPUtils.parseSsrcMedia = function(line) {
  var sp = line.indexOf(' ');
  var parts = {
    ssrc: parseInt(line.substr(7, sp - 7), 10)
  };
  var colon = line.indexOf(':', sp);
  if (colon > -1) {
    parts.attribute = line.substr(sp + 1, colon - sp - 1);
    parts.value = line.substr(colon + 1);
  } else {
    parts.attribute = line.substr(sp + 1);
  }
  return parts;
};

// Extracts the MID (RFC 5888) from a media section.
// returns the MID or undefined if no mid line was found.
SDPUtils.getMid = function(mediaSection) {
  var mid = SDPUtils.matchPrefix(mediaSection, 'a=mid:')[0];
  if (mid) {
    return mid.substr(6);
  }
}

SDPUtils.parseFingerprint = function(line) {
  var parts = line.substr(14).split(' ');
  return {
    algorithm: parts[0].toLowerCase(), // algorithm is case-sensitive in Edge.
    value: parts[1]
  };
};

// Extracts DTLS parameters from SDP media section or sessionpart.
// FIXME: for consistency with other functions this should only
//   get the fingerprint line as input. See also getIceParameters.
SDPUtils.getDtlsParameters = function(mediaSection, sessionpart) {
  var lines = SDPUtils.matchPrefix(mediaSection + sessionpart,
      'a=fingerprint:');
  // Note: a=setup line is ignored since we use the 'auto' role.
  // Note2: 'algorithm' is not case sensitive except in Edge.
  return {
    role: 'auto',
    fingerprints: lines.map(SDPUtils.parseFingerprint)
  };
};

// Serializes DTLS parameters to SDP.
SDPUtils.writeDtlsParameters = function(params, setupType) {
  var sdp = 'a=setup:' + setupType + '\r\n';
  params.fingerprints.forEach(function(fp) {
    sdp += 'a=fingerprint:' + fp.algorithm + ' ' + fp.value + '\r\n';
  });
  return sdp;
};
// Parses ICE information from SDP media section or sessionpart.
// FIXME: for consistency with other functions this should only
//   get the ice-ufrag and ice-pwd lines as input.
SDPUtils.getIceParameters = function(mediaSection, sessionpart) {
  var lines = SDPUtils.splitLines(mediaSection);
  // Search in session part, too.
  lines = lines.concat(SDPUtils.splitLines(sessionpart));
  var iceParameters = {
    usernameFragment: lines.filter(function(line) {
      return line.indexOf('a=ice-ufrag:') === 0;
    })[0].substr(12),
    password: lines.filter(function(line) {
      return line.indexOf('a=ice-pwd:') === 0;
    })[0].substr(10)
  };
  return iceParameters;
};

// Serializes ICE parameters to SDP.
SDPUtils.writeIceParameters = function(params) {
  return 'a=ice-ufrag:' + params.usernameFragment + '\r\n' +
      'a=ice-pwd:' + params.password + '\r\n';
};

// Parses the SDP media section and returns RTCRtpParameters.
SDPUtils.parseRtpParameters = function(mediaSection) {
  var description = {
    codecs: [],
    headerExtensions: [],
    fecMechanisms: [],
    rtcp: []
  };
  var lines = SDPUtils.splitLines(mediaSection);
  var mline = lines[0].split(' ');
  for (var i = 3; i < mline.length; i++) { // find all codecs from mline[3..]
    var pt = mline[i];
    var rtpmapline = SDPUtils.matchPrefix(
        mediaSection, 'a=rtpmap:' + pt + ' ')[0];
    if (rtpmapline) {
      var codec = SDPUtils.parseRtpMap(rtpmapline);
      var fmtps = SDPUtils.matchPrefix(
          mediaSection, 'a=fmtp:' + pt + ' ');
      // Only the first a=fmtp:<pt> is considered.
      codec.parameters = fmtps.length ? SDPUtils.parseFmtp(fmtps[0]) : {};
      codec.rtcpFeedback = SDPUtils.matchPrefix(
          mediaSection, 'a=rtcp-fb:' + pt + ' ')
        .map(SDPUtils.parseRtcpFb);
      description.codecs.push(codec);
      // parse FEC mechanisms from rtpmap lines.
      switch (codec.name.toUpperCase()) {
        case 'RED':
        case 'ULPFEC':
          description.fecMechanisms.push(codec.name.toUpperCase());
          break;
        default: // only RED and ULPFEC are recognized as FEC mechanisms.
          break;
      }
    }
  }
  SDPUtils.matchPrefix(mediaSection, 'a=extmap:').forEach(function(line) {
    description.headerExtensions.push(SDPUtils.parseExtmap(line));
  });
  // FIXME: parse rtcp.
  return description;
};

// Generates parts of the SDP media section describing the capabilities /
// parameters.
SDPUtils.writeRtpDescription = function(kind, caps) {
  var sdp = '';

  // Build the mline.
  sdp += 'm=' + kind + ' ';
  sdp += caps.codecs.length > 0 ? '9' : '0'; // reject if no codecs.
  sdp += ' UDP/TLS/RTP/SAVPF ';
  sdp += caps.codecs.map(function(codec) {
    if (codec.preferredPayloadType !== undefined) {
      return codec.preferredPayloadType;
    }
    return codec.payloadType;
  }).join(' ') + '\r\n';

  sdp += 'c=IN IP4 0.0.0.0\r\n';
  sdp += 'a=rtcp:9 IN IP4 0.0.0.0\r\n';

  // Add a=rtpmap lines for each codec. Also fmtp and rtcp-fb.
  caps.codecs.forEach(function(codec) {
    sdp += SDPUtils.writeRtpMap(codec);
    sdp += SDPUtils.writeFmtp(codec);
    sdp += SDPUtils.writeRtcpFb(codec);
  });
  var maxptime = 0;
  caps.codecs.forEach(function(codec) {
    if (codec.maxptime > maxptime) {
      maxptime = codec.maxptime;
    }
  });
  if (maxptime > 0) {
    sdp += 'a=maxptime:' + maxptime + '\r\n';
  }
  sdp += 'a=rtcp-mux\r\n';

  caps.headerExtensions.forEach(function(extension) {
    sdp += SDPUtils.writeExtmap(extension);
  });
  // FIXME: write fecMechanisms.
  return sdp;
};

// Parses the SDP media section and returns an array of
// RTCRtpEncodingParameters.
SDPUtils.parseRtpEncodingParameters = function(mediaSection) {
  var encodingParameters = [];
  var description = SDPUtils.parseRtpParameters(mediaSection);
  var hasRed = description.fecMechanisms.indexOf('RED') !== -1;
  var hasUlpfec = description.fecMechanisms.indexOf('ULPFEC') !== -1;

  // filter a=ssrc:... cname:, ignore PlanB-msid
  var ssrcs = SDPUtils.matchPrefix(mediaSection, 'a=ssrc:')
  .map(function(line) {
    return SDPUtils.parseSsrcMedia(line);
  })
  .filter(function(parts) {
    return parts.attribute === 'cname';
  });
  var primarySsrc = ssrcs.length > 0 && ssrcs[0].ssrc;
  var secondarySsrc;

  var flows = SDPUtils.matchPrefix(mediaSection, 'a=ssrc-group:FID')
  .map(function(line) {
    var parts = line.split(' ');
    parts.shift();
    return parts.map(function(part) {
      return parseInt(part, 10);
    });
  });
  if (flows.length > 0 && flows[0].length > 1 && flows[0][0] === primarySsrc) {
    secondarySsrc = flows[0][1];
  }

  description.codecs.forEach(function(codec) {
    if (codec.name.toUpperCase() === 'RTX' && codec.parameters.apt) {
      var encParam = {
        ssrc: primarySsrc,
        codecPayloadType: parseInt(codec.parameters.apt, 10),
        rtx: {
          ssrc: secondarySsrc
        }
      };
      encodingParameters.push(encParam);
      if (hasRed) {
        encParam = JSON.parse(JSON.stringify(encParam));
        encParam.fec = {
          ssrc: secondarySsrc,
          mechanism: hasUlpfec ? 'red+ulpfec' : 'red'
        };
        encodingParameters.push(encParam);
      }
    }
  });
  if (encodingParameters.length === 0 && primarySsrc) {
    encodingParameters.push({
      ssrc: primarySsrc
    });
  }

  // we support both b=AS and b=TIAS but interpret AS as TIAS.
  var bandwidth = SDPUtils.matchPrefix(mediaSection, 'b=');
  if (bandwidth.length) {
    if (bandwidth[0].indexOf('b=TIAS:') === 0) {
      bandwidth = parseInt(bandwidth[0].substr(7), 10);
    } else if (bandwidth[0].indexOf('b=AS:') === 0) {
      bandwidth = parseInt(bandwidth[0].substr(5), 10);
    }
    encodingParameters.forEach(function(params) {
      params.maxBitrate = bandwidth;
    });
  }
  return encodingParameters;
};

// parses http://draft.ortc.org/#rtcrtcpparameters*
SDPUtils.parseRtcpParameters = function(mediaSection) {
  var rtcpParameters = {};

  var cname;
  // Gets the first SSRC. Note that with RTX there might be multiple
  // SSRCs.
  var remoteSsrc = SDPUtils.matchPrefix(mediaSection, 'a=ssrc:')
      .map(function(line) {
        return SDPUtils.parseSsrcMedia(line);
      })
      .filter(function(obj) {
        return obj.attribute === 'cname';
      })[0];
  if (remoteSsrc) {
    rtcpParameters.cname = remoteSsrc.value;
    rtcpParameters.ssrc = remoteSsrc.ssrc;
  }

  // Edge uses the compound attribute instead of reducedSize
  // compound is !reducedSize
  var rsize = SDPUtils.matchPrefix(mediaSection, 'a=rtcp-rsize');
  rtcpParameters.reducedSize = rsize.length > 0;
  rtcpParameters.compound = rsize.length === 0;

  // parses the rtcp-mux attrіbute.
  // Note that Edge does not support unmuxed RTCP.
  var mux = SDPUtils.matchPrefix(mediaSection, 'a=rtcp-mux');
  rtcpParameters.mux = mux.length > 0;

  return rtcpParameters;
};

// parses either a=msid: or a=ssrc:... msid lines and returns
// the id of the MediaStream and MediaStreamTrack.
SDPUtils.parseMsid = function(mediaSection) {
  var parts;
  var spec = SDPUtils.matchPrefix(mediaSection, 'a=msid:');
  if (spec.length === 1) {
    parts = spec[0].substr(7).split(' ');
    return {stream: parts[0], track: parts[1]};
  }
  var planB = SDPUtils.matchPrefix(mediaSection, 'a=ssrc:')
  .map(function(line) {
    return SDPUtils.parseSsrcMedia(line);
  })
  .filter(function(parts) {
    return parts.attribute === 'msid';
  });
  if (planB.length > 0) {
    parts = planB[0].value.split(' ');
    return {stream: parts[0], track: parts[1]};
  }
};

SDPUtils.writeSessionBoilerplate = function() {
  // FIXME: sess-id should be an NTP timestamp.
  return 'v=0\r\n' +
      'o=thisisadapterortc 8169639915646943137 2 IN IP4 127.0.0.1\r\n' +
      's=-\r\n' +
      't=0 0\r\n';
};

SDPUtils.writeMediaSection = function(transceiver, caps, type, stream) {
  var sdp = SDPUtils.writeRtpDescription(transceiver.kind, caps);

  // Map ICE parameters (ufrag, pwd) to SDP.
  sdp += SDPUtils.writeIceParameters(
      transceiver.iceGatherer.getLocalParameters());

  // Map DTLS parameters to SDP.
  sdp += SDPUtils.writeDtlsParameters(
      transceiver.dtlsTransport.getLocalParameters(),
      type === 'offer' ? 'actpass' : 'active');

  sdp += 'a=mid:' + transceiver.mid + '\r\n';

  if (transceiver.direction) {
    sdp += 'a=' + transceiver.direction + '\r\n';
  } else if (transceiver.rtpSender && transceiver.rtpReceiver) {
    sdp += 'a=sendrecv\r\n';
  } else if (transceiver.rtpSender) {
    sdp += 'a=sendonly\r\n';
  } else if (transceiver.rtpReceiver) {
    sdp += 'a=recvonly\r\n';
  } else {
    sdp += 'a=inactive\r\n';
  }

  if (transceiver.rtpSender) {
    // spec.
    var msid = 'msid:' + stream.id + ' ' +
        transceiver.rtpSender.track.id + '\r\n';
    sdp += 'a=' + msid;

    // for Chrome.
    sdp += 'a=ssrc:' + transceiver.sendEncodingParameters[0].ssrc +
        ' ' + msid;
    if (transceiver.sendEncodingParameters[0].rtx) {
      sdp += 'a=ssrc:' + transceiver.sendEncodingParameters[0].rtx.ssrc +
          ' ' + msid;
      sdp += 'a=ssrc-group:FID ' +
          transceiver.sendEncodingParameters[0].ssrc + ' ' +
          transceiver.sendEncodingParameters[0].rtx.ssrc +
          '\r\n';
    }
  }
  // FIXME: this should be written by writeRtpDescription.
  sdp += 'a=ssrc:' + transceiver.sendEncodingParameters[0].ssrc +
      ' cname:' + SDPUtils.localCName + '\r\n';
  if (transceiver.rtpSender && transceiver.sendEncodingParameters[0].rtx) {
    sdp += 'a=ssrc:' + transceiver.sendEncodingParameters[0].rtx.ssrc +
        ' cname:' + SDPUtils.localCName + '\r\n';
  }
  return sdp;
};

// Gets the direction from the mediaSection or the sessionpart.
SDPUtils.getDirection = function(mediaSection, sessionpart) {
  // Look for sendrecv, sendonly, recvonly, inactive, default to sendrecv.
  var lines = SDPUtils.splitLines(mediaSection);
  for (var i = 0; i < lines.length; i++) {
    switch (lines[i]) {
      case 'a=sendrecv':
      case 'a=sendonly':
      case 'a=recvonly':
      case 'a=inactive':
        return lines[i].substr(2);
      default:
        // FIXME: What should happen here?
    }
  }
  if (sessionpart) {
    return SDPUtils.getDirection(sessionpart);
  }
  return 'sendrecv';
};

SDPUtils.getKind = function(mediaSection) {
  var lines = SDPUtils.splitLines(mediaSection);
  var mline = lines[0].split(' ');
  return mline[0].substr(2);
};

SDPUtils.isRejected = function(mediaSection) {
  return mediaSection.split(' ', 2)[1] === '0';
};

// Expose public methods.
module.exports = SDPUtils;

},{}],27:[function(require,module,exports){
(function (global){(function (){
(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.vexDialog = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

/**
 * Expose `parse`.
 */

module.exports = parse;

/**
 * Tests for browser support.
 */

var innerHTMLBug = false;
var bugTestDiv;
if (typeof document !== 'undefined') {
  bugTestDiv = document.createElement('div');
  // Setup
  bugTestDiv.innerHTML = '  <link/><table></table><a href="/a">a</a><input type="checkbox"/>';
  // Make sure that link elements get serialized correctly by innerHTML
  // This requires a wrapper element in IE
  innerHTMLBug = !bugTestDiv.getElementsByTagName('link').length;
  bugTestDiv = undefined;
}

/**
 * Wrap map from jquery.
 */

var map = {
  legend: [1, '<fieldset>', '</fieldset>'],
  tr: [2, '<table><tbody>', '</tbody></table>'],
  col: [2, '<table><tbody></tbody><colgroup>', '</colgroup></table>'],
  // for script/link/style tags to work in IE6-8, you have to wrap
  // in a div with a non-whitespace character in front, ha!
  _default: innerHTMLBug ? [1, 'X<div>', '</div>'] : [0, '', '']
};

map.td =
map.th = [3, '<table><tbody><tr>', '</tr></tbody></table>'];

map.option =
map.optgroup = [1, '<select multiple="multiple">', '</select>'];

map.thead =
map.tbody =
map.colgroup =
map.caption =
map.tfoot = [1, '<table>', '</table>'];

map.polyline =
map.ellipse =
map.polygon =
map.circle =
map.text =
map.line =
map.path =
map.rect =
map.g = [1, '<svg xmlns="http://www.w3.org/2000/svg" version="1.1">','</svg>'];

/**
 * Parse `html` and return a DOM Node instance, which could be a TextNode,
 * HTML DOM Node of some kind (<div> for example), or a DocumentFragment
 * instance, depending on the contents of the `html` string.
 *
 * @param {String} html - HTML string to "domify"
 * @param {Document} doc - The `document` instance to create the Node for
 * @return {DOMNode} the TextNode, DOM Node, or DocumentFragment instance
 * @api private
 */

function parse(html, doc) {
  if ('string' != typeof html) throw new TypeError('String expected');

  // default to the global `document` object
  if (!doc) doc = document;

  // tag name
  var m = /<([\w:]+)/.exec(html);
  if (!m) return doc.createTextNode(html);

  html = html.replace(/^\s+|\s+$/g, ''); // Remove leading/trailing whitespace

  var tag = m[1];

  // body support
  if (tag == 'body') {
    var el = doc.createElement('html');
    el.innerHTML = html;
    return el.removeChild(el.lastChild);
  }

  // wrap map
  var wrap = map[tag] || map._default;
  var depth = wrap[0];
  var prefix = wrap[1];
  var suffix = wrap[2];
  var el = doc.createElement('div');
  el.innerHTML = prefix + html + suffix;
  while (depth--) el = el.lastChild;

  // one element
  if (el.firstChild == el.lastChild) {
    return el.removeChild(el.firstChild);
  }

  // several elements
  var fragment = doc.createDocumentFragment();
  while (el.firstChild) {
    fragment.appendChild(el.removeChild(el.firstChild));
  }

  return fragment;
}

},{}],2:[function(require,module,exports){
// get successful control from form and assemble into object
// http://www.w3.org/TR/html401/interact/forms.html#h-17.13.2

// types which indicate a submit action and are not successful controls
// these will be ignored
var k_r_submitter = /^(?:submit|button|image|reset|file)$/i;

// node names which could be successful controls
var k_r_success_contrls = /^(?:input|select|textarea|keygen)/i;

// Matches bracket notation.
var brackets = /(\[[^\[\]]*\])/g;

// serializes form fields
// @param form MUST be an HTMLForm element
// @param options is an optional argument to configure the serialization. Default output
// with no options specified is a url encoded string
//    - hash: [true | false] Configure the output type. If true, the output will
//    be a js object.
//    - serializer: [function] Optional serializer function to override the default one.
//    The function takes 3 arguments (result, key, value) and should return new result
//    hash and url encoded str serializers are provided with this module
//    - disabled: [true | false]. If true serialize disabled fields.
//    - empty: [true | false]. If true serialize empty fields
function serialize(form, options) {
    if (typeof options != 'object') {
        options = { hash: !!options };
    }
    else if (options.hash === undefined) {
        options.hash = true;
    }

    var result = (options.hash) ? {} : '';
    var serializer = options.serializer || ((options.hash) ? hash_serializer : str_serialize);

    var elements = form && form.elements ? form.elements : [];

    //Object store each radio and set if it's empty or not
    var radio_store = Object.create(null);

    for (var i=0 ; i<elements.length ; ++i) {
        var element = elements[i];

        // ingore disabled fields
        if ((!options.disabled && element.disabled) || !element.name) {
            continue;
        }
        // ignore anyhting that is not considered a success field
        if (!k_r_success_contrls.test(element.nodeName) ||
            k_r_submitter.test(element.type)) {
            continue;
        }

        var key = element.name;
        var val = element.value;

        // we can't just use element.value for checkboxes cause some browsers lie to us
        // they say "on" for value when the box isn't checked
        if ((element.type === 'checkbox' || element.type === 'radio') && !element.checked) {
            val = undefined;
        }

        // If we want empty elements
        if (options.empty) {
            // for checkbox
            if (element.type === 'checkbox' && !element.checked) {
                val = '';
            }

            // for radio
            if (element.type === 'radio') {
                if (!radio_store[element.name] && !element.checked) {
                    radio_store[element.name] = false;
                }
                else if (element.checked) {
                    radio_store[element.name] = true;
                }
            }

            // if options empty is true, continue only if its radio
            if (!val && element.type == 'radio') {
                continue;
            }
        }
        else {
            // value-less fields are ignored unless options.empty is true
            if (!val) {
                continue;
            }
        }

        // multi select boxes
        if (element.type === 'select-multiple') {
            val = [];

            var selectOptions = element.options;
            var isSelectedOptions = false;
            for (var j=0 ; j<selectOptions.length ; ++j) {
                var option = selectOptions[j];
                var allowedEmpty = options.empty && !option.value;
                var hasValue = (option.value || allowedEmpty);
                if (option.selected && hasValue) {
                    isSelectedOptions = true;

                    // If using a hash serializer be sure to add the
                    // correct notation for an array in the multi-select
                    // context. Here the name attribute on the select element
                    // might be missing the trailing bracket pair. Both names
                    // "foo" and "foo[]" should be arrays.
                    if (options.hash && key.slice(key.length - 2) !== '[]') {
                        result = serializer(result, key + '[]', option.value);
                    }
                    else {
                        result = serializer(result, key, option.value);
                    }
                }
            }

            // Serialize if no selected options and options.empty is true
            if (!isSelectedOptions && options.empty) {
                result = serializer(result, key, '');
            }

            continue;
        }

        result = serializer(result, key, val);
    }

    // Check for all empty radio buttons and serialize them with key=""
    if (options.empty) {
        for (var key in radio_store) {
            if (!radio_store[key]) {
                result = serializer(result, key, '');
            }
        }
    }

    return result;
}

function parse_keys(string) {
    var keys = [];
    var prefix = /^([^\[\]]*)/;
    var children = new RegExp(brackets);
    var match = prefix.exec(string);

    if (match[1]) {
        keys.push(match[1]);
    }

    while ((match = children.exec(string)) !== null) {
        keys.push(match[1]);
    }

    return keys;
}

function hash_assign(result, keys, value) {
    if (keys.length === 0) {
        result = value;
        return result;
    }

    var key = keys.shift();
    var between = key.match(/^\[(.+?)\]$/);

    if (key === '[]') {
        result = result || [];

        if (Array.isArray(result)) {
            result.push(hash_assign(null, keys, value));
        }
        else {
            // This might be the result of bad name attributes like "[][foo]",
            // in this case the original `result` object will already be
            // assigned to an object literal. Rather than coerce the object to
            // an array, or cause an exception the attribute "_values" is
            // assigned as an array.
            result._values = result._values || [];
            result._values.push(hash_assign(null, keys, value));
        }

        return result;
    }

    // Key is an attribute name and can be assigned directly.
    if (!between) {
        result[key] = hash_assign(result[key], keys, value);
    }
    else {
        var string = between[1];
        // +var converts the variable into a number
        // better than parseInt because it doesn't truncate away trailing
        // letters and actually fails if whole thing is not a number
        var index = +string;

        // If the characters between the brackets is not a number it is an
        // attribute name and can be assigned directly.
        if (isNaN(index)) {
            result = result || {};
            result[string] = hash_assign(result[string], keys, value);
        }
        else {
            result = result || [];
            result[index] = hash_assign(result[index], keys, value);
        }
    }

    return result;
}

// Object/hash encoding serializer.
function hash_serializer(result, key, value) {
    var matches = key.match(brackets);

    // Has brackets? Use the recursive assignment function to walk the keys,
    // construct any missing objects in the result tree and make the assignment
    // at the end of the chain.
    if (matches) {
        var keys = parse_keys(key);
        hash_assign(result, keys, value);
    }
    else {
        // Non bracket notation can make assignments directly.
        var existing = result[key];

        // If the value has been assigned already (for instance when a radio and
        // a checkbox have the same name attribute) convert the previous value
        // into an array before pushing into it.
        //
        // NOTE: If this requirement were removed all hash creation and
        // assignment could go through `hash_assign`.
        if (existing) {
            if (!Array.isArray(existing)) {
                result[key] = [ existing ];
            }

            result[key].push(value);
        }
        else {
            result[key] = value;
        }
    }

    return result;
}

// urlform encoding serializer
function str_serialize(result, key, value) {
    // encode newlines as \r\n cause the html spec says so
    value = value.replace(/(\r)?\n/g, '\r\n');
    value = encodeURIComponent(value);

    // spaces should be '+' rather than '%20'.
    value = value.replace(/%20/g, '+');
    return result + (result ? '&' : '') + encodeURIComponent(key) + '=' + value;
}

module.exports = serialize;

},{}],3:[function(require,module,exports){
var domify = require('domify')
var serialize = require('form-serialize')

// Build DOM elements for the structure of the dialog
var buildDialogForm = function buildDialogForm (options) {
  var form = document.createElement('form')
  form.classList.add('vex-dialog-form')

  var message = document.createElement('div')
  message.classList.add('vex-dialog-message')
  message.appendChild(options.message instanceof window.Node ? options.message : domify(options.message))

  var input = document.createElement('div')
  input.classList.add('vex-dialog-input')
  input.appendChild(options.input instanceof window.Node ? options.input : domify(options.input))

  form.appendChild(message)
  form.appendChild(input)

  return form
}

// Take an array of buttons (see the default buttons below) and turn them into DOM elements
var buttonsToDOM = function buttonsToDOM (buttons) {
  var domButtons = document.createElement('div')
  domButtons.classList.add('vex-dialog-buttons')

  for (var i = 0; i < buttons.length; i++) {
    var button = buttons[i]
    var domButton = document.createElement('button')
    domButton.type = button.type
    domButton.textContent = button.text
    domButton.className = button.className
    domButton.classList.add('vex-dialog-button')
    if (i === 0) {
      domButton.classList.add('vex-first')
    } else if (i === buttons.length - 1) {
      domButton.classList.add('vex-last')
    }
    // Attach click listener to button with closure
    (function (button) {
      domButton.addEventListener('click', function (e) {
        if (button.click) {
          button.click.call(this, e)
        }
      }.bind(this))
    }.bind(this)(button))

    domButtons.appendChild(domButton)
  }

  return domButtons
}

var plugin = function plugin (vex) {
  // Define the API first
  var dialog = {
    // Plugin name
    name: 'dialog',

    // Open
    open: function open (opts) {
      var options = Object.assign({}, this.defaultOptions, opts)

      // `message` is unsafe internally, so translate
      // safe default: HTML-escape the message before passing it through
      if (options.unsafeMessage && !options.message) {
        options.message = options.unsafeMessage
      } else if (options.message) {
        options.message = vex._escapeHtml(options.message)
      }

      // Build the form from the options
      var form = options.unsafeContent = buildDialogForm(options)

      // Open the dialog
      var dialogInstance = vex.open(options)

      // Quick comment - these options and appending buttons and everything
      // would preferably be done _before_ opening the dialog. However, since
      // they rely on the context of the vex instance, we have to do them
      // after. A potential future fix would be to differentiate between
      // a "created" vex instance and an "opened" vex instance, so any actions
      // that rely on the specific context of the instance can do their stuff
      // before opening the dialog on the page.

      // Override the before close callback to also pass the value of the form
      var beforeClose = options.beforeClose && options.beforeClose.bind(dialogInstance)
      dialogInstance.options.beforeClose = function dialogBeforeClose () {
        // Only call the callback once - when the validation in beforeClose, if present, is true
        var shouldClose = beforeClose ? beforeClose() : true
        if (shouldClose) {
          options.callback(this.value || false)
        }
        // Return the result of beforeClose() to vex
        return shouldClose
      }.bind(dialogInstance)

      // Append buttons to form with correct context
      form.appendChild(buttonsToDOM.call(dialogInstance, options.buttons))

      // Attach form to instance
      dialogInstance.form = form

      // Add submit listener to form
      form.addEventListener('submit', options.onSubmit.bind(dialogInstance))

      // Optionally focus the first input in the form
      if (options.focusFirstInput) {
        var el = dialogInstance.contentEl.querySelector('button, input, select, textarea')
        if (el) {
          el.focus()
        }
      }

      // For chaining
      return dialogInstance
    },

    // Alert
    alert: function (options) {
      // Allow string as message
      if (typeof options === 'string') {
        options = {
          message: options
        }
      }
      options = Object.assign({}, this.defaultOptions, this.defaultAlertOptions, options)
      return this.open(options)
    },

    // Confirm
    confirm: function (options) {
      if (typeof options !== 'object' || typeof options.callback !== 'function') {
        throw new Error('dialog.confirm(options) requires options.callback.')
      }
      options = Object.assign({}, this.defaultOptions, this.defaultConfirmOptions, options)
      return this.open(options)
    },

    // Prompt
    prompt: function (options) {
      if (typeof options !== 'object' || typeof options.callback !== 'function') {
        throw new Error('dialog.prompt(options) requires options.callback.')
      }
      var defaults = Object.assign({}, this.defaultOptions, this.defaultPromptOptions)
      var dynamicDefaults = {
        unsafeMessage: '<label for="vex">' + vex._escapeHtml(options.label || defaults.label) + '</label>',
        input: '<input name="vex" type="text" class="vex-dialog-prompt-input" placeholder="' + vex._escapeHtml(options.placeholder || defaults.placeholder) + '" value="' + vex._escapeHtml(options.value || defaults.value) + '" />'
      }
      options = Object.assign(defaults, dynamicDefaults, options)
      // Pluck the value of the "vex" input field as the return value for prompt's callback
      // More closely mimics "window.prompt" in that a single string is returned
      var callback = options.callback
      options.callback = function promptCallback (value) {
        if (typeof value === 'object') {
          var keys = Object.keys(value)
          value = keys.length ? value[keys[0]] : ''
        }
        callback(value)
      }
      return this.open(options)
    }
  }

  // Now define any additional data that's not the direct dialog API
  dialog.buttons = {
    YES: {
      text: 'OK',
      type: 'submit',
      className: 'vex-dialog-button-primary',
      click: function yesClick () {
        this.value = true
      }
    },

    NO: {
      text: 'Cancel',
      type: 'button',
      className: 'vex-dialog-button-secondary',
      click: function noClick () {
        this.value = false
        this.close()
      }
    }
  }

  dialog.defaultOptions = {
    callback: function () {},
    afterOpen: function () {},
    message: '',
    input: '',
    buttons: [
      dialog.buttons.YES,
      dialog.buttons.NO
    ],
    showCloseButton: false,
    onSubmit: function onDialogSubmit (e) {
      e.preventDefault()
      if (this.options.input) {
        this.value = serialize(this.form, { hash: true })
      }
      return this.close()
    },
    focusFirstInput: true
  }

  dialog.defaultAlertOptions = {
    buttons: [
      dialog.buttons.YES
    ]
  }

  dialog.defaultPromptOptions = {
    label: 'Prompt:',
    placeholder: '',
    value: ''
  }

  dialog.defaultConfirmOptions = {}

  return dialog
}

module.exports = plugin

},{"domify":1,"form-serialize":2}]},{},[3])(3)
});
}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"domify":15,"form-serialize":18}],28:[function(require,module,exports){
(function (global){(function (){
(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.vex = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*
 * classList.js: Cross-browser full element.classList implementation.
 * 2014-07-23
 *
 * By Eli Grey, http://eligrey.com
 * Public Domain.
 * NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.
 */

/*global self, document, DOMException */

/*! @source http://purl.eligrey.com/github/classList.js/blob/master/classList.js*/

/* Copied from MDN:
 * https://developer.mozilla.org/en-US/docs/Web/API/Element/classList
 */

if ("document" in window.self) {

  // Full polyfill for browsers with no classList support
  // Including IE < Edge missing SVGElement.classList
  if (!("classList" in document.createElement("_"))
    || document.createElementNS && !("classList" in document.createElementNS("http://www.w3.org/2000/svg","g"))) {

  (function (view) {

    "use strict";

    if (!('Element' in view)) return;

    var
        classListProp = "classList"
      , protoProp = "prototype"
      , elemCtrProto = view.Element[protoProp]
      , objCtr = Object
      , strTrim = String[protoProp].trim || function () {
        return this.replace(/^\s+|\s+$/g, "");
      }
      , arrIndexOf = Array[protoProp].indexOf || function (item) {
        var
            i = 0
          , len = this.length
        ;
        for (; i < len; i++) {
          if (i in this && this[i] === item) {
            return i;
          }
        }
        return -1;
      }
      // Vendors: please allow content code to instantiate DOMExceptions
      , DOMEx = function (type, message) {
        this.name = type;
        this.code = DOMException[type];
        this.message = message;
      }
      , checkTokenAndGetIndex = function (classList, token) {
        if (token === "") {
          throw new DOMEx(
              "SYNTAX_ERR"
            , "An invalid or illegal string was specified"
          );
        }
        if (/\s/.test(token)) {
          throw new DOMEx(
              "INVALID_CHARACTER_ERR"
            , "String contains an invalid character"
          );
        }
        return arrIndexOf.call(classList, token);
      }
      , ClassList = function (elem) {
        var
            trimmedClasses = strTrim.call(elem.getAttribute("class") || "")
          , classes = trimmedClasses ? trimmedClasses.split(/\s+/) : []
          , i = 0
          , len = classes.length
        ;
        for (; i < len; i++) {
          this.push(classes[i]);
        }
        this._updateClassName = function () {
          elem.setAttribute("class", this.toString());
        };
      }
      , classListProto = ClassList[protoProp] = []
      , classListGetter = function () {
        return new ClassList(this);
      }
    ;
    // Most DOMException implementations don't allow calling DOMException's toString()
    // on non-DOMExceptions. Error's toString() is sufficient here.
    DOMEx[protoProp] = Error[protoProp];
    classListProto.item = function (i) {
      return this[i] || null;
    };
    classListProto.contains = function (token) {
      token += "";
      return checkTokenAndGetIndex(this, token) !== -1;
    };
    classListProto.add = function () {
      var
          tokens = arguments
        , i = 0
        , l = tokens.length
        , token
        , updated = false
      ;
      do {
        token = tokens[i] + "";
        if (checkTokenAndGetIndex(this, token) === -1) {
          this.push(token);
          updated = true;
        }
      }
      while (++i < l);

      if (updated) {
        this._updateClassName();
      }
    };
    classListProto.remove = function () {
      var
          tokens = arguments
        , i = 0
        , l = tokens.length
        , token
        , updated = false
        , index
      ;
      do {
        token = tokens[i] + "";
        index = checkTokenAndGetIndex(this, token);
        while (index !== -1) {
          this.splice(index, 1);
          updated = true;
          index = checkTokenAndGetIndex(this, token);
        }
      }
      while (++i < l);

      if (updated) {
        this._updateClassName();
      }
    };
    classListProto.toggle = function (token, force) {
      token += "";

      var
          result = this.contains(token)
        , method = result ?
          force !== true && "remove"
        :
          force !== false && "add"
      ;

      if (method) {
        this[method](token);
      }

      if (force === true || force === false) {
        return force;
      } else {
        return !result;
      }
    };
    classListProto.toString = function () {
      return this.join(" ");
    };

    if (objCtr.defineProperty) {
      var classListPropDesc = {
          get: classListGetter
        , enumerable: true
        , configurable: true
      };
      try {
        objCtr.defineProperty(elemCtrProto, classListProp, classListPropDesc);
      } catch (ex) { // IE 8 doesn't support enumerable:true
        if (ex.number === -0x7FF5EC54) {
          classListPropDesc.enumerable = false;
          objCtr.defineProperty(elemCtrProto, classListProp, classListPropDesc);
        }
      }
    } else if (objCtr[protoProp].__defineGetter__) {
      elemCtrProto.__defineGetter__(classListProp, classListGetter);
    }

    }(window.self));

    } else {
    // There is full or partial native classList support, so just check if we need
    // to normalize the add/remove and toggle APIs.

    (function () {
      "use strict";

      var testElement = document.createElement("_");

      testElement.classList.add("c1", "c2");

      // Polyfill for IE 10/11 and Firefox <26, where classList.add and
      // classList.remove exist but support only one argument at a time.
      if (!testElement.classList.contains("c2")) {
        var createMethod = function(method) {
          var original = DOMTokenList.prototype[method];

          DOMTokenList.prototype[method] = function(token) {
            var i, len = arguments.length;

            for (i = 0; i < len; i++) {
              token = arguments[i];
              original.call(this, token);
            }
          };
        };
        createMethod('add');
        createMethod('remove');
      }

      testElement.classList.toggle("c3", false);

      // Polyfill for IE 10 and Firefox <24, where classList.toggle does not
      // support the second argument.
      if (testElement.classList.contains("c3")) {
        var _toggle = DOMTokenList.prototype.toggle;

        DOMTokenList.prototype.toggle = function(token, force) {
          if (1 in arguments && !this.contains(token) === !force) {
            return force;
          } else {
            return _toggle.call(this, token);
          }
        };

      }

      testElement = null;
    }());
  }
}

},{}],2:[function(require,module,exports){

/**
 * Expose `parse`.
 */

module.exports = parse;

/**
 * Tests for browser support.
 */

var innerHTMLBug = false;
var bugTestDiv;
if (typeof document !== 'undefined') {
  bugTestDiv = document.createElement('div');
  // Setup
  bugTestDiv.innerHTML = '  <link/><table></table><a href="/a">a</a><input type="checkbox"/>';
  // Make sure that link elements get serialized correctly by innerHTML
  // This requires a wrapper element in IE
  innerHTMLBug = !bugTestDiv.getElementsByTagName('link').length;
  bugTestDiv = undefined;
}

/**
 * Wrap map from jquery.
 */

var map = {
  legend: [1, '<fieldset>', '</fieldset>'],
  tr: [2, '<table><tbody>', '</tbody></table>'],
  col: [2, '<table><tbody></tbody><colgroup>', '</colgroup></table>'],
  // for script/link/style tags to work in IE6-8, you have to wrap
  // in a div with a non-whitespace character in front, ha!
  _default: innerHTMLBug ? [1, 'X<div>', '</div>'] : [0, '', '']
};

map.td =
map.th = [3, '<table><tbody><tr>', '</tr></tbody></table>'];

map.option =
map.optgroup = [1, '<select multiple="multiple">', '</select>'];

map.thead =
map.tbody =
map.colgroup =
map.caption =
map.tfoot = [1, '<table>', '</table>'];

map.polyline =
map.ellipse =
map.polygon =
map.circle =
map.text =
map.line =
map.path =
map.rect =
map.g = [1, '<svg xmlns="http://www.w3.org/2000/svg" version="1.1">','</svg>'];

/**
 * Parse `html` and return a DOM Node instance, which could be a TextNode,
 * HTML DOM Node of some kind (<div> for example), or a DocumentFragment
 * instance, depending on the contents of the `html` string.
 *
 * @param {String} html - HTML string to "domify"
 * @param {Document} doc - The `document` instance to create the Node for
 * @return {DOMNode} the TextNode, DOM Node, or DocumentFragment instance
 * @api private
 */

function parse(html, doc) {
  if ('string' != typeof html) throw new TypeError('String expected');

  // default to the global `document` object
  if (!doc) doc = document;

  // tag name
  var m = /<([\w:]+)/.exec(html);
  if (!m) return doc.createTextNode(html);

  html = html.replace(/^\s+|\s+$/g, ''); // Remove leading/trailing whitespace

  var tag = m[1];

  // body support
  if (tag == 'body') {
    var el = doc.createElement('html');
    el.innerHTML = html;
    return el.removeChild(el.lastChild);
  }

  // wrap map
  var wrap = map[tag] || map._default;
  var depth = wrap[0];
  var prefix = wrap[1];
  var suffix = wrap[2];
  var el = doc.createElement('div');
  el.innerHTML = prefix + html + suffix;
  while (depth--) el = el.lastChild;

  // one element
  if (el.firstChild == el.lastChild) {
    return el.removeChild(el.firstChild);
  }

  // several elements
  var fragment = doc.createDocumentFragment();
  while (el.firstChild) {
    fragment.appendChild(el.removeChild(el.firstChild));
  }

  return fragment;
}

},{}],3:[function(require,module,exports){
/**
 * Code refactored from Mozilla Developer Network:
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign
 */

'use strict';

function assign(target, firstSource) {
  if (target === undefined || target === null) {
    throw new TypeError('Cannot convert first argument to object');
  }

  var to = Object(target);
  for (var i = 1; i < arguments.length; i++) {
    var nextSource = arguments[i];
    if (nextSource === undefined || nextSource === null) {
      continue;
    }

    var keysArray = Object.keys(Object(nextSource));
    for (var nextIndex = 0, len = keysArray.length; nextIndex < len; nextIndex++) {
      var nextKey = keysArray[nextIndex];
      var desc = Object.getOwnPropertyDescriptor(nextSource, nextKey);
      if (desc !== undefined && desc.enumerable) {
        to[nextKey] = nextSource[nextKey];
      }
    }
  }
  return to;
}

function polyfill() {
  if (!Object.assign) {
    Object.defineProperty(Object, 'assign', {
      enumerable: false,
      configurable: true,
      writable: true,
      value: assign
    });
  }
}

module.exports = {
  assign: assign,
  polyfill: polyfill
};

},{}],4:[function(require,module,exports){
// classList polyfill for old browsers
require('classlist-polyfill')
// Object.assign polyfill
require('es6-object-assign').polyfill()

// String to DOM function
var domify = require('domify')

// Use the DOM's HTML parsing to escape any dangerous strings
var escapeHtml = function escapeHtml (str) {
  if (typeof str !== 'undefined') {
    var div = document.createElement('div')
    div.appendChild(document.createTextNode(str))
    return div.innerHTML
  } else {
    return ''
  }
}

// Utility function to add space-delimited class strings to a DOM element's classList
var addClasses = function addClasses (el, classStr) {
  if (typeof classStr !== 'string' || classStr.length === 0) {
    return
  }
  var classes = classStr.split(' ')
  for (var i = 0; i < classes.length; i++) {
    var className = classes[i]
    if (className.length) {
      el.classList.add(className)
    }
  }
}

// Detect CSS Animation End Support
// https://github.com/limonte/sweetalert2/blob/99bd539f85e15ac170f69d35001d12e092ef0054/src/utils/dom.js#L194
var animationEndEvent = (function detectAnimationEndEvent () {
  var el = document.createElement('div')
  var eventNames = {
    'WebkitAnimation': 'webkitAnimationEnd',
    'MozAnimation': 'animationend',
    'OAnimation': 'oanimationend',
    'msAnimation': 'MSAnimationEnd',
    'animation': 'animationend'
  }
  for (var i in eventNames) {
    if (el.style[i] !== undefined) {
      return eventNames[i]
    }
  }
  return false
})()

// vex base CSS classes
var baseClassNames = {
  vex: 'vex',
  content: 'vex-content',
  overlay: 'vex-overlay',
  close: 'vex-close',
  closing: 'vex-closing',
  open: 'vex-open'
}

// Private lookup table of all open vex objects, keyed by id
var vexes = {}
var globalId = 1

// Private boolean to assist the escapeButtonCloses option
var isEscapeActive = false

// vex itself is an object that exposes a simple API to open and close vex objects in various ways
var vex = {
  open: function open (opts) {
    // Check for usage of deprecated options, and log a warning
    var warnDeprecated = function warnDeprecated (prop) {
      console.warn('The "' + prop + '" property is deprecated in vex 3. Use CSS classes and the appropriate "ClassName" options, instead.')
      console.warn('See http://github.hubspot.com/vex/api/advanced/#options')
    }
    if (opts.css) {
      warnDeprecated('css')
    }
    if (opts.overlayCSS) {
      warnDeprecated('overlayCSS')
    }
    if (opts.contentCSS) {
      warnDeprecated('contentCSS')
    }
    if (opts.closeCSS) {
      warnDeprecated('closeCSS')
    }

    // The dialog instance
    var vexInstance = {}

    // Set id
    vexInstance.id = globalId++

    // Store internally
    vexes[vexInstance.id] = vexInstance

    // Set state
    vexInstance.isOpen = true

    // Close function on the vex instance
    // This is how all API functions should close individual vexes
    vexInstance.close = function instanceClose () {
      // Check state
      if (!this.isOpen) {
        return true
      }

      var options = this.options

      // escapeButtonCloses is checked first
      if (isEscapeActive && !options.escapeButtonCloses) {
        return false
      }

      // Allow the user to validate any info or abort the close with the beforeClose callback
      var shouldClose = (function shouldClose () {
        // Call before close callback
        if (options.beforeClose) {
          return options.beforeClose.call(this)
        }
        // Otherwise indicate that it's ok to continue with close
        return true
      }.bind(this)())

      // If beforeClose() fails, abort the close
      if (shouldClose === false) {
        return false
      }

      // Update state
      this.isOpen = false

      // Detect if the content el has any CSS animations defined
      var style = window.getComputedStyle(this.contentEl)
      function hasAnimationPre (prefix) {
        return style.getPropertyValue(prefix + 'animation-name') !== 'none' && style.getPropertyValue(prefix + 'animation-duration') !== '0s'
      }
      var hasAnimation = hasAnimationPre('') || hasAnimationPre('-webkit-') || hasAnimationPre('-moz-') || hasAnimationPre('-o-')

      // Define the function that will actually close the instance
      var close = function close () {
        if (!this.rootEl.parentNode) {
          return
        }
        // Run once
        this.rootEl.removeEventListener(animationEndEvent, close)
        // Remove from lookup table (prevent memory leaks)
        delete vexes[this.id]
        // Remove the dialog from the DOM
        this.rootEl.parentNode.removeChild(this.rootEl)
        // Call after close callback
        if (options.afterClose) {
          options.afterClose.call(this)
        }
        // Remove styling from the body, if no more vexes are open
        if (Object.keys(vexes).length === 0) {
          document.body.classList.remove(baseClassNames.open)
        }
      }.bind(this)

      // Close the vex
      if (animationEndEvent && hasAnimation) {
        // Setup the end event listener, to remove the el from the DOM
        this.rootEl.addEventListener(animationEndEvent, close)
        // Add the closing class to the dialog, showing the close animation
        this.rootEl.classList.add(baseClassNames.closing)
      } else {
        close()
      }

      return true
    }

    // Allow strings as content
    if (typeof opts === 'string') {
      opts = {
        content: opts
      }
    }

    // `content` is unsafe internally, so translate
    // safe default: HTML-escape the content before passing it through
    if (opts.unsafeContent && !opts.content) {
      opts.content = opts.unsafeContent
    } else if (opts.content) {
      opts.content = escapeHtml(opts.content)
    }

    // Store options on instance for future reference
    var options = vexInstance.options = Object.assign({}, vex.defaultOptions, opts)

    // vex root
    var rootEl = vexInstance.rootEl = document.createElement('div')
    rootEl.classList.add(baseClassNames.vex)
    addClasses(rootEl, options.className)

    // Overlay
    var overlayEl = vexInstance.overlayEl = document.createElement('div')
    overlayEl.classList.add(baseClassNames.overlay)
    addClasses(overlayEl, options.overlayClassName)
    if (options.overlayClosesOnClick) {
      overlayEl.addEventListener('click', function overlayClickListener (e) {
        if (e.target === overlayEl) {
          vexInstance.close()
        }
      })
    }
    rootEl.appendChild(overlayEl)

    // Content
    var contentEl = vexInstance.contentEl = document.createElement('div')
    contentEl.classList.add(baseClassNames.content)
    addClasses(contentEl, options.contentClassName)
    contentEl.appendChild(options.content instanceof window.Node ? options.content : domify(options.content))
    rootEl.appendChild(contentEl)

    // Close button
    if (options.showCloseButton) {
      var closeEl = vexInstance.closeEl = document.createElement('div')
      closeEl.classList.add(baseClassNames.close)
      addClasses(closeEl, options.closeClassName)
      closeEl.addEventListener('click', vexInstance.close.bind(vexInstance))
      contentEl.appendChild(closeEl)
    }

    // Add to DOM
    document.querySelector(options.appendLocation).appendChild(rootEl)

    // Call after open callback
    if (options.afterOpen) {
      options.afterOpen.call(vexInstance)
    }

    // Apply styling to the body
    document.body.classList.add(baseClassNames.open)

    // Return the created vex instance
    return vexInstance
  },

  // A top-level vex.close function to close dialogs by reference or id
  close: function close (vexOrId) {
    var id
    if (vexOrId.id) {
      id = vexOrId.id
    } else if (typeof vexOrId === 'string') {
      id = vexOrId
    } else {
      throw new TypeError('close requires a vex object or id string')
    }
    if (!vexes[id]) {
      return false
    }
    return vexes[id].close()
  },

  // Close the most recently created/opened vex
  closeTop: function closeTop () {
    var ids = Object.keys(vexes)
    if (!ids.length) {
      return false
    }
    return vexes[ids[ids.length - 1]].close()
  },

  // Close every vex!
  closeAll: function closeAll () {
    for (var id in vexes) {
      this.close(id)
    }
    return true
  },

  // A getter for the internal lookup table
  getAll: function getAll () {
    return vexes
  },

  // A getter for the internal lookup table
  getById: function getById (id) {
    return vexes[id]
  }
}

// Close top vex on escape
window.addEventListener('keyup', function vexKeyupListener (e) {
  if (e.keyCode === 27) {
    isEscapeActive = true
    vex.closeTop()
    isEscapeActive = false
  }
})

// Close all vexes on history pop state (useful in single page apps)
window.addEventListener('popstate', function () {
  if (vex.defaultOptions.closeAllOnPopState) {
    vex.closeAll()
  }
})

vex.defaultOptions = {
  content: '',
  showCloseButton: true,
  escapeButtonCloses: true,
  overlayClosesOnClick: true,
  appendLocation: 'body',
  className: '',
  overlayClassName: '',
  contentClassName: '',
  closeClassName: '',
  closeAllOnPopState: true
}

// TODO Loading symbols?

// Include escapeHtml function on the library object
Object.defineProperty(vex, '_escapeHtml', {
  configurable: false,
  enumerable: false,
  writable: false,
  value: escapeHtml
})

// Plugin system!
vex.registerPlugin = function registerPlugin (pluginFn, name) {
  var plugin = pluginFn(vex)
  var pluginName = name || plugin.name
  if (vex[pluginName]) {
    throw new Error('Plugin ' + name + ' is already registered.')
  }
  vex[pluginName] = plugin
}

module.exports = vex

},{"classlist-polyfill":1,"domify":2,"es6-object-assign":3}]},{},[4])(4)
});
}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"classlist-polyfill":10,"domify":15,"es6-object-assign":17}],29:[function(require,module,exports){
(function (global){(function (){
(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.VideoStreamMerger = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";module.exports=VideoStreamMerger;function VideoStreamMerger(a){if(!(this instanceof VideoStreamMerger))return new VideoStreamMerger(a);a=a||{};var b=window.AudioContext||window.webkitAudioContext,c=!!(b&&(this._audioCtx=a.audioContext||new b).createMediaStreamDestination),d=!!document.createElement("canvas").captureStream;if(!(c&&d))throw new Error("Unsupported browser");this.width=a.width||640,this.height=a.height||480,this.fps=a.fps||25,this.clearRect=!(a.clearRect!==void 0)||a.clearRect,this._canvas=document.createElement("canvas"),this._canvas.setAttribute("width",this.width),this._canvas.setAttribute("height",this.height),this._canvas.setAttribute("style","position:fixed; left: 110%; pointer-events: none"),this._ctx=this._canvas.getContext("2d"),this._streams=[],this._frameCount=0,this._audioDestination=this._audioCtx.createMediaStreamDestination(),this._videoSyncDelayNode=this._audioCtx.createDelay(5),this._videoSyncDelayNode.connect(this._audioDestination),this._setupConstantNode(),this.started=!1,this.result=null,this._backgroundAudioHack()}VideoStreamMerger.prototype.setOutputSize=function(a,b){this.width=a,this.height=b,this._canvas.setAttribute("width",this.width),this._canvas.setAttribute("height",this.height)},VideoStreamMerger.prototype.getAudioContext=function(){return this._audioCtx},VideoStreamMerger.prototype.getAudioDestination=function(){return this._audioDestination},VideoStreamMerger.prototype.getCanvasContext=function(){return this._ctx},VideoStreamMerger.prototype._backgroundAudioHack=function(){var a=this._audioCtx.createConstantSource(),b=this._audioCtx.createGain();b.gain.value=.001,a.connect(b),b.connect(this._audioCtx.destination),a.start()},VideoStreamMerger.prototype._setupConstantNode=function(){var a=this._audioCtx.createConstantSource();a.start();var b=this._audioCtx.createGain();b.gain.value=0,a.connect(b),b.connect(this._videoSyncDelayNode)},VideoStreamMerger.prototype.updateIndex=function(a,b){"string"==typeof a&&(a={id:a}),b=null==b?0:b;for(var c=0;c<this._streams.length;c++)a.id===this._streams[c].id&&(this._streams[c].index=b);this._sortStreams()},VideoStreamMerger.prototype._sortStreams=function(){this._streams=this._streams.sort(function(c,a){return c.index-a.index})},VideoStreamMerger.prototype.addMediaElement=function(a,b,c){var d=this;if(c=c||{},c.x=c.x||0,c.y=c.y||0,c.width=c.width,c.height=c.height,c.mute=c.mute||c.muted||!1,c.oldDraw=c.draw,c.oldAudioEffect=c.audioEffect,c.draw="VIDEO"===b.tagName||"IMG"===b.tagName?function(a,e,f){if(c.oldDraw)c.oldDraw(a,b,f);else{var g=null==c.width?d.width:c.width,h=null==c.height?d.height:c.height;a.drawImage(b,c.x,c.y,g,h),f()}}:null,!c.mute){var e=b._mediaElementSource||this.getAudioContext().createMediaElementSource(b);b._mediaElementSource=e,e.connect(this.getAudioContext().destination);var f=this.getAudioContext().createGain();e.connect(f),b.muted?(b.muted=!1,b.volume=.001,f.gain.value=1e3):f.gain.value=1,c.audioEffect=function(a,b){c.oldAudioEffect?c.oldAudioEffect(f,b):f.connect(b)},c.oldAudioEffect=null}this.addStream(a,c)},VideoStreamMerger.prototype.addStream=function(a,b){if("string"==typeof a)return this._addData(a,b);b=b||{};for(var c={isData:!1,x:b.x||0,y:b.y||0,width:b.width,height:b.height,draw:b.draw||null,mute:b.mute||b.muted||!1,audioEffect:b.audioEffect||null,index:null==b.index?0:b.index,hasVideo:0<a.getVideoTracks().length},d=null,e=0;e<this._streams.length;e++)this._streams[e].id===a.id&&(d=this._streams[e].element);d||(d=document.createElement("video"),d.autoplay=!0,d.muted=!0,d.srcObject=a,d.setAttribute("style","position:fixed; left: 0px; top:0px; pointer-events: none; opacity:0;"),document.body.appendChild(d),!c.mute&&(c.audioSource=this._audioCtx.createMediaStreamSource(a),c.audioOutput=this._audioCtx.createGain(),c.audioOutput.gain.value=1,c.audioEffect?c.audioEffect(c.audioSource,c.audioOutput):c.audioSource.connect(c.audioOutput),c.audioOutput.connect(this._videoSyncDelayNode))),c.element=d,c.id=a.id||null,this._streams.push(c),this._sortStreams()},VideoStreamMerger.prototype.removeStream=function(a){"string"==typeof a&&(a={id:a});for(var b,c=0;c<this._streams.length;c++)b=this._streams[c],a.id===b.id&&(b.audioSource&&(b.audioSource=null),b.audioOutput&&(b.audioOutput.disconnect(this._videoSyncDelayNode),b.audioOutput=null),b.element&&b.element.remove(),this._streams[c]=null,this._streams.splice(c,1),c--)},VideoStreamMerger.prototype._addData=function(a,b){b=b||{};var c={};c.isData=!0,c.draw=b.draw||null,c.audioEffect=b.audioEffect||null,c.id=a,c.element=null,c.index=null==b.index?0:b.index,c.audioEffect&&(c.audioOutput=this._audioCtx.createGain(),c.audioOutput.gain.value=1,c.audioEffect(null,c.audioOutput),c.audioOutput.connect(this._videoSyncDelayNode)),this._streams.push(c),this._sortStreams()},VideoStreamMerger.prototype._requestAnimationFrame=function(a){var b=!1,c=setInterval(function(){!b&&document.hidden&&(b=!0,clearInterval(c),a())},1e3/this.fps);requestAnimationFrame(function(){b||(b=!0,clearInterval(c),a())})},VideoStreamMerger.prototype.start=function(){this.started=!0,this._requestAnimationFrame(this._draw.bind(this)),this.result=this._canvas.captureStream(this.fps);var a=this.result.getAudioTracks()[0];a&&this.result.removeTrack(a);var b=this._audioDestination.stream.getAudioTracks();this.result.addTrack(b[0])},VideoStreamMerger.prototype._updateAudioDelay=function(a){this._videoSyncDelayNode.delayTime.setValueAtTime(a/1e3,this._audioCtx.currentTime)},VideoStreamMerger.prototype._draw=function(){var a=this;if(this.started){this._frameCount++;var b=null;0==this._frameCount%60&&(b=performance.now());var c=this._streams.length,d=function(){if(c--,0>=c){if(0==a._frameCount%60){var d=performance.now();a._updateAudioDelay(d-b)}a._requestAnimationFrame(a._draw.bind(a))}};this.clearRect&&this._ctx.clearRect(0,0,this.width,this.height),this._streams.forEach(function(b){if(b.draw)b.draw(a._ctx,b.element,d);else if(!b.isData&&b.hasVideo){var c=null==b.width?a.width:b.width,e=null==b.height?a.height:b.height;a._ctx.drawImage(b.element,b.x,b.y,c,e),d()}else d()}),0===this._streams.length&&d()}},VideoStreamMerger.prototype.destroy=function(){this.started=!1,this._canvas=null,this._ctx=null,this._streams.forEach(function(a){a.element&&a.element.remove()}),this._streams=[],this._audioCtx.close(),this._audioCtx=null,this._audioDestination=null,this._videoSyncDelayNode=null,this.result.getTracks().forEach(function(a){a.stop()}),this.result=null};

},{}]},{},[1])(1)
});

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],30:[function(require,module,exports){
var raf = require('raf');

module.exports = VolumeMeter

function VolumeMeter (context, opts, onenterframe) {
  if (typeof opts === 'function') {
    onenterframe = opts
    opts = null
  }
  opts = opts || {}
  opts.fftSize = opts.fftSize || 32
  opts.tweenIn = opts.tweenIn || 1.618
  opts.tweenOut = opts.tweenOut || opts.tweenIn * 3

  var buffer, self = this
  var range, next, tween, handle, last = 0
  var analyser = context.createAnalyser()

  analyser.stop = function () {
    this.ended = true
    raf.cancel(handle)
  }

  // the fftSize property governs the sample size even
  // when we are not requesting frequency domain data
  analyser.fftSize = opts.fftSize
  buffer = new Uint8Array(opts.fftSize)

  function render () {
    if (analyser.ended) return

    analyser.getByteTimeDomainData(buffer)
    range = getDynamicRange(buffer) * (Math.E - 1)
    next = Math.floor(Math.log1p(range) * 100)
    tween = next > last ? opts.tweenIn : opts.tweenOut
    next = last = last + (next - last) / tween

    onenterframe(next)
    handle = raf(render)
  }

  render()

  return analyser
}

function getDynamicRange(buffer) {
  var len = buffer.length
  var min = 128
  var max = 128

  for (var i = 0; i < len; i++) {
    var sample = buffer[i]
    if (sample < min) min = sample
    else if (sample > max) max = sample
  }

  return (max - min) / 255
}

},{"raf":25}],31:[function(require,module,exports){
/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
 /* eslint-env node */

'use strict';

// Shimming starts here.
(function() {
  // Utils.
  var logging = require('./utils').log;
  var browserDetails = require('./utils').browserDetails;
  // Export to the adapter global object visible in the browser.
  module.exports.browserDetails = browserDetails;
  module.exports.extractVersion = require('./utils').extractVersion;
  module.exports.disableLog = require('./utils').disableLog;

  // Uncomment the line below if you want logging to occur, including logging
  // for the switch statement below. Can also be turned on in the browser via
  // adapter.disableLog(false), but then logging from the switch statement below
  // will not appear.
  // require('./utils').disableLog(false);

  // Browser shims.
  var chromeShim = require('./chrome/chrome_shim') || null;
  var edgeShim = require('./edge/edge_shim') || null;
  var firefoxShim = require('./firefox/firefox_shim') || null;
  var safariShim = require('./safari/safari_shim') || null;

  // Shim browser if found.
  switch (browserDetails.browser) {
    case 'opera': // fallthrough as it uses chrome shims
    case 'chrome':
      if (!chromeShim || !chromeShim.shimPeerConnection) {
        logging('Chrome shim is not included in this adapter release.');
        return;
      }
      logging('adapter.js shimming chrome.');
      // Export to the adapter global object visible in the browser.
      module.exports.browserShim = chromeShim;

      chromeShim.shimGetUserMedia();
      chromeShim.shimMediaStream();
      chromeShim.shimSourceObject();
      chromeShim.shimPeerConnection();
      chromeShim.shimOnTrack();
      break;
    case 'firefox':
      if (!firefoxShim || !firefoxShim.shimPeerConnection) {
        logging('Firefox shim is not included in this adapter release.');
        return;
      }
      logging('adapter.js shimming firefox.');
      // Export to the adapter global object visible in the browser.
      module.exports.browserShim = firefoxShim;

      firefoxShim.shimGetUserMedia();
      firefoxShim.shimSourceObject();
      firefoxShim.shimPeerConnection();
      firefoxShim.shimOnTrack();
      break;
    case 'edge':
      if (!edgeShim || !edgeShim.shimPeerConnection) {
        logging('MS edge shim is not included in this adapter release.');
        return;
      }
      logging('adapter.js shimming edge.');
      // Export to the adapter global object visible in the browser.
      module.exports.browserShim = edgeShim;

      edgeShim.shimGetUserMedia();
      edgeShim.shimPeerConnection();
      break;
    case 'safari':
      if (!safariShim) {
        logging('Safari shim is not included in this adapter release.');
        return;
      }
      logging('adapter.js shimming safari.');
      // Export to the adapter global object visible in the browser.
      module.exports.browserShim = safariShim;

      safariShim.shimGetUserMedia();
      break;
    default:
      logging('Unsupported browser!');
  }
})();

},{"./chrome/chrome_shim":32,"./edge/edge_shim":34,"./firefox/firefox_shim":36,"./safari/safari_shim":38,"./utils":39}],32:[function(require,module,exports){

/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
 /* eslint-env node */
'use strict';
var logging = require('../utils.js').log;
var browserDetails = require('../utils.js').browserDetails;

var chromeShim = {
  shimMediaStream: function() {
    window.MediaStream = window.MediaStream || window.webkitMediaStream;
  },

  shimOnTrack: function() {
    if (typeof window === 'object' && window.RTCPeerConnection && !('ontrack' in
        window.RTCPeerConnection.prototype)) {
      Object.defineProperty(window.RTCPeerConnection.prototype, 'ontrack', {
        get: function() {
          return this._ontrack;
        },
        set: function(f) {
          var self = this;
          if (this._ontrack) {
            this.removeEventListener('track', this._ontrack);
            this.removeEventListener('addstream', this._ontrackpoly);
          }
          this.addEventListener('track', this._ontrack = f);
          this.addEventListener('addstream', this._ontrackpoly = function(e) {
            // onaddstream does not fire when a track is added to an existing
            // stream. But stream.onaddtrack is implemented so we use that.
            e.stream.addEventListener('addtrack', function(te) {
              var event = new Event('track');
              event.track = te.track;
              event.receiver = {track: te.track};
              event.streams = [e.stream];
              self.dispatchEvent(event);
            });
            e.stream.getTracks().forEach(function(track) {
              var event = new Event('track');
              event.track = track;
              event.receiver = {track: track};
              event.streams = [e.stream];
              this.dispatchEvent(event);
            }.bind(this));
          }.bind(this));
        }
      });
    }
  },

  shimSourceObject: function() {
    if (typeof window === 'object') {
      if (window.HTMLMediaElement &&
        !('srcObject' in window.HTMLMediaElement.prototype)) {
        // Shim the srcObject property, once, when HTMLMediaElement is found.
        Object.defineProperty(window.HTMLMediaElement.prototype, 'srcObject', {
          get: function() {
            return this._srcObject;
          },
          set: function(stream) {
            var self = this;
            // Use _srcObject as a private property for this shim
            this._srcObject = stream;
            if (this.src) {
              URL.revokeObjectURL(this.src);
            }

            if (!stream) {
              this.src = '';
              return;
            }
            this.src = URL.createObjectURL(stream);
            // We need to recreate the blob url when a track is added or
            // removed. Doing it manually since we want to avoid a recursion.
            stream.addEventListener('addtrack', function() {
              if (self.src) {
                URL.revokeObjectURL(self.src);
              }
              self.src = URL.createObjectURL(stream);
            });
            stream.addEventListener('removetrack', function() {
              if (self.src) {
                URL.revokeObjectURL(self.src);
              }
              self.src = URL.createObjectURL(stream);
            });
          }
        });
      }
    }
  },

  shimPeerConnection: function() {
    // The RTCPeerConnection object.
    window.RTCPeerConnection = function(pcConfig, pcConstraints) {
      // Translate iceTransportPolicy to iceTransports,
      // see https://code.google.com/p/webrtc/issues/detail?id=4869
      logging('PeerConnection');
      if (pcConfig && pcConfig.iceTransportPolicy) {
        pcConfig.iceTransports = pcConfig.iceTransportPolicy;
      }

      var pc = new webkitRTCPeerConnection(pcConfig, pcConstraints);
      var origGetStats = pc.getStats.bind(pc);
      pc.getStats = function(selector, successCallback, errorCallback) {
        var self = this;
        var args = arguments;

        // If selector is a function then we are in the old style stats so just
        // pass back the original getStats format to avoid breaking old users.
        if (arguments.length > 0 && typeof selector === 'function') {
          return origGetStats(selector, successCallback);
        }

        var fixChromeStats_ = function(response) {
          var standardReport = {};
          var reports = response.result();
          reports.forEach(function(report) {
            var standardStats = {
              id: report.id,
              timestamp: report.timestamp,
              type: report.type
            };
            report.names().forEach(function(name) {
              standardStats[name] = report.stat(name);
            });
            standardReport[standardStats.id] = standardStats;
          });

          return standardReport;
        };

        // shim getStats with maplike support
        var makeMapStats = function(stats, legacyStats) {
          var map = new Map(Object.keys(stats).map(function(key) {
            return[key, stats[key]];
          }));
          legacyStats = legacyStats || stats;
          Object.keys(legacyStats).forEach(function(key) {
            map[key] = legacyStats[key];
          });
          return map;
        };

        if (arguments.length >= 2) {
          var successCallbackWrapper_ = function(response) {
            args[1](makeMapStats(fixChromeStats_(response)));
          };

          return origGetStats.apply(this, [successCallbackWrapper_,
              arguments[0]]);
        }

        // promise-support
        return new Promise(function(resolve, reject) {
          if (args.length === 1 && typeof selector === 'object') {
            origGetStats.apply(self, [
              function(response) {
                resolve(makeMapStats(fixChromeStats_(response)));
              }, reject]);
          } else {
            // Preserve legacy chrome stats only on legacy access of stats obj
            origGetStats.apply(self, [
              function(response) {
                resolve(makeMapStats(fixChromeStats_(response),
                    response.result()));
              }, reject]);
          }
        }).then(successCallback, errorCallback);
      };

      return pc;
    };
    window.RTCPeerConnection.prototype = webkitRTCPeerConnection.prototype;

    // wrap static methods. Currently just generateCertificate.
    if (webkitRTCPeerConnection.generateCertificate) {
      Object.defineProperty(window.RTCPeerConnection, 'generateCertificate', {
        get: function() {
          return webkitRTCPeerConnection.generateCertificate;
        }
      });
    }

    ['createOffer', 'createAnswer'].forEach(function(method) {
      var nativeMethod = webkitRTCPeerConnection.prototype[method];
      webkitRTCPeerConnection.prototype[method] = function() {
        var self = this;
        if (arguments.length < 1 || (arguments.length === 1 &&
            typeof arguments[0] === 'object')) {
          var opts = arguments.length === 1 ? arguments[0] : undefined;
          return new Promise(function(resolve, reject) {
            nativeMethod.apply(self, [resolve, reject, opts]);
          });
        }
        return nativeMethod.apply(this, arguments);
      };
    });

    // add promise support -- natively available in Chrome 51
    if (browserDetails.version < 51) {
      ['setLocalDescription', 'setRemoteDescription', 'addIceCandidate']
          .forEach(function(method) {
            var nativeMethod = webkitRTCPeerConnection.prototype[method];
            webkitRTCPeerConnection.prototype[method] = function() {
              var args = arguments;
              var self = this;
              var promise = new Promise(function(resolve, reject) {
                nativeMethod.apply(self, [args[0], resolve, reject]);
              });
              if (args.length < 2) {
                return promise;
              }
              return promise.then(function() {
                args[1].apply(null, []);
              },
              function(err) {
                if (args.length >= 3) {
                  args[2].apply(null, [err]);
                }
              });
            };
          });
    }

    // shim implicit creation of RTCSessionDescription/RTCIceCandidate
    ['setLocalDescription', 'setRemoteDescription', 'addIceCandidate']
        .forEach(function(method) {
          var nativeMethod = webkitRTCPeerConnection.prototype[method];
          webkitRTCPeerConnection.prototype[method] = function() {
            arguments[0] = new ((method === 'addIceCandidate') ?
                RTCIceCandidate : RTCSessionDescription)(arguments[0]);
            return nativeMethod.apply(this, arguments);
          };
        });

    // support for addIceCandidate(null or undefined)
    var nativeAddIceCandidate =
        RTCPeerConnection.prototype.addIceCandidate;
    RTCPeerConnection.prototype.addIceCandidate = function() {
      if (!arguments[0]) {
        if (arguments[1]) {
          arguments[1].apply(null);
        }
        return Promise.resolve();
      }
      return nativeAddIceCandidate.apply(this, arguments);
    };
  }
};


// Expose public methods.
module.exports = {
  shimMediaStream: chromeShim.shimMediaStream,
  shimOnTrack: chromeShim.shimOnTrack,
  shimSourceObject: chromeShim.shimSourceObject,
  shimPeerConnection: chromeShim.shimPeerConnection,
  shimGetUserMedia: require('./getusermedia')
};

},{"../utils.js":39,"./getusermedia":33}],33:[function(require,module,exports){
/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
 /* eslint-env node */
'use strict';
var logging = require('../utils.js').log;

// Expose public methods.
module.exports = function() {
  var constraintsToChrome_ = function(c) {
    if (typeof c !== 'object' || c.mandatory || c.optional) {
      return c;
    }
    var cc = {};
    Object.keys(c).forEach(function(key) {
      if (key === 'require' || key === 'advanced' || key === 'mediaSource') {
        return;
      }
      var r = (typeof c[key] === 'object') ? c[key] : {ideal: c[key]};
      if (r.exact !== undefined && typeof r.exact === 'number') {
        r.min = r.max = r.exact;
      }
      var oldname_ = function(prefix, name) {
        if (prefix) {
          return prefix + name.charAt(0).toUpperCase() + name.slice(1);
        }
        return (name === 'deviceId') ? 'sourceId' : name;
      };
      if (r.ideal !== undefined) {
        cc.optional = cc.optional || [];
        var oc = {};
        if (typeof r.ideal === 'number') {
          oc[oldname_('min', key)] = r.ideal;
          cc.optional.push(oc);
          oc = {};
          oc[oldname_('max', key)] = r.ideal;
          cc.optional.push(oc);
        } else {
          oc[oldname_('', key)] = r.ideal;
          cc.optional.push(oc);
        }
      }
      if (r.exact !== undefined && typeof r.exact !== 'number') {
        cc.mandatory = cc.mandatory || {};
        cc.mandatory[oldname_('', key)] = r.exact;
      } else {
        ['min', 'max'].forEach(function(mix) {
          if (r[mix] !== undefined) {
            cc.mandatory = cc.mandatory || {};
            cc.mandatory[oldname_(mix, key)] = r[mix];
          }
        });
      }
    });
    if (c.advanced) {
      cc.optional = (cc.optional || []).concat(c.advanced);
    }
    return cc;
  };

  var shimConstraints_ = function(constraints, func) {
    constraints = JSON.parse(JSON.stringify(constraints));
    if (constraints && constraints.audio) {
      constraints.audio = constraintsToChrome_(constraints.audio);
    }
    if (constraints && typeof constraints.video === 'object') {
      // Shim facingMode for mobile, where it defaults to "user".
      var face = constraints.video.facingMode;
      face = face && ((typeof face === 'object') ? face : {ideal: face});

      if ((face && (face.exact === 'user' || face.exact === 'environment' ||
                    face.ideal === 'user' || face.ideal === 'environment')) &&
          !(navigator.mediaDevices.getSupportedConstraints &&
            navigator.mediaDevices.getSupportedConstraints().facingMode)) {
        delete constraints.video.facingMode;
        if (face.exact === 'environment' || face.ideal === 'environment') {
          // Look for "back" in label, or use last cam (typically back cam).
          return navigator.mediaDevices.enumerateDevices()
          .then(function(devices) {
            devices = devices.filter(function(d) {
              return d.kind === 'videoinput';
            });
            var back = devices.find(function(d) {
              return d.label.toLowerCase().indexOf('back') !== -1;
            }) || (devices.length && devices[devices.length - 1]);
            if (back) {
              constraints.video.deviceId = face.exact ? {exact: back.deviceId} :
                                                        {ideal: back.deviceId};
            }
            constraints.video = constraintsToChrome_(constraints.video);
            logging('chrome: ' + JSON.stringify(constraints));
            return func(constraints);
          });
        }
      }
      constraints.video = constraintsToChrome_(constraints.video);
    }
    logging('chrome: ' + JSON.stringify(constraints));
    return func(constraints);
  };

  var shimError_ = function(e) {
    return {
      name: {
        PermissionDeniedError: 'NotAllowedError',
        ConstraintNotSatisfiedError: 'OverconstrainedError'
      }[e.name] || e.name,
      message: e.message,
      constraint: e.constraintName,
      toString: function() {
        return this.name + (this.message && ': ') + this.message;
      }
    };
  };

  var getUserMedia_ = function(constraints, onSuccess, onError) {
    shimConstraints_(constraints, function(c) {
      navigator.webkitGetUserMedia(c, onSuccess, function(e) {
        onError(shimError_(e));
      });
    });
  };

  navigator.getUserMedia = getUserMedia_;

  // Returns the result of getUserMedia as a Promise.
  var getUserMediaPromise_ = function(constraints) {
    return new Promise(function(resolve, reject) {
      navigator.getUserMedia(constraints, resolve, reject);
    });
  };

  if (!navigator.mediaDevices) {
    navigator.mediaDevices = {
      getUserMedia: getUserMediaPromise_,
      enumerateDevices: function() {
        return new Promise(function(resolve) {
          var kinds = {audio: 'audioinput', video: 'videoinput'};
          return MediaStreamTrack.getSources(function(devices) {
            resolve(devices.map(function(device) {
              return {label: device.label,
                      kind: kinds[device.kind],
                      deviceId: device.id,
                      groupId: ''};
            }));
          });
        });
      }
    };
  }

  // A shim for getUserMedia method on the mediaDevices object.
  // TODO(KaptenJansson) remove once implemented in Chrome stable.
  if (!navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia = function(constraints) {
      return getUserMediaPromise_(constraints);
    };
  } else {
    // Even though Chrome 45 has navigator.mediaDevices and a getUserMedia
    // function which returns a Promise, it does not accept spec-style
    // constraints.
    var origGetUserMedia = navigator.mediaDevices.getUserMedia.
        bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = function(cs) {
      return shimConstraints_(cs, function(c) {
        return origGetUserMedia(c).then(function(stream) {
          if (c.audio && !stream.getAudioTracks().length ||
              c.video && !stream.getVideoTracks().length) {
            stream.getTracks().forEach(function(track) {
              track.stop();
            });
            throw new DOMException('', 'NotFoundError');
          }
          return stream;
        }, function(e) {
          return Promise.reject(shimError_(e));
        });
      });
    };
  }

  // Dummy devicechange event methods.
  // TODO(KaptenJansson) remove once implemented in Chrome stable.
  if (typeof navigator.mediaDevices.addEventListener === 'undefined') {
    navigator.mediaDevices.addEventListener = function() {
      logging('Dummy mediaDevices.addEventListener called.');
    };
  }
  if (typeof navigator.mediaDevices.removeEventListener === 'undefined') {
    navigator.mediaDevices.removeEventListener = function() {
      logging('Dummy mediaDevices.removeEventListener called.');
    };
  }
};

},{"../utils.js":39}],34:[function(require,module,exports){
/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
 /* eslint-env node */
'use strict';

var SDPUtils = require('sdp');
var browserDetails = require('../utils').browserDetails;

var edgeShim = {
  shimPeerConnection: function() {
    if (window.RTCIceGatherer) {
      // ORTC defines an RTCIceCandidate object but no constructor.
      // Not implemented in Edge.
      if (!window.RTCIceCandidate) {
        window.RTCIceCandidate = function(args) {
          return args;
        };
      }
      // ORTC does not have a session description object but
      // other browsers (i.e. Chrome) that will support both PC and ORTC
      // in the future might have this defined already.
      if (!window.RTCSessionDescription) {
        window.RTCSessionDescription = function(args) {
          return args;
        };
      }
      // this adds an additional event listener to MediaStrackTrack that signals
      // when a tracks enabled property was changed.
      var origMSTEnabled = Object.getOwnPropertyDescriptor(
          MediaStreamTrack.prototype, 'enabled');
      Object.defineProperty(MediaStreamTrack.prototype, 'enabled', {
        set: function(value) {
          origMSTEnabled.set.call(this, value);
          var ev = new Event('enabled');
          ev.enabled = value;
          this.dispatchEvent(ev);
        }
      });
    }

    window.RTCPeerConnection = function(config) {
      var self = this;

      var _eventTarget = document.createDocumentFragment();
      ['addEventListener', 'removeEventListener', 'dispatchEvent']
          .forEach(function(method) {
            self[method] = _eventTarget[method].bind(_eventTarget);
          });

      this.onicecandidate = null;
      this.onaddstream = null;
      this.ontrack = null;
      this.onremovestream = null;
      this.onsignalingstatechange = null;
      this.oniceconnectionstatechange = null;
      this.onnegotiationneeded = null;
      this.ondatachannel = null;

      this.localStreams = [];
      this.remoteStreams = [];
      this.getLocalStreams = function() {
        return self.localStreams;
      };
      this.getRemoteStreams = function() {
        return self.remoteStreams;
      };

      this.localDescription = new RTCSessionDescription({
        type: '',
        sdp: ''
      });
      this.remoteDescription = new RTCSessionDescription({
        type: '',
        sdp: ''
      });
      this.signalingState = 'stable';
      this.iceConnectionState = 'new';
      this.iceGatheringState = 'new';

      this.iceOptions = {
        gatherPolicy: 'all',
        iceServers: []
      };
      if (config && config.iceTransportPolicy) {
        switch (config.iceTransportPolicy) {
          case 'all':
          case 'relay':
            this.iceOptions.gatherPolicy = config.iceTransportPolicy;
            break;
          case 'none':
            // FIXME: remove once implementation and spec have added this.
            throw new TypeError('iceTransportPolicy "none" not supported');
          default:
            // don't set iceTransportPolicy.
            break;
        }
      }
      this.usingBundle = config && config.bundlePolicy === 'max-bundle';

      if (config && config.iceServers) {
        // Edge does not like
        // 1) stun:
        // 2) turn: that does not have all of turn:host:port?transport=udp
        // 3) turn: with ipv6 addresses
        var iceServers = JSON.parse(JSON.stringify(config.iceServers));
        this.iceOptions.iceServers = iceServers.filter(function(server) {
          if (server && server.urls) {
            var urls = server.urls;
            if (typeof urls === 'string') {
              urls = [urls];
            }
            urls = urls.filter(function(url) {
              return (url.indexOf('turn:') === 0 &&
                  url.indexOf('transport=udp') !== -1 &&
                  url.indexOf('turn:[') === -1) ||
                  (url.indexOf('stun:') === 0 &&
                    browserDetails.version >= 14393);
            })[0];
            return !!urls;
          }
          return false;
        });
      }
      this._config = config;

      // per-track iceGathers, iceTransports, dtlsTransports, rtpSenders, ...
      // everything that is needed to describe a SDP m-line.
      this.transceivers = [];

      // since the iceGatherer is currently created in createOffer but we
      // must not emit candidates until after setLocalDescription we buffer
      // them in this array.
      this._localIceCandidatesBuffer = [];
    };

    window.RTCPeerConnection.prototype._emitBufferedCandidates = function() {
      var self = this;
      var sections = SDPUtils.splitSections(self.localDescription.sdp);
      // FIXME: need to apply ice candidates in a way which is async but
      // in-order
      this._localIceCandidatesBuffer.forEach(function(event) {
        var end = !event.candidate || Object.keys(event.candidate).length === 0;
        if (end) {
          for (var j = 1; j < sections.length; j++) {
            if (sections[j].indexOf('\r\na=end-of-candidates\r\n') === -1) {
              sections[j] += 'a=end-of-candidates\r\n';
            }
          }
        } else if (event.candidate.candidate.indexOf('typ endOfCandidates')
            === -1) {
          sections[event.candidate.sdpMLineIndex + 1] +=
              'a=' + event.candidate.candidate + '\r\n';
        }
        self.localDescription.sdp = sections.join('');
        self.dispatchEvent(event);
        if (self.onicecandidate !== null) {
          self.onicecandidate(event);
        }
        if (!event.candidate && self.iceGatheringState !== 'complete') {
          var complete = self.transceivers.every(function(transceiver) {
            return transceiver.iceGatherer &&
                transceiver.iceGatherer.state === 'completed';
          });
          if (complete) {
            self.iceGatheringState = 'complete';
          }
        }
      });
      this._localIceCandidatesBuffer = [];
    };

    window.RTCPeerConnection.prototype.getConfiguration = function() {
      return this._config;
    };

    window.RTCPeerConnection.prototype.addStream = function(stream) {
      // Clone is necessary for local demos mostly, attaching directly
      // to two different senders does not work (build 10547).
      var clonedStream = stream.clone();
      stream.getTracks().forEach(function(track, idx) {
        var clonedTrack = clonedStream.getTracks()[idx];
        track.addEventListener('enabled', function(event) {
          clonedTrack.enabled = event.enabled;
        });
      });
      this.localStreams.push(clonedStream);
      this._maybeFireNegotiationNeeded();
    };

    window.RTCPeerConnection.prototype.removeStream = function(stream) {
      var idx = this.localStreams.indexOf(stream);
      if (idx > -1) {
        this.localStreams.splice(idx, 1);
        this._maybeFireNegotiationNeeded();
      }
    };

    window.RTCPeerConnection.prototype.getSenders = function() {
      return this.transceivers.filter(function(transceiver) {
        return !!transceiver.rtpSender;
      })
      .map(function(transceiver) {
        return transceiver.rtpSender;
      });
    };

    window.RTCPeerConnection.prototype.getReceivers = function() {
      return this.transceivers.filter(function(transceiver) {
        return !!transceiver.rtpReceiver;
      })
      .map(function(transceiver) {
        return transceiver.rtpReceiver;
      });
    };

    // Determines the intersection of local and remote capabilities.
    window.RTCPeerConnection.prototype._getCommonCapabilities =
        function(localCapabilities, remoteCapabilities) {
          var commonCapabilities = {
            codecs: [],
            headerExtensions: [],
            fecMechanisms: []
          };
          localCapabilities.codecs.forEach(function(lCodec) {
            for (var i = 0; i < remoteCapabilities.codecs.length; i++) {
              var rCodec = remoteCapabilities.codecs[i];
              if (lCodec.name.toLowerCase() === rCodec.name.toLowerCase() &&
                  lCodec.clockRate === rCodec.clockRate) {
                // number of channels is the highest common number of channels
                rCodec.numChannels = Math.min(lCodec.numChannels,
                    rCodec.numChannels);
                // push rCodec so we reply with offerer payload type
                commonCapabilities.codecs.push(rCodec);

                // determine common feedback mechanisms
                rCodec.rtcpFeedback = rCodec.rtcpFeedback.filter(function(fb) {
                  for (var j = 0; j < lCodec.rtcpFeedback.length; j++) {
                    if (lCodec.rtcpFeedback[j].type === fb.type &&
                        lCodec.rtcpFeedback[j].parameter === fb.parameter) {
                      return true;
                    }
                  }
                  return false;
                });
                // FIXME: also need to determine .parameters
                //  see https://github.com/openpeer/ortc/issues/569
                break;
              }
            }
          });

          localCapabilities.headerExtensions
              .forEach(function(lHeaderExtension) {
                for (var i = 0; i < remoteCapabilities.headerExtensions.length;
                     i++) {
                  var rHeaderExtension = remoteCapabilities.headerExtensions[i];
                  if (lHeaderExtension.uri === rHeaderExtension.uri) {
                    commonCapabilities.headerExtensions.push(rHeaderExtension);
                    break;
                  }
                }
              });

          // FIXME: fecMechanisms
          return commonCapabilities;
        };

    // Create ICE gatherer, ICE transport and DTLS transport.
    window.RTCPeerConnection.prototype._createIceAndDtlsTransports =
        function(mid, sdpMLineIndex) {
          var self = this;
          var iceGatherer = new RTCIceGatherer(self.iceOptions);
          var iceTransport = new RTCIceTransport(iceGatherer);
          iceGatherer.onlocalcandidate = function(evt) {
            var event = new Event('icecandidate');
            event.candidate = {sdpMid: mid, sdpMLineIndex: sdpMLineIndex};

            var cand = evt.candidate;
            var end = !cand || Object.keys(cand).length === 0;
            // Edge emits an empty object for RTCIceCandidateComplete‥
            if (end) {
              // polyfill since RTCIceGatherer.state is not implemented in
              // Edge 10547 yet.
              if (iceGatherer.state === undefined) {
                iceGatherer.state = 'completed';
              }

              // Emit a candidate with type endOfCandidates to make the samples
              // work. Edge requires addIceCandidate with this empty candidate
              // to start checking. The real solution is to signal
              // end-of-candidates to the other side when getting the null
              // candidate but some apps (like the samples) don't do that.
              event.candidate.candidate =
                  'candidate:1 1 udp 1 0.0.0.0 9 typ endOfCandidates';
            } else {
              // RTCIceCandidate doesn't have a component, needs to be added
              cand.component = iceTransport.component === 'RTCP' ? 2 : 1;
              event.candidate.candidate = SDPUtils.writeCandidate(cand);
            }

            // update local description.
            var sections = SDPUtils.splitSections(self.localDescription.sdp);
            if (event.candidate.candidate.indexOf('typ endOfCandidates')
                === -1) {
              sections[event.candidate.sdpMLineIndex + 1] +=
                  'a=' + event.candidate.candidate + '\r\n';
            } else {
              sections[event.candidate.sdpMLineIndex + 1] +=
                  'a=end-of-candidates\r\n';
            }
            self.localDescription.sdp = sections.join('');

            var complete = self.transceivers.every(function(transceiver) {
              return transceiver.iceGatherer &&
                  transceiver.iceGatherer.state === 'completed';
            });

            // Emit candidate if localDescription is set.
            // Also emits null candidate when all gatherers are complete.
            switch (self.iceGatheringState) {
              case 'new':
                self._localIceCandidatesBuffer.push(event);
                if (end && complete) {
                  self._localIceCandidatesBuffer.push(
                      new Event('icecandidate'));
                }
                break;
              case 'gathering':
                self._emitBufferedCandidates();
                self.dispatchEvent(event);
                if (self.onicecandidate !== null) {
                  self.onicecandidate(event);
                }
                if (complete) {
                  self.dispatchEvent(new Event('icecandidate'));
                  if (self.onicecandidate !== null) {
                    self.onicecandidate(new Event('icecandidate'));
                  }
                  self.iceGatheringState = 'complete';
                }
                break;
              case 'complete':
                // should not happen... currently!
                break;
              default: // no-op.
                break;
            }
          };
          iceTransport.onicestatechange = function() {
            self._updateConnectionState();
          };

          var dtlsTransport = new RTCDtlsTransport(iceTransport);
          dtlsTransport.ondtlsstatechange = function() {
            self._updateConnectionState();
          };
          dtlsTransport.onerror = function() {
            // onerror does not set state to failed by itself.
            dtlsTransport.state = 'failed';
            self._updateConnectionState();
          };

          return {
            iceGatherer: iceGatherer,
            iceTransport: iceTransport,
            dtlsTransport: dtlsTransport
          };
        };

    // Start the RTP Sender and Receiver for a transceiver.
    window.RTCPeerConnection.prototype._transceive = function(transceiver,
        send, recv) {
      var params = this._getCommonCapabilities(transceiver.localCapabilities,
          transceiver.remoteCapabilities);
      if (send && transceiver.rtpSender) {
        params.encodings = transceiver.sendEncodingParameters;
        params.rtcp = {
          cname: SDPUtils.localCName
        };
        if (transceiver.recvEncodingParameters.length) {
          params.rtcp.ssrc = transceiver.recvEncodingParameters[0].ssrc;
        }
        transceiver.rtpSender.send(params);
      }
      if (recv && transceiver.rtpReceiver) {
        // remove RTX field in Edge 14942
        if (transceiver.kind === 'video'
            && transceiver.recvEncodingParameters) {
          transceiver.recvEncodingParameters.forEach(function(p) {
            delete p.rtx;
          });
        }
        params.encodings = transceiver.recvEncodingParameters;
        params.rtcp = {
          cname: transceiver.cname
        };
        if (transceiver.sendEncodingParameters.length) {
          params.rtcp.ssrc = transceiver.sendEncodingParameters[0].ssrc;
        }
        transceiver.rtpReceiver.receive(params);
      }
    };

    window.RTCPeerConnection.prototype.setLocalDescription =
        function(description) {
          var self = this;
          var sections;
          var sessionpart;
          if (description.type === 'offer') {
            // FIXME: What was the purpose of this empty if statement?
            // if (!this._pendingOffer) {
            // } else {
            if (this._pendingOffer) {
              // VERY limited support for SDP munging. Limited to:
              // * changing the order of codecs
              sections = SDPUtils.splitSections(description.sdp);
              sessionpart = sections.shift();
              sections.forEach(function(mediaSection, sdpMLineIndex) {
                var caps = SDPUtils.parseRtpParameters(mediaSection);
                self._pendingOffer[sdpMLineIndex].localCapabilities = caps;
              });
              this.transceivers = this._pendingOffer;
              delete this._pendingOffer;
            }
          } else if (description.type === 'answer') {
            sections = SDPUtils.splitSections(self.remoteDescription.sdp);
            sessionpart = sections.shift();
            var isIceLite = SDPUtils.matchPrefix(sessionpart,
                'a=ice-lite').length > 0;
            sections.forEach(function(mediaSection, sdpMLineIndex) {
              var transceiver = self.transceivers[sdpMLineIndex];
              var iceGatherer = transceiver.iceGatherer;
              var iceTransport = transceiver.iceTransport;
              var dtlsTransport = transceiver.dtlsTransport;
              var localCapabilities = transceiver.localCapabilities;
              var remoteCapabilities = transceiver.remoteCapabilities;

              var rejected = mediaSection.split('\n', 1)[0]
                  .split(' ', 2)[1] === '0';

              if (!rejected && !transceiver.isDatachannel) {
                var remoteIceParameters = SDPUtils.getIceParameters(
                    mediaSection, sessionpart);
                if (isIceLite) {
                  var cands = SDPUtils.matchPrefix(mediaSection, 'a=candidate:')
                  .map(function(cand) {
                    return SDPUtils.parseCandidate(cand);
                  })
                  .filter(function(cand) {
                    return cand.component === '1';
                  });
                  // ice-lite only includes host candidates in the SDP so we can
                  // use setRemoteCandidates (which implies an
                  // RTCIceCandidateComplete)
                  if (cands.length) {
                    iceTransport.setRemoteCandidates(cands);
                  }
                }
                var remoteDtlsParameters = SDPUtils.getDtlsParameters(
                    mediaSection, sessionpart);
                if (isIceLite) {
                  remoteDtlsParameters.role = 'server';
                }

                if (!self.usingBundle || sdpMLineIndex === 0) {
                  iceTransport.start(iceGatherer, remoteIceParameters,
                      isIceLite ? 'controlling' : 'controlled');
                  dtlsTransport.start(remoteDtlsParameters);
                }

                // Calculate intersection of capabilities.
                var params = self._getCommonCapabilities(localCapabilities,
                    remoteCapabilities);

                // Start the RTCRtpSender. The RTCRtpReceiver for this
                // transceiver has already been started in setRemoteDescription.
                self._transceive(transceiver,
                    params.codecs.length > 0,
                    false);
              }
            });
          }

          this.localDescription = {
            type: description.type,
            sdp: description.sdp
          };
          switch (description.type) {
            case 'offer':
              this._updateSignalingState('have-local-offer');
              break;
            case 'answer':
              this._updateSignalingState('stable');
              break;
            default:
              throw new TypeError('unsupported type "' + description.type +
                  '"');
          }

          // If a success callback was provided, emit ICE candidates after it
          // has been executed. Otherwise, emit callback after the Promise is
          // resolved.
          var hasCallback = arguments.length > 1 &&
            typeof arguments[1] === 'function';
          if (hasCallback) {
            var cb = arguments[1];
            window.setTimeout(function() {
              cb();
              if (self.iceGatheringState === 'new') {
                self.iceGatheringState = 'gathering';
              }
              self._emitBufferedCandidates();
            }, 0);
          }
          var p = Promise.resolve();
          p.then(function() {
            if (!hasCallback) {
              if (self.iceGatheringState === 'new') {
                self.iceGatheringState = 'gathering';
              }
              // Usually candidates will be emitted earlier.
              window.setTimeout(self._emitBufferedCandidates.bind(self), 500);
            }
          });
          return p;
        };

    window.RTCPeerConnection.prototype.setRemoteDescription =
        function(description) {
          var self = this;
          var stream = new MediaStream();
          var receiverList = [];
          var sections = SDPUtils.splitSections(description.sdp);
          var sessionpart = sections.shift();
          var isIceLite = SDPUtils.matchPrefix(sessionpart,
              'a=ice-lite').length > 0;
          this.usingBundle = SDPUtils.matchPrefix(sessionpart,
              'a=group:BUNDLE ').length > 0;
          sections.forEach(function(mediaSection, sdpMLineIndex) {
            var lines = SDPUtils.splitLines(mediaSection);
            var mline = lines[0].substr(2).split(' ');
            var kind = mline[0];
            var rejected = mline[1] === '0';
            var direction = SDPUtils.getDirection(mediaSection, sessionpart);

            var mid = SDPUtils.matchPrefix(mediaSection, 'a=mid:');
            if (mid.length) {
              mid = mid[0].substr(6);
            } else {
              mid = SDPUtils.generateIdentifier();
            }

            // Reject datachannels which are not implemented yet.
            if (kind === 'application' && mline[2] === 'DTLS/SCTP') {
              self.transceivers[sdpMLineIndex] = {
                mid: mid,
                isDatachannel: true
              };
              return;
            }

            var transceiver;
            var iceGatherer;
            var iceTransport;
            var dtlsTransport;
            var rtpSender;
            var rtpReceiver;
            var sendEncodingParameters;
            var recvEncodingParameters;
            var localCapabilities;

            var track;
            // FIXME: ensure the mediaSection has rtcp-mux set.
            var remoteCapabilities = SDPUtils.parseRtpParameters(mediaSection);
            var remoteIceParameters;
            var remoteDtlsParameters;
            if (!rejected) {
              remoteIceParameters = SDPUtils.getIceParameters(mediaSection,
                  sessionpart);
              remoteDtlsParameters = SDPUtils.getDtlsParameters(mediaSection,
                  sessionpart);
              remoteDtlsParameters.role = 'client';
            }
            recvEncodingParameters =
                SDPUtils.parseRtpEncodingParameters(mediaSection);

            var cname;
            // Gets the first SSRC. Note that with RTX there might be multiple
            // SSRCs.
            var remoteSsrc = SDPUtils.matchPrefix(mediaSection, 'a=ssrc:')
                .map(function(line) {
                  return SDPUtils.parseSsrcMedia(line);
                })
                .filter(function(obj) {
                  return obj.attribute === 'cname';
                })[0];
            if (remoteSsrc) {
              cname = remoteSsrc.value;
            }

            var isComplete = SDPUtils.matchPrefix(mediaSection,
                'a=end-of-candidates', sessionpart).length > 0;
            var cands = SDPUtils.matchPrefix(mediaSection, 'a=candidate:')
                .map(function(cand) {
                  return SDPUtils.parseCandidate(cand);
                })
                .filter(function(cand) {
                  return cand.component === '1';
                });
            if (description.type === 'offer' && !rejected) {
              var transports = self.usingBundle && sdpMLineIndex > 0 ? {
                iceGatherer: self.transceivers[0].iceGatherer,
                iceTransport: self.transceivers[0].iceTransport,
                dtlsTransport: self.transceivers[0].dtlsTransport
              } : self._createIceAndDtlsTransports(mid, sdpMLineIndex);

              if (isComplete) {
                transports.iceTransport.setRemoteCandidates(cands);
              }

              localCapabilities = RTCRtpReceiver.getCapabilities(kind);

              // filter RTX until additional stuff needed for RTX is implemented
              // in adapter.js
              localCapabilities.codecs = localCapabilities.codecs.filter(
                  function(codec) {
                    return codec.name !== 'rtx';
                  });

              sendEncodingParameters = [{
                ssrc: (2 * sdpMLineIndex + 2) * 1001
              }];

              rtpReceiver = new RTCRtpReceiver(transports.dtlsTransport, kind);

              track = rtpReceiver.track;
              receiverList.push([track, rtpReceiver]);
              // FIXME: not correct when there are multiple streams but that is
              // not currently supported in this shim.
              stream.addTrack(track);

              // FIXME: look at direction.
              if (self.localStreams.length > 0 &&
                  self.localStreams[0].getTracks().length >= sdpMLineIndex) {
                var localTrack;
                if (kind === 'audio') {
                  localTrack = self.localStreams[0].getAudioTracks()[0];
                } else if (kind === 'video') {
                  localTrack = self.localStreams[0].getVideoTracks()[0];
                }
                if (localTrack) {
                  rtpSender = new RTCRtpSender(localTrack,
                      transports.dtlsTransport);
                }
              }

              self.transceivers[sdpMLineIndex] = {
                iceGatherer: transports.iceGatherer,
                iceTransport: transports.iceTransport,
                dtlsTransport: transports.dtlsTransport,
                localCapabilities: localCapabilities,
                remoteCapabilities: remoteCapabilities,
                rtpSender: rtpSender,
                rtpReceiver: rtpReceiver,
                kind: kind,
                mid: mid,
                cname: cname,
                sendEncodingParameters: sendEncodingParameters,
                recvEncodingParameters: recvEncodingParameters
              };
              // Start the RTCRtpReceiver now. The RTPSender is started in
              // setLocalDescription.
              self._transceive(self.transceivers[sdpMLineIndex],
                  false,
                  direction === 'sendrecv' || direction === 'sendonly');
            } else if (description.type === 'answer' && !rejected) {
              transceiver = self.transceivers[sdpMLineIndex];
              iceGatherer = transceiver.iceGatherer;
              iceTransport = transceiver.iceTransport;
              dtlsTransport = transceiver.dtlsTransport;
              rtpSender = transceiver.rtpSender;
              rtpReceiver = transceiver.rtpReceiver;
              sendEncodingParameters = transceiver.sendEncodingParameters;
              localCapabilities = transceiver.localCapabilities;

              self.transceivers[sdpMLineIndex].recvEncodingParameters =
                  recvEncodingParameters;
              self.transceivers[sdpMLineIndex].remoteCapabilities =
                  remoteCapabilities;
              self.transceivers[sdpMLineIndex].cname = cname;

              if ((isIceLite || isComplete) && cands.length) {
                iceTransport.setRemoteCandidates(cands);
              }
              if (!self.usingBundle || sdpMLineIndex === 0) {
                iceTransport.start(iceGatherer, remoteIceParameters,
                    'controlling');
                dtlsTransport.start(remoteDtlsParameters);
              }

              self._transceive(transceiver,
                  direction === 'sendrecv' || direction === 'recvonly',
                  direction === 'sendrecv' || direction === 'sendonly');

              if (rtpReceiver &&
                  (direction === 'sendrecv' || direction === 'sendonly')) {
                track = rtpReceiver.track;
                receiverList.push([track, rtpReceiver]);
                stream.addTrack(track);
              } else {
                // FIXME: actually the receiver should be created later.
                delete transceiver.rtpReceiver;
              }
            }
          });

          this.remoteDescription = {
            type: description.type,
            sdp: description.sdp
          };
          switch (description.type) {
            case 'offer':
              this._updateSignalingState('have-remote-offer');
              break;
            case 'answer':
              this._updateSignalingState('stable');
              break;
            default:
              throw new TypeError('unsupported type "' + description.type +
                  '"');
          }
          if (stream.getTracks().length) {
            self.remoteStreams.push(stream);
            window.setTimeout(function() {
              var event = new Event('addstream');
              event.stream = stream;
              self.dispatchEvent(event);
              if (self.onaddstream !== null) {
                window.setTimeout(function() {
                  self.onaddstream(event);
                }, 0);
              }

              receiverList.forEach(function(item) {
                var track = item[0];
                var receiver = item[1];
                var trackEvent = new Event('track');
                trackEvent.track = track;
                trackEvent.receiver = receiver;
                trackEvent.streams = [stream];
                self.dispatchEvent(event);
                if (self.ontrack !== null) {
                  window.setTimeout(function() {
                    self.ontrack(trackEvent);
                  }, 0);
                }
              });
            }, 0);
          }
          if (arguments.length > 1 && typeof arguments[1] === 'function') {
            window.setTimeout(arguments[1], 0);
          }
          return Promise.resolve();
        };

    window.RTCPeerConnection.prototype.close = function() {
      this.transceivers.forEach(function(transceiver) {
        /* not yet
        if (transceiver.iceGatherer) {
          transceiver.iceGatherer.close();
        }
        */
        if (transceiver.iceTransport) {
          transceiver.iceTransport.stop();
        }
        if (transceiver.dtlsTransport) {
          transceiver.dtlsTransport.stop();
        }
        if (transceiver.rtpSender) {
          transceiver.rtpSender.stop();
        }
        if (transceiver.rtpReceiver) {
          transceiver.rtpReceiver.stop();
        }
      });
      // FIXME: clean up tracks, local streams, remote streams, etc
      this._updateSignalingState('closed');
    };

    // Update the signaling state.
    window.RTCPeerConnection.prototype._updateSignalingState =
        function(newState) {
          this.signalingState = newState;
          var event = new Event('signalingstatechange');
          this.dispatchEvent(event);
          if (this.onsignalingstatechange !== null) {
            this.onsignalingstatechange(event);
          }
        };

    // Determine whether to fire the negotiationneeded event.
    window.RTCPeerConnection.prototype._maybeFireNegotiationNeeded =
        function() {
          // Fire away (for now).
          var event = new Event('negotiationneeded');
          this.dispatchEvent(event);
          if (this.onnegotiationneeded !== null) {
            this.onnegotiationneeded(event);
          }
        };

    // Update the connection state.
    window.RTCPeerConnection.prototype._updateConnectionState = function() {
      var self = this;
      var newState;
      var states = {
        'new': 0,
        closed: 0,
        connecting: 0,
        checking: 0,
        connected: 0,
        completed: 0,
        failed: 0
      };
      this.transceivers.forEach(function(transceiver) {
        states[transceiver.iceTransport.state]++;
        states[transceiver.dtlsTransport.state]++;
      });
      // ICETransport.completed and connected are the same for this purpose.
      states.connected += states.completed;

      newState = 'new';
      if (states.failed > 0) {
        newState = 'failed';
      } else if (states.connecting > 0 || states.checking > 0) {
        newState = 'connecting';
      } else if (states.disconnected > 0) {
        newState = 'disconnected';
      } else if (states.new > 0) {
        newState = 'new';
      } else if (states.connected > 0 || states.completed > 0) {
        newState = 'connected';
      }

      if (newState !== self.iceConnectionState) {
        self.iceConnectionState = newState;
        var event = new Event('iceconnectionstatechange');
        this.dispatchEvent(event);
        if (this.oniceconnectionstatechange !== null) {
          this.oniceconnectionstatechange(event);
        }
      }
    };

    window.RTCPeerConnection.prototype.createOffer = function() {
      var self = this;
      if (this._pendingOffer) {
        throw new Error('createOffer called while there is a pending offer.');
      }
      var offerOptions;
      if (arguments.length === 1 && typeof arguments[0] !== 'function') {
        offerOptions = arguments[0];
      } else if (arguments.length === 3) {
        offerOptions = arguments[2];
      }

      var tracks = [];
      var numAudioTracks = 0;
      var numVideoTracks = 0;
      // Default to sendrecv.
      if (this.localStreams.length) {
        numAudioTracks = this.localStreams[0].getAudioTracks().length;
        numVideoTracks = this.localStreams[0].getVideoTracks().length;
      }
      // Determine number of audio and video tracks we need to send/recv.
      if (offerOptions) {
        // Reject Chrome legacy constraints.
        if (offerOptions.mandatory || offerOptions.optional) {
          throw new TypeError(
              'Legacy mandatory/optional constraints not supported.');
        }
        if (offerOptions.offerToReceiveAudio !== undefined) {
          numAudioTracks = offerOptions.offerToReceiveAudio;
        }
        if (offerOptions.offerToReceiveVideo !== undefined) {
          numVideoTracks = offerOptions.offerToReceiveVideo;
        }
      }
      if (this.localStreams.length) {
        // Push local streams.
        this.localStreams[0].getTracks().forEach(function(track) {
          tracks.push({
            kind: track.kind,
            track: track,
            wantReceive: track.kind === 'audio' ?
                numAudioTracks > 0 : numVideoTracks > 0
          });
          if (track.kind === 'audio') {
            numAudioTracks--;
          } else if (track.kind === 'video') {
            numVideoTracks--;
          }
        });
      }
      // Create M-lines for recvonly streams.
      while (numAudioTracks > 0 || numVideoTracks > 0) {
        if (numAudioTracks > 0) {
          tracks.push({
            kind: 'audio',
            wantReceive: true
          });
          numAudioTracks--;
        }
        if (numVideoTracks > 0) {
          tracks.push({
            kind: 'video',
            wantReceive: true
          });
          numVideoTracks--;
        }
      }

      var sdp = SDPUtils.writeSessionBoilerplate();
      var transceivers = [];
      tracks.forEach(function(mline, sdpMLineIndex) {
        // For each track, create an ice gatherer, ice transport,
        // dtls transport, potentially rtpsender and rtpreceiver.
        var track = mline.track;
        var kind = mline.kind;
        var mid = SDPUtils.generateIdentifier();

        var transports = self.usingBundle && sdpMLineIndex > 0 ? {
          iceGatherer: transceivers[0].iceGatherer,
          iceTransport: transceivers[0].iceTransport,
          dtlsTransport: transceivers[0].dtlsTransport
        } : self._createIceAndDtlsTransports(mid, sdpMLineIndex);

        var localCapabilities = RTCRtpSender.getCapabilities(kind);
        // filter RTX until additional stuff needed for RTX is implemented
        // in adapter.js
        localCapabilities.codecs = localCapabilities.codecs.filter(
            function(codec) {
              return codec.name !== 'rtx';
            });
        localCapabilities.codecs.forEach(function(codec) {
          // work around https://bugs.chromium.org/p/webrtc/issues/detail?id=6552
          // by adding level-asymmetry-allowed=1
          if (codec.name === 'H264' &&
              codec.parameters['level-asymmetry-allowed'] === undefined) {
            codec.parameters['level-asymmetry-allowed'] = '1';
          }
        });

        var rtpSender;
        var rtpReceiver;

        // generate an ssrc now, to be used later in rtpSender.send
        var sendEncodingParameters = [{
          ssrc: (2 * sdpMLineIndex + 1) * 1001
        }];
        if (track) {
          rtpSender = new RTCRtpSender(track, transports.dtlsTransport);
        }

        if (mline.wantReceive) {
          rtpReceiver = new RTCRtpReceiver(transports.dtlsTransport, kind);
        }

        transceivers[sdpMLineIndex] = {
          iceGatherer: transports.iceGatherer,
          iceTransport: transports.iceTransport,
          dtlsTransport: transports.dtlsTransport,
          localCapabilities: localCapabilities,
          remoteCapabilities: null,
          rtpSender: rtpSender,
          rtpReceiver: rtpReceiver,
          kind: kind,
          mid: mid,
          sendEncodingParameters: sendEncodingParameters,
          recvEncodingParameters: null
        };
      });
      if (this.usingBundle) {
        sdp += 'a=group:BUNDLE ' + transceivers.map(function(t) {
          return t.mid;
        }).join(' ') + '\r\n';
      }
      tracks.forEach(function(mline, sdpMLineIndex) {
        var transceiver = transceivers[sdpMLineIndex];
        sdp += SDPUtils.writeMediaSection(transceiver,
            transceiver.localCapabilities, 'offer', self.localStreams[0]);
      });

      this._pendingOffer = transceivers;
      var desc = new RTCSessionDescription({
        type: 'offer',
        sdp: sdp
      });
      if (arguments.length && typeof arguments[0] === 'function') {
        window.setTimeout(arguments[0], 0, desc);
      }
      return Promise.resolve(desc);
    };

    window.RTCPeerConnection.prototype.createAnswer = function() {
      var self = this;

      var sdp = SDPUtils.writeSessionBoilerplate();
      if (this.usingBundle) {
        sdp += 'a=group:BUNDLE ' + this.transceivers.map(function(t) {
          return t.mid;
        }).join(' ') + '\r\n';
      }
      this.transceivers.forEach(function(transceiver) {
        if (transceiver.isDatachannel) {
          sdp += 'm=application 0 DTLS/SCTP 5000\r\n' +
              'c=IN IP4 0.0.0.0\r\n' +
              'a=mid:' + transceiver.mid + '\r\n';
          return;
        }
        // Calculate intersection of capabilities.
        var commonCapabilities = self._getCommonCapabilities(
            transceiver.localCapabilities,
            transceiver.remoteCapabilities);

        sdp += SDPUtils.writeMediaSection(transceiver, commonCapabilities,
            'answer', self.localStreams[0]);
      });

      var desc = new RTCSessionDescription({
        type: 'answer',
        sdp: sdp
      });
      if (arguments.length && typeof arguments[0] === 'function') {
        window.setTimeout(arguments[0], 0, desc);
      }
      return Promise.resolve(desc);
    };

    window.RTCPeerConnection.prototype.addIceCandidate = function(candidate) {
      if (!candidate) {
        this.transceivers.forEach(function(transceiver) {
          transceiver.iceTransport.addRemoteCandidate({});
        });
      } else {
        var mLineIndex = candidate.sdpMLineIndex;
        if (candidate.sdpMid) {
          for (var i = 0; i < this.transceivers.length; i++) {
            if (this.transceivers[i].mid === candidate.sdpMid) {
              mLineIndex = i;
              break;
            }
          }
        }
        var transceiver = this.transceivers[mLineIndex];
        if (transceiver) {
          var cand = Object.keys(candidate.candidate).length > 0 ?
              SDPUtils.parseCandidate(candidate.candidate) : {};
          // Ignore Chrome's invalid candidates since Edge does not like them.
          if (cand.protocol === 'tcp' && (cand.port === 0 || cand.port === 9)) {
            return;
          }
          // Ignore RTCP candidates, we assume RTCP-MUX.
          if (cand.component !== '1') {
            return;
          }
          // A dirty hack to make samples work.
          if (cand.type === 'endOfCandidates') {
            cand = {};
          }
          transceiver.iceTransport.addRemoteCandidate(cand);

          // update the remoteDescription.
          var sections = SDPUtils.splitSections(this.remoteDescription.sdp);
          sections[mLineIndex + 1] += (cand.type ? candidate.candidate.trim()
              : 'a=end-of-candidates') + '\r\n';
          this.remoteDescription.sdp = sections.join('');
        }
      }
      if (arguments.length > 1 && typeof arguments[1] === 'function') {
        window.setTimeout(arguments[1], 0);
      }
      return Promise.resolve();
    };

    window.RTCPeerConnection.prototype.getStats = function() {
      var promises = [];
      this.transceivers.forEach(function(transceiver) {
        ['rtpSender', 'rtpReceiver', 'iceGatherer', 'iceTransport',
            'dtlsTransport'].forEach(function(method) {
              if (transceiver[method]) {
                promises.push(transceiver[method].getStats());
              }
            });
      });
      var cb = arguments.length > 1 && typeof arguments[1] === 'function' &&
          arguments[1];
      return new Promise(function(resolve) {
        // shim getStats with maplike support
        var results = new Map();
        Promise.all(promises).then(function(res) {
          res.forEach(function(result) {
            Object.keys(result).forEach(function(id) {
              results.set(id, result[id]);
              results[id] = result[id];
            });
          });
          if (cb) {
            window.setTimeout(cb, 0, results);
          }
          resolve(results);
        });
      });
    };
  }
};

// Expose public methods.
module.exports = {
  shimPeerConnection: edgeShim.shimPeerConnection,
  shimGetUserMedia: require('./getusermedia')
};

},{"../utils":39,"./getusermedia":35,"sdp":26}],35:[function(require,module,exports){
/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
 /* eslint-env node */
'use strict';

// Expose public methods.
module.exports = function() {
  var shimError_ = function(e) {
    return {
      name: {PermissionDeniedError: 'NotAllowedError'}[e.name] || e.name,
      message: e.message,
      constraint: e.constraint,
      toString: function() {
        return this.name;
      }
    };
  };

  // getUserMedia error shim.
  var origGetUserMedia = navigator.mediaDevices.getUserMedia.
      bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = function(c) {
    return origGetUserMedia(c).catch(function(e) {
      return Promise.reject(shimError_(e));
    });
  };
};

},{}],36:[function(require,module,exports){
/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
 /* eslint-env node */
'use strict';

var browserDetails = require('../utils').browserDetails;

var firefoxShim = {
  shimOnTrack: function() {
    if (typeof window === 'object' && window.RTCPeerConnection && !('ontrack' in
        window.RTCPeerConnection.prototype)) {
      Object.defineProperty(window.RTCPeerConnection.prototype, 'ontrack', {
        get: function() {
          return this._ontrack;
        },
        set: function(f) {
          if (this._ontrack) {
            this.removeEventListener('track', this._ontrack);
            this.removeEventListener('addstream', this._ontrackpoly);
          }
          this.addEventListener('track', this._ontrack = f);
          this.addEventListener('addstream', this._ontrackpoly = function(e) {
            e.stream.getTracks().forEach(function(track) {
              var event = new Event('track');
              event.track = track;
              event.receiver = {track: track};
              event.streams = [e.stream];
              this.dispatchEvent(event);
            }.bind(this));
          }.bind(this));
        }
      });
    }
  },

  shimSourceObject: function() {
    // Firefox has supported mozSrcObject since FF22, unprefixed in 42.
    if (typeof window === 'object') {
      if (window.HTMLMediaElement &&
        !('srcObject' in window.HTMLMediaElement.prototype)) {
        // Shim the srcObject property, once, when HTMLMediaElement is found.
        Object.defineProperty(window.HTMLMediaElement.prototype, 'srcObject', {
          get: function() {
            return this.mozSrcObject;
          },
          set: function(stream) {
            this.mozSrcObject = stream;
          }
        });
      }
    }
  },

  shimPeerConnection: function() {
    if (typeof window !== 'object' || !(window.RTCPeerConnection ||
        window.mozRTCPeerConnection)) {
      return; // probably media.peerconnection.enabled=false in about:config
    }
    // The RTCPeerConnection object.
    if (!window.RTCPeerConnection) {
      window.RTCPeerConnection = function(pcConfig, pcConstraints) {
        if (browserDetails.version < 38) {
          // .urls is not supported in FF < 38.
          // create RTCIceServers with a single url.
          if (pcConfig && pcConfig.iceServers) {
            var newIceServers = [];
            for (var i = 0; i < pcConfig.iceServers.length; i++) {
              var server = pcConfig.iceServers[i];
              if (server.hasOwnProperty('urls')) {
                for (var j = 0; j < server.urls.length; j++) {
                  var newServer = {
                    url: server.urls[j]
                  };
                  if (server.urls[j].indexOf('turn') === 0) {
                    newServer.username = server.username;
                    newServer.credential = server.credential;
                  }
                  newIceServers.push(newServer);
                }
              } else {
                newIceServers.push(pcConfig.iceServers[i]);
              }
            }
            pcConfig.iceServers = newIceServers;
          }
        }
        return new mozRTCPeerConnection(pcConfig, pcConstraints);
      };
      window.RTCPeerConnection.prototype = mozRTCPeerConnection.prototype;

      // wrap static methods. Currently just generateCertificate.
      if (mozRTCPeerConnection.generateCertificate) {
        Object.defineProperty(window.RTCPeerConnection, 'generateCertificate', {
          get: function() {
            return mozRTCPeerConnection.generateCertificate;
          }
        });
      }

      window.RTCSessionDescription = mozRTCSessionDescription;
      window.RTCIceCandidate = mozRTCIceCandidate;
    }

    // shim away need for obsolete RTCIceCandidate/RTCSessionDescription.
    ['setLocalDescription', 'setRemoteDescription', 'addIceCandidate']
        .forEach(function(method) {
          var nativeMethod = RTCPeerConnection.prototype[method];
          RTCPeerConnection.prototype[method] = function() {
            arguments[0] = new ((method === 'addIceCandidate') ?
                RTCIceCandidate : RTCSessionDescription)(arguments[0]);
            return nativeMethod.apply(this, arguments);
          };
        });

    // support for addIceCandidate(null or undefined)
    var nativeAddIceCandidate =
        RTCPeerConnection.prototype.addIceCandidate;
    RTCPeerConnection.prototype.addIceCandidate = function() {
      if (!arguments[0]) {
        if (arguments[1]) {
          arguments[1].apply(null);
        }
        return Promise.resolve();
      }
      return nativeAddIceCandidate.apply(this, arguments);
    };

    if (browserDetails.version < 48) {
      // shim getStats with maplike support
      var makeMapStats = function(stats) {
        var map = new Map();
        Object.keys(stats).forEach(function(key) {
          map.set(key, stats[key]);
          map[key] = stats[key];
        });
        return map;
      };

      var nativeGetStats = RTCPeerConnection.prototype.getStats;
      RTCPeerConnection.prototype.getStats = function(selector, onSucc, onErr) {
        return nativeGetStats.apply(this, [selector || null])
          .then(function(stats) {
            return makeMapStats(stats);
          })
          .then(onSucc, onErr);
      };
    }
  }
};

// Expose public methods.
module.exports = {
  shimOnTrack: firefoxShim.shimOnTrack,
  shimSourceObject: firefoxShim.shimSourceObject,
  shimPeerConnection: firefoxShim.shimPeerConnection,
  shimGetUserMedia: require('./getusermedia')
};

},{"../utils":39,"./getusermedia":37}],37:[function(require,module,exports){
/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
 /* eslint-env node */
'use strict';

var logging = require('../utils').log;
var browserDetails = require('../utils').browserDetails;

// Expose public methods.
module.exports = function() {
  var shimError_ = function(e) {
    return {
      name: {
        SecurityError: 'NotAllowedError',
        PermissionDeniedError: 'NotAllowedError'
      }[e.name] || e.name,
      message: {
        'The operation is insecure.': 'The request is not allowed by the ' +
        'user agent or the platform in the current context.'
      }[e.message] || e.message,
      constraint: e.constraint,
      toString: function() {
        return this.name + (this.message && ': ') + this.message;
      }
    };
  };

  // getUserMedia constraints shim.
  var getUserMedia_ = function(constraints, onSuccess, onError) {
    var constraintsToFF37_ = function(c) {
      if (typeof c !== 'object' || c.require) {
        return c;
      }
      var require = [];
      Object.keys(c).forEach(function(key) {
        if (key === 'require' || key === 'advanced' || key === 'mediaSource') {
          return;
        }
        var r = c[key] = (typeof c[key] === 'object') ?
            c[key] : {ideal: c[key]};
        if (r.min !== undefined ||
            r.max !== undefined || r.exact !== undefined) {
          require.push(key);
        }
        if (r.exact !== undefined) {
          if (typeof r.exact === 'number') {
            r. min = r.max = r.exact;
          } else {
            c[key] = r.exact;
          }
          delete r.exact;
        }
        if (r.ideal !== undefined) {
          c.advanced = c.advanced || [];
          var oc = {};
          if (typeof r.ideal === 'number') {
            oc[key] = {min: r.ideal, max: r.ideal};
          } else {
            oc[key] = r.ideal;
          }
          c.advanced.push(oc);
          delete r.ideal;
          if (!Object.keys(r).length) {
            delete c[key];
          }
        }
      });
      if (require.length) {
        c.require = require;
      }
      return c;
    };
    constraints = JSON.parse(JSON.stringify(constraints));
    if (browserDetails.version < 38) {
      logging('spec: ' + JSON.stringify(constraints));
      if (constraints.audio) {
        constraints.audio = constraintsToFF37_(constraints.audio);
      }
      if (constraints.video) {
        constraints.video = constraintsToFF37_(constraints.video);
      }
      logging('ff37: ' + JSON.stringify(constraints));
    }
    return navigator.mozGetUserMedia(constraints, onSuccess, function(e) {
      onError(shimError_(e));
    });
  };

  // Returns the result of getUserMedia as a Promise.
  var getUserMediaPromise_ = function(constraints) {
    return new Promise(function(resolve, reject) {
      getUserMedia_(constraints, resolve, reject);
    });
  };

  // Shim for mediaDevices on older versions.
  if (!navigator.mediaDevices) {
    navigator.mediaDevices = {getUserMedia: getUserMediaPromise_,
      addEventListener: function() { },
      removeEventListener: function() { }
    };
  }
  navigator.mediaDevices.enumerateDevices =
      navigator.mediaDevices.enumerateDevices || function() {
        return new Promise(function(resolve) {
          var infos = [
            {kind: 'audioinput', deviceId: 'default', label: '', groupId: ''},
            {kind: 'videoinput', deviceId: 'default', label: '', groupId: ''}
          ];
          resolve(infos);
        });
      };

  if (browserDetails.version < 41) {
    // Work around http://bugzil.la/1169665
    var orgEnumerateDevices =
        navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
    navigator.mediaDevices.enumerateDevices = function() {
      return orgEnumerateDevices().then(undefined, function(e) {
        if (e.name === 'NotFoundError') {
          return [];
        }
        throw e;
      });
    };
  }
  if (browserDetails.version < 49) {
    var origGetUserMedia = navigator.mediaDevices.getUserMedia.
        bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = function(c) {
      return origGetUserMedia(c).then(function(stream) {
        // Work around https://bugzil.la/802326
        if (c.audio && !stream.getAudioTracks().length ||
            c.video && !stream.getVideoTracks().length) {
          stream.getTracks().forEach(function(track) {
            track.stop();
          });
          throw new DOMException('The object can not be found here.',
                                 'NotFoundError');
        }
        return stream;
      }, function(e) {
        return Promise.reject(shimError_(e));
      });
    };
  }
  navigator.getUserMedia = function(constraints, onSuccess, onError) {
    if (browserDetails.version < 44) {
      return getUserMedia_(constraints, onSuccess, onError);
    }
    // Replace Firefox 44+'s deprecation warning with unprefixed version.
    console.warn('navigator.getUserMedia has been replaced by ' +
                 'navigator.mediaDevices.getUserMedia');
    navigator.mediaDevices.getUserMedia(constraints).then(onSuccess, onError);
  };
};

},{"../utils":39}],38:[function(require,module,exports){
/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
'use strict';
var safariShim = {
  // TODO: DrAlex, should be here, double check against LayoutTests
  // shimOnTrack: function() { },

  // TODO: once the back-end for the mac port is done, add.
  // TODO: check for webkitGTK+
  // shimPeerConnection: function() { },

  shimGetUserMedia: function() {
    navigator.getUserMedia = navigator.webkitGetUserMedia;
  }
};

// Expose public methods.
module.exports = {
  shimGetUserMedia: safariShim.shimGetUserMedia
  // TODO
  // shimOnTrack: safariShim.shimOnTrack,
  // shimPeerConnection: safariShim.shimPeerConnection
};

},{}],39:[function(require,module,exports){
/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
 /* eslint-env node */
'use strict';

var logDisabled_ = true;

// Utility methods.
var utils = {
  disableLog: function(bool) {
    if (typeof bool !== 'boolean') {
      return new Error('Argument type: ' + typeof bool +
          '. Please use a boolean.');
    }
    logDisabled_ = bool;
    return (bool) ? 'adapter.js logging disabled' :
        'adapter.js logging enabled';
  },

  log: function() {
    if (typeof window === 'object') {
      if (logDisabled_) {
        return;
      }
      if (typeof console !== 'undefined' && typeof console.log === 'function') {
        console.log.apply(console, arguments);
      }
    }
  },

  /**
   * Extract browser version out of the provided user agent string.
   *
   * @param {!string} uastring userAgent string.
   * @param {!string} expr Regular expression used as match criteria.
   * @param {!number} pos position in the version string to be returned.
   * @return {!number} browser version.
   */
  extractVersion: function(uastring, expr, pos) {
    var match = uastring.match(expr);
    return match && match.length >= pos && parseInt(match[pos], 10);
  },

  /**
   * Browser detector.
   *
   * @return {object} result containing browser and version
   *     properties.
   */
  detectBrowser: function() {
    // Returned result object.
    var result = {};
    result.browser = null;
    result.version = null;

    // Fail early if it's not a browser
    if (typeof window === 'undefined' || !window.navigator) {
      result.browser = 'Not a browser.';
      return result;
    }

    // Firefox.
    if (navigator.mozGetUserMedia) {
      result.browser = 'firefox';
      result.version = this.extractVersion(navigator.userAgent,
          /Firefox\/([0-9]+)\./, 1);

    // all webkit-based browsers
    } else if (navigator.webkitGetUserMedia) {
      // Chrome, Chromium, Webview, Opera, all use the chrome shim for now
      if (window.webkitRTCPeerConnection) {
        result.browser = 'chrome';
        result.version = this.extractVersion(navigator.userAgent,
          /Chrom(e|ium)\/([0-9]+)\./, 2);

      // Safari or unknown webkit-based
      // for the time being Safari has support for MediaStreams but not webRTC
      } else {
        // Safari UA substrings of interest for reference:
        // - webkit version:           AppleWebKit/602.1.25 (also used in Op,Cr)
        // - safari UI version:        Version/9.0.3 (unique to Safari)
        // - safari UI webkit version: Safari/601.4.4 (also used in Op,Cr)
        //
        // if the webkit version and safari UI webkit versions are equals,
        // ... this is a stable version.
        //
        // only the internal webkit version is important today to know if
        // media streams are supported
        //
        if (navigator.userAgent.match(/Version\/(\d+).(\d+)/)) {
          result.browser = 'safari';
          result.version = this.extractVersion(navigator.userAgent,
            /AppleWebKit\/([0-9]+)\./, 1);

        // unknown webkit-based browser
        } else {
          result.browser = 'Unsupported webkit-based browser ' +
              'with GUM support but no WebRTC support.';
          return result;
        }
      }

    // Edge.
    } else if (navigator.mediaDevices &&
        navigator.userAgent.match(/Edge\/(\d+).(\d+)$/)) {
      result.browser = 'edge';
      result.version = this.extractVersion(navigator.userAgent,
          /Edge\/(\d+).(\d+)$/, 2);

    // Default fallthrough: not supported.
    } else {
      result.browser = 'Not a supported browser.';
      return result;
    }

    return result;
  }
};

// Export.
module.exports = {
  log: utils.log,
  disableLog: utils.disableLog,
  browserDetails: utils.detectBrowser(),
  extractVersion: utils.extractVersion
};

},{}],40:[function(require,module,exports){
var h = require('hyperscript')
var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')

var ListOption = require('./listoption')

inherits(List, EventEmitter)

function List () {
  var self = this
  
  self._select = h('div.select')
  
  self._plus = h('button.plus', {onclick: self._onAddOption.bind(self)}, '+')
  self._minus = h('button.minus', {onclick: self._onRemoveOption.bind(self)},'-')
  self._up = h('button.up', {onclick: self._onMoveUp.bind(self)}, '▲')
  self._down = h('button.down', {onclick: self._onMoveDown.bind(self)}, '▼')

  self.element = h('div.list', 
                  self._select,
                  h('div.controls', 
                   self._plus,
                   self._minus, 
                   h('div', ' '),
                   self._up,
                   self._down))
  
  self._selected = null
  self._options = []
  
  Object.defineProperty(self, 'length', {
    get: function () {
      return self._options.length
    }
  })
  
  self._checkButtons()
}

List.prototype._setSelection = function (opt) {
  var self = this
  
  if (self._selected) self._selected.element.className = 'option'
  
  self._selected = opt

  if (!self._selected) {
    self.emit('change', null)
    return
  }
  self._selected.element.className = 'option selected'
  self._checkButtons()
  self.emit('change', opt.value)
}

List.prototype.get = function (index) {
  var self = this
  return self._options[index]
}

List.prototype.addOption = function (text, value) {
  var self = this
  
  var opt = new ListOption(0, text, value)
  self._options.forEach(function (opt) {
    opt.index++
  })
  
  self._options.splice(0, 0, opt)
  if (self._select.firstChild) {
    self._select.insertBefore(opt.element, self._select.firstChild)
  } else {
    self._select.appendChild(opt.element)
  }
  
  self._setSelection(opt)
  
  opt.element.addEventListener('click', function () {
    self._setSelection(opt)
  })
  self._checkButtons()
}

List.prototype._onAddOption = function () {
  var self = this
  
  self.emit('add')
}

List.prototype._onRemoveOption = function () {
  var self = this
  
  if (!self._selected) return
  
  var selectedIndex = self._selected.index
  
  for (var i=self._selected.index+1; i<self._options.length; i++) {
    self._options[i].index--
  }

  ;(function (oldValue) {
    self._options[selectedIndex].destroy()
    self._options.splice(selectedIndex, 1)
    self._selected = null
    self._setSelection(self._options[selectedIndex-1] || self._options[selectedIndex+1] || null)

    self.emit('remove', oldValue)
  }(self._selected.value))
  
  self._checkButtons()
}

List.prototype._onMoveUp = function () {
  var self = this
  
  if (!self._selected) return
  if (!self._options[self._selected.index-1]) return
  
  ;(function (top, bottom) {
    var topIndex = self._selected.index-1
    var bottomIndex = self._selected.index
    
    self._options[topIndex] = bottom
    self._options[bottomIndex] = top
    
    self._options[topIndex].index = topIndex
    self._options[bottomIndex].index = bottomIndex
    
    self._options[topIndex].element.parentNode.insertBefore(self._options[topIndex].element, self._options[bottomIndex].element) // swap nodes
    
    self._checkButtons()
    
    self.emit('reorder', topIndex, self._options[topIndex].value) // emit the lower indexed item
    
  }(self._options[self._selected.index-1], self._options[self._selected.index]))
}

List.prototype._onMoveDown = function () {
  var self = this
  
  if (!self._selected) return
  if (!self._options[self._selected.index+1]) return
  
  ;(function (top, bottom) {
    var topIndex = self._selected.index
    var bottomIndex = self._selected.index+1
    
    self._options[bottomIndex] = top
    self._options[topIndex] = bottom
    
    self._options[bottomIndex].index = bottomIndex
    self._options[topIndex].index = topIndex
    
    self._options[topIndex].element.parentNode.insertBefore(self._options[topIndex].element, self._options[bottomIndex].element) // swap nodes
    
    self._checkButtons()
    
    self.emit('reorder', topIndex, self._options[topIndex].value) // emit the lower indexed item
    
  }(self._options[self._selected.index], self._options[self._selected.index+1]))
}

List.prototype.empty = function () {
  var self = this
  
  while (self._options[0]) {
    self._options[0].destroy()
    self._options.shift()
  }
  
  self._selected = null
  
  self._checkButtons()
}

List.prototype.disableButton = function (buttonClass) {
  var self = this
  self['_'+buttonClass].className = buttonClass+' disabled'
}

List.prototype.enableButton = function (buttonClass) {
  var self = this
  self['_'+buttonClass].className = buttonClass
}

List.prototype.setButtonContent = function (buttonClass, content) {
  var self = this
  self['_'+buttonClass].innerHTML = content
}

List.prototype._checkButtons = function () {
  var self = this
  
  if (!self._selected) {
    self.disableButton('up')
    self.disableButton('down')
    self.disableButton('minus')
    return
  } else {
    self.enableButton('minus')
  }
  
  if (!self._options[self._selected.index-1]) {
    self.disableButton('up')
  } else {
    self.enableButton('up')
  }
  
  if (!self._options[self._selected.index+1]) {
    self.disableButton('down')
  } else {
    self.enableButton('down')
  }
}

module.exports = List
},{"./listoption":41,"events":2,"hyperscript":20,"inherits":22}],41:[function(require,module,exports){
var h = require('hyperscript')

function ListOption (index, text, value) {
  var self = this

  self.index = index
  self.text = text
  self.value = value
  self.element = h('div.option', self.text) 
}

ListOption.prototype.destroy = function () {
  var self = this
  
  self.element.parentElement.removeChild(self.element)
  self.element = null
  
  self.index = null
  self.text = null
  self.value = null
}
  
module.exports = ListOption
},{"hyperscript":20}],42:[function(require,module,exports){
// moves/resizes a source on a scene

var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')
var h = require('hyperscript')
var interact = require('interactjs')

inherits(SourceMover, EventEmitter)

function SourceMover (source, output) {
  var self = this

  self.player = document.querySelector('.JumpStreamer .view video')
  
  self.id = source.id
  self.output = output
  self.destroyed = false
  
  self.x = 0
  self.y = 0
  self.width = self.player.clientWidth
  self.height = self.player.clientHeight
  
  self.outx = self.x + 2
  self.outy = self.y + 2
  
  self.xRatio = self.output.width / self.player.clientWidth
  self.yRatio = self.output.height / self.player.clientHeight
  
  window.addEventListener('resize', self._onWindowResize.bind(self))
  
  self.element = h('div.mover', 
                  h('div.corner.top.left'),
                  h('div.corner.top.right'),
                  h('div.corner.bottom.left'),
                  h('div.corner.bottom.right'))
  self._setStyle()
  
  interact(self.element).draggable({
    onmove: self._onDragMove.bind(self)
  }).resizable({
    edges: { left: true, right: true, bottom: true, top: true }
  }).on('resizemove', self._onResizeMove.bind(self))
}

SourceMover.prototype._onWindowResize = function () {
  var self = this
  
  if (self.destroyed) return
  
  self.xRatio = self.output.width / self.player.clientWidth
  self.yRatio = self.output.height / self.player.clientHeight
    
  // TODO: Figure out how to recalc the transform
  self._setStyle()
}

SourceMover.prototype.focus = function () {
  var self = this
  self.element.style.display = ''
}

SourceMover.prototype.blur = function (){
  var self = this
  self.element.style.display = 'none'
}

SourceMover.prototype._onDragMove = function (event) {
  var self = this
  
  var target = event.target
  // keep the dragged position in the data-x/data-y attributes
  var x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx
  var y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy

  // translate the element
  target.style.transform = 'translate(' + x + 'px, ' + y + 'px)'

  // update the position attributes
  target.setAttribute('data-x', x)
  target.setAttribute('data-y', y)
  
  // update the source
  self.outx = self.x + x + 2
  self.outy = self.x + y + 2
}

SourceMover.prototype._onResizeMove = function (event) {
  var self = this
  
  var target = event.target
  var x = (parseFloat(target.getAttribute('data-x')) || 0)
  var y = (parseFloat(target.getAttribute('data-y')) || 0)

  // update the element's style
  target.style.width  = event.rect.width + 'px'
  target.style.height = event.rect.height + 'px'

  // translate when resizing from top or left edges
  x += event.deltaRect.left
  y += event.deltaRect.top

  target.style.transform = 'translate(' + x + 'px,' + y + 'px)';

  target.setAttribute('data-x', x)
  target.setAttribute('data-y', y)
  
  // update the source
  self.outx = self.x + x + 2
  self.outy = self.x + y + 2
  
  self.width = event.rect.width
  self.height = event.rect.height
}

SourceMover.prototype._setStyle = function (element) {
  var self = this
  
  self.element.style = 
    'left:'+self.player.offsetLeft+'px;'+
    'top:'+self.player.offsetTop+'px;'+
    'width:'+self.width+'px;'+
    'height:'+self.height+'px;'
}

SourceMover.prototype.draw = function (ctx, frame, next) {
  var self = this
  
  if (self.destroyed) return next()

  ctx.drawImage(frame, self.outx * self.xRatio, self.outy * self.yRatio, self.width * self.xRatio, self.height * self.yRatio)
  
  next()
}

SourceMover.prototype.show = function () {
  var self = this
  self.element.style.display = ''
}

SourceMover.prototype.hide = function () {
  var self = this
  self.element.style.display = 'none'
}

SourceMover.prototype.destroy = function () {
  var self = this
  
  self.element.parentElement.removeChild(self.element)
  
  self.element = null
  self.output = null
  self.id = null
  self.x = null
  self.y = null
  self.width = null
  self.height = null
  self.xRatio = null
  self.yRatio = null
  self.destroyed = true
}
  
module.exports = SourceMover
},{"events":2,"hyperscript":20,"inherits":22,"interactjs":23}],43:[function(require,module,exports){
var h = require('hyperscript')
var VideoStreamMerger = require('video-stream-merger')
var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')

var View = require('./widgets/view')
var Scenes = require('./widgets/scenes')
var Sources = require('./widgets/sources')
var Transitions = require('./widgets/transitions')
var MixerPanel = require('./widgets/mixerPanel')
var Controls = require('./widgets/controls')

inherits(Display, EventEmitter)

function Display (element, opts) {
  var self = this
  
  self._merger = new VideoStreamMerger(opts.output)
  self._merger.start()
  
  self.view = new View(opts) 
  self.scenes = new Scenes(self._merger, opts)
  self.sources = new Sources(opts)
  self.mixerPanel = new MixerPanel(opts)
  self.transitions = new Transitions(opts)
  self.controls = new Controls(opts)
  
  self.sources.ready()
  
  self.view.setStream(self._merger.result)

  self.element = h('div.JumpStreamer',
                   self.view.element,
                   h('div.toolbar',
                    self.scenes.element,
                    self.sources.element,
                    self.mixerPanel.element,
                    self.transitions.element,
                    self.controls.element))

  element.appendChild(self.element)
  
  self.sources.on('remove', function (source) {
    self.scenes.removeSource(source)
  })
  self.sources.on('change', function (source) {
    self.scenes.focusSource(source)
  })
  self.sources.on('reorder', function (index, source) {
    self.scenes.reorderSource(index, source)
  })
  
  self.scenes.on('change', self._changeScene.bind(self))
  self.scenes.on('mover', function (mover) {
    self.view.addMover(mover)
  })
  
  self.controls.on('stream', function () {
    self.emit('stream', self._merger.result)
  })
  self.controls.on('stopstream', function () {
    self.emit('stopstream')
  })

}

Display.prototype._changeScene = function (scene) {
  var self = this
  
  self.sources.setScene(scene)
}
  
module.exports = Display
},{"./widgets/controls":44,"./widgets/mixerPanel":45,"./widgets/scenes":46,"./widgets/sources":47,"./widgets/transitions":48,"./widgets/view":49,"events":2,"hyperscript":20,"inherits":22,"video-stream-merger":29}],44:[function(require,module,exports){
var h = require('hyperscript')
var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')

inherits(Controls, EventEmitter)

function Controls () {
  var self = this

  self._startedStream = false
  self._startButton = h('button.stopped', {onclick: self.clickStream.bind(self)}, 'Start Streaming')
  self._startButton.style.marginTop = '10px'
  
  var label = h('label')
  label.innerHTML = '&nbsp;'
  
  self.element = h('div.controls',
                    label,
                    self._startButton//,
                    //h('button', {onclick: self.clickRecord}, 'Start Recording'),
                    //h('button', {onclick: self.clickSettings}, 'Settings')
                  )
}

Controls.prototype.clickStream = function () {
  var self = this
  
  if (self._startedStream) {
    self._startButton.innerHTML = 'Start Streaming'
    self._startButton.className = 'stopped'
    self.emit('stopstream')
  } else {
    self._startButton.innerHTML = 'Stop Streaming'
    self._startButton.className = 'started'
    self.emit('stream')
  }
  
  self._startedStream = !self._startedStream
}

Controls.prototype.clickRecord = function () {
  var self = this
  // TODO
}

Controls.prototype.clickSettings = function () {
  var self = this
  // TODO
}
  
module.exports = Controls
},{"events":2,"hyperscript":20,"inherits":22}],45:[function(require,module,exports){
var h = require('hyperscript')

var mixer = require('./../../lib/mixer')

function MixerPanel () {
  var self = this
  
  var listEl = h('div')
  
  self.element = h('div.mixer',
                  h('label', 'Mixer'),
                  listEl)
  
  mixer.on('sourceAdd', function (source) {
    console.log('source added', source)
    var sourceElement = h('div#a'+source.id, 
                         h('label', source.name),
                         h('div.meter'))
    listEl.appendChild(sourceElement)
  })
  
  mixer.on('sourceRemove', function (source) {
    console.log('source removed', source)
    var el = listEl.querySelector('#a'+source.id)
    if (!el) return
    listEl.removeChild(el)
  })
  
  mixer.on('sourceVolume', function (source, volume) {
    var el = listEl.querySelector('#a'+source.id + ' .meter')
    if (!el) return
    el.style.width = volume+'%'
  })
}
  
module.exports = MixerPanel
},{"./../../lib/mixer":52,"hyperscript":20}],46:[function(require,module,exports){
// Controls adding/removing/changing of scenes

var h = require('hyperscript')
var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')
var VideoStreamMerger = require('video-stream-merger')

var List = require('./../common/list')
var Scene = require('./../../lib/scene')

inherits(Scenes, EventEmitter)

function Scenes (output) {
  var self = this

  self.list = new List()
  self.list.on('add', self._createScene.bind(self))
  self.list.on('remove', self._destroyScene.bind(self))
  self.list.on('change', self._changeScene.bind(self))
  
  self.element = h('div.scenes',
                  h('label', 'Scenes'),
                  self.list.element)
  
  self.counter = 0
  self._currentScene = null
  
  self._output = output
}

Scenes.prototype.focusSource = function (source) {
  var self = this
  self._currentScene.focusSource(source)
}

Scenes.prototype.removeSource = function (source) {
  var self = this
  
  self._currentScene.removeSource(source)
}

Scenes.prototype.reorderSource = function (index, source) {
  var self = this
  
  self._currentScene.reorderSource(index, source)
}

Scenes.prototype._createScene = function () {
  var self = this
  
  var newScene = new Scene(self._output)
  
  newScene.on('mover', function (mover) {
    self.emit('mover', mover)
  })
  
  self.counter++
  self.list.addOption('Scene '+self.counter, newScene)
}

Scenes.prototype._destroyScene = function (scene) {
  var self = this
  
  scene.destroy()
}

Scenes.prototype._changeScene = function (scene) {
  var self = this
  
  if (self._currentScene) self._currentScene.hide()
  
  if (scene) {
    scene.show()
    self._currentScene = scene
  }
  
  self.emit('change', scene)
}
  
module.exports = Scenes
},{"./../../lib/scene":53,"./../common/list":40,"events":2,"hyperscript":20,"inherits":22,"video-stream-merger":29}],47:[function(require,module,exports){
var h = require('hyperscript')
var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')

var List = require('./../common/list')
var InputManager = require('./../../lib/inputmanager')
var Source = require('./../../lib/source')

inherits(Sources, EventEmitter)

function Sources (opts) {
  var self = this

  self.list = new List()
  
  self.inputManager = new InputManager(opts)
  
  self.list.on('add', function () {
    self._getSource()
  })
  
  self.scene = null
  self._ready = false
  
  self.element = h('div.sources',
                  h('label', 'Sources'),
                  self.list.element)
  
  self.list.on('remove', function (source) {
    self.emit('remove', source)
  })
  self.list.on('change', function (source) {
    self.emit('change', source)
  })
  self.list.on('reorder', function (index, source) {
    self.emit('reorder', index, source)
  })
  
  self.list.disableButton('plus')
  self.list.setButtonContent('plus', '&#9716;')
}

Sources.prototype.ready = function () {
  var self = this
  
  self.list.setButtonContent('plus', '+')
  
  self._ready = true
  self.emit('ready')
}

Sources.prototype._getSource = function () {
  var self = this
  
  self.inputManager.chooseDevice(function (err, name, hasVideo, stream) {
    if (err) throw err
    
    var newSource = new Source(stream, name || 'Source', hasVideo)
    
    self.scene.addSource(newSource)
    self.list.addOption(newSource.name, newSource)
    
    self.emit('add', newSource)
  })
}

Sources.prototype.setScene = function (scene) {
  var self = this
  
  if (!self._ready) {
    self.once('ready', function () {
      self.setScene(scene)
    })
    return
  }
  
  self.list.empty()
  
  if (!scene) {
    self.list.disableButton('plus')
    return
  }
  
  scene.sources.forEach((source) => {
    self.list.addOption(source.name, source)
  })
  
  self.scene = scene
  
  self.list.enableButton('plus')
}
  
module.exports = Sources
},{"./../../lib/inputmanager":51,"./../../lib/source":54,"./../common/list":40,"events":2,"hyperscript":20,"inherits":22}],48:[function(require,module,exports){
var h = require('hyperscript')

function Transitions () {
  var self = this

  self.element = h('div.transitions',
                  h('label', 'Scene Transitions'))
}

Transitions.prototype.method = function () {
  var self = this
  
}
  
module.exports = Transitions
},{"hyperscript":20}],49:[function(require,module,exports){
var h = require('hyperscript')

function View () {
  var self = this

  self.video = h('video', {
    autoplay: true,
    muted: true
  })
  
  self.video.setAttribute('height', '100%')
  
  self.element = h('div.view', self.video)
}

View.prototype.addMover = function (mover) {
  var self = this
  
  self.element.appendChild(mover.element)
}

View.prototype.setStream = function (stream) {
  var self = this
  
  self.video.srcObject = stream
}

module.exports = View
},{"hyperscript":20}],50:[function(require,module,exports){
var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')

var Display = require('./display/display')
var mixer = require('./lib/mixer')

inherits(WBS, EventEmitter)

function WBS (element, opts) {
  var self = this
  if (!(self instanceof WBS)) return new WBS(element, opts)

  if (typeof element === 'string') {
    element = document.querySelector(element)
  }

  opts = opts || {}
  
  var audioContext = new AudioContext()

  mixer.setAudioContext(audioContext)
  opts.output = opts.output || {
    width: 400 * 3,
    height: 300 * 3,
    fps: 40,
    audioContext: audioContext
  }
  opts.inputs = opts.inputs || []
  opts.injectStyles = opts.injectStyles || true

  if (opts.injectStyles) require('./../less/wbs.css')

  self._display = new Display(element, opts)

  self._display.on('stream', function (stream) {
    self.emit('stream', stream)
  })
  self._display.on('stopstream', function () {
    self.emit('stopstream')
  })
}

module.exports = WBS

},{"./../less/wbs.css":6,"./display/display":43,"./lib/mixer":52,"events":2,"inherits":22}],51:[function(require,module,exports){
var vex = require('vex-js')
vex.registerPlugin(require('vex-dialog'))

require('./../../less/vex.css')
require('./../../less/vex-theme-plain.css')

vex.defaultOptions.className = 'vex-theme-plain'

var h = require('hyperscript')
var getusermedia = require('getusermedia')
var enumerateDevices = require('enumerate-devices')

function getMediaPermissions (cb) {
  getusermedia({audio: true, video:true}, cb)
}

function getReadableName (device, counter) {
  if (device.label) {
    return device.label + ' ('+formatKind(device.kind)+')'
  } else {
    return formatKind(device.kind)+ ' ' + counter
  }
}

function formatKind (kind) {
  switch (kind) {
    case 'audioinput':
      return 'Audio Input'
      break
    case 'videoinput':
      return 'Video Input'
      break
    case 'audiooutput':
      return 'Audio Output'
      break
    case 'videooutput':
      return 'Video Output'
      break
  }
}

function contains (str, substr) {
  return str.indexOf(substr) !== -1
}

function InputManager (opts) {
  var self = this

  self.inputs = opts.inputs
  var counter = -1

  self.inputs.forEach(device => {
    counter++
    device.id = counter
  })

  // add default inputs
  getMediaPermissions(function (err) {
    if (err) return console.error(err)

    self.inputs.push({
      id: ++counter,
      name: 'Image Asset',
      getStream: function (cb) {
        self.getFile(file => {
          const imageElement = document.createElement('img')
          const reader = new FileReader()
          console.log(file)
          reader.onload = function(event) {
            console.log('loaded')
            imageElement.src = event.target.result
            cb(null, file.name, true, imageElement)
          }
          reader.readAsDataURL(file)
        })
      }
    })

    if (navigator.mediaDevices.getDisplayMedia) {
      self.inputs.push({
        id: ++counter,
        name: 'Screen Capture',
        getStream: function (cb) {
          navigator.mediaDevices.getDisplayMedia({ audio: false, video: true }).then(stream => {
            cb(null, 'Screen Capture', true, stream)
          })
        }
      })
    }

    enumerateDevices().then((devices) => {
      devices.forEach(function (device) {
        var deviceName = getReadableName(device, counter)
        var hasVideo = contains(device.kind, 'video')
        self.inputs.push({
          id: ++counter,
          name: deviceName,
          getStream: function (cb) {
            getusermedia({
              audio: contains(device.kind, 'audio') ? {exact: device.deviceId}: undefined,
              video: contains(device.kind, 'video') ? {exact: device.deviceId} : undefined
            }, function (err, stream) {
              cb(err, deviceName, hasVideo, stream)
            })
          }
        })
      })
    })
  })
}

InputManager.prototype.getFile = function (cb) {
  var self = this
  
  vex.dialog.open({
    message: 'Select a file',
    input: [
        '<style>',
            '.vex-custom-field-wrapper {',
                'margin: 1em 0;',
            '}',
            '.vex-custom-field-wrapper > label {',
                'display: inline-block;',
                'margin-bottom: .2em;',
            '}',
        '</style>',
        '<div class="vex-custom-field-wrapper">',
          '<input id="fileUpload" type="file" />',
        '</div>'
    ].join(''),
    callback: function () {
        const file = document.querySelector('#fileUpload').files[0]
        if (!file) return
        cb(file)
    }
  })
}

InputManager.prototype.chooseDevice = function (cb) {
  var self = this
  
  vex.dialog.open({
    message: 'Select a media source',
    input: [
        '<style>',
            '.vex-custom-field-wrapper {',
                'margin: 1em 0;',
            '}',
            '.vex-custom-field-wrapper > label {',
                'display: inline-block;',
                'margin-bottom: .2em;',
            '}',
        '</style>',
        '<div class="vex-custom-field-wrapper">',
            '<div class="vex-custom-input-wrapper">',
                '<select name="chosen">',
                  self.inputs.map(function (a) {
                    return '<option value="'+a.id+'">'+a.name+'</option>'
                  }).join(''),
                '</select>',
            '</div>',
        '</div>'
    ].join(''),
    callback: function (data) {
        if (!data) return
        self.inputs[data.chosen].getStream(cb)
    }
  })
}
  
module.exports = InputManager
},{"./../../less/vex-theme-plain.css":4,"./../../less/vex.css":5,"enumerate-devices":16,"getusermedia":19,"hyperscript":20,"vex-dialog":27,"vex-js":28}],52:[function(require,module,exports){
var VolumeMeter = require('volume-meter')

var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')

inherits(Mixer, EventEmitter)

function Mixer () {
  var self = this

  self.audioContext = null
  self.analyzer = null
}

Mixer.prototype.setAudioContext = function (audioContext) {
  var self = this
  
  self.audioContext = audioContext
}

Mixer.prototype.addStream = function (sourceObj, sourceNode, destNode) {
  var self = this
  
  self.emit('sourceAdd', sourceObj)
  
  var meter = VolumeMeter(self.audioContext, { tweenIn: 2, tweenOut: 6 }, function (volume) {
    self.emit('sourceVolume', sourceObj, volume)
  })
  
  sourceNode.connect(meter)
  sourceNode.connect(destNode)

  console.log('added')
}

Mixer.prototype.removeStream = function (id) {
  var self = this
  
  self.emit('sourceRemove', id)
  console.log('removed')
}
  
module.exports = new Mixer()
},{"events":2,"inherits":22,"volume-meter":30}],53:[function(require,module,exports){
// merges multiple Sources

var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')

var SourceMover = require('./../display/common/sourcemover')
var mixer = require('./mixer')

inherits(Scene, EventEmitter)

function Scene (output, mixerEffect, opts) {
  var self = this
  
  opts = opts || {}
  opts.width = opts.width || 400*3
  opts.height = opts.height || 400*3
  
  self.sources = []
  
  self._output = output
  self._mixerEffect = mixerEffect
}

Scene.prototype.addSource = function (source, opts) {
  var self = this

  opts = opts || {}
  opts.audioEffect = source.audioEffect
  opts.index = null // place on top
  
  if (source.hasVideo) {
    var mover = new SourceMover(source, self._output)
    source.mover = mover
    opts.draw = mover.draw.bind(mover)
    self.emit('mover', mover)
    opts.mute = true
  }

  if (!source.hasVideo) {
    source.audioEffect = mixer.addStream.bind(mixer, source)
    opts.audioEffect = source.audioEffect
  }
  
  if (source.stream instanceof HTMLMediaElement || source.stream instanceof HTMLImageElement) {
    self._output.addMediaElement(source.id, source.stream, opts)
  } else {
    self._output.addStream(source.stream, opts)
  }
  self.sources.push(source)

  console.log(self.sources)
}

Scene.prototype.removeSource = function (source) {
  var self = this
  
  self._output.removeStream(source.stream)
  mixer.removeStream(source)
  
  for (var i=0; i<self.sources.length; i++) {
    if (self.sources[i].id === source.id) {
      self.sources[i].destroy()
      self.sources.splice(i, 1)
      i--
    }
  }
}

Scene.prototype.reorderSource = function (index, source) {
  var self = this
  
  index = self.sources.length - (index+1)
  
  self._output.updateIndex(source.stream, index)
  
  for (var i=0; i<self.sources.length; i++) {
    if (self.sources[i].id === source.id) {
      self.sources.splice(i, 1)
      i--
    }
  }
  self.sources.splice(index, 0, source)
  
  console.log(self.sources)
}

Scene.prototype.focusSource = function (source) {
  var self = this
  
  for (var i=0; i<self.sources.length; i++) {
    if (!self.sources[i].mover) continue
    if (source && self.sources[i].id === source.id) {
      self.sources[i].mover.focus()
    } else {
      self.sources[i].mover.blur()
    }
  }
}

Scene.prototype.show = function () {
  var self = this

  console.log(self._output._streams)
  
  for (var i=0; i<self.sources.length; i++) {
    var isMediaElement = self.sources[i] instanceof HTMLMediaElement
    if (isMediaElement) {
      if (self.sources[i].mover) {
        self._output.addMediaElement(self.sources[i].id, self.sources[i].stream, {
          draw: self.sources[i].mover.draw.bind(self.sources[i].mover),
          audioEffect: mixer.addStream.bind(mixer, self.sources[i]),
          mute: true
        })
        self.sources[i].mover.show()
      } else {
        self._output.addMediaElement(self.sources[i].id, self.sources[i].stream, {
          audioEffect: mixer.addStream.bind(mixer, self.sources[i])
        })
      }
    } else {
      if (self.sources[i].mover) {
        self._output.addStream(self.sources[i].stream, {
          draw: self.sources[i].mover.draw.bind(self.sources[i].mover),
          audioEffect: mixer.addStream.bind(mixer, self.sources[i]),
          mute: true
        })
        self.sources[i].mover.show()
      } else {
        self._output.addStream(self.sources[i].stream, {
          audioEffect: mixer.addStream.bind(mixer, self.sources[i])
        })
      }
    }
  }
}

Scene.prototype.hide = function () {
  var self = this
  
  for (var i=0; i<self.sources.length; i++) {
    if (self.sources[i].stream instanceof HTMLMediaElement) {
      self._output.removeStream(self.sources[i].id)
    } else {
      self._output.removeStream(self.sources[i].stream)
    }
    mixer.removeStream(self.sources[i])

    if (self.sources[i].mover) {
      self.sources[i].mover.hide()
    }
  }
}

Scene.prototype.destroy = function () {
  var self = this
  
  for (var i=0; i<self.sources.length; i++) {
    self.sources[i].destroy()
  }
  
  self.sources = []
}
  
module.exports = Scene
},{"./../display/common/sourcemover":42,"./mixer":52,"events":2,"inherits":22}],54:[function(require,module,exports){
// wraps an input MediaStream

var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')
var cuid = require('cuid')

inherits(Source, EventEmitter)

function Source (stream, name, hasVideo) {
  var self = this

  self.stream = stream || null
  self.id = stream.id || cuid()
  self.name = name || 'Source'
  self.hasVideo = hasVideo
  self.mover = null
}

Source.prototype.destroy = function () {
  var self = this
  
  self.stream = null
  self.id = null
  self.name = null
  if (self.mover) self.mover.destroy()
  self.mover = null
}
  
module.exports = Source
},{"cuid":11,"events":2,"inherits":22}]},{},[50])(50)
});
