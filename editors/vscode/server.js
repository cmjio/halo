import { createRequire } from "node:module";
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toESMCache_node;
var __toESMCache_esm;
var __toESM = (mod, isNodeMode, target) => {
  var canCache = mod != null && typeof mod === "object";
  if (canCache) {
    var cache = isNodeMode ? __toESMCache_node ??= new WeakMap : __toESMCache_esm ??= new WeakMap;
    var cached = cache.get(mod);
    if (cached)
      return cached;
  }
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  if (mod && typeof mod === "object" || typeof mod === "function") {
    for (let key of __getOwnPropNames(mod))
      if (!__hasOwnProp.call(to, key))
        __defProp(to, key, {
          get: __accessProp.bind(mod, key),
          enumerable: true
        });
  }
  if (canCache)
    cache.set(mod, to);
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// node_modules/vscode-languageserver/lib/common/utils/is.js
var require_is = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.thenable = exports.typedArray = exports.stringArray = exports.array = exports.func = exports.error = exports.number = exports.string = exports.boolean = undefined;
  function boolean(value) {
    return value === true || value === false;
  }
  exports.boolean = boolean;
  function string(value) {
    return typeof value === "string" || value instanceof String;
  }
  exports.string = string;
  function number(value) {
    return typeof value === "number" || value instanceof Number;
  }
  exports.number = number;
  function error(value) {
    return value instanceof Error;
  }
  exports.error = error;
  function func(value) {
    return typeof value === "function";
  }
  exports.func = func;
  function array(value) {
    return Array.isArray(value);
  }
  exports.array = array;
  function stringArray(value) {
    return array(value) && value.every((elem) => string(elem));
  }
  exports.stringArray = stringArray;
  function typedArray(value, check) {
    return Array.isArray(value) && value.every(check);
  }
  exports.typedArray = typedArray;
  function thenable(value) {
    return value && func(value.then);
  }
  exports.thenable = thenable;
});

// node_modules/vscode-jsonrpc/lib/common/is.js
var require_is2 = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.stringArray = exports.array = exports.func = exports.error = exports.number = exports.string = exports.boolean = undefined;
  function boolean(value) {
    return value === true || value === false;
  }
  exports.boolean = boolean;
  function string(value) {
    return typeof value === "string" || value instanceof String;
  }
  exports.string = string;
  function number(value) {
    return typeof value === "number" || value instanceof Number;
  }
  exports.number = number;
  function error(value) {
    return value instanceof Error;
  }
  exports.error = error;
  function func(value) {
    return typeof value === "function";
  }
  exports.func = func;
  function array(value) {
    return Array.isArray(value);
  }
  exports.array = array;
  function stringArray(value) {
    return array(value) && value.every((elem) => string(elem));
  }
  exports.stringArray = stringArray;
});

// node_modules/vscode-jsonrpc/lib/common/messages.js
var require_messages = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.Message = exports.NotificationType9 = exports.NotificationType8 = exports.NotificationType7 = exports.NotificationType6 = exports.NotificationType5 = exports.NotificationType4 = exports.NotificationType3 = exports.NotificationType2 = exports.NotificationType1 = exports.NotificationType0 = exports.NotificationType = exports.RequestType9 = exports.RequestType8 = exports.RequestType7 = exports.RequestType6 = exports.RequestType5 = exports.RequestType4 = exports.RequestType3 = exports.RequestType2 = exports.RequestType1 = exports.RequestType = exports.RequestType0 = exports.AbstractMessageSignature = exports.ParameterStructures = exports.ResponseError = exports.ErrorCodes = undefined;
  var is = require_is2();
  var ErrorCodes;
  (function(ErrorCodes) {
    ErrorCodes.ParseError = -32700;
    ErrorCodes.InvalidRequest = -32600;
    ErrorCodes.MethodNotFound = -32601;
    ErrorCodes.InvalidParams = -32602;
    ErrorCodes.InternalError = -32603;
    ErrorCodes.jsonrpcReservedErrorRangeStart = -32099;
    ErrorCodes.serverErrorStart = -32099;
    ErrorCodes.MessageWriteError = -32099;
    ErrorCodes.MessageReadError = -32098;
    ErrorCodes.PendingResponseRejected = -32097;
    ErrorCodes.ConnectionInactive = -32096;
    ErrorCodes.ServerNotInitialized = -32002;
    ErrorCodes.UnknownErrorCode = -32001;
    ErrorCodes.jsonrpcReservedErrorRangeEnd = -32000;
    ErrorCodes.serverErrorEnd = -32000;
  })(ErrorCodes || (exports.ErrorCodes = ErrorCodes = {}));

  class ResponseError extends Error {
    constructor(code, message, data) {
      super(message);
      this.code = is.number(code) ? code : ErrorCodes.UnknownErrorCode;
      this.data = data;
      Object.setPrototypeOf(this, ResponseError.prototype);
    }
    toJson() {
      const result = {
        code: this.code,
        message: this.message
      };
      if (this.data !== undefined) {
        result.data = this.data;
      }
      return result;
    }
  }
  exports.ResponseError = ResponseError;

  class ParameterStructures {
    constructor(kind) {
      this.kind = kind;
    }
    static is(value) {
      return value === ParameterStructures.auto || value === ParameterStructures.byName || value === ParameterStructures.byPosition;
    }
    toString() {
      return this.kind;
    }
  }
  exports.ParameterStructures = ParameterStructures;
  ParameterStructures.auto = new ParameterStructures("auto");
  ParameterStructures.byPosition = new ParameterStructures("byPosition");
  ParameterStructures.byName = new ParameterStructures("byName");

  class AbstractMessageSignature {
    constructor(method, numberOfParams) {
      this.method = method;
      this.numberOfParams = numberOfParams;
    }
    get parameterStructures() {
      return ParameterStructures.auto;
    }
  }
  exports.AbstractMessageSignature = AbstractMessageSignature;

  class RequestType0 extends AbstractMessageSignature {
    constructor(method) {
      super(method, 0);
    }
  }
  exports.RequestType0 = RequestType0;

  class RequestType extends AbstractMessageSignature {
    constructor(method, _parameterStructures = ParameterStructures.auto) {
      super(method, 1);
      this._parameterStructures = _parameterStructures;
    }
    get parameterStructures() {
      return this._parameterStructures;
    }
  }
  exports.RequestType = RequestType;

  class RequestType1 extends AbstractMessageSignature {
    constructor(method, _parameterStructures = ParameterStructures.auto) {
      super(method, 1);
      this._parameterStructures = _parameterStructures;
    }
    get parameterStructures() {
      return this._parameterStructures;
    }
  }
  exports.RequestType1 = RequestType1;

  class RequestType2 extends AbstractMessageSignature {
    constructor(method) {
      super(method, 2);
    }
  }
  exports.RequestType2 = RequestType2;

  class RequestType3 extends AbstractMessageSignature {
    constructor(method) {
      super(method, 3);
    }
  }
  exports.RequestType3 = RequestType3;

  class RequestType4 extends AbstractMessageSignature {
    constructor(method) {
      super(method, 4);
    }
  }
  exports.RequestType4 = RequestType4;

  class RequestType5 extends AbstractMessageSignature {
    constructor(method) {
      super(method, 5);
    }
  }
  exports.RequestType5 = RequestType5;

  class RequestType6 extends AbstractMessageSignature {
    constructor(method) {
      super(method, 6);
    }
  }
  exports.RequestType6 = RequestType6;

  class RequestType7 extends AbstractMessageSignature {
    constructor(method) {
      super(method, 7);
    }
  }
  exports.RequestType7 = RequestType7;

  class RequestType8 extends AbstractMessageSignature {
    constructor(method) {
      super(method, 8);
    }
  }
  exports.RequestType8 = RequestType8;

  class RequestType9 extends AbstractMessageSignature {
    constructor(method) {
      super(method, 9);
    }
  }
  exports.RequestType9 = RequestType9;

  class NotificationType extends AbstractMessageSignature {
    constructor(method, _parameterStructures = ParameterStructures.auto) {
      super(method, 1);
      this._parameterStructures = _parameterStructures;
    }
    get parameterStructures() {
      return this._parameterStructures;
    }
  }
  exports.NotificationType = NotificationType;

  class NotificationType0 extends AbstractMessageSignature {
    constructor(method) {
      super(method, 0);
    }
  }
  exports.NotificationType0 = NotificationType0;

  class NotificationType1 extends AbstractMessageSignature {
    constructor(method, _parameterStructures = ParameterStructures.auto) {
      super(method, 1);
      this._parameterStructures = _parameterStructures;
    }
    get parameterStructures() {
      return this._parameterStructures;
    }
  }
  exports.NotificationType1 = NotificationType1;

  class NotificationType2 extends AbstractMessageSignature {
    constructor(method) {
      super(method, 2);
    }
  }
  exports.NotificationType2 = NotificationType2;

  class NotificationType3 extends AbstractMessageSignature {
    constructor(method) {
      super(method, 3);
    }
  }
  exports.NotificationType3 = NotificationType3;

  class NotificationType4 extends AbstractMessageSignature {
    constructor(method) {
      super(method, 4);
    }
  }
  exports.NotificationType4 = NotificationType4;

  class NotificationType5 extends AbstractMessageSignature {
    constructor(method) {
      super(method, 5);
    }
  }
  exports.NotificationType5 = NotificationType5;

  class NotificationType6 extends AbstractMessageSignature {
    constructor(method) {
      super(method, 6);
    }
  }
  exports.NotificationType6 = NotificationType6;

  class NotificationType7 extends AbstractMessageSignature {
    constructor(method) {
      super(method, 7);
    }
  }
  exports.NotificationType7 = NotificationType7;

  class NotificationType8 extends AbstractMessageSignature {
    constructor(method) {
      super(method, 8);
    }
  }
  exports.NotificationType8 = NotificationType8;

  class NotificationType9 extends AbstractMessageSignature {
    constructor(method) {
      super(method, 9);
    }
  }
  exports.NotificationType9 = NotificationType9;
  var Message;
  (function(Message) {
    function isRequest(message) {
      const candidate = message;
      return candidate && is.string(candidate.method) && (is.string(candidate.id) || is.number(candidate.id));
    }
    Message.isRequest = isRequest;
    function isNotification(message) {
      const candidate = message;
      return candidate && is.string(candidate.method) && message.id === undefined;
    }
    Message.isNotification = isNotification;
    function isResponse(message) {
      const candidate = message;
      return candidate && (candidate.result !== undefined || !!candidate.error) && (is.string(candidate.id) || is.number(candidate.id) || candidate.id === null);
    }
    Message.isResponse = isResponse;
  })(Message || (exports.Message = Message = {}));
});

// node_modules/vscode-jsonrpc/lib/common/linkedMap.js
var require_linkedMap = __commonJS(function(exports) {
  var _a;
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.LRUCache = exports.LinkedMap = exports.Touch = undefined;
  var Touch;
  (function(Touch) {
    Touch.None = 0;
    Touch.First = 1;
    Touch.AsOld = Touch.First;
    Touch.Last = 2;
    Touch.AsNew = Touch.Last;
  })(Touch || (exports.Touch = Touch = {}));

  class LinkedMap {
    constructor() {
      this[_a] = "LinkedMap";
      this._map = new Map;
      this._head = undefined;
      this._tail = undefined;
      this._size = 0;
      this._state = 0;
    }
    clear() {
      this._map.clear();
      this._head = undefined;
      this._tail = undefined;
      this._size = 0;
      this._state++;
    }
    isEmpty() {
      return !this._head && !this._tail;
    }
    get size() {
      return this._size;
    }
    get first() {
      return this._head?.value;
    }
    get last() {
      return this._tail?.value;
    }
    has(key) {
      return this._map.has(key);
    }
    get(key, touch = Touch.None) {
      const item = this._map.get(key);
      if (!item) {
        return;
      }
      if (touch !== Touch.None) {
        this.touch(item, touch);
      }
      return item.value;
    }
    set(key, value, touch = Touch.None) {
      let item = this._map.get(key);
      if (item) {
        item.value = value;
        if (touch !== Touch.None) {
          this.touch(item, touch);
        }
      } else {
        item = { key, value, next: undefined, previous: undefined };
        switch (touch) {
          case Touch.None:
            this.addItemLast(item);
            break;
          case Touch.First:
            this.addItemFirst(item);
            break;
          case Touch.Last:
            this.addItemLast(item);
            break;
          default:
            this.addItemLast(item);
            break;
        }
        this._map.set(key, item);
        this._size++;
      }
      return this;
    }
    delete(key) {
      return !!this.remove(key);
    }
    remove(key) {
      const item = this._map.get(key);
      if (!item) {
        return;
      }
      this._map.delete(key);
      this.removeItem(item);
      this._size--;
      return item.value;
    }
    shift() {
      if (!this._head && !this._tail) {
        return;
      }
      if (!this._head || !this._tail) {
        throw new Error("Invalid list");
      }
      const item = this._head;
      this._map.delete(item.key);
      this.removeItem(item);
      this._size--;
      return item.value;
    }
    forEach(callbackfn, thisArg) {
      const state = this._state;
      let current = this._head;
      while (current) {
        if (thisArg) {
          callbackfn.bind(thisArg)(current.value, current.key, this);
        } else {
          callbackfn(current.value, current.key, this);
        }
        if (this._state !== state) {
          throw new Error(`LinkedMap got modified during iteration.`);
        }
        current = current.next;
      }
    }
    keys() {
      const state = this._state;
      let current = this._head;
      const iterator = {
        [Symbol.iterator]: () => {
          return iterator;
        },
        next: () => {
          if (this._state !== state) {
            throw new Error(`LinkedMap got modified during iteration.`);
          }
          if (current) {
            const result = { value: current.key, done: false };
            current = current.next;
            return result;
          } else {
            return { value: undefined, done: true };
          }
        }
      };
      return iterator;
    }
    values() {
      const state = this._state;
      let current = this._head;
      const iterator = {
        [Symbol.iterator]: () => {
          return iterator;
        },
        next: () => {
          if (this._state !== state) {
            throw new Error(`LinkedMap got modified during iteration.`);
          }
          if (current) {
            const result = { value: current.value, done: false };
            current = current.next;
            return result;
          } else {
            return { value: undefined, done: true };
          }
        }
      };
      return iterator;
    }
    entries() {
      const state = this._state;
      let current = this._head;
      const iterator = {
        [Symbol.iterator]: () => {
          return iterator;
        },
        next: () => {
          if (this._state !== state) {
            throw new Error(`LinkedMap got modified during iteration.`);
          }
          if (current) {
            const result = { value: [current.key, current.value], done: false };
            current = current.next;
            return result;
          } else {
            return { value: undefined, done: true };
          }
        }
      };
      return iterator;
    }
    [(_a = Symbol.toStringTag, Symbol.iterator)]() {
      return this.entries();
    }
    trimOld(newSize) {
      if (newSize >= this.size) {
        return;
      }
      if (newSize === 0) {
        this.clear();
        return;
      }
      let current = this._head;
      let currentSize = this.size;
      while (current && currentSize > newSize) {
        this._map.delete(current.key);
        current = current.next;
        currentSize--;
      }
      this._head = current;
      this._size = currentSize;
      if (current) {
        current.previous = undefined;
      }
      this._state++;
    }
    addItemFirst(item) {
      if (!this._head && !this._tail) {
        this._tail = item;
      } else if (!this._head) {
        throw new Error("Invalid list");
      } else {
        item.next = this._head;
        this._head.previous = item;
      }
      this._head = item;
      this._state++;
    }
    addItemLast(item) {
      if (!this._head && !this._tail) {
        this._head = item;
      } else if (!this._tail) {
        throw new Error("Invalid list");
      } else {
        item.previous = this._tail;
        this._tail.next = item;
      }
      this._tail = item;
      this._state++;
    }
    removeItem(item) {
      if (item === this._head && item === this._tail) {
        this._head = undefined;
        this._tail = undefined;
      } else if (item === this._head) {
        if (!item.next) {
          throw new Error("Invalid list");
        }
        item.next.previous = undefined;
        this._head = item.next;
      } else if (item === this._tail) {
        if (!item.previous) {
          throw new Error("Invalid list");
        }
        item.previous.next = undefined;
        this._tail = item.previous;
      } else {
        const next = item.next;
        const previous = item.previous;
        if (!next || !previous) {
          throw new Error("Invalid list");
        }
        next.previous = previous;
        previous.next = next;
      }
      item.next = undefined;
      item.previous = undefined;
      this._state++;
    }
    touch(item, touch) {
      if (!this._head || !this._tail) {
        throw new Error("Invalid list");
      }
      if (touch !== Touch.First && touch !== Touch.Last) {
        return;
      }
      if (touch === Touch.First) {
        if (item === this._head) {
          return;
        }
        const next = item.next;
        const previous = item.previous;
        if (item === this._tail) {
          previous.next = undefined;
          this._tail = previous;
        } else {
          next.previous = previous;
          previous.next = next;
        }
        item.previous = undefined;
        item.next = this._head;
        this._head.previous = item;
        this._head = item;
        this._state++;
      } else if (touch === Touch.Last) {
        if (item === this._tail) {
          return;
        }
        const next = item.next;
        const previous = item.previous;
        if (item === this._head) {
          next.previous = undefined;
          this._head = next;
        } else {
          next.previous = previous;
          previous.next = next;
        }
        item.next = undefined;
        item.previous = this._tail;
        this._tail.next = item;
        this._tail = item;
        this._state++;
      }
    }
    toJSON() {
      const data = [];
      this.forEach((value, key) => {
        data.push([key, value]);
      });
      return data;
    }
    fromJSON(data) {
      this.clear();
      for (const [key, value] of data) {
        this.set(key, value);
      }
    }
  }
  exports.LinkedMap = LinkedMap;

  class LRUCache extends LinkedMap {
    constructor(limit, ratio = 1) {
      super();
      this._limit = limit;
      this._ratio = Math.min(Math.max(0, ratio), 1);
    }
    get limit() {
      return this._limit;
    }
    set limit(limit) {
      this._limit = limit;
      this.checkTrim();
    }
    get ratio() {
      return this._ratio;
    }
    set ratio(ratio) {
      this._ratio = Math.min(Math.max(0, ratio), 1);
      this.checkTrim();
    }
    get(key, touch = Touch.AsNew) {
      return super.get(key, touch);
    }
    peek(key) {
      return super.get(key, Touch.None);
    }
    set(key, value) {
      super.set(key, value, Touch.Last);
      this.checkTrim();
      return this;
    }
    checkTrim() {
      if (this.size > this._limit) {
        this.trimOld(Math.round(this._limit * this._ratio));
      }
    }
  }
  exports.LRUCache = LRUCache;
});

// node_modules/vscode-jsonrpc/lib/common/disposable.js
var require_disposable = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.Disposable = undefined;
  var Disposable;
  (function(Disposable) {
    function create(func) {
      return {
        dispose: func
      };
    }
    Disposable.create = create;
  })(Disposable || (exports.Disposable = Disposable = {}));
});

// node_modules/vscode-jsonrpc/lib/common/ral.js
var require_ral = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  var _ral;
  function RAL() {
    if (_ral === undefined) {
      throw new Error(`No runtime abstraction layer installed`);
    }
    return _ral;
  }
  (function(RAL) {
    function install(ral) {
      if (ral === undefined) {
        throw new Error(`No runtime abstraction layer provided`);
      }
      _ral = ral;
    }
    RAL.install = install;
  })(RAL || (RAL = {}));
  exports.default = RAL;
});

// node_modules/vscode-jsonrpc/lib/common/events.js
var require_events = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.Emitter = exports.Event = undefined;
  var ral_1 = require_ral();
  var Event;
  (function(Event) {
    const _disposable = { dispose() {} };
    Event.None = function() {
      return _disposable;
    };
  })(Event || (exports.Event = Event = {}));

  class CallbackList {
    add(callback, context = null, bucket) {
      if (!this._callbacks) {
        this._callbacks = [];
        this._contexts = [];
      }
      this._callbacks.push(callback);
      this._contexts.push(context);
      if (Array.isArray(bucket)) {
        bucket.push({ dispose: () => this.remove(callback, context) });
      }
    }
    remove(callback, context = null) {
      if (!this._callbacks) {
        return;
      }
      let foundCallbackWithDifferentContext = false;
      for (let i = 0, len = this._callbacks.length;i < len; i++) {
        if (this._callbacks[i] === callback) {
          if (this._contexts[i] === context) {
            this._callbacks.splice(i, 1);
            this._contexts.splice(i, 1);
            return;
          } else {
            foundCallbackWithDifferentContext = true;
          }
        }
      }
      if (foundCallbackWithDifferentContext) {
        throw new Error("When adding a listener with a context, you should remove it with the same context");
      }
    }
    invoke(...args) {
      if (!this._callbacks) {
        return [];
      }
      const ret = [], callbacks = this._callbacks.slice(0), contexts = this._contexts.slice(0);
      for (let i = 0, len = callbacks.length;i < len; i++) {
        try {
          ret.push(callbacks[i].apply(contexts[i], args));
        } catch (e) {
          (0, ral_1.default)().console.error(e);
        }
      }
      return ret;
    }
    isEmpty() {
      return !this._callbacks || this._callbacks.length === 0;
    }
    dispose() {
      this._callbacks = undefined;
      this._contexts = undefined;
    }
  }

  class Emitter {
    constructor(_options) {
      this._options = _options;
    }
    get event() {
      if (!this._event) {
        this._event = (listener, thisArgs, disposables) => {
          if (!this._callbacks) {
            this._callbacks = new CallbackList;
          }
          if (this._options && this._options.onFirstListenerAdd && this._callbacks.isEmpty()) {
            this._options.onFirstListenerAdd(this);
          }
          this._callbacks.add(listener, thisArgs);
          const result = {
            dispose: () => {
              if (!this._callbacks) {
                return;
              }
              this._callbacks.remove(listener, thisArgs);
              result.dispose = Emitter._noop;
              if (this._options && this._options.onLastListenerRemove && this._callbacks.isEmpty()) {
                this._options.onLastListenerRemove(this);
              }
            }
          };
          if (Array.isArray(disposables)) {
            disposables.push(result);
          }
          return result;
        };
      }
      return this._event;
    }
    fire(event) {
      if (this._callbacks) {
        this._callbacks.invoke.call(this._callbacks, event);
      }
    }
    dispose() {
      if (this._callbacks) {
        this._callbacks.dispose();
        this._callbacks = undefined;
      }
    }
  }
  exports.Emitter = Emitter;
  Emitter._noop = function() {};
});

// node_modules/vscode-jsonrpc/lib/common/cancellation.js
var require_cancellation = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.CancellationTokenSource = exports.CancellationToken = undefined;
  var ral_1 = require_ral();
  var Is = require_is2();
  var events_1 = require_events();
  var CancellationToken;
  (function(CancellationToken) {
    CancellationToken.None = Object.freeze({
      isCancellationRequested: false,
      onCancellationRequested: events_1.Event.None
    });
    CancellationToken.Cancelled = Object.freeze({
      isCancellationRequested: true,
      onCancellationRequested: events_1.Event.None
    });
    function is(value) {
      const candidate = value;
      return candidate && (candidate === CancellationToken.None || candidate === CancellationToken.Cancelled || Is.boolean(candidate.isCancellationRequested) && !!candidate.onCancellationRequested);
    }
    CancellationToken.is = is;
  })(CancellationToken || (exports.CancellationToken = CancellationToken = {}));
  var shortcutEvent = Object.freeze(function(callback, context) {
    const handle = (0, ral_1.default)().timer.setTimeout(callback.bind(context), 0);
    return { dispose() {
      handle.dispose();
    } };
  });

  class MutableToken {
    constructor() {
      this._isCancelled = false;
    }
    cancel() {
      if (!this._isCancelled) {
        this._isCancelled = true;
        if (this._emitter) {
          this._emitter.fire(undefined);
          this.dispose();
        }
      }
    }
    get isCancellationRequested() {
      return this._isCancelled;
    }
    get onCancellationRequested() {
      if (this._isCancelled) {
        return shortcutEvent;
      }
      if (!this._emitter) {
        this._emitter = new events_1.Emitter;
      }
      return this._emitter.event;
    }
    dispose() {
      if (this._emitter) {
        this._emitter.dispose();
        this._emitter = undefined;
      }
    }
  }

  class CancellationTokenSource {
    get token() {
      if (!this._token) {
        this._token = new MutableToken;
      }
      return this._token;
    }
    cancel() {
      if (!this._token) {
        this._token = CancellationToken.Cancelled;
      } else {
        this._token.cancel();
      }
    }
    dispose() {
      if (!this._token) {
        this._token = CancellationToken.None;
      } else if (this._token instanceof MutableToken) {
        this._token.dispose();
      }
    }
  }
  exports.CancellationTokenSource = CancellationTokenSource;
});

// node_modules/vscode-jsonrpc/lib/common/sharedArrayCancellation.js
var require_sharedArrayCancellation = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.SharedArrayReceiverStrategy = exports.SharedArraySenderStrategy = undefined;
  var cancellation_1 = require_cancellation();
  var CancellationState;
  (function(CancellationState) {
    CancellationState.Continue = 0;
    CancellationState.Cancelled = 1;
  })(CancellationState || (CancellationState = {}));

  class SharedArraySenderStrategy {
    constructor() {
      this.buffers = new Map;
    }
    enableCancellation(request) {
      if (request.id === null) {
        return;
      }
      const buffer = new SharedArrayBuffer(4);
      const data = new Int32Array(buffer, 0, 1);
      data[0] = CancellationState.Continue;
      this.buffers.set(request.id, buffer);
      request.$cancellationData = buffer;
    }
    async sendCancellation(_conn, id) {
      const buffer = this.buffers.get(id);
      if (buffer === undefined) {
        return;
      }
      const data = new Int32Array(buffer, 0, 1);
      Atomics.store(data, 0, CancellationState.Cancelled);
    }
    cleanup(id) {
      this.buffers.delete(id);
    }
    dispose() {
      this.buffers.clear();
    }
  }
  exports.SharedArraySenderStrategy = SharedArraySenderStrategy;

  class SharedArrayBufferCancellationToken {
    constructor(buffer) {
      this.data = new Int32Array(buffer, 0, 1);
    }
    get isCancellationRequested() {
      return Atomics.load(this.data, 0) === CancellationState.Cancelled;
    }
    get onCancellationRequested() {
      throw new Error(`Cancellation over SharedArrayBuffer doesn't support cancellation events`);
    }
  }

  class SharedArrayBufferCancellationTokenSource {
    constructor(buffer) {
      this.token = new SharedArrayBufferCancellationToken(buffer);
    }
    cancel() {}
    dispose() {}
  }

  class SharedArrayReceiverStrategy {
    constructor() {
      this.kind = "request";
    }
    createCancellationTokenSource(request) {
      const buffer = request.$cancellationData;
      if (buffer === undefined) {
        return new cancellation_1.CancellationTokenSource;
      }
      return new SharedArrayBufferCancellationTokenSource(buffer);
    }
  }
  exports.SharedArrayReceiverStrategy = SharedArrayReceiverStrategy;
});

// node_modules/vscode-jsonrpc/lib/common/semaphore.js
var require_semaphore = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.Semaphore = undefined;
  var ral_1 = require_ral();

  class Semaphore {
    constructor(capacity = 1) {
      if (capacity <= 0) {
        throw new Error("Capacity must be greater than 0");
      }
      this._capacity = capacity;
      this._active = 0;
      this._waiting = [];
    }
    lock(thunk) {
      return new Promise((resolve, reject) => {
        this._waiting.push({ thunk, resolve, reject });
        this.runNext();
      });
    }
    get active() {
      return this._active;
    }
    runNext() {
      if (this._waiting.length === 0 || this._active === this._capacity) {
        return;
      }
      (0, ral_1.default)().timer.setImmediate(() => this.doRunNext());
    }
    doRunNext() {
      if (this._waiting.length === 0 || this._active === this._capacity) {
        return;
      }
      const next = this._waiting.shift();
      this._active++;
      if (this._active > this._capacity) {
        throw new Error(`To many thunks active`);
      }
      try {
        const result = next.thunk();
        if (result instanceof Promise) {
          result.then((value) => {
            this._active--;
            next.resolve(value);
            this.runNext();
          }, (err) => {
            this._active--;
            next.reject(err);
            this.runNext();
          });
        } else {
          this._active--;
          next.resolve(result);
          this.runNext();
        }
      } catch (err) {
        this._active--;
        next.reject(err);
        this.runNext();
      }
    }
  }
  exports.Semaphore = Semaphore;
});

// node_modules/vscode-jsonrpc/lib/common/messageReader.js
var require_messageReader = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.ReadableStreamMessageReader = exports.AbstractMessageReader = exports.MessageReader = undefined;
  var ral_1 = require_ral();
  var Is = require_is2();
  var events_1 = require_events();
  var semaphore_1 = require_semaphore();
  var MessageReader;
  (function(MessageReader) {
    function is(value) {
      let candidate = value;
      return candidate && Is.func(candidate.listen) && Is.func(candidate.dispose) && Is.func(candidate.onError) && Is.func(candidate.onClose) && Is.func(candidate.onPartialMessage);
    }
    MessageReader.is = is;
  })(MessageReader || (exports.MessageReader = MessageReader = {}));

  class AbstractMessageReader {
    constructor() {
      this.errorEmitter = new events_1.Emitter;
      this.closeEmitter = new events_1.Emitter;
      this.partialMessageEmitter = new events_1.Emitter;
    }
    dispose() {
      this.errorEmitter.dispose();
      this.closeEmitter.dispose();
    }
    get onError() {
      return this.errorEmitter.event;
    }
    fireError(error) {
      this.errorEmitter.fire(this.asError(error));
    }
    get onClose() {
      return this.closeEmitter.event;
    }
    fireClose() {
      this.closeEmitter.fire(undefined);
    }
    get onPartialMessage() {
      return this.partialMessageEmitter.event;
    }
    firePartialMessage(info) {
      this.partialMessageEmitter.fire(info);
    }
    asError(error) {
      if (error instanceof Error) {
        return error;
      } else {
        return new Error(`Reader received error. Reason: ${Is.string(error.message) ? error.message : "unknown"}`);
      }
    }
  }
  exports.AbstractMessageReader = AbstractMessageReader;
  var ResolvedMessageReaderOptions;
  (function(ResolvedMessageReaderOptions) {
    function fromOptions(options) {
      let charset;
      let result;
      let contentDecoder;
      const contentDecoders = new Map;
      let contentTypeDecoder;
      const contentTypeDecoders = new Map;
      if (options === undefined || typeof options === "string") {
        charset = options ?? "utf-8";
      } else {
        charset = options.charset ?? "utf-8";
        if (options.contentDecoder !== undefined) {
          contentDecoder = options.contentDecoder;
          contentDecoders.set(contentDecoder.name, contentDecoder);
        }
        if (options.contentDecoders !== undefined) {
          for (const decoder of options.contentDecoders) {
            contentDecoders.set(decoder.name, decoder);
          }
        }
        if (options.contentTypeDecoder !== undefined) {
          contentTypeDecoder = options.contentTypeDecoder;
          contentTypeDecoders.set(contentTypeDecoder.name, contentTypeDecoder);
        }
        if (options.contentTypeDecoders !== undefined) {
          for (const decoder of options.contentTypeDecoders) {
            contentTypeDecoders.set(decoder.name, decoder);
          }
        }
      }
      if (contentTypeDecoder === undefined) {
        contentTypeDecoder = (0, ral_1.default)().applicationJson.decoder;
        contentTypeDecoders.set(contentTypeDecoder.name, contentTypeDecoder);
      }
      return { charset, contentDecoder, contentDecoders, contentTypeDecoder, contentTypeDecoders };
    }
    ResolvedMessageReaderOptions.fromOptions = fromOptions;
  })(ResolvedMessageReaderOptions || (ResolvedMessageReaderOptions = {}));

  class ReadableStreamMessageReader extends AbstractMessageReader {
    constructor(readable, options) {
      super();
      this.readable = readable;
      this.options = ResolvedMessageReaderOptions.fromOptions(options);
      this.buffer = (0, ral_1.default)().messageBuffer.create(this.options.charset);
      this._partialMessageTimeout = 1e4;
      this.nextMessageLength = -1;
      this.messageToken = 0;
      this.readSemaphore = new semaphore_1.Semaphore(1);
    }
    set partialMessageTimeout(timeout) {
      this._partialMessageTimeout = timeout;
    }
    get partialMessageTimeout() {
      return this._partialMessageTimeout;
    }
    listen(callback) {
      this.nextMessageLength = -1;
      this.messageToken = 0;
      this.partialMessageTimer = undefined;
      this.callback = callback;
      const result = this.readable.onData((data) => {
        this.onData(data);
      });
      this.readable.onError((error) => this.fireError(error));
      this.readable.onClose(() => this.fireClose());
      return result;
    }
    onData(data) {
      try {
        this.buffer.append(data);
        while (true) {
          if (this.nextMessageLength === -1) {
            const headers = this.buffer.tryReadHeaders(true);
            if (!headers) {
              return;
            }
            const contentLength = headers.get("content-length");
            if (!contentLength) {
              this.fireError(new Error(`Header must provide a Content-Length property.
${JSON.stringify(Object.fromEntries(headers))}`));
              return;
            }
            const length = parseInt(contentLength);
            if (isNaN(length)) {
              this.fireError(new Error(`Content-Length value must be a number. Got ${contentLength}`));
              return;
            }
            this.nextMessageLength = length;
          }
          const body = this.buffer.tryReadBody(this.nextMessageLength);
          if (body === undefined) {
            this.setPartialMessageTimer();
            return;
          }
          this.clearPartialMessageTimer();
          this.nextMessageLength = -1;
          this.readSemaphore.lock(async () => {
            const bytes = this.options.contentDecoder !== undefined ? await this.options.contentDecoder.decode(body) : body;
            const message = await this.options.contentTypeDecoder.decode(bytes, this.options);
            this.callback(message);
          }).catch((error) => {
            this.fireError(error);
          });
        }
      } catch (error) {
        this.fireError(error);
      }
    }
    clearPartialMessageTimer() {
      if (this.partialMessageTimer) {
        this.partialMessageTimer.dispose();
        this.partialMessageTimer = undefined;
      }
    }
    setPartialMessageTimer() {
      this.clearPartialMessageTimer();
      if (this._partialMessageTimeout <= 0) {
        return;
      }
      this.partialMessageTimer = (0, ral_1.default)().timer.setTimeout((token, timeout) => {
        this.partialMessageTimer = undefined;
        if (token === this.messageToken) {
          this.firePartialMessage({ messageToken: token, waitingTime: timeout });
          this.setPartialMessageTimer();
        }
      }, this._partialMessageTimeout, this.messageToken, this._partialMessageTimeout);
    }
  }
  exports.ReadableStreamMessageReader = ReadableStreamMessageReader;
});

// node_modules/vscode-jsonrpc/lib/common/messageWriter.js
var require_messageWriter = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.WriteableStreamMessageWriter = exports.AbstractMessageWriter = exports.MessageWriter = undefined;
  var ral_1 = require_ral();
  var Is = require_is2();
  var semaphore_1 = require_semaphore();
  var events_1 = require_events();
  var ContentLength = "Content-Length: ";
  var CRLF = `\r
`;
  var MessageWriter;
  (function(MessageWriter) {
    function is(value) {
      let candidate = value;
      return candidate && Is.func(candidate.dispose) && Is.func(candidate.onClose) && Is.func(candidate.onError) && Is.func(candidate.write);
    }
    MessageWriter.is = is;
  })(MessageWriter || (exports.MessageWriter = MessageWriter = {}));

  class AbstractMessageWriter {
    constructor() {
      this.errorEmitter = new events_1.Emitter;
      this.closeEmitter = new events_1.Emitter;
    }
    dispose() {
      this.errorEmitter.dispose();
      this.closeEmitter.dispose();
    }
    get onError() {
      return this.errorEmitter.event;
    }
    fireError(error, message, count) {
      this.errorEmitter.fire([this.asError(error), message, count]);
    }
    get onClose() {
      return this.closeEmitter.event;
    }
    fireClose() {
      this.closeEmitter.fire(undefined);
    }
    asError(error) {
      if (error instanceof Error) {
        return error;
      } else {
        return new Error(`Writer received error. Reason: ${Is.string(error.message) ? error.message : "unknown"}`);
      }
    }
  }
  exports.AbstractMessageWriter = AbstractMessageWriter;
  var ResolvedMessageWriterOptions;
  (function(ResolvedMessageWriterOptions) {
    function fromOptions(options) {
      if (options === undefined || typeof options === "string") {
        return { charset: options ?? "utf-8", contentTypeEncoder: (0, ral_1.default)().applicationJson.encoder };
      } else {
        return { charset: options.charset ?? "utf-8", contentEncoder: options.contentEncoder, contentTypeEncoder: options.contentTypeEncoder ?? (0, ral_1.default)().applicationJson.encoder };
      }
    }
    ResolvedMessageWriterOptions.fromOptions = fromOptions;
  })(ResolvedMessageWriterOptions || (ResolvedMessageWriterOptions = {}));

  class WriteableStreamMessageWriter extends AbstractMessageWriter {
    constructor(writable, options) {
      super();
      this.writable = writable;
      this.options = ResolvedMessageWriterOptions.fromOptions(options);
      this.errorCount = 0;
      this.writeSemaphore = new semaphore_1.Semaphore(1);
      this.writable.onError((error) => this.fireError(error));
      this.writable.onClose(() => this.fireClose());
    }
    async write(msg) {
      return this.writeSemaphore.lock(async () => {
        const payload = this.options.contentTypeEncoder.encode(msg, this.options).then((buffer) => {
          if (this.options.contentEncoder !== undefined) {
            return this.options.contentEncoder.encode(buffer);
          } else {
            return buffer;
          }
        });
        return payload.then((buffer) => {
          const headers = [];
          headers.push(ContentLength, buffer.byteLength.toString(), CRLF);
          headers.push(CRLF);
          return this.doWrite(msg, headers, buffer);
        }, (error) => {
          this.fireError(error);
          throw error;
        });
      });
    }
    async doWrite(msg, headers, data) {
      try {
        await this.writable.write(headers.join(""), "ascii");
        return this.writable.write(data);
      } catch (error) {
        this.handleError(error, msg);
        return Promise.reject(error);
      }
    }
    handleError(error, msg) {
      this.errorCount++;
      this.fireError(error, msg, this.errorCount);
    }
    end() {
      this.writable.end();
    }
  }
  exports.WriteableStreamMessageWriter = WriteableStreamMessageWriter;
});

// node_modules/vscode-jsonrpc/lib/common/messageBuffer.js
var require_messageBuffer = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.AbstractMessageBuffer = undefined;
  var CR = 13;
  var LF = 10;
  var CRLF = `\r
`;

  class AbstractMessageBuffer {
    constructor(encoding = "utf-8") {
      this._encoding = encoding;
      this._chunks = [];
      this._totalLength = 0;
    }
    get encoding() {
      return this._encoding;
    }
    append(chunk) {
      const toAppend = typeof chunk === "string" ? this.fromString(chunk, this._encoding) : chunk;
      this._chunks.push(toAppend);
      this._totalLength += toAppend.byteLength;
    }
    tryReadHeaders(lowerCaseKeys = false) {
      if (this._chunks.length === 0) {
        return;
      }
      let state = 0;
      let chunkIndex = 0;
      let offset = 0;
      let chunkBytesRead = 0;
      row:
        while (chunkIndex < this._chunks.length) {
          const chunk = this._chunks[chunkIndex];
          offset = 0;
          column:
            while (offset < chunk.length) {
              const value = chunk[offset];
              switch (value) {
                case CR:
                  switch (state) {
                    case 0:
                      state = 1;
                      break;
                    case 2:
                      state = 3;
                      break;
                    default:
                      state = 0;
                  }
                  break;
                case LF:
                  switch (state) {
                    case 1:
                      state = 2;
                      break;
                    case 3:
                      state = 4;
                      offset++;
                      break row;
                    default:
                      state = 0;
                  }
                  break;
                default:
                  state = 0;
              }
              offset++;
            }
          chunkBytesRead += chunk.byteLength;
          chunkIndex++;
        }
      if (state !== 4) {
        return;
      }
      const buffer = this._read(chunkBytesRead + offset);
      const result = new Map;
      const headers = this.toString(buffer, "ascii").split(CRLF);
      if (headers.length < 2) {
        return result;
      }
      for (let i = 0;i < headers.length - 2; i++) {
        const header = headers[i];
        const index = header.indexOf(":");
        if (index === -1) {
          throw new Error(`Message header must separate key and value using ':'
${header}`);
        }
        const key = header.substr(0, index);
        const value = header.substr(index + 1).trim();
        result.set(lowerCaseKeys ? key.toLowerCase() : key, value);
      }
      return result;
    }
    tryReadBody(length) {
      if (this._totalLength < length) {
        return;
      }
      return this._read(length);
    }
    get numberOfBytes() {
      return this._totalLength;
    }
    _read(byteCount) {
      if (byteCount === 0) {
        return this.emptyBuffer();
      }
      if (byteCount > this._totalLength) {
        throw new Error(`Cannot read so many bytes!`);
      }
      if (this._chunks[0].byteLength === byteCount) {
        const chunk = this._chunks[0];
        this._chunks.shift();
        this._totalLength -= byteCount;
        return this.asNative(chunk);
      }
      if (this._chunks[0].byteLength > byteCount) {
        const chunk = this._chunks[0];
        const result = this.asNative(chunk, byteCount);
        this._chunks[0] = chunk.slice(byteCount);
        this._totalLength -= byteCount;
        return result;
      }
      const result = this.allocNative(byteCount);
      let resultOffset = 0;
      let chunkIndex = 0;
      while (byteCount > 0) {
        const chunk = this._chunks[chunkIndex];
        if (chunk.byteLength > byteCount) {
          const chunkPart = chunk.slice(0, byteCount);
          result.set(chunkPart, resultOffset);
          resultOffset += byteCount;
          this._chunks[chunkIndex] = chunk.slice(byteCount);
          this._totalLength -= byteCount;
          byteCount -= byteCount;
        } else {
          result.set(chunk, resultOffset);
          resultOffset += chunk.byteLength;
          this._chunks.shift();
          this._totalLength -= chunk.byteLength;
          byteCount -= chunk.byteLength;
        }
      }
      return result;
    }
  }
  exports.AbstractMessageBuffer = AbstractMessageBuffer;
});

// node_modules/vscode-jsonrpc/lib/common/connection.js
var require_connection = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.createMessageConnection = exports.ConnectionOptions = exports.MessageStrategy = exports.CancellationStrategy = exports.CancellationSenderStrategy = exports.CancellationReceiverStrategy = exports.RequestCancellationReceiverStrategy = exports.IdCancellationReceiverStrategy = exports.ConnectionStrategy = exports.ConnectionError = exports.ConnectionErrors = exports.LogTraceNotification = exports.SetTraceNotification = exports.TraceFormat = exports.TraceValues = exports.Trace = exports.NullLogger = exports.ProgressType = exports.ProgressToken = undefined;
  var ral_1 = require_ral();
  var Is = require_is2();
  var messages_1 = require_messages();
  var linkedMap_1 = require_linkedMap();
  var events_1 = require_events();
  var cancellation_1 = require_cancellation();
  var CancelNotification;
  (function(CancelNotification) {
    CancelNotification.type = new messages_1.NotificationType("$/cancelRequest");
  })(CancelNotification || (CancelNotification = {}));
  var ProgressToken;
  (function(ProgressToken) {
    function is(value) {
      return typeof value === "string" || typeof value === "number";
    }
    ProgressToken.is = is;
  })(ProgressToken || (exports.ProgressToken = ProgressToken = {}));
  var ProgressNotification;
  (function(ProgressNotification) {
    ProgressNotification.type = new messages_1.NotificationType("$/progress");
  })(ProgressNotification || (ProgressNotification = {}));

  class ProgressType {
    constructor() {}
  }
  exports.ProgressType = ProgressType;
  var StarRequestHandler;
  (function(StarRequestHandler) {
    function is(value) {
      return Is.func(value);
    }
    StarRequestHandler.is = is;
  })(StarRequestHandler || (StarRequestHandler = {}));
  exports.NullLogger = Object.freeze({
    error: () => {},
    warn: () => {},
    info: () => {},
    log: () => {}
  });
  var Trace;
  (function(Trace) {
    Trace[Trace["Off"] = 0] = "Off";
    Trace[Trace["Messages"] = 1] = "Messages";
    Trace[Trace["Compact"] = 2] = "Compact";
    Trace[Trace["Verbose"] = 3] = "Verbose";
  })(Trace || (exports.Trace = Trace = {}));
  var TraceValues;
  (function(TraceValues) {
    TraceValues.Off = "off";
    TraceValues.Messages = "messages";
    TraceValues.Compact = "compact";
    TraceValues.Verbose = "verbose";
  })(TraceValues || (exports.TraceValues = TraceValues = {}));
  (function(Trace) {
    function fromString(value) {
      if (!Is.string(value)) {
        return Trace.Off;
      }
      value = value.toLowerCase();
      switch (value) {
        case "off":
          return Trace.Off;
        case "messages":
          return Trace.Messages;
        case "compact":
          return Trace.Compact;
        case "verbose":
          return Trace.Verbose;
        default:
          return Trace.Off;
      }
    }
    Trace.fromString = fromString;
    function toString(value) {
      switch (value) {
        case Trace.Off:
          return "off";
        case Trace.Messages:
          return "messages";
        case Trace.Compact:
          return "compact";
        case Trace.Verbose:
          return "verbose";
        default:
          return "off";
      }
    }
    Trace.toString = toString;
  })(Trace || (exports.Trace = Trace = {}));
  var TraceFormat;
  (function(TraceFormat) {
    TraceFormat["Text"] = "text";
    TraceFormat["JSON"] = "json";
  })(TraceFormat || (exports.TraceFormat = TraceFormat = {}));
  (function(TraceFormat) {
    function fromString(value) {
      if (!Is.string(value)) {
        return TraceFormat.Text;
      }
      value = value.toLowerCase();
      if (value === "json") {
        return TraceFormat.JSON;
      } else {
        return TraceFormat.Text;
      }
    }
    TraceFormat.fromString = fromString;
  })(TraceFormat || (exports.TraceFormat = TraceFormat = {}));
  var SetTraceNotification;
  (function(SetTraceNotification) {
    SetTraceNotification.type = new messages_1.NotificationType("$/setTrace");
  })(SetTraceNotification || (exports.SetTraceNotification = SetTraceNotification = {}));
  var LogTraceNotification;
  (function(LogTraceNotification) {
    LogTraceNotification.type = new messages_1.NotificationType("$/logTrace");
  })(LogTraceNotification || (exports.LogTraceNotification = LogTraceNotification = {}));
  var ConnectionErrors;
  (function(ConnectionErrors) {
    ConnectionErrors[ConnectionErrors["Closed"] = 1] = "Closed";
    ConnectionErrors[ConnectionErrors["Disposed"] = 2] = "Disposed";
    ConnectionErrors[ConnectionErrors["AlreadyListening"] = 3] = "AlreadyListening";
  })(ConnectionErrors || (exports.ConnectionErrors = ConnectionErrors = {}));

  class ConnectionError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
      Object.setPrototypeOf(this, ConnectionError.prototype);
    }
  }
  exports.ConnectionError = ConnectionError;
  var ConnectionStrategy;
  (function(ConnectionStrategy) {
    function is(value) {
      const candidate = value;
      return candidate && Is.func(candidate.cancelUndispatched);
    }
    ConnectionStrategy.is = is;
  })(ConnectionStrategy || (exports.ConnectionStrategy = ConnectionStrategy = {}));
  var IdCancellationReceiverStrategy;
  (function(IdCancellationReceiverStrategy) {
    function is(value) {
      const candidate = value;
      return candidate && (candidate.kind === undefined || candidate.kind === "id") && Is.func(candidate.createCancellationTokenSource) && (candidate.dispose === undefined || Is.func(candidate.dispose));
    }
    IdCancellationReceiverStrategy.is = is;
  })(IdCancellationReceiverStrategy || (exports.IdCancellationReceiverStrategy = IdCancellationReceiverStrategy = {}));
  var RequestCancellationReceiverStrategy;
  (function(RequestCancellationReceiverStrategy) {
    function is(value) {
      const candidate = value;
      return candidate && candidate.kind === "request" && Is.func(candidate.createCancellationTokenSource) && (candidate.dispose === undefined || Is.func(candidate.dispose));
    }
    RequestCancellationReceiverStrategy.is = is;
  })(RequestCancellationReceiverStrategy || (exports.RequestCancellationReceiverStrategy = RequestCancellationReceiverStrategy = {}));
  var CancellationReceiverStrategy;
  (function(CancellationReceiverStrategy) {
    CancellationReceiverStrategy.Message = Object.freeze({
      createCancellationTokenSource(_) {
        return new cancellation_1.CancellationTokenSource;
      }
    });
    function is(value) {
      return IdCancellationReceiverStrategy.is(value) || RequestCancellationReceiverStrategy.is(value);
    }
    CancellationReceiverStrategy.is = is;
  })(CancellationReceiverStrategy || (exports.CancellationReceiverStrategy = CancellationReceiverStrategy = {}));
  var CancellationSenderStrategy;
  (function(CancellationSenderStrategy) {
    CancellationSenderStrategy.Message = Object.freeze({
      sendCancellation(conn, id) {
        return conn.sendNotification(CancelNotification.type, { id });
      },
      cleanup(_) {}
    });
    function is(value) {
      const candidate = value;
      return candidate && Is.func(candidate.sendCancellation) && Is.func(candidate.cleanup);
    }
    CancellationSenderStrategy.is = is;
  })(CancellationSenderStrategy || (exports.CancellationSenderStrategy = CancellationSenderStrategy = {}));
  var CancellationStrategy;
  (function(CancellationStrategy) {
    CancellationStrategy.Message = Object.freeze({
      receiver: CancellationReceiverStrategy.Message,
      sender: CancellationSenderStrategy.Message
    });
    function is(value) {
      const candidate = value;
      return candidate && CancellationReceiverStrategy.is(candidate.receiver) && CancellationSenderStrategy.is(candidate.sender);
    }
    CancellationStrategy.is = is;
  })(CancellationStrategy || (exports.CancellationStrategy = CancellationStrategy = {}));
  var MessageStrategy;
  (function(MessageStrategy) {
    function is(value) {
      const candidate = value;
      return candidate && Is.func(candidate.handleMessage);
    }
    MessageStrategy.is = is;
  })(MessageStrategy || (exports.MessageStrategy = MessageStrategy = {}));
  var ConnectionOptions;
  (function(ConnectionOptions) {
    function is(value) {
      const candidate = value;
      return candidate && (CancellationStrategy.is(candidate.cancellationStrategy) || ConnectionStrategy.is(candidate.connectionStrategy) || MessageStrategy.is(candidate.messageStrategy));
    }
    ConnectionOptions.is = is;
  })(ConnectionOptions || (exports.ConnectionOptions = ConnectionOptions = {}));
  var ConnectionState;
  (function(ConnectionState) {
    ConnectionState[ConnectionState["New"] = 1] = "New";
    ConnectionState[ConnectionState["Listening"] = 2] = "Listening";
    ConnectionState[ConnectionState["Closed"] = 3] = "Closed";
    ConnectionState[ConnectionState["Disposed"] = 4] = "Disposed";
  })(ConnectionState || (ConnectionState = {}));
  function createMessageConnection(messageReader, messageWriter, _logger, options) {
    const logger = _logger !== undefined ? _logger : exports.NullLogger;
    let sequenceNumber = 0;
    let notificationSequenceNumber = 0;
    let unknownResponseSequenceNumber = 0;
    const version = "2.0";
    let starRequestHandler = undefined;
    const requestHandlers = new Map;
    let starNotificationHandler = undefined;
    const notificationHandlers = new Map;
    const progressHandlers = new Map;
    let timer;
    let messageQueue = new linkedMap_1.LinkedMap;
    let responsePromises = new Map;
    let knownCanceledRequests = new Set;
    let requestTokens = new Map;
    let trace = Trace.Off;
    let traceFormat = TraceFormat.Text;
    let tracer;
    let state = ConnectionState.New;
    const errorEmitter = new events_1.Emitter;
    const closeEmitter = new events_1.Emitter;
    const unhandledNotificationEmitter = new events_1.Emitter;
    const unhandledProgressEmitter = new events_1.Emitter;
    const disposeEmitter = new events_1.Emitter;
    const cancellationStrategy = options && options.cancellationStrategy ? options.cancellationStrategy : CancellationStrategy.Message;
    function createRequestQueueKey(id) {
      if (id === null) {
        throw new Error(`Can't send requests with id null since the response can't be correlated.`);
      }
      return "req-" + id.toString();
    }
    function createResponseQueueKey(id) {
      if (id === null) {
        return "res-unknown-" + (++unknownResponseSequenceNumber).toString();
      } else {
        return "res-" + id.toString();
      }
    }
    function createNotificationQueueKey() {
      return "not-" + (++notificationSequenceNumber).toString();
    }
    function addMessageToQueue(queue, message) {
      if (messages_1.Message.isRequest(message)) {
        queue.set(createRequestQueueKey(message.id), message);
      } else if (messages_1.Message.isResponse(message)) {
        queue.set(createResponseQueueKey(message.id), message);
      } else {
        queue.set(createNotificationQueueKey(), message);
      }
    }
    function cancelUndispatched(_message) {
      return;
    }
    function isListening() {
      return state === ConnectionState.Listening;
    }
    function isClosed() {
      return state === ConnectionState.Closed;
    }
    function isDisposed() {
      return state === ConnectionState.Disposed;
    }
    function closeHandler() {
      if (state === ConnectionState.New || state === ConnectionState.Listening) {
        state = ConnectionState.Closed;
        closeEmitter.fire(undefined);
      }
    }
    function readErrorHandler(error) {
      errorEmitter.fire([error, undefined, undefined]);
    }
    function writeErrorHandler(data) {
      errorEmitter.fire(data);
    }
    messageReader.onClose(closeHandler);
    messageReader.onError(readErrorHandler);
    messageWriter.onClose(closeHandler);
    messageWriter.onError(writeErrorHandler);
    function triggerMessageQueue() {
      if (timer || messageQueue.size === 0) {
        return;
      }
      timer = (0, ral_1.default)().timer.setImmediate(() => {
        timer = undefined;
        processMessageQueue();
      });
    }
    function handleMessage(message) {
      if (messages_1.Message.isRequest(message)) {
        handleRequest(message);
      } else if (messages_1.Message.isNotification(message)) {
        handleNotification(message);
      } else if (messages_1.Message.isResponse(message)) {
        handleResponse(message);
      } else {
        handleInvalidMessage(message);
      }
    }
    function processMessageQueue() {
      if (messageQueue.size === 0) {
        return;
      }
      const message = messageQueue.shift();
      try {
        const messageStrategy = options?.messageStrategy;
        if (MessageStrategy.is(messageStrategy)) {
          messageStrategy.handleMessage(message, handleMessage);
        } else {
          handleMessage(message);
        }
      } finally {
        triggerMessageQueue();
      }
    }
    const callback = (message) => {
      try {
        if (messages_1.Message.isNotification(message) && message.method === CancelNotification.type.method) {
          const cancelId = message.params.id;
          const key = createRequestQueueKey(cancelId);
          const toCancel = messageQueue.get(key);
          if (messages_1.Message.isRequest(toCancel)) {
            const strategy = options?.connectionStrategy;
            const response = strategy && strategy.cancelUndispatched ? strategy.cancelUndispatched(toCancel, cancelUndispatched) : cancelUndispatched(toCancel);
            if (response && (response.error !== undefined || response.result !== undefined)) {
              messageQueue.delete(key);
              requestTokens.delete(cancelId);
              response.id = toCancel.id;
              traceSendingResponse(response, message.method, Date.now());
              messageWriter.write(response).catch(() => logger.error(`Sending response for canceled message failed.`));
              return;
            }
          }
          const cancellationToken = requestTokens.get(cancelId);
          if (cancellationToken !== undefined) {
            cancellationToken.cancel();
            traceReceivedNotification(message);
            return;
          } else {
            knownCanceledRequests.add(cancelId);
          }
        }
        addMessageToQueue(messageQueue, message);
      } finally {
        triggerMessageQueue();
      }
    };
    function handleRequest(requestMessage) {
      if (isDisposed()) {
        return;
      }
      function reply(resultOrError, method, startTime) {
        const message = {
          jsonrpc: version,
          id: requestMessage.id
        };
        if (resultOrError instanceof messages_1.ResponseError) {
          message.error = resultOrError.toJson();
        } else {
          message.result = resultOrError === undefined ? null : resultOrError;
        }
        traceSendingResponse(message, method, startTime);
        messageWriter.write(message).catch(() => logger.error(`Sending response failed.`));
      }
      function replyError(error, method, startTime) {
        const message = {
          jsonrpc: version,
          id: requestMessage.id,
          error: error.toJson()
        };
        traceSendingResponse(message, method, startTime);
        messageWriter.write(message).catch(() => logger.error(`Sending response failed.`));
      }
      function replySuccess(result, method, startTime) {
        if (result === undefined) {
          result = null;
        }
        const message = {
          jsonrpc: version,
          id: requestMessage.id,
          result
        };
        traceSendingResponse(message, method, startTime);
        messageWriter.write(message).catch(() => logger.error(`Sending response failed.`));
      }
      traceReceivedRequest(requestMessage);
      const element = requestHandlers.get(requestMessage.method);
      let type;
      let requestHandler;
      if (element) {
        type = element.type;
        requestHandler = element.handler;
      }
      const startTime = Date.now();
      if (requestHandler || starRequestHandler) {
        const tokenKey = requestMessage.id ?? String(Date.now());
        const cancellationSource = IdCancellationReceiverStrategy.is(cancellationStrategy.receiver) ? cancellationStrategy.receiver.createCancellationTokenSource(tokenKey) : cancellationStrategy.receiver.createCancellationTokenSource(requestMessage);
        if (requestMessage.id !== null && knownCanceledRequests.has(requestMessage.id)) {
          cancellationSource.cancel();
        }
        if (requestMessage.id !== null) {
          requestTokens.set(tokenKey, cancellationSource);
        }
        try {
          let handlerResult;
          if (requestHandler) {
            if (requestMessage.params === undefined) {
              if (type !== undefined && type.numberOfParams !== 0) {
                replyError(new messages_1.ResponseError(messages_1.ErrorCodes.InvalidParams, `Request ${requestMessage.method} defines ${type.numberOfParams} params but received none.`), requestMessage.method, startTime);
                return;
              }
              handlerResult = requestHandler(cancellationSource.token);
            } else if (Array.isArray(requestMessage.params)) {
              if (type !== undefined && type.parameterStructures === messages_1.ParameterStructures.byName) {
                replyError(new messages_1.ResponseError(messages_1.ErrorCodes.InvalidParams, `Request ${requestMessage.method} defines parameters by name but received parameters by position`), requestMessage.method, startTime);
                return;
              }
              handlerResult = requestHandler(...requestMessage.params, cancellationSource.token);
            } else {
              if (type !== undefined && type.parameterStructures === messages_1.ParameterStructures.byPosition) {
                replyError(new messages_1.ResponseError(messages_1.ErrorCodes.InvalidParams, `Request ${requestMessage.method} defines parameters by position but received parameters by name`), requestMessage.method, startTime);
                return;
              }
              handlerResult = requestHandler(requestMessage.params, cancellationSource.token);
            }
          } else if (starRequestHandler) {
            handlerResult = starRequestHandler(requestMessage.method, requestMessage.params, cancellationSource.token);
          }
          const promise = handlerResult;
          if (!handlerResult) {
            requestTokens.delete(tokenKey);
            replySuccess(handlerResult, requestMessage.method, startTime);
          } else if (promise.then) {
            promise.then((resultOrError) => {
              requestTokens.delete(tokenKey);
              reply(resultOrError, requestMessage.method, startTime);
            }, (error) => {
              requestTokens.delete(tokenKey);
              if (error instanceof messages_1.ResponseError) {
                replyError(error, requestMessage.method, startTime);
              } else if (error && Is.string(error.message)) {
                replyError(new messages_1.ResponseError(messages_1.ErrorCodes.InternalError, `Request ${requestMessage.method} failed with message: ${error.message}`), requestMessage.method, startTime);
              } else {
                replyError(new messages_1.ResponseError(messages_1.ErrorCodes.InternalError, `Request ${requestMessage.method} failed unexpectedly without providing any details.`), requestMessage.method, startTime);
              }
            });
          } else {
            requestTokens.delete(tokenKey);
            reply(handlerResult, requestMessage.method, startTime);
          }
        } catch (error) {
          requestTokens.delete(tokenKey);
          if (error instanceof messages_1.ResponseError) {
            reply(error, requestMessage.method, startTime);
          } else if (error && Is.string(error.message)) {
            replyError(new messages_1.ResponseError(messages_1.ErrorCodes.InternalError, `Request ${requestMessage.method} failed with message: ${error.message}`), requestMessage.method, startTime);
          } else {
            replyError(new messages_1.ResponseError(messages_1.ErrorCodes.InternalError, `Request ${requestMessage.method} failed unexpectedly without providing any details.`), requestMessage.method, startTime);
          }
        }
      } else {
        replyError(new messages_1.ResponseError(messages_1.ErrorCodes.MethodNotFound, `Unhandled method ${requestMessage.method}`), requestMessage.method, startTime);
      }
    }
    function handleResponse(responseMessage) {
      if (isDisposed()) {
        return;
      }
      if (responseMessage.id === null) {
        if (responseMessage.error) {
          logger.error(`Received response message without id: Error is: 
${JSON.stringify(responseMessage.error, undefined, 4)}`);
        } else {
          logger.error(`Received response message without id. No further error information provided.`);
        }
      } else {
        const key = responseMessage.id;
        const responsePromise = responsePromises.get(key);
        traceReceivedResponse(responseMessage, responsePromise);
        if (responsePromise !== undefined) {
          responsePromises.delete(key);
          try {
            if (responseMessage.error) {
              const error = responseMessage.error;
              responsePromise.reject(new messages_1.ResponseError(error.code, error.message, error.data));
            } else if (responseMessage.result !== undefined) {
              responsePromise.resolve(responseMessage.result);
            } else {
              throw new Error("Should never happen.");
            }
          } catch (error) {
            if (error.message) {
              logger.error(`Response handler '${responsePromise.method}' failed with message: ${error.message}`);
            } else {
              logger.error(`Response handler '${responsePromise.method}' failed unexpectedly.`);
            }
          }
        }
      }
    }
    function handleNotification(message) {
      if (isDisposed()) {
        return;
      }
      let type = undefined;
      let notificationHandler;
      if (message.method === CancelNotification.type.method) {
        const cancelId = message.params.id;
        knownCanceledRequests.delete(cancelId);
        traceReceivedNotification(message);
        return;
      } else {
        const element = notificationHandlers.get(message.method);
        if (element) {
          notificationHandler = element.handler;
          type = element.type;
        }
      }
      if (notificationHandler || starNotificationHandler) {
        try {
          traceReceivedNotification(message);
          if (notificationHandler) {
            if (message.params === undefined) {
              if (type !== undefined) {
                if (type.numberOfParams !== 0 && type.parameterStructures !== messages_1.ParameterStructures.byName) {
                  logger.error(`Notification ${message.method} defines ${type.numberOfParams} params but received none.`);
                }
              }
              notificationHandler();
            } else if (Array.isArray(message.params)) {
              const params = message.params;
              if (message.method === ProgressNotification.type.method && params.length === 2 && ProgressToken.is(params[0])) {
                notificationHandler({ token: params[0], value: params[1] });
              } else {
                if (type !== undefined) {
                  if (type.parameterStructures === messages_1.ParameterStructures.byName) {
                    logger.error(`Notification ${message.method} defines parameters by name but received parameters by position`);
                  }
                  if (type.numberOfParams !== message.params.length) {
                    logger.error(`Notification ${message.method} defines ${type.numberOfParams} params but received ${params.length} arguments`);
                  }
                }
                notificationHandler(...params);
              }
            } else {
              if (type !== undefined && type.parameterStructures === messages_1.ParameterStructures.byPosition) {
                logger.error(`Notification ${message.method} defines parameters by position but received parameters by name`);
              }
              notificationHandler(message.params);
            }
          } else if (starNotificationHandler) {
            starNotificationHandler(message.method, message.params);
          }
        } catch (error) {
          if (error.message) {
            logger.error(`Notification handler '${message.method}' failed with message: ${error.message}`);
          } else {
            logger.error(`Notification handler '${message.method}' failed unexpectedly.`);
          }
        }
      } else {
        unhandledNotificationEmitter.fire(message);
      }
    }
    function handleInvalidMessage(message) {
      if (!message) {
        logger.error("Received empty message.");
        return;
      }
      logger.error(`Received message which is neither a response nor a notification message:
${JSON.stringify(message, null, 4)}`);
      const responseMessage = message;
      if (Is.string(responseMessage.id) || Is.number(responseMessage.id)) {
        const key = responseMessage.id;
        const responseHandler = responsePromises.get(key);
        if (responseHandler) {
          responseHandler.reject(new Error("The received response has neither a result nor an error property."));
        }
      }
    }
    function stringifyTrace(params) {
      if (params === undefined || params === null) {
        return;
      }
      switch (trace) {
        case Trace.Verbose:
          return JSON.stringify(params, null, 4);
        case Trace.Compact:
          return JSON.stringify(params);
        default:
          return;
      }
    }
    function traceSendingRequest(message) {
      if (trace === Trace.Off || !tracer) {
        return;
      }
      if (traceFormat === TraceFormat.Text) {
        let data = undefined;
        if ((trace === Trace.Verbose || trace === Trace.Compact) && message.params) {
          data = `Params: ${stringifyTrace(message.params)}

`;
        }
        tracer.log(`Sending request '${message.method} - (${message.id})'.`, data);
      } else {
        logLSPMessage("send-request", message);
      }
    }
    function traceSendingNotification(message) {
      if (trace === Trace.Off || !tracer) {
        return;
      }
      if (traceFormat === TraceFormat.Text) {
        let data = undefined;
        if (trace === Trace.Verbose || trace === Trace.Compact) {
          if (message.params) {
            data = `Params: ${stringifyTrace(message.params)}

`;
          } else {
            data = `No parameters provided.

`;
          }
        }
        tracer.log(`Sending notification '${message.method}'.`, data);
      } else {
        logLSPMessage("send-notification", message);
      }
    }
    function traceSendingResponse(message, method, startTime) {
      if (trace === Trace.Off || !tracer) {
        return;
      }
      if (traceFormat === TraceFormat.Text) {
        let data = undefined;
        if (trace === Trace.Verbose || trace === Trace.Compact) {
          if (message.error && message.error.data) {
            data = `Error data: ${stringifyTrace(message.error.data)}

`;
          } else {
            if (message.result) {
              data = `Result: ${stringifyTrace(message.result)}

`;
            } else if (message.error === undefined) {
              data = `No result returned.

`;
            }
          }
        }
        tracer.log(`Sending response '${method} - (${message.id})'. Processing request took ${Date.now() - startTime}ms`, data);
      } else {
        logLSPMessage("send-response", message);
      }
    }
    function traceReceivedRequest(message) {
      if (trace === Trace.Off || !tracer) {
        return;
      }
      if (traceFormat === TraceFormat.Text) {
        let data = undefined;
        if ((trace === Trace.Verbose || trace === Trace.Compact) && message.params) {
          data = `Params: ${stringifyTrace(message.params)}

`;
        }
        tracer.log(`Received request '${message.method} - (${message.id})'.`, data);
      } else {
        logLSPMessage("receive-request", message);
      }
    }
    function traceReceivedNotification(message) {
      if (trace === Trace.Off || !tracer || message.method === LogTraceNotification.type.method) {
        return;
      }
      if (traceFormat === TraceFormat.Text) {
        let data = undefined;
        if (trace === Trace.Verbose || trace === Trace.Compact) {
          if (message.params) {
            data = `Params: ${stringifyTrace(message.params)}

`;
          } else {
            data = `No parameters provided.

`;
          }
        }
        tracer.log(`Received notification '${message.method}'.`, data);
      } else {
        logLSPMessage("receive-notification", message);
      }
    }
    function traceReceivedResponse(message, responsePromise) {
      if (trace === Trace.Off || !tracer) {
        return;
      }
      if (traceFormat === TraceFormat.Text) {
        let data = undefined;
        if (trace === Trace.Verbose || trace === Trace.Compact) {
          if (message.error && message.error.data) {
            data = `Error data: ${stringifyTrace(message.error.data)}

`;
          } else {
            if (message.result) {
              data = `Result: ${stringifyTrace(message.result)}

`;
            } else if (message.error === undefined) {
              data = `No result returned.

`;
            }
          }
        }
        if (responsePromise) {
          const error = message.error ? ` Request failed: ${message.error.message} (${message.error.code}).` : "";
          tracer.log(`Received response '${responsePromise.method} - (${message.id})' in ${Date.now() - responsePromise.timerStart}ms.${error}`, data);
        } else {
          tracer.log(`Received response ${message.id} without active response promise.`, data);
        }
      } else {
        logLSPMessage("receive-response", message);
      }
    }
    function logLSPMessage(type, message) {
      if (!tracer || trace === Trace.Off) {
        return;
      }
      const lspMessage = {
        isLSPMessage: true,
        type,
        message,
        timestamp: Date.now()
      };
      tracer.log(lspMessage);
    }
    function throwIfClosedOrDisposed() {
      if (isClosed()) {
        throw new ConnectionError(ConnectionErrors.Closed, "Connection is closed.");
      }
      if (isDisposed()) {
        throw new ConnectionError(ConnectionErrors.Disposed, "Connection is disposed.");
      }
    }
    function throwIfListening() {
      if (isListening()) {
        throw new ConnectionError(ConnectionErrors.AlreadyListening, "Connection is already listening");
      }
    }
    function throwIfNotListening() {
      if (!isListening()) {
        throw new Error("Call listen() first.");
      }
    }
    function undefinedToNull(param) {
      if (param === undefined) {
        return null;
      } else {
        return param;
      }
    }
    function nullToUndefined(param) {
      if (param === null) {
        return;
      } else {
        return param;
      }
    }
    function isNamedParam(param) {
      return param !== undefined && param !== null && !Array.isArray(param) && typeof param === "object";
    }
    function computeSingleParam(parameterStructures, param) {
      switch (parameterStructures) {
        case messages_1.ParameterStructures.auto:
          if (isNamedParam(param)) {
            return nullToUndefined(param);
          } else {
            return [undefinedToNull(param)];
          }
        case messages_1.ParameterStructures.byName:
          if (!isNamedParam(param)) {
            throw new Error(`Received parameters by name but param is not an object literal.`);
          }
          return nullToUndefined(param);
        case messages_1.ParameterStructures.byPosition:
          return [undefinedToNull(param)];
        default:
          throw new Error(`Unknown parameter structure ${parameterStructures.toString()}`);
      }
    }
    function computeMessageParams(type, params) {
      let result;
      const numberOfParams = type.numberOfParams;
      switch (numberOfParams) {
        case 0:
          result = undefined;
          break;
        case 1:
          result = computeSingleParam(type.parameterStructures, params[0]);
          break;
        default:
          result = [];
          for (let i = 0;i < params.length && i < numberOfParams; i++) {
            result.push(undefinedToNull(params[i]));
          }
          if (params.length < numberOfParams) {
            for (let i = params.length;i < numberOfParams; i++) {
              result.push(null);
            }
          }
          break;
      }
      return result;
    }
    const connection = {
      sendNotification: (type, ...args) => {
        throwIfClosedOrDisposed();
        let method;
        let messageParams;
        if (Is.string(type)) {
          method = type;
          const first = args[0];
          let paramStart = 0;
          let parameterStructures = messages_1.ParameterStructures.auto;
          if (messages_1.ParameterStructures.is(first)) {
            paramStart = 1;
            parameterStructures = first;
          }
          let paramEnd = args.length;
          const numberOfParams = paramEnd - paramStart;
          switch (numberOfParams) {
            case 0:
              messageParams = undefined;
              break;
            case 1:
              messageParams = computeSingleParam(parameterStructures, args[paramStart]);
              break;
            default:
              if (parameterStructures === messages_1.ParameterStructures.byName) {
                throw new Error(`Received ${numberOfParams} parameters for 'by Name' notification parameter structure.`);
              }
              messageParams = args.slice(paramStart, paramEnd).map((value) => undefinedToNull(value));
              break;
          }
        } else {
          const params = args;
          method = type.method;
          messageParams = computeMessageParams(type, params);
        }
        const notificationMessage = {
          jsonrpc: version,
          method,
          params: messageParams
        };
        traceSendingNotification(notificationMessage);
        return messageWriter.write(notificationMessage).catch((error) => {
          logger.error(`Sending notification failed.`);
          throw error;
        });
      },
      onNotification: (type, handler) => {
        throwIfClosedOrDisposed();
        let method;
        if (Is.func(type)) {
          starNotificationHandler = type;
        } else if (handler) {
          if (Is.string(type)) {
            method = type;
            notificationHandlers.set(type, { type: undefined, handler });
          } else {
            method = type.method;
            notificationHandlers.set(type.method, { type, handler });
          }
        }
        return {
          dispose: () => {
            if (method !== undefined) {
              notificationHandlers.delete(method);
            } else {
              starNotificationHandler = undefined;
            }
          }
        };
      },
      onProgress: (_type, token, handler) => {
        if (progressHandlers.has(token)) {
          throw new Error(`Progress handler for token ${token} already registered`);
        }
        progressHandlers.set(token, handler);
        return {
          dispose: () => {
            progressHandlers.delete(token);
          }
        };
      },
      sendProgress: (_type, token, value) => {
        return connection.sendNotification(ProgressNotification.type, { token, value });
      },
      onUnhandledProgress: unhandledProgressEmitter.event,
      sendRequest: (type, ...args) => {
        throwIfClosedOrDisposed();
        throwIfNotListening();
        let method;
        let messageParams;
        let token = undefined;
        if (Is.string(type)) {
          method = type;
          const first = args[0];
          const last = args[args.length - 1];
          let paramStart = 0;
          let parameterStructures = messages_1.ParameterStructures.auto;
          if (messages_1.ParameterStructures.is(first)) {
            paramStart = 1;
            parameterStructures = first;
          }
          let paramEnd = args.length;
          if (cancellation_1.CancellationToken.is(last)) {
            paramEnd = paramEnd - 1;
            token = last;
          }
          const numberOfParams = paramEnd - paramStart;
          switch (numberOfParams) {
            case 0:
              messageParams = undefined;
              break;
            case 1:
              messageParams = computeSingleParam(parameterStructures, args[paramStart]);
              break;
            default:
              if (parameterStructures === messages_1.ParameterStructures.byName) {
                throw new Error(`Received ${numberOfParams} parameters for 'by Name' request parameter structure.`);
              }
              messageParams = args.slice(paramStart, paramEnd).map((value) => undefinedToNull(value));
              break;
          }
        } else {
          const params = args;
          method = type.method;
          messageParams = computeMessageParams(type, params);
          const numberOfParams = type.numberOfParams;
          token = cancellation_1.CancellationToken.is(params[numberOfParams]) ? params[numberOfParams] : undefined;
        }
        const id = sequenceNumber++;
        let disposable;
        if (token) {
          disposable = token.onCancellationRequested(() => {
            const p = cancellationStrategy.sender.sendCancellation(connection, id);
            if (p === undefined) {
              logger.log(`Received no promise from cancellation strategy when cancelling id ${id}`);
              return Promise.resolve();
            } else {
              return p.catch(() => {
                logger.log(`Sending cancellation messages for id ${id} failed`);
              });
            }
          });
        }
        const requestMessage = {
          jsonrpc: version,
          id,
          method,
          params: messageParams
        };
        traceSendingRequest(requestMessage);
        if (typeof cancellationStrategy.sender.enableCancellation === "function") {
          cancellationStrategy.sender.enableCancellation(requestMessage);
        }
        return new Promise(async (resolve, reject) => {
          const resolveWithCleanup = (r) => {
            resolve(r);
            cancellationStrategy.sender.cleanup(id);
            disposable?.dispose();
          };
          const rejectWithCleanup = (r) => {
            reject(r);
            cancellationStrategy.sender.cleanup(id);
            disposable?.dispose();
          };
          const responsePromise = { method, timerStart: Date.now(), resolve: resolveWithCleanup, reject: rejectWithCleanup };
          try {
            await messageWriter.write(requestMessage);
            responsePromises.set(id, responsePromise);
          } catch (error) {
            logger.error(`Sending request failed.`);
            responsePromise.reject(new messages_1.ResponseError(messages_1.ErrorCodes.MessageWriteError, error.message ? error.message : "Unknown reason"));
            throw error;
          }
        });
      },
      onRequest: (type, handler) => {
        throwIfClosedOrDisposed();
        let method = null;
        if (StarRequestHandler.is(type)) {
          method = undefined;
          starRequestHandler = type;
        } else if (Is.string(type)) {
          method = null;
          if (handler !== undefined) {
            method = type;
            requestHandlers.set(type, { handler, type: undefined });
          }
        } else {
          if (handler !== undefined) {
            method = type.method;
            requestHandlers.set(type.method, { type, handler });
          }
        }
        return {
          dispose: () => {
            if (method === null) {
              return;
            }
            if (method !== undefined) {
              requestHandlers.delete(method);
            } else {
              starRequestHandler = undefined;
            }
          }
        };
      },
      hasPendingResponse: () => {
        return responsePromises.size > 0;
      },
      trace: async (_value, _tracer, sendNotificationOrTraceOptions) => {
        let _sendNotification = false;
        let _traceFormat = TraceFormat.Text;
        if (sendNotificationOrTraceOptions !== undefined) {
          if (Is.boolean(sendNotificationOrTraceOptions)) {
            _sendNotification = sendNotificationOrTraceOptions;
          } else {
            _sendNotification = sendNotificationOrTraceOptions.sendNotification || false;
            _traceFormat = sendNotificationOrTraceOptions.traceFormat || TraceFormat.Text;
          }
        }
        trace = _value;
        traceFormat = _traceFormat;
        if (trace === Trace.Off) {
          tracer = undefined;
        } else {
          tracer = _tracer;
        }
        if (_sendNotification && !isClosed() && !isDisposed()) {
          await connection.sendNotification(SetTraceNotification.type, { value: Trace.toString(_value) });
        }
      },
      onError: errorEmitter.event,
      onClose: closeEmitter.event,
      onUnhandledNotification: unhandledNotificationEmitter.event,
      onDispose: disposeEmitter.event,
      end: () => {
        messageWriter.end();
      },
      dispose: () => {
        if (isDisposed()) {
          return;
        }
        state = ConnectionState.Disposed;
        disposeEmitter.fire(undefined);
        const error = new messages_1.ResponseError(messages_1.ErrorCodes.PendingResponseRejected, "Pending response rejected since connection got disposed");
        for (const promise of responsePromises.values()) {
          promise.reject(error);
        }
        responsePromises = new Map;
        requestTokens = new Map;
        knownCanceledRequests = new Set;
        messageQueue = new linkedMap_1.LinkedMap;
        if (Is.func(messageWriter.dispose)) {
          messageWriter.dispose();
        }
        if (Is.func(messageReader.dispose)) {
          messageReader.dispose();
        }
      },
      listen: () => {
        throwIfClosedOrDisposed();
        throwIfListening();
        state = ConnectionState.Listening;
        messageReader.listen(callback);
      },
      inspect: () => {
        (0, ral_1.default)().console.log("inspect");
      }
    };
    connection.onNotification(LogTraceNotification.type, (params) => {
      if (trace === Trace.Off || !tracer) {
        return;
      }
      const verbose = trace === Trace.Verbose || trace === Trace.Compact;
      tracer.log(params.message, verbose ? params.verbose : undefined);
    });
    connection.onNotification(ProgressNotification.type, (params) => {
      const handler = progressHandlers.get(params.token);
      if (handler) {
        handler(params.value);
      } else {
        unhandledProgressEmitter.fire(params);
      }
    });
    return connection;
  }
  exports.createMessageConnection = createMessageConnection;
});

// node_modules/vscode-jsonrpc/lib/common/api.js
var require_api = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.ProgressType = exports.ProgressToken = exports.createMessageConnection = exports.NullLogger = exports.ConnectionOptions = exports.ConnectionStrategy = exports.AbstractMessageBuffer = exports.WriteableStreamMessageWriter = exports.AbstractMessageWriter = exports.MessageWriter = exports.ReadableStreamMessageReader = exports.AbstractMessageReader = exports.MessageReader = exports.SharedArrayReceiverStrategy = exports.SharedArraySenderStrategy = exports.CancellationToken = exports.CancellationTokenSource = exports.Emitter = exports.Event = exports.Disposable = exports.LRUCache = exports.Touch = exports.LinkedMap = exports.ParameterStructures = exports.NotificationType9 = exports.NotificationType8 = exports.NotificationType7 = exports.NotificationType6 = exports.NotificationType5 = exports.NotificationType4 = exports.NotificationType3 = exports.NotificationType2 = exports.NotificationType1 = exports.NotificationType0 = exports.NotificationType = exports.ErrorCodes = exports.ResponseError = exports.RequestType9 = exports.RequestType8 = exports.RequestType7 = exports.RequestType6 = exports.RequestType5 = exports.RequestType4 = exports.RequestType3 = exports.RequestType2 = exports.RequestType1 = exports.RequestType0 = exports.RequestType = exports.Message = exports.RAL = undefined;
  exports.MessageStrategy = exports.CancellationStrategy = exports.CancellationSenderStrategy = exports.CancellationReceiverStrategy = exports.ConnectionError = exports.ConnectionErrors = exports.LogTraceNotification = exports.SetTraceNotification = exports.TraceFormat = exports.TraceValues = exports.Trace = undefined;
  var messages_1 = require_messages();
  Object.defineProperty(exports, "Message", { enumerable: true, get: function() {
    return messages_1.Message;
  } });
  Object.defineProperty(exports, "RequestType", { enumerable: true, get: function() {
    return messages_1.RequestType;
  } });
  Object.defineProperty(exports, "RequestType0", { enumerable: true, get: function() {
    return messages_1.RequestType0;
  } });
  Object.defineProperty(exports, "RequestType1", { enumerable: true, get: function() {
    return messages_1.RequestType1;
  } });
  Object.defineProperty(exports, "RequestType2", { enumerable: true, get: function() {
    return messages_1.RequestType2;
  } });
  Object.defineProperty(exports, "RequestType3", { enumerable: true, get: function() {
    return messages_1.RequestType3;
  } });
  Object.defineProperty(exports, "RequestType4", { enumerable: true, get: function() {
    return messages_1.RequestType4;
  } });
  Object.defineProperty(exports, "RequestType5", { enumerable: true, get: function() {
    return messages_1.RequestType5;
  } });
  Object.defineProperty(exports, "RequestType6", { enumerable: true, get: function() {
    return messages_1.RequestType6;
  } });
  Object.defineProperty(exports, "RequestType7", { enumerable: true, get: function() {
    return messages_1.RequestType7;
  } });
  Object.defineProperty(exports, "RequestType8", { enumerable: true, get: function() {
    return messages_1.RequestType8;
  } });
  Object.defineProperty(exports, "RequestType9", { enumerable: true, get: function() {
    return messages_1.RequestType9;
  } });
  Object.defineProperty(exports, "ResponseError", { enumerable: true, get: function() {
    return messages_1.ResponseError;
  } });
  Object.defineProperty(exports, "ErrorCodes", { enumerable: true, get: function() {
    return messages_1.ErrorCodes;
  } });
  Object.defineProperty(exports, "NotificationType", { enumerable: true, get: function() {
    return messages_1.NotificationType;
  } });
  Object.defineProperty(exports, "NotificationType0", { enumerable: true, get: function() {
    return messages_1.NotificationType0;
  } });
  Object.defineProperty(exports, "NotificationType1", { enumerable: true, get: function() {
    return messages_1.NotificationType1;
  } });
  Object.defineProperty(exports, "NotificationType2", { enumerable: true, get: function() {
    return messages_1.NotificationType2;
  } });
  Object.defineProperty(exports, "NotificationType3", { enumerable: true, get: function() {
    return messages_1.NotificationType3;
  } });
  Object.defineProperty(exports, "NotificationType4", { enumerable: true, get: function() {
    return messages_1.NotificationType4;
  } });
  Object.defineProperty(exports, "NotificationType5", { enumerable: true, get: function() {
    return messages_1.NotificationType5;
  } });
  Object.defineProperty(exports, "NotificationType6", { enumerable: true, get: function() {
    return messages_1.NotificationType6;
  } });
  Object.defineProperty(exports, "NotificationType7", { enumerable: true, get: function() {
    return messages_1.NotificationType7;
  } });
  Object.defineProperty(exports, "NotificationType8", { enumerable: true, get: function() {
    return messages_1.NotificationType8;
  } });
  Object.defineProperty(exports, "NotificationType9", { enumerable: true, get: function() {
    return messages_1.NotificationType9;
  } });
  Object.defineProperty(exports, "ParameterStructures", { enumerable: true, get: function() {
    return messages_1.ParameterStructures;
  } });
  var linkedMap_1 = require_linkedMap();
  Object.defineProperty(exports, "LinkedMap", { enumerable: true, get: function() {
    return linkedMap_1.LinkedMap;
  } });
  Object.defineProperty(exports, "LRUCache", { enumerable: true, get: function() {
    return linkedMap_1.LRUCache;
  } });
  Object.defineProperty(exports, "Touch", { enumerable: true, get: function() {
    return linkedMap_1.Touch;
  } });
  var disposable_1 = require_disposable();
  Object.defineProperty(exports, "Disposable", { enumerable: true, get: function() {
    return disposable_1.Disposable;
  } });
  var events_1 = require_events();
  Object.defineProperty(exports, "Event", { enumerable: true, get: function() {
    return events_1.Event;
  } });
  Object.defineProperty(exports, "Emitter", { enumerable: true, get: function() {
    return events_1.Emitter;
  } });
  var cancellation_1 = require_cancellation();
  Object.defineProperty(exports, "CancellationTokenSource", { enumerable: true, get: function() {
    return cancellation_1.CancellationTokenSource;
  } });
  Object.defineProperty(exports, "CancellationToken", { enumerable: true, get: function() {
    return cancellation_1.CancellationToken;
  } });
  var sharedArrayCancellation_1 = require_sharedArrayCancellation();
  Object.defineProperty(exports, "SharedArraySenderStrategy", { enumerable: true, get: function() {
    return sharedArrayCancellation_1.SharedArraySenderStrategy;
  } });
  Object.defineProperty(exports, "SharedArrayReceiverStrategy", { enumerable: true, get: function() {
    return sharedArrayCancellation_1.SharedArrayReceiverStrategy;
  } });
  var messageReader_1 = require_messageReader();
  Object.defineProperty(exports, "MessageReader", { enumerable: true, get: function() {
    return messageReader_1.MessageReader;
  } });
  Object.defineProperty(exports, "AbstractMessageReader", { enumerable: true, get: function() {
    return messageReader_1.AbstractMessageReader;
  } });
  Object.defineProperty(exports, "ReadableStreamMessageReader", { enumerable: true, get: function() {
    return messageReader_1.ReadableStreamMessageReader;
  } });
  var messageWriter_1 = require_messageWriter();
  Object.defineProperty(exports, "MessageWriter", { enumerable: true, get: function() {
    return messageWriter_1.MessageWriter;
  } });
  Object.defineProperty(exports, "AbstractMessageWriter", { enumerable: true, get: function() {
    return messageWriter_1.AbstractMessageWriter;
  } });
  Object.defineProperty(exports, "WriteableStreamMessageWriter", { enumerable: true, get: function() {
    return messageWriter_1.WriteableStreamMessageWriter;
  } });
  var messageBuffer_1 = require_messageBuffer();
  Object.defineProperty(exports, "AbstractMessageBuffer", { enumerable: true, get: function() {
    return messageBuffer_1.AbstractMessageBuffer;
  } });
  var connection_1 = require_connection();
  Object.defineProperty(exports, "ConnectionStrategy", { enumerable: true, get: function() {
    return connection_1.ConnectionStrategy;
  } });
  Object.defineProperty(exports, "ConnectionOptions", { enumerable: true, get: function() {
    return connection_1.ConnectionOptions;
  } });
  Object.defineProperty(exports, "NullLogger", { enumerable: true, get: function() {
    return connection_1.NullLogger;
  } });
  Object.defineProperty(exports, "createMessageConnection", { enumerable: true, get: function() {
    return connection_1.createMessageConnection;
  } });
  Object.defineProperty(exports, "ProgressToken", { enumerable: true, get: function() {
    return connection_1.ProgressToken;
  } });
  Object.defineProperty(exports, "ProgressType", { enumerable: true, get: function() {
    return connection_1.ProgressType;
  } });
  Object.defineProperty(exports, "Trace", { enumerable: true, get: function() {
    return connection_1.Trace;
  } });
  Object.defineProperty(exports, "TraceValues", { enumerable: true, get: function() {
    return connection_1.TraceValues;
  } });
  Object.defineProperty(exports, "TraceFormat", { enumerable: true, get: function() {
    return connection_1.TraceFormat;
  } });
  Object.defineProperty(exports, "SetTraceNotification", { enumerable: true, get: function() {
    return connection_1.SetTraceNotification;
  } });
  Object.defineProperty(exports, "LogTraceNotification", { enumerable: true, get: function() {
    return connection_1.LogTraceNotification;
  } });
  Object.defineProperty(exports, "ConnectionErrors", { enumerable: true, get: function() {
    return connection_1.ConnectionErrors;
  } });
  Object.defineProperty(exports, "ConnectionError", { enumerable: true, get: function() {
    return connection_1.ConnectionError;
  } });
  Object.defineProperty(exports, "CancellationReceiverStrategy", { enumerable: true, get: function() {
    return connection_1.CancellationReceiverStrategy;
  } });
  Object.defineProperty(exports, "CancellationSenderStrategy", { enumerable: true, get: function() {
    return connection_1.CancellationSenderStrategy;
  } });
  Object.defineProperty(exports, "CancellationStrategy", { enumerable: true, get: function() {
    return connection_1.CancellationStrategy;
  } });
  Object.defineProperty(exports, "MessageStrategy", { enumerable: true, get: function() {
    return connection_1.MessageStrategy;
  } });
  var ral_1 = require_ral();
  exports.RAL = ral_1.default;
});

// node_modules/vscode-jsonrpc/lib/node/ril.js
var require_ril = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  var util_1 = __require("util");
  var api_1 = require_api();

  class MessageBuffer extends api_1.AbstractMessageBuffer {
    constructor(encoding = "utf-8") {
      super(encoding);
    }
    emptyBuffer() {
      return MessageBuffer.emptyBuffer;
    }
    fromString(value, encoding) {
      return Buffer.from(value, encoding);
    }
    toString(value, encoding) {
      if (value instanceof Buffer) {
        return value.toString(encoding);
      } else {
        return new util_1.TextDecoder(encoding).decode(value);
      }
    }
    asNative(buffer, length) {
      if (length === undefined) {
        return buffer instanceof Buffer ? buffer : Buffer.from(buffer);
      } else {
        return buffer instanceof Buffer ? buffer.slice(0, length) : Buffer.from(buffer, 0, length);
      }
    }
    allocNative(length) {
      return Buffer.allocUnsafe(length);
    }
  }
  MessageBuffer.emptyBuffer = Buffer.allocUnsafe(0);

  class ReadableStreamWrapper {
    constructor(stream) {
      this.stream = stream;
    }
    onClose(listener) {
      this.stream.on("close", listener);
      return api_1.Disposable.create(() => this.stream.off("close", listener));
    }
    onError(listener) {
      this.stream.on("error", listener);
      return api_1.Disposable.create(() => this.stream.off("error", listener));
    }
    onEnd(listener) {
      this.stream.on("end", listener);
      return api_1.Disposable.create(() => this.stream.off("end", listener));
    }
    onData(listener) {
      this.stream.on("data", listener);
      return api_1.Disposable.create(() => this.stream.off("data", listener));
    }
  }

  class WritableStreamWrapper {
    constructor(stream) {
      this.stream = stream;
    }
    onClose(listener) {
      this.stream.on("close", listener);
      return api_1.Disposable.create(() => this.stream.off("close", listener));
    }
    onError(listener) {
      this.stream.on("error", listener);
      return api_1.Disposable.create(() => this.stream.off("error", listener));
    }
    onEnd(listener) {
      this.stream.on("end", listener);
      return api_1.Disposable.create(() => this.stream.off("end", listener));
    }
    write(data, encoding) {
      return new Promise((resolve, reject) => {
        const callback = (error) => {
          if (error === undefined || error === null) {
            resolve();
          } else {
            reject(error);
          }
        };
        if (typeof data === "string") {
          this.stream.write(data, encoding, callback);
        } else {
          this.stream.write(data, callback);
        }
      });
    }
    end() {
      this.stream.end();
    }
  }
  var _ril = Object.freeze({
    messageBuffer: Object.freeze({
      create: (encoding) => new MessageBuffer(encoding)
    }),
    applicationJson: Object.freeze({
      encoder: Object.freeze({
        name: "application/json",
        encode: (msg, options) => {
          try {
            return Promise.resolve(Buffer.from(JSON.stringify(msg, undefined, 0), options.charset));
          } catch (err) {
            return Promise.reject(err);
          }
        }
      }),
      decoder: Object.freeze({
        name: "application/json",
        decode: (buffer, options) => {
          try {
            if (buffer instanceof Buffer) {
              return Promise.resolve(JSON.parse(buffer.toString(options.charset)));
            } else {
              return Promise.resolve(JSON.parse(new util_1.TextDecoder(options.charset).decode(buffer)));
            }
          } catch (err) {
            return Promise.reject(err);
          }
        }
      })
    }),
    stream: Object.freeze({
      asReadableStream: (stream) => new ReadableStreamWrapper(stream),
      asWritableStream: (stream) => new WritableStreamWrapper(stream)
    }),
    console,
    timer: Object.freeze({
      setTimeout(callback, ms, ...args) {
        const handle = setTimeout(callback, ms, ...args);
        return { dispose: () => clearTimeout(handle) };
      },
      setImmediate(callback, ...args) {
        const handle = setImmediate(callback, ...args);
        return { dispose: () => clearImmediate(handle) };
      },
      setInterval(callback, ms, ...args) {
        const handle = setInterval(callback, ms, ...args);
        return { dispose: () => clearInterval(handle) };
      }
    })
  });
  function RIL() {
    return _ril;
  }
  (function(RIL) {
    function install() {
      api_1.RAL.install(_ril);
    }
    RIL.install = install;
  })(RIL || (RIL = {}));
  exports.default = RIL;
});

// node_modules/vscode-jsonrpc/lib/node/main.js
var require_main = __commonJS(function(exports) {
  var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined)
      k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() {
        return m[k];
      } };
    }
    Object.defineProperty(o, k2, desc);
  } : function(o, m, k, k2) {
    if (k2 === undefined)
      k2 = k;
    o[k2] = m[k];
  });
  var __exportStar = exports && exports.__exportStar || function(m, exports2) {
    for (var p in m)
      if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p))
        __createBinding(exports2, m, p);
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.createMessageConnection = exports.createServerSocketTransport = exports.createClientSocketTransport = exports.createServerPipeTransport = exports.createClientPipeTransport = exports.generateRandomPipeName = exports.StreamMessageWriter = exports.StreamMessageReader = exports.SocketMessageWriter = exports.SocketMessageReader = exports.PortMessageWriter = exports.PortMessageReader = exports.IPCMessageWriter = exports.IPCMessageReader = undefined;
  var ril_1 = require_ril();
  ril_1.default.install();
  var path = __require("path");
  var os = __require("os");
  var crypto_1 = __require("crypto");
  var net_1 = __require("net");
  var api_1 = require_api();
  __exportStar(require_api(), exports);

  class IPCMessageReader extends api_1.AbstractMessageReader {
    constructor(process2) {
      super();
      this.process = process2;
      let eventEmitter = this.process;
      eventEmitter.on("error", (error) => this.fireError(error));
      eventEmitter.on("close", () => this.fireClose());
    }
    listen(callback) {
      this.process.on("message", callback);
      return api_1.Disposable.create(() => this.process.off("message", callback));
    }
  }
  exports.IPCMessageReader = IPCMessageReader;

  class IPCMessageWriter extends api_1.AbstractMessageWriter {
    constructor(process2) {
      super();
      this.process = process2;
      this.errorCount = 0;
      const eventEmitter = this.process;
      eventEmitter.on("error", (error) => this.fireError(error));
      eventEmitter.on("close", () => this.fireClose);
    }
    write(msg) {
      try {
        if (typeof this.process.send === "function") {
          this.process.send(msg, undefined, undefined, (error) => {
            if (error) {
              this.errorCount++;
              this.handleError(error, msg);
            } else {
              this.errorCount = 0;
            }
          });
        }
        return Promise.resolve();
      } catch (error) {
        this.handleError(error, msg);
        return Promise.reject(error);
      }
    }
    handleError(error, msg) {
      this.errorCount++;
      this.fireError(error, msg, this.errorCount);
    }
    end() {}
  }
  exports.IPCMessageWriter = IPCMessageWriter;

  class PortMessageReader extends api_1.AbstractMessageReader {
    constructor(port) {
      super();
      this.onData = new api_1.Emitter;
      port.on("close", () => this.fireClose);
      port.on("error", (error) => this.fireError(error));
      port.on("message", (message) => {
        this.onData.fire(message);
      });
    }
    listen(callback) {
      return this.onData.event(callback);
    }
  }
  exports.PortMessageReader = PortMessageReader;

  class PortMessageWriter extends api_1.AbstractMessageWriter {
    constructor(port) {
      super();
      this.port = port;
      this.errorCount = 0;
      port.on("close", () => this.fireClose());
      port.on("error", (error) => this.fireError(error));
    }
    write(msg) {
      try {
        this.port.postMessage(msg);
        return Promise.resolve();
      } catch (error) {
        this.handleError(error, msg);
        return Promise.reject(error);
      }
    }
    handleError(error, msg) {
      this.errorCount++;
      this.fireError(error, msg, this.errorCount);
    }
    end() {}
  }
  exports.PortMessageWriter = PortMessageWriter;

  class SocketMessageReader extends api_1.ReadableStreamMessageReader {
    constructor(socket, encoding = "utf-8") {
      super((0, ril_1.default)().stream.asReadableStream(socket), encoding);
    }
  }
  exports.SocketMessageReader = SocketMessageReader;

  class SocketMessageWriter extends api_1.WriteableStreamMessageWriter {
    constructor(socket, options) {
      super((0, ril_1.default)().stream.asWritableStream(socket), options);
      this.socket = socket;
    }
    dispose() {
      super.dispose();
      this.socket.destroy();
    }
  }
  exports.SocketMessageWriter = SocketMessageWriter;

  class StreamMessageReader extends api_1.ReadableStreamMessageReader {
    constructor(readable, encoding) {
      super((0, ril_1.default)().stream.asReadableStream(readable), encoding);
    }
  }
  exports.StreamMessageReader = StreamMessageReader;

  class StreamMessageWriter extends api_1.WriteableStreamMessageWriter {
    constructor(writable, options) {
      super((0, ril_1.default)().stream.asWritableStream(writable), options);
    }
  }
  exports.StreamMessageWriter = StreamMessageWriter;
  var XDG_RUNTIME_DIR = process.env["XDG_RUNTIME_DIR"];
  var safeIpcPathLengths = new Map([
    ["linux", 107],
    ["darwin", 103]
  ]);
  function generateRandomPipeName() {
    const randomSuffix = (0, crypto_1.randomBytes)(21).toString("hex");
    if (process.platform === "win32") {
      return `\\\\.\\pipe\\vscode-jsonrpc-${randomSuffix}-sock`;
    }
    let result;
    if (XDG_RUNTIME_DIR) {
      result = path.join(XDG_RUNTIME_DIR, `vscode-ipc-${randomSuffix}.sock`);
    } else {
      result = path.join(os.tmpdir(), `vscode-${randomSuffix}.sock`);
    }
    const limit = safeIpcPathLengths.get(process.platform);
    if (limit !== undefined && result.length > limit) {
      (0, ril_1.default)().console.warn(`WARNING: IPC handle "${result}" is longer than ${limit} characters.`);
    }
    return result;
  }
  exports.generateRandomPipeName = generateRandomPipeName;
  function createClientPipeTransport(pipeName, encoding = "utf-8") {
    let connectResolve;
    const connected = new Promise((resolve, _reject) => {
      connectResolve = resolve;
    });
    return new Promise((resolve, reject) => {
      let server = (0, net_1.createServer)((socket) => {
        server.close();
        connectResolve([
          new SocketMessageReader(socket, encoding),
          new SocketMessageWriter(socket, encoding)
        ]);
      });
      server.on("error", reject);
      server.listen(pipeName, () => {
        server.removeListener("error", reject);
        resolve({
          onConnected: () => {
            return connected;
          }
        });
      });
    });
  }
  exports.createClientPipeTransport = createClientPipeTransport;
  function createServerPipeTransport(pipeName, encoding = "utf-8") {
    const socket = (0, net_1.createConnection)(pipeName);
    return [
      new SocketMessageReader(socket, encoding),
      new SocketMessageWriter(socket, encoding)
    ];
  }
  exports.createServerPipeTransport = createServerPipeTransport;
  function createClientSocketTransport(port, encoding = "utf-8") {
    let connectResolve;
    const connected = new Promise((resolve, _reject) => {
      connectResolve = resolve;
    });
    return new Promise((resolve, reject) => {
      const server = (0, net_1.createServer)((socket) => {
        server.close();
        connectResolve([
          new SocketMessageReader(socket, encoding),
          new SocketMessageWriter(socket, encoding)
        ]);
      });
      server.on("error", reject);
      server.listen(port, "127.0.0.1", () => {
        server.removeListener("error", reject);
        resolve({
          onConnected: () => {
            return connected;
          }
        });
      });
    });
  }
  exports.createClientSocketTransport = createClientSocketTransport;
  function createServerSocketTransport(port, encoding = "utf-8") {
    const socket = (0, net_1.createConnection)(port, "127.0.0.1");
    return [
      new SocketMessageReader(socket, encoding),
      new SocketMessageWriter(socket, encoding)
    ];
  }
  exports.createServerSocketTransport = createServerSocketTransport;
  function isReadableStream(value) {
    const candidate = value;
    return candidate.read !== undefined && candidate.addListener !== undefined;
  }
  function isWritableStream(value) {
    const candidate = value;
    return candidate.write !== undefined && candidate.addListener !== undefined;
  }
  function createMessageConnection(input, output, logger, options) {
    if (!logger) {
      logger = api_1.NullLogger;
    }
    const reader = isReadableStream(input) ? new StreamMessageReader(input) : input;
    const writer = isWritableStream(output) ? new StreamMessageWriter(output) : output;
    if (api_1.ConnectionStrategy.is(options)) {
      options = { connectionStrategy: options };
    }
    return (0, api_1.createMessageConnection)(reader, writer, logger, options);
  }
  exports.createMessageConnection = createMessageConnection;
});

// node_modules/vscode-languageserver-types/lib/umd/main.js
var require_main2 = __commonJS(function(exports, module) {
  (function(factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
      var v = factory(__require, exports);
      if (v !== undefined)
        module.exports = v;
    } else if (typeof define === "function" && define.amd) {
      define(["require", "exports"], factory);
    }
  })(function(require2, exports2) {
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.TextDocument = exports2.EOL = exports2.WorkspaceFolder = exports2.InlineCompletionContext = exports2.SelectedCompletionInfo = exports2.InlineCompletionTriggerKind = exports2.InlineCompletionList = exports2.InlineCompletionItem = exports2.StringValue = exports2.InlayHint = exports2.InlayHintLabelPart = exports2.InlayHintKind = exports2.InlineValueContext = exports2.InlineValueEvaluatableExpression = exports2.InlineValueVariableLookup = exports2.InlineValueText = exports2.SemanticTokens = exports2.SemanticTokenModifiers = exports2.SemanticTokenTypes = exports2.SelectionRange = exports2.DocumentLink = exports2.FormattingOptions = exports2.CodeLens = exports2.CodeAction = exports2.CodeActionContext = exports2.CodeActionTriggerKind = exports2.CodeActionKind = exports2.DocumentSymbol = exports2.WorkspaceSymbol = exports2.SymbolInformation = exports2.SymbolTag = exports2.SymbolKind = exports2.DocumentHighlight = exports2.DocumentHighlightKind = exports2.SignatureInformation = exports2.ParameterInformation = exports2.Hover = exports2.MarkedString = exports2.CompletionList = exports2.CompletionItem = exports2.CompletionItemLabelDetails = exports2.InsertTextMode = exports2.InsertReplaceEdit = exports2.CompletionItemTag = exports2.InsertTextFormat = exports2.CompletionItemKind = exports2.MarkupContent = exports2.MarkupKind = exports2.TextDocumentItem = exports2.OptionalVersionedTextDocumentIdentifier = exports2.VersionedTextDocumentIdentifier = exports2.TextDocumentIdentifier = exports2.WorkspaceChange = exports2.WorkspaceEdit = exports2.DeleteFile = exports2.RenameFile = exports2.CreateFile = exports2.TextDocumentEdit = exports2.AnnotatedTextEdit = exports2.ChangeAnnotationIdentifier = exports2.ChangeAnnotation = exports2.TextEdit = exports2.Command = exports2.Diagnostic = exports2.CodeDescription = exports2.DiagnosticTag = exports2.DiagnosticSeverity = exports2.DiagnosticRelatedInformation = exports2.FoldingRange = exports2.FoldingRangeKind = exports2.ColorPresentation = exports2.ColorInformation = exports2.Color = exports2.LocationLink = exports2.Location = exports2.Range = exports2.Position = exports2.uinteger = exports2.integer = exports2.URI = exports2.DocumentUri = undefined;
    var DocumentUri;
    (function(DocumentUri) {
      function is(value) {
        return typeof value === "string";
      }
      DocumentUri.is = is;
    })(DocumentUri || (exports2.DocumentUri = DocumentUri = {}));
    var URI;
    (function(URI) {
      function is(value) {
        return typeof value === "string";
      }
      URI.is = is;
    })(URI || (exports2.URI = URI = {}));
    var integer;
    (function(integer) {
      integer.MIN_VALUE = -2147483648;
      integer.MAX_VALUE = 2147483647;
      function is(value) {
        return typeof value === "number" && integer.MIN_VALUE <= value && value <= integer.MAX_VALUE;
      }
      integer.is = is;
    })(integer || (exports2.integer = integer = {}));
    var uinteger;
    (function(uinteger) {
      uinteger.MIN_VALUE = 0;
      uinteger.MAX_VALUE = 2147483647;
      function is(value) {
        return typeof value === "number" && uinteger.MIN_VALUE <= value && value <= uinteger.MAX_VALUE;
      }
      uinteger.is = is;
    })(uinteger || (exports2.uinteger = uinteger = {}));
    var Position;
    (function(Position) {
      function create(line, character) {
        if (line === Number.MAX_VALUE) {
          line = uinteger.MAX_VALUE;
        }
        if (character === Number.MAX_VALUE) {
          character = uinteger.MAX_VALUE;
        }
        return { line, character };
      }
      Position.create = create;
      function is(value) {
        var candidate = value;
        return Is.objectLiteral(candidate) && Is.uinteger(candidate.line) && Is.uinteger(candidate.character);
      }
      Position.is = is;
    })(Position || (exports2.Position = Position = {}));
    var Range;
    (function(Range) {
      function create(one, two, three, four) {
        if (Is.uinteger(one) && Is.uinteger(two) && Is.uinteger(three) && Is.uinteger(four)) {
          return { start: Position.create(one, two), end: Position.create(three, four) };
        } else if (Position.is(one) && Position.is(two)) {
          return { start: one, end: two };
        } else {
          throw new Error("Range#create called with invalid arguments[".concat(one, ", ").concat(two, ", ").concat(three, ", ").concat(four, "]"));
        }
      }
      Range.create = create;
      function is(value) {
        var candidate = value;
        return Is.objectLiteral(candidate) && Position.is(candidate.start) && Position.is(candidate.end);
      }
      Range.is = is;
    })(Range || (exports2.Range = Range = {}));
    var Location;
    (function(Location) {
      function create(uri, range) {
        return { uri, range };
      }
      Location.create = create;
      function is(value) {
        var candidate = value;
        return Is.objectLiteral(candidate) && Range.is(candidate.range) && (Is.string(candidate.uri) || Is.undefined(candidate.uri));
      }
      Location.is = is;
    })(Location || (exports2.Location = Location = {}));
    var LocationLink;
    (function(LocationLink) {
      function create(targetUri, targetRange, targetSelectionRange, originSelectionRange) {
        return { targetUri, targetRange, targetSelectionRange, originSelectionRange };
      }
      LocationLink.create = create;
      function is(value) {
        var candidate = value;
        return Is.objectLiteral(candidate) && Range.is(candidate.targetRange) && Is.string(candidate.targetUri) && Range.is(candidate.targetSelectionRange) && (Range.is(candidate.originSelectionRange) || Is.undefined(candidate.originSelectionRange));
      }
      LocationLink.is = is;
    })(LocationLink || (exports2.LocationLink = LocationLink = {}));
    var Color;
    (function(Color) {
      function create(red, green, blue, alpha) {
        return {
          red,
          green,
          blue,
          alpha
        };
      }
      Color.create = create;
      function is(value) {
        var candidate = value;
        return Is.objectLiteral(candidate) && Is.numberRange(candidate.red, 0, 1) && Is.numberRange(candidate.green, 0, 1) && Is.numberRange(candidate.blue, 0, 1) && Is.numberRange(candidate.alpha, 0, 1);
      }
      Color.is = is;
    })(Color || (exports2.Color = Color = {}));
    var ColorInformation;
    (function(ColorInformation) {
      function create(range, color) {
        return {
          range,
          color
        };
      }
      ColorInformation.create = create;
      function is(value) {
        var candidate = value;
        return Is.objectLiteral(candidate) && Range.is(candidate.range) && Color.is(candidate.color);
      }
      ColorInformation.is = is;
    })(ColorInformation || (exports2.ColorInformation = ColorInformation = {}));
    var ColorPresentation;
    (function(ColorPresentation) {
      function create(label, textEdit, additionalTextEdits) {
        return {
          label,
          textEdit,
          additionalTextEdits
        };
      }
      ColorPresentation.create = create;
      function is(value) {
        var candidate = value;
        return Is.objectLiteral(candidate) && Is.string(candidate.label) && (Is.undefined(candidate.textEdit) || TextEdit.is(candidate)) && (Is.undefined(candidate.additionalTextEdits) || Is.typedArray(candidate.additionalTextEdits, TextEdit.is));
      }
      ColorPresentation.is = is;
    })(ColorPresentation || (exports2.ColorPresentation = ColorPresentation = {}));
    var FoldingRangeKind;
    (function(FoldingRangeKind) {
      FoldingRangeKind.Comment = "comment";
      FoldingRangeKind.Imports = "imports";
      FoldingRangeKind.Region = "region";
    })(FoldingRangeKind || (exports2.FoldingRangeKind = FoldingRangeKind = {}));
    var FoldingRange;
    (function(FoldingRange) {
      function create(startLine, endLine, startCharacter, endCharacter, kind, collapsedText) {
        var result = {
          startLine,
          endLine
        };
        if (Is.defined(startCharacter)) {
          result.startCharacter = startCharacter;
        }
        if (Is.defined(endCharacter)) {
          result.endCharacter = endCharacter;
        }
        if (Is.defined(kind)) {
          result.kind = kind;
        }
        if (Is.defined(collapsedText)) {
          result.collapsedText = collapsedText;
        }
        return result;
      }
      FoldingRange.create = create;
      function is(value) {
        var candidate = value;
        return Is.objectLiteral(candidate) && Is.uinteger(candidate.startLine) && Is.uinteger(candidate.startLine) && (Is.undefined(candidate.startCharacter) || Is.uinteger(candidate.startCharacter)) && (Is.undefined(candidate.endCharacter) || Is.uinteger(candidate.endCharacter)) && (Is.undefined(candidate.kind) || Is.string(candidate.kind));
      }
      FoldingRange.is = is;
    })(FoldingRange || (exports2.FoldingRange = FoldingRange = {}));
    var DiagnosticRelatedInformation;
    (function(DiagnosticRelatedInformation) {
      function create(location, message) {
        return {
          location,
          message
        };
      }
      DiagnosticRelatedInformation.create = create;
      function is(value) {
        var candidate = value;
        return Is.defined(candidate) && Location.is(candidate.location) && Is.string(candidate.message);
      }
      DiagnosticRelatedInformation.is = is;
    })(DiagnosticRelatedInformation || (exports2.DiagnosticRelatedInformation = DiagnosticRelatedInformation = {}));
    var DiagnosticSeverity;
    (function(DiagnosticSeverity) {
      DiagnosticSeverity.Error = 1;
      DiagnosticSeverity.Warning = 2;
      DiagnosticSeverity.Information = 3;
      DiagnosticSeverity.Hint = 4;
    })(DiagnosticSeverity || (exports2.DiagnosticSeverity = DiagnosticSeverity = {}));
    var DiagnosticTag;
    (function(DiagnosticTag) {
      DiagnosticTag.Unnecessary = 1;
      DiagnosticTag.Deprecated = 2;
    })(DiagnosticTag || (exports2.DiagnosticTag = DiagnosticTag = {}));
    var CodeDescription;
    (function(CodeDescription) {
      function is(value) {
        var candidate = value;
        return Is.objectLiteral(candidate) && Is.string(candidate.href);
      }
      CodeDescription.is = is;
    })(CodeDescription || (exports2.CodeDescription = CodeDescription = {}));
    var Diagnostic;
    (function(Diagnostic) {
      function create(range, message, severity, code, source, relatedInformation) {
        var result = { range, message };
        if (Is.defined(severity)) {
          result.severity = severity;
        }
        if (Is.defined(code)) {
          result.code = code;
        }
        if (Is.defined(source)) {
          result.source = source;
        }
        if (Is.defined(relatedInformation)) {
          result.relatedInformation = relatedInformation;
        }
        return result;
      }
      Diagnostic.create = create;
      function is(value) {
        var _a;
        var candidate = value;
        return Is.defined(candidate) && Range.is(candidate.range) && Is.string(candidate.message) && (Is.number(candidate.severity) || Is.undefined(candidate.severity)) && (Is.integer(candidate.code) || Is.string(candidate.code) || Is.undefined(candidate.code)) && (Is.undefined(candidate.codeDescription) || Is.string((_a = candidate.codeDescription) === null || _a === undefined ? undefined : _a.href)) && (Is.string(candidate.source) || Is.undefined(candidate.source)) && (Is.undefined(candidate.relatedInformation) || Is.typedArray(candidate.relatedInformation, DiagnosticRelatedInformation.is));
      }
      Diagnostic.is = is;
    })(Diagnostic || (exports2.Diagnostic = Diagnostic = {}));
    var Command;
    (function(Command) {
      function create(title, command) {
        var args = [];
        for (var _i = 2;_i < arguments.length; _i++) {
          args[_i - 2] = arguments[_i];
        }
        var result = { title, command };
        if (Is.defined(args) && args.length > 0) {
          result.arguments = args;
        }
        return result;
      }
      Command.create = create;
      function is(value) {
        var candidate = value;
        return Is.defined(candidate) && Is.string(candidate.title) && Is.string(candidate.command);
      }
      Command.is = is;
    })(Command || (exports2.Command = Command = {}));
    var TextEdit;
    (function(TextEdit) {
      function replace(range, newText) {
        return { range, newText };
      }
      TextEdit.replace = replace;
      function insert(position, newText) {
        return { range: { start: position, end: position }, newText };
      }
      TextEdit.insert = insert;
      function del(range) {
        return { range, newText: "" };
      }
      TextEdit.del = del;
      function is(value) {
        var candidate = value;
        return Is.objectLiteral(candidate) && Is.string(candidate.newText) && Range.is(candidate.range);
      }
      TextEdit.is = is;
    })(TextEdit || (exports2.TextEdit = TextEdit = {}));
    var ChangeAnnotation;
    (function(ChangeAnnotation) {
      function create(label, needsConfirmation, description) {
        var result = { label };
        if (needsConfirmation !== undefined) {
          result.needsConfirmation = needsConfirmation;
        }
        if (description !== undefined) {
          result.description = description;
        }
        return result;
      }
      ChangeAnnotation.create = create;
      function is(value) {
        var candidate = value;
        return Is.objectLiteral(candidate) && Is.string(candidate.label) && (Is.boolean(candidate.needsConfirmation) || candidate.needsConfirmation === undefined) && (Is.string(candidate.description) || candidate.description === undefined);
      }
      ChangeAnnotation.is = is;
    })(ChangeAnnotation || (exports2.ChangeAnnotation = ChangeAnnotation = {}));
    var ChangeAnnotationIdentifier;
    (function(ChangeAnnotationIdentifier) {
      function is(value) {
        var candidate = value;
        return Is.string(candidate);
      }
      ChangeAnnotationIdentifier.is = is;
    })(ChangeAnnotationIdentifier || (exports2.ChangeAnnotationIdentifier = ChangeAnnotationIdentifier = {}));
    var AnnotatedTextEdit;
    (function(AnnotatedTextEdit) {
      function replace(range, newText, annotation) {
        return { range, newText, annotationId: annotation };
      }
      AnnotatedTextEdit.replace = replace;
      function insert(position, newText, annotation) {
        return { range: { start: position, end: position }, newText, annotationId: annotation };
      }
      AnnotatedTextEdit.insert = insert;
      function del(range, annotation) {
        return { range, newText: "", annotationId: annotation };
      }
      AnnotatedTextEdit.del = del;
      function is(value) {
        var candidate = value;
        return TextEdit.is(candidate) && (ChangeAnnotation.is(candidate.annotationId) || ChangeAnnotationIdentifier.is(candidate.annotationId));
      }
      AnnotatedTextEdit.is = is;
    })(AnnotatedTextEdit || (exports2.AnnotatedTextEdit = AnnotatedTextEdit = {}));
    var TextDocumentEdit;
    (function(TextDocumentEdit) {
      function create(textDocument, edits) {
        return { textDocument, edits };
      }
      TextDocumentEdit.create = create;
      function is(value) {
        var candidate = value;
        return Is.defined(candidate) && OptionalVersionedTextDocumentIdentifier.is(candidate.textDocument) && Array.isArray(candidate.edits);
      }
      TextDocumentEdit.is = is;
    })(TextDocumentEdit || (exports2.TextDocumentEdit = TextDocumentEdit = {}));
    var CreateFile;
    (function(CreateFile) {
      function create(uri, options, annotation) {
        var result = {
          kind: "create",
          uri
        };
        if (options !== undefined && (options.overwrite !== undefined || options.ignoreIfExists !== undefined)) {
          result.options = options;
        }
        if (annotation !== undefined) {
          result.annotationId = annotation;
        }
        return result;
      }
      CreateFile.create = create;
      function is(value) {
        var candidate = value;
        return candidate && candidate.kind === "create" && Is.string(candidate.uri) && (candidate.options === undefined || (candidate.options.overwrite === undefined || Is.boolean(candidate.options.overwrite)) && (candidate.options.ignoreIfExists === undefined || Is.boolean(candidate.options.ignoreIfExists))) && (candidate.annotationId === undefined || ChangeAnnotationIdentifier.is(candidate.annotationId));
      }
      CreateFile.is = is;
    })(CreateFile || (exports2.CreateFile = CreateFile = {}));
    var RenameFile;
    (function(RenameFile) {
      function create(oldUri, newUri, options, annotation) {
        var result = {
          kind: "rename",
          oldUri,
          newUri
        };
        if (options !== undefined && (options.overwrite !== undefined || options.ignoreIfExists !== undefined)) {
          result.options = options;
        }
        if (annotation !== undefined) {
          result.annotationId = annotation;
        }
        return result;
      }
      RenameFile.create = create;
      function is(value) {
        var candidate = value;
        return candidate && candidate.kind === "rename" && Is.string(candidate.oldUri) && Is.string(candidate.newUri) && (candidate.options === undefined || (candidate.options.overwrite === undefined || Is.boolean(candidate.options.overwrite)) && (candidate.options.ignoreIfExists === undefined || Is.boolean(candidate.options.ignoreIfExists))) && (candidate.annotationId === undefined || ChangeAnnotationIdentifier.is(candidate.annotationId));
      }
      RenameFile.is = is;
    })(RenameFile || (exports2.RenameFile = RenameFile = {}));
    var DeleteFile;
    (function(DeleteFile) {
      function create(uri, options, annotation) {
        var result = {
          kind: "delete",
          uri
        };
        if (options !== undefined && (options.recursive !== undefined || options.ignoreIfNotExists !== undefined)) {
          result.options = options;
        }
        if (annotation !== undefined) {
          result.annotationId = annotation;
        }
        return result;
      }
      DeleteFile.create = create;
      function is(value) {
        var candidate = value;
        return candidate && candidate.kind === "delete" && Is.string(candidate.uri) && (candidate.options === undefined || (candidate.options.recursive === undefined || Is.boolean(candidate.options.recursive)) && (candidate.options.ignoreIfNotExists === undefined || Is.boolean(candidate.options.ignoreIfNotExists))) && (candidate.annotationId === undefined || ChangeAnnotationIdentifier.is(candidate.annotationId));
      }
      DeleteFile.is = is;
    })(DeleteFile || (exports2.DeleteFile = DeleteFile = {}));
    var WorkspaceEdit;
    (function(WorkspaceEdit) {
      function is(value) {
        var candidate = value;
        return candidate && (candidate.changes !== undefined || candidate.documentChanges !== undefined) && (candidate.documentChanges === undefined || candidate.documentChanges.every(function(change) {
          if (Is.string(change.kind)) {
            return CreateFile.is(change) || RenameFile.is(change) || DeleteFile.is(change);
          } else {
            return TextDocumentEdit.is(change);
          }
        }));
      }
      WorkspaceEdit.is = is;
    })(WorkspaceEdit || (exports2.WorkspaceEdit = WorkspaceEdit = {}));
    var TextEditChangeImpl = function() {
      function TextEditChangeImpl(edits, changeAnnotations) {
        this.edits = edits;
        this.changeAnnotations = changeAnnotations;
      }
      TextEditChangeImpl.prototype.insert = function(position, newText, annotation) {
        var edit;
        var id;
        if (annotation === undefined) {
          edit = TextEdit.insert(position, newText);
        } else if (ChangeAnnotationIdentifier.is(annotation)) {
          id = annotation;
          edit = AnnotatedTextEdit.insert(position, newText, annotation);
        } else {
          this.assertChangeAnnotations(this.changeAnnotations);
          id = this.changeAnnotations.manage(annotation);
          edit = AnnotatedTextEdit.insert(position, newText, id);
        }
        this.edits.push(edit);
        if (id !== undefined) {
          return id;
        }
      };
      TextEditChangeImpl.prototype.replace = function(range, newText, annotation) {
        var edit;
        var id;
        if (annotation === undefined) {
          edit = TextEdit.replace(range, newText);
        } else if (ChangeAnnotationIdentifier.is(annotation)) {
          id = annotation;
          edit = AnnotatedTextEdit.replace(range, newText, annotation);
        } else {
          this.assertChangeAnnotations(this.changeAnnotations);
          id = this.changeAnnotations.manage(annotation);
          edit = AnnotatedTextEdit.replace(range, newText, id);
        }
        this.edits.push(edit);
        if (id !== undefined) {
          return id;
        }
      };
      TextEditChangeImpl.prototype.delete = function(range, annotation) {
        var edit;
        var id;
        if (annotation === undefined) {
          edit = TextEdit.del(range);
        } else if (ChangeAnnotationIdentifier.is(annotation)) {
          id = annotation;
          edit = AnnotatedTextEdit.del(range, annotation);
        } else {
          this.assertChangeAnnotations(this.changeAnnotations);
          id = this.changeAnnotations.manage(annotation);
          edit = AnnotatedTextEdit.del(range, id);
        }
        this.edits.push(edit);
        if (id !== undefined) {
          return id;
        }
      };
      TextEditChangeImpl.prototype.add = function(edit) {
        this.edits.push(edit);
      };
      TextEditChangeImpl.prototype.all = function() {
        return this.edits;
      };
      TextEditChangeImpl.prototype.clear = function() {
        this.edits.splice(0, this.edits.length);
      };
      TextEditChangeImpl.prototype.assertChangeAnnotations = function(value) {
        if (value === undefined) {
          throw new Error("Text edit change is not configured to manage change annotations.");
        }
      };
      return TextEditChangeImpl;
    }();
    var ChangeAnnotations = function() {
      function ChangeAnnotations(annotations) {
        this._annotations = annotations === undefined ? Object.create(null) : annotations;
        this._counter = 0;
        this._size = 0;
      }
      ChangeAnnotations.prototype.all = function() {
        return this._annotations;
      };
      Object.defineProperty(ChangeAnnotations.prototype, "size", {
        get: function() {
          return this._size;
        },
        enumerable: false,
        configurable: true
      });
      ChangeAnnotations.prototype.manage = function(idOrAnnotation, annotation) {
        var id;
        if (ChangeAnnotationIdentifier.is(idOrAnnotation)) {
          id = idOrAnnotation;
        } else {
          id = this.nextId();
          annotation = idOrAnnotation;
        }
        if (this._annotations[id] !== undefined) {
          throw new Error("Id ".concat(id, " is already in use."));
        }
        if (annotation === undefined) {
          throw new Error("No annotation provided for id ".concat(id));
        }
        this._annotations[id] = annotation;
        this._size++;
        return id;
      };
      ChangeAnnotations.prototype.nextId = function() {
        this._counter++;
        return this._counter.toString();
      };
      return ChangeAnnotations;
    }();
    var WorkspaceChange = function() {
      function WorkspaceChange(workspaceEdit) {
        var _this = this;
        this._textEditChanges = Object.create(null);
        if (workspaceEdit !== undefined) {
          this._workspaceEdit = workspaceEdit;
          if (workspaceEdit.documentChanges) {
            this._changeAnnotations = new ChangeAnnotations(workspaceEdit.changeAnnotations);
            workspaceEdit.changeAnnotations = this._changeAnnotations.all();
            workspaceEdit.documentChanges.forEach(function(change) {
              if (TextDocumentEdit.is(change)) {
                var textEditChange = new TextEditChangeImpl(change.edits, _this._changeAnnotations);
                _this._textEditChanges[change.textDocument.uri] = textEditChange;
              }
            });
          } else if (workspaceEdit.changes) {
            Object.keys(workspaceEdit.changes).forEach(function(key) {
              var textEditChange = new TextEditChangeImpl(workspaceEdit.changes[key]);
              _this._textEditChanges[key] = textEditChange;
            });
          }
        } else {
          this._workspaceEdit = {};
        }
      }
      Object.defineProperty(WorkspaceChange.prototype, "edit", {
        get: function() {
          this.initDocumentChanges();
          if (this._changeAnnotations !== undefined) {
            if (this._changeAnnotations.size === 0) {
              this._workspaceEdit.changeAnnotations = undefined;
            } else {
              this._workspaceEdit.changeAnnotations = this._changeAnnotations.all();
            }
          }
          return this._workspaceEdit;
        },
        enumerable: false,
        configurable: true
      });
      WorkspaceChange.prototype.getTextEditChange = function(key) {
        if (OptionalVersionedTextDocumentIdentifier.is(key)) {
          this.initDocumentChanges();
          if (this._workspaceEdit.documentChanges === undefined) {
            throw new Error("Workspace edit is not configured for document changes.");
          }
          var textDocument = { uri: key.uri, version: key.version };
          var result = this._textEditChanges[textDocument.uri];
          if (!result) {
            var edits = [];
            var textDocumentEdit = {
              textDocument,
              edits
            };
            this._workspaceEdit.documentChanges.push(textDocumentEdit);
            result = new TextEditChangeImpl(edits, this._changeAnnotations);
            this._textEditChanges[textDocument.uri] = result;
          }
          return result;
        } else {
          this.initChanges();
          if (this._workspaceEdit.changes === undefined) {
            throw new Error("Workspace edit is not configured for normal text edit changes.");
          }
          var result = this._textEditChanges[key];
          if (!result) {
            var edits = [];
            this._workspaceEdit.changes[key] = edits;
            result = new TextEditChangeImpl(edits);
            this._textEditChanges[key] = result;
          }
          return result;
        }
      };
      WorkspaceChange.prototype.initDocumentChanges = function() {
        if (this._workspaceEdit.documentChanges === undefined && this._workspaceEdit.changes === undefined) {
          this._changeAnnotations = new ChangeAnnotations;
          this._workspaceEdit.documentChanges = [];
          this._workspaceEdit.changeAnnotations = this._changeAnnotations.all();
        }
      };
      WorkspaceChange.prototype.initChanges = function() {
        if (this._workspaceEdit.documentChanges === undefined && this._workspaceEdit.changes === undefined) {
          this._workspaceEdit.changes = Object.create(null);
        }
      };
      WorkspaceChange.prototype.createFile = function(uri, optionsOrAnnotation, options) {
        this.initDocumentChanges();
        if (this._workspaceEdit.documentChanges === undefined) {
          throw new Error("Workspace edit is not configured for document changes.");
        }
        var annotation;
        if (ChangeAnnotation.is(optionsOrAnnotation) || ChangeAnnotationIdentifier.is(optionsOrAnnotation)) {
          annotation = optionsOrAnnotation;
        } else {
          options = optionsOrAnnotation;
        }
        var operation;
        var id;
        if (annotation === undefined) {
          operation = CreateFile.create(uri, options);
        } else {
          id = ChangeAnnotationIdentifier.is(annotation) ? annotation : this._changeAnnotations.manage(annotation);
          operation = CreateFile.create(uri, options, id);
        }
        this._workspaceEdit.documentChanges.push(operation);
        if (id !== undefined) {
          return id;
        }
      };
      WorkspaceChange.prototype.renameFile = function(oldUri, newUri, optionsOrAnnotation, options) {
        this.initDocumentChanges();
        if (this._workspaceEdit.documentChanges === undefined) {
          throw new Error("Workspace edit is not configured for document changes.");
        }
        var annotation;
        if (ChangeAnnotation.is(optionsOrAnnotation) || ChangeAnnotationIdentifier.is(optionsOrAnnotation)) {
          annotation = optionsOrAnnotation;
        } else {
          options = optionsOrAnnotation;
        }
        var operation;
        var id;
        if (annotation === undefined) {
          operation = RenameFile.create(oldUri, newUri, options);
        } else {
          id = ChangeAnnotationIdentifier.is(annotation) ? annotation : this._changeAnnotations.manage(annotation);
          operation = RenameFile.create(oldUri, newUri, options, id);
        }
        this._workspaceEdit.documentChanges.push(operation);
        if (id !== undefined) {
          return id;
        }
      };
      WorkspaceChange.prototype.deleteFile = function(uri, optionsOrAnnotation, options) {
        this.initDocumentChanges();
        if (this._workspaceEdit.documentChanges === undefined) {
          throw new Error("Workspace edit is not configured for document changes.");
        }
        var annotation;
        if (ChangeAnnotation.is(optionsOrAnnotation) || ChangeAnnotationIdentifier.is(optionsOrAnnotation)) {
          annotation = optionsOrAnnotation;
        } else {
          options = optionsOrAnnotation;
        }
        var operation;
        var id;
        if (annotation === undefined) {
          operation = DeleteFile.create(uri, options);
        } else {
          id = ChangeAnnotationIdentifier.is(annotation) ? annotation : this._changeAnnotations.manage(annotation);
          operation = DeleteFile.create(uri, options, id);
        }
        this._workspaceEdit.documentChanges.push(operation);
        if (id !== undefined) {
          return id;
        }
      };
      return WorkspaceChange;
    }();
    exports2.WorkspaceChange = WorkspaceChange;
    var TextDocumentIdentifier;
    (function(TextDocumentIdentifier) {
      function create(uri) {
        return { uri };
      }
      TextDocumentIdentifier.create = create;
      function is(value) {
        var candidate = value;
        return Is.defined(candidate) && Is.string(candidate.uri);
      }
      TextDocumentIdentifier.is = is;
    })(TextDocumentIdentifier || (exports2.TextDocumentIdentifier = TextDocumentIdentifier = {}));
    var VersionedTextDocumentIdentifier;
    (function(VersionedTextDocumentIdentifier) {
      function create(uri, version) {
        return { uri, version };
      }
      VersionedTextDocumentIdentifier.create = create;
      function is(value) {
        var candidate = value;
        return Is.defined(candidate) && Is.string(candidate.uri) && Is.integer(candidate.version);
      }
      VersionedTextDocumentIdentifier.is = is;
    })(VersionedTextDocumentIdentifier || (exports2.VersionedTextDocumentIdentifier = VersionedTextDocumentIdentifier = {}));
    var OptionalVersionedTextDocumentIdentifier;
    (function(OptionalVersionedTextDocumentIdentifier) {
      function create(uri, version) {
        return { uri, version };
      }
      OptionalVersionedTextDocumentIdentifier.create = create;
      function is(value) {
        var candidate = value;
        return Is.defined(candidate) && Is.string(candidate.uri) && (candidate.version === null || Is.integer(candidate.version));
      }
      OptionalVersionedTextDocumentIdentifier.is = is;
    })(OptionalVersionedTextDocumentIdentifier || (exports2.OptionalVersionedTextDocumentIdentifier = OptionalVersionedTextDocumentIdentifier = {}));
    var TextDocumentItem;
    (function(TextDocumentItem) {
      function create(uri, languageId, version, text) {
        return { uri, languageId, version, text };
      }
      TextDocumentItem.create = create;
      function is(value) {
        var candidate = value;
        return Is.defined(candidate) && Is.string(candidate.uri) && Is.string(candidate.languageId) && Is.integer(candidate.version) && Is.string(candidate.text);
      }
      TextDocumentItem.is = is;
    })(TextDocumentItem || (exports2.TextDocumentItem = TextDocumentItem = {}));
    var MarkupKind;
    (function(MarkupKind) {
      MarkupKind.PlainText = "plaintext";
      MarkupKind.Markdown = "markdown";
      function is(value) {
        var candidate = value;
        return candidate === MarkupKind.PlainText || candidate === MarkupKind.Markdown;
      }
      MarkupKind.is = is;
    })(MarkupKind || (exports2.MarkupKind = MarkupKind = {}));
    var MarkupContent;
    (function(MarkupContent) {
      function is(value) {
        var candidate = value;
        return Is.objectLiteral(value) && MarkupKind.is(candidate.kind) && Is.string(candidate.value);
      }
      MarkupContent.is = is;
    })(MarkupContent || (exports2.MarkupContent = MarkupContent = {}));
    var CompletionItemKind;
    (function(CompletionItemKind) {
      CompletionItemKind.Text = 1;
      CompletionItemKind.Method = 2;
      CompletionItemKind.Function = 3;
      CompletionItemKind.Constructor = 4;
      CompletionItemKind.Field = 5;
      CompletionItemKind.Variable = 6;
      CompletionItemKind.Class = 7;
      CompletionItemKind.Interface = 8;
      CompletionItemKind.Module = 9;
      CompletionItemKind.Property = 10;
      CompletionItemKind.Unit = 11;
      CompletionItemKind.Value = 12;
      CompletionItemKind.Enum = 13;
      CompletionItemKind.Keyword = 14;
      CompletionItemKind.Snippet = 15;
      CompletionItemKind.Color = 16;
      CompletionItemKind.File = 17;
      CompletionItemKind.Reference = 18;
      CompletionItemKind.Folder = 19;
      CompletionItemKind.EnumMember = 20;
      CompletionItemKind.Constant = 21;
      CompletionItemKind.Struct = 22;
      CompletionItemKind.Event = 23;
      CompletionItemKind.Operator = 24;
      CompletionItemKind.TypeParameter = 25;
    })(CompletionItemKind || (exports2.CompletionItemKind = CompletionItemKind = {}));
    var InsertTextFormat;
    (function(InsertTextFormat) {
      InsertTextFormat.PlainText = 1;
      InsertTextFormat.Snippet = 2;
    })(InsertTextFormat || (exports2.InsertTextFormat = InsertTextFormat = {}));
    var CompletionItemTag;
    (function(CompletionItemTag) {
      CompletionItemTag.Deprecated = 1;
    })(CompletionItemTag || (exports2.CompletionItemTag = CompletionItemTag = {}));
    var InsertReplaceEdit;
    (function(InsertReplaceEdit) {
      function create(newText, insert, replace) {
        return { newText, insert, replace };
      }
      InsertReplaceEdit.create = create;
      function is(value) {
        var candidate = value;
        return candidate && Is.string(candidate.newText) && Range.is(candidate.insert) && Range.is(candidate.replace);
      }
      InsertReplaceEdit.is = is;
    })(InsertReplaceEdit || (exports2.InsertReplaceEdit = InsertReplaceEdit = {}));
    var InsertTextMode;
    (function(InsertTextMode) {
      InsertTextMode.asIs = 1;
      InsertTextMode.adjustIndentation = 2;
    })(InsertTextMode || (exports2.InsertTextMode = InsertTextMode = {}));
    var CompletionItemLabelDetails;
    (function(CompletionItemLabelDetails) {
      function is(value) {
        var candidate = value;
        return candidate && (Is.string(candidate.detail) || candidate.detail === undefined) && (Is.string(candidate.description) || candidate.description === undefined);
      }
      CompletionItemLabelDetails.is = is;
    })(CompletionItemLabelDetails || (exports2.CompletionItemLabelDetails = CompletionItemLabelDetails = {}));
    var CompletionItem;
    (function(CompletionItem) {
      function create(label) {
        return { label };
      }
      CompletionItem.create = create;
    })(CompletionItem || (exports2.CompletionItem = CompletionItem = {}));
    var CompletionList;
    (function(CompletionList) {
      function create(items, isIncomplete) {
        return { items: items ? items : [], isIncomplete: !!isIncomplete };
      }
      CompletionList.create = create;
    })(CompletionList || (exports2.CompletionList = CompletionList = {}));
    var MarkedString;
    (function(MarkedString) {
      function fromPlainText(plainText) {
        return plainText.replace(/[\\`*_{}[\]()#+\-.!]/g, "\\$&");
      }
      MarkedString.fromPlainText = fromPlainText;
      function is(value) {
        var candidate = value;
        return Is.string(candidate) || Is.objectLiteral(candidate) && Is.string(candidate.language) && Is.string(candidate.value);
      }
      MarkedString.is = is;
    })(MarkedString || (exports2.MarkedString = MarkedString = {}));
    var Hover;
    (function(Hover) {
      function is(value) {
        var candidate = value;
        return !!candidate && Is.objectLiteral(candidate) && (MarkupContent.is(candidate.contents) || MarkedString.is(candidate.contents) || Is.typedArray(candidate.contents, MarkedString.is)) && (value.range === undefined || Range.is(value.range));
      }
      Hover.is = is;
    })(Hover || (exports2.Hover = Hover = {}));
    var ParameterInformation;
    (function(ParameterInformation) {
      function create(label, documentation) {
        return documentation ? { label, documentation } : { label };
      }
      ParameterInformation.create = create;
    })(ParameterInformation || (exports2.ParameterInformation = ParameterInformation = {}));
    var SignatureInformation;
    (function(SignatureInformation) {
      function create(label, documentation) {
        var parameters = [];
        for (var _i = 2;_i < arguments.length; _i++) {
          parameters[_i - 2] = arguments[_i];
        }
        var result = { label };
        if (Is.defined(documentation)) {
          result.documentation = documentation;
        }
        if (Is.defined(parameters)) {
          result.parameters = parameters;
        } else {
          result.parameters = [];
        }
        return result;
      }
      SignatureInformation.create = create;
    })(SignatureInformation || (exports2.SignatureInformation = SignatureInformation = {}));
    var DocumentHighlightKind;
    (function(DocumentHighlightKind) {
      DocumentHighlightKind.Text = 1;
      DocumentHighlightKind.Read = 2;
      DocumentHighlightKind.Write = 3;
    })(DocumentHighlightKind || (exports2.DocumentHighlightKind = DocumentHighlightKind = {}));
    var DocumentHighlight;
    (function(DocumentHighlight) {
      function create(range, kind) {
        var result = { range };
        if (Is.number(kind)) {
          result.kind = kind;
        }
        return result;
      }
      DocumentHighlight.create = create;
    })(DocumentHighlight || (exports2.DocumentHighlight = DocumentHighlight = {}));
    var SymbolKind;
    (function(SymbolKind) {
      SymbolKind.File = 1;
      SymbolKind.Module = 2;
      SymbolKind.Namespace = 3;
      SymbolKind.Package = 4;
      SymbolKind.Class = 5;
      SymbolKind.Method = 6;
      SymbolKind.Property = 7;
      SymbolKind.Field = 8;
      SymbolKind.Constructor = 9;
      SymbolKind.Enum = 10;
      SymbolKind.Interface = 11;
      SymbolKind.Function = 12;
      SymbolKind.Variable = 13;
      SymbolKind.Constant = 14;
      SymbolKind.String = 15;
      SymbolKind.Number = 16;
      SymbolKind.Boolean = 17;
      SymbolKind.Array = 18;
      SymbolKind.Object = 19;
      SymbolKind.Key = 20;
      SymbolKind.Null = 21;
      SymbolKind.EnumMember = 22;
      SymbolKind.Struct = 23;
      SymbolKind.Event = 24;
      SymbolKind.Operator = 25;
      SymbolKind.TypeParameter = 26;
    })(SymbolKind || (exports2.SymbolKind = SymbolKind = {}));
    var SymbolTag;
    (function(SymbolTag) {
      SymbolTag.Deprecated = 1;
    })(SymbolTag || (exports2.SymbolTag = SymbolTag = {}));
    var SymbolInformation;
    (function(SymbolInformation) {
      function create(name, kind, range, uri, containerName) {
        var result = {
          name,
          kind,
          location: { uri, range }
        };
        if (containerName) {
          result.containerName = containerName;
        }
        return result;
      }
      SymbolInformation.create = create;
    })(SymbolInformation || (exports2.SymbolInformation = SymbolInformation = {}));
    var WorkspaceSymbol;
    (function(WorkspaceSymbol) {
      function create(name, kind, uri, range) {
        return range !== undefined ? { name, kind, location: { uri, range } } : { name, kind, location: { uri } };
      }
      WorkspaceSymbol.create = create;
    })(WorkspaceSymbol || (exports2.WorkspaceSymbol = WorkspaceSymbol = {}));
    var DocumentSymbol;
    (function(DocumentSymbol) {
      function create(name, detail, kind, range, selectionRange, children) {
        var result = {
          name,
          detail,
          kind,
          range,
          selectionRange
        };
        if (children !== undefined) {
          result.children = children;
        }
        return result;
      }
      DocumentSymbol.create = create;
      function is(value) {
        var candidate = value;
        return candidate && Is.string(candidate.name) && Is.number(candidate.kind) && Range.is(candidate.range) && Range.is(candidate.selectionRange) && (candidate.detail === undefined || Is.string(candidate.detail)) && (candidate.deprecated === undefined || Is.boolean(candidate.deprecated)) && (candidate.children === undefined || Array.isArray(candidate.children)) && (candidate.tags === undefined || Array.isArray(candidate.tags));
      }
      DocumentSymbol.is = is;
    })(DocumentSymbol || (exports2.DocumentSymbol = DocumentSymbol = {}));
    var CodeActionKind;
    (function(CodeActionKind) {
      CodeActionKind.Empty = "";
      CodeActionKind.QuickFix = "quickfix";
      CodeActionKind.Refactor = "refactor";
      CodeActionKind.RefactorExtract = "refactor.extract";
      CodeActionKind.RefactorInline = "refactor.inline";
      CodeActionKind.RefactorRewrite = "refactor.rewrite";
      CodeActionKind.Source = "source";
      CodeActionKind.SourceOrganizeImports = "source.organizeImports";
      CodeActionKind.SourceFixAll = "source.fixAll";
    })(CodeActionKind || (exports2.CodeActionKind = CodeActionKind = {}));
    var CodeActionTriggerKind;
    (function(CodeActionTriggerKind) {
      CodeActionTriggerKind.Invoked = 1;
      CodeActionTriggerKind.Automatic = 2;
    })(CodeActionTriggerKind || (exports2.CodeActionTriggerKind = CodeActionTriggerKind = {}));
    var CodeActionContext;
    (function(CodeActionContext) {
      function create(diagnostics, only, triggerKind) {
        var result = { diagnostics };
        if (only !== undefined && only !== null) {
          result.only = only;
        }
        if (triggerKind !== undefined && triggerKind !== null) {
          result.triggerKind = triggerKind;
        }
        return result;
      }
      CodeActionContext.create = create;
      function is(value) {
        var candidate = value;
        return Is.defined(candidate) && Is.typedArray(candidate.diagnostics, Diagnostic.is) && (candidate.only === undefined || Is.typedArray(candidate.only, Is.string)) && (candidate.triggerKind === undefined || candidate.triggerKind === CodeActionTriggerKind.Invoked || candidate.triggerKind === CodeActionTriggerKind.Automatic);
      }
      CodeActionContext.is = is;
    })(CodeActionContext || (exports2.CodeActionContext = CodeActionContext = {}));
    var CodeAction;
    (function(CodeAction) {
      function create(title, kindOrCommandOrEdit, kind) {
        var result = { title };
        var checkKind = true;
        if (typeof kindOrCommandOrEdit === "string") {
          checkKind = false;
          result.kind = kindOrCommandOrEdit;
        } else if (Command.is(kindOrCommandOrEdit)) {
          result.command = kindOrCommandOrEdit;
        } else {
          result.edit = kindOrCommandOrEdit;
        }
        if (checkKind && kind !== undefined) {
          result.kind = kind;
        }
        return result;
      }
      CodeAction.create = create;
      function is(value) {
        var candidate = value;
        return candidate && Is.string(candidate.title) && (candidate.diagnostics === undefined || Is.typedArray(candidate.diagnostics, Diagnostic.is)) && (candidate.kind === undefined || Is.string(candidate.kind)) && (candidate.edit !== undefined || candidate.command !== undefined) && (candidate.command === undefined || Command.is(candidate.command)) && (candidate.isPreferred === undefined || Is.boolean(candidate.isPreferred)) && (candidate.edit === undefined || WorkspaceEdit.is(candidate.edit));
      }
      CodeAction.is = is;
    })(CodeAction || (exports2.CodeAction = CodeAction = {}));
    var CodeLens;
    (function(CodeLens) {
      function create(range, data) {
        var result = { range };
        if (Is.defined(data)) {
          result.data = data;
        }
        return result;
      }
      CodeLens.create = create;
      function is(value) {
        var candidate = value;
        return Is.defined(candidate) && Range.is(candidate.range) && (Is.undefined(candidate.command) || Command.is(candidate.command));
      }
      CodeLens.is = is;
    })(CodeLens || (exports2.CodeLens = CodeLens = {}));
    var FormattingOptions;
    (function(FormattingOptions) {
      function create(tabSize, insertSpaces) {
        return { tabSize, insertSpaces };
      }
      FormattingOptions.create = create;
      function is(value) {
        var candidate = value;
        return Is.defined(candidate) && Is.uinteger(candidate.tabSize) && Is.boolean(candidate.insertSpaces);
      }
      FormattingOptions.is = is;
    })(FormattingOptions || (exports2.FormattingOptions = FormattingOptions = {}));
    var DocumentLink;
    (function(DocumentLink) {
      function create(range, target, data) {
        return { range, target, data };
      }
      DocumentLink.create = create;
      function is(value) {
        var candidate = value;
        return Is.defined(candidate) && Range.is(candidate.range) && (Is.undefined(candidate.target) || Is.string(candidate.target));
      }
      DocumentLink.is = is;
    })(DocumentLink || (exports2.DocumentLink = DocumentLink = {}));
    var SelectionRange;
    (function(SelectionRange) {
      function create(range, parent) {
        return { range, parent };
      }
      SelectionRange.create = create;
      function is(value) {
        var candidate = value;
        return Is.objectLiteral(candidate) && Range.is(candidate.range) && (candidate.parent === undefined || SelectionRange.is(candidate.parent));
      }
      SelectionRange.is = is;
    })(SelectionRange || (exports2.SelectionRange = SelectionRange = {}));
    var SemanticTokenTypes;
    (function(SemanticTokenTypes) {
      SemanticTokenTypes["namespace"] = "namespace";
      SemanticTokenTypes["type"] = "type";
      SemanticTokenTypes["class"] = "class";
      SemanticTokenTypes["enum"] = "enum";
      SemanticTokenTypes["interface"] = "interface";
      SemanticTokenTypes["struct"] = "struct";
      SemanticTokenTypes["typeParameter"] = "typeParameter";
      SemanticTokenTypes["parameter"] = "parameter";
      SemanticTokenTypes["variable"] = "variable";
      SemanticTokenTypes["property"] = "property";
      SemanticTokenTypes["enumMember"] = "enumMember";
      SemanticTokenTypes["event"] = "event";
      SemanticTokenTypes["function"] = "function";
      SemanticTokenTypes["method"] = "method";
      SemanticTokenTypes["macro"] = "macro";
      SemanticTokenTypes["keyword"] = "keyword";
      SemanticTokenTypes["modifier"] = "modifier";
      SemanticTokenTypes["comment"] = "comment";
      SemanticTokenTypes["string"] = "string";
      SemanticTokenTypes["number"] = "number";
      SemanticTokenTypes["regexp"] = "regexp";
      SemanticTokenTypes["operator"] = "operator";
      SemanticTokenTypes["decorator"] = "decorator";
    })(SemanticTokenTypes || (exports2.SemanticTokenTypes = SemanticTokenTypes = {}));
    var SemanticTokenModifiers;
    (function(SemanticTokenModifiers) {
      SemanticTokenModifiers["declaration"] = "declaration";
      SemanticTokenModifiers["definition"] = "definition";
      SemanticTokenModifiers["readonly"] = "readonly";
      SemanticTokenModifiers["static"] = "static";
      SemanticTokenModifiers["deprecated"] = "deprecated";
      SemanticTokenModifiers["abstract"] = "abstract";
      SemanticTokenModifiers["async"] = "async";
      SemanticTokenModifiers["modification"] = "modification";
      SemanticTokenModifiers["documentation"] = "documentation";
      SemanticTokenModifiers["defaultLibrary"] = "defaultLibrary";
    })(SemanticTokenModifiers || (exports2.SemanticTokenModifiers = SemanticTokenModifiers = {}));
    var SemanticTokens;
    (function(SemanticTokens) {
      function is(value) {
        var candidate = value;
        return Is.objectLiteral(candidate) && (candidate.resultId === undefined || typeof candidate.resultId === "string") && Array.isArray(candidate.data) && (candidate.data.length === 0 || typeof candidate.data[0] === "number");
      }
      SemanticTokens.is = is;
    })(SemanticTokens || (exports2.SemanticTokens = SemanticTokens = {}));
    var InlineValueText;
    (function(InlineValueText) {
      function create(range, text) {
        return { range, text };
      }
      InlineValueText.create = create;
      function is(value) {
        var candidate = value;
        return candidate !== undefined && candidate !== null && Range.is(candidate.range) && Is.string(candidate.text);
      }
      InlineValueText.is = is;
    })(InlineValueText || (exports2.InlineValueText = InlineValueText = {}));
    var InlineValueVariableLookup;
    (function(InlineValueVariableLookup) {
      function create(range, variableName, caseSensitiveLookup) {
        return { range, variableName, caseSensitiveLookup };
      }
      InlineValueVariableLookup.create = create;
      function is(value) {
        var candidate = value;
        return candidate !== undefined && candidate !== null && Range.is(candidate.range) && Is.boolean(candidate.caseSensitiveLookup) && (Is.string(candidate.variableName) || candidate.variableName === undefined);
      }
      InlineValueVariableLookup.is = is;
    })(InlineValueVariableLookup || (exports2.InlineValueVariableLookup = InlineValueVariableLookup = {}));
    var InlineValueEvaluatableExpression;
    (function(InlineValueEvaluatableExpression) {
      function create(range, expression) {
        return { range, expression };
      }
      InlineValueEvaluatableExpression.create = create;
      function is(value) {
        var candidate = value;
        return candidate !== undefined && candidate !== null && Range.is(candidate.range) && (Is.string(candidate.expression) || candidate.expression === undefined);
      }
      InlineValueEvaluatableExpression.is = is;
    })(InlineValueEvaluatableExpression || (exports2.InlineValueEvaluatableExpression = InlineValueEvaluatableExpression = {}));
    var InlineValueContext;
    (function(InlineValueContext) {
      function create(frameId, stoppedLocation) {
        return { frameId, stoppedLocation };
      }
      InlineValueContext.create = create;
      function is(value) {
        var candidate = value;
        return Is.defined(candidate) && Range.is(value.stoppedLocation);
      }
      InlineValueContext.is = is;
    })(InlineValueContext || (exports2.InlineValueContext = InlineValueContext = {}));
    var InlayHintKind;
    (function(InlayHintKind) {
      InlayHintKind.Type = 1;
      InlayHintKind.Parameter = 2;
      function is(value) {
        return value === 1 || value === 2;
      }
      InlayHintKind.is = is;
    })(InlayHintKind || (exports2.InlayHintKind = InlayHintKind = {}));
    var InlayHintLabelPart;
    (function(InlayHintLabelPart) {
      function create(value) {
        return { value };
      }
      InlayHintLabelPart.create = create;
      function is(value) {
        var candidate = value;
        return Is.objectLiteral(candidate) && (candidate.tooltip === undefined || Is.string(candidate.tooltip) || MarkupContent.is(candidate.tooltip)) && (candidate.location === undefined || Location.is(candidate.location)) && (candidate.command === undefined || Command.is(candidate.command));
      }
      InlayHintLabelPart.is = is;
    })(InlayHintLabelPart || (exports2.InlayHintLabelPart = InlayHintLabelPart = {}));
    var InlayHint;
    (function(InlayHint) {
      function create(position, label, kind) {
        var result = { position, label };
        if (kind !== undefined) {
          result.kind = kind;
        }
        return result;
      }
      InlayHint.create = create;
      function is(value) {
        var candidate = value;
        return Is.objectLiteral(candidate) && Position.is(candidate.position) && (Is.string(candidate.label) || Is.typedArray(candidate.label, InlayHintLabelPart.is)) && (candidate.kind === undefined || InlayHintKind.is(candidate.kind)) && candidate.textEdits === undefined || Is.typedArray(candidate.textEdits, TextEdit.is) && (candidate.tooltip === undefined || Is.string(candidate.tooltip) || MarkupContent.is(candidate.tooltip)) && (candidate.paddingLeft === undefined || Is.boolean(candidate.paddingLeft)) && (candidate.paddingRight === undefined || Is.boolean(candidate.paddingRight));
      }
      InlayHint.is = is;
    })(InlayHint || (exports2.InlayHint = InlayHint = {}));
    var StringValue;
    (function(StringValue) {
      function createSnippet(value) {
        return { kind: "snippet", value };
      }
      StringValue.createSnippet = createSnippet;
    })(StringValue || (exports2.StringValue = StringValue = {}));
    var InlineCompletionItem;
    (function(InlineCompletionItem) {
      function create(insertText, filterText, range, command) {
        return { insertText, filterText, range, command };
      }
      InlineCompletionItem.create = create;
    })(InlineCompletionItem || (exports2.InlineCompletionItem = InlineCompletionItem = {}));
    var InlineCompletionList;
    (function(InlineCompletionList) {
      function create(items) {
        return { items };
      }
      InlineCompletionList.create = create;
    })(InlineCompletionList || (exports2.InlineCompletionList = InlineCompletionList = {}));
    var InlineCompletionTriggerKind;
    (function(InlineCompletionTriggerKind) {
      InlineCompletionTriggerKind.Invoked = 0;
      InlineCompletionTriggerKind.Automatic = 1;
    })(InlineCompletionTriggerKind || (exports2.InlineCompletionTriggerKind = InlineCompletionTriggerKind = {}));
    var SelectedCompletionInfo;
    (function(SelectedCompletionInfo) {
      function create(range, text) {
        return { range, text };
      }
      SelectedCompletionInfo.create = create;
    })(SelectedCompletionInfo || (exports2.SelectedCompletionInfo = SelectedCompletionInfo = {}));
    var InlineCompletionContext;
    (function(InlineCompletionContext) {
      function create(triggerKind, selectedCompletionInfo) {
        return { triggerKind, selectedCompletionInfo };
      }
      InlineCompletionContext.create = create;
    })(InlineCompletionContext || (exports2.InlineCompletionContext = InlineCompletionContext = {}));
    var WorkspaceFolder;
    (function(WorkspaceFolder) {
      function is(value) {
        var candidate = value;
        return Is.objectLiteral(candidate) && URI.is(candidate.uri) && Is.string(candidate.name);
      }
      WorkspaceFolder.is = is;
    })(WorkspaceFolder || (exports2.WorkspaceFolder = WorkspaceFolder = {}));
    exports2.EOL = [`
`, `\r
`, "\r"];
    var TextDocument;
    (function(TextDocument) {
      function create(uri, languageId, version, content) {
        return new FullTextDocument(uri, languageId, version, content);
      }
      TextDocument.create = create;
      function is(value) {
        var candidate = value;
        return Is.defined(candidate) && Is.string(candidate.uri) && (Is.undefined(candidate.languageId) || Is.string(candidate.languageId)) && Is.uinteger(candidate.lineCount) && Is.func(candidate.getText) && Is.func(candidate.positionAt) && Is.func(candidate.offsetAt) ? true : false;
      }
      TextDocument.is = is;
      function applyEdits(document, edits) {
        var text = document.getText();
        var sortedEdits = mergeSort(edits, function(a, b) {
          var diff = a.range.start.line - b.range.start.line;
          if (diff === 0) {
            return a.range.start.character - b.range.start.character;
          }
          return diff;
        });
        var lastModifiedOffset = text.length;
        for (var i = sortedEdits.length - 1;i >= 0; i--) {
          var e = sortedEdits[i];
          var startOffset = document.offsetAt(e.range.start);
          var endOffset = document.offsetAt(e.range.end);
          if (endOffset <= lastModifiedOffset) {
            text = text.substring(0, startOffset) + e.newText + text.substring(endOffset, text.length);
          } else {
            throw new Error("Overlapping edit");
          }
          lastModifiedOffset = startOffset;
        }
        return text;
      }
      TextDocument.applyEdits = applyEdits;
      function mergeSort(data, compare) {
        if (data.length <= 1) {
          return data;
        }
        var p = data.length / 2 | 0;
        var left = data.slice(0, p);
        var right = data.slice(p);
        mergeSort(left, compare);
        mergeSort(right, compare);
        var leftIdx = 0;
        var rightIdx = 0;
        var i = 0;
        while (leftIdx < left.length && rightIdx < right.length) {
          var ret = compare(left[leftIdx], right[rightIdx]);
          if (ret <= 0) {
            data[i++] = left[leftIdx++];
          } else {
            data[i++] = right[rightIdx++];
          }
        }
        while (leftIdx < left.length) {
          data[i++] = left[leftIdx++];
        }
        while (rightIdx < right.length) {
          data[i++] = right[rightIdx++];
        }
        return data;
      }
    })(TextDocument || (exports2.TextDocument = TextDocument = {}));
    var FullTextDocument = function() {
      function FullTextDocument(uri, languageId, version, content) {
        this._uri = uri;
        this._languageId = languageId;
        this._version = version;
        this._content = content;
        this._lineOffsets = undefined;
      }
      Object.defineProperty(FullTextDocument.prototype, "uri", {
        get: function() {
          return this._uri;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(FullTextDocument.prototype, "languageId", {
        get: function() {
          return this._languageId;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(FullTextDocument.prototype, "version", {
        get: function() {
          return this._version;
        },
        enumerable: false,
        configurable: true
      });
      FullTextDocument.prototype.getText = function(range) {
        if (range) {
          var start = this.offsetAt(range.start);
          var end = this.offsetAt(range.end);
          return this._content.substring(start, end);
        }
        return this._content;
      };
      FullTextDocument.prototype.update = function(event, version) {
        this._content = event.text;
        this._version = version;
        this._lineOffsets = undefined;
      };
      FullTextDocument.prototype.getLineOffsets = function() {
        if (this._lineOffsets === undefined) {
          var lineOffsets = [];
          var text = this._content;
          var isLineStart = true;
          for (var i = 0;i < text.length; i++) {
            if (isLineStart) {
              lineOffsets.push(i);
              isLineStart = false;
            }
            var ch = text.charAt(i);
            isLineStart = ch === "\r" || ch === `
`;
            if (ch === "\r" && i + 1 < text.length && text.charAt(i + 1) === `
`) {
              i++;
            }
          }
          if (isLineStart && text.length > 0) {
            lineOffsets.push(text.length);
          }
          this._lineOffsets = lineOffsets;
        }
        return this._lineOffsets;
      };
      FullTextDocument.prototype.positionAt = function(offset) {
        offset = Math.max(Math.min(offset, this._content.length), 0);
        var lineOffsets = this.getLineOffsets();
        var low = 0, high = lineOffsets.length;
        if (high === 0) {
          return Position.create(0, offset);
        }
        while (low < high) {
          var mid = Math.floor((low + high) / 2);
          if (lineOffsets[mid] > offset) {
            high = mid;
          } else {
            low = mid + 1;
          }
        }
        var line = low - 1;
        return Position.create(line, offset - lineOffsets[line]);
      };
      FullTextDocument.prototype.offsetAt = function(position) {
        var lineOffsets = this.getLineOffsets();
        if (position.line >= lineOffsets.length) {
          return this._content.length;
        } else if (position.line < 0) {
          return 0;
        }
        var lineOffset = lineOffsets[position.line];
        var nextLineOffset = position.line + 1 < lineOffsets.length ? lineOffsets[position.line + 1] : this._content.length;
        return Math.max(Math.min(lineOffset + position.character, nextLineOffset), lineOffset);
      };
      Object.defineProperty(FullTextDocument.prototype, "lineCount", {
        get: function() {
          return this.getLineOffsets().length;
        },
        enumerable: false,
        configurable: true
      });
      return FullTextDocument;
    }();
    var Is;
    (function(Is) {
      var toString = Object.prototype.toString;
      function defined(value) {
        return typeof value !== "undefined";
      }
      Is.defined = defined;
      function undefined2(value) {
        return typeof value === "undefined";
      }
      Is.undefined = undefined2;
      function boolean(value) {
        return value === true || value === false;
      }
      Is.boolean = boolean;
      function string(value) {
        return toString.call(value) === "[object String]";
      }
      Is.string = string;
      function number(value) {
        return toString.call(value) === "[object Number]";
      }
      Is.number = number;
      function numberRange(value, min, max) {
        return toString.call(value) === "[object Number]" && min <= value && value <= max;
      }
      Is.numberRange = numberRange;
      function integer(value) {
        return toString.call(value) === "[object Number]" && -2147483648 <= value && value <= 2147483647;
      }
      Is.integer = integer;
      function uinteger(value) {
        return toString.call(value) === "[object Number]" && 0 <= value && value <= 2147483647;
      }
      Is.uinteger = uinteger;
      function func(value) {
        return toString.call(value) === "[object Function]";
      }
      Is.func = func;
      function objectLiteral(value) {
        return value !== null && typeof value === "object";
      }
      Is.objectLiteral = objectLiteral;
      function typedArray(value, check) {
        return Array.isArray(value) && value.every(check);
      }
      Is.typedArray = typedArray;
    })(Is || (Is = {}));
  });
});

// node_modules/vscode-languageserver-protocol/lib/common/messages.js
var require_messages2 = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.ProtocolNotificationType = exports.ProtocolNotificationType0 = exports.ProtocolRequestType = exports.ProtocolRequestType0 = exports.RegistrationType = exports.MessageDirection = undefined;
  var vscode_jsonrpc_1 = require_main();
  var MessageDirection;
  (function(MessageDirection) {
    MessageDirection["clientToServer"] = "clientToServer";
    MessageDirection["serverToClient"] = "serverToClient";
    MessageDirection["both"] = "both";
  })(MessageDirection || (exports.MessageDirection = MessageDirection = {}));

  class RegistrationType {
    constructor(method) {
      this.method = method;
    }
  }
  exports.RegistrationType = RegistrationType;

  class ProtocolRequestType0 extends vscode_jsonrpc_1.RequestType0 {
    constructor(method) {
      super(method);
    }
  }
  exports.ProtocolRequestType0 = ProtocolRequestType0;

  class ProtocolRequestType extends vscode_jsonrpc_1.RequestType {
    constructor(method) {
      super(method, vscode_jsonrpc_1.ParameterStructures.byName);
    }
  }
  exports.ProtocolRequestType = ProtocolRequestType;

  class ProtocolNotificationType0 extends vscode_jsonrpc_1.NotificationType0 {
    constructor(method) {
      super(method);
    }
  }
  exports.ProtocolNotificationType0 = ProtocolNotificationType0;

  class ProtocolNotificationType extends vscode_jsonrpc_1.NotificationType {
    constructor(method) {
      super(method, vscode_jsonrpc_1.ParameterStructures.byName);
    }
  }
  exports.ProtocolNotificationType = ProtocolNotificationType;
});

// node_modules/vscode-languageserver-protocol/lib/common/utils/is.js
var require_is3 = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.objectLiteral = exports.typedArray = exports.stringArray = exports.array = exports.func = exports.error = exports.number = exports.string = exports.boolean = undefined;
  function boolean(value) {
    return value === true || value === false;
  }
  exports.boolean = boolean;
  function string(value) {
    return typeof value === "string" || value instanceof String;
  }
  exports.string = string;
  function number(value) {
    return typeof value === "number" || value instanceof Number;
  }
  exports.number = number;
  function error(value) {
    return value instanceof Error;
  }
  exports.error = error;
  function func(value) {
    return typeof value === "function";
  }
  exports.func = func;
  function array(value) {
    return Array.isArray(value);
  }
  exports.array = array;
  function stringArray(value) {
    return array(value) && value.every((elem) => string(elem));
  }
  exports.stringArray = stringArray;
  function typedArray(value, check) {
    return Array.isArray(value) && value.every(check);
  }
  exports.typedArray = typedArray;
  function objectLiteral(value) {
    return value !== null && typeof value === "object";
  }
  exports.objectLiteral = objectLiteral;
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.implementation.js
var require_protocol_implementation = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.ImplementationRequest = undefined;
  var messages_1 = require_messages2();
  var ImplementationRequest;
  (function(ImplementationRequest) {
    ImplementationRequest.method = "textDocument/implementation";
    ImplementationRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    ImplementationRequest.type = new messages_1.ProtocolRequestType(ImplementationRequest.method);
  })(ImplementationRequest || (exports.ImplementationRequest = ImplementationRequest = {}));
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.typeDefinition.js
var require_protocol_typeDefinition = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.TypeDefinitionRequest = undefined;
  var messages_1 = require_messages2();
  var TypeDefinitionRequest;
  (function(TypeDefinitionRequest) {
    TypeDefinitionRequest.method = "textDocument/typeDefinition";
    TypeDefinitionRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    TypeDefinitionRequest.type = new messages_1.ProtocolRequestType(TypeDefinitionRequest.method);
  })(TypeDefinitionRequest || (exports.TypeDefinitionRequest = TypeDefinitionRequest = {}));
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.workspaceFolder.js
var require_protocol_workspaceFolder = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.DidChangeWorkspaceFoldersNotification = exports.WorkspaceFoldersRequest = undefined;
  var messages_1 = require_messages2();
  var WorkspaceFoldersRequest;
  (function(WorkspaceFoldersRequest) {
    WorkspaceFoldersRequest.method = "workspace/workspaceFolders";
    WorkspaceFoldersRequest.messageDirection = messages_1.MessageDirection.serverToClient;
    WorkspaceFoldersRequest.type = new messages_1.ProtocolRequestType0(WorkspaceFoldersRequest.method);
  })(WorkspaceFoldersRequest || (exports.WorkspaceFoldersRequest = WorkspaceFoldersRequest = {}));
  var DidChangeWorkspaceFoldersNotification;
  (function(DidChangeWorkspaceFoldersNotification) {
    DidChangeWorkspaceFoldersNotification.method = "workspace/didChangeWorkspaceFolders";
    DidChangeWorkspaceFoldersNotification.messageDirection = messages_1.MessageDirection.clientToServer;
    DidChangeWorkspaceFoldersNotification.type = new messages_1.ProtocolNotificationType(DidChangeWorkspaceFoldersNotification.method);
  })(DidChangeWorkspaceFoldersNotification || (exports.DidChangeWorkspaceFoldersNotification = DidChangeWorkspaceFoldersNotification = {}));
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.configuration.js
var require_protocol_configuration = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.ConfigurationRequest = undefined;
  var messages_1 = require_messages2();
  var ConfigurationRequest;
  (function(ConfigurationRequest) {
    ConfigurationRequest.method = "workspace/configuration";
    ConfigurationRequest.messageDirection = messages_1.MessageDirection.serverToClient;
    ConfigurationRequest.type = new messages_1.ProtocolRequestType(ConfigurationRequest.method);
  })(ConfigurationRequest || (exports.ConfigurationRequest = ConfigurationRequest = {}));
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.colorProvider.js
var require_protocol_colorProvider = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.ColorPresentationRequest = exports.DocumentColorRequest = undefined;
  var messages_1 = require_messages2();
  var DocumentColorRequest;
  (function(DocumentColorRequest) {
    DocumentColorRequest.method = "textDocument/documentColor";
    DocumentColorRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    DocumentColorRequest.type = new messages_1.ProtocolRequestType(DocumentColorRequest.method);
  })(DocumentColorRequest || (exports.DocumentColorRequest = DocumentColorRequest = {}));
  var ColorPresentationRequest;
  (function(ColorPresentationRequest) {
    ColorPresentationRequest.method = "textDocument/colorPresentation";
    ColorPresentationRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    ColorPresentationRequest.type = new messages_1.ProtocolRequestType(ColorPresentationRequest.method);
  })(ColorPresentationRequest || (exports.ColorPresentationRequest = ColorPresentationRequest = {}));
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.foldingRange.js
var require_protocol_foldingRange = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.FoldingRangeRefreshRequest = exports.FoldingRangeRequest = undefined;
  var messages_1 = require_messages2();
  var FoldingRangeRequest;
  (function(FoldingRangeRequest) {
    FoldingRangeRequest.method = "textDocument/foldingRange";
    FoldingRangeRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    FoldingRangeRequest.type = new messages_1.ProtocolRequestType(FoldingRangeRequest.method);
  })(FoldingRangeRequest || (exports.FoldingRangeRequest = FoldingRangeRequest = {}));
  var FoldingRangeRefreshRequest;
  (function(FoldingRangeRefreshRequest) {
    FoldingRangeRefreshRequest.method = `workspace/foldingRange/refresh`;
    FoldingRangeRefreshRequest.messageDirection = messages_1.MessageDirection.serverToClient;
    FoldingRangeRefreshRequest.type = new messages_1.ProtocolRequestType0(FoldingRangeRefreshRequest.method);
  })(FoldingRangeRefreshRequest || (exports.FoldingRangeRefreshRequest = FoldingRangeRefreshRequest = {}));
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.declaration.js
var require_protocol_declaration = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.DeclarationRequest = undefined;
  var messages_1 = require_messages2();
  var DeclarationRequest;
  (function(DeclarationRequest) {
    DeclarationRequest.method = "textDocument/declaration";
    DeclarationRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    DeclarationRequest.type = new messages_1.ProtocolRequestType(DeclarationRequest.method);
  })(DeclarationRequest || (exports.DeclarationRequest = DeclarationRequest = {}));
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.selectionRange.js
var require_protocol_selectionRange = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.SelectionRangeRequest = undefined;
  var messages_1 = require_messages2();
  var SelectionRangeRequest;
  (function(SelectionRangeRequest) {
    SelectionRangeRequest.method = "textDocument/selectionRange";
    SelectionRangeRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    SelectionRangeRequest.type = new messages_1.ProtocolRequestType(SelectionRangeRequest.method);
  })(SelectionRangeRequest || (exports.SelectionRangeRequest = SelectionRangeRequest = {}));
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.progress.js
var require_protocol_progress = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.WorkDoneProgressCancelNotification = exports.WorkDoneProgressCreateRequest = exports.WorkDoneProgress = undefined;
  var vscode_jsonrpc_1 = require_main();
  var messages_1 = require_messages2();
  var WorkDoneProgress;
  (function(WorkDoneProgress) {
    WorkDoneProgress.type = new vscode_jsonrpc_1.ProgressType;
    function is(value) {
      return value === WorkDoneProgress.type;
    }
    WorkDoneProgress.is = is;
  })(WorkDoneProgress || (exports.WorkDoneProgress = WorkDoneProgress = {}));
  var WorkDoneProgressCreateRequest;
  (function(WorkDoneProgressCreateRequest) {
    WorkDoneProgressCreateRequest.method = "window/workDoneProgress/create";
    WorkDoneProgressCreateRequest.messageDirection = messages_1.MessageDirection.serverToClient;
    WorkDoneProgressCreateRequest.type = new messages_1.ProtocolRequestType(WorkDoneProgressCreateRequest.method);
  })(WorkDoneProgressCreateRequest || (exports.WorkDoneProgressCreateRequest = WorkDoneProgressCreateRequest = {}));
  var WorkDoneProgressCancelNotification;
  (function(WorkDoneProgressCancelNotification) {
    WorkDoneProgressCancelNotification.method = "window/workDoneProgress/cancel";
    WorkDoneProgressCancelNotification.messageDirection = messages_1.MessageDirection.clientToServer;
    WorkDoneProgressCancelNotification.type = new messages_1.ProtocolNotificationType(WorkDoneProgressCancelNotification.method);
  })(WorkDoneProgressCancelNotification || (exports.WorkDoneProgressCancelNotification = WorkDoneProgressCancelNotification = {}));
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.callHierarchy.js
var require_protocol_callHierarchy = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.CallHierarchyOutgoingCallsRequest = exports.CallHierarchyIncomingCallsRequest = exports.CallHierarchyPrepareRequest = undefined;
  var messages_1 = require_messages2();
  var CallHierarchyPrepareRequest;
  (function(CallHierarchyPrepareRequest) {
    CallHierarchyPrepareRequest.method = "textDocument/prepareCallHierarchy";
    CallHierarchyPrepareRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    CallHierarchyPrepareRequest.type = new messages_1.ProtocolRequestType(CallHierarchyPrepareRequest.method);
  })(CallHierarchyPrepareRequest || (exports.CallHierarchyPrepareRequest = CallHierarchyPrepareRequest = {}));
  var CallHierarchyIncomingCallsRequest;
  (function(CallHierarchyIncomingCallsRequest) {
    CallHierarchyIncomingCallsRequest.method = "callHierarchy/incomingCalls";
    CallHierarchyIncomingCallsRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    CallHierarchyIncomingCallsRequest.type = new messages_1.ProtocolRequestType(CallHierarchyIncomingCallsRequest.method);
  })(CallHierarchyIncomingCallsRequest || (exports.CallHierarchyIncomingCallsRequest = CallHierarchyIncomingCallsRequest = {}));
  var CallHierarchyOutgoingCallsRequest;
  (function(CallHierarchyOutgoingCallsRequest) {
    CallHierarchyOutgoingCallsRequest.method = "callHierarchy/outgoingCalls";
    CallHierarchyOutgoingCallsRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    CallHierarchyOutgoingCallsRequest.type = new messages_1.ProtocolRequestType(CallHierarchyOutgoingCallsRequest.method);
  })(CallHierarchyOutgoingCallsRequest || (exports.CallHierarchyOutgoingCallsRequest = CallHierarchyOutgoingCallsRequest = {}));
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.semanticTokens.js
var require_protocol_semanticTokens = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.SemanticTokensRefreshRequest = exports.SemanticTokensRangeRequest = exports.SemanticTokensDeltaRequest = exports.SemanticTokensRequest = exports.SemanticTokensRegistrationType = exports.TokenFormat = undefined;
  var messages_1 = require_messages2();
  var TokenFormat;
  (function(TokenFormat) {
    TokenFormat.Relative = "relative";
  })(TokenFormat || (exports.TokenFormat = TokenFormat = {}));
  var SemanticTokensRegistrationType;
  (function(SemanticTokensRegistrationType) {
    SemanticTokensRegistrationType.method = "textDocument/semanticTokens";
    SemanticTokensRegistrationType.type = new messages_1.RegistrationType(SemanticTokensRegistrationType.method);
  })(SemanticTokensRegistrationType || (exports.SemanticTokensRegistrationType = SemanticTokensRegistrationType = {}));
  var SemanticTokensRequest;
  (function(SemanticTokensRequest) {
    SemanticTokensRequest.method = "textDocument/semanticTokens/full";
    SemanticTokensRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    SemanticTokensRequest.type = new messages_1.ProtocolRequestType(SemanticTokensRequest.method);
    SemanticTokensRequest.registrationMethod = SemanticTokensRegistrationType.method;
  })(SemanticTokensRequest || (exports.SemanticTokensRequest = SemanticTokensRequest = {}));
  var SemanticTokensDeltaRequest;
  (function(SemanticTokensDeltaRequest) {
    SemanticTokensDeltaRequest.method = "textDocument/semanticTokens/full/delta";
    SemanticTokensDeltaRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    SemanticTokensDeltaRequest.type = new messages_1.ProtocolRequestType(SemanticTokensDeltaRequest.method);
    SemanticTokensDeltaRequest.registrationMethod = SemanticTokensRegistrationType.method;
  })(SemanticTokensDeltaRequest || (exports.SemanticTokensDeltaRequest = SemanticTokensDeltaRequest = {}));
  var SemanticTokensRangeRequest;
  (function(SemanticTokensRangeRequest) {
    SemanticTokensRangeRequest.method = "textDocument/semanticTokens/range";
    SemanticTokensRangeRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    SemanticTokensRangeRequest.type = new messages_1.ProtocolRequestType(SemanticTokensRangeRequest.method);
    SemanticTokensRangeRequest.registrationMethod = SemanticTokensRegistrationType.method;
  })(SemanticTokensRangeRequest || (exports.SemanticTokensRangeRequest = SemanticTokensRangeRequest = {}));
  var SemanticTokensRefreshRequest;
  (function(SemanticTokensRefreshRequest) {
    SemanticTokensRefreshRequest.method = `workspace/semanticTokens/refresh`;
    SemanticTokensRefreshRequest.messageDirection = messages_1.MessageDirection.serverToClient;
    SemanticTokensRefreshRequest.type = new messages_1.ProtocolRequestType0(SemanticTokensRefreshRequest.method);
  })(SemanticTokensRefreshRequest || (exports.SemanticTokensRefreshRequest = SemanticTokensRefreshRequest = {}));
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.showDocument.js
var require_protocol_showDocument = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.ShowDocumentRequest = undefined;
  var messages_1 = require_messages2();
  var ShowDocumentRequest;
  (function(ShowDocumentRequest) {
    ShowDocumentRequest.method = "window/showDocument";
    ShowDocumentRequest.messageDirection = messages_1.MessageDirection.serverToClient;
    ShowDocumentRequest.type = new messages_1.ProtocolRequestType(ShowDocumentRequest.method);
  })(ShowDocumentRequest || (exports.ShowDocumentRequest = ShowDocumentRequest = {}));
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.linkedEditingRange.js
var require_protocol_linkedEditingRange = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.LinkedEditingRangeRequest = undefined;
  var messages_1 = require_messages2();
  var LinkedEditingRangeRequest;
  (function(LinkedEditingRangeRequest) {
    LinkedEditingRangeRequest.method = "textDocument/linkedEditingRange";
    LinkedEditingRangeRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    LinkedEditingRangeRequest.type = new messages_1.ProtocolRequestType(LinkedEditingRangeRequest.method);
  })(LinkedEditingRangeRequest || (exports.LinkedEditingRangeRequest = LinkedEditingRangeRequest = {}));
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.fileOperations.js
var require_protocol_fileOperations = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.WillDeleteFilesRequest = exports.DidDeleteFilesNotification = exports.DidRenameFilesNotification = exports.WillRenameFilesRequest = exports.DidCreateFilesNotification = exports.WillCreateFilesRequest = exports.FileOperationPatternKind = undefined;
  var messages_1 = require_messages2();
  var FileOperationPatternKind;
  (function(FileOperationPatternKind) {
    FileOperationPatternKind.file = "file";
    FileOperationPatternKind.folder = "folder";
  })(FileOperationPatternKind || (exports.FileOperationPatternKind = FileOperationPatternKind = {}));
  var WillCreateFilesRequest;
  (function(WillCreateFilesRequest) {
    WillCreateFilesRequest.method = "workspace/willCreateFiles";
    WillCreateFilesRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    WillCreateFilesRequest.type = new messages_1.ProtocolRequestType(WillCreateFilesRequest.method);
  })(WillCreateFilesRequest || (exports.WillCreateFilesRequest = WillCreateFilesRequest = {}));
  var DidCreateFilesNotification;
  (function(DidCreateFilesNotification) {
    DidCreateFilesNotification.method = "workspace/didCreateFiles";
    DidCreateFilesNotification.messageDirection = messages_1.MessageDirection.clientToServer;
    DidCreateFilesNotification.type = new messages_1.ProtocolNotificationType(DidCreateFilesNotification.method);
  })(DidCreateFilesNotification || (exports.DidCreateFilesNotification = DidCreateFilesNotification = {}));
  var WillRenameFilesRequest;
  (function(WillRenameFilesRequest) {
    WillRenameFilesRequest.method = "workspace/willRenameFiles";
    WillRenameFilesRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    WillRenameFilesRequest.type = new messages_1.ProtocolRequestType(WillRenameFilesRequest.method);
  })(WillRenameFilesRequest || (exports.WillRenameFilesRequest = WillRenameFilesRequest = {}));
  var DidRenameFilesNotification;
  (function(DidRenameFilesNotification) {
    DidRenameFilesNotification.method = "workspace/didRenameFiles";
    DidRenameFilesNotification.messageDirection = messages_1.MessageDirection.clientToServer;
    DidRenameFilesNotification.type = new messages_1.ProtocolNotificationType(DidRenameFilesNotification.method);
  })(DidRenameFilesNotification || (exports.DidRenameFilesNotification = DidRenameFilesNotification = {}));
  var DidDeleteFilesNotification;
  (function(DidDeleteFilesNotification) {
    DidDeleteFilesNotification.method = "workspace/didDeleteFiles";
    DidDeleteFilesNotification.messageDirection = messages_1.MessageDirection.clientToServer;
    DidDeleteFilesNotification.type = new messages_1.ProtocolNotificationType(DidDeleteFilesNotification.method);
  })(DidDeleteFilesNotification || (exports.DidDeleteFilesNotification = DidDeleteFilesNotification = {}));
  var WillDeleteFilesRequest;
  (function(WillDeleteFilesRequest) {
    WillDeleteFilesRequest.method = "workspace/willDeleteFiles";
    WillDeleteFilesRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    WillDeleteFilesRequest.type = new messages_1.ProtocolRequestType(WillDeleteFilesRequest.method);
  })(WillDeleteFilesRequest || (exports.WillDeleteFilesRequest = WillDeleteFilesRequest = {}));
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.moniker.js
var require_protocol_moniker = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.MonikerRequest = exports.MonikerKind = exports.UniquenessLevel = undefined;
  var messages_1 = require_messages2();
  var UniquenessLevel;
  (function(UniquenessLevel) {
    UniquenessLevel.document = "document";
    UniquenessLevel.project = "project";
    UniquenessLevel.group = "group";
    UniquenessLevel.scheme = "scheme";
    UniquenessLevel.global = "global";
  })(UniquenessLevel || (exports.UniquenessLevel = UniquenessLevel = {}));
  var MonikerKind;
  (function(MonikerKind) {
    MonikerKind.$import = "import";
    MonikerKind.$export = "export";
    MonikerKind.local = "local";
  })(MonikerKind || (exports.MonikerKind = MonikerKind = {}));
  var MonikerRequest;
  (function(MonikerRequest) {
    MonikerRequest.method = "textDocument/moniker";
    MonikerRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    MonikerRequest.type = new messages_1.ProtocolRequestType(MonikerRequest.method);
  })(MonikerRequest || (exports.MonikerRequest = MonikerRequest = {}));
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.typeHierarchy.js
var require_protocol_typeHierarchy = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.TypeHierarchySubtypesRequest = exports.TypeHierarchySupertypesRequest = exports.TypeHierarchyPrepareRequest = undefined;
  var messages_1 = require_messages2();
  var TypeHierarchyPrepareRequest;
  (function(TypeHierarchyPrepareRequest) {
    TypeHierarchyPrepareRequest.method = "textDocument/prepareTypeHierarchy";
    TypeHierarchyPrepareRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    TypeHierarchyPrepareRequest.type = new messages_1.ProtocolRequestType(TypeHierarchyPrepareRequest.method);
  })(TypeHierarchyPrepareRequest || (exports.TypeHierarchyPrepareRequest = TypeHierarchyPrepareRequest = {}));
  var TypeHierarchySupertypesRequest;
  (function(TypeHierarchySupertypesRequest) {
    TypeHierarchySupertypesRequest.method = "typeHierarchy/supertypes";
    TypeHierarchySupertypesRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    TypeHierarchySupertypesRequest.type = new messages_1.ProtocolRequestType(TypeHierarchySupertypesRequest.method);
  })(TypeHierarchySupertypesRequest || (exports.TypeHierarchySupertypesRequest = TypeHierarchySupertypesRequest = {}));
  var TypeHierarchySubtypesRequest;
  (function(TypeHierarchySubtypesRequest) {
    TypeHierarchySubtypesRequest.method = "typeHierarchy/subtypes";
    TypeHierarchySubtypesRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    TypeHierarchySubtypesRequest.type = new messages_1.ProtocolRequestType(TypeHierarchySubtypesRequest.method);
  })(TypeHierarchySubtypesRequest || (exports.TypeHierarchySubtypesRequest = TypeHierarchySubtypesRequest = {}));
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.inlineValue.js
var require_protocol_inlineValue = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.InlineValueRefreshRequest = exports.InlineValueRequest = undefined;
  var messages_1 = require_messages2();
  var InlineValueRequest;
  (function(InlineValueRequest) {
    InlineValueRequest.method = "textDocument/inlineValue";
    InlineValueRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    InlineValueRequest.type = new messages_1.ProtocolRequestType(InlineValueRequest.method);
  })(InlineValueRequest || (exports.InlineValueRequest = InlineValueRequest = {}));
  var InlineValueRefreshRequest;
  (function(InlineValueRefreshRequest) {
    InlineValueRefreshRequest.method = `workspace/inlineValue/refresh`;
    InlineValueRefreshRequest.messageDirection = messages_1.MessageDirection.serverToClient;
    InlineValueRefreshRequest.type = new messages_1.ProtocolRequestType0(InlineValueRefreshRequest.method);
  })(InlineValueRefreshRequest || (exports.InlineValueRefreshRequest = InlineValueRefreshRequest = {}));
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.inlayHint.js
var require_protocol_inlayHint = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.InlayHintRefreshRequest = exports.InlayHintResolveRequest = exports.InlayHintRequest = undefined;
  var messages_1 = require_messages2();
  var InlayHintRequest;
  (function(InlayHintRequest) {
    InlayHintRequest.method = "textDocument/inlayHint";
    InlayHintRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    InlayHintRequest.type = new messages_1.ProtocolRequestType(InlayHintRequest.method);
  })(InlayHintRequest || (exports.InlayHintRequest = InlayHintRequest = {}));
  var InlayHintResolveRequest;
  (function(InlayHintResolveRequest) {
    InlayHintResolveRequest.method = "inlayHint/resolve";
    InlayHintResolveRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    InlayHintResolveRequest.type = new messages_1.ProtocolRequestType(InlayHintResolveRequest.method);
  })(InlayHintResolveRequest || (exports.InlayHintResolveRequest = InlayHintResolveRequest = {}));
  var InlayHintRefreshRequest;
  (function(InlayHintRefreshRequest) {
    InlayHintRefreshRequest.method = `workspace/inlayHint/refresh`;
    InlayHintRefreshRequest.messageDirection = messages_1.MessageDirection.serverToClient;
    InlayHintRefreshRequest.type = new messages_1.ProtocolRequestType0(InlayHintRefreshRequest.method);
  })(InlayHintRefreshRequest || (exports.InlayHintRefreshRequest = InlayHintRefreshRequest = {}));
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.diagnostic.js
var require_protocol_diagnostic = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.DiagnosticRefreshRequest = exports.WorkspaceDiagnosticRequest = exports.DocumentDiagnosticRequest = exports.DocumentDiagnosticReportKind = exports.DiagnosticServerCancellationData = undefined;
  var vscode_jsonrpc_1 = require_main();
  var Is = require_is3();
  var messages_1 = require_messages2();
  var DiagnosticServerCancellationData;
  (function(DiagnosticServerCancellationData) {
    function is(value) {
      const candidate = value;
      return candidate && Is.boolean(candidate.retriggerRequest);
    }
    DiagnosticServerCancellationData.is = is;
  })(DiagnosticServerCancellationData || (exports.DiagnosticServerCancellationData = DiagnosticServerCancellationData = {}));
  var DocumentDiagnosticReportKind;
  (function(DocumentDiagnosticReportKind) {
    DocumentDiagnosticReportKind.Full = "full";
    DocumentDiagnosticReportKind.Unchanged = "unchanged";
  })(DocumentDiagnosticReportKind || (exports.DocumentDiagnosticReportKind = DocumentDiagnosticReportKind = {}));
  var DocumentDiagnosticRequest;
  (function(DocumentDiagnosticRequest) {
    DocumentDiagnosticRequest.method = "textDocument/diagnostic";
    DocumentDiagnosticRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    DocumentDiagnosticRequest.type = new messages_1.ProtocolRequestType(DocumentDiagnosticRequest.method);
    DocumentDiagnosticRequest.partialResult = new vscode_jsonrpc_1.ProgressType;
  })(DocumentDiagnosticRequest || (exports.DocumentDiagnosticRequest = DocumentDiagnosticRequest = {}));
  var WorkspaceDiagnosticRequest;
  (function(WorkspaceDiagnosticRequest) {
    WorkspaceDiagnosticRequest.method = "workspace/diagnostic";
    WorkspaceDiagnosticRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    WorkspaceDiagnosticRequest.type = new messages_1.ProtocolRequestType(WorkspaceDiagnosticRequest.method);
    WorkspaceDiagnosticRequest.partialResult = new vscode_jsonrpc_1.ProgressType;
  })(WorkspaceDiagnosticRequest || (exports.WorkspaceDiagnosticRequest = WorkspaceDiagnosticRequest = {}));
  var DiagnosticRefreshRequest;
  (function(DiagnosticRefreshRequest) {
    DiagnosticRefreshRequest.method = `workspace/diagnostic/refresh`;
    DiagnosticRefreshRequest.messageDirection = messages_1.MessageDirection.serverToClient;
    DiagnosticRefreshRequest.type = new messages_1.ProtocolRequestType0(DiagnosticRefreshRequest.method);
  })(DiagnosticRefreshRequest || (exports.DiagnosticRefreshRequest = DiagnosticRefreshRequest = {}));
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.notebook.js
var require_protocol_notebook = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.DidCloseNotebookDocumentNotification = exports.DidSaveNotebookDocumentNotification = exports.DidChangeNotebookDocumentNotification = exports.NotebookCellArrayChange = exports.DidOpenNotebookDocumentNotification = exports.NotebookDocumentSyncRegistrationType = exports.NotebookDocument = exports.NotebookCell = exports.ExecutionSummary = exports.NotebookCellKind = undefined;
  var vscode_languageserver_types_1 = require_main2();
  var Is = require_is3();
  var messages_1 = require_messages2();
  var NotebookCellKind;
  (function(NotebookCellKind) {
    NotebookCellKind.Markup = 1;
    NotebookCellKind.Code = 2;
    function is(value) {
      return value === 1 || value === 2;
    }
    NotebookCellKind.is = is;
  })(NotebookCellKind || (exports.NotebookCellKind = NotebookCellKind = {}));
  var ExecutionSummary;
  (function(ExecutionSummary) {
    function create(executionOrder, success) {
      const result = { executionOrder };
      if (success === true || success === false) {
        result.success = success;
      }
      return result;
    }
    ExecutionSummary.create = create;
    function is(value) {
      const candidate = value;
      return Is.objectLiteral(candidate) && vscode_languageserver_types_1.uinteger.is(candidate.executionOrder) && (candidate.success === undefined || Is.boolean(candidate.success));
    }
    ExecutionSummary.is = is;
    function equals(one, other) {
      if (one === other) {
        return true;
      }
      if (one === null || one === undefined || other === null || other === undefined) {
        return false;
      }
      return one.executionOrder === other.executionOrder && one.success === other.success;
    }
    ExecutionSummary.equals = equals;
  })(ExecutionSummary || (exports.ExecutionSummary = ExecutionSummary = {}));
  var NotebookCell;
  (function(NotebookCell) {
    function create(kind, document) {
      return { kind, document };
    }
    NotebookCell.create = create;
    function is(value) {
      const candidate = value;
      return Is.objectLiteral(candidate) && NotebookCellKind.is(candidate.kind) && vscode_languageserver_types_1.DocumentUri.is(candidate.document) && (candidate.metadata === undefined || Is.objectLiteral(candidate.metadata));
    }
    NotebookCell.is = is;
    function diff(one, two) {
      const result = new Set;
      if (one.document !== two.document) {
        result.add("document");
      }
      if (one.kind !== two.kind) {
        result.add("kind");
      }
      if (one.executionSummary !== two.executionSummary) {
        result.add("executionSummary");
      }
      if ((one.metadata !== undefined || two.metadata !== undefined) && !equalsMetadata(one.metadata, two.metadata)) {
        result.add("metadata");
      }
      if ((one.executionSummary !== undefined || two.executionSummary !== undefined) && !ExecutionSummary.equals(one.executionSummary, two.executionSummary)) {
        result.add("executionSummary");
      }
      return result;
    }
    NotebookCell.diff = diff;
    function equalsMetadata(one, other) {
      if (one === other) {
        return true;
      }
      if (one === null || one === undefined || other === null || other === undefined) {
        return false;
      }
      if (typeof one !== typeof other) {
        return false;
      }
      if (typeof one !== "object") {
        return false;
      }
      const oneArray = Array.isArray(one);
      const otherArray = Array.isArray(other);
      if (oneArray !== otherArray) {
        return false;
      }
      if (oneArray && otherArray) {
        if (one.length !== other.length) {
          return false;
        }
        for (let i = 0;i < one.length; i++) {
          if (!equalsMetadata(one[i], other[i])) {
            return false;
          }
        }
      }
      if (Is.objectLiteral(one) && Is.objectLiteral(other)) {
        const oneKeys = Object.keys(one);
        const otherKeys = Object.keys(other);
        if (oneKeys.length !== otherKeys.length) {
          return false;
        }
        oneKeys.sort();
        otherKeys.sort();
        if (!equalsMetadata(oneKeys, otherKeys)) {
          return false;
        }
        for (let i = 0;i < oneKeys.length; i++) {
          const prop = oneKeys[i];
          if (!equalsMetadata(one[prop], other[prop])) {
            return false;
          }
        }
      }
      return true;
    }
  })(NotebookCell || (exports.NotebookCell = NotebookCell = {}));
  var NotebookDocument;
  (function(NotebookDocument) {
    function create(uri, notebookType, version, cells) {
      return { uri, notebookType, version, cells };
    }
    NotebookDocument.create = create;
    function is(value) {
      const candidate = value;
      return Is.objectLiteral(candidate) && Is.string(candidate.uri) && vscode_languageserver_types_1.integer.is(candidate.version) && Is.typedArray(candidate.cells, NotebookCell.is);
    }
    NotebookDocument.is = is;
  })(NotebookDocument || (exports.NotebookDocument = NotebookDocument = {}));
  var NotebookDocumentSyncRegistrationType;
  (function(NotebookDocumentSyncRegistrationType) {
    NotebookDocumentSyncRegistrationType.method = "notebookDocument/sync";
    NotebookDocumentSyncRegistrationType.messageDirection = messages_1.MessageDirection.clientToServer;
    NotebookDocumentSyncRegistrationType.type = new messages_1.RegistrationType(NotebookDocumentSyncRegistrationType.method);
  })(NotebookDocumentSyncRegistrationType || (exports.NotebookDocumentSyncRegistrationType = NotebookDocumentSyncRegistrationType = {}));
  var DidOpenNotebookDocumentNotification;
  (function(DidOpenNotebookDocumentNotification) {
    DidOpenNotebookDocumentNotification.method = "notebookDocument/didOpen";
    DidOpenNotebookDocumentNotification.messageDirection = messages_1.MessageDirection.clientToServer;
    DidOpenNotebookDocumentNotification.type = new messages_1.ProtocolNotificationType(DidOpenNotebookDocumentNotification.method);
    DidOpenNotebookDocumentNotification.registrationMethod = NotebookDocumentSyncRegistrationType.method;
  })(DidOpenNotebookDocumentNotification || (exports.DidOpenNotebookDocumentNotification = DidOpenNotebookDocumentNotification = {}));
  var NotebookCellArrayChange;
  (function(NotebookCellArrayChange) {
    function is(value) {
      const candidate = value;
      return Is.objectLiteral(candidate) && vscode_languageserver_types_1.uinteger.is(candidate.start) && vscode_languageserver_types_1.uinteger.is(candidate.deleteCount) && (candidate.cells === undefined || Is.typedArray(candidate.cells, NotebookCell.is));
    }
    NotebookCellArrayChange.is = is;
    function create(start, deleteCount, cells) {
      const result = { start, deleteCount };
      if (cells !== undefined) {
        result.cells = cells;
      }
      return result;
    }
    NotebookCellArrayChange.create = create;
  })(NotebookCellArrayChange || (exports.NotebookCellArrayChange = NotebookCellArrayChange = {}));
  var DidChangeNotebookDocumentNotification;
  (function(DidChangeNotebookDocumentNotification) {
    DidChangeNotebookDocumentNotification.method = "notebookDocument/didChange";
    DidChangeNotebookDocumentNotification.messageDirection = messages_1.MessageDirection.clientToServer;
    DidChangeNotebookDocumentNotification.type = new messages_1.ProtocolNotificationType(DidChangeNotebookDocumentNotification.method);
    DidChangeNotebookDocumentNotification.registrationMethod = NotebookDocumentSyncRegistrationType.method;
  })(DidChangeNotebookDocumentNotification || (exports.DidChangeNotebookDocumentNotification = DidChangeNotebookDocumentNotification = {}));
  var DidSaveNotebookDocumentNotification;
  (function(DidSaveNotebookDocumentNotification) {
    DidSaveNotebookDocumentNotification.method = "notebookDocument/didSave";
    DidSaveNotebookDocumentNotification.messageDirection = messages_1.MessageDirection.clientToServer;
    DidSaveNotebookDocumentNotification.type = new messages_1.ProtocolNotificationType(DidSaveNotebookDocumentNotification.method);
    DidSaveNotebookDocumentNotification.registrationMethod = NotebookDocumentSyncRegistrationType.method;
  })(DidSaveNotebookDocumentNotification || (exports.DidSaveNotebookDocumentNotification = DidSaveNotebookDocumentNotification = {}));
  var DidCloseNotebookDocumentNotification;
  (function(DidCloseNotebookDocumentNotification) {
    DidCloseNotebookDocumentNotification.method = "notebookDocument/didClose";
    DidCloseNotebookDocumentNotification.messageDirection = messages_1.MessageDirection.clientToServer;
    DidCloseNotebookDocumentNotification.type = new messages_1.ProtocolNotificationType(DidCloseNotebookDocumentNotification.method);
    DidCloseNotebookDocumentNotification.registrationMethod = NotebookDocumentSyncRegistrationType.method;
  })(DidCloseNotebookDocumentNotification || (exports.DidCloseNotebookDocumentNotification = DidCloseNotebookDocumentNotification = {}));
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.inlineCompletion.js
var require_protocol_inlineCompletion = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.InlineCompletionRequest = undefined;
  var messages_1 = require_messages2();
  var InlineCompletionRequest;
  (function(InlineCompletionRequest) {
    InlineCompletionRequest.method = "textDocument/inlineCompletion";
    InlineCompletionRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    InlineCompletionRequest.type = new messages_1.ProtocolRequestType(InlineCompletionRequest.method);
  })(InlineCompletionRequest || (exports.InlineCompletionRequest = InlineCompletionRequest = {}));
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.js
var require_protocol = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.WorkspaceSymbolRequest = exports.CodeActionResolveRequest = exports.CodeActionRequest = exports.DocumentSymbolRequest = exports.DocumentHighlightRequest = exports.ReferencesRequest = exports.DefinitionRequest = exports.SignatureHelpRequest = exports.SignatureHelpTriggerKind = exports.HoverRequest = exports.CompletionResolveRequest = exports.CompletionRequest = exports.CompletionTriggerKind = exports.PublishDiagnosticsNotification = exports.WatchKind = exports.RelativePattern = exports.FileChangeType = exports.DidChangeWatchedFilesNotification = exports.WillSaveTextDocumentWaitUntilRequest = exports.WillSaveTextDocumentNotification = exports.TextDocumentSaveReason = exports.DidSaveTextDocumentNotification = exports.DidCloseTextDocumentNotification = exports.DidChangeTextDocumentNotification = exports.TextDocumentContentChangeEvent = exports.DidOpenTextDocumentNotification = exports.TextDocumentSyncKind = exports.TelemetryEventNotification = exports.LogMessageNotification = exports.ShowMessageRequest = exports.ShowMessageNotification = exports.MessageType = exports.DidChangeConfigurationNotification = exports.ExitNotification = exports.ShutdownRequest = exports.InitializedNotification = exports.InitializeErrorCodes = exports.InitializeRequest = exports.WorkDoneProgressOptions = exports.TextDocumentRegistrationOptions = exports.StaticRegistrationOptions = exports.PositionEncodingKind = exports.FailureHandlingKind = exports.ResourceOperationKind = exports.UnregistrationRequest = exports.RegistrationRequest = exports.DocumentSelector = exports.NotebookCellTextDocumentFilter = exports.NotebookDocumentFilter = exports.TextDocumentFilter = undefined;
  exports.MonikerRequest = exports.MonikerKind = exports.UniquenessLevel = exports.WillDeleteFilesRequest = exports.DidDeleteFilesNotification = exports.WillRenameFilesRequest = exports.DidRenameFilesNotification = exports.WillCreateFilesRequest = exports.DidCreateFilesNotification = exports.FileOperationPatternKind = exports.LinkedEditingRangeRequest = exports.ShowDocumentRequest = exports.SemanticTokensRegistrationType = exports.SemanticTokensRefreshRequest = exports.SemanticTokensRangeRequest = exports.SemanticTokensDeltaRequest = exports.SemanticTokensRequest = exports.TokenFormat = exports.CallHierarchyPrepareRequest = exports.CallHierarchyOutgoingCallsRequest = exports.CallHierarchyIncomingCallsRequest = exports.WorkDoneProgressCancelNotification = exports.WorkDoneProgressCreateRequest = exports.WorkDoneProgress = exports.SelectionRangeRequest = exports.DeclarationRequest = exports.FoldingRangeRefreshRequest = exports.FoldingRangeRequest = exports.ColorPresentationRequest = exports.DocumentColorRequest = exports.ConfigurationRequest = exports.DidChangeWorkspaceFoldersNotification = exports.WorkspaceFoldersRequest = exports.TypeDefinitionRequest = exports.ImplementationRequest = exports.ApplyWorkspaceEditRequest = exports.ExecuteCommandRequest = exports.PrepareRenameRequest = exports.RenameRequest = exports.PrepareSupportDefaultBehavior = exports.DocumentOnTypeFormattingRequest = exports.DocumentRangesFormattingRequest = exports.DocumentRangeFormattingRequest = exports.DocumentFormattingRequest = exports.DocumentLinkResolveRequest = exports.DocumentLinkRequest = exports.CodeLensRefreshRequest = exports.CodeLensResolveRequest = exports.CodeLensRequest = exports.WorkspaceSymbolResolveRequest = undefined;
  exports.InlineCompletionRequest = exports.DidCloseNotebookDocumentNotification = exports.DidSaveNotebookDocumentNotification = exports.DidChangeNotebookDocumentNotification = exports.NotebookCellArrayChange = exports.DidOpenNotebookDocumentNotification = exports.NotebookDocumentSyncRegistrationType = exports.NotebookDocument = exports.NotebookCell = exports.ExecutionSummary = exports.NotebookCellKind = exports.DiagnosticRefreshRequest = exports.WorkspaceDiagnosticRequest = exports.DocumentDiagnosticRequest = exports.DocumentDiagnosticReportKind = exports.DiagnosticServerCancellationData = exports.InlayHintRefreshRequest = exports.InlayHintResolveRequest = exports.InlayHintRequest = exports.InlineValueRefreshRequest = exports.InlineValueRequest = exports.TypeHierarchySupertypesRequest = exports.TypeHierarchySubtypesRequest = exports.TypeHierarchyPrepareRequest = undefined;
  var messages_1 = require_messages2();
  var vscode_languageserver_types_1 = require_main2();
  var Is = require_is3();
  var protocol_implementation_1 = require_protocol_implementation();
  Object.defineProperty(exports, "ImplementationRequest", { enumerable: true, get: function() {
    return protocol_implementation_1.ImplementationRequest;
  } });
  var protocol_typeDefinition_1 = require_protocol_typeDefinition();
  Object.defineProperty(exports, "TypeDefinitionRequest", { enumerable: true, get: function() {
    return protocol_typeDefinition_1.TypeDefinitionRequest;
  } });
  var protocol_workspaceFolder_1 = require_protocol_workspaceFolder();
  Object.defineProperty(exports, "WorkspaceFoldersRequest", { enumerable: true, get: function() {
    return protocol_workspaceFolder_1.WorkspaceFoldersRequest;
  } });
  Object.defineProperty(exports, "DidChangeWorkspaceFoldersNotification", { enumerable: true, get: function() {
    return protocol_workspaceFolder_1.DidChangeWorkspaceFoldersNotification;
  } });
  var protocol_configuration_1 = require_protocol_configuration();
  Object.defineProperty(exports, "ConfigurationRequest", { enumerable: true, get: function() {
    return protocol_configuration_1.ConfigurationRequest;
  } });
  var protocol_colorProvider_1 = require_protocol_colorProvider();
  Object.defineProperty(exports, "DocumentColorRequest", { enumerable: true, get: function() {
    return protocol_colorProvider_1.DocumentColorRequest;
  } });
  Object.defineProperty(exports, "ColorPresentationRequest", { enumerable: true, get: function() {
    return protocol_colorProvider_1.ColorPresentationRequest;
  } });
  var protocol_foldingRange_1 = require_protocol_foldingRange();
  Object.defineProperty(exports, "FoldingRangeRequest", { enumerable: true, get: function() {
    return protocol_foldingRange_1.FoldingRangeRequest;
  } });
  Object.defineProperty(exports, "FoldingRangeRefreshRequest", { enumerable: true, get: function() {
    return protocol_foldingRange_1.FoldingRangeRefreshRequest;
  } });
  var protocol_declaration_1 = require_protocol_declaration();
  Object.defineProperty(exports, "DeclarationRequest", { enumerable: true, get: function() {
    return protocol_declaration_1.DeclarationRequest;
  } });
  var protocol_selectionRange_1 = require_protocol_selectionRange();
  Object.defineProperty(exports, "SelectionRangeRequest", { enumerable: true, get: function() {
    return protocol_selectionRange_1.SelectionRangeRequest;
  } });
  var protocol_progress_1 = require_protocol_progress();
  Object.defineProperty(exports, "WorkDoneProgress", { enumerable: true, get: function() {
    return protocol_progress_1.WorkDoneProgress;
  } });
  Object.defineProperty(exports, "WorkDoneProgressCreateRequest", { enumerable: true, get: function() {
    return protocol_progress_1.WorkDoneProgressCreateRequest;
  } });
  Object.defineProperty(exports, "WorkDoneProgressCancelNotification", { enumerable: true, get: function() {
    return protocol_progress_1.WorkDoneProgressCancelNotification;
  } });
  var protocol_callHierarchy_1 = require_protocol_callHierarchy();
  Object.defineProperty(exports, "CallHierarchyIncomingCallsRequest", { enumerable: true, get: function() {
    return protocol_callHierarchy_1.CallHierarchyIncomingCallsRequest;
  } });
  Object.defineProperty(exports, "CallHierarchyOutgoingCallsRequest", { enumerable: true, get: function() {
    return protocol_callHierarchy_1.CallHierarchyOutgoingCallsRequest;
  } });
  Object.defineProperty(exports, "CallHierarchyPrepareRequest", { enumerable: true, get: function() {
    return protocol_callHierarchy_1.CallHierarchyPrepareRequest;
  } });
  var protocol_semanticTokens_1 = require_protocol_semanticTokens();
  Object.defineProperty(exports, "TokenFormat", { enumerable: true, get: function() {
    return protocol_semanticTokens_1.TokenFormat;
  } });
  Object.defineProperty(exports, "SemanticTokensRequest", { enumerable: true, get: function() {
    return protocol_semanticTokens_1.SemanticTokensRequest;
  } });
  Object.defineProperty(exports, "SemanticTokensDeltaRequest", { enumerable: true, get: function() {
    return protocol_semanticTokens_1.SemanticTokensDeltaRequest;
  } });
  Object.defineProperty(exports, "SemanticTokensRangeRequest", { enumerable: true, get: function() {
    return protocol_semanticTokens_1.SemanticTokensRangeRequest;
  } });
  Object.defineProperty(exports, "SemanticTokensRefreshRequest", { enumerable: true, get: function() {
    return protocol_semanticTokens_1.SemanticTokensRefreshRequest;
  } });
  Object.defineProperty(exports, "SemanticTokensRegistrationType", { enumerable: true, get: function() {
    return protocol_semanticTokens_1.SemanticTokensRegistrationType;
  } });
  var protocol_showDocument_1 = require_protocol_showDocument();
  Object.defineProperty(exports, "ShowDocumentRequest", { enumerable: true, get: function() {
    return protocol_showDocument_1.ShowDocumentRequest;
  } });
  var protocol_linkedEditingRange_1 = require_protocol_linkedEditingRange();
  Object.defineProperty(exports, "LinkedEditingRangeRequest", { enumerable: true, get: function() {
    return protocol_linkedEditingRange_1.LinkedEditingRangeRequest;
  } });
  var protocol_fileOperations_1 = require_protocol_fileOperations();
  Object.defineProperty(exports, "FileOperationPatternKind", { enumerable: true, get: function() {
    return protocol_fileOperations_1.FileOperationPatternKind;
  } });
  Object.defineProperty(exports, "DidCreateFilesNotification", { enumerable: true, get: function() {
    return protocol_fileOperations_1.DidCreateFilesNotification;
  } });
  Object.defineProperty(exports, "WillCreateFilesRequest", { enumerable: true, get: function() {
    return protocol_fileOperations_1.WillCreateFilesRequest;
  } });
  Object.defineProperty(exports, "DidRenameFilesNotification", { enumerable: true, get: function() {
    return protocol_fileOperations_1.DidRenameFilesNotification;
  } });
  Object.defineProperty(exports, "WillRenameFilesRequest", { enumerable: true, get: function() {
    return protocol_fileOperations_1.WillRenameFilesRequest;
  } });
  Object.defineProperty(exports, "DidDeleteFilesNotification", { enumerable: true, get: function() {
    return protocol_fileOperations_1.DidDeleteFilesNotification;
  } });
  Object.defineProperty(exports, "WillDeleteFilesRequest", { enumerable: true, get: function() {
    return protocol_fileOperations_1.WillDeleteFilesRequest;
  } });
  var protocol_moniker_1 = require_protocol_moniker();
  Object.defineProperty(exports, "UniquenessLevel", { enumerable: true, get: function() {
    return protocol_moniker_1.UniquenessLevel;
  } });
  Object.defineProperty(exports, "MonikerKind", { enumerable: true, get: function() {
    return protocol_moniker_1.MonikerKind;
  } });
  Object.defineProperty(exports, "MonikerRequest", { enumerable: true, get: function() {
    return protocol_moniker_1.MonikerRequest;
  } });
  var protocol_typeHierarchy_1 = require_protocol_typeHierarchy();
  Object.defineProperty(exports, "TypeHierarchyPrepareRequest", { enumerable: true, get: function() {
    return protocol_typeHierarchy_1.TypeHierarchyPrepareRequest;
  } });
  Object.defineProperty(exports, "TypeHierarchySubtypesRequest", { enumerable: true, get: function() {
    return protocol_typeHierarchy_1.TypeHierarchySubtypesRequest;
  } });
  Object.defineProperty(exports, "TypeHierarchySupertypesRequest", { enumerable: true, get: function() {
    return protocol_typeHierarchy_1.TypeHierarchySupertypesRequest;
  } });
  var protocol_inlineValue_1 = require_protocol_inlineValue();
  Object.defineProperty(exports, "InlineValueRequest", { enumerable: true, get: function() {
    return protocol_inlineValue_1.InlineValueRequest;
  } });
  Object.defineProperty(exports, "InlineValueRefreshRequest", { enumerable: true, get: function() {
    return protocol_inlineValue_1.InlineValueRefreshRequest;
  } });
  var protocol_inlayHint_1 = require_protocol_inlayHint();
  Object.defineProperty(exports, "InlayHintRequest", { enumerable: true, get: function() {
    return protocol_inlayHint_1.InlayHintRequest;
  } });
  Object.defineProperty(exports, "InlayHintResolveRequest", { enumerable: true, get: function() {
    return protocol_inlayHint_1.InlayHintResolveRequest;
  } });
  Object.defineProperty(exports, "InlayHintRefreshRequest", { enumerable: true, get: function() {
    return protocol_inlayHint_1.InlayHintRefreshRequest;
  } });
  var protocol_diagnostic_1 = require_protocol_diagnostic();
  Object.defineProperty(exports, "DiagnosticServerCancellationData", { enumerable: true, get: function() {
    return protocol_diagnostic_1.DiagnosticServerCancellationData;
  } });
  Object.defineProperty(exports, "DocumentDiagnosticReportKind", { enumerable: true, get: function() {
    return protocol_diagnostic_1.DocumentDiagnosticReportKind;
  } });
  Object.defineProperty(exports, "DocumentDiagnosticRequest", { enumerable: true, get: function() {
    return protocol_diagnostic_1.DocumentDiagnosticRequest;
  } });
  Object.defineProperty(exports, "WorkspaceDiagnosticRequest", { enumerable: true, get: function() {
    return protocol_diagnostic_1.WorkspaceDiagnosticRequest;
  } });
  Object.defineProperty(exports, "DiagnosticRefreshRequest", { enumerable: true, get: function() {
    return protocol_diagnostic_1.DiagnosticRefreshRequest;
  } });
  var protocol_notebook_1 = require_protocol_notebook();
  Object.defineProperty(exports, "NotebookCellKind", { enumerable: true, get: function() {
    return protocol_notebook_1.NotebookCellKind;
  } });
  Object.defineProperty(exports, "ExecutionSummary", { enumerable: true, get: function() {
    return protocol_notebook_1.ExecutionSummary;
  } });
  Object.defineProperty(exports, "NotebookCell", { enumerable: true, get: function() {
    return protocol_notebook_1.NotebookCell;
  } });
  Object.defineProperty(exports, "NotebookDocument", { enumerable: true, get: function() {
    return protocol_notebook_1.NotebookDocument;
  } });
  Object.defineProperty(exports, "NotebookDocumentSyncRegistrationType", { enumerable: true, get: function() {
    return protocol_notebook_1.NotebookDocumentSyncRegistrationType;
  } });
  Object.defineProperty(exports, "DidOpenNotebookDocumentNotification", { enumerable: true, get: function() {
    return protocol_notebook_1.DidOpenNotebookDocumentNotification;
  } });
  Object.defineProperty(exports, "NotebookCellArrayChange", { enumerable: true, get: function() {
    return protocol_notebook_1.NotebookCellArrayChange;
  } });
  Object.defineProperty(exports, "DidChangeNotebookDocumentNotification", { enumerable: true, get: function() {
    return protocol_notebook_1.DidChangeNotebookDocumentNotification;
  } });
  Object.defineProperty(exports, "DidSaveNotebookDocumentNotification", { enumerable: true, get: function() {
    return protocol_notebook_1.DidSaveNotebookDocumentNotification;
  } });
  Object.defineProperty(exports, "DidCloseNotebookDocumentNotification", { enumerable: true, get: function() {
    return protocol_notebook_1.DidCloseNotebookDocumentNotification;
  } });
  var protocol_inlineCompletion_1 = require_protocol_inlineCompletion();
  Object.defineProperty(exports, "InlineCompletionRequest", { enumerable: true, get: function() {
    return protocol_inlineCompletion_1.InlineCompletionRequest;
  } });
  var TextDocumentFilter;
  (function(TextDocumentFilter) {
    function is(value) {
      const candidate = value;
      return Is.string(candidate) || (Is.string(candidate.language) || Is.string(candidate.scheme) || Is.string(candidate.pattern));
    }
    TextDocumentFilter.is = is;
  })(TextDocumentFilter || (exports.TextDocumentFilter = TextDocumentFilter = {}));
  var NotebookDocumentFilter;
  (function(NotebookDocumentFilter) {
    function is(value) {
      const candidate = value;
      return Is.objectLiteral(candidate) && (Is.string(candidate.notebookType) || Is.string(candidate.scheme) || Is.string(candidate.pattern));
    }
    NotebookDocumentFilter.is = is;
  })(NotebookDocumentFilter || (exports.NotebookDocumentFilter = NotebookDocumentFilter = {}));
  var NotebookCellTextDocumentFilter;
  (function(NotebookCellTextDocumentFilter) {
    function is(value) {
      const candidate = value;
      return Is.objectLiteral(candidate) && (Is.string(candidate.notebook) || NotebookDocumentFilter.is(candidate.notebook)) && (candidate.language === undefined || Is.string(candidate.language));
    }
    NotebookCellTextDocumentFilter.is = is;
  })(NotebookCellTextDocumentFilter || (exports.NotebookCellTextDocumentFilter = NotebookCellTextDocumentFilter = {}));
  var DocumentSelector;
  (function(DocumentSelector) {
    function is(value) {
      if (!Array.isArray(value)) {
        return false;
      }
      for (let elem of value) {
        if (!Is.string(elem) && !TextDocumentFilter.is(elem) && !NotebookCellTextDocumentFilter.is(elem)) {
          return false;
        }
      }
      return true;
    }
    DocumentSelector.is = is;
  })(DocumentSelector || (exports.DocumentSelector = DocumentSelector = {}));
  var RegistrationRequest;
  (function(RegistrationRequest) {
    RegistrationRequest.method = "client/registerCapability";
    RegistrationRequest.messageDirection = messages_1.MessageDirection.serverToClient;
    RegistrationRequest.type = new messages_1.ProtocolRequestType(RegistrationRequest.method);
  })(RegistrationRequest || (exports.RegistrationRequest = RegistrationRequest = {}));
  var UnregistrationRequest;
  (function(UnregistrationRequest) {
    UnregistrationRequest.method = "client/unregisterCapability";
    UnregistrationRequest.messageDirection = messages_1.MessageDirection.serverToClient;
    UnregistrationRequest.type = new messages_1.ProtocolRequestType(UnregistrationRequest.method);
  })(UnregistrationRequest || (exports.UnregistrationRequest = UnregistrationRequest = {}));
  var ResourceOperationKind;
  (function(ResourceOperationKind) {
    ResourceOperationKind.Create = "create";
    ResourceOperationKind.Rename = "rename";
    ResourceOperationKind.Delete = "delete";
  })(ResourceOperationKind || (exports.ResourceOperationKind = ResourceOperationKind = {}));
  var FailureHandlingKind;
  (function(FailureHandlingKind) {
    FailureHandlingKind.Abort = "abort";
    FailureHandlingKind.Transactional = "transactional";
    FailureHandlingKind.TextOnlyTransactional = "textOnlyTransactional";
    FailureHandlingKind.Undo = "undo";
  })(FailureHandlingKind || (exports.FailureHandlingKind = FailureHandlingKind = {}));
  var PositionEncodingKind;
  (function(PositionEncodingKind) {
    PositionEncodingKind.UTF8 = "utf-8";
    PositionEncodingKind.UTF16 = "utf-16";
    PositionEncodingKind.UTF32 = "utf-32";
  })(PositionEncodingKind || (exports.PositionEncodingKind = PositionEncodingKind = {}));
  var StaticRegistrationOptions;
  (function(StaticRegistrationOptions) {
    function hasId(value) {
      const candidate = value;
      return candidate && Is.string(candidate.id) && candidate.id.length > 0;
    }
    StaticRegistrationOptions.hasId = hasId;
  })(StaticRegistrationOptions || (exports.StaticRegistrationOptions = StaticRegistrationOptions = {}));
  var TextDocumentRegistrationOptions;
  (function(TextDocumentRegistrationOptions) {
    function is(value) {
      const candidate = value;
      return candidate && (candidate.documentSelector === null || DocumentSelector.is(candidate.documentSelector));
    }
    TextDocumentRegistrationOptions.is = is;
  })(TextDocumentRegistrationOptions || (exports.TextDocumentRegistrationOptions = TextDocumentRegistrationOptions = {}));
  var WorkDoneProgressOptions;
  (function(WorkDoneProgressOptions) {
    function is(value) {
      const candidate = value;
      return Is.objectLiteral(candidate) && (candidate.workDoneProgress === undefined || Is.boolean(candidate.workDoneProgress));
    }
    WorkDoneProgressOptions.is = is;
    function hasWorkDoneProgress(value) {
      const candidate = value;
      return candidate && Is.boolean(candidate.workDoneProgress);
    }
    WorkDoneProgressOptions.hasWorkDoneProgress = hasWorkDoneProgress;
  })(WorkDoneProgressOptions || (exports.WorkDoneProgressOptions = WorkDoneProgressOptions = {}));
  var InitializeRequest;
  (function(InitializeRequest) {
    InitializeRequest.method = "initialize";
    InitializeRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    InitializeRequest.type = new messages_1.ProtocolRequestType(InitializeRequest.method);
  })(InitializeRequest || (exports.InitializeRequest = InitializeRequest = {}));
  var InitializeErrorCodes;
  (function(InitializeErrorCodes) {
    InitializeErrorCodes.unknownProtocolVersion = 1;
  })(InitializeErrorCodes || (exports.InitializeErrorCodes = InitializeErrorCodes = {}));
  var InitializedNotification;
  (function(InitializedNotification) {
    InitializedNotification.method = "initialized";
    InitializedNotification.messageDirection = messages_1.MessageDirection.clientToServer;
    InitializedNotification.type = new messages_1.ProtocolNotificationType(InitializedNotification.method);
  })(InitializedNotification || (exports.InitializedNotification = InitializedNotification = {}));
  var ShutdownRequest;
  (function(ShutdownRequest) {
    ShutdownRequest.method = "shutdown";
    ShutdownRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    ShutdownRequest.type = new messages_1.ProtocolRequestType0(ShutdownRequest.method);
  })(ShutdownRequest || (exports.ShutdownRequest = ShutdownRequest = {}));
  var ExitNotification;
  (function(ExitNotification) {
    ExitNotification.method = "exit";
    ExitNotification.messageDirection = messages_1.MessageDirection.clientToServer;
    ExitNotification.type = new messages_1.ProtocolNotificationType0(ExitNotification.method);
  })(ExitNotification || (exports.ExitNotification = ExitNotification = {}));
  var DidChangeConfigurationNotification;
  (function(DidChangeConfigurationNotification) {
    DidChangeConfigurationNotification.method = "workspace/didChangeConfiguration";
    DidChangeConfigurationNotification.messageDirection = messages_1.MessageDirection.clientToServer;
    DidChangeConfigurationNotification.type = new messages_1.ProtocolNotificationType(DidChangeConfigurationNotification.method);
  })(DidChangeConfigurationNotification || (exports.DidChangeConfigurationNotification = DidChangeConfigurationNotification = {}));
  var MessageType;
  (function(MessageType) {
    MessageType.Error = 1;
    MessageType.Warning = 2;
    MessageType.Info = 3;
    MessageType.Log = 4;
    MessageType.Debug = 5;
  })(MessageType || (exports.MessageType = MessageType = {}));
  var ShowMessageNotification;
  (function(ShowMessageNotification) {
    ShowMessageNotification.method = "window/showMessage";
    ShowMessageNotification.messageDirection = messages_1.MessageDirection.serverToClient;
    ShowMessageNotification.type = new messages_1.ProtocolNotificationType(ShowMessageNotification.method);
  })(ShowMessageNotification || (exports.ShowMessageNotification = ShowMessageNotification = {}));
  var ShowMessageRequest;
  (function(ShowMessageRequest) {
    ShowMessageRequest.method = "window/showMessageRequest";
    ShowMessageRequest.messageDirection = messages_1.MessageDirection.serverToClient;
    ShowMessageRequest.type = new messages_1.ProtocolRequestType(ShowMessageRequest.method);
  })(ShowMessageRequest || (exports.ShowMessageRequest = ShowMessageRequest = {}));
  var LogMessageNotification;
  (function(LogMessageNotification) {
    LogMessageNotification.method = "window/logMessage";
    LogMessageNotification.messageDirection = messages_1.MessageDirection.serverToClient;
    LogMessageNotification.type = new messages_1.ProtocolNotificationType(LogMessageNotification.method);
  })(LogMessageNotification || (exports.LogMessageNotification = LogMessageNotification = {}));
  var TelemetryEventNotification;
  (function(TelemetryEventNotification) {
    TelemetryEventNotification.method = "telemetry/event";
    TelemetryEventNotification.messageDirection = messages_1.MessageDirection.serverToClient;
    TelemetryEventNotification.type = new messages_1.ProtocolNotificationType(TelemetryEventNotification.method);
  })(TelemetryEventNotification || (exports.TelemetryEventNotification = TelemetryEventNotification = {}));
  var TextDocumentSyncKind;
  (function(TextDocumentSyncKind) {
    TextDocumentSyncKind.None = 0;
    TextDocumentSyncKind.Full = 1;
    TextDocumentSyncKind.Incremental = 2;
  })(TextDocumentSyncKind || (exports.TextDocumentSyncKind = TextDocumentSyncKind = {}));
  var DidOpenTextDocumentNotification;
  (function(DidOpenTextDocumentNotification) {
    DidOpenTextDocumentNotification.method = "textDocument/didOpen";
    DidOpenTextDocumentNotification.messageDirection = messages_1.MessageDirection.clientToServer;
    DidOpenTextDocumentNotification.type = new messages_1.ProtocolNotificationType(DidOpenTextDocumentNotification.method);
  })(DidOpenTextDocumentNotification || (exports.DidOpenTextDocumentNotification = DidOpenTextDocumentNotification = {}));
  var TextDocumentContentChangeEvent;
  (function(TextDocumentContentChangeEvent) {
    function isIncremental(event) {
      let candidate = event;
      return candidate !== undefined && candidate !== null && typeof candidate.text === "string" && candidate.range !== undefined && (candidate.rangeLength === undefined || typeof candidate.rangeLength === "number");
    }
    TextDocumentContentChangeEvent.isIncremental = isIncremental;
    function isFull(event) {
      let candidate = event;
      return candidate !== undefined && candidate !== null && typeof candidate.text === "string" && candidate.range === undefined && candidate.rangeLength === undefined;
    }
    TextDocumentContentChangeEvent.isFull = isFull;
  })(TextDocumentContentChangeEvent || (exports.TextDocumentContentChangeEvent = TextDocumentContentChangeEvent = {}));
  var DidChangeTextDocumentNotification;
  (function(DidChangeTextDocumentNotification) {
    DidChangeTextDocumentNotification.method = "textDocument/didChange";
    DidChangeTextDocumentNotification.messageDirection = messages_1.MessageDirection.clientToServer;
    DidChangeTextDocumentNotification.type = new messages_1.ProtocolNotificationType(DidChangeTextDocumentNotification.method);
  })(DidChangeTextDocumentNotification || (exports.DidChangeTextDocumentNotification = DidChangeTextDocumentNotification = {}));
  var DidCloseTextDocumentNotification;
  (function(DidCloseTextDocumentNotification) {
    DidCloseTextDocumentNotification.method = "textDocument/didClose";
    DidCloseTextDocumentNotification.messageDirection = messages_1.MessageDirection.clientToServer;
    DidCloseTextDocumentNotification.type = new messages_1.ProtocolNotificationType(DidCloseTextDocumentNotification.method);
  })(DidCloseTextDocumentNotification || (exports.DidCloseTextDocumentNotification = DidCloseTextDocumentNotification = {}));
  var DidSaveTextDocumentNotification;
  (function(DidSaveTextDocumentNotification) {
    DidSaveTextDocumentNotification.method = "textDocument/didSave";
    DidSaveTextDocumentNotification.messageDirection = messages_1.MessageDirection.clientToServer;
    DidSaveTextDocumentNotification.type = new messages_1.ProtocolNotificationType(DidSaveTextDocumentNotification.method);
  })(DidSaveTextDocumentNotification || (exports.DidSaveTextDocumentNotification = DidSaveTextDocumentNotification = {}));
  var TextDocumentSaveReason;
  (function(TextDocumentSaveReason) {
    TextDocumentSaveReason.Manual = 1;
    TextDocumentSaveReason.AfterDelay = 2;
    TextDocumentSaveReason.FocusOut = 3;
  })(TextDocumentSaveReason || (exports.TextDocumentSaveReason = TextDocumentSaveReason = {}));
  var WillSaveTextDocumentNotification;
  (function(WillSaveTextDocumentNotification) {
    WillSaveTextDocumentNotification.method = "textDocument/willSave";
    WillSaveTextDocumentNotification.messageDirection = messages_1.MessageDirection.clientToServer;
    WillSaveTextDocumentNotification.type = new messages_1.ProtocolNotificationType(WillSaveTextDocumentNotification.method);
  })(WillSaveTextDocumentNotification || (exports.WillSaveTextDocumentNotification = WillSaveTextDocumentNotification = {}));
  var WillSaveTextDocumentWaitUntilRequest;
  (function(WillSaveTextDocumentWaitUntilRequest) {
    WillSaveTextDocumentWaitUntilRequest.method = "textDocument/willSaveWaitUntil";
    WillSaveTextDocumentWaitUntilRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    WillSaveTextDocumentWaitUntilRequest.type = new messages_1.ProtocolRequestType(WillSaveTextDocumentWaitUntilRequest.method);
  })(WillSaveTextDocumentWaitUntilRequest || (exports.WillSaveTextDocumentWaitUntilRequest = WillSaveTextDocumentWaitUntilRequest = {}));
  var DidChangeWatchedFilesNotification;
  (function(DidChangeWatchedFilesNotification) {
    DidChangeWatchedFilesNotification.method = "workspace/didChangeWatchedFiles";
    DidChangeWatchedFilesNotification.messageDirection = messages_1.MessageDirection.clientToServer;
    DidChangeWatchedFilesNotification.type = new messages_1.ProtocolNotificationType(DidChangeWatchedFilesNotification.method);
  })(DidChangeWatchedFilesNotification || (exports.DidChangeWatchedFilesNotification = DidChangeWatchedFilesNotification = {}));
  var FileChangeType;
  (function(FileChangeType) {
    FileChangeType.Created = 1;
    FileChangeType.Changed = 2;
    FileChangeType.Deleted = 3;
  })(FileChangeType || (exports.FileChangeType = FileChangeType = {}));
  var RelativePattern;
  (function(RelativePattern) {
    function is(value) {
      const candidate = value;
      return Is.objectLiteral(candidate) && (vscode_languageserver_types_1.URI.is(candidate.baseUri) || vscode_languageserver_types_1.WorkspaceFolder.is(candidate.baseUri)) && Is.string(candidate.pattern);
    }
    RelativePattern.is = is;
  })(RelativePattern || (exports.RelativePattern = RelativePattern = {}));
  var WatchKind;
  (function(WatchKind) {
    WatchKind.Create = 1;
    WatchKind.Change = 2;
    WatchKind.Delete = 4;
  })(WatchKind || (exports.WatchKind = WatchKind = {}));
  var PublishDiagnosticsNotification;
  (function(PublishDiagnosticsNotification) {
    PublishDiagnosticsNotification.method = "textDocument/publishDiagnostics";
    PublishDiagnosticsNotification.messageDirection = messages_1.MessageDirection.serverToClient;
    PublishDiagnosticsNotification.type = new messages_1.ProtocolNotificationType(PublishDiagnosticsNotification.method);
  })(PublishDiagnosticsNotification || (exports.PublishDiagnosticsNotification = PublishDiagnosticsNotification = {}));
  var CompletionTriggerKind;
  (function(CompletionTriggerKind) {
    CompletionTriggerKind.Invoked = 1;
    CompletionTriggerKind.TriggerCharacter = 2;
    CompletionTriggerKind.TriggerForIncompleteCompletions = 3;
  })(CompletionTriggerKind || (exports.CompletionTriggerKind = CompletionTriggerKind = {}));
  var CompletionRequest;
  (function(CompletionRequest) {
    CompletionRequest.method = "textDocument/completion";
    CompletionRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    CompletionRequest.type = new messages_1.ProtocolRequestType(CompletionRequest.method);
  })(CompletionRequest || (exports.CompletionRequest = CompletionRequest = {}));
  var CompletionResolveRequest;
  (function(CompletionResolveRequest) {
    CompletionResolveRequest.method = "completionItem/resolve";
    CompletionResolveRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    CompletionResolveRequest.type = new messages_1.ProtocolRequestType(CompletionResolveRequest.method);
  })(CompletionResolveRequest || (exports.CompletionResolveRequest = CompletionResolveRequest = {}));
  var HoverRequest;
  (function(HoverRequest) {
    HoverRequest.method = "textDocument/hover";
    HoverRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    HoverRequest.type = new messages_1.ProtocolRequestType(HoverRequest.method);
  })(HoverRequest || (exports.HoverRequest = HoverRequest = {}));
  var SignatureHelpTriggerKind;
  (function(SignatureHelpTriggerKind) {
    SignatureHelpTriggerKind.Invoked = 1;
    SignatureHelpTriggerKind.TriggerCharacter = 2;
    SignatureHelpTriggerKind.ContentChange = 3;
  })(SignatureHelpTriggerKind || (exports.SignatureHelpTriggerKind = SignatureHelpTriggerKind = {}));
  var SignatureHelpRequest;
  (function(SignatureHelpRequest) {
    SignatureHelpRequest.method = "textDocument/signatureHelp";
    SignatureHelpRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    SignatureHelpRequest.type = new messages_1.ProtocolRequestType(SignatureHelpRequest.method);
  })(SignatureHelpRequest || (exports.SignatureHelpRequest = SignatureHelpRequest = {}));
  var DefinitionRequest;
  (function(DefinitionRequest) {
    DefinitionRequest.method = "textDocument/definition";
    DefinitionRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    DefinitionRequest.type = new messages_1.ProtocolRequestType(DefinitionRequest.method);
  })(DefinitionRequest || (exports.DefinitionRequest = DefinitionRequest = {}));
  var ReferencesRequest;
  (function(ReferencesRequest) {
    ReferencesRequest.method = "textDocument/references";
    ReferencesRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    ReferencesRequest.type = new messages_1.ProtocolRequestType(ReferencesRequest.method);
  })(ReferencesRequest || (exports.ReferencesRequest = ReferencesRequest = {}));
  var DocumentHighlightRequest;
  (function(DocumentHighlightRequest) {
    DocumentHighlightRequest.method = "textDocument/documentHighlight";
    DocumentHighlightRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    DocumentHighlightRequest.type = new messages_1.ProtocolRequestType(DocumentHighlightRequest.method);
  })(DocumentHighlightRequest || (exports.DocumentHighlightRequest = DocumentHighlightRequest = {}));
  var DocumentSymbolRequest;
  (function(DocumentSymbolRequest) {
    DocumentSymbolRequest.method = "textDocument/documentSymbol";
    DocumentSymbolRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    DocumentSymbolRequest.type = new messages_1.ProtocolRequestType(DocumentSymbolRequest.method);
  })(DocumentSymbolRequest || (exports.DocumentSymbolRequest = DocumentSymbolRequest = {}));
  var CodeActionRequest;
  (function(CodeActionRequest) {
    CodeActionRequest.method = "textDocument/codeAction";
    CodeActionRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    CodeActionRequest.type = new messages_1.ProtocolRequestType(CodeActionRequest.method);
  })(CodeActionRequest || (exports.CodeActionRequest = CodeActionRequest = {}));
  var CodeActionResolveRequest;
  (function(CodeActionResolveRequest) {
    CodeActionResolveRequest.method = "codeAction/resolve";
    CodeActionResolveRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    CodeActionResolveRequest.type = new messages_1.ProtocolRequestType(CodeActionResolveRequest.method);
  })(CodeActionResolveRequest || (exports.CodeActionResolveRequest = CodeActionResolveRequest = {}));
  var WorkspaceSymbolRequest;
  (function(WorkspaceSymbolRequest) {
    WorkspaceSymbolRequest.method = "workspace/symbol";
    WorkspaceSymbolRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    WorkspaceSymbolRequest.type = new messages_1.ProtocolRequestType(WorkspaceSymbolRequest.method);
  })(WorkspaceSymbolRequest || (exports.WorkspaceSymbolRequest = WorkspaceSymbolRequest = {}));
  var WorkspaceSymbolResolveRequest;
  (function(WorkspaceSymbolResolveRequest) {
    WorkspaceSymbolResolveRequest.method = "workspaceSymbol/resolve";
    WorkspaceSymbolResolveRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    WorkspaceSymbolResolveRequest.type = new messages_1.ProtocolRequestType(WorkspaceSymbolResolveRequest.method);
  })(WorkspaceSymbolResolveRequest || (exports.WorkspaceSymbolResolveRequest = WorkspaceSymbolResolveRequest = {}));
  var CodeLensRequest;
  (function(CodeLensRequest) {
    CodeLensRequest.method = "textDocument/codeLens";
    CodeLensRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    CodeLensRequest.type = new messages_1.ProtocolRequestType(CodeLensRequest.method);
  })(CodeLensRequest || (exports.CodeLensRequest = CodeLensRequest = {}));
  var CodeLensResolveRequest;
  (function(CodeLensResolveRequest) {
    CodeLensResolveRequest.method = "codeLens/resolve";
    CodeLensResolveRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    CodeLensResolveRequest.type = new messages_1.ProtocolRequestType(CodeLensResolveRequest.method);
  })(CodeLensResolveRequest || (exports.CodeLensResolveRequest = CodeLensResolveRequest = {}));
  var CodeLensRefreshRequest;
  (function(CodeLensRefreshRequest) {
    CodeLensRefreshRequest.method = `workspace/codeLens/refresh`;
    CodeLensRefreshRequest.messageDirection = messages_1.MessageDirection.serverToClient;
    CodeLensRefreshRequest.type = new messages_1.ProtocolRequestType0(CodeLensRefreshRequest.method);
  })(CodeLensRefreshRequest || (exports.CodeLensRefreshRequest = CodeLensRefreshRequest = {}));
  var DocumentLinkRequest;
  (function(DocumentLinkRequest) {
    DocumentLinkRequest.method = "textDocument/documentLink";
    DocumentLinkRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    DocumentLinkRequest.type = new messages_1.ProtocolRequestType(DocumentLinkRequest.method);
  })(DocumentLinkRequest || (exports.DocumentLinkRequest = DocumentLinkRequest = {}));
  var DocumentLinkResolveRequest;
  (function(DocumentLinkResolveRequest) {
    DocumentLinkResolveRequest.method = "documentLink/resolve";
    DocumentLinkResolveRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    DocumentLinkResolveRequest.type = new messages_1.ProtocolRequestType(DocumentLinkResolveRequest.method);
  })(DocumentLinkResolveRequest || (exports.DocumentLinkResolveRequest = DocumentLinkResolveRequest = {}));
  var DocumentFormattingRequest;
  (function(DocumentFormattingRequest) {
    DocumentFormattingRequest.method = "textDocument/formatting";
    DocumentFormattingRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    DocumentFormattingRequest.type = new messages_1.ProtocolRequestType(DocumentFormattingRequest.method);
  })(DocumentFormattingRequest || (exports.DocumentFormattingRequest = DocumentFormattingRequest = {}));
  var DocumentRangeFormattingRequest;
  (function(DocumentRangeFormattingRequest) {
    DocumentRangeFormattingRequest.method = "textDocument/rangeFormatting";
    DocumentRangeFormattingRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    DocumentRangeFormattingRequest.type = new messages_1.ProtocolRequestType(DocumentRangeFormattingRequest.method);
  })(DocumentRangeFormattingRequest || (exports.DocumentRangeFormattingRequest = DocumentRangeFormattingRequest = {}));
  var DocumentRangesFormattingRequest;
  (function(DocumentRangesFormattingRequest) {
    DocumentRangesFormattingRequest.method = "textDocument/rangesFormatting";
    DocumentRangesFormattingRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    DocumentRangesFormattingRequest.type = new messages_1.ProtocolRequestType(DocumentRangesFormattingRequest.method);
  })(DocumentRangesFormattingRequest || (exports.DocumentRangesFormattingRequest = DocumentRangesFormattingRequest = {}));
  var DocumentOnTypeFormattingRequest;
  (function(DocumentOnTypeFormattingRequest) {
    DocumentOnTypeFormattingRequest.method = "textDocument/onTypeFormatting";
    DocumentOnTypeFormattingRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    DocumentOnTypeFormattingRequest.type = new messages_1.ProtocolRequestType(DocumentOnTypeFormattingRequest.method);
  })(DocumentOnTypeFormattingRequest || (exports.DocumentOnTypeFormattingRequest = DocumentOnTypeFormattingRequest = {}));
  var PrepareSupportDefaultBehavior;
  (function(PrepareSupportDefaultBehavior) {
    PrepareSupportDefaultBehavior.Identifier = 1;
  })(PrepareSupportDefaultBehavior || (exports.PrepareSupportDefaultBehavior = PrepareSupportDefaultBehavior = {}));
  var RenameRequest;
  (function(RenameRequest) {
    RenameRequest.method = "textDocument/rename";
    RenameRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    RenameRequest.type = new messages_1.ProtocolRequestType(RenameRequest.method);
  })(RenameRequest || (exports.RenameRequest = RenameRequest = {}));
  var PrepareRenameRequest;
  (function(PrepareRenameRequest) {
    PrepareRenameRequest.method = "textDocument/prepareRename";
    PrepareRenameRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    PrepareRenameRequest.type = new messages_1.ProtocolRequestType(PrepareRenameRequest.method);
  })(PrepareRenameRequest || (exports.PrepareRenameRequest = PrepareRenameRequest = {}));
  var ExecuteCommandRequest;
  (function(ExecuteCommandRequest) {
    ExecuteCommandRequest.method = "workspace/executeCommand";
    ExecuteCommandRequest.messageDirection = messages_1.MessageDirection.clientToServer;
    ExecuteCommandRequest.type = new messages_1.ProtocolRequestType(ExecuteCommandRequest.method);
  })(ExecuteCommandRequest || (exports.ExecuteCommandRequest = ExecuteCommandRequest = {}));
  var ApplyWorkspaceEditRequest;
  (function(ApplyWorkspaceEditRequest) {
    ApplyWorkspaceEditRequest.method = "workspace/applyEdit";
    ApplyWorkspaceEditRequest.messageDirection = messages_1.MessageDirection.serverToClient;
    ApplyWorkspaceEditRequest.type = new messages_1.ProtocolRequestType("workspace/applyEdit");
  })(ApplyWorkspaceEditRequest || (exports.ApplyWorkspaceEditRequest = ApplyWorkspaceEditRequest = {}));
});

// node_modules/vscode-languageserver-protocol/lib/common/connection.js
var require_connection2 = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.createProtocolConnection = undefined;
  var vscode_jsonrpc_1 = require_main();
  function createProtocolConnection(input, output, logger, options) {
    if (vscode_jsonrpc_1.ConnectionStrategy.is(options)) {
      options = { connectionStrategy: options };
    }
    return (0, vscode_jsonrpc_1.createMessageConnection)(input, output, logger, options);
  }
  exports.createProtocolConnection = createProtocolConnection;
});

// node_modules/vscode-languageserver-protocol/lib/common/api.js
var require_api2 = __commonJS(function(exports) {
  var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined)
      k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() {
        return m[k];
      } };
    }
    Object.defineProperty(o, k2, desc);
  } : function(o, m, k, k2) {
    if (k2 === undefined)
      k2 = k;
    o[k2] = m[k];
  });
  var __exportStar = exports && exports.__exportStar || function(m, exports2) {
    for (var p in m)
      if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p))
        __createBinding(exports2, m, p);
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.LSPErrorCodes = exports.createProtocolConnection = undefined;
  __exportStar(require_main(), exports);
  __exportStar(require_main2(), exports);
  __exportStar(require_messages2(), exports);
  __exportStar(require_protocol(), exports);
  var connection_1 = require_connection2();
  Object.defineProperty(exports, "createProtocolConnection", { enumerable: true, get: function() {
    return connection_1.createProtocolConnection;
  } });
  var LSPErrorCodes;
  (function(LSPErrorCodes) {
    LSPErrorCodes.lspReservedErrorRangeStart = -32899;
    LSPErrorCodes.RequestFailed = -32803;
    LSPErrorCodes.ServerCancelled = -32802;
    LSPErrorCodes.ContentModified = -32801;
    LSPErrorCodes.RequestCancelled = -32800;
    LSPErrorCodes.lspReservedErrorRangeEnd = -32800;
  })(LSPErrorCodes || (exports.LSPErrorCodes = LSPErrorCodes = {}));
});

// node_modules/vscode-languageserver-protocol/lib/node/main.js
var require_main3 = __commonJS(function(exports) {
  var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined)
      k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() {
        return m[k];
      } };
    }
    Object.defineProperty(o, k2, desc);
  } : function(o, m, k, k2) {
    if (k2 === undefined)
      k2 = k;
    o[k2] = m[k];
  });
  var __exportStar = exports && exports.__exportStar || function(m, exports2) {
    for (var p in m)
      if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p))
        __createBinding(exports2, m, p);
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.createProtocolConnection = undefined;
  var node_1 = require_main();
  __exportStar(require_main(), exports);
  __exportStar(require_api2(), exports);
  function createProtocolConnection(input, output, logger, options) {
    return (0, node_1.createMessageConnection)(input, output, logger, options);
  }
  exports.createProtocolConnection = createProtocolConnection;
});

// node_modules/vscode-languageserver/lib/common/utils/uuid.js
var require_uuid = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.generateUuid = exports.parse = exports.isUUID = exports.v4 = exports.empty = undefined;

  class ValueUUID {
    constructor(_value) {
      this._value = _value;
    }
    asHex() {
      return this._value;
    }
    equals(other) {
      return this.asHex() === other.asHex();
    }
  }

  class V4UUID extends ValueUUID {
    static _oneOf(array) {
      return array[Math.floor(array.length * Math.random())];
    }
    static _randomHex() {
      return V4UUID._oneOf(V4UUID._chars);
    }
    constructor() {
      super([
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        "-",
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        "-",
        "4",
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        "-",
        V4UUID._oneOf(V4UUID._timeHighBits),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        "-",
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex()
      ].join(""));
    }
  }
  V4UUID._chars = ["0", "1", "2", "3", "4", "5", "6", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f"];
  V4UUID._timeHighBits = ["8", "9", "a", "b"];
  exports.empty = new ValueUUID("00000000-0000-0000-0000-000000000000");
  function v4() {
    return new V4UUID;
  }
  exports.v4 = v4;
  var _UUIDPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function isUUID(value) {
    return _UUIDPattern.test(value);
  }
  exports.isUUID = isUUID;
  function parse(value) {
    if (!isUUID(value)) {
      throw new Error("invalid uuid");
    }
    return new ValueUUID(value);
  }
  exports.parse = parse;
  function generateUuid() {
    return v4().asHex();
  }
  exports.generateUuid = generateUuid;
});

// node_modules/vscode-languageserver/lib/common/progress.js
var require_progress = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.attachPartialResult = exports.ProgressFeature = exports.attachWorkDone = undefined;
  var vscode_languageserver_protocol_1 = require_main3();
  var uuid_1 = require_uuid();

  class WorkDoneProgressReporterImpl {
    constructor(_connection, _token) {
      this._connection = _connection;
      this._token = _token;
      WorkDoneProgressReporterImpl.Instances.set(this._token, this);
    }
    begin(title, percentage, message, cancellable) {
      let param = {
        kind: "begin",
        title,
        percentage,
        message,
        cancellable
      };
      this._connection.sendProgress(vscode_languageserver_protocol_1.WorkDoneProgress.type, this._token, param);
    }
    report(arg0, arg1) {
      let param = {
        kind: "report"
      };
      if (typeof arg0 === "number") {
        param.percentage = arg0;
        if (arg1 !== undefined) {
          param.message = arg1;
        }
      } else {
        param.message = arg0;
      }
      this._connection.sendProgress(vscode_languageserver_protocol_1.WorkDoneProgress.type, this._token, param);
    }
    done() {
      WorkDoneProgressReporterImpl.Instances.delete(this._token);
      this._connection.sendProgress(vscode_languageserver_protocol_1.WorkDoneProgress.type, this._token, { kind: "end" });
    }
  }
  WorkDoneProgressReporterImpl.Instances = new Map;

  class WorkDoneProgressServerReporterImpl extends WorkDoneProgressReporterImpl {
    constructor(connection, token) {
      super(connection, token);
      this._source = new vscode_languageserver_protocol_1.CancellationTokenSource;
    }
    get token() {
      return this._source.token;
    }
    done() {
      this._source.dispose();
      super.done();
    }
    cancel() {
      this._source.cancel();
    }
  }

  class NullProgressReporter {
    constructor() {}
    begin() {}
    report() {}
    done() {}
  }

  class NullProgressServerReporter extends NullProgressReporter {
    constructor() {
      super();
      this._source = new vscode_languageserver_protocol_1.CancellationTokenSource;
    }
    get token() {
      return this._source.token;
    }
    done() {
      this._source.dispose();
    }
    cancel() {
      this._source.cancel();
    }
  }
  function attachWorkDone(connection, params) {
    if (params === undefined || params.workDoneToken === undefined) {
      return new NullProgressReporter;
    }
    const token = params.workDoneToken;
    delete params.workDoneToken;
    return new WorkDoneProgressReporterImpl(connection, token);
  }
  exports.attachWorkDone = attachWorkDone;
  var ProgressFeature = (Base) => {
    return class extends Base {
      constructor() {
        super();
        this._progressSupported = false;
      }
      initialize(capabilities) {
        super.initialize(capabilities);
        if (capabilities?.window?.workDoneProgress === true) {
          this._progressSupported = true;
          this.connection.onNotification(vscode_languageserver_protocol_1.WorkDoneProgressCancelNotification.type, (params) => {
            let progress = WorkDoneProgressReporterImpl.Instances.get(params.token);
            if (progress instanceof WorkDoneProgressServerReporterImpl || progress instanceof NullProgressServerReporter) {
              progress.cancel();
            }
          });
        }
      }
      attachWorkDoneProgress(token) {
        if (token === undefined) {
          return new NullProgressReporter;
        } else {
          return new WorkDoneProgressReporterImpl(this.connection, token);
        }
      }
      createWorkDoneProgress() {
        if (this._progressSupported) {
          const token = (0, uuid_1.generateUuid)();
          return this.connection.sendRequest(vscode_languageserver_protocol_1.WorkDoneProgressCreateRequest.type, { token }).then(() => {
            const result = new WorkDoneProgressServerReporterImpl(this.connection, token);
            return result;
          });
        } else {
          return Promise.resolve(new NullProgressServerReporter);
        }
      }
    };
  };
  exports.ProgressFeature = ProgressFeature;
  var ResultProgress;
  (function(ResultProgress) {
    ResultProgress.type = new vscode_languageserver_protocol_1.ProgressType;
  })(ResultProgress || (ResultProgress = {}));

  class ResultProgressReporterImpl {
    constructor(_connection, _token) {
      this._connection = _connection;
      this._token = _token;
    }
    report(data) {
      this._connection.sendProgress(ResultProgress.type, this._token, data);
    }
  }
  function attachPartialResult(connection, params) {
    if (params === undefined || params.partialResultToken === undefined) {
      return;
    }
    const token = params.partialResultToken;
    delete params.partialResultToken;
    return new ResultProgressReporterImpl(connection, token);
  }
  exports.attachPartialResult = attachPartialResult;
});

// node_modules/vscode-languageserver/lib/common/configuration.js
var require_configuration = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.ConfigurationFeature = undefined;
  var vscode_languageserver_protocol_1 = require_main3();
  var Is = require_is();
  var ConfigurationFeature = (Base) => {
    return class extends Base {
      getConfiguration(arg) {
        if (!arg) {
          return this._getConfiguration({});
        } else if (Is.string(arg)) {
          return this._getConfiguration({ section: arg });
        } else {
          return this._getConfiguration(arg);
        }
      }
      _getConfiguration(arg) {
        let params = {
          items: Array.isArray(arg) ? arg : [arg]
        };
        return this.connection.sendRequest(vscode_languageserver_protocol_1.ConfigurationRequest.type, params).then((result) => {
          if (Array.isArray(result)) {
            return Array.isArray(arg) ? result : result[0];
          } else {
            return Array.isArray(arg) ? [] : null;
          }
        });
      }
    };
  };
  exports.ConfigurationFeature = ConfigurationFeature;
});

// node_modules/vscode-languageserver/lib/common/workspaceFolder.js
var require_workspaceFolder = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.WorkspaceFoldersFeature = undefined;
  var vscode_languageserver_protocol_1 = require_main3();
  var WorkspaceFoldersFeature = (Base) => {
    return class extends Base {
      constructor() {
        super();
        this._notificationIsAutoRegistered = false;
      }
      initialize(capabilities) {
        super.initialize(capabilities);
        let workspaceCapabilities = capabilities.workspace;
        if (workspaceCapabilities && workspaceCapabilities.workspaceFolders) {
          this._onDidChangeWorkspaceFolders = new vscode_languageserver_protocol_1.Emitter;
          this.connection.onNotification(vscode_languageserver_protocol_1.DidChangeWorkspaceFoldersNotification.type, (params) => {
            this._onDidChangeWorkspaceFolders.fire(params.event);
          });
        }
      }
      fillServerCapabilities(capabilities) {
        super.fillServerCapabilities(capabilities);
        const changeNotifications = capabilities.workspace?.workspaceFolders?.changeNotifications;
        this._notificationIsAutoRegistered = changeNotifications === true || typeof changeNotifications === "string";
      }
      getWorkspaceFolders() {
        return this.connection.sendRequest(vscode_languageserver_protocol_1.WorkspaceFoldersRequest.type);
      }
      get onDidChangeWorkspaceFolders() {
        if (!this._onDidChangeWorkspaceFolders) {
          throw new Error("Client doesn't support sending workspace folder change events.");
        }
        if (!this._notificationIsAutoRegistered && !this._unregistration) {
          this._unregistration = this.connection.client.register(vscode_languageserver_protocol_1.DidChangeWorkspaceFoldersNotification.type);
        }
        return this._onDidChangeWorkspaceFolders.event;
      }
    };
  };
  exports.WorkspaceFoldersFeature = WorkspaceFoldersFeature;
});

// node_modules/vscode-languageserver/lib/common/callHierarchy.js
var require_callHierarchy = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.CallHierarchyFeature = undefined;
  var vscode_languageserver_protocol_1 = require_main3();
  var CallHierarchyFeature = (Base) => {
    return class extends Base {
      get callHierarchy() {
        return {
          onPrepare: (handler) => {
            return this.connection.onRequest(vscode_languageserver_protocol_1.CallHierarchyPrepareRequest.type, (params, cancel) => {
              return handler(params, cancel, this.attachWorkDoneProgress(params), undefined);
            });
          },
          onIncomingCalls: (handler) => {
            const type = vscode_languageserver_protocol_1.CallHierarchyIncomingCallsRequest.type;
            return this.connection.onRequest(type, (params, cancel) => {
              return handler(params, cancel, this.attachWorkDoneProgress(params), this.attachPartialResultProgress(type, params));
            });
          },
          onOutgoingCalls: (handler) => {
            const type = vscode_languageserver_protocol_1.CallHierarchyOutgoingCallsRequest.type;
            return this.connection.onRequest(type, (params, cancel) => {
              return handler(params, cancel, this.attachWorkDoneProgress(params), this.attachPartialResultProgress(type, params));
            });
          }
        };
      }
    };
  };
  exports.CallHierarchyFeature = CallHierarchyFeature;
});

// node_modules/vscode-languageserver/lib/common/semanticTokens.js
var require_semanticTokens = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.SemanticTokensBuilder = exports.SemanticTokensDiff = exports.SemanticTokensFeature = undefined;
  var vscode_languageserver_protocol_1 = require_main3();
  var SemanticTokensFeature = (Base) => {
    return class extends Base {
      get semanticTokens() {
        return {
          refresh: () => {
            return this.connection.sendRequest(vscode_languageserver_protocol_1.SemanticTokensRefreshRequest.type);
          },
          on: (handler) => {
            const type = vscode_languageserver_protocol_1.SemanticTokensRequest.type;
            return this.connection.onRequest(type, (params, cancel) => {
              return handler(params, cancel, this.attachWorkDoneProgress(params), this.attachPartialResultProgress(type, params));
            });
          },
          onDelta: (handler) => {
            const type = vscode_languageserver_protocol_1.SemanticTokensDeltaRequest.type;
            return this.connection.onRequest(type, (params, cancel) => {
              return handler(params, cancel, this.attachWorkDoneProgress(params), this.attachPartialResultProgress(type, params));
            });
          },
          onRange: (handler) => {
            const type = vscode_languageserver_protocol_1.SemanticTokensRangeRequest.type;
            return this.connection.onRequest(type, (params, cancel) => {
              return handler(params, cancel, this.attachWorkDoneProgress(params), this.attachPartialResultProgress(type, params));
            });
          }
        };
      }
    };
  };
  exports.SemanticTokensFeature = SemanticTokensFeature;

  class SemanticTokensDiff {
    constructor(originalSequence, modifiedSequence) {
      this.originalSequence = originalSequence;
      this.modifiedSequence = modifiedSequence;
    }
    computeDiff() {
      const originalLength = this.originalSequence.length;
      const modifiedLength = this.modifiedSequence.length;
      let startIndex = 0;
      while (startIndex < modifiedLength && startIndex < originalLength && this.originalSequence[startIndex] === this.modifiedSequence[startIndex]) {
        startIndex++;
      }
      if (startIndex < modifiedLength && startIndex < originalLength) {
        let originalEndIndex = originalLength - 1;
        let modifiedEndIndex = modifiedLength - 1;
        while (originalEndIndex >= startIndex && modifiedEndIndex >= startIndex && this.originalSequence[originalEndIndex] === this.modifiedSequence[modifiedEndIndex]) {
          originalEndIndex--;
          modifiedEndIndex--;
        }
        if (originalEndIndex < startIndex || modifiedEndIndex < startIndex) {
          originalEndIndex++;
          modifiedEndIndex++;
        }
        const deleteCount = originalEndIndex - startIndex + 1;
        const newData = this.modifiedSequence.slice(startIndex, modifiedEndIndex + 1);
        if (newData.length === 1 && newData[0] === this.originalSequence[originalEndIndex]) {
          return [
            { start: startIndex, deleteCount: deleteCount - 1 }
          ];
        } else {
          return [
            { start: startIndex, deleteCount, data: newData }
          ];
        }
      } else if (startIndex < modifiedLength) {
        return [
          { start: startIndex, deleteCount: 0, data: this.modifiedSequence.slice(startIndex) }
        ];
      } else if (startIndex < originalLength) {
        return [
          { start: startIndex, deleteCount: originalLength - startIndex }
        ];
      } else {
        return [];
      }
    }
  }
  exports.SemanticTokensDiff = SemanticTokensDiff;

  class SemanticTokensBuilder {
    constructor() {
      this._prevData = undefined;
      this.initialize();
    }
    initialize() {
      this._id = Date.now();
      this._prevLine = 0;
      this._prevChar = 0;
      this._data = [];
      this._dataLen = 0;
    }
    push(line, char, length, tokenType, tokenModifiers) {
      let pushLine = line;
      let pushChar = char;
      if (this._dataLen > 0) {
        pushLine -= this._prevLine;
        if (pushLine === 0) {
          pushChar -= this._prevChar;
        }
      }
      this._data[this._dataLen++] = pushLine;
      this._data[this._dataLen++] = pushChar;
      this._data[this._dataLen++] = length;
      this._data[this._dataLen++] = tokenType;
      this._data[this._dataLen++] = tokenModifiers;
      this._prevLine = line;
      this._prevChar = char;
    }
    get id() {
      return this._id.toString();
    }
    previousResult(id) {
      if (this.id === id) {
        this._prevData = this._data;
      }
      this.initialize();
    }
    build() {
      this._prevData = undefined;
      return {
        resultId: this.id,
        data: this._data
      };
    }
    canBuildEdits() {
      return this._prevData !== undefined;
    }
    buildEdits() {
      if (this._prevData !== undefined) {
        return {
          resultId: this.id,
          edits: new SemanticTokensDiff(this._prevData, this._data).computeDiff()
        };
      } else {
        return this.build();
      }
    }
  }
  exports.SemanticTokensBuilder = SemanticTokensBuilder;
});

// node_modules/vscode-languageserver/lib/common/showDocument.js
var require_showDocument = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.ShowDocumentFeature = undefined;
  var vscode_languageserver_protocol_1 = require_main3();
  var ShowDocumentFeature = (Base) => {
    return class extends Base {
      showDocument(params) {
        return this.connection.sendRequest(vscode_languageserver_protocol_1.ShowDocumentRequest.type, params);
      }
    };
  };
  exports.ShowDocumentFeature = ShowDocumentFeature;
});

// node_modules/vscode-languageserver/lib/common/fileOperations.js
var require_fileOperations = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.FileOperationsFeature = undefined;
  var vscode_languageserver_protocol_1 = require_main3();
  var FileOperationsFeature = (Base) => {
    return class extends Base {
      onDidCreateFiles(handler) {
        return this.connection.onNotification(vscode_languageserver_protocol_1.DidCreateFilesNotification.type, (params) => {
          handler(params);
        });
      }
      onDidRenameFiles(handler) {
        return this.connection.onNotification(vscode_languageserver_protocol_1.DidRenameFilesNotification.type, (params) => {
          handler(params);
        });
      }
      onDidDeleteFiles(handler) {
        return this.connection.onNotification(vscode_languageserver_protocol_1.DidDeleteFilesNotification.type, (params) => {
          handler(params);
        });
      }
      onWillCreateFiles(handler) {
        return this.connection.onRequest(vscode_languageserver_protocol_1.WillCreateFilesRequest.type, (params, cancel) => {
          return handler(params, cancel);
        });
      }
      onWillRenameFiles(handler) {
        return this.connection.onRequest(vscode_languageserver_protocol_1.WillRenameFilesRequest.type, (params, cancel) => {
          return handler(params, cancel);
        });
      }
      onWillDeleteFiles(handler) {
        return this.connection.onRequest(vscode_languageserver_protocol_1.WillDeleteFilesRequest.type, (params, cancel) => {
          return handler(params, cancel);
        });
      }
    };
  };
  exports.FileOperationsFeature = FileOperationsFeature;
});

// node_modules/vscode-languageserver/lib/common/linkedEditingRange.js
var require_linkedEditingRange = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.LinkedEditingRangeFeature = undefined;
  var vscode_languageserver_protocol_1 = require_main3();
  var LinkedEditingRangeFeature = (Base) => {
    return class extends Base {
      onLinkedEditingRange(handler) {
        return this.connection.onRequest(vscode_languageserver_protocol_1.LinkedEditingRangeRequest.type, (params, cancel) => {
          return handler(params, cancel, this.attachWorkDoneProgress(params), undefined);
        });
      }
    };
  };
  exports.LinkedEditingRangeFeature = LinkedEditingRangeFeature;
});

// node_modules/vscode-languageserver/lib/common/typeHierarchy.js
var require_typeHierarchy = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.TypeHierarchyFeature = undefined;
  var vscode_languageserver_protocol_1 = require_main3();
  var TypeHierarchyFeature = (Base) => {
    return class extends Base {
      get typeHierarchy() {
        return {
          onPrepare: (handler) => {
            return this.connection.onRequest(vscode_languageserver_protocol_1.TypeHierarchyPrepareRequest.type, (params, cancel) => {
              return handler(params, cancel, this.attachWorkDoneProgress(params), undefined);
            });
          },
          onSupertypes: (handler) => {
            const type = vscode_languageserver_protocol_1.TypeHierarchySupertypesRequest.type;
            return this.connection.onRequest(type, (params, cancel) => {
              return handler(params, cancel, this.attachWorkDoneProgress(params), this.attachPartialResultProgress(type, params));
            });
          },
          onSubtypes: (handler) => {
            const type = vscode_languageserver_protocol_1.TypeHierarchySubtypesRequest.type;
            return this.connection.onRequest(type, (params, cancel) => {
              return handler(params, cancel, this.attachWorkDoneProgress(params), this.attachPartialResultProgress(type, params));
            });
          }
        };
      }
    };
  };
  exports.TypeHierarchyFeature = TypeHierarchyFeature;
});

// node_modules/vscode-languageserver/lib/common/inlineValue.js
var require_inlineValue = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.InlineValueFeature = undefined;
  var vscode_languageserver_protocol_1 = require_main3();
  var InlineValueFeature = (Base) => {
    return class extends Base {
      get inlineValue() {
        return {
          refresh: () => {
            return this.connection.sendRequest(vscode_languageserver_protocol_1.InlineValueRefreshRequest.type);
          },
          on: (handler) => {
            return this.connection.onRequest(vscode_languageserver_protocol_1.InlineValueRequest.type, (params, cancel) => {
              return handler(params, cancel, this.attachWorkDoneProgress(params));
            });
          }
        };
      }
    };
  };
  exports.InlineValueFeature = InlineValueFeature;
});

// node_modules/vscode-languageserver/lib/common/foldingRange.js
var require_foldingRange = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.FoldingRangeFeature = undefined;
  var vscode_languageserver_protocol_1 = require_main3();
  var FoldingRangeFeature = (Base) => {
    return class extends Base {
      get foldingRange() {
        return {
          refresh: () => {
            return this.connection.sendRequest(vscode_languageserver_protocol_1.FoldingRangeRefreshRequest.type);
          },
          on: (handler) => {
            const type = vscode_languageserver_protocol_1.FoldingRangeRequest.type;
            return this.connection.onRequest(type, (params, cancel) => {
              return handler(params, cancel, this.attachWorkDoneProgress(params), this.attachPartialResultProgress(type, params));
            });
          }
        };
      }
    };
  };
  exports.FoldingRangeFeature = FoldingRangeFeature;
});

// node_modules/vscode-languageserver/lib/common/inlayHint.js
var require_inlayHint = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.InlayHintFeature = undefined;
  var vscode_languageserver_protocol_1 = require_main3();
  var InlayHintFeature = (Base) => {
    return class extends Base {
      get inlayHint() {
        return {
          refresh: () => {
            return this.connection.sendRequest(vscode_languageserver_protocol_1.InlayHintRefreshRequest.type);
          },
          on: (handler) => {
            return this.connection.onRequest(vscode_languageserver_protocol_1.InlayHintRequest.type, (params, cancel) => {
              return handler(params, cancel, this.attachWorkDoneProgress(params));
            });
          },
          resolve: (handler) => {
            return this.connection.onRequest(vscode_languageserver_protocol_1.InlayHintResolveRequest.type, (params, cancel) => {
              return handler(params, cancel);
            });
          }
        };
      }
    };
  };
  exports.InlayHintFeature = InlayHintFeature;
});

// node_modules/vscode-languageserver/lib/common/diagnostic.js
var require_diagnostic = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.DiagnosticFeature = undefined;
  var vscode_languageserver_protocol_1 = require_main3();
  var DiagnosticFeature = (Base) => {
    return class extends Base {
      get diagnostics() {
        return {
          refresh: () => {
            return this.connection.sendRequest(vscode_languageserver_protocol_1.DiagnosticRefreshRequest.type);
          },
          on: (handler) => {
            return this.connection.onRequest(vscode_languageserver_protocol_1.DocumentDiagnosticRequest.type, (params, cancel) => {
              return handler(params, cancel, this.attachWorkDoneProgress(params), this.attachPartialResultProgress(vscode_languageserver_protocol_1.DocumentDiagnosticRequest.partialResult, params));
            });
          },
          onWorkspace: (handler) => {
            return this.connection.onRequest(vscode_languageserver_protocol_1.WorkspaceDiagnosticRequest.type, (params, cancel) => {
              return handler(params, cancel, this.attachWorkDoneProgress(params), this.attachPartialResultProgress(vscode_languageserver_protocol_1.WorkspaceDiagnosticRequest.partialResult, params));
            });
          }
        };
      }
    };
  };
  exports.DiagnosticFeature = DiagnosticFeature;
});

// node_modules/vscode-languageserver/lib/common/textDocuments.js
var require_textDocuments = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.TextDocuments = undefined;
  var vscode_languageserver_protocol_1 = require_main3();

  class TextDocuments {
    constructor(configuration) {
      this._configuration = configuration;
      this._syncedDocuments = new Map;
      this._onDidChangeContent = new vscode_languageserver_protocol_1.Emitter;
      this._onDidOpen = new vscode_languageserver_protocol_1.Emitter;
      this._onDidClose = new vscode_languageserver_protocol_1.Emitter;
      this._onDidSave = new vscode_languageserver_protocol_1.Emitter;
      this._onWillSave = new vscode_languageserver_protocol_1.Emitter;
    }
    get onDidOpen() {
      return this._onDidOpen.event;
    }
    get onDidChangeContent() {
      return this._onDidChangeContent.event;
    }
    get onWillSave() {
      return this._onWillSave.event;
    }
    onWillSaveWaitUntil(handler) {
      this._willSaveWaitUntil = handler;
    }
    get onDidSave() {
      return this._onDidSave.event;
    }
    get onDidClose() {
      return this._onDidClose.event;
    }
    get(uri) {
      return this._syncedDocuments.get(uri);
    }
    all() {
      return Array.from(this._syncedDocuments.values());
    }
    keys() {
      return Array.from(this._syncedDocuments.keys());
    }
    listen(connection) {
      connection.__textDocumentSync = vscode_languageserver_protocol_1.TextDocumentSyncKind.Incremental;
      const disposables = [];
      disposables.push(connection.onDidOpenTextDocument((event) => {
        const td = event.textDocument;
        const document = this._configuration.create(td.uri, td.languageId, td.version, td.text);
        this._syncedDocuments.set(td.uri, document);
        const toFire = Object.freeze({ document });
        this._onDidOpen.fire(toFire);
        this._onDidChangeContent.fire(toFire);
      }));
      disposables.push(connection.onDidChangeTextDocument((event) => {
        const td = event.textDocument;
        const changes = event.contentChanges;
        if (changes.length === 0) {
          return;
        }
        const { version } = td;
        if (version === null || version === undefined) {
          throw new Error(`Received document change event for ${td.uri} without valid version identifier`);
        }
        let syncedDocument = this._syncedDocuments.get(td.uri);
        if (syncedDocument !== undefined) {
          syncedDocument = this._configuration.update(syncedDocument, changes, version);
          this._syncedDocuments.set(td.uri, syncedDocument);
          this._onDidChangeContent.fire(Object.freeze({ document: syncedDocument }));
        }
      }));
      disposables.push(connection.onDidCloseTextDocument((event) => {
        let syncedDocument = this._syncedDocuments.get(event.textDocument.uri);
        if (syncedDocument !== undefined) {
          this._syncedDocuments.delete(event.textDocument.uri);
          this._onDidClose.fire(Object.freeze({ document: syncedDocument }));
        }
      }));
      disposables.push(connection.onWillSaveTextDocument((event) => {
        let syncedDocument = this._syncedDocuments.get(event.textDocument.uri);
        if (syncedDocument !== undefined) {
          this._onWillSave.fire(Object.freeze({ document: syncedDocument, reason: event.reason }));
        }
      }));
      disposables.push(connection.onWillSaveTextDocumentWaitUntil((event, token) => {
        let syncedDocument = this._syncedDocuments.get(event.textDocument.uri);
        if (syncedDocument !== undefined && this._willSaveWaitUntil) {
          return this._willSaveWaitUntil(Object.freeze({ document: syncedDocument, reason: event.reason }), token);
        } else {
          return [];
        }
      }));
      disposables.push(connection.onDidSaveTextDocument((event) => {
        let syncedDocument = this._syncedDocuments.get(event.textDocument.uri);
        if (syncedDocument !== undefined) {
          this._onDidSave.fire(Object.freeze({ document: syncedDocument }));
        }
      }));
      return vscode_languageserver_protocol_1.Disposable.create(() => {
        disposables.forEach((disposable) => disposable.dispose());
      });
    }
  }
  exports.TextDocuments = TextDocuments;
});

// node_modules/vscode-languageserver/lib/common/notebook.js
var require_notebook = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.NotebookDocuments = exports.NotebookSyncFeature = undefined;
  var vscode_languageserver_protocol_1 = require_main3();
  var textDocuments_1 = require_textDocuments();
  var NotebookSyncFeature = (Base) => {
    return class extends Base {
      get synchronization() {
        return {
          onDidOpenNotebookDocument: (handler) => {
            return this.connection.onNotification(vscode_languageserver_protocol_1.DidOpenNotebookDocumentNotification.type, (params) => {
              handler(params);
            });
          },
          onDidChangeNotebookDocument: (handler) => {
            return this.connection.onNotification(vscode_languageserver_protocol_1.DidChangeNotebookDocumentNotification.type, (params) => {
              handler(params);
            });
          },
          onDidSaveNotebookDocument: (handler) => {
            return this.connection.onNotification(vscode_languageserver_protocol_1.DidSaveNotebookDocumentNotification.type, (params) => {
              handler(params);
            });
          },
          onDidCloseNotebookDocument: (handler) => {
            return this.connection.onNotification(vscode_languageserver_protocol_1.DidCloseNotebookDocumentNotification.type, (params) => {
              handler(params);
            });
          }
        };
      }
    };
  };
  exports.NotebookSyncFeature = NotebookSyncFeature;

  class CellTextDocumentConnection {
    onDidOpenTextDocument(handler) {
      this.openHandler = handler;
      return vscode_languageserver_protocol_1.Disposable.create(() => {
        this.openHandler = undefined;
      });
    }
    openTextDocument(params) {
      this.openHandler && this.openHandler(params);
    }
    onDidChangeTextDocument(handler) {
      this.changeHandler = handler;
      return vscode_languageserver_protocol_1.Disposable.create(() => {
        this.changeHandler = handler;
      });
    }
    changeTextDocument(params) {
      this.changeHandler && this.changeHandler(params);
    }
    onDidCloseTextDocument(handler) {
      this.closeHandler = handler;
      return vscode_languageserver_protocol_1.Disposable.create(() => {
        this.closeHandler = undefined;
      });
    }
    closeTextDocument(params) {
      this.closeHandler && this.closeHandler(params);
    }
    onWillSaveTextDocument() {
      return CellTextDocumentConnection.NULL_DISPOSE;
    }
    onWillSaveTextDocumentWaitUntil() {
      return CellTextDocumentConnection.NULL_DISPOSE;
    }
    onDidSaveTextDocument() {
      return CellTextDocumentConnection.NULL_DISPOSE;
    }
  }
  CellTextDocumentConnection.NULL_DISPOSE = Object.freeze({ dispose: () => {} });

  class NotebookDocuments {
    constructor(configurationOrTextDocuments) {
      if (configurationOrTextDocuments instanceof textDocuments_1.TextDocuments) {
        this._cellTextDocuments = configurationOrTextDocuments;
      } else {
        this._cellTextDocuments = new textDocuments_1.TextDocuments(configurationOrTextDocuments);
      }
      this.notebookDocuments = new Map;
      this.notebookCellMap = new Map;
      this._onDidOpen = new vscode_languageserver_protocol_1.Emitter;
      this._onDidChange = new vscode_languageserver_protocol_1.Emitter;
      this._onDidSave = new vscode_languageserver_protocol_1.Emitter;
      this._onDidClose = new vscode_languageserver_protocol_1.Emitter;
    }
    get cellTextDocuments() {
      return this._cellTextDocuments;
    }
    getCellTextDocument(cell) {
      return this._cellTextDocuments.get(cell.document);
    }
    getNotebookDocument(uri) {
      return this.notebookDocuments.get(uri);
    }
    getNotebookCell(uri) {
      const value = this.notebookCellMap.get(uri);
      return value && value[0];
    }
    findNotebookDocumentForCell(cell) {
      const key = typeof cell === "string" ? cell : cell.document;
      const value = this.notebookCellMap.get(key);
      return value && value[1];
    }
    get onDidOpen() {
      return this._onDidOpen.event;
    }
    get onDidSave() {
      return this._onDidSave.event;
    }
    get onDidChange() {
      return this._onDidChange.event;
    }
    get onDidClose() {
      return this._onDidClose.event;
    }
    listen(connection) {
      const cellTextDocumentConnection = new CellTextDocumentConnection;
      const disposables = [];
      disposables.push(this.cellTextDocuments.listen(cellTextDocumentConnection));
      disposables.push(connection.notebooks.synchronization.onDidOpenNotebookDocument((params) => {
        this.notebookDocuments.set(params.notebookDocument.uri, params.notebookDocument);
        for (const cellTextDocument of params.cellTextDocuments) {
          cellTextDocumentConnection.openTextDocument({ textDocument: cellTextDocument });
        }
        this.updateCellMap(params.notebookDocument);
        this._onDidOpen.fire(params.notebookDocument);
      }));
      disposables.push(connection.notebooks.synchronization.onDidChangeNotebookDocument((params) => {
        const notebookDocument = this.notebookDocuments.get(params.notebookDocument.uri);
        if (notebookDocument === undefined) {
          return;
        }
        notebookDocument.version = params.notebookDocument.version;
        const oldMetadata = notebookDocument.metadata;
        let metadataChanged = false;
        const change = params.change;
        if (change.metadata !== undefined) {
          metadataChanged = true;
          notebookDocument.metadata = change.metadata;
        }
        const opened = [];
        const closed = [];
        const data = [];
        const text = [];
        if (change.cells !== undefined) {
          const changedCells = change.cells;
          if (changedCells.structure !== undefined) {
            const array = changedCells.structure.array;
            notebookDocument.cells.splice(array.start, array.deleteCount, ...array.cells !== undefined ? array.cells : []);
            if (changedCells.structure.didOpen !== undefined) {
              for (const open of changedCells.structure.didOpen) {
                cellTextDocumentConnection.openTextDocument({ textDocument: open });
                opened.push(open.uri);
              }
            }
            if (changedCells.structure.didClose) {
              for (const close of changedCells.structure.didClose) {
                cellTextDocumentConnection.closeTextDocument({ textDocument: close });
                closed.push(close.uri);
              }
            }
          }
          if (changedCells.data !== undefined) {
            const cellUpdates = new Map(changedCells.data.map((cell) => [cell.document, cell]));
            for (let i = 0;i <= notebookDocument.cells.length; i++) {
              const change = cellUpdates.get(notebookDocument.cells[i].document);
              if (change !== undefined) {
                const old = notebookDocument.cells.splice(i, 1, change);
                data.push({ old: old[0], new: change });
                cellUpdates.delete(change.document);
                if (cellUpdates.size === 0) {
                  break;
                }
              }
            }
          }
          if (changedCells.textContent !== undefined) {
            for (const cellTextDocument of changedCells.textContent) {
              cellTextDocumentConnection.changeTextDocument({ textDocument: cellTextDocument.document, contentChanges: cellTextDocument.changes });
              text.push(cellTextDocument.document.uri);
            }
          }
        }
        this.updateCellMap(notebookDocument);
        const changeEvent = { notebookDocument };
        if (metadataChanged) {
          changeEvent.metadata = { old: oldMetadata, new: notebookDocument.metadata };
        }
        const added = [];
        for (const open of opened) {
          added.push(this.getNotebookCell(open));
        }
        const removed = [];
        for (const close of closed) {
          removed.push(this.getNotebookCell(close));
        }
        const textContent = [];
        for (const change of text) {
          textContent.push(this.getNotebookCell(change));
        }
        if (added.length > 0 || removed.length > 0 || data.length > 0 || textContent.length > 0) {
          changeEvent.cells = { added, removed, changed: { data, textContent } };
        }
        if (changeEvent.metadata !== undefined || changeEvent.cells !== undefined) {
          this._onDidChange.fire(changeEvent);
        }
      }));
      disposables.push(connection.notebooks.synchronization.onDidSaveNotebookDocument((params) => {
        const notebookDocument = this.notebookDocuments.get(params.notebookDocument.uri);
        if (notebookDocument === undefined) {
          return;
        }
        this._onDidSave.fire(notebookDocument);
      }));
      disposables.push(connection.notebooks.synchronization.onDidCloseNotebookDocument((params) => {
        const notebookDocument = this.notebookDocuments.get(params.notebookDocument.uri);
        if (notebookDocument === undefined) {
          return;
        }
        this._onDidClose.fire(notebookDocument);
        for (const cellTextDocument of params.cellTextDocuments) {
          cellTextDocumentConnection.closeTextDocument({ textDocument: cellTextDocument });
        }
        this.notebookDocuments.delete(params.notebookDocument.uri);
        for (const cell of notebookDocument.cells) {
          this.notebookCellMap.delete(cell.document);
        }
      }));
      return vscode_languageserver_protocol_1.Disposable.create(() => {
        disposables.forEach((disposable) => disposable.dispose());
      });
    }
    updateCellMap(notebookDocument) {
      for (const cell of notebookDocument.cells) {
        this.notebookCellMap.set(cell.document, [cell, notebookDocument]);
      }
    }
  }
  exports.NotebookDocuments = NotebookDocuments;
});

// node_modules/vscode-languageserver/lib/common/moniker.js
var require_moniker = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.MonikerFeature = undefined;
  var vscode_languageserver_protocol_1 = require_main3();
  var MonikerFeature = (Base) => {
    return class extends Base {
      get moniker() {
        return {
          on: (handler) => {
            const type = vscode_languageserver_protocol_1.MonikerRequest.type;
            return this.connection.onRequest(type, (params, cancel) => {
              return handler(params, cancel, this.attachWorkDoneProgress(params), this.attachPartialResultProgress(type, params));
            });
          }
        };
      }
    };
  };
  exports.MonikerFeature = MonikerFeature;
});

// node_modules/vscode-languageserver/lib/common/server.js
var require_server = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.createConnection = exports.combineFeatures = exports.combineNotebooksFeatures = exports.combineLanguagesFeatures = exports.combineWorkspaceFeatures = exports.combineWindowFeatures = exports.combineClientFeatures = exports.combineTracerFeatures = exports.combineTelemetryFeatures = exports.combineConsoleFeatures = exports._NotebooksImpl = exports._LanguagesImpl = exports.BulkUnregistration = exports.BulkRegistration = exports.ErrorMessageTracker = undefined;
  var vscode_languageserver_protocol_1 = require_main3();
  var Is = require_is();
  var UUID = require_uuid();
  var progress_1 = require_progress();
  var configuration_1 = require_configuration();
  var workspaceFolder_1 = require_workspaceFolder();
  var callHierarchy_1 = require_callHierarchy();
  var semanticTokens_1 = require_semanticTokens();
  var showDocument_1 = require_showDocument();
  var fileOperations_1 = require_fileOperations();
  var linkedEditingRange_1 = require_linkedEditingRange();
  var typeHierarchy_1 = require_typeHierarchy();
  var inlineValue_1 = require_inlineValue();
  var foldingRange_1 = require_foldingRange();
  var inlayHint_1 = require_inlayHint();
  var diagnostic_1 = require_diagnostic();
  var notebook_1 = require_notebook();
  var moniker_1 = require_moniker();
  function null2Undefined(value) {
    if (value === null) {
      return;
    }
    return value;
  }

  class ErrorMessageTracker {
    constructor() {
      this._messages = Object.create(null);
    }
    add(message) {
      let count = this._messages[message];
      if (!count) {
        count = 0;
      }
      count++;
      this._messages[message] = count;
    }
    sendErrors(connection) {
      Object.keys(this._messages).forEach((message) => {
        connection.window.showErrorMessage(message);
      });
    }
  }
  exports.ErrorMessageTracker = ErrorMessageTracker;

  class RemoteConsoleImpl {
    constructor() {}
    rawAttach(connection) {
      this._rawConnection = connection;
    }
    attach(connection) {
      this._connection = connection;
    }
    get connection() {
      if (!this._connection) {
        throw new Error("Remote is not attached to a connection yet.");
      }
      return this._connection;
    }
    fillServerCapabilities(_capabilities) {}
    initialize(_capabilities) {}
    error(message) {
      this.send(vscode_languageserver_protocol_1.MessageType.Error, message);
    }
    warn(message) {
      this.send(vscode_languageserver_protocol_1.MessageType.Warning, message);
    }
    info(message) {
      this.send(vscode_languageserver_protocol_1.MessageType.Info, message);
    }
    log(message) {
      this.send(vscode_languageserver_protocol_1.MessageType.Log, message);
    }
    debug(message) {
      this.send(vscode_languageserver_protocol_1.MessageType.Debug, message);
    }
    send(type, message) {
      if (this._rawConnection) {
        this._rawConnection.sendNotification(vscode_languageserver_protocol_1.LogMessageNotification.type, { type, message }).catch(() => {
          (0, vscode_languageserver_protocol_1.RAL)().console.error(`Sending log message failed`);
        });
      }
    }
  }

  class _RemoteWindowImpl {
    constructor() {}
    attach(connection) {
      this._connection = connection;
    }
    get connection() {
      if (!this._connection) {
        throw new Error("Remote is not attached to a connection yet.");
      }
      return this._connection;
    }
    initialize(_capabilities) {}
    fillServerCapabilities(_capabilities) {}
    showErrorMessage(message, ...actions) {
      let params = { type: vscode_languageserver_protocol_1.MessageType.Error, message, actions };
      return this.connection.sendRequest(vscode_languageserver_protocol_1.ShowMessageRequest.type, params).then(null2Undefined);
    }
    showWarningMessage(message, ...actions) {
      let params = { type: vscode_languageserver_protocol_1.MessageType.Warning, message, actions };
      return this.connection.sendRequest(vscode_languageserver_protocol_1.ShowMessageRequest.type, params).then(null2Undefined);
    }
    showInformationMessage(message, ...actions) {
      let params = { type: vscode_languageserver_protocol_1.MessageType.Info, message, actions };
      return this.connection.sendRequest(vscode_languageserver_protocol_1.ShowMessageRequest.type, params).then(null2Undefined);
    }
  }
  var RemoteWindowImpl = (0, showDocument_1.ShowDocumentFeature)((0, progress_1.ProgressFeature)(_RemoteWindowImpl));
  var BulkRegistration;
  (function(BulkRegistration) {
    function create() {
      return new BulkRegistrationImpl;
    }
    BulkRegistration.create = create;
  })(BulkRegistration || (exports.BulkRegistration = BulkRegistration = {}));

  class BulkRegistrationImpl {
    constructor() {
      this._registrations = [];
      this._registered = new Set;
    }
    add(type, registerOptions) {
      const method = Is.string(type) ? type : type.method;
      if (this._registered.has(method)) {
        throw new Error(`${method} is already added to this registration`);
      }
      const id = UUID.generateUuid();
      this._registrations.push({
        id,
        method,
        registerOptions: registerOptions || {}
      });
      this._registered.add(method);
    }
    asRegistrationParams() {
      return {
        registrations: this._registrations
      };
    }
  }
  var BulkUnregistration;
  (function(BulkUnregistration) {
    function create() {
      return new BulkUnregistrationImpl(undefined, []);
    }
    BulkUnregistration.create = create;
  })(BulkUnregistration || (exports.BulkUnregistration = BulkUnregistration = {}));

  class BulkUnregistrationImpl {
    constructor(_connection, unregistrations) {
      this._connection = _connection;
      this._unregistrations = new Map;
      unregistrations.forEach((unregistration) => {
        this._unregistrations.set(unregistration.method, unregistration);
      });
    }
    get isAttached() {
      return !!this._connection;
    }
    attach(connection) {
      this._connection = connection;
    }
    add(unregistration) {
      this._unregistrations.set(unregistration.method, unregistration);
    }
    dispose() {
      let unregistrations = [];
      for (let unregistration of this._unregistrations.values()) {
        unregistrations.push(unregistration);
      }
      let params = {
        unregisterations: unregistrations
      };
      this._connection.sendRequest(vscode_languageserver_protocol_1.UnregistrationRequest.type, params).catch(() => {
        this._connection.console.info(`Bulk unregistration failed.`);
      });
    }
    disposeSingle(arg) {
      const method = Is.string(arg) ? arg : arg.method;
      const unregistration = this._unregistrations.get(method);
      if (!unregistration) {
        return false;
      }
      let params = {
        unregisterations: [unregistration]
      };
      this._connection.sendRequest(vscode_languageserver_protocol_1.UnregistrationRequest.type, params).then(() => {
        this._unregistrations.delete(method);
      }, (_error) => {
        this._connection.console.info(`Un-registering request handler for ${unregistration.id} failed.`);
      });
      return true;
    }
  }

  class RemoteClientImpl {
    attach(connection) {
      this._connection = connection;
    }
    get connection() {
      if (!this._connection) {
        throw new Error("Remote is not attached to a connection yet.");
      }
      return this._connection;
    }
    initialize(_capabilities) {}
    fillServerCapabilities(_capabilities) {}
    register(typeOrRegistrations, registerOptionsOrType, registerOptions) {
      if (typeOrRegistrations instanceof BulkRegistrationImpl) {
        return this.registerMany(typeOrRegistrations);
      } else if (typeOrRegistrations instanceof BulkUnregistrationImpl) {
        return this.registerSingle1(typeOrRegistrations, registerOptionsOrType, registerOptions);
      } else {
        return this.registerSingle2(typeOrRegistrations, registerOptionsOrType);
      }
    }
    registerSingle1(unregistration, type, registerOptions) {
      const method = Is.string(type) ? type : type.method;
      const id = UUID.generateUuid();
      let params = {
        registrations: [{ id, method, registerOptions: registerOptions || {} }]
      };
      if (!unregistration.isAttached) {
        unregistration.attach(this.connection);
      }
      return this.connection.sendRequest(vscode_languageserver_protocol_1.RegistrationRequest.type, params).then((_result) => {
        unregistration.add({ id, method });
        return unregistration;
      }, (_error) => {
        this.connection.console.info(`Registering request handler for ${method} failed.`);
        return Promise.reject(_error);
      });
    }
    registerSingle2(type, registerOptions) {
      const method = Is.string(type) ? type : type.method;
      const id = UUID.generateUuid();
      let params = {
        registrations: [{ id, method, registerOptions: registerOptions || {} }]
      };
      return this.connection.sendRequest(vscode_languageserver_protocol_1.RegistrationRequest.type, params).then((_result) => {
        return vscode_languageserver_protocol_1.Disposable.create(() => {
          this.unregisterSingle(id, method).catch(() => {
            this.connection.console.info(`Un-registering capability with id ${id} failed.`);
          });
        });
      }, (_error) => {
        this.connection.console.info(`Registering request handler for ${method} failed.`);
        return Promise.reject(_error);
      });
    }
    unregisterSingle(id, method) {
      let params = {
        unregisterations: [{ id, method }]
      };
      return this.connection.sendRequest(vscode_languageserver_protocol_1.UnregistrationRequest.type, params).catch(() => {
        this.connection.console.info(`Un-registering request handler for ${id} failed.`);
      });
    }
    registerMany(registrations) {
      let params = registrations.asRegistrationParams();
      return this.connection.sendRequest(vscode_languageserver_protocol_1.RegistrationRequest.type, params).then(() => {
        return new BulkUnregistrationImpl(this._connection, params.registrations.map((registration) => {
          return { id: registration.id, method: registration.method };
        }));
      }, (_error) => {
        this.connection.console.info(`Bulk registration failed.`);
        return Promise.reject(_error);
      });
    }
  }

  class _RemoteWorkspaceImpl {
    constructor() {}
    attach(connection) {
      this._connection = connection;
    }
    get connection() {
      if (!this._connection) {
        throw new Error("Remote is not attached to a connection yet.");
      }
      return this._connection;
    }
    initialize(_capabilities) {}
    fillServerCapabilities(_capabilities) {}
    applyEdit(paramOrEdit) {
      function isApplyWorkspaceEditParams(value) {
        return value && !!value.edit;
      }
      let params = isApplyWorkspaceEditParams(paramOrEdit) ? paramOrEdit : { edit: paramOrEdit };
      return this.connection.sendRequest(vscode_languageserver_protocol_1.ApplyWorkspaceEditRequest.type, params);
    }
  }
  var RemoteWorkspaceImpl = (0, fileOperations_1.FileOperationsFeature)((0, workspaceFolder_1.WorkspaceFoldersFeature)((0, configuration_1.ConfigurationFeature)(_RemoteWorkspaceImpl)));

  class TracerImpl {
    constructor() {
      this._trace = vscode_languageserver_protocol_1.Trace.Off;
    }
    attach(connection) {
      this._connection = connection;
    }
    get connection() {
      if (!this._connection) {
        throw new Error("Remote is not attached to a connection yet.");
      }
      return this._connection;
    }
    initialize(_capabilities) {}
    fillServerCapabilities(_capabilities) {}
    set trace(value) {
      this._trace = value;
    }
    log(message, verbose) {
      if (this._trace === vscode_languageserver_protocol_1.Trace.Off) {
        return;
      }
      this.connection.sendNotification(vscode_languageserver_protocol_1.LogTraceNotification.type, {
        message,
        verbose: this._trace === vscode_languageserver_protocol_1.Trace.Verbose ? verbose : undefined
      }).catch(() => {});
    }
  }

  class TelemetryImpl {
    constructor() {}
    attach(connection) {
      this._connection = connection;
    }
    get connection() {
      if (!this._connection) {
        throw new Error("Remote is not attached to a connection yet.");
      }
      return this._connection;
    }
    initialize(_capabilities) {}
    fillServerCapabilities(_capabilities) {}
    logEvent(data) {
      this.connection.sendNotification(vscode_languageserver_protocol_1.TelemetryEventNotification.type, data).catch(() => {
        this.connection.console.log(`Sending TelemetryEventNotification failed`);
      });
    }
  }

  class _LanguagesImpl {
    constructor() {}
    attach(connection) {
      this._connection = connection;
    }
    get connection() {
      if (!this._connection) {
        throw new Error("Remote is not attached to a connection yet.");
      }
      return this._connection;
    }
    initialize(_capabilities) {}
    fillServerCapabilities(_capabilities) {}
    attachWorkDoneProgress(params) {
      return (0, progress_1.attachWorkDone)(this.connection, params);
    }
    attachPartialResultProgress(_type, params) {
      return (0, progress_1.attachPartialResult)(this.connection, params);
    }
  }
  exports._LanguagesImpl = _LanguagesImpl;
  var LanguagesImpl = (0, foldingRange_1.FoldingRangeFeature)((0, moniker_1.MonikerFeature)((0, diagnostic_1.DiagnosticFeature)((0, inlayHint_1.InlayHintFeature)((0, inlineValue_1.InlineValueFeature)((0, typeHierarchy_1.TypeHierarchyFeature)((0, linkedEditingRange_1.LinkedEditingRangeFeature)((0, semanticTokens_1.SemanticTokensFeature)((0, callHierarchy_1.CallHierarchyFeature)(_LanguagesImpl)))))))));

  class _NotebooksImpl {
    constructor() {}
    attach(connection) {
      this._connection = connection;
    }
    get connection() {
      if (!this._connection) {
        throw new Error("Remote is not attached to a connection yet.");
      }
      return this._connection;
    }
    initialize(_capabilities) {}
    fillServerCapabilities(_capabilities) {}
    attachWorkDoneProgress(params) {
      return (0, progress_1.attachWorkDone)(this.connection, params);
    }
    attachPartialResultProgress(_type, params) {
      return (0, progress_1.attachPartialResult)(this.connection, params);
    }
  }
  exports._NotebooksImpl = _NotebooksImpl;
  var NotebooksImpl = (0, notebook_1.NotebookSyncFeature)(_NotebooksImpl);
  function combineConsoleFeatures(one, two) {
    return function(Base) {
      return two(one(Base));
    };
  }
  exports.combineConsoleFeatures = combineConsoleFeatures;
  function combineTelemetryFeatures(one, two) {
    return function(Base) {
      return two(one(Base));
    };
  }
  exports.combineTelemetryFeatures = combineTelemetryFeatures;
  function combineTracerFeatures(one, two) {
    return function(Base) {
      return two(one(Base));
    };
  }
  exports.combineTracerFeatures = combineTracerFeatures;
  function combineClientFeatures(one, two) {
    return function(Base) {
      return two(one(Base));
    };
  }
  exports.combineClientFeatures = combineClientFeatures;
  function combineWindowFeatures(one, two) {
    return function(Base) {
      return two(one(Base));
    };
  }
  exports.combineWindowFeatures = combineWindowFeatures;
  function combineWorkspaceFeatures(one, two) {
    return function(Base) {
      return two(one(Base));
    };
  }
  exports.combineWorkspaceFeatures = combineWorkspaceFeatures;
  function combineLanguagesFeatures(one, two) {
    return function(Base) {
      return two(one(Base));
    };
  }
  exports.combineLanguagesFeatures = combineLanguagesFeatures;
  function combineNotebooksFeatures(one, two) {
    return function(Base) {
      return two(one(Base));
    };
  }
  exports.combineNotebooksFeatures = combineNotebooksFeatures;
  function combineFeatures(one, two) {
    function combine(one, two, func) {
      if (one && two) {
        return func(one, two);
      } else if (one) {
        return one;
      } else {
        return two;
      }
    }
    let result = {
      __brand: "features",
      console: combine(one.console, two.console, combineConsoleFeatures),
      tracer: combine(one.tracer, two.tracer, combineTracerFeatures),
      telemetry: combine(one.telemetry, two.telemetry, combineTelemetryFeatures),
      client: combine(one.client, two.client, combineClientFeatures),
      window: combine(one.window, two.window, combineWindowFeatures),
      workspace: combine(one.workspace, two.workspace, combineWorkspaceFeatures),
      languages: combine(one.languages, two.languages, combineLanguagesFeatures),
      notebooks: combine(one.notebooks, two.notebooks, combineNotebooksFeatures)
    };
    return result;
  }
  exports.combineFeatures = combineFeatures;
  function createConnection(connectionFactory, watchDog, factories) {
    const logger = factories && factories.console ? new (factories.console(RemoteConsoleImpl)) : new RemoteConsoleImpl;
    const connection = connectionFactory(logger);
    logger.rawAttach(connection);
    const tracer = factories && factories.tracer ? new (factories.tracer(TracerImpl)) : new TracerImpl;
    const telemetry = factories && factories.telemetry ? new (factories.telemetry(TelemetryImpl)) : new TelemetryImpl;
    const client = factories && factories.client ? new (factories.client(RemoteClientImpl)) : new RemoteClientImpl;
    const remoteWindow = factories && factories.window ? new (factories.window(RemoteWindowImpl)) : new RemoteWindowImpl;
    const workspace = factories && factories.workspace ? new (factories.workspace(RemoteWorkspaceImpl)) : new RemoteWorkspaceImpl;
    const languages = factories && factories.languages ? new (factories.languages(LanguagesImpl)) : new LanguagesImpl;
    const notebooks = factories && factories.notebooks ? new (factories.notebooks(NotebooksImpl)) : new NotebooksImpl;
    const allRemotes = [logger, tracer, telemetry, client, remoteWindow, workspace, languages, notebooks];
    function asPromise(value) {
      if (value instanceof Promise) {
        return value;
      } else if (Is.thenable(value)) {
        return new Promise((resolve, reject) => {
          value.then((resolved) => resolve(resolved), (error) => reject(error));
        });
      } else {
        return Promise.resolve(value);
      }
    }
    let shutdownHandler = undefined;
    let initializeHandler = undefined;
    let exitHandler = undefined;
    let protocolConnection = {
      listen: () => connection.listen(),
      sendRequest: (type, ...params) => connection.sendRequest(Is.string(type) ? type : type.method, ...params),
      onRequest: (type, handler) => connection.onRequest(type, handler),
      sendNotification: (type, param) => {
        const method = Is.string(type) ? type : type.method;
        return connection.sendNotification(method, param);
      },
      onNotification: (type, handler) => connection.onNotification(type, handler),
      onProgress: connection.onProgress,
      sendProgress: connection.sendProgress,
      onInitialize: (handler) => {
        initializeHandler = handler;
        return {
          dispose: () => {
            initializeHandler = undefined;
          }
        };
      },
      onInitialized: (handler) => connection.onNotification(vscode_languageserver_protocol_1.InitializedNotification.type, handler),
      onShutdown: (handler) => {
        shutdownHandler = handler;
        return {
          dispose: () => {
            shutdownHandler = undefined;
          }
        };
      },
      onExit: (handler) => {
        exitHandler = handler;
        return {
          dispose: () => {
            exitHandler = undefined;
          }
        };
      },
      get console() {
        return logger;
      },
      get telemetry() {
        return telemetry;
      },
      get tracer() {
        return tracer;
      },
      get client() {
        return client;
      },
      get window() {
        return remoteWindow;
      },
      get workspace() {
        return workspace;
      },
      get languages() {
        return languages;
      },
      get notebooks() {
        return notebooks;
      },
      onDidChangeConfiguration: (handler) => connection.onNotification(vscode_languageserver_protocol_1.DidChangeConfigurationNotification.type, handler),
      onDidChangeWatchedFiles: (handler) => connection.onNotification(vscode_languageserver_protocol_1.DidChangeWatchedFilesNotification.type, handler),
      __textDocumentSync: undefined,
      onDidOpenTextDocument: (handler) => connection.onNotification(vscode_languageserver_protocol_1.DidOpenTextDocumentNotification.type, handler),
      onDidChangeTextDocument: (handler) => connection.onNotification(vscode_languageserver_protocol_1.DidChangeTextDocumentNotification.type, handler),
      onDidCloseTextDocument: (handler) => connection.onNotification(vscode_languageserver_protocol_1.DidCloseTextDocumentNotification.type, handler),
      onWillSaveTextDocument: (handler) => connection.onNotification(vscode_languageserver_protocol_1.WillSaveTextDocumentNotification.type, handler),
      onWillSaveTextDocumentWaitUntil: (handler) => connection.onRequest(vscode_languageserver_protocol_1.WillSaveTextDocumentWaitUntilRequest.type, handler),
      onDidSaveTextDocument: (handler) => connection.onNotification(vscode_languageserver_protocol_1.DidSaveTextDocumentNotification.type, handler),
      sendDiagnostics: (params) => connection.sendNotification(vscode_languageserver_protocol_1.PublishDiagnosticsNotification.type, params),
      onHover: (handler) => connection.onRequest(vscode_languageserver_protocol_1.HoverRequest.type, (params, cancel) => {
        return handler(params, cancel, (0, progress_1.attachWorkDone)(connection, params), undefined);
      }),
      onCompletion: (handler) => connection.onRequest(vscode_languageserver_protocol_1.CompletionRequest.type, (params, cancel) => {
        return handler(params, cancel, (0, progress_1.attachWorkDone)(connection, params), (0, progress_1.attachPartialResult)(connection, params));
      }),
      onCompletionResolve: (handler) => connection.onRequest(vscode_languageserver_protocol_1.CompletionResolveRequest.type, handler),
      onSignatureHelp: (handler) => connection.onRequest(vscode_languageserver_protocol_1.SignatureHelpRequest.type, (params, cancel) => {
        return handler(params, cancel, (0, progress_1.attachWorkDone)(connection, params), undefined);
      }),
      onDeclaration: (handler) => connection.onRequest(vscode_languageserver_protocol_1.DeclarationRequest.type, (params, cancel) => {
        return handler(params, cancel, (0, progress_1.attachWorkDone)(connection, params), (0, progress_1.attachPartialResult)(connection, params));
      }),
      onDefinition: (handler) => connection.onRequest(vscode_languageserver_protocol_1.DefinitionRequest.type, (params, cancel) => {
        return handler(params, cancel, (0, progress_1.attachWorkDone)(connection, params), (0, progress_1.attachPartialResult)(connection, params));
      }),
      onTypeDefinition: (handler) => connection.onRequest(vscode_languageserver_protocol_1.TypeDefinitionRequest.type, (params, cancel) => {
        return handler(params, cancel, (0, progress_1.attachWorkDone)(connection, params), (0, progress_1.attachPartialResult)(connection, params));
      }),
      onImplementation: (handler) => connection.onRequest(vscode_languageserver_protocol_1.ImplementationRequest.type, (params, cancel) => {
        return handler(params, cancel, (0, progress_1.attachWorkDone)(connection, params), (0, progress_1.attachPartialResult)(connection, params));
      }),
      onReferences: (handler) => connection.onRequest(vscode_languageserver_protocol_1.ReferencesRequest.type, (params, cancel) => {
        return handler(params, cancel, (0, progress_1.attachWorkDone)(connection, params), (0, progress_1.attachPartialResult)(connection, params));
      }),
      onDocumentHighlight: (handler) => connection.onRequest(vscode_languageserver_protocol_1.DocumentHighlightRequest.type, (params, cancel) => {
        return handler(params, cancel, (0, progress_1.attachWorkDone)(connection, params), (0, progress_1.attachPartialResult)(connection, params));
      }),
      onDocumentSymbol: (handler) => connection.onRequest(vscode_languageserver_protocol_1.DocumentSymbolRequest.type, (params, cancel) => {
        return handler(params, cancel, (0, progress_1.attachWorkDone)(connection, params), (0, progress_1.attachPartialResult)(connection, params));
      }),
      onWorkspaceSymbol: (handler) => connection.onRequest(vscode_languageserver_protocol_1.WorkspaceSymbolRequest.type, (params, cancel) => {
        return handler(params, cancel, (0, progress_1.attachWorkDone)(connection, params), (0, progress_1.attachPartialResult)(connection, params));
      }),
      onWorkspaceSymbolResolve: (handler) => connection.onRequest(vscode_languageserver_protocol_1.WorkspaceSymbolResolveRequest.type, handler),
      onCodeAction: (handler) => connection.onRequest(vscode_languageserver_protocol_1.CodeActionRequest.type, (params, cancel) => {
        return handler(params, cancel, (0, progress_1.attachWorkDone)(connection, params), (0, progress_1.attachPartialResult)(connection, params));
      }),
      onCodeActionResolve: (handler) => connection.onRequest(vscode_languageserver_protocol_1.CodeActionResolveRequest.type, (params, cancel) => {
        return handler(params, cancel);
      }),
      onCodeLens: (handler) => connection.onRequest(vscode_languageserver_protocol_1.CodeLensRequest.type, (params, cancel) => {
        return handler(params, cancel, (0, progress_1.attachWorkDone)(connection, params), (0, progress_1.attachPartialResult)(connection, params));
      }),
      onCodeLensResolve: (handler) => connection.onRequest(vscode_languageserver_protocol_1.CodeLensResolveRequest.type, (params, cancel) => {
        return handler(params, cancel);
      }),
      onDocumentFormatting: (handler) => connection.onRequest(vscode_languageserver_protocol_1.DocumentFormattingRequest.type, (params, cancel) => {
        return handler(params, cancel, (0, progress_1.attachWorkDone)(connection, params), undefined);
      }),
      onDocumentRangeFormatting: (handler) => connection.onRequest(vscode_languageserver_protocol_1.DocumentRangeFormattingRequest.type, (params, cancel) => {
        return handler(params, cancel, (0, progress_1.attachWorkDone)(connection, params), undefined);
      }),
      onDocumentOnTypeFormatting: (handler) => connection.onRequest(vscode_languageserver_protocol_1.DocumentOnTypeFormattingRequest.type, (params, cancel) => {
        return handler(params, cancel);
      }),
      onRenameRequest: (handler) => connection.onRequest(vscode_languageserver_protocol_1.RenameRequest.type, (params, cancel) => {
        return handler(params, cancel, (0, progress_1.attachWorkDone)(connection, params), undefined);
      }),
      onPrepareRename: (handler) => connection.onRequest(vscode_languageserver_protocol_1.PrepareRenameRequest.type, (params, cancel) => {
        return handler(params, cancel);
      }),
      onDocumentLinks: (handler) => connection.onRequest(vscode_languageserver_protocol_1.DocumentLinkRequest.type, (params, cancel) => {
        return handler(params, cancel, (0, progress_1.attachWorkDone)(connection, params), (0, progress_1.attachPartialResult)(connection, params));
      }),
      onDocumentLinkResolve: (handler) => connection.onRequest(vscode_languageserver_protocol_1.DocumentLinkResolveRequest.type, (params, cancel) => {
        return handler(params, cancel);
      }),
      onDocumentColor: (handler) => connection.onRequest(vscode_languageserver_protocol_1.DocumentColorRequest.type, (params, cancel) => {
        return handler(params, cancel, (0, progress_1.attachWorkDone)(connection, params), (0, progress_1.attachPartialResult)(connection, params));
      }),
      onColorPresentation: (handler) => connection.onRequest(vscode_languageserver_protocol_1.ColorPresentationRequest.type, (params, cancel) => {
        return handler(params, cancel, (0, progress_1.attachWorkDone)(connection, params), (0, progress_1.attachPartialResult)(connection, params));
      }),
      onFoldingRanges: (handler) => connection.onRequest(vscode_languageserver_protocol_1.FoldingRangeRequest.type, (params, cancel) => {
        return handler(params, cancel, (0, progress_1.attachWorkDone)(connection, params), (0, progress_1.attachPartialResult)(connection, params));
      }),
      onSelectionRanges: (handler) => connection.onRequest(vscode_languageserver_protocol_1.SelectionRangeRequest.type, (params, cancel) => {
        return handler(params, cancel, (0, progress_1.attachWorkDone)(connection, params), (0, progress_1.attachPartialResult)(connection, params));
      }),
      onExecuteCommand: (handler) => connection.onRequest(vscode_languageserver_protocol_1.ExecuteCommandRequest.type, (params, cancel) => {
        return handler(params, cancel, (0, progress_1.attachWorkDone)(connection, params), undefined);
      }),
      dispose: () => connection.dispose()
    };
    for (let remote of allRemotes) {
      remote.attach(protocolConnection);
    }
    connection.onRequest(vscode_languageserver_protocol_1.InitializeRequest.type, (params) => {
      watchDog.initialize(params);
      if (Is.string(params.trace)) {
        tracer.trace = vscode_languageserver_protocol_1.Trace.fromString(params.trace);
      }
      for (let remote of allRemotes) {
        remote.initialize(params.capabilities);
      }
      if (initializeHandler) {
        let result = initializeHandler(params, new vscode_languageserver_protocol_1.CancellationTokenSource().token, (0, progress_1.attachWorkDone)(connection, params), undefined);
        return asPromise(result).then((value) => {
          if (value instanceof vscode_languageserver_protocol_1.ResponseError) {
            return value;
          }
          let result = value;
          if (!result) {
            result = { capabilities: {} };
          }
          let capabilities = result.capabilities;
          if (!capabilities) {
            capabilities = {};
            result.capabilities = capabilities;
          }
          if (capabilities.textDocumentSync === undefined || capabilities.textDocumentSync === null) {
            capabilities.textDocumentSync = Is.number(protocolConnection.__textDocumentSync) ? protocolConnection.__textDocumentSync : vscode_languageserver_protocol_1.TextDocumentSyncKind.None;
          } else if (!Is.number(capabilities.textDocumentSync) && !Is.number(capabilities.textDocumentSync.change)) {
            capabilities.textDocumentSync.change = Is.number(protocolConnection.__textDocumentSync) ? protocolConnection.__textDocumentSync : vscode_languageserver_protocol_1.TextDocumentSyncKind.None;
          }
          for (let remote of allRemotes) {
            remote.fillServerCapabilities(capabilities);
          }
          return result;
        });
      } else {
        let result = { capabilities: { textDocumentSync: vscode_languageserver_protocol_1.TextDocumentSyncKind.None } };
        for (let remote of allRemotes) {
          remote.fillServerCapabilities(result.capabilities);
        }
        return result;
      }
    });
    connection.onRequest(vscode_languageserver_protocol_1.ShutdownRequest.type, () => {
      watchDog.shutdownReceived = true;
      if (shutdownHandler) {
        return shutdownHandler(new vscode_languageserver_protocol_1.CancellationTokenSource().token);
      } else {
        return;
      }
    });
    connection.onNotification(vscode_languageserver_protocol_1.ExitNotification.type, () => {
      try {
        if (exitHandler) {
          exitHandler();
        }
      } finally {
        if (watchDog.shutdownReceived) {
          watchDog.exit(0);
        } else {
          watchDog.exit(1);
        }
      }
    });
    connection.onNotification(vscode_languageserver_protocol_1.SetTraceNotification.type, (params) => {
      tracer.trace = vscode_languageserver_protocol_1.Trace.fromString(params.value);
    });
    return protocolConnection;
  }
  exports.createConnection = createConnection;
});

// node_modules/vscode-languageserver/lib/node/files.js
var require_files = __commonJS(function(exports) {
  var __filename = "/Users/cmj/projects/oneshots/langly/.claude/worktrees/deep-work-4ed0fb/node_modules/vscode-languageserver/lib/node/files.js";
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.resolveModulePath = exports.FileSystem = exports.resolveGlobalYarnPath = exports.resolveGlobalNodePath = exports.resolve = exports.uriToFilePath = undefined;
  var url = __require("url");
  var path = __require("path");
  var fs = __require("fs");
  var child_process_1 = __require("child_process");
  function uriToFilePath(uri) {
    let parsed = url.parse(uri);
    if (parsed.protocol !== "file:" || !parsed.path) {
      return;
    }
    let segments = parsed.path.split("/");
    for (var i = 0, len = segments.length;i < len; i++) {
      segments[i] = decodeURIComponent(segments[i]);
    }
    if (process.platform === "win32" && segments.length > 1) {
      let first = segments[0];
      let second = segments[1];
      if (first.length === 0 && second.length > 1 && second[1] === ":") {
        segments.shift();
      }
    }
    return path.normalize(segments.join("/"));
  }
  exports.uriToFilePath = uriToFilePath;
  function isWindows() {
    return process.platform === "win32";
  }
  function resolve(moduleName, nodePath, cwd, tracer) {
    const nodePathKey = "NODE_PATH";
    const app = [
      "var p = process;",
      "p.on('message',function(m){",
      "if(m.c==='e'){",
      "p.exit(0);",
      "}",
      "else if(m.c==='rs'){",
      "try{",
      "var r=require.resolve(m.a);",
      "p.send({c:'r',s:true,r:r});",
      "}",
      "catch(err){",
      "p.send({c:'r',s:false});",
      "}",
      "}",
      "});"
    ].join("");
    return new Promise((resolve, reject) => {
      let env = process.env;
      let newEnv = Object.create(null);
      Object.keys(env).forEach((key) => newEnv[key] = env[key]);
      if (nodePath && fs.existsSync(nodePath)) {
        if (newEnv[nodePathKey]) {
          newEnv[nodePathKey] = nodePath + path.delimiter + newEnv[nodePathKey];
        } else {
          newEnv[nodePathKey] = nodePath;
        }
        if (tracer) {
          tracer(`NODE_PATH value is: ${newEnv[nodePathKey]}`);
        }
      }
      newEnv["ELECTRON_RUN_AS_NODE"] = "1";
      try {
        let cp = (0, child_process_1.fork)("", [], {
          cwd,
          env: newEnv,
          execArgv: ["-e", app]
        });
        if (cp.pid === undefined) {
          reject(new Error(`Starting process to resolve node module  ${moduleName} failed`));
          return;
        }
        cp.on("error", (error) => {
          reject(error);
        });
        cp.on("message", (message) => {
          if (message.c === "r") {
            cp.send({ c: "e" });
            if (message.s) {
              resolve(message.r);
            } else {
              reject(new Error(`Failed to resolve module: ${moduleName}`));
            }
          }
        });
        let message = {
          c: "rs",
          a: moduleName
        };
        cp.send(message);
      } catch (error) {
        reject(error);
      }
    });
  }
  exports.resolve = resolve;
  function resolveGlobalNodePath(tracer) {
    let npmCommand = "npm";
    const env = Object.create(null);
    Object.keys(process.env).forEach((key) => env[key] = process.env[key]);
    env["NO_UPDATE_NOTIFIER"] = "true";
    const options = {
      encoding: "utf8",
      env
    };
    if (isWindows()) {
      npmCommand = "npm.cmd";
      options.shell = true;
    }
    let handler = () => {};
    try {
      process.on("SIGPIPE", handler);
      let stdout = (0, child_process_1.spawnSync)(npmCommand, ["config", "get", "prefix"], options).stdout;
      if (!stdout) {
        if (tracer) {
          tracer(`'npm config get prefix' didn't return a value.`);
        }
        return;
      }
      let prefix = stdout.trim();
      if (tracer) {
        tracer(`'npm config get prefix' value is: ${prefix}`);
      }
      if (prefix.length > 0) {
        if (isWindows()) {
          return path.join(prefix, "node_modules");
        } else {
          return path.join(prefix, "lib", "node_modules");
        }
      }
      return;
    } catch (err) {
      return;
    } finally {
      process.removeListener("SIGPIPE", handler);
    }
  }
  exports.resolveGlobalNodePath = resolveGlobalNodePath;
  function resolveGlobalYarnPath(tracer) {
    let yarnCommand = "yarn";
    let options = {
      encoding: "utf8"
    };
    if (isWindows()) {
      yarnCommand = "yarn.cmd";
      options.shell = true;
    }
    let handler = () => {};
    try {
      process.on("SIGPIPE", handler);
      let results = (0, child_process_1.spawnSync)(yarnCommand, ["global", "dir", "--json"], options);
      let stdout = results.stdout;
      if (!stdout) {
        if (tracer) {
          tracer(`'yarn global dir' didn't return a value.`);
          if (results.stderr) {
            tracer(results.stderr);
          }
        }
        return;
      }
      let lines = stdout.trim().split(/\r?\n/);
      for (let line of lines) {
        try {
          let yarn = JSON.parse(line);
          if (yarn.type === "log") {
            return path.join(yarn.data, "node_modules");
          }
        } catch (e) {}
      }
      return;
    } catch (err) {
      return;
    } finally {
      process.removeListener("SIGPIPE", handler);
    }
  }
  exports.resolveGlobalYarnPath = resolveGlobalYarnPath;
  var FileSystem;
  (function(FileSystem) {
    let _isCaseSensitive = undefined;
    function isCaseSensitive() {
      if (_isCaseSensitive !== undefined) {
        return _isCaseSensitive;
      }
      if (process.platform === "win32") {
        _isCaseSensitive = false;
      } else {
        _isCaseSensitive = !fs.existsSync(__filename.toUpperCase()) || !fs.existsSync(__filename.toLowerCase());
      }
      return _isCaseSensitive;
    }
    FileSystem.isCaseSensitive = isCaseSensitive;
    function isParent(parent, child) {
      if (isCaseSensitive()) {
        return path.normalize(child).indexOf(path.normalize(parent)) === 0;
      } else {
        return path.normalize(child).toLowerCase().indexOf(path.normalize(parent).toLowerCase()) === 0;
      }
    }
    FileSystem.isParent = isParent;
  })(FileSystem || (exports.FileSystem = FileSystem = {}));
  function resolveModulePath(workspaceRoot, moduleName, nodePath, tracer) {
    if (nodePath) {
      if (!path.isAbsolute(nodePath)) {
        nodePath = path.join(workspaceRoot, nodePath);
      }
      return resolve(moduleName, nodePath, nodePath, tracer).then((value) => {
        if (FileSystem.isParent(nodePath, value)) {
          return value;
        } else {
          return Promise.reject(new Error(`Failed to load ${moduleName} from node path location.`));
        }
      }).then(undefined, (_error) => {
        return resolve(moduleName, resolveGlobalNodePath(tracer), workspaceRoot, tracer);
      });
    } else {
      return resolve(moduleName, resolveGlobalNodePath(tracer), workspaceRoot, tracer);
    }
  }
  exports.resolveModulePath = resolveModulePath;
});

// node_modules/vscode-languageserver/lib/common/inlineCompletion.proposed.js
var require_inlineCompletion_proposed = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.InlineCompletionFeature = undefined;
  var vscode_languageserver_protocol_1 = require_main3();
  var InlineCompletionFeature = (Base) => {
    return class extends Base {
      get inlineCompletion() {
        return {
          on: (handler) => {
            return this.connection.onRequest(vscode_languageserver_protocol_1.InlineCompletionRequest.type, (params, cancel) => {
              return handler(params, cancel, this.attachWorkDoneProgress(params));
            });
          }
        };
      }
    };
  };
  exports.InlineCompletionFeature = InlineCompletionFeature;
});

// node_modules/vscode-languageserver/lib/common/api.js
var require_api3 = __commonJS(function(exports) {
  var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined)
      k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() {
        return m[k];
      } };
    }
    Object.defineProperty(o, k2, desc);
  } : function(o, m, k, k2) {
    if (k2 === undefined)
      k2 = k;
    o[k2] = m[k];
  });
  var __exportStar = exports && exports.__exportStar || function(m, exports2) {
    for (var p in m)
      if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p))
        __createBinding(exports2, m, p);
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.ProposedFeatures = exports.NotebookDocuments = exports.TextDocuments = exports.SemanticTokensBuilder = undefined;
  var semanticTokens_1 = require_semanticTokens();
  Object.defineProperty(exports, "SemanticTokensBuilder", { enumerable: true, get: function() {
    return semanticTokens_1.SemanticTokensBuilder;
  } });
  var ic = require_inlineCompletion_proposed();
  __exportStar(require_main3(), exports);
  var textDocuments_1 = require_textDocuments();
  Object.defineProperty(exports, "TextDocuments", { enumerable: true, get: function() {
    return textDocuments_1.TextDocuments;
  } });
  var notebook_1 = require_notebook();
  Object.defineProperty(exports, "NotebookDocuments", { enumerable: true, get: function() {
    return notebook_1.NotebookDocuments;
  } });
  __exportStar(require_server(), exports);
  var ProposedFeatures;
  (function(ProposedFeatures) {
    ProposedFeatures.all = {
      __brand: "features",
      languages: ic.InlineCompletionFeature
    };
  })(ProposedFeatures || (exports.ProposedFeatures = ProposedFeatures = {}));
});

// node_modules/vscode-languageserver/lib/node/main.js
var require_main4 = __commonJS(function(exports) {
  var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined)
      k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() {
        return m[k];
      } };
    }
    Object.defineProperty(o, k2, desc);
  } : function(o, m, k, k2) {
    if (k2 === undefined)
      k2 = k;
    o[k2] = m[k];
  });
  var __exportStar = exports && exports.__exportStar || function(m, exports2) {
    for (var p in m)
      if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p))
        __createBinding(exports2, m, p);
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.createConnection = exports.Files = undefined;
  var node_util_1 = __require("node:util");
  var Is = require_is();
  var server_1 = require_server();
  var fm = require_files();
  var node_1 = require_main3();
  __exportStar(require_main3(), exports);
  __exportStar(require_api3(), exports);
  var Files;
  (function(Files) {
    Files.uriToFilePath = fm.uriToFilePath;
    Files.resolveGlobalNodePath = fm.resolveGlobalNodePath;
    Files.resolveGlobalYarnPath = fm.resolveGlobalYarnPath;
    Files.resolve = fm.resolve;
    Files.resolveModulePath = fm.resolveModulePath;
  })(Files || (exports.Files = Files = {}));
  var _protocolConnection;
  function endProtocolConnection() {
    if (_protocolConnection === undefined) {
      return;
    }
    try {
      _protocolConnection.end();
    } catch (_err) {}
  }
  var _shutdownReceived = false;
  var exitTimer = undefined;
  function setupExitTimer() {
    const argName = "--clientProcessId";
    function runTimer(value) {
      try {
        let processId = parseInt(value);
        if (!isNaN(processId)) {
          exitTimer = setInterval(() => {
            try {
              process.kill(processId, 0);
            } catch (ex) {
              endProtocolConnection();
              process.exit(_shutdownReceived ? 0 : 1);
            }
          }, 3000);
        }
      } catch (e) {}
    }
    for (let i = 2;i < process.argv.length; i++) {
      let arg = process.argv[i];
      if (arg === argName && i + 1 < process.argv.length) {
        runTimer(process.argv[i + 1]);
        return;
      } else {
        let args = arg.split("=");
        if (args[0] === argName) {
          runTimer(args[1]);
        }
      }
    }
  }
  setupExitTimer();
  var watchDog = {
    initialize: (params) => {
      const processId = params.processId;
      if (Is.number(processId) && exitTimer === undefined) {
        setInterval(() => {
          try {
            process.kill(processId, 0);
          } catch (ex) {
            process.exit(_shutdownReceived ? 0 : 1);
          }
        }, 3000);
      }
    },
    get shutdownReceived() {
      return _shutdownReceived;
    },
    set shutdownReceived(value) {
      _shutdownReceived = value;
    },
    exit: (code) => {
      endProtocolConnection();
      process.exit(code);
    }
  };
  function createConnection(arg1, arg2, arg3, arg4) {
    let factories;
    let input;
    let output;
    let options;
    if (arg1 !== undefined && arg1.__brand === "features") {
      factories = arg1;
      arg1 = arg2;
      arg2 = arg3;
      arg3 = arg4;
    }
    if (node_1.ConnectionStrategy.is(arg1) || node_1.ConnectionOptions.is(arg1)) {
      options = arg1;
    } else {
      input = arg1;
      output = arg2;
      options = arg3;
    }
    return _createConnection(input, output, options, factories);
  }
  exports.createConnection = createConnection;
  function _createConnection(input, output, options, factories) {
    let stdio = false;
    if (!input && !output && process.argv.length > 2) {
      let port = undefined;
      let pipeName = undefined;
      let argv = process.argv.slice(2);
      for (let i = 0;i < argv.length; i++) {
        let arg = argv[i];
        if (arg === "--node-ipc") {
          input = new node_1.IPCMessageReader(process);
          output = new node_1.IPCMessageWriter(process);
          break;
        } else if (arg === "--stdio") {
          stdio = true;
          input = process.stdin;
          output = process.stdout;
          break;
        } else if (arg === "--socket") {
          port = parseInt(argv[i + 1]);
          break;
        } else if (arg === "--pipe") {
          pipeName = argv[i + 1];
          break;
        } else {
          var args = arg.split("=");
          if (args[0] === "--socket") {
            port = parseInt(args[1]);
            break;
          } else if (args[0] === "--pipe") {
            pipeName = args[1];
            break;
          }
        }
      }
      if (port) {
        let transport = (0, node_1.createServerSocketTransport)(port);
        input = transport[0];
        output = transport[1];
      } else if (pipeName) {
        let transport = (0, node_1.createServerPipeTransport)(pipeName);
        input = transport[0];
        output = transport[1];
      }
    }
    var commandLineMessage = "Use arguments of createConnection or set command line parameters: '--node-ipc', '--stdio' or '--socket={number}'";
    if (!input) {
      throw new Error("Connection input stream is not set. " + commandLineMessage);
    }
    if (!output) {
      throw new Error("Connection output stream is not set. " + commandLineMessage);
    }
    if (Is.func(input.read) && Is.func(input.on)) {
      let inputStream = input;
      inputStream.on("end", () => {
        endProtocolConnection();
        process.exit(_shutdownReceived ? 0 : 1);
      });
      inputStream.on("close", () => {
        endProtocolConnection();
        process.exit(_shutdownReceived ? 0 : 1);
      });
    }
    const connectionFactory = (logger) => {
      const result = (0, node_1.createProtocolConnection)(input, output, logger, options);
      if (stdio) {
        patchConsole(logger);
      }
      return result;
    };
    return (0, server_1.createConnection)(connectionFactory, watchDog, factories);
  }
  function patchConsole(logger) {
    function serialize(args) {
      return args.map((arg) => typeof arg === "string" ? arg : (0, node_util_1.inspect)(arg)).join(" ");
    }
    const counters = new Map;
    console.assert = function assert(assertion, ...args) {
      if (assertion) {
        return;
      }
      if (args.length === 0) {
        logger.error("Assertion failed");
      } else {
        const [message, ...rest] = args;
        logger.error(`Assertion failed: ${message} ${serialize(rest)}`);
      }
    };
    console.count = function count(label = "default") {
      const message = String(label);
      let counter = counters.get(message) ?? 0;
      counter += 1;
      counters.set(message, counter);
      logger.log(`${message}: ${message}`);
    };
    console.countReset = function countReset(label) {
      if (label === undefined) {
        counters.clear();
      } else {
        counters.delete(String(label));
      }
    };
    console.debug = function debug(...args) {
      logger.log(serialize(args));
    };
    console.dir = function dir(arg, options) {
      logger.log((0, node_util_1.inspect)(arg, options));
    };
    console.log = function log(...args) {
      logger.log(serialize(args));
    };
    console.error = function error(...args) {
      logger.error(serialize(args));
    };
    console.trace = function trace(...args) {
      const stack = new Error().stack.replace(/(.+\n){2}/, "");
      let message = "Trace";
      if (args.length !== 0) {
        message += `: ${serialize(args)}`;
      }
      logger.log(`${message}
${stack}`);
    };
    console.warn = function warn(...args) {
      logger.warn(serialize(args));
    };
  }
});

// src/lsp/server.ts
var import_node = __toESM(require_main4(), 1);

// node_modules/vscode-languageserver-textdocument/lib/esm/main.js
class FullTextDocument {
  constructor(uri, languageId, version, content) {
    this._uri = uri;
    this._languageId = languageId;
    this._version = version;
    this._content = content;
    this._lineOffsets = undefined;
  }
  get uri() {
    return this._uri;
  }
  get languageId() {
    return this._languageId;
  }
  get version() {
    return this._version;
  }
  getText(range) {
    if (range) {
      const start = this.offsetAt(range.start);
      const end = this.offsetAt(range.end);
      return this._content.substring(start, end);
    }
    return this._content;
  }
  update(changes, version) {
    for (const change of changes) {
      if (FullTextDocument.isIncremental(change)) {
        const range = getWellformedRange(change.range);
        const startOffset = this.offsetAt(range.start);
        const endOffset = this.offsetAt(range.end);
        this._content = this._content.substring(0, startOffset) + change.text + this._content.substring(endOffset, this._content.length);
        const startLine = Math.max(range.start.line, 0);
        const endLine = Math.max(range.end.line, 0);
        let lineOffsets = this._lineOffsets;
        const addedLineOffsets = computeLineOffsets(change.text, false, startOffset);
        if (endLine - startLine === addedLineOffsets.length) {
          for (let i = 0, len = addedLineOffsets.length;i < len; i++) {
            lineOffsets[i + startLine + 1] = addedLineOffsets[i];
          }
        } else {
          if (addedLineOffsets.length < 1e4) {
            lineOffsets.splice(startLine + 1, endLine - startLine, ...addedLineOffsets);
          } else {
            this._lineOffsets = lineOffsets = lineOffsets.slice(0, startLine + 1).concat(addedLineOffsets, lineOffsets.slice(endLine + 1));
          }
        }
        const diff = change.text.length - (endOffset - startOffset);
        if (diff !== 0) {
          for (let i = startLine + 1 + addedLineOffsets.length, len = lineOffsets.length;i < len; i++) {
            lineOffsets[i] = lineOffsets[i] + diff;
          }
        }
      } else if (FullTextDocument.isFull(change)) {
        this._content = change.text;
        this._lineOffsets = undefined;
      } else {
        throw new Error("Unknown change event received");
      }
    }
    this._version = version;
  }
  getLineOffsets() {
    if (this._lineOffsets === undefined) {
      this._lineOffsets = computeLineOffsets(this._content, true);
    }
    return this._lineOffsets;
  }
  positionAt(offset) {
    offset = Math.max(Math.min(offset, this._content.length), 0);
    const lineOffsets = this.getLineOffsets();
    let low = 0, high = lineOffsets.length;
    if (high === 0) {
      return { line: 0, character: offset };
    }
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (lineOffsets[mid] > offset) {
        high = mid;
      } else {
        low = mid + 1;
      }
    }
    const line = low - 1;
    offset = this.ensureBeforeEOL(offset, lineOffsets[line]);
    return { line, character: offset - lineOffsets[line] };
  }
  offsetAt(position) {
    const lineOffsets = this.getLineOffsets();
    if (position.line >= lineOffsets.length) {
      return this._content.length;
    } else if (position.line < 0) {
      return 0;
    }
    const lineOffset = lineOffsets[position.line];
    if (position.character <= 0) {
      return lineOffset;
    }
    const nextLineOffset = position.line + 1 < lineOffsets.length ? lineOffsets[position.line + 1] : this._content.length;
    const offset = Math.min(lineOffset + position.character, nextLineOffset);
    return this.ensureBeforeEOL(offset, lineOffset);
  }
  ensureBeforeEOL(offset, lineOffset) {
    while (offset > lineOffset && isEOL(this._content.charCodeAt(offset - 1))) {
      offset--;
    }
    return offset;
  }
  get lineCount() {
    return this.getLineOffsets().length;
  }
  static isIncremental(event) {
    const candidate = event;
    return candidate !== undefined && candidate !== null && typeof candidate.text === "string" && candidate.range !== undefined && (candidate.rangeLength === undefined || typeof candidate.rangeLength === "number");
  }
  static isFull(event) {
    const candidate = event;
    return candidate !== undefined && candidate !== null && typeof candidate.text === "string" && candidate.range === undefined && candidate.rangeLength === undefined;
  }
}
var TextDocument;
(function(TextDocument) {
  function create(uri, languageId, version, content) {
    return new FullTextDocument(uri, languageId, version, content);
  }
  TextDocument.create = create;
  function update(document, changes, version) {
    if (document instanceof FullTextDocument) {
      document.update(changes, version);
      return document;
    } else {
      throw new Error("TextDocument.update: document must be created by TextDocument.create");
    }
  }
  TextDocument.update = update;
  function applyEdits(document, edits) {
    const text = document.getText();
    const sortedEdits = mergeSort(edits.map(getWellformedEdit), (a, b) => {
      const diff = a.range.start.line - b.range.start.line;
      if (diff === 0) {
        return a.range.start.character - b.range.start.character;
      }
      return diff;
    });
    let lastModifiedOffset = 0;
    const spans = [];
    for (const e of sortedEdits) {
      const startOffset = document.offsetAt(e.range.start);
      if (startOffset < lastModifiedOffset) {
        throw new Error("Overlapping edit");
      } else if (startOffset > lastModifiedOffset) {
        spans.push(text.substring(lastModifiedOffset, startOffset));
      }
      if (e.newText.length) {
        spans.push(e.newText);
      }
      lastModifiedOffset = document.offsetAt(e.range.end);
    }
    spans.push(text.substr(lastModifiedOffset));
    return spans.join("");
  }
  TextDocument.applyEdits = applyEdits;
})(TextDocument || (TextDocument = {}));
function mergeSort(data, compare) {
  if (data.length <= 1) {
    return data;
  }
  const p = data.length / 2 | 0;
  const left = data.slice(0, p);
  const right = data.slice(p);
  mergeSort(left, compare);
  mergeSort(right, compare);
  let leftIdx = 0;
  let rightIdx = 0;
  let i = 0;
  while (leftIdx < left.length && rightIdx < right.length) {
    const ret = compare(left[leftIdx], right[rightIdx]);
    if (ret <= 0) {
      data[i++] = left[leftIdx++];
    } else {
      data[i++] = right[rightIdx++];
    }
  }
  while (leftIdx < left.length) {
    data[i++] = left[leftIdx++];
  }
  while (rightIdx < right.length) {
    data[i++] = right[rightIdx++];
  }
  return data;
}
function computeLineOffsets(text, isAtLineStart, textOffset = 0) {
  const result = isAtLineStart ? [textOffset] : [];
  for (let i = 0;i < text.length; i++) {
    const ch = text.charCodeAt(i);
    if (isEOL(ch)) {
      if (ch === 13 && i + 1 < text.length && text.charCodeAt(i + 1) === 10) {
        i++;
      }
      result.push(textOffset + i + 1);
    }
  }
  return result;
}
function isEOL(char) {
  return char === 13 || char === 10;
}
function getWellformedRange(range) {
  const start = range.start;
  const end = range.end;
  if (start.line > end.line || start.line === end.line && start.character > end.character) {
    return { start: end, end: start };
  }
  return range;
}
function getWellformedEdit(textEdit) {
  const range = getWellformedRange(textEdit.range);
  if (range !== textEdit.range) {
    return { newText: textEdit.newText, range };
  }
  return textEdit;
}

// src/lsp/diagnostics.ts
var import_vscode_languageserver = __toESM(require_main4(), 1);

// node_modules/antlr4ng/dist/index.mjs
var __defProp2 = Object.defineProperty;
var __name = (target, value) => __defProp2(target, "name", { value, configurable: true });
var IntStream;
((IntStream2) => {
  IntStream2.EOF = -1;
  IntStream2.UNKNOWN_SOURCE_NAME = "<unknown>";
})(IntStream || (IntStream = {}));
var Token;
((Token2) => {
  Token2.INVALID_TYPE = 0;
  Token2.EPSILON = -2;
  Token2.MIN_USER_TOKEN_TYPE = 1;
  Token2.EOF = IntStream.EOF;
  Token2.DEFAULT_CHANNEL = 0;
  Token2.HIDDEN_CHANNEL = 1;
  Token2.MIN_USER_CHANNEL_VALUE = 2;
})(Token || (Token = {}));
var isToken = /* @__PURE__ */ __name((candidate) => {
  const token = candidate;
  return token.tokenSource !== undefined && token.channel !== undefined;
}, "isToken");
var BitSet = class {
  static {
    __name(this, "BitSet");
  }
  data;
  constructor(data) {
    if (data) {
      this.data = new Uint32Array(data.map((value) => {
        return value >>> 0;
      }));
    } else {
      this.data = new Uint32Array(1);
    }
  }
  [Symbol.iterator]() {
    const length = this.data.length;
    let currentIndex = 0;
    let currentWord = this.data[currentIndex];
    const words = this.data;
    return {
      [Symbol.iterator]() {
        return this;
      },
      next: /* @__PURE__ */ __name(() => {
        while (currentIndex < length) {
          if (currentWord !== 0) {
            const t = currentWord & -currentWord;
            const value = (currentIndex << 5) + this.bitCount(t - 1);
            currentWord ^= t;
            return { done: false, value };
          } else {
            currentIndex++;
            if (currentIndex < length) {
              currentWord = words[currentIndex];
            }
          }
        }
        return { done: true, value: undefined };
      }, "next")
    };
  }
  clear(index) {
    if (index === undefined) {
      this.data = new Uint32Array;
    } else {
      this.resize(index);
      this.data[index >>> 5] &= ~(1 << index);
    }
  }
  or(set) {
    const minCount = Math.min(this.data.length, set.data.length);
    for (let k = 0;k < minCount; ++k) {
      this.data[k] |= set.data[k];
    }
    if (this.data.length < set.data.length) {
      this.resize((set.data.length << 5) - 1);
      const c = set.data.length;
      for (let k = minCount;k < c; ++k) {
        this.data[k] = set.data[k];
      }
    }
  }
  get(index) {
    if (index < 0) {
      throw new RangeError("index cannot be negative");
    }
    const slot = index >>> 5;
    if (slot >= this.data.length) {
      return false;
    }
    return (this.data[slot] & 1 << index % 32) !== 0;
  }
  get length() {
    let result = 0;
    const c = this.data.length;
    const w = this.data;
    for (let i = 0;i < c; i++) {
      result += this.bitCount(w[i]);
    }
    return result;
  }
  values() {
    const result = new Array(this.length);
    let pos = 0;
    const length = this.data.length;
    for (let k = 0;k < length; ++k) {
      let w = this.data[k];
      while (w !== 0) {
        const t = w & -w;
        result[pos++] = (k << 5) + this.bitCount(t - 1);
        w ^= t;
      }
    }
    return result;
  }
  nextSetBit(fromIndex) {
    if (fromIndex < 0) {
      throw new RangeError("index cannot be negative");
    }
    for (const index of this) {
      if (index >= fromIndex) {
        return index;
      }
    }
    return;
  }
  set(index) {
    if (index < 0) {
      throw new RangeError("index cannot be negative");
    }
    this.resize(index);
    this.data[index >>> 5] |= 1 << index % 32;
  }
  toString() {
    return "{" + this.values().join(", ") + "}";
  }
  resize(index) {
    const count = index + 32 >>> 5;
    if (count <= this.data.length) {
      return;
    }
    const data = new Uint32Array(count);
    data.set(this.data);
    data.fill(0, this.data.length);
    this.data = data;
  }
  bitCount(v) {
    v = v - (v >> 1 & 1431655765);
    v = (v & 858993459) + (v >> 2 & 858993459);
    v = v + (v >> 4) & 252645135;
    v = v + (v >> 8);
    v = v + (v >> 16);
    return v & 63;
  }
};
var c1 = 3432918353;
var c2 = 461845907;
var r1 = 15;
var r2 = 13;
var m = 5;
var n = 3864292196;
var MurmurHash = class _MurmurHash {
  static {
    __name(this, "MurmurHash");
  }
  static defaultSeed = 701;
  constructor() {}
  static initialize(seed = _MurmurHash.defaultSeed) {
    return seed;
  }
  static updateFromComparable(hash, value) {
    return this.update(hash, value?.hashCode() ?? 0);
  }
  static update(hash, value) {
    value = Math.imul(value, c1);
    value = value << r1 | value >>> 32 - r1;
    value = Math.imul(value, c2);
    hash = hash ^ value;
    hash = hash << r2 | hash >>> 32 - r2;
    hash = Math.imul(hash, m) + n;
    return hash;
  }
  static finish(hash, entryCount) {
    hash ^= entryCount * 4;
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 2246822507);
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 3266489909);
    hash ^= hash >>> 16;
    return hash;
  }
  static hashCode(value, seed) {
    return _MurmurHash.finish(_MurmurHash.update(seed ?? _MurmurHash.defaultSeed, value), 1);
  }
};
var ObjectEqualityComparator = class _ObjectEqualityComparator {
  static {
    __name(this, "ObjectEqualityComparator");
  }
  static instance = new _ObjectEqualityComparator;
  hashCode(obj) {
    if (obj == null) {
      return 0;
    }
    return obj.hashCode();
  }
  equals(a, b) {
    if (a == null) {
      return b == null;
    }
    return a.equals(b);
  }
};
var DefaultEqualityComparator = class _DefaultEqualityComparator {
  static {
    __name(this, "DefaultEqualityComparator");
  }
  static instance = new _DefaultEqualityComparator;
  hashCode(obj) {
    if (obj == null) {
      return 0;
    }
    return ObjectEqualityComparator.instance.hashCode(obj);
  }
  equals(a, b) {
    if (a == null) {
      return b == null;
    }
    if (typeof a === "string" || typeof a === "number") {
      return a === b;
    }
    return ObjectEqualityComparator.instance.equals(a, b);
  }
};
var HashSet = class _HashSet {
  static {
    __name(this, "HashSet");
  }
  static defaultLoadFactor = 0.75;
  static initialCapacity = 16;
  comparator;
  buckets;
  threshold;
  itemCount = 0;
  constructor(comparatorOrSet, initialCapacity = _HashSet.initialCapacity) {
    if (comparatorOrSet instanceof _HashSet) {
      this.comparator = comparatorOrSet.comparator;
      this.buckets = comparatorOrSet.buckets.slice(0);
      for (let i = 0;i < this.buckets.length; i++) {
        const bucket = this.buckets[i];
        if (bucket) {
          this.buckets[i] = bucket.slice(0);
        }
      }
      this.itemCount = comparatorOrSet.itemCount;
      this.threshold = comparatorOrSet.threshold;
    } else {
      this.comparator = comparatorOrSet ?? DefaultEqualityComparator.instance;
      this.buckets = this.createBuckets(initialCapacity);
      this.threshold = Math.floor(_HashSet.initialCapacity * _HashSet.defaultLoadFactor);
    }
  }
  getOrAdd(o) {
    if (this.itemCount > this.threshold) {
      this.expand();
    }
    const b = this.getBucket(o);
    let bucket = this.buckets[b];
    if (!bucket) {
      bucket = [o];
      this.buckets[b] = bucket;
      ++this.itemCount;
      return o;
    }
    for (const existing of bucket) {
      if (this.comparator.equals(existing, o)) {
        return existing;
      }
    }
    bucket.push(o);
    ++this.itemCount;
    return o;
  }
  get(o) {
    if (o == null) {
      return o;
    }
    const b = this.getBucket(o);
    const bucket = this.buckets[b];
    if (!bucket) {
      return;
    }
    for (const e of bucket) {
      if (this.comparator.equals(e, o)) {
        return e;
      }
    }
    return;
  }
  remove(o) {
    if (o == null) {
      return false;
    }
    const b = this.getBucket(o);
    const bucket = this.buckets[b];
    if (!bucket) {
      return false;
    }
    for (let i = 0;i < bucket.length; i++) {
      const existing = bucket[i];
      if (this.comparator.equals(existing, o)) {
        bucket.splice(i, 1);
        --this.itemCount;
        return true;
      }
    }
    return false;
  }
  hashCode() {
    let hash = MurmurHash.initialize();
    for (const bucket of this.buckets) {
      if (bucket == null) {
        continue;
      }
      for (const o of bucket) {
        if (o == null) {
          break;
        }
        hash = MurmurHash.update(hash, this.comparator.hashCode(o));
      }
    }
    hash = MurmurHash.finish(hash, this.size);
    return hash;
  }
  equals(o) {
    if (o === this) {
      return true;
    }
    if (!(o instanceof _HashSet)) {
      return false;
    }
    if (o.size !== this.size) {
      return false;
    }
    return this.containsAll(o);
  }
  add(t) {
    const existing = this.getOrAdd(t);
    return existing === t;
  }
  contains(o) {
    return this.containsFast(o);
  }
  containsFast(obj) {
    if (obj == null) {
      return false;
    }
    return this.get(obj) !== undefined;
  }
  *[Symbol.iterator]() {
    yield* this.toArray();
  }
  toArray() {
    const a = new Array(this.size);
    let i = 0;
    for (const bucket of this.buckets) {
      if (bucket == null) {
        continue;
      }
      for (const o of bucket) {
        if (o == null) {
          break;
        }
        a[i++] = o;
      }
    }
    return a;
  }
  containsAll(collection) {
    if (collection instanceof _HashSet) {
      for (const bucket of collection.buckets) {
        if (bucket == null) {
          continue;
        }
        for (const o of bucket) {
          if (o == null) {
            break;
          }
          if (!this.containsFast(o)) {
            return false;
          }
        }
      }
    } else {
      for (const o of collection) {
        if (!this.containsFast(o)) {
          return false;
        }
      }
    }
    return true;
  }
  addAll(c) {
    let changed = false;
    for (const o of c) {
      const existing = this.getOrAdd(o);
      if (existing !== o) {
        changed = true;
      }
    }
    return changed;
  }
  clear() {
    this.buckets = this.createBuckets(_HashSet.initialCapacity);
    this.itemCount = 0;
    this.threshold = Math.floor(_HashSet.initialCapacity * _HashSet.defaultLoadFactor);
  }
  toString() {
    if (this.size === 0) {
      return "{}";
    }
    let buf = "{";
    let first = true;
    for (const bucket of this.buckets) {
      if (bucket == null) {
        continue;
      }
      for (const o of bucket) {
        if (o == null) {
          break;
        }
        if (first) {
          first = false;
        } else {
          buf += ", ";
        }
        buf += o.toString();
      }
    }
    buf += "}";
    return buf;
  }
  toTableString() {
    let buf = "";
    for (const bucket of this.buckets) {
      if (bucket == null) {
        buf += `null
`;
        continue;
      }
      buf += "[";
      let first = true;
      for (const o of bucket) {
        if (first) {
          first = false;
        } else {
          buf += " ";
        }
        if (o == null) {
          buf += "_";
        } else {
          buf += o.toString();
        }
      }
      buf += `]
`;
    }
    return buf;
  }
  getBucket(o) {
    const hash = this.comparator.hashCode(o);
    const b = hash & this.buckets.length - 1;
    return b;
  }
  expand() {
    const old = this.buckets;
    const newCapacity = this.buckets.length * 2;
    const newTable = this.createBuckets(newCapacity);
    this.buckets = newTable;
    this.threshold = Math.floor(newCapacity * _HashSet.defaultLoadFactor);
    for (const bucket of old) {
      if (!bucket) {
        continue;
      }
      for (const o of bucket) {
        const b = this.getBucket(o);
        let newBucket = this.buckets[b];
        if (!newBucket) {
          newBucket = [];
          this.buckets[b] = newBucket;
        }
        newBucket.push(o);
      }
    }
  }
  get size() {
    return this.itemCount;
  }
  get isEmpty() {
    return this.itemCount === 0;
  }
  createBuckets(capacity) {
    return new Array(capacity);
  }
};
var Interval = class _Interval {
  static {
    __name(this, "Interval");
  }
  static INVALID_INTERVAL = new _Interval(-1, -2);
  static INTERVAL_POOL_MAX_VALUE = 1000;
  static cache = [];
  start;
  stop;
  cachedHashCode;
  constructor(start, stop) {
    this.start = start;
    this.stop = stop;
    this.cachedHashCode = Math.imul(651 + start, 31) + stop;
  }
  static of(a, b) {
    if (a !== b || a < 0 || a > _Interval.INTERVAL_POOL_MAX_VALUE) {
      return new _Interval(a, b);
    }
    if (!_Interval.cache[a]) {
      _Interval.cache[a] = new _Interval(a, a);
    }
    return _Interval.cache[a];
  }
  equals(o) {
    return this.start === o.start && this.stop === o.stop;
  }
  hashCode() {
    return this.cachedHashCode;
  }
  startsBeforeDisjoint(other) {
    return this.start < other.start && this.stop < other.start;
  }
  startsBeforeNonDisjoint(other) {
    return this.start <= other.start && this.stop >= other.start;
  }
  startsAfter(other) {
    return this.start > other.start;
  }
  startsAfterDisjoint(other) {
    return this.start > other.stop;
  }
  startsAfterNonDisjoint(other) {
    return this.start > other.start && this.start <= other.stop;
  }
  disjoint(other) {
    return this.startsBeforeDisjoint(other) || this.startsAfterDisjoint(other);
  }
  adjacent(other) {
    return this.start === other.stop + 1 || this.stop === other.start - 1;
  }
  properlyContains(other) {
    return other.start >= this.start && other.stop <= this.stop;
  }
  union(other) {
    return _Interval.of(Math.min(this.start, other.start), Math.max(this.stop, other.stop));
  }
  intersection(other) {
    return _Interval.of(Math.max(this.start, other.start), Math.min(this.stop, other.stop));
  }
  differenceNotProperlyContained(other) {
    let diff = null;
    if (other.startsBeforeNonDisjoint(this)) {
      diff = _Interval.of(Math.max(this.start, other.stop + 1), this.stop);
    } else if (other.startsAfterNonDisjoint(this)) {
      diff = _Interval.of(this.start, other.start - 1);
    }
    return diff;
  }
  toString() {
    return `${this.start}..${this.stop}`;
  }
  get length() {
    if (this.stop < this.start) {
      return 0;
    }
    return this.stop - this.start + 1;
  }
};
var Vocabulary = class _Vocabulary {
  static {
    __name(this, "Vocabulary");
  }
  static EMPTY_NAMES = [];
  static EMPTY_VOCABULARY = new _Vocabulary(_Vocabulary.EMPTY_NAMES, _Vocabulary.EMPTY_NAMES, _Vocabulary.EMPTY_NAMES);
  maxTokenType;
  literalNames;
  symbolicNames;
  displayNames;
  constructor(literalNames, symbolicNames, displayNames) {
    this.literalNames = literalNames ?? _Vocabulary.EMPTY_NAMES;
    this.symbolicNames = symbolicNames ?? _Vocabulary.EMPTY_NAMES;
    this.displayNames = displayNames ?? _Vocabulary.EMPTY_NAMES;
    this.maxTokenType = Math.max(this.displayNames.length, Math.max(this.literalNames.length, this.symbolicNames.length)) - 1;
  }
  static fromTokenNames(tokenNames) {
    if (tokenNames == null || tokenNames.length === 0) {
      return _Vocabulary.EMPTY_VOCABULARY;
    }
    const literalNames = [...tokenNames];
    const symbolicNames = [...tokenNames];
    for (let i = 0;i < tokenNames.length; i++) {
      const tokenName = tokenNames[i];
      if (tokenName == null) {
        continue;
      }
      if (tokenName.length > 0) {
        const firstChar = tokenName.codePointAt(0);
        if (firstChar === 39) {
          symbolicNames[i] = null;
          continue;
        } else if (firstChar >= 65 && firstChar <= 90) {
          literalNames[i] = null;
          continue;
        }
      }
      literalNames[i] = null;
      symbolicNames[i] = null;
    }
    return new _Vocabulary(literalNames, symbolicNames, tokenNames);
  }
  getMaxTokenType() {
    return this.maxTokenType;
  }
  getLiteralName(tokenType) {
    if (tokenType >= 0 && tokenType < this.literalNames.length) {
      return this.literalNames[tokenType];
    }
    return null;
  }
  getSymbolicName(tokenType) {
    if (tokenType >= 0 && tokenType < this.symbolicNames.length) {
      return this.symbolicNames[tokenType];
    }
    if (tokenType === Token.EOF) {
      return "EOF";
    }
    return null;
  }
  getDisplayName(tokenType) {
    if (tokenType >= 0 && tokenType < this.displayNames.length) {
      const displayName = this.displayNames[tokenType];
      if (displayName != null) {
        return displayName;
      }
    }
    const literalName = this.getLiteralName(tokenType);
    if (literalName != null) {
      return literalName;
    }
    const symbolicName = this.getSymbolicName(tokenType);
    if (symbolicName != null) {
      return symbolicName;
    }
    return `${tokenType}`;
  }
  getLiteralNames() {
    return this.literalNames;
  }
  getSymbolicNames() {
    return this.symbolicNames;
  }
  getDisplayNames() {
    return this.displayNames;
  }
};
var IntervalSet = class _IntervalSet {
  static {
    __name(this, "IntervalSet");
  }
  intervals = [];
  cachedHashCode;
  constructor(set) {
    if (set) {
      if (Array.isArray(set)) {
        for (const el of set) {
          this.addOne(el);
        }
      } else {
        this.addSet(set);
      }
    }
  }
  static of(a, b) {
    const s = new _IntervalSet;
    s.addRange(a, b);
    return s;
  }
  static or(sets) {
    const result = new _IntervalSet;
    for (const set of sets) {
      result.addSet(set);
    }
    return result;
  }
  [Symbol.iterator]() {
    return this.intervals[Symbol.iterator]();
  }
  get(index) {
    return this.intervals[index];
  }
  get minElement() {
    if (this.intervals.length === 0) {
      return Token.INVALID_TYPE;
    }
    return this.intervals[0].start;
  }
  get maxElement() {
    if (this.intervals.length === 0) {
      return Token.INVALID_TYPE;
    }
    return this.intervals[this.intervals.length - 1].stop;
  }
  clear() {
    this.cachedHashCode = undefined;
    this.intervals = [];
  }
  addOne(v) {
    this.addInterval(new Interval(v, v));
  }
  addRange(l, h) {
    this.addInterval(new Interval(l, h));
  }
  addInterval(addition) {
    this.cachedHashCode = undefined;
    if (this.intervals.length === 0) {
      this.intervals.push(addition);
    } else {
      for (let pos = 0;pos < this.intervals.length; pos++) {
        const existing = this.intervals[pos];
        if (addition.equals(existing)) {
          return;
        }
        if (addition.adjacent(existing) || !addition.disjoint(existing)) {
          const bigger = addition.union(existing);
          this.intervals[pos] = bigger;
          for (let sub = pos + 1;sub < this.intervals.length; ) {
            const next = this.intervals[sub];
            if (!bigger.adjacent(next) && bigger.disjoint(next)) {
              break;
            }
            this.intervals.splice(sub, 1);
            this.intervals[pos] = bigger.union(next);
          }
          return;
        }
        if (addition.startsBeforeDisjoint(existing)) {
          this.intervals.splice(pos, 0, addition);
          return;
        }
      }
      this.intervals.push(addition);
    }
  }
  addSet(other) {
    other.intervals.forEach((toAdd) => {
      return this.addInterval(toAdd);
    }, this);
    return this;
  }
  complementWithVocabulary(vocabulary) {
    const result = new _IntervalSet;
    if (!vocabulary) {
      return result;
    }
    if (vocabulary.length === 0) {
      return result;
    }
    result.addSet(vocabulary);
    return result.subtract(this);
  }
  complement(minElement, maxElement) {
    const result = new _IntervalSet;
    result.addInterval(new Interval(minElement, maxElement));
    return result.subtract(this);
  }
  or(sets) {
    const result = new _IntervalSet;
    result.addSet(this);
    sets.forEach((set) => {
      return result.addSet(set);
    });
    return result;
  }
  and(other) {
    if (other.length === 0) {
      return new _IntervalSet;
    }
    const myIntervals = this.intervals;
    const theirIntervals = other.intervals;
    let intersection;
    const mySize = myIntervals.length;
    const theirSize = theirIntervals.length;
    let i = 0;
    let j = 0;
    while (i < mySize && j < theirSize) {
      const mine = myIntervals[i];
      const theirs = theirIntervals[j];
      if (mine.startsBeforeDisjoint(theirs)) {
        i++;
      } else if (theirs.startsBeforeDisjoint(mine)) {
        j++;
      } else if (mine.properlyContains(theirs)) {
        if (!intersection) {
          intersection = new _IntervalSet;
        }
        intersection.addInterval(mine.intersection(theirs));
        j++;
      } else if (theirs.properlyContains(mine)) {
        if (!intersection) {
          intersection = new _IntervalSet;
        }
        intersection.addInterval(mine.intersection(theirs));
        i++;
      } else if (!mine.disjoint(theirs)) {
        if (!intersection) {
          intersection = new _IntervalSet;
        }
        intersection.addInterval(mine.intersection(theirs));
        if (mine.startsAfterNonDisjoint(theirs)) {
          j++;
        } else if (theirs.startsAfterNonDisjoint(mine)) {
          i++;
        }
      }
    }
    if (!intersection) {
      return new _IntervalSet;
    }
    return intersection;
  }
  subtract(other) {
    if (this.length === 0) {
      return new _IntervalSet;
    }
    const result = new _IntervalSet(this);
    if (other.length === 0) {
      return result;
    }
    let resultI = 0;
    let rightI = 0;
    while (resultI < result.intervals.length && rightI < other.intervals.length) {
      const resultInterval = result.intervals[resultI];
      const rightInterval = other.intervals[rightI];
      if (rightInterval.stop < resultInterval.start) {
        rightI++;
        continue;
      }
      if (rightInterval.start > resultInterval.stop) {
        resultI++;
        continue;
      }
      let beforeCurrent;
      let afterCurrent;
      if (rightInterval.start > resultInterval.start) {
        beforeCurrent = new Interval(resultInterval.start, rightInterval.start - 1);
      }
      if (rightInterval.stop < resultInterval.stop) {
        afterCurrent = new Interval(rightInterval.stop + 1, resultInterval.stop);
      }
      if (beforeCurrent) {
        if (afterCurrent) {
          result.intervals[resultI] = beforeCurrent;
          result.intervals.splice(resultI + 1, 0, afterCurrent);
          resultI++;
          rightI++;
        } else {
          result.intervals[resultI] = beforeCurrent;
          resultI++;
        }
      } else {
        if (afterCurrent) {
          result.intervals[resultI] = afterCurrent;
          rightI++;
        } else {
          result.intervals.splice(resultI, 1);
        }
      }
    }
    return result;
  }
  contains(el) {
    const n2 = this.intervals.length;
    let l = 0;
    let r = n2 - 1;
    while (l <= r) {
      const m2 = Math.floor((l + r) / 2);
      const interval = this.intervals[m2];
      if (interval.stop < el) {
        l = m2 + 1;
      } else if (interval.start > el) {
        r = m2 - 1;
      } else {
        return true;
      }
    }
    return false;
  }
  removeRange(toRemove) {
    this.cachedHashCode = undefined;
    if (toRemove.start === toRemove.stop) {
      this.removeOne(toRemove.start);
    } else if (this.intervals !== null) {
      let pos = 0;
      for (const existing of this.intervals) {
        if (toRemove.stop <= existing.start) {
          return;
        } else if (toRemove.start > existing.start && toRemove.stop < existing.stop) {
          this.intervals[pos] = new Interval(existing.start, toRemove.start);
          const x = new Interval(toRemove.stop, existing.stop);
          this.intervals.splice(pos, 0, x);
          return;
        } else if (toRemove.start <= existing.start && toRemove.stop >= existing.stop) {
          this.intervals.splice(pos, 1);
          pos = pos - 1;
        } else if (toRemove.start < existing.stop) {
          this.intervals[pos] = new Interval(existing.start, toRemove.start);
        } else if (toRemove.stop < existing.stop) {
          this.intervals[pos] = new Interval(toRemove.stop, existing.stop);
        }
        pos += 1;
      }
    }
  }
  removeOne(value) {
    this.cachedHashCode = undefined;
    for (let i = 0;i < this.intervals.length; i++) {
      const existing = this.intervals[i];
      if (value < existing.start) {
        return;
      } else if (value === existing.start && value === existing.stop) {
        this.intervals.splice(i, 1);
        return;
      } else if (value === existing.start) {
        this.intervals[i] = new Interval(existing.start + 1, existing.stop);
        return;
      } else if (value === existing.stop) {
        this.intervals[i] = new Interval(existing.start, existing.stop - 1);
        return;
      } else if (value < existing.stop) {
        const replace = new Interval(existing.start, value - 1);
        this.intervals[i] = new Interval(value + 1, existing.stop);
        this.intervals.splice(i, 0, replace);
        return;
      }
    }
  }
  hashCode() {
    if (this.cachedHashCode === undefined) {
      let hash = MurmurHash.initialize();
      for (const interval of this.intervals) {
        hash = MurmurHash.update(hash, interval.start);
        hash = MurmurHash.update(hash, interval.stop);
      }
      this.cachedHashCode = MurmurHash.finish(hash, this.intervals.length * 2);
    }
    return this.cachedHashCode;
  }
  equals(other) {
    if (this === other) {
      return true;
    }
    if (this.intervals.length !== other.intervals.length) {
      return false;
    }
    for (let i = 0;i < this.intervals.length; i++) {
      if (!this.intervals[i].equals(other.intervals[i])) {
        return false;
      }
    }
    return true;
  }
  toString(elementsAreChar) {
    if (this.intervals.length === 0) {
      return "{}";
    }
    let result = "";
    if (this.length > 1) {
      result += "{";
    }
    for (let i = 0;i < this.intervals.length; ++i) {
      const interval = this.intervals[i];
      const start = interval.start;
      const stop = interval.stop;
      if (start === stop) {
        if (start === Token.EOF) {
          result += "<EOF>";
        } else if (elementsAreChar) {
          result += "'" + String.fromCodePoint(start) + "'";
        } else {
          result += start;
        }
      } else {
        if (elementsAreChar) {
          result += "'" + String.fromCodePoint(start) + "'..'" + String.fromCodePoint(stop) + "'";
        } else {
          result += start + ".." + stop;
        }
      }
      if (i < this.intervals.length - 1) {
        result += ", ";
      }
    }
    if (this.length > 1) {
      result += "}";
    }
    return result;
  }
  toStringWithVocabulary(vocabulary) {
    if (this.intervals.length === 0) {
      return "{}";
    }
    let result = "";
    if (this.length > 1) {
      result += "{";
    }
    for (let i = 0;i < this.intervals.length; ++i) {
      const interval = this.intervals[i];
      const start = interval.start;
      const stop = interval.stop;
      if (start === stop) {
        if (start === Token.EOF) {
          result += "<EOF>";
        } else {
          result += this.elementName(vocabulary, start);
        }
      } else {
        for (let i2 = start;i2 <= stop; ++i2) {
          if (i2 > start) {
            result += ", ";
          }
          result += this.elementName(vocabulary, i2);
        }
      }
      if (i < this.intervals.length - 1) {
        result += ", ";
      }
    }
    if (this.length > 1) {
      result += "}";
    }
    return result;
  }
  toStringWithRuleNames(ruleNames) {
    if (this.intervals.length === 0) {
      return "{}";
    }
    let result = "";
    if (this.length > 1) {
      result += "{";
    }
    const vocabulary = Vocabulary.fromTokenNames(ruleNames);
    for (let i = 0;i < this.intervals.length; ++i) {
      const interval = this.intervals[i];
      const start = interval.start;
      const stop = interval.stop;
      if (start === stop) {
        if (start === Token.EOF) {
          result += "<EOF>";
        } else {
          result += this.elementName(vocabulary, start);
        }
      } else {
        for (let i2 = start;i2 <= stop; ++i2) {
          if (i2 > start) {
            result += ", ";
          }
          result += this.elementName(vocabulary, i2);
        }
      }
      if (i < this.intervals.length - 1) {
        result += ", ";
      }
    }
    if (this.length > 1) {
      result += "}";
    }
    return result;
  }
  toArray() {
    const data = [];
    for (const interval of this.intervals) {
      for (let j = interval.start;j <= interval.stop; j++) {
        data.push(j);
      }
    }
    return data;
  }
  get length() {
    let result = 0;
    for (const interval of this.intervals) {
      result += interval.length;
    }
    return result;
  }
  elementName(vocabulary, token) {
    if (token === Token.EOF) {
      return "<EOF>";
    }
    if (token === Token.EPSILON) {
      return "<EPSILON>";
    }
    return vocabulary.getDisplayName(token);
  }
};
var valueToString = /* @__PURE__ */ __name((v) => {
  return v === null ? "null" : v;
}, "valueToString");
var arrayToString = /* @__PURE__ */ __name((value) => {
  return Array.isArray(value) ? "[" + value.map(valueToString).join(", ") + "]" : "null";
}, "arrayToString");
var equalArrays = /* @__PURE__ */ __name((a, b) => {
  if (a === b) {
    return true;
  }
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0;i < a.length; i++) {
    const left = a[i];
    const right = b[i];
    if (left === right) {
      continue;
    }
    if (!left || !left.equals(right)) {
      return false;
    }
  }
  return true;
}, "equalArrays");
var equalNumberArrays = /* @__PURE__ */ __name((a, b) => {
  if (a === b) {
    return true;
  }
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0;i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}, "equalNumberArrays");
var escapeWhitespace = /* @__PURE__ */ __name((s, escapeSpaces = false) => {
  s = s.replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\r/g, "\\r");
  if (escapeSpaces) {
    s = s.replace(/ /g, "·");
  }
  return s;
}, "escapeWhitespace");
var SemanticContext = class _SemanticContext {
  static {
    __name(this, "SemanticContext");
  }
  cachedHashCode;
  static andContext(a, b) {
    if (a === null || a === _SemanticContext.NONE) {
      return b;
    }
    if (b === null || b === _SemanticContext.NONE) {
      return a;
    }
    const result = new AND(a, b);
    if (result.operands.length === 1) {
      return result.operands[0];
    }
    return result;
  }
  static orContext(a, b) {
    if (a === null) {
      return b;
    }
    if (b === null) {
      return a;
    }
    if (a === _SemanticContext.NONE || b === _SemanticContext.NONE) {
      return _SemanticContext.NONE;
    }
    const result = new OR(a, b);
    if (result.operands.length === 1) {
      return result.operands[0];
    } else {
      return result;
    }
  }
  static filterPrecedencePredicates(set) {
    const result = [];
    for (const context of set) {
      if (context instanceof _SemanticContext.PrecedencePredicate) {
        result.push(context);
      }
    }
    return result;
  }
  evalPrecedence(_parser, _parserCallStack) {
    return this;
  }
};
var AND = class _AND extends SemanticContext {
  static {
    __name(this, "AND");
  }
  operands;
  constructor(a, b) {
    super();
    const operands = new HashSet;
    if (a instanceof _AND) {
      a.operands.forEach((o) => {
        operands.add(o);
      });
    } else {
      operands.add(a);
    }
    if (b instanceof _AND) {
      b.operands.forEach((o) => {
        operands.add(o);
      });
    } else {
      operands.add(b);
    }
    const precedencePredicates = SemanticContext.filterPrecedencePredicates(operands);
    if (precedencePredicates.length > 0) {
      let reduced = null;
      precedencePredicates.forEach((p) => {
        if (reduced === null || p.precedence < reduced.precedence) {
          reduced = p;
        }
      });
      if (reduced) {
        operands.add(reduced);
      }
    }
    this.operands = operands.toArray();
  }
  equals(other) {
    if (this === other) {
      return true;
    }
    if (!(other instanceof _AND)) {
      return false;
    }
    return equalArrays(this.operands, other.operands);
  }
  hashCode() {
    if (this.cachedHashCode === undefined) {
      let hash = MurmurHash.initialize();
      for (const operand of this.operands) {
        hash = MurmurHash.updateFromComparable(hash, operand);
      }
      hash = MurmurHash.update(hash, 3813686060);
      this.cachedHashCode = MurmurHash.finish(hash, this.operands.length + 1);
    }
    return this.cachedHashCode;
  }
  evaluate(parser, parserCallStack) {
    for (const operand of this.operands) {
      if (!operand.evaluate(parser, parserCallStack)) {
        return false;
      }
    }
    return true;
  }
  evalPrecedence(parser, parserCallStack) {
    let differs = false;
    const operands = [];
    for (const context of this.operands) {
      const evaluated = context.evalPrecedence(parser, parserCallStack);
      differs ||= evaluated !== context;
      if (evaluated === null) {
        return null;
      } else if (evaluated !== SemanticContext.NONE) {
        operands.push(evaluated);
      }
    }
    if (!differs) {
      return this;
    }
    if (operands.length === 0) {
      return SemanticContext.NONE;
    }
    let result = null;
    operands.forEach((o) => {
      result = result === null ? o : SemanticContext.andContext(result, o);
    });
    return result;
  }
  toString() {
    const s = this.operands.map((o) => {
      return o.toString();
    });
    return (s.length > 3 ? s.slice(3) : s).join("&&");
  }
};
var OR = class _OR extends SemanticContext {
  static {
    __name(this, "OR");
  }
  operands;
  constructor(a, b) {
    super();
    const operands = new HashSet;
    if (a instanceof _OR) {
      a.operands.forEach((o) => {
        operands.add(o);
      });
    } else {
      operands.add(a);
    }
    if (b instanceof _OR) {
      b.operands.forEach((o) => {
        operands.add(o);
      });
    } else {
      operands.add(b);
    }
    const precedencePredicates = SemanticContext.filterPrecedencePredicates(operands);
    if (precedencePredicates.length > 0) {
      const s = precedencePredicates.sort((a2, b2) => {
        return a2.compareTo(b2);
      });
      const reduced = s[s.length - 1];
      operands.add(reduced);
    }
    this.operands = operands.toArray();
  }
  equals(other) {
    if (this === other) {
      return true;
    } else if (!(other instanceof _OR)) {
      return false;
    } else {
      return equalArrays(this.operands, other.operands);
    }
  }
  hashCode() {
    if (this.cachedHashCode === undefined) {
      let hash = MurmurHash.initialize();
      for (const operand of this.operands) {
        hash = MurmurHash.updateFromComparable(hash, operand);
      }
      hash = MurmurHash.update(hash, 3383313031);
      this.cachedHashCode = MurmurHash.finish(hash, this.operands.length + 1);
    }
    return this.cachedHashCode;
  }
  evaluate(parser, parserCallStack) {
    for (const operand of this.operands) {
      if (operand.evaluate(parser, parserCallStack)) {
        return true;
      }
    }
    return false;
  }
  evalPrecedence(parser, parserCallStack) {
    let differs = false;
    const operands = [];
    for (const context of this.operands) {
      const evaluated = context.evalPrecedence(parser, parserCallStack);
      differs ||= evaluated !== context;
      if (evaluated === SemanticContext.NONE) {
        return SemanticContext.NONE;
      } else if (evaluated !== null) {
        operands.push(evaluated);
      }
    }
    if (!differs) {
      return this;
    }
    if (operands.length === 0) {
      return null;
    }
    let result = null;
    operands.forEach((o) => {
      result = result === null ? o : SemanticContext.orContext(result, o);
    });
    return result;
  }
  toString() {
    const s = this.operands.map((o) => {
      return o.toString();
    });
    return (s.length > 3 ? s.slice(3) : s).join("||");
  }
};
((SemanticContext2) => {

  class Predicate extends SemanticContext2 {
    static {
      __name(this, "Predicate");
    }
    ruleIndex;
    predIndex;
    isCtxDependent;
    constructor(ruleIndex, predIndex, isCtxDependent) {
      super();
      this.ruleIndex = ruleIndex ?? -1;
      this.predIndex = predIndex ?? -1;
      this.isCtxDependent = isCtxDependent ?? false;
    }
    evaluate(parser, outerContext) {
      const localctx = this.isCtxDependent ? outerContext : null;
      return parser.sempred(localctx, this.ruleIndex, this.predIndex);
    }
    hashCode() {
      if (this.cachedHashCode === undefined) {
        let hashCode = MurmurHash.initialize();
        hashCode = MurmurHash.update(hashCode, this.ruleIndex);
        hashCode = MurmurHash.update(hashCode, this.predIndex);
        hashCode = MurmurHash.update(hashCode, this.isCtxDependent ? 1 : 0);
        hashCode = MurmurHash.finish(hashCode, 3);
        this.cachedHashCode = hashCode;
      }
      return this.cachedHashCode;
    }
    equals(other) {
      if (this === other) {
        return true;
      }
      return this.ruleIndex === other.ruleIndex && this.predIndex === other.predIndex && this.isCtxDependent === other.isCtxDependent;
    }
    toString() {
      return "{" + this.ruleIndex + ":" + this.predIndex + "}?";
    }
  }
  SemanticContext2.Predicate = Predicate;

  class PrecedencePredicate extends SemanticContext2 {
    static {
      __name(this, "PrecedencePredicate");
    }
    precedence;
    constructor(precedence) {
      super();
      this.precedence = precedence ?? 0;
    }
    evaluate(parser, outerContext) {
      return parser.precpred(outerContext, this.precedence);
    }
    evalPrecedence(parser, outerContext) {
      if (parser.precpred(outerContext ?? null, this.precedence)) {
        return SemanticContext2.NONE;
      }
      return null;
    }
    compareTo(other) {
      return this.precedence - other.precedence;
    }
    hashCode() {
      return 31 + this.precedence;
    }
    equals(other) {
      if (this === other) {
        return true;
      }
      return this.precedence === other.precedence;
    }
    toString() {
      return "{" + this.precedence + ">=prec}?";
    }
  }
  SemanticContext2.PrecedencePredicate = PrecedencePredicate;
  SemanticContext2.NONE = new Predicate;
})(SemanticContext || (SemanticContext = {}));
var ATNConfig = class _ATNConfig {
  static {
    __name(this, "ATNConfig");
  }
  state;
  alt;
  reachesIntoOuterContext = false;
  precedenceFilterSuppressed = false;
  get semanticContext() {
    return this.#semanticContext;
  }
  cachedHashCode;
  #context = null;
  #semanticContext;
  constructor(c, state, context, semanticContext) {
    this.state = state;
    this.alt = c.alt;
    this.context = context;
    this.#semanticContext = semanticContext ?? SemanticContext.NONE;
    this.reachesIntoOuterContext = c.reachesIntoOuterContext;
    if (c.precedenceFilterSuppressed !== undefined) {
      this.precedenceFilterSuppressed = c.precedenceFilterSuppressed;
    }
  }
  static duplicate(old, semanticContext) {
    return new _ATNConfig(old, old.state, old.context, semanticContext ?? old.semanticContext);
  }
  static createWithContext(state, alt, context, semanticContext) {
    return new _ATNConfig({ alt }, state, context, semanticContext);
  }
  static createWithConfig(state, config, context) {
    return new _ATNConfig(config, state, context ?? config.context, config.semanticContext);
  }
  static createWithSemanticContext(state, c, semanticContext) {
    return new _ATNConfig(c, state ?? c.state, c.context, semanticContext);
  }
  hashCode() {
    if (this.cachedHashCode === undefined) {
      let hashCode = MurmurHash.initialize(7);
      hashCode = MurmurHash.update(hashCode, this.state.stateNumber);
      hashCode = MurmurHash.update(hashCode, this.alt);
      hashCode = MurmurHash.updateFromComparable(hashCode, this.#context);
      hashCode = MurmurHash.updateFromComparable(hashCode, this.semanticContext);
      hashCode = MurmurHash.finish(hashCode, 4);
      this.cachedHashCode = hashCode;
    }
    return this.cachedHashCode;
  }
  get context() {
    return this.#context;
  }
  set context(context) {
    this.#context = context;
    this.cachedHashCode = undefined;
  }
  equals(other) {
    if (this === other) {
      return true;
    }
    return this.state.stateNumber === other.state.stateNumber && this.alt === other.alt && (this.context === null ? other.context === null : this.context.equals(other.context)) && this.semanticContext.equals(other.semanticContext) && this.precedenceFilterSuppressed === other.precedenceFilterSuppressed;
  }
  toString(_recog, showAlt = true) {
    let alt = "";
    if (showAlt) {
      alt = "," + this.alt;
    }
    return "(" + this.state + alt + (this.context !== null ? ",[" + this.context.toString() + "]" : "") + (this.semanticContext !== SemanticContext.NONE ? "," + this.semanticContext.toString() : "") + (this.reachesIntoOuterContext ? ",up=" + this.reachesIntoOuterContext : "") + ")";
  }
};
var ATNState = class _ATNState {
  static {
    __name(this, "ATNState");
  }
  static INVALID_STATE_NUMBER = -1;
  static INVALID_TYPE = 0;
  static BASIC = 1;
  static RULE_START = 2;
  static BLOCK_START = 3;
  static PLUS_BLOCK_START = 4;
  static STAR_BLOCK_START = 5;
  static TOKEN_START = 6;
  static RULE_STOP = 7;
  static BLOCK_END = 8;
  static STAR_LOOP_BACK = 9;
  static STAR_LOOP_ENTRY = 10;
  static PLUS_LOOP_BACK = 11;
  static LOOP_END = 12;
  static stateType = _ATNState.INVALID_STATE_NUMBER;
  stateNumber = 0;
  ruleIndex = 0;
  epsilonOnlyTransitions = false;
  nextTokenWithinRule;
  transitions = [];
  hashCode() {
    return this.stateNumber;
  }
  equals(other) {
    return this.stateNumber === other.stateNumber;
  }
  toString() {
    return `${this.stateNumber}`;
  }
  addTransitionAtIndex(index, transition) {
    if (this.transitions.length === 0) {
      this.epsilonOnlyTransitions = transition.isEpsilon;
    } else if (this.epsilonOnlyTransitions !== transition.isEpsilon) {
      this.epsilonOnlyTransitions = false;
    }
    this.transitions.splice(index, 0, transition);
  }
  addTransition(transition) {
    if (this.transitions.length === 0) {
      this.epsilonOnlyTransitions = transition.isEpsilon;
    } else if (this.epsilonOnlyTransitions !== transition.isEpsilon) {
      this.epsilonOnlyTransitions = false;
    }
    this.transitions.push(transition);
  }
  setTransition(i, e) {
    this.transitions.splice(i, 1, e);
  }
  removeTransition(index) {
    const t = this.transitions.splice(index, 1);
    return t[0];
  }
};
var PredictionContext = class _PredictionContext {
  static {
    __name(this, "PredictionContext");
  }
  static EMPTY_RETURN_STATE = 2147483647;
  static traceATNSimulator = false;
  cachedHashCode;
  constructor(cachedHashCode) {
    this.cachedHashCode = cachedHashCode;
  }
  static calculateEmptyHashCode() {
    let hash = MurmurHash.initialize(31);
    hash = MurmurHash.finish(hash, 0);
    return hash;
  }
  static calculateHashCodeSingle(parent, returnState) {
    let hash = MurmurHash.initialize(31);
    hash = MurmurHash.updateFromComparable(hash, parent);
    hash = MurmurHash.update(hash, returnState);
    hash = MurmurHash.finish(hash, 2);
    return hash;
  }
  static calculateHashCodeList(parents, returnStates) {
    let hash = MurmurHash.initialize(31);
    for (const parent of parents) {
      hash = MurmurHash.updateFromComparable(hash, parent);
    }
    for (const returnState of returnStates) {
      hash = MurmurHash.update(hash, returnState);
    }
    hash = MurmurHash.finish(hash, 2 * parents.length);
    return hash;
  }
  isEmpty() {
    return false;
  }
  hasEmptyPath() {
    return this.getReturnState(this.length - 1) === _PredictionContext.EMPTY_RETURN_STATE;
  }
  hashCode() {
    return this.cachedHashCode;
  }
  toString(_recog) {
    return "";
  }
};
var SingletonPredictionContext = class _SingletonPredictionContext extends PredictionContext {
  static {
    __name(this, "SingletonPredictionContext");
  }
  parent;
  returnState;
  constructor(parent, returnState) {
    super(parent ? PredictionContext.calculateHashCodeSingle(parent, returnState) : PredictionContext.calculateEmptyHashCode());
    this.parent = parent ?? null;
    this.returnState = returnState;
  }
  getParent(_index) {
    return this.parent;
  }
  getReturnState(_index) {
    return this.returnState;
  }
  equals(other) {
    if (this === other) {
      return true;
    }
    if (!(other instanceof _SingletonPredictionContext)) {
      return false;
    }
    if (this.hashCode() !== other.hashCode()) {
      return false;
    }
    if (this.returnState !== other.returnState) {
      return false;
    }
    if (this.parent == null) {
      return other.parent == null;
    }
    return this.parent.equals(other.parent);
  }
  toString() {
    const up = this.parent === null ? "" : this.parent.toString();
    if (up.length === 0) {
      if (this.returnState === PredictionContext.EMPTY_RETURN_STATE) {
        return "$";
      }
      return "" + this.returnState;
    } else {
      return "" + this.returnState + " " + up;
    }
  }
  get length() {
    return 1;
  }
};
var EmptyPredictionContext = class _EmptyPredictionContext extends SingletonPredictionContext {
  static {
    __name(this, "EmptyPredictionContext");
  }
  static instance = new _EmptyPredictionContext;
  constructor() {
    super(undefined, PredictionContext.EMPTY_RETURN_STATE);
  }
  isEmpty() {
    return true;
  }
  getParent() {
    return null;
  }
  getReturnState() {
    return this.returnState;
  }
  equals(other) {
    return this === other;
  }
  toString() {
    return "$";
  }
};
var Transition = class {
  static {
    __name(this, "Transition");
  }
  static INVALID = 0;
  static EPSILON = 1;
  static RANGE = 2;
  static RULE = 3;
  static PREDICATE = 4;
  static ATOM = 5;
  static ACTION = 6;
  static SET = 7;
  static NOT_SET = 8;
  static WILDCARD = 9;
  static PRECEDENCE = 10;
  target;
  constructor(target) {
    this.target = target;
  }
  get isEpsilon() {
    return false;
  }
  get label() {
    return null;
  }
  toString() {
    return "";
  }
};
var SetTransition = class extends Transition {
  static {
    __name(this, "SetTransition");
  }
  set;
  constructor(target, set) {
    super(target);
    if (set) {
      this.set = set;
    } else {
      this.set = IntervalSet.of(Token.INVALID_TYPE, Token.INVALID_TYPE);
    }
  }
  get transitionType() {
    return Transition.SET;
  }
  get label() {
    return this.set;
  }
  matches(symbol, _minVocabSymbol, _maxVocabSymbol) {
    return this.set.contains(symbol);
  }
  toString() {
    return this.set.toString();
  }
};
var NotSetTransition = class extends SetTransition {
  static {
    __name(this, "NotSetTransition");
  }
  get transitionType() {
    return Transition.NOT_SET;
  }
  matches(symbol, minVocabSymbol, maxVocabSymbol) {
    return symbol >= minVocabSymbol && symbol <= maxVocabSymbol && !super.matches(symbol, minVocabSymbol, maxVocabSymbol);
  }
  toString() {
    return "~" + super.toString();
  }
};
var MapKeyEqualityComparator = class {
  static {
    __name(this, "MapKeyEqualityComparator");
  }
  keyComparator;
  constructor(keyComparator) {
    this.keyComparator = keyComparator;
  }
  hashCode(obj) {
    return this.keyComparator.hashCode(obj.key);
  }
  equals(a, b) {
    return this.keyComparator.equals(a.key, b.key);
  }
};
var HashMap = class _HashMap {
  static {
    __name(this, "HashMap");
  }
  backingStore;
  constructor(keyComparer) {
    if (keyComparer instanceof _HashMap) {
      this.backingStore = new HashSet(keyComparer.backingStore);
    } else {
      keyComparer = keyComparer ?? DefaultEqualityComparator.instance;
      this.backingStore = new HashSet(new MapKeyEqualityComparator(keyComparer));
    }
  }
  clear() {
    this.backingStore.clear();
  }
  containsKey(key) {
    return this.backingStore.contains({ key });
  }
  get(key) {
    const bucket = this.backingStore.get({ key });
    if (!bucket) {
      return;
    }
    return bucket.value;
  }
  get isEmpty() {
    return this.backingStore.isEmpty;
  }
  set(key, value) {
    const element = this.backingStore.get({ key, value });
    let result;
    if (!element) {
      this.backingStore.add({ key, value });
    } else {
      result = element.value;
      element.value = value;
    }
    return result;
  }
  setIfAbsent(key, value) {
    const element = this.backingStore.get({ key, value });
    let result;
    if (!element) {
      this.backingStore.add({ key, value });
    } else {
      result = element.value;
    }
    return result;
  }
  keys() {
    return this.backingStore.toArray().map((bucket) => {
      return bucket.key;
    });
  }
  values() {
    return this.backingStore.toArray().map((bucket) => {
      return bucket.value;
    });
  }
  get size() {
    return this.backingStore.size;
  }
  hashCode() {
    return this.backingStore.hashCode();
  }
  equals(o) {
    return this.backingStore.equals(o.backingStore);
  }
};
var TerminalNode = class {
  static {
    __name(this, "TerminalNode");
  }
  parent = null;
  symbol;
  constructor(symbol) {
    this.symbol = symbol;
  }
  getChild(_i) {
    return null;
  }
  getSymbol() {
    return this.symbol;
  }
  getPayload() {
    return this.symbol;
  }
  getSourceInterval() {
    if (this.symbol === null) {
      return Interval.INVALID_INTERVAL;
    }
    const tokenIndex = this.symbol.tokenIndex;
    return new Interval(tokenIndex, tokenIndex);
  }
  getChildCount() {
    return 0;
  }
  accept(visitor) {
    return visitor.visitTerminal(this);
  }
  getText() {
    return this.symbol?.text ?? "";
  }
  toString() {
    if (this.symbol?.type === Token.EOF) {
      return "<EOF>";
    } else {
      return this.symbol?.text ?? "";
    }
  }
  toStringTree() {
    return this.toString();
  }
};
var ErrorNode = class extends TerminalNode {
  static {
    __name(this, "ErrorNode");
  }
  accept(visitor) {
    return visitor.visitErrorNode(this);
  }
};
var CommonToken = class _CommonToken {
  static {
    __name(this, "CommonToken");
  }
  static EMPTY_SOURCE = [null, null];
  source;
  tokenIndex;
  start;
  stop;
  type;
  line;
  column;
  channel;
  #text;
  constructor(details) {
    this.type = details.type;
    this.source = details.source;
    this.tokenIndex = details.tokenIndex ?? -1;
    this.line = details.line ?? 0;
    this.column = details.column ?? -1;
    this.channel = details.channel ?? Token.DEFAULT_CHANNEL;
    this.start = details.start ?? 0;
    this.stop = details.stop ?? 0;
    this.#text = details.text;
    if (details.line === undefined && details.source[0] !== null) {
      this.line = details.source[0].line;
    }
    if (details.column === undefined && details.source[0] !== null) {
      this.column = details.source[0].column;
    }
  }
  static fromToken(token) {
    const source = [token.tokenSource, token.inputStream];
    return new _CommonToken({
      type: token.type,
      line: token.line,
      tokenIndex: token.tokenIndex,
      column: token.column,
      channel: token.channel,
      start: token.start,
      stop: token.stop,
      text: token.text,
      source
    });
  }
  static fromType(type, text) {
    return new _CommonToken({ type, text, source: _CommonToken.EMPTY_SOURCE });
  }
  static fromSource(source, type, channel, start, stop) {
    return new _CommonToken({ type, channel, start, stop, source });
  }
  get tokenSource() {
    return this.source[0];
  }
  get inputStream() {
    return this.source[1];
  }
  set inputStream(input) {
    this.source[1] = input;
  }
  clone() {
    const t = new _CommonToken({
      source: this.source,
      type: this.type,
      channel: this.channel,
      start: this.start,
      stop: this.stop,
      tokenIndex: this.tokenIndex,
      line: this.line,
      column: this.column,
      text: this.#text
    });
    return t;
  }
  toString(recognizer) {
    let channelStr = "";
    if (this.channel > 0) {
      channelStr = ",channel=" + this.channel;
    }
    let text = this.text;
    if (text) {
      text = text.replace(/\n/g, "\\n");
      text = text.replace(/\r/g, "\\r");
      text = text.replace(/\t/g, "\\t");
    } else {
      text = "<no text>";
    }
    let typeString = String(this.type);
    if (recognizer) {
      typeString = recognizer.vocabulary.getDisplayName(this.type) ?? "<unknown>";
    }
    return "[@" + this.tokenIndex + "," + this.start + ":" + this.stop + "='" + text + "',<" + typeString + ">" + channelStr + "," + this.line + ":" + this.column + "]";
  }
  get text() {
    if (this.#text !== undefined) {
      return this.#text;
    }
    const input = this.inputStream;
    if (!input) {
      return;
    }
    const n2 = input.size;
    if (this.start < n2 && this.stop < n2) {
      return input.getTextFromRange(this.start, this.stop);
    }
    return "<EOF>";
  }
  set text(text) {
    this.#text = text;
  }
  setText(text) {
    this.#text = text;
  }
  setType(ttype) {
    this.type = ttype;
  }
  setLine(line) {
    this.line = line;
  }
  setCharPositionInLine(pos) {
    this.column = pos;
  }
  setChannel(channel) {
    this.channel = channel;
  }
  setTokenIndex(index) {
    this.tokenIndex = index;
  }
};
var Trees = class _Trees {
  static {
    __name(this, "Trees");
  }
  static toStringTree(tree, ruleNames, recog) {
    ruleNames = ruleNames ?? null;
    if (recog) {
      ruleNames = recog.ruleNames;
    }
    let s = _Trees.getNodeText(tree, ruleNames);
    s = escapeWhitespace(s, false);
    const c = tree.getChildCount();
    if (c === 0) {
      return s;
    }
    let res = "(" + s + " ";
    if (c > 0) {
      s = _Trees.toStringTree(tree.getChild(0), ruleNames);
      res = res.concat(s);
    }
    for (let i = 1;i < c; i++) {
      s = _Trees.toStringTree(tree.getChild(i), ruleNames);
      res = res.concat(" " + s);
    }
    res = res.concat(")");
    return res;
  }
  static getNodeText(t, ruleNames, recog) {
    ruleNames = ruleNames ?? null;
    if (recog) {
      ruleNames = recog.ruleNames;
    }
    if (ruleNames !== null) {
      if (t instanceof ParserRuleContext) {
        const context = t.ruleContext;
        const altNumber = context.getAltNumber();
        if (altNumber !== 0) {
          return ruleNames[t.ruleIndex] + ":" + altNumber;
        }
        return ruleNames[t.ruleIndex];
      } else if (t instanceof ErrorNode) {
        return t.toString();
      } else if (t instanceof TerminalNode) {
        return t.symbol.text;
      }
    }
    const payload = t.getPayload();
    if (isToken(payload)) {
      return payload.text;
    }
    return String(t.getPayload());
  }
  static getChildren(t) {
    const list = [];
    for (let i = 0;i < t.getChildCount(); i++) {
      list.push(t.getChild(i));
    }
    return list;
  }
  static getAncestors(t) {
    if (t.parent === null) {
      return [];
    }
    let ancestors = [];
    let p = t.parent;
    while (p !== null) {
      ancestors = [p].concat(ancestors);
      p = p.parent;
    }
    return ancestors;
  }
  static isAncestorOf(t, u) {
    if (t === null || u === null || t.parent === null) {
      return false;
    }
    let p = u.parent;
    while (p !== null) {
      if (t === p) {
        return true;
      }
      p = p.parent;
    }
    return false;
  }
  static findAllTokenNodes(t, ttype) {
    return _Trees.findAllNodes(t, ttype, true);
  }
  static findAllRuleNodes(t, ruleIndex) {
    return _Trees.findAllNodes(t, ruleIndex, false);
  }
  static findAllNodes(t, index, findTokens) {
    const nodes = [];
    _Trees.doFindAllNodes(t, index, findTokens, nodes);
    return nodes;
  }
  static descendants(t) {
    let nodes = [t];
    for (let i = 0;i < t.getChildCount(); i++) {
      nodes = nodes.concat(_Trees.descendants(t.getChild(i)));
    }
    return nodes;
  }
  static getRootOfSubtreeEnclosingRegion(t, startTokenIndex, stopTokenIndex) {
    const n2 = t.getChildCount();
    for (let i = 0;i < n2; i++) {
      const child = t.getChild(i);
      const r = this.getRootOfSubtreeEnclosingRegion(child, startTokenIndex, stopTokenIndex);
      if (r !== null) {
        return r;
      }
    }
    if (t instanceof ParserRuleContext) {
      if (startTokenIndex >= t.start.tokenIndex && (t.stop === null || stopTokenIndex <= t.stop.tokenIndex)) {
        return t;
      }
    }
    return null;
  }
  static stripChildrenOutOfRange(t, root, startIndex, stopIndex) {
    if (t === null) {
      return;
    }
    for (let i = 0;i < t.getChildCount(); i++) {
      const child = t.getChild(i);
      const range = child.getSourceInterval();
      if (t instanceof ParserRuleContext && (range.stop < startIndex || range.start > stopIndex)) {
        if (this.isAncestorOf(child, root)) {
          const abbrev = CommonToken.fromType(Token.INVALID_TYPE, "...");
          t.children[i] = new TerminalNode(abbrev);
        }
      }
    }
  }
  static doFindAllNodes(t, index, findTokens, nodes) {
    if (findTokens && t instanceof TerminalNode) {
      if (t.symbol?.type === index) {
        nodes.push(t);
      }
    } else if (!findTokens && t instanceof ParserRuleContext) {
      if (t.ruleIndex === index) {
        nodes.push(t);
      }
    }
    for (let i = 0;i < t.getChildCount(); i++) {
      _Trees.doFindAllNodes(t.getChild(i), index, findTokens, nodes);
    }
  }
};
var ParserRuleContext = class _ParserRuleContext {
  static {
    __name(this, "ParserRuleContext");
  }
  static empty = new _ParserRuleContext(null);
  start = null;
  stop = null;
  children = [];
  invokingState;
  parent;
  constructor(parent, invokingStateNumber = -1) {
    this.parent = parent;
    this.invokingState = invokingStateNumber;
  }
  copyFrom(ctx) {
    this.parent = ctx.parent;
    this.invokingState = ctx.invokingState;
    this.children.slice(0, this.children.length);
    this.start = ctx.start;
    this.stop = ctx.stop;
    if (ctx.children) {
      ctx.children.forEach((child) => {
        if (child instanceof ErrorNode) {
          this.children.push(child);
          child.parent = this;
        }
      });
    }
  }
  enterRule(_listener) {}
  exitRule(_listener) {}
  addChild(child) {
    this.children.push(child);
    return child;
  }
  removeLastChild() {
    this.children.pop();
  }
  addTokenNode(token) {
    const node = new TerminalNode(token);
    this.children.push(node);
    node.parent = this;
    return node;
  }
  addErrorNode(errorNode) {
    errorNode.parent = this;
    this.children.push(errorNode);
    return errorNode;
  }
  getChild(i, type) {
    if (i < 0 || i >= this.children.length) {
      return null;
    }
    if (!type) {
      return this.children[i];
    }
    for (const child of this.children) {
      if (child instanceof type) {
        if (i === 0) {
          return child;
        } else {
          i -= 1;
        }
      }
    }
    return null;
  }
  getToken(ttype, i) {
    if (i < 0 || i >= this.children.length) {
      return null;
    }
    for (const child of this.children) {
      if ("symbol" in child) {
        if (child.symbol?.type === ttype) {
          if (i === 0) {
            return child;
          } else {
            i -= 1;
          }
        }
      }
    }
    return null;
  }
  getTokens(ttype) {
    const tokens = [];
    for (const child of this.children) {
      if ("symbol" in child) {
        if (child.symbol?.type === ttype) {
          tokens.push(child);
        }
      }
    }
    return tokens;
  }
  getRuleContext(index, ctxType) {
    return this.getChild(index, ctxType);
  }
  getRuleContexts(ctxType) {
    const contexts = [];
    for (const child of this.children) {
      if (child instanceof ctxType) {
        contexts.push(child);
      }
    }
    return contexts;
  }
  getChildCount() {
    return this.children.length;
  }
  getSourceInterval() {
    if (this.start === null) {
      return Interval.INVALID_INTERVAL;
    }
    if (this.stop === null || this.stop.tokenIndex < this.start.tokenIndex) {
      return new Interval(this.start.tokenIndex, this.start.tokenIndex - 1);
    }
    return new Interval(this.start.tokenIndex, this.stop.tokenIndex);
  }
  depth() {
    let n2 = 0;
    let p = this;
    while (p !== null) {
      p = p.parent;
      n2 += 1;
    }
    return n2;
  }
  isEmpty() {
    return this.invokingState === -1;
  }
  get ruleContext() {
    return this;
  }
  get ruleIndex() {
    return -1;
  }
  getPayload() {
    return this;
  }
  getText() {
    if (this.children.length === 0) {
      return "";
    }
    return this.children.map((child) => {
      return child.getText();
    }).join("");
  }
  getAltNumber() {
    return ATN.INVALID_ALT_NUMBER;
  }
  setAltNumber(_altNumber) {}
  accept(visitor) {
    return visitor.visitChildren(this);
  }
  toStringTree(...args) {
    if (args.length < 2) {
      return Trees.toStringTree(this, null, args[0]);
    }
    return Trees.toStringTree(this, args[0], args[1]);
  }
  toString(ruleNames, stop) {
    ruleNames = ruleNames ?? null;
    stop = stop ?? null;
    let p = this;
    let s = "[";
    while (p !== null && p !== stop) {
      if (ruleNames === null) {
        if (!p.isEmpty()) {
          s += p.invokingState;
        }
      } else {
        const ri = p.ruleIndex;
        const ruleName = ri >= 0 && ri < ruleNames.length ? ruleNames[ri] : "" + ri;
        s += ruleName;
      }
      if (p.parent !== null && (ruleNames !== null || !p.parent.isEmpty())) {
        s += " ";
      }
      p = p.parent;
    }
    s += "]";
    return s;
  }
};
var ArrayPredictionContext = class _ArrayPredictionContext extends PredictionContext {
  static {
    __name(this, "ArrayPredictionContext");
  }
  parents = [];
  returnStates = [];
  constructor(parents, returnStates) {
    super(PredictionContext.calculateHashCodeList(parents, returnStates));
    this.parents = parents;
    this.returnStates = returnStates;
    return this;
  }
  isEmpty() {
    return this.returnStates[0] === PredictionContext.EMPTY_RETURN_STATE;
  }
  get length() {
    return this.returnStates.length;
  }
  getParent(index) {
    return this.parents[index];
  }
  getReturnState(index) {
    return this.returnStates[index];
  }
  equals(other) {
    if (this === other) {
      return true;
    }
    if (!(other instanceof _ArrayPredictionContext) || this.hashCode() !== other.hashCode()) {
      return false;
    }
    return equalNumberArrays(this.returnStates, other.returnStates) && equalArrays(this.parents, other.parents);
  }
  toString() {
    if (this.isEmpty()) {
      return "[]";
    }
    const entries = [];
    for (let i = 0;i < this.returnStates.length; i++) {
      if (this.returnStates[i] === PredictionContext.EMPTY_RETURN_STATE) {
        entries.push("$");
        continue;
      }
      entries.push(this.returnStates[i].toString());
      if (this.parents[i]) {
        entries.push(this.parents[i].toString());
      } else {
        entries.push("null");
      }
    }
    return `[${entries.join(", ")}]`;
  }
};
var createSingletonPredictionContext = /* @__PURE__ */ __name((parent, returnState) => {
  if (returnState === PredictionContext.EMPTY_RETURN_STATE && parent === null) {
    return EmptyPredictionContext.instance;
  } else {
    return new SingletonPredictionContext(parent, returnState);
  }
}, "createSingletonPredictionContext");
var predictionContextFromRuleContext = /* @__PURE__ */ __name((atn, outerContext) => {
  if (!outerContext) {
    outerContext = ParserRuleContext.empty;
  }
  if (!outerContext.parent || outerContext === ParserRuleContext.empty) {
    return EmptyPredictionContext.instance;
  }
  const parent = predictionContextFromRuleContext(atn, outerContext.parent);
  const state = atn.states[outerContext.invokingState];
  const transition = state.transitions[0];
  return createSingletonPredictionContext(parent, transition.followState.stateNumber);
}, "predictionContextFromRuleContext");
var getCachedPredictionContext = /* @__PURE__ */ __name((context, contextCache, visited) => {
  if (context.isEmpty()) {
    return context;
  }
  let existing = visited.get(context);
  if (existing) {
    return existing;
  }
  existing = contextCache.get(context);
  if (existing) {
    visited.set(context, existing);
    return existing;
  }
  let changed = false;
  let parents = [];
  for (let i = 0;i < parents.length; i++) {
    const parent = getCachedPredictionContext(context.getParent(i), contextCache, visited);
    if (changed || parent !== context.getParent(i)) {
      if (!changed) {
        parents = [];
        for (let j = 0;j < context.length; j++) {
          parents[j] = context.getParent(j);
        }
        changed = true;
      }
      parents[i] = parent;
    }
  }
  if (!changed) {
    contextCache.add(context);
    visited.set(context, context);
    return context;
  }
  let updated;
  if (parents.length === 0) {
    updated = EmptyPredictionContext.instance;
  } else if (parents.length === 1) {
    updated = createSingletonPredictionContext(parents[0] ?? undefined, context.getReturnState(0));
  } else {
    updated = new ArrayPredictionContext(parents, context.returnStates);
  }
  contextCache.add(updated);
  visited.set(updated, updated);
  visited.set(context, updated);
  return updated;
}, "getCachedPredictionContext");
var merge = /* @__PURE__ */ __name((a, b, rootIsWildcard, mergeCache) => {
  if (a === b || a.equals(b)) {
    return a;
  }
  if (a instanceof SingletonPredictionContext && b instanceof SingletonPredictionContext) {
    return mergeSingletons(a, b, rootIsWildcard, mergeCache);
  }
  if (rootIsWildcard) {
    if (a instanceof EmptyPredictionContext) {
      return a;
    }
    if (b instanceof EmptyPredictionContext) {
      return b;
    }
  }
  if (a instanceof SingletonPredictionContext) {
    a = new ArrayPredictionContext([a.parent], [a.returnState]);
  }
  if (b instanceof SingletonPredictionContext) {
    b = new ArrayPredictionContext([b.parent], [b.returnState]);
  }
  return mergeArrays(a, b, rootIsWildcard, mergeCache);
}, "merge");
var mergeArrays = /* @__PURE__ */ __name((a, b, rootIsWildcard, mergeCache) => {
  if (mergeCache) {
    let previous = mergeCache.get(a, b);
    if (previous) {
      return previous;
    }
    previous = mergeCache.get(b, a);
    if (previous) {
      return previous;
    }
  }
  let i = 0;
  let j = 0;
  let k = 0;
  let mergedReturnStates = new Array(a.returnStates.length + b.returnStates.length).fill(0);
  let mergedParents = new Array(a.returnStates.length + b.returnStates.length).fill(null);
  while (i < a.returnStates.length && j < b.returnStates.length) {
    const aParent = a.parents[i];
    const bParent = b.parents[j];
    if (a.returnStates[i] === b.returnStates[j]) {
      const payload = a.returnStates[i];
      const bothDollars = payload === PredictionContext.EMPTY_RETURN_STATE && aParent === null && bParent === null;
      const axAx = aParent !== null && bParent !== null && aParent === bParent;
      if (bothDollars || axAx) {
        mergedParents[k] = aParent;
        mergedReturnStates[k] = payload;
      } else {
        mergedParents[k] = merge(aParent, bParent, rootIsWildcard, mergeCache);
        mergedReturnStates[k] = payload;
      }
      i += 1;
      j += 1;
    } else if (a.returnStates[i] < b.returnStates[j]) {
      mergedParents[k] = aParent;
      mergedReturnStates[k] = a.returnStates[i];
      i += 1;
    } else {
      mergedParents[k] = bParent;
      mergedReturnStates[k] = b.returnStates[j];
      j += 1;
    }
    k += 1;
  }
  if (i < a.returnStates.length) {
    for (let p = i;p < a.returnStates.length; p++) {
      mergedParents[k] = a.parents[p];
      mergedReturnStates[k] = a.returnStates[p];
      k += 1;
    }
  } else {
    for (let p = j;p < b.returnStates.length; p++) {
      mergedParents[k] = b.parents[p];
      mergedReturnStates[k] = b.returnStates[p];
      k += 1;
    }
  }
  if (k < mergedParents.length) {
    if (k === 1) {
      const aNew = createSingletonPredictionContext(mergedParents[0] ?? undefined, mergedReturnStates[0]);
      if (mergeCache !== null) {
        mergeCache.set(a, b, aNew);
      }
      return aNew;
    }
    mergedParents = mergedParents.slice(0, k);
    mergedReturnStates = mergedReturnStates.slice(0, k);
  }
  const merged = new ArrayPredictionContext(mergedParents, mergedReturnStates);
  if (merged.equals(a)) {
    if (mergeCache !== null) {
      mergeCache.set(a, b, a);
    }
    if (PredictionContext.traceATNSimulator) {
      console.log("mergeArrays a=" + a + ",b=" + b + " -> a");
    }
    return a;
  }
  if (merged.equals(b)) {
    if (mergeCache !== null) {
      mergeCache.set(a, b, b);
    }
    return b;
  }
  combineCommonParents(mergedParents);
  if (mergeCache !== null) {
    mergeCache.set(a, b, merged);
  }
  if (PredictionContext.traceATNSimulator) {
    console.log("mergeArrays a=" + a + ",b=" + b + " -> " + merged);
  }
  return merged;
}, "mergeArrays");
var combineCommonParents = /* @__PURE__ */ __name((parents) => {
  const uniqueParents = new HashMap(ObjectEqualityComparator.instance);
  for (const parent of parents) {
    if (parent) {
      if (!uniqueParents.containsKey(parent)) {
        uniqueParents.set(parent, parent);
      }
    }
  }
  for (let q = 0;q < parents.length; q++) {
    if (parents[q]) {
      parents[q] = uniqueParents.get(parents[q]) ?? null;
    }
  }
}, "combineCommonParents");
var mergeSingletons = /* @__PURE__ */ __name((a, b, rootIsWildcard, mergeCache) => {
  if (mergeCache !== null) {
    let previous = mergeCache.get(a, b);
    if (previous !== null) {
      return previous;
    }
    previous = mergeCache.get(b, a);
    if (previous !== null) {
      return previous;
    }
  }
  const rootMerge = mergeRoot(a, b, rootIsWildcard);
  if (rootMerge !== null) {
    if (mergeCache !== null) {
      mergeCache.set(a, b, rootMerge);
    }
    return rootMerge;
  }
  if (a.returnState === b.returnState) {
    const parent = merge(a.parent, b.parent, rootIsWildcard, mergeCache);
    if (parent === a.parent) {
      return a;
    }
    if (parent === b.parent) {
      return b;
    }
    const spc = createSingletonPredictionContext(parent, a.returnState);
    if (mergeCache !== null) {
      mergeCache.set(a, b, spc);
    }
    return spc;
  } else {
    let singleParent = null;
    if (a === b || a.parent !== null && a.parent.equals(b.parent)) {
      singleParent = a.parent;
    }
    if (singleParent !== null) {
      const payloads2 = [a.returnState, b.returnState];
      if (a.returnState > b.returnState) {
        payloads2[0] = b.returnState;
        payloads2[1] = a.returnState;
      }
      const parents2 = [singleParent, singleParent];
      const apc = new ArrayPredictionContext(parents2, payloads2);
      if (mergeCache !== null) {
        mergeCache.set(a, b, apc);
      }
      return apc;
    }
    const payloads = [a.returnState, b.returnState];
    let parents = [a.parent, b.parent];
    if (a.returnState > b.returnState) {
      payloads[0] = b.returnState;
      payloads[1] = a.returnState;
      parents = [b.parent, a.parent];
    }
    const aNew = new ArrayPredictionContext(parents, payloads);
    if (mergeCache !== null) {
      mergeCache.set(a, b, aNew);
    }
    return aNew;
  }
}, "mergeSingletons");
var mergeRoot = /* @__PURE__ */ __name((a, b, rootIsWildcard) => {
  if (rootIsWildcard) {
    if (a === EmptyPredictionContext.instance || b === EmptyPredictionContext.instance) {
      return EmptyPredictionContext.instance;
    }
  } else {
    if (a === EmptyPredictionContext.instance && b === EmptyPredictionContext.instance) {
      return EmptyPredictionContext.instance;
    }
    if (a === EmptyPredictionContext.instance) {
      const payloads = [
        b.returnState,
        PredictionContext.EMPTY_RETURN_STATE
      ];
      const parents = [b.parent, null];
      return new ArrayPredictionContext(parents, payloads);
    }
    if (b === EmptyPredictionContext.instance) {
      const payloads = [a.returnState, PredictionContext.EMPTY_RETURN_STATE];
      const parents = [a.parent, null];
      return new ArrayPredictionContext(parents, payloads);
    }
  }
  return null;
}, "mergeRoot");
var LL1Analyzer = class _LL1Analyzer {
  constructor(atn) {
    this.atn = atn;
  }
  static {
    __name(this, "LL1Analyzer");
  }
  static hitPredicate = Token.INVALID_TYPE;
  getDecisionLookahead(s) {
    const count = s.transitions.length;
    const look = new Array(count);
    for (let alt = 0;alt < count; alt++) {
      const set = new IntervalSet;
      const lookBusy = new HashSet;
      this.doLook(s.transitions[alt].target, undefined, EmptyPredictionContext.instance, set, lookBusy, new BitSet, false, false);
      if (set.length > 0 && !set.contains(_LL1Analyzer.hitPredicate)) {
        look[alt] = set;
      }
    }
    return look;
  }
  look(s, stopState, ctx) {
    const r = new IntervalSet;
    const lookContext = ctx ? predictionContextFromRuleContext(this.atn, ctx) : null;
    this.doLook(s, stopState, lookContext, r, new HashSet, new BitSet, true, true);
    return r;
  }
  doLook(s, stopState, ctx, look, lookBusy, calledRuleStack, seeThruPreds, addEOF) {
    const c = ATNConfig.createWithContext(s, 0, ctx);
    if (lookBusy.get(c)) {
      return;
    }
    lookBusy.add(c);
    if (s === stopState) {
      if (!ctx) {
        look.addOne(Token.EPSILON);
        return;
      } else if (ctx.isEmpty() && addEOF) {
        look.addOne(Token.EOF);
        return;
      }
    }
    if (s.constructor.stateType === ATNState.RULE_STOP) {
      if (!ctx) {
        look.addOne(Token.EPSILON);
        return;
      } else if (ctx.isEmpty() && addEOF) {
        look.addOne(Token.EOF);
        return;
      }
      if (ctx !== EmptyPredictionContext.instance) {
        const removed = calledRuleStack.get(s.ruleIndex);
        try {
          calledRuleStack.clear(s.ruleIndex);
          for (let i = 0;i < ctx.length; i++) {
            const returnState = this.atn.states[ctx.getReturnState(i)];
            this.doLook(returnState, stopState, ctx.getParent(i), look, lookBusy, calledRuleStack, seeThruPreds, addEOF);
          }
        } finally {
          if (removed) {
            calledRuleStack.set(s.ruleIndex);
          }
        }
        return;
      }
    }
    for (const t of s.transitions) {
      switch (t.transitionType) {
        case Transition.RULE: {
          if (calledRuleStack.get(t.target.ruleIndex)) {
            continue;
          }
          const newContext = createSingletonPredictionContext(ctx ?? undefined, t.followState.stateNumber);
          try {
            calledRuleStack.set(t.target.ruleIndex);
            this.doLook(t.target, stopState, newContext, look, lookBusy, calledRuleStack, seeThruPreds, addEOF);
          } finally {
            calledRuleStack.clear(t.target.ruleIndex);
          }
          break;
        }
        case Transition.PREDICATE:
        case Transition.PRECEDENCE: {
          if (seeThruPreds) {
            this.doLook(t.target, stopState, ctx, look, lookBusy, calledRuleStack, seeThruPreds, addEOF);
          } else {
            look.addOne(_LL1Analyzer.hitPredicate);
          }
          break;
        }
        case Transition.WILDCARD: {
          look.addRange(Token.MIN_USER_TOKEN_TYPE, this.atn.maxTokenType);
          break;
        }
        default: {
          if (t.isEpsilon) {
            this.doLook(t.target, stopState, ctx, look, lookBusy, calledRuleStack, seeThruPreds, addEOF);
          } else {
            let set = t.label;
            if (set) {
              if (t instanceof NotSetTransition) {
                set = set.complement(Token.MIN_USER_TOKEN_TYPE, this.atn.maxTokenType);
              }
              look.addSet(set);
            }
          }
          break;
        }
      }
    }
  }
};
var ATN = class {
  static {
    __name(this, "ATN");
  }
  static INVALID_ALT_NUMBER = 0;
  static LEXER = 0;
  static PARSER = 1;
  grammarType;
  maxTokenType;
  states = [];
  decisionToState = [];
  ruleToStartState = [];
  ruleToStopState = [];
  modeNameToStartState = /* @__PURE__ */ new Map;
  ruleToTokenType = [];
  lexerActions = [];
  modeToStartState = [];
  analyzer;
  constructor(grammarType, maxTokenType) {
    this.grammarType = grammarType;
    this.maxTokenType = maxTokenType;
    this.analyzer = new LL1Analyzer(this);
  }
  nextTokens(atnState, ctx) {
    if (!ctx && atnState.nextTokenWithinRule) {
      return atnState.nextTokenWithinRule;
    }
    const next = this.analyzer.look(atnState, undefined, ctx);
    if (!ctx) {
      atnState.nextTokenWithinRule = next;
    }
    return next;
  }
  addState(state) {
    if (state) {
      state.stateNumber = this.states.length;
    }
    this.states.push(state);
  }
  removeState(state) {
    this.states[state.stateNumber] = null;
  }
  defineDecisionState(s) {
    this.decisionToState.push(s);
    s.decision = this.decisionToState.length - 1;
    return s.decision;
  }
  getDecisionState(decision) {
    if (this.decisionToState.length === 0) {
      return null;
    } else {
      return this.decisionToState[decision];
    }
  }
  getNumberOfDecisions() {
    return this.decisionToState.length;
  }
  getExpectedTokens(stateNumber, context) {
    if (stateNumber < 0 || stateNumber >= this.states.length) {
      throw new Error("Invalid state number.");
    }
    const s = this.states[stateNumber];
    let following = this.nextTokens(s);
    if (!following.contains(Token.EPSILON)) {
      return following;
    }
    let ctx = context;
    const expected = new IntervalSet;
    expected.addSet(following);
    expected.removeOne(Token.EPSILON);
    while (ctx !== null && ctx.invokingState >= 0 && following.contains(Token.EPSILON)) {
      const invokingState = this.states[ctx.invokingState];
      const rt = invokingState.transitions[0];
      following = this.nextTokens(rt.followState);
      expected.addSet(following);
      expected.removeOne(Token.EPSILON);
      ctx = ctx.parent;
    }
    if (following.contains(Token.EPSILON)) {
      expected.addOne(Token.EOF);
    }
    return expected;
  }
};
var KeyTypeEqualityComparer = class _KeyTypeEqualityComparer {
  static {
    __name(this, "KeyTypeEqualityComparer");
  }
  static instance = new _KeyTypeEqualityComparer;
  hashCode(config) {
    let hashCode = 7;
    hashCode = 31 * hashCode + config.state.stateNumber;
    hashCode = 31 * hashCode + config.alt;
    hashCode = 31 * hashCode + config.semanticContext.hashCode();
    return hashCode;
  }
  equals(a, b) {
    if (a === b) {
      return true;
    }
    return a.state.stateNumber === b.state.stateNumber && a.alt === b.alt && a.semanticContext.equals(b.semanticContext);
  }
};
var ATNConfigSet = class {
  static {
    __name(this, "ATNConfigSet");
  }
  configLookup = new HashSet(KeyTypeEqualityComparer.instance);
  configs = [];
  uniqueAlt = 0;
  hasSemanticContext = false;
  dipsIntoOuterContext = false;
  fullCtx = false;
  readOnly = false;
  conflictingAlts = null;
  firstStopState;
  #cachedHashCode = -1;
  constructor(fullCtxOrOldSet) {
    if (fullCtxOrOldSet !== undefined) {
      if (typeof fullCtxOrOldSet === "boolean") {
        this.fullCtx = fullCtxOrOldSet ?? true;
      } else {
        const old = fullCtxOrOldSet;
        this.addAll(old.configs);
        this.uniqueAlt = old.uniqueAlt;
        this.conflictingAlts = old.conflictingAlts;
        this.hasSemanticContext = old.hasSemanticContext;
        this.dipsIntoOuterContext = old.dipsIntoOuterContext;
      }
    }
  }
  [Symbol.iterator]() {
    return this.configs[Symbol.iterator]();
  }
  add(config, mergeCache = null) {
    if (this.readOnly) {
      throw new Error("This set is readonly");
    }
    if (!this.firstStopState && config.state.constructor.stateType === ATNState.RULE_STOP) {
      this.firstStopState = config;
    }
    this.hasSemanticContext ||= config.semanticContext !== SemanticContext.NONE;
    this.dipsIntoOuterContext ||= config.reachesIntoOuterContext;
    const existing = this.configLookup.getOrAdd(config);
    if (existing === config) {
      this.#cachedHashCode = -1;
      this.configs.push(config);
      return;
    }
    const rootIsWildcard = !this.fullCtx;
    const merged = merge(existing.context, config.context, rootIsWildcard, mergeCache);
    existing.reachesIntoOuterContext ||= config.reachesIntoOuterContext;
    existing.precedenceFilterSuppressed ||= config.precedenceFilterSuppressed;
    existing.context = merged;
  }
  get elements() {
    return this.configs;
  }
  getAlts() {
    const alts = new BitSet;
    for (const config of this.configs) {
      alts.set(config.alt);
    }
    return alts;
  }
  getPredicates() {
    const preds = [];
    for (const config of this.configs) {
      if (config.semanticContext !== SemanticContext.NONE) {
        preds.push(config.semanticContext);
      }
    }
    return preds;
  }
  getStates() {
    const states = new HashSet;
    for (const config of this.configs) {
      states.add(config.state);
    }
    return states;
  }
  optimizeConfigs(interpreter) {
    if (this.readOnly) {
      throw new Error("This set is readonly");
    }
    if (this.configLookup.size === 0) {
      return;
    }
    for (const config of this.configs) {
      config.context = interpreter.getCachedContext(config.context);
    }
  }
  addAll(coll) {
    for (const config of coll) {
      this.add(config);
    }
    return false;
  }
  equals(other) {
    if (this === other) {
      return true;
    }
    if (this.fullCtx === other.fullCtx && this.uniqueAlt === other.uniqueAlt && this.conflictingAlts === other.conflictingAlts && this.hasSemanticContext === other.hasSemanticContext && this.dipsIntoOuterContext === other.dipsIntoOuterContext && equalArrays(this.configs, other.configs)) {
      return true;
    }
    return false;
  }
  hashCode() {
    if (this.#cachedHashCode === -1) {
      this.#cachedHashCode = this.computeHashCode();
    }
    return this.#cachedHashCode;
  }
  get length() {
    return this.configs.length;
  }
  isEmpty() {
    return this.configs.length === 0;
  }
  contains(item) {
    if (this.configLookup === null) {
      throw new Error("This method is not implemented for readonly sets.");
    }
    return this.configLookup.contains(item);
  }
  containsFast(item) {
    if (this.configLookup === null) {
      throw new Error("This method is not implemented for readonly sets.");
    }
    return this.configLookup.contains(item);
  }
  clear() {
    if (this.readOnly) {
      throw new Error("This set is readonly");
    }
    this.configs = [];
    this.#cachedHashCode = -1;
    this.configLookup = new HashSet(KeyTypeEqualityComparer.instance);
  }
  setReadonly(readOnly) {
    this.readOnly = readOnly;
    if (readOnly) {
      this.configLookup = null;
    }
  }
  toString() {
    return arrayToString(this.configs) + (this.hasSemanticContext ? ",hasSemanticContext=" + this.hasSemanticContext : "") + (this.uniqueAlt !== ATN.INVALID_ALT_NUMBER ? ",uniqueAlt=" + this.uniqueAlt : "") + (this.conflictingAlts !== null ? ",conflictingAlts=" + this.conflictingAlts : "") + (this.dipsIntoOuterContext ? ",dipsIntoOuterContext" : "");
  }
  computeHashCode() {
    let hash = MurmurHash.initialize();
    this.configs.forEach((config) => {
      hash = MurmurHash.update(hash, config.hashCode());
    });
    hash = MurmurHash.finish(hash, this.configs.length);
    return hash;
  }
};
var BasicState = class extends ATNState {
  static {
    __name(this, "BasicState");
  }
  static stateType = ATNState.BASIC;
};
var DecisionState = class extends ATNState {
  static {
    __name(this, "DecisionState");
  }
  decision = -1;
  nonGreedy = false;
};
var BlockStartState = class extends DecisionState {
  static {
    __name(this, "BlockStartState");
  }
  endState;
};
var BlockEndState = class extends ATNState {
  static {
    __name(this, "BlockEndState");
  }
  static stateType = ATNState.BLOCK_END;
  startState;
};
var LoopEndState = class extends ATNState {
  static {
    __name(this, "LoopEndState");
  }
  static stateType = ATNState.LOOP_END;
  loopBackState;
};
var RuleStartState = class extends ATNState {
  static {
    __name(this, "RuleStartState");
  }
  static stateType = ATNState.RULE_START;
  stopState;
  isLeftRecursiveRule = false;
};
var RuleStopState = class extends ATNState {
  static {
    __name(this, "RuleStopState");
  }
  static stateType = ATNState.RULE_STOP;
};
var TokensStartState = class extends DecisionState {
  static {
    __name(this, "TokensStartState");
  }
  static stateType = ATNState.TOKEN_START;
};
var PlusLoopbackState = class extends DecisionState {
  static {
    __name(this, "PlusLoopbackState");
  }
  static stateType = ATNState.PLUS_LOOP_BACK;
};
var StarLoopbackState = class extends ATNState {
  static {
    __name(this, "StarLoopbackState");
  }
  static stateType = ATNState.STAR_LOOP_BACK;
};
var StarLoopEntryState = class extends DecisionState {
  static {
    __name(this, "StarLoopEntryState");
  }
  static stateType = ATNState.STAR_LOOP_ENTRY;
  loopBackState;
  precedenceRuleDecision = false;
};
var PlusBlockStartState = class extends BlockStartState {
  static {
    __name(this, "PlusBlockStartState");
  }
  static stateType = ATNState.PLUS_BLOCK_START;
  loopBackState;
};
var StarBlockStartState = class extends BlockStartState {
  static {
    __name(this, "StarBlockStartState");
  }
  static stateType = ATNState.STAR_BLOCK_START;
};
var BasicBlockStartState = class extends BlockStartState {
  static {
    __name(this, "BasicBlockStartState");
  }
  static stateType = ATNState.BLOCK_START;
};
var AtomTransition = class extends Transition {
  static {
    __name(this, "AtomTransition");
  }
  labelValue;
  #label;
  constructor(target, label) {
    super(target);
    this.labelValue = label;
    this.#label = IntervalSet.of(label, label);
  }
  get label() {
    return this.#label;
  }
  get transitionType() {
    return Transition.ATOM;
  }
  matches(symbol) {
    return this.labelValue === symbol;
  }
  toString() {
    return this.labelValue.toString();
  }
};
var RuleTransition = class extends Transition {
  static {
    __name(this, "RuleTransition");
  }
  ruleIndex;
  precedence;
  followState;
  constructor(ruleStart, ruleIndex, precedence, followState) {
    super(ruleStart);
    this.ruleIndex = ruleIndex;
    this.precedence = precedence;
    this.followState = followState;
  }
  get isEpsilon() {
    return true;
  }
  get transitionType() {
    return Transition.RULE;
  }
  matches(_symbol, _minVocabSymbol, _maxVocabSymbol) {
    return false;
  }
};
var RangeTransition = class extends Transition {
  static {
    __name(this, "RangeTransition");
  }
  start;
  stop;
  #label = new IntervalSet;
  constructor(target, start, stop) {
    super(target);
    this.start = start;
    this.stop = stop;
    this.#label.addRange(start, stop);
  }
  get label() {
    return this.#label;
  }
  get transitionType() {
    return Transition.RANGE;
  }
  matches(symbol, _minVocabSymbol, _maxVocabSymbol) {
    return symbol >= this.start && symbol <= this.stop;
  }
  toString() {
    return "'" + String.fromCharCode(this.start) + "'..'" + String.fromCharCode(this.stop) + "'";
  }
};
var ActionTransition = class extends Transition {
  static {
    __name(this, "ActionTransition");
  }
  ruleIndex;
  actionIndex;
  isCtxDependent;
  constructor(target, ruleIndex, actionIndex, isCtxDependent) {
    super(target);
    this.ruleIndex = ruleIndex;
    this.actionIndex = actionIndex ?? -1;
    this.isCtxDependent = isCtxDependent ?? false;
  }
  get isEpsilon() {
    return true;
  }
  get transitionType() {
    return Transition.ACTION;
  }
  matches(_symbol, _minVocabSymbol, _maxVocabSymbol) {
    return false;
  }
  toString() {
    return "action_" + this.ruleIndex + ":" + this.actionIndex;
  }
};
var EpsilonTransition = class extends Transition {
  static {
    __name(this, "EpsilonTransition");
  }
  #outermostPrecedenceReturn;
  constructor(target, outermostPrecedenceReturn = -1) {
    super(target);
    this.#outermostPrecedenceReturn = outermostPrecedenceReturn;
  }
  get outermostPrecedenceReturn() {
    return this.#outermostPrecedenceReturn;
  }
  get isEpsilon() {
    return true;
  }
  get transitionType() {
    return Transition.EPSILON;
  }
  matches() {
    return false;
  }
  toString() {
    return "epsilon";
  }
};
var WildcardTransition = class extends Transition {
  static {
    __name(this, "WildcardTransition");
  }
  get transitionType() {
    return Transition.WILDCARD;
  }
  matches(symbol, minVocabSymbol, maxVocabSymbol) {
    return symbol >= minVocabSymbol && symbol <= maxVocabSymbol;
  }
  toString() {
    return ".";
  }
};
var AbstractPredicateTransition = class extends Transition {
  static {
    __name(this, "AbstractPredicateTransition");
  }
  constructor(target) {
    super(target);
  }
};
var PredicateTransition = class extends AbstractPredicateTransition {
  static {
    __name(this, "PredicateTransition");
  }
  ruleIndex;
  predIndex;
  isCtxDependent;
  constructor(target, ruleIndex, predIndex, isCtxDependent) {
    super(target);
    this.ruleIndex = ruleIndex;
    this.predIndex = predIndex;
    this.isCtxDependent = isCtxDependent;
  }
  get isEpsilon() {
    return true;
  }
  matches(_symbol, _minVocabSymbol, _maxVocabSymbol) {
    return false;
  }
  get transitionType() {
    return Transition.PREDICATE;
  }
  getPredicate() {
    return new SemanticContext.Predicate(this.ruleIndex, this.predIndex, this.isCtxDependent);
  }
  toString() {
    return "pred_" + this.ruleIndex + ":" + this.predIndex;
  }
};
var PrecedencePredicateTransition = class extends AbstractPredicateTransition {
  static {
    __name(this, "PrecedencePredicateTransition");
  }
  precedence;
  constructor(target, precedence) {
    super(target);
    this.precedence = precedence;
  }
  get isEpsilon() {
    return true;
  }
  matches(_symbol, _minVocabSymbol, _maxVocabSymbol) {
    return false;
  }
  getPredicate() {
    return new SemanticContext.PrecedencePredicate(this.precedence);
  }
  get transitionType() {
    return Transition.PRECEDENCE;
  }
  toString() {
    return this.precedence + " >= _p";
  }
};
var LexerActionType = {
  CHANNEL: 0,
  CUSTOM: 1,
  MODE: 2,
  MORE: 3,
  POP_MODE: 4,
  PUSH_MODE: 5,
  SKIP: 6,
  TYPE: 7
};
var LexerSkipAction = class _LexerSkipAction {
  static {
    __name(this, "LexerSkipAction");
  }
  static instance = new _LexerSkipAction;
  actionType;
  isPositionDependent = false;
  constructor() {
    this.actionType = LexerActionType.SKIP;
  }
  equals(obj) {
    return obj === this;
  }
  hashCode() {
    return LexerActionType.SKIP;
  }
  execute(lexer) {
    lexer.skip();
  }
  toString() {
    return "skip";
  }
};
var LexerChannelAction = class _LexerChannelAction {
  static {
    __name(this, "LexerChannelAction");
  }
  channel;
  actionType;
  isPositionDependent = false;
  cachedHashCode;
  constructor(channel) {
    this.actionType = LexerActionType.CHANNEL;
    this.channel = channel;
  }
  execute(lexer) {
    lexer.channel = this.channel;
  }
  hashCode() {
    if (this.cachedHashCode === undefined) {
      let hash = MurmurHash.initialize();
      hash = MurmurHash.update(hash, this.actionType);
      hash = MurmurHash.update(hash, this.channel);
      this.cachedHashCode = MurmurHash.finish(hash, 2);
    }
    return this.cachedHashCode;
  }
  equals(other) {
    if (this === other) {
      return true;
    }
    if (!(other instanceof _LexerChannelAction)) {
      return false;
    }
    return this.channel === other.channel;
  }
  toString() {
    return "channel(" + this.channel + ")";
  }
};
var LexerCustomAction = class _LexerCustomAction {
  static {
    __name(this, "LexerCustomAction");
  }
  ruleIndex;
  actionIndex;
  actionType;
  isPositionDependent = true;
  cachedHashCode;
  constructor(ruleIndex, actionIndex) {
    this.actionType = LexerActionType.CUSTOM;
    this.ruleIndex = ruleIndex;
    this.actionIndex = actionIndex;
  }
  execute(lexer) {
    lexer.action(null, this.ruleIndex, this.actionIndex);
  }
  hashCode() {
    if (this.cachedHashCode === undefined) {
      let hash = MurmurHash.initialize();
      hash = MurmurHash.update(hash, this.actionType);
      hash = MurmurHash.update(hash, this.ruleIndex);
      hash = MurmurHash.update(hash, this.actionIndex);
      this.cachedHashCode = MurmurHash.finish(hash, 3);
    }
    return this.cachedHashCode;
  }
  equals(other) {
    if (this === other) {
      return true;
    }
    if (!(other instanceof _LexerCustomAction)) {
      return false;
    }
    return this.ruleIndex === other.ruleIndex && this.actionIndex === other.actionIndex;
  }
};
var LexerMoreAction = class _LexerMoreAction {
  static {
    __name(this, "LexerMoreAction");
  }
  static instance = new _LexerMoreAction;
  actionType;
  isPositionDependent = false;
  constructor() {
    this.actionType = LexerActionType.MORE;
  }
  equals(obj) {
    return obj === this;
  }
  hashCode() {
    return LexerActionType.MORE;
  }
  execute(lexer) {
    lexer.more();
  }
  toString() {
    return "more";
  }
};
var LexerTypeAction = class _LexerTypeAction {
  static {
    __name(this, "LexerTypeAction");
  }
  type;
  actionType;
  isPositionDependent = false;
  cachedHashCode;
  constructor(type) {
    this.actionType = LexerActionType.TYPE;
    this.type = type;
  }
  execute(lexer) {
    lexer.type = this.type;
  }
  hashCode() {
    if (this.cachedHashCode === undefined) {
      let hash = MurmurHash.initialize();
      hash = MurmurHash.update(hash, this.actionType);
      hash = MurmurHash.update(hash, this.type);
      this.cachedHashCode = MurmurHash.finish(hash, 2);
    }
    return this.cachedHashCode;
  }
  equals(other) {
    if (this === other) {
      return true;
    }
    if (!(other instanceof _LexerTypeAction)) {
      return false;
    }
    return this.type === other.type;
  }
  toString() {
    return "type(" + this.type + ")";
  }
};
var LexerPushModeAction = class _LexerPushModeAction {
  static {
    __name(this, "LexerPushModeAction");
  }
  mode;
  actionType;
  isPositionDependent = false;
  cachedHashCode;
  constructor(mode) {
    this.actionType = LexerActionType.PUSH_MODE;
    this.mode = mode;
  }
  execute(lexer) {
    lexer.pushMode(this.mode);
  }
  hashCode() {
    if (this.cachedHashCode === undefined) {
      let hash = MurmurHash.initialize();
      hash = MurmurHash.update(hash, this.actionType);
      hash = MurmurHash.update(hash, this.mode);
      this.cachedHashCode = MurmurHash.finish(hash, 2);
    }
    return this.cachedHashCode;
  }
  equals(other) {
    if (this === other) {
      return true;
    }
    if (!(other instanceof _LexerPushModeAction)) {
      return false;
    }
    return this.mode === other.mode;
  }
  toString() {
    return "pushMode(" + this.mode + ")";
  }
};
var LexerPopModeAction = class _LexerPopModeAction {
  static {
    __name(this, "LexerPopModeAction");
  }
  static instance = new _LexerPopModeAction;
  actionType;
  isPositionDependent = false;
  constructor() {
    this.actionType = LexerActionType.POP_MODE;
  }
  equals(obj) {
    return obj === this;
  }
  hashCode() {
    return LexerActionType.POP_MODE;
  }
  execute(lexer) {
    lexer.popMode();
  }
  toString() {
    return "popMode";
  }
};
var LexerModeAction = class _LexerModeAction {
  static {
    __name(this, "LexerModeAction");
  }
  mode;
  actionType;
  isPositionDependent = false;
  cachedHashCode;
  constructor(mode) {
    this.actionType = LexerActionType.MODE;
    this.mode = mode;
  }
  execute(lexer) {
    lexer.mode = this.mode;
  }
  hashCode() {
    if (this.cachedHashCode === undefined) {
      let hash = MurmurHash.initialize();
      hash = MurmurHash.update(hash, this.actionType);
      hash = MurmurHash.update(hash, this.mode);
      this.cachedHashCode = MurmurHash.finish(hash, 2);
    }
    return this.cachedHashCode;
  }
  equals(other) {
    if (this === other) {
      return true;
    }
    if (!(other instanceof _LexerModeAction)) {
      return false;
    }
    return this.mode === other.mode;
  }
  toString() {
    return "mode(" + this.mode + ")";
  }
};
var ATNDeserializer = class _ATNDeserializer {
  static {
    __name(this, "ATNDeserializer");
  }
  static SERIALIZED_VERSION = 4;
  static stateTypeMapper = /* @__PURE__ */ new Map([
    [ATNState.INVALID_TYPE, undefined],
    [ATNState.BASIC, BasicState],
    [ATNState.RULE_START, RuleStartState],
    [ATNState.BLOCK_START, BasicBlockStartState],
    [ATNState.PLUS_BLOCK_START, PlusBlockStartState],
    [ATNState.STAR_BLOCK_START, StarBlockStartState],
    [ATNState.TOKEN_START, TokensStartState],
    [ATNState.RULE_STOP, RuleStopState],
    [ATNState.BLOCK_END, BlockEndState],
    [ATNState.STAR_LOOP_BACK, StarLoopbackState],
    [ATNState.STAR_LOOP_ENTRY, StarLoopEntryState],
    [ATNState.PLUS_LOOP_BACK, PlusLoopbackState],
    [ATNState.LOOP_END, LoopEndState]
  ]);
  static lexerActionFactoryMapper = /* @__PURE__ */ new Map([
    [LexerActionType.CHANNEL, (data1) => {
      return new LexerChannelAction(data1);
    }],
    [LexerActionType.CUSTOM, (data1, data2) => {
      return new LexerCustomAction(data1, data2);
    }],
    [LexerActionType.MODE, (data1) => {
      return new LexerModeAction(data1);
    }],
    [LexerActionType.MORE, () => {
      return LexerMoreAction.instance;
    }],
    [LexerActionType.POP_MODE, () => {
      return LexerPopModeAction.instance;
    }],
    [LexerActionType.PUSH_MODE, (data1) => {
      return new LexerPushModeAction(data1);
    }],
    [LexerActionType.SKIP, () => {
      return LexerSkipAction.instance;
    }],
    [LexerActionType.TYPE, (data1) => {
      return new LexerTypeAction(data1);
    }]
  ]);
  data = [];
  pos = 0;
  deserializationOptions;
  actionFactories;
  constructor(options) {
    if (!options) {
      options = { readOnly: false, verifyATN: true, generateRuleBypassTransitions: false };
    }
    this.deserializationOptions = options;
  }
  deserialize(data) {
    this.data = data;
    this.checkVersion();
    const atn = this.readATN();
    this.readStates(atn);
    this.readRules(atn);
    this.readModes(atn);
    const sets = [];
    this.readSets(atn, sets);
    this.readEdges(atn, sets);
    this.readDecisions(atn);
    this.readLexerActions(atn);
    this.markPrecedenceDecisions(atn);
    this.verifyATN(atn);
    if (this.deserializationOptions.generateRuleBypassTransitions && atn.grammarType === ATN.PARSER) {
      this.generateRuleBypassTransitions(atn);
      this.verifyATN(atn);
    }
    return atn;
  }
  checkVersion() {
    const version = this.data[this.pos++];
    if (version !== _ATNDeserializer.SERIALIZED_VERSION) {
      throw new Error("Could not deserialize ATN with version " + version + " (expected " + _ATNDeserializer.SERIALIZED_VERSION + ").");
    }
  }
  readATN() {
    const grammarType = this.data[this.pos++];
    const maxTokenType = this.data[this.pos++];
    return new ATN(grammarType, maxTokenType);
  }
  readStates(atn) {
    let j;
    let stateNumber;
    const loopBackStateNumbers = [];
    const endStateNumbers = [];
    const stateCount = this.data[this.pos++];
    for (let i = 0;i < stateCount; i++) {
      const stateType = this.data[this.pos++];
      if (stateType === ATNState.INVALID_TYPE) {
        atn.addState(null);
        continue;
      }
      const ruleIndex = this.data[this.pos++];
      const s = this.stateFactory(stateType, ruleIndex);
      if (stateType === ATNState.LOOP_END) {
        const loopBackStateNumber = this.data[this.pos++];
        loopBackStateNumbers.push([s, loopBackStateNumber]);
      } else if (s instanceof BlockStartState) {
        const endStateNumber = this.data[this.pos++];
        endStateNumbers.push([s, endStateNumber]);
      }
      atn.addState(s);
    }
    for (j = 0;j < loopBackStateNumbers.length; j++) {
      const pair = loopBackStateNumbers[j];
      pair[0].loopBackState = atn.states[pair[1]] ?? undefined;
    }
    for (j = 0;j < endStateNumbers.length; j++) {
      const pair = endStateNumbers[j];
      pair[0].endState = atn.states[pair[1]];
    }
    const numNonGreedyStates = this.data[this.pos++];
    for (j = 0;j < numNonGreedyStates; j++) {
      stateNumber = this.data[this.pos++];
      atn.states[stateNumber].nonGreedy = true;
    }
    const numPrecedenceStates = this.data[this.pos++];
    for (j = 0;j < numPrecedenceStates; j++) {
      stateNumber = this.data[this.pos++];
      atn.states[stateNumber].isLeftRecursiveRule = true;
    }
  }
  readRules(atn) {
    let i;
    const ruleCount = this.data[this.pos++];
    if (atn.grammarType === ATN.LEXER) {
      atn.ruleToTokenType = new Array(ruleCount);
      atn.ruleToTokenType.fill(0);
    }
    atn.ruleToStartState = new Array(ruleCount);
    atn.ruleToStartState.fill(null);
    for (i = 0;i < ruleCount; i++) {
      const s = this.data[this.pos++];
      atn.ruleToStartState[i] = atn.states[s];
      if (atn.grammarType === ATN.LEXER) {
        const tokenType = this.data[this.pos++];
        atn.ruleToTokenType[i] = tokenType;
      }
    }
    atn.ruleToStopState = new Array(ruleCount);
    atn.ruleToStopState.fill(null);
    for (i = 0;i < atn.states.length; i++) {
      const state = atn.states[i];
      if (!(state instanceof RuleStopState)) {
        continue;
      }
      atn.ruleToStopState[state.ruleIndex] = state;
      atn.ruleToStartState[state.ruleIndex].stopState = state;
    }
  }
  readModes(atn) {
    const modeCount = this.data[this.pos++];
    for (let i = 0;i < modeCount; i++) {
      const s = this.data[this.pos++];
      atn.modeToStartState.push(atn.states[s]);
    }
  }
  readSets(atn, sets) {
    const m2 = this.data[this.pos++];
    for (let i = 0;i < m2; i++) {
      const intervalSet = new IntervalSet;
      sets.push(intervalSet);
      const n2 = this.data[this.pos++];
      const containsEof = this.data[this.pos++];
      if (containsEof !== 0) {
        intervalSet.addOne(-1);
      }
      for (let j = 0;j < n2; j++) {
        const i1 = this.data[this.pos++];
        const i2 = this.data[this.pos++];
        intervalSet.addRange(i1, i2);
      }
    }
  }
  readEdges(atn, sets) {
    let i;
    let j;
    let state;
    let trans;
    let target;
    const edgeCount = this.data[this.pos++];
    for (i = 0;i < edgeCount; i++) {
      const src = this.data[this.pos++];
      const trg = this.data[this.pos++];
      const ttype = this.data[this.pos++];
      const arg1 = this.data[this.pos++];
      const arg2 = this.data[this.pos++];
      const arg3 = this.data[this.pos++];
      trans = this.edgeFactory(atn, ttype, trg, arg1, arg2, arg3, sets);
      const srcState = atn.states[src];
      srcState.addTransition(trans);
    }
    for (i = 0;i < atn.states.length; i++) {
      state = atn.states[i];
      for (j = 0;j < state.transitions.length; j++) {
        const t = state.transitions[j];
        if (!(t instanceof RuleTransition)) {
          continue;
        }
        let outermostPrecedenceReturn = -1;
        if (atn.ruleToStartState[t.target.ruleIndex].isLeftRecursiveRule) {
          if (t.precedence === 0) {
            outermostPrecedenceReturn = t.target.ruleIndex;
          }
        }
        trans = new EpsilonTransition(t.followState, outermostPrecedenceReturn);
        atn.ruleToStopState[t.target.ruleIndex].addTransition(trans);
      }
    }
    for (i = 0;i < atn.states.length; i++) {
      state = atn.states[i];
      if (state instanceof BlockStartState) {
        if (!state.endState) {
          throw new Error("IllegalState");
        }
        if (state.endState.startState) {
          throw new Error("IllegalState");
        }
        state.endState.startState = state;
      }
      if (state instanceof PlusLoopbackState) {
        for (j = 0;j < state.transitions.length; j++) {
          target = state.transitions[j].target;
          if (target instanceof PlusBlockStartState) {
            target.loopBackState = state;
          }
        }
      } else if (state instanceof StarLoopbackState) {
        for (j = 0;j < state.transitions.length; j++) {
          target = state.transitions[j].target;
          if (target instanceof StarLoopEntryState) {
            target.loopBackState = state;
          }
        }
      }
    }
  }
  readDecisions(atn) {
    const decisionCount = this.data[this.pos++];
    for (let i = 0;i < decisionCount; i++) {
      const s = this.data[this.pos++];
      const decState = atn.states[s];
      atn.decisionToState.push(decState);
      decState.decision = i;
    }
  }
  readLexerActions(atn) {
    if (atn.grammarType === ATN.LEXER) {
      const count = this.data[this.pos++];
      atn.lexerActions = [];
      for (let i = 0;i < count; i++) {
        const actionType = this.data[this.pos++];
        const data1 = this.data[this.pos++];
        const data2 = this.data[this.pos++];
        atn.lexerActions.push(this.lexerActionFactory(actionType, data1, data2));
      }
    }
  }
  generateRuleBypassTransitions(atn) {
    let i;
    const count = atn.ruleToStartState.length;
    for (i = 0;i < count; i++) {
      atn.ruleToTokenType[i] = atn.maxTokenType + i + 1;
    }
    for (i = 0;i < count; i++) {
      this.generateRuleBypassTransition(atn, i);
    }
  }
  generateRuleBypassTransition(atn, idx) {
    let i;
    let state;
    const bypassStart = new BasicBlockStartState;
    bypassStart.ruleIndex = idx;
    atn.addState(bypassStart);
    const bypassStop = new BlockEndState;
    bypassStop.ruleIndex = idx;
    atn.addState(bypassStop);
    bypassStart.endState = bypassStop;
    atn.defineDecisionState(bypassStart);
    bypassStop.startState = bypassStart;
    let excludeTransition = null;
    let endState = null;
    if (atn.ruleToStartState[idx].isLeftRecursiveRule) {
      endState = null;
      for (i = 0;i < atn.states.length; i++) {
        state = atn.states[i];
        if (this.stateIsEndStateFor(state, idx)) {
          endState = state;
          excludeTransition = state.loopBackState.transitions[0];
          break;
        }
      }
      if (excludeTransition === null) {
        throw new Error("Couldn't identify final state of the precedence rule prefix section.");
      }
    } else {
      endState = atn.ruleToStopState[idx];
    }
    for (i = 0;i < atn.states.length; i++) {
      state = atn.states[i];
      for (const transition of state.transitions) {
        if (transition === excludeTransition) {
          continue;
        }
        if (transition.target === endState) {
          transition.target = bypassStop;
        }
      }
    }
    const ruleToStartState = atn.ruleToStartState[idx];
    while (ruleToStartState.transitions.length > 0) {
      const transition = ruleToStartState.removeTransition(ruleToStartState.transitions.length - 1);
      bypassStart.addTransition(transition);
    }
    atn.ruleToStartState[idx].addTransition(new EpsilonTransition(bypassStart));
    if (endState) {
      bypassStop.addTransition(new EpsilonTransition(endState));
    }
    const matchState = new BasicState;
    atn.addState(matchState);
    matchState.addTransition(new AtomTransition(bypassStop, atn.ruleToTokenType[idx]));
    bypassStart.addTransition(new EpsilonTransition(matchState));
  }
  stateIsEndStateFor(state, idx) {
    if (state.ruleIndex !== idx) {
      return null;
    }
    if (!(state instanceof StarLoopEntryState)) {
      return null;
    }
    const maybeLoopEndState = state.transitions[state.transitions.length - 1].target;
    if (!(maybeLoopEndState instanceof LoopEndState)) {
      return null;
    }
    if (maybeLoopEndState.epsilonOnlyTransitions && maybeLoopEndState.transitions[0].target instanceof RuleStopState) {
      return state;
    } else {
      return null;
    }
  }
  markPrecedenceDecisions(atn) {
    for (const state of atn.states) {
      if (!(state instanceof StarLoopEntryState)) {
        continue;
      }
      if (atn.ruleToStartState[state.ruleIndex].isLeftRecursiveRule) {
        const maybeLoopEndState = state.transitions[state.transitions.length - 1].target;
        if (maybeLoopEndState instanceof LoopEndState) {
          if (maybeLoopEndState.epsilonOnlyTransitions && maybeLoopEndState.transitions[0].target instanceof RuleStopState) {
            state.precedenceRuleDecision = true;
          }
        }
      }
    }
  }
  verifyATN(atn) {
    if (!this.deserializationOptions.verifyATN) {
      return;
    }
    for (const state of atn.states) {
      if (state === null) {
        continue;
      }
      this.checkCondition(state.epsilonOnlyTransitions || state.transitions.length <= 1);
      if (state instanceof PlusBlockStartState) {
        this.checkCondition(state.loopBackState !== null);
      } else if (state instanceof StarLoopEntryState) {
        this.checkCondition(state.loopBackState !== null);
        this.checkCondition(state.transitions.length === 2);
        if (state.transitions[0].target instanceof StarBlockStartState) {
          this.checkCondition(state.transitions[1].target instanceof LoopEndState);
          this.checkCondition(!state.nonGreedy);
        } else if (state.transitions[0].target instanceof LoopEndState) {
          this.checkCondition(state.transitions[1].target instanceof StarBlockStartState);
          this.checkCondition(state.nonGreedy);
        } else {
          throw new Error("IllegalState");
        }
      } else if (state instanceof StarLoopbackState) {
        this.checkCondition(state.transitions.length === 1);
        this.checkCondition(state.transitions[0].target instanceof StarLoopEntryState);
      } else if (state instanceof LoopEndState) {
        this.checkCondition(state.loopBackState !== null);
      } else if (state instanceof RuleStartState) {
        this.checkCondition(state.stopState !== null);
      } else if (state instanceof BlockStartState) {
        this.checkCondition(state.endState !== null);
      } else if (state instanceof BlockEndState) {
        this.checkCondition(state.startState !== null);
      } else if (state instanceof DecisionState) {
        this.checkCondition(state.transitions.length <= 1 || state.decision >= 0);
      } else {
        this.checkCondition(state.transitions.length <= 1 || state instanceof RuleStopState);
      }
    }
  }
  checkCondition(condition, message) {
    if (!condition) {
      if (message === undefined || message === null) {
        message = "IllegalState";
      }
      throw message;
    }
  }
  edgeFactory(atn, type, trg, arg1, arg2, arg3, sets) {
    const target = atn.states[trg];
    switch (type) {
      case Transition.EPSILON:
        return new EpsilonTransition(target);
      case Transition.RANGE:
        return arg3 !== 0 ? new RangeTransition(target, Token.EOF, arg2) : new RangeTransition(target, arg1, arg2);
      case Transition.RULE:
        return new RuleTransition(atn.states[arg1], arg2, arg3, target);
      case Transition.PREDICATE:
        return new PredicateTransition(target, arg1, arg2, arg3 !== 0);
      case Transition.PRECEDENCE:
        return new PrecedencePredicateTransition(target, arg1);
      case Transition.ATOM:
        return arg3 !== 0 ? new AtomTransition(target, Token.EOF) : new AtomTransition(target, arg1);
      case Transition.ACTION:
        return new ActionTransition(target, arg1, arg2, arg3 !== 0);
      case Transition.SET:
        return new SetTransition(target, sets[arg1]);
      case Transition.NOT_SET:
        return new NotSetTransition(target, sets[arg1]);
      case Transition.WILDCARD:
        return new WildcardTransition(target);
      default:
        throw new Error("The specified transition type: " + type + " is not valid.");
    }
  }
  stateFactory(type, ruleIndex) {
    const ctor = _ATNDeserializer.stateTypeMapper.get(type);
    if (!ctor) {
      throw new Error("The specified state type " + type + " is not valid.");
    }
    const s = new ctor;
    s.ruleIndex = ruleIndex;
    return s;
  }
  lexerActionFactory(type, data1, data2) {
    const factory = _ATNDeserializer.lexerActionFactoryMapper.get(type);
    if (!factory) {
      throw new Error("The specified lexer action type " + type + " is not valid.");
    }
    return factory(data1, data2);
  }
};
var OrderedHashMap = class _OrderedHashMap extends HashMap {
  static {
    __name(this, "OrderedHashMap");
  }
  #keys = [];
  clear() {
    super.clear();
    this.#keys = [];
  }
  get(key) {
    return super.get(key);
  }
  set(key, value) {
    const result = super.set(key, value);
    if (result === undefined) {
      this.#keys.push(key);
    }
    return result;
  }
  setIfAbsent(key, value) {
    const result = super.setIfAbsent(key, value);
    if (result === undefined) {
      this.#keys.push(key);
    }
    return result;
  }
  values() {
    return {
      [Symbol.iterator]: () => {
        let index = 0;
        return {
          next: /* @__PURE__ */ __name(() => {
            if (index < this.#keys.length) {
              return {
                done: false,
                value: super.get(this.#keys[index++])
              };
            }
            return {
              done: true,
              value: undefined
            };
          }, "next")
        };
      }
    };
  }
  keys() {
    return this.#keys[Symbol.iterator]();
  }
  equals(o) {
    if (!(o instanceof _OrderedHashMap)) {
      return false;
    }
    return super.equals(o);
  }
};
var ATNSerializer = class _ATNSerializer {
  static {
    __name(this, "ATNSerializer");
  }
  atn;
  data = [];
  sets = new OrderedHashMap(ObjectEqualityComparator.instance);
  nonGreedyStates = [];
  precedenceStates = [];
  constructor(atn) {
    this.atn = atn;
  }
  static getSerialized(atn) {
    return new _ATNSerializer(atn).serialize();
  }
  static serializeSets(data, sets) {
    data.push(sets.length);
    for (const set of sets) {
      const containsEof = set.contains(Token.EOF);
      const intervals = [...set];
      if (containsEof && intervals[0].stop === Token.EOF) {
        data.push(intervals.length - 1);
      } else {
        data.push(intervals.length);
      }
      data.push(containsEof ? 1 : 0);
      for (const interval of intervals) {
        if (interval.start === Token.EOF) {
          if (interval.stop === Token.EOF) {
            continue;
          } else {
            data.push(0);
          }
        } else {
          data.push(interval.start);
        }
        data.push(interval.stop);
      }
    }
  }
  serialize() {
    this.addPreamble();
    const edgeCount = this.addEdges();
    this.addNonGreedyStates();
    this.addPrecedenceStates();
    this.addRuleStatesAndLexerTokenTypes();
    this.addModeStartStates();
    const setIndices = this.addSets();
    this.addEdges(edgeCount, setIndices);
    this.addDecisionStartStates();
    this.addLexerActions();
    return this.data;
  }
  addPreamble() {
    this.data.push(ATNDeserializer.SERIALIZED_VERSION);
    this.data.push(this.atn.grammarType);
    this.data.push(this.atn.maxTokenType);
  }
  addLexerActions() {
    if (this.atn.grammarType === ATN.LEXER) {
      this.data.push(this.atn.lexerActions.length);
      for (const action of this.atn.lexerActions) {
        this.data.push(action.actionType);
        switch (action.actionType) {
          case LexerActionType.CHANNEL: {
            const channel = action.channel;
            this.data.push(channel);
            this.data.push(0);
            break;
          }
          case LexerActionType.CUSTOM: {
            const ruleIndex = action.ruleIndex;
            const actionIndex = action.actionIndex;
            this.data.push(ruleIndex);
            this.data.push(actionIndex);
            break;
          }
          case LexerActionType.MODE: {
            const mode = action.mode;
            this.data.push(mode);
            this.data.push(0);
            break;
          }
          case LexerActionType.MORE: {
            this.data.push(0);
            this.data.push(0);
            break;
          }
          case LexerActionType.POP_MODE: {
            this.data.push(0);
            this.data.push(0);
            break;
          }
          case LexerActionType.PUSH_MODE: {
            const mode = action.mode;
            this.data.push(mode);
            this.data.push(0);
            break;
          }
          case LexerActionType.SKIP: {
            this.data.push(0);
            this.data.push(0);
            break;
          }
          case LexerActionType.TYPE: {
            const type = action.type;
            this.data.push(type);
            this.data.push(0);
            break;
          }
          default: {
            throw new Error(`The specified lexer action type ${action.actionType} is not valid.`);
          }
        }
      }
    }
  }
  addDecisionStartStates() {
    this.data.push(this.atn.decisionToState.length);
    for (const decStartState of this.atn.decisionToState) {
      this.data.push(decStartState.stateNumber);
    }
  }
  addEdges(...args) {
    switch (args.length) {
      case 0: {
        let edgeCount = 0;
        this.data.push(this.atn.states.length);
        for (const s of this.atn.states) {
          if (s === null) {
            this.data.push(ATNState.INVALID_TYPE);
            continue;
          }
          const stateType = s.constructor.stateType;
          if (s instanceof DecisionState && s.nonGreedy) {
            this.nonGreedyStates.push(s.stateNumber);
          }
          if (s instanceof RuleStartState && s.isLeftRecursiveRule) {
            this.precedenceStates.push(s.stateNumber);
          }
          this.data.push(stateType);
          this.data.push(s.ruleIndex);
          if (s.constructor.stateType === ATNState.LOOP_END) {
            this.data.push(s.loopBackState.stateNumber);
          } else {
            if (s instanceof BlockStartState) {
              this.data.push(s.endState.stateNumber);
            }
          }
          if (s.constructor.stateType !== ATNState.RULE_STOP) {
            edgeCount += s.transitions.length;
          }
          for (const t of s.transitions) {
            const edgeType = t.transitionType;
            if (edgeType === Transition.SET || edgeType === Transition.NOT_SET) {
              const st = t;
              this.sets.set(st.set, true);
            }
          }
        }
        return edgeCount;
      }
      case 2: {
        const [edgeCount, setIndices] = args;
        this.data.push(edgeCount);
        for (const s of this.atn.states) {
          if (s === null) {
            continue;
          }
          if (s.constructor.stateType === ATNState.RULE_STOP) {
            continue;
          }
          for (const t of s.transitions) {
            if (this.atn.states[t.target.stateNumber] === null) {
              throw new Error("Cannot serialize a transition to a removed state.");
            }
            const src = s.stateNumber;
            let trg = t.target.stateNumber;
            const edgeType = t.transitionType;
            let arg1 = 0;
            let arg2 = 0;
            let arg3 = 0;
            switch (edgeType) {
              case Transition.RULE: {
                trg = t.followState.stateNumber;
                arg1 = t.target.stateNumber;
                arg2 = t.ruleIndex;
                arg3 = t.precedence;
                break;
              }
              case Transition.PRECEDENCE: {
                const ppt = t;
                arg1 = ppt.precedence;
                break;
              }
              case Transition.PREDICATE: {
                const pt = t;
                arg1 = pt.ruleIndex;
                arg2 = pt.predIndex;
                arg3 = pt.isCtxDependent ? 1 : 0;
                break;
              }
              case Transition.RANGE: {
                arg1 = t.start;
                arg2 = t.stop;
                if (arg1 === Token.EOF) {
                  arg1 = 0;
                  arg3 = 1;
                }
                break;
              }
              case Transition.ATOM: {
                arg1 = t.labelValue;
                if (arg1 === Token.EOF) {
                  arg1 = 0;
                  arg3 = 1;
                }
                break;
              }
              case Transition.ACTION: {
                const at = t;
                arg1 = at.ruleIndex;
                arg2 = at.actionIndex;
                arg3 = at.isCtxDependent ? 1 : 0;
                break;
              }
              case Transition.SET: {
                arg1 = setIndices.get(t.set);
                break;
              }
              case Transition.NOT_SET: {
                arg1 = setIndices.get(t.set);
                break;
              }
              case Transition.WILDCARD: {
                break;
              }
              default:
            }
            this.data.push(src);
            this.data.push(trg);
            this.data.push(edgeType);
            this.data.push(arg1);
            this.data.push(arg2);
            this.data.push(arg3);
          }
        }
        break;
      }
      default: {
        throw new Error("Invalid number of arguments");
      }
    }
  }
  addSets() {
    _ATNSerializer.serializeSets(this.data, [...this.sets.keys()]);
    const setIndices = new HashMap;
    let setIndex = 0;
    for (const s of this.sets.keys()) {
      setIndices.set(s, setIndex++);
    }
    return setIndices;
  }
  addModeStartStates() {
    const modeCount = this.atn.modeToStartState.length;
    this.data.push(modeCount);
    if (modeCount > 0) {
      for (const modeStartState of this.atn.modeToStartState) {
        this.data.push(modeStartState.stateNumber);
      }
    }
  }
  addRuleStatesAndLexerTokenTypes() {
    const ruleCount = this.atn.ruleToStartState.length;
    this.data.push(ruleCount);
    for (let r = 0;r < ruleCount; r++) {
      const ruleStartState = this.atn.ruleToStartState[r];
      this.data.push(ruleStartState.stateNumber);
      if (this.atn.grammarType === ATN.LEXER) {
        this.data.push(this.atn.ruleToTokenType[r]);
      }
    }
  }
  addPrecedenceStates() {
    this.data.push(this.precedenceStates.length);
    for (const state of this.precedenceStates) {
      this.data.push(state);
    }
  }
  addNonGreedyStates() {
    this.data.push(this.nonGreedyStates.length);
    for (const state of this.nonGreedyStates) {
      this.data.push(state);
    }
  }
};
var DFAState = class _DFAState {
  static {
    __name(this, "DFAState");
  }
  stateNumber = -1;
  configs;
  edges = [];
  isAcceptState = false;
  prediction = -1;
  lexerActionExecutor = null;
  requiresFullContext = false;
  predicates = null;
  constructor(configs) {
    if (configs) {
      this.configs = configs;
    }
  }
  static fromState(stateNumber) {
    const result = new _DFAState;
    result.stateNumber = stateNumber;
    return result;
  }
  static fromConfigs(configs) {
    return new _DFAState(configs);
  }
  static hashCode(state) {
    return state.configs.hashCode();
  }
  static equals(a, b) {
    return a.configs.equals(b.configs);
  }
  getAltSet() {
    const alts = /* @__PURE__ */ new Set;
    for (const config of this.configs) {
      alts.add(config.alt);
    }
    if (alts.size === 0) {
      return null;
    }
    return alts;
  }
  toString() {
    let buf = "";
    buf += this.stateNumber;
    buf += ":";
    buf += this.configs ? this.configs.toString() : "";
    if (this.isAcceptState) {
      buf += "=>";
      if (this.predicates) {
        buf += arrayToString(this.predicates);
      } else {
        buf += this.prediction;
      }
    }
    return buf.toString();
  }
};
var ATNSimulator = class {
  static {
    __name(this, "ATNSimulator");
  }
  static ERROR = DFAState.fromState(2147483647);
  atn;
  sharedContextCache;
  constructor(atn, sharedContextCache) {
    this.atn = atn;
    this.sharedContextCache = sharedContextCache;
    return this;
  }
  getCachedContext(context) {
    if (!this.sharedContextCache) {
      return context;
    }
    const visited = new HashMap(ObjectEqualityComparator.instance);
    return getCachedPredictionContext(context, this.sharedContextCache, visited);
  }
};
var CodePointTransitions = class _CodePointTransitions {
  static {
    __name(this, "CodePointTransitions");
  }
  static createWithCodePoint(target, codePoint) {
    return _CodePointTransitions.createWithCodePointRange(target, codePoint, codePoint);
  }
  static createWithCodePointRange(target, codePointFrom, codePointTo) {
    return codePointFrom === codePointTo ? new AtomTransition(target, codePointFrom) : new RangeTransition(target, codePointFrom, codePointTo);
  }
};
var DecisionInfo = class {
  static {
    __name(this, "DecisionInfo");
  }
  decision = 0;
  invocations = 0;
  timeInPrediction = 0;
  sllTotalLook = 0;
  sllMinLook = 0;
  sllMaxLook = 0;
  sllMaxLookEvent;
  llTotalLook = 0;
  llMinLook = 0;
  llMaxLook = 0;
  llMaxLookEvent;
  contextSensitivities;
  errors;
  ambiguities;
  predicateEvals;
  sllATNTransitions = 0;
  sllDFATransitions = 0;
  llFallback = 0;
  llATNTransitions = 0;
  llDFATransitions = 0;
  constructor(decision) {
    this.decision = decision;
    this.contextSensitivities = [];
    this.errors = [];
    this.ambiguities = [];
    this.predicateEvals = [];
  }
  toString() {
    return "{decision=" + this.decision + ", contextSensitivities=" + this.contextSensitivities.length + ", errors=" + this.errors.length + ", ambiguities=" + this.ambiguities.length + ", sllLookahead=" + this.sllTotalLook + ", sllATNTransitions=" + this.sllATNTransitions + ", sllDFATransitions=" + this.sllDFATransitions + ", llFallback=" + this.llFallback + ", llLookahead=" + this.llTotalLook + ", llATNTransitions=" + this.llATNTransitions + "}";
  }
};
var LexerATNConfig = class _LexerATNConfig extends ATNConfig {
  static {
    __name(this, "LexerATNConfig");
  }
  lexerActionExecutor;
  passedThroughNonGreedyDecision;
  constructor(config, state, context, lexerActionExecutor) {
    super(config, state, context ?? config.context, context ? SemanticContext.NONE : config.semanticContext);
    this.lexerActionExecutor = context ? lexerActionExecutor : config.lexerActionExecutor ?? null;
    this.passedThroughNonGreedyDecision = _LexerATNConfig.checkNonGreedyDecision(config, this.state);
    return this;
  }
  static createWithExecutor(config, state, lexerActionExecutor) {
    return new _LexerATNConfig(config, state, config.context, lexerActionExecutor);
  }
  static createWithConfig(state, config, context) {
    return new _LexerATNConfig(config, state, context ?? null, config.lexerActionExecutor);
  }
  static createWithContext(state, alt, context) {
    return new _LexerATNConfig({ alt }, state, context, null);
  }
  static checkNonGreedyDecision(source, target) {
    return source.passedThroughNonGreedyDecision || "nonGreedy" in target && target.nonGreedy;
  }
  hashCode() {
    if (this.cachedHashCode === undefined) {
      let hashCode = MurmurHash.initialize(7);
      hashCode = MurmurHash.update(hashCode, this.state.stateNumber);
      hashCode = MurmurHash.update(hashCode, this.alt);
      hashCode = MurmurHash.updateFromComparable(hashCode, this.context);
      hashCode = MurmurHash.updateFromComparable(hashCode, this.semanticContext);
      hashCode = MurmurHash.update(hashCode, this.passedThroughNonGreedyDecision ? 1 : 0);
      hashCode = MurmurHash.updateFromComparable(hashCode, this.lexerActionExecutor);
      hashCode = MurmurHash.finish(hashCode, 6);
      this.cachedHashCode = hashCode;
    }
    return this.cachedHashCode;
  }
  equals(other) {
    if (this === other) {
      return true;
    }
    return this.passedThroughNonGreedyDecision === other.passedThroughNonGreedyDecision && (this.lexerActionExecutor && other.lexerActionExecutor ? this.lexerActionExecutor.equals(other.lexerActionExecutor) : !other.lexerActionExecutor) && super.equals(other);
  }
};
var BaseErrorListener = class {
  static {
    __name(this, "BaseErrorListener");
  }
  syntaxError(recognizer, offendingSymbol, line, column, msg, e) {}
  reportAmbiguity(recognizer, dfa, startIndex, stopIndex, exact, ambigAlts, configs) {}
  reportAttemptingFullContext(recognizer, dfa, startIndex, stopIndex, conflictingAlts, configs) {}
  reportContextSensitivity(recognizer, dfa, startIndex, stopIndex, prediction, configs) {}
};
var ConsoleErrorListener = class _ConsoleErrorListener extends BaseErrorListener {
  static {
    __name(this, "ConsoleErrorListener");
  }
  static instance = new _ConsoleErrorListener;
  syntaxError(recognizer, offendingSymbol, line, charPositionInLine, msg, _e) {
    console.error("line " + line + ":" + charPositionInLine + " " + msg);
  }
};
var ProxyErrorListener = class extends BaseErrorListener {
  constructor(delegates) {
    super();
    this.delegates = delegates;
    return this;
  }
  static {
    __name(this, "ProxyErrorListener");
  }
  syntaxError(recognizer, offendingSymbol, line, column, msg, e) {
    this.delegates.forEach((d) => {
      d.syntaxError(recognizer, offendingSymbol, line, column, msg, e);
    });
  }
  reportAmbiguity(recognizer, dfa, startIndex, stopIndex, exact, ambigAlts, configs) {
    this.delegates.forEach((d) => {
      d.reportAmbiguity(recognizer, dfa, startIndex, stopIndex, exact, ambigAlts, configs);
    });
  }
  reportAttemptingFullContext(recognizer, dfa, startIndex, stopIndex, conflictingAlts, configs) {
    this.delegates.forEach((d) => {
      d.reportAttemptingFullContext(recognizer, dfa, startIndex, stopIndex, conflictingAlts, configs);
    });
  }
  reportContextSensitivity(recognizer, dfa, startIndex, stopIndex, prediction, configs) {
    this.delegates.forEach((d) => {
      d.reportContextSensitivity(recognizer, dfa, startIndex, stopIndex, prediction, configs);
    });
  }
};
var Recognizer = class _Recognizer {
  static {
    __name(this, "Recognizer");
  }
  static EOF = -1;
  static tokenTypeMapCache = /* @__PURE__ */ new Map;
  static ruleIndexMapCache = /* @__PURE__ */ new Map;
  interpreter;
  listeners = [ConsoleErrorListener.instance];
  stateNumber = -1;
  checkVersion(toolVersion) {
    const runtimeVersion = "4.13.1";
    if (runtimeVersion !== toolVersion) {
      console.error("ANTLR runtime and generated code versions disagree: " + runtimeVersion + "!=" + toolVersion);
    }
  }
  addErrorListener(listener) {
    this.listeners.push(listener);
  }
  removeErrorListeners() {
    this.listeners = [];
  }
  removeErrorListener(listener) {
    for (let i = 0;i < this.listeners.length; i++) {
      if (this.listeners[i] === listener) {
        this.listeners.splice(i, 1);
        return;
      }
    }
  }
  getErrorListeners() {
    return this.listeners;
  }
  getTokenTypeMap() {
    const vocabulary = this.vocabulary;
    let result = _Recognizer.tokenTypeMapCache.get(vocabulary);
    if (!result) {
      result = /* @__PURE__ */ new Map;
      for (let i = 0;i <= this.atn.maxTokenType; i++) {
        const literalName = vocabulary.getLiteralName(i);
        if (literalName) {
          result.set(literalName, i);
        }
        const symbolicName = vocabulary.getSymbolicName(i);
        if (symbolicName) {
          result.set(symbolicName, i);
        }
      }
      result.set("EOF", Token.EOF);
      _Recognizer.tokenTypeMapCache.set(vocabulary, result);
    }
    return result;
  }
  getRuleIndexMap() {
    const ruleNames = this.ruleNames;
    let result = _Recognizer.ruleIndexMapCache.get(ruleNames);
    if (!result) {
      result = /* @__PURE__ */ new Map;
      ruleNames.forEach((ruleName, idx) => {
        return result.set(ruleName, idx);
      });
      _Recognizer.ruleIndexMapCache.set(ruleNames, result);
    }
    return result;
  }
  getTokenType(tokenName) {
    const ttype = this.getTokenTypeMap().get(tokenName);
    if (ttype) {
      return ttype;
    }
    return Token.INVALID_TYPE;
  }
  getErrorHeader(e) {
    const line = e.offendingToken?.line;
    const column = e.offendingToken?.column;
    return "line " + line + ":" + column;
  }
  get errorListenerDispatch() {
    return new ProxyErrorListener(this.listeners);
  }
  sempred(_localctx, _ruleIndex, _actionIndex) {
    return true;
  }
  precpred(_localctx, _precedence) {
    return true;
  }
  action(_localctx, _ruleIndex, _actionIndex) {}
  get atn() {
    return this.interpreter.atn;
  }
  get state() {
    return this.stateNumber;
  }
  set state(state) {
    this.stateNumber = state;
  }
  getParseInfo() {
    return;
  }
};
var CommonTokenFactory = class _CommonTokenFactory {
  static {
    __name(this, "CommonTokenFactory");
  }
  static DEFAULT = new _CommonTokenFactory;
  copyText = false;
  constructor(copyText) {
    this.copyText = copyText ?? false;
  }
  create(source, type, text, channel, start, stop, line, column) {
    const t = CommonToken.fromSource(source, type, channel, start, stop);
    t.line = line;
    t.column = column;
    if (text) {
      t.text = text;
    } else if (this.copyText && source[1] !== null) {
      t.text = source[1].getTextFromRange(start, stop);
    }
    return t;
  }
};
var RecognitionException = class _RecognitionException extends Error {
  static {
    __name(this, "RecognitionException");
  }
  ctx;
  offendingToken = null;
  offendingState = -1;
  recognizer;
  input;
  constructor(params) {
    super(params.message);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, _RecognitionException);
    }
    this.message = params.message;
    this.recognizer = params.recognizer;
    this.input = params.input;
    this.ctx = params.ctx;
    if (this.recognizer !== null) {
      this.offendingState = this.recognizer.state;
    }
  }
  getExpectedTokens() {
    if (this.recognizer !== null && this.ctx !== null) {
      return this.recognizer.atn.getExpectedTokens(this.offendingState, this.ctx);
    } else {
      return null;
    }
  }
  toString() {
    return this.message;
  }
};
var LexerNoViableAltException = class extends RecognitionException {
  static {
    __name(this, "LexerNoViableAltException");
  }
  startIndex;
  deadEndConfigs;
  constructor(lexer, input, startIndex, deadEndConfigs) {
    super({ message: "", recognizer: lexer, input, ctx: null });
    this.startIndex = startIndex;
    this.deadEndConfigs = deadEndConfigs;
  }
  toString() {
    let symbol = "";
    if (this.input && this.startIndex >= 0 && this.startIndex < this.input.size) {
      symbol = this.input.getTextFromRange(this.startIndex, this.startIndex);
    }
    return `LexerNoViableAltException(${symbol})`;
  }
};
var Lexer = class _Lexer extends Recognizer {
  static {
    __name(this, "Lexer");
  }
  static DEFAULT_MODE = 0;
  static MORE = -2;
  static SKIP = -3;
  static DEFAULT_TOKEN_CHANNEL = Token.DEFAULT_CHANNEL;
  static HIDDEN = Token.HIDDEN_CHANNEL;
  options = {
    minDFAEdge: 0,
    maxDFAEdge: 256,
    minCodePoint: 0,
    maxCodePoint: 1114111
  };
  tokenStartCharIndex = -1;
  channel = 0;
  type = 0;
  mode = _Lexer.DEFAULT_MODE;
  currentTokenColumn = 0;
  currentTokenStartLine = 0;
  input;
  token = null;
  hitEOF = false;
  factory;
  #modeStack = [];
  #text;
  constructor(input, options) {
    super();
    this.options = { ...this.options, ...options };
    this.input = input;
    this.factory = CommonTokenFactory.DEFAULT;
  }
  reset(seekBack = true) {
    if (seekBack) {
      this.input.seek(0);
    }
    this.token = null;
    this.type = Token.INVALID_TYPE;
    this.channel = Token.DEFAULT_CHANNEL;
    this.tokenStartCharIndex = -1;
    this.currentTokenColumn = -1;
    this.currentTokenStartLine = -1;
    this.#text = undefined;
    this.hitEOF = false;
    this.mode = _Lexer.DEFAULT_MODE;
    this.#modeStack = [];
    this.interpreter.reset();
  }
  nextToken() {
    if (this.input === null) {
      throw new Error("nextToken requires a non-null input stream.");
    }
    const tokenStartMarker = this.input.mark();
    try {
      while (true) {
        if (this.hitEOF) {
          this.emitEOF();
          return this.token;
        }
        this.token = null;
        this.channel = Token.DEFAULT_CHANNEL;
        this.tokenStartCharIndex = this.input.index;
        this.currentTokenColumn = this.interpreter.column;
        this.currentTokenStartLine = this.interpreter.line;
        this.#text = undefined;
        let continueOuter = false;
        while (true) {
          this.type = Token.INVALID_TYPE;
          let ttype = _Lexer.SKIP;
          try {
            ttype = this.interpreter.match(this.input, this.mode);
          } catch (e) {
            if (e instanceof LexerNoViableAltException) {
              this.notifyListeners(e);
              this.recover(e);
            } else {
              throw e;
            }
          }
          if (this.input.LA(1) === Token.EOF) {
            this.hitEOF = true;
          }
          if (this.type === Token.INVALID_TYPE) {
            this.type = ttype;
          }
          if (this.type === _Lexer.SKIP) {
            continueOuter = true;
            break;
          }
          if (this.type !== _Lexer.MORE) {
            break;
          }
        }
        if (continueOuter) {
          continue;
        }
        if (this.token === null) {
          this.emit();
        }
        return this.token;
      }
    } finally {
      this.input.release(tokenStartMarker);
    }
  }
  skip() {
    this.type = _Lexer.SKIP;
  }
  more() {
    this.type = _Lexer.MORE;
  }
  pushMode(m2) {
    if (LexerATNSimulator.debug) {
      console.log("pushMode " + m2);
    }
    this.#modeStack.push(this.mode);
    this.mode = m2;
  }
  popMode() {
    if (this.#modeStack.length === 0) {
      throw new Error("Empty Stack");
    }
    if (LexerATNSimulator.debug) {
      console.log("popMode back to " + this.#modeStack.slice(0, -1));
    }
    this.mode = this.#modeStack.pop();
    return this.mode;
  }
  get modeStack() {
    return this.#modeStack;
  }
  emitToken(token) {
    this.token = token;
  }
  emit() {
    const t = this.factory.create([this, this.input], this.type, this.#text, this.channel, this.tokenStartCharIndex, this.getCharIndex() - 1, this.currentTokenStartLine, this.currentTokenColumn);
    this.emitToken(t);
    return t;
  }
  emitEOF() {
    const eof = this.factory.create([this, this.input], Token.EOF, undefined, Token.DEFAULT_CHANNEL, this.input.index, this.input.index - 1, this.line, this.column);
    this.emitToken(eof);
    return eof;
  }
  getCharIndex() {
    return this.input.index;
  }
  getAllTokens() {
    const tokens = [];
    let t = this.nextToken();
    while (t.type !== Token.EOF) {
      tokens.push(t);
      t = this.nextToken();
    }
    return tokens;
  }
  notifyListeners(e) {
    const start = this.tokenStartCharIndex;
    const stop = this.input.index;
    const text = this.input.getTextFromRange(start, stop);
    const msg = "token recognition error at: '" + this.getErrorDisplay(text) + "'";
    this.errorListenerDispatch.syntaxError(this, null, this.currentTokenStartLine, this.currentTokenColumn, msg, e);
  }
  getErrorDisplay(s) {
    return s;
  }
  getErrorDisplayForChar(c) {
    if (c.charCodeAt(0) === Token.EOF) {
      return "<EOF>";
    }
    if (c === `
`) {
      return "\\n";
    }
    if (c === "\t") {
      return "\\t";
    }
    if (c === "\r") {
      return "\\r";
    }
    return c;
  }
  getCharErrorDisplay(c) {
    return "'" + this.getErrorDisplayForChar(c) + "'";
  }
  recover(re) {
    if (this.input.LA(1) !== Token.EOF) {
      if (re instanceof LexerNoViableAltException) {
        this.interpreter.consume(this.input);
      } else {
        this.input.consume();
      }
    }
  }
  get inputStream() {
    return this.input;
  }
  set inputStream(input) {
    this.reset(false);
    this.input = input;
  }
  set tokenFactory(factory) {
    this.factory = factory;
  }
  get tokenFactory() {
    return this.factory;
  }
  get sourceName() {
    return this.input.getSourceName();
  }
  get line() {
    return this.interpreter.line;
  }
  set line(line) {
    this.interpreter.line = line;
  }
  get column() {
    return this.interpreter.column;
  }
  set column(column) {
    this.interpreter.column = column;
  }
  get text() {
    if (this.#text) {
      return this.#text;
    } else {
      return this.interpreter.getText(this.input);
    }
  }
  set text(text) {
    this.#text = text;
  }
};
var DFASerializer = class {
  static {
    __name(this, "DFASerializer");
  }
  dfa;
  vocabulary;
  constructor(dfa, vocabulary) {
    this.dfa = dfa;
    this.vocabulary = vocabulary;
  }
  toString() {
    if (!this.dfa.s0) {
      return "";
    }
    let buf = "";
    const states = this.dfa.getStates();
    for (const s of states) {
      let n2 = 0;
      n2 = s.edges.length;
      for (let i = 0;i < n2; i++) {
        const t = s.edges[i];
        if (t && t.stateNumber !== 2147483647) {
          buf += this.getStateString(s);
          const label = this.getEdgeLabel(i);
          buf += "-";
          buf += label;
          buf += "->";
          buf += this.getStateString(t);
          buf += `
`;
        }
      }
    }
    return buf;
  }
  getEdgeLabel(i) {
    const name = this.vocabulary.getDisplayName(i - 1);
    return `${name}`;
  }
  getStateString(s) {
    const n2 = s.stateNumber;
    const baseStateStr = (s.isAcceptState ? ":" : "") + "s" + n2 + (s.requiresFullContext ? "^" : "");
    if (s.isAcceptState) {
      if (s.predicates !== null) {
        return `${baseStateStr}=>${s.predicates.toString()}`;
      }
      return `${baseStateStr}=>${s.prediction}`;
    } else {
      return `${baseStateStr}`;
    }
  }
};
var LexerDFASerializer = class extends DFASerializer {
  static {
    __name(this, "LexerDFASerializer");
  }
  constructor(dfa) {
    super(dfa, Vocabulary.EMPTY_VOCABULARY);
  }
  getEdgeLabel = /* @__PURE__ */ __name((i) => {
    return "'" + String.fromCharCode(i) + "'";
  }, "getEdgeLabel");
};
var DFA = class {
  static {
    __name(this, "DFA");
  }
  s0;
  decision;
  atnStartState;
  isPrecedenceDfa;
  states = /* @__PURE__ */ new Map;
  constructor(atnStartState, decision) {
    this.atnStartState = atnStartState;
    this.decision = decision ?? 0;
    let precedenceDfa = false;
    if (atnStartState instanceof StarLoopEntryState) {
      if (atnStartState.precedenceRuleDecision) {
        precedenceDfa = true;
        this.s0 = DFAState.fromState(-1);
      }
    }
    this.isPrecedenceDfa = precedenceDfa;
  }
  [Symbol.iterator] = () => {
    return this.states.values()[Symbol.iterator]();
  };
  getPrecedenceStartState = /* @__PURE__ */ __name((precedence) => {
    if (!this.isPrecedenceDfa) {
      throw new Error(`Only precedence DFAs may contain a precedence start state.`);
    }
    if (!this.s0 || !this.s0.edges || precedence < 0 || precedence >= this.s0.edges.length) {
      return;
    }
    return this.s0.edges[precedence];
  }, "getPrecedenceStartState");
  setPrecedenceStartState = /* @__PURE__ */ __name((precedence, startState) => {
    if (!this.isPrecedenceDfa) {
      throw new Error(`Only precedence DFAs may contain a precedence start state.`);
    }
    if (precedence < 0 || !this.s0) {
      return;
    }
    this.s0.edges[precedence] = startState;
  }, "setPrecedenceStartState");
  getStates() {
    const result = [...this.states.values()];
    result.sort((o1, o2) => {
      return o1.stateNumber - o2.stateNumber;
    });
    return result;
  }
  getState(state) {
    return this.states.get(state.configs.hashCode()) ?? null;
  }
  getStateForConfigs(configs) {
    return this.states.get(configs.hashCode()) ?? null;
  }
  addState(state) {
    const hash = state.configs.hashCode();
    if (this.states.has(hash)) {
      return;
    }
    this.states.set(hash, state);
    state.stateNumber = this.states.size - 1;
  }
  toString(vocabulary) {
    if (!vocabulary) {
      return this.toString(Vocabulary.EMPTY_VOCABULARY);
    }
    if (!this.s0) {
      return "";
    }
    const serializer = new DFASerializer(this, vocabulary);
    return serializer.toString() ?? "";
  }
  toLexerString() {
    if (!this.s0) {
      return "";
    }
    const serializer = new LexerDFASerializer(this);
    return serializer.toString() ?? "";
  }
  get length() {
    return this.states.size;
  }
};
var LexerIndexedCustomAction = class _LexerIndexedCustomAction {
  static {
    __name(this, "LexerIndexedCustomAction");
  }
  offset;
  action;
  actionType;
  isPositionDependent = true;
  cachedHashCode;
  constructor(offset, action) {
    this.actionType = action.actionType;
    this.offset = offset;
    this.action = action;
  }
  execute(lexer) {
    this.action.execute(lexer);
  }
  hashCode() {
    if (this.cachedHashCode === undefined) {
      let hash = MurmurHash.initialize();
      hash = MurmurHash.update(hash, this.offset);
      hash = MurmurHash.updateFromComparable(hash, this.action);
      this.cachedHashCode = MurmurHash.finish(hash, 2);
    }
    return this.cachedHashCode;
  }
  equals(other) {
    if (this === other) {
      return true;
    }
    if (!(other instanceof _LexerIndexedCustomAction)) {
      return false;
    }
    return this.offset === other.offset && this.action === other.action;
  }
};
var LexerActionExecutor = class _LexerActionExecutor {
  static {
    __name(this, "LexerActionExecutor");
  }
  lexerActions;
  actionType;
  isPositionDependent = false;
  cachedHashCode;
  constructor(lexerActions) {
    this.actionType = -1;
    this.lexerActions = lexerActions ?? [];
    return this;
  }
  static append(lexerActionExecutor, lexerAction) {
    if (lexerActionExecutor === null) {
      return new _LexerActionExecutor([lexerAction]);
    }
    const lexerActions = lexerActionExecutor.lexerActions.concat([lexerAction]);
    return new _LexerActionExecutor(lexerActions);
  }
  fixOffsetBeforeMatch(offset) {
    let updatedLexerActions = null;
    for (let i = 0;i < this.lexerActions.length; i++) {
      if (this.lexerActions[i].isPositionDependent && !(this.lexerActions[i] instanceof LexerIndexedCustomAction)) {
        if (updatedLexerActions === null) {
          updatedLexerActions = this.lexerActions.concat([]);
        }
        updatedLexerActions[i] = new LexerIndexedCustomAction(offset, this.lexerActions[i]);
      }
    }
    if (updatedLexerActions === null) {
      return this;
    } else {
      return new _LexerActionExecutor(updatedLexerActions);
    }
  }
  execute(lexer, input, startIndex) {
    if (input === undefined || startIndex === undefined) {
      return;
    }
    let requiresSeek = false;
    const stopIndex = input.index;
    try {
      for (const lexerAction of this.lexerActions) {
        let action = lexerAction;
        if (lexerAction instanceof LexerIndexedCustomAction) {
          const offset = lexerAction.offset;
          input.seek(startIndex + offset);
          action = lexerAction.action;
          requiresSeek = startIndex + offset !== stopIndex;
        } else if (lexerAction.isPositionDependent) {
          input.seek(stopIndex);
          requiresSeek = false;
        }
        action.execute(lexer);
      }
    } finally {
      if (requiresSeek) {
        input.seek(stopIndex);
      }
    }
  }
  hashCode() {
    if (this.cachedHashCode === undefined) {
      let hashCode = MurmurHash.initialize(7);
      for (const lexerAction of this.lexerActions) {
        hashCode = MurmurHash.update(hashCode, lexerAction.hashCode());
      }
      this.cachedHashCode = MurmurHash.finish(hashCode, this.lexerActions.length);
    }
    return this.cachedHashCode;
  }
  equals(other) {
    if (this === other) {
      return true;
    }
    if (this.cachedHashCode !== other.cachedHashCode) {
      return false;
    }
    if (this.lexerActions.length !== other.lexerActions.length) {
      return false;
    }
    return this.lexerActions.every((action, index) => {
      return action.equals(other.lexerActions[index]);
    });
  }
};
var OrderedHashSet = class _OrderedHashSet extends HashSet {
  static {
    __name(this, "OrderedHashSet");
  }
  elements = [];
  getOrAdd(o) {
    const oldSize = this.size;
    const result = super.getOrAdd(o);
    if (this.size > oldSize) {
      this.elements.push(o);
    }
    return result;
  }
  equals(o) {
    if (!(o instanceof _OrderedHashSet)) {
      return false;
    }
    return super.equals(o);
  }
  clear() {
    super.clear();
    this.elements = [];
  }
  *[Symbol.iterator]() {
    yield* this.elements;
  }
  toArray() {
    return this.elements.slice(0);
  }
};
var OrderedATNConfigSet = class extends ATNConfigSet {
  static {
    __name(this, "OrderedATNConfigSet");
  }
  constructor() {
    super();
    this.configLookup = new OrderedHashSet;
  }
};
var LexerATNSimulator = class _LexerATNSimulator extends ATNSimulator {
  static {
    __name(this, "LexerATNSimulator");
  }
  static debug = false;
  decisionToDFA;
  recognizer = null;
  startIndex = -1;
  line = 1;
  column = 0;
  mode = Lexer.DEFAULT_MODE;
  prevAccept;
  options;
  lexerATNConfigFactory;
  constructor(recog, atn, decisionToDFA, sharedContextCache) {
    super(atn, sharedContextCache);
    this.decisionToDFA = decisionToDFA;
    this.recognizer = recog;
    if (recog) {
      this.options = recog.options;
    } else {
      this.options = {
        minDFAEdge: 0,
        maxDFAEdge: 256,
        minCodePoint: 0,
        maxCodePoint: 1114111
      };
    }
  }
  match(input, mode) {
    this.mode = mode;
    const mark = input.mark();
    try {
      this.startIndex = input.index;
      this.prevAccept = undefined;
      const dfa = this.decisionToDFA[mode];
      if (!dfa.s0) {
        return this.matchATN(input);
      }
      return this.execATN(input, dfa.s0);
    } finally {
      input.release(mark);
    }
  }
  reset() {
    this.prevAccept = undefined;
    this.startIndex = -1;
    this.line = 1;
    this.column = 0;
    this.mode = Lexer.DEFAULT_MODE;
  }
  clearDFA() {
    for (let d = 0;d < this.decisionToDFA.length; d++) {
      this.decisionToDFA[d] = new DFA(this.atn.getDecisionState(d), d);
    }
  }
  getDFA(mode) {
    return this.decisionToDFA[mode];
  }
  getText(input) {
    return input.getTextFromRange(this.startIndex, input.index - 1);
  }
  consume(input) {
    const curChar = input.LA(1);
    if (curChar === 10) {
      this.line += 1;
      this.column = 0;
    } else {
      this.column += 1;
    }
    input.consume();
  }
  getTokenName(tt) {
    if (tt === Token.EOF) {
      return "EOF";
    } else {
      return "'" + String.fromCharCode(tt) + "'";
    }
  }
  matchATN(input) {
    const startState = this.atn.modeToStartState[this.mode];
    if (_LexerATNSimulator.debug) {
      console.log("matchATN mode " + this.mode + " start: " + startState);
    }
    const oldMode = this.mode;
    const s0Closure = this.computeStartState(input, startState);
    const suppressEdge = s0Closure.hasSemanticContext;
    s0Closure.hasSemanticContext = false;
    const next = this.addDFAState(s0Closure);
    if (!suppressEdge) {
      this.decisionToDFA[this.mode].s0 = next;
    }
    const predict = this.execATN(input, next);
    if (_LexerATNSimulator.debug) {
      console.log("DFA after matchATN: " + this.decisionToDFA[oldMode].toLexerString());
    }
    return predict;
  }
  execATN(input, state) {
    if (_LexerATNSimulator.debug) {
      console.log("start state closure=" + state.configs);
    }
    if (state.isAcceptState) {
      this.captureSimState(input, state);
    }
    let t = input.LA(1);
    while (true) {
      if (_LexerATNSimulator.debug) {
        console.log("execATN loop starting closure: " + state.configs);
      }
      let target = this.getExistingTargetState(state, t);
      if (!target) {
        target = this.computeTargetState(input, state, t);
      }
      if (target === ATNSimulator.ERROR) {
        break;
      }
      if (t !== Token.EOF) {
        this.consume(input);
      }
      if (target.isAcceptState) {
        this.captureSimState(input, target);
        if (t === Token.EOF) {
          break;
        }
      }
      t = input.LA(1);
      state = target;
    }
    return this.failOrAccept(input, state.configs, t);
  }
  getExistingTargetState(s, t) {
    if (t >= this.options.minDFAEdge && t <= this.options.maxDFAEdge) {
      const target = s.edges[t - this.options.minDFAEdge];
      if (_LexerATNSimulator.debug && target) {
        console.log("reuse state " + s.stateNumber + " edge to " + target.stateNumber);
      }
      return target;
    }
    return;
  }
  computeTargetState(input, s, t) {
    const reach = new OrderedATNConfigSet;
    this.getReachableConfigSet(input, s.configs, reach, t);
    if (reach.length === 0) {
      if (!reach.hasSemanticContext) {
        this.addDFAEdge(s, t, ATNSimulator.ERROR);
      }
      return ATNSimulator.ERROR;
    }
    return this.addDFAEdge(s, t, null, reach);
  }
  failOrAccept(input, reach, t) {
    if (this.prevAccept?.dfaState) {
      const { dfaState, index, line, column } = this.prevAccept;
      this.accept(input, dfaState.lexerActionExecutor, this.startIndex, index, line, column);
      return dfaState.prediction;
    }
    if (t === Token.EOF && input.index === this.startIndex) {
      return Token.EOF;
    }
    throw new LexerNoViableAltException(this.recognizer, input, this.startIndex, reach);
  }
  getReachableConfigSet(input, closure, reach, t) {
    let skipAlt = ATN.INVALID_ALT_NUMBER;
    for (const cfg of closure) {
      const currentAltReachedAcceptState = cfg.alt === skipAlt;
      if (currentAltReachedAcceptState && cfg.passedThroughNonGreedyDecision) {
        continue;
      }
      if (_LexerATNSimulator.debug) {
        console.log(`testing %s at %s
`, this.getTokenName(t), cfg.toString(this.recognizer, true));
      }
      for (const trans of cfg.state.transitions) {
        const target = this.getReachableTarget(trans, t);
        if (target) {
          let lexerActionExecutor = cfg.lexerActionExecutor;
          if (lexerActionExecutor) {
            lexerActionExecutor = lexerActionExecutor.fixOffsetBeforeMatch(input.index - this.startIndex);
          }
          const treatEofAsEpsilon = t === Token.EOF;
          const config = LexerATNConfig.createWithExecutor(cfg, target, lexerActionExecutor);
          if (this.closure(input, config, reach, currentAltReachedAcceptState, true, treatEofAsEpsilon)) {
            skipAlt = cfg.alt;
          }
        }
      }
    }
  }
  accept(input, lexerActionExecutor, startIndex, index, line, charPos) {
    if (_LexerATNSimulator.debug) {
      console.log(`ACTION %s
`, lexerActionExecutor);
    }
    input.seek(index);
    this.line = line;
    this.column = charPos;
    if (lexerActionExecutor && this.recognizer) {
      lexerActionExecutor.execute(this.recognizer, input, startIndex);
    }
  }
  getReachableTarget(trans, t) {
    if (trans.matches(t, this.options.minCodePoint, this.options.maxCodePoint)) {
      return trans.target;
    } else {
      return;
    }
  }
  computeStartState(input, p) {
    const initialContext = EmptyPredictionContext.instance;
    const configs = new OrderedATNConfigSet;
    for (let i = 0;i < p.transitions.length; i++) {
      const target = p.transitions[i].target;
      const cfg = LexerATNConfig.createWithContext(target, i + 1, initialContext);
      this.closure(input, cfg, configs, false, false, false);
    }
    return configs;
  }
  closure(input, config, configs, currentAltReachedAcceptState, speculative, treatEofAsEpsilon) {
    let cfg = null;
    if (_LexerATNSimulator.debug) {
      console.log("closure(" + config.toString(this.recognizer, true) + ")");
    }
    if (config.state.constructor.stateType === ATNState.RULE_STOP) {
      if (_LexerATNSimulator.debug) {
        if (this.recognizer !== null) {
          console.log(`closure at %s rule stop %s
`, this.recognizer.ruleNames[config.state.ruleIndex], config);
        } else {
          console.log(`closure at rule stop %s
`, config);
        }
      }
      if (!config.context || config.context.hasEmptyPath()) {
        if (!config.context || config.context.isEmpty()) {
          configs.add(config);
          return true;
        } else {
          configs.add(LexerATNConfig.createWithConfig(config.state, config, EmptyPredictionContext.instance));
          currentAltReachedAcceptState = true;
        }
      }
      if (config.context && !config.context.isEmpty()) {
        for (let i = 0;i < config.context.length; i++) {
          if (config.context.getReturnState(i) !== PredictionContext.EMPTY_RETURN_STATE) {
            const newContext = config.context.getParent(i);
            const returnState = this.atn.states[config.context.getReturnState(i)];
            cfg = LexerATNConfig.createWithConfig(returnState, config, newContext);
            currentAltReachedAcceptState = this.closure(input, cfg, configs, currentAltReachedAcceptState, speculative, treatEofAsEpsilon);
          }
        }
      }
      return currentAltReachedAcceptState;
    }
    if (!config.state.epsilonOnlyTransitions) {
      if (!currentAltReachedAcceptState || !config.passedThroughNonGreedyDecision) {
        configs.add(config);
      }
    }
    for (const trans of config.state.transitions) {
      cfg = this.getEpsilonTarget(input, config, trans, configs, speculative, treatEofAsEpsilon);
      if (cfg) {
        currentAltReachedAcceptState = this.closure(input, cfg, configs, currentAltReachedAcceptState, speculative, treatEofAsEpsilon);
      }
    }
    return currentAltReachedAcceptState;
  }
  getEpsilonTarget(input, config, trans, configs, speculative, treatEofAsEpsilon) {
    if (!this.lexerATNConfigFactory) {
      this.setupATNFactoryLookup();
    }
    const factory = this.lexerATNConfigFactory[trans.transitionType];
    if (!factory) {
      return null;
    }
    return factory(input, config, trans, configs, speculative, treatEofAsEpsilon);
  }
  setupATNFactoryLookup() {
    this.lexerATNConfigFactory = [];
    this.lexerATNConfigFactory[Transition.RULE] = (input, config, trans) => {
      const newContext = createSingletonPredictionContext(config.context ?? undefined, trans.followState.stateNumber);
      return LexerATNConfig.createWithConfig(trans.target, config, newContext);
    };
    this.lexerATNConfigFactory[Transition.PRECEDENCE] = () => {
      throw new Error("Precedence predicates are not supported in lexers.");
    };
    this.lexerATNConfigFactory[Transition.PREDICATE] = (input, config, trans, configs, speculative) => {
      const pt = trans;
      if (_LexerATNSimulator.debug) {
        console.log("EVAL rule " + pt.ruleIndex + ":" + pt.predIndex);
      }
      configs.hasSemanticContext = true;
      if (this.evaluatePredicate(input, pt.ruleIndex, pt.predIndex, speculative)) {
        return LexerATNConfig.createWithConfig(trans.target, config);
      }
      return null;
    };
    this.lexerATNConfigFactory[Transition.ACTION] = (input, config, trans) => {
      if (config.context === null || config.context.hasEmptyPath()) {
        const lexerActionExecutor = LexerActionExecutor.append(config.lexerActionExecutor, this.atn.lexerActions[trans.actionIndex]);
        return LexerATNConfig.createWithExecutor(config, trans.target, lexerActionExecutor);
      } else {
        return LexerATNConfig.createWithConfig(trans.target, config);
      }
    };
    this.lexerATNConfigFactory[Transition.EPSILON] = (input, config, trans) => {
      return LexerATNConfig.createWithConfig(trans.target, config);
    };
    const simple = /* @__PURE__ */ __name((input, config, trans, configs, speculative, treatEofAsEpsilon) => {
      if (treatEofAsEpsilon) {
        if (trans.matches(Token.EOF, this.options.minCodePoint, this.options.maxCodePoint)) {
          return LexerATNConfig.createWithConfig(trans.target, config);
        }
      }
      return null;
    }, "simple");
    this.lexerATNConfigFactory[Transition.ATOM] = simple;
    this.lexerATNConfigFactory[Transition.RANGE] = simple;
    this.lexerATNConfigFactory[Transition.SET] = simple;
  }
  evaluatePredicate(input, ruleIndex, predIndex, speculative) {
    if (!this.recognizer) {
      return true;
    }
    if (!speculative) {
      return this.recognizer.sempred(null, ruleIndex, predIndex);
    }
    const savedColumn = this.column;
    const savedLine = this.line;
    const index = input.index;
    const marker = input.mark();
    try {
      this.consume(input);
      return this.recognizer.sempred(null, ruleIndex, predIndex);
    } finally {
      this.column = savedColumn;
      this.line = savedLine;
      input.seek(index);
      input.release(marker);
    }
  }
  captureSimState(input, dfaState) {
    this.prevAccept = {
      index: input.index,
      line: this.line,
      column: this.column,
      dfaState
    };
  }
  addDFAEdge(from, tk, to, configs) {
    if (!to && configs) {
      const suppressEdge = configs.hasSemanticContext;
      configs.hasSemanticContext = false;
      to = this.addDFAState(configs);
      if (suppressEdge) {
        return to;
      }
    }
    if (tk < this.options.minDFAEdge || tk > this.options.maxDFAEdge) {
      return to;
    }
    if (_LexerATNSimulator.debug) {
      console.log("EDGE " + from + " -> " + to + " upon " + tk);
    }
    from.edges[tk - this.options.minDFAEdge] = to;
    return to;
  }
  addDFAState(configs) {
    const dfa = this.decisionToDFA[this.mode];
    const existing = dfa.getStateForConfigs(configs);
    if (existing) {
      return existing;
    }
    const proposed = DFAState.fromConfigs(configs);
    const firstConfigWithRuleStopState = configs.firstStopState;
    if (firstConfigWithRuleStopState) {
      proposed.isAcceptState = true;
      proposed.lexerActionExecutor = firstConfigWithRuleStopState.lexerActionExecutor;
      proposed.prediction = this.atn.ruleToTokenType[firstConfigWithRuleStopState.state.ruleIndex];
    }
    configs.setReadonly(true);
    dfa.addState(proposed);
    return proposed;
  }
};
var ParseInfo = class {
  static {
    __name(this, "ParseInfo");
  }
  atnSimulator;
  constructor(atnSimulator) {
    this.atnSimulator = atnSimulator;
  }
  getDecisionInfo() {
    return this.atnSimulator.getDecisionInfo();
  }
  getLLDecisions() {
    const decisions = this.atnSimulator.getDecisionInfo();
    const result = new Array;
    for (let i = 0;i < decisions.length; i++) {
      const fallBack = decisions[i].llFallback;
      if (fallBack > 0) {
        result.push(i);
      }
    }
    return result;
  }
  getTotalTimeInPrediction() {
    const decisions = this.atnSimulator.getDecisionInfo();
    let t = 0;
    for (const decision of decisions) {
      t += decision.timeInPrediction;
    }
    return t;
  }
  getTotalSLLLookaheadOps() {
    const decisions = this.atnSimulator.getDecisionInfo();
    let k = 0;
    for (const decision of decisions) {
      k += decision.sllTotalLook;
    }
    return k;
  }
  getTotalLLLookaheadOps() {
    const decisions = this.atnSimulator.getDecisionInfo();
    let k = 0;
    for (const decision of decisions) {
      k += decision.llTotalLook;
    }
    return k;
  }
  getTotalSLLATNLookaheadOps() {
    const decisions = this.atnSimulator.getDecisionInfo();
    let k = 0;
    for (const decision of decisions) {
      k += decision.sllATNTransitions;
    }
    return k;
  }
  getTotalLLATNLookaheadOps() {
    const decisions = this.atnSimulator.getDecisionInfo();
    let k = 0;
    for (const decision of decisions) {
      k += decision.llATNTransitions;
    }
    return k;
  }
  getTotalATNLookaheadOps() {
    const decisions = this.atnSimulator.getDecisionInfo();
    let k = 0;
    for (const decision of decisions) {
      k += decision.sllATNTransitions;
      k += decision.llATNTransitions;
    }
    return k;
  }
  getDFASize(decision) {
    if (decision === undefined) {
      let n2 = 0;
      const decisionToDFA = this.atnSimulator.decisionToDFA;
      for (let i = 0;i < decisionToDFA.length; i++) {
        n2 += this.getDFASize(i);
      }
      return n2;
    } else {
      const decisionToDFA = this.atnSimulator.decisionToDFA[decision];
      return decisionToDFA.length;
    }
  }
};
var NoViableAltException = class extends RecognitionException {
  static {
    __name(this, "NoViableAltException");
  }
  deadEndConfigs = null;
  startToken;
  constructor(recognizer, input = null, startToken = null, offendingToken = null, deadEndConfigs = null, ctx = null) {
    ctx = ctx ?? recognizer.context;
    offendingToken = offendingToken ?? recognizer.getCurrentToken();
    startToken = startToken ?? recognizer.getCurrentToken();
    input = input ?? recognizer.inputStream;
    super({ message: "", recognizer, input, ctx });
    this.deadEndConfigs = deadEndConfigs;
    this.startToken = startToken;
    this.offendingToken = offendingToken;
  }
};
var DoubleDict = class {
  static {
    __name(this, "DoubleDict");
  }
  cacheMap;
  constructor() {
    this.cacheMap = new HashMap;
  }
  get(a, b) {
    const d = this.cacheMap.get(a) ?? null;
    return d === null ? null : d.get(b) ?? null;
  }
  set(a, b, o) {
    let d = this.cacheMap.get(a);
    if (!d) {
      d = new HashMap;
      this.cacheMap.set(a, d);
    }
    d.set(b, o);
  }
};
var SubsetEqualityComparer = class _SubsetEqualityComparer {
  static {
    __name(this, "SubsetEqualityComparer");
  }
  static instance = new _SubsetEqualityComparer;
  hashCode(config) {
    let hashCode = MurmurHash.initialize(7);
    hashCode = MurmurHash.update(hashCode, config.state.stateNumber);
    hashCode = MurmurHash.updateFromComparable(hashCode, config.context);
    hashCode = MurmurHash.finish(hashCode, 2);
    return hashCode;
  }
  equals(a, b) {
    return a.state.stateNumber === b.state.stateNumber && (a.context?.equals(b.context) ?? true);
  }
};
var PredictionMode = class _PredictionMode {
  static {
    __name(this, "PredictionMode");
  }
  static SLL = 0;
  static LL = 1;
  static LL_EXACT_AMBIG_DETECTION = 2;
  static hasSLLConflictTerminatingPrediction(mode, configs) {
    if (_PredictionMode.allConfigsInRuleStopStates(configs)) {
      return true;
    }
    if (mode === _PredictionMode.SLL) {
      if (configs.hasSemanticContext) {
        const dup = new ATNConfigSet;
        for (let c of configs) {
          c = ATNConfig.duplicate(c, SemanticContext.NONE);
          dup.add(c);
        }
        configs = dup;
      }
    }
    const altSets = _PredictionMode.getConflictingAltSubsets(configs);
    return _PredictionMode.hasConflictingAltSet(altSets) && !_PredictionMode.hasStateAssociatedWithOneAlt(configs);
  }
  static hasConfigInRuleStopState(configs) {
    for (const c of configs) {
      if (c.state instanceof RuleStopState) {
        return true;
      }
    }
    return false;
  }
  static allConfigsInRuleStopStates(configs) {
    for (const c of configs) {
      if (!(c.state instanceof RuleStopState)) {
        return false;
      }
    }
    return true;
  }
  static resolvesToJustOneViableAlt(altSets) {
    return _PredictionMode.getSingleViableAlt(altSets);
  }
  static allSubsetsConflict(altSets) {
    return !_PredictionMode.hasNonConflictingAltSet(altSets);
  }
  static hasNonConflictingAltSet(altSets) {
    for (const alts of altSets) {
      if (alts.length === 1) {
        return true;
      }
    }
    return false;
  }
  static hasConflictingAltSet(altSets) {
    for (const alts of altSets) {
      if (alts.length > 1) {
        return true;
      }
    }
    return false;
  }
  static allSubsetsEqual(altSets) {
    let first = null;
    for (const alts of altSets) {
      if (first === null) {
        first = alts;
      } else if (alts !== first) {
        return false;
      }
    }
    return true;
  }
  static getUniqueAlt(altSets) {
    const all = _PredictionMode.getAlts(altSets);
    if (all.length === 1) {
      return all.nextSetBit(0);
    } else {
      return ATN.INVALID_ALT_NUMBER;
    }
  }
  static getAlts(altSets) {
    const all = new BitSet;
    altSets.forEach((alts) => {
      all.or(alts);
    });
    return all;
  }
  static getConflictingAltSubsets(configs) {
    const configToAlts = new HashMap(SubsetEqualityComparer.instance);
    for (const cfg of configs) {
      let alts = configToAlts.get(cfg);
      if (!alts) {
        alts = new BitSet;
        configToAlts.set(cfg, alts);
      }
      alts.set(cfg.alt);
    }
    return Array.from(configToAlts.values());
  }
  static getStateToAltMap(configs) {
    const m2 = new HashMap(ObjectEqualityComparator.instance);
    for (const c of configs) {
      let alts = m2.get(c.state);
      if (!alts) {
        alts = new BitSet;
        m2.set(c.state, alts);
      }
      alts.set(c.alt);
    }
    return m2;
  }
  static hasStateAssociatedWithOneAlt(configs) {
    const counts = {};
    for (const c of configs) {
      const stateNumber = c.state.stateNumber;
      if (!counts[stateNumber]) {
        counts[stateNumber] = 0;
      }
      counts[stateNumber]++;
    }
    return Object.values(counts).some((count) => {
      return count === 1;
    });
  }
  static getSingleViableAlt(altSets) {
    let result = null;
    for (const alts of altSets) {
      const minAlt = alts.nextSetBit(0);
      if (result === null) {
        result = minAlt;
      } else if (result !== minAlt) {
        return ATN.INVALID_ALT_NUMBER;
      }
    }
    return result ?? 0;
  }
};
var ParserATNSimulator = class _ParserATNSimulator extends ATNSimulator {
  static {
    __name(this, "ParserATNSimulator");
  }
  static traceATNSimulator = false;
  static debug;
  static debugAdd = false;
  static debugClosure = false;
  static dfaDebug = false;
  static retryDebug = false;
  predictionMode;
  decisionToDFA;
  parser;
  mergeCache = new DoubleDict;
  predictionState;
  constructor(recog, atn, decisionToDFA, sharedContextCache) {
    super(atn, sharedContextCache);
    this.parser = recog;
    this.decisionToDFA = decisionToDFA;
  }
  static getUniqueAlt(configs) {
    let alt = ATN.INVALID_ALT_NUMBER;
    for (const c of configs) {
      if (alt === ATN.INVALID_ALT_NUMBER) {
        alt = c.alt;
      } else if (c.alt !== alt) {
        return ATN.INVALID_ALT_NUMBER;
      }
    }
    return alt;
  }
  reset() {}
  clearDFA() {
    for (let d = 0;d < this.decisionToDFA.length; d++) {
      this.decisionToDFA[d] = new DFA(this.atn.getDecisionState(d), d);
    }
  }
  adaptivePredict(input, decision, outerContext) {
    if (_ParserATNSimulator.debug || _ParserATNSimulator.traceATNSimulator) {
      console.log("adaptivePredict decision " + decision + " exec LA(1)==" + this.getLookaheadName(input) + " line " + input.LT(1).line + ":" + input.LT(1).column);
    }
    const dfa = this.decisionToDFA[decision];
    this.predictionState = {
      input,
      startIndex: input.index,
      outerContext: outerContext ?? undefined,
      dfa
    };
    const m2 = input.mark();
    const index = input.index;
    try {
      let s0;
      if (dfa.isPrecedenceDfa) {
        s0 = dfa.getPrecedenceStartState(this.parser.getPrecedence());
      } else {
        s0 = dfa.s0;
      }
      if (!s0) {
        if (!outerContext) {
          outerContext = ParserRuleContext.empty;
        }
        if (_ParserATNSimulator.debug) {
          console.log("predictATN decision " + dfa.decision + " exec LA(1)==" + this.getLookaheadName(input) + ", outerContext=" + outerContext.toString(this.parser.ruleNames));
        }
        const fullCtx = false;
        let s0_closure = this.computeStartState(dfa.atnStartState, ParserRuleContext.empty, fullCtx);
        if (dfa.isPrecedenceDfa) {
          s0_closure = this.applyPrecedenceFilter(s0_closure);
          s0 = this.addDFAState(dfa, DFAState.fromConfigs(s0_closure));
          dfa.setPrecedenceStartState(this.parser.getPrecedence(), s0);
        } else {
          s0 = this.addDFAState(dfa, DFAState.fromConfigs(s0_closure));
          dfa.s0 = s0;
        }
      }
      const alt = this.execATN(dfa, s0, input, index, outerContext);
      if (_ParserATNSimulator.debug) {
        console.log("DFA after predictATN: " + dfa.toString(this.parser.vocabulary));
      }
      return alt;
    } finally {
      this.predictionState.dfa = undefined;
      this.mergeCache = new DoubleDict;
      input.seek(index);
      input.release(m2);
    }
  }
  execATN(dfa, s0, input, startIndex, outerContext) {
    if (_ParserATNSimulator.debug || _ParserATNSimulator.traceATNSimulator) {
      console.log("execATN decision " + dfa.decision + ", DFA state " + s0 + ", LA(1)==" + this.getLookaheadName(input) + " line " + input.LT(1).line + ":" + input.LT(1).column);
    }
    let alt;
    let previousState = s0;
    let t = input.LA(1);
    while (true) {
      let nextState = this.getExistingTargetState(previousState, t);
      if (!nextState) {
        nextState = this.computeTargetState(dfa, previousState, t);
      }
      if (nextState === ATNSimulator.ERROR) {
        const e = this.noViableAlt(input, outerContext, previousState.configs, startIndex);
        input.seek(startIndex);
        alt = this.getSynValidOrSemInvalidAltThatFinishedDecisionEntryRule(previousState.configs, outerContext);
        if (alt !== ATN.INVALID_ALT_NUMBER) {
          return alt;
        } else {
          throw e;
        }
      }
      if (nextState.requiresFullContext && this.predictionMode !== PredictionMode.SLL) {
        let conflictingAlts = null;
        if (nextState.predicates !== null) {
          if (_ParserATNSimulator.debug) {
            console.log("DFA state has preds in DFA sim LL failover");
          }
          const conflictIndex = input.index;
          if (conflictIndex !== startIndex) {
            input.seek(startIndex);
          }
          conflictingAlts = this.evalSemanticContext(nextState.predicates, outerContext, true);
          if (conflictingAlts.length === 1) {
            if (_ParserATNSimulator.debug) {
              console.log("Full LL avoided");
            }
            return conflictingAlts.nextSetBit(0);
          }
          if (conflictIndex !== startIndex) {
            input.seek(conflictIndex);
          }
        }
        if (_ParserATNSimulator.dfaDebug) {
          console.log("ctx sensitive state " + outerContext + " in " + nextState);
        }
        const fullCtx = true;
        const s0_closure = this.computeStartState(dfa.atnStartState, outerContext, fullCtx);
        this.reportAttemptingFullContext(dfa, conflictingAlts, nextState.configs, startIndex, input.index);
        alt = this.execATNWithFullContext(dfa, nextState, s0_closure, input, startIndex, outerContext);
        return alt;
      }
      if (nextState.isAcceptState) {
        if (nextState.predicates === null) {
          return nextState.prediction;
        }
        const stopIndex = input.index;
        input.seek(startIndex);
        const alts = this.evalSemanticContext(nextState.predicates, outerContext, true);
        if (alts.length === 0) {
          throw this.noViableAlt(input, outerContext, nextState.configs, startIndex);
        }
        if (alts.length === 1) {
          return alts.nextSetBit(0);
        }
        this.reportAmbiguity(dfa, nextState, startIndex, stopIndex, false, alts, nextState.configs);
        return alts.nextSetBit(0);
      }
      previousState = nextState;
      if (t !== Token.EOF) {
        input.consume();
        t = input.LA(1);
      }
    }
  }
  getExistingTargetState(previousD, t) {
    return previousD.edges[t + 1];
  }
  computeTargetState(dfa, previousD, t) {
    const reach = this.computeReachSet(previousD.configs, t, false);
    if (reach === null) {
      this.addDFAEdge(dfa, previousD, t, ATNSimulator.ERROR);
      return ATNSimulator.ERROR;
    }
    let D = DFAState.fromConfigs(reach);
    const predictedAlt = _ParserATNSimulator.getUniqueAlt(reach);
    if (_ParserATNSimulator.debug) {
      const altSubSets = PredictionMode.getConflictingAltSubsets(reach);
      console.log("SLL altSubSets=" + arrayToString(altSubSets) + ", configs=" + reach + ", predict=" + predictedAlt + ", allSubsetsConflict=" + PredictionMode.allSubsetsConflict(altSubSets) + ", conflictingAlts=" + this.getConflictingAlts(reach));
    }
    if (predictedAlt !== ATN.INVALID_ALT_NUMBER) {
      D.isAcceptState = true;
      D.configs.uniqueAlt = predictedAlt;
      D.prediction = predictedAlt;
    } else if (PredictionMode.hasSLLConflictTerminatingPrediction(this.predictionMode, reach)) {
      D.configs.conflictingAlts = this.getConflictingAlts(reach);
      D.requiresFullContext = true;
      D.isAcceptState = true;
      D.prediction = D.configs.conflictingAlts.nextSetBit(0);
    }
    if (D.isAcceptState && D.configs.hasSemanticContext) {
      this.predicateDFAState(D, this.atn.getDecisionState(dfa.decision));
      if (D.predicates !== null) {
        D.prediction = ATN.INVALID_ALT_NUMBER;
      }
    }
    D = this.addDFAEdge(dfa, previousD, t, D);
    return D;
  }
  getRuleName(index) {
    if (this.parser !== null && index >= 0) {
      return this.parser.ruleNames[index];
    } else {
      return "<rule " + index + ">";
    }
  }
  getTokenName(t) {
    if (t === Token.EOF) {
      return "EOF";
    }
    const vocabulary = this.parser?.vocabulary ?? Vocabulary.EMPTY_VOCABULARY;
    const displayName = vocabulary.getDisplayName(t);
    if (displayName === t.toString()) {
      return displayName;
    }
    return displayName + "<" + t + ">";
  }
  getLookaheadName(input) {
    return this.getTokenName(input.LA(1));
  }
  dumpDeadEndConfigs(e) {
    console.log("dead end configs: ");
    const decs = e.deadEndConfigs;
    for (const c of decs) {
      let trans = "no edges";
      if (c.state.transitions.length > 0) {
        const t = c.state.transitions[0];
        if (t instanceof AtomTransition) {
          trans = "Atom " + this.getTokenName(t.labelValue);
        } else if (t instanceof SetTransition) {
          const neg = t instanceof NotSetTransition;
          trans = (neg ? "~" : "") + "Set " + t.label;
        }
      }
      console.error(c.toString(this.parser, true) + ":" + trans);
    }
  }
  predicateDFAState(dfaState, decisionState) {
    const altCount = decisionState.transitions.length;
    const altsToCollectPredsFrom = this.getConflictingAltsOrUniqueAlt(dfaState.configs);
    const altToPred = this.getPredsForAmbigAlts(altsToCollectPredsFrom, dfaState.configs, altCount);
    if (altToPred !== null) {
      dfaState.predicates = this.getPredicatePredictions(altsToCollectPredsFrom, altToPred);
      dfaState.prediction = ATN.INVALID_ALT_NUMBER;
    } else {
      dfaState.prediction = altsToCollectPredsFrom.nextSetBit(0);
    }
  }
  execATNWithFullContext(dfa, D, s0, input, startIndex, outerContext) {
    if (_ParserATNSimulator.debug || _ParserATNSimulator.traceATNSimulator) {
      console.log("execATNWithFullContext " + s0);
    }
    const fullCtx = true;
    let foundExactAmbig = false;
    let reach;
    let previous = s0;
    input.seek(startIndex);
    let t = input.LA(1);
    let predictedAlt = -1;
    for (;; ) {
      reach = this.computeReachSet(previous, t, fullCtx);
      if (reach === null) {
        const e = this.noViableAlt(input, outerContext, previous, startIndex);
        input.seek(startIndex);
        const alt = this.getSynValidOrSemInvalidAltThatFinishedDecisionEntryRule(previous, outerContext);
        if (alt !== ATN.INVALID_ALT_NUMBER) {
          return alt;
        } else {
          throw e;
        }
      }
      const altSubSets = PredictionMode.getConflictingAltSubsets(reach);
      if (_ParserATNSimulator.debug) {
        console.log("LL altSubSets=" + altSubSets + ", predict=" + PredictionMode.getUniqueAlt(altSubSets) + ", resolvesToJustOneViableAlt=" + PredictionMode.resolvesToJustOneViableAlt(altSubSets));
      }
      reach.uniqueAlt = _ParserATNSimulator.getUniqueAlt(reach);
      if (reach.uniqueAlt !== ATN.INVALID_ALT_NUMBER) {
        predictedAlt = reach.uniqueAlt;
        break;
      } else if (this.predictionMode !== PredictionMode.LL_EXACT_AMBIG_DETECTION) {
        predictedAlt = PredictionMode.resolvesToJustOneViableAlt(altSubSets);
        if (predictedAlt !== ATN.INVALID_ALT_NUMBER) {
          break;
        }
      } else {
        if (PredictionMode.allSubsetsConflict(altSubSets) && PredictionMode.allSubsetsEqual(altSubSets)) {
          foundExactAmbig = true;
          predictedAlt = PredictionMode.getSingleViableAlt(altSubSets);
          break;
        }
      }
      previous = reach;
      if (t !== Token.EOF) {
        input.consume();
        t = input.LA(1);
      }
    }
    if (reach.uniqueAlt !== ATN.INVALID_ALT_NUMBER) {
      this.reportContextSensitivity(dfa, predictedAlt, reach, startIndex, input.index);
      return predictedAlt;
    }
    this.reportAmbiguity(dfa, D, startIndex, input.index, foundExactAmbig, reach.getAlts(), reach);
    return predictedAlt;
  }
  computeReachSet(closure, t, fullCtx) {
    if (_ParserATNSimulator.debug) {
      console.log("in computeReachSet, starting closure: " + closure);
    }
    const intermediate = new ATNConfigSet(fullCtx);
    let skippedStopStates = null;
    for (const c of closure) {
      if (_ParserATNSimulator.debug) {
        console.log("testing " + this.getTokenName(t) + " at " + c);
      }
      if (c.state instanceof RuleStopState) {
        if (fullCtx || t === Token.EOF) {
          if (skippedStopStates === null) {
            skippedStopStates = [];
          }
          skippedStopStates.push(c);
        }
        continue;
      }
      for (const trans of c.state.transitions) {
        const target = this.getReachableTarget(trans, t);
        if (target !== null) {
          const cfg = ATNConfig.createWithConfig(target, c);
          intermediate.add(cfg, this.mergeCache);
          if (_ParserATNSimulator.debugAdd) {
            console.log("added " + cfg + " to intermediate");
          }
        }
      }
    }
    let reach = null;
    if (skippedStopStates === null && t !== Token.EOF) {
      if (intermediate.length === 1) {
        reach = intermediate;
      } else if (_ParserATNSimulator.getUniqueAlt(intermediate) !== ATN.INVALID_ALT_NUMBER) {
        reach = intermediate;
      }
    }
    if (reach === null) {
      reach = new ATNConfigSet(fullCtx);
      const closureBusy = new HashSet;
      const treatEofAsEpsilon = t === Token.EOF;
      for (const config of intermediate) {
        this.closure(config, reach, closureBusy, false, fullCtx, treatEofAsEpsilon);
      }
    }
    if (t === Token.EOF) {
      reach = this.removeAllConfigsNotInRuleStopState(reach, reach === intermediate);
    }
    if (skippedStopStates !== null && (!fullCtx || !PredictionMode.hasConfigInRuleStopState(reach))) {
      for (const config of skippedStopStates) {
        reach.add(config, this.mergeCache);
      }
    }
    if (_ParserATNSimulator.traceATNSimulator) {
      console.log("computeReachSet " + closure + " -> " + reach);
    }
    if (reach.length === 0) {
      return null;
    } else {
      return reach;
    }
  }
  removeAllConfigsNotInRuleStopState(configs, lookToEndOfRule) {
    if (PredictionMode.allConfigsInRuleStopStates(configs)) {
      return configs;
    }
    const result = new ATNConfigSet(configs.fullCtx);
    for (const config of configs) {
      if (config.state instanceof RuleStopState) {
        result.add(config, this.mergeCache);
        continue;
      }
      if (lookToEndOfRule && config.state.epsilonOnlyTransitions) {
        const nextTokens = this.atn.nextTokens(config.state);
        if (nextTokens.contains(Token.EPSILON)) {
          const endOfRuleState = this.atn.ruleToStopState[config.state.ruleIndex];
          result.add(ATNConfig.createWithConfig(endOfRuleState, config), this.mergeCache);
        }
      }
    }
    return result;
  }
  computeStartState(p, ctx, fullCtx) {
    const initialContext = predictionContextFromRuleContext(this.atn, ctx);
    const configs = new ATNConfigSet(fullCtx);
    if (_ParserATNSimulator.traceATNSimulator) {
      console.log("computeStartState from ATN state " + p + " initialContext=" + initialContext.toString(this.parser));
    }
    for (let i = 0;i < p.transitions.length; i++) {
      const target = p.transitions[i].target;
      const c = ATNConfig.createWithContext(target, i + 1, initialContext);
      const closureBusy = new HashSet;
      this.closure(c, configs, closureBusy, true, fullCtx, false);
    }
    return configs;
  }
  applyPrecedenceFilter(configs) {
    const statesFromAlt1 = [];
    const configSet = new ATNConfigSet(configs.fullCtx);
    for (const config of configs) {
      if (config.alt !== 1) {
        continue;
      }
      const updatedContext = config.semanticContext.evalPrecedence(this.parser, this.predictionState.outerContext);
      if (updatedContext === null) {
        continue;
      }
      statesFromAlt1[config.state.stateNumber] = config.context;
      if (updatedContext !== config.semanticContext) {
        configSet.add(ATNConfig.duplicate(config, updatedContext), this.mergeCache);
      } else {
        configSet.add(config, this.mergeCache);
      }
    }
    for (const config of configs) {
      if (config.alt === 1) {
        continue;
      }
      if (!config.precedenceFilterSuppressed) {
        const context = statesFromAlt1[config.state.stateNumber] || null;
        if (context !== null && context.equals(config.context)) {
          continue;
        }
      }
      configSet.add(config, this.mergeCache);
    }
    return configSet;
  }
  getReachableTarget(trans, ttype) {
    if (trans.matches(ttype, 0, this.atn.maxTokenType)) {
      return trans.target;
    } else {
      return null;
    }
  }
  getPredsForAmbigAlts(ambigAlts, configs, altCount) {
    let altToPred = [];
    for (const c of configs) {
      if (ambigAlts.get(c.alt)) {
        altToPred[c.alt] = SemanticContext.orContext(altToPred[c.alt] ?? null, c.semanticContext);
      }
    }
    let nPredAlts = 0;
    for (let i = 1;i < altCount + 1; i++) {
      const pred = altToPred[i] ?? null;
      if (pred === null) {
        altToPred[i] = SemanticContext.NONE;
      } else if (pred !== SemanticContext.NONE) {
        nPredAlts += 1;
      }
    }
    if (nPredAlts === 0) {
      altToPred = null;
    }
    if (_ParserATNSimulator.debug) {
      console.log("getPredsForAmbigAlts result " + arrayToString(altToPred));
    }
    return altToPred;
  }
  getPredicatePredictions(ambigAlts, altToPred) {
    const pairs = [];
    let containsPredicate = false;
    for (let i = 1;i < altToPred.length; i++) {
      const pred = altToPred[i];
      if (ambigAlts.get(i)) {
        pairs.push({ pred, alt: i });
      }
      if (pred !== SemanticContext.NONE) {
        containsPredicate = true;
      }
    }
    if (!containsPredicate) {
      return null;
    }
    return pairs;
  }
  getSynValidOrSemInvalidAltThatFinishedDecisionEntryRule(configs, outerContext) {
    const splitConfigs = this.splitAccordingToSemanticValidity(configs, outerContext);
    const semValidConfigs = splitConfigs[0];
    const semInvalidConfigs = splitConfigs[1];
    let alt = this.getAltThatFinishedDecisionEntryRule(semValidConfigs);
    if (alt !== ATN.INVALID_ALT_NUMBER) {
      return alt;
    }
    if (semInvalidConfigs.length > 0) {
      alt = this.getAltThatFinishedDecisionEntryRule(semInvalidConfigs);
      if (alt !== ATN.INVALID_ALT_NUMBER) {
        return alt;
      }
    }
    return ATN.INVALID_ALT_NUMBER;
  }
  getAltThatFinishedDecisionEntryRule(configs) {
    const alts = [];
    for (const c of configs) {
      if (c.reachesIntoOuterContext || c.state instanceof RuleStopState && c.context.hasEmptyPath()) {
        if (alts.indexOf(c.alt) < 0) {
          alts.push(c.alt);
        }
      }
    }
    if (alts.length === 0) {
      return ATN.INVALID_ALT_NUMBER;
    } else {
      return Math.min(...alts);
    }
  }
  splitAccordingToSemanticValidity(configs, outerContext) {
    const succeeded = new ATNConfigSet(configs.fullCtx);
    const failed = new ATNConfigSet(configs.fullCtx);
    for (const c of configs) {
      if (c.semanticContext !== SemanticContext.NONE) {
        const predicateEvaluationResult = c.semanticContext.evaluate(this.parser, outerContext);
        if (predicateEvaluationResult) {
          succeeded.add(c);
        } else {
          failed.add(c);
        }
      } else {
        succeeded.add(c);
      }
    }
    return [succeeded, failed];
  }
  evalSemanticContext(predPredictions, outerContext, complete) {
    const predictions = new BitSet;
    for (const pair of predPredictions) {
      if (pair.pred === SemanticContext.NONE) {
        predictions.set(pair.alt);
        if (!complete) {
          break;
        }
        continue;
      }
      const predicateEvaluationResult = pair.pred.evaluate(this.parser, outerContext);
      if (_ParserATNSimulator.debug || _ParserATNSimulator.dfaDebug) {
        console.log("eval pred " + pair + "=" + predicateEvaluationResult);
      }
      if (predicateEvaluationResult) {
        predictions.set(pair.alt);
        if (!complete) {
          break;
        }
      }
    }
    return predictions;
  }
  closure(config, configs, closureBusy, collectPredicates, fullCtx, treatEofAsEpsilon) {
    const initialDepth = 0;
    this.closureCheckingStopState(config, configs, closureBusy, collectPredicates, fullCtx, initialDepth, treatEofAsEpsilon);
  }
  closureCheckingStopState(config, configs, closureBusy, collectPredicates, fullCtx, depth, treatEofAsEpsilon) {
    if (_ParserATNSimulator.traceATNSimulator || _ParserATNSimulator.debugClosure) {
      console.log("closure(" + config.toString(this.parser, true) + ")");
    }
    if (config.state instanceof RuleStopState) {
      if (config.context && !config.context.isEmpty()) {
        for (let i = 0;i < config.context.length; i++) {
          if (config.context.getReturnState(i) === PredictionContext.EMPTY_RETURN_STATE) {
            if (fullCtx) {
              configs.add(ATNConfig.createWithConfig(config.state, config, EmptyPredictionContext.instance), this.mergeCache);
              continue;
            } else {
              if (_ParserATNSimulator.debug) {
                console.log("FALLING off rule " + this.getRuleName(config.state.ruleIndex));
              }
              this.closure_(config, configs, closureBusy, collectPredicates, fullCtx, depth, treatEofAsEpsilon);
            }
            continue;
          }
          const returnState = this.atn.states[config.context.getReturnState(i)];
          const newContext = config.context.getParent(i);
          const c = ATNConfig.createWithContext(returnState, config.alt, newContext, config.semanticContext);
          c.reachesIntoOuterContext = config.reachesIntoOuterContext;
          this.closureCheckingStopState(c, configs, closureBusy, collectPredicates, fullCtx, depth - 1, treatEofAsEpsilon);
        }
        return;
      } else if (fullCtx) {
        configs.add(config, this.mergeCache);
        return;
      } else {
        if (_ParserATNSimulator.debug) {
          console.log("FALLING off rule " + this.getRuleName(config.state.ruleIndex));
        }
      }
    }
    this.closure_(config, configs, closureBusy, collectPredicates, fullCtx, depth, treatEofAsEpsilon);
  }
  closure_(config, configs, closureBusy, collectPredicates, fullCtx, depth, treatEofAsEpsilon) {
    const p = config.state;
    if (!p.epsilonOnlyTransitions) {
      configs.add(config, this.mergeCache);
    }
    for (let i = 0;i < p.transitions.length; i++) {
      if (i === 0 && this.canDropLoopEntryEdgeInLeftRecursiveRule(config)) {
        continue;
      }
      const t = p.transitions[i];
      const continueCollecting = collectPredicates && !(t instanceof ActionTransition);
      const c = this.getEpsilonTarget(config, t, continueCollecting, depth === 0, fullCtx, treatEofAsEpsilon);
      if (c) {
        let newDepth = depth;
        if (config.state.constructor.stateType === ATNState.RULE_STOP) {
          if (this.predictionState.dfa && this.predictionState?.dfa.isPrecedenceDfa) {
            const outermostPrecedenceReturn = t.outermostPrecedenceReturn;
            if (outermostPrecedenceReturn === this.predictionState?.dfa.atnStartState?.ruleIndex) {
              c.precedenceFilterSuppressed = true;
            }
          }
          c.reachesIntoOuterContext = true;
          if (closureBusy.getOrAdd(c) !== c) {
            continue;
          }
          configs.dipsIntoOuterContext = true;
          newDepth -= 1;
          if (_ParserATNSimulator.debug) {
            console.log("dips into outer ctx: " + c);
          }
        } else {
          if (!t.isEpsilon && closureBusy.getOrAdd(c) !== c) {
            continue;
          }
          if (t instanceof RuleTransition) {
            if (newDepth >= 0) {
              newDepth += 1;
            }
          }
        }
        this.closureCheckingStopState(c, configs, closureBusy, continueCollecting, fullCtx, newDepth, treatEofAsEpsilon);
      }
    }
  }
  canDropLoopEntryEdgeInLeftRecursiveRule(config) {
    const p = config.state;
    if (p.constructor.stateType !== ATNState.STAR_LOOP_ENTRY || !config.context) {
      return false;
    }
    if (!p.precedenceRuleDecision || config.context.isEmpty() || config.context.hasEmptyPath()) {
      return false;
    }
    const numCtxs = config.context.length;
    for (let i = 0;i < numCtxs; i++) {
      const returnState = this.atn.states[config.context.getReturnState(i)];
      if (returnState.ruleIndex !== p.ruleIndex) {
        return false;
      }
    }
    const decisionStartState = p.transitions[0].target;
    const blockEndStateNum = decisionStartState.endState.stateNumber;
    const blockEndState = this.atn.states[blockEndStateNum];
    for (let i = 0;i < numCtxs; i++) {
      const returnStateNumber = config.context.getReturnState(i);
      const returnState = this.atn.states[returnStateNumber];
      if (returnState.transitions.length !== 1 || !returnState.transitions[0].isEpsilon) {
        return false;
      }
      const returnStateTarget = returnState.transitions[0].target;
      if (returnState.constructor.stateType === ATNState.BLOCK_END && returnStateTarget === p) {
        continue;
      }
      if (returnState === blockEndState) {
        continue;
      }
      if (returnStateTarget === blockEndState) {
        continue;
      }
      if (returnStateTarget.constructor.stateType === ATNState.BLOCK_END && returnStateTarget.transitions.length === 1 && returnStateTarget.transitions[0].isEpsilon && returnStateTarget.transitions[0].target === p) {
        continue;
      }
      return false;
    }
    return true;
  }
  getEpsilonTarget(config, t, collectPredicates, inContext, fullCtx, treatEofAsEpsilon) {
    switch (t.transitionType) {
      case Transition.RULE: {
        return this.ruleTransition(config, t);
      }
      case Transition.PRECEDENCE: {
        return this.precedenceTransition(config, t, collectPredicates, inContext, fullCtx);
      }
      case Transition.PREDICATE: {
        return this.predTransition(config, t, collectPredicates, inContext, fullCtx);
      }
      case Transition.ACTION: {
        if (_ParserATNSimulator.debug) {
          const at = t;
          const index = at.actionIndex === -1 ? 65535 : at.actionIndex;
          console.log("ACTION edge " + at.ruleIndex + ":" + index);
        }
        return ATNConfig.createWithConfig(t.target, config);
      }
      case Transition.EPSILON: {
        return ATNConfig.createWithConfig(t.target, config);
      }
      case Transition.ATOM:
      case Transition.RANGE:
      case Transition.SET: {
        if (treatEofAsEpsilon) {
          if (t.matches(Token.EOF, 0, 1)) {
            return ATNConfig.createWithConfig(t.target, config);
          }
        }
        return null;
      }
      default:
        return null;
    }
  }
  precedenceTransition(config, pt, collectPredicates, inContext, fullCtx) {
    if (_ParserATNSimulator.debug) {
      console.log("PRED (collectPredicates=" + collectPredicates + ") " + pt.precedence + ">=_p, ctx dependent=true");
      if (this.parser !== null) {
        console.log("context surrounding pred is " + arrayToString(this.parser.getRuleInvocationStack()));
      }
    }
    let c = null;
    if (collectPredicates && inContext) {
      if (fullCtx && this.predictionState?.input) {
        const currentPosition = this.predictionState.input.index;
        this.predictionState.input.seek(this.predictionState.startIndex);
        const predSucceeds = pt.getPredicate().evaluate(this.parser, this.predictionState.outerContext);
        this.predictionState.input.seek(currentPosition);
        if (predSucceeds) {
          c = ATNConfig.createWithConfig(pt.target, config);
        }
      } else {
        const newSemCtx = SemanticContext.andContext(config.semanticContext, pt.getPredicate());
        c = ATNConfig.createWithSemanticContext(pt.target, config, newSemCtx);
      }
    } else {
      c = ATNConfig.createWithConfig(pt.target, config);
    }
    if (_ParserATNSimulator.debug) {
      console.log("config from pred transition=" + c);
    }
    return c;
  }
  predTransition(config, pt, collectPredicates, inContext, fullCtx) {
    if (_ParserATNSimulator.debug) {
      console.log("PRED (collectPredicates=" + collectPredicates + ") " + pt.ruleIndex + ":" + pt.predIndex + ", ctx dependent=" + pt.isCtxDependent);
      if (this.parser !== null) {
        console.log("context surrounding pred is " + arrayToString(this.parser.getRuleInvocationStack()));
      }
    }
    let c = null;
    if (collectPredicates && (pt.isCtxDependent && inContext || !pt.isCtxDependent)) {
      if (fullCtx && this.predictionState?.input) {
        const currentPosition = this.predictionState.input.index;
        this.predictionState.input.seek(this.predictionState.startIndex);
        const predSucceeds = pt.getPredicate().evaluate(this.parser, this.predictionState.outerContext);
        this.predictionState.input.seek(currentPosition);
        if (predSucceeds) {
          c = ATNConfig.createWithConfig(pt.target, config);
        }
      } else {
        const newSemCtx = SemanticContext.andContext(config.semanticContext, pt.getPredicate());
        c = ATNConfig.createWithSemanticContext(pt.target, config, newSemCtx);
      }
    } else {
      c = ATNConfig.createWithConfig(pt.target, config);
    }
    if (_ParserATNSimulator.debug) {
      console.log("config from pred transition=" + c);
    }
    return c;
  }
  ruleTransition(config, t) {
    if (_ParserATNSimulator.debug) {
      console.log("CALL rule " + this.getRuleName(t.target.ruleIndex) + ", ctx=" + config.context);
    }
    const returnState = t.followState;
    const newContext = createSingletonPredictionContext(config.context ?? undefined, returnState.stateNumber);
    return ATNConfig.createWithConfig(t.target, config, newContext);
  }
  getConflictingAlts(configs) {
    const altSets = PredictionMode.getConflictingAltSubsets(configs);
    return PredictionMode.getAlts(altSets);
  }
  getConflictingAltsOrUniqueAlt(configs) {
    let conflictingAlts;
    if (configs.uniqueAlt !== ATN.INVALID_ALT_NUMBER) {
      conflictingAlts = new BitSet;
      conflictingAlts.set(configs.uniqueAlt);
    } else {
      conflictingAlts = configs.conflictingAlts;
    }
    return conflictingAlts;
  }
  noViableAlt(input, outerContext, configs, startIndex) {
    return new NoViableAltException(this.parser, input, input.get(startIndex), input.LT(1), configs, outerContext);
  }
  addDFAEdge(dfa, from, t, to) {
    if (_ParserATNSimulator.debug) {
      console.log("EDGE " + from + " -> " + to + " upon " + this.getTokenName(t));
    }
    to = this.addDFAState(dfa, to);
    if (t < -1 || t > this.atn.maxTokenType) {
      return to;
    }
    if (_ParserATNSimulator.debug) {
      console.log(`DFA=
` + dfa.toString(this.parser != null ? this.parser.vocabulary : Vocabulary.EMPTY_VOCABULARY));
    }
    from.edges[t + 1] = to;
    return to;
  }
  addDFAState(dfa, newState) {
    if (newState === ATNSimulator.ERROR) {
      return newState;
    }
    const existing = dfa.getState(newState);
    if (existing !== null) {
      return existing;
    }
    if (!newState.configs.readOnly) {
      newState.configs.optimizeConfigs(this);
      newState.configs.setReadonly(true);
    }
    if (_ParserATNSimulator.traceATNSimulator) {
      console.log("addDFAState new " + newState);
    }
    dfa.addState(newState);
    return newState;
  }
  reportAttemptingFullContext(dfa, conflictingAlts, configs, startIndex, stopIndex) {
    if (_ParserATNSimulator.debug || _ParserATNSimulator.retryDebug) {
      const interval = new Interval(startIndex, stopIndex + 1);
      console.log("reportAttemptingFullContext decision=" + dfa.decision + ":" + configs + ", input=" + this.parser.tokenStream.getTextFromInterval(interval));
    }
    this.parser.errorListenerDispatch.reportAttemptingFullContext(this.parser, dfa, startIndex, stopIndex, conflictingAlts, configs);
  }
  reportContextSensitivity(dfa, prediction, configs, startIndex, stopIndex) {
    if (_ParserATNSimulator.debug || _ParserATNSimulator.retryDebug) {
      const interval = new Interval(startIndex, stopIndex + 1);
      console.log("reportContextSensitivity decision=" + dfa.decision + ":" + configs + ", input=" + this.parser.tokenStream.getTextFromInterval(interval));
    }
    this.parser.errorListenerDispatch.reportContextSensitivity(this.parser, dfa, startIndex, stopIndex, prediction, configs);
  }
  reportAmbiguity(dfa, D, startIndex, stopIndex, exact, ambigAlts, configs) {
    if (_ParserATNSimulator.debug || _ParserATNSimulator.retryDebug) {
      const interval = new Interval(startIndex, stopIndex + 1);
      console.log("reportAmbiguity " + ambigAlts + ":" + configs + ", input=" + this.parser.tokenStream.getTextFromInterval(interval));
    }
    this.parser.errorListenerDispatch.reportAmbiguity(this.parser, dfa, startIndex, stopIndex, exact, ambigAlts, configs);
  }
};
var PredictionContextCache = class {
  static {
    __name(this, "PredictionContextCache");
  }
  cache = new HashMap(ObjectEqualityComparator.instance);
  add(ctx) {
    if (ctx === EmptyPredictionContext.instance) {
      return ctx;
    }
    const existing = this.cache.get(ctx);
    if (existing) {
      return existing;
    }
    this.cache.set(ctx, ctx);
    return ctx;
  }
  get(ctx) {
    return this.cache.get(ctx);
  }
  get length() {
    return this.cache.size;
  }
};
var ProfilingATNSimulator = class extends ParserATNSimulator {
  static {
    __name(this, "ProfilingATNSimulator");
  }
  decisions;
  numDecisions = 0;
  currentDecision = 0;
  currentState;
  conflictingAltResolvedBySLL;
  sllStopIndex = 0;
  llStopIndex = 0;
  constructor(parser) {
    const sharedContextCache = parser.interpreter.sharedContextCache;
    super(parser, parser.interpreter.atn, parser.interpreter.decisionToDFA, sharedContextCache);
    if (sharedContextCache) {
      this.numDecisions = this.atn.decisionToState.length;
      this.decisions = new Array(this.numDecisions);
      for (let i = 0;i < this.numDecisions; i++) {
        this.decisions[i] = new DecisionInfo(i);
      }
    }
  }
  adaptivePredict(input, decision, outerContext) {
    try {
      this.sllStopIndex = -1;
      this.llStopIndex = -1;
      this.currentDecision = decision;
      const start = performance.now();
      const alt = super.adaptivePredict(input, decision, outerContext);
      const stop = performance.now();
      this.decisions[decision].timeInPrediction += stop - start;
      this.decisions[decision].invocations++;
      const sllLook = this.sllStopIndex - this.predictionState.startIndex + 1;
      this.decisions[decision].sllTotalLook += sllLook;
      this.decisions[decision].sllMinLook = this.decisions[decision].sllMinLook === 0 ? sllLook : Math.min(this.decisions[decision].sllMinLook, sllLook);
      if (sllLook > this.decisions[decision].sllMaxLook) {
        this.decisions[decision].sllMaxLook = sllLook;
        this.decisions[decision].sllMaxLookEvent = {
          decision,
          configs: null,
          predictedAlt: alt,
          input,
          startIndex: this.predictionState.startIndex,
          stopIndex: this.sllStopIndex,
          fullCtx: false
        };
      }
      if (this.llStopIndex >= 0) {
        const llLook = this.llStopIndex - this.predictionState.startIndex + 1;
        this.decisions[decision].llTotalLook += llLook;
        this.decisions[decision].llMinLook = this.decisions[decision].llMinLook === 0 ? llLook : Math.min(this.decisions[decision].llMinLook, llLook);
        if (llLook > this.decisions[decision].llMaxLook) {
          this.decisions[decision].llMaxLook = llLook;
          this.decisions[decision].llMaxLookEvent = {
            decision,
            configs: null,
            predictedAlt: alt,
            input,
            startIndex: this.predictionState.startIndex,
            stopIndex: this.llStopIndex,
            fullCtx: true
          };
        }
      }
      return alt;
    } finally {
      this.currentDecision = -1;
    }
  }
  getExistingTargetState(previousD, t) {
    this.sllStopIndex = this.predictionState.input.index;
    const existingTargetState = super.getExistingTargetState(previousD, t);
    if (existingTargetState !== undefined) {
      this.decisions[this.currentDecision].sllDFATransitions++;
      if (existingTargetState === ATNSimulator.ERROR) {
        this.decisions[this.currentDecision].errors.push({
          decision: this.currentDecision,
          configs: previousD.configs,
          input: this.predictionState.input,
          startIndex: this.predictionState.startIndex,
          stopIndex: this.sllStopIndex,
          fullCtx: false
        });
      }
    }
    this.currentState = existingTargetState;
    return existingTargetState;
  }
  computeTargetState(dfa, previousD, t) {
    const state = super.computeTargetState(dfa, previousD, t);
    this.currentState = state;
    return state;
  }
  computeReachSet(closure, t, fullCtx) {
    if (fullCtx && this.predictionState?.input) {
      this.llStopIndex = this.predictionState.input.index;
    }
    const reachConfigs = super.computeReachSet(closure, t, fullCtx);
    if (this.predictionState?.input) {
      if (fullCtx) {
        this.decisions[this.currentDecision].llATNTransitions++;
        if (reachConfigs === null) {
          this.decisions[this.currentDecision].errors.push({
            decision: this.currentDecision,
            configs: closure,
            input: this.predictionState.input,
            startIndex: this.predictionState.startIndex,
            stopIndex: this.sllStopIndex,
            fullCtx: true
          });
        }
      } else {
        this.decisions[this.currentDecision].sllATNTransitions++;
        if (reachConfigs === null) {
          this.decisions[this.currentDecision].errors.push({
            decision: this.currentDecision,
            configs: closure,
            input: this.predictionState.input,
            startIndex: this.predictionState.startIndex,
            stopIndex: this.sllStopIndex,
            fullCtx: false
          });
        }
      }
    }
    return reachConfigs;
  }
  reportAttemptingFullContext(dfa, conflictingAlts, configs, startIndex, stopIndex) {
    if (conflictingAlts !== null) {
      this.conflictingAltResolvedBySLL = conflictingAlts.nextSetBit(0);
    } else {
      this.conflictingAltResolvedBySLL = configs.getAlts().nextSetBit(0);
    }
    this.decisions[this.currentDecision].llFallback++;
    if (conflictingAlts) {
      super.reportAttemptingFullContext(dfa, conflictingAlts, configs, startIndex, stopIndex);
    }
  }
  reportContextSensitivity(dfa, prediction, configs, startIndex, stopIndex) {
    if (prediction !== this.conflictingAltResolvedBySLL && this.predictionState.input) {
      this.decisions[this.currentDecision].contextSensitivities.push({
        decision: this.currentDecision,
        configs,
        input: this.predictionState.input,
        startIndex,
        stopIndex,
        fullCtx: true
      });
    }
    super.reportContextSensitivity(dfa, prediction, configs, startIndex, stopIndex);
  }
  reportAmbiguity(dfa, state, startIndex, stopIndex, exact, ambigAlts, configs) {
    let prediction;
    if (ambigAlts) {
      prediction = ambigAlts.nextSetBit(0);
    } else {
      prediction = configs.getAlts().nextSetBit(0);
    }
    if (this.predictionState?.input) {
      if (configs.fullCtx && prediction !== this.conflictingAltResolvedBySLL) {
        this.decisions[this.currentDecision].contextSensitivities.push({
          decision: this.currentDecision,
          configs,
          input: this.predictionState.input,
          startIndex,
          stopIndex,
          fullCtx: true
        });
      }
      this.decisions[this.currentDecision].ambiguities.push({
        ambigAlts,
        decision: this.currentDecision,
        configs,
        input: this.predictionState.input,
        startIndex,
        stopIndex,
        fullCtx: configs.fullCtx
      });
    }
    super.reportAmbiguity(dfa, state, startIndex, stopIndex, exact, ambigAlts, configs);
  }
  getDecisionInfo() {
    return this.decisions;
  }
  getCurrentState() {
    return this.currentState;
  }
};
var PredPrediction;
((PredPrediction2) => {
  PredPrediction2.toString = /* @__PURE__ */ __name((prediction) => {
    return `(${prediction.pred}, ${prediction.alt})`;
  }, "toString");
})(PredPrediction || (PredPrediction = {}));
var ParseCancellationException = class extends Error {
  static {
    __name(this, "ParseCancellationException");
  }
  constructor(e) {
    super();
    this.cause = e;
  }
};
var InterpreterDataReader = class {
  static {
    __name(this, "InterpreterDataReader");
  }
  static parseInterpreterData(source) {
    const ruleNames = [];
    const channels = [];
    const modes = [];
    const literalNames = [];
    const symbolicNames = [];
    const lines = source.split(`
`);
    let index = 0;
    let line = lines[index++];
    if (line !== "token literal names:") {
      throw new Error("Unexpected data entry");
    }
    do {
      line = lines[index++];
      if (line.length === 0) {
        break;
      }
      literalNames.push(line === "null" ? null : line);
    } while (true);
    line = lines[index++];
    if (line !== "token symbolic names:") {
      throw new Error("Unexpected data entry");
    }
    do {
      line = lines[index++];
      if (line.length === 0) {
        break;
      }
      symbolicNames.push(line === "null" ? null : line);
    } while (true);
    line = lines[index++];
    if (line !== "rule names:") {
      throw new Error("Unexpected data entry");
    }
    do {
      line = lines[index++];
      if (line.length === 0) {
        break;
      }
      ruleNames.push(line);
    } while (true);
    line = lines[index++];
    if (line === "channel names:") {
      do {
        line = lines[index++];
        if (line.length === 0) {
          break;
        }
        channels.push(line);
      } while (true);
      line = lines[index++];
      if (line !== "mode names:") {
        throw new Error("Unexpected data entry");
      }
      do {
        line = lines[index++];
        if (line.length === 0) {
          break;
        }
        modes.push(line);
      } while (true);
    }
    line = lines[index++];
    if (line !== "atn:") {
      throw new Error("Unexpected data entry");
    }
    line = lines[index++];
    const elements = line.split(",");
    let value;
    const serializedATN = [];
    for (let i = 0;i < elements.length; ++i) {
      const element = elements[i];
      if (element.startsWith("[")) {
        value = Number(element.substring(1).trim());
      } else if (element.endsWith("]")) {
        value = Number(element.substring(0, element.length - 1).trim());
      } else {
        value = Number(element.trim());
      }
      serializedATN[i] = value;
    }
    const deserializer = new ATNDeserializer;
    return {
      atn: deserializer.deserialize(serializedATN),
      vocabulary: new Vocabulary(literalNames, symbolicNames, []),
      ruleNames,
      channels: channels.length > 0 ? channels : undefined,
      modes: modes.length > 0 ? modes : undefined
    };
  }
};
var AbstractParseTreeVisitor = class {
  static {
    __name(this, "AbstractParseTreeVisitor");
  }
  visit(tree) {
    return tree.accept(this);
  }
  visitChildren(node) {
    let result = this.defaultResult();
    const n2 = node.getChildCount();
    for (let i = 0;i < n2; i++) {
      if (!this.shouldVisitNextChild(node, result)) {
        break;
      }
      const c = node.getChild(i);
      if (c) {
        const childResult = c.accept(this);
        result = this.aggregateResult(result, childResult);
      }
    }
    return result;
  }
  visitTerminal(_node) {
    return this.defaultResult();
  }
  visitErrorNode(_node) {
    return this.defaultResult();
  }
  defaultResult() {
    return null;
  }
  shouldVisitNextChild(_node, _currentResult) {
    return true;
  }
  aggregateResult(aggregate, nextResult) {
    return nextResult;
  }
};
var ParseTreeWalker = class _ParseTreeWalker {
  static {
    __name(this, "ParseTreeWalker");
  }
  static DEFAULT = new _ParseTreeWalker;
  walk(listener, t) {
    const errorNode = t instanceof ErrorNode;
    if (errorNode) {
      listener.visitErrorNode(t);
    } else if (t instanceof TerminalNode) {
      listener.visitTerminal(t);
    } else {
      const r = t;
      this.enterRule(listener, r);
      for (let i = 0;i < t.getChildCount(); i++) {
        this.walk(listener, t.getChild(i));
      }
      this.exitRule(listener, r);
    }
  }
  enterRule(listener, r) {
    const ctx = r.ruleContext;
    listener.enterEveryRule(ctx);
    ctx.enterRule(listener);
  }
  exitRule(listener, r) {
    const ctx = r.ruleContext;
    ctx.exitRule(listener);
    listener.exitEveryRule(ctx);
  }
};
var CharStream;
((CharStream2) => {
  CharStream2.fromString = /* @__PURE__ */ __name((str) => {
    return new CharStreamImpl(str);
  }, "fromString");
})(CharStream || (CharStream = {}));
var CharStreamImpl = class {
  static {
    __name(this, "CharStreamImpl");
  }
  name = "";
  index = 0;
  data;
  constructor(input) {
    const codePoints = [];
    for (const char of input) {
      codePoints.push(char.codePointAt(0));
    }
    this.data = new Uint32Array(codePoints);
  }
  reset() {
    this.index = 0;
  }
  consume() {
    if (this.index >= this.data.length) {
      throw new Error("cannot consume EOF");
    }
    this.index += 1;
  }
  LA(offset) {
    if (offset === 0) {
      return 0;
    }
    if (offset < 0) {
      offset += 1;
    }
    const pos = this.index + offset - 1;
    if (pos < 0 || pos >= this.data.length) {
      return Token.EOF;
    }
    return this.data[pos];
  }
  mark() {
    return -1;
  }
  release(_marker) {}
  seek(index) {
    if (index <= this.index) {
      this.index = index;
      return;
    }
    this.index = Math.min(index, this.data.length);
  }
  getTextFromRange(start, stop) {
    stop = stop ?? this.data.length - 1;
    if (stop >= this.data.length) {
      stop = this.data.length - 1;
    }
    if (start >= this.data.length) {
      return "";
    }
    return this.stringFromRange(start, stop + 1);
  }
  getTextFromInterval(interval) {
    const start = interval.start;
    let stop = interval.stop;
    if (stop >= this.data.length) {
      stop = this.data.length - 1;
    }
    if (start >= this.data.length) {
      return "";
    }
    return this.stringFromRange(start, stop + 1);
  }
  toString() {
    return this.stringFromRange(0);
  }
  get size() {
    return this.data.length;
  }
  getSourceName() {
    if (this.name) {
      return this.name;
    }
    return IntStream.UNKNOWN_SOURCE_NAME;
  }
  stringFromRange(start, stop) {
    const data = this.data.slice(start, stop);
    let result = "";
    data.forEach((value) => {
      result += String.fromCodePoint(value);
    });
    return result;
  }
};
var isWritableToken = /* @__PURE__ */ __name((candidate) => {
  return candidate.setText !== undefined;
}, "isWritableToken");
var BufferedTokenStream = class {
  static {
    __name(this, "BufferedTokenStream");
  }
  tokenSource;
  tokens = [];
  p = -1;
  fetchedEOF = false;
  constructor(tokenSource) {
    this.tokenSource = tokenSource;
  }
  mark() {
    return 0;
  }
  release(_marker) {}
  reset() {
    this.seek(0);
  }
  seek(index) {
    this.lazyInit();
    this.p = this.adjustSeekIndex(index);
  }
  get size() {
    return this.tokens.length;
  }
  get index() {
    return this.p;
  }
  get(index) {
    this.lazyInit();
    return this.tokens[index];
  }
  consume() {
    let skipEofCheck = false;
    if (this.p >= 0) {
      if (this.fetchedEOF) {
        skipEofCheck = this.p < this.tokens.length - 1;
      } else {
        skipEofCheck = this.p < this.tokens.length;
      }
    } else {
      skipEofCheck = false;
    }
    if (!skipEofCheck && this.LA(1) === Token.EOF) {
      throw new Error("cannot consume EOF");
    }
    if (this.sync(this.p + 1)) {
      this.p = this.adjustSeekIndex(this.p + 1);
    }
  }
  sync(i) {
    const n2 = i - this.tokens.length + 1;
    if (n2 > 0) {
      const fetched = this.fetch(n2);
      return fetched >= n2;
    }
    return true;
  }
  fetch(n2) {
    if (this.fetchedEOF) {
      return 0;
    }
    for (let i = 0;i < n2; i++) {
      const t = this.tokenSource.nextToken();
      if (isWritableToken(t)) {
        t.tokenIndex = this.tokens.length;
      }
      this.tokens.push(t);
      if (t.type === Token.EOF) {
        this.fetchedEOF = true;
        return i + 1;
      }
    }
    return n2;
  }
  getTokens(start, stop, types) {
    this.lazyInit();
    if (start === undefined && stop === undefined) {
      return this.tokens;
    }
    start ??= 0;
    if (stop === undefined) {
      stop = this.tokens.length - 1;
    }
    if (start < 0 || stop >= this.tokens.length || stop < 0 || start >= this.tokens.length) {
      throw new RangeError("start " + start + " or stop " + stop + " not in 0.." + (this.tokens.length - 1));
    }
    if (start > stop) {
      return [];
    }
    if (types === undefined) {
      return this.tokens.slice(start, stop + 1);
    }
    const subset = [];
    if (stop >= this.tokens.length) {
      stop = this.tokens.length - 1;
    }
    for (let i = start;i < stop; i++) {
      const t = this.tokens[i];
      if (t.type === Token.EOF) {
        subset.push(t);
        break;
      }
      if (types.has(t.type)) {
        subset.push(t);
      }
    }
    return subset;
  }
  LA(k) {
    return this.LT(k)?.type ?? Token.INVALID_TYPE;
  }
  LB(k) {
    if (this.p - k < 0) {
      return null;
    }
    return this.tokens[this.p - k];
  }
  LT(k) {
    this.lazyInit();
    if (k === 0) {
      return null;
    }
    if (k < 0) {
      return this.LB(-k);
    }
    const i = this.p + k - 1;
    this.sync(i);
    if (i >= this.tokens.length) {
      return this.tokens[this.tokens.length - 1];
    }
    return this.tokens[i];
  }
  adjustSeekIndex(i) {
    return i;
  }
  lazyInit() {
    if (this.p === -1) {
      this.setup();
    }
  }
  setup() {
    this.sync(0);
    this.p = this.adjustSeekIndex(0);
  }
  setTokenSource(tokenSource) {
    this.tokenSource = tokenSource;
    this.tokens = [];
    this.p = -1;
    this.fetchedEOF = false;
  }
  nextTokenOnChannel(i, channel) {
    this.sync(i);
    if (i >= this.tokens.length) {
      return -1;
    }
    let token = this.tokens[i];
    while (token.channel !== channel) {
      if (token.type === Token.EOF) {
        return -1;
      }
      i += 1;
      this.sync(i);
      token = this.tokens[i];
    }
    return i;
  }
  previousTokenOnChannel(i, channel) {
    if (i >= this.tokens.length) {
      return this.tokens.length - 1;
    }
    while (i >= 0) {
      const token = this.tokens[i];
      if (token.type === Token.EOF || token.channel === channel) {
        return i;
      }
      --i;
    }
    return i;
  }
  getHiddenTokensToRight(tokenIndex, channel) {
    if (channel === undefined) {
      channel = -1;
    }
    this.lazyInit();
    if (tokenIndex < 0 || tokenIndex >= this.tokens.length) {
      throw new Error(`${tokenIndex} not in 0..${this.tokens.length - 1}`);
    }
    const nextOnChannel = this.nextTokenOnChannel(tokenIndex + 1, Lexer.DEFAULT_TOKEN_CHANNEL);
    const from = tokenIndex + 1;
    const to = nextOnChannel === -1 ? this.tokens.length - 1 : nextOnChannel;
    return this.filterForChannel(from, to, channel);
  }
  getHiddenTokensToLeft(tokenIndex, channel) {
    if (channel === undefined) {
      channel = -1;
    }
    this.lazyInit();
    if (tokenIndex < 0 || tokenIndex >= this.tokens.length) {
      throw new Error(`${tokenIndex} not in 0..${this.tokens.length - 1}`);
    }
    const prevOnChannel = this.previousTokenOnChannel(tokenIndex - 1, Lexer.DEFAULT_TOKEN_CHANNEL);
    if (prevOnChannel === tokenIndex - 1) {
      return;
    }
    const from = prevOnChannel + 1;
    const to = tokenIndex - 1;
    return this.filterForChannel(from, to, channel);
  }
  filterForChannel(left, right, channel) {
    const hidden = [];
    for (let i = left;i < right + 1; i++) {
      const t = this.tokens[i];
      if (channel === -1) {
        if (t.channel !== Lexer.DEFAULT_TOKEN_CHANNEL) {
          hidden.push(t);
        }
      } else if (t.channel === channel) {
        hidden.push(t);
      }
    }
    if (hidden.length === 0) {
      return;
    }
    return hidden;
  }
  getSourceName() {
    return this.tokenSource.sourceName;
  }
  getText() {
    return this.getTextFromInterval(Interval.of(0, this.size - 1));
  }
  getTextFromInterval(interval) {
    const start = interval.start;
    let stop = interval.stop;
    if (start < 0 || stop < 0) {
      return "";
    }
    this.sync(stop);
    if (stop >= this.tokens.length) {
      stop = this.tokens.length - 1;
    }
    let result = "";
    for (let i = start;i <= stop; ++i) {
      const t = this.tokens[i];
      if (t.type === Token.EOF) {
        break;
      }
      result += t.text;
    }
    return result;
  }
  getTextFromContext(ctx) {
    return this.getTextFromInterval(ctx.getSourceInterval());
  }
  getTextFromRange(start, stop) {
    if (start !== null && stop !== null) {
      return this.getTextFromInterval(Interval.of(start.tokenIndex, stop.tokenIndex));
    }
    return "";
  }
  fill() {
    this.lazyInit();
    while (this.fetch(1000) === 1000) {}
  }
  setLine(line) {
    this.tokenSource.line = line;
  }
  setColumn(column) {
    this.tokenSource.column = column;
  }
};
var CommonTokenStream = class extends BufferedTokenStream {
  static {
    __name(this, "CommonTokenStream");
  }
  channel = Token.DEFAULT_CHANNEL;
  constructor(lexer, channel) {
    super(lexer);
    this.channel = channel ?? Token.DEFAULT_CHANNEL;
  }
  adjustSeekIndex(i) {
    return this.nextTokenOnChannel(i, this.channel);
  }
  LB(k) {
    if (k === 0 || this.index - k < 0) {
      return null;
    }
    let i = this.index;
    let n2 = 1;
    while (n2 <= k) {
      i = this.previousTokenOnChannel(i - 1, this.channel);
      n2 += 1;
    }
    if (i < 0) {
      return null;
    }
    return this.tokens[i];
  }
  LT(k) {
    this.lazyInit();
    if (k === 0) {
      return null;
    }
    if (k < 0) {
      return this.LB(-k);
    }
    let i = this.index;
    let n2 = 1;
    while (n2 < k) {
      if (this.sync(i + 1)) {
        i = this.nextTokenOnChannel(i + 1, this.channel);
      }
      n2 += 1;
    }
    return this.tokens[i];
  }
  getNumberOfOnChannelTokens() {
    let n2 = 0;
    this.fill();
    for (const t of this.tokens) {
      if (t.channel === this.channel) {
        n2 += 1;
      }
      if (t.type === Token.EOF) {
        break;
      }
    }
    return n2;
  }
};
var XPathLexer = class _XPathLexer extends Lexer {
  static {
    __name(this, "XPathLexer");
  }
  static TOKEN_REF = 1;
  static RULE_REF = 2;
  static ANYWHERE = 3;
  static ROOT = 4;
  static WILDCARD = 5;
  static BANG = 6;
  static ID = 7;
  static STRING = 8;
  static channelNames = [
    "DEFAULT_TOKEN_CHANNEL",
    "HIDDEN"
  ];
  static literalNames = [
    null,
    null,
    null,
    "'//'",
    "'/'",
    "'*'",
    "'!'"
  ];
  static symbolicNames = [
    null,
    "TOKEN_REF",
    "RULE_REF",
    "ANYWHERE",
    "ROOT",
    "WILDCARD",
    "BANG",
    "ID",
    "STRING"
  ];
  static modeNames = [
    "DEFAULT_MODE"
  ];
  static ruleNames = [
    "ANYWHERE",
    "ROOT",
    "WILDCARD",
    "BANG",
    "ID",
    "NameChar",
    "NameStartChar",
    "STRING"
  ];
  constructor(input) {
    super(input);
    this.interpreter = new LexerATNSimulator(this, _XPathLexer._ATN, _XPathLexer.decisionsToDFA, new PredictionContextCache);
  }
  get grammarFileName() {
    return "XPathLexer.g4";
  }
  get literalNames() {
    return _XPathLexer.literalNames;
  }
  get symbolicNames() {
    return _XPathLexer.symbolicNames;
  }
  get ruleNames() {
    return _XPathLexer.ruleNames;
  }
  get serializedATN() {
    return _XPathLexer._serializedATN;
  }
  get channelNames() {
    return _XPathLexer.channelNames;
  }
  get modeNames() {
    return _XPathLexer.modeNames;
  }
  action(localContext, ruleIndex, actionIndex) {
    switch (ruleIndex) {
      case 4:
        this.ID_action(localContext, actionIndex);
        break;
    }
  }
  ID_action(localContext, actionIndex) {
    switch (actionIndex) {
      case 0:
        const text = this.text;
        if (text.charAt(0) === text.charAt(0).toUpperCase()) {
          this.type = _XPathLexer.TOKEN_REF;
        } else {
          this.type = _XPathLexer.RULE_REF;
        }
        break;
    }
  }
  static _serializedATN = [
    4,
    0,
    8,
    48,
    6,
    -1,
    2,
    0,
    7,
    0,
    2,
    1,
    7,
    1,
    2,
    2,
    7,
    2,
    2,
    3,
    7,
    3,
    2,
    4,
    7,
    4,
    2,
    5,
    7,
    5,
    2,
    6,
    7,
    6,
    2,
    7,
    7,
    7,
    1,
    0,
    1,
    0,
    1,
    0,
    1,
    1,
    1,
    1,
    1,
    2,
    1,
    2,
    1,
    3,
    1,
    3,
    1,
    4,
    1,
    4,
    5,
    4,
    29,
    8,
    4,
    10,
    4,
    12,
    4,
    32,
    9,
    4,
    1,
    4,
    1,
    4,
    1,
    5,
    1,
    5,
    1,
    6,
    1,
    6,
    1,
    7,
    1,
    7,
    5,
    7,
    42,
    8,
    7,
    10,
    7,
    12,
    7,
    45,
    9,
    7,
    1,
    7,
    1,
    7,
    1,
    43,
    0,
    8,
    1,
    3,
    3,
    4,
    5,
    5,
    7,
    6,
    9,
    7,
    11,
    0,
    13,
    0,
    15,
    8,
    1,
    0,
    2,
    784,
    0,
    0,
    8,
    14,
    27,
    48,
    57,
    65,
    90,
    95,
    95,
    97,
    122,
    127,
    159,
    170,
    170,
    173,
    173,
    181,
    181,
    186,
    186,
    192,
    214,
    216,
    246,
    248,
    705,
    710,
    721,
    736,
    740,
    748,
    748,
    750,
    750,
    768,
    884,
    886,
    887,
    890,
    893,
    895,
    895,
    902,
    902,
    904,
    906,
    908,
    908,
    910,
    929,
    931,
    1013,
    1015,
    1153,
    1155,
    1159,
    1162,
    1327,
    1329,
    1366,
    1369,
    1369,
    1376,
    1416,
    1425,
    1469,
    1471,
    1471,
    1473,
    1474,
    1476,
    1477,
    1479,
    1479,
    1488,
    1514,
    1519,
    1522,
    1536,
    1541,
    1552,
    1562,
    1564,
    1564,
    1568,
    1641,
    1646,
    1747,
    1749,
    1757,
    1759,
    1768,
    1770,
    1788,
    1791,
    1791,
    1807,
    1866,
    1869,
    1969,
    1984,
    2037,
    2042,
    2042,
    2045,
    2045,
    2048,
    2093,
    2112,
    2139,
    2144,
    2154,
    2160,
    2183,
    2185,
    2190,
    2192,
    2193,
    2200,
    2403,
    2406,
    2415,
    2417,
    2435,
    2437,
    2444,
    2447,
    2448,
    2451,
    2472,
    2474,
    2480,
    2482,
    2482,
    2486,
    2489,
    2492,
    2500,
    2503,
    2504,
    2507,
    2510,
    2519,
    2519,
    2524,
    2525,
    2527,
    2531,
    2534,
    2545,
    2556,
    2556,
    2558,
    2558,
    2561,
    2563,
    2565,
    2570,
    2575,
    2576,
    2579,
    2600,
    2602,
    2608,
    2610,
    2611,
    2613,
    2614,
    2616,
    2617,
    2620,
    2620,
    2622,
    2626,
    2631,
    2632,
    2635,
    2637,
    2641,
    2641,
    2649,
    2652,
    2654,
    2654,
    2662,
    2677,
    2689,
    2691,
    2693,
    2701,
    2703,
    2705,
    2707,
    2728,
    2730,
    2736,
    2738,
    2739,
    2741,
    2745,
    2748,
    2757,
    2759,
    2761,
    2763,
    2765,
    2768,
    2768,
    2784,
    2787,
    2790,
    2799,
    2809,
    2815,
    2817,
    2819,
    2821,
    2828,
    2831,
    2832,
    2835,
    2856,
    2858,
    2864,
    2866,
    2867,
    2869,
    2873,
    2876,
    2884,
    2887,
    2888,
    2891,
    2893,
    2901,
    2903,
    2908,
    2909,
    2911,
    2915,
    2918,
    2927,
    2929,
    2929,
    2946,
    2947,
    2949,
    2954,
    2958,
    2960,
    2962,
    2965,
    2969,
    2970,
    2972,
    2972,
    2974,
    2975,
    2979,
    2980,
    2984,
    2986,
    2990,
    3001,
    3006,
    3010,
    3014,
    3016,
    3018,
    3021,
    3024,
    3024,
    3031,
    3031,
    3046,
    3055,
    3072,
    3084,
    3086,
    3088,
    3090,
    3112,
    3114,
    3129,
    3132,
    3140,
    3142,
    3144,
    3146,
    3149,
    3157,
    3158,
    3160,
    3162,
    3165,
    3165,
    3168,
    3171,
    3174,
    3183,
    3200,
    3203,
    3205,
    3212,
    3214,
    3216,
    3218,
    3240,
    3242,
    3251,
    3253,
    3257,
    3260,
    3268,
    3270,
    3272,
    3274,
    3277,
    3285,
    3286,
    3293,
    3294,
    3296,
    3299,
    3302,
    3311,
    3313,
    3315,
    3328,
    3340,
    3342,
    3344,
    3346,
    3396,
    3398,
    3400,
    3402,
    3406,
    3412,
    3415,
    3423,
    3427,
    3430,
    3439,
    3450,
    3455,
    3457,
    3459,
    3461,
    3478,
    3482,
    3505,
    3507,
    3515,
    3517,
    3517,
    3520,
    3526,
    3530,
    3530,
    3535,
    3540,
    3542,
    3542,
    3544,
    3551,
    3558,
    3567,
    3570,
    3571,
    3585,
    3642,
    3648,
    3662,
    3664,
    3673,
    3713,
    3714,
    3716,
    3716,
    3718,
    3722,
    3724,
    3747,
    3749,
    3749,
    3751,
    3773,
    3776,
    3780,
    3782,
    3782,
    3784,
    3790,
    3792,
    3801,
    3804,
    3807,
    3840,
    3840,
    3864,
    3865,
    3872,
    3881,
    3893,
    3893,
    3895,
    3895,
    3897,
    3897,
    3902,
    3911,
    3913,
    3948,
    3953,
    3972,
    3974,
    3991,
    3993,
    4028,
    4038,
    4038,
    4096,
    4169,
    4176,
    4253,
    4256,
    4293,
    4295,
    4295,
    4301,
    4301,
    4304,
    4346,
    4348,
    4680,
    4682,
    4685,
    4688,
    4694,
    4696,
    4696,
    4698,
    4701,
    4704,
    4744,
    4746,
    4749,
    4752,
    4784,
    4786,
    4789,
    4792,
    4798,
    4800,
    4800,
    4802,
    4805,
    4808,
    4822,
    4824,
    4880,
    4882,
    4885,
    4888,
    4954,
    4957,
    4959,
    4992,
    5007,
    5024,
    5109,
    5112,
    5117,
    5121,
    5740,
    5743,
    5759,
    5761,
    5786,
    5792,
    5866,
    5870,
    5880,
    5888,
    5909,
    5919,
    5940,
    5952,
    5971,
    5984,
    5996,
    5998,
    6000,
    6002,
    6003,
    6016,
    6099,
    6103,
    6103,
    6108,
    6109,
    6112,
    6121,
    6155,
    6169,
    6176,
    6264,
    6272,
    6314,
    6320,
    6389,
    6400,
    6430,
    6432,
    6443,
    6448,
    6459,
    6470,
    6509,
    6512,
    6516,
    6528,
    6571,
    6576,
    6601,
    6608,
    6617,
    6656,
    6683,
    6688,
    6750,
    6752,
    6780,
    6783,
    6793,
    6800,
    6809,
    6823,
    6823,
    6832,
    6845,
    6847,
    6862,
    6912,
    6988,
    6992,
    7001,
    7019,
    7027,
    7040,
    7155,
    7168,
    7223,
    7232,
    7241,
    7245,
    7293,
    7296,
    7304,
    7312,
    7354,
    7357,
    7359,
    7376,
    7378,
    7380,
    7418,
    7424,
    7957,
    7960,
    7965,
    7968,
    8005,
    8008,
    8013,
    8016,
    8023,
    8025,
    8025,
    8027,
    8027,
    8029,
    8029,
    8031,
    8061,
    8064,
    8116,
    8118,
    8124,
    8126,
    8126,
    8130,
    8132,
    8134,
    8140,
    8144,
    8147,
    8150,
    8155,
    8160,
    8172,
    8178,
    8180,
    8182,
    8188,
    8203,
    8207,
    8234,
    8238,
    8255,
    8256,
    8276,
    8276,
    8288,
    8292,
    8294,
    8303,
    8305,
    8305,
    8319,
    8319,
    8336,
    8348,
    8400,
    8412,
    8417,
    8417,
    8421,
    8432,
    8450,
    8450,
    8455,
    8455,
    8458,
    8467,
    8469,
    8469,
    8473,
    8477,
    8484,
    8484,
    8486,
    8486,
    8488,
    8488,
    8490,
    8493,
    8495,
    8505,
    8508,
    8511,
    8517,
    8521,
    8526,
    8526,
    8544,
    8584,
    11264,
    11492,
    11499,
    11507,
    11520,
    11557,
    11559,
    11559,
    11565,
    11565,
    11568,
    11623,
    11631,
    11631,
    11647,
    11670,
    11680,
    11686,
    11688,
    11694,
    11696,
    11702,
    11704,
    11710,
    11712,
    11718,
    11720,
    11726,
    11728,
    11734,
    11736,
    11742,
    11744,
    11775,
    11823,
    11823,
    12293,
    12295,
    12321,
    12335,
    12337,
    12341,
    12344,
    12348,
    12353,
    12438,
    12441,
    12442,
    12445,
    12447,
    12449,
    12538,
    12540,
    12543,
    12549,
    12591,
    12593,
    12686,
    12704,
    12735,
    12784,
    12799,
    13312,
    19903,
    19968,
    42124,
    42192,
    42237,
    42240,
    42508,
    42512,
    42539,
    42560,
    42607,
    42612,
    42621,
    42623,
    42737,
    42775,
    42783,
    42786,
    42888,
    42891,
    42954,
    42960,
    42961,
    42963,
    42963,
    42965,
    42969,
    42994,
    43047,
    43052,
    43052,
    43072,
    43123,
    43136,
    43205,
    43216,
    43225,
    43232,
    43255,
    43259,
    43259,
    43261,
    43309,
    43312,
    43347,
    43360,
    43388,
    43392,
    43456,
    43471,
    43481,
    43488,
    43518,
    43520,
    43574,
    43584,
    43597,
    43600,
    43609,
    43616,
    43638,
    43642,
    43714,
    43739,
    43741,
    43744,
    43759,
    43762,
    43766,
    43777,
    43782,
    43785,
    43790,
    43793,
    43798,
    43808,
    43814,
    43816,
    43822,
    43824,
    43866,
    43868,
    43881,
    43888,
    44010,
    44012,
    44013,
    44016,
    44025,
    44032,
    55203,
    55216,
    55238,
    55243,
    55291,
    63744,
    64109,
    64112,
    64217,
    64256,
    64262,
    64275,
    64279,
    64285,
    64296,
    64298,
    64310,
    64312,
    64316,
    64318,
    64318,
    64320,
    64321,
    64323,
    64324,
    64326,
    64433,
    64467,
    64829,
    64848,
    64911,
    64914,
    64967,
    65008,
    65019,
    65024,
    65039,
    65056,
    65071,
    65075,
    65076,
    65101,
    65103,
    65136,
    65140,
    65142,
    65276,
    65279,
    65279,
    65296,
    65305,
    65313,
    65338,
    65343,
    65343,
    65345,
    65370,
    65382,
    65470,
    65474,
    65479,
    65482,
    65487,
    65490,
    65495,
    65498,
    65500,
    65529,
    65531,
    65536,
    65547,
    65549,
    65574,
    65576,
    65594,
    65596,
    65597,
    65599,
    65613,
    65616,
    65629,
    65664,
    65786,
    65856,
    65908,
    66045,
    66045,
    66176,
    66204,
    66208,
    66256,
    66272,
    66272,
    66304,
    66335,
    66349,
    66378,
    66384,
    66426,
    66432,
    66461,
    66464,
    66499,
    66504,
    66511,
    66513,
    66517,
    66560,
    66717,
    66720,
    66729,
    66736,
    66771,
    66776,
    66811,
    66816,
    66855,
    66864,
    66915,
    66928,
    66938,
    66940,
    66954,
    66956,
    66962,
    66964,
    66965,
    66967,
    66977,
    66979,
    66993,
    66995,
    67001,
    67003,
    67004,
    67072,
    67382,
    67392,
    67413,
    67424,
    67431,
    67456,
    67461,
    67463,
    67504,
    67506,
    67514,
    67584,
    67589,
    67592,
    67592,
    67594,
    67637,
    67639,
    67640,
    67644,
    67644,
    67647,
    67669,
    67680,
    67702,
    67712,
    67742,
    67808,
    67826,
    67828,
    67829,
    67840,
    67861,
    67872,
    67897,
    67968,
    68023,
    68030,
    68031,
    68096,
    68099,
    68101,
    68102,
    68108,
    68115,
    68117,
    68119,
    68121,
    68149,
    68152,
    68154,
    68159,
    68159,
    68192,
    68220,
    68224,
    68252,
    68288,
    68295,
    68297,
    68326,
    68352,
    68405,
    68416,
    68437,
    68448,
    68466,
    68480,
    68497,
    68608,
    68680,
    68736,
    68786,
    68800,
    68850,
    68864,
    68903,
    68912,
    68921,
    69248,
    69289,
    69291,
    69292,
    69296,
    69297,
    69373,
    69404,
    69415,
    69415,
    69424,
    69456,
    69488,
    69509,
    69552,
    69572,
    69600,
    69622,
    69632,
    69702,
    69734,
    69749,
    69759,
    69818,
    69821,
    69821,
    69826,
    69826,
    69837,
    69837,
    69840,
    69864,
    69872,
    69881,
    69888,
    69940,
    69942,
    69951,
    69956,
    69959,
    69968,
    70003,
    70006,
    70006,
    70016,
    70084,
    70089,
    70092,
    70094,
    70106,
    70108,
    70108,
    70144,
    70161,
    70163,
    70199,
    70206,
    70209,
    70272,
    70278,
    70280,
    70280,
    70282,
    70285,
    70287,
    70301,
    70303,
    70312,
    70320,
    70378,
    70384,
    70393,
    70400,
    70403,
    70405,
    70412,
    70415,
    70416,
    70419,
    70440,
    70442,
    70448,
    70450,
    70451,
    70453,
    70457,
    70459,
    70468,
    70471,
    70472,
    70475,
    70477,
    70480,
    70480,
    70487,
    70487,
    70493,
    70499,
    70502,
    70508,
    70512,
    70516,
    70656,
    70730,
    70736,
    70745,
    70750,
    70753,
    70784,
    70853,
    70855,
    70855,
    70864,
    70873,
    71040,
    71093,
    71096,
    71104,
    71128,
    71133,
    71168,
    71232,
    71236,
    71236,
    71248,
    71257,
    71296,
    71352,
    71360,
    71369,
    71424,
    71450,
    71453,
    71467,
    71472,
    71481,
    71488,
    71494,
    71680,
    71738,
    71840,
    71913,
    71935,
    71942,
    71945,
    71945,
    71948,
    71955,
    71957,
    71958,
    71960,
    71989,
    71991,
    71992,
    71995,
    72003,
    72016,
    72025,
    72096,
    72103,
    72106,
    72151,
    72154,
    72161,
    72163,
    72164,
    72192,
    72254,
    72263,
    72263,
    72272,
    72345,
    72349,
    72349,
    72368,
    72440,
    72704,
    72712,
    72714,
    72758,
    72760,
    72768,
    72784,
    72793,
    72818,
    72847,
    72850,
    72871,
    72873,
    72886,
    72960,
    72966,
    72968,
    72969,
    72971,
    73014,
    73018,
    73018,
    73020,
    73021,
    73023,
    73031,
    73040,
    73049,
    73056,
    73061,
    73063,
    73064,
    73066,
    73102,
    73104,
    73105,
    73107,
    73112,
    73120,
    73129,
    73440,
    73462,
    73472,
    73488,
    73490,
    73530,
    73534,
    73538,
    73552,
    73561,
    73648,
    73648,
    73728,
    74649,
    74752,
    74862,
    74880,
    75075,
    77712,
    77808,
    77824,
    78933,
    82944,
    83526,
    92160,
    92728,
    92736,
    92766,
    92768,
    92777,
    92784,
    92862,
    92864,
    92873,
    92880,
    92909,
    92912,
    92916,
    92928,
    92982,
    92992,
    92995,
    93008,
    93017,
    93027,
    93047,
    93053,
    93071,
    93760,
    93823,
    93952,
    94026,
    94031,
    94087,
    94095,
    94111,
    94176,
    94177,
    94179,
    94180,
    94192,
    94193,
    94208,
    100343,
    100352,
    101589,
    101632,
    101640,
    110576,
    110579,
    110581,
    110587,
    110589,
    110590,
    110592,
    110882,
    110898,
    110898,
    110928,
    110930,
    110933,
    110933,
    110948,
    110951,
    110960,
    111355,
    113664,
    113770,
    113776,
    113788,
    113792,
    113800,
    113808,
    113817,
    113821,
    113822,
    113824,
    113827,
    118528,
    118573,
    118576,
    118598,
    119141,
    119145,
    119149,
    119170,
    119173,
    119179,
    119210,
    119213,
    119362,
    119364,
    119808,
    119892,
    119894,
    119964,
    119966,
    119967,
    119970,
    119970,
    119973,
    119974,
    119977,
    119980,
    119982,
    119993,
    119995,
    119995,
    119997,
    120003,
    120005,
    120069,
    120071,
    120074,
    120077,
    120084,
    120086,
    120092,
    120094,
    120121,
    120123,
    120126,
    120128,
    120132,
    120134,
    120134,
    120138,
    120144,
    120146,
    120485,
    120488,
    120512,
    120514,
    120538,
    120540,
    120570,
    120572,
    120596,
    120598,
    120628,
    120630,
    120654,
    120656,
    120686,
    120688,
    120712,
    120714,
    120744,
    120746,
    120770,
    120772,
    120779,
    120782,
    120831,
    121344,
    121398,
    121403,
    121452,
    121461,
    121461,
    121476,
    121476,
    121499,
    121503,
    121505,
    121519,
    122624,
    122654,
    122661,
    122666,
    122880,
    122886,
    122888,
    122904,
    122907,
    122913,
    122915,
    122916,
    122918,
    122922,
    122928,
    122989,
    123023,
    123023,
    123136,
    123180,
    123184,
    123197,
    123200,
    123209,
    123214,
    123214,
    123536,
    123566,
    123584,
    123641,
    124112,
    124153,
    124896,
    124902,
    124904,
    124907,
    124909,
    124910,
    124912,
    124926,
    124928,
    125124,
    125136,
    125142,
    125184,
    125259,
    125264,
    125273,
    126464,
    126467,
    126469,
    126495,
    126497,
    126498,
    126500,
    126500,
    126503,
    126503,
    126505,
    126514,
    126516,
    126519,
    126521,
    126521,
    126523,
    126523,
    126530,
    126530,
    126535,
    126535,
    126537,
    126537,
    126539,
    126539,
    126541,
    126543,
    126545,
    126546,
    126548,
    126548,
    126551,
    126551,
    126553,
    126553,
    126555,
    126555,
    126557,
    126557,
    126559,
    126559,
    126561,
    126562,
    126564,
    126564,
    126567,
    126570,
    126572,
    126578,
    126580,
    126583,
    126585,
    126588,
    126590,
    126590,
    126592,
    126601,
    126603,
    126619,
    126625,
    126627,
    126629,
    126633,
    126635,
    126651,
    130032,
    130041,
    131072,
    173791,
    173824,
    177977,
    177984,
    178205,
    178208,
    183969,
    183984,
    191456,
    194560,
    195101,
    196608,
    201546,
    201552,
    205743,
    917505,
    917505,
    917536,
    917631,
    917760,
    917999,
    662,
    0,
    65,
    90,
    97,
    122,
    170,
    170,
    181,
    181,
    186,
    186,
    192,
    214,
    216,
    246,
    248,
    705,
    710,
    721,
    736,
    740,
    748,
    748,
    750,
    750,
    880,
    884,
    886,
    887,
    890,
    893,
    895,
    895,
    902,
    902,
    904,
    906,
    908,
    908,
    910,
    929,
    931,
    1013,
    1015,
    1153,
    1162,
    1327,
    1329,
    1366,
    1369,
    1369,
    1376,
    1416,
    1488,
    1514,
    1519,
    1522,
    1568,
    1610,
    1646,
    1647,
    1649,
    1747,
    1749,
    1749,
    1765,
    1766,
    1774,
    1775,
    1786,
    1788,
    1791,
    1791,
    1808,
    1808,
    1810,
    1839,
    1869,
    1957,
    1969,
    1969,
    1994,
    2026,
    2036,
    2037,
    2042,
    2042,
    2048,
    2069,
    2074,
    2074,
    2084,
    2084,
    2088,
    2088,
    2112,
    2136,
    2144,
    2154,
    2160,
    2183,
    2185,
    2190,
    2208,
    2249,
    2308,
    2361,
    2365,
    2365,
    2384,
    2384,
    2392,
    2401,
    2417,
    2432,
    2437,
    2444,
    2447,
    2448,
    2451,
    2472,
    2474,
    2480,
    2482,
    2482,
    2486,
    2489,
    2493,
    2493,
    2510,
    2510,
    2524,
    2525,
    2527,
    2529,
    2544,
    2545,
    2556,
    2556,
    2565,
    2570,
    2575,
    2576,
    2579,
    2600,
    2602,
    2608,
    2610,
    2611,
    2613,
    2614,
    2616,
    2617,
    2649,
    2652,
    2654,
    2654,
    2674,
    2676,
    2693,
    2701,
    2703,
    2705,
    2707,
    2728,
    2730,
    2736,
    2738,
    2739,
    2741,
    2745,
    2749,
    2749,
    2768,
    2768,
    2784,
    2785,
    2809,
    2809,
    2821,
    2828,
    2831,
    2832,
    2835,
    2856,
    2858,
    2864,
    2866,
    2867,
    2869,
    2873,
    2877,
    2877,
    2908,
    2909,
    2911,
    2913,
    2929,
    2929,
    2947,
    2947,
    2949,
    2954,
    2958,
    2960,
    2962,
    2965,
    2969,
    2970,
    2972,
    2972,
    2974,
    2975,
    2979,
    2980,
    2984,
    2986,
    2990,
    3001,
    3024,
    3024,
    3077,
    3084,
    3086,
    3088,
    3090,
    3112,
    3114,
    3129,
    3133,
    3133,
    3160,
    3162,
    3165,
    3165,
    3168,
    3169,
    3200,
    3200,
    3205,
    3212,
    3214,
    3216,
    3218,
    3240,
    3242,
    3251,
    3253,
    3257,
    3261,
    3261,
    3293,
    3294,
    3296,
    3297,
    3313,
    3314,
    3332,
    3340,
    3342,
    3344,
    3346,
    3386,
    3389,
    3389,
    3406,
    3406,
    3412,
    3414,
    3423,
    3425,
    3450,
    3455,
    3461,
    3478,
    3482,
    3505,
    3507,
    3515,
    3517,
    3517,
    3520,
    3526,
    3585,
    3632,
    3634,
    3635,
    3648,
    3654,
    3713,
    3714,
    3716,
    3716,
    3718,
    3722,
    3724,
    3747,
    3749,
    3749,
    3751,
    3760,
    3762,
    3763,
    3773,
    3773,
    3776,
    3780,
    3782,
    3782,
    3804,
    3807,
    3840,
    3840,
    3904,
    3911,
    3913,
    3948,
    3976,
    3980,
    4096,
    4138,
    4159,
    4159,
    4176,
    4181,
    4186,
    4189,
    4193,
    4193,
    4197,
    4198,
    4206,
    4208,
    4213,
    4225,
    4238,
    4238,
    4256,
    4293,
    4295,
    4295,
    4301,
    4301,
    4304,
    4346,
    4348,
    4680,
    4682,
    4685,
    4688,
    4694,
    4696,
    4696,
    4698,
    4701,
    4704,
    4744,
    4746,
    4749,
    4752,
    4784,
    4786,
    4789,
    4792,
    4798,
    4800,
    4800,
    4802,
    4805,
    4808,
    4822,
    4824,
    4880,
    4882,
    4885,
    4888,
    4954,
    4992,
    5007,
    5024,
    5109,
    5112,
    5117,
    5121,
    5740,
    5743,
    5759,
    5761,
    5786,
    5792,
    5866,
    5870,
    5880,
    5888,
    5905,
    5919,
    5937,
    5952,
    5969,
    5984,
    5996,
    5998,
    6000,
    6016,
    6067,
    6103,
    6103,
    6108,
    6108,
    6176,
    6264,
    6272,
    6276,
    6279,
    6312,
    6314,
    6314,
    6320,
    6389,
    6400,
    6430,
    6480,
    6509,
    6512,
    6516,
    6528,
    6571,
    6576,
    6601,
    6656,
    6678,
    6688,
    6740,
    6823,
    6823,
    6917,
    6963,
    6981,
    6988,
    7043,
    7072,
    7086,
    7087,
    7098,
    7141,
    7168,
    7203,
    7245,
    7247,
    7258,
    7293,
    7296,
    7304,
    7312,
    7354,
    7357,
    7359,
    7401,
    7404,
    7406,
    7411,
    7413,
    7414,
    7418,
    7418,
    7424,
    7615,
    7680,
    7957,
    7960,
    7965,
    7968,
    8005,
    8008,
    8013,
    8016,
    8023,
    8025,
    8025,
    8027,
    8027,
    8029,
    8029,
    8031,
    8061,
    8064,
    8116,
    8118,
    8124,
    8126,
    8126,
    8130,
    8132,
    8134,
    8140,
    8144,
    8147,
    8150,
    8155,
    8160,
    8172,
    8178,
    8180,
    8182,
    8188,
    8305,
    8305,
    8319,
    8319,
    8336,
    8348,
    8450,
    8450,
    8455,
    8455,
    8458,
    8467,
    8469,
    8469,
    8473,
    8477,
    8484,
    8484,
    8486,
    8486,
    8488,
    8488,
    8490,
    8493,
    8495,
    8505,
    8508,
    8511,
    8517,
    8521,
    8526,
    8526,
    8544,
    8584,
    11264,
    11492,
    11499,
    11502,
    11506,
    11507,
    11520,
    11557,
    11559,
    11559,
    11565,
    11565,
    11568,
    11623,
    11631,
    11631,
    11648,
    11670,
    11680,
    11686,
    11688,
    11694,
    11696,
    11702,
    11704,
    11710,
    11712,
    11718,
    11720,
    11726,
    11728,
    11734,
    11736,
    11742,
    11823,
    11823,
    12293,
    12295,
    12321,
    12329,
    12337,
    12341,
    12344,
    12348,
    12353,
    12438,
    12445,
    12447,
    12449,
    12538,
    12540,
    12543,
    12549,
    12591,
    12593,
    12686,
    12704,
    12735,
    12784,
    12799,
    13312,
    19903,
    19968,
    42124,
    42192,
    42237,
    42240,
    42508,
    42512,
    42527,
    42538,
    42539,
    42560,
    42606,
    42623,
    42653,
    42656,
    42735,
    42775,
    42783,
    42786,
    42888,
    42891,
    42954,
    42960,
    42961,
    42963,
    42963,
    42965,
    42969,
    42994,
    43009,
    43011,
    43013,
    43015,
    43018,
    43020,
    43042,
    43072,
    43123,
    43138,
    43187,
    43250,
    43255,
    43259,
    43259,
    43261,
    43262,
    43274,
    43301,
    43312,
    43334,
    43360,
    43388,
    43396,
    43442,
    43471,
    43471,
    43488,
    43492,
    43494,
    43503,
    43514,
    43518,
    43520,
    43560,
    43584,
    43586,
    43588,
    43595,
    43616,
    43638,
    43642,
    43642,
    43646,
    43695,
    43697,
    43697,
    43701,
    43702,
    43705,
    43709,
    43712,
    43712,
    43714,
    43714,
    43739,
    43741,
    43744,
    43754,
    43762,
    43764,
    43777,
    43782,
    43785,
    43790,
    43793,
    43798,
    43808,
    43814,
    43816,
    43822,
    43824,
    43866,
    43868,
    43881,
    43888,
    44002,
    44032,
    55203,
    55216,
    55238,
    55243,
    55291,
    63744,
    64109,
    64112,
    64217,
    64256,
    64262,
    64275,
    64279,
    64285,
    64285,
    64287,
    64296,
    64298,
    64310,
    64312,
    64316,
    64318,
    64318,
    64320,
    64321,
    64323,
    64324,
    64326,
    64433,
    64467,
    64829,
    64848,
    64911,
    64914,
    64967,
    65008,
    65019,
    65136,
    65140,
    65142,
    65276,
    65313,
    65338,
    65345,
    65370,
    65382,
    65470,
    65474,
    65479,
    65482,
    65487,
    65490,
    65495,
    65498,
    65500,
    65536,
    65547,
    65549,
    65574,
    65576,
    65594,
    65596,
    65597,
    65599,
    65613,
    65616,
    65629,
    65664,
    65786,
    65856,
    65908,
    66176,
    66204,
    66208,
    66256,
    66304,
    66335,
    66349,
    66378,
    66384,
    66421,
    66432,
    66461,
    66464,
    66499,
    66504,
    66511,
    66513,
    66517,
    66560,
    66717,
    66736,
    66771,
    66776,
    66811,
    66816,
    66855,
    66864,
    66915,
    66928,
    66938,
    66940,
    66954,
    66956,
    66962,
    66964,
    66965,
    66967,
    66977,
    66979,
    66993,
    66995,
    67001,
    67003,
    67004,
    67072,
    67382,
    67392,
    67413,
    67424,
    67431,
    67456,
    67461,
    67463,
    67504,
    67506,
    67514,
    67584,
    67589,
    67592,
    67592,
    67594,
    67637,
    67639,
    67640,
    67644,
    67644,
    67647,
    67669,
    67680,
    67702,
    67712,
    67742,
    67808,
    67826,
    67828,
    67829,
    67840,
    67861,
    67872,
    67897,
    67968,
    68023,
    68030,
    68031,
    68096,
    68096,
    68112,
    68115,
    68117,
    68119,
    68121,
    68149,
    68192,
    68220,
    68224,
    68252,
    68288,
    68295,
    68297,
    68324,
    68352,
    68405,
    68416,
    68437,
    68448,
    68466,
    68480,
    68497,
    68608,
    68680,
    68736,
    68786,
    68800,
    68850,
    68864,
    68899,
    69248,
    69289,
    69296,
    69297,
    69376,
    69404,
    69415,
    69415,
    69424,
    69445,
    69488,
    69505,
    69552,
    69572,
    69600,
    69622,
    69635,
    69687,
    69745,
    69746,
    69749,
    69749,
    69763,
    69807,
    69840,
    69864,
    69891,
    69926,
    69956,
    69956,
    69959,
    69959,
    69968,
    70002,
    70006,
    70006,
    70019,
    70066,
    70081,
    70084,
    70106,
    70106,
    70108,
    70108,
    70144,
    70161,
    70163,
    70187,
    70207,
    70208,
    70272,
    70278,
    70280,
    70280,
    70282,
    70285,
    70287,
    70301,
    70303,
    70312,
    70320,
    70366,
    70405,
    70412,
    70415,
    70416,
    70419,
    70440,
    70442,
    70448,
    70450,
    70451,
    70453,
    70457,
    70461,
    70461,
    70480,
    70480,
    70493,
    70497,
    70656,
    70708,
    70727,
    70730,
    70751,
    70753,
    70784,
    70831,
    70852,
    70853,
    70855,
    70855,
    71040,
    71086,
    71128,
    71131,
    71168,
    71215,
    71236,
    71236,
    71296,
    71338,
    71352,
    71352,
    71424,
    71450,
    71488,
    71494,
    71680,
    71723,
    71840,
    71903,
    71935,
    71942,
    71945,
    71945,
    71948,
    71955,
    71957,
    71958,
    71960,
    71983,
    71999,
    71999,
    72001,
    72001,
    72096,
    72103,
    72106,
    72144,
    72161,
    72161,
    72163,
    72163,
    72192,
    72192,
    72203,
    72242,
    72250,
    72250,
    72272,
    72272,
    72284,
    72329,
    72349,
    72349,
    72368,
    72440,
    72704,
    72712,
    72714,
    72750,
    72768,
    72768,
    72818,
    72847,
    72960,
    72966,
    72968,
    72969,
    72971,
    73008,
    73030,
    73030,
    73056,
    73061,
    73063,
    73064,
    73066,
    73097,
    73112,
    73112,
    73440,
    73458,
    73474,
    73474,
    73476,
    73488,
    73490,
    73523,
    73648,
    73648,
    73728,
    74649,
    74752,
    74862,
    74880,
    75075,
    77712,
    77808,
    77824,
    78895,
    78913,
    78918,
    82944,
    83526,
    92160,
    92728,
    92736,
    92766,
    92784,
    92862,
    92880,
    92909,
    92928,
    92975,
    92992,
    92995,
    93027,
    93047,
    93053,
    93071,
    93760,
    93823,
    93952,
    94026,
    94032,
    94032,
    94099,
    94111,
    94176,
    94177,
    94179,
    94179,
    94208,
    100343,
    100352,
    101589,
    101632,
    101640,
    110576,
    110579,
    110581,
    110587,
    110589,
    110590,
    110592,
    110882,
    110898,
    110898,
    110928,
    110930,
    110933,
    110933,
    110948,
    110951,
    110960,
    111355,
    113664,
    113770,
    113776,
    113788,
    113792,
    113800,
    113808,
    113817,
    119808,
    119892,
    119894,
    119964,
    119966,
    119967,
    119970,
    119970,
    119973,
    119974,
    119977,
    119980,
    119982,
    119993,
    119995,
    119995,
    119997,
    120003,
    120005,
    120069,
    120071,
    120074,
    120077,
    120084,
    120086,
    120092,
    120094,
    120121,
    120123,
    120126,
    120128,
    120132,
    120134,
    120134,
    120138,
    120144,
    120146,
    120485,
    120488,
    120512,
    120514,
    120538,
    120540,
    120570,
    120572,
    120596,
    120598,
    120628,
    120630,
    120654,
    120656,
    120686,
    120688,
    120712,
    120714,
    120744,
    120746,
    120770,
    120772,
    120779,
    122624,
    122654,
    122661,
    122666,
    122928,
    122989,
    123136,
    123180,
    123191,
    123197,
    123214,
    123214,
    123536,
    123565,
    123584,
    123627,
    124112,
    124139,
    124896,
    124902,
    124904,
    124907,
    124909,
    124910,
    124912,
    124926,
    124928,
    125124,
    125184,
    125251,
    125259,
    125259,
    126464,
    126467,
    126469,
    126495,
    126497,
    126498,
    126500,
    126500,
    126503,
    126503,
    126505,
    126514,
    126516,
    126519,
    126521,
    126521,
    126523,
    126523,
    126530,
    126530,
    126535,
    126535,
    126537,
    126537,
    126539,
    126539,
    126541,
    126543,
    126545,
    126546,
    126548,
    126548,
    126551,
    126551,
    126553,
    126553,
    126555,
    126555,
    126557,
    126557,
    126559,
    126559,
    126561,
    126562,
    126564,
    126564,
    126567,
    126570,
    126572,
    126578,
    126580,
    126583,
    126585,
    126588,
    126590,
    126590,
    126592,
    126601,
    126603,
    126619,
    126625,
    126627,
    126629,
    126633,
    126635,
    126651,
    131072,
    173791,
    173824,
    177977,
    177984,
    178205,
    178208,
    183969,
    183984,
    191456,
    194560,
    195101,
    196608,
    201546,
    201552,
    205743,
    47,
    0,
    1,
    1,
    0,
    0,
    0,
    0,
    3,
    1,
    0,
    0,
    0,
    0,
    5,
    1,
    0,
    0,
    0,
    0,
    7,
    1,
    0,
    0,
    0,
    0,
    9,
    1,
    0,
    0,
    0,
    0,
    15,
    1,
    0,
    0,
    0,
    1,
    17,
    1,
    0,
    0,
    0,
    3,
    20,
    1,
    0,
    0,
    0,
    5,
    22,
    1,
    0,
    0,
    0,
    7,
    24,
    1,
    0,
    0,
    0,
    9,
    26,
    1,
    0,
    0,
    0,
    11,
    35,
    1,
    0,
    0,
    0,
    13,
    37,
    1,
    0,
    0,
    0,
    15,
    39,
    1,
    0,
    0,
    0,
    17,
    18,
    5,
    47,
    0,
    0,
    18,
    19,
    5,
    47,
    0,
    0,
    19,
    2,
    1,
    0,
    0,
    0,
    20,
    21,
    5,
    47,
    0,
    0,
    21,
    4,
    1,
    0,
    0,
    0,
    22,
    23,
    5,
    42,
    0,
    0,
    23,
    6,
    1,
    0,
    0,
    0,
    24,
    25,
    5,
    33,
    0,
    0,
    25,
    8,
    1,
    0,
    0,
    0,
    26,
    30,
    3,
    13,
    6,
    0,
    27,
    29,
    3,
    11,
    5,
    0,
    28,
    27,
    1,
    0,
    0,
    0,
    29,
    32,
    1,
    0,
    0,
    0,
    30,
    28,
    1,
    0,
    0,
    0,
    30,
    31,
    1,
    0,
    0,
    0,
    31,
    33,
    1,
    0,
    0,
    0,
    32,
    30,
    1,
    0,
    0,
    0,
    33,
    34,
    6,
    4,
    0,
    0,
    34,
    10,
    1,
    0,
    0,
    0,
    35,
    36,
    7,
    0,
    0,
    0,
    36,
    12,
    1,
    0,
    0,
    0,
    37,
    38,
    7,
    1,
    0,
    0,
    38,
    14,
    1,
    0,
    0,
    0,
    39,
    43,
    5,
    39,
    0,
    0,
    40,
    42,
    9,
    0,
    0,
    0,
    41,
    40,
    1,
    0,
    0,
    0,
    42,
    45,
    1,
    0,
    0,
    0,
    43,
    44,
    1,
    0,
    0,
    0,
    43,
    41,
    1,
    0,
    0,
    0,
    44,
    46,
    1,
    0,
    0,
    0,
    45,
    43,
    1,
    0,
    0,
    0,
    46,
    47,
    5,
    39,
    0,
    0,
    47,
    16,
    1,
    0,
    0,
    0,
    3,
    0,
    30,
    43,
    1,
    1,
    4,
    0
  ];
  static __ATN;
  static get _ATN() {
    if (!_XPathLexer.__ATN) {
      _XPathLexer.__ATN = new ATNDeserializer().deserialize(_XPathLexer._serializedATN);
    }
    return _XPathLexer.__ATN;
  }
  static vocabulary = new Vocabulary(_XPathLexer.literalNames, _XPathLexer.symbolicNames, []);
  get vocabulary() {
    return _XPathLexer.vocabulary;
  }
  static decisionsToDFA = _XPathLexer._ATN.decisionToState.map((ds, index) => {
    return new DFA(ds, index);
  });
};
var XPathLexerErrorListener = class extends BaseErrorListener {
  static {
    __name(this, "XPathLexerErrorListener");
  }
  syntaxError(_recognizer, _offendingSymbol, _line, _charPositionInLine, _msg, _e) {}
};
var XPathElement = class {
  static {
    __name(this, "XPathElement");
  }
  invert;
  nodeName;
  constructor(nodeName) {
    this.nodeName = nodeName;
    this.invert = false;
  }
  toString() {
    const inv = this.invert ? "!" : "";
    return "XPathElement[" + inv + this.nodeName + "]";
  }
};
var XPathRuleAnywhereElement = class extends XPathElement {
  static {
    __name(this, "XPathRuleAnywhereElement");
  }
  ruleIndex;
  constructor(ruleName, ruleIndex) {
    super(ruleName);
    this.ruleIndex = ruleIndex;
  }
  evaluate(t) {
    return Trees.findAllRuleNodes(t, this.ruleIndex);
  }
  toString() {
    const inv = this.invert ? "!" : "";
    return "XPathRuleAnywhereElement[" + inv + this.nodeName + "]";
  }
};
var XPathRuleElement = class extends XPathElement {
  static {
    __name(this, "XPathRuleElement");
  }
  ruleIndex;
  constructor(ruleName, ruleIndex) {
    super(ruleName);
    this.ruleIndex = ruleIndex;
  }
  evaluate(t) {
    const nodes = [];
    for (const c of Trees.getChildren(t)) {
      if (c instanceof ParserRuleContext) {
        if (c.ruleIndex === this.ruleIndex && !this.invert || c.ruleIndex !== this.ruleIndex && this.invert) {
          nodes.push(c);
        }
      }
    }
    return nodes;
  }
  toString() {
    const inv = this.invert ? "!" : "";
    return "XPathRuleElement[" + inv + this.nodeName + "]";
  }
};
var XPathTokenAnywhereElement = class extends XPathElement {
  static {
    __name(this, "XPathTokenAnywhereElement");
  }
  tokenType;
  constructor(tokenName, tokenType) {
    super(tokenName);
    this.tokenType = tokenType;
  }
  evaluate(t) {
    return Trees.findAllTokenNodes(t, this.tokenType);
  }
  toString() {
    const inv = this.invert ? "!" : "";
    return "XPathTokenAnywhereElement[" + inv + this.nodeName + "]";
  }
};
var XPathTokenElement = class extends XPathElement {
  static {
    __name(this, "XPathTokenElement");
  }
  tokenType;
  constructor(tokenName, tokenType) {
    super(tokenName);
    this.tokenType = tokenType;
  }
  evaluate(t) {
    const nodes = [];
    for (const c of Trees.getChildren(t)) {
      if (c instanceof TerminalNode && c.symbol) {
        if (c.symbol.type === this.tokenType && !this.invert || c.symbol.type !== this.tokenType && this.invert) {
          nodes.push(c);
        }
      }
    }
    return nodes;
  }
  toString() {
    const inv = this.invert ? "!" : "";
    return "XPathTokenElement[" + inv + this.nodeName + "]";
  }
};
var XPathWildcardAnywhereElement = class extends XPathElement {
  static {
    __name(this, "XPathWildcardAnywhereElement");
  }
  constructor() {
    super(XPath.WILDCARD);
  }
  evaluate(t) {
    if (this.invert) {
      return [];
    }
    return Trees.descendants(t);
  }
  toString() {
    const inv = this.invert ? "!" : "";
    return "XPathWildcardAnywhereElement[" + inv + this.nodeName + "]";
  }
};
var XPathWildcardElement = class extends XPathElement {
  static {
    __name(this, "XPathWildcardElement");
  }
  constructor() {
    super(XPath.WILDCARD);
  }
  evaluate(t) {
    const kids = [];
    if (this.invert) {
      return kids;
    }
    for (const c of Trees.getChildren(t)) {
      kids.push(c);
    }
    return kids;
  }
  toString() {
    const inv = this.invert ? "!" : "";
    return "XPathWildcardElement[" + inv + this.nodeName + "]";
  }
};
var XPath = class _XPath {
  static {
    __name(this, "XPath");
  }
  static WILDCARD = "*";
  static NOT = "!";
  path;
  elements;
  parser;
  constructor(parser, path) {
    this.parser = parser;
    this.path = path;
    this.elements = this.split(path);
  }
  static findAll(tree, xpath, parser) {
    const p = new _XPath(parser, xpath);
    return p.evaluate(tree);
  }
  split(path) {
    const lexer = new XPathLexer(CharStream.fromString(path));
    lexer.recover = (e) => {
      throw e;
    };
    lexer.removeErrorListeners();
    lexer.addErrorListener(new XPathLexerErrorListener);
    const tokenStream = new CommonTokenStream(lexer);
    try {
      tokenStream.fill();
    } catch (e) {
      if (e instanceof LexerNoViableAltException) {
        const pos = lexer.column;
        const msg = "Invalid tokens or characters at index " + pos + " in path '" + path + "' -- " + e.message;
        throw new RangeError(msg);
      }
      throw e;
    }
    const tokens = tokenStream.getTokens();
    const elements = [];
    const n2 = tokens.length;
    let i = 0;
    loop:
      while (i < n2) {
        const el = tokens[i];
        let next;
        switch (el.type) {
          case XPathLexer.ROOT:
          case XPathLexer.ANYWHERE:
            const anywhere = el.type === XPathLexer.ANYWHERE;
            i++;
            next = tokens[i];
            const invert = next.type === XPathLexer.BANG;
            if (invert) {
              i++;
              next = tokens[i];
            }
            const pathElement = this.getXPathElement(next, anywhere);
            pathElement.invert = invert;
            elements.push(pathElement);
            i++;
            break;
          case XPathLexer.TOKEN_REF:
          case XPathLexer.RULE_REF:
          case XPathLexer.WILDCARD:
            elements.push(this.getXPathElement(el, false));
            ++i;
            break;
          case Token.EOF:
            break loop;
          default:
            throw new Error("Unknown path element " + el);
        }
      }
    return elements;
  }
  evaluate(t) {
    const dummyRoot = new ParserRuleContext(null);
    dummyRoot.addChild(t);
    let work = /* @__PURE__ */ new Set([dummyRoot]);
    let i = 0;
    while (i < this.elements.length) {
      const next = /* @__PURE__ */ new Set;
      for (const node of work) {
        if (node.getChildCount() > 0) {
          const matching = this.elements[i].evaluate(node);
          matching.forEach((tree) => {
            next.add(tree);
          }, next);
        }
      }
      i++;
      work = next;
    }
    return work;
  }
  getXPathElement(wordToken, anywhere) {
    if (wordToken.type === Token.EOF) {
      throw new Error("Missing path element at end of path");
    }
    const word = wordToken.text;
    if (word == null) {
      throw new Error("Expected wordToken to have text content.");
    }
    const ttype = this.parser.getTokenType(word);
    const ruleIndex = this.parser.getRuleIndex(word);
    switch (wordToken.type) {
      case XPathLexer.WILDCARD:
        return anywhere ? new XPathWildcardAnywhereElement : new XPathWildcardElement;
      case XPathLexer.TOKEN_REF:
      case XPathLexer.STRING:
        if (ttype === Token.INVALID_TYPE) {
          throw new Error(word + " at index " + wordToken.start + " isn't a valid token name");
        }
        return anywhere ? new XPathTokenAnywhereElement(word, ttype) : new XPathTokenElement(word, ttype);
      default:
        if (ruleIndex === -1) {
          throw new Error(word + " at index " + wordToken.start + " isn't a valid rule name");
        }
        return anywhere ? new XPathRuleAnywhereElement(word, ruleIndex) : new XPathRuleElement(word, ruleIndex);
    }
  }
};
var Chunk = class {
  static {
    __name(this, "Chunk");
  }
};
var ParseTreeMatch = class {
  static {
    __name(this, "ParseTreeMatch");
  }
  tree;
  pattern;
  labels;
  mismatchedNode;
  constructor(tree, pattern, labels, mismatchedNode) {
    this.tree = tree;
    this.pattern = pattern;
    this.labels = labels;
    this.mismatchedNode = mismatchedNode;
  }
  get(label) {
    const parseTrees = this.labels.get(label);
    if (!parseTrees || parseTrees.length === 0) {
      return null;
    }
    return parseTrees[parseTrees.length - 1];
  }
  getAll(label) {
    const nodes = this.labels.get(label);
    return nodes ?? [];
  }
  getLabels() {
    return this.labels;
  }
  getMismatchedNode() {
    return this.mismatchedNode;
  }
  succeeded() {
    return !this.mismatchedNode;
  }
  getPattern() {
    return this.pattern;
  }
  getTree() {
    return this.tree;
  }
  toString() {
    return `Match ${this.succeeded() ? "succeeded" : "failed"}; found ${this.getLabels().size} labels`;
  }
};
var ParseTreePattern = class {
  static {
    __name(this, "ParseTreePattern");
  }
  patternRuleIndex;
  pattern;
  patternTree;
  matcher;
  constructor(matcher, pattern, patternRuleIndex, patternTree) {
    this.matcher = matcher;
    this.patternRuleIndex = patternRuleIndex;
    this.pattern = pattern;
    this.patternTree = patternTree;
  }
  match(tree) {
    return this.matcher.match(tree, this);
  }
  matches(tree) {
    return this.matcher.match(tree, this).succeeded();
  }
  findAll(tree, xpath) {
    const subtrees = XPath.findAll(tree, xpath, this.matcher.getParser());
    const matches = new Array;
    for (const t of subtrees) {
      const match = this.match(t);
      if (match.succeeded()) {
        matches.push(match);
      }
    }
    return matches;
  }
  getMatcher() {
    return this.matcher;
  }
  getPattern() {
    return this.pattern;
  }
  getPatternRuleIndex() {
    return this.patternRuleIndex;
  }
  getPatternTree() {
    return this.patternTree;
  }
};
var InputMismatchException = class extends RecognitionException {
  static {
    __name(this, "InputMismatchException");
  }
  constructor(recognizer) {
    super({ message: "", recognizer, input: recognizer.inputStream, ctx: recognizer.context });
    this.offendingToken = recognizer.getCurrentToken();
  }
};
var FailedPredicateException = class extends RecognitionException {
  static {
    __name(this, "FailedPredicateException");
  }
  ruleIndex = 0;
  predicateIndex = 0;
  predicate;
  constructor(recognizer, predicate, message = null) {
    super({
      message: formatMessage(predicate ?? "no predicate", message ?? null),
      recognizer,
      input: recognizer.inputStream,
      ctx: recognizer.context
    });
    const s = recognizer.atn.states[recognizer.state];
    const trans = s.transitions[0];
    if (trans instanceof PredicateTransition) {
      this.ruleIndex = trans.ruleIndex;
      this.predicateIndex = trans.predIndex;
    } else {
      this.ruleIndex = 0;
      this.predicateIndex = 0;
    }
    this.predicate = predicate;
    this.offendingToken = recognizer.getCurrentToken();
  }
};
var formatMessage = /* @__PURE__ */ __name((predicate, message) => {
  if (message !== null) {
    return message;
  }
  return "failed predicate: {" + predicate + "}?";
}, "formatMessage");
var DefaultErrorStrategy = class {
  static {
    __name(this, "DefaultErrorStrategy");
  }
  errorRecoveryMode = false;
  lastErrorIndex = -1;
  lastErrorStates = new IntervalSet;
  nextTokensContext = null;
  nextTokenState = 0;
  reset(recognizer) {
    this.endErrorCondition(recognizer);
  }
  beginErrorCondition(_recognizer) {
    this.errorRecoveryMode = true;
  }
  inErrorRecoveryMode(_recognizer) {
    return this.errorRecoveryMode;
  }
  endErrorCondition(_recognizer) {
    this.errorRecoveryMode = false;
    this.lastErrorStates = new IntervalSet;
    this.lastErrorIndex = -1;
  }
  reportMatch(recognizer) {
    this.endErrorCondition(recognizer);
  }
  reportError(recognizer, e) {
    if (this.inErrorRecoveryMode(recognizer)) {
      return;
    }
    this.beginErrorCondition(recognizer);
    if (e instanceof NoViableAltException) {
      this.reportNoViableAlternative(recognizer, e);
    } else if (e instanceof InputMismatchException) {
      this.reportInputMismatch(recognizer, e);
    } else if (e instanceof FailedPredicateException) {
      this.reportFailedPredicate(recognizer, e);
    } else {
      recognizer.notifyErrorListeners(e.message, e.offendingToken, e);
    }
  }
  recover(recognizer, _e) {
    if (this.lastErrorIndex === recognizer.inputStream?.index && this.lastErrorStates.contains(recognizer.state)) {
      recognizer.consume();
    }
    this.lastErrorIndex = recognizer.inputStream?.index ?? 0;
    this.lastErrorStates.addOne(recognizer.state);
    const followSet = this.getErrorRecoverySet(recognizer);
    this.consumeUntil(recognizer, followSet);
  }
  sync(recognizer) {
    if (this.inErrorRecoveryMode(recognizer)) {
      return;
    }
    const s = recognizer.atn.states[recognizer.state];
    const la = recognizer.tokenStream.LA(1);
    const nextTokens = recognizer.atn.nextTokens(s);
    if (nextTokens.contains(la)) {
      this.nextTokensContext = null;
      this.nextTokenState = ATNState.INVALID_STATE_NUMBER;
      return;
    }
    if (nextTokens.contains(Token.EPSILON)) {
      if (this.nextTokensContext === null) {
        this.nextTokensContext = recognizer.context;
        this.nextTokenState = recognizer.state;
      }
      return;
    }
    switch (s.constructor.stateType) {
      case ATNState.BLOCK_START:
      case ATNState.STAR_BLOCK_START:
      case ATNState.PLUS_BLOCK_START:
      case ATNState.STAR_LOOP_ENTRY: {
        if (this.singleTokenDeletion(recognizer) !== null) {
          return;
        }
        throw new InputMismatchException(recognizer);
      }
      case ATNState.PLUS_LOOP_BACK:
      case ATNState.STAR_LOOP_BACK: {
        this.reportUnwantedToken(recognizer);
        const expecting = new IntervalSet;
        expecting.addSet(recognizer.getExpectedTokens());
        const whatFollowsLoopIterationOrRule = expecting.addSet(this.getErrorRecoverySet(recognizer));
        this.consumeUntil(recognizer, whatFollowsLoopIterationOrRule);
        break;
      }
      default:
    }
  }
  reportNoViableAlternative(recognizer, e) {
    if (e.message.length > 0) {
      recognizer.notifyErrorListeners(e.message, e.offendingToken, e);
      return;
    }
    const tokens = recognizer.tokenStream;
    let input;
    if (tokens !== null && e.startToken) {
      if (e.startToken.type === Token.EOF) {
        input = "<EOF>";
      } else {
        input = tokens.getTextFromRange(e.startToken, e.offendingToken);
      }
    } else {
      input = "<unknown input>";
    }
    const msg = "no viable alternative at input " + this.escapeWSAndQuote(input);
    recognizer.notifyErrorListeners(msg, e.offendingToken, e);
  }
  reportInputMismatch(recognizer, e) {
    if (e.message.length > 0) {
      recognizer.notifyErrorListeners(e.message, e.offendingToken, e);
      return;
    }
    const msg = "mismatched input " + this.getTokenErrorDisplay(e.offendingToken) + " expecting " + e.getExpectedTokens().toStringWithVocabulary(recognizer.vocabulary);
    recognizer.notifyErrorListeners(msg, e.offendingToken, e);
  }
  reportFailedPredicate(recognizer, e) {
    const ruleName = recognizer.ruleNames[recognizer.context.ruleIndex];
    const msg = "rule " + ruleName + " " + e.message;
    recognizer.notifyErrorListeners(msg, e.offendingToken, e);
  }
  reportUnwantedToken(recognizer) {
    if (this.inErrorRecoveryMode(recognizer)) {
      return;
    }
    this.beginErrorCondition(recognizer);
    const t = recognizer.getCurrentToken();
    const tokenName = this.getTokenErrorDisplay(t);
    const expecting = this.getExpectedTokens(recognizer);
    const msg = "extraneous input " + tokenName + " expecting " + expecting.toStringWithVocabulary(recognizer.vocabulary);
    recognizer.notifyErrorListeners(msg, t, null);
  }
  reportMissingToken(recognizer) {
    if (this.inErrorRecoveryMode(recognizer)) {
      return;
    }
    this.beginErrorCondition(recognizer);
    const t = recognizer.getCurrentToken();
    const expecting = this.getExpectedTokens(recognizer);
    const msg = "missing " + expecting.toStringWithVocabulary(recognizer.vocabulary) + " at " + this.getTokenErrorDisplay(t);
    recognizer.notifyErrorListeners(msg, t, null);
  }
  recoverInline(recognizer) {
    const matchedSymbol = this.singleTokenDeletion(recognizer);
    if (matchedSymbol) {
      recognizer.consume();
      return matchedSymbol;
    }
    if (this.singleTokenInsertion(recognizer)) {
      return this.getMissingSymbol(recognizer);
    }
    throw new InputMismatchException(recognizer);
  }
  singleTokenInsertion(recognizer) {
    const currentSymbolType = recognizer.tokenStream?.LA(1) ?? -1;
    const atn = recognizer.atn;
    const currentState = atn.states[recognizer.state];
    const next = currentState.transitions[0].target;
    const expectingAtLL2 = atn.nextTokens(next, recognizer.context ?? undefined);
    if (expectingAtLL2.contains(currentSymbolType)) {
      this.reportMissingToken(recognizer);
      return true;
    }
    return false;
  }
  singleTokenDeletion(recognizer) {
    const nextTokenType = recognizer.tokenStream?.LA(2) ?? -1;
    const expecting = this.getExpectedTokens(recognizer);
    if (expecting.contains(nextTokenType)) {
      this.reportUnwantedToken(recognizer);
      recognizer.consume();
      const matchedSymbol = recognizer.getCurrentToken();
      this.reportMatch(recognizer);
      return matchedSymbol;
    }
    return null;
  }
  getMissingSymbol(recognizer) {
    const currentSymbol = recognizer.getCurrentToken();
    const expecting = this.getExpectedTokens(recognizer);
    let expectedTokenType = Token.INVALID_TYPE;
    if (expecting.length !== 0) {
      expectedTokenType = expecting.minElement;
    }
    let tokenText;
    if (expectedTokenType === Token.EOF) {
      tokenText = "<missing EOF>";
    } else {
      tokenText = "<missing " + recognizer.vocabulary.getDisplayName(expectedTokenType) + ">";
    }
    let current = currentSymbol;
    const lookBack = recognizer.tokenStream?.LT(-1);
    if (current.type === Token.EOF && lookBack !== null) {
      current = lookBack;
    }
    return recognizer.getTokenFactory().create(current.source, expectedTokenType, tokenText, Token.DEFAULT_CHANNEL, -1, -1, current.line, current.column);
  }
  getExpectedTokens(recognizer) {
    return recognizer.getExpectedTokens();
  }
  getTokenErrorDisplay(t) {
    if (t === null) {
      return "<no token>";
    }
    let s = t.text;
    if (!s) {
      if (t.type === Token.EOF) {
        s = "<EOF>";
      } else {
        s = "<" + t.type + ">";
      }
    }
    return this.escapeWSAndQuote(s);
  }
  escapeWSAndQuote(s) {
    s = s.replace(/\n/g, "\\n");
    s = s.replace(/\r/g, "\\r");
    s = s.replace(/\t/g, "\\t");
    return "'" + s + "'";
  }
  getErrorRecoverySet(recognizer) {
    const atn = recognizer.atn;
    let ctx = recognizer.context;
    const recoverSet = new IntervalSet;
    while (ctx !== null && ctx.invokingState >= 0) {
      const invokingState = atn.states[ctx.invokingState];
      const rt = invokingState.transitions[0];
      const follow = atn.nextTokens(rt.followState);
      recoverSet.addSet(follow);
      ctx = ctx.parent;
    }
    recoverSet.removeOne(Token.EPSILON);
    return recoverSet;
  }
  consumeUntil(recognizer, set) {
    let ttype = recognizer.tokenStream?.LA(1) ?? -1;
    while (ttype !== Token.EOF && !set.contains(ttype)) {
      recognizer.consume();
      ttype = recognizer.tokenStream?.LA(1) ?? -1;
    }
  }
};
var BailErrorStrategy = class extends DefaultErrorStrategy {
  static {
    __name(this, "BailErrorStrategy");
  }
  recover(recognizer, e) {
    throw new ParseCancellationException(e);
  }
  recoverInline(recognizer) {
    const exception = new InputMismatchException(recognizer);
    throw new ParseCancellationException(exception);
  }
  sync(_recognizer) {}
};
var ListTokenSource = class {
  static {
    __name(this, "ListTokenSource");
  }
  sourceName;
  tokenFactory = CommonTokenFactory.DEFAULT;
  tokens = [];
  i = 0;
  eofToken = null;
  constructor(tokens, sourceName) {
    this.tokens = tokens;
    this.sourceName = sourceName ?? "";
  }
  get column() {
    if (this.i < this.tokens.length) {
      return this.tokens[this.i].column;
    }
    if (this.eofToken !== null) {
      return this.eofToken.column;
    }
    if (this.tokens.length > 0) {
      const lastToken = this.tokens[this.tokens.length - 1];
      const tokenText = lastToken.text;
      if (tokenText) {
        const lastNewLine = tokenText.lastIndexOf(`
`);
        if (lastNewLine >= 0) {
          return tokenText.length - lastNewLine - 1;
        }
      }
      return lastToken.column + lastToken.stop - lastToken.start + 1;
    }
    return 0;
  }
  nextToken() {
    if (this.i >= this.tokens.length) {
      if (this.eofToken === null) {
        let start = -1;
        if (this.tokens.length > 0) {
          const previousStop = this.tokens[this.tokens.length - 1].stop;
          if (previousStop !== -1) {
            start = previousStop + 1;
          }
        }
        const stop = Math.max(-1, start - 1);
        this.eofToken = this.tokenFactory.create([this, this.inputStream], Token.EOF, "EOF", Token.DEFAULT_CHANNEL, start, stop, this.line, this.column);
      }
      return this.eofToken;
    }
    const t = this.tokens[this.i];
    if (this.i === this.tokens.length - 1 && t.type === Token.EOF) {
      this.eofToken = t;
    }
    this.i++;
    return t;
  }
  get line() {
    if (this.i < this.tokens.length) {
      return this.tokens[this.i].line;
    }
    if (this.eofToken !== null) {
      return this.eofToken.line;
    }
    if (this.tokens.length > 0) {
      const lastToken = this.tokens[this.tokens.length - 1];
      let line = lastToken.line;
      const tokenText = lastToken.text;
      if (tokenText) {
        for (const char of tokenText) {
          if (char === `
`) {
            line++;
          }
        }
      }
      return line;
    }
    return 1;
  }
  get inputStream() {
    if (this.i < this.tokens.length) {
      return this.tokens[this.i].inputStream;
    }
    if (this.eofToken !== null) {
      return this.eofToken.inputStream;
    }
    if (this.tokens.length > 0) {
      return this.tokens[this.tokens.length - 1].inputStream;
    }
    return null;
  }
  getSourceName() {
    if (this.sourceName !== null) {
      return this.sourceName;
    }
    const inputStream = this.inputStream;
    if (inputStream !== null) {
      return inputStream.getSourceName();
    }
    return "List";
  }
};
var InterpreterRuleContext = class extends ParserRuleContext {
  static {
    __name(this, "InterpreterRuleContext");
  }
  #ruleIndex;
  constructor(ruleIndex, parent, invokingStateNumber) {
    super(parent, invokingStateNumber);
    this.#ruleIndex = ruleIndex;
  }
  get ruleIndex() {
    return this.#ruleIndex;
  }
};
var TraceListener = class {
  static {
    __name(this, "TraceListener");
  }
  parser;
  constructor(parser) {
    this.parser = parser;
  }
  enterEveryRule(ctx) {
    console.log("enter   " + this.parser.ruleNames[ctx.ruleIndex] + ", LT(1)=" + this.parser.inputStream?.LT(1)?.text);
  }
  visitTerminal(node) {
    console.log("consume " + node.getSymbol() + " rule " + this.parser.ruleNames[this.parser.context.ruleIndex]);
  }
  exitEveryRule(ctx) {
    console.log("exit    " + this.parser.ruleNames[ctx.ruleIndex] + ", LT(1)=" + this.parser.inputStream?.LT(1)?.text);
  }
  visitErrorNode(_node) {}
};
var Parser = class extends Recognizer {
  static {
    __name(this, "Parser");
  }
  printer = null;
  buildParseTrees = true;
  errorHandler = new DefaultErrorStrategy;
  context = null;
  precedenceStack = [];
  parseListeners = null;
  syntaxErrors = 0;
  matchedEOF = false;
  tracer = null;
  bypassAltsAtnCache = null;
  #inputStream;
  constructor(input) {
    super();
    this.precedenceStack.push(0);
    this.syntaxErrors = 0;
    this.#inputStream = input;
  }
  reset(rewindInputStream = true) {
    if (rewindInputStream) {
      this.inputStream.seek(0);
    }
    this.errorHandler.reset(this);
    this.context = null;
    this.syntaxErrors = 0;
    this.matchedEOF = false;
    this.setTrace(false);
    this.precedenceStack = [];
    this.precedenceStack.push(0);
    if (this.interpreter) {
      this.interpreter.reset();
    }
  }
  match(ttype) {
    let t = this.getCurrentToken();
    if (t.type === ttype) {
      if (ttype === Token.EOF) {
        this.matchedEOF = true;
      }
      this.errorHandler.reportMatch(this);
      this.consume();
    } else {
      t = this.errorHandler.recoverInline(this);
      if (this.buildParseTrees && t.tokenIndex === -1) {
        this.context.addErrorNode(this.createErrorNode(this.context, t));
      }
    }
    return t;
  }
  matchWildcard() {
    let t = this.getCurrentToken();
    if (t.type > 0) {
      this.errorHandler.reportMatch(this);
      this.consume();
    } else {
      t = this.errorHandler.recoverInline(this);
      if (this.buildParseTrees && t.tokenIndex === -1) {
        this.context.addErrorNode(this.createErrorNode(this.context, t));
      }
    }
    return t;
  }
  getParseListeners() {
    return this.parseListeners ?? [];
  }
  addParseListener(listener) {
    if (listener === null) {
      throw new Error("listener");
    }
    if (this.parseListeners === null) {
      this.parseListeners = [];
    }
    this.parseListeners.push(listener);
  }
  removeParseListener(listener) {
    if (this.parseListeners !== null && listener !== null) {
      const idx = this.parseListeners.indexOf(listener);
      if (idx >= 0) {
        this.parseListeners.splice(idx, 1);
      }
      if (this.parseListeners.length === 0) {
        this.parseListeners = null;
      }
    }
  }
  removeParseListeners() {
    this.parseListeners = null;
  }
  triggerEnterRuleEvent() {
    if (this.parseListeners !== null) {
      const ctx = this.context;
      this.parseListeners.forEach((listener) => {
        listener.enterEveryRule(ctx);
        ctx.enterRule(listener);
      });
    }
  }
  triggerExitRuleEvent() {
    if (this.parseListeners !== null) {
      const ctx = this.context;
      this.parseListeners.slice(0).reverse().forEach((listener) => {
        ctx.exitRule(listener);
        listener.exitEveryRule(ctx);
      });
    }
  }
  getTokenFactory() {
    return this.inputStream.tokenSource.tokenFactory;
  }
  setTokenFactory(factory) {
    this.inputStream.tokenSource.tokenFactory = factory;
  }
  compileParseTreePattern(pattern, patternRuleIndex, lexer) {
    if (!lexer) {
      if (this.tokenStream !== null) {
        const tokenSource = this.tokenStream.tokenSource;
        if (tokenSource instanceof Lexer) {
          lexer = tokenSource;
        }
      }
    }
    if (!lexer) {
      throw new Error("Parser can't discover a lexer to use");
    }
    const m2 = new ParseTreePatternMatcher(lexer, this);
    return m2.compile(pattern, patternRuleIndex);
  }
  getATNWithBypassAlts() {
    const serializedAtn = this.serializedATN;
    if (serializedAtn === null) {
      throw new Error("The current parser does not support an ATN with bypass alternatives.");
    }
    if (this.bypassAltsAtnCache !== null) {
      return this.bypassAltsAtnCache;
    }
    const deserializationOptions = { readOnly: false, verifyATN: true, generateRuleBypassTransitions: true };
    this.bypassAltsAtnCache = new ATNDeserializer(deserializationOptions).deserialize(serializedAtn);
    return this.bypassAltsAtnCache;
  }
  get numberOfSyntaxErrors() {
    return this.syntaxErrors;
  }
  get inputStream() {
    return this.#inputStream;
  }
  set inputStream(input) {
    this.tokenStream = input;
  }
  get tokenStream() {
    return this.#inputStream;
  }
  set tokenStream(input) {
    this.reset(false);
    this.#inputStream = input;
  }
  getCurrentToken() {
    return this.inputStream.LT(1);
  }
  notifyErrorListeners(msg, offendingToken, err) {
    offendingToken = offendingToken ?? null;
    err = err ?? null;
    if (offendingToken === null) {
      offendingToken = this.getCurrentToken();
    }
    this.syntaxErrors += 1;
    const line = offendingToken.line;
    const column = offendingToken.column;
    this.errorListenerDispatch.syntaxError(this, offendingToken, line, column, msg, err);
  }
  consume() {
    const o = this.getCurrentToken();
    if (o.type !== Token.EOF) {
      this.tokenStream.consume();
    }
    const hasListener = this.parseListeners !== null && this.parseListeners.length > 0;
    if (this.buildParseTrees || hasListener) {
      let node;
      if (this.errorHandler.inErrorRecoveryMode(this)) {
        node = this.context.addErrorNode(this.createErrorNode(this.context, o));
      } else {
        node = this.context.addTokenNode(o);
      }
      if (hasListener) {
        this.parseListeners.forEach((listener) => {
          if (node instanceof ErrorNode) {
            listener.visitErrorNode(node);
          } else {
            listener.visitTerminal(node);
          }
        });
      }
    }
    return o;
  }
  addContextToParseTree() {
    if (this.context?.parent) {
      this.context.parent.addChild(this.context);
    }
  }
  enterRule(localctx, state, _ruleIndex) {
    this.state = state;
    this.context = localctx;
    this.context.start = this.inputStream.LT(1);
    if (this.buildParseTrees) {
      this.addContextToParseTree();
    }
    this.triggerEnterRuleEvent();
  }
  exitRule() {
    if (this.matchedEOF) {
      this.context.stop = this.inputStream.LT(1);
    } else {
      this.context.stop = this.inputStream.LT(-1);
    }
    this.triggerExitRuleEvent();
    this.state = this.context.invokingState;
    this.context = this.context.parent;
  }
  enterOuterAlt(localctx, altNum) {
    localctx.setAltNumber(altNum);
    if (this.buildParseTrees && this.context !== localctx) {
      if (this.context?.parent) {
        this.context.parent.removeLastChild();
        this.context.parent.addChild(localctx);
      }
    }
    this.context = localctx;
  }
  getPrecedence() {
    if (this.precedenceStack.length === 0) {
      return -1;
    }
    return this.precedenceStack[this.precedenceStack.length - 1];
  }
  enterRecursionRule(localctx, state, ruleIndex, precedence) {
    this.state = state;
    this.precedenceStack.push(precedence);
    this.context = localctx;
    this.context.start = this.inputStream.LT(1);
    this.triggerEnterRuleEvent();
  }
  pushNewRecursionContext(localctx, state, _ruleIndex) {
    const previous = this.context;
    previous.parent = localctx;
    previous.invokingState = state;
    previous.stop = this.inputStream.LT(-1);
    this.context = localctx;
    this.context.start = previous.start;
    if (this.buildParseTrees) {
      this.context.addChild(previous);
    }
    this.triggerEnterRuleEvent();
  }
  unrollRecursionContexts(parent) {
    this.precedenceStack.pop();
    this.context.stop = this.inputStream.LT(-1);
    const retCtx = this.context;
    const parseListeners = this.getParseListeners();
    if (parseListeners !== null && parseListeners.length > 0) {
      while (this.context !== parent) {
        this.triggerExitRuleEvent();
        this.context = this.context.parent;
      }
    } else {
      this.context = parent;
    }
    retCtx.parent = parent;
    if (this.buildParseTrees && parent !== null) {
      parent.addChild(retCtx);
    }
  }
  getInvokingContext(ruleIndex) {
    let ctx = this.context;
    while (ctx !== null) {
      if (ctx.ruleIndex === ruleIndex) {
        return ctx;
      }
      ctx = ctx.parent;
    }
    return null;
  }
  precpred(_localctx, precedence) {
    return precedence >= this.precedenceStack[this.precedenceStack.length - 1];
  }
  isExpectedToken(symbol) {
    const atn = this.interpreter.atn;
    let ctx = this.context;
    const s = atn.states[this.state];
    let following = atn.nextTokens(s);
    if (following.contains(symbol)) {
      return true;
    }
    if (!following.contains(Token.EPSILON)) {
      return false;
    }
    while (ctx !== null && ctx.invokingState >= 0 && following.contains(Token.EPSILON)) {
      const invokingState = atn.states[ctx.invokingState];
      const rt = invokingState.transitions[0];
      following = atn.nextTokens(rt.followState);
      if (following.contains(symbol)) {
        return true;
      }
      ctx = ctx.parent;
    }
    if (following.contains(Token.EPSILON) && symbol === Token.EOF) {
      return true;
    } else {
      return false;
    }
  }
  getExpectedTokens() {
    return this.interpreter.atn.getExpectedTokens(this.state, this.context);
  }
  getExpectedTokensWithinCurrentRule() {
    const atn = this.interpreter.atn;
    const s = atn.states[this.state];
    return atn.nextTokens(s);
  }
  getRuleIndex(ruleName) {
    return this.getRuleIndexMap().get(ruleName) ?? -1;
  }
  getRuleInvocationStack(p) {
    p = p ?? null;
    if (p === null) {
      p = this.context;
    }
    const stack = [];
    while (p !== null) {
      const ruleIndex = p.ruleIndex;
      if (ruleIndex < 0) {
        stack.push("n/a");
      } else {
        stack.push(this.ruleNames[ruleIndex]);
      }
      p = p.parent;
    }
    return stack;
  }
  getDFAStrings() {
    return this.interpreter.decisionToDFA.toString();
  }
  dumpDFA() {
    let seenOne = false;
    for (const dfa of this.interpreter.decisionToDFA) {
      if (dfa.length > 0) {
        if (seenOne) {
          console.log();
        }
        if (this.printer) {
          this.printer.println("Decision " + dfa.decision + ":");
          this.printer.print(dfa.toString(this.vocabulary));
        }
        seenOne = true;
      }
    }
  }
  getSourceName() {
    return this.inputStream.getSourceName();
  }
  getParseInfo() {
    const interp = this.interpreter;
    if (interp instanceof ProfilingATNSimulator) {
      return new ParseInfo(interp);
    }
    return;
  }
  setProfile(profile) {
    const interp = this.interpreter;
    const saveMode = interp.predictionMode;
    if (profile) {
      if (!(interp instanceof ProfilingATNSimulator)) {
        this.interpreter = new ProfilingATNSimulator(this);
      }
    } else if (interp instanceof ProfilingATNSimulator) {
      const sharedContextCache = interp.sharedContextCache;
      if (sharedContextCache) {
        const sim = new ParserATNSimulator(this, this.atn, interp.decisionToDFA, sharedContextCache);
        this.interpreter = sim;
      }
    }
    this.interpreter.predictionMode = saveMode;
  }
  setTrace(trace) {
    if (!trace) {
      this.removeParseListener(this.tracer);
      this.tracer = null;
    } else {
      if (this.tracer !== null) {
        this.removeParseListener(this.tracer);
      }
      this.tracer = new TraceListener(this);
      this.addParseListener(this.tracer);
    }
  }
  createTerminalNode(parent, t) {
    return new TerminalNode(t);
  }
  createErrorNode(parent, t) {
    return new ErrorNode(t);
  }
};
var ParserInterpreter = class extends Parser {
  static {
    __name(this, "ParserInterpreter");
  }
  rootContext;
  overrideDecisionRoot = null;
  parentContextStack = [];
  overrideDecisionAlt = -1;
  overrideDecisionReached = false;
  decisionToDFA;
  sharedContextCache = new PredictionContextCache;
  pushRecursionContextStates;
  #overrideDecision = -1;
  #overrideDecisionInputIndex = -1;
  #grammarFileName;
  #atn;
  #ruleNames;
  #vocabulary;
  constructor(grammarFileName, vocabulary, ruleNames, atn, input) {
    super(input);
    this.#grammarFileName = grammarFileName;
    this.#atn = atn;
    this.#ruleNames = ruleNames.slice(0);
    this.#vocabulary = vocabulary;
    this.pushRecursionContextStates = new BitSet;
    for (const state of atn.states) {
      if (state instanceof StarLoopEntryState && state.precedenceRuleDecision) {
        this.pushRecursionContextStates.set(state.stateNumber);
      }
    }
    this.decisionToDFA = atn.decisionToState.map((ds, i) => {
      return new DFA(ds, i);
    });
    this.interpreter = new ParserATNSimulator(this, atn, this.decisionToDFA, this.sharedContextCache);
  }
  reset() {
    super.reset();
    this.overrideDecisionReached = false;
    this.overrideDecisionRoot = null;
  }
  get atn() {
    return this.#atn;
  }
  get vocabulary() {
    return this.#vocabulary;
  }
  get ruleNames() {
    return this.#ruleNames;
  }
  get grammarFileName() {
    return this.#grammarFileName;
  }
  get atnState() {
    return this.#atn.states[this.state];
  }
  parse(startRuleIndex) {
    const startRuleStartState = this.#atn.ruleToStartState[startRuleIndex];
    this.rootContext = this.createInterpreterRuleContext(null, ATNState.INVALID_STATE_NUMBER, startRuleIndex);
    if (startRuleStartState.isLeftRecursiveRule) {
      this.enterRecursionRule(this.rootContext, startRuleStartState.stateNumber, startRuleIndex, 0);
    } else {
      this.enterRule(this.rootContext, startRuleStartState.stateNumber, startRuleIndex);
    }
    while (true) {
      const p = this.atnState;
      switch (p.constructor.stateType) {
        case ATNState.RULE_STOP: {
          if (this.context?.isEmpty()) {
            if (startRuleStartState.isLeftRecursiveRule) {
              const result = this.context;
              const parentContext = this.parentContextStack.pop();
              this.unrollRecursionContexts(parentContext[0]);
              return result;
            } else {
              this.exitRule();
              return this.rootContext;
            }
          }
          this.visitRuleStopState(p);
          break;
        }
        default: {
          try {
            this.visitState(p);
          } catch (e) {
            if (e instanceof RecognitionException) {
              this.state = this.#atn.ruleToStopState[p.ruleIndex].stateNumber;
              this.errorHandler.reportError(this, e);
              this.recover(e);
            } else {
              throw e;
            }
          }
          break;
        }
      }
    }
  }
  addDecisionOverride(decision, tokenIndex, forcedAlt) {
    this.#overrideDecision = decision;
    this.#overrideDecisionInputIndex = tokenIndex;
    this.overrideDecisionAlt = forcedAlt;
  }
  get overrideDecision() {
    return this.#overrideDecision;
  }
  get overrideDecisionInputIndex() {
    return this.#overrideDecisionInputIndex;
  }
  enterRecursionRule(localctx, state, ruleIndex, precedence) {
    this.parentContextStack.push([this.context, localctx.invokingState]);
    super.enterRecursionRule(localctx, state, ruleIndex, precedence);
  }
  get serializedATN() {
    throw new Error("The ParserInterpreter does not support the serializedATN property.");
  }
  visitState(p) {
    let predictedAlt = 1;
    if (p instanceof DecisionState) {
      predictedAlt = this.visitDecisionState(p);
    }
    const transition = p.transitions[predictedAlt - 1];
    switch (transition.transitionType) {
      case Transition.EPSILON:
        if (this.pushRecursionContextStates.get(p.stateNumber) && !(transition.target.constructor.stateType === ATNState.LOOP_END)) {
          const parentContext = this.parentContextStack[this.parentContextStack.length - 1];
          const localctx = this.createInterpreterRuleContext(parentContext[0], parentContext[1], this.context.ruleIndex);
          this.pushNewRecursionContext(localctx, this.#atn.ruleToStartState[p.ruleIndex].stateNumber, this.context.ruleIndex);
        }
        break;
      case Transition.ATOM:
        this.match(transition.label.minElement);
        break;
      case Transition.RANGE:
      case Transition.SET:
      case Transition.NOT_SET:
        if (!transition.matches(this.inputStream.LA(1), Token.MIN_USER_TOKEN_TYPE, 65535)) {
          this.recoverInline();
        }
        this.matchWildcard();
        break;
      case Transition.WILDCARD:
        this.matchWildcard();
        break;
      case Transition.RULE:
        const ruleStartState = transition.target;
        const ruleIndex = ruleStartState.ruleIndex;
        const newContext = this.createInterpreterRuleContext(this.context, p.stateNumber, ruleIndex);
        if (ruleStartState.isLeftRecursiveRule) {
          this.enterRecursionRule(newContext, ruleStartState.stateNumber, ruleIndex, transition.precedence);
        } else {
          this.enterRule(newContext, transition.target.stateNumber, ruleIndex);
        }
        break;
      case Transition.PREDICATE:
        const predicateTransition = transition;
        if (!this.sempred(this.context, predicateTransition.ruleIndex, predicateTransition.predIndex)) {
          throw new FailedPredicateException(this);
        }
        break;
      case Transition.ACTION:
        const actionTransition = transition;
        this.action(this.context, actionTransition.ruleIndex, actionTransition.actionIndex);
        break;
      case Transition.PRECEDENCE:
        if (!this.precpred(this.context, transition.precedence)) {
          const precedence = transition.precedence;
          throw new FailedPredicateException(this, `precpred(_ctx, ${precedence})`);
        }
        break;
      default:
        throw new Error("UnsupportedOperationException: Unrecognized ATN transition type.");
    }
    this.state = transition.target.stateNumber;
  }
  visitDecisionState(p) {
    let predictedAlt = 1;
    if (p.transitions.length > 1) {
      this.errorHandler.sync(this);
      const decision = p.decision;
      if (decision === this.#overrideDecision && this.inputStream.index === this.#overrideDecisionInputIndex && !this.overrideDecisionReached) {
        predictedAlt = this.overrideDecisionAlt;
        this.overrideDecisionReached = true;
      } else {
        predictedAlt = this.interpreter.adaptivePredict(this.inputStream, decision, this.context);
      }
    }
    return predictedAlt;
  }
  createInterpreterRuleContext(parent, invokingStateNumber, ruleIndex) {
    return new InterpreterRuleContext(ruleIndex, parent, invokingStateNumber);
  }
  visitRuleStopState(p) {
    const ruleStartState = this.#atn.ruleToStartState[p.ruleIndex];
    if (ruleStartState.isLeftRecursiveRule) {
      const [parentContext, state] = this.parentContextStack.pop();
      this.unrollRecursionContexts(parentContext);
      this.state = state;
    } else {
      this.exitRule();
    }
    const ruleTransition = this.#atn.states[this.state].transitions[0];
    this.state = ruleTransition.followState.stateNumber;
  }
  recover(e) {
    const i = this.inputStream.index;
    this.errorHandler.recover(this, e);
    if (this.inputStream.index === i) {
      const tok = e.offendingToken;
      if (!tok) {
        throw new Error("Expected exception to have an offending token");
      }
      const source = tok.tokenSource;
      const stream = source?.inputStream ?? null;
      const sourcePair = [source, stream];
      if (e instanceof InputMismatchException) {
        const expectedTokens = e.getExpectedTokens();
        if (!expectedTokens) {
          throw new Error("Expected the exception to provide expected tokens");
        }
        let expectedTokenType = Token.INVALID_TYPE;
        if (expectedTokens.length !== 0) {
          expectedTokenType = expectedTokens.minElement;
        }
        const errToken = this.getTokenFactory().create(sourcePair, expectedTokenType, tok.text, Token.DEFAULT_CHANNEL, -1, -1, tok.line, tok.column);
        this.context.addErrorNode(this.createErrorNode(this.context, errToken));
      } else {
        const errToken = this.getTokenFactory().create(sourcePair, Token.INVALID_TYPE, tok.text, Token.DEFAULT_CHANNEL, -1, -1, tok.line, tok.column);
        this.context.addErrorNode(this.createErrorNode(this.context, errToken));
      }
    }
  }
  recoverInline() {
    return this.errorHandler.recoverInline(this);
  }
};
var MultiMap = class extends Map {
  static {
    __name(this, "MultiMap");
  }
  map(key, value) {
    let elementsForKey = this.get(key);
    if (!elementsForKey) {
      elementsForKey = new Array;
      this.set(key, elementsForKey);
    }
    elementsForKey.push(value);
  }
  getPairs() {
    const pairs = new Array;
    for (const key of this.keys()) {
      const keys = this.get(key) ?? [];
      for (const value of keys) {
        pairs.push([key, value]);
      }
    }
    return pairs;
  }
  toString() {
    const entries = [];
    this.forEach((value, key) => {
      entries.push(`${key}=[${value.join(", ")}]`);
    });
    return `{${entries.join(", ")}}`;
  }
};
var CannotInvokeStartRuleError = class extends Error {
  static {
    __name(this, "CannotInvokeStartRuleError");
  }
  constructor(e) {
    super();
    this.cause = e;
  }
};
var RuleTagToken = class {
  static {
    __name(this, "RuleTagToken");
  }
  label;
  ruleName;
  bypassTokenType;
  constructor(ruleName, bypassTokenType, label) {
    this.ruleName = ruleName;
    this.bypassTokenType = bypassTokenType;
    this.label = label;
  }
  get channel() {
    return Token.DEFAULT_CHANNEL;
  }
  get text() {
    if (this.label !== undefined) {
      return "<" + this.label + ":" + this.ruleName + ">";
    }
    return "<" + this.ruleName + ">";
  }
  get type() {
    return this.bypassTokenType;
  }
  get line() {
    return 0;
  }
  get column() {
    return -1;
  }
  get tokenIndex() {
    return -1;
  }
  get start() {
    return -1;
  }
  get stop() {
    return -1;
  }
  get tokenSource() {
    return null;
  }
  get inputStream() {
    return null;
  }
  toString() {
    return this.ruleName + ":" + this.bypassTokenType;
  }
};
var StartRuleDoesNotConsumeFullPatternError = class extends Error {
  static {
    __name(this, "StartRuleDoesNotConsumeFullPatternError");
  }
};
var TagChunk = class extends Chunk {
  static {
    __name(this, "TagChunk");
  }
  tag;
  label;
  constructor(...args) {
    let label;
    let tag;
    if (args.length === 1) {
      tag = args[0];
    } else {
      label = args[0];
      tag = args[1];
    }
    super();
    if (!tag) {
      throw new Error("tag cannot be null or empty");
    }
    this.label = label;
    this.tag = tag;
  }
  toString() {
    if (this.label !== undefined) {
      return this.label + ":" + this.tag;
    }
    return this.tag;
  }
};
var TextChunk = class extends Chunk {
  static {
    __name(this, "TextChunk");
  }
  text;
  constructor(text) {
    super();
    this.text = text;
  }
  toString() {
    return "'" + this.text + "'";
  }
};
var TokenTagToken = class extends CommonToken {
  static {
    __name(this, "TokenTagToken");
  }
  tokenName;
  label;
  constructor(tokenName, type, label) {
    super({ type, source: CommonToken.EMPTY_SOURCE });
    this.tokenName = tokenName;
    this.label = label;
  }
  get text() {
    if (this.label !== undefined) {
      return "<" + this.label + ":" + this.tokenName + ">";
    }
    return "<" + this.tokenName + ">";
  }
  toString() {
    return this.tokenName + ":" + this.type;
  }
};
var ParseTreePatternMatcher = class {
  static {
    __name(this, "ParseTreePatternMatcher");
  }
  start = "<";
  stop = ">";
  escape = "\\";
  lexer;
  parser;
  constructor(lexer, parser) {
    this.lexer = lexer;
    this.parser = parser;
  }
  setDelimiters(start, stop, escapeLeft) {
    if (start === null || start.length === 0) {
      throw new Error("start cannot be null or empty");
    }
    if (stop === null || stop.length === 0) {
      throw new Error("stop cannot be null or empty");
    }
    this.start = start;
    this.stop = stop;
    this.escape = escapeLeft;
  }
  matches(...args) {
    switch (args.length) {
      case 2: {
        const [tree, pattern] = args;
        const labels = new MultiMap;
        const mismatchedNode = this.matchImpl(tree, pattern.getPatternTree(), labels);
        return mismatchedNode === null;
      }
      case 3: {
        const [tree, pattern, patternRuleIndex] = args;
        const p = this.compile(pattern, patternRuleIndex);
        return this.matches(tree, p);
      }
      default: {
        throw new Error("Invalid number of arguments");
      }
    }
  }
  match(...args) {
    switch (args.length) {
      case 2: {
        const [tree, pattern] = args;
        const labels = new MultiMap;
        const mismatchedNode = this.matchImpl(tree, pattern.getPatternTree(), labels);
        return new ParseTreeMatch(tree, pattern, labels, mismatchedNode);
      }
      case 3: {
        const [tree, pattern, patternRuleIndex] = args;
        const p = this.compile(pattern, patternRuleIndex);
        return this.match(tree, p);
      }
      default: {
        throw new Error("Invalid number of arguments");
      }
    }
  }
  compile(pattern, patternRuleIndex) {
    const tokenList = this.tokenize(pattern);
    const tokenSrc = new ListTokenSource(tokenList);
    const tokens = new CommonTokenStream(tokenSrc);
    const parserInterp = new ParserInterpreter(this.parser.grammarFileName, this.parser.vocabulary, this.parser.ruleNames, this.parser.getATNWithBypassAlts(), tokens);
    parserInterp.removeErrorListeners();
    let tree = null;
    try {
      parserInterp.errorHandler = new BailErrorStrategy;
      tree = parserInterp.parse(patternRuleIndex);
    } catch (error) {
      if (error instanceof ParseCancellationException) {
        throw error.cause;
      } else if (error instanceof RecognitionException) {
        throw error;
      } else if (error instanceof Error) {
        throw new CannotInvokeStartRuleError(error);
      } else {
        throw error;
      }
    }
    if (tokens.LA(1) !== Token.EOF) {
      throw new StartRuleDoesNotConsumeFullPatternError;
    }
    return new ParseTreePattern(this, pattern, patternRuleIndex, tree);
  }
  getLexer() {
    return this.lexer;
  }
  getParser() {
    return this.parser;
  }
  tokenize(pattern) {
    const chunks = this.split(pattern);
    const tokens = new Array;
    for (const chunk of chunks) {
      if (chunk instanceof TagChunk) {
        const tagChunk = chunk;
        const char = tagChunk.tag[0];
        if (char === char.toUpperCase()) {
          const ttype = this.parser.getTokenType(tagChunk.tag);
          if (ttype === Token.INVALID_TYPE) {
            throw new Error("Unknown token " + tagChunk.tag + " in pattern: " + pattern);
          }
          const t = new TokenTagToken(tagChunk.tag, ttype, tagChunk.label);
          tokens.push(t);
        } else {
          if (char === char.toLowerCase()) {
            const ruleIndex = this.parser.getRuleIndex(tagChunk.tag);
            if (ruleIndex === -1) {
              throw new Error("Unknown rule " + tagChunk.tag + " in pattern: " + pattern);
            }
            const ruleImaginaryTokenType = this.parser.getATNWithBypassAlts().ruleToTokenType[ruleIndex];
            tokens.push(new RuleTagToken(tagChunk.tag, ruleImaginaryTokenType, tagChunk.label));
          } else {
            throw new Error("invalid tag: " + tagChunk.tag + " in pattern: " + pattern);
          }
        }
      } else {
        const textChunk = chunk;
        const input = CharStream.fromString(textChunk.text);
        this.lexer.inputStream = input;
        let t = this.lexer.nextToken();
        while (t.type !== Token.EOF) {
          tokens.push(t);
          t = this.lexer.nextToken();
        }
      }
    }
    return tokens;
  }
  split(pattern) {
    let p = 0;
    const n2 = pattern.length;
    const chunks = new Array;
    const starts = new Array;
    const stops = new Array;
    while (p < n2) {
      if (p === pattern.indexOf(this.escape + this.start, p)) {
        p += this.escape.length + this.start.length;
      } else {
        if (p === pattern.indexOf(this.escape + this.stop, p)) {
          p += this.escape.length + this.stop.length;
        } else {
          if (p === pattern.indexOf(this.start, p)) {
            starts.push(p);
            p += this.start.length;
          } else {
            if (p === pattern.indexOf(this.stop, p)) {
              stops.push(p);
              p += this.stop.length;
            } else {
              p++;
            }
          }
        }
      }
    }
    if (starts.length > stops.length) {
      throw new Error("unterminated tag in pattern: " + pattern);
    }
    if (starts.length < stops.length) {
      throw new Error("missing start tag in pattern: " + pattern);
    }
    const tagCount = starts.length;
    for (let i = 0;i < tagCount; i++) {
      if (starts[i] >= stops[i]) {
        throw new Error("tag delimiters out of order in pattern: " + pattern);
      }
    }
    if (tagCount === 0) {
      const text = pattern.substring(0, n2);
      chunks.push(new TextChunk(text));
    }
    if (tagCount > 0 && starts[0] > 0) {
      const text = pattern.substring(0, starts[0]);
      chunks.push(new TextChunk(text));
    }
    for (let i = 0;i < tagCount; i++) {
      const tag = pattern.substring(starts[i] + this.start.length, stops[i]);
      let ruleOrToken = tag;
      let label;
      const colon = tag.indexOf(":");
      if (colon >= 0) {
        label = tag.substring(0, colon);
        ruleOrToken = tag.substring(colon + 1, tag.length);
      }
      chunks.push(new TagChunk(label, ruleOrToken));
      if (i + 1 < tagCount) {
        const text = pattern.substring(stops[i] + this.stop.length, starts[i + 1]);
        chunks.push(new TextChunk(text));
      }
    }
    if (tagCount > 0) {
      const afterLastTag = stops[tagCount - 1] + this.stop.length;
      if (afterLastTag < n2) {
        const text = pattern.substring(afterLastTag, n2);
        chunks.push(new TextChunk(text));
      }
    }
    for (let i = 0;i < chunks.length; i++) {
      const c = chunks[i];
      if (c instanceof TextChunk) {
        const tc = c;
        const unescaped = tc.text.replaceAll(this.escape, "");
        if (unescaped.length < tc.text.length) {
          chunks[i] = new TextChunk(unescaped);
        }
      }
    }
    return chunks;
  }
  matchImpl(tree, patternTree, labels) {
    if (tree instanceof TerminalNode && patternTree instanceof TerminalNode) {
      const t1 = tree;
      const t2 = patternTree;
      let mismatchedNode;
      if (t1.getSymbol().type === t2.getSymbol().type) {
        if (t2.getSymbol() instanceof TokenTagToken) {
          const tokenTagToken = t2.getSymbol();
          labels.map(tokenTagToken.tokenName, tree);
          if (tokenTagToken.label !== undefined) {
            labels.map(tokenTagToken.label, tree);
          }
        } else {
          if (t1.getText() === t2.getText()) {} else {
            if (!mismatchedNode) {
              mismatchedNode = t1;
            }
          }
        }
      } else {
        if (!mismatchedNode) {
          mismatchedNode = t1;
        }
      }
      return mismatchedNode;
    }
    if (tree instanceof ParserRuleContext && patternTree instanceof ParserRuleContext) {
      let mismatchedNode;
      const ruleTagToken = this.getRuleTagToken(patternTree);
      if (ruleTagToken) {
        if (tree.ruleIndex === patternTree.ruleIndex) {
          labels.map(ruleTagToken.ruleName, tree);
          if (ruleTagToken.label) {
            labels.map(ruleTagToken.label, tree);
          }
        } else {
          if (!mismatchedNode) {
            mismatchedNode = tree;
          }
        }
        return mismatchedNode;
      }
      if (tree.getChildCount() !== patternTree.getChildCount()) {
        if (!mismatchedNode) {
          mismatchedNode = tree;
        }
        return mismatchedNode;
      }
      const n2 = tree.getChildCount();
      for (let i = 0;i < n2; i++) {
        const childMatch = this.matchImpl(tree.getChild(i), patternTree.getChild(i), labels);
        if (childMatch) {
          return childMatch;
        }
      }
      return mismatchedNode;
    }
    return tree;
  }
  getRuleTagToken(t) {
    if (t instanceof ParserRuleContext) {
      if (t.getChildCount() === 1 && t.getChild(0) instanceof TerminalNode) {
        const c = t.getChild(0);
        if (c.getSymbol() instanceof RuleTagToken) {
          return c.getSymbol();
        }
      }
    }
    return;
  }
};
var DiagnosticErrorListener = class extends BaseErrorListener {
  static {
    __name(this, "DiagnosticErrorListener");
  }
  exactOnly;
  constructor(exactOnly) {
    super();
    this.exactOnly = exactOnly ?? true;
  }
  reportAmbiguity = /* @__PURE__ */ __name((recognizer, dfa, startIndex, stopIndex, exact, ambigAlts, configs) => {
    if (this.exactOnly && !exact) {
      return;
    }
    const decision = this.getDecisionDescription(recognizer, dfa);
    const conflictingAlts = this.getConflictingAlts(ambigAlts, configs);
    const text = recognizer.tokenStream?.getTextFromInterval(Interval.of(startIndex, stopIndex));
    const message = `reportAmbiguity d=${decision}: ambigAlts=${conflictingAlts}, input='${text}'`;
    recognizer.notifyErrorListeners(message, null, null);
  }, "reportAmbiguity");
  reportAttemptingFullContext = /* @__PURE__ */ __name((recognizer, dfa, startIndex, stopIndex, _conflictingAlts, _configs) => {
    const decision = this.getDecisionDescription(recognizer, dfa);
    const text = recognizer.tokenStream?.getTextFromInterval(Interval.of(startIndex, stopIndex));
    const message = `reportAttemptingFullContext d=${decision}, input='${text}'`;
    recognizer.notifyErrorListeners(message, null, null);
  }, "reportAttemptingFullContext");
  reportContextSensitivity = /* @__PURE__ */ __name((recognizer, dfa, startIndex, stopIndex, _prediction, _configs) => {
    const decision = this.getDecisionDescription(recognizer, dfa);
    const text = recognizer.tokenStream?.getTextFromInterval(Interval.of(startIndex, stopIndex));
    const message = `reportContextSensitivity d=${decision}, input='${text}'`;
    recognizer.notifyErrorListeners(message, null, null);
  }, "reportContextSensitivity");
  getDecisionDescription = /* @__PURE__ */ __name((recognizer, dfa) => {
    const decision = dfa.decision;
    const ruleIndex = dfa.atnStartState.ruleIndex;
    const ruleNames = recognizer.ruleNames;
    if (ruleIndex < 0 || ruleIndex >= ruleNames.length) {
      return decision.toString();
    }
    const ruleName = ruleNames[ruleIndex];
    if (ruleName.length === 0) {
      return decision.toString();
    }
    return `${decision} (${ruleName})`;
  }, "getDecisionDescription");
  getConflictingAlts = /* @__PURE__ */ __name((reportedAlts, configs) => {
    if (reportedAlts) {
      return reportedAlts;
    }
    const result = new BitSet;
    for (let i = 0;i < configs.configs.length; i++) {
      result.set(configs.configs[i].alt);
    }
    return result;
  }, "getConflictingAlts");
};
var LexerInterpreter = class extends Lexer {
  static {
    __name(this, "LexerInterpreter");
  }
  decisionToDFA;
  sharedContextCache = new PredictionContextCache;
  #grammarFileName;
  #atn;
  #ruleNames;
  #channelNames;
  #modeNames;
  #vocabulary;
  constructor(grammarFileName, vocabulary, ruleNames, channelNames, modeNames, atn, input) {
    super(input);
    if (atn.grammarType !== ATN.LEXER) {
      throw new Error("IllegalArgumentException: The ATN must be a lexer ATN.");
    }
    this.#grammarFileName = grammarFileName;
    this.#atn = atn;
    this.#ruleNames = ruleNames.slice(0);
    this.#channelNames = channelNames.slice(0);
    this.#modeNames = modeNames.slice(0);
    this.#vocabulary = vocabulary;
    this.decisionToDFA = atn.decisionToState.map((ds, i) => {
      return new DFA(ds, i);
    });
    this.interpreter = new LexerATNSimulator(this, atn, this.decisionToDFA, this.sharedContextCache);
  }
  get atn() {
    return this.#atn;
  }
  get grammarFileName() {
    return this.#grammarFileName;
  }
  get ruleNames() {
    return this.#ruleNames;
  }
  get channelNames() {
    return this.#channelNames;
  }
  get modeNames() {
    return this.#modeNames;
  }
  get vocabulary() {
    return this.#vocabulary;
  }
  get serializedATN() {
    throw new Error("The LexerInterpreter does not support the serializedATN property.");
  }
};
var RuntimeMetaData = class _RuntimeMetaData {
  static {
    __name(this, "RuntimeMetaData");
  }
  static VERSION = "4.13.1";
  static getRuntimeVersion() {
    return _RuntimeMetaData.VERSION;
  }
  static checkVersion(generatingToolVersion, compileTimeVersion) {
    const runtimeVersion = _RuntimeMetaData.VERSION;
    let runtimeConflictsWithGeneratingTool = false;
    let runtimeConflictsWithCompileTimeTool = false;
    runtimeConflictsWithGeneratingTool = runtimeVersion !== generatingToolVersion && _RuntimeMetaData.getMajorMinorVersion(runtimeVersion) !== _RuntimeMetaData.getMajorMinorVersion(generatingToolVersion);
    runtimeConflictsWithCompileTimeTool = runtimeVersion !== compileTimeVersion && _RuntimeMetaData.getMajorMinorVersion(runtimeVersion) !== _RuntimeMetaData.getMajorMinorVersion(compileTimeVersion);
    if (runtimeConflictsWithGeneratingTool) {
      console.error(`ANTLR Tool version ${generatingToolVersion} used for code generation does not match the current runtime version ${runtimeVersion}`);
    }
    if (runtimeConflictsWithCompileTimeTool) {
      console.error(`ANTLR Runtime version ${compileTimeVersion} used for parser compilation does not match the current runtime version ${runtimeVersion}`);
    }
  }
  static getMajorMinorVersion(version) {
    const firstDot = version.indexOf(".");
    const secondDot = firstDot >= 0 ? version.indexOf(".", firstDot + 1) : -1;
    const firstDash = version.indexOf("-");
    let referenceLength = version.length;
    if (secondDot >= 0) {
      referenceLength = Math.min(referenceLength, secondDot);
    }
    if (firstDash >= 0) {
      referenceLength = Math.min(referenceLength, firstDash);
    }
    return version.substring(0, referenceLength);
  }
};
var TokenStreamRewriter = class _TokenStreamRewriter {
  static {
    __name(this, "TokenStreamRewriter");
  }
  static DEFAULT_PROGRAM_NAME = "default";
  static PROGRAM_INIT_SIZE = 100;
  static MIN_TOKEN_INDEX = 0;
  tokens;
  programs = /* @__PURE__ */ new Map;
  lastRewriteTokenIndexes;
  constructor(tokens) {
    this.tokens = tokens;
  }
  getTokenStream() {
    return this.tokens;
  }
  insertAfter(tokenOrIndex, text, programName = _TokenStreamRewriter.DEFAULT_PROGRAM_NAME) {
    let index;
    if (typeof tokenOrIndex === "number") {
      index = tokenOrIndex;
    } else {
      index = tokenOrIndex.tokenIndex;
    }
    const rewrites = this.getProgram(programName);
    const op = new InsertAfterOp(this.tokens, index, rewrites.length, text);
    rewrites.push(op);
  }
  insertBefore(tokenOrIndex, text, programName = _TokenStreamRewriter.DEFAULT_PROGRAM_NAME) {
    let index;
    if (typeof tokenOrIndex === "number") {
      index = tokenOrIndex;
    } else {
      index = tokenOrIndex.tokenIndex;
    }
    const rewrites = this.getProgram(programName);
    const op = new InsertBeforeOp(this.tokens, index, rewrites.length, text);
    rewrites.push(op);
  }
  replaceSingle(tokenOrIndex, text, programName = _TokenStreamRewriter.DEFAULT_PROGRAM_NAME) {
    this.replace(tokenOrIndex, tokenOrIndex, text, programName);
  }
  replace(from, to, text, programName = _TokenStreamRewriter.DEFAULT_PROGRAM_NAME) {
    if (typeof from !== "number") {
      from = from.tokenIndex;
    }
    if (typeof to !== "number") {
      to = to.tokenIndex;
    }
    if (from > to || from < 0 || to < 0 || to >= this.tokens.size) {
      throw new RangeError(`replace: range invalid: ${from}..${to}(size=${this.tokens.size})`);
    }
    const rewrites = this.getProgram(programName);
    const op = new ReplaceOp(this.tokens, from, to, rewrites.length, text);
    rewrites.push(op);
  }
  delete(from, to, programName = _TokenStreamRewriter.DEFAULT_PROGRAM_NAME) {
    if (to == null) {
      to = from;
    }
    this.replace(from, to, null, programName);
  }
  getProgram(name) {
    let is = this.programs.get(name);
    if (is == null) {
      is = this.initializeProgram(name);
    }
    return is;
  }
  initializeProgram(name) {
    const is = [];
    this.programs.set(name, is);
    return is;
  }
  getText(intervalOrProgram, programName = _TokenStreamRewriter.DEFAULT_PROGRAM_NAME) {
    let interval;
    if (intervalOrProgram instanceof Interval) {
      interval = intervalOrProgram;
    } else {
      interval = new Interval(0, this.tokens.size - 1);
    }
    if (typeof intervalOrProgram === "string") {
      programName = intervalOrProgram;
    }
    const rewrites = this.programs.get(programName);
    let start = interval.start;
    let stop = interval.stop;
    if (stop > this.tokens.size - 1) {
      stop = this.tokens.size - 1;
    }
    if (start < 0) {
      start = 0;
    }
    if (rewrites == null || rewrites.length === 0) {
      return this.tokens.getTextFromInterval(new Interval(start, stop));
    }
    const buf = [];
    const indexToOp = this.reduceToSingleOperationPerIndex(rewrites);
    let i = start;
    while (i <= stop && i < this.tokens.size) {
      const op = indexToOp.get(i);
      indexToOp.delete(i);
      const t = this.tokens.get(i);
      if (op == null) {
        if (t.type !== Token.EOF) {
          buf.push(String(t.text));
        }
        i++;
      } else {
        i = op.execute(buf);
      }
    }
    if (stop === this.tokens.size - 1) {
      for (const op of indexToOp.values()) {
        if (op && op.index >= this.tokens.size - 1) {
          buf.push(String(op.text));
        }
      }
    }
    return buf.join("");
  }
  reduceToSingleOperationPerIndex(rewrites) {
    for (let i = 0;i < rewrites.length; i++) {
      const op = rewrites[i];
      if (op == null) {
        continue;
      }
      if (!(op instanceof ReplaceOp)) {
        continue;
      }
      const rop = op;
      const inserts = this.getKindOfOps(rewrites, InsertBeforeOp, i);
      for (const iop of inserts) {
        if (iop.index === rop.index) {
          rewrites[iop.instructionIndex] = null;
          rop.text = String(iop.text) + (rop.text != null ? rop.text.toString() : "");
        } else if (iop.index > rop.index && iop.index <= rop.lastIndex) {
          rewrites[iop.instructionIndex] = null;
        }
      }
      const prevReplaces = this.getKindOfOps(rewrites, ReplaceOp, i);
      for (const prevRop of prevReplaces) {
        if (prevRop.index >= rop.index && prevRop.lastIndex <= rop.lastIndex) {
          rewrites[prevRop.instructionIndex] = null;
          continue;
        }
        const disjoint = prevRop.lastIndex < rop.index || prevRop.index > rop.lastIndex;
        if (prevRop.text == null && rop.text == null && !disjoint) {
          rewrites[prevRop.instructionIndex] = null;
          rop.index = Math.min(prevRop.index, rop.index);
          rop.lastIndex = Math.max(prevRop.lastIndex, rop.lastIndex);
        } else if (!disjoint) {
          throw new Error(`replace op boundaries of ${rop} overlap with previous ${prevRop}`);
        }
      }
    }
    for (let i = 0;i < rewrites.length; i++) {
      const op = rewrites[i];
      if (op == null) {
        continue;
      }
      if (!(op instanceof InsertBeforeOp)) {
        continue;
      }
      const iop = op;
      const prevInserts = this.getKindOfOps(rewrites, InsertBeforeOp, i);
      for (const prevIop of prevInserts) {
        if (prevIop.index === iop.index) {
          if (prevIop instanceof InsertAfterOp) {
            iop.text = this.catOpText(prevIop.text, iop.text);
            rewrites[prevIop.instructionIndex] = null;
          } else if (prevIop instanceof InsertBeforeOp) {
            iop.text = this.catOpText(iop.text, prevIop.text);
            rewrites[prevIop.instructionIndex] = null;
          }
        }
      }
      const prevReplaces = this.getKindOfOps(rewrites, ReplaceOp, i);
      for (const rop of prevReplaces) {
        if (iop.index === rop.index) {
          rop.text = this.catOpText(iop.text, rop.text);
          rewrites[i] = null;
          continue;
        }
        if (iop.index >= rop.index && iop.index <= rop.lastIndex) {
          throw new Error(`insert op ${iop} within boundaries of previous ${rop}`);
        }
      }
    }
    const m2 = /* @__PURE__ */ new Map;
    for (const op of rewrites) {
      if (op == null) {
        continue;
      }
      if (m2.get(op.index) != null) {
        throw new Error("should only be one op per index");
      }
      m2.set(op.index, op);
    }
    return m2;
  }
  catOpText(a, b) {
    let x = "";
    let y = "";
    if (a != null) {
      x = a.toString();
    }
    if (b != null) {
      y = b.toString();
    }
    return x + y;
  }
  getKindOfOps(rewrites, kind, before) {
    return rewrites.slice(0, before).filter((op) => {
      return op && op instanceof kind;
    });
  }
};
var RewriteOperation = class {
  static {
    __name(this, "RewriteOperation");
  }
  instructionIndex;
  index;
  text;
  tokens;
  constructor(tokens, index, instructionIndex, text) {
    this.tokens = tokens;
    this.instructionIndex = instructionIndex;
    this.index = index;
    this.text = text === undefined ? "" : text;
  }
  execute(_buf) {
    return this.index;
  }
  toString() {
    return "<RewriteOperation@" + this.tokens.get(this.index) + ':"' + this.text + '">';
  }
};
var InsertBeforeOp = class extends RewriteOperation {
  static {
    __name(this, "InsertBeforeOp");
  }
  constructor(tokens, index, instructionIndex, text) {
    super(tokens, index, instructionIndex, text);
  }
  execute(buf) {
    if (this.text) {
      buf.push(this.text.toString());
    }
    if (this.tokens.get(this.index).type !== Token.EOF) {
      buf.push(String(this.tokens.get(this.index).text));
    }
    return this.index + 1;
  }
  toString() {
    return "<InsertBeforeOp@" + this.tokens.get(this.index) + ':"' + this.text + '">';
  }
};
var InsertAfterOp = class extends InsertBeforeOp {
  static {
    __name(this, "InsertAfterOp");
  }
  constructor(tokens, index, instructionIndex, text) {
    super(tokens, index + 1, instructionIndex, text);
  }
  toString() {
    return "<InsertAfterOp@" + this.tokens.get(this.index) + ':"' + this.text + '">';
  }
};
var ReplaceOp = class extends RewriteOperation {
  static {
    __name(this, "ReplaceOp");
  }
  lastIndex;
  constructor(tokens, from, to, instructionIndex, text) {
    super(tokens, from, instructionIndex, text);
    this.lastIndex = to;
  }
  execute(buf) {
    if (this.text) {
      buf.push(this.text.toString());
    }
    return this.lastIndex + 1;
  }
  toString() {
    if (this.text == null) {
      return "<DeleteOp@" + this.tokens.get(this.index) + ".." + this.tokens.get(this.lastIndex) + ">";
    }
    return "<ReplaceOp@" + this.tokens.get(this.index) + ".." + this.tokens.get(this.lastIndex) + ':"' + this.text + '">';
  }
};
var UnbufferedTokenStream = class {
  static {
    __name(this, "UnbufferedTokenStream");
  }
  tokenSource;
  tokens;
  n;
  p = 0;
  numMarkers = 0;
  lastToken;
  lastTokenBufferStart;
  currentTokenIndex = 0;
  constructor(tokenSource, bufferSize) {
    this.tokenSource = tokenSource;
    bufferSize = bufferSize ?? 256;
    this.tokens = new Array(bufferSize);
    this.n = 0;
    this.fill(1);
  }
  get(i) {
    const bufferStartIndex = this.getBufferStartIndex();
    if (i < bufferStartIndex || i >= bufferStartIndex + this.n) {
      throw new Error("get(" + i + ") outside buffer: " + bufferStartIndex + ".." + (bufferStartIndex + this.n));
    }
    return this.tokens[i - bufferStartIndex];
  }
  LT(i) {
    if (i === -1) {
      return this.lastToken;
    }
    this.sync(i);
    const index = this.p + i - 1;
    if (index < 0) {
      throw new Error("LT(" + i + ") gives negative index");
    }
    if (index >= this.n) {
      return this.tokens[this.n - 1];
    }
    return this.tokens[index];
  }
  LA(i) {
    return this.LT(i).type;
  }
  getText() {
    return "";
  }
  getTextFromContext(ctx) {
    return this.getTextFromInterval(ctx.getSourceInterval());
  }
  getTextFromInterval(interval) {
    const bufferStartIndex = this.getBufferStartIndex();
    const bufferStopIndex = bufferStartIndex + this.tokens.length - 1;
    const start = interval.start;
    const stop = interval.stop;
    if (start < bufferStartIndex || stop > bufferStopIndex) {
      throw new Error("interval " + interval + " not in token buffer window: " + bufferStartIndex + ".." + bufferStopIndex);
    }
    const a = start - bufferStartIndex;
    const b = stop - bufferStartIndex;
    let result = "";
    for (let i = a;i <= b; i++) {
      const t = this.tokens[i];
      result += t.text;
    }
    return result;
  }
  getTextFromRange(start, stop) {
    return this.getTextFromInterval(Interval.of(start.tokenIndex, stop.tokenIndex));
  }
  consume() {
    if (this.LA(1) === Token.EOF) {
      throw new Error("cannot consume EOF");
    }
    this.lastToken = this.tokens[this.p];
    if (this.p === this.n - 1 && this.numMarkers === 0) {
      this.n = 0;
      this.p = -1;
      this.lastTokenBufferStart = this.lastToken;
    }
    this.p++;
    this.currentTokenIndex++;
    this.sync(1);
  }
  mark() {
    if (this.numMarkers === 0) {
      this.lastTokenBufferStart = this.lastToken;
    }
    const mark = -this.numMarkers - 1;
    this.numMarkers++;
    return mark;
  }
  release(marker) {
    const expectedMark = -this.numMarkers;
    if (marker !== expectedMark) {
      throw new Error("release() called with an invalid marker.");
    }
    this.numMarkers--;
    if (this.numMarkers === 0) {
      if (this.p > 0) {
        this.tokens.copyWithin(0, this.p, this.n);
        this.n = this.n - this.p;
        this.p = 0;
      }
      this.lastTokenBufferStart = this.lastToken;
    }
  }
  get index() {
    return this.currentTokenIndex;
  }
  seek(index) {
    if (index === this.currentTokenIndex) {
      return;
    }
    if (index > this.currentTokenIndex) {
      this.sync(index - this.currentTokenIndex);
      index = Math.min(index, this.getBufferStartIndex() + this.n - 1);
    }
    const bufferStartIndex = this.getBufferStartIndex();
    const i = index - bufferStartIndex;
    if (i < 0) {
      throw new Error("cannot seek to negative index " + index);
    } else {
      if (i >= this.n) {
        throw new Error("seek to index outside buffer: " + index + " not in " + bufferStartIndex + ".." + (bufferStartIndex + this.n));
      }
    }
    this.p = i;
    this.currentTokenIndex = index;
    if (this.p === 0) {
      this.lastToken = this.lastTokenBufferStart;
    } else {
      this.lastToken = this.tokens[this.p - 1];
    }
  }
  get size() {
    throw new Error("Unbuffered stream cannot know its size");
  }
  getSourceName() {
    return this.tokenSource.sourceName;
  }
  setLine(line) {
    this.tokenSource.line = line;
  }
  setColumn(column) {
    this.tokenSource.column = column;
  }
  sync(want) {
    const need = this.p + want - 1 - this.n + 1;
    if (need > 0) {
      this.fill(need);
    }
  }
  fill(n2) {
    for (let i = 0;i < n2; i++) {
      if (this.n > 0 && this.tokens[this.n - 1].type === Token.EOF) {
        return i;
      }
      const t = this.tokenSource.nextToken();
      this.add(t);
    }
    return n2;
  }
  add(t) {
    if (this.n >= this.tokens.length) {
      this.tokens.length = this.tokens.length * 2;
    }
    if (isWritableToken(t)) {
      t.setTokenIndex(this.getBufferStartIndex() + this.n);
    }
    this.tokens[this.n++] = t;
  }
  getBufferStartIndex() {
    return this.currentTokenIndex - this.p;
  }
};

// src/parser/generated/HaloLexer.ts
class HaloLexer extends Lexer {
  static T__0 = 1;
  static T__1 = 2;
  static T__2 = 3;
  static T__3 = 4;
  static T__4 = 5;
  static T__5 = 6;
  static T__6 = 7;
  static T__7 = 8;
  static T__8 = 9;
  static T__9 = 10;
  static T__10 = 11;
  static T__11 = 12;
  static T__12 = 13;
  static T__13 = 14;
  static T__14 = 15;
  static T__15 = 16;
  static T__16 = 17;
  static T__17 = 18;
  static T__18 = 19;
  static T__19 = 20;
  static T__20 = 21;
  static T__21 = 22;
  static T__22 = 23;
  static T__23 = 24;
  static T__24 = 25;
  static T__25 = 26;
  static T__26 = 27;
  static T__27 = 28;
  static T__28 = 29;
  static T__29 = 30;
  static T__30 = 31;
  static T__31 = 32;
  static T__32 = 33;
  static T__33 = 34;
  static T__34 = 35;
  static T__35 = 36;
  static T__36 = 37;
  static T__37 = 38;
  static T__38 = 39;
  static WS = 40;
  static NL = 41;
  static LINE_COMMENT = 42;
  static BLOCK_COMMENT = 43;
  static LOOP = 44;
  static FANOUT = 45;
  static INTERRUPT = 46;
  static GATE = 47;
  static LISTEN = 48;
  static PIPE = 49;
  static BOOL = 50;
  static NULL = 51;
  static DURATION = 52;
  static NUMBER = 53;
  static MODEL_REF = 54;
  static IDENTIFIER = 55;
  static TRIPLE_STRING = 56;
  static STRING = 57;
  static channelNames = [
    "DEFAULT_TOKEN_CHANNEL",
    "HIDDEN"
  ];
  static literalNames = [
    null,
    "'policy'",
    "'tool'",
    "'store'",
    "'schema'",
    "'agent'",
    "'pipeline'",
    "'equips'",
    "'requires'",
    "'system'",
    "'context'",
    "'yield'",
    "'listen'",
    "'loop'",
    "'as'",
    "'each'",
    "'in'",
    "'else'",
    "'.'",
    "':'",
    "'&'",
    "'('",
    "')'",
    "'{'",
    "','",
    "'}'",
    "'['",
    "']'",
    "'@'",
    "'->'",
    "'<'",
    "'>'",
    "'=>'",
    "'||'",
    "'&&'",
    "'!'",
    "'=='",
    "'!='",
    "'>='",
    "'<='",
    null,
    null,
    null,
    null,
    "'|<>'",
    "'|*'",
    "'|!'",
    "'|?'",
    "'~>'",
    "'|>'",
    null,
    "'null'"
  ];
  static symbolicNames = [
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    "WS",
    "NL",
    "LINE_COMMENT",
    "BLOCK_COMMENT",
    "LOOP",
    "FANOUT",
    "INTERRUPT",
    "GATE",
    "LISTEN",
    "PIPE",
    "BOOL",
    "NULL",
    "DURATION",
    "NUMBER",
    "MODEL_REF",
    "IDENTIFIER",
    "TRIPLE_STRING",
    "STRING"
  ];
  static modeNames = [
    "DEFAULT_MODE"
  ];
  static ruleNames = [
    "T__0",
    "T__1",
    "T__2",
    "T__3",
    "T__4",
    "T__5",
    "T__6",
    "T__7",
    "T__8",
    "T__9",
    "T__10",
    "T__11",
    "T__12",
    "T__13",
    "T__14",
    "T__15",
    "T__16",
    "T__17",
    "T__18",
    "T__19",
    "T__20",
    "T__21",
    "T__22",
    "T__23",
    "T__24",
    "T__25",
    "T__26",
    "T__27",
    "T__28",
    "T__29",
    "T__30",
    "T__31",
    "T__32",
    "T__33",
    "T__34",
    "T__35",
    "T__36",
    "T__37",
    "T__38",
    "WS",
    "NL",
    "LINE_COMMENT",
    "BLOCK_COMMENT",
    "LOOP",
    "FANOUT",
    "INTERRUPT",
    "GATE",
    "LISTEN",
    "PIPE",
    "BOOL",
    "NULL",
    "DURATION",
    "NUMBER",
    "MODEL_REF",
    "IDENTIFIER",
    "TRIPLE_STRING",
    "STRING"
  ];
  constructor(input) {
    super(input);
    this.interpreter = new LexerATNSimulator(this, HaloLexer._ATN, HaloLexer.decisionsToDFA, new PredictionContextCache);
  }
  get grammarFileName() {
    return "Halo.g4";
  }
  get literalNames() {
    return HaloLexer.literalNames;
  }
  get symbolicNames() {
    return HaloLexer.symbolicNames;
  }
  get ruleNames() {
    return HaloLexer.ruleNames;
  }
  get serializedATN() {
    return HaloLexer._serializedATN;
  }
  get channelNames() {
    return HaloLexer.channelNames;
  }
  get modeNames() {
    return HaloLexer.modeNames;
  }
  static _serializedATN = [
    4,
    0,
    57,
    435,
    6,
    -1,
    2,
    0,
    7,
    0,
    2,
    1,
    7,
    1,
    2,
    2,
    7,
    2,
    2,
    3,
    7,
    3,
    2,
    4,
    7,
    4,
    2,
    5,
    7,
    5,
    2,
    6,
    7,
    6,
    2,
    7,
    7,
    7,
    2,
    8,
    7,
    8,
    2,
    9,
    7,
    9,
    2,
    10,
    7,
    10,
    2,
    11,
    7,
    11,
    2,
    12,
    7,
    12,
    2,
    13,
    7,
    13,
    2,
    14,
    7,
    14,
    2,
    15,
    7,
    15,
    2,
    16,
    7,
    16,
    2,
    17,
    7,
    17,
    2,
    18,
    7,
    18,
    2,
    19,
    7,
    19,
    2,
    20,
    7,
    20,
    2,
    21,
    7,
    21,
    2,
    22,
    7,
    22,
    2,
    23,
    7,
    23,
    2,
    24,
    7,
    24,
    2,
    25,
    7,
    25,
    2,
    26,
    7,
    26,
    2,
    27,
    7,
    27,
    2,
    28,
    7,
    28,
    2,
    29,
    7,
    29,
    2,
    30,
    7,
    30,
    2,
    31,
    7,
    31,
    2,
    32,
    7,
    32,
    2,
    33,
    7,
    33,
    2,
    34,
    7,
    34,
    2,
    35,
    7,
    35,
    2,
    36,
    7,
    36,
    2,
    37,
    7,
    37,
    2,
    38,
    7,
    38,
    2,
    39,
    7,
    39,
    2,
    40,
    7,
    40,
    2,
    41,
    7,
    41,
    2,
    42,
    7,
    42,
    2,
    43,
    7,
    43,
    2,
    44,
    7,
    44,
    2,
    45,
    7,
    45,
    2,
    46,
    7,
    46,
    2,
    47,
    7,
    47,
    2,
    48,
    7,
    48,
    2,
    49,
    7,
    49,
    2,
    50,
    7,
    50,
    2,
    51,
    7,
    51,
    2,
    52,
    7,
    52,
    2,
    53,
    7,
    53,
    2,
    54,
    7,
    54,
    2,
    55,
    7,
    55,
    2,
    56,
    7,
    56,
    1,
    0,
    1,
    0,
    1,
    0,
    1,
    0,
    1,
    0,
    1,
    0,
    1,
    0,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    2,
    1,
    2,
    1,
    2,
    1,
    2,
    1,
    2,
    1,
    2,
    1,
    3,
    1,
    3,
    1,
    3,
    1,
    3,
    1,
    3,
    1,
    3,
    1,
    3,
    1,
    4,
    1,
    4,
    1,
    4,
    1,
    4,
    1,
    4,
    1,
    4,
    1,
    5,
    1,
    5,
    1,
    5,
    1,
    5,
    1,
    5,
    1,
    5,
    1,
    5,
    1,
    5,
    1,
    5,
    1,
    6,
    1,
    6,
    1,
    6,
    1,
    6,
    1,
    6,
    1,
    6,
    1,
    6,
    1,
    7,
    1,
    7,
    1,
    7,
    1,
    7,
    1,
    7,
    1,
    7,
    1,
    7,
    1,
    7,
    1,
    7,
    1,
    8,
    1,
    8,
    1,
    8,
    1,
    8,
    1,
    8,
    1,
    8,
    1,
    8,
    1,
    9,
    1,
    9,
    1,
    9,
    1,
    9,
    1,
    9,
    1,
    9,
    1,
    9,
    1,
    9,
    1,
    10,
    1,
    10,
    1,
    10,
    1,
    10,
    1,
    10,
    1,
    10,
    1,
    11,
    1,
    11,
    1,
    11,
    1,
    11,
    1,
    11,
    1,
    11,
    1,
    11,
    1,
    12,
    1,
    12,
    1,
    12,
    1,
    12,
    1,
    12,
    1,
    13,
    1,
    13,
    1,
    13,
    1,
    14,
    1,
    14,
    1,
    14,
    1,
    14,
    1,
    14,
    1,
    15,
    1,
    15,
    1,
    15,
    1,
    16,
    1,
    16,
    1,
    16,
    1,
    16,
    1,
    16,
    1,
    17,
    1,
    17,
    1,
    18,
    1,
    18,
    1,
    19,
    1,
    19,
    1,
    20,
    1,
    20,
    1,
    21,
    1,
    21,
    1,
    22,
    1,
    22,
    1,
    23,
    1,
    23,
    1,
    24,
    1,
    24,
    1,
    25,
    1,
    25,
    1,
    26,
    1,
    26,
    1,
    27,
    1,
    27,
    1,
    28,
    1,
    28,
    1,
    28,
    1,
    29,
    1,
    29,
    1,
    30,
    1,
    30,
    1,
    31,
    1,
    31,
    1,
    31,
    1,
    32,
    1,
    32,
    1,
    32,
    1,
    33,
    1,
    33,
    1,
    33,
    1,
    34,
    1,
    34,
    1,
    35,
    1,
    35,
    1,
    35,
    1,
    36,
    1,
    36,
    1,
    36,
    1,
    37,
    1,
    37,
    1,
    37,
    1,
    38,
    1,
    38,
    1,
    38,
    1,
    39,
    4,
    39,
    274,
    8,
    39,
    11,
    39,
    12,
    39,
    275,
    1,
    39,
    1,
    39,
    1,
    40,
    3,
    40,
    281,
    8,
    40,
    1,
    40,
    4,
    40,
    284,
    8,
    40,
    11,
    40,
    12,
    40,
    285,
    1,
    40,
    1,
    40,
    1,
    41,
    1,
    41,
    1,
    41,
    1,
    41,
    5,
    41,
    294,
    8,
    41,
    10,
    41,
    12,
    41,
    297,
    9,
    41,
    1,
    41,
    1,
    41,
    1,
    42,
    1,
    42,
    1,
    42,
    1,
    42,
    5,
    42,
    305,
    8,
    42,
    10,
    42,
    12,
    42,
    308,
    9,
    42,
    1,
    42,
    1,
    42,
    1,
    42,
    1,
    42,
    1,
    42,
    1,
    43,
    1,
    43,
    1,
    43,
    1,
    43,
    1,
    44,
    1,
    44,
    1,
    44,
    1,
    45,
    1,
    45,
    1,
    45,
    1,
    46,
    1,
    46,
    1,
    46,
    1,
    47,
    1,
    47,
    1,
    47,
    1,
    48,
    1,
    48,
    1,
    48,
    1,
    49,
    1,
    49,
    1,
    49,
    1,
    49,
    1,
    49,
    1,
    49,
    1,
    49,
    1,
    49,
    1,
    49,
    3,
    49,
    343,
    8,
    49,
    1,
    50,
    1,
    50,
    1,
    50,
    1,
    50,
    1,
    50,
    1,
    51,
    4,
    51,
    351,
    8,
    51,
    11,
    51,
    12,
    51,
    352,
    1,
    51,
    1,
    51,
    1,
    51,
    3,
    51,
    358,
    8,
    51,
    1,
    52,
    3,
    52,
    361,
    8,
    52,
    1,
    52,
    4,
    52,
    364,
    8,
    52,
    11,
    52,
    12,
    52,
    365,
    1,
    52,
    1,
    52,
    4,
    52,
    370,
    8,
    52,
    11,
    52,
    12,
    52,
    371,
    3,
    52,
    374,
    8,
    52,
    1,
    53,
    1,
    53,
    5,
    53,
    378,
    8,
    53,
    10,
    53,
    12,
    53,
    381,
    9,
    53,
    1,
    53,
    1,
    53,
    4,
    53,
    385,
    8,
    53,
    11,
    53,
    12,
    53,
    386,
    4,
    53,
    389,
    8,
    53,
    11,
    53,
    12,
    53,
    390,
    1,
    54,
    1,
    54,
    5,
    54,
    395,
    8,
    54,
    10,
    54,
    12,
    54,
    398,
    9,
    54,
    1,
    55,
    1,
    55,
    1,
    55,
    1,
    55,
    1,
    55,
    5,
    55,
    405,
    8,
    55,
    10,
    55,
    12,
    55,
    408,
    9,
    55,
    1,
    55,
    1,
    55,
    1,
    55,
    1,
    55,
    1,
    56,
    1,
    56,
    1,
    56,
    1,
    56,
    5,
    56,
    418,
    8,
    56,
    10,
    56,
    12,
    56,
    421,
    9,
    56,
    1,
    56,
    1,
    56,
    1,
    56,
    1,
    56,
    1,
    56,
    5,
    56,
    428,
    8,
    56,
    10,
    56,
    12,
    56,
    431,
    9,
    56,
    1,
    56,
    3,
    56,
    434,
    8,
    56,
    2,
    306,
    406,
    0,
    57,
    1,
    1,
    3,
    2,
    5,
    3,
    7,
    4,
    9,
    5,
    11,
    6,
    13,
    7,
    15,
    8,
    17,
    9,
    19,
    10,
    21,
    11,
    23,
    12,
    25,
    13,
    27,
    14,
    29,
    15,
    31,
    16,
    33,
    17,
    35,
    18,
    37,
    19,
    39,
    20,
    41,
    21,
    43,
    22,
    45,
    23,
    47,
    24,
    49,
    25,
    51,
    26,
    53,
    27,
    55,
    28,
    57,
    29,
    59,
    30,
    61,
    31,
    63,
    32,
    65,
    33,
    67,
    34,
    69,
    35,
    71,
    36,
    73,
    37,
    75,
    38,
    77,
    39,
    79,
    40,
    81,
    41,
    83,
    42,
    85,
    43,
    87,
    44,
    89,
    45,
    91,
    46,
    93,
    47,
    95,
    48,
    97,
    49,
    99,
    50,
    101,
    51,
    103,
    52,
    105,
    53,
    107,
    54,
    109,
    55,
    111,
    56,
    113,
    57,
    1,
    0,
    10,
    2,
    0,
    9,
    9,
    32,
    32,
    2,
    0,
    10,
    10,
    13,
    13,
    1,
    0,
    48,
    57,
    4,
    0,
    100,
    100,
    104,
    104,
    109,
    109,
    115,
    115,
    3,
    0,
    65,
    90,
    95,
    95,
    97,
    122,
    5,
    0,
    46,
    46,
    48,
    57,
    65,
    90,
    95,
    95,
    97,
    122,
    2,
    0,
    45,
    45,
    47,
    47,
    4,
    0,
    48,
    57,
    65,
    90,
    95,
    95,
    97,
    122,
    4,
    0,
    10,
    10,
    13,
    13,
    34,
    34,
    92,
    92,
    4,
    0,
    10,
    10,
    13,
    13,
    39,
    39,
    92,
    92,
    456,
    0,
    1,
    1,
    0,
    0,
    0,
    0,
    3,
    1,
    0,
    0,
    0,
    0,
    5,
    1,
    0,
    0,
    0,
    0,
    7,
    1,
    0,
    0,
    0,
    0,
    9,
    1,
    0,
    0,
    0,
    0,
    11,
    1,
    0,
    0,
    0,
    0,
    13,
    1,
    0,
    0,
    0,
    0,
    15,
    1,
    0,
    0,
    0,
    0,
    17,
    1,
    0,
    0,
    0,
    0,
    19,
    1,
    0,
    0,
    0,
    0,
    21,
    1,
    0,
    0,
    0,
    0,
    23,
    1,
    0,
    0,
    0,
    0,
    25,
    1,
    0,
    0,
    0,
    0,
    27,
    1,
    0,
    0,
    0,
    0,
    29,
    1,
    0,
    0,
    0,
    0,
    31,
    1,
    0,
    0,
    0,
    0,
    33,
    1,
    0,
    0,
    0,
    0,
    35,
    1,
    0,
    0,
    0,
    0,
    37,
    1,
    0,
    0,
    0,
    0,
    39,
    1,
    0,
    0,
    0,
    0,
    41,
    1,
    0,
    0,
    0,
    0,
    43,
    1,
    0,
    0,
    0,
    0,
    45,
    1,
    0,
    0,
    0,
    0,
    47,
    1,
    0,
    0,
    0,
    0,
    49,
    1,
    0,
    0,
    0,
    0,
    51,
    1,
    0,
    0,
    0,
    0,
    53,
    1,
    0,
    0,
    0,
    0,
    55,
    1,
    0,
    0,
    0,
    0,
    57,
    1,
    0,
    0,
    0,
    0,
    59,
    1,
    0,
    0,
    0,
    0,
    61,
    1,
    0,
    0,
    0,
    0,
    63,
    1,
    0,
    0,
    0,
    0,
    65,
    1,
    0,
    0,
    0,
    0,
    67,
    1,
    0,
    0,
    0,
    0,
    69,
    1,
    0,
    0,
    0,
    0,
    71,
    1,
    0,
    0,
    0,
    0,
    73,
    1,
    0,
    0,
    0,
    0,
    75,
    1,
    0,
    0,
    0,
    0,
    77,
    1,
    0,
    0,
    0,
    0,
    79,
    1,
    0,
    0,
    0,
    0,
    81,
    1,
    0,
    0,
    0,
    0,
    83,
    1,
    0,
    0,
    0,
    0,
    85,
    1,
    0,
    0,
    0,
    0,
    87,
    1,
    0,
    0,
    0,
    0,
    89,
    1,
    0,
    0,
    0,
    0,
    91,
    1,
    0,
    0,
    0,
    0,
    93,
    1,
    0,
    0,
    0,
    0,
    95,
    1,
    0,
    0,
    0,
    0,
    97,
    1,
    0,
    0,
    0,
    0,
    99,
    1,
    0,
    0,
    0,
    0,
    101,
    1,
    0,
    0,
    0,
    0,
    103,
    1,
    0,
    0,
    0,
    0,
    105,
    1,
    0,
    0,
    0,
    0,
    107,
    1,
    0,
    0,
    0,
    0,
    109,
    1,
    0,
    0,
    0,
    0,
    111,
    1,
    0,
    0,
    0,
    0,
    113,
    1,
    0,
    0,
    0,
    1,
    115,
    1,
    0,
    0,
    0,
    3,
    122,
    1,
    0,
    0,
    0,
    5,
    127,
    1,
    0,
    0,
    0,
    7,
    133,
    1,
    0,
    0,
    0,
    9,
    140,
    1,
    0,
    0,
    0,
    11,
    146,
    1,
    0,
    0,
    0,
    13,
    155,
    1,
    0,
    0,
    0,
    15,
    162,
    1,
    0,
    0,
    0,
    17,
    171,
    1,
    0,
    0,
    0,
    19,
    178,
    1,
    0,
    0,
    0,
    21,
    186,
    1,
    0,
    0,
    0,
    23,
    192,
    1,
    0,
    0,
    0,
    25,
    199,
    1,
    0,
    0,
    0,
    27,
    204,
    1,
    0,
    0,
    0,
    29,
    207,
    1,
    0,
    0,
    0,
    31,
    212,
    1,
    0,
    0,
    0,
    33,
    215,
    1,
    0,
    0,
    0,
    35,
    220,
    1,
    0,
    0,
    0,
    37,
    222,
    1,
    0,
    0,
    0,
    39,
    224,
    1,
    0,
    0,
    0,
    41,
    226,
    1,
    0,
    0,
    0,
    43,
    228,
    1,
    0,
    0,
    0,
    45,
    230,
    1,
    0,
    0,
    0,
    47,
    232,
    1,
    0,
    0,
    0,
    49,
    234,
    1,
    0,
    0,
    0,
    51,
    236,
    1,
    0,
    0,
    0,
    53,
    238,
    1,
    0,
    0,
    0,
    55,
    240,
    1,
    0,
    0,
    0,
    57,
    242,
    1,
    0,
    0,
    0,
    59,
    245,
    1,
    0,
    0,
    0,
    61,
    247,
    1,
    0,
    0,
    0,
    63,
    249,
    1,
    0,
    0,
    0,
    65,
    252,
    1,
    0,
    0,
    0,
    67,
    255,
    1,
    0,
    0,
    0,
    69,
    258,
    1,
    0,
    0,
    0,
    71,
    260,
    1,
    0,
    0,
    0,
    73,
    263,
    1,
    0,
    0,
    0,
    75,
    266,
    1,
    0,
    0,
    0,
    77,
    269,
    1,
    0,
    0,
    0,
    79,
    273,
    1,
    0,
    0,
    0,
    81,
    283,
    1,
    0,
    0,
    0,
    83,
    289,
    1,
    0,
    0,
    0,
    85,
    300,
    1,
    0,
    0,
    0,
    87,
    314,
    1,
    0,
    0,
    0,
    89,
    318,
    1,
    0,
    0,
    0,
    91,
    321,
    1,
    0,
    0,
    0,
    93,
    324,
    1,
    0,
    0,
    0,
    95,
    327,
    1,
    0,
    0,
    0,
    97,
    330,
    1,
    0,
    0,
    0,
    99,
    342,
    1,
    0,
    0,
    0,
    101,
    344,
    1,
    0,
    0,
    0,
    103,
    350,
    1,
    0,
    0,
    0,
    105,
    360,
    1,
    0,
    0,
    0,
    107,
    375,
    1,
    0,
    0,
    0,
    109,
    392,
    1,
    0,
    0,
    0,
    111,
    399,
    1,
    0,
    0,
    0,
    113,
    433,
    1,
    0,
    0,
    0,
    115,
    116,
    5,
    112,
    0,
    0,
    116,
    117,
    5,
    111,
    0,
    0,
    117,
    118,
    5,
    108,
    0,
    0,
    118,
    119,
    5,
    105,
    0,
    0,
    119,
    120,
    5,
    99,
    0,
    0,
    120,
    121,
    5,
    121,
    0,
    0,
    121,
    2,
    1,
    0,
    0,
    0,
    122,
    123,
    5,
    116,
    0,
    0,
    123,
    124,
    5,
    111,
    0,
    0,
    124,
    125,
    5,
    111,
    0,
    0,
    125,
    126,
    5,
    108,
    0,
    0,
    126,
    4,
    1,
    0,
    0,
    0,
    127,
    128,
    5,
    115,
    0,
    0,
    128,
    129,
    5,
    116,
    0,
    0,
    129,
    130,
    5,
    111,
    0,
    0,
    130,
    131,
    5,
    114,
    0,
    0,
    131,
    132,
    5,
    101,
    0,
    0,
    132,
    6,
    1,
    0,
    0,
    0,
    133,
    134,
    5,
    115,
    0,
    0,
    134,
    135,
    5,
    99,
    0,
    0,
    135,
    136,
    5,
    104,
    0,
    0,
    136,
    137,
    5,
    101,
    0,
    0,
    137,
    138,
    5,
    109,
    0,
    0,
    138,
    139,
    5,
    97,
    0,
    0,
    139,
    8,
    1,
    0,
    0,
    0,
    140,
    141,
    5,
    97,
    0,
    0,
    141,
    142,
    5,
    103,
    0,
    0,
    142,
    143,
    5,
    101,
    0,
    0,
    143,
    144,
    5,
    110,
    0,
    0,
    144,
    145,
    5,
    116,
    0,
    0,
    145,
    10,
    1,
    0,
    0,
    0,
    146,
    147,
    5,
    112,
    0,
    0,
    147,
    148,
    5,
    105,
    0,
    0,
    148,
    149,
    5,
    112,
    0,
    0,
    149,
    150,
    5,
    101,
    0,
    0,
    150,
    151,
    5,
    108,
    0,
    0,
    151,
    152,
    5,
    105,
    0,
    0,
    152,
    153,
    5,
    110,
    0,
    0,
    153,
    154,
    5,
    101,
    0,
    0,
    154,
    12,
    1,
    0,
    0,
    0,
    155,
    156,
    5,
    101,
    0,
    0,
    156,
    157,
    5,
    113,
    0,
    0,
    157,
    158,
    5,
    117,
    0,
    0,
    158,
    159,
    5,
    105,
    0,
    0,
    159,
    160,
    5,
    112,
    0,
    0,
    160,
    161,
    5,
    115,
    0,
    0,
    161,
    14,
    1,
    0,
    0,
    0,
    162,
    163,
    5,
    114,
    0,
    0,
    163,
    164,
    5,
    101,
    0,
    0,
    164,
    165,
    5,
    113,
    0,
    0,
    165,
    166,
    5,
    117,
    0,
    0,
    166,
    167,
    5,
    105,
    0,
    0,
    167,
    168,
    5,
    114,
    0,
    0,
    168,
    169,
    5,
    101,
    0,
    0,
    169,
    170,
    5,
    115,
    0,
    0,
    170,
    16,
    1,
    0,
    0,
    0,
    171,
    172,
    5,
    115,
    0,
    0,
    172,
    173,
    5,
    121,
    0,
    0,
    173,
    174,
    5,
    115,
    0,
    0,
    174,
    175,
    5,
    116,
    0,
    0,
    175,
    176,
    5,
    101,
    0,
    0,
    176,
    177,
    5,
    109,
    0,
    0,
    177,
    18,
    1,
    0,
    0,
    0,
    178,
    179,
    5,
    99,
    0,
    0,
    179,
    180,
    5,
    111,
    0,
    0,
    180,
    181,
    5,
    110,
    0,
    0,
    181,
    182,
    5,
    116,
    0,
    0,
    182,
    183,
    5,
    101,
    0,
    0,
    183,
    184,
    5,
    120,
    0,
    0,
    184,
    185,
    5,
    116,
    0,
    0,
    185,
    20,
    1,
    0,
    0,
    0,
    186,
    187,
    5,
    121,
    0,
    0,
    187,
    188,
    5,
    105,
    0,
    0,
    188,
    189,
    5,
    101,
    0,
    0,
    189,
    190,
    5,
    108,
    0,
    0,
    190,
    191,
    5,
    100,
    0,
    0,
    191,
    22,
    1,
    0,
    0,
    0,
    192,
    193,
    5,
    108,
    0,
    0,
    193,
    194,
    5,
    105,
    0,
    0,
    194,
    195,
    5,
    115,
    0,
    0,
    195,
    196,
    5,
    116,
    0,
    0,
    196,
    197,
    5,
    101,
    0,
    0,
    197,
    198,
    5,
    110,
    0,
    0,
    198,
    24,
    1,
    0,
    0,
    0,
    199,
    200,
    5,
    108,
    0,
    0,
    200,
    201,
    5,
    111,
    0,
    0,
    201,
    202,
    5,
    111,
    0,
    0,
    202,
    203,
    5,
    112,
    0,
    0,
    203,
    26,
    1,
    0,
    0,
    0,
    204,
    205,
    5,
    97,
    0,
    0,
    205,
    206,
    5,
    115,
    0,
    0,
    206,
    28,
    1,
    0,
    0,
    0,
    207,
    208,
    5,
    101,
    0,
    0,
    208,
    209,
    5,
    97,
    0,
    0,
    209,
    210,
    5,
    99,
    0,
    0,
    210,
    211,
    5,
    104,
    0,
    0,
    211,
    30,
    1,
    0,
    0,
    0,
    212,
    213,
    5,
    105,
    0,
    0,
    213,
    214,
    5,
    110,
    0,
    0,
    214,
    32,
    1,
    0,
    0,
    0,
    215,
    216,
    5,
    101,
    0,
    0,
    216,
    217,
    5,
    108,
    0,
    0,
    217,
    218,
    5,
    115,
    0,
    0,
    218,
    219,
    5,
    101,
    0,
    0,
    219,
    34,
    1,
    0,
    0,
    0,
    220,
    221,
    5,
    46,
    0,
    0,
    221,
    36,
    1,
    0,
    0,
    0,
    222,
    223,
    5,
    58,
    0,
    0,
    223,
    38,
    1,
    0,
    0,
    0,
    224,
    225,
    5,
    38,
    0,
    0,
    225,
    40,
    1,
    0,
    0,
    0,
    226,
    227,
    5,
    40,
    0,
    0,
    227,
    42,
    1,
    0,
    0,
    0,
    228,
    229,
    5,
    41,
    0,
    0,
    229,
    44,
    1,
    0,
    0,
    0,
    230,
    231,
    5,
    123,
    0,
    0,
    231,
    46,
    1,
    0,
    0,
    0,
    232,
    233,
    5,
    44,
    0,
    0,
    233,
    48,
    1,
    0,
    0,
    0,
    234,
    235,
    5,
    125,
    0,
    0,
    235,
    50,
    1,
    0,
    0,
    0,
    236,
    237,
    5,
    91,
    0,
    0,
    237,
    52,
    1,
    0,
    0,
    0,
    238,
    239,
    5,
    93,
    0,
    0,
    239,
    54,
    1,
    0,
    0,
    0,
    240,
    241,
    5,
    64,
    0,
    0,
    241,
    56,
    1,
    0,
    0,
    0,
    242,
    243,
    5,
    45,
    0,
    0,
    243,
    244,
    5,
    62,
    0,
    0,
    244,
    58,
    1,
    0,
    0,
    0,
    245,
    246,
    5,
    60,
    0,
    0,
    246,
    60,
    1,
    0,
    0,
    0,
    247,
    248,
    5,
    62,
    0,
    0,
    248,
    62,
    1,
    0,
    0,
    0,
    249,
    250,
    5,
    61,
    0,
    0,
    250,
    251,
    5,
    62,
    0,
    0,
    251,
    64,
    1,
    0,
    0,
    0,
    252,
    253,
    5,
    124,
    0,
    0,
    253,
    254,
    5,
    124,
    0,
    0,
    254,
    66,
    1,
    0,
    0,
    0,
    255,
    256,
    5,
    38,
    0,
    0,
    256,
    257,
    5,
    38,
    0,
    0,
    257,
    68,
    1,
    0,
    0,
    0,
    258,
    259,
    5,
    33,
    0,
    0,
    259,
    70,
    1,
    0,
    0,
    0,
    260,
    261,
    5,
    61,
    0,
    0,
    261,
    262,
    5,
    61,
    0,
    0,
    262,
    72,
    1,
    0,
    0,
    0,
    263,
    264,
    5,
    33,
    0,
    0,
    264,
    265,
    5,
    61,
    0,
    0,
    265,
    74,
    1,
    0,
    0,
    0,
    266,
    267,
    5,
    62,
    0,
    0,
    267,
    268,
    5,
    61,
    0,
    0,
    268,
    76,
    1,
    0,
    0,
    0,
    269,
    270,
    5,
    60,
    0,
    0,
    270,
    271,
    5,
    61,
    0,
    0,
    271,
    78,
    1,
    0,
    0,
    0,
    272,
    274,
    7,
    0,
    0,
    0,
    273,
    272,
    1,
    0,
    0,
    0,
    274,
    275,
    1,
    0,
    0,
    0,
    275,
    273,
    1,
    0,
    0,
    0,
    275,
    276,
    1,
    0,
    0,
    0,
    276,
    277,
    1,
    0,
    0,
    0,
    277,
    278,
    6,
    39,
    0,
    0,
    278,
    80,
    1,
    0,
    0,
    0,
    279,
    281,
    5,
    13,
    0,
    0,
    280,
    279,
    1,
    0,
    0,
    0,
    280,
    281,
    1,
    0,
    0,
    0,
    281,
    282,
    1,
    0,
    0,
    0,
    282,
    284,
    5,
    10,
    0,
    0,
    283,
    280,
    1,
    0,
    0,
    0,
    284,
    285,
    1,
    0,
    0,
    0,
    285,
    283,
    1,
    0,
    0,
    0,
    285,
    286,
    1,
    0,
    0,
    0,
    286,
    287,
    1,
    0,
    0,
    0,
    287,
    288,
    6,
    40,
    0,
    0,
    288,
    82,
    1,
    0,
    0,
    0,
    289,
    290,
    5,
    47,
    0,
    0,
    290,
    291,
    5,
    47,
    0,
    0,
    291,
    295,
    1,
    0,
    0,
    0,
    292,
    294,
    8,
    1,
    0,
    0,
    293,
    292,
    1,
    0,
    0,
    0,
    294,
    297,
    1,
    0,
    0,
    0,
    295,
    293,
    1,
    0,
    0,
    0,
    295,
    296,
    1,
    0,
    0,
    0,
    296,
    298,
    1,
    0,
    0,
    0,
    297,
    295,
    1,
    0,
    0,
    0,
    298,
    299,
    6,
    41,
    0,
    0,
    299,
    84,
    1,
    0,
    0,
    0,
    300,
    301,
    5,
    47,
    0,
    0,
    301,
    302,
    5,
    42,
    0,
    0,
    302,
    306,
    1,
    0,
    0,
    0,
    303,
    305,
    9,
    0,
    0,
    0,
    304,
    303,
    1,
    0,
    0,
    0,
    305,
    308,
    1,
    0,
    0,
    0,
    306,
    307,
    1,
    0,
    0,
    0,
    306,
    304,
    1,
    0,
    0,
    0,
    307,
    309,
    1,
    0,
    0,
    0,
    308,
    306,
    1,
    0,
    0,
    0,
    309,
    310,
    5,
    42,
    0,
    0,
    310,
    311,
    5,
    47,
    0,
    0,
    311,
    312,
    1,
    0,
    0,
    0,
    312,
    313,
    6,
    42,
    0,
    0,
    313,
    86,
    1,
    0,
    0,
    0,
    314,
    315,
    5,
    124,
    0,
    0,
    315,
    316,
    5,
    60,
    0,
    0,
    316,
    317,
    5,
    62,
    0,
    0,
    317,
    88,
    1,
    0,
    0,
    0,
    318,
    319,
    5,
    124,
    0,
    0,
    319,
    320,
    5,
    42,
    0,
    0,
    320,
    90,
    1,
    0,
    0,
    0,
    321,
    322,
    5,
    124,
    0,
    0,
    322,
    323,
    5,
    33,
    0,
    0,
    323,
    92,
    1,
    0,
    0,
    0,
    324,
    325,
    5,
    124,
    0,
    0,
    325,
    326,
    5,
    63,
    0,
    0,
    326,
    94,
    1,
    0,
    0,
    0,
    327,
    328,
    5,
    126,
    0,
    0,
    328,
    329,
    5,
    62,
    0,
    0,
    329,
    96,
    1,
    0,
    0,
    0,
    330,
    331,
    5,
    124,
    0,
    0,
    331,
    332,
    5,
    62,
    0,
    0,
    332,
    98,
    1,
    0,
    0,
    0,
    333,
    334,
    5,
    116,
    0,
    0,
    334,
    335,
    5,
    114,
    0,
    0,
    335,
    336,
    5,
    117,
    0,
    0,
    336,
    343,
    5,
    101,
    0,
    0,
    337,
    338,
    5,
    102,
    0,
    0,
    338,
    339,
    5,
    97,
    0,
    0,
    339,
    340,
    5,
    108,
    0,
    0,
    340,
    341,
    5,
    115,
    0,
    0,
    341,
    343,
    5,
    101,
    0,
    0,
    342,
    333,
    1,
    0,
    0,
    0,
    342,
    337,
    1,
    0,
    0,
    0,
    343,
    100,
    1,
    0,
    0,
    0,
    344,
    345,
    5,
    110,
    0,
    0,
    345,
    346,
    5,
    117,
    0,
    0,
    346,
    347,
    5,
    108,
    0,
    0,
    347,
    348,
    5,
    108,
    0,
    0,
    348,
    102,
    1,
    0,
    0,
    0,
    349,
    351,
    7,
    2,
    0,
    0,
    350,
    349,
    1,
    0,
    0,
    0,
    351,
    352,
    1,
    0,
    0,
    0,
    352,
    350,
    1,
    0,
    0,
    0,
    352,
    353,
    1,
    0,
    0,
    0,
    353,
    357,
    1,
    0,
    0,
    0,
    354,
    355,
    5,
    109,
    0,
    0,
    355,
    358,
    5,
    115,
    0,
    0,
    356,
    358,
    7,
    3,
    0,
    0,
    357,
    354,
    1,
    0,
    0,
    0,
    357,
    356,
    1,
    0,
    0,
    0,
    358,
    104,
    1,
    0,
    0,
    0,
    359,
    361,
    5,
    45,
    0,
    0,
    360,
    359,
    1,
    0,
    0,
    0,
    360,
    361,
    1,
    0,
    0,
    0,
    361,
    363,
    1,
    0,
    0,
    0,
    362,
    364,
    7,
    2,
    0,
    0,
    363,
    362,
    1,
    0,
    0,
    0,
    364,
    365,
    1,
    0,
    0,
    0,
    365,
    363,
    1,
    0,
    0,
    0,
    365,
    366,
    1,
    0,
    0,
    0,
    366,
    373,
    1,
    0,
    0,
    0,
    367,
    369,
    5,
    46,
    0,
    0,
    368,
    370,
    7,
    2,
    0,
    0,
    369,
    368,
    1,
    0,
    0,
    0,
    370,
    371,
    1,
    0,
    0,
    0,
    371,
    369,
    1,
    0,
    0,
    0,
    371,
    372,
    1,
    0,
    0,
    0,
    372,
    374,
    1,
    0,
    0,
    0,
    373,
    367,
    1,
    0,
    0,
    0,
    373,
    374,
    1,
    0,
    0,
    0,
    374,
    106,
    1,
    0,
    0,
    0,
    375,
    379,
    7,
    4,
    0,
    0,
    376,
    378,
    7,
    5,
    0,
    0,
    377,
    376,
    1,
    0,
    0,
    0,
    378,
    381,
    1,
    0,
    0,
    0,
    379,
    377,
    1,
    0,
    0,
    0,
    379,
    380,
    1,
    0,
    0,
    0,
    380,
    388,
    1,
    0,
    0,
    0,
    381,
    379,
    1,
    0,
    0,
    0,
    382,
    384,
    7,
    6,
    0,
    0,
    383,
    385,
    7,
    5,
    0,
    0,
    384,
    383,
    1,
    0,
    0,
    0,
    385,
    386,
    1,
    0,
    0,
    0,
    386,
    384,
    1,
    0,
    0,
    0,
    386,
    387,
    1,
    0,
    0,
    0,
    387,
    389,
    1,
    0,
    0,
    0,
    388,
    382,
    1,
    0,
    0,
    0,
    389,
    390,
    1,
    0,
    0,
    0,
    390,
    388,
    1,
    0,
    0,
    0,
    390,
    391,
    1,
    0,
    0,
    0,
    391,
    108,
    1,
    0,
    0,
    0,
    392,
    396,
    7,
    4,
    0,
    0,
    393,
    395,
    7,
    7,
    0,
    0,
    394,
    393,
    1,
    0,
    0,
    0,
    395,
    398,
    1,
    0,
    0,
    0,
    396,
    394,
    1,
    0,
    0,
    0,
    396,
    397,
    1,
    0,
    0,
    0,
    397,
    110,
    1,
    0,
    0,
    0,
    398,
    396,
    1,
    0,
    0,
    0,
    399,
    400,
    5,
    34,
    0,
    0,
    400,
    401,
    5,
    34,
    0,
    0,
    401,
    402,
    5,
    34,
    0,
    0,
    402,
    406,
    1,
    0,
    0,
    0,
    403,
    405,
    9,
    0,
    0,
    0,
    404,
    403,
    1,
    0,
    0,
    0,
    405,
    408,
    1,
    0,
    0,
    0,
    406,
    407,
    1,
    0,
    0,
    0,
    406,
    404,
    1,
    0,
    0,
    0,
    407,
    409,
    1,
    0,
    0,
    0,
    408,
    406,
    1,
    0,
    0,
    0,
    409,
    410,
    5,
    34,
    0,
    0,
    410,
    411,
    5,
    34,
    0,
    0,
    411,
    412,
    5,
    34,
    0,
    0,
    412,
    112,
    1,
    0,
    0,
    0,
    413,
    419,
    5,
    34,
    0,
    0,
    414,
    418,
    8,
    8,
    0,
    0,
    415,
    416,
    5,
    92,
    0,
    0,
    416,
    418,
    9,
    0,
    0,
    0,
    417,
    414,
    1,
    0,
    0,
    0,
    417,
    415,
    1,
    0,
    0,
    0,
    418,
    421,
    1,
    0,
    0,
    0,
    419,
    417,
    1,
    0,
    0,
    0,
    419,
    420,
    1,
    0,
    0,
    0,
    420,
    422,
    1,
    0,
    0,
    0,
    421,
    419,
    1,
    0,
    0,
    0,
    422,
    434,
    5,
    34,
    0,
    0,
    423,
    429,
    5,
    39,
    0,
    0,
    424,
    428,
    8,
    9,
    0,
    0,
    425,
    426,
    5,
    92,
    0,
    0,
    426,
    428,
    9,
    0,
    0,
    0,
    427,
    424,
    1,
    0,
    0,
    0,
    427,
    425,
    1,
    0,
    0,
    0,
    428,
    431,
    1,
    0,
    0,
    0,
    429,
    427,
    1,
    0,
    0,
    0,
    429,
    430,
    1,
    0,
    0,
    0,
    430,
    432,
    1,
    0,
    0,
    0,
    431,
    429,
    1,
    0,
    0,
    0,
    432,
    434,
    5,
    39,
    0,
    0,
    433,
    413,
    1,
    0,
    0,
    0,
    433,
    423,
    1,
    0,
    0,
    0,
    434,
    114,
    1,
    0,
    0,
    0,
    23,
    0,
    275,
    280,
    285,
    295,
    306,
    342,
    352,
    357,
    360,
    365,
    371,
    373,
    379,
    386,
    390,
    396,
    406,
    417,
    419,
    427,
    429,
    433,
    1,
    6,
    0,
    0
  ];
  static __ATN;
  static get _ATN() {
    if (!HaloLexer.__ATN) {
      HaloLexer.__ATN = new ATNDeserializer().deserialize(HaloLexer._serializedATN);
    }
    return HaloLexer.__ATN;
  }
  static vocabulary = new Vocabulary(HaloLexer.literalNames, HaloLexer.symbolicNames, []);
  get vocabulary() {
    return HaloLexer.vocabulary;
  }
  static decisionsToDFA = HaloLexer._ATN.decisionToState.map((ds, index) => new DFA(ds, index));
}

// src/parser/generated/HaloParser.ts
class HaloParser extends Parser {
  static T__0 = 1;
  static T__1 = 2;
  static T__2 = 3;
  static T__3 = 4;
  static T__4 = 5;
  static T__5 = 6;
  static T__6 = 7;
  static T__7 = 8;
  static T__8 = 9;
  static T__9 = 10;
  static T__10 = 11;
  static T__11 = 12;
  static T__12 = 13;
  static T__13 = 14;
  static T__14 = 15;
  static T__15 = 16;
  static T__16 = 17;
  static T__17 = 18;
  static T__18 = 19;
  static T__19 = 20;
  static T__20 = 21;
  static T__21 = 22;
  static T__22 = 23;
  static T__23 = 24;
  static T__24 = 25;
  static T__25 = 26;
  static T__26 = 27;
  static T__27 = 28;
  static T__28 = 29;
  static T__29 = 30;
  static T__30 = 31;
  static T__31 = 32;
  static T__32 = 33;
  static T__33 = 34;
  static T__34 = 35;
  static T__35 = 36;
  static T__36 = 37;
  static T__37 = 38;
  static T__38 = 39;
  static WS = 40;
  static NL = 41;
  static LINE_COMMENT = 42;
  static BLOCK_COMMENT = 43;
  static LOOP = 44;
  static FANOUT = 45;
  static INTERRUPT = 46;
  static GATE = 47;
  static LISTEN = 48;
  static PIPE = 49;
  static BOOL = 50;
  static NULL = 51;
  static DURATION = 52;
  static NUMBER = 53;
  static MODEL_REF = 54;
  static IDENTIFIER = 55;
  static TRIPLE_STRING = 56;
  static STRING = 57;
  static RULE_program = 0;
  static RULE_declaration = 1;
  static RULE_name = 2;
  static RULE_dottedId = 3;
  static RULE_policyDecl = 4;
  static RULE_policyRule = 5;
  static RULE_toolDecl = 6;
  static RULE_storeDecl = 7;
  static RULE_schemaDecl = 8;
  static RULE_schemaField = 9;
  static RULE_agentDecl = 10;
  static RULE_modelRef = 11;
  static RULE_modelParam = 12;
  static RULE_agentModifier = 13;
  static RULE_directive = 14;
  static RULE_directiveArg = 15;
  static RULE_pipelineDecl = 16;
  static RULE_paramList = 17;
  static RULE_param = 18;
  static RULE_typeRef = 19;
  static RULE_pipeline = 20;
  static RULE_pipelineOp = 21;
  static RULE_binding = 22;
  static RULE_branchArm = 23;
  static RULE_fanoutItem = 24;
  static RULE_callExpr = 25;
  static RULE_callArgs = 26;
  static RULE_callArg = 27;
  static RULE_callValue = 28;
  static RULE_listValue = 29;
  static RULE_value = 30;
  static RULE_literal = 31;
  static RULE_expression = 32;
  static RULE_contextRef = 33;
  static RULE_condExpr = 34;
  static RULE_orExpr = 35;
  static RULE_andExpr = 36;
  static RULE_notExpr = 37;
  static RULE_comparison = 38;
  static RULE_compOp = 39;
  static RULE_operand = 40;
  static literalNames = [
    null,
    "'policy'",
    "'tool'",
    "'store'",
    "'schema'",
    "'agent'",
    "'pipeline'",
    "'equips'",
    "'requires'",
    "'system'",
    "'context'",
    "'yield'",
    "'listen'",
    "'loop'",
    "'as'",
    "'each'",
    "'in'",
    "'else'",
    "'.'",
    "':'",
    "'&'",
    "'('",
    "')'",
    "'{'",
    "','",
    "'}'",
    "'['",
    "']'",
    "'@'",
    "'->'",
    "'<'",
    "'>'",
    "'=>'",
    "'||'",
    "'&&'",
    "'!'",
    "'=='",
    "'!='",
    "'>='",
    "'<='",
    null,
    null,
    null,
    null,
    "'|<>'",
    "'|*'",
    "'|!'",
    "'|?'",
    "'~>'",
    "'|>'",
    null,
    "'null'"
  ];
  static symbolicNames = [
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    "WS",
    "NL",
    "LINE_COMMENT",
    "BLOCK_COMMENT",
    "LOOP",
    "FANOUT",
    "INTERRUPT",
    "GATE",
    "LISTEN",
    "PIPE",
    "BOOL",
    "NULL",
    "DURATION",
    "NUMBER",
    "MODEL_REF",
    "IDENTIFIER",
    "TRIPLE_STRING",
    "STRING"
  ];
  static ruleNames = [
    "program",
    "declaration",
    "name",
    "dottedId",
    "policyDecl",
    "policyRule",
    "toolDecl",
    "storeDecl",
    "schemaDecl",
    "schemaField",
    "agentDecl",
    "modelRef",
    "modelParam",
    "agentModifier",
    "directive",
    "directiveArg",
    "pipelineDecl",
    "paramList",
    "param",
    "typeRef",
    "pipeline",
    "pipelineOp",
    "binding",
    "branchArm",
    "fanoutItem",
    "callExpr",
    "callArgs",
    "callArg",
    "callValue",
    "listValue",
    "value",
    "literal",
    "expression",
    "contextRef",
    "condExpr",
    "orExpr",
    "andExpr",
    "notExpr",
    "comparison",
    "compOp",
    "operand"
  ];
  get grammarFileName() {
    return "Halo.g4";
  }
  get literalNames() {
    return HaloParser.literalNames;
  }
  get symbolicNames() {
    return HaloParser.symbolicNames;
  }
  get ruleNames() {
    return HaloParser.ruleNames;
  }
  get serializedATN() {
    return HaloParser._serializedATN;
  }
  createFailedPredicateException(predicate, message) {
    return new FailedPredicateException(this, predicate, message);
  }
  constructor(input) {
    super(input);
    this.interpreter = new ParserATNSimulator(this, HaloParser._ATN, HaloParser.decisionsToDFA, new PredictionContextCache);
  }
  program() {
    let localContext = new ProgramContext(this.context, this.state);
    this.enterRule(localContext, 0, HaloParser.RULE_program);
    let _la;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 85;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        while ((_la & ~31) === 0 && (1 << _la & 268435582) !== 0) {
          {
            {
              this.state = 82;
              this.declaration();
            }
          }
          this.state = 87;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        }
        this.state = 88;
        this.match(HaloParser.EOF);
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  declaration() {
    let localContext = new DeclarationContext(this.context, this.state);
    this.enterRule(localContext, 2, HaloParser.RULE_declaration);
    try {
      this.state = 96;
      this.errorHandler.sync(this);
      switch (this.interpreter.adaptivePredict(this.tokenStream, 1, this.context)) {
        case 1:
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 90;
            this.policyDecl();
          }
          break;
        case 2:
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 91;
            this.toolDecl();
          }
          break;
        case 3:
          this.enterOuterAlt(localContext, 3);
          {
            this.state = 92;
            this.storeDecl();
          }
          break;
        case 4:
          this.enterOuterAlt(localContext, 4);
          {
            this.state = 93;
            this.schemaDecl();
          }
          break;
        case 5:
          this.enterOuterAlt(localContext, 5);
          {
            this.state = 94;
            this.agentDecl();
          }
          break;
        case 6:
          this.enterOuterAlt(localContext, 6);
          {
            this.state = 95;
            this.pipelineDecl();
          }
          break;
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  name() {
    let localContext = new NameContext(this.context, this.state);
    this.enterRule(localContext, 4, HaloParser.RULE_name);
    let _la;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 98;
        _la = this.tokenStream.LA(1);
        if (!((_la & ~31) === 0 && (1 << _la & 262142) !== 0 || _la === 55)) {
          this.errorHandler.recoverInline(this);
        } else {
          this.errorHandler.reportMatch(this);
          this.consume();
        }
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  dottedId() {
    let localContext = new DottedIdContext(this.context, this.state);
    this.enterRule(localContext, 6, HaloParser.RULE_dottedId);
    let _la;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 100;
        this.match(HaloParser.IDENTIFIER);
        this.state = 105;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        while (_la === 18) {
          {
            {
              this.state = 101;
              this.match(HaloParser.T__17);
              this.state = 102;
              this.name();
            }
          }
          this.state = 107;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        }
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  policyDecl() {
    let localContext = new PolicyDeclContext(this.context, this.state);
    this.enterRule(localContext, 8, HaloParser.RULE_policyDecl);
    let _la;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 108;
        this.match(HaloParser.T__0);
        this.state = 109;
        this.match(HaloParser.IDENTIFIER);
        this.state = 110;
        this.match(HaloParser.T__18);
        this.state = 111;
        this.policyRule();
        this.state = 116;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        while (_la === 20) {
          {
            {
              this.state = 112;
              this.match(HaloParser.T__19);
              this.state = 113;
              this.policyRule();
            }
          }
          this.state = 118;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        }
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  policyRule() {
    let localContext = new PolicyRuleContext(this.context, this.state);
    this.enterRule(localContext, 10, HaloParser.RULE_policyRule);
    let _la;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 119;
        this.match(HaloParser.IDENTIFIER);
        this.state = 120;
        this.match(HaloParser.T__20);
        this.state = 122;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        if ((_la & ~31) === 0 && (1 << _la & 67371006) !== 0 || (_la - 50 & ~31) === 0 && (1 << _la - 50 & 255) !== 0) {
          {
            this.state = 121;
            this.callArgs();
          }
        }
        this.state = 124;
        this.match(HaloParser.T__21);
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  toolDecl() {
    let localContext = new ToolDeclContext(this.context, this.state);
    this.enterRule(localContext, 12, HaloParser.RULE_toolDecl);
    let _la;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 126;
        this.match(HaloParser.T__1);
        this.state = 127;
        this.match(HaloParser.IDENTIFIER);
        this.state = 128;
        this.match(HaloParser.T__18);
        this.state = 129;
        this.match(HaloParser.IDENTIFIER);
        this.state = 130;
        this.match(HaloParser.T__20);
        this.state = 132;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        if ((_la & ~31) === 0 && (1 << _la & 67371006) !== 0 || (_la - 50 & ~31) === 0 && (1 << _la - 50 & 255) !== 0) {
          {
            this.state = 131;
            this.callArgs();
          }
        }
        this.state = 134;
        this.match(HaloParser.T__21);
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  storeDecl() {
    let localContext = new StoreDeclContext(this.context, this.state);
    this.enterRule(localContext, 14, HaloParser.RULE_storeDecl);
    let _la;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 136;
        this.match(HaloParser.T__2);
        this.state = 137;
        this.match(HaloParser.IDENTIFIER);
        this.state = 138;
        this.match(HaloParser.T__18);
        this.state = 139;
        this.match(HaloParser.IDENTIFIER);
        this.state = 140;
        this.match(HaloParser.T__20);
        this.state = 142;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        if ((_la & ~31) === 0 && (1 << _la & 67371006) !== 0 || (_la - 50 & ~31) === 0 && (1 << _la - 50 & 255) !== 0) {
          {
            this.state = 141;
            this.callArgs();
          }
        }
        this.state = 144;
        this.match(HaloParser.T__21);
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  schemaDecl() {
    let localContext = new SchemaDeclContext(this.context, this.state);
    this.enterRule(localContext, 16, HaloParser.RULE_schemaDecl);
    let _la;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 146;
        this.match(HaloParser.T__3);
        this.state = 147;
        this.match(HaloParser.IDENTIFIER);
        this.state = 148;
        this.match(HaloParser.T__22);
        this.state = 155;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        while ((_la & ~31) === 0 && (1 << _la & 262142) !== 0 || _la === 55) {
          {
            {
              this.state = 149;
              this.schemaField();
              this.state = 151;
              this.errorHandler.sync(this);
              _la = this.tokenStream.LA(1);
              if (_la === 24) {
                {
                  this.state = 150;
                  this.match(HaloParser.T__23);
                }
              }
            }
          }
          this.state = 157;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        }
        this.state = 158;
        this.match(HaloParser.T__24);
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  schemaField() {
    let localContext = new SchemaFieldContext(this.context, this.state);
    this.enterRule(localContext, 18, HaloParser.RULE_schemaField);
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 160;
        this.name();
        this.state = 161;
        this.match(HaloParser.T__18);
        this.state = 162;
        this.typeRef();
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  agentDecl() {
    let localContext = new AgentDeclContext(this.context, this.state);
    this.enterRule(localContext, 20, HaloParser.RULE_agentDecl);
    let _la;
    try {
      let alternative;
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 167;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        while (_la === 28) {
          {
            {
              this.state = 164;
              this.directive();
            }
          }
          this.state = 169;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        }
        this.state = 170;
        this.match(HaloParser.T__4);
        this.state = 171;
        this.match(HaloParser.IDENTIFIER);
        this.state = 172;
        this.match(HaloParser.T__25);
        this.state = 173;
        this.modelRef();
        this.state = 178;
        this.errorHandler.sync(this);
        alternative = this.interpreter.adaptivePredict(this.tokenStream, 10, this.context);
        while (alternative !== 2 && alternative !== ATN.INVALID_ALT_NUMBER) {
          if (alternative === 1) {
            {
              {
                this.state = 174;
                this.match(HaloParser.T__23);
                this.state = 175;
                this.modelParam();
              }
            }
          }
          this.state = 180;
          this.errorHandler.sync(this);
          alternative = this.interpreter.adaptivePredict(this.tokenStream, 10, this.context);
        }
        this.state = 182;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        if (_la === 24) {
          {
            this.state = 181;
            this.match(HaloParser.T__23);
          }
        }
        this.state = 184;
        this.match(HaloParser.T__26);
        this.state = 188;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        while ((_la & ~31) === 0 && (1 << _la & 896) !== 0) {
          {
            {
              this.state = 185;
              this.agentModifier();
            }
          }
          this.state = 190;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        }
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  modelRef() {
    let localContext = new ModelRefContext(this.context, this.state);
    this.enterRule(localContext, 22, HaloParser.RULE_modelRef);
    try {
      this.state = 194;
      this.errorHandler.sync(this);
      switch (this.tokenStream.LA(1)) {
        case HaloParser.MODEL_REF:
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 191;
            this.match(HaloParser.MODEL_REF);
          }
          break;
        case HaloParser.STRING:
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 192;
            this.match(HaloParser.STRING);
          }
          break;
        case HaloParser.IDENTIFIER:
          this.enterOuterAlt(localContext, 3);
          {
            this.state = 193;
            this.dottedId();
          }
          break;
        default:
          throw new NoViableAltException(this);
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  modelParam() {
    let localContext = new ModelParamContext(this.context, this.state);
    this.enterRule(localContext, 24, HaloParser.RULE_modelParam);
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 196;
        this.name();
        this.state = 197;
        this.match(HaloParser.T__18);
        this.state = 198;
        this.value();
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  agentModifier() {
    let localContext = new AgentModifierContext(this.context, this.state);
    this.enterRule(localContext, 26, HaloParser.RULE_agentModifier);
    let _la;
    try {
      this.state = 220;
      this.errorHandler.sync(this);
      switch (this.tokenStream.LA(1)) {
        case HaloParser.T__6:
          localContext = new EquipsModifierContext(localContext);
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 200;
            this.match(HaloParser.T__6);
            this.state = 201;
            this.match(HaloParser.IDENTIFIER);
            this.state = 206;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 24) {
              {
                {
                  this.state = 202;
                  this.match(HaloParser.T__23);
                  this.state = 203;
                  this.match(HaloParser.IDENTIFIER);
                }
              }
              this.state = 208;
              this.errorHandler.sync(this);
              _la = this.tokenStream.LA(1);
            }
          }
          break;
        case HaloParser.T__7:
          localContext = new RequiresModifierContext(localContext);
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 209;
            this.match(HaloParser.T__7);
            this.state = 210;
            this.match(HaloParser.IDENTIFIER);
            this.state = 215;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 24) {
              {
                {
                  this.state = 211;
                  this.match(HaloParser.T__23);
                  this.state = 212;
                  this.match(HaloParser.IDENTIFIER);
                }
              }
              this.state = 217;
              this.errorHandler.sync(this);
              _la = this.tokenStream.LA(1);
            }
          }
          break;
        case HaloParser.T__8:
          localContext = new SystemModifierContext(localContext);
          this.enterOuterAlt(localContext, 3);
          {
            this.state = 218;
            this.match(HaloParser.T__8);
            this.state = 219;
            _la = this.tokenStream.LA(1);
            if (!(_la === 56 || _la === 57)) {
              this.errorHandler.recoverInline(this);
            } else {
              this.errorHandler.reportMatch(this);
              this.consume();
            }
          }
          break;
        default:
          throw new NoViableAltException(this);
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  directive() {
    let localContext = new DirectiveContext(this.context, this.state);
    this.enterRule(localContext, 28, HaloParser.RULE_directive);
    let _la;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 222;
        this.match(HaloParser.T__27);
        this.state = 223;
        this.name();
        this.state = 236;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        if (_la === 21) {
          {
            this.state = 224;
            this.match(HaloParser.T__20);
            this.state = 233;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((_la - 50 & ~31) === 0 && (1 << _la - 50 & 255) !== 0) {
              {
                this.state = 225;
                this.directiveArg();
                this.state = 230;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 24) {
                  {
                    {
                      this.state = 226;
                      this.match(HaloParser.T__23);
                      this.state = 227;
                      this.directiveArg();
                    }
                  }
                  this.state = 232;
                  this.errorHandler.sync(this);
                  _la = this.tokenStream.LA(1);
                }
              }
            }
            this.state = 235;
            this.match(HaloParser.T__21);
          }
        }
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  directiveArg() {
    let localContext = new DirectiveArgContext(this.context, this.state);
    this.enterRule(localContext, 30, HaloParser.RULE_directiveArg);
    try {
      this.state = 241;
      this.errorHandler.sync(this);
      switch (this.tokenStream.LA(1)) {
        case HaloParser.BOOL:
        case HaloParser.NULL:
        case HaloParser.DURATION:
        case HaloParser.NUMBER:
        case HaloParser.TRIPLE_STRING:
        case HaloParser.STRING:
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 238;
            this.literal();
          }
          break;
        case HaloParser.MODEL_REF:
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 239;
            this.match(HaloParser.MODEL_REF);
          }
          break;
        case HaloParser.IDENTIFIER:
          this.enterOuterAlt(localContext, 3);
          {
            this.state = 240;
            this.dottedId();
          }
          break;
        default:
          throw new NoViableAltException(this);
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  pipelineDecl() {
    let localContext = new PipelineDeclContext(this.context, this.state);
    this.enterRule(localContext, 32, HaloParser.RULE_pipelineDecl);
    let _la;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 246;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        while (_la === 28) {
          {
            {
              this.state = 243;
              this.directive();
            }
          }
          this.state = 248;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        }
        this.state = 249;
        this.match(HaloParser.T__5);
        this.state = 250;
        this.match(HaloParser.IDENTIFIER);
        this.state = 251;
        this.match(HaloParser.T__20);
        this.state = 253;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        if (_la === 55) {
          {
            this.state = 252;
            this.paramList();
          }
        }
        this.state = 255;
        this.match(HaloParser.T__21);
        this.state = 258;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        if (_la === 29) {
          {
            this.state = 256;
            this.match(HaloParser.T__28);
            this.state = 257;
            this.typeRef();
          }
        }
        this.state = 260;
        this.match(HaloParser.T__18);
        this.state = 261;
        this.pipeline();
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  paramList() {
    let localContext = new ParamListContext(this.context, this.state);
    this.enterRule(localContext, 34, HaloParser.RULE_paramList);
    let _la;
    try {
      let alternative;
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 263;
        this.param();
        this.state = 268;
        this.errorHandler.sync(this);
        alternative = this.interpreter.adaptivePredict(this.tokenStream, 24, this.context);
        while (alternative !== 2 && alternative !== ATN.INVALID_ALT_NUMBER) {
          if (alternative === 1) {
            {
              {
                this.state = 264;
                this.match(HaloParser.T__23);
                this.state = 265;
                this.param();
              }
            }
          }
          this.state = 270;
          this.errorHandler.sync(this);
          alternative = this.interpreter.adaptivePredict(this.tokenStream, 24, this.context);
        }
        this.state = 272;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        if (_la === 24) {
          {
            this.state = 271;
            this.match(HaloParser.T__23);
          }
        }
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  param() {
    let localContext = new ParamContext(this.context, this.state);
    this.enterRule(localContext, 36, HaloParser.RULE_param);
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 274;
        this.match(HaloParser.IDENTIFIER);
        this.state = 275;
        this.match(HaloParser.T__18);
        this.state = 276;
        this.typeRef();
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  typeRef() {
    let localContext = new TypeRefContext(this.context, this.state);
    this.enterRule(localContext, 38, HaloParser.RULE_typeRef);
    let _la;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 278;
        this.dottedId();
        this.state = 290;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        if (_la === 30) {
          {
            this.state = 279;
            this.match(HaloParser.T__29);
            this.state = 280;
            this.typeRef();
            this.state = 285;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 24) {
              {
                {
                  this.state = 281;
                  this.match(HaloParser.T__23);
                  this.state = 282;
                  this.typeRef();
                }
              }
              this.state = 287;
              this.errorHandler.sync(this);
              _la = this.tokenStream.LA(1);
            }
            this.state = 288;
            this.match(HaloParser.T__30);
          }
        }
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  pipeline() {
    let localContext = new PipelineContext(this.context, this.state);
    this.enterRule(localContext, 40, HaloParser.RULE_pipeline);
    let _la;
    try {
      this.state = 304;
      this.errorHandler.sync(this);
      switch (this.tokenStream.LA(1)) {
        case HaloParser.T__9:
        case HaloParser.BOOL:
        case HaloParser.NULL:
        case HaloParser.DURATION:
        case HaloParser.NUMBER:
        case HaloParser.IDENTIFIER:
        case HaloParser.TRIPLE_STRING:
        case HaloParser.STRING:
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 292;
            this.expression();
            this.state = 296;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((_la - 44 & ~31) === 0 && (1 << _la - 44 & 63) !== 0) {
              {
                {
                  this.state = 293;
                  this.pipelineOp();
                }
              }
              this.state = 298;
              this.errorHandler.sync(this);
              _la = this.tokenStream.LA(1);
            }
          }
          break;
        case HaloParser.LOOP:
        case HaloParser.FANOUT:
        case HaloParser.INTERRUPT:
        case HaloParser.GATE:
        case HaloParser.LISTEN:
        case HaloParser.PIPE:
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 300;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
              {
                {
                  this.state = 299;
                  this.pipelineOp();
                }
              }
              this.state = 302;
              this.errorHandler.sync(this);
              _la = this.tokenStream.LA(1);
            } while ((_la - 44 & ~31) === 0 && (1 << _la - 44 & 63) !== 0);
          }
          break;
        default:
          throw new NoViableAltException(this);
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  pipelineOp() {
    let localContext = new PipelineOpContext(this.context, this.state);
    this.enterRule(localContext, 42, HaloParser.RULE_pipelineOp);
    let _la;
    try {
      let alternative;
      this.state = 400;
      this.errorHandler.sync(this);
      switch (this.interpreter.adaptivePredict(this.tokenStream, 46, this.context)) {
        case 1:
          localContext = new PipeOpContext(localContext);
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 306;
            this.match(HaloParser.PIPE);
            this.state = 307;
            this.callExpr();
            this.state = 309;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 14) {
              {
                this.state = 308;
                this.binding();
              }
            }
          }
          break;
        case 2:
          localContext = new GateOpContext(localContext);
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 311;
            this.match(HaloParser.GATE);
            this.state = 312;
            this.match(HaloParser.T__20);
            this.state = 313;
            this.condExpr();
            this.state = 314;
            this.match(HaloParser.T__21);
            this.state = 316;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 32) {
              {
                this.state = 315;
                this.match(HaloParser.T__31);
              }
            }
          }
          break;
        case 3:
          localContext = new BranchOpContext(localContext);
          this.enterOuterAlt(localContext, 3);
          {
            this.state = 318;
            this.match(HaloParser.GATE);
            this.state = 319;
            this.match(HaloParser.T__22);
            this.state = 320;
            this.branchArm();
            this.state = 325;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 33, this.context);
            while (alternative !== 2 && alternative !== ATN.INVALID_ALT_NUMBER) {
              if (alternative === 1) {
                {
                  {
                    this.state = 321;
                    this.match(HaloParser.T__23);
                    this.state = 322;
                    this.branchArm();
                  }
                }
              }
              this.state = 327;
              this.errorHandler.sync(this);
              alternative = this.interpreter.adaptivePredict(this.tokenStream, 33, this.context);
            }
            this.state = 329;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 24) {
              {
                this.state = 328;
                this.match(HaloParser.T__23);
              }
            }
            this.state = 331;
            this.match(HaloParser.T__24);
            this.state = 333;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 14) {
              {
                this.state = 332;
                this.binding();
              }
            }
          }
          break;
        case 4:
          localContext = new InterruptOpContext(localContext);
          this.enterOuterAlt(localContext, 4);
          {
            this.state = 335;
            this.match(HaloParser.INTERRUPT);
            this.state = 336;
            this.match(HaloParser.T__10);
            this.state = 337;
            this.match(HaloParser.T__20);
            this.state = 339;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((_la & ~31) === 0 && (1 << _la & 67371006) !== 0 || (_la - 50 & ~31) === 0 && (1 << _la - 50 & 255) !== 0) {
              {
                this.state = 338;
                this.callArgs();
              }
            }
            this.state = 341;
            this.match(HaloParser.T__21);
            this.state = 343;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 14) {
              {
                this.state = 342;
                this.binding();
              }
            }
          }
          break;
        case 5:
          localContext = new FanoutOpContext(localContext);
          this.enterOuterAlt(localContext, 5);
          {
            this.state = 345;
            this.match(HaloParser.FANOUT);
            this.state = 346;
            this.match(HaloParser.T__22);
            this.state = 347;
            this.fanoutItem();
            this.state = 352;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 38, this.context);
            while (alternative !== 2 && alternative !== ATN.INVALID_ALT_NUMBER) {
              if (alternative === 1) {
                {
                  {
                    this.state = 348;
                    this.match(HaloParser.T__23);
                    this.state = 349;
                    this.fanoutItem();
                  }
                }
              }
              this.state = 354;
              this.errorHandler.sync(this);
              alternative = this.interpreter.adaptivePredict(this.tokenStream, 38, this.context);
            }
            this.state = 356;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 24) {
              {
                this.state = 355;
                this.match(HaloParser.T__23);
              }
            }
            this.state = 358;
            this.match(HaloParser.T__24);
            this.state = 360;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 14) {
              {
                this.state = 359;
                this.binding();
              }
            }
          }
          break;
        case 6:
          localContext = new EachOpContext(localContext);
          this.enterOuterAlt(localContext, 6);
          {
            this.state = 362;
            this.match(HaloParser.FANOUT);
            this.state = 363;
            this.match(HaloParser.T__14);
            this.state = 364;
            this.match(HaloParser.T__20);
            this.state = 365;
            this.match(HaloParser.IDENTIFIER);
            this.state = 366;
            this.match(HaloParser.T__15);
            this.state = 367;
            this.callValue();
            this.state = 370;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 24) {
              {
                this.state = 368;
                this.match(HaloParser.T__23);
                this.state = 369;
                this.callArgs();
              }
            }
            this.state = 372;
            this.match(HaloParser.T__21);
            this.state = 373;
            this.match(HaloParser.T__31);
            this.state = 374;
            this.callExpr();
            this.state = 376;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 14) {
              {
                this.state = 375;
                this.binding();
              }
            }
          }
          break;
        case 7:
          localContext = new ListenOpContext(localContext);
          this.enterOuterAlt(localContext, 7);
          {
            this.state = 378;
            this.match(HaloParser.LISTEN);
            this.state = 379;
            this.match(HaloParser.T__11);
            this.state = 380;
            this.match(HaloParser.T__20);
            this.state = 381;
            this.callValue();
            this.state = 382;
            this.match(HaloParser.T__21);
            this.state = 384;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 14) {
              {
                this.state = 383;
                this.binding();
              }
            }
          }
          break;
        case 8:
          localContext = new LoopOpContext(localContext);
          this.enterOuterAlt(localContext, 8);
          {
            this.state = 386;
            this.match(HaloParser.LOOP);
            this.state = 387;
            this.match(HaloParser.T__12);
            this.state = 388;
            this.match(HaloParser.T__20);
            this.state = 389;
            this.match(HaloParser.IDENTIFIER);
            this.state = 390;
            this.match(HaloParser.T__23);
            this.state = 391;
            _la = this.tokenStream.LA(1);
            if (!(_la === 56 || _la === 57)) {
              this.errorHandler.recoverInline(this);
            } else {
              this.errorHandler.reportMatch(this);
              this.consume();
            }
            this.state = 394;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 24) {
              {
                this.state = 392;
                this.match(HaloParser.T__23);
                this.state = 393;
                this.callArgs();
              }
            }
            this.state = 396;
            this.match(HaloParser.T__21);
            this.state = 398;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 14) {
              {
                this.state = 397;
                this.binding();
              }
            }
          }
          break;
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  binding() {
    let localContext = new BindingContext(this.context, this.state);
    this.enterRule(localContext, 44, HaloParser.RULE_binding);
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 402;
        this.match(HaloParser.T__13);
        this.state = 403;
        this.name();
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  branchArm() {
    let localContext = new BranchArmContext(this.context, this.state);
    this.enterRule(localContext, 46, HaloParser.RULE_branchArm);
    try {
      this.state = 414;
      this.errorHandler.sync(this);
      switch (this.tokenStream.LA(1)) {
        case HaloParser.T__20:
          localContext = new CondArmContext(localContext);
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 405;
            this.match(HaloParser.T__20);
            this.state = 406;
            this.condExpr();
            this.state = 407;
            this.match(HaloParser.T__21);
            this.state = 408;
            this.match(HaloParser.T__31);
            this.state = 409;
            this.callExpr();
          }
          break;
        case HaloParser.T__16:
          localContext = new ElseArmContext(localContext);
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 411;
            this.match(HaloParser.T__16);
            this.state = 412;
            this.match(HaloParser.T__31);
            this.state = 413;
            this.callExpr();
          }
          break;
        default:
          throw new NoViableAltException(this);
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  fanoutItem() {
    let localContext = new FanoutItemContext(this.context, this.state);
    this.enterRule(localContext, 48, HaloParser.RULE_fanoutItem);
    let _la;
    try {
      this.state = 424;
      this.errorHandler.sync(this);
      switch (this.interpreter.adaptivePredict(this.tokenStream, 50, this.context)) {
        case 1:
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 416;
            this.callExpr();
            this.state = 418;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 14) {
              {
                this.state = 417;
                this.binding();
              }
            }
          }
          break;
        case 2:
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 420;
            this.match(HaloParser.IDENTIFIER);
            this.state = 422;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 14) {
              {
                this.state = 421;
                this.binding();
              }
            }
          }
          break;
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  callExpr() {
    let localContext = new CallExprContext(this.context, this.state);
    this.enterRule(localContext, 50, HaloParser.RULE_callExpr);
    let _la;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 426;
        this.match(HaloParser.IDENTIFIER);
        this.state = 429;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        if (_la === 18) {
          {
            this.state = 427;
            this.match(HaloParser.T__17);
            this.state = 428;
            this.name();
          }
        }
        this.state = 431;
        this.match(HaloParser.T__20);
        this.state = 433;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        if ((_la & ~31) === 0 && (1 << _la & 67371006) !== 0 || (_la - 50 & ~31) === 0 && (1 << _la - 50 & 255) !== 0) {
          {
            this.state = 432;
            this.callArgs();
          }
        }
        this.state = 435;
        this.match(HaloParser.T__21);
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  callArgs() {
    let localContext = new CallArgsContext(this.context, this.state);
    this.enterRule(localContext, 52, HaloParser.RULE_callArgs);
    let _la;
    try {
      let alternative;
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 437;
        this.callArg();
        this.state = 442;
        this.errorHandler.sync(this);
        alternative = this.interpreter.adaptivePredict(this.tokenStream, 53, this.context);
        while (alternative !== 2 && alternative !== ATN.INVALID_ALT_NUMBER) {
          if (alternative === 1) {
            {
              {
                this.state = 438;
                this.match(HaloParser.T__23);
                this.state = 439;
                this.callArg();
              }
            }
          }
          this.state = 444;
          this.errorHandler.sync(this);
          alternative = this.interpreter.adaptivePredict(this.tokenStream, 53, this.context);
        }
        this.state = 446;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        if (_la === 24) {
          {
            this.state = 445;
            this.match(HaloParser.T__23);
          }
        }
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  callArg() {
    let localContext = new CallArgContext(this.context, this.state);
    this.enterRule(localContext, 54, HaloParser.RULE_callArg);
    try {
      this.state = 453;
      this.errorHandler.sync(this);
      switch (this.interpreter.adaptivePredict(this.tokenStream, 55, this.context)) {
        case 1:
          localContext = new NamedArgContext(localContext);
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 448;
            this.name();
            this.state = 449;
            this.match(HaloParser.T__18);
            this.state = 450;
            this.callValue();
          }
          break;
        case 2:
          localContext = new PositionalArgContext(localContext);
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 452;
            this.callValue();
          }
          break;
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  callValue() {
    let localContext = new CallValueContext(this.context, this.state);
    this.enterRule(localContext, 56, HaloParser.RULE_callValue);
    try {
      this.state = 460;
      this.errorHandler.sync(this);
      switch (this.tokenStream.LA(1)) {
        case HaloParser.BOOL:
        case HaloParser.NULL:
        case HaloParser.DURATION:
        case HaloParser.NUMBER:
        case HaloParser.TRIPLE_STRING:
        case HaloParser.STRING:
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 455;
            this.literal();
          }
          break;
        case HaloParser.MODEL_REF:
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 456;
            this.match(HaloParser.MODEL_REF);
          }
          break;
        case HaloParser.T__9:
          this.enterOuterAlt(localContext, 3);
          {
            this.state = 457;
            this.contextRef();
          }
          break;
        case HaloParser.T__25:
          this.enterOuterAlt(localContext, 4);
          {
            this.state = 458;
            this.listValue();
          }
          break;
        case HaloParser.IDENTIFIER:
          this.enterOuterAlt(localContext, 5);
          {
            this.state = 459;
            this.dottedId();
          }
          break;
        default:
          throw new NoViableAltException(this);
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  listValue() {
    let localContext = new ListValueContext(this.context, this.state);
    this.enterRule(localContext, 58, HaloParser.RULE_listValue);
    let _la;
    try {
      let alternative;
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 462;
        this.match(HaloParser.T__25);
        this.state = 474;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        if (_la === 10 || _la === 26 || (_la - 50 & ~31) === 0 && (1 << _la - 50 & 255) !== 0) {
          {
            this.state = 463;
            this.callValue();
            this.state = 468;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 57, this.context);
            while (alternative !== 2 && alternative !== ATN.INVALID_ALT_NUMBER) {
              if (alternative === 1) {
                {
                  {
                    this.state = 464;
                    this.match(HaloParser.T__23);
                    this.state = 465;
                    this.callValue();
                  }
                }
              }
              this.state = 470;
              this.errorHandler.sync(this);
              alternative = this.interpreter.adaptivePredict(this.tokenStream, 57, this.context);
            }
            this.state = 472;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 24) {
              {
                this.state = 471;
                this.match(HaloParser.T__23);
              }
            }
          }
        }
        this.state = 476;
        this.match(HaloParser.T__26);
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  value() {
    let localContext = new ValueContext(this.context, this.state);
    this.enterRule(localContext, 60, HaloParser.RULE_value);
    try {
      this.state = 481;
      this.errorHandler.sync(this);
      switch (this.tokenStream.LA(1)) {
        case HaloParser.BOOL:
        case HaloParser.NULL:
        case HaloParser.DURATION:
        case HaloParser.NUMBER:
        case HaloParser.TRIPLE_STRING:
        case HaloParser.STRING:
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 478;
            this.literal();
          }
          break;
        case HaloParser.MODEL_REF:
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 479;
            this.match(HaloParser.MODEL_REF);
          }
          break;
        case HaloParser.IDENTIFIER:
          this.enterOuterAlt(localContext, 3);
          {
            this.state = 480;
            this.dottedId();
          }
          break;
        default:
          throw new NoViableAltException(this);
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  literal() {
    let localContext = new LiteralContext(this.context, this.state);
    this.enterRule(localContext, 62, HaloParser.RULE_literal);
    let _la;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 483;
        _la = this.tokenStream.LA(1);
        if (!((_la - 50 & ~31) === 0 && (1 << _la - 50 & 207) !== 0)) {
          this.errorHandler.recoverInline(this);
        } else {
          this.errorHandler.reportMatch(this);
          this.consume();
        }
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  expression() {
    let localContext = new ExpressionContext(this.context, this.state);
    this.enterRule(localContext, 64, HaloParser.RULE_expression);
    try {
      this.state = 488;
      this.errorHandler.sync(this);
      switch (this.tokenStream.LA(1)) {
        case HaloParser.BOOL:
        case HaloParser.NULL:
        case HaloParser.DURATION:
        case HaloParser.NUMBER:
        case HaloParser.TRIPLE_STRING:
        case HaloParser.STRING:
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 485;
            this.literal();
          }
          break;
        case HaloParser.T__9:
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 486;
            this.contextRef();
          }
          break;
        case HaloParser.IDENTIFIER:
          this.enterOuterAlt(localContext, 3);
          {
            this.state = 487;
            this.dottedId();
          }
          break;
        default:
          throw new NoViableAltException(this);
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  contextRef() {
    let localContext = new ContextRefContext(this.context, this.state);
    this.enterRule(localContext, 66, HaloParser.RULE_contextRef);
    let _la;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 490;
        this.match(HaloParser.T__9);
        this.state = 495;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        while (_la === 18) {
          {
            {
              this.state = 491;
              this.match(HaloParser.T__17);
              this.state = 492;
              this.name();
            }
          }
          this.state = 497;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        }
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  condExpr() {
    let localContext = new CondExprContext(this.context, this.state);
    this.enterRule(localContext, 68, HaloParser.RULE_condExpr);
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 498;
        this.orExpr();
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  orExpr() {
    let localContext = new OrExprContext(this.context, this.state);
    this.enterRule(localContext, 70, HaloParser.RULE_orExpr);
    let _la;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 500;
        this.andExpr();
        this.state = 505;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        while (_la === 33) {
          {
            {
              this.state = 501;
              this.match(HaloParser.T__32);
              this.state = 502;
              this.andExpr();
            }
          }
          this.state = 507;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        }
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  andExpr() {
    let localContext = new AndExprContext(this.context, this.state);
    this.enterRule(localContext, 72, HaloParser.RULE_andExpr);
    let _la;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 508;
        this.notExpr();
        this.state = 513;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        while (_la === 34) {
          {
            {
              this.state = 509;
              this.match(HaloParser.T__33);
              this.state = 510;
              this.notExpr();
            }
          }
          this.state = 515;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        }
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  notExpr() {
    let localContext = new NotExprContext(this.context, this.state);
    this.enterRule(localContext, 74, HaloParser.RULE_notExpr);
    try {
      this.state = 519;
      this.errorHandler.sync(this);
      switch (this.tokenStream.LA(1)) {
        case HaloParser.T__34:
          localContext = new NegationContext(localContext);
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 516;
            this.match(HaloParser.T__34);
            this.state = 517;
            this.notExpr();
          }
          break;
        case HaloParser.T__9:
        case HaloParser.T__20:
        case HaloParser.BOOL:
        case HaloParser.NULL:
        case HaloParser.DURATION:
        case HaloParser.NUMBER:
        case HaloParser.IDENTIFIER:
        case HaloParser.TRIPLE_STRING:
        case HaloParser.STRING:
          localContext = new ComparisonExprContext(localContext);
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 518;
            this.comparison();
          }
          break;
        default:
          throw new NoViableAltException(this);
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  comparison() {
    let localContext = new ComparisonContext(this.context, this.state);
    this.enterRule(localContext, 76, HaloParser.RULE_comparison);
    let _la;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 521;
        this.operand();
        this.state = 525;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        if ((_la - 30 & ~31) === 0 && (1 << _la - 30 & 963) !== 0) {
          {
            this.state = 522;
            this.compOp();
            this.state = 523;
            this.operand();
          }
        }
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  compOp() {
    let localContext = new CompOpContext(this.context, this.state);
    this.enterRule(localContext, 78, HaloParser.RULE_compOp);
    let _la;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 527;
        _la = this.tokenStream.LA(1);
        if (!((_la - 30 & ~31) === 0 && (1 << _la - 30 & 963) !== 0)) {
          this.errorHandler.recoverInline(this);
        } else {
          this.errorHandler.reportMatch(this);
          this.consume();
        }
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  operand() {
    let localContext = new OperandContext(this.context, this.state);
    this.enterRule(localContext, 80, HaloParser.RULE_operand);
    try {
      this.state = 536;
      this.errorHandler.sync(this);
      switch (this.tokenStream.LA(1)) {
        case HaloParser.T__20:
          localContext = new ParenOperandContext(localContext);
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 529;
            this.match(HaloParser.T__20);
            this.state = 530;
            this.orExpr();
            this.state = 531;
            this.match(HaloParser.T__21);
          }
          break;
        case HaloParser.BOOL:
        case HaloParser.NULL:
        case HaloParser.DURATION:
        case HaloParser.NUMBER:
        case HaloParser.TRIPLE_STRING:
        case HaloParser.STRING:
          localContext = new LiteralOperandContext(localContext);
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 533;
            this.literal();
          }
          break;
        case HaloParser.T__9:
          localContext = new ContextOperandContext(localContext);
          this.enterOuterAlt(localContext, 3);
          {
            this.state = 534;
            this.contextRef();
          }
          break;
        case HaloParser.IDENTIFIER:
          localContext = new RefOperandContext(localContext);
          this.enterOuterAlt(localContext, 4);
          {
            this.state = 535;
            this.dottedId();
          }
          break;
        default:
          throw new NoViableAltException(this);
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  static _serializedATN = [
    4,
    1,
    57,
    539,
    2,
    0,
    7,
    0,
    2,
    1,
    7,
    1,
    2,
    2,
    7,
    2,
    2,
    3,
    7,
    3,
    2,
    4,
    7,
    4,
    2,
    5,
    7,
    5,
    2,
    6,
    7,
    6,
    2,
    7,
    7,
    7,
    2,
    8,
    7,
    8,
    2,
    9,
    7,
    9,
    2,
    10,
    7,
    10,
    2,
    11,
    7,
    11,
    2,
    12,
    7,
    12,
    2,
    13,
    7,
    13,
    2,
    14,
    7,
    14,
    2,
    15,
    7,
    15,
    2,
    16,
    7,
    16,
    2,
    17,
    7,
    17,
    2,
    18,
    7,
    18,
    2,
    19,
    7,
    19,
    2,
    20,
    7,
    20,
    2,
    21,
    7,
    21,
    2,
    22,
    7,
    22,
    2,
    23,
    7,
    23,
    2,
    24,
    7,
    24,
    2,
    25,
    7,
    25,
    2,
    26,
    7,
    26,
    2,
    27,
    7,
    27,
    2,
    28,
    7,
    28,
    2,
    29,
    7,
    29,
    2,
    30,
    7,
    30,
    2,
    31,
    7,
    31,
    2,
    32,
    7,
    32,
    2,
    33,
    7,
    33,
    2,
    34,
    7,
    34,
    2,
    35,
    7,
    35,
    2,
    36,
    7,
    36,
    2,
    37,
    7,
    37,
    2,
    38,
    7,
    38,
    2,
    39,
    7,
    39,
    2,
    40,
    7,
    40,
    1,
    0,
    5,
    0,
    84,
    8,
    0,
    10,
    0,
    12,
    0,
    87,
    9,
    0,
    1,
    0,
    1,
    0,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    3,
    1,
    97,
    8,
    1,
    1,
    2,
    1,
    2,
    1,
    3,
    1,
    3,
    1,
    3,
    5,
    3,
    104,
    8,
    3,
    10,
    3,
    12,
    3,
    107,
    9,
    3,
    1,
    4,
    1,
    4,
    1,
    4,
    1,
    4,
    1,
    4,
    1,
    4,
    5,
    4,
    115,
    8,
    4,
    10,
    4,
    12,
    4,
    118,
    9,
    4,
    1,
    5,
    1,
    5,
    1,
    5,
    3,
    5,
    123,
    8,
    5,
    1,
    5,
    1,
    5,
    1,
    6,
    1,
    6,
    1,
    6,
    1,
    6,
    1,
    6,
    1,
    6,
    3,
    6,
    133,
    8,
    6,
    1,
    6,
    1,
    6,
    1,
    7,
    1,
    7,
    1,
    7,
    1,
    7,
    1,
    7,
    1,
    7,
    3,
    7,
    143,
    8,
    7,
    1,
    7,
    1,
    7,
    1,
    8,
    1,
    8,
    1,
    8,
    1,
    8,
    1,
    8,
    3,
    8,
    152,
    8,
    8,
    5,
    8,
    154,
    8,
    8,
    10,
    8,
    12,
    8,
    157,
    9,
    8,
    1,
    8,
    1,
    8,
    1,
    9,
    1,
    9,
    1,
    9,
    1,
    9,
    1,
    10,
    5,
    10,
    166,
    8,
    10,
    10,
    10,
    12,
    10,
    169,
    9,
    10,
    1,
    10,
    1,
    10,
    1,
    10,
    1,
    10,
    1,
    10,
    1,
    10,
    5,
    10,
    177,
    8,
    10,
    10,
    10,
    12,
    10,
    180,
    9,
    10,
    1,
    10,
    3,
    10,
    183,
    8,
    10,
    1,
    10,
    1,
    10,
    5,
    10,
    187,
    8,
    10,
    10,
    10,
    12,
    10,
    190,
    9,
    10,
    1,
    11,
    1,
    11,
    1,
    11,
    3,
    11,
    195,
    8,
    11,
    1,
    12,
    1,
    12,
    1,
    12,
    1,
    12,
    1,
    13,
    1,
    13,
    1,
    13,
    1,
    13,
    5,
    13,
    205,
    8,
    13,
    10,
    13,
    12,
    13,
    208,
    9,
    13,
    1,
    13,
    1,
    13,
    1,
    13,
    1,
    13,
    5,
    13,
    214,
    8,
    13,
    10,
    13,
    12,
    13,
    217,
    9,
    13,
    1,
    13,
    1,
    13,
    3,
    13,
    221,
    8,
    13,
    1,
    14,
    1,
    14,
    1,
    14,
    1,
    14,
    1,
    14,
    1,
    14,
    5,
    14,
    229,
    8,
    14,
    10,
    14,
    12,
    14,
    232,
    9,
    14,
    3,
    14,
    234,
    8,
    14,
    1,
    14,
    3,
    14,
    237,
    8,
    14,
    1,
    15,
    1,
    15,
    1,
    15,
    3,
    15,
    242,
    8,
    15,
    1,
    16,
    5,
    16,
    245,
    8,
    16,
    10,
    16,
    12,
    16,
    248,
    9,
    16,
    1,
    16,
    1,
    16,
    1,
    16,
    1,
    16,
    3,
    16,
    254,
    8,
    16,
    1,
    16,
    1,
    16,
    1,
    16,
    3,
    16,
    259,
    8,
    16,
    1,
    16,
    1,
    16,
    1,
    16,
    1,
    17,
    1,
    17,
    1,
    17,
    5,
    17,
    267,
    8,
    17,
    10,
    17,
    12,
    17,
    270,
    9,
    17,
    1,
    17,
    3,
    17,
    273,
    8,
    17,
    1,
    18,
    1,
    18,
    1,
    18,
    1,
    18,
    1,
    19,
    1,
    19,
    1,
    19,
    1,
    19,
    1,
    19,
    5,
    19,
    284,
    8,
    19,
    10,
    19,
    12,
    19,
    287,
    9,
    19,
    1,
    19,
    1,
    19,
    3,
    19,
    291,
    8,
    19,
    1,
    20,
    1,
    20,
    5,
    20,
    295,
    8,
    20,
    10,
    20,
    12,
    20,
    298,
    9,
    20,
    1,
    20,
    4,
    20,
    301,
    8,
    20,
    11,
    20,
    12,
    20,
    302,
    3,
    20,
    305,
    8,
    20,
    1,
    21,
    1,
    21,
    1,
    21,
    3,
    21,
    310,
    8,
    21,
    1,
    21,
    1,
    21,
    1,
    21,
    1,
    21,
    1,
    21,
    3,
    21,
    317,
    8,
    21,
    1,
    21,
    1,
    21,
    1,
    21,
    1,
    21,
    1,
    21,
    5,
    21,
    324,
    8,
    21,
    10,
    21,
    12,
    21,
    327,
    9,
    21,
    1,
    21,
    3,
    21,
    330,
    8,
    21,
    1,
    21,
    1,
    21,
    3,
    21,
    334,
    8,
    21,
    1,
    21,
    1,
    21,
    1,
    21,
    1,
    21,
    3,
    21,
    340,
    8,
    21,
    1,
    21,
    1,
    21,
    3,
    21,
    344,
    8,
    21,
    1,
    21,
    1,
    21,
    1,
    21,
    1,
    21,
    1,
    21,
    5,
    21,
    351,
    8,
    21,
    10,
    21,
    12,
    21,
    354,
    9,
    21,
    1,
    21,
    3,
    21,
    357,
    8,
    21,
    1,
    21,
    1,
    21,
    3,
    21,
    361,
    8,
    21,
    1,
    21,
    1,
    21,
    1,
    21,
    1,
    21,
    1,
    21,
    1,
    21,
    1,
    21,
    1,
    21,
    3,
    21,
    371,
    8,
    21,
    1,
    21,
    1,
    21,
    1,
    21,
    1,
    21,
    3,
    21,
    377,
    8,
    21,
    1,
    21,
    1,
    21,
    1,
    21,
    1,
    21,
    1,
    21,
    1,
    21,
    3,
    21,
    385,
    8,
    21,
    1,
    21,
    1,
    21,
    1,
    21,
    1,
    21,
    1,
    21,
    1,
    21,
    1,
    21,
    1,
    21,
    3,
    21,
    395,
    8,
    21,
    1,
    21,
    1,
    21,
    3,
    21,
    399,
    8,
    21,
    3,
    21,
    401,
    8,
    21,
    1,
    22,
    1,
    22,
    1,
    22,
    1,
    23,
    1,
    23,
    1,
    23,
    1,
    23,
    1,
    23,
    1,
    23,
    1,
    23,
    1,
    23,
    1,
    23,
    3,
    23,
    415,
    8,
    23,
    1,
    24,
    1,
    24,
    3,
    24,
    419,
    8,
    24,
    1,
    24,
    1,
    24,
    3,
    24,
    423,
    8,
    24,
    3,
    24,
    425,
    8,
    24,
    1,
    25,
    1,
    25,
    1,
    25,
    3,
    25,
    430,
    8,
    25,
    1,
    25,
    1,
    25,
    3,
    25,
    434,
    8,
    25,
    1,
    25,
    1,
    25,
    1,
    26,
    1,
    26,
    1,
    26,
    5,
    26,
    441,
    8,
    26,
    10,
    26,
    12,
    26,
    444,
    9,
    26,
    1,
    26,
    3,
    26,
    447,
    8,
    26,
    1,
    27,
    1,
    27,
    1,
    27,
    1,
    27,
    1,
    27,
    3,
    27,
    454,
    8,
    27,
    1,
    28,
    1,
    28,
    1,
    28,
    1,
    28,
    1,
    28,
    3,
    28,
    461,
    8,
    28,
    1,
    29,
    1,
    29,
    1,
    29,
    1,
    29,
    5,
    29,
    467,
    8,
    29,
    10,
    29,
    12,
    29,
    470,
    9,
    29,
    1,
    29,
    3,
    29,
    473,
    8,
    29,
    3,
    29,
    475,
    8,
    29,
    1,
    29,
    1,
    29,
    1,
    30,
    1,
    30,
    1,
    30,
    3,
    30,
    482,
    8,
    30,
    1,
    31,
    1,
    31,
    1,
    32,
    1,
    32,
    1,
    32,
    3,
    32,
    489,
    8,
    32,
    1,
    33,
    1,
    33,
    1,
    33,
    5,
    33,
    494,
    8,
    33,
    10,
    33,
    12,
    33,
    497,
    9,
    33,
    1,
    34,
    1,
    34,
    1,
    35,
    1,
    35,
    1,
    35,
    5,
    35,
    504,
    8,
    35,
    10,
    35,
    12,
    35,
    507,
    9,
    35,
    1,
    36,
    1,
    36,
    1,
    36,
    5,
    36,
    512,
    8,
    36,
    10,
    36,
    12,
    36,
    515,
    9,
    36,
    1,
    37,
    1,
    37,
    1,
    37,
    3,
    37,
    520,
    8,
    37,
    1,
    38,
    1,
    38,
    1,
    38,
    1,
    38,
    3,
    38,
    526,
    8,
    38,
    1,
    39,
    1,
    39,
    1,
    40,
    1,
    40,
    1,
    40,
    1,
    40,
    1,
    40,
    1,
    40,
    1,
    40,
    3,
    40,
    537,
    8,
    40,
    1,
    40,
    0,
    0,
    41,
    0,
    2,
    4,
    6,
    8,
    10,
    12,
    14,
    16,
    18,
    20,
    22,
    24,
    26,
    28,
    30,
    32,
    34,
    36,
    38,
    40,
    42,
    44,
    46,
    48,
    50,
    52,
    54,
    56,
    58,
    60,
    62,
    64,
    66,
    68,
    70,
    72,
    74,
    76,
    78,
    80,
    0,
    4,
    2,
    0,
    1,
    17,
    55,
    55,
    1,
    0,
    56,
    57,
    2,
    0,
    50,
    53,
    56,
    57,
    2,
    0,
    30,
    31,
    36,
    39,
    585,
    0,
    85,
    1,
    0,
    0,
    0,
    2,
    96,
    1,
    0,
    0,
    0,
    4,
    98,
    1,
    0,
    0,
    0,
    6,
    100,
    1,
    0,
    0,
    0,
    8,
    108,
    1,
    0,
    0,
    0,
    10,
    119,
    1,
    0,
    0,
    0,
    12,
    126,
    1,
    0,
    0,
    0,
    14,
    136,
    1,
    0,
    0,
    0,
    16,
    146,
    1,
    0,
    0,
    0,
    18,
    160,
    1,
    0,
    0,
    0,
    20,
    167,
    1,
    0,
    0,
    0,
    22,
    194,
    1,
    0,
    0,
    0,
    24,
    196,
    1,
    0,
    0,
    0,
    26,
    220,
    1,
    0,
    0,
    0,
    28,
    222,
    1,
    0,
    0,
    0,
    30,
    241,
    1,
    0,
    0,
    0,
    32,
    246,
    1,
    0,
    0,
    0,
    34,
    263,
    1,
    0,
    0,
    0,
    36,
    274,
    1,
    0,
    0,
    0,
    38,
    278,
    1,
    0,
    0,
    0,
    40,
    304,
    1,
    0,
    0,
    0,
    42,
    400,
    1,
    0,
    0,
    0,
    44,
    402,
    1,
    0,
    0,
    0,
    46,
    414,
    1,
    0,
    0,
    0,
    48,
    424,
    1,
    0,
    0,
    0,
    50,
    426,
    1,
    0,
    0,
    0,
    52,
    437,
    1,
    0,
    0,
    0,
    54,
    453,
    1,
    0,
    0,
    0,
    56,
    460,
    1,
    0,
    0,
    0,
    58,
    462,
    1,
    0,
    0,
    0,
    60,
    481,
    1,
    0,
    0,
    0,
    62,
    483,
    1,
    0,
    0,
    0,
    64,
    488,
    1,
    0,
    0,
    0,
    66,
    490,
    1,
    0,
    0,
    0,
    68,
    498,
    1,
    0,
    0,
    0,
    70,
    500,
    1,
    0,
    0,
    0,
    72,
    508,
    1,
    0,
    0,
    0,
    74,
    519,
    1,
    0,
    0,
    0,
    76,
    521,
    1,
    0,
    0,
    0,
    78,
    527,
    1,
    0,
    0,
    0,
    80,
    536,
    1,
    0,
    0,
    0,
    82,
    84,
    3,
    2,
    1,
    0,
    83,
    82,
    1,
    0,
    0,
    0,
    84,
    87,
    1,
    0,
    0,
    0,
    85,
    83,
    1,
    0,
    0,
    0,
    85,
    86,
    1,
    0,
    0,
    0,
    86,
    88,
    1,
    0,
    0,
    0,
    87,
    85,
    1,
    0,
    0,
    0,
    88,
    89,
    5,
    0,
    0,
    1,
    89,
    1,
    1,
    0,
    0,
    0,
    90,
    97,
    3,
    8,
    4,
    0,
    91,
    97,
    3,
    12,
    6,
    0,
    92,
    97,
    3,
    14,
    7,
    0,
    93,
    97,
    3,
    16,
    8,
    0,
    94,
    97,
    3,
    20,
    10,
    0,
    95,
    97,
    3,
    32,
    16,
    0,
    96,
    90,
    1,
    0,
    0,
    0,
    96,
    91,
    1,
    0,
    0,
    0,
    96,
    92,
    1,
    0,
    0,
    0,
    96,
    93,
    1,
    0,
    0,
    0,
    96,
    94,
    1,
    0,
    0,
    0,
    96,
    95,
    1,
    0,
    0,
    0,
    97,
    3,
    1,
    0,
    0,
    0,
    98,
    99,
    7,
    0,
    0,
    0,
    99,
    5,
    1,
    0,
    0,
    0,
    100,
    105,
    5,
    55,
    0,
    0,
    101,
    102,
    5,
    18,
    0,
    0,
    102,
    104,
    3,
    4,
    2,
    0,
    103,
    101,
    1,
    0,
    0,
    0,
    104,
    107,
    1,
    0,
    0,
    0,
    105,
    103,
    1,
    0,
    0,
    0,
    105,
    106,
    1,
    0,
    0,
    0,
    106,
    7,
    1,
    0,
    0,
    0,
    107,
    105,
    1,
    0,
    0,
    0,
    108,
    109,
    5,
    1,
    0,
    0,
    109,
    110,
    5,
    55,
    0,
    0,
    110,
    111,
    5,
    19,
    0,
    0,
    111,
    116,
    3,
    10,
    5,
    0,
    112,
    113,
    5,
    20,
    0,
    0,
    113,
    115,
    3,
    10,
    5,
    0,
    114,
    112,
    1,
    0,
    0,
    0,
    115,
    118,
    1,
    0,
    0,
    0,
    116,
    114,
    1,
    0,
    0,
    0,
    116,
    117,
    1,
    0,
    0,
    0,
    117,
    9,
    1,
    0,
    0,
    0,
    118,
    116,
    1,
    0,
    0,
    0,
    119,
    120,
    5,
    55,
    0,
    0,
    120,
    122,
    5,
    21,
    0,
    0,
    121,
    123,
    3,
    52,
    26,
    0,
    122,
    121,
    1,
    0,
    0,
    0,
    122,
    123,
    1,
    0,
    0,
    0,
    123,
    124,
    1,
    0,
    0,
    0,
    124,
    125,
    5,
    22,
    0,
    0,
    125,
    11,
    1,
    0,
    0,
    0,
    126,
    127,
    5,
    2,
    0,
    0,
    127,
    128,
    5,
    55,
    0,
    0,
    128,
    129,
    5,
    19,
    0,
    0,
    129,
    130,
    5,
    55,
    0,
    0,
    130,
    132,
    5,
    21,
    0,
    0,
    131,
    133,
    3,
    52,
    26,
    0,
    132,
    131,
    1,
    0,
    0,
    0,
    132,
    133,
    1,
    0,
    0,
    0,
    133,
    134,
    1,
    0,
    0,
    0,
    134,
    135,
    5,
    22,
    0,
    0,
    135,
    13,
    1,
    0,
    0,
    0,
    136,
    137,
    5,
    3,
    0,
    0,
    137,
    138,
    5,
    55,
    0,
    0,
    138,
    139,
    5,
    19,
    0,
    0,
    139,
    140,
    5,
    55,
    0,
    0,
    140,
    142,
    5,
    21,
    0,
    0,
    141,
    143,
    3,
    52,
    26,
    0,
    142,
    141,
    1,
    0,
    0,
    0,
    142,
    143,
    1,
    0,
    0,
    0,
    143,
    144,
    1,
    0,
    0,
    0,
    144,
    145,
    5,
    22,
    0,
    0,
    145,
    15,
    1,
    0,
    0,
    0,
    146,
    147,
    5,
    4,
    0,
    0,
    147,
    148,
    5,
    55,
    0,
    0,
    148,
    155,
    5,
    23,
    0,
    0,
    149,
    151,
    3,
    18,
    9,
    0,
    150,
    152,
    5,
    24,
    0,
    0,
    151,
    150,
    1,
    0,
    0,
    0,
    151,
    152,
    1,
    0,
    0,
    0,
    152,
    154,
    1,
    0,
    0,
    0,
    153,
    149,
    1,
    0,
    0,
    0,
    154,
    157,
    1,
    0,
    0,
    0,
    155,
    153,
    1,
    0,
    0,
    0,
    155,
    156,
    1,
    0,
    0,
    0,
    156,
    158,
    1,
    0,
    0,
    0,
    157,
    155,
    1,
    0,
    0,
    0,
    158,
    159,
    5,
    25,
    0,
    0,
    159,
    17,
    1,
    0,
    0,
    0,
    160,
    161,
    3,
    4,
    2,
    0,
    161,
    162,
    5,
    19,
    0,
    0,
    162,
    163,
    3,
    38,
    19,
    0,
    163,
    19,
    1,
    0,
    0,
    0,
    164,
    166,
    3,
    28,
    14,
    0,
    165,
    164,
    1,
    0,
    0,
    0,
    166,
    169,
    1,
    0,
    0,
    0,
    167,
    165,
    1,
    0,
    0,
    0,
    167,
    168,
    1,
    0,
    0,
    0,
    168,
    170,
    1,
    0,
    0,
    0,
    169,
    167,
    1,
    0,
    0,
    0,
    170,
    171,
    5,
    5,
    0,
    0,
    171,
    172,
    5,
    55,
    0,
    0,
    172,
    173,
    5,
    26,
    0,
    0,
    173,
    178,
    3,
    22,
    11,
    0,
    174,
    175,
    5,
    24,
    0,
    0,
    175,
    177,
    3,
    24,
    12,
    0,
    176,
    174,
    1,
    0,
    0,
    0,
    177,
    180,
    1,
    0,
    0,
    0,
    178,
    176,
    1,
    0,
    0,
    0,
    178,
    179,
    1,
    0,
    0,
    0,
    179,
    182,
    1,
    0,
    0,
    0,
    180,
    178,
    1,
    0,
    0,
    0,
    181,
    183,
    5,
    24,
    0,
    0,
    182,
    181,
    1,
    0,
    0,
    0,
    182,
    183,
    1,
    0,
    0,
    0,
    183,
    184,
    1,
    0,
    0,
    0,
    184,
    188,
    5,
    27,
    0,
    0,
    185,
    187,
    3,
    26,
    13,
    0,
    186,
    185,
    1,
    0,
    0,
    0,
    187,
    190,
    1,
    0,
    0,
    0,
    188,
    186,
    1,
    0,
    0,
    0,
    188,
    189,
    1,
    0,
    0,
    0,
    189,
    21,
    1,
    0,
    0,
    0,
    190,
    188,
    1,
    0,
    0,
    0,
    191,
    195,
    5,
    54,
    0,
    0,
    192,
    195,
    5,
    57,
    0,
    0,
    193,
    195,
    3,
    6,
    3,
    0,
    194,
    191,
    1,
    0,
    0,
    0,
    194,
    192,
    1,
    0,
    0,
    0,
    194,
    193,
    1,
    0,
    0,
    0,
    195,
    23,
    1,
    0,
    0,
    0,
    196,
    197,
    3,
    4,
    2,
    0,
    197,
    198,
    5,
    19,
    0,
    0,
    198,
    199,
    3,
    60,
    30,
    0,
    199,
    25,
    1,
    0,
    0,
    0,
    200,
    201,
    5,
    7,
    0,
    0,
    201,
    206,
    5,
    55,
    0,
    0,
    202,
    203,
    5,
    24,
    0,
    0,
    203,
    205,
    5,
    55,
    0,
    0,
    204,
    202,
    1,
    0,
    0,
    0,
    205,
    208,
    1,
    0,
    0,
    0,
    206,
    204,
    1,
    0,
    0,
    0,
    206,
    207,
    1,
    0,
    0,
    0,
    207,
    221,
    1,
    0,
    0,
    0,
    208,
    206,
    1,
    0,
    0,
    0,
    209,
    210,
    5,
    8,
    0,
    0,
    210,
    215,
    5,
    55,
    0,
    0,
    211,
    212,
    5,
    24,
    0,
    0,
    212,
    214,
    5,
    55,
    0,
    0,
    213,
    211,
    1,
    0,
    0,
    0,
    214,
    217,
    1,
    0,
    0,
    0,
    215,
    213,
    1,
    0,
    0,
    0,
    215,
    216,
    1,
    0,
    0,
    0,
    216,
    221,
    1,
    0,
    0,
    0,
    217,
    215,
    1,
    0,
    0,
    0,
    218,
    219,
    5,
    9,
    0,
    0,
    219,
    221,
    7,
    1,
    0,
    0,
    220,
    200,
    1,
    0,
    0,
    0,
    220,
    209,
    1,
    0,
    0,
    0,
    220,
    218,
    1,
    0,
    0,
    0,
    221,
    27,
    1,
    0,
    0,
    0,
    222,
    223,
    5,
    28,
    0,
    0,
    223,
    236,
    3,
    4,
    2,
    0,
    224,
    233,
    5,
    21,
    0,
    0,
    225,
    230,
    3,
    30,
    15,
    0,
    226,
    227,
    5,
    24,
    0,
    0,
    227,
    229,
    3,
    30,
    15,
    0,
    228,
    226,
    1,
    0,
    0,
    0,
    229,
    232,
    1,
    0,
    0,
    0,
    230,
    228,
    1,
    0,
    0,
    0,
    230,
    231,
    1,
    0,
    0,
    0,
    231,
    234,
    1,
    0,
    0,
    0,
    232,
    230,
    1,
    0,
    0,
    0,
    233,
    225,
    1,
    0,
    0,
    0,
    233,
    234,
    1,
    0,
    0,
    0,
    234,
    235,
    1,
    0,
    0,
    0,
    235,
    237,
    5,
    22,
    0,
    0,
    236,
    224,
    1,
    0,
    0,
    0,
    236,
    237,
    1,
    0,
    0,
    0,
    237,
    29,
    1,
    0,
    0,
    0,
    238,
    242,
    3,
    62,
    31,
    0,
    239,
    242,
    5,
    54,
    0,
    0,
    240,
    242,
    3,
    6,
    3,
    0,
    241,
    238,
    1,
    0,
    0,
    0,
    241,
    239,
    1,
    0,
    0,
    0,
    241,
    240,
    1,
    0,
    0,
    0,
    242,
    31,
    1,
    0,
    0,
    0,
    243,
    245,
    3,
    28,
    14,
    0,
    244,
    243,
    1,
    0,
    0,
    0,
    245,
    248,
    1,
    0,
    0,
    0,
    246,
    244,
    1,
    0,
    0,
    0,
    246,
    247,
    1,
    0,
    0,
    0,
    247,
    249,
    1,
    0,
    0,
    0,
    248,
    246,
    1,
    0,
    0,
    0,
    249,
    250,
    5,
    6,
    0,
    0,
    250,
    251,
    5,
    55,
    0,
    0,
    251,
    253,
    5,
    21,
    0,
    0,
    252,
    254,
    3,
    34,
    17,
    0,
    253,
    252,
    1,
    0,
    0,
    0,
    253,
    254,
    1,
    0,
    0,
    0,
    254,
    255,
    1,
    0,
    0,
    0,
    255,
    258,
    5,
    22,
    0,
    0,
    256,
    257,
    5,
    29,
    0,
    0,
    257,
    259,
    3,
    38,
    19,
    0,
    258,
    256,
    1,
    0,
    0,
    0,
    258,
    259,
    1,
    0,
    0,
    0,
    259,
    260,
    1,
    0,
    0,
    0,
    260,
    261,
    5,
    19,
    0,
    0,
    261,
    262,
    3,
    40,
    20,
    0,
    262,
    33,
    1,
    0,
    0,
    0,
    263,
    268,
    3,
    36,
    18,
    0,
    264,
    265,
    5,
    24,
    0,
    0,
    265,
    267,
    3,
    36,
    18,
    0,
    266,
    264,
    1,
    0,
    0,
    0,
    267,
    270,
    1,
    0,
    0,
    0,
    268,
    266,
    1,
    0,
    0,
    0,
    268,
    269,
    1,
    0,
    0,
    0,
    269,
    272,
    1,
    0,
    0,
    0,
    270,
    268,
    1,
    0,
    0,
    0,
    271,
    273,
    5,
    24,
    0,
    0,
    272,
    271,
    1,
    0,
    0,
    0,
    272,
    273,
    1,
    0,
    0,
    0,
    273,
    35,
    1,
    0,
    0,
    0,
    274,
    275,
    5,
    55,
    0,
    0,
    275,
    276,
    5,
    19,
    0,
    0,
    276,
    277,
    3,
    38,
    19,
    0,
    277,
    37,
    1,
    0,
    0,
    0,
    278,
    290,
    3,
    6,
    3,
    0,
    279,
    280,
    5,
    30,
    0,
    0,
    280,
    285,
    3,
    38,
    19,
    0,
    281,
    282,
    5,
    24,
    0,
    0,
    282,
    284,
    3,
    38,
    19,
    0,
    283,
    281,
    1,
    0,
    0,
    0,
    284,
    287,
    1,
    0,
    0,
    0,
    285,
    283,
    1,
    0,
    0,
    0,
    285,
    286,
    1,
    0,
    0,
    0,
    286,
    288,
    1,
    0,
    0,
    0,
    287,
    285,
    1,
    0,
    0,
    0,
    288,
    289,
    5,
    31,
    0,
    0,
    289,
    291,
    1,
    0,
    0,
    0,
    290,
    279,
    1,
    0,
    0,
    0,
    290,
    291,
    1,
    0,
    0,
    0,
    291,
    39,
    1,
    0,
    0,
    0,
    292,
    296,
    3,
    64,
    32,
    0,
    293,
    295,
    3,
    42,
    21,
    0,
    294,
    293,
    1,
    0,
    0,
    0,
    295,
    298,
    1,
    0,
    0,
    0,
    296,
    294,
    1,
    0,
    0,
    0,
    296,
    297,
    1,
    0,
    0,
    0,
    297,
    305,
    1,
    0,
    0,
    0,
    298,
    296,
    1,
    0,
    0,
    0,
    299,
    301,
    3,
    42,
    21,
    0,
    300,
    299,
    1,
    0,
    0,
    0,
    301,
    302,
    1,
    0,
    0,
    0,
    302,
    300,
    1,
    0,
    0,
    0,
    302,
    303,
    1,
    0,
    0,
    0,
    303,
    305,
    1,
    0,
    0,
    0,
    304,
    292,
    1,
    0,
    0,
    0,
    304,
    300,
    1,
    0,
    0,
    0,
    305,
    41,
    1,
    0,
    0,
    0,
    306,
    307,
    5,
    49,
    0,
    0,
    307,
    309,
    3,
    50,
    25,
    0,
    308,
    310,
    3,
    44,
    22,
    0,
    309,
    308,
    1,
    0,
    0,
    0,
    309,
    310,
    1,
    0,
    0,
    0,
    310,
    401,
    1,
    0,
    0,
    0,
    311,
    312,
    5,
    47,
    0,
    0,
    312,
    313,
    5,
    21,
    0,
    0,
    313,
    314,
    3,
    68,
    34,
    0,
    314,
    316,
    5,
    22,
    0,
    0,
    315,
    317,
    5,
    32,
    0,
    0,
    316,
    315,
    1,
    0,
    0,
    0,
    316,
    317,
    1,
    0,
    0,
    0,
    317,
    401,
    1,
    0,
    0,
    0,
    318,
    319,
    5,
    47,
    0,
    0,
    319,
    320,
    5,
    23,
    0,
    0,
    320,
    325,
    3,
    46,
    23,
    0,
    321,
    322,
    5,
    24,
    0,
    0,
    322,
    324,
    3,
    46,
    23,
    0,
    323,
    321,
    1,
    0,
    0,
    0,
    324,
    327,
    1,
    0,
    0,
    0,
    325,
    323,
    1,
    0,
    0,
    0,
    325,
    326,
    1,
    0,
    0,
    0,
    326,
    329,
    1,
    0,
    0,
    0,
    327,
    325,
    1,
    0,
    0,
    0,
    328,
    330,
    5,
    24,
    0,
    0,
    329,
    328,
    1,
    0,
    0,
    0,
    329,
    330,
    1,
    0,
    0,
    0,
    330,
    331,
    1,
    0,
    0,
    0,
    331,
    333,
    5,
    25,
    0,
    0,
    332,
    334,
    3,
    44,
    22,
    0,
    333,
    332,
    1,
    0,
    0,
    0,
    333,
    334,
    1,
    0,
    0,
    0,
    334,
    401,
    1,
    0,
    0,
    0,
    335,
    336,
    5,
    46,
    0,
    0,
    336,
    337,
    5,
    11,
    0,
    0,
    337,
    339,
    5,
    21,
    0,
    0,
    338,
    340,
    3,
    52,
    26,
    0,
    339,
    338,
    1,
    0,
    0,
    0,
    339,
    340,
    1,
    0,
    0,
    0,
    340,
    341,
    1,
    0,
    0,
    0,
    341,
    343,
    5,
    22,
    0,
    0,
    342,
    344,
    3,
    44,
    22,
    0,
    343,
    342,
    1,
    0,
    0,
    0,
    343,
    344,
    1,
    0,
    0,
    0,
    344,
    401,
    1,
    0,
    0,
    0,
    345,
    346,
    5,
    45,
    0,
    0,
    346,
    347,
    5,
    23,
    0,
    0,
    347,
    352,
    3,
    48,
    24,
    0,
    348,
    349,
    5,
    24,
    0,
    0,
    349,
    351,
    3,
    48,
    24,
    0,
    350,
    348,
    1,
    0,
    0,
    0,
    351,
    354,
    1,
    0,
    0,
    0,
    352,
    350,
    1,
    0,
    0,
    0,
    352,
    353,
    1,
    0,
    0,
    0,
    353,
    356,
    1,
    0,
    0,
    0,
    354,
    352,
    1,
    0,
    0,
    0,
    355,
    357,
    5,
    24,
    0,
    0,
    356,
    355,
    1,
    0,
    0,
    0,
    356,
    357,
    1,
    0,
    0,
    0,
    357,
    358,
    1,
    0,
    0,
    0,
    358,
    360,
    5,
    25,
    0,
    0,
    359,
    361,
    3,
    44,
    22,
    0,
    360,
    359,
    1,
    0,
    0,
    0,
    360,
    361,
    1,
    0,
    0,
    0,
    361,
    401,
    1,
    0,
    0,
    0,
    362,
    363,
    5,
    45,
    0,
    0,
    363,
    364,
    5,
    15,
    0,
    0,
    364,
    365,
    5,
    21,
    0,
    0,
    365,
    366,
    5,
    55,
    0,
    0,
    366,
    367,
    5,
    16,
    0,
    0,
    367,
    370,
    3,
    56,
    28,
    0,
    368,
    369,
    5,
    24,
    0,
    0,
    369,
    371,
    3,
    52,
    26,
    0,
    370,
    368,
    1,
    0,
    0,
    0,
    370,
    371,
    1,
    0,
    0,
    0,
    371,
    372,
    1,
    0,
    0,
    0,
    372,
    373,
    5,
    22,
    0,
    0,
    373,
    374,
    5,
    32,
    0,
    0,
    374,
    376,
    3,
    50,
    25,
    0,
    375,
    377,
    3,
    44,
    22,
    0,
    376,
    375,
    1,
    0,
    0,
    0,
    376,
    377,
    1,
    0,
    0,
    0,
    377,
    401,
    1,
    0,
    0,
    0,
    378,
    379,
    5,
    48,
    0,
    0,
    379,
    380,
    5,
    12,
    0,
    0,
    380,
    381,
    5,
    21,
    0,
    0,
    381,
    382,
    3,
    56,
    28,
    0,
    382,
    384,
    5,
    22,
    0,
    0,
    383,
    385,
    3,
    44,
    22,
    0,
    384,
    383,
    1,
    0,
    0,
    0,
    384,
    385,
    1,
    0,
    0,
    0,
    385,
    401,
    1,
    0,
    0,
    0,
    386,
    387,
    5,
    44,
    0,
    0,
    387,
    388,
    5,
    13,
    0,
    0,
    388,
    389,
    5,
    21,
    0,
    0,
    389,
    390,
    5,
    55,
    0,
    0,
    390,
    391,
    5,
    24,
    0,
    0,
    391,
    394,
    7,
    1,
    0,
    0,
    392,
    393,
    5,
    24,
    0,
    0,
    393,
    395,
    3,
    52,
    26,
    0,
    394,
    392,
    1,
    0,
    0,
    0,
    394,
    395,
    1,
    0,
    0,
    0,
    395,
    396,
    1,
    0,
    0,
    0,
    396,
    398,
    5,
    22,
    0,
    0,
    397,
    399,
    3,
    44,
    22,
    0,
    398,
    397,
    1,
    0,
    0,
    0,
    398,
    399,
    1,
    0,
    0,
    0,
    399,
    401,
    1,
    0,
    0,
    0,
    400,
    306,
    1,
    0,
    0,
    0,
    400,
    311,
    1,
    0,
    0,
    0,
    400,
    318,
    1,
    0,
    0,
    0,
    400,
    335,
    1,
    0,
    0,
    0,
    400,
    345,
    1,
    0,
    0,
    0,
    400,
    362,
    1,
    0,
    0,
    0,
    400,
    378,
    1,
    0,
    0,
    0,
    400,
    386,
    1,
    0,
    0,
    0,
    401,
    43,
    1,
    0,
    0,
    0,
    402,
    403,
    5,
    14,
    0,
    0,
    403,
    404,
    3,
    4,
    2,
    0,
    404,
    45,
    1,
    0,
    0,
    0,
    405,
    406,
    5,
    21,
    0,
    0,
    406,
    407,
    3,
    68,
    34,
    0,
    407,
    408,
    5,
    22,
    0,
    0,
    408,
    409,
    5,
    32,
    0,
    0,
    409,
    410,
    3,
    50,
    25,
    0,
    410,
    415,
    1,
    0,
    0,
    0,
    411,
    412,
    5,
    17,
    0,
    0,
    412,
    413,
    5,
    32,
    0,
    0,
    413,
    415,
    3,
    50,
    25,
    0,
    414,
    405,
    1,
    0,
    0,
    0,
    414,
    411,
    1,
    0,
    0,
    0,
    415,
    47,
    1,
    0,
    0,
    0,
    416,
    418,
    3,
    50,
    25,
    0,
    417,
    419,
    3,
    44,
    22,
    0,
    418,
    417,
    1,
    0,
    0,
    0,
    418,
    419,
    1,
    0,
    0,
    0,
    419,
    425,
    1,
    0,
    0,
    0,
    420,
    422,
    5,
    55,
    0,
    0,
    421,
    423,
    3,
    44,
    22,
    0,
    422,
    421,
    1,
    0,
    0,
    0,
    422,
    423,
    1,
    0,
    0,
    0,
    423,
    425,
    1,
    0,
    0,
    0,
    424,
    416,
    1,
    0,
    0,
    0,
    424,
    420,
    1,
    0,
    0,
    0,
    425,
    49,
    1,
    0,
    0,
    0,
    426,
    429,
    5,
    55,
    0,
    0,
    427,
    428,
    5,
    18,
    0,
    0,
    428,
    430,
    3,
    4,
    2,
    0,
    429,
    427,
    1,
    0,
    0,
    0,
    429,
    430,
    1,
    0,
    0,
    0,
    430,
    431,
    1,
    0,
    0,
    0,
    431,
    433,
    5,
    21,
    0,
    0,
    432,
    434,
    3,
    52,
    26,
    0,
    433,
    432,
    1,
    0,
    0,
    0,
    433,
    434,
    1,
    0,
    0,
    0,
    434,
    435,
    1,
    0,
    0,
    0,
    435,
    436,
    5,
    22,
    0,
    0,
    436,
    51,
    1,
    0,
    0,
    0,
    437,
    442,
    3,
    54,
    27,
    0,
    438,
    439,
    5,
    24,
    0,
    0,
    439,
    441,
    3,
    54,
    27,
    0,
    440,
    438,
    1,
    0,
    0,
    0,
    441,
    444,
    1,
    0,
    0,
    0,
    442,
    440,
    1,
    0,
    0,
    0,
    442,
    443,
    1,
    0,
    0,
    0,
    443,
    446,
    1,
    0,
    0,
    0,
    444,
    442,
    1,
    0,
    0,
    0,
    445,
    447,
    5,
    24,
    0,
    0,
    446,
    445,
    1,
    0,
    0,
    0,
    446,
    447,
    1,
    0,
    0,
    0,
    447,
    53,
    1,
    0,
    0,
    0,
    448,
    449,
    3,
    4,
    2,
    0,
    449,
    450,
    5,
    19,
    0,
    0,
    450,
    451,
    3,
    56,
    28,
    0,
    451,
    454,
    1,
    0,
    0,
    0,
    452,
    454,
    3,
    56,
    28,
    0,
    453,
    448,
    1,
    0,
    0,
    0,
    453,
    452,
    1,
    0,
    0,
    0,
    454,
    55,
    1,
    0,
    0,
    0,
    455,
    461,
    3,
    62,
    31,
    0,
    456,
    461,
    5,
    54,
    0,
    0,
    457,
    461,
    3,
    66,
    33,
    0,
    458,
    461,
    3,
    58,
    29,
    0,
    459,
    461,
    3,
    6,
    3,
    0,
    460,
    455,
    1,
    0,
    0,
    0,
    460,
    456,
    1,
    0,
    0,
    0,
    460,
    457,
    1,
    0,
    0,
    0,
    460,
    458,
    1,
    0,
    0,
    0,
    460,
    459,
    1,
    0,
    0,
    0,
    461,
    57,
    1,
    0,
    0,
    0,
    462,
    474,
    5,
    26,
    0,
    0,
    463,
    468,
    3,
    56,
    28,
    0,
    464,
    465,
    5,
    24,
    0,
    0,
    465,
    467,
    3,
    56,
    28,
    0,
    466,
    464,
    1,
    0,
    0,
    0,
    467,
    470,
    1,
    0,
    0,
    0,
    468,
    466,
    1,
    0,
    0,
    0,
    468,
    469,
    1,
    0,
    0,
    0,
    469,
    472,
    1,
    0,
    0,
    0,
    470,
    468,
    1,
    0,
    0,
    0,
    471,
    473,
    5,
    24,
    0,
    0,
    472,
    471,
    1,
    0,
    0,
    0,
    472,
    473,
    1,
    0,
    0,
    0,
    473,
    475,
    1,
    0,
    0,
    0,
    474,
    463,
    1,
    0,
    0,
    0,
    474,
    475,
    1,
    0,
    0,
    0,
    475,
    476,
    1,
    0,
    0,
    0,
    476,
    477,
    5,
    27,
    0,
    0,
    477,
    59,
    1,
    0,
    0,
    0,
    478,
    482,
    3,
    62,
    31,
    0,
    479,
    482,
    5,
    54,
    0,
    0,
    480,
    482,
    3,
    6,
    3,
    0,
    481,
    478,
    1,
    0,
    0,
    0,
    481,
    479,
    1,
    0,
    0,
    0,
    481,
    480,
    1,
    0,
    0,
    0,
    482,
    61,
    1,
    0,
    0,
    0,
    483,
    484,
    7,
    2,
    0,
    0,
    484,
    63,
    1,
    0,
    0,
    0,
    485,
    489,
    3,
    62,
    31,
    0,
    486,
    489,
    3,
    66,
    33,
    0,
    487,
    489,
    3,
    6,
    3,
    0,
    488,
    485,
    1,
    0,
    0,
    0,
    488,
    486,
    1,
    0,
    0,
    0,
    488,
    487,
    1,
    0,
    0,
    0,
    489,
    65,
    1,
    0,
    0,
    0,
    490,
    495,
    5,
    10,
    0,
    0,
    491,
    492,
    5,
    18,
    0,
    0,
    492,
    494,
    3,
    4,
    2,
    0,
    493,
    491,
    1,
    0,
    0,
    0,
    494,
    497,
    1,
    0,
    0,
    0,
    495,
    493,
    1,
    0,
    0,
    0,
    495,
    496,
    1,
    0,
    0,
    0,
    496,
    67,
    1,
    0,
    0,
    0,
    497,
    495,
    1,
    0,
    0,
    0,
    498,
    499,
    3,
    70,
    35,
    0,
    499,
    69,
    1,
    0,
    0,
    0,
    500,
    505,
    3,
    72,
    36,
    0,
    501,
    502,
    5,
    33,
    0,
    0,
    502,
    504,
    3,
    72,
    36,
    0,
    503,
    501,
    1,
    0,
    0,
    0,
    504,
    507,
    1,
    0,
    0,
    0,
    505,
    503,
    1,
    0,
    0,
    0,
    505,
    506,
    1,
    0,
    0,
    0,
    506,
    71,
    1,
    0,
    0,
    0,
    507,
    505,
    1,
    0,
    0,
    0,
    508,
    513,
    3,
    74,
    37,
    0,
    509,
    510,
    5,
    34,
    0,
    0,
    510,
    512,
    3,
    74,
    37,
    0,
    511,
    509,
    1,
    0,
    0,
    0,
    512,
    515,
    1,
    0,
    0,
    0,
    513,
    511,
    1,
    0,
    0,
    0,
    513,
    514,
    1,
    0,
    0,
    0,
    514,
    73,
    1,
    0,
    0,
    0,
    515,
    513,
    1,
    0,
    0,
    0,
    516,
    517,
    5,
    35,
    0,
    0,
    517,
    520,
    3,
    74,
    37,
    0,
    518,
    520,
    3,
    76,
    38,
    0,
    519,
    516,
    1,
    0,
    0,
    0,
    519,
    518,
    1,
    0,
    0,
    0,
    520,
    75,
    1,
    0,
    0,
    0,
    521,
    525,
    3,
    80,
    40,
    0,
    522,
    523,
    3,
    78,
    39,
    0,
    523,
    524,
    3,
    80,
    40,
    0,
    524,
    526,
    1,
    0,
    0,
    0,
    525,
    522,
    1,
    0,
    0,
    0,
    525,
    526,
    1,
    0,
    0,
    0,
    526,
    77,
    1,
    0,
    0,
    0,
    527,
    528,
    7,
    3,
    0,
    0,
    528,
    79,
    1,
    0,
    0,
    0,
    529,
    530,
    5,
    21,
    0,
    0,
    530,
    531,
    3,
    70,
    35,
    0,
    531,
    532,
    5,
    22,
    0,
    0,
    532,
    537,
    1,
    0,
    0,
    0,
    533,
    537,
    3,
    62,
    31,
    0,
    534,
    537,
    3,
    66,
    33,
    0,
    535,
    537,
    3,
    6,
    3,
    0,
    536,
    529,
    1,
    0,
    0,
    0,
    536,
    533,
    1,
    0,
    0,
    0,
    536,
    534,
    1,
    0,
    0,
    0,
    536,
    535,
    1,
    0,
    0,
    0,
    537,
    81,
    1,
    0,
    0,
    0,
    68,
    85,
    96,
    105,
    116,
    122,
    132,
    142,
    151,
    155,
    167,
    178,
    182,
    188,
    194,
    206,
    215,
    220,
    230,
    233,
    236,
    241,
    246,
    253,
    258,
    268,
    272,
    285,
    290,
    296,
    302,
    304,
    309,
    316,
    325,
    329,
    333,
    339,
    343,
    352,
    356,
    360,
    370,
    376,
    384,
    394,
    398,
    400,
    414,
    418,
    422,
    424,
    429,
    433,
    442,
    446,
    453,
    460,
    468,
    472,
    474,
    481,
    488,
    495,
    505,
    513,
    519,
    525,
    536
  ];
  static __ATN;
  static get _ATN() {
    if (!HaloParser.__ATN) {
      HaloParser.__ATN = new ATNDeserializer().deserialize(HaloParser._serializedATN);
    }
    return HaloParser.__ATN;
  }
  static vocabulary = new Vocabulary(HaloParser.literalNames, HaloParser.symbolicNames, []);
  get vocabulary() {
    return HaloParser.vocabulary;
  }
  static decisionsToDFA = HaloParser._ATN.decisionToState.map((ds, index) => new DFA(ds, index));
}

class ProgramContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  EOF() {
    return this.getToken(HaloParser.EOF, 0);
  }
  declaration(i) {
    if (i === undefined) {
      return this.getRuleContexts(DeclarationContext);
    }
    return this.getRuleContext(i, DeclarationContext);
  }
  get ruleIndex() {
    return HaloParser.RULE_program;
  }
  accept(visitor) {
    if (visitor.visitProgram) {
      return visitor.visitProgram(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class DeclarationContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  policyDecl() {
    return this.getRuleContext(0, PolicyDeclContext);
  }
  toolDecl() {
    return this.getRuleContext(0, ToolDeclContext);
  }
  storeDecl() {
    return this.getRuleContext(0, StoreDeclContext);
  }
  schemaDecl() {
    return this.getRuleContext(0, SchemaDeclContext);
  }
  agentDecl() {
    return this.getRuleContext(0, AgentDeclContext);
  }
  pipelineDecl() {
    return this.getRuleContext(0, PipelineDeclContext);
  }
  get ruleIndex() {
    return HaloParser.RULE_declaration;
  }
  accept(visitor) {
    if (visitor.visitDeclaration) {
      return visitor.visitDeclaration(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class NameContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  IDENTIFIER() {
    return this.getToken(HaloParser.IDENTIFIER, 0);
  }
  get ruleIndex() {
    return HaloParser.RULE_name;
  }
  accept(visitor) {
    if (visitor.visitName) {
      return visitor.visitName(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class DottedIdContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  IDENTIFIER() {
    return this.getToken(HaloParser.IDENTIFIER, 0);
  }
  name(i) {
    if (i === undefined) {
      return this.getRuleContexts(NameContext);
    }
    return this.getRuleContext(i, NameContext);
  }
  get ruleIndex() {
    return HaloParser.RULE_dottedId;
  }
  accept(visitor) {
    if (visitor.visitDottedId) {
      return visitor.visitDottedId(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class PolicyDeclContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  IDENTIFIER() {
    return this.getToken(HaloParser.IDENTIFIER, 0);
  }
  policyRule(i) {
    if (i === undefined) {
      return this.getRuleContexts(PolicyRuleContext);
    }
    return this.getRuleContext(i, PolicyRuleContext);
  }
  get ruleIndex() {
    return HaloParser.RULE_policyDecl;
  }
  accept(visitor) {
    if (visitor.visitPolicyDecl) {
      return visitor.visitPolicyDecl(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class PolicyRuleContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  IDENTIFIER() {
    return this.getToken(HaloParser.IDENTIFIER, 0);
  }
  callArgs() {
    return this.getRuleContext(0, CallArgsContext);
  }
  get ruleIndex() {
    return HaloParser.RULE_policyRule;
  }
  accept(visitor) {
    if (visitor.visitPolicyRule) {
      return visitor.visitPolicyRule(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class ToolDeclContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  IDENTIFIER(i) {
    if (i === undefined) {
      return this.getTokens(HaloParser.IDENTIFIER);
    } else {
      return this.getToken(HaloParser.IDENTIFIER, i);
    }
  }
  callArgs() {
    return this.getRuleContext(0, CallArgsContext);
  }
  get ruleIndex() {
    return HaloParser.RULE_toolDecl;
  }
  accept(visitor) {
    if (visitor.visitToolDecl) {
      return visitor.visitToolDecl(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class StoreDeclContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  IDENTIFIER(i) {
    if (i === undefined) {
      return this.getTokens(HaloParser.IDENTIFIER);
    } else {
      return this.getToken(HaloParser.IDENTIFIER, i);
    }
  }
  callArgs() {
    return this.getRuleContext(0, CallArgsContext);
  }
  get ruleIndex() {
    return HaloParser.RULE_storeDecl;
  }
  accept(visitor) {
    if (visitor.visitStoreDecl) {
      return visitor.visitStoreDecl(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class SchemaDeclContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  IDENTIFIER() {
    return this.getToken(HaloParser.IDENTIFIER, 0);
  }
  schemaField(i) {
    if (i === undefined) {
      return this.getRuleContexts(SchemaFieldContext);
    }
    return this.getRuleContext(i, SchemaFieldContext);
  }
  get ruleIndex() {
    return HaloParser.RULE_schemaDecl;
  }
  accept(visitor) {
    if (visitor.visitSchemaDecl) {
      return visitor.visitSchemaDecl(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class SchemaFieldContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  name() {
    return this.getRuleContext(0, NameContext);
  }
  typeRef() {
    return this.getRuleContext(0, TypeRefContext);
  }
  get ruleIndex() {
    return HaloParser.RULE_schemaField;
  }
  accept(visitor) {
    if (visitor.visitSchemaField) {
      return visitor.visitSchemaField(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class AgentDeclContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  IDENTIFIER() {
    return this.getToken(HaloParser.IDENTIFIER, 0);
  }
  modelRef() {
    return this.getRuleContext(0, ModelRefContext);
  }
  directive(i) {
    if (i === undefined) {
      return this.getRuleContexts(DirectiveContext);
    }
    return this.getRuleContext(i, DirectiveContext);
  }
  modelParam(i) {
    if (i === undefined) {
      return this.getRuleContexts(ModelParamContext);
    }
    return this.getRuleContext(i, ModelParamContext);
  }
  agentModifier(i) {
    if (i === undefined) {
      return this.getRuleContexts(AgentModifierContext);
    }
    return this.getRuleContext(i, AgentModifierContext);
  }
  get ruleIndex() {
    return HaloParser.RULE_agentDecl;
  }
  accept(visitor) {
    if (visitor.visitAgentDecl) {
      return visitor.visitAgentDecl(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class ModelRefContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  MODEL_REF() {
    return this.getToken(HaloParser.MODEL_REF, 0);
  }
  STRING() {
    return this.getToken(HaloParser.STRING, 0);
  }
  dottedId() {
    return this.getRuleContext(0, DottedIdContext);
  }
  get ruleIndex() {
    return HaloParser.RULE_modelRef;
  }
  accept(visitor) {
    if (visitor.visitModelRef) {
      return visitor.visitModelRef(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class ModelParamContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  name() {
    return this.getRuleContext(0, NameContext);
  }
  value() {
    return this.getRuleContext(0, ValueContext);
  }
  get ruleIndex() {
    return HaloParser.RULE_modelParam;
  }
  accept(visitor) {
    if (visitor.visitModelParam) {
      return visitor.visitModelParam(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class AgentModifierContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  get ruleIndex() {
    return HaloParser.RULE_agentModifier;
  }
  copyFrom(ctx) {
    super.copyFrom(ctx);
  }
}

class RequiresModifierContext extends AgentModifierContext {
  constructor(ctx) {
    super(ctx.parent, ctx.invokingState);
    super.copyFrom(ctx);
  }
  IDENTIFIER(i) {
    if (i === undefined) {
      return this.getTokens(HaloParser.IDENTIFIER);
    } else {
      return this.getToken(HaloParser.IDENTIFIER, i);
    }
  }
  accept(visitor) {
    if (visitor.visitRequiresModifier) {
      return visitor.visitRequiresModifier(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class SystemModifierContext extends AgentModifierContext {
  constructor(ctx) {
    super(ctx.parent, ctx.invokingState);
    super.copyFrom(ctx);
  }
  STRING() {
    return this.getToken(HaloParser.STRING, 0);
  }
  TRIPLE_STRING() {
    return this.getToken(HaloParser.TRIPLE_STRING, 0);
  }
  accept(visitor) {
    if (visitor.visitSystemModifier) {
      return visitor.visitSystemModifier(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class EquipsModifierContext extends AgentModifierContext {
  constructor(ctx) {
    super(ctx.parent, ctx.invokingState);
    super.copyFrom(ctx);
  }
  IDENTIFIER(i) {
    if (i === undefined) {
      return this.getTokens(HaloParser.IDENTIFIER);
    } else {
      return this.getToken(HaloParser.IDENTIFIER, i);
    }
  }
  accept(visitor) {
    if (visitor.visitEquipsModifier) {
      return visitor.visitEquipsModifier(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class DirectiveContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  name() {
    return this.getRuleContext(0, NameContext);
  }
  directiveArg(i) {
    if (i === undefined) {
      return this.getRuleContexts(DirectiveArgContext);
    }
    return this.getRuleContext(i, DirectiveArgContext);
  }
  get ruleIndex() {
    return HaloParser.RULE_directive;
  }
  accept(visitor) {
    if (visitor.visitDirective) {
      return visitor.visitDirective(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class DirectiveArgContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  literal() {
    return this.getRuleContext(0, LiteralContext);
  }
  MODEL_REF() {
    return this.getToken(HaloParser.MODEL_REF, 0);
  }
  dottedId() {
    return this.getRuleContext(0, DottedIdContext);
  }
  get ruleIndex() {
    return HaloParser.RULE_directiveArg;
  }
  accept(visitor) {
    if (visitor.visitDirectiveArg) {
      return visitor.visitDirectiveArg(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class PipelineDeclContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  IDENTIFIER() {
    return this.getToken(HaloParser.IDENTIFIER, 0);
  }
  pipeline() {
    return this.getRuleContext(0, PipelineContext);
  }
  directive(i) {
    if (i === undefined) {
      return this.getRuleContexts(DirectiveContext);
    }
    return this.getRuleContext(i, DirectiveContext);
  }
  paramList() {
    return this.getRuleContext(0, ParamListContext);
  }
  typeRef() {
    return this.getRuleContext(0, TypeRefContext);
  }
  get ruleIndex() {
    return HaloParser.RULE_pipelineDecl;
  }
  accept(visitor) {
    if (visitor.visitPipelineDecl) {
      return visitor.visitPipelineDecl(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class ParamListContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  param(i) {
    if (i === undefined) {
      return this.getRuleContexts(ParamContext);
    }
    return this.getRuleContext(i, ParamContext);
  }
  get ruleIndex() {
    return HaloParser.RULE_paramList;
  }
  accept(visitor) {
    if (visitor.visitParamList) {
      return visitor.visitParamList(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class ParamContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  IDENTIFIER() {
    return this.getToken(HaloParser.IDENTIFIER, 0);
  }
  typeRef() {
    return this.getRuleContext(0, TypeRefContext);
  }
  get ruleIndex() {
    return HaloParser.RULE_param;
  }
  accept(visitor) {
    if (visitor.visitParam) {
      return visitor.visitParam(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class TypeRefContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  dottedId() {
    return this.getRuleContext(0, DottedIdContext);
  }
  typeRef(i) {
    if (i === undefined) {
      return this.getRuleContexts(TypeRefContext);
    }
    return this.getRuleContext(i, TypeRefContext);
  }
  get ruleIndex() {
    return HaloParser.RULE_typeRef;
  }
  accept(visitor) {
    if (visitor.visitTypeRef) {
      return visitor.visitTypeRef(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class PipelineContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  expression() {
    return this.getRuleContext(0, ExpressionContext);
  }
  pipelineOp(i) {
    if (i === undefined) {
      return this.getRuleContexts(PipelineOpContext);
    }
    return this.getRuleContext(i, PipelineOpContext);
  }
  get ruleIndex() {
    return HaloParser.RULE_pipeline;
  }
  accept(visitor) {
    if (visitor.visitPipeline) {
      return visitor.visitPipeline(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class PipelineOpContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  get ruleIndex() {
    return HaloParser.RULE_pipelineOp;
  }
  copyFrom(ctx) {
    super.copyFrom(ctx);
  }
}

class FanoutOpContext extends PipelineOpContext {
  constructor(ctx) {
    super(ctx.parent, ctx.invokingState);
    super.copyFrom(ctx);
  }
  FANOUT() {
    return this.getToken(HaloParser.FANOUT, 0);
  }
  fanoutItem(i) {
    if (i === undefined) {
      return this.getRuleContexts(FanoutItemContext);
    }
    return this.getRuleContext(i, FanoutItemContext);
  }
  binding() {
    return this.getRuleContext(0, BindingContext);
  }
  accept(visitor) {
    if (visitor.visitFanoutOp) {
      return visitor.visitFanoutOp(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class ListenOpContext extends PipelineOpContext {
  constructor(ctx) {
    super(ctx.parent, ctx.invokingState);
    super.copyFrom(ctx);
  }
  LISTEN() {
    return this.getToken(HaloParser.LISTEN, 0);
  }
  callValue() {
    return this.getRuleContext(0, CallValueContext);
  }
  binding() {
    return this.getRuleContext(0, BindingContext);
  }
  accept(visitor) {
    if (visitor.visitListenOp) {
      return visitor.visitListenOp(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class PipeOpContext extends PipelineOpContext {
  constructor(ctx) {
    super(ctx.parent, ctx.invokingState);
    super.copyFrom(ctx);
  }
  PIPE() {
    return this.getToken(HaloParser.PIPE, 0);
  }
  callExpr() {
    return this.getRuleContext(0, CallExprContext);
  }
  binding() {
    return this.getRuleContext(0, BindingContext);
  }
  accept(visitor) {
    if (visitor.visitPipeOp) {
      return visitor.visitPipeOp(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class GateOpContext extends PipelineOpContext {
  constructor(ctx) {
    super(ctx.parent, ctx.invokingState);
    super.copyFrom(ctx);
  }
  GATE() {
    return this.getToken(HaloParser.GATE, 0);
  }
  condExpr() {
    return this.getRuleContext(0, CondExprContext);
  }
  accept(visitor) {
    if (visitor.visitGateOp) {
      return visitor.visitGateOp(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class EachOpContext extends PipelineOpContext {
  constructor(ctx) {
    super(ctx.parent, ctx.invokingState);
    super.copyFrom(ctx);
  }
  FANOUT() {
    return this.getToken(HaloParser.FANOUT, 0);
  }
  IDENTIFIER() {
    return this.getToken(HaloParser.IDENTIFIER, 0);
  }
  callValue() {
    return this.getRuleContext(0, CallValueContext);
  }
  callExpr() {
    return this.getRuleContext(0, CallExprContext);
  }
  callArgs() {
    return this.getRuleContext(0, CallArgsContext);
  }
  binding() {
    return this.getRuleContext(0, BindingContext);
  }
  accept(visitor) {
    if (visitor.visitEachOp) {
      return visitor.visitEachOp(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class InterruptOpContext extends PipelineOpContext {
  constructor(ctx) {
    super(ctx.parent, ctx.invokingState);
    super.copyFrom(ctx);
  }
  INTERRUPT() {
    return this.getToken(HaloParser.INTERRUPT, 0);
  }
  callArgs() {
    return this.getRuleContext(0, CallArgsContext);
  }
  binding() {
    return this.getRuleContext(0, BindingContext);
  }
  accept(visitor) {
    if (visitor.visitInterruptOp) {
      return visitor.visitInterruptOp(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class LoopOpContext extends PipelineOpContext {
  constructor(ctx) {
    super(ctx.parent, ctx.invokingState);
    super.copyFrom(ctx);
  }
  LOOP() {
    return this.getToken(HaloParser.LOOP, 0);
  }
  IDENTIFIER() {
    return this.getToken(HaloParser.IDENTIFIER, 0);
  }
  STRING() {
    return this.getToken(HaloParser.STRING, 0);
  }
  TRIPLE_STRING() {
    return this.getToken(HaloParser.TRIPLE_STRING, 0);
  }
  callArgs() {
    return this.getRuleContext(0, CallArgsContext);
  }
  binding() {
    return this.getRuleContext(0, BindingContext);
  }
  accept(visitor) {
    if (visitor.visitLoopOp) {
      return visitor.visitLoopOp(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class BranchOpContext extends PipelineOpContext {
  constructor(ctx) {
    super(ctx.parent, ctx.invokingState);
    super.copyFrom(ctx);
  }
  GATE() {
    return this.getToken(HaloParser.GATE, 0);
  }
  branchArm(i) {
    if (i === undefined) {
      return this.getRuleContexts(BranchArmContext);
    }
    return this.getRuleContext(i, BranchArmContext);
  }
  binding() {
    return this.getRuleContext(0, BindingContext);
  }
  accept(visitor) {
    if (visitor.visitBranchOp) {
      return visitor.visitBranchOp(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class BindingContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  name() {
    return this.getRuleContext(0, NameContext);
  }
  get ruleIndex() {
    return HaloParser.RULE_binding;
  }
  accept(visitor) {
    if (visitor.visitBinding) {
      return visitor.visitBinding(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class BranchArmContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  get ruleIndex() {
    return HaloParser.RULE_branchArm;
  }
  copyFrom(ctx) {
    super.copyFrom(ctx);
  }
}

class CondArmContext extends BranchArmContext {
  constructor(ctx) {
    super(ctx.parent, ctx.invokingState);
    super.copyFrom(ctx);
  }
  condExpr() {
    return this.getRuleContext(0, CondExprContext);
  }
  callExpr() {
    return this.getRuleContext(0, CallExprContext);
  }
  accept(visitor) {
    if (visitor.visitCondArm) {
      return visitor.visitCondArm(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class ElseArmContext extends BranchArmContext {
  constructor(ctx) {
    super(ctx.parent, ctx.invokingState);
    super.copyFrom(ctx);
  }
  callExpr() {
    return this.getRuleContext(0, CallExprContext);
  }
  accept(visitor) {
    if (visitor.visitElseArm) {
      return visitor.visitElseArm(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class FanoutItemContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  callExpr() {
    return this.getRuleContext(0, CallExprContext);
  }
  binding() {
    return this.getRuleContext(0, BindingContext);
  }
  IDENTIFIER() {
    return this.getToken(HaloParser.IDENTIFIER, 0);
  }
  get ruleIndex() {
    return HaloParser.RULE_fanoutItem;
  }
  accept(visitor) {
    if (visitor.visitFanoutItem) {
      return visitor.visitFanoutItem(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class CallExprContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  IDENTIFIER() {
    return this.getToken(HaloParser.IDENTIFIER, 0);
  }
  name() {
    return this.getRuleContext(0, NameContext);
  }
  callArgs() {
    return this.getRuleContext(0, CallArgsContext);
  }
  get ruleIndex() {
    return HaloParser.RULE_callExpr;
  }
  accept(visitor) {
    if (visitor.visitCallExpr) {
      return visitor.visitCallExpr(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class CallArgsContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  callArg(i) {
    if (i === undefined) {
      return this.getRuleContexts(CallArgContext);
    }
    return this.getRuleContext(i, CallArgContext);
  }
  get ruleIndex() {
    return HaloParser.RULE_callArgs;
  }
  accept(visitor) {
    if (visitor.visitCallArgs) {
      return visitor.visitCallArgs(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}
class CallArgContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  get ruleIndex() {
    return HaloParser.RULE_callArg;
  }
  copyFrom(ctx) {
    super.copyFrom(ctx);
  }
}

class NamedArgContext extends CallArgContext {
  constructor(ctx) {
    super(ctx.parent, ctx.invokingState);
    super.copyFrom(ctx);
  }
  name() {
    return this.getRuleContext(0, NameContext);
  }
  callValue() {
    return this.getRuleContext(0, CallValueContext);
  }
  accept(visitor) {
    if (visitor.visitNamedArg) {
      return visitor.visitNamedArg(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class PositionalArgContext extends CallArgContext {
  constructor(ctx) {
    super(ctx.parent, ctx.invokingState);
    super.copyFrom(ctx);
  }
  callValue() {
    return this.getRuleContext(0, CallValueContext);
  }
  accept(visitor) {
    if (visitor.visitPositionalArg) {
      return visitor.visitPositionalArg(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class CallValueContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  literal() {
    return this.getRuleContext(0, LiteralContext);
  }
  MODEL_REF() {
    return this.getToken(HaloParser.MODEL_REF, 0);
  }
  contextRef() {
    return this.getRuleContext(0, ContextRefContext);
  }
  listValue() {
    return this.getRuleContext(0, ListValueContext);
  }
  dottedId() {
    return this.getRuleContext(0, DottedIdContext);
  }
  get ruleIndex() {
    return HaloParser.RULE_callValue;
  }
  accept(visitor) {
    if (visitor.visitCallValue) {
      return visitor.visitCallValue(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class ListValueContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  callValue(i) {
    if (i === undefined) {
      return this.getRuleContexts(CallValueContext);
    }
    return this.getRuleContext(i, CallValueContext);
  }
  get ruleIndex() {
    return HaloParser.RULE_listValue;
  }
  accept(visitor) {
    if (visitor.visitListValue) {
      return visitor.visitListValue(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class ValueContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  literal() {
    return this.getRuleContext(0, LiteralContext);
  }
  MODEL_REF() {
    return this.getToken(HaloParser.MODEL_REF, 0);
  }
  dottedId() {
    return this.getRuleContext(0, DottedIdContext);
  }
  get ruleIndex() {
    return HaloParser.RULE_value;
  }
  accept(visitor) {
    if (visitor.visitValue) {
      return visitor.visitValue(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class LiteralContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  STRING() {
    return this.getToken(HaloParser.STRING, 0);
  }
  TRIPLE_STRING() {
    return this.getToken(HaloParser.TRIPLE_STRING, 0);
  }
  NUMBER() {
    return this.getToken(HaloParser.NUMBER, 0);
  }
  DURATION() {
    return this.getToken(HaloParser.DURATION, 0);
  }
  BOOL() {
    return this.getToken(HaloParser.BOOL, 0);
  }
  NULL() {
    return this.getToken(HaloParser.NULL, 0);
  }
  get ruleIndex() {
    return HaloParser.RULE_literal;
  }
  accept(visitor) {
    if (visitor.visitLiteral) {
      return visitor.visitLiteral(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class ExpressionContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  literal() {
    return this.getRuleContext(0, LiteralContext);
  }
  contextRef() {
    return this.getRuleContext(0, ContextRefContext);
  }
  dottedId() {
    return this.getRuleContext(0, DottedIdContext);
  }
  get ruleIndex() {
    return HaloParser.RULE_expression;
  }
  accept(visitor) {
    if (visitor.visitExpression) {
      return visitor.visitExpression(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class ContextRefContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  name(i) {
    if (i === undefined) {
      return this.getRuleContexts(NameContext);
    }
    return this.getRuleContext(i, NameContext);
  }
  get ruleIndex() {
    return HaloParser.RULE_contextRef;
  }
  accept(visitor) {
    if (visitor.visitContextRef) {
      return visitor.visitContextRef(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class CondExprContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  orExpr() {
    return this.getRuleContext(0, OrExprContext);
  }
  get ruleIndex() {
    return HaloParser.RULE_condExpr;
  }
  accept(visitor) {
    if (visitor.visitCondExpr) {
      return visitor.visitCondExpr(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class OrExprContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  andExpr(i) {
    if (i === undefined) {
      return this.getRuleContexts(AndExprContext);
    }
    return this.getRuleContext(i, AndExprContext);
  }
  get ruleIndex() {
    return HaloParser.RULE_orExpr;
  }
  accept(visitor) {
    if (visitor.visitOrExpr) {
      return visitor.visitOrExpr(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class AndExprContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  notExpr(i) {
    if (i === undefined) {
      return this.getRuleContexts(NotExprContext);
    }
    return this.getRuleContext(i, NotExprContext);
  }
  get ruleIndex() {
    return HaloParser.RULE_andExpr;
  }
  accept(visitor) {
    if (visitor.visitAndExpr) {
      return visitor.visitAndExpr(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class NotExprContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  get ruleIndex() {
    return HaloParser.RULE_notExpr;
  }
  copyFrom(ctx) {
    super.copyFrom(ctx);
  }
}

class NegationContext extends NotExprContext {
  constructor(ctx) {
    super(ctx.parent, ctx.invokingState);
    super.copyFrom(ctx);
  }
  notExpr() {
    return this.getRuleContext(0, NotExprContext);
  }
  accept(visitor) {
    if (visitor.visitNegation) {
      return visitor.visitNegation(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class ComparisonExprContext extends NotExprContext {
  constructor(ctx) {
    super(ctx.parent, ctx.invokingState);
    super.copyFrom(ctx);
  }
  comparison() {
    return this.getRuleContext(0, ComparisonContext);
  }
  accept(visitor) {
    if (visitor.visitComparisonExpr) {
      return visitor.visitComparisonExpr(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class ComparisonContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  operand(i) {
    if (i === undefined) {
      return this.getRuleContexts(OperandContext);
    }
    return this.getRuleContext(i, OperandContext);
  }
  compOp() {
    return this.getRuleContext(0, CompOpContext);
  }
  get ruleIndex() {
    return HaloParser.RULE_comparison;
  }
  accept(visitor) {
    if (visitor.visitComparison) {
      return visitor.visitComparison(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class CompOpContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  get ruleIndex() {
    return HaloParser.RULE_compOp;
  }
  accept(visitor) {
    if (visitor.visitCompOp) {
      return visitor.visitCompOp(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class OperandContext extends ParserRuleContext {
  constructor(parent, invokingState) {
    super(parent, invokingState);
  }
  get ruleIndex() {
    return HaloParser.RULE_operand;
  }
  copyFrom(ctx) {
    super.copyFrom(ctx);
  }
}

class LiteralOperandContext extends OperandContext {
  constructor(ctx) {
    super(ctx.parent, ctx.invokingState);
    super.copyFrom(ctx);
  }
  literal() {
    return this.getRuleContext(0, LiteralContext);
  }
  accept(visitor) {
    if (visitor.visitLiteralOperand) {
      return visitor.visitLiteralOperand(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class ParenOperandContext extends OperandContext {
  constructor(ctx) {
    super(ctx.parent, ctx.invokingState);
    super.copyFrom(ctx);
  }
  orExpr() {
    return this.getRuleContext(0, OrExprContext);
  }
  accept(visitor) {
    if (visitor.visitParenOperand) {
      return visitor.visitParenOperand(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class ContextOperandContext extends OperandContext {
  constructor(ctx) {
    super(ctx.parent, ctx.invokingState);
    super.copyFrom(ctx);
  }
  contextRef() {
    return this.getRuleContext(0, ContextRefContext);
  }
  accept(visitor) {
    if (visitor.visitContextOperand) {
      return visitor.visitContextOperand(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class RefOperandContext extends OperandContext {
  constructor(ctx) {
    super(ctx.parent, ctx.invokingState);
    super.copyFrom(ctx);
  }
  dottedId() {
    return this.getRuleContext(0, DottedIdContext);
  }
  accept(visitor) {
    if (visitor.visitRefOperand) {
      return visitor.visitRefOperand(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

// src/parser/builtins.ts
var DIRECTIVES = ["timeout", "retry", "checkpoint", "shadow", "correct"];
var SCHEMA_TYPES = ["String", "Number", "Integer", "Boolean", "Array", "List", "Object", "Map", "JSON", "Any"];
var SYSTEM_METHODS = ["Print", "Log", "Sleep", "Fail", "Pick"];
var SYSTEM_EVENTS = ["ResolveIncident", "Publish", "Distribute", "TriggerWebhook", "Notify"];
var TOOL_PROVIDERS = ["REST", "GET", "POST", "VectorStore", "PostgreSQL", "SQL", "Bash", "Browser", "File", "Slack", "Email", "GitHub", "Linear", "Figma"];
var BLOCK_CATEGORIES = ["Profanity", "DestructiveOps", "PromptInjection", "PII", "SSN", "CreditCard", "Email", "Phone", "APIKey", "Markdown"];
var REDACT_CATEGORIES = ["PII", "SSN", "CreditCard", "Email", "Phone", "APIKey", "IPAddress"];
var ENFORCED_RULES = ["Block", "Redact", "MaxWords", "MaxChars", "MaxTokens", "MaxSpend", "LogViolation", "Enforce", "Require", "MatchRegex", "Validate"];
var REQUIRE_CHECKS = ["JSON", "XML", "Citation"];
var UNENFORCED_RULES = ["Tone", "Anonymize", "MaxDensity"];
var CONTEXT_NAMESPACES = ["data", "input", "meta", "trace", "current"];
function includes(list, value) {
  return list.includes(value);
}
function parseDuration(d) {
  const m = d.trim().match(/^(\d+)(ms|s|m|h|d)$/);
  if (!m)
    return NaN;
  const unit = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2]];
  return Number(m[1]) * unit;
}

// src/parser/validate.ts
function validate(ast, options = {}) {
  return new Validator(ast, options).run();
}

class Validator {
  ast;
  options;
  diags = [];
  agents;
  tools;
  policies;
  pipelines;
  constructor(ast, options) {
    this.ast = ast;
    this.options = options;
    this.agents = new Map(ast.agents.map((m) => [m.name, m]));
    this.tools = new Map([...ast.tools, ...ast.stores].map((t) => [t.name, t]));
    this.policies = new Map(ast.policies.map((g) => [g.name, g]));
    this.pipelines = new Map(ast.pipelines.map((s) => [s.name, s]));
  }
  isDeclaredName(name) {
    return this.agents.has(name) || this.tools.has(name) || this.policies.has(name) || this.pipelines.has(name);
  }
  add(severity, message, loc) {
    this.diags.push({ severity, message, ...loc ? { line: loc.line, column: loc.column } : {} });
  }
  run() {
    this.checkDuplicates();
    for (const g of this.ast.policies)
      this.checkPolicy(g);
    for (const t of this.tools.values()) {
      const known = includes(TOOL_PROVIDERS, t.provider) || this.options.toolProviders?.includes(t.provider);
      if (!known)
        this.add("warning", `Tool "${t.name}" uses unknown provider "${t.provider}" (register it with runtime.registerToolProvider)`, t.loc);
    }
    for (const m of this.ast.agents)
      this.checkAgent(m);
    for (const sc of this.ast.schemas)
      this.checkSchema(sc);
    for (const s of this.ast.pipelines)
      this.checkPipeline(s);
    const seen = new Set;
    this.diags = this.diags.filter((d) => {
      const key = `${d.severity}|${d.line}|${d.message}`;
      return !seen.has(key) && !!seen.add(key);
    });
    return this.diags.sort((a, b) => (a.line ?? 0) - (b.line ?? 0) || (a.column ?? 0) - (b.column ?? 0));
  }
  checkDuplicates() {
    const seen = new Map;
    const decls = [
      ...this.ast.policies.map((d) => ["policy", d.name, d.loc]),
      ...this.ast.tools.map((d) => ["tool", d.name, d.loc]),
      ...this.ast.stores.map((d) => ["store", d.name, d.loc]),
      ...this.ast.schemas.map((d) => ["schema", d.name, d.loc]),
      ...this.ast.agents.map((d) => ["agent", d.name, d.loc]),
      ...this.ast.pipelines.map((d) => ["pipeline", d.name, d.loc])
    ];
    for (const [kind, name, loc] of decls) {
      if (name === "System" || name === "Env")
        this.add("error", `"${name}" is reserved and cannot be declared`, loc);
      const prev = seen.get(name);
      if (prev)
        this.add("error", `Duplicate declaration "${name}" (already declared as ${prev})`, loc);
      else
        seen.set(name, kind);
    }
  }
  checkPolicy(g) {
    for (const rule of g.rules) {
      if (includes(UNENFORCED_RULES, rule.name)) {
        this.add("warning", `Policy "${g.name}": ${rule.name}(...) is not enforced by the runtime yet`, g.loc);
      } else if (!includes(ENFORCED_RULES, rule.name)) {
        this.add("warning", `Policy "${g.name}": unknown rule ${rule.name}(...) is ignored`, g.loc);
      } else if (rule.name === "Block" || rule.name === "Redact") {
        const known = rule.name === "Block" ? BLOCK_CATEGORIES : REDACT_CATEGORIES;
        for (const cat of rule.args) {
          if (!known.includes(cat))
            this.add("warning", `Policy "${g.name}": ${rule.name}(${cat}) is not a detectable category and is not enforced`, g.loc);
        }
      } else if (rule.name === "Require" && !rule.args.every((a) => includes(REQUIRE_CHECKS, a))) {
        this.add("warning", `Policy "${g.name}": Require(${rule.args.join(", ")}) is not enforced; only Require(${REQUIRE_CHECKS.join(" | ")}) is checked`, g.loc);
      } else if (rule.name === "Validate" && rule.args.length !== 3) {
        this.add("error", `Policy "${g.name}": Validate needs a field, an operator, and a value, e.g. Validate("amount", "<=", "context.data.limit")`, g.loc);
      } else if (rule.name === "Enforce" && !rule.args.every((a) => a.toUpperCase() === "JSON")) {
        this.add("warning", `Policy "${g.name}": Enforce(${rule.args.join(", ")}) is not enforced; only Enforce(JSON) is checked`, g.loc);
      } else if ((rule.name === "MaxWords" || rule.name === "MaxChars" || rule.name === "MaxTokens" || rule.name === "MaxSpend") && !(Number(rule.args[0]) >= 0)) {
        this.add("error", `Policy "${g.name}": ${rule.name} needs a numeric limit`, g.loc);
      }
    }
  }
  checkAgent(m) {
    for (const r of m.requires ?? []) {
      if (!this.policies.has(r))
        this.add("error", `Agent "${m.name}" requires undefined policy "${r}"`, m.loc);
    }
    for (const e of m.equips ?? []) {
      if (!this.tools.has(e))
        this.add("error", `Agent "${m.name}" equips undefined tool "${e}"`, m.loc);
    }
    if (this.options.canHandleModel && !this.options.canHandleModel(m.modelId)) {
      this.add("warning", `Agent "${m.name}": no adapter handles model "${m.modelId}"`, m.loc);
    }
    for (const d of m.directives ?? []) {
      this.checkDirective(d, m.loc, "agent");
      if (d.name === "shadow") {
        const target = d.value;
        if (target === m.name)
          this.add("error", `Agent "${m.name}" cannot shadow itself`, m.loc);
        else if (!this.agents.has(target) && !/[-/]/.test(target)) {
          this.add("warning", `@shadow(${target}) on "${m.name}": "${target}" is not a defined agent or model, so it will never run`, m.loc);
        }
      }
    }
  }
  checkDirective(d, loc, on) {
    if (!includes(DIRECTIVES, d.name)) {
      this.add("warning", `Unknown directive @${d.name} is ignored`, loc);
      return;
    }
    const args = d.value ? d.value.split(/\s*,\s*/) : [];
    if (d.name === "timeout" && !(args.length === 1 && parseDuration(args[0]) > 0)) {
      this.add("error", `@timeout needs one duration, e.g. @timeout(30s)`, loc);
    }
    if (d.name === "retry") {
      const [count, delay] = args;
      if (!count || !/^\d+$/.test(count) || delay !== undefined && !(parseDuration(delay) >= 0)) {
        this.add("error", `@retry needs a count and optional delay, e.g. @retry(3, 2s)`, loc);
      }
    }
    if (d.name === "shadow" && args.length !== 1)
      this.add("error", `@shadow needs exactly one target`, loc);
    if (d.name === "shadow" && on === "pipeline")
      this.add("warning", `@shadow only applies to agents`, loc);
    if (d.name === "checkpoint" && on === "agent")
      this.add("warning", `@checkpoint only applies to pipelines`, loc);
  }
  checkSchema(sc) {
    const names = new Set;
    for (const f of sc.fields) {
      if (names.has(f.name))
        this.add("error", `Schema "${sc.name}": duplicate field "${f.name}"`, sc.loc);
      names.add(f.name);
      for (const t of f.type.split(/[<>,\s]+/).filter(Boolean)) {
        if (!includes(SCHEMA_TYPES, t) && !this.ast.schemas.some((x) => x.name === t)) {
          this.add("warning", `Schema "${sc.name}": field "${f.name}" has unknown type "${t}" (use ${SCHEMA_TYPES.join(", ")}, or another schema)`, sc.loc);
        }
      }
    }
  }
  checkPipeline(s) {
    for (const d of s.directives)
      this.checkDirective(d, s.loc, "pipeline");
    const params = new Set(s.params.map((p) => p.name));
    const data = new Set(params);
    s.pipeline.forEach((stage, i) => {
      if (stage.kind === "expression") {
        if (stage.expr.kind === "ref" && !params.has(stage.expr.path[0])) {
          this.add("error", `Pipeline "${s.name}": undefined variable "${stage.expr.path[0]}"`, stage.loc);
        } else if (stage.expr.kind === "context") {
          this.checkContextRef(stage.expr.path, s, data, stage.loc);
        }
        if (i !== 0)
          this.add("error", `Pipeline "${s.name}": an expression can only start a pipeline`, stage.loc);
        return;
      }
      this.checkStage(stage, s, params, data);
      for (const key of producedKeys(stage))
        data.add(key);
    });
  }
  checkStage(stage, s, params, data) {
    switch (stage.kind) {
      case "call":
        this.checkCall(stage, s, params, data);
        break;
      case "fanout":
        for (const sub of stage.stages)
          this.checkCall(sub, s, params, data);
        break;
      case "branch":
        stage.arms.forEach((arm, i) => {
          if (arm.expr)
            this.checkCond(arm.expr, s, params, data, stage.loc);
          else if (i !== stage.arms.length - 1)
            this.add("error", `Pipeline "${s.name}": the else arm must come last in a branch`, arm.call.loc);
          this.checkCall(arm.call, s, params, data);
        });
        break;
      case "each": {
        this.checkValue(stage.list, s, params, data, stage.loc);
        if (params.has(stage.item) || this.isDeclaredName(stage.item)) {
          this.add("error", `Pipeline "${s.name}": each(${stage.item} in ...) reuses the name "${stage.item}"; pick a new loop variable`, stage.loc);
        }
        for (const o of stage.options) {
          if (o.name !== "concurrency")
            this.add("warning", `Pipeline "${s.name}": each(...) has no option "${o.name ?? "(positional)"}" (only concurrency: n)`, stage.loc);
        }
        this.checkCall(stage.call, s, params, new Set([...data, stage.item, "index"]));
        break;
      }
      case "gate":
        this.checkCond(stage.expr, s, params, data, stage.loc);
        break;
      case "loop":
        if (!this.agents.has(stage.target))
          this.add("error", `Pipeline "${s.name}": loop(${stage.target}, ...) needs an agent to retry with, but "${stage.target}" is not an agent`, stage.loc);
        for (const e of stage.conditionErrors ?? [])
          this.add("error", `Pipeline "${s.name}": loop condition "${stage.condition}" is not valid: ${e}`, stage.loc);
        if (stage.expr)
          this.checkCond(stage.expr, s, params, data, stage.loc);
        for (const o of stage.options) {
          if (o.name !== "max")
            this.add("warning", `Pipeline "${s.name}": loop(...) has no option "${o.name ?? "(positional)"}" (only max: n)`, stage.loc);
        }
        break;
      case "interrupt":
        this.checkArgs(stage.argList, s, params, data, stage.loc);
        break;
      case "listen":
        if (stage.targetValue.kind === "context")
          this.checkContextRef(stage.targetValue.path, s, data, stage.loc);
        break;
    }
  }
  checkCall(call, s, params, data) {
    const where = `Pipeline "${s.name}"`;
    const target = `${call.callee}${call.method ? "." + call.method : ""}`;
    this.checkArgs(call.argList, s, params, data, call.loc);
    if (call.callee === "System") {
      const known = includes(SYSTEM_METHODS, call.method) || includes(SYSTEM_EVENTS, call.method) || this.options.systemMethods?.includes(call.method);
      if (!known)
        this.add("error", `${where}: unknown System method "${call.method}"`, call.loc);
      return;
    }
    if (!call.method) {
      if (!this.pipelines.has(call.callee))
        this.add("error", `${where}: "${call.callee}(...)" is not a defined pipeline`, call.loc);
      else if (call.callee === s.name)
        this.add("warning", `${where}: calls itself recursively`, call.loc);
      return;
    }
    const agent = this.agents.get(call.callee);
    if (agent) {
      const toolArg = call.argList.find((a) => a.name === "tool");
      if (toolArg) {
        const toolName = toolArg.value.kind === "ref" ? toolArg.value.path.join(".") : undefined;
        if (!toolName || !this.tools.has(toolName)) {
          this.add("error", `${where}: ${target} uses undefined tool "${toolName ?? "?"}"`, call.loc);
        } else if (!agent.equips?.includes(toolName)) {
          this.add("error", `${where}: agent "${agent.name}" is not equipped with tool "${toolName}" (add \`equips ${toolName}\`)`, call.loc);
        }
      }
      return;
    }
    if (this.tools.has(call.callee))
      return;
    if (call.implicit && this.pipelines.has(call.callee))
      return;
    this.add("error", `${where}: unknown callee "${call.callee}" in ${target}(...)`, call.loc);
  }
  checkArgs(args, s, params, data, loc) {
    for (const a of args)
      this.checkValue(a.value, s, params, data, loc);
  }
  checkValue(v, s, params, data, loc) {
    if (v.kind === "context")
      this.checkContextRef(v.path, s, data, loc);
    else if (v.kind === "list")
      for (const item of v.items)
        this.checkValue(item, s, params, data, loc);
    else if (v.kind === "string")
      this.checkTemplate(v.value, s, params, data, loc);
  }
  checkTemplate(text, s, params, data, loc) {
    for (const [, expr] of text.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)) {
      const path = expr.split(".");
      if (path[0] === "context") {
        this.checkContextRef(path.slice(1), s, data, loc);
      } else if (path[0] !== "current" && !params.has(path[0]) && !data.has(path[0]) && path[0] !== "Env") {
        this.add("warning", `Pipeline "${s.name}": template {{${expr}}} does not match a parameter or an earlier result`, loc);
      }
    }
  }
  checkCond(c, s, params, data, loc) {
    switch (c.kind) {
      case "or":
      case "and":
        for (const t of c.terms)
          this.checkCond(t, s, params, data, loc);
        break;
      case "not":
        this.checkCond(c.expr, s, params, data, loc);
        break;
      case "compare":
        this.checkCond(c.left, s, params, data, loc);
        this.checkCond(c.right, s, params, data, loc);
        break;
      case "value":
        if (c.value.kind === "context")
          this.checkContextRef(c.value.path, s, data, loc);
        else if (c.value.kind === "ref" && !params.has(c.value.path[0]) && !data.has(c.value.path[0])) {
          this.add("warning", `Pipeline "${s.name}": "${c.value.path.join(".")}" in a gate is not a parameter or result; it compares as a string`, loc);
        }
        break;
    }
  }
  checkContextRef(path, s, data, loc) {
    const [ns, key] = path;
    if (ns === undefined)
      return;
    if (!includes(CONTEXT_NAMESPACES, ns)) {
      this.add("warning", `Pipeline "${s.name}": context.${ns} is not a context namespace (use ${CONTEXT_NAMESPACES.map((n) => "context." + n).join(", ")})`, loc);
      return;
    }
    if (key === undefined)
      return;
    if (ns === "data" && !data.has(key)) {
      this.add("warning", `Pipeline "${s.name}": context.data.${key} is never set before it is read (bind a result with \`as ${key}\`)`, loc);
    }
    if (ns === "input" && !s.params.some((p) => p.name === key)) {
      this.add("warning", `Pipeline "${s.name}": context.input.${key} is not a parameter of this pipeline`, loc);
    }
  }
}
function producedKeys(stage) {
  switch (stage.kind) {
    case "call":
      return [...callKeys(stage), ...stage.bind ? [stage.bind] : []];
    case "fanout":
      return [...stage.stages.flatMap((s) => [...callKeys(s), ...s.bind ? [s.bind] : []]), ...stage.bind ? [stage.bind] : []];
    case "branch":
      return [...stage.arms.flatMap((a) => callKeys(a.call)), ...stage.bind ? [stage.bind] : []];
    case "each":
      return [...callKeys(stage.call), ...stage.bind ? [stage.bind] : []];
    case "loop":
      return [stage.target, ...stage.bind ? [stage.bind] : []];
    case "listen":
      return [stage.target.split(".")[0], ...stage.bind ? [stage.bind] : []];
    case "interrupt":
      return ["yield", ...stage.bind ? [stage.bind] : []];
    default:
      return [];
  }
}
function callKeys(call) {
  if (call.callee === "System")
    return [];
  return call.method ? [call.callee, call.method] : [call.callee];
}
// src/parser/index.ts
class CollectingErrorListener extends BaseErrorListener {
  errors = [];
  syntaxError(_recognizer, offendingSymbol, line, charPositionInLine, msg, _e) {
    const near = offendingSymbol?.text;
    const suffix = near != null && near !== "<EOF>" ? ` near "${near}"` : "";
    this.errors.push(`[${line}:${charPositionInLine}] ${msg}${suffix}`);
  }
}
function makeParser(source) {
  const input = CharStream.fromString(source);
  const lexer = new HaloLexer(input);
  const listener = new CollectingErrorListener;
  lexer.removeErrorListeners();
  lexer.addErrorListener(listener);
  const parser = new HaloParser(new CommonTokenStream(lexer));
  parser.removeErrorListeners();
  parser.addErrorListener(listener);
  return { input, parser, listener };
}
var empty = (errors) => ({ policies: [], tools: [], stores: [], schemas: [], agents: [], pipelines: [], errors });
function parse(source) {
  const { input, parser, listener } = makeParser(source);
  const program = parser.program();
  if (listener.errors.length > 0)
    return empty(listener.errors);
  const result = empty([]);
  const walker = new Walker(input);
  for (const decl of program.declaration()) {
    const p = decl.policyDecl();
    const t = decl.toolDecl();
    const st = decl.storeDecl();
    const sc = decl.schemaDecl();
    const a = decl.agentDecl();
    const pl = decl.pipelineDecl();
    if (p)
      result.policies.push(walker.policy(p));
    else if (t)
      result.tools.push(walker.tool(t));
    else if (st)
      result.stores.push(walker.tool(st));
    else if (sc)
      result.schemas.push(walker.schema(sc));
    else if (a)
      result.agents.push(walker.agent(a));
    else if (pl)
      result.pipelines.push(walker.pipeline(pl));
  }
  return result;
}
function parseCondition(text) {
  const { input, parser, listener } = makeParser(text);
  const ctx = parser.condExpr();
  if (!listener.errors.length && parser.getCurrentToken().type !== HaloParser.EOF)
    listener.errors.push(`unexpected "${parser.getCurrentToken().text}"`);
  if (listener.errors.length)
    return { errors: listener.errors };
  return { expr: new Walker(input).condition(ctx), errors: [] };
}

class Walker {
  input;
  constructor(input) {
    this.input = input;
  }
  loc(ctx) {
    return { line: ctx.start?.line ?? 0, column: ctx.start?.column ?? 0 };
  }
  sourceText(ctx) {
    if (!ctx.start || !ctx.stop)
      return ctx.getText();
    return this.input.getTextFromRange(ctx.start.start, ctx.stop.stop);
  }
  policy(ctx) {
    const rules = ctx.policyRule().map((r) => ({
      name: r.IDENTIFIER().getText(),
      args: this.args(r.callArgs()).map((a) => a.name ? `${a.name}: ${render(a.value)}` : render(a.value))
    }));
    return {
      name: ctx.IDENTIFIER().getText(),
      rules,
      rawRules: rules.map((r) => `${r.name}(${r.args.join(", ")})`),
      loc: this.loc(ctx)
    };
  }
  schema(ctx) {
    return {
      name: ctx.IDENTIFIER().getText(),
      fields: ctx.schemaField().map((f) => ({ name: f.name().getText(), type: typeText(f.typeRef()) })),
      loc: this.loc(ctx)
    };
  }
  tool(ctx) {
    const ids = ctx.IDENTIFIER();
    const argList = this.args(ctx.callArgs());
    return {
      name: ids[0].getText(),
      provider: ids[1].getText(),
      ...renderArgs(argList),
      argList,
      loc: this.loc(ctx)
    };
  }
  agent(ctx) {
    const params = {};
    for (const p of ctx.modelParam())
      params[p.name().getText()] = render(this.value(p.value()));
    const ref = ctx.modelRef();
    const str = ref.STRING();
    const modelId = str ? unquote(str.getText()) : ref.getText();
    const agent = { name: ctx.IDENTIFIER().getText(), modelId, params, directives: this.directives(ctx.directive()), loc: this.loc(ctx) };
    for (const mod of ctx.agentModifier()) {
      if (mod instanceof EquipsModifierContext) {
        agent.equips = [...agent.equips ?? [], ...mod.IDENTIFIER().map((i) => i.getText())];
      } else if (mod instanceof RequiresModifierContext) {
        agent.requires = [...agent.requires ?? [], ...mod.IDENTIFIER().map((i) => i.getText())];
      } else if (mod instanceof SystemModifierContext) {
        const triple = mod.TRIPLE_STRING();
        agent.system = triple ? dedent(triple.getText().slice(3, -3)) : unquote(mod.STRING().getText());
      }
    }
    return agent;
  }
  directives(list) {
    return list.map((d) => ({
      name: d.name().getText(),
      value: d.directiveArg().map((a) => {
        const lit = a.literal();
        if (lit)
          return render(this.literal(lit));
        return a.getText();
      }).join(", ")
    }));
  }
  pipeline(ctx) {
    const pipelineCtx = ctx.pipeline();
    const pipeline = [];
    const head = pipelineCtx.expression();
    if (head) {
      const expr = this.expression(head);
      pipeline.push({ kind: "expression", value: render(expr), expr, loc: this.loc(head) });
    }
    for (const op of pipelineCtx.pipelineOp())
      pipeline.push(this.pipelineOp(op));
    return {
      name: ctx.IDENTIFIER().getText(),
      params: (ctx.paramList()?.param() ?? []).map((p) => ({ name: p.IDENTIFIER().getText(), type: typeText(p.typeRef()) })),
      returnType: ctx.typeRef() ? typeText(ctx.typeRef()) : "",
      pipeline,
      directives: this.directives(ctx.directive()),
      loc: this.loc(ctx)
    };
  }
  pipelineOp(ctx) {
    const loc = this.loc(ctx);
    if (ctx instanceof PipeOpContext) {
      return { ...this.call(ctx.callExpr()), bind: bindName(ctx.binding()), loc };
    }
    if (ctx instanceof GateOpContext) {
      return { kind: "gate", condition: this.sourceText(ctx.condExpr()), expr: this.orExpr(ctx.condExpr().orExpr()), loc };
    }
    if (ctx instanceof InterruptOpContext) {
      const argList = this.args(ctx.callArgs());
      return { kind: "interrupt", callee: "yield", args: argList.map((a) => a.name ? `${a.name}: ${render(a.value)}` : render(a.value)), argList, bind: bindName(ctx.binding()), loc };
    }
    if (ctx instanceof FanoutOpContext) {
      const stages = ctx.fanoutItem().map((item) => {
        const call = item.callExpr();
        const bind = bindName(item.binding());
        if (call)
          return { ...this.call(call), bind };
        return { kind: "call", callee: item.IDENTIFIER().getText(), method: "prompt", args: [], namedArgs: {}, argList: [], bind, implicit: true, loc: this.loc(item) };
      });
      return { kind: "fanout", stages, bind: bindName(ctx.binding()), loc };
    }
    if (ctx instanceof BranchOpContext) {
      const arms = ctx.branchArm().map((arm) => {
        if (arm instanceof CondArmContext) {
          return { condition: this.sourceText(arm.condExpr()), expr: this.orExpr(arm.condExpr().orExpr()), call: this.call(arm.callExpr()) };
        }
        return { call: this.call(arm.callExpr()) };
      });
      return { kind: "branch", arms, bind: bindName(ctx.binding()), loc };
    }
    if (ctx instanceof EachOpContext) {
      return {
        kind: "each",
        item: ctx.IDENTIFIER().getText(),
        list: this.callValue(ctx.callValue()),
        options: this.args(ctx.callArgs()),
        call: this.call(ctx.callExpr()),
        bind: bindName(ctx.binding()),
        loc
      };
    }
    if (ctx instanceof LoopOpContext) {
      const raw = (ctx.STRING() ?? ctx.TRIPLE_STRING()).getText();
      const condition = raw.startsWith('"""') ? raw.slice(3, -3).trim() : unquote(raw);
      const parsed = parseCondition(condition);
      return {
        kind: "loop",
        target: ctx.IDENTIFIER().getText(),
        condition,
        expr: parsed.expr,
        conditionErrors: parsed.errors.length ? parsed.errors : undefined,
        options: this.args(ctx.callArgs()),
        bind: bindName(ctx.binding()),
        loc
      };
    }
    if (ctx instanceof ListenOpContext) {
      const targetValue = this.callValue(ctx.callValue());
      return { kind: "listen", target: render(targetValue), targetValue, bind: bindName(ctx.binding()), loc };
    }
    throw new Error(`Unhandled pipeline operator: ${ctx.getText()}`);
  }
  call(ctx) {
    const argList = this.args(ctx.callArgs());
    return {
      kind: "call",
      callee: ctx.IDENTIFIER().getText(),
      method: ctx.name()?.getText() ?? "",
      ...renderArgs(argList),
      argList,
      loc: this.loc(ctx)
    };
  }
  args(ctx) {
    if (!ctx)
      return [];
    return ctx.callArg().map((a) => a instanceof NamedArgContext ? { name: a.name().getText(), value: this.callValue(a.callValue()) } : { value: this.callValue(a.callValue()) });
  }
  callValue(ctx) {
    const lit = ctx.literal();
    if (lit)
      return this.literal(lit);
    const model = ctx.MODEL_REF();
    if (model)
      return { kind: "model", value: model.getText() };
    const cref = ctx.contextRef();
    if (cref)
      return this.contextRef(cref);
    const list = ctx.listValue();
    if (list)
      return { kind: "list", items: list.callValue().map((v) => this.callValue(v)) };
    return this.dotted(ctx.dottedId());
  }
  value(ctx) {
    const lit = ctx.literal();
    if (lit)
      return this.literal(lit);
    const model = ctx.MODEL_REF();
    if (model)
      return { kind: "model", value: model.getText() };
    return this.dotted(ctx.dottedId());
  }
  expression(ctx) {
    const lit = ctx.literal();
    if (lit)
      return this.literal(lit);
    const cref = ctx.contextRef();
    if (cref)
      return this.contextRef(cref);
    return this.dotted(ctx.dottedId());
  }
  literal(ctx) {
    const text = ctx.getText();
    if (ctx.STRING())
      return { kind: "string", value: unquote(text) };
    if (ctx.TRIPLE_STRING())
      return { kind: "string", value: dedent(text.slice(3, -3)) };
    if (ctx.NUMBER())
      return { kind: "number", value: Number(text), raw: text };
    if (ctx.DURATION())
      return { kind: "duration", ms: parseDuration(text), raw: text };
    if (ctx.BOOL())
      return { kind: "bool", value: text === "true" };
    return { kind: "null" };
  }
  dotted(ctx) {
    return { kind: "ref", path: [ctx.IDENTIFIER().getText(), ...ctx.name().map((n) => n.getText())] };
  }
  contextRef(ctx) {
    return { kind: "context", path: ctx.name().map((n) => n.getText()) };
  }
  condition(ctx) {
    return this.orExpr(ctx.orExpr());
  }
  orExpr(ctx) {
    const terms = ctx.andExpr().map((a) => this.andExpr(a));
    return terms.length === 1 ? terms[0] : { kind: "or", terms };
  }
  andExpr(ctx) {
    const terms = ctx.notExpr().map((n) => this.notExpr(n));
    return terms.length === 1 ? terms[0] : { kind: "and", terms };
  }
  notExpr(ctx) {
    if (ctx instanceof NegationContext)
      return { kind: "not", expr: this.notExpr(ctx.notExpr()) };
    return this.comparison(ctx.comparison());
  }
  comparison(ctx) {
    const [l, r] = ctx.operand();
    const left = this.operand(l);
    if (!r)
      return left;
    return { kind: "compare", op: ctx.compOp().getText(), left, right: this.operand(r) };
  }
  operand(ctx) {
    if (ctx instanceof ParenOperandContext)
      return this.orExpr(ctx.orExpr());
    if (ctx instanceof LiteralOperandContext)
      return { kind: "value", value: this.literal(ctx.literal()) };
    if (ctx instanceof ContextOperandContext)
      return { kind: "value", value: this.contextRef(ctx.contextRef()) };
    return { kind: "value", value: this.dotted(ctx.dottedId()) };
  }
}
function bindName(ctx) {
  return ctx?.name().getText();
}
function render(v) {
  switch (v.kind) {
    case "string":
      return v.value;
    case "number":
      return v.raw;
    case "bool":
      return String(v.value);
    case "null":
      return "null";
    case "duration":
      return v.raw;
    case "model":
      return v.value;
    case "ref":
      return v.path.join(".");
    case "context":
      return ["context", ...v.path].join(".");
    case "list":
      return `[${v.items.map(render).join(", ")}]`;
  }
}
function renderArgs(argList) {
  const args = [];
  const namedArgs = {};
  for (const a of argList) {
    if (a.name)
      namedArgs[a.name] = render(a.value);
    else
      args.push(render(a.value));
  }
  return { args, namedArgs };
}
var ESCAPES = { n: `
`, t: "\t", r: "\r", "0": "\x00" };
function unquote(s) {
  return s.slice(1, -1).replace(/\\(.)/g, (_, c) => ESCAPES[c] ?? c);
}
function dedent(s) {
  const lines = s.replace(/^[ \t]*\r?\n/, "").replace(/\r?\n[ \t]*$/, "").split(/\r?\n/);
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^[ \t]*/)[0].length));
  return lines.map((l) => l.slice(Number.isFinite(indent) ? indent : 0)).join(`
`);
}
function typeText(ctx) {
  const base = ctx.dottedId().getText();
  const args = ctx.typeRef();
  return args.length ? `${base}<${args.map(typeText).join(", ")}>` : base;
}

// src/lsp/diagnostics.ts
function rangeAt(lines, line, character, length) {
  const text = lines[line] ?? "";
  const word = text.slice(character).match(/^[\w.@]+/)?.[0];
  const len = length ?? (word?.length || Math.max(1, text.length - character));
  return { start: { line, character }, end: { line, character: character + len } };
}
function getDiagnostics(sourceText) {
  const lines = sourceText.split(`
`);
  const ast = parse(sourceText);
  if (ast.errors.length) {
    return ast.errors.map((err) => {
      const m = err.match(/^\[(\d+):(\d+)\] (.+?)(?: near "(.*)")?$/s);
      if (!m)
        return { severity: import_vscode_languageserver.DiagnosticSeverity.Error, range: rangeAt(lines, 0, 0, 0), message: err, source: "halo" };
      const line = Number(m[1]) - 1;
      return { severity: import_vscode_languageserver.DiagnosticSeverity.Error, range: rangeAt(lines, line, Number(m[2]), m[4]?.length || undefined), message: m[3], source: "halo" };
    });
  }
  return validate(ast).map((d) => ({
    severity: d.severity === "error" ? import_vscode_languageserver.DiagnosticSeverity.Error : import_vscode_languageserver.DiagnosticSeverity.Warning,
    range: d.line ? rangeAt(lines, d.line - 1, d.column ?? 0) : rangeAt(lines, 0, 0, 0),
    message: d.message,
    source: "halo"
  }));
}

// src/lsp/completions.ts
var import_vscode_languageserver2 = __toESM(require_main4(), 1);
var KEYWORDS = [
  ["agent", "Declare an agent: agent Name [model, temp: 0.2]"],
  ["pipeline", "Declare a pipeline: pipeline Name(arg: Type) -> Type:"],
  ["tool", "Declare a tool: tool Name : Provider(...)"],
  ["store", 'Declare a store: store Name : VectorStore(namespace: "x")'],
  ["policy", "Declare a policy: policy Name : Rule(...) & Rule(...)"],
  ["schema", "Declare an output schema: schema Name { field: Type }"],
  ["equips", "Give an agent tools it may use"],
  ["requires", "Bind policies to an agent"],
  ["system", "An agent's system prompt"],
  ["yield", "|! yield(...): ask a human"],
  ["listen", "~> listen(Source.Event): wait for an event"],
  ["loop", '|<> loop(Agent, "condition"): retry the agent while the condition holds'],
  ["each", "|* each(item in list) => Call(): one call per item"],
  ["else", "The fallback arm of a branch"],
  ["as", "Bind a result: ... as name → context.data.name"],
  ["context", "context.current, context.input, context.data, context.meta"]
];
function getCompletions(sourceText, position) {
  const line = sourceText.split(`
`)[position.line] ?? "";
  const before = line.slice(0, position.character);
  if (/System\.\w*$/.test(before)) {
    return [...SYSTEM_METHODS, ...SYSTEM_EVENTS].map((m) => ({ label: m, kind: import_vscode_languageserver2.CompletionItemKind.Method, detail: `System.${m}` }));
  }
  if (/@\w*$/.test(before))
    return DIRECTIVES.map((d) => ({ label: d, kind: import_vscode_languageserver2.CompletionItemKind.Keyword, detail: `@${d}` }));
  if (/:\s*\w*$/.test(before) && /^\s*(tool|store)\b/.test(line)) {
    return TOOL_PROVIDERS.map((p) => ({ label: p, kind: import_vscode_languageserver2.CompletionItemKind.Class, detail: "Tool provider" }));
  }
  if (/\b(Block|Redact)\(\s*\w*$/.test(before)) {
    const list = /Block\(\s*\w*$/.test(before) ? BLOCK_CATEGORIES : REDACT_CATEGORIES;
    return list.map((c) => ({ label: c, kind: import_vscode_languageserver2.CompletionItemKind.EnumMember }));
  }
  if (/^\s*policy\b/.test(line))
    return ENFORCED_RULES.map((r) => ({ label: r, kind: import_vscode_languageserver2.CompletionItemKind.Function, detail: "Policy rule" }));
  const items = KEYWORDS.map(([label, detail]) => ({ label, kind: import_vscode_languageserver2.CompletionItemKind.Keyword, detail }));
  const ast = parse(sourceText);
  for (const a of ast.agents)
    items.push({ label: a.name, kind: import_vscode_languageserver2.CompletionItemKind.Class, detail: `agent [${a.modelId}]` });
  for (const t of [...ast.tools, ...ast.stores])
    items.push({ label: t.name, kind: import_vscode_languageserver2.CompletionItemKind.Interface, detail: `tool : ${t.provider}` });
  for (const p of ast.policies)
    items.push({ label: p.name, kind: import_vscode_languageserver2.CompletionItemKind.Constant, detail: "policy" });
  for (const p of ast.pipelines)
    items.push({ label: p.name, kind: import_vscode_languageserver2.CompletionItemKind.Function, detail: `pipeline (${p.params.map((x) => x.name).join(", ")})` });
  for (const s of ast.schemas)
    items.push({ label: s.name, kind: import_vscode_languageserver2.CompletionItemKind.Struct, detail: "schema" });
  return items;
}

// src/lsp/hover.ts
var import_vscode_languageserver3 = __toESM(require_main4(), 1);
var OPERATORS = {
  "|>": "**Pipe**: run a call on the current value.",
  "|?": "**Gate** `|? (cond)`: stop the run unless the condition holds.  \n**Branch** `|? { (cond) => A(), else => B() }`: run the first matching arm.",
  "|!": "**Interrupt** `|! yield(...)`: ask a human. With no handler, the run pauses until `signal()` / `halo resume`.",
  "|*": "**Fan-out** `|* { A(), B() }`: run calls in parallel.  \n**Each** `|* each(item in list) => Call()`: one call per item.",
  "~>": "**Listen** `~> listen(Source.Event)`: wait for an external event.",
  "|<>": '**Loop** `|<> loop(Agent, "cond", max: 3)`: while the condition holds, go back to the agent\'s stage.'
};
function wordAt(line, character) {
  const op = line.slice(Math.max(0, character - 2), character + 3).match(/\|<>|\|>|\|\?|\|!|\|\*|~>/);
  if (op)
    return op[0];
  let start = character;
  while (start > 0 && /\w/.test(line.charAt(start - 1)))
    start--;
  let end = character;
  while (end < line.length && /\w/.test(line.charAt(end)))
    end++;
  return line.slice(start, end);
}
function getHover(sourceText, position) {
  const word = wordAt(sourceText.split(`
`)[position.line] ?? "", position.character);
  if (!word)
    return null;
  const md = (value) => ({ contents: { kind: import_vscode_languageserver3.MarkupKind.Markdown, value } });
  if (OPERATORS[word])
    return md(OPERATORS[word]);
  const ast = parse(sourceText);
  const agent = ast.agents.find((a) => a.name === word);
  if (agent) {
    const lines = [`**agent ${agent.name}** — \`${agent.modelId}\``];
    const params = Object.entries(agent.params).map(([k, v]) => `${k}: ${v}`);
    if (params.length)
      lines.push(params.join(", "));
    if (agent.system)
      lines.push(`> ${agent.system.split(`
`).join(`
> `)}`);
    if (agent.equips?.length)
      lines.push(`equips ${agent.equips.join(", ")}`);
    if (agent.requires?.length)
      lines.push(`requires ${agent.requires.join(", ")}`);
    return md(lines.join(`

`));
  }
  const tool = [...ast.tools, ...ast.stores].find((t) => t.name === word);
  if (tool)
    return md(`**tool ${tool.name}** : \`${tool.provider}(${[...tool.args, ...Object.entries(tool.namedArgs).map(([k, v]) => `${k}: ${v}`)].join(", ")})\``);
  const policy = ast.policies.find((p) => p.name === word);
  if (policy)
    return md(`**policy ${policy.name}**

${policy.rules.map((r) => `- \`${r.name}(${r.args.join(", ")})\``).join(`
`)}`);
  const pipeline = ast.pipelines.find((p) => p.name === word);
  if (pipeline) {
    const sig = `${pipeline.name}(${pipeline.params.map((p) => `${p.name}: ${p.type}`).join(", ")})${pipeline.returnType ? ` -> ${pipeline.returnType}` : ""}`;
    return md(`**pipeline** \`${sig}\` — ${pipeline.pipeline.length} stage(s)`);
  }
  const schema = ast.schemas.find((s) => s.name === word);
  if (schema)
    return md(`**schema ${schema.name}**

${schema.fields.map((f) => `- ${f.name}: \`${f.type}\``).join(`
`)}`);
  return null;
}

// src/lsp/server.ts
var connection = import_node.createConnection(import_node.ProposedFeatures.all);
var documents = new import_node.TextDocuments(TextDocument);
var hasConfigurationCapability = false;
var hasWorkspaceFolderCapability = false;
connection.onInitialize((params) => {
  const capabilities = params.capabilities;
  hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
  hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
  const result = {
    capabilities: {
      textDocumentSync: import_node.TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: false
      },
      hoverProvider: true
    }
  };
  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true
      }
    };
  }
  return result;
});
connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    connection.client.register(import_node.DidChangeConfigurationNotification.type, undefined);
  }
});
documents.onDidChangeContent((change) => {
  const diagnostics = getDiagnostics(change.document.getText());
  connection.sendDiagnostics({ uri: change.document.uri, diagnostics });
});
connection.onCompletion((textDocumentPosition) => {
  const doc = documents.get(textDocumentPosition.textDocument.uri);
  if (!doc)
    return [];
  return getCompletions(doc.getText(), textDocumentPosition.position);
});
connection.onHover((textDocumentPosition) => {
  const doc = documents.get(textDocumentPosition.textDocument.uri);
  if (!doc)
    return null;
  return getHover(doc.getText(), textDocumentPosition.position);
});
documents.listen(connection);
connection.listen();
