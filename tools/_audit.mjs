var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/react/cjs/react.production.min.js
var require_react_production_min = __commonJS({
  "node_modules/react/cjs/react.production.min.js"(exports) {
    "use strict";
    var l = Symbol.for("react.element");
    var n = Symbol.for("react.portal");
    var p = Symbol.for("react.fragment");
    var q = Symbol.for("react.strict_mode");
    var r = Symbol.for("react.profiler");
    var t = Symbol.for("react.provider");
    var u = Symbol.for("react.context");
    var v = Symbol.for("react.forward_ref");
    var w = Symbol.for("react.suspense");
    var x = Symbol.for("react.memo");
    var y = Symbol.for("react.lazy");
    var z = Symbol.iterator;
    function A(a) {
      if (null === a || "object" !== typeof a) return null;
      a = z && a[z] || a["@@iterator"];
      return "function" === typeof a ? a : null;
    }
    var B = { isMounted: function() {
      return false;
    }, enqueueForceUpdate: function() {
    }, enqueueReplaceState: function() {
    }, enqueueSetState: function() {
    } };
    var C = Object.assign;
    var D = {};
    function E(a, b, e) {
      this.props = a;
      this.context = b;
      this.refs = D;
      this.updater = e || B;
    }
    E.prototype.isReactComponent = {};
    E.prototype.setState = function(a, b) {
      if ("object" !== typeof a && "function" !== typeof a && null != a) throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
      this.updater.enqueueSetState(this, a, b, "setState");
    };
    E.prototype.forceUpdate = function(a) {
      this.updater.enqueueForceUpdate(this, a, "forceUpdate");
    };
    function F() {
    }
    F.prototype = E.prototype;
    function G(a, b, e) {
      this.props = a;
      this.context = b;
      this.refs = D;
      this.updater = e || B;
    }
    var H = G.prototype = new F();
    H.constructor = G;
    C(H, E.prototype);
    H.isPureReactComponent = true;
    var I = Array.isArray;
    var J = Object.prototype.hasOwnProperty;
    var K = { current: null };
    var L = { key: true, ref: true, __self: true, __source: true };
    function M(a, b, e) {
      var d, c = {}, k = null, h = null;
      if (null != b) for (d in void 0 !== b.ref && (h = b.ref), void 0 !== b.key && (k = "" + b.key), b) J.call(b, d) && !L.hasOwnProperty(d) && (c[d] = b[d]);
      var g = arguments.length - 2;
      if (1 === g) c.children = e;
      else if (1 < g) {
        for (var f = Array(g), m = 0; m < g; m++) f[m] = arguments[m + 2];
        c.children = f;
      }
      if (a && a.defaultProps) for (d in g = a.defaultProps, g) void 0 === c[d] && (c[d] = g[d]);
      return { $$typeof: l, type: a, key: k, ref: h, props: c, _owner: K.current };
    }
    function N(a, b) {
      return { $$typeof: l, type: a.type, key: b, ref: a.ref, props: a.props, _owner: a._owner };
    }
    function O(a) {
      return "object" === typeof a && null !== a && a.$$typeof === l;
    }
    function escape(a) {
      var b = { "=": "=0", ":": "=2" };
      return "$" + a.replace(/[=:]/g, function(a2) {
        return b[a2];
      });
    }
    var P = /\/+/g;
    function Q(a, b) {
      return "object" === typeof a && null !== a && null != a.key ? escape("" + a.key) : b.toString(36);
    }
    function R(a, b, e, d, c) {
      var k = typeof a;
      if ("undefined" === k || "boolean" === k) a = null;
      var h = false;
      if (null === a) h = true;
      else switch (k) {
        case "string":
        case "number":
          h = true;
          break;
        case "object":
          switch (a.$$typeof) {
            case l:
            case n:
              h = true;
          }
      }
      if (h) return h = a, c = c(h), a = "" === d ? "." + Q(h, 0) : d, I(c) ? (e = "", null != a && (e = a.replace(P, "$&/") + "/"), R(c, b, e, "", function(a2) {
        return a2;
      })) : null != c && (O(c) && (c = N(c, e + (!c.key || h && h.key === c.key ? "" : ("" + c.key).replace(P, "$&/") + "/") + a)), b.push(c)), 1;
      h = 0;
      d = "" === d ? "." : d + ":";
      if (I(a)) for (var g = 0; g < a.length; g++) {
        k = a[g];
        var f = d + Q(k, g);
        h += R(k, b, e, f, c);
      }
      else if (f = A(a), "function" === typeof f) for (a = f.call(a), g = 0; !(k = a.next()).done; ) k = k.value, f = d + Q(k, g++), h += R(k, b, e, f, c);
      else if ("object" === k) throw b = String(a), Error("Objects are not valid as a React child (found: " + ("[object Object]" === b ? "object with keys {" + Object.keys(a).join(", ") + "}" : b) + "). If you meant to render a collection of children, use an array instead.");
      return h;
    }
    function S(a, b, e) {
      if (null == a) return a;
      var d = [], c = 0;
      R(a, d, "", "", function(a2) {
        return b.call(e, a2, c++);
      });
      return d;
    }
    function T(a) {
      if (-1 === a._status) {
        var b = a._result;
        b = b();
        b.then(function(b2) {
          if (0 === a._status || -1 === a._status) a._status = 1, a._result = b2;
        }, function(b2) {
          if (0 === a._status || -1 === a._status) a._status = 2, a._result = b2;
        });
        -1 === a._status && (a._status = 0, a._result = b);
      }
      if (1 === a._status) return a._result.default;
      throw a._result;
    }
    var U = { current: null };
    var V = { transition: null };
    var W = { ReactCurrentDispatcher: U, ReactCurrentBatchConfig: V, ReactCurrentOwner: K };
    function X() {
      throw Error("act(...) is not supported in production builds of React.");
    }
    exports.Children = { map: S, forEach: function(a, b, e) {
      S(a, function() {
        b.apply(this, arguments);
      }, e);
    }, count: function(a) {
      var b = 0;
      S(a, function() {
        b++;
      });
      return b;
    }, toArray: function(a) {
      return S(a, function(a2) {
        return a2;
      }) || [];
    }, only: function(a) {
      if (!O(a)) throw Error("React.Children.only expected to receive a single React element child.");
      return a;
    } };
    exports.Component = E;
    exports.Fragment = p;
    exports.Profiler = r;
    exports.PureComponent = G;
    exports.StrictMode = q;
    exports.Suspense = w;
    exports.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = W;
    exports.act = X;
    exports.cloneElement = function(a, b, e) {
      if (null === a || void 0 === a) throw Error("React.cloneElement(...): The argument must be a React element, but you passed " + a + ".");
      var d = C({}, a.props), c = a.key, k = a.ref, h = a._owner;
      if (null != b) {
        void 0 !== b.ref && (k = b.ref, h = K.current);
        void 0 !== b.key && (c = "" + b.key);
        if (a.type && a.type.defaultProps) var g = a.type.defaultProps;
        for (f in b) J.call(b, f) && !L.hasOwnProperty(f) && (d[f] = void 0 === b[f] && void 0 !== g ? g[f] : b[f]);
      }
      var f = arguments.length - 2;
      if (1 === f) d.children = e;
      else if (1 < f) {
        g = Array(f);
        for (var m = 0; m < f; m++) g[m] = arguments[m + 2];
        d.children = g;
      }
      return { $$typeof: l, type: a.type, key: c, ref: k, props: d, _owner: h };
    };
    exports.createContext = function(a) {
      a = { $$typeof: u, _currentValue: a, _currentValue2: a, _threadCount: 0, Provider: null, Consumer: null, _defaultValue: null, _globalName: null };
      a.Provider = { $$typeof: t, _context: a };
      return a.Consumer = a;
    };
    exports.createElement = M;
    exports.createFactory = function(a) {
      var b = M.bind(null, a);
      b.type = a;
      return b;
    };
    exports.createRef = function() {
      return { current: null };
    };
    exports.forwardRef = function(a) {
      return { $$typeof: v, render: a };
    };
    exports.isValidElement = O;
    exports.lazy = function(a) {
      return { $$typeof: y, _payload: { _status: -1, _result: a }, _init: T };
    };
    exports.memo = function(a, b) {
      return { $$typeof: x, type: a, compare: void 0 === b ? null : b };
    };
    exports.startTransition = function(a) {
      var b = V.transition;
      V.transition = {};
      try {
        a();
      } finally {
        V.transition = b;
      }
    };
    exports.unstable_act = X;
    exports.useCallback = function(a, b) {
      return U.current.useCallback(a, b);
    };
    exports.useContext = function(a) {
      return U.current.useContext(a);
    };
    exports.useDebugValue = function() {
    };
    exports.useDeferredValue = function(a) {
      return U.current.useDeferredValue(a);
    };
    exports.useEffect = function(a, b) {
      return U.current.useEffect(a, b);
    };
    exports.useId = function() {
      return U.current.useId();
    };
    exports.useImperativeHandle = function(a, b, e) {
      return U.current.useImperativeHandle(a, b, e);
    };
    exports.useInsertionEffect = function(a, b) {
      return U.current.useInsertionEffect(a, b);
    };
    exports.useLayoutEffect = function(a, b) {
      return U.current.useLayoutEffect(a, b);
    };
    exports.useMemo = function(a, b) {
      return U.current.useMemo(a, b);
    };
    exports.useReducer = function(a, b, e) {
      return U.current.useReducer(a, b, e);
    };
    exports.useRef = function(a) {
      return U.current.useRef(a);
    };
    exports.useState = function(a) {
      return U.current.useState(a);
    };
    exports.useSyncExternalStore = function(a, b, e) {
      return U.current.useSyncExternalStore(a, b, e);
    };
    exports.useTransition = function() {
      return U.current.useTransition();
    };
    exports.version = "18.3.1";
  }
});

// node_modules/react/cjs/react.development.js
var require_react_development = __commonJS({
  "node_modules/react/cjs/react.development.js"(exports, module) {
    "use strict";
    if (process.env.NODE_ENV !== "production") {
      (function() {
        "use strict";
        if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart === "function") {
          __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(new Error());
        }
        var ReactVersion = "18.3.1";
        var REACT_ELEMENT_TYPE = Symbol.for("react.element");
        var REACT_PORTAL_TYPE = Symbol.for("react.portal");
        var REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
        var REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode");
        var REACT_PROFILER_TYPE = Symbol.for("react.profiler");
        var REACT_PROVIDER_TYPE = Symbol.for("react.provider");
        var REACT_CONTEXT_TYPE = Symbol.for("react.context");
        var REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref");
        var REACT_SUSPENSE_TYPE = Symbol.for("react.suspense");
        var REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list");
        var REACT_MEMO_TYPE = Symbol.for("react.memo");
        var REACT_LAZY_TYPE = Symbol.for("react.lazy");
        var REACT_OFFSCREEN_TYPE = Symbol.for("react.offscreen");
        var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
        var FAUX_ITERATOR_SYMBOL = "@@iterator";
        function getIteratorFn(maybeIterable) {
          if (maybeIterable === null || typeof maybeIterable !== "object") {
            return null;
          }
          var maybeIterator = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL];
          if (typeof maybeIterator === "function") {
            return maybeIterator;
          }
          return null;
        }
        var ReactCurrentDispatcher = {
          /**
           * @internal
           * @type {ReactComponent}
           */
          current: null
        };
        var ReactCurrentBatchConfig = {
          transition: null
        };
        var ReactCurrentActQueue = {
          current: null,
          // Used to reproduce behavior of `batchedUpdates` in legacy mode.
          isBatchingLegacy: false,
          didScheduleLegacyUpdate: false
        };
        var ReactCurrentOwner = {
          /**
           * @internal
           * @type {ReactComponent}
           */
          current: null
        };
        var ReactDebugCurrentFrame = {};
        var currentExtraStackFrame = null;
        function setExtraStackFrame(stack) {
          {
            currentExtraStackFrame = stack;
          }
        }
        {
          ReactDebugCurrentFrame.setExtraStackFrame = function(stack) {
            {
              currentExtraStackFrame = stack;
            }
          };
          ReactDebugCurrentFrame.getCurrentStack = null;
          ReactDebugCurrentFrame.getStackAddendum = function() {
            var stack = "";
            if (currentExtraStackFrame) {
              stack += currentExtraStackFrame;
            }
            var impl = ReactDebugCurrentFrame.getCurrentStack;
            if (impl) {
              stack += impl() || "";
            }
            return stack;
          };
        }
        var enableScopeAPI = false;
        var enableCacheElement = false;
        var enableTransitionTracing = false;
        var enableLegacyHidden = false;
        var enableDebugTracing = false;
        var ReactSharedInternals = {
          ReactCurrentDispatcher,
          ReactCurrentBatchConfig,
          ReactCurrentOwner
        };
        {
          ReactSharedInternals.ReactDebugCurrentFrame = ReactDebugCurrentFrame;
          ReactSharedInternals.ReactCurrentActQueue = ReactCurrentActQueue;
        }
        function warn(format) {
          {
            {
              for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
                args[_key - 1] = arguments[_key];
              }
              printWarning("warn", format, args);
            }
          }
        }
        function error(format) {
          {
            {
              for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
                args[_key2 - 1] = arguments[_key2];
              }
              printWarning("error", format, args);
            }
          }
        }
        function printWarning(level, format, args) {
          {
            var ReactDebugCurrentFrame2 = ReactSharedInternals.ReactDebugCurrentFrame;
            var stack = ReactDebugCurrentFrame2.getStackAddendum();
            if (stack !== "") {
              format += "%s";
              args = args.concat([stack]);
            }
            var argsWithFormat = args.map(function(item) {
              return String(item);
            });
            argsWithFormat.unshift("Warning: " + format);
            Function.prototype.apply.call(console[level], console, argsWithFormat);
          }
        }
        var didWarnStateUpdateForUnmountedComponent = {};
        function warnNoop(publicInstance, callerName) {
          {
            var _constructor = publicInstance.constructor;
            var componentName = _constructor && (_constructor.displayName || _constructor.name) || "ReactClass";
            var warningKey = componentName + "." + callerName;
            if (didWarnStateUpdateForUnmountedComponent[warningKey]) {
              return;
            }
            error("Can't call %s on a component that is not yet mounted. This is a no-op, but it might indicate a bug in your application. Instead, assign to `this.state` directly or define a `state = {};` class property with the desired state in the %s component.", callerName, componentName);
            didWarnStateUpdateForUnmountedComponent[warningKey] = true;
          }
        }
        var ReactNoopUpdateQueue = {
          /**
           * Checks whether or not this composite component is mounted.
           * @param {ReactClass} publicInstance The instance we want to test.
           * @return {boolean} True if mounted, false otherwise.
           * @protected
           * @final
           */
          isMounted: function(publicInstance) {
            return false;
          },
          /**
           * Forces an update. This should only be invoked when it is known with
           * certainty that we are **not** in a DOM transaction.
           *
           * You may want to call this when you know that some deeper aspect of the
           * component's state has changed but `setState` was not called.
           *
           * This will not invoke `shouldComponentUpdate`, but it will invoke
           * `componentWillUpdate` and `componentDidUpdate`.
           *
           * @param {ReactClass} publicInstance The instance that should rerender.
           * @param {?function} callback Called after component is updated.
           * @param {?string} callerName name of the calling function in the public API.
           * @internal
           */
          enqueueForceUpdate: function(publicInstance, callback, callerName) {
            warnNoop(publicInstance, "forceUpdate");
          },
          /**
           * Replaces all of the state. Always use this or `setState` to mutate state.
           * You should treat `this.state` as immutable.
           *
           * There is no guarantee that `this.state` will be immediately updated, so
           * accessing `this.state` after calling this method may return the old value.
           *
           * @param {ReactClass} publicInstance The instance that should rerender.
           * @param {object} completeState Next state.
           * @param {?function} callback Called after component is updated.
           * @param {?string} callerName name of the calling function in the public API.
           * @internal
           */
          enqueueReplaceState: function(publicInstance, completeState, callback, callerName) {
            warnNoop(publicInstance, "replaceState");
          },
          /**
           * Sets a subset of the state. This only exists because _pendingState is
           * internal. This provides a merging strategy that is not available to deep
           * properties which is confusing. TODO: Expose pendingState or don't use it
           * during the merge.
           *
           * @param {ReactClass} publicInstance The instance that should rerender.
           * @param {object} partialState Next partial state to be merged with state.
           * @param {?function} callback Called after component is updated.
           * @param {?string} Name of the calling function in the public API.
           * @internal
           */
          enqueueSetState: function(publicInstance, partialState, callback, callerName) {
            warnNoop(publicInstance, "setState");
          }
        };
        var assign = Object.assign;
        var emptyObject = {};
        {
          Object.freeze(emptyObject);
        }
        function Component(props, context, updater) {
          this.props = props;
          this.context = context;
          this.refs = emptyObject;
          this.updater = updater || ReactNoopUpdateQueue;
        }
        Component.prototype.isReactComponent = {};
        Component.prototype.setState = function(partialState, callback) {
          if (typeof partialState !== "object" && typeof partialState !== "function" && partialState != null) {
            throw new Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
          }
          this.updater.enqueueSetState(this, partialState, callback, "setState");
        };
        Component.prototype.forceUpdate = function(callback) {
          this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
        };
        {
          var deprecatedAPIs = {
            isMounted: ["isMounted", "Instead, make sure to clean up subscriptions and pending requests in componentWillUnmount to prevent memory leaks."],
            replaceState: ["replaceState", "Refactor your code to use setState instead (see https://github.com/facebook/react/issues/3236)."]
          };
          var defineDeprecationWarning = function(methodName, info) {
            Object.defineProperty(Component.prototype, methodName, {
              get: function() {
                warn("%s(...) is deprecated in plain JavaScript React classes. %s", info[0], info[1]);
                return void 0;
              }
            });
          };
          for (var fnName in deprecatedAPIs) {
            if (deprecatedAPIs.hasOwnProperty(fnName)) {
              defineDeprecationWarning(fnName, deprecatedAPIs[fnName]);
            }
          }
        }
        function ComponentDummy() {
        }
        ComponentDummy.prototype = Component.prototype;
        function PureComponent(props, context, updater) {
          this.props = props;
          this.context = context;
          this.refs = emptyObject;
          this.updater = updater || ReactNoopUpdateQueue;
        }
        var pureComponentPrototype = PureComponent.prototype = new ComponentDummy();
        pureComponentPrototype.constructor = PureComponent;
        assign(pureComponentPrototype, Component.prototype);
        pureComponentPrototype.isPureReactComponent = true;
        function createRef() {
          var refObject = {
            current: null
          };
          {
            Object.seal(refObject);
          }
          return refObject;
        }
        var isArrayImpl = Array.isArray;
        function isArray(a) {
          return isArrayImpl(a);
        }
        function typeName(value) {
          {
            var hasToStringTag = typeof Symbol === "function" && Symbol.toStringTag;
            var type = hasToStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
            return type;
          }
        }
        function willCoercionThrow(value) {
          {
            try {
              testStringCoercion(value);
              return false;
            } catch (e) {
              return true;
            }
          }
        }
        function testStringCoercion(value) {
          return "" + value;
        }
        function checkKeyStringCoercion(value) {
          {
            if (willCoercionThrow(value)) {
              error("The provided key is an unsupported type %s. This value must be coerced to a string before before using it here.", typeName(value));
              return testStringCoercion(value);
            }
          }
        }
        function getWrappedName(outerType, innerType, wrapperName) {
          var displayName = outerType.displayName;
          if (displayName) {
            return displayName;
          }
          var functionName = innerType.displayName || innerType.name || "";
          return functionName !== "" ? wrapperName + "(" + functionName + ")" : wrapperName;
        }
        function getContextName(type) {
          return type.displayName || "Context";
        }
        function getComponentNameFromType(type) {
          if (type == null) {
            return null;
          }
          {
            if (typeof type.tag === "number") {
              error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue.");
            }
          }
          if (typeof type === "function") {
            return type.displayName || type.name || null;
          }
          if (typeof type === "string") {
            return type;
          }
          switch (type) {
            case REACT_FRAGMENT_TYPE:
              return "Fragment";
            case REACT_PORTAL_TYPE:
              return "Portal";
            case REACT_PROFILER_TYPE:
              return "Profiler";
            case REACT_STRICT_MODE_TYPE:
              return "StrictMode";
            case REACT_SUSPENSE_TYPE:
              return "Suspense";
            case REACT_SUSPENSE_LIST_TYPE:
              return "SuspenseList";
          }
          if (typeof type === "object") {
            switch (type.$$typeof) {
              case REACT_CONTEXT_TYPE:
                var context = type;
                return getContextName(context) + ".Consumer";
              case REACT_PROVIDER_TYPE:
                var provider = type;
                return getContextName(provider._context) + ".Provider";
              case REACT_FORWARD_REF_TYPE:
                return getWrappedName(type, type.render, "ForwardRef");
              case REACT_MEMO_TYPE:
                var outerName = type.displayName || null;
                if (outerName !== null) {
                  return outerName;
                }
                return getComponentNameFromType(type.type) || "Memo";
              case REACT_LAZY_TYPE: {
                var lazyComponent = type;
                var payload = lazyComponent._payload;
                var init = lazyComponent._init;
                try {
                  return getComponentNameFromType(init(payload));
                } catch (x) {
                  return null;
                }
              }
            }
          }
          return null;
        }
        var hasOwnProperty = Object.prototype.hasOwnProperty;
        var RESERVED_PROPS = {
          key: true,
          ref: true,
          __self: true,
          __source: true
        };
        var specialPropKeyWarningShown, specialPropRefWarningShown, didWarnAboutStringRefs;
        {
          didWarnAboutStringRefs = {};
        }
        function hasValidRef(config) {
          {
            if (hasOwnProperty.call(config, "ref")) {
              var getter = Object.getOwnPropertyDescriptor(config, "ref").get;
              if (getter && getter.isReactWarning) {
                return false;
              }
            }
          }
          return config.ref !== void 0;
        }
        function hasValidKey(config) {
          {
            if (hasOwnProperty.call(config, "key")) {
              var getter = Object.getOwnPropertyDescriptor(config, "key").get;
              if (getter && getter.isReactWarning) {
                return false;
              }
            }
          }
          return config.key !== void 0;
        }
        function defineKeyPropWarningGetter(props, displayName) {
          var warnAboutAccessingKey = function() {
            {
              if (!specialPropKeyWarningShown) {
                specialPropKeyWarningShown = true;
                error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", displayName);
              }
            }
          };
          warnAboutAccessingKey.isReactWarning = true;
          Object.defineProperty(props, "key", {
            get: warnAboutAccessingKey,
            configurable: true
          });
        }
        function defineRefPropWarningGetter(props, displayName) {
          var warnAboutAccessingRef = function() {
            {
              if (!specialPropRefWarningShown) {
                specialPropRefWarningShown = true;
                error("%s: `ref` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", displayName);
              }
            }
          };
          warnAboutAccessingRef.isReactWarning = true;
          Object.defineProperty(props, "ref", {
            get: warnAboutAccessingRef,
            configurable: true
          });
        }
        function warnIfStringRefCannotBeAutoConverted(config) {
          {
            if (typeof config.ref === "string" && ReactCurrentOwner.current && config.__self && ReactCurrentOwner.current.stateNode !== config.__self) {
              var componentName = getComponentNameFromType(ReactCurrentOwner.current.type);
              if (!didWarnAboutStringRefs[componentName]) {
                error('Component "%s" contains the string ref "%s". Support for string refs will be removed in a future major release. This case cannot be automatically converted to an arrow function. We ask you to manually fix this case by using useRef() or createRef() instead. Learn more about using refs safely here: https://reactjs.org/link/strict-mode-string-ref', componentName, config.ref);
                didWarnAboutStringRefs[componentName] = true;
              }
            }
          }
        }
        var ReactElement = function(type, key, ref, self, source, owner, props) {
          var element = {
            // This tag allows us to uniquely identify this as a React Element
            $$typeof: REACT_ELEMENT_TYPE,
            // Built-in properties that belong on the element
            type,
            key,
            ref,
            props,
            // Record the component responsible for creating this element.
            _owner: owner
          };
          {
            element._store = {};
            Object.defineProperty(element._store, "validated", {
              configurable: false,
              enumerable: false,
              writable: true,
              value: false
            });
            Object.defineProperty(element, "_self", {
              configurable: false,
              enumerable: false,
              writable: false,
              value: self
            });
            Object.defineProperty(element, "_source", {
              configurable: false,
              enumerable: false,
              writable: false,
              value: source
            });
            if (Object.freeze) {
              Object.freeze(element.props);
              Object.freeze(element);
            }
          }
          return element;
        };
        function createElement(type, config, children) {
          var propName;
          var props = {};
          var key = null;
          var ref = null;
          var self = null;
          var source = null;
          if (config != null) {
            if (hasValidRef(config)) {
              ref = config.ref;
              {
                warnIfStringRefCannotBeAutoConverted(config);
              }
            }
            if (hasValidKey(config)) {
              {
                checkKeyStringCoercion(config.key);
              }
              key = "" + config.key;
            }
            self = config.__self === void 0 ? null : config.__self;
            source = config.__source === void 0 ? null : config.__source;
            for (propName in config) {
              if (hasOwnProperty.call(config, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
                props[propName] = config[propName];
              }
            }
          }
          var childrenLength = arguments.length - 2;
          if (childrenLength === 1) {
            props.children = children;
          } else if (childrenLength > 1) {
            var childArray = Array(childrenLength);
            for (var i = 0; i < childrenLength; i++) {
              childArray[i] = arguments[i + 2];
            }
            {
              if (Object.freeze) {
                Object.freeze(childArray);
              }
            }
            props.children = childArray;
          }
          if (type && type.defaultProps) {
            var defaultProps = type.defaultProps;
            for (propName in defaultProps) {
              if (props[propName] === void 0) {
                props[propName] = defaultProps[propName];
              }
            }
          }
          {
            if (key || ref) {
              var displayName = typeof type === "function" ? type.displayName || type.name || "Unknown" : type;
              if (key) {
                defineKeyPropWarningGetter(props, displayName);
              }
              if (ref) {
                defineRefPropWarningGetter(props, displayName);
              }
            }
          }
          return ReactElement(type, key, ref, self, source, ReactCurrentOwner.current, props);
        }
        function cloneAndReplaceKey(oldElement, newKey) {
          var newElement = ReactElement(oldElement.type, newKey, oldElement.ref, oldElement._self, oldElement._source, oldElement._owner, oldElement.props);
          return newElement;
        }
        function cloneElement(element, config, children) {
          if (element === null || element === void 0) {
            throw new Error("React.cloneElement(...): The argument must be a React element, but you passed " + element + ".");
          }
          var propName;
          var props = assign({}, element.props);
          var key = element.key;
          var ref = element.ref;
          var self = element._self;
          var source = element._source;
          var owner = element._owner;
          if (config != null) {
            if (hasValidRef(config)) {
              ref = config.ref;
              owner = ReactCurrentOwner.current;
            }
            if (hasValidKey(config)) {
              {
                checkKeyStringCoercion(config.key);
              }
              key = "" + config.key;
            }
            var defaultProps;
            if (element.type && element.type.defaultProps) {
              defaultProps = element.type.defaultProps;
            }
            for (propName in config) {
              if (hasOwnProperty.call(config, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
                if (config[propName] === void 0 && defaultProps !== void 0) {
                  props[propName] = defaultProps[propName];
                } else {
                  props[propName] = config[propName];
                }
              }
            }
          }
          var childrenLength = arguments.length - 2;
          if (childrenLength === 1) {
            props.children = children;
          } else if (childrenLength > 1) {
            var childArray = Array(childrenLength);
            for (var i = 0; i < childrenLength; i++) {
              childArray[i] = arguments[i + 2];
            }
            props.children = childArray;
          }
          return ReactElement(element.type, key, ref, self, source, owner, props);
        }
        function isValidElement(object) {
          return typeof object === "object" && object !== null && object.$$typeof === REACT_ELEMENT_TYPE;
        }
        var SEPARATOR = ".";
        var SUBSEPARATOR = ":";
        function escape(key) {
          var escapeRegex = /[=:]/g;
          var escaperLookup = {
            "=": "=0",
            ":": "=2"
          };
          var escapedString = key.replace(escapeRegex, function(match) {
            return escaperLookup[match];
          });
          return "$" + escapedString;
        }
        var didWarnAboutMaps = false;
        var userProvidedKeyEscapeRegex = /\/+/g;
        function escapeUserProvidedKey(text) {
          return text.replace(userProvidedKeyEscapeRegex, "$&/");
        }
        function getElementKey(element, index) {
          if (typeof element === "object" && element !== null && element.key != null) {
            {
              checkKeyStringCoercion(element.key);
            }
            return escape("" + element.key);
          }
          return index.toString(36);
        }
        function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
          var type = typeof children;
          if (type === "undefined" || type === "boolean") {
            children = null;
          }
          var invokeCallback = false;
          if (children === null) {
            invokeCallback = true;
          } else {
            switch (type) {
              case "string":
              case "number":
                invokeCallback = true;
                break;
              case "object":
                switch (children.$$typeof) {
                  case REACT_ELEMENT_TYPE:
                  case REACT_PORTAL_TYPE:
                    invokeCallback = true;
                }
            }
          }
          if (invokeCallback) {
            var _child = children;
            var mappedChild = callback(_child);
            var childKey = nameSoFar === "" ? SEPARATOR + getElementKey(_child, 0) : nameSoFar;
            if (isArray(mappedChild)) {
              var escapedChildKey = "";
              if (childKey != null) {
                escapedChildKey = escapeUserProvidedKey(childKey) + "/";
              }
              mapIntoArray(mappedChild, array, escapedChildKey, "", function(c) {
                return c;
              });
            } else if (mappedChild != null) {
              if (isValidElement(mappedChild)) {
                {
                  if (mappedChild.key && (!_child || _child.key !== mappedChild.key)) {
                    checkKeyStringCoercion(mappedChild.key);
                  }
                }
                mappedChild = cloneAndReplaceKey(
                  mappedChild,
                  // Keep both the (mapped) and old keys if they differ, just as
                  // traverseAllChildren used to do for objects as children
                  escapedPrefix + // $FlowFixMe Flow incorrectly thinks React.Portal doesn't have a key
                  (mappedChild.key && (!_child || _child.key !== mappedChild.key) ? (
                    // $FlowFixMe Flow incorrectly thinks existing element's key can be a number
                    // eslint-disable-next-line react-internal/safe-string-coercion
                    escapeUserProvidedKey("" + mappedChild.key) + "/"
                  ) : "") + childKey
                );
              }
              array.push(mappedChild);
            }
            return 1;
          }
          var child;
          var nextName;
          var subtreeCount = 0;
          var nextNamePrefix = nameSoFar === "" ? SEPARATOR : nameSoFar + SUBSEPARATOR;
          if (isArray(children)) {
            for (var i = 0; i < children.length; i++) {
              child = children[i];
              nextName = nextNamePrefix + getElementKey(child, i);
              subtreeCount += mapIntoArray(child, array, escapedPrefix, nextName, callback);
            }
          } else {
            var iteratorFn = getIteratorFn(children);
            if (typeof iteratorFn === "function") {
              var iterableChildren = children;
              {
                if (iteratorFn === iterableChildren.entries) {
                  if (!didWarnAboutMaps) {
                    warn("Using Maps as children is not supported. Use an array of keyed ReactElements instead.");
                  }
                  didWarnAboutMaps = true;
                }
              }
              var iterator = iteratorFn.call(iterableChildren);
              var step;
              var ii = 0;
              while (!(step = iterator.next()).done) {
                child = step.value;
                nextName = nextNamePrefix + getElementKey(child, ii++);
                subtreeCount += mapIntoArray(child, array, escapedPrefix, nextName, callback);
              }
            } else if (type === "object") {
              var childrenString = String(children);
              throw new Error("Objects are not valid as a React child (found: " + (childrenString === "[object Object]" ? "object with keys {" + Object.keys(children).join(", ") + "}" : childrenString) + "). If you meant to render a collection of children, use an array instead.");
            }
          }
          return subtreeCount;
        }
        function mapChildren(children, func, context) {
          if (children == null) {
            return children;
          }
          var result = [];
          var count = 0;
          mapIntoArray(children, result, "", "", function(child) {
            return func.call(context, child, count++);
          });
          return result;
        }
        function countChildren(children) {
          var n = 0;
          mapChildren(children, function() {
            n++;
          });
          return n;
        }
        function forEachChildren(children, forEachFunc, forEachContext) {
          mapChildren(children, function() {
            forEachFunc.apply(this, arguments);
          }, forEachContext);
        }
        function toArray(children) {
          return mapChildren(children, function(child) {
            return child;
          }) || [];
        }
        function onlyChild(children) {
          if (!isValidElement(children)) {
            throw new Error("React.Children.only expected to receive a single React element child.");
          }
          return children;
        }
        function createContext(defaultValue) {
          var context = {
            $$typeof: REACT_CONTEXT_TYPE,
            // As a workaround to support multiple concurrent renderers, we categorize
            // some renderers as primary and others as secondary. We only expect
            // there to be two concurrent renderers at most: React Native (primary) and
            // Fabric (secondary); React DOM (primary) and React ART (secondary).
            // Secondary renderers store their context values on separate fields.
            _currentValue: defaultValue,
            _currentValue2: defaultValue,
            // Used to track how many concurrent renderers this context currently
            // supports within in a single renderer. Such as parallel server rendering.
            _threadCount: 0,
            // These are circular
            Provider: null,
            Consumer: null,
            // Add these to use same hidden class in VM as ServerContext
            _defaultValue: null,
            _globalName: null
          };
          context.Provider = {
            $$typeof: REACT_PROVIDER_TYPE,
            _context: context
          };
          var hasWarnedAboutUsingNestedContextConsumers = false;
          var hasWarnedAboutUsingConsumerProvider = false;
          var hasWarnedAboutDisplayNameOnConsumer = false;
          {
            var Consumer = {
              $$typeof: REACT_CONTEXT_TYPE,
              _context: context
            };
            Object.defineProperties(Consumer, {
              Provider: {
                get: function() {
                  if (!hasWarnedAboutUsingConsumerProvider) {
                    hasWarnedAboutUsingConsumerProvider = true;
                    error("Rendering <Context.Consumer.Provider> is not supported and will be removed in a future major release. Did you mean to render <Context.Provider> instead?");
                  }
                  return context.Provider;
                },
                set: function(_Provider) {
                  context.Provider = _Provider;
                }
              },
              _currentValue: {
                get: function() {
                  return context._currentValue;
                },
                set: function(_currentValue) {
                  context._currentValue = _currentValue;
                }
              },
              _currentValue2: {
                get: function() {
                  return context._currentValue2;
                },
                set: function(_currentValue2) {
                  context._currentValue2 = _currentValue2;
                }
              },
              _threadCount: {
                get: function() {
                  return context._threadCount;
                },
                set: function(_threadCount) {
                  context._threadCount = _threadCount;
                }
              },
              Consumer: {
                get: function() {
                  if (!hasWarnedAboutUsingNestedContextConsumers) {
                    hasWarnedAboutUsingNestedContextConsumers = true;
                    error("Rendering <Context.Consumer.Consumer> is not supported and will be removed in a future major release. Did you mean to render <Context.Consumer> instead?");
                  }
                  return context.Consumer;
                }
              },
              displayName: {
                get: function() {
                  return context.displayName;
                },
                set: function(displayName) {
                  if (!hasWarnedAboutDisplayNameOnConsumer) {
                    warn("Setting `displayName` on Context.Consumer has no effect. You should set it directly on the context with Context.displayName = '%s'.", displayName);
                    hasWarnedAboutDisplayNameOnConsumer = true;
                  }
                }
              }
            });
            context.Consumer = Consumer;
          }
          {
            context._currentRenderer = null;
            context._currentRenderer2 = null;
          }
          return context;
        }
        var Uninitialized = -1;
        var Pending = 0;
        var Resolved = 1;
        var Rejected = 2;
        function lazyInitializer(payload) {
          if (payload._status === Uninitialized) {
            var ctor = payload._result;
            var thenable = ctor();
            thenable.then(function(moduleObject2) {
              if (payload._status === Pending || payload._status === Uninitialized) {
                var resolved = payload;
                resolved._status = Resolved;
                resolved._result = moduleObject2;
              }
            }, function(error2) {
              if (payload._status === Pending || payload._status === Uninitialized) {
                var rejected = payload;
                rejected._status = Rejected;
                rejected._result = error2;
              }
            });
            if (payload._status === Uninitialized) {
              var pending = payload;
              pending._status = Pending;
              pending._result = thenable;
            }
          }
          if (payload._status === Resolved) {
            var moduleObject = payload._result;
            {
              if (moduleObject === void 0) {
                error("lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))\n\nDid you accidentally put curly braces around the import?", moduleObject);
              }
            }
            {
              if (!("default" in moduleObject)) {
                error("lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))", moduleObject);
              }
            }
            return moduleObject.default;
          } else {
            throw payload._result;
          }
        }
        function lazy(ctor) {
          var payload = {
            // We use these fields to store the result.
            _status: Uninitialized,
            _result: ctor
          };
          var lazyType = {
            $$typeof: REACT_LAZY_TYPE,
            _payload: payload,
            _init: lazyInitializer
          };
          {
            var defaultProps;
            var propTypes;
            Object.defineProperties(lazyType, {
              defaultProps: {
                configurable: true,
                get: function() {
                  return defaultProps;
                },
                set: function(newDefaultProps) {
                  error("React.lazy(...): It is not supported to assign `defaultProps` to a lazy component import. Either specify them where the component is defined, or create a wrapping component around it.");
                  defaultProps = newDefaultProps;
                  Object.defineProperty(lazyType, "defaultProps", {
                    enumerable: true
                  });
                }
              },
              propTypes: {
                configurable: true,
                get: function() {
                  return propTypes;
                },
                set: function(newPropTypes) {
                  error("React.lazy(...): It is not supported to assign `propTypes` to a lazy component import. Either specify them where the component is defined, or create a wrapping component around it.");
                  propTypes = newPropTypes;
                  Object.defineProperty(lazyType, "propTypes", {
                    enumerable: true
                  });
                }
              }
            });
          }
          return lazyType;
        }
        function forwardRef(render) {
          {
            if (render != null && render.$$typeof === REACT_MEMO_TYPE) {
              error("forwardRef requires a render function but received a `memo` component. Instead of forwardRef(memo(...)), use memo(forwardRef(...)).");
            } else if (typeof render !== "function") {
              error("forwardRef requires a render function but was given %s.", render === null ? "null" : typeof render);
            } else {
              if (render.length !== 0 && render.length !== 2) {
                error("forwardRef render functions accept exactly two parameters: props and ref. %s", render.length === 1 ? "Did you forget to use the ref parameter?" : "Any additional parameter will be undefined.");
              }
            }
            if (render != null) {
              if (render.defaultProps != null || render.propTypes != null) {
                error("forwardRef render functions do not support propTypes or defaultProps. Did you accidentally pass a React component?");
              }
            }
          }
          var elementType = {
            $$typeof: REACT_FORWARD_REF_TYPE,
            render
          };
          {
            var ownName;
            Object.defineProperty(elementType, "displayName", {
              enumerable: false,
              configurable: true,
              get: function() {
                return ownName;
              },
              set: function(name) {
                ownName = name;
                if (!render.name && !render.displayName) {
                  render.displayName = name;
                }
              }
            });
          }
          return elementType;
        }
        var REACT_MODULE_REFERENCE;
        {
          REACT_MODULE_REFERENCE = Symbol.for("react.module.reference");
        }
        function isValidElementType(type) {
          if (typeof type === "string" || typeof type === "function") {
            return true;
          }
          if (type === REACT_FRAGMENT_TYPE || type === REACT_PROFILER_TYPE || enableDebugTracing || type === REACT_STRICT_MODE_TYPE || type === REACT_SUSPENSE_TYPE || type === REACT_SUSPENSE_LIST_TYPE || enableLegacyHidden || type === REACT_OFFSCREEN_TYPE || enableScopeAPI || enableCacheElement || enableTransitionTracing) {
            return true;
          }
          if (typeof type === "object" && type !== null) {
            if (type.$$typeof === REACT_LAZY_TYPE || type.$$typeof === REACT_MEMO_TYPE || type.$$typeof === REACT_PROVIDER_TYPE || type.$$typeof === REACT_CONTEXT_TYPE || type.$$typeof === REACT_FORWARD_REF_TYPE || // This needs to include all possible module reference object
            // types supported by any Flight configuration anywhere since
            // we don't know which Flight build this will end up being used
            // with.
            type.$$typeof === REACT_MODULE_REFERENCE || type.getModuleId !== void 0) {
              return true;
            }
          }
          return false;
        }
        function memo(type, compare) {
          {
            if (!isValidElementType(type)) {
              error("memo: The first argument must be a component. Instead received: %s", type === null ? "null" : typeof type);
            }
          }
          var elementType = {
            $$typeof: REACT_MEMO_TYPE,
            type,
            compare: compare === void 0 ? null : compare
          };
          {
            var ownName;
            Object.defineProperty(elementType, "displayName", {
              enumerable: false,
              configurable: true,
              get: function() {
                return ownName;
              },
              set: function(name) {
                ownName = name;
                if (!type.name && !type.displayName) {
                  type.displayName = name;
                }
              }
            });
          }
          return elementType;
        }
        function resolveDispatcher() {
          var dispatcher = ReactCurrentDispatcher.current;
          {
            if (dispatcher === null) {
              error("Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:\n1. You might have mismatching versions of React and the renderer (such as React DOM)\n2. You might be breaking the Rules of Hooks\n3. You might have more than one copy of React in the same app\nSee https://reactjs.org/link/invalid-hook-call for tips about how to debug and fix this problem.");
            }
          }
          return dispatcher;
        }
        function useContext(Context) {
          var dispatcher = resolveDispatcher();
          {
            if (Context._context !== void 0) {
              var realContext = Context._context;
              if (realContext.Consumer === Context) {
                error("Calling useContext(Context.Consumer) is not supported, may cause bugs, and will be removed in a future major release. Did you mean to call useContext(Context) instead?");
              } else if (realContext.Provider === Context) {
                error("Calling useContext(Context.Provider) is not supported. Did you mean to call useContext(Context) instead?");
              }
            }
          }
          return dispatcher.useContext(Context);
        }
        function useState(initialState) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useState(initialState);
        }
        function useReducer(reducer, initialArg, init) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useReducer(reducer, initialArg, init);
        }
        function useRef(initialValue) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useRef(initialValue);
        }
        function useEffect(create, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useEffect(create, deps);
        }
        function useInsertionEffect(create, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useInsertionEffect(create, deps);
        }
        function useLayoutEffect(create, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useLayoutEffect(create, deps);
        }
        function useCallback(callback, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useCallback(callback, deps);
        }
        function useMemo(create, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useMemo(create, deps);
        }
        function useImperativeHandle(ref, create, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useImperativeHandle(ref, create, deps);
        }
        function useDebugValue(value, formatterFn) {
          {
            var dispatcher = resolveDispatcher();
            return dispatcher.useDebugValue(value, formatterFn);
          }
        }
        function useTransition() {
          var dispatcher = resolveDispatcher();
          return dispatcher.useTransition();
        }
        function useDeferredValue(value) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useDeferredValue(value);
        }
        function useId() {
          var dispatcher = resolveDispatcher();
          return dispatcher.useId();
        }
        function useSyncExternalStore2(subscribe, getSnapshot, getServerSnapshot) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
        }
        var disabledDepth = 0;
        var prevLog;
        var prevInfo;
        var prevWarn;
        var prevError;
        var prevGroup;
        var prevGroupCollapsed;
        var prevGroupEnd;
        function disabledLog() {
        }
        disabledLog.__reactDisabledLog = true;
        function disableLogs() {
          {
            if (disabledDepth === 0) {
              prevLog = console.log;
              prevInfo = console.info;
              prevWarn = console.warn;
              prevError = console.error;
              prevGroup = console.group;
              prevGroupCollapsed = console.groupCollapsed;
              prevGroupEnd = console.groupEnd;
              var props = {
                configurable: true,
                enumerable: true,
                value: disabledLog,
                writable: true
              };
              Object.defineProperties(console, {
                info: props,
                log: props,
                warn: props,
                error: props,
                group: props,
                groupCollapsed: props,
                groupEnd: props
              });
            }
            disabledDepth++;
          }
        }
        function reenableLogs() {
          {
            disabledDepth--;
            if (disabledDepth === 0) {
              var props = {
                configurable: true,
                enumerable: true,
                writable: true
              };
              Object.defineProperties(console, {
                log: assign({}, props, {
                  value: prevLog
                }),
                info: assign({}, props, {
                  value: prevInfo
                }),
                warn: assign({}, props, {
                  value: prevWarn
                }),
                error: assign({}, props, {
                  value: prevError
                }),
                group: assign({}, props, {
                  value: prevGroup
                }),
                groupCollapsed: assign({}, props, {
                  value: prevGroupCollapsed
                }),
                groupEnd: assign({}, props, {
                  value: prevGroupEnd
                })
              });
            }
            if (disabledDepth < 0) {
              error("disabledDepth fell below zero. This is a bug in React. Please file an issue.");
            }
          }
        }
        var ReactCurrentDispatcher$1 = ReactSharedInternals.ReactCurrentDispatcher;
        var prefix;
        function describeBuiltInComponentFrame(name, source, ownerFn) {
          {
            if (prefix === void 0) {
              try {
                throw Error();
              } catch (x) {
                var match = x.stack.trim().match(/\n( *(at )?)/);
                prefix = match && match[1] || "";
              }
            }
            return "\n" + prefix + name;
          }
        }
        var reentry = false;
        var componentFrameCache;
        {
          var PossiblyWeakMap = typeof WeakMap === "function" ? WeakMap : Map;
          componentFrameCache = new PossiblyWeakMap();
        }
        function describeNativeComponentFrame(fn, construct) {
          if (!fn || reentry) {
            return "";
          }
          {
            var frame = componentFrameCache.get(fn);
            if (frame !== void 0) {
              return frame;
            }
          }
          var control;
          reentry = true;
          var previousPrepareStackTrace = Error.prepareStackTrace;
          Error.prepareStackTrace = void 0;
          var previousDispatcher;
          {
            previousDispatcher = ReactCurrentDispatcher$1.current;
            ReactCurrentDispatcher$1.current = null;
            disableLogs();
          }
          try {
            if (construct) {
              var Fake = function() {
                throw Error();
              };
              Object.defineProperty(Fake.prototype, "props", {
                set: function() {
                  throw Error();
                }
              });
              if (typeof Reflect === "object" && Reflect.construct) {
                try {
                  Reflect.construct(Fake, []);
                } catch (x) {
                  control = x;
                }
                Reflect.construct(fn, [], Fake);
              } else {
                try {
                  Fake.call();
                } catch (x) {
                  control = x;
                }
                fn.call(Fake.prototype);
              }
            } else {
              try {
                throw Error();
              } catch (x) {
                control = x;
              }
              fn();
            }
          } catch (sample) {
            if (sample && control && typeof sample.stack === "string") {
              var sampleLines = sample.stack.split("\n");
              var controlLines = control.stack.split("\n");
              var s = sampleLines.length - 1;
              var c = controlLines.length - 1;
              while (s >= 1 && c >= 0 && sampleLines[s] !== controlLines[c]) {
                c--;
              }
              for (; s >= 1 && c >= 0; s--, c--) {
                if (sampleLines[s] !== controlLines[c]) {
                  if (s !== 1 || c !== 1) {
                    do {
                      s--;
                      c--;
                      if (c < 0 || sampleLines[s] !== controlLines[c]) {
                        var _frame = "\n" + sampleLines[s].replace(" at new ", " at ");
                        if (fn.displayName && _frame.includes("<anonymous>")) {
                          _frame = _frame.replace("<anonymous>", fn.displayName);
                        }
                        {
                          if (typeof fn === "function") {
                            componentFrameCache.set(fn, _frame);
                          }
                        }
                        return _frame;
                      }
                    } while (s >= 1 && c >= 0);
                  }
                  break;
                }
              }
            }
          } finally {
            reentry = false;
            {
              ReactCurrentDispatcher$1.current = previousDispatcher;
              reenableLogs();
            }
            Error.prepareStackTrace = previousPrepareStackTrace;
          }
          var name = fn ? fn.displayName || fn.name : "";
          var syntheticFrame = name ? describeBuiltInComponentFrame(name) : "";
          {
            if (typeof fn === "function") {
              componentFrameCache.set(fn, syntheticFrame);
            }
          }
          return syntheticFrame;
        }
        function describeFunctionComponentFrame(fn, source, ownerFn) {
          {
            return describeNativeComponentFrame(fn, false);
          }
        }
        function shouldConstruct(Component2) {
          var prototype = Component2.prototype;
          return !!(prototype && prototype.isReactComponent);
        }
        function describeUnknownElementTypeFrameInDEV(type, source, ownerFn) {
          if (type == null) {
            return "";
          }
          if (typeof type === "function") {
            {
              return describeNativeComponentFrame(type, shouldConstruct(type));
            }
          }
          if (typeof type === "string") {
            return describeBuiltInComponentFrame(type);
          }
          switch (type) {
            case REACT_SUSPENSE_TYPE:
              return describeBuiltInComponentFrame("Suspense");
            case REACT_SUSPENSE_LIST_TYPE:
              return describeBuiltInComponentFrame("SuspenseList");
          }
          if (typeof type === "object") {
            switch (type.$$typeof) {
              case REACT_FORWARD_REF_TYPE:
                return describeFunctionComponentFrame(type.render);
              case REACT_MEMO_TYPE:
                return describeUnknownElementTypeFrameInDEV(type.type, source, ownerFn);
              case REACT_LAZY_TYPE: {
                var lazyComponent = type;
                var payload = lazyComponent._payload;
                var init = lazyComponent._init;
                try {
                  return describeUnknownElementTypeFrameInDEV(init(payload), source, ownerFn);
                } catch (x) {
                }
              }
            }
          }
          return "";
        }
        var loggedTypeFailures = {};
        var ReactDebugCurrentFrame$1 = ReactSharedInternals.ReactDebugCurrentFrame;
        function setCurrentlyValidatingElement(element) {
          {
            if (element) {
              var owner = element._owner;
              var stack = describeUnknownElementTypeFrameInDEV(element.type, element._source, owner ? owner.type : null);
              ReactDebugCurrentFrame$1.setExtraStackFrame(stack);
            } else {
              ReactDebugCurrentFrame$1.setExtraStackFrame(null);
            }
          }
        }
        function checkPropTypes(typeSpecs, values, location, componentName, element) {
          {
            var has = Function.call.bind(hasOwnProperty);
            for (var typeSpecName in typeSpecs) {
              if (has(typeSpecs, typeSpecName)) {
                var error$1 = void 0;
                try {
                  if (typeof typeSpecs[typeSpecName] !== "function") {
                    var err = Error((componentName || "React class") + ": " + location + " type `" + typeSpecName + "` is invalid; it must be a function, usually from the `prop-types` package, but received `" + typeof typeSpecs[typeSpecName] + "`.This often happens because of typos such as `PropTypes.function` instead of `PropTypes.func`.");
                    err.name = "Invariant Violation";
                    throw err;
                  }
                  error$1 = typeSpecs[typeSpecName](values, typeSpecName, componentName, location, null, "SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED");
                } catch (ex) {
                  error$1 = ex;
                }
                if (error$1 && !(error$1 instanceof Error)) {
                  setCurrentlyValidatingElement(element);
                  error("%s: type specification of %s `%s` is invalid; the type checker function must return `null` or an `Error` but returned a %s. You may have forgotten to pass an argument to the type checker creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and shape all require an argument).", componentName || "React class", location, typeSpecName, typeof error$1);
                  setCurrentlyValidatingElement(null);
                }
                if (error$1 instanceof Error && !(error$1.message in loggedTypeFailures)) {
                  loggedTypeFailures[error$1.message] = true;
                  setCurrentlyValidatingElement(element);
                  error("Failed %s type: %s", location, error$1.message);
                  setCurrentlyValidatingElement(null);
                }
              }
            }
          }
        }
        function setCurrentlyValidatingElement$1(element) {
          {
            if (element) {
              var owner = element._owner;
              var stack = describeUnknownElementTypeFrameInDEV(element.type, element._source, owner ? owner.type : null);
              setExtraStackFrame(stack);
            } else {
              setExtraStackFrame(null);
            }
          }
        }
        var propTypesMisspellWarningShown;
        {
          propTypesMisspellWarningShown = false;
        }
        function getDeclarationErrorAddendum() {
          if (ReactCurrentOwner.current) {
            var name = getComponentNameFromType(ReactCurrentOwner.current.type);
            if (name) {
              return "\n\nCheck the render method of `" + name + "`.";
            }
          }
          return "";
        }
        function getSourceInfoErrorAddendum(source) {
          if (source !== void 0) {
            var fileName = source.fileName.replace(/^.*[\\\/]/, "");
            var lineNumber = source.lineNumber;
            return "\n\nCheck your code at " + fileName + ":" + lineNumber + ".";
          }
          return "";
        }
        function getSourceInfoErrorAddendumForProps(elementProps) {
          if (elementProps !== null && elementProps !== void 0) {
            return getSourceInfoErrorAddendum(elementProps.__source);
          }
          return "";
        }
        var ownerHasKeyUseWarning = {};
        function getCurrentComponentErrorInfo(parentType) {
          var info = getDeclarationErrorAddendum();
          if (!info) {
            var parentName = typeof parentType === "string" ? parentType : parentType.displayName || parentType.name;
            if (parentName) {
              info = "\n\nCheck the top-level render call using <" + parentName + ">.";
            }
          }
          return info;
        }
        function validateExplicitKey(element, parentType) {
          if (!element._store || element._store.validated || element.key != null) {
            return;
          }
          element._store.validated = true;
          var currentComponentErrorInfo = getCurrentComponentErrorInfo(parentType);
          if (ownerHasKeyUseWarning[currentComponentErrorInfo]) {
            return;
          }
          ownerHasKeyUseWarning[currentComponentErrorInfo] = true;
          var childOwner = "";
          if (element && element._owner && element._owner !== ReactCurrentOwner.current) {
            childOwner = " It was passed a child from " + getComponentNameFromType(element._owner.type) + ".";
          }
          {
            setCurrentlyValidatingElement$1(element);
            error('Each child in a list should have a unique "key" prop.%s%s See https://reactjs.org/link/warning-keys for more information.', currentComponentErrorInfo, childOwner);
            setCurrentlyValidatingElement$1(null);
          }
        }
        function validateChildKeys(node, parentType) {
          if (typeof node !== "object") {
            return;
          }
          if (isArray(node)) {
            for (var i = 0; i < node.length; i++) {
              var child = node[i];
              if (isValidElement(child)) {
                validateExplicitKey(child, parentType);
              }
            }
          } else if (isValidElement(node)) {
            if (node._store) {
              node._store.validated = true;
            }
          } else if (node) {
            var iteratorFn = getIteratorFn(node);
            if (typeof iteratorFn === "function") {
              if (iteratorFn !== node.entries) {
                var iterator = iteratorFn.call(node);
                var step;
                while (!(step = iterator.next()).done) {
                  if (isValidElement(step.value)) {
                    validateExplicitKey(step.value, parentType);
                  }
                }
              }
            }
          }
        }
        function validatePropTypes(element) {
          {
            var type = element.type;
            if (type === null || type === void 0 || typeof type === "string") {
              return;
            }
            var propTypes;
            if (typeof type === "function") {
              propTypes = type.propTypes;
            } else if (typeof type === "object" && (type.$$typeof === REACT_FORWARD_REF_TYPE || // Note: Memo only checks outer props here.
            // Inner props are checked in the reconciler.
            type.$$typeof === REACT_MEMO_TYPE)) {
              propTypes = type.propTypes;
            } else {
              return;
            }
            if (propTypes) {
              var name = getComponentNameFromType(type);
              checkPropTypes(propTypes, element.props, "prop", name, element);
            } else if (type.PropTypes !== void 0 && !propTypesMisspellWarningShown) {
              propTypesMisspellWarningShown = true;
              var _name = getComponentNameFromType(type);
              error("Component %s declared `PropTypes` instead of `propTypes`. Did you misspell the property assignment?", _name || "Unknown");
            }
            if (typeof type.getDefaultProps === "function" && !type.getDefaultProps.isReactClassApproved) {
              error("getDefaultProps is only used on classic React.createClass definitions. Use a static property named `defaultProps` instead.");
            }
          }
        }
        function validateFragmentProps(fragment) {
          {
            var keys = Object.keys(fragment.props);
            for (var i = 0; i < keys.length; i++) {
              var key = keys[i];
              if (key !== "children" && key !== "key") {
                setCurrentlyValidatingElement$1(fragment);
                error("Invalid prop `%s` supplied to `React.Fragment`. React.Fragment can only have `key` and `children` props.", key);
                setCurrentlyValidatingElement$1(null);
                break;
              }
            }
            if (fragment.ref !== null) {
              setCurrentlyValidatingElement$1(fragment);
              error("Invalid attribute `ref` supplied to `React.Fragment`.");
              setCurrentlyValidatingElement$1(null);
            }
          }
        }
        function createElementWithValidation(type, props, children) {
          var validType = isValidElementType(type);
          if (!validType) {
            var info = "";
            if (type === void 0 || typeof type === "object" && type !== null && Object.keys(type).length === 0) {
              info += " You likely forgot to export your component from the file it's defined in, or you might have mixed up default and named imports.";
            }
            var sourceInfo = getSourceInfoErrorAddendumForProps(props);
            if (sourceInfo) {
              info += sourceInfo;
            } else {
              info += getDeclarationErrorAddendum();
            }
            var typeString;
            if (type === null) {
              typeString = "null";
            } else if (isArray(type)) {
              typeString = "array";
            } else if (type !== void 0 && type.$$typeof === REACT_ELEMENT_TYPE) {
              typeString = "<" + (getComponentNameFromType(type.type) || "Unknown") + " />";
              info = " Did you accidentally export a JSX literal instead of a component?";
            } else {
              typeString = typeof type;
            }
            {
              error("React.createElement: type is invalid -- expected a string (for built-in components) or a class/function (for composite components) but got: %s.%s", typeString, info);
            }
          }
          var element = createElement.apply(this, arguments);
          if (element == null) {
            return element;
          }
          if (validType) {
            for (var i = 2; i < arguments.length; i++) {
              validateChildKeys(arguments[i], type);
            }
          }
          if (type === REACT_FRAGMENT_TYPE) {
            validateFragmentProps(element);
          } else {
            validatePropTypes(element);
          }
          return element;
        }
        var didWarnAboutDeprecatedCreateFactory = false;
        function createFactoryWithValidation(type) {
          var validatedFactory = createElementWithValidation.bind(null, type);
          validatedFactory.type = type;
          {
            if (!didWarnAboutDeprecatedCreateFactory) {
              didWarnAboutDeprecatedCreateFactory = true;
              warn("React.createFactory() is deprecated and will be removed in a future major release. Consider using JSX or use React.createElement() directly instead.");
            }
            Object.defineProperty(validatedFactory, "type", {
              enumerable: false,
              get: function() {
                warn("Factory.type is deprecated. Access the class directly before passing it to createFactory.");
                Object.defineProperty(this, "type", {
                  value: type
                });
                return type;
              }
            });
          }
          return validatedFactory;
        }
        function cloneElementWithValidation(element, props, children) {
          var newElement = cloneElement.apply(this, arguments);
          for (var i = 2; i < arguments.length; i++) {
            validateChildKeys(arguments[i], newElement.type);
          }
          validatePropTypes(newElement);
          return newElement;
        }
        function startTransition(scope, options) {
          var prevTransition = ReactCurrentBatchConfig.transition;
          ReactCurrentBatchConfig.transition = {};
          var currentTransition = ReactCurrentBatchConfig.transition;
          {
            ReactCurrentBatchConfig.transition._updatedFibers = /* @__PURE__ */ new Set();
          }
          try {
            scope();
          } finally {
            ReactCurrentBatchConfig.transition = prevTransition;
            {
              if (prevTransition === null && currentTransition._updatedFibers) {
                var updatedFibersCount = currentTransition._updatedFibers.size;
                if (updatedFibersCount > 10) {
                  warn("Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table.");
                }
                currentTransition._updatedFibers.clear();
              }
            }
          }
        }
        var didWarnAboutMessageChannel = false;
        var enqueueTaskImpl = null;
        function enqueueTask(task) {
          if (enqueueTaskImpl === null) {
            try {
              var requireString = ("require" + Math.random()).slice(0, 7);
              var nodeRequire = module && module[requireString];
              enqueueTaskImpl = nodeRequire.call(module, "timers").setImmediate;
            } catch (_err) {
              enqueueTaskImpl = function(callback) {
                {
                  if (didWarnAboutMessageChannel === false) {
                    didWarnAboutMessageChannel = true;
                    if (typeof MessageChannel === "undefined") {
                      error("This browser does not have a MessageChannel implementation, so enqueuing tasks via await act(async () => ...) will fail. Please file an issue at https://github.com/facebook/react/issues if you encounter this warning.");
                    }
                  }
                }
                var channel = new MessageChannel();
                channel.port1.onmessage = callback;
                channel.port2.postMessage(void 0);
              };
            }
          }
          return enqueueTaskImpl(task);
        }
        var actScopeDepth = 0;
        var didWarnNoAwaitAct = false;
        function act(callback) {
          {
            var prevActScopeDepth = actScopeDepth;
            actScopeDepth++;
            if (ReactCurrentActQueue.current === null) {
              ReactCurrentActQueue.current = [];
            }
            var prevIsBatchingLegacy = ReactCurrentActQueue.isBatchingLegacy;
            var result;
            try {
              ReactCurrentActQueue.isBatchingLegacy = true;
              result = callback();
              if (!prevIsBatchingLegacy && ReactCurrentActQueue.didScheduleLegacyUpdate) {
                var queue = ReactCurrentActQueue.current;
                if (queue !== null) {
                  ReactCurrentActQueue.didScheduleLegacyUpdate = false;
                  flushActQueue(queue);
                }
              }
            } catch (error2) {
              popActScope(prevActScopeDepth);
              throw error2;
            } finally {
              ReactCurrentActQueue.isBatchingLegacy = prevIsBatchingLegacy;
            }
            if (result !== null && typeof result === "object" && typeof result.then === "function") {
              var thenableResult = result;
              var wasAwaited = false;
              var thenable = {
                then: function(resolve, reject) {
                  wasAwaited = true;
                  thenableResult.then(function(returnValue2) {
                    popActScope(prevActScopeDepth);
                    if (actScopeDepth === 0) {
                      recursivelyFlushAsyncActWork(returnValue2, resolve, reject);
                    } else {
                      resolve(returnValue2);
                    }
                  }, function(error2) {
                    popActScope(prevActScopeDepth);
                    reject(error2);
                  });
                }
              };
              {
                if (!didWarnNoAwaitAct && typeof Promise !== "undefined") {
                  Promise.resolve().then(function() {
                  }).then(function() {
                    if (!wasAwaited) {
                      didWarnNoAwaitAct = true;
                      error("You called act(async () => ...) without await. This could lead to unexpected testing behaviour, interleaving multiple act calls and mixing their scopes. You should - await act(async () => ...);");
                    }
                  });
                }
              }
              return thenable;
            } else {
              var returnValue = result;
              popActScope(prevActScopeDepth);
              if (actScopeDepth === 0) {
                var _queue = ReactCurrentActQueue.current;
                if (_queue !== null) {
                  flushActQueue(_queue);
                  ReactCurrentActQueue.current = null;
                }
                var _thenable = {
                  then: function(resolve, reject) {
                    if (ReactCurrentActQueue.current === null) {
                      ReactCurrentActQueue.current = [];
                      recursivelyFlushAsyncActWork(returnValue, resolve, reject);
                    } else {
                      resolve(returnValue);
                    }
                  }
                };
                return _thenable;
              } else {
                var _thenable2 = {
                  then: function(resolve, reject) {
                    resolve(returnValue);
                  }
                };
                return _thenable2;
              }
            }
          }
        }
        function popActScope(prevActScopeDepth) {
          {
            if (prevActScopeDepth !== actScopeDepth - 1) {
              error("You seem to have overlapping act() calls, this is not supported. Be sure to await previous act() calls before making a new one. ");
            }
            actScopeDepth = prevActScopeDepth;
          }
        }
        function recursivelyFlushAsyncActWork(returnValue, resolve, reject) {
          {
            var queue = ReactCurrentActQueue.current;
            if (queue !== null) {
              try {
                flushActQueue(queue);
                enqueueTask(function() {
                  if (queue.length === 0) {
                    ReactCurrentActQueue.current = null;
                    resolve(returnValue);
                  } else {
                    recursivelyFlushAsyncActWork(returnValue, resolve, reject);
                  }
                });
              } catch (error2) {
                reject(error2);
              }
            } else {
              resolve(returnValue);
            }
          }
        }
        var isFlushing = false;
        function flushActQueue(queue) {
          {
            if (!isFlushing) {
              isFlushing = true;
              var i = 0;
              try {
                for (; i < queue.length; i++) {
                  var callback = queue[i];
                  do {
                    callback = callback(true);
                  } while (callback !== null);
                }
                queue.length = 0;
              } catch (error2) {
                queue = queue.slice(i + 1);
                throw error2;
              } finally {
                isFlushing = false;
              }
            }
          }
        }
        var createElement$1 = createElementWithValidation;
        var cloneElement$1 = cloneElementWithValidation;
        var createFactory = createFactoryWithValidation;
        var Children = {
          map: mapChildren,
          forEach: forEachChildren,
          count: countChildren,
          toArray,
          only: onlyChild
        };
        exports.Children = Children;
        exports.Component = Component;
        exports.Fragment = REACT_FRAGMENT_TYPE;
        exports.Profiler = REACT_PROFILER_TYPE;
        exports.PureComponent = PureComponent;
        exports.StrictMode = REACT_STRICT_MODE_TYPE;
        exports.Suspense = REACT_SUSPENSE_TYPE;
        exports.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = ReactSharedInternals;
        exports.act = act;
        exports.cloneElement = cloneElement$1;
        exports.createContext = createContext;
        exports.createElement = createElement$1;
        exports.createFactory = createFactory;
        exports.createRef = createRef;
        exports.forwardRef = forwardRef;
        exports.isValidElement = isValidElement;
        exports.lazy = lazy;
        exports.memo = memo;
        exports.startTransition = startTransition;
        exports.unstable_act = act;
        exports.useCallback = useCallback;
        exports.useContext = useContext;
        exports.useDebugValue = useDebugValue;
        exports.useDeferredValue = useDeferredValue;
        exports.useEffect = useEffect;
        exports.useId = useId;
        exports.useImperativeHandle = useImperativeHandle;
        exports.useInsertionEffect = useInsertionEffect;
        exports.useLayoutEffect = useLayoutEffect;
        exports.useMemo = useMemo;
        exports.useReducer = useReducer;
        exports.useRef = useRef;
        exports.useState = useState;
        exports.useSyncExternalStore = useSyncExternalStore2;
        exports.useTransition = useTransition;
        exports.version = ReactVersion;
        if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop === "function") {
          __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(new Error());
        }
      })();
    }
  }
});

// node_modules/react/index.js
var require_react = __commonJS({
  "node_modules/react/index.js"(exports, module) {
    "use strict";
    if (process.env.NODE_ENV === "production") {
      module.exports = require_react_production_min();
    } else {
      module.exports = require_react_development();
    }
  }
});

// tools/_audit.ts
import { readFileSync } from "node:fs";

// src/core/types.ts
var MODE_LABEL = {
  trend: "Trend",
  series: "Series",
  moodboard: "Moodboard"
};
var CAT_LABEL = { shoe: "Footwear" };
var TIER_LABEL = {
  core: "Core",
  push: "Push",
  signature: "Signature"
};
var TAXONOMY = {
  shoe: [
    {
      id: "sneaker",
      label: "Sneakers",
      note: "Running, court, lifestyle",
      types: [
        { id: "running", label: "Road daily trainer", en: "road running daily trainer with engineered mesh upper, cushioned rocker midsole and segmented rubber outsole" },
        { id: "max_cushion", label: "Max cushion", en: "max-cushion running shoe with a tall soft midsole stack, wide platform and moderate rocker" },
        { id: "tempo_racer", label: "Tempo / racing", en: "lightweight tempo racing shoe with a low-slung aggressive rocker midsole and thin engineered mesh upper" },
        { id: "trail", label: "Trail", en: "trail running shoe with aggressive lugged outsole, toe bumper and reinforced upper" },
        { id: "court_sneaker", label: "Court", en: "low-top court sneaker with leather upper and cupsole" },
        { id: "lifestyle_runner", label: "Lifestyle runner", en: "retro lifestyle runner with layered suede and nylon mesh upper and EVA wedge midsole" },
        { id: "chunky_sneaker", label: "Chunky", en: "chunky dad sneaker with layered exaggerated midsole" }
      ]
    },
    {
      id: "dress",
      label: "Dress",
      note: "Loafer, derby, oxford",
      types: [
        { id: "loafer", label: "Penny loafer", en: "penny loafer with raised apron seam and saddle strap" },
        { id: "horsebit_loafer", label: "Horsebit loafer", en: "horsebit loafer with metal snaffle hardware across the vamp" },
        { id: "chunky_loafer", label: "Chunky loafer", en: "chunky loafer with a lugged platform sole and high rounded volume" },
        { id: "derby", label: "Derby", en: "derby shoe with open lacing" },
        { id: "oxford", label: "Oxford", en: "oxford shoe with closed lacing" },
        { id: "monk", label: "Monk strap", en: "monk strap shoe with metal buckle" }
      ]
    },
    {
      id: "heel",
      label: "Heels",
      note: "Pump, slingback",
      types: [
        { id: "pump", label: "Pump", en: "pump" },
        { id: "slingback", label: "Slingback", en: "slingback with heel strap" },
        { id: "mary_jane", label: "Mary jane", en: "mary jane shoe with instep strap" },
        { id: "mule", label: "Mule", en: "backless mule" }
      ]
    },
    {
      id: "flat",
      label: "Flats",
      note: "Ballet, driving",
      types: [
        { id: "ballet_flat", label: "Ballet flat", en: "ballet flat" },
        { id: "driving", label: "Driving", en: "driving moccasin with pebbled rubber pod sole" },
        { id: "espadrille", label: "Espadrille", en: "espadrille flat with jute-wrapped sole" }
      ]
    },
    {
      id: "boot",
      label: "Boots",
      note: "Ankle, chelsea, hiking",
      types: [
        { id: "ankle_boot", label: "Ankle boot", en: "ankle boot" },
        { id: "chelsea", label: "Chelsea", en: "chelsea boot with elastic side gore" },
        { id: "combat", label: "Combat", en: "lace-up combat boot with lugged sole" },
        { id: "long_boot", label: "Knee-high", en: "knee-high long boot" },
        { id: "hiking", label: "Hiking", en: "hiking boot with deep lugged outsole, protective toe cap and padded collar" }
      ]
    },
    {
      id: "sandal",
      label: "Sandals",
      note: "Slide, sport, strappy",
      types: [
        { id: "strap_sandal", label: "Strappy", en: "strappy sandal" },
        { id: "slide", label: "Slide", en: "single-band slide sandal" },
        { id: "sport_sandal", label: "Sport", en: "sport sandal with moulded footbed and adjustable webbing straps" },
        { id: "gladiator", label: "Gladiator", en: "gladiator sandal with multiple ankle straps" }
      ]
    }
  ]
};
var ALL_TYPES = Object.values(TAXONOMY).flatMap((gs) => gs.flatMap((g) => g.types));
var TYPE_LABEL = Object.fromEntries(ALL_TYPES.map((t) => [t.id, t.label]));
var TYPE_EN = Object.fromEntries(ALL_TYPES.map((t) => [t.id, t.en]));
var UNKNOWN = "unknown";
function defaultLineProfile() {
  return {
    product: { useCase: "daily", environment: "urban", targetConsumer: "unisex", season: "FW26", climate: "all_season" },
    lastFit: { lastFamily: UNKNOWN, baseSize: UNKNOWN, width: UNKNOWN, toeShape: UNKNOWN, toeVolume: UNKNOWN, heelHold: UNKNOWN, existingLastReuse: true },
    upper: { outer: UNKNOWN, lining: UNKNOWN, reinforcement: UNKNOWN, closure: UNKNOWN, protection: UNKNOWN },
    bottom: { midsole: UNKNOWN, plate: UNKNOWN, outsole: UNKNOWN, stackBand: UNKNOWN, dropMm: UNKNOWN, rocker: UNKNOWN, heel: UNKNOWN, existingBottomReuse: true },
    construction: { lasting: UNKNOWN, soleAttachment: UNKNOWN },
    performance: { weightTargetG: UNKNOWN, cushioning: UNKNOWN, stability: UNKNOWN, wetGrip: UNKNOWN, flexibility: UNKNOWN },
    commercial: { markets: ["KR"], channels: ["DTC"] }
  };
}
function asFootwearLine(lp) {
  const l = lp;
  if (!l || !l.product || !l.lastFit || !l.upper || !l.bottom || !l.construction) return void 0;
  return l;
}
function lineFingerprint(raw, itemType) {
  const lp = asFootwearLine(raw);
  if (!lp) return TYPE_LABEL[itemType] ?? itemType;
  const bits = [
    TYPE_LABEL[itemType] ?? itemType,
    lp.product.useCase !== UNKNOWN ? lp.product.useCase : "",
    lp.product.targetConsumer,
    lp.lastFit.lastFamily !== UNKNOWN ? lp.lastFit.lastFamily : "",
    lp.upper.outer !== UNKNOWN ? `${lp.upper.outer} upper` : "",
    lp.bottom.outsole !== UNKNOWN ? lp.bottom.outsole : "",
    lp.construction.soleAttachment !== UNKNOWN ? lp.construction.soleAttachment : "",
    lp.product.season
  ].filter(Boolean);
  return bits.join(" \xB7 ");
}
var COMP_GROUP_LABEL = {
  direct: "Direct competitor",
  commercial_leader: "Commercial leader",
  technical_authority: "Technical authority",
  heritage_authority: "Heritage authority",
  directional_designer: "Directional designer",
  aspirational: "Aspirational reference",
  adjacent: "Adjacent reference"
};
var MODE_SCOPE = {
  trend: { competitor: true, trend: true, upload: false, note: "Researches competitor lines and market trends" },
  series: { competitor: false, trend: true, upload: true, note: "Reads your series, then checks trends only" },
  moodboard: { competitor: false, trend: false, upload: true, note: "Uses only the files you upload" }
};
var DEFAULT_PARAMS = {
  mode: "trend",
  category: "shoe",
  itemType: "loafer",
  line: defaultLineProfile(),
  endStage: "S3",
  sketchCount: 12,
  tierRatio: [1, 1, 1],
  renderRatio: 0.5,
  viewCount: 3,
  colorwayCount: 2,
  topN: 3,
  designsPerSketch: 2,
  variationCount: 3,
  campaignShots: 4,
  make3d: true,
  approvalGate: true,
  imageEngine: "detail",
  imageBudget: 12,
  trend: {
    // 기본을 비워둔다. 가상의 브랜드명으로 검색하면 결과가 무의미하고 시간만 든다.
    competitors: [],
    priceBand: "contemporary",
    priceMinKrw: 15e4,
    priceMaxKrw: 45e4,
    adjacentBand: true,
    objectives: ["live_commercial_pulse", "design_trends", "next_season_forecast"]
  },
  series: {
    seriesName: "",
    archiveFiles: [],
    valueStatement: "",
    trendSearch: true
  },
  moodboard: { files: [], notes: "" }
};

// src/core/pitch.ts
function buildLocalPitch(st) {
  const p = st.params;
  const alive = st.designs.filter((d) => !d.rejected);
  const top = st.designs.filter((d) => d.isTop);
  const rejected = st.designs.filter((d) => d.rejected);
  const agenda = [
    { no: 1, title: "Where this started", note: `${MODE_LABEL[p.mode]} mode \xB7 inputs and how far we looked` },
    { no: 2, title: "What we actually saw", note: `${st.signals.length} signals, all sourced` },
    { no: 3, title: "How we narrowed it", note: `${st.directions.length} directions` },
    { no: 4, title: "What we made", note: `${alive.length} of ${st.designs.length} specs passed the rules` },
    { no: 5, title: "What we are putting up", note: top.length ? `Top ${top.length}` : "not selected yet" },
    { no: 6, title: "What you need to decide", note: "approve or reject, and why" }
  ];
  const designPitches = alive.map((d) => buildDesignPitch(d, st));
  const closing = [
    top.length ? `What you decide today is whether the Top ${top.length} go through, and if not, which axis is the problem.` : "What you decide today is which ones move on to render.",
    rejected.length ? `The ${rejected.length} the rules caught never got an image. They break manufacturing constraints, so they are not up for discussion.` : "Nothing was rejected on rules this round.",
    "Costs are rough. The assumptions and exclusions sit on each card."
  ];
  return {
    title: `${CAT_LABEL[p.category]} ${TYPE_LABEL[p.itemType] ?? p.itemType} review`,
    subtitle: `${MODE_LABEL[p.mode]} mode \xB7 ${st.designs.length} specs \xB7 ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`,
    agenda,
    designPitches,
    closing
  };
}
function buildDesignPitch(d, st) {
  const f = d.spec.fields;
  const traced = d.spec.hintApplied !== void 0;
  const sigs = d.rationale.driving_signals.filter((ds) => !traced || ds.weight > 0).map((ds) => st.signals.find((s) => s.signal_id === ds.signal_id)).filter(Boolean);
  const why = [];
  if (traced && d.rationale.narrative.length) why.push(d.rationale.narrative[0]);
  sigs.forEach((s) => {
    if (!s) return;
    why.push(`${s.label} showed up ${s.observed_count} times. It is a shift on the ${s.axis} axis, and confidence is ${s.confidence}.`);
  });
  if (d.rationale.type_placement_reason) why.push(d.rationale.type_placement_reason + ".");
  const feasibility = [];
  const mold = d.cost.tooling.mold_count_required;
  feasibility.push(mold === 0 ? "No new moulds. This runs on existing tooling." : `${mold} new moulds are needed. Each size takes its own mould, so amortisation has to be read alongside this.`);
  const cap = Math.round((d.cost.cap_ratio - 1) * 100);
  feasibility.push(cap <= 0 ? `Cost sits ${Math.abs(cap)}% below the cap.` : `Cost runs ${cap}% over the cap.`);
  const warns = d.ruleResults.filter((r) => r.severity === "warn");
  if (warns.length) feasibility.push(`${warns.length} warnings: ${warns.map((w) => w.message).join(" / ")}`);
  const objections = [];
  const weakest = sigs.filter(Boolean).sort((a, b) => a.observed_count - b.observed_count)[0];
  if (weakest && weakest.observed_count <= 3) {
    objections.push({
      q: `Is the ${weakest.label} evidence thin?`,
      a: `Seen ${weakest.observed_count} times, so the sample is small. We are not claiming more than that, and this axis only drives Push and above.`
    });
  }
  if (cap > 0) {
    objections.push({
      q: "Cost is over the cap. Can this still go?",
      a: `${cap}% over. ${d.spec.tier === "core" ? "Core has no room for that, so the spec needs trimming." : `${TIER_LABEL[d.spec.tier]} runs a wider cap and can absorb it.`}`
    });
  }
  if (d.viewMismatch) {
    objections.push({
      q: "The detail changes between views.",
      a: "That gap survived a regeneration. We left it visible rather than hiding it, and the side view is the reference cut."
    });
  }
  if (mold > 0) {
    objections.push({
      q: "Does the tooling pay back?",
      a: `At ${d.cost.tooling.amortization_volume.toLocaleString()} units that is KRW ${d.cost.tooling.tooling_per_unit_krw.toLocaleString()} each. Change the volume assumption and this number moves first.`
    });
  }
  const specBits = `${f.toe_shape} toe \xB7 ${f.heel_height_mm}mm ${f.heel_type === "sport_midsole" ? "stack" : "heel"} \xB7 ${f.panel_count} panels`;
  return {
    design_id: d.spec.design_id,
    headline: `${d.spec.design_id} \xB7 ${TIER_LABEL[d.spec.tier]} \xB7 ${specBits}`,
    why,
    feasibility,
    objections
  };
}

// src/core/i18n.ts
var import_react = __toESM(require_react(), 1);
var KEY = "vringon.lang";
function initial() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "ko" || saved === "en" || saved === "ja") return saved;
    const nav = navigator.language?.toLowerCase() ?? "";
    if (nav.startsWith("ko")) return "ko";
    if (nav.startsWith("ja")) return "ja";
    return "en";
  } catch {
    return "en";
  }
}
var lang = initial();

// src/core/research.ts
var shotUrl = (u, page) => {
  if (u && !/^https?:\/\//.test(u)) return u;
  const q = [];
  if (u) q.push(`u=${encodeURIComponent(u)}`);
  if (page) q.push(`p=${encodeURIComponent(page)}`);
  return `/api/shot?${q.join("&")}`;
};
var GRADE_LABEL = {
  edgy: "Edgy",
  early_sign: "Early sign",
  safe: "Safe",
  big: "Big trend",
  stable: "Stable",
  last_call: "Last call"
};
var MAG_LABEL = {
  surging: "Surging",
  rising: "Rising",
  steady: "Steady",
  softening: "Softening"
};
function metricText(m) {
  if (m.yoy_percent != null) return `${m.yoy_percent > 0 ? "+" : ""}${m.yoy_percent}%`;
  return MAG_LABEL[m.magnitude] ?? "\u2014";
}

// src/core/boardModel.ts
function buildBoardModel(st) {
  const p = st.params;
  const scope = MODE_SCOPE[p.mode];
  const nodes = [];
  const edges = [];
  const columns = [
    { key: "input", title: "1 \xB7 Input", note: "What you gave it" },
    { key: "research", title: "2 \xB7 Research", note: scope.competitor ? "What the agent collected" : scope.trend ? "Trend research" : "Your uploads, read" },
    { key: "signal", title: "3 \xB7 Signals", note: "Observations with a source" },
    { key: "direction", title: "4 \xB7 Directions", note: "Signals combined" },
    { key: "sketchlane", title: "5 \xB7 Sketches", note: "One form, black ink only" },
    { key: "design", title: "6 \xB7 Designs", note: "Colour enters here" },
    { key: "selection", title: "7 \xB7 Selection", note: "Metrics and calls" },
    { key: "variation", title: "8 \xB7 Variations", note: "One design, several products" },
    { key: "campaign", title: "9 \xB7 Campaign shots", note: "Worn on a model, staged on set" },
    { key: "showroom", title: "10 \xB7 3D showroom", note: "Turn it, or open it full size" }
  ];
  const inputBody = [];
  inputBody.push(`Line: ${lineFingerprint(p.line, p.itemType)}`);
  if (p.mode === "trend") {
    inputBody.push(`${p.trend.competitors.length} competitor lines: ${p.trend.competitors.join(", ")}`);
    inputBody.push(`Primary band KRW ${(p.trend.priceMinKrw / 1e4).toFixed(0)}0k-${(p.trend.priceMaxKrw / 1e4).toFixed(0)}0k \xB7 ${p.trend.priceBand}${p.trend.adjacentBand ? " \xB7 adjacent band as reference" : ""}`);
  } else if (p.mode === "series") {
    inputBody.push(`Series "${p.series.seriesName || "untitled"}" \xB7 ${p.series.archiveFiles.length} designs`);
    if (p.series.valueStatement) inputBody.push(`Value: ${p.series.valueStatement.slice(0, 90)}`);
    inputBody.push(p.series.trendSearch ? "Trend research on, no competitor research" : "No outside research");
  } else {
    inputBody.push(`${p.moodboard.files.length} uploads: ${p.moodboard.files.join(", ") || "none"}`);
    inputBody.push("Nothing outside these files");
  }
  nodes.push({
    id: "in",
    kind: "input",
    column: 0,
    row: 0,
    title: `${MODE_LABEL[p.mode]} mode input`,
    body: inputBody,
    tone: "accent"
  });
  let researchIds = [];
  if (p.mode === "trend") {
    const inBand = st.competitors.filter((c) => c.in_band);
    const out = st.competitors.filter((c) => !c.in_band);
    const noProxy = st.competitors.filter((c) => c.observation_count < 2);
    nodes.push({
      id: "r-comp",
      kind: "research",
      column: 1,
      row: 0,
      title: "What the market is selling",
      body: [
        `${st.competitors.length} products \xB7 ${inBand.length} in band${out.length ? ` \xB7 ${out.length} reference` : ""}`,
        noProxy.length ? "Single pass, so no sales ranking is inferred" : ""
      ].filter(Boolean),
      tone: "accent"
    });
    researchIds = ["r-comp", "r-trend"];
    edges.push({ from: "in", to: "r-comp", label: "competitor lines" });
    const withShots = st.competitors.filter((c) => c.image_urls?.length || c.product_url);
    const shotPick = [...withShots.filter((c) => c.retailer), ...withShots.filter((c) => !c.retailer)].slice(0, 14);
    shotPick.forEach((c, k) => {
      const id = `comp-shot-${k}`;
      nodes.push({
        id,
        kind: "research",
        column: 1,
        row: 1 + k,
        title: `${c.brand} ${c.name}`,
        // 가격과 어디서 팔리는지 한 줄. 나머지는 사진이 말한다.
        body: [[
          c.price_krw > 0 ? `KRW ${(c.price_krw / 1e4).toFixed(0)}0k` : "",
          c.retailer ? `${c.retailer} bestseller` : c.competitor_group ? COMP_GROUP_LABEL[c.competitor_group] : "",
          c.size_status === "size_broken" ? "size broken" : ""
        ].filter(Boolean).join(" \xB7 ")].filter(Boolean),
        imageUrl: shotUrl(c.image_urls?.[0] ?? "", c.product_url),
        tone: c.retailer ? "accent" : "neutral"
      });
      edges.push({ from: "r-comp", to: id, dashed: true });
    });
    nodes.push({
      id: "r-trend",
      kind: "research",
      column: 1,
      row: 1 + shotPick.length,
      title: "Trend research",
      body: [`${st.signals.length} signals, each with a source`]
    });
    edges.push({ from: "in", to: "r-trend", label: "line profile" });
  } else if (p.mode === "series") {
    nodes.push({
      id: "r-dna",
      kind: "research",
      column: 1,
      row: 0,
      title: "Series DNA",
      body: [
        `${st.seriesDna?.invariant.length ?? 0} fixed \xB7 ${st.seriesDna?.variable.length ?? 0} variable \xB7 ${st.seriesDna?.ambiguous.length ?? 0} unclear`,
        ...st.seriesDna?.invariant.slice(0, 2).map((i) => `Fixed: ${i.label} (${i.observed_in}/${i.of})`) ?? []
      ],
      tone: "accent"
    });
    nodes.push({
      id: "r-check",
      kind: "research",
      column: 1,
      row: 1,
      title: "Stated vs observed",
      body: st.dnaConflict ? [
        `You wrote ${st.dnaConflict.brandClaim}`,
        `We see ${st.dnaConflict.observed}`,
        st.dnaConflict.resolved ? `Going with: ${st.dnaConflict.resolved}` : "Not resolved yet"
      ] : ["No conflict"],
      tone: "warn"
    });
    researchIds = ["r-dna", "r-check"];
    edges.push({ from: "in", to: "r-dna", label: "uploaded designs" });
    edges.push({ from: "in", to: "r-check", label: "value statement" });
    edges.push({ from: "r-dna", to: "r-check", label: "observed elements" });
    if (p.series.trendSearch) {
      nodes.push({ id: "r-trend", kind: "research", column: 1, row: 2, title: "Trend research", body: ["The only outside research in Series mode", "No competitor research"] });
      researchIds.push("r-trend");
    }
  } else {
    nodes.push({
      id: "r-pdf",
      kind: "research",
      column: 1,
      row: 0,
      title: "Uploads, read",
      body: ["Sections, images, captions and colour chips", "Tagged untrusted so any instruction inside stays data"],
      tone: "accent"
    });
    nodes.push({
      id: "r-bias",
      kind: "research",
      column: 1,
      row: 1,
      title: "Source perspective",
      body: st.reportBias ? [st.reportBias.perspective, ...st.reportBias.notes.slice(0, 2)] : [],
      tone: "warn"
    });
    researchIds = ["r-pdf", "r-bias"];
    edges.push({ from: "in", to: "r-pdf", label: "PDF" });
    edges.push({ from: "r-pdf", to: "r-bias", label: "citation spread" });
  }
  const compShotRows = nodes.filter((n) => n.id.startsWith("comp-shot-")).length;
  const dosRow = 2 + compShotRows;
  const dossier = st.dossier;
  if (dossier?.macrotrends?.length) {
    const pct = metricText;
    nodes.push({
      id: "dos",
      kind: "research",
      column: 1,
      row: dosRow,
      title: `${dossier.season} \xB7 ${dossier.season_title}`,
      body: [dossier.powershift ? dossier.powershift : `${dossier.macrotrends.length} directions`],
      tone: "accent"
    });
    edges.push({ from: "in", to: "dos", label: "season brief" });
    dossier.macrotrends.forEach((m, i) => {
      const id = `macro-${i}`;
      nodes.push({
        id,
        kind: "research",
        column: 1,
        row: dosRow + 1 + i * 10,
        title: `${m.name} \xB7 ${GRADE_LABEL[m.grade] ?? m.grade}`,
        body: [
          m.statement,
          (m.key_items ?? []).slice(0, 3).map((k) => k.name).join(" \xB7 ")
        ].filter(Boolean),
        palette: (m.palette ?? []).slice(0, 8).map((c) => ({ name: c.name, hex: c.hex }))
      });
      edges.push({ from: "dos", to: id, label: "macrotrend" });
      const withShot = (m.key_items ?? []).filter((k) => k.image_url || k.metric?.source_url).slice(0, 3);
      withShot.forEach((k, j) => {
        const kid = `macro-${i}-item-${j}`;
        nodes.push({
          // 반 칸(1.5)에 두면 x 범위가 조사 열과 139px 겹친다. 같은 열에 두고 아래로 쌓는다.
          id: kid,
          kind: "research",
          column: 1,
          row: dosRow + 1 + i * 10 + j + 1,
          title: k.name,
          body: [
            [metricText(k.metric), GRADE_LABEL[k.grade] ?? k.grade].filter(Boolean).join(" \xB7 "),
            k.silhouette_spec
          ].filter(Boolean),
          imageUrl: shotUrl(k.image_url ?? "", k.metric?.source_url),
          tone: "muted"
        });
        edges.push({ from: id, to: kid, label: "evidence", dashed: true });
      });
    });
  }
  const signalIds = new Set(st.signals.map((s) => s.signal_id));
  st.signals.forEach((s, i) => {
    nodes.push({
      id: `sg-${s.signal_id}`,
      kind: "signal",
      column: 2,
      row: i,
      title: s.label,
      body: [
        `${s.axis} \xB7 seen ${s.observed_count}x \xB7 ${s.direction === "rising" ? "rising" : s.direction === "stable" ? "holding" : "fading"}`,
        s.sales_proxy_score != null ? `proxy ${s.sales_proxy_score} (${s.proxy_confidence})` : s.page_ref ? `source ${s.page_ref}` : `${s.sources.length} sources`
      ],
      tone: s.confidence === "low" ? "muted" : "neutral"
    });
    const src = p.mode === "trend" ? "r-trend" : p.mode === "series" ? researchIds.includes("r-trend") ? "r-trend" : "r-dna" : "r-pdf";
    edges.push({ from: src, to: `sg-${s.signal_id}`, dashed: s.confidence === "low" });
  });
  st.directions.forEach((d, i) => {
    nodes.push({
      id: `dir-${d.id}`,
      kind: "direction",
      column: 3,
      row: i,
      title: d.title,
      body: [d.summary],
      tone: "accent"
    });
    d.signal_ids.filter((sid) => signalIds.has(sid)).forEach((sid) => edges.push({ from: `sg-${sid}`, to: `dir-${d.id}` }));
  });
  if (p.mode === "series" && st.seriesDna) {
    st.directions.forEach((d) => edges.push({ from: "r-dna", to: `dir-${d.id}`, label: "DNA lock", dashed: true }));
  }
  const alive = st.designs.filter((d) => !d.rejected);
  const rejected = st.designs.filter((d) => d.rejected);
  const deck = buildLocalPitch(st);
  const pitchOf = (id) => deck.designPitches.find((x) => x.design_id === id);
  let skRow = 0;
  alive.forEach((d) => {
    const sketches = d.images.filter((im) => im.view === "sketch" || im.view === "sketch_var");
    sketches.forEach((im, k) => {
      const id = `sk-${d.spec.design_id}-${k}`;
      const pit = pitchOf(d.spec.design_id);
      const why = k === 0 ? [
        d.spec.comboLabel ? `Reads the research as: ${d.spec.comboLabel}` : "",
        ...(pit?.why ?? []).slice(0, 2),
        d.rationale?.narrative?.[0] ?? ""
      ].filter(Boolean) : ["Same silhouette and outsole as the base form. Only the upper is read differently."];
      nodes.push({
        id,
        kind: "design",
        column: 4,
        row: skRow++,
        title: `${d.spec.design_id} \xB7 ${k === 0 ? "Base form" : `Ink variation ${k}`}`,
        body: why,
        imageUrl: im.url,
        prompts: im.promptUsed ? [`Sketch prompt: ${im.promptUsed.slice(0, 180)}${im.promptUsed.length > 180 ? "\u2026" : ""}`] : void 0,
        tone: "muted"
      });
      const dir = st.directions.find((x) => d.rationale.driving_signals.some((ds) => x.signal_ids.includes(ds.signal_id)));
      if (k === 0 && dir) edges.push({ from: `dir-${dir.id}`, to: id, label: "form" });
      if (k > 0) edges.push({ from: `sk-${d.spec.design_id}-0`, to: id, label: "ink variation", dashed: true });
      const rendered = d.images.some((x) => x.view !== "sketch" && x.view !== "sketch_var");
      edges.push({ from: id, to: d.spec.design_id, label: k === 0 ? rendered ? "coloured" : "spec only" : void 0, dashed: k === 0 && !rendered });
    });
  });
  alive.forEach((d, i) => {
    const hero = d.images.find((im) => !["sketch", "sketch_var"].includes(im.view));
    const pit = pitchOf(d.spec.design_id);
    if (pit) {
      const basePrompt = d.images.find((im) => im.origin === "generated" && im.view !== "sketch")?.promptUsed;
      const variantPrompt = d.images.find((im) => im.view === "design")?.promptUsed;
      const cut = (s) => s ? s.length > 150 ? s.slice(0, 150) + "\u2026" : s : null;
      const setBy = (d.spec.hintApplied ?? []).filter((k) => k in d.spec.fields).map((k) => `${k.replace(/_/g, " ")} ${d.spec.fields[k]}`);
      const refused = (d.spec.hintBlocked ?? []).slice(0, 2).map((b) => `${b.field.replace(/_/g, " ")} ${b.wanted}, held at ${b.got}`);
      const capPct = Math.round((d.cost.cap_ratio - 1) * 100);
      nodes.push({
        id: `pitch-${d.spec.design_id}`,
        kind: "selection",
        column: 5.5,
        row: i,
        // 스케치가 왜 나왔는지는 스케치 레인이 말한다. 여기는 그 스케치를 어떻게 디자인으로 옮겼는가다.
        title: "From sketch to design: what was asked, and why",
        body: [
          d.spec.comboLabel ? `This design was asked to lead with one idea: ${d.spec.comboLabel.replace(/^Only /, "")}. That is why the prompt below names it first.` : "The prompt below carries the spec straight from the sketch.",
          ...setBy.length ? [`The research fixed ${setBy.length} value${setBy.length > 1 ? "s" : ""} in that prompt: ${setBy.join(", ")}.`] : [],
          ...refused.length ? [`It also asked for ${refused.join(" and ")}. A ${TYPE_LABEL[d.spec.itemType] ?? d.spec.itemType} cannot take that, so it is absent from the prompt.`] : [],
          `Tooling: ${d.cost.tooling.mold_count_required === 0 ? "no new moulds" : `${d.cost.tooling.mold_count_required} new moulds`}. Cost sits ${capPct === 0 ? "level with" : capPct > 0 ? `${capPct}% over` : `${Math.abs(capPct)}% under`} the cap.`,
          ...d.mdReview ? [`MD: ${d.mdReview.verdict === "buy" ? "would buy" : d.mdReview.verdict === "buy_if_fixed" ? "would buy if fixed" : "passes"} \u2014 ${d.mdReview.why}`] : [],
          ...d.mdReview?.concern ? [`MD concern: ${d.mdReview.concern}`] : [],
          ...d.mdReview?.fix ? [`MD would need: ${d.mdReview.fix}`] : []
        ],
        prompts: [
          cut(basePrompt) ? `Sketch to design: ${cut(basePrompt)}` : null,
          cut(variantPrompt) ? `Second design from the same sketch: ${cut(variantPrompt)}` : null
        ].filter((x) => !!x),
        tone: "muted",
        isPitch: true
      });
      edges.push({ from: d.spec.design_id, to: `pitch-${d.spec.design_id}`, label: "reasoning", dashed: true });
    }
    nodes.push({
      id: d.spec.design_id,
      kind: "design",
      column: 5,
      row: i,
      title: `${d.spec.design_id} \xB7 ${TIER_LABEL[d.spec.tier]}`,
      body: [
        ...d.metrics.map((m) => `${m.label} ${m.value}`),
        // 렌더가 없으면 그 사실을 카드가 말한다. 스케치를 대신 걸어 두지 않는다.
        ...hero ? [] : ["Not rendered in this run: the image cap was reached before this one. The spec and reasoning below still hold."],
        // 게놈 없이 나온 안은 조합 폴백이다. 저작자가 다르면 카드도 그렇게 말해야 한다.
        ...d.spec.genome ? [] : ["Spec built from signal combinations, not authored as a concept."],
        // 게이트를 못 넘고도 채택된 안은 어디가 겹치는지 말한다.
        ...d.spec.genome?.gate_overlap?.length ? [`Shares ${d.spec.genome.gate_overlap.join(", ")} with an earlier design \u2014 kept for its concept, not its silhouette.`] : []
      ],
      design: d,
      imageUrl: hero?.url
    });
    const traced = d.spec.hintApplied !== void 0;
    d.rationale.driving_signals.filter((ds) => (!traced || ds.weight > 0) && (signalIds.has(ds.signal_id) || st.directions.some((x) => x.signal_ids.includes(ds.signal_id)))).forEach((ds) => {
      const dir = st.directions.find((x) => x.signal_ids.includes(ds.signal_id));
      edges.push({
        from: dir ? `dir-${dir.id}` : `sg-${ds.signal_id}`,
        to: d.spec.design_id,
        label: traced ? `${Math.round(ds.weight * 100)}% of the spec` : `${Math.round(ds.weight * 100)}%`,
        weight: ds.weight
      });
    });
  });
  if (rejected.length) {
    nodes.push({
      id: "rejected",
      kind: "design",
      column: 5,
      row: alive.length,
      title: `${rejected.length} rejected on rules`,
      body: rejected.slice(0, 4).map((d) => `${d.spec.design_id} \xB7 ${d.ruleResults.filter((r) => r.severity === "fail").map((r) => r.rule).join(", ")}`),
      tone: "muted"
    });
  }
  const top = st.designs.filter((d) => d.isTop);
  if (top.length) {
    nodes.push({
      id: "top",
      kind: "selection",
      column: 6,
      row: 0,
      title: `Top ${top.length}`,
      body: [
        ...top.map((d) => `${d.spec.design_id} \xB7 ${TIER_LABEL[d.spec.tier]} \xB7 distance ${d.topDistance ?? "n/a"}`),
        "At least one per tier, with a distance threshold so they do not converge"
      ],
      tone: "accent"
    });
    top.forEach((d) => edges.push({ from: d.spec.design_id, to: "top", label: "selected" }));
    let campaignRow = 0;
    let showroomRow = 0;
    top.forEach((d) => {
      const worn = d.images.filter((im) => im.view === "wear");
      const concepts = d.images.filter((im) => im.view === "concept");
      const frames = [
        ...worn.map((im) => ({ im, label: "Worn", note: "Simulated wear" })),
        ...concepts.map((im) => ({ im, label: im.conceptLabel ?? "Concept", note: im.persona ?? "" }))
      ];
      if (d.model) {
        const id = `model-${d.spec.design_id}`;
        nodes.push({
          id,
          kind: "selection",
          column: 9,
          row: showroomRow++,
          title: `${d.spec.design_id} \xB7 3D`,
          body: ["Drag to turn"],
          modelUrl: d.model.url,
          imageUrl: (d.images.find((i) => i.view === "lateral" && !i.colorway) ?? d.images[0])?.url
        });
        edges.push({ from: "top", to: id, label: "3D" });
      }
      frames.forEach((fr, k) => {
        const id = `shot-${d.spec.design_id}-${k}`;
        nodes.push({
          id,
          kind: "selection",
          column: 8,
          row: campaignRow++,
          title: `${d.spec.design_id} \xB7 ${fr.label}`,
          body: fr.note ? [fr.note] : [],
          imageUrl: fr.im.url
        });
        edges.push({ from: "top", to: id, label: k === 0 ? "campaign" : void 0 });
      });
    });
  }
  let varRow = 0;
  st.designs.filter((d) => !d.rejected).forEach((d) => {
    const vars = d.images.filter((im) => im.view === "variation");
    vars.forEach((im, k) => {
      const id = `var-${d.spec.design_id}-${k}`;
      const sl = im.sliders ? Object.entries(im.sliders).filter(([, v]) => Math.abs(v) > 0.2).map(([key, v]) => `${key.split("_").slice(1).join(" ")} ${v > 0 ? "+" : ""}${v.toFixed(2)}`) : [];
      nodes.push({
        id,
        kind: "design",
        column: 7,
        row: varRow++,
        title: `${d.spec.design_id} \xB7 ${(im.variantAxis ?? "Variation").split(" \xB7 ")[0]}`,
        body: [
          im.variantAxis?.split(" \xB7 ")[1] ?? "One axis changed",
          sl.length ? `Sliders: ${sl.join(", ")}` : "",
          "Structure and palette held; only this axis moved."
        ].filter(Boolean),
        imageUrl: im.url
      });
      edges.push({ from: d.spec.design_id, to: id, label: (im.variantAxis ?? "variation").split(" \xB7 ")[0] });
    });
  });
  const approved = st.designs.filter((d) => d.verdict === "approve");
  const rejectedByUser = st.designs.filter((d) => d.verdict === "reject");
  if (approved.length || rejectedByUser.length) {
    const tagCount = {};
    rejectedByUser.forEach((d) => d.verdictTags?.forEach((t) => {
      tagCount[t] = (tagCount[t] ?? 0) + 1;
    }));
    nodes.push({
      id: "verdict",
      kind: "selection",
      column: 6,
      row: 1,
      title: "Review calls",
      body: [
        `${approved.length} approved \xB7 ${rejectedByUser.length} rejected`,
        ...Object.keys(tagCount).length ? [`Reasons: ${Object.entries(tagCount).map(([k, v]) => `${k} ${v}`).join(", ")}`] : [],
        "Calls and reasons feed the reference bank for the next run"
      ]
    });
    approved.forEach((d) => edges.push({ from: d.spec.design_id, to: "verdict", label: "approved" }));
    rejectedByUser.forEach((d) => edges.push({ from: d.spec.design_id, to: "verdict", label: "rejected", dashed: true }));
  }
  nodes.push({
    id: "appendix",
    kind: "appendix",
    column: 6,
    row: 2,
    title: "Appendix \xB7 assumptions and limits",
    body: [
      "Costs are rough. The band, the assumptions and what is excluded sit on each card.",
      "Worn shots are simulated. The real fit may differ.",
      "Competitor references were read for attributes only and never fed into generation.",
      "Generated elements may not be copyrightable depending on jurisdiction."
    ],
    tone: "muted"
  });
  return { columns, nodes, edges };
}

// tools/_audit.ts
var files = ["sample_trend_chelsea", "sample_series_aj1", "sample_moodboard_micam"];
for (const f of files) {
  const st = JSON.parse(readFileSync(`src/samples/${f}.json`, "utf8"));
  const m = buildBoardModel(st);
  const issues = [];
  const sketchHashes = new Set(st.designs.flatMap((d) => d.images.filter((i) => ["sketch", "sketch_var"].includes(i.view)).map((i) => i.hash)));
  for (const n of m.nodes.filter((n2) => n2.kind === "design" && n2.column === 5 && n2.imageUrl)) {
    const hit = [...sketchHashes].some((h) => n.imageUrl.includes(h));
    if (hit) issues.push(`\uB514\uC790\uC778 \uCE78\uC774 \uC2A4\uCF00\uCE58 \uC774\uBBF8\uC9C0 \uC0AC\uC6A9: ${n.id}`);
  }
  for (const d of st.designs.filter((d2) => !d2.rejected)) {
    const renders = d.images.filter((i) => !["sketch", "sketch_var"].includes(i.view));
    if (!renders.length) issues.push(`\uB80C\uB354 0\uC7A5: ${d.spec.design_id}`);
  }
  for (const d of st.designs.filter((d2) => !d2.rejected)) {
    const sk = d.images.filter((i) => ["sketch", "sketch_var"].includes(i.view));
    const renders = d.images.filter((i) => !["sketch", "sketch_var"].includes(i.view));
    if (!sk.length && renders.length) issues.push(`\uC2A4\uCF00\uCE58 \uC5C6\uC774 \uB80C\uB354\uB9CC: ${d.spec.design_id} (\uACC4\uBCF4 \uB04A\uAE40)`);
  }
  const ids = new Set(m.nodes.map((n) => n.id));
  for (const e of m.edges) {
    if (!ids.has(e.from)) issues.push(`\uC5E3\uC9C0 \uCD9C\uBC1C\uC9C0 \uC5C6\uC74C: ${e.from} \u2192 ${e.to}`);
    if (!ids.has(e.to)) issues.push(`\uC5E3\uC9C0 \uB3C4\uCC29\uC9C0 \uC5C6\uC74C: ${e.from} \u2192 ${e.to}`);
  }
  const noImg = m.nodes.filter((n) => n.kind === "design" && !n.imageUrl && !n.design).length;
  if (noImg) issues.push(`\uC774\uBBF8\uC9C0 \uC5C6\uB294 \uB514\uC790\uC778 \uCE74\uB4DC ${noImg}\uAC74`);
  const noGen = st.designs.filter((d) => !d.rejected && !d.spec.genome).length;
  if (noGen) issues.push(`\uAC8C\uB188 \uC5C6\uC774 \uC0B4\uC544\uB0A8\uC740 \uB514\uC790\uC778 ${noGen}\uAC74 (\uD3F4\uBC31 \uACBD\uB85C)`);
  const noQa = st.designs.filter((d) => !d.rejected && d.images.some((i) => !["sketch", "sketch_var"].includes(i.view)) && !(d.qa || []).length).length;
  if (noQa) issues.push(`\uB80C\uB354\uB294 \uC788\uB294\uB370 \uAC80\uC99D \uAE30\uB85D \uC5C6\uC74C ${noQa}\uAC74`);
  console.log(`\u2550\u2550 ${f} \xB7 \uB178\uB4DC ${m.nodes.length} / \uC5E3\uC9C0 ${m.edges.length}`);
  if (!issues.length) console.log("   \uC774\uC0C1 \uC5C6\uC74C");
  else issues.forEach((x) => console.log("   \u2717", x));
}
/*! Bundled license information:

react/cjs/react.production.min.js:
  (**
   * @license React
   * react.production.min.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react/cjs/react.development.js:
  (**
   * @license React
   * react.development.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)
*/
