import { createChart } from './chart.js';
import M from './model.js';
import { css } from './css.js';

export var version = typeof __FAGEX_VERSION__ !== 'undefined' ? __FAGEX_VERSION__ : '0.0.0-dev';

export var model = M;

var registry = [];

var LIVE_OPTIONS = ['view', 'range', 'expiry', 'orientation', 'theme', 'layers'];

function resolveDom(dom) {
    if (typeof dom === 'string' && typeof document !== 'undefined') dom = document.querySelector(dom);
    if (!dom || dom.nodeType !== 1) throw new Error('FlashAlphaGex.init: element not found');
    return dom;
}

function injectCss(nonce) {
    if (!css || typeof document === 'undefined' || document.getElementById('flashalpha-gex-css')) return;
    var style = document.createElement('style');
    style.id = 'flashalpha-gex-css';
    if (nonce) style.setAttribute('nonce', nonce);
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
}

function GexChart(dom, options) {
    this._dom = dom;
    this._options = Object.assign({}, options || {});
    this._handlers = {};
    this._disposed = false;
    this._mount();
}

GexChart.prototype._mount = function () {
    var self = this;
    var o = this._options;
    o.mode = o.mode === 'compact' || o.mode === 'zero-dte' ? o.mode : 'full';
    if (o.injectCss !== false) injectCss(o.cssNonce);
    this._dom.classList.add('flashalpha-gex');
    this._dom.setAttribute('data-mode', o.mode);
    var el = document.createElement('div');
    el.className = 'fagex-root';
    this._dom.appendChild(el);
    this._root = el;
    if (o.on && typeof o.on === 'object') {
        Object.keys(o.on).forEach(function (name) { self.on(name, o.on[name]); });
        o.on = null;
    }
    this._chart = createChart(el, o, function (name, payload) { self._emit(name, payload); });
};

GexChart.prototype._unmount = function () {
    if (this._chart) this._chart.destroy();
    this._chart = null;
    if (this._root && this._root.parentNode) this._root.parentNode.removeChild(this._root);
    this._root = null;
};

GexChart.prototype._remount = function () {
    this._unmount();
    this._mount();
};

GexChart.prototype._emit = function (name, payload) {
    var self = this;
    Promise.resolve().then(function () {
        if (self._disposed) return;
        (self._handlers[name] || []).slice().forEach(function (fn) {
            try { fn.call(self, payload); } catch (e) { setTimeout(function () { throw e; }, 0); }
        });
    });
};

GexChart.prototype.on = function (name, fn) {
    if (typeof fn !== 'function') return this;
    (this._handlers[name] = this._handlers[name] || []).push(fn);
    return this;
};

GexChart.prototype.off = function (name, fn) {
    if (!this._handlers[name]) return this;
    this._handlers[name] = fn ? this._handlers[name].filter(function (h) { return h !== fn; }) : [];
    return this;
};

GexChart.prototype.setSymbol = function (symbol, assetType) {
    if (this._disposed) return this;
    this._options.symbol = symbol;
    if (assetType) this._options.assetType = assetType; else delete this._options.assetType;
    delete this._options.data;
    delete this._options.summary;
    this._remount();
    return this;
};

GexChart.prototype.setOption = function (partial) {
    if (this._disposed || !partial || typeof partial !== 'object') return this;
    var o = this._options;
    var remount = Object.keys(partial).some(function (k) { return LIVE_OPTIONS.indexOf(k) === -1; });
    Object.keys(partial).forEach(function (k) { o[k] = partial[k]; });
    if (remount) { this._remount(); return this; }
    var c = this._chart;
    if ('theme' in partial) c.setTheme(partial.theme);
    if ('view' in partial) c.setView(partial.view);
    if ('range' in partial) c.setRange(partial.range);
    if ('orientation' in partial) c.setOrientation(partial.orientation);
    if ('layers' in partial) c.setLayers(partial.layers);
    if ('expiry' in partial) c.setExpiry(partial.expiry);
    return this;
};

GexChart.prototype.setView = function (view) { return this.setOption({ view: view }); };
GexChart.prototype.setRange = function (range) { return this.setOption({ range: range }); };
GexChart.prototype.setExpiry = function (expiry) { return this.setOption({ expiry: expiry }); };
GexChart.prototype.setTheme = function (theme) { return this.setOption({ theme: theme }); };
GexChart.prototype.setOrientation = function (orientation) { return this.setOption({ orientation: orientation }); };

GexChart.prototype.setData = function (data) {
    if (!this._disposed && this._chart) this._chart.setData(data);
    return this;
};

GexChart.prototype.refresh = function () {
    return !this._disposed && !!this._chart && this._chart.refresh();
};

GexChart.prototype.resize = function () {
    if (!this._disposed && this._chart) this._chart.onResize();
    return this;
};

GexChart.prototype.getModel = function () { return this._chart ? this._chart.model : null; };
GexChart.prototype.getStatus = function () { return this._chart ? this._chart.status : 'disposed'; };
GexChart.prototype.getOrientation = function () { return this._chart ? this._chart.orientation() : null; };
GexChart.prototype.getDataURL = function (opts) { return this._chart ? this._chart.getDataURL(opts) : null; };
GexChart.prototype.getDom = function () { return this._dom; };
GexChart.prototype.isDisposed = function () { return this._disposed; };

GexChart.prototype.dispose = function () {
    if (this._disposed) return;
    this._unmount();
    this._dom.classList.remove('flashalpha-gex');
    this._dom.removeAttribute('data-mode');
    var self = this;
    registry = registry.filter(function (r) { return r !== self; });
    var handlers = (this._handlers.dispose || []).slice();
    this._disposed = true;
    this._handlers = {};
    handlers.forEach(function (fn) { try { fn.call(self); } catch (e) { setTimeout(function () { throw e; }, 0); } });
};

export function getInstanceByDom(dom) {
    for (var i = 0; i < registry.length; i++) if (registry[i]._dom === dom) return registry[i];
    return null;
}

export function init(dom, options) {
    var el = resolveDom(dom);
    var old = getInstanceByDom(el);
    if (old) old.dispose();
    var chart = new GexChart(el, options);
    registry.push(chart);
    return chart;
}

export function dispose(target) {
    var chart = target instanceof GexChart ? target : getInstanceByDom(typeof target === 'string' ? document.querySelector(target) : target);
    if (chart) chart.dispose();
}

function optionsFromDataset(d) {
    var o = {};
    ['symbol', 'apiKey', 'apiBase', 'mode', 'theme', 'view', 'expiry', 'orientation', 'plan'].forEach(function (k) {
        if (d[k]) o[k] = d[k];
    });
    if (d.range) o.range = d.range === 'all' || d.range === 'auto' ? d.range : Number(d.range);
    if (d.attribution === 'false') o.attribution = false;
    return o;
}

export function autoInit(root) {
    var scope = root || (typeof document !== 'undefined' ? document : null);
    if (!scope || !scope.querySelectorAll) return [];
    var out = [];
    scope.querySelectorAll('[data-flashalpha-gex]').forEach(function (el) {
        if (getInstanceByDom(el)) return;
        out.push(init(el, optionsFromDataset(el.dataset || {})));
    });
    return out;
}
