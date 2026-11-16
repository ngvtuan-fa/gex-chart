import M from './model.js';
import T from './theme.js';
import { createApi, planRankFromName, MIN_OI } from './api.js';
import { createStorage } from './storage.js';
import * as brand from './brand.js';

var root = typeof window !== 'undefined' ? window : globalThis;
var DARK = 'flashalpha-dark';
var LIGHT = 'flashalpha-light';
var REFRESH_MS = 15000;
var LIVE_MS = { 1: 5 * 60000, 2: 2 * 60000, 3: 60000 };
var LIVE_SUMMARY_MS = M.LIVE_SUMMARY_MS;
var LIVE_QUOTA_RESERVE = 0.2;
var LIVE_BUSY_RETRY_MS = 10000;
var QUOTE_MS = { 2: 60000, 3: 30000 };
var VIEWS = [['net', 'Net GEX'], ['callput', 'Call vs Put'], ['oi', 'Open Interest'], ['flow', 'Flow']];
var FLOW_RANK = 3;
var FLOW_WHAT = 'Flow-signed GEX (today’s dealer flow)';
var RANGES = [[0.05, '±5%'], [0.10, '±10%'], [0.20, '±20%'], ['all', 'All']];
var ZDTE_VIEWS = ['net', 'callput', 'oi'];
var ZDTE_RANGES = [[0.005, '±0.5%'], [0.01, '±1%'], [0.02, '±2%'], ['all', 'All']];
var FS_ICON = '<svg class="block mx-auto" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
var FS_EXIT_ICON = '<svg class="block mx-auto" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
var TOOL_ICON = {
    zoomOut: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35M8 11h6"/>',
    zoomIn: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35M8 11h6M11 8v6"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>',
    export: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    barsUp: '<path d="M3 21h18M7 17V9M12 17V4M17 17v-5"/>',
    barsSide: '<path d="M3 3v18M7 7h8M7 12h13M7 17h5"/>'
};
function toolIcon(name) {
    return '<svg class="block mx-auto" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + TOOL_ICON[name] + '</svg>';
}
var BLINK_MS = 1280;
var UPPER_ROW = ['maxPain', 'flip', 'flowFlip', 'magnet'];
var LABEL_TIER_PX = 17;
var LABEL_GAP_PX = 6;
var V_GUTTER = { wide: 140, mobile: 72 };
var V_ZOOM_PX = 34;
var V_LABEL_H = { wide: 16, mobile: 14 };
var V_LABEL_GAP = 2;
var MENUS = {
    more: ['more', 'more-menu'], exp: ['exp-btn', 'exp-menu'], range: ['range-btn', 'range-menu'], view: ['view-btn', 'view-menu'],
    layers: ['layers-btn', 'layers-menu', 'layers-ibtn']
};
var LAYER_LEVEL = {
    emLow: { label: 'EM low', short: 'EM', order: 6 },
    emHigh: { label: 'EM high', short: 'EM', order: 7 },
    magnet: { label: 'Magnet', short: 'MG', order: 8 }
};
var EM_LIVE_MS = M.EM_LIVE_MS;
var LAYERS_ICON = '<svg class="block mx-auto" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg>';
var CHECK = '<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>';
var FS_CLASSES = {
    root: ['!fixed', 'inset-0', 'z-[2147483000]', 'flex', 'flex-col', 'p-4', 'overflow-auto', 'bg-slate-900', 'data-[theme=flashalpha-light]:bg-white'],
    body: ['flex-auto', 'min-h-[320px]'],
    stage: ['!h-full'],
    rail: ['overflow-y-auto'],
    concl: ['flex-none'],
    tip: ['flex-none'],
    foot: ['flex-none']
};
var MOBILE = 'group-data-[layout=mobile]:';
var EDGE_ROW = '<div class="flex flex-wrap justify-end gap-1 mb-1" data-r="edge-row" hidden></div>';
var TW = {
    muted: 'text-xs text-[color:var(--fagex-muted)]',
    btn: 'h-[26px] min-w-[26px] px-3 rounded-lg border border-[color:var(--fagex-border)] bg-[color:var(--fagex-btn)] text-[13px] font-semibold whitespace-nowrap ' +
        'enabled:hover:bg-[color:var(--fagex-btn-hover)] aria-pressed:border-[color:var(--fagex-on)] aria-pressed:bg-[color:var(--fagex-on)] aria-pressed:text-[color:var(--fagex-on-text)]',
    seg: 'inline-flex overflow-hidden rounded-lg border border-[color:var(--fagex-border)]',
    segBtn: 'h-[26px] min-w-[26px] px-3 border-0 border-r border-[color:var(--fagex-border)] last:border-r-0 bg-[color:var(--fagex-btn)] text-[13px] font-semibold whitespace-nowrap ' +
        'hover:bg-[color:var(--fagex-btn-hover)] aria-pressed:bg-[color:var(--fagex-on)] aria-pressed:text-[color:var(--fagex-on-text)]',
    menu: 'absolute top-[calc(100%+4px)] z-30 min-w-[220px] ' + MOBILE + 'min-w-[200px] max-h-[300px] overflow-y-auto p-1 rounded-lg border border-[color:var(--fagex-border)] bg-[color:var(--fagex-raised)] shadow-[0_10px_30px_rgba(0,0,0,.35)] ' +
        '[&>button]:flex [&>button]:w-full [&>button]:items-center [&>button]:gap-1.5 [&>button]:min-h-[44px] [&>button]:px-2.5 [&>button]:border-0 [&>button]:rounded-md [&>button]:bg-transparent [&>button]:text-left [&>button]:text-[13px] ' +
        '[&>button:hover]:bg-[color:var(--fagex-btn-hover)] [&>button[aria-selected=true]]:font-bold [&>button[aria-selected=true]]:text-blue-400 [&>button[data-locked]]:text-[color:var(--fagex-muted)]'
};
TW.wideBtn = TW.btn + ' ' + MOBILE + 'hidden';
TW.cta = 'inline-flex items-center justify-center min-h-[44px] px-5 rounded-lg border-0 bg-blue-600 hover:bg-blue-700 !text-white text-sm/[1.45] font-bold no-underline';
TW.ovCard = 'relative z-[1] max-w-[380px] p-4 text-center';
TW.ovTitle = 'mx-0 mt-0 mb-1 text-base/[1.45] font-bold';
TW.ovText = 'mx-0 mt-0 mb-3.5 text-[13px] text-[color:var(--fagex-muted)]';
TW.menuNote = 'p-2.5 text-[13px] text-[color:var(--fagex-muted)]';
TW.picked = 'aria-[current=true]:border-[color:var(--fagex-on)] aria-[current=true]:shadow-[inset_0_0_0_1px_var(--fagex-on)]';
var LEVEL_TEXT = {
    callWall: 'text-[color:var(--fagex-pos)]', putWall: 'text-[color:var(--fagex-neg)]',
    flip: 'text-[color:var(--fagex-flip)]', maxPain: 'text-[color:var(--fagex-mp)]', flowFlip: 'text-[color:var(--fagex-flow)]', spot: '',
    emLow: 'text-[color:var(--fagex-muted)]', emHigh: 'text-[color:var(--fagex-muted)]', magnet: 'text-[color:var(--fagex-magnet)]'
};
var CHEVRON = '<svg class="flex-none w-3.5 h-3.5 ml-auto opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
var FOOT_ICON = {
    source: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/><path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3"/>',
    filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>',
    shown: '<path d="M18 20V10M12 20V4M6 20v-6"/>',
    unit: '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'
};
function footItem(it) {
    return '<span class="flex items-center gap-1.5 min-w-0">' +
        '<svg class="flex-none w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + it[0] + '</svg>' +
        '<span>' + esc(it[1]) + '</span></span>';
}
var LOCK = '<svg class="w-3.5 h-3.5 flex-none ml-auto" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M7 11V8a5 5 0 0110 0v3M6 11h12v9H6z"/></svg>';
var LOCK_INLINE = LOCK.replace('flex-none ml-auto', 'inline-block ml-1 -mt-0.5 align-middle');
function linkTarget(href) {
    try {
        var here = root.location && root.location.href;
        var u = new URL(href, here);
        return here && u.origin !== root.location.origin ? ' target="_blank" rel="noopener"' : '';
    } catch (e) {
        return '';
    }
}
var ATTR_NAME = /^(data|aria)-[a-z0-9-]+$|^(id|title)$/;
function attrHtml(attrs) {
    if (!attrs || typeof attrs !== 'object') return '';
    return Object.keys(attrs).filter(function (k) { return ATTR_NAME.test(k); }).map(function (k) { return ' ' + k + '="' + esc(attrs[k]) + '"'; }).join('');
}
function setAttrs(el, attrs) {
    if (!attrs || typeof attrs !== 'object') return;
    Object.keys(attrs).forEach(function (k) { if (ATTR_NAME.test(k)) el.setAttribute(k, String(attrs[k])); });
}
function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}
function reducedMotion() {
    try { return root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
}
function fsElement() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
function fsCall(target, names) {
    for (var i = 0; i < names.length; i++) {
        if (typeof target[names[i]] !== 'function') continue;
        try { var r = target[names[i]](); if (r && r.catch) r.catch(function () {}); } catch (e) {  }
        return;
    }
}
function layoutFor(width) { return width >= 1024 ? 'desktop' : width >= 640 ? 'tablet' : 'mobile'; }
var measureCtx = null;
function labelWidth(text, size) {
    try {
        if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
        measureCtx.font = '600 ' + size + 'px ' + (getComputedStyle(document.body).fontFamily || 'sans-serif');
        return measureCtx.measureText(text).width;
    } catch (e) { return String(text).length * size * 0.6; }
}

var NICE_STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
function niceCeil(v) {
    if (!(v > 0) || !isFinite(v)) return 1;
    var e = Math.pow(10, Math.floor(Math.log(v) / Math.LN10));
    var f = v / e;
    for (var i = 0; i < NICE_STEPS.length; i++) if (f <= NICE_STEPS[i] + 1e-9) return NICE_STEPS[i] * e;
    return 10 * e;
}
function symmetricAxis(absMax, split) {
    var half = split / 2;
    var step = niceCeil(absMax * 1.10 / half);
    return { min: -step * half, max: step * half, interval: step };
}

var echartsPromises = {};
function loadEcharts(src) {
    if (root.echarts) return Promise.resolve(root.echarts);
    if (!src) return Promise.reject(new Error('echarts missing'));
    if (echartsPromises[src]) return echartsPromises[src];
    echartsPromises[src] = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = function () {
            if (root.echarts) { resolve(root.echarts); return; }
            delete echartsPromises[src];
            reject(new Error('echarts missing'));
        };
        s.onerror = function () { delete echartsPromises[src]; s.remove(); reject(new Error('echarts failed to load')); };
        document.head.appendChild(s);
    });
    return echartsPromises[src];
}
function nearViewport(el) {
    return new Promise(function (resolve) {
        if (!('IntersectionObserver' in root)) { resolve(); return; }
        var io = new IntersectionObserver(function (entries) {
            if (entries.some(function (e) { return e.isIntersecting; })) { io.disconnect(); resolve(); }
        }, { rootMargin: '300px 0px' });
        io.observe(el);
    });
}
function fmtAsOf(iso) {
    var t = Date.parse(iso);
    if (!isFinite(t)) return '';
    try {
        return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
            .format(new Date(t)) + ' ET';
    } catch (e) { return new Date(t).toLocaleString(); }
}
function fmtExpiry(iso, today) {
    return iso === today ? iso + ' · 0DTE' : String(iso);
}
function stageClass(vertical) {
    return vertical
        ? 'relative h-[640px] group-data-[layout=tablet]:h-[600px] ' + MOBILE + 'h-[min(75vh,560px)] ' +
            'data-[trail]:h-[744px] group-data-[layout=tablet]:data-[trail]:h-[704px] ' + MOBILE + 'data-[trail]:h-[calc(min(75vh,560px)+80px)]'
        : 'relative h-[480px] group-data-[layout=tablet]:h-[440px] ' + MOBILE + 'h-[min(60vh,420px)] ' +
            'data-[trail]:h-[584px] group-data-[layout=tablet]:data-[trail]:h-[544px] ' + MOBILE + 'data-[trail]:h-[calc(min(60vh,420px)+80px)]';
}
function template(features, zdte, vertical) {
    var viewList = zdte ? VIEWS.filter(function (v) { return ZDTE_VIEWS.indexOf(v[0]) !== -1; }) : VIEWS;
    var views = viewList.map(function (v) {
        return '<button type="button" class="' + TW.segBtn + '" data-view="' + v[0] + '" aria-pressed="false">' + v[1] + '</button>';
    }).join('');
    var viewOptions = viewList.map(function (v) {
        return '<button type="button" role="option" data-view="' + v[0] + '" aria-selected="false">' + v[1] + '</button>';
    }).join('');
    var ranges = (zdte ? ZDTE_RANGES : RANGES).map(function (r) {
        return '<button type="button" role="option" data-range="' + r[0] + '" aria-selected="false">' + r[1] + '</button>';
    }).join('');
    var picker = TW.btn + ' inline-flex items-center gap-1.5 text-left ' + MOBILE + 'w-full ' + MOBILE + 'px-2';
    var pickerBox = 'relative ' + MOBILE + 'flex-1 ' + MOBILE + 'min-w-0';
    var smallOnly = 'hidden group-data-[layout=tablet]:block ' + MOBILE + 'block';
    var desktopOnly = 'group-data-[layout=tablet]:hidden ' + MOBILE + 'hidden';
    var tag = 'px-1.5 py-px rounded border border-current text-[11px] font-bold';
    var scopeTag = zdte
        ? '<span class="' + tag + ' text-blue-400" data-r="all-tag">0DTE</span>' +
          '<span class="' + tag + ' text-[color:var(--fagex-flip)]" data-r="sample-tag" title="Sample snapshot, not live data" hidden>Sample</span>'
        : '<span class="' + TW.muted + '" data-r="all-tag">All expiries</span>';
    var expiryPicker = zdte ? '' :
                '<div class="' + pickerBox + '">' +
                    '<button type="button" class="' + picker + '" data-r="exp-btn" aria-haspopup="listbox" aria-expanded="false"></button>' +
                    '<div class="' + TW.menu + ' left-0 ' + MOBILE + 'left-auto ' + MOBILE + 'right-0" data-r="exp-menu" role="listbox" aria-label="Expiry" hidden></div>' +
                '</div>';
    var layersPicker = zdte || features.layers === false ? '' :
                '<div class="relative ' + MOBILE + 'hidden">' +
                    '<button type="button" class="' + picker + '" data-r="layers-btn" aria-haspopup="menu" aria-expanded="false"></button>' +
                    '<div class="' + TW.menu + ' left-0 ' + MOBILE + 'left-auto ' + MOBILE + 'right-0 [&>button[aria-disabled=true]]:opacity-50 [&>button[aria-disabled=true]]:cursor-not-allowed" data-r="layers-menu" role="menu" aria-label="Layers" hidden></div>' +
                '</div>';
    var layersIcon = zdte || features.layers === false ? '' :
                '<div class="relative hidden ' + MOBILE + 'block">' +
                    '<button type="button" class="' + TW.btn + ' data-[on]:border-[color:var(--fagex-on)] data-[on]:text-blue-400" data-r="layers-ibtn" aria-haspopup="menu" aria-expanded="false" aria-label="Layers" title="Layers">' + LAYERS_ICON + '</button>' +
                '</div>';
    var refreshBtn = zdte ? '' : '<button type="button" class="' + TW.btn + '" data-r="refresh" aria-label="Refresh" title="Refresh">' + toolIcon('refresh') + '</button>';
    var labelsOn = features.labels !== false;
    return '' +
        '<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">' +
            '<div class="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">' +
                '<span class="text-lg/[1.45] font-extrabold ' + MOBILE + 'text-base/[1.45]" data-r="sym"></span>' +
                '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full border border-[color:var(--fagex-border)] bg-[color:var(--fagex-surface)] text-xs font-bold text-[color:var(--fagex-muted)] ' +
                    'data-[regime=positive]:border-current data-[regime=positive]:text-[color:var(--fagex-pos)] data-[regime=negative]:border-current data-[regime=negative]:text-[color:var(--fagex-neg)]" data-r="badge" data-regime="unknown"></span>' +
                '<span class="[&_b]:font-extrabold [&[data-sign=pos]_b]:text-[color:var(--fagex-pos)] [&[data-sign=neg]_b]:text-[color:var(--fagex-neg)] [&_small]:text-xs [&_small]:text-[color:var(--fagex-muted)]" data-r="net"></span>' +
                scopeTag +
                '<span class="px-2 py-0.5 rounded-md border border-[color:var(--fagex-border)] bg-[color:var(--fagex-surface)] ' + TW.muted + '" data-r="scope-chip"></span>' +
            '</div>' +
            '<div class="flex flex-col gap-y-1 ' + MOBILE + 'basis-full">' +
            '<div class="flex flex-wrap items-center gap-x-2 gap-y-1 ' + TW.muted + '"><span data-r="asof"></span>' +
                '<span class="px-1.5 py-px rounded border border-current text-[11px] font-bold text-[color:var(--fagex-flip)]" data-r="delayed" hidden>Delayed</span>' +
                '<span class="inline-flex items-center gap-1 text-[11px] font-bold text-[color:var(--fagex-pos)] data-[paused]:text-[color:var(--fagex-muted)] ' +
                    '[&>i]:block [&>i]:w-1.5 [&>i]:h-1.5 [&>i]:rounded-full [&>i]:bg-current motion-safe:[&:not([data-paused])>i]:animate-pulse" data-r="live" hidden><i></i><span></span></span>' +
                '</div>' +
            '<a class="self-end group-data-[layout=mobile]:self-start text-xs font-semibold text-blue-400 hover:text-blue-300 hover:underline cursor-pointer" data-r="delayed-cta" hidden></a>' +
            '</div>' +
        '</div>' +
        '<p class="mx-0 mt-1 mb-0 ' + TW.muted + '" data-r="reason" hidden></p>' +
        '<p class="mx-0 mt-2 mb-2.5 text-sm/[1.45] text-[color:var(--fagex-text)] group-data-[layout=tablet]:line-clamp-2 ' + MOBILE + 'line-clamp-3 ' + MOBILE + 'text-[13px]" data-r="concl"></p>' +
        '<div class="flex flex-wrap items-center gap-2 mb-2.5 ' + MOBILE + 'grid ' + MOBILE + 'grid-cols-[minmax(0,1fr)]" data-r="toolbar" role="toolbar" aria-label="Chart controls" hidden>' +
            '<div class="' + TW.seg + ' ' + desktopOnly + '" role="group" aria-label="View">' + views + '</div>' +
            '<div class="flex flex-wrap items-center gap-2 ' + MOBILE + 'flex-nowrap">' +
                '<div class="' + pickerBox + ' ' + smallOnly + '">' +
                    '<button type="button" class="' + picker + '" data-r="view-btn" aria-haspopup="listbox" aria-expanded="false"></button>' +
                    '<div class="' + TW.menu + ' left-0" data-r="view-menu" role="listbox" aria-label="View" hidden>' + viewOptions + '</div>' +
                '</div>' +
                '<div class="' + pickerBox + '">' +
                    '<button type="button" class="' + picker + '" data-r="range-btn" aria-haspopup="listbox" aria-expanded="false"></button>' +
                    '<div class="' + TW.menu + ' left-0" data-r="range-menu" role="listbox" aria-label="Strike range" hidden>' + ranges + '</div>' +
                '</div>' +
                expiryPicker +
                layersPicker +
            '</div>' +
            '<div class="flex flex-wrap items-center gap-2 ml-auto ' + MOBILE + 'ml-0 ' + MOBILE + 'justify-end">' +
                (labelsOn ? '<button type="button" class="' + TW.wideBtn + '" data-r="labels" aria-pressed="true">Labels</button>' : '') +
                layersIcon +
                '<button type="button" class="' + TW.btn + '" data-r="reset" aria-label="Reset zoom" title="Reset zoom">' + toolIcon('zoomOut') + '</button>' +
                refreshBtn +
                (features.export ? '<button type="button" class="' + TW.btn + '" data-r="export" aria-label="Export GEX" title="Export GEX">' + toolIcon('export') + '</button>' : '') +
                (features.orientation !== false ? '<button type="button" class="' + TW.wideBtn + '" data-r="orient" aria-pressed="false" aria-label="Vertical chart" title="Vertical chart">' + toolIcon('barsSide') + '</button>' : '') +
                (features.fullscreen !== false ? '<button type="button" class="' + TW.btn + '" data-r="fullscreen" aria-pressed="false" aria-label="Full screen" title="Full screen">' + FS_ICON + '</button>' : '') +
                (labelsOn || features.orientation !== false ?
                '<div class="relative hidden ' + MOBILE + 'block">' +
                    '<button type="button" class="' + TW.btn + '" data-r="more" aria-haspopup="menu" aria-expanded="false" aria-label="More actions">⋮</button>' +
                    '<div class="' + TW.menu + ' right-0" data-r="more-menu" role="menu" hidden>' +
                        (labelsOn ? '<button type="button" role="menuitem" data-r="m-labels">Hide labels</button>' : '') +
                        (features.orientation !== false ? '<button type="button" role="menuitem" data-r="m-orient">Vertical chart</button>' : '') +
                    '</div>' +
                '</div>' : '') +
            '</div>' +
        '</div>' +
        '<div class="flex flex-col gap-2 mb-2" data-r="chips" role="group" aria-label="Key levels" hidden></div>' +
        EDGE_ROW +
        '<div class="block group-data-[layout=desktop]:grid group-data-[layout=desktop]:grid-cols-[minmax(0,1fr)_260px] group-data-[layout=desktop]:gap-4" data-r="body">' +
            '<div class="' + stageClass(vertical) + '" data-r="stage">' +
                '<div class="absolute inset-0 touch-pan-y [[data-trail]>&]:bottom-[104px] ' + MOBILE + '[[data-trail]>&]:bottom-[80px]" data-r="chart"></div>' +
                '<div class="absolute inset-x-0 bottom-0 flex flex-col h-[96px] ' + MOBILE + 'h-[72px]" data-r="trail" aria-label="Flip vs spot today" hidden>' +
                    '<div class="flex items-center gap-3 px-1 text-[11px] text-[color:var(--fagex-muted)]">' +
                        '<span class="font-bold">Flip vs spot · today (ET)</span>' +
                        '<span class="inline-flex items-center gap-1"><i class="block w-3.5 border-t-[1.5px] border-solid border-[color:var(--fagex-text)]"></i>Spot</span>' +
                        '<span class="inline-flex items-center gap-1"><i class="block w-3.5 border-t-2 border-dashed border-[color:var(--fagex-flip)]"></i>Flip</span>' +
                    '</div>' +
                    '<div class="relative flex-1 min-h-0">' +
                        '<div class="absolute inset-0" data-r="trail-chart"></div>' +
                        '<div class="absolute inset-0 flex items-center justify-center ' + TW.muted + '" data-r="trail-msg" hidden></div>' +
                    '</div>' +
                '</div>' +
                '<div class="absolute z-[4] flex flex-col gap-1" data-r="edge-l"></div>' +
                '<div class="absolute z-[4] flex flex-col items-end gap-1" data-r="edge-r"></div>' +
                '<div class="absolute inset-0 z-[5] flex items-center justify-center [&:not([data-state=loading])]:rounded-lg [&:not([data-state=loading])]:bg-[color:var(--fagex-overlay)]" data-r="overlay" hidden></div>' +
            '</div>' +
            '<aside class="pl-3.5 border-l border-[color:var(--fagex-border)] [&_ul]:m-0 [&_ul]:p-0 [&_ul]:list-none" data-r="rail" aria-label="Key levels" hidden></aside>' +
        '</div>' +
        '<div class="mt-2 min-h-[44px] px-3 py-2.5 rounded-lg border border-[color:var(--fagex-border)] bg-[color:var(--fagex-surface)]" data-r="tip" aria-live="polite" hidden></div>' +
        '<div class="mt-3 pt-2.5 border-t border-[color:var(--fagex-border)] grid grid-cols-1 gap-x-1 gap-y-1.5 group-data-[layout=tablet]:grid-cols-4 group-data-[layout=desktop]:grid-cols-4 ' + TW.muted + '" data-r="foot"></div>' +
        (features.attribution !== false ? attributionHtml('') : '') +
        '<div class="absolute top-[120px] right-0 z-40 max-w-[320px] p-3.5 rounded-xl border border-[color:var(--fagex-border)] bg-[color:var(--fagex-raised)] shadow-[0_12px_32px_rgba(0,0,0,.4)] text-[13px] ' +
            '[&_p]:mx-0 [&_p]:mt-0 [&_p]:mb-2.5 ' + MOBILE + 'left-0 ' + MOBILE + 'max-w-none" data-r="pop" role="dialog" aria-modal="false" hidden></div>';
}
function attributionHtml(extra) {
    return '<div class="flex justify-end mt-1.5 text-[11px] ' + extra + '" data-r="attr">' +
        '<a class="no-underline text-[color:var(--fagex-muted)] hover:text-[color:var(--fagex-text)] hover:underline" href="' + esc(brand.homeUrl()) + '" target="_blank" rel="noopener">GEX data by&nbsp;<b>FlashAlpha</b></a></div>';
}
function liteTemplate(features) {
    return '' +
        EDGE_ROW +
        '<div class="relative flex-1 min-h-[360px] ' + MOBILE + 'min-h-[min(60vh,320px)]" data-r="stage">' +
            '<div class="absolute inset-0 touch-pan-y" data-r="chart"></div>' +
            '<div class="absolute z-[4] flex flex-col gap-1" data-r="edge-l"></div>' +
            '<div class="absolute z-[4] flex flex-col items-end gap-1" data-r="edge-r"></div>' +
            '<div class="absolute inset-0 z-[5] flex items-center justify-center [&:not([data-state=loading])]:rounded-lg [&:not([data-state=loading])]:bg-[color:var(--fagex-overlay)]" data-r="overlay" hidden></div>' +
        '</div>' +
        '<div class="flex-none mt-2 min-h-[44px] px-3 py-2.5 rounded-lg border border-[color:var(--fagex-border)] bg-[color:var(--fagex-surface)]" data-r="tip" aria-live="polite" hidden></div>' +
        (features.attribution !== false ? attributionHtml('flex-none') : '');
}
function skeletonHtml(vertical) {
    var bars = [30, 45, 62, 80, 55, 38, 26, 22, 40, 70, 52, 34, 20];
    if (vertical) {
        return '<div class="absolute top-4 right-12 bottom-8 left-12 flex flex-col justify-center gap-[2%] blur-[6px] opacity-60" aria-hidden="true">' +
            bars.map(function (w, i) {
                var cls = i > 6 ? 'right-1/2 rounded-l-[3px] bg-[rgba(239,68,68,.5)]' : 'left-1/2 rounded-r-[3px] bg-[rgba(16,185,129,.5)]';
                return '<span class="relative flex-1"><span style="width:' + (w / 2) + '%" class="absolute inset-y-0 ' + cls + '"></span></span>';
            }).join('') + '</div>';
    }
    return '<div class="absolute top-6 right-4 bottom-8 left-12 flex items-center gap-[3%] blur-[6px] opacity-60" aria-hidden="true">' +
        bars.map(function (h, i) {
            var cls = i > 6 ? 'flex-1 translate-y-1/2 rounded-b-[3px] bg-[rgba(239,68,68,.5)]' : 'flex-1 -translate-y-1/2 rounded-t-[3px] bg-[rgba(16,185,129,.5)]';
            return '<span style="height:' + (h / 2) + '%" class="' + cls + '"></span>';
        }).join('') + '</div>';
}
function loaderHtml(label) {
    var run = reducedMotion()
        ? ' transform="translate(22 0)">'
        : '><animateTransform attributeName="transform" type="translate" from="-44 0" to="88 0" dur="1.2s"' +
          ' calcMode="spline" keyTimes="0;1" keySplines="0.42 0 0.58 1" repeatCount="indefinite"/>';
    return '<div class="flex items-center justify-center" role="status">' +
        '<svg class="block" width="120" height="120" viewBox="0 0 120 120" aria-hidden="true" focusable="false">' +
            '<defs>' +
                '<linearGradient id="fagex-ld-grad" x1="0" y1="0" x2="1" y2="0">' +
                    '<stop offset="0" stop-color="#3b77ae"/><stop offset=".5" stop-color="#3293e0"/><stop offset="1" stop-color="#2563eb"/>' +
                '</linearGradient>' +
                '<clipPath id="fagex-ld-clip"><rect x="16" y="94" width="88" height="4" rx="2"/></clipPath>' +
            '</defs>' +
            '<image href="' + brand.LOGO + '" x="22" y="22" width="76" height="51" preserveAspectRatio="xMidYMid meet"/>' +
            '<rect class="fill-[var(--fagex-skel)]" x="16" y="94" width="88" height="4" rx="2"/>' +
            '<g clip-path="url(#fagex-ld-clip)">' +
                '<rect x="16" y="94" width="44" height="4" rx="2" fill="url(#fagex-ld-grad)"' + run + '</rect>' +
            '</g>' +
        '</svg>' +
        '<span class="sr-only">' + esc(label) + '</span></div>';
}
function themeModeOf(t) {
    if (t === 'light' || t === LIGHT) return LIGHT;
    if (t === 'dark' || t === DARK) return DARK;
    if (t === 'class') return 'class';
    return 'auto';
}
function plainObject(v) { return v && typeof v === 'object' ? v : null; }
function Gex(el, opts, emit) {
    this.el = el;
    this.opts = opts || {};
    this.emitFn = typeof emit === 'function' ? emit : function () {};
    this.lite = this.opts.mode === 'compact';
    this.zdte = this.opts.mode === 'zero-dte';
    this.pageData = this.lite || this.zdte;
    this.store = createStorage(this.opts.storagePrefix, this.opts.storage !== 'none');
    this.api = createApi({
        apiKey: this.opts.apiKey, getApiKey: this.opts.getApiKey, apiBase: this.opts.apiBase, headers: this.opts.headers,
        plan: this.opts.plan, source: this.opts.source, fetch: this.opts.fetch, maxConcurrent: this.opts.maxConcurrent, storage: this.store
    });
    var sym = this.opts.symbol === undefined || this.opts.symbol === null || this.opts.symbol === '' ? 'SPY' : this.opts.symbol;
    this.symbol = String(sym).trim().toUpperCase();
    this.assetType = this.opts.assetType || (M.isFutures(this.symbol) ? 'futures' : 'stock');
    this.cur = this.assetType === 'futures' ? '' : '$';
    this.ec = this.opts.echarts || null;
    this.echartsSrc = this.opts.echartsUrl || null;
    var data = plainObject(this.opts.data);
    this.staticData = !!data;
    this.sample = this.zdte && !!(data && data.sample);
    var attribution = this.opts.attribution !== false;
    this.features = this.lite ? { maxPain: true, export: false, levelsRail: false, orientation: false, attribution: attribution }
        : Object.assign({ maxPain: true, export: true, levelsRail: true, orientation: true }, plainObject(this.opts.features) || {}, { attribution: attribution });
    this.liveOn = this.features.live !== false;
    this.themeMode = themeModeOf(this.opts.theme);
    this.guestCta = plainObject(this.opts.guestCta);
    this.delayedCta = plainObject(this.opts.delayedCta) && this.opts.delayedCta.href ? this.opts.delayedCta : null;
    this.upgradeUrlFn = typeof this.opts.upgradeUrl === 'function' ? this.opts.upgradeUrl : null;
    this.upgradeNoteFn = typeof this.opts.upgradeNote === 'function' ? this.opts.upgradeNote : null;
    this.upgradeAttrs = plainObject(this.opts.upgradeAttrs);
    var prefs = this.lite ? {} : (plainObject(this.store.get('prefs')) || {});
    this.viewKeys = this.zdte ? ZDTE_VIEWS : M.VIEWS;
    this.rangeKeys = this.zdte ? M.ZDTE_RANGES : M.RANGES;
    this.view = this.lite ? 'net' : this.viewKeys.indexOf(prefs.view) !== -1 ? prefs.view
        : this.viewKeys.indexOf(this.opts.view) !== -1 ? this.opts.view : 'net';
    this.userRange = !this.lite && this.rangeKeys.indexOf(this.opts.range) !== -1 ? this.opts.range : null;
    this.topN = this.lite && M.num(this.opts.top) > 0 ? Math.floor(this.opts.top) : 0;
    if (this.topN) this.userRange = 'all';
    this.zoomBar = this.opts.zoomBar !== false;
    this.labelsPref = this.lite ? { wide: true, mobile: this.opts.labelsMobile === true }
        : { wide: prefs.labels !== false, mobile: prefs.labelsMobile === true };
    var defOrient = this.opts.orientation === 'vertical' ? 'v' : 'h';
    var orientOf = function (v) { return v === 'v' || v === 'h' ? v : defOrient; };
    this.savedOrient = this.lite ? {} : { orient: prefs.orient, orientMobile: prefs.orientMobile };
    this.orientPref = this.lite ? { wide: defOrient, mobile: defOrient } : { wide: orientOf(prefs.orient), mobile: orientOf(prefs.orientMobile) };
    this.fullscreen = false;
    this.requestedExpiry = this.opts.expiry || 'auto';
    this.savedLayers = plainObject(this.opts.layers) || prefs.layers;
    this.layersChosen = !!this.savedLayers && typeof this.savedLayers === 'object';
    this.layers = this.pageData ? {} : M.normalizeLayerPrefs(this.savedLayers, 0);
    this.layerData = {};
    this.layerErr = {};
    this.layerLocked = {};
    this.layerBusy = {};
    this.trailChart = null;
    this.summaryProvided = Object.prototype.hasOwnProperty.call(this.opts, 'summary') || !!(data && Object.prototype.hasOwnProperty.call(data, 'summary'));
    this.summary = this.opts.summary || (data && data.summary) || null;
    this.gexRaw = data ? (this.zdte ? data.zeroDte || null : data.gex || null) : null;
    this.expiries = null;
    this.expiry = this.lite && this.staticData ? (this.opts.expiry && this.opts.expiry !== 'auto' ? this.opts.expiry : 'all') : null;
    this.rank = this.staticData ? (this.opts.plan ? planRankFromName(this.opts.plan) : null) : null;
    this.invalidKey = false;
    this.model = null;
    this.status = 'loading';
    this.error = null;
    this.win = null;
    this.zoomBack = null;
    this.atDefault = false;
    this.highlight = null;
    this.lastLoad = 0;
    this.chart = null;
    this.destroyed = false;
    this.layout = layoutFor(el.clientWidth || (el.parentNode && el.parentNode.clientWidth) || 1024);
    this.labelsOn = this.labelsPref[this.labelsKey()];
    this.today = M.todayET();
    this._listeners = [];
}
Gex.prototype.$ = function (name) { return this.el.querySelector('[data-r="' + name + '"]'); };
Gex.prototype.emit = function (name, payload) {
    try { this.emitFn(name, payload); } catch (e) { return; }
};
Gex.prototype.upgradeUrl = function (rank, campaign) {
    if (this.upgradeUrlFn) {
        try {
            var u = this.upgradeUrlFn(M.PLAN_SLUG[rank] || null, rank);
            if (u) return String(u);
        } catch (e) { return brand.pricingUrl(rank, campaign); }
    }
    return brand.pricingUrl(rank, campaign);
};
Gex.prototype.theme = function () {
    if (this.themeMode === 'class') return document.documentElement.classList.contains('dark') ? DARK : LIGHT;
    if (this.themeMode === 'auto') {
        try { return root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches ? DARK : LIGHT; } catch (e) { return DARK; }
    }
    return this.themeMode;
};
Gex.prototype.watchTheme = function () {
    var self = this;
    var follow = function () { self.applyTheme(self.theme()); };
    if (this.themeMode === 'class' && 'MutationObserver' in root) {
        this.mo = new MutationObserver(follow);
        this.mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    } else if (this.themeMode === 'auto' && root.matchMedia) {
        try {
            var mq = root.matchMedia('(prefers-color-scheme: dark)');
            if (mq && mq.addEventListener) { mq.addEventListener('change', follow); this._mq = [mq, follow]; }
        } catch (e) { this._mq = null; }
    }
};
Gex.prototype.labelsKey = function () { return this.layout === 'mobile' ? 'mobile' : 'wide'; };

Gex.prototype.vertical = function () { return this.orientPref[this.labelsKey()] === 'v'; };
Gex.prototype.orientation = function () { return this.vertical() ? 'vertical' : 'horizontal'; };
Gex.prototype.range = function () {
    return this.userRange !== null ? this.userRange : 'auto';
};
Gex.prototype.on = function (target, type, fn, opt) {
    target.addEventListener(type, fn, opt);
    this._listeners.push([target, type, fn, opt]);
};
Gex.prototype.mountUi = function () {
    var self = this;
    this.el.classList.add('group', 'relative');
    if (this.lite) ['flex-1', 'flex', 'flex-col', 'min-h-0'].forEach(function (c) { self.el.classList.add(c); });
    this.el.innerHTML = this.lite ? liteTemplate(this.features) : template(this.features, this.zdte, this.vertical());
    this.el.setAttribute('data-theme', this.theme());
    this.el.setAttribute('data-layout', this.layout);
    this.el.setAttribute('data-orient', this.vertical() ? 'v' : 'h');
    if (this.lite) {
        this.on(this.el, 'click', function (e) {
            var t = e.target.closest('button[data-edge], button[data-r="retry"]');
            if (!t || !self.el.contains(t)) return;
            if (t.dataset.edge) self.extendTo(Number(t.dataset.edge));
            else self.loadPageData({ refresh: true });
        });
    } else this.bindUi();
    if ('ResizeObserver' in root) {
        this.ro = new ResizeObserver(function () { self.onResize(); });
        this.ro.observe(this.el);
        this.ro.observe(this.$('chart'));
    }
    this.watchTheme();
};
Gex.prototype.start = function () {
    this.mountUi();
    if (this.lite && this.staticData) {
        this.setLiteData(this.summary, this.gexRaw);
        this.renderLite();
        return;
    }
    if (!this.lite) this.el.setAttribute('data-booting', '');
    this.renderOverlay('loading');
    if (this.zdte) {
        if (this.staticData) { this.setZdteData(this.gexRaw); this.renderLite(); return; }
        this.loadPageData();
        return;
    }
    this.boot();
};
Gex.prototype.boot = async function () {
    var self = this;
    var plan = await this.api.fetchPlan();
    if (this.destroyed) return;
    this.rank = plan.rank;
    this.invalidKey = plan.invalid;
    if (this.lite) return this.rank === null ? this.startGuest() : this.loadPageData();
    this.layers = M.normalizeLayerPrefs(this.savedLayers, this.rank);
    if (this.view === 'flow' && !(this.rank >= FLOW_RANK)) this.view = 'net';
    if (this.rank === null) return this.startGuest();
    this.echartsReady = nearViewport(this.el).then(function () { return self.loadEcharts(); })
        .then(function () { return true; }, function () { return false; });
    this.load();
};
Gex.prototype.loadEcharts = function () {
    var self = this;
    var p = this.ec ? Promise.resolve(this.ec) : loadEcharts(this.echartsSrc);
    return p.then(function (ec) {
        self.ec = ec;
        T.register(ec);
        self.echartsOk = true;
        return ec;
    });
};
Gex.prototype.startGuest = async function () {
    this.status = 'guest';
    this.model = this.summary ? M.buildModel({ symbol: this.symbol, assetType: this.assetType, summary: this.summary, gex: {}, expiry: 'all' }) : null;
    this.renderGuest();
    this.emit('locked', { feature: 'api-key', requiredPlan: 'Free', reason: this.invalidKey ? 'invalid-key' : 'api-key' });
    if (this.summary || this._guestSummaryTried || this.invalidKey) return;
    this._guestSummaryTried = true;
    var r = await this.api.fetchSummary(this.symbol);
    if (this.destroyed || this.status !== 'guest' || !r.ok || !r.data) return;
    this.summary = r.data;
    this.model = M.buildModel({ symbol: this.symbol, assetType: this.assetType, summary: this.summary, gex: {}, expiry: 'all' });
    this.renderGuest();
};
Gex.prototype.renderGuest = function () {
    if (this.pageData) {
        this.el.removeAttribute('data-booting');
        this.clearChart();
        this.renderOverlay('guest');
        return;
    }
    this.renderAll();
};
Gex.prototype.loadPageData = async function (opts) {
    opts = opts || {};
    var self = this;
    var seq = this._loadSeq = (this._loadSeq || 0) + 1;
    var stale = function () { return self.destroyed || seq !== self._loadSeq; };
    this.lastLoad = Date.now();
    this.status = 'loading';
    this.error = null;
    this.emit('loading', { symbol: this.symbol, refresh: !!opts.refresh });
    this.renderOverlay(this.chart ? 'refreshing' : 'loading');
    if (this.zdte) {
        var zr = await this.api.fetchZeroDte(this.symbol);
        if (stale()) return;
        if (!zr.ok) return this.pageFail(zr.error);
        this.updateZdte({ data: zr.data, symbol: this.symbol });
        return;
    }
    this.today = M.todayET();
    var expiry = this.requestedExpiry;
    if (expiry === 'auto' || M.expiryLocked(expiry, this.rank, this.today)) {
        if (this.rank >= 2) expiry = 'all';
        else {
            var er = await this.api.fetchExpiries(this.symbol, this.today);
            if (stale()) return;
            if (!er.ok) return this.pageFail(er.error);
            this.expiries = er.data;
            expiry = M.defaultExpiry(this.expiries, this.rank, this.today);
        }
    }
    this.expiry = expiry || 'all';
    var useSummary = this.summaryProvided && !opts.refresh;
    var results = await Promise.all([
        useSummary ? Promise.resolve({ ok: true, data: this.summary }) : this.api.fetchSummary(this.symbol),
        expiry ? this.api.fetchGex(this.symbol, expiry) : Promise.resolve({ ok: true, data: null })
    ]);
    if (stale()) return;
    if (!results[1].ok) return this.pageFail(results[1].error);
    var zoomed = !!this.win && !this.atDefault;
    this.setLiteData(results[0].ok ? results[0].data : this.summary, results[1].data);
    if (!zoomed) this.win = null;
    this.renderLite();
};
Gex.prototype.pageFail = function (err) {
    err = err || { kind: 'network' };
    if (err.kind === 'unauthorized') { this.invalidKey = true; return this.startGuest(); }
    this.el.removeAttribute('data-booting');
    this.clearChart();
    if (err.kind === 'locked') {
        this.status = 'locked';
        this.lockInfo = { rank: err.requiredRank || 2, reason: null, message: err.message || null };
        if (this.zdte) this.renderAll(); else this.renderOverlay('locked');
        this.emit('locked', { feature: this.zdte ? 'zero-dte' : 'gex', requiredPlan: M.PLAN_NAME[this.lockInfo.rank], reason: 'plan' });
        return;
    }
    this.status = err.kind === 'quota' || err.kind === 'concurrency' ? 'limit' : err.kind === 'not_found' ? 'not_found' : 'error';
    this.error = err;
    if (this.zdte) this.renderAll(); else this.renderOverlay(this.status);
    if (this.status === 'limit') this.emit('rate-limited', { kind: err.kind, resetAt: err.resetAt || null, retryAfter: err.retryAfter || null });
    else this.emit('error', { kind: err.kind, status: err.status || null, code: err.code || null });
};

Gex.prototype.setLiteData = function (summary, gex) {
    var self = this;
    this.summary = summary || null;
    this.gexRaw = gex || null;
    this.model = M.buildModel({ symbol: this.symbol, assetType: this.assetType, summary: this.summary, gex: this.gexRaw || {}, expiry: this.expiry, minOi: MIN_OI, keepNulls: true });
    if (this.topN) {
        var keep = M.topStrikes(this.model.strikes, 'net', this.topN);
        this.model.strikes = this.model.strikes.filter(function (s) { return keep.indexOf(s.strike) !== -1; });
    }
    this.byStrike = {};
    this.model.strikes.forEach(function (s) { self.byStrike[s.strike] = s; });
    this.applyPrice();
};
Gex.prototype.setZdteData = function (raw) {
    var self = this;
    this.gexRaw = raw || null;
    this.model = raw ? M.modelFromZeroDte(raw) : null;
    this.byStrike = {};
    if (this.model) this.model.strikes.forEach(function (s) { self.byStrike[s.strike] = s; });
};
Gex.prototype.updateZdte = function (d) {
    if (!this.zdte || this.destroyed) return;
    d = d || {};
    var sym = d.symbol ? String(d.symbol).toUpperCase() : this.symbol;
    if (sym !== this.symbol) {
        this.symbol = sym;
        this.highlight = null;
        this.userRange = null;
        this.zoomBack = null;
        this.win = null;
        this._keepZoom = false;
        this._tipStrike = undefined;
        this.clearChart();
        this.el.setAttribute('data-booting', '');
    }
    if (d.sample !== undefined) this.sample = !!d.sample;
    var data = d.data === undefined ? null : d.data;
    if (this.status === 'ready') this._keepZoom = !!this.win && !this.atDefault;
    this.setZdteData(data);
    if (data && this.model) {
        if (!this._keepZoom) this.win = null;
        this._keepZoom = false;
        this.followHighlight();
    }
    this.renderLite();
    var tip = this.$('tip');
    if (this.status === 'ready' && this.layout === 'mobile' && this._tipStrike !== undefined && this.byStrike[this._tipStrike]) tip.innerHTML = this.tipHtml(this.byStrike[this._tipStrike]);
};
Gex.prototype.followHighlight = function () {
    var h = this.highlight, m = this.model;
    if (!h || !m) return;
    var src = h.from === 'chain' ? m.chain : m;
    var p = h.key === 'spot' ? m.spot : src ? src[h.key] : null;
    if (p === null || p === undefined) this.highlight = null;
    else { h.price = p; h.label = h.label.replace(/\s\S+$/, ' ' + fmtLevel(h.key, p, this.cur)); }
};
Gex.prototype.renderLite = function () {
    var self = this;
    if (this.destroyed) return;
    if (this.zdte) {
        var noZdte = !!this.gexRaw && this.gexRaw.no_zero_dte === true;
        if (!this.gexRaw) {
            this.status = 'loading';
            this.renderOverlay(this.chart ? 'refreshing' : 'loading');
            this.ensureEcharts().catch(function () { return null; });
            return;
        }
        if (noZdte) {
            this.status = 'empty';
            this.el.removeAttribute('data-booting');
            this.clearChart();
            this.renderAll();
            this.emit('empty', { noZeroDte: true });
            return;
        }
    }
    if (!this.model.strikes.length) {
        this.status = 'empty';
        this.el.removeAttribute('data-booting');
        this.renderOverlay(null);
        this.clearChart();
        this.syncQuote();
        this.emit('empty', { expiry: this.zdte ? this.model.expiry : 'all' });
        return;
    }
    if (this.echartsOk) {
        this.status = 'ready';
        if (this.zdte) this.renderAll();
        else {
            this.renderOverlay(null);
            this.renderChart();
            this.syncQuote();
        }
        this.emit('ready', { model: this.model, raw: this.gexRaw });
        return;
    }
    this.status = 'loading';
    this.renderOverlay('loading');
    this.ensureEcharts().then(function () {
        if (!self.destroyed && self.status === 'loading') self.renderLite();
    }, function () {
        if (self.destroyed || self.status !== 'loading') return;
        self.status = 'error';
        self.error = { kind: 'echarts' };
        self.renderOverlay('error');
        self.emit('error', { kind: 'echarts' });
    });
};
Gex.prototype.ensureEcharts = function () {
    var self = this;
    if (!this.echartsReady) {
        this.echartsReady = nearViewport(this.el).then(function () { return self.loadEcharts(); })
            .then(function () { return true; }, function () { self.echartsReady = null; throw new Error('echarts'); });
    }
    return this.echartsReady;
};
Gex.prototype.updateLite = function (d) {
    if (!this.lite || this.destroyed) return;
    d = d || {};
    var zoomed = this.status === 'ready' && !!this.win && !this.atDefault;
    this.setLiteData(d.summary, d.data);
    if (!zoomed) this.win = null;
    this.renderLite();

    var tip = this.$('tip');
    if (this.status === 'ready' && this.layout === 'mobile' && this._tipStrike !== undefined && this.byStrike[this._tipStrike]) tip.innerHTML = this.tipHtml(this.byStrike[this._tipStrike]);
};
Gex.prototype.quoteRank = function () {
    return Math.min(Math.max(this.rank || 0, 0), 3);
};
Gex.prototype.sessionLive = function () {
    return !this.destroyed && !!this.model && this.model.marketOpen === true && Date.now() < M.sessionBoundsET(M.todayET()).close;
};
Gex.prototype.quoteLive = function () { return this.liveOn && !this.zdte && this.status === 'ready' && !!QUOTE_MS[this.quoteRank()] && this.sessionLive(); };
Gex.prototype.applyPrice = function () {
    var m = this.model;
    if (!m) return;
    this.current = M.currentPrice(this.summary, this.quote, m.marketOpen === true);
    if (this.current) m.spot = this.current.price;
};
Gex.prototype.syncQuote = function () {
    var self = this;
    clearTimeout(this._quoteTimer);
    this._quoteTimer = null;
    if (!this.quoteLive() || this.quotePaused) return;
    if (!this._quoteWatch) {
        this._quoteWatch = true;
        this.on(document, 'visibilitychange', function () { if (document.visibilityState === 'visible') self.syncQuote(); });
        if ('IntersectionObserver' in root) {
            this.io = new IntersectionObserver(function (entries) {
                self._onScreen = entries.some(function (e) { return e.isIntersecting; });
                if (self._onScreen) self.syncQuote();
            });
            this.io.observe(this.el);
        } else this._onScreen = true;
    }
    if (this._quoteRunning) return;
    var wait = Math.max(0, (this._quoteAt || 0) + QUOTE_MS[this.quoteRank()] - Date.now());
    this._quoteTimer = setTimeout(function () { self.quoteTick(); }, wait);
};
Gex.prototype.quoteTick = async function () {
    this._quoteTimer = null;
    if (!this.quoteLive() || this.quotePaused) return;
    if (document.visibilityState === 'hidden' || !this._onScreen) return;
    this._quoteRunning = true;
    var r = null, skip = false;
    try {
        if (!this._quotaUnlimited) {
            var acct = await this.api.fetchAccount();
            if (this.destroyed) return;
            if (acct) this.setQuota(acct);
            skip = !acct || M.belowQuotaReserve(acct, LIVE_QUOTA_RESERVE);
        }
        if (!skip) r = await this.api.fetchQuote(this.symbol);
    } finally { this._quoteRunning = false; }
    if (this.destroyed) return;
    this._quoteAt = Date.now();

    if (skip) return this.syncQuote();
    if (r.ok) {
        var q = M.quotePrice(r.data);
        if (q) {
            this.quote = q;
            this.applyPrice();
            var h = this.highlight;
            if (h && h.key === 'spot') { h.price = this.model.spot; h.label = 'Spot ' + fmtLevel('spot', h.price, this.cur); }
            if (this.status === 'ready') { this.renderLevels(); this.renderChart(); }
        }
    } else {
        var kind = r.error && r.error.kind;
        if (kind === 'quota' || kind === 'locked') this.quotePaused = kind === 'quota' ? 'quota' : 'error';
    }
    this.syncQuote();
};
Gex.prototype.load = async function (opts) {
    opts = opts || {};
    var self = this;
    var seq = this._loadSeq = (this._loadSeq || 0) + 1;
    var stale = function () { return self.destroyed || seq !== self._loadSeq; };
    clearTimeout(this._liveTimer);
    this._liveTimer = null;
    this.livePaused = null;
    this._liveBatch = false;
    this.lastLoad = Date.now();
    this.armRefresh();
    this.status = 'loading';
    this.error = null;
    this.emit('loading', { symbol: this.symbol, refresh: !!opts.refresh });
    this.today = M.todayET();
    this.renderOverlay(opts.refresh ? 'refreshing' : 'loading');
    this.renderToolbar();
    var access = M.symbolAccess(this.symbol, this.assetType, this.rank, this.api.deniedSymbol(this.symbol));
    var summaryP = Promise.resolve(null);
    var needSummary = (!this.summaryProvided || opts.refresh) && !(access.locked && access.reason !== 'futures');
    if (needSummary) {
        summaryP = this.api.fetchSummary(this.symbol).then(function (r) {
            if (r.ok) { if (!stale()) { self.summary = r.data; self._summaryAt = Date.now(); } return null; }
            self.symbolRefused(r.error);
            return r.error;
        });
    } else if (!this._summaryAt) this._summaryAt = Date.now();
    if (access.locked) {
        await summaryP;
        if (stale()) return;
        this.setLocked(access.requiredRank, access.reason, access.message);
        return;
    }
    var expiry = this.expiry || this.requestedExpiry;
    if (expiry === 'auto' || (expiry && M.expiryLocked(expiry, this.rank, this.today))) {
        if (this.rank >= 2) expiry = 'all';
        else {
            var er = await this.api.fetchExpiries(this.symbol, this.today);
            if (stale()) return;
            if (!er.ok) { await summaryP; if (stale()) return; return this.fail(this.symbolRefused(er.error)); }
            this.expiries = er.data;
            expiry = M.defaultExpiry(this.expiries, this.rank, this.today);
            if (!expiry) { await summaryP; if (stale()) return; return this.setEmpty(); }
        }
    }
    this.expiry = expiry;
    var gexP = (this.gexRaw && !opts.refresh && !opts.expiryChange) ? Promise.resolve({ ok: true, data: this.gexRaw }) : this.api.fetchGex(this.symbol, expiry);
    var flowP = this.view === 'flow' && this.rank >= FLOW_RANK ? this.api.fetchFlow(this.symbol, expiry) : Promise.resolve(null);
    var results = await Promise.all([summaryP, gexP, flowP]);
    if (stale()) return;
    var gr = results[1];
    if (!gr.ok) return this.fail(expiry !== 'all' && expiry !== this.today ? this.symbolRefused(gr.error) : gr.error);
    this.gexRaw = gr.data;
    this.model = M.buildModel({ symbol: this.symbol, assetType: this.assetType, summary: this.summary, gex: this.gexRaw, expiry: expiry, minOi: MIN_OI });
    this.applyPrice();
    this.byStrike = {};
    this.model.strikes.forEach(function (s) { self.byStrike[s.strike] = s; });
    var flowErr = this.applyFlow(results[2]);
    if (!this.model.strikes.length) return this.setEmpty();
    this.status = 'ready';
    this.win = null;
    this.userRange = null;
    this.zoomBack = null;
    this.highlight = null;
    this.recordTrail();
    this.renderHeader();
    this.renderToolbar();
    this.renderLevels();
    await this.echartsReady;
    if (stale()) return;
    if (!this.ec) return this.fail({ kind: 'echarts' });
    this.renderAll();
    if (flowErr) this.flowFailed(flowErr);

    else if (this.view === 'flow' && !this.model.flow) this.loadFlow();
    this.emit('ready', { model: this.model, raw: this.gexRaw });
    this.armRefresh();
    this.scheduleLive();
    this.syncLayers(opts.refresh ? 'refresh' : 'load');
};
Gex.prototype.applyFlow = function (r) {
    if (!r) return null;
    if (r.ok && this.model) { this._flowRaw = r.data; M.attachFlow(this.model, r.data); return null; }
    if (this.view === 'flow') this.view = 'net';
    return r.error || { kind: 'network' };
};
Gex.prototype.flowFailed = function (err) {
    if (err.kind === 'locked') { this.showPopover(FLOW_WHAT, err.requiredRank || FLOW_RANK); return; }
    this.showMessage(err.kind === 'quota' || err.kind === 'concurrency'
        ? 'Session flow is rate-limited right now. The chart shows Net GEX instead.'
        : 'Couldn’t load today’s session flow. The chart shows Net GEX instead.');
};
Gex.prototype.loadFlow = async function () {
    var expiry = this.expiry, model = this.model;
    this.renderOverlay('refreshing');
    var r = await this.api.fetchFlow(this.symbol, expiry);

    if (this.destroyed || this.model !== model || this.status !== 'ready') return;
    var err = this.applyFlow(r);
    this.renderAll();
    if (err) this.flowFailed(err);
};
Gex.prototype.symbolRefused = function (err) {
    if (!err || err.kind !== 'locked' || M.isFutures(this.symbol, this.assetType)) return err;
    var entry = this.api.rememberDenied(this.symbol, err);
    return Object.assign({}, err, { reason: 'symbol', requiredRank: entry.rank });
};
Gex.prototype.setLocked = function (requiredRank, reason, message) {
    this.status = 'locked';
    this.lockInfo = { rank: requiredRank || 2, reason: reason || null, message: message || null };
    this.model = this.summary ? M.buildModel({ symbol: this.symbol, assetType: this.assetType, summary: this.summary, gex: {}, expiry: 'all' }) : null;
    this.renderAll();
    this.emit('locked', { requiredPlan: M.PLAN_NAME[this.lockInfo.rank], reason: this.lockInfo.reason });
};
Gex.prototype.setEmpty = function () {
    this.status = 'empty';
    if (!this.model && this.summary) this.model = M.buildModel({ symbol: this.symbol, assetType: this.assetType, summary: this.summary, gex: {}, expiry: 'all' });
    this.renderAll();
    this.emit('empty', { expiry: this.expiry || null });
    this.armRefresh();
};
Gex.prototype.fail = function (err) {
    err = err || { kind: 'network' };
    if (err.kind === 'locked') return this.setLocked(err.requiredRank, err.reason || null, err.message || null);
    this.status = err.kind === 'quota' || err.kind === 'concurrency' ? 'limit' : err.kind === 'not_found' ? 'not_found' : 'error';
    this.error = err;
    if (this.summary) this.model = M.buildModel({ symbol: this.symbol, assetType: this.assetType, summary: this.summary, gex: {}, expiry: 'all' });
    this.renderAll();
    if (this.status === 'limit') this.emit('rate-limited', { kind: err.kind, resetAt: err.resetAt || null, retryAfter: err.retryAfter || null });
    else this.emit('error', { kind: err.kind, code: err.code || null });
    this.armRefresh();
};
Gex.prototype.armRefresh = function () {
    var self = this;
    clearTimeout(this._refreshTimer);
    var btn = this.$('refresh');
    if (!btn) return;
    btn.disabled = true;
    this._refreshTimer = setTimeout(function () { if (!self.destroyed) btn.disabled = false; }, Math.max(0, REFRESH_MS - (Date.now() - this.lastLoad)));
};
Gex.prototype.liveEnabled = function () {
    return this.liveOn && !this.destroyed && !this.zdte && !!LIVE_MS[this.rank] && this.status === 'ready' && !!this.model && this.model.marketOpen === true;
};
Gex.prototype.scheduleLive = function () {
    var self = this;
    clearTimeout(this._liveTimer);
    this._liveTimer = null;
    if (this.liveEnabled() && !this.livePaused) {
        var wait = Math.max(0, this.lastLoad + LIVE_MS[this.rank] - Date.now());
        this._liveTimer = setTimeout(function () { self.liveTick(); }, wait);
    }
    this.renderLive();
};
Gex.prototype.busy = function () {
    var self = this;
    var menuOpen = Object.keys(MENUS).some(function (n) { var m = self.$(MENUS[n][1]); return !!m && !m.hidden; });
    var pop = this.$('pop'), ov = this.$('overlay');
    return menuOpen || !!this._upgrade || (!!pop && !pop.hidden) || (!!ov && ov.getAttribute('data-state') === 'refreshing');
};
Gex.prototype.liveTick = async function () {
    var self = this;
    this._liveTimer = null;
    if (!this.liveEnabled() || this.livePaused) return this.renderLive();
    if (document.visibilityState === 'hidden') return;
    if (this.busy()) { this._liveTimer = setTimeout(function () { self.liveTick(); }, LIVE_BUSY_RETRY_MS); return; }
    this._liveRunning = true;
    try {
        var seq = this._loadSeq;
        if (!this._quotaUnlimited) {
            var q = await this.api.fetchAccount();
            if (this.destroyed || seq !== this._loadSeq) return;
            if (!q) return this.scheduleLiveAfterFailure();
            this.setQuota(q);
            if (M.belowQuotaReserve(q, LIVE_QUOTA_RESERVE)) {
                this.livePaused = 'quota';
                return this.scheduleLive();
            }
        }
        this._liveBatch = true;
        await this.liveRefresh();
    } finally {
        this._liveRunning = false;
    }
};
Gex.prototype.scheduleLiveAfterFailure = function () {
    this.lastLoad = Date.now();
    this.scheduleLive();
};

Gex.prototype.liveRefresh = async function () {
    var self = this;
    var seq = this._loadSeq, expiry = this.expiry;
    var stale = function () { return self.destroyed || seq !== self._loadSeq || self.status !== 'ready'; };
    var withSummary = Date.now() - (this._summaryAt || 0) >= LIVE_SUMMARY_MS;
    var flowOn = this.view === 'flow' && this.rank >= FLOW_RANK;
    var results = await Promise.all([
        withSummary ? this.api.fetchSummary(this.symbol) : Promise.resolve(null),
        this.api.fetchGex(this.symbol, expiry),
        flowOn ? this.api.fetchFlow(this.symbol, expiry) : Promise.resolve(null)
    ]);
    if (stale()) return;
    var sr = results[0], gr = results[1], fr = results[2];
    if (!gr.ok) {
        var e = gr.error || {};
        if (e.kind === 'quota' || e.kind === 'locked') { this.livePaused = e.kind === 'quota' ? 'quota' : 'error'; return this.scheduleLive(); }
        return this.scheduleLiveAfterFailure();
    }
    if (sr && sr.ok) { this.summary = sr.data; this._summaryAt = Date.now(); }
    this.gexRaw = gr.data;
    this.model = M.buildModel({ symbol: this.symbol, assetType: this.assetType, summary: this.summary, gex: this.gexRaw, expiry: expiry, minOi: MIN_OI });
    this.applyPrice();
    this.byStrike = {};
    this.model.strikes.forEach(function (s) { self.byStrike[s.strike] = s; });
    if (fr && fr.ok) { this._flowRaw = fr.data; M.attachFlow(this.model, fr.data); }
    else if (flowOn && this._flowRaw) M.attachFlow(this.model, this._flowRaw);
    this.lastLoad = Date.now();
    this.armRefresh();
    if (!this.model.strikes.length) return this.setEmpty();
    this.recordTrail();
    this.applyLayers();
    this.followHighlight();
    this.renderHeader();
    this.renderToolbar();
    this.renderLevels();
    this.renderChart();
    this.renderTrail();
    var tip = this.$('tip');
    if (this.layout === 'mobile' && this._tipStrike !== undefined && this.byStrike[this._tipStrike]) tip.innerHTML = this.tipHtml(this.byStrike[this._tipStrike]);

    if (this.view === 'flow' && !this.model.flow) this.loadFlow();
    this.emit('ready', { model: this.model, raw: this.gexRaw, live: true });
    this.emit('live-update', { model: this.model });
    this.scheduleLive();
    this.syncQuote();

    this.syncLayers('live');
};
Gex.prototype.renderLive = function () {
    var el = this.$('live');
    if (!el) return;
    var on = this.liveEnabled();
    el.hidden = !on;
    if (!on) return;
    var text = this.livePaused === 'quota' ? 'Live paused – daily quota low' : this.livePaused ? 'Live paused' : 'Live';
    el.lastElementChild.textContent = text;
    el.title = this.livePaused ? 'Use Refresh to update by hand.' : 'Updates every ' + this.liveEvery() + ' while the market is open and this tab is visible.';
    if (this.livePaused) el.setAttribute('data-paused', ''); else el.removeAttribute('data-paused');
};
Gex.prototype.liveEvery = function () {
    var ms = LIVE_MS[this.rank];
    return ms >= 60000 ? (ms / 60000) + ' min' : (ms / 1000) + ' s';
};

Gex.prototype.setQuota = function (q) {
    if (!q) return;
    this._quota = q;
    if (q.unlimited) this._quotaUnlimited = true;
};
Gex.prototype.layerCtx = function () {
    return {
        scope: this.expiry === 'all' ? 'all' : 'single',
        view: this.view,
        hasToday: this.expiries ? this.expiries.indexOf(this.today) !== -1 : null,
        afterClose: M.afterCloseET(),
        lockedRank: this.layerLocked
    };
};
Gex.prototype.layerAccess = function (key) { return M.layerAccess(key, this.rank, this.layerCtx()); };
Gex.prototype.layerOn = function (key) { return !!this.layers[key] && this.layerAccess(key) === 'ok'; };
Gex.prototype.applyLayers = function () {
    var m = this.model;
    if (!m || this.zdte) return;
    var d = this.layerData;
    var pick = this.layerOn('em') && d.em ? M.pickExpectedMove(d.em.raw, this.expiry, this.today, M.afterCloseET()) : null;
    this._emPick = pick;
    m.em = pick && pick.em ? pick.em : null;
    m.emLow = m.em ? m.em.lo : null;
    m.emHigh = m.em ? m.em.hi : null;
    m.pin = this.layerOn('pin') && d.pin && d.pin.expiry === this.expiry ? M.normalizePinRisk(d.pin.raw) : null;
    m.magnet = m.pin ? m.pin.magnet : null;
    m.zdte = this.layerOn('zdte') && d.zdte && d.zdte.day === this.today ? M.normalizeZdte(d.zdte.raw, this.today) : null;
    var h = this.highlight;
    if (h && LAYER_LEVEL[h.key] && (m[h.key] === null || m[h.key] === undefined)) this.highlight = null;
};
Gex.prototype.syncLayers = function (mode) {
    if (this.status !== 'ready' || this.destroyed) return;
    var self = this;
    M.LAYER_KEYS.forEach(function (key) {
        if (key === 'trail' || !self.layerOn(key)) return;
        if (mode === 'toggle' && self.layerBusy[key]) return;
        var d = self.layerData[key];
        var missing = !d || (key === 'pin' && d.expiry !== self.expiry) || (key === 'zdte' && d.day !== self.today);
        if (missing || mode === 'refresh') return self.fetchLayer(key);
        if (mode === 'toggle') return;
        if (key !== 'em' || Date.now() - d.at >= EM_LIVE_MS) self.fetchLayer(key);
    });
};
Gex.prototype.fetchLayer = async function (key) {
    var seq = this._loadSeq, expiry = this.expiry, today = this.today, sym = this.symbol;
    var token = {};
    this.layerBusy[key] = token;
    this.renderLayersMenu();
    var r = null;
    try {
        if ((key === 'pin' && expiry === 'all') || key === 'zdte') {
            if (!this.expiries) {
                var er = await this.api.fetchExpiries(sym, today);
                if (er.ok) { if (!this.destroyed) this.expiries = er.data; } else r = er;
            }
        }
        if (r) {  }
        else if (key === 'em') r = await this.api.fetchExpectedMove(sym);
        else if (key === 'pin') {

            var pinExp = expiry === 'all' ? M.nearestExpiry(this.expiries, today, M.afterCloseET()) : expiry;
            r = pinExp ? await this.api.fetchPinRisk(sym, pinExp) : { ok: false, error: { kind: 'http' } };
        }
        else if (key === 'zdte' && this.layerOn('zdte')) r = await this.api.fetchGex(sym, today, 'zdte');
    } catch (e) { r = { ok: false, error: { kind: 'network' } }; }
    if (this.layerBusy[key] !== token) return;
    this.layerBusy[key] = null;
    if (this.destroyed) return;
    if (seq !== this._loadSeq) { this.renderLayersMenu(); return; }
    if (r && r.ok) {
        this.layerData[key] = { raw: r.data, at: Date.now(), expiry: expiry, day: today };
        this.layerErr[key] = false;
    } else if (r) {
        var e = r.error || {};
        this.layerData[key] = null;
        var req = e.requiredRank || Math.min(3, (this.rank || 0) + 1);
        if (e.kind === 'locked' && req > (this.rank || 0)) this.layerLocked[key] = req;
        else this.layerErr[key] = true;
    }
    this.renderLayers();
};

Gex.prototype.renderLayers = function () {
    this.applyLayers();
    this.renderToolbar();
    if (this.status !== 'ready') return;
    this.renderLevels();
    this.renderChart();
    this.renderTrail();
};
Gex.prototype.layerNote = function (key) {
    if (this.layerBusy[key]) return 'Loading…';
    if (this.layerErr[key]) return M.layerMeta(key).label + ' unavailable';
    var pick = this._emPick;
    if (key === 'em' && this.layerData.em && pick && !pick.em) return 'Expected move unavailable' + (pick.expiry ? ' for ' + pick.expiry : '');
    return '';
};
Gex.prototype.renderLayersMenu = function () {
    var menu = this.$('layers-menu');
    if (!menu) return;
    var self = this;
    var ctx = this.layerCtx();
    var active = M.LAYER_KEYS.filter(function (k) { return self.layerOn(k); }).length;
    var label = 'Layers' + (active ? ' (' + active + ')' : '');
    var btn = this.$('layers-btn');
    if (btn) {
        btn.innerHTML = '<span class="min-w-0 truncate">Layers' + (active ? ' <b>(' + active + ')</b>' : '') + '</span>' + CHEVRON;
        btn.title = label;
    }
    var ibtn = this.$('layers-ibtn');
    if (ibtn) {
        ibtn.setAttribute('aria-label', label);
        ibtn.title = label;
        if (active) ibtn.setAttribute('data-on', ''); else ibtn.removeAttribute('data-on');
    }
    var focused = document.activeElement && menu.contains(document.activeElement) ? document.activeElement.getAttribute('data-layer') : null;
    menu.innerHTML = M.LAYERS.map(function (L) {
        var acc = self.layerAccess(L.key);
        if (acc === 'locked') {
            var plan = M.PLAN_NAME[M.layerRank(L.key, ctx)];
            return '<button type="button" role="menuitem" data-layer="' + L.key + '" data-locked="1" title="' + esc(L.what + ' needs the FlashAlpha ' + plan + ' plan') + '">' +
                '<span>' + esc(L.label) + '</span>' + LOCK + '<span class="text-[11px] font-bold text-[color:var(--fagex-flip)]">' + esc(plan) + '</span></button>';
        }
        var usable = acc === 'ok';
        var on = !!self.layers[L.key];
        var note = usable ? (on ? self.layerNote(L.key) : '') : acc;
        return '<button type="button" role="menuitemcheckbox" data-layer="' + L.key + '" aria-checked="' + on + '"' +
            (usable ? '' : ' aria-disabled="true" title="' + esc(acc) + '"') + '>' +
            '<span class="flex-none grid place-items-center w-4 h-4 rounded border ' +
                (on ? 'border-[color:var(--fagex-on)] bg-[color:var(--fagex-on)] text-[color:var(--fagex-on-text)]' : 'border-[color:var(--fagex-border)]') + '">' + (on ? CHECK : '') + '</span>' +
            '<span class="flex flex-col min-w-0"><span>' + esc(L.label) + '</span>' +
                (note ? '<small class="text-[11px] text-[color:var(--fagex-muted)]">' + esc(note) + '</small>' : '') + '</span></button>';
    }).join('');
    if (focused) {
        var f = menu.querySelector('[data-layer="' + focused + '"]');
        if (f) f.focus();
    }
};
Gex.prototype.layerClick = function (key) {
    var acc = this.layerAccess(key);
    if (acc === 'locked') { this.closeMenus(); return this.showLayerLock(key); }
    if (acc !== 'ok') return;
    this.layers[key] = !this.layers[key];
    this.layersChosen = true;
    if (!this.layers[key]) this.layerErr[key] = false;
    this.savePrefs();
    this.renderLayers();
    if (this.layers[key]) this.syncLayers('toggle');
};
Gex.prototype.showLayerLock = function (key) {
    var L = M.layerMeta(key);
    var rank = M.layerRank(key, this.layerCtx());
    var plan = M.PLAN_NAME[rank];
    this.showPopover(L.what, rank, 'layer', { title: L.what + ' is included from the FlashAlpha ' + plan + ' plan', lead: L.lead, feature: key });
};
Gex.prototype.showPinInfo = function () {
    var pin = this.model && this.model.pin;
    if (pin) this.showMessage(this.pinText(pin));
};
Gex.prototype.pinText = function (pin) {
    return 'Pin risk ' + pin.score + '/100 · ' + (pin.expiry ? 'Exp ' + pin.expiry : 'nearest expiry') + ' · ' + M.pinBreakdownText(pin);
};
Gex.prototype.recordTrail = function () {
    var m = this.model;
    if (!m || m.marketOpen !== true) return;
    var pts = this.api.readTrail(this.symbol);
    var p = M.trailPoint(this.summary, pts.length ? pts[pts.length - 1][0] : null);
    if (p) this.api.appendTrail(this.symbol, p);
};
Gex.prototype.disposeTrail = function () {
    if (this.trailChart) { this.trailChart.dispose(); this.trailChart = null; }
};
Gex.prototype.renderTrail = function () {
    var panel = this.$('trail'), stage = this.$('stage');
    if (!panel || !stage) return;
    var on = this.status === 'ready' && !!this.model && this.layerOn('trail');
    panel.hidden = !on;
    if (on) stage.setAttribute('data-trail', ''); else stage.removeAttribute('data-trail');
    if (!on) { this.disposeTrail(); return; }
    var pts = this.api.readTrail(this.symbol);
    var msg = this.model.marketOpen === false && !pts.length ? 'No trail yet today.' : pts.length < 2 ? 'Trail starts with the next live update.' : '';
    var msgEl = this.$('trail-msg'), box = this.$('trail-chart');
    msgEl.textContent = msg;
    msgEl.hidden = !msg;
    box.hidden = !!msg;
    if (msg || !this.ec) { this.disposeTrail(); return; }
    if (!this.trailChart) this.trailChart = this.ec.init(box, this.theme(), { renderer: 'canvas', devicePixelRatio: root.devicePixelRatio || 1 });
    this.trailChart.setOption(this.trailOption(pts), { notMerge: true });
};
Gex.prototype.trailOption = function (pts) {
    var p = T.palette(this.theme());
    var cur = this.cur, mobile = this.layout === 'mobile';
    var session = M.sessionBoundsET(this.today);
    var byT = {};
    pts.forEach(function (x) { byT[x[0]] = x; });
    var fmtEt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
    var etTime = function (t) { try { return fmtEt.format(new Date(t)); } catch (e) { return ''; } };
    var dots = pts.length < 30;
    return {
        animation: false,
        grid: { left: this.gridSides().left, right: 16, top: 6, bottom: 18 },
        xAxis: {
            type: 'time', min: session.open, max: session.close, splitNumber: mobile ? 3 : 6,
            axisLabel: { color: p.muted, fontSize: 9, hideOverlap: true, formatter: function (v) { return etTime(v); } },
            splitLine: { show: false }
        },
        yAxis: {
            type: 'value', scale: true, splitNumber: 2,
            axisLabel: { color: p.muted, fontSize: 9, formatter: function (v) { return M.fmtAxisStrike(v, cur); } },
            splitLine: { lineStyle: { color: p.grid } }
        },
        tooltip: {
            trigger: 'axis', confine: true,
            backgroundColor: p.tooltipBg, borderColor: p.tooltipBorder, textStyle: { color: p.text, fontSize: 11 },
            formatter: function (params) {
                var t = params && params[0] && params[0].value && params[0].value[0];
                var x = byT[t];
                if (!x) return '';
                var flip = x[2] === null ? '– (' + M.noFlipReason(x[3]) + ')' : M.fmtPrice(x[2], cur) + (x[3] && x[3] !== 'available' ? ' (unverified)' : '');
                return esc(etTime(t) + ' ET') + '<br>Spot ' + esc(M.fmtPrice(x[1], cur)) + '<br>Flip ' + esc(flip);
            }
        },
        series: [{
            id: 'trail-spot', name: 'Spot', type: 'line', showSymbol: dots, symbolSize: 3,
            data: pts.map(function (x) { return [x[0], x[1]]; }),
            lineStyle: { color: p.spot, width: 1.5 }, itemStyle: { color: p.spot }
        }, {
            id: 'trail-flip', name: 'Flip', type: 'line', showSymbol: dots, symbolSize: 3, connectNulls: false,
            data: pts.map(function (x) { return [x[0], x[2]]; }),
            lineStyle: { color: p.flip, width: 1.5, type: 'dashed' }, itemStyle: { color: p.flip }
        }]
    };
};
Gex.prototype.bindUi = function () {
    var self = this;
    this.on(this.el, 'click', function (e) {
        var t = e.target.closest('button, a');
        if (!t || !self.el.contains(t)) return;
        self._liveBatch = false;
        if (t.dataset.view) { self.closeMenus(); return self.setView(t.dataset.view); }
        if (t.dataset.range) {
            self.closeMenus();
            return self.setRange(t.dataset.range === 'all' ? 'all' : Number(t.dataset.range));
        }
        if (t.dataset.expiry) return self.pickExpiry(t.dataset.expiry, t);
        if (t.dataset.level) return self.levelClick(t.dataset.levelGroup, t.dataset.level);
        if (t.dataset.edge) return self.extendTo(Number(t.dataset.edge));
        if (t.dataset.layer) return self.layerClick(t.dataset.layer);
        switch (t.dataset.r) {
            case 'exp-btn': return self.toggleExpiryMenu();
            case 'layers-btn': case 'layers-ibtn': return self.toggleMenu('layers');
            case 'range-btn': return self.toggleMenu('range');
            case 'view-btn': return self.toggleMenu('view');
            case 'labels': case 'm-labels': self.closeMenus(); return self.toggleLabels();
            case 'fullscreen': return self.toggleFullscreen();
            case 'reset': return self.resetZoom();
            case 'refresh': return self.refresh();
            case 'export': return self.exportPng();
            case 'orient': case 'm-orient':
                self.closeMenus();
                return self.setOrientation(self.vertical() ? 'horizontal' : 'vertical');
            case 'more': return self.toggleMenu('more');
            case 'retry': return self.pageData ? self.loadPageData({ refresh: true }) : self.load({ refresh: true });
            case 'pick-expiry': return self.toggleExpiryMenu(true);
            case 'pop-close': return self.closePopover();
            case 'pin-info': return self.showPinInfo();
        }
    });
    this.on(document, 'click', function (e) {
        if (!self.el.contains(e.target)) self.closePopover();
    });
    this.on(document, 'visibilitychange', function () {
        if (document.visibilityState === 'visible' && !self._liveTimer && !self._liveRunning) self.scheduleLive();
    });
    this.on(document, 'pointerdown', function (e) {
        Object.keys(MENUS).forEach(function (n) {
            var menu = self.$(MENUS[n][1]);
            var btns = self.menuButtons(n);
            if (!menu || menu.hidden || menu.contains(e.target) || btns.some(function (b) { return b.contains(e.target); })) return;
            menu.hidden = true;
            btns.forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
        });
    }, true);
    this.on(this.el, 'keydown', function (e) {
        if (e.key !== 'Escape') return;
        if (self._upgrade) { self.closeUpgrade(); return; }
        var open = !self.$('pop').hidden || Object.keys(MENUS).some(function (n) { var m = self.$(MENUS[n][1]); return !!m && !m.hidden; });
        self.closeMenus(); self.closePopover();
        if (!open && self.fullscreen && !fsElement()) self.setFullscreen(false);
    });
    ['fullscreenchange', 'webkitfullscreenchange'].forEach(function (type) {
        self.on(document, type, function () {
            if (self.fullscreen && fsElement() !== self.el) self.setFullscreen(false, true);
        });
    });
};
Gex.prototype.menuButtons = function (name) {
    var self = this;
    return [MENUS[name][0], MENUS[name][2]].map(function (r) { return r ? self.$(r) : null; }).filter(Boolean);
};
Gex.prototype.toggleMenu = function (name, force) {
    var btn = this.$(this.layout === 'mobile' && MENUS[name][2] ? MENUS[name][2] : MENUS[name][0]);
    var menu = this.$(MENUS[name][1]);
    if (!btn || !menu) return;
    var open = force !== undefined ? force : menu.hidden;
    this.closeMenus();
    if (open && menu.parentNode !== btn.parentNode) btn.parentNode.appendChild(menu);
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
        var first = menu.querySelector('[aria-selected="true"]') || menu.querySelector('button:not([disabled])');
        if (first) first.focus();
    }
};
Gex.prototype.closeMenus = function () {
    Object.keys(MENUS).forEach(function (n) {
        var menu = this.$(MENUS[n][1]);
        if (menu) menu.hidden = true;
        this.menuButtons(n).forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
    }, this);
};
Gex.prototype.toggleExpiryMenu = async function (force) {
    var menu = this.$('exp-menu');
    if (!menu) return;
    if (!menu.hidden && force === undefined) { this.closeMenus(); return; }
    this.toggleMenu('exp', true);
    if (!this.expiries) {
        menu.innerHTML = '<div class="' + TW.menuNote + '">Loading expiries…</div>';
        var r = await this.api.fetchExpiries(this.symbol, this.today);
        if (this.destroyed) return;
        if (!r.ok) { menu.innerHTML = '<div class="' + TW.menuNote + '">Could not load expiries.</div>'; return; }
        this.expiries = r.data;
        this.renderToolbar();
    }
    this.renderExpiryMenu();
    var cur = menu.querySelector('[aria-selected="true"]') || menu.querySelector('button');
    if (cur) cur.focus();
};
Gex.prototype.renderExpiryMenu = function () {
    var menu = this.$('exp-menu');
    if (!menu) return;
    var self = this;
    var items = ['all'].concat((this.expiries || []).filter(function (e) { return e >= self.today; }));
    menu.innerHTML = items.map(function (e) {
        var locked = M.expiryLocked(e, self.rank, self.today);
        var label = e === 'all' ? 'All expiries' : fmtExpiry(e, self.today);
        return '<button type="button" role="option" data-expiry="' + esc(e) + '" aria-selected="' + (e === self.expiry) + '"' +
            (locked ? ' data-locked="1"' : '') + '>' +
            '<span>' + esc(label) + '</span>' + (locked ? LOCK + '<span class="text-[11px] font-bold text-[color:var(--fagex-flip)]">Growth</span>' : '') + '</button>';
    }).join('');
};
Gex.prototype.pickExpiry = function (expiry, btn) {
    if (btn && btn.dataset.locked) {
        this.closeMenus();
        this.showPopover(expiry === 'all' ? 'All expiries (the full chain)' : 'Same-day (0DTE) expiries', 2);
        return;
    }
    this.closeMenus();
    this.setExpiry(expiry);
};
Gex.prototype.showPopover = function (what, rank, reason, copy) {
    var plan = M.PLAN_NAME[rank];
    copy = copy || {};
    var feature = copy.feature || reason || 'expiry';
    this.closePopover();
    this.openUpgrade({
        title: copy.title || what + ' ' + (what.indexOf('expir') !== -1 ? 'need' : 'needs') + ' the FlashAlpha ' + plan + ' plan',
        lead: copy.lead || 'Upgrade to ' + plan + ' to unlock it on this chart.',
        rank: rank,
        feature: feature
    });
    this.emit('locked', { feature: feature, requiredPlan: plan, reason: reason || 'expiry' });
};
Gex.prototype.upgradeNote = function (rank) {
    if (!this.upgradeNoteFn) return '';
    try { return String(this.upgradeNoteFn(M.PLAN_SLUG[rank] || null, rank) || ''); } catch (e) { return ''; }
};
Gex.prototype.openUpgrade = function (o) {
    var self = this;
    this.closeUpgrade();
    var plan = M.PLAN_NAME[o.rank] || 'a higher';
    var href = this.upgradeUrl(o.rank, 'upgrade_' + o.feature);
    var note = this.upgradeNote(o.rank);
    var id = 'fagex-upgrade-' + Math.random().toString(36).slice(2, 8);
    var node = document.createElement('div');
    node.className = 'fixed inset-0 z-[2147483001] flex items-center justify-center p-4 bg-[rgba(2,6,23,.8)] backdrop-blur-[16px]';
    node.setAttribute('data-r', 'upgrade');
    node.setAttribute('role', 'dialog');
    node.setAttribute('aria-modal', 'true');
    node.setAttribute('aria-labelledby', id);
    node.innerHTML =
        '<div class="w-full max-w-lg overflow-hidden rounded-2xl border border-[color:var(--fagex-border)] bg-[color:var(--fagex-raised)] text-left shadow-[0_25px_50px_-12px_rgba(0,0,0,.6)]">' +
            '<div class="h-1 bg-[linear-gradient(90deg,#3b82f6,#6366f1,#a855f7)]"></div>' +
            '<div class="p-8 ' + MOBILE + 'p-6">' +
                '<div class="flex items-start gap-4 mb-5">' +
                    '<div class="flex flex-none items-center justify-center w-12 h-12 rounded-xl border border-[rgba(245,158,11,.25)] bg-[rgba(245,158,11,.1)] text-[color:var(--fagex-flip)]">' +
                        '<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>' +
                    '</div>' +
                    '<div>' +
                        '<h3 id="' + id + '" class="text-lg/[1.4] font-bold text-[color:var(--fagex-text)]">' + esc(o.title) + '</h3>' +
                        (o.lead ? '<p class="mt-1 text-sm/[1.45] text-[color:var(--fagex-muted)]">' + esc(o.lead) + '</p>' : '') +
                    '</div>' +
                '</div>' +
                (note ? '<p class="mb-5 text-center text-xs text-[color:var(--fagex-muted)]" data-um="note">' + esc(note) + '</p>' : '') +
                '<div class="flex items-center justify-center gap-3 ' + MOBILE + 'flex-col-reverse ' + MOBILE + 'items-stretch">' +
                    '<button type="button" class="px-6 py-3 rounded-lg text-sm font-medium text-[color:var(--fagex-muted)] hover:bg-[color:var(--fagex-btn-hover)] hover:text-[color:var(--fagex-text)]" data-um="close">Maybe later</button>' +
                    '<a class="px-8 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 !text-white text-center text-sm font-bold no-underline shadow-[0_10px_15px_-3px_rgba(37,99,235,.25)]" href="' + esc(href) + '"' +
                        linkTarget(href) + attrHtml(this.upgradeAttrs) + ' data-um="cta">Upgrade to ' + esc(plan) + '</a>' +
                '</div>' +
            '</div>' +
        '</div>';
    this.el.appendChild(node);
    this._upgrade = { node: node, lastFocus: document.activeElement };
    node.addEventListener('click', function (e) {
        if (e.target === node || (e.target.closest && e.target.closest('[data-um="close"]'))) self.closeUpgrade();
    });
    var cta = node.querySelector('[data-um="cta"]');
    try { cta.focus(); } catch (e) { return; }
};
Gex.prototype.closeUpgrade = function () {
    var u = this._upgrade;
    if (!u) return;
    this._upgrade = null;
    if (u.node.parentNode) u.node.parentNode.removeChild(u.node);
    try { if (u.lastFocus && document.contains(u.lastFocus) && u.lastFocus.focus) u.lastFocus.focus(); } catch (e) { return; }
};
Gex.prototype.showMessage = function (text) {
    var pop = this.$('pop');
    if (!pop) return;
    this.closePopover();
    pop.innerHTML = '<p>' + esc(text) + '</p><div class="flex items-center gap-2"><button type="button" class="' + TW.btn + '" data-r="pop-close">Close</button></div>';
    pop.hidden = false;
};
Gex.prototype.closePopover = function () {
    var pop = this.$('pop');
    if (pop) pop.hidden = true;
};
Gex.prototype.savePrefs = function () {
    var p = { view: this.view, labels: this.labelsPref.wide, labelsMobile: this.labelsPref.mobile };
    if (this.savedOrient.orient) p.orient = this.savedOrient.orient;
    if (this.savedOrient.orientMobile) p.orientMobile = this.savedOrient.orientMobile;
    if (this.layersChosen) p.layers = this.zdte ? this.savedLayers : this.layers;
    this.store.set('prefs', p);
};
Gex.prototype.setView = function (view) {
    if (this.viewKeys.indexOf(view) === -1 || view === this.view) return;
    if (view === 'flow' && !(this.rank >= FLOW_RANK)) { this.showPopover(FLOW_WHAT, FLOW_RANK, 'flow'); return; }
    this.view = view;
    if (this.highlight && this.highlight.key === 'flowFlip' && view !== 'flow') { this.highlight = null; this.renderBlink(); }
    this.savePrefs();
    this.renderToolbar();
    if (this.status === 'ready') {
        if (view === 'flow' && !this.model.flow) this.loadFlow();
        else { this.renderHeader(); this.renderLevels(); this.renderChart(); this.renderFooter(); }
        this.syncLayers('toggle');
    }
    this.emit('view-change', { view: view });
};
Gex.prototype.setRange = function (range) {
    if (this.rangeKeys.indexOf(range) === -1) return;
    this.userRange = range;
    this.zoomBack = null;
    this.atDefault = true;
    this.savePrefs();
    this.renderToolbar();
    if (this.status === 'ready') this.applyWindow(this.defaultWindow());
    this.emit('range-change', { range: range });
};
Gex.prototype.setExpiry = function (expiry) {
    if (!expiry || expiry === this.expiry || this.status === 'guest' || this.pageData) return;
    if (M.expiryLocked(expiry, this.rank, this.today)) { this.showPopover(expiry === 'all' ? 'All expiries (the full chain)' : 'Same-day (0DTE) expiries', 2); return; }
    this.expiry = expiry;
    this.gexRaw = null;
    this.emit('expiry-change', { expiry: expiry });
    this.load({ expiryChange: true, trigger: 'expiry' });
};
Gex.prototype.refresh = function () {
    if (this.destroyed || this.status === 'guest' || Date.now() - this.lastLoad < REFRESH_MS) return false;
    if (this.pageData) {
        if (this.staticData) return false;
        this.loadPageData({ refresh: true });
        return true;
    }
    this.load({ refresh: true, trigger: 'refresh' });
    return true;
};
Gex.prototype.toggleLabels = function () {
    this.labelsOn = !this.labelsOn;
    this.labelsPref[this.labelsKey()] = this.labelsOn;
    this.savePrefs();
    this.renderToolbar();
    if (this.status === 'ready') this.renderChart();
};
Gex.prototype.setOrientation = function (o) {
    var v = o === 'vertical' || o === 'v' ? 'v' : o === 'horizontal' || o === 'h' ? 'h' : null;
    var key = this.labelsKey();
    if (!v || this.destroyed || v === this.orientPref[key]) return;
    this.orientPref[key] = v;
    if (!this.lite) {
        this.savedOrient[key === 'mobile' ? 'orientMobile' : 'orient'] = v;
        this.savePrefs();
        this.closeMenus();
        this.closePopover();
    }
    this.applyOrientation();
    this.emit('orientation-change', { orientation: this.orientation() });
    this.reload();
};
Gex.prototype.reload = function () {
    this.clearChart();
    this.disposeTrail();
    this.win = null;
    if (this.pageData) {
        this.zoomBack = null;
        if (this.zdte || this.model) this.renderLite();
        return;
    }
    if (this.status === 'guest' || this.status === 'locked') { this.renderOverlay(this.status); if (this.status === 'guest') return; }
    this.load({ refresh: true, trigger: 'orientation' });
};
Gex.prototype.applyOrientation = function () {
    var v = this.vertical();
    this.el.setAttribute('data-orient', v ? 'v' : 'h');
    var stage = this.$('stage');
    if (stage && !this.lite) {
        stage.className = stageClass(v);
        if (this.fullscreen) FS_CLASSES.stage.forEach(function (c) { stage.classList.add(c); });
    }
    this.renderOrientButton();
};
Gex.prototype.renderOrientButton = function () {
    var b = this.$('orient'), item = this.$('m-orient');
    if (!b) return;
    var v = this.vertical();
    var name = v ? 'Horizontal chart' : 'Vertical chart';
    b.innerHTML = toolIcon(v ? 'barsUp' : 'barsSide');
    b.setAttribute('aria-pressed', v ? 'true' : 'false');
    b.setAttribute('aria-label', name);
    b.title = name;
    b.disabled = this.status === 'loading';
    if (item) {
        item.innerHTML = '<span>' + name + '</span>';
        item.disabled = b.disabled;
    }
};
Gex.prototype.toggleFullscreen = function () { this.setFullscreen(!this.fullscreen); };
Gex.prototype.setFullscreen = function (on, fromBrowser) {
    if (on === this.fullscreen) return;
    this.fullscreen = on;
    var parts = { root: this.el, body: this.$('body'), stage: this.$('stage'), rail: this.$('rail'), concl: this.$('concl'), tip: this.$('tip'), foot: this.$('foot') };
    Object.keys(FS_CLASSES).forEach(function (k) {
        var node = parts[k];
        if (node) FS_CLASSES[k].forEach(function (c) { node.classList.toggle(c, on); });
    });
    if (on) {
        this._overflow = [document.documentElement, document.body].map(function (n) { var v = n.style.overflow; n.style.overflow = 'hidden'; return [n, v]; });
    } else if (this._overflow) {
        this._overflow.forEach(function (x) { x[0].style.overflow = x[1]; });
        this._overflow = null;
    }
    var btn = this.$('fullscreen');
    if (btn) {
        var label = on ? 'Exit full screen' : 'Full screen';
        btn.innerHTML = on ? FS_EXIT_ICON : FS_ICON;
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        btn.setAttribute('aria-label', label);
        btn.title = label;
    }
    if (fromBrowser) return;
    if (on) fsCall(this.el, ['requestFullscreen', 'webkitRequestFullscreen']);
    else if (fsElement() === this.el) fsCall(document, ['exitFullscreen', 'webkitExitFullscreen']);
};

Gex.prototype.applyTheme = function (name) {
    if (T.NAMES.indexOf(name) === -1) return;
    this.el.setAttribute('data-theme', name);
    if (this.chart) { this.chart.setTheme(name); this.renderChart(); }
    if (this.trailChart) { this.disposeTrail(); this.renderTrail(); }
};
Gex.prototype.setTheme = function (mode) {
    if (this._mq) { this._mq[0].removeEventListener('change', this._mq[1]); this._mq = null; }
    if (this.mo) { this.mo.disconnect(); this.mo = null; }
    this.themeMode = themeModeOf(mode);
    this.watchTheme();
    this.applyTheme(this.theme());
};
Gex.prototype.destroy = function () {
    this.destroyed = true;
    this.closeUpgrade();
    if (this.fullscreen) this.setFullscreen(false);
    clearTimeout(this._refreshTimer);
    clearTimeout(this._liveTimer);
    clearTimeout(this._quoteTimer);
    if (this.ro) this.ro.disconnect();
    if (this.io) this.io.disconnect();
    if (this.mo) this.mo.disconnect();
    if (this._mq) this._mq[0].removeEventListener('change', this._mq[1]);
    this._listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
    if (this.chart) this.chart.dispose();
    this.chart = null;
    this.disposeTrail();
    this.el.innerHTML = '';
};
Gex.prototype.defaultWindow = function () {
    var m = this.model;
    var range = this.range();
    if (range === 'auto') {
        var auto = this.layout === 'mobile' ? M.rangeWindow(m.strikes, m.spot, this.zdte ? 0.01 : 0.05) : this.autoWindow();
        if (auto) return auto;
        range = 'all';
    }
    return M.rangeWindow(m.strikes, m.spot, range);
};
Gex.prototype.autoWindow = function () {
    var m = this.model;
    function n(v) { return typeof v === 'number' && isFinite(v) ? v : null; }
    var c = m.chain || {};
    var levels = [n(m.maxPain) !== null ? m.maxPain : n(c.maxPain), n(m.putWall) !== null ? m.putWall : n(c.putWall),
        n(m.callWall) !== null ? m.callWall : n(c.callWall)]
        .filter(function (v) { return v !== null; });
    if (levels.length < 2) return null;
    var lo = Math.min.apply(null, levels), hi = Math.max.apply(null, levels);
    var pad = (hi - lo) * 0.4 || (M.minGap(m.strikes) || Math.abs(hi) * 0.01) * 3;
    return { lo: lo - pad, hi: hi + pad };
};

Gex.prototype.extent = function () {
    var m = this.model;
    var vals = [m.strikes[0].strike, m.strikes[m.strikes.length - 1].strike];
    this.chartLevels().forEach(function (l) { vals.push(l.price); });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var pad = (M.minGap(m.strikes) || (hi - lo) / 50 || 1) * 0.6;
    return { lo: lo - pad, hi: hi + pad };
};

Gex.prototype.zoomTo = function (win) {
    this.win = win;
    this._zooming = true;
    try { this.chart.dispatchAction({ type: 'dataZoom', startValue: win.lo, endValue: win.hi }); }
    finally { this._zooming = false; }
    this.onZoomed();
};
Gex.prototype.applyWindow = function (win) {
    if (!this.chart) return;
    var gap = M.minGap(this.model.strikes) || 0;
    this.zoomTo({ lo: win.lo - gap * 0.6, hi: win.hi + gap * 0.6 });
};
Gex.prototype.resetZoom = function () {
    if (this.status !== 'ready' || !this.chart) return;
    var back = this.zoomBack;
    if (back) {
        this.zoomBack = null;
        this.userRange = back.range;
        this.atDefault = back.atDefault;
        this.renderToolbar();
        this.zoomTo(back.win);
        return;
    }
    var toFive = this.zoomGoesToFive();
    this.zoomBack = this.win ? { win: this.win, range: this.userRange, atDefault: this.atDefault } : null;
    this.userRange = toFive ? this.zoomInRange() : null;
    this.atDefault = true;
    this.renderToolbar();
    this.applyWindow(this.defaultWindow());
};
Gex.prototype.zoomGoesToFive = function () {
    return !this.zoomBack && this.userRange === null && !!this.atDefault;
};
Gex.prototype.zoomInRange = function () {
    if (!this.zdte) return 0.05;
    return this.layout === 'mobile' ? 0.005 : 0.01;
};
Gex.prototype.extendTo = function (price) {
    if (!this.win || !isFinite(price)) return;
    var pad = Math.abs((this.model.spot || price) * 0.01);
    var lo = Math.min(this.win.lo, price - pad), hi = Math.max(this.win.hi, price + pad);
    this.atDefault = false;
    this.forgetZoomBack();
    this.renderZoomButton();
    this.zoomTo({ lo: lo, hi: hi });
};
Gex.prototype.forgetZoomBack = function () {
    if (!this.zoomBack) return;
    this.zoomBack = null;
    this.renderToolbar();
};
Gex.prototype.readWindow = function () {
    if (!this.chart) return;
    var dz = (this.chart.getOption().dataZoom || [])[0];
    if (dz && isFinite(dz.startValue) && isFinite(dz.endValue)) this.win = { lo: dz.startValue, hi: dz.endValue };
};
Gex.prototype.onZoomed = function () {
    var self = this;
    if (this._zoomRaf) return;
    var raf = root.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
    this._zoomRaf = raf(function () {
        self._zoomRaf = null;
        if (!self.chart || self.status !== 'ready') return;
        self.readWindow();
        var opt = { grid: self.grid(), series: self.seriesOption() };
        opt[self.vertical() ? 'xAxis' : 'yAxis'] = self.valueAxisOption();
        self.chart.setOption(opt, { lazyUpdate: true });
        self.renderBlink();
        self.renderPriceTag();
        self.renderVLabels();
        self.renderEdges();
        self.renderFooter();
    });
};
Gex.prototype.chartLevels = function () {
    var m = this.model;
    if (!m) return [];
    var levels = M.levelList(m, m.spot, { maxPain: this.features.maxPain && m.scope !== 'single', flowFlip: this.view === 'flow' });
    if (m.scope === 'single') {
        M.levelList(m.chain, m.spot, { spot: false }).forEach(function (l) {
            if (l.key === 'callWall' || l.key === 'putWall') levels.push(Object.assign({}, l, { label: l.label + ' (all exp.)' }));
        });
    }
    Object.keys(LAYER_LEVEL).forEach(function (key) {
        var price = m[key];
        if (price === null || price === undefined) return;
        var meta = LAYER_LEVEL[key];
        levels.push({ key: key, label: meta.label, short: meta.short, price: price, verified: true, order: meta.order });
    });
    levels.sort(function (a, b) { return b.price - a.price || a.order - b.order; });
    return levels;
};
function fmtLevel(key, price, cur) {
    return key === 'spot' || key === 'flip' || key === 'flowFlip' || key === 'emLow' || key === 'emHigh' ? M.fmtPrice(price, cur) : M.fmtStrike(price, cur);
}
Gex.prototype.levelText = function (group) {
    var lay = this.layout, cur = this.cur;
    var mobile = lay === 'mobile';
    var priceOf = function (i) { return fmtLevel(i.key, i.price, mobile ? '' : cur); };
    var isUnverified = function (i) { return i.key === 'flip' && !i.verified; };
    var first = group.items[0];
    var firstPrice = priceOf(first);
    var samePrice = group.items.every(function (i) { return priceOf(i) === firstPrice; });
    var unverified = group.items.some(isUnverified);
    if (mobile) {
        if (samePrice) return group.items.map(function (i) { return i.short; }).join('·') + ' ' + firstPrice + (unverified ? '?' : '');
        return group.items.map(function (i) { return i.short + ' ' + priceOf(i) + (isUnverified(i) ? '?' : ''); }).join('·');
    }
    if (samePrice) return group.label + ' ' + firstPrice + (unverified ? ' (unverified)' : '');
    return group.items.map(function (i) { return i.label + ' ' + priceOf(i) + (isUnverified(i) ? ' (unverified)' : ''); }).join(' · ');
};
Gex.prototype.levelStyle = function (key, verified) {
    var p = T.palette(this.theme());
    var s;
    switch (key) {
        case 'spot': s = { color: p.spot, type: 'solid', width: 1.5 }; break;
        case 'flip': s = { color: p.flip, type: 'dashed', width: 2, opacity: verified ? 1 : 0.45 }; break;
        case 'callWall': s = { color: p.callWall, type: 'solid', width: 1.5 }; break;
        case 'putWall': s = { color: p.putWall, type: 'solid', width: 1.5 }; break;
        case 'flowFlip': s = { color: p.flowFlip, type: 'dashed', width: 2 }; break;
        case 'emLow': case 'emHigh': s = { color: p.em, type: 'dotted', width: 1 }; break;
        case 'magnet': s = { color: p.magnet, type: 'dashed', width: 1.5 }; break;
        default: s = { color: p.maxPain, type: 'dashed', width: 2 };
    }
    return s;
};
Gex.prototype.isBlinking = function (key) {
    var h = this.highlight;
    return !!h && h.group === 'scope' && h.key === key && !reducedMotion();
};
Gex.prototype.labelPlan = function () {
    var self = this;
    var win = this.win;
    var inside = this.chartLevels().filter(function (l) { return l.key !== 'spot' && (!win || (l.price >= win.lo && l.price <= win.hi)); });
    var range = win || (this.model && this.model.strikes.length ? this.extent() : null);
    var sides = this.gridSides();
    var box = this.$('chart');
    var plotW = (this.chart ? this.chart.getWidth() : (box ? box.clientWidth : 0)) - sides.left - sides.right;
    var span = range ? (range.hi - range.lo) || 1 : 1;
    var size = this.layout === 'mobile' ? 10 : 11;
    var groups = [];
    var next = 0;
    [0, 1].forEach(function (row) {
        var rowLevels = inside.filter(function (l) { return (UPPER_ROW.indexOf(l.key) !== -1) === (row === 1); });
        var base = next;
        var ends = [];
        M.mergeLevels(rowLevels, self.model.spot).forEach(function (g) {
            g.text = self.levelText(g);
            var t = 0;
            if (self.labelsOn && range) {
                var x = (g.price - range.lo) / span * plotW;
                var half = (labelWidth(g.text, size) + 8) / 2;
                while (ends[t] !== undefined && ends[t] + LABEL_GAP_PX > x - half) t++;
                ends[t] = x + half;
            }
            g.tier = base + t;
            next = Math.max(next, g.tier + 1);
            groups.push(g);
        });
        if (next === base) next = base + 1;
    });
    return { groups: groups, tiers: Math.max(2, next) };
};
Gex.prototype.vLevelGroups = function () {
    var self = this;
    var win = this.win;
    var inside = this.chartLevels().filter(function (l) { return l.key !== 'spot' && (!win || (l.price >= win.lo && l.price <= win.hi)); });
    var groups = [];
    [0, 1].forEach(function (row) {
        var rowLevels = inside.filter(function (l) { return (UPPER_ROW.indexOf(l.key) !== -1) === (row === 1); });
        M.mergeLevels(rowLevels, self.model.spot).forEach(function (g) {
            g.text = self.levelText(g);
            g.tier = 0;
            groups.push(g);
        });
    });
    return groups;
};
Gex.prototype.markLines = function () {
    var self = this;
    var win = this.win;
    var data = [];
    var vertical = this.vertical();
    var axis = vertical ? 'yAxis' : 'xAxis';
    var labelsOn = this.labelsOn && !vertical;
    (vertical ? this.vLevelGroups() : this.labelPlan().groups).forEach(function (g) {
        g.items.forEach(function (item, i) {
            var ls = self.levelStyle(item.key, item.verified);
            var labelOpacity = ls.opacity === undefined ? 1 : ls.opacity;
            if (self.isBlinking(item.key)) ls = Object.assign({}, ls, { opacity: 0 });
            data.push(at(item.price, {
                lineStyle: ls,
                label: i === 0 && labelsOn ? {
                    show: true, position: 'end', distance: 4 + g.tier * LABEL_TIER_PX, opacity: labelOpacity,
                    formatter: g.text,
                    color: ls.color, fontSize: self.layout === 'mobile' ? 10 : 11, fontWeight: 600,
                    padding: [2, 4]
                } : { show: false }
            }));
        });
    });
    var spot = this.model ? this.model.spot : null;
    if (typeof spot === 'number' && isFinite(spot) && (!win || (spot >= win.lo && spot <= win.hi))) {
        var ss = this.levelStyle('spot', true);
        if (this.isBlinking('spot')) ss = Object.assign({}, ss, { opacity: 0 });
        data.push(at(spot, { lineStyle: ss, label: { show: false } }));
    }
    var h = this.highlight;
    if (h && h.group === 'chain' && (!win || (h.price >= win.lo && h.price <= win.hi))) {
        var hs = this.levelStyle(h.key, true);
        data.push(at(h.price, {
            lineStyle: { color: hs.color, type: 'dotted', width: 2, opacity: reducedMotion() ? 1 : 0 },
            label: { show: labelsOn, position: 'insideEndTop', formatter: 'All exp. ' + h.label, color: hs.color, fontSize: 10, opacity: 1 }
        }));
    }
    function at(price, d) { d[axis] = price; return d; }
    return { symbol: ['none', 'none'], silent: true, animation: false, precision: 4, data: data };
};
Gex.prototype.markArea = function () {
    var win = this.win;
    var vertical = this.vertical();
    var axis = vertical ? 'yAxis' : 'xAxis';
    var at = function (price, d) { d = d || {}; d[axis] = price; return d; };
    var zones = win ? M.regimeZones(this.model, win.lo, win.hi) : [];
    var em = this.model.em;
    var p = T.palette(this.theme());
    var band = em ? [[at(em.lo, { itemStyle: { color: p.emArea }, label: { show: false } }), at(em.hi)]] : [];
    if (!zones.length) return { silent: true, data: band };
    var mobile = this.layout === 'mobile';
    var sides = this.gridSides();
    var plotW = (this.chart ? this.chart.getWidth() : 0) - sides.left - sides.right;
    var g = vertical ? this.grid() : null;
    var plotH = vertical ? (this.chart ? this.chart.getHeight() : 0) - g.top - g.bottom : 0;
    var data = zones.map(function (z) {
        var text = M.zoneLabel(z.side, mobile);
        var textW = labelWidth(text, 11) + 8;
        var fits = vertical ? M.zoneLabelFits(z, win.lo, win.hi, plotH, 18) && textW <= plotW
            : M.zoneLabelFits(z, win.lo, win.hi, plotW, textW);
        var pos = vertical ? (z.side === 'pos' ? 'insideTopLeft' : 'insideBottomLeft')
            : (z.side === 'pos' ? 'insideBottomRight' : 'insideBottomLeft');
        return [at(z.lo, {
            itemStyle: { color: z.side === 'pos' ? p.posArea : p.negArea },
            label: fits ? {
                show: true, position: pos,
                formatter: text, color: z.side === 'pos' ? p.posAreaText : p.negAreaText,
                fontSize: 11, fontWeight: 600, padding: [2, 4]
            } : { show: false }
        }), at(z.hi)];
    });
    return { silent: true, data: data.concat(band) };
};
Gex.prototype.renderBlink = function () {
    if (!this.chart) return;
    var h = this.highlight, win = this.win;
    var show = !!h && !!win && !reducedMotion() && h.price >= win.lo && h.price <= win.hi;
    if (!show) {
        if (this._blinkOn) this.chart.setOption({ graphic: [{ id: 'fagex-blink', $action: 'remove' }] });
        this._blinkOn = false;
        return;
    }
    var s = h.group === 'scope'
        ? this.levelStyle(h.key, h.key !== 'flip' || this.model.flipVerified)
        : { color: this.levelStyle(h.key, true).color, type: 'dotted', width: 2 };
    var base = s.opacity === undefined ? 1 : s.opacity;
    var g = this.grid();
    var vertical = this.vertical();
    var px = this.chart.convertToPixel(vertical ? { yAxisIndex: 0 } : { xAxisIndex: 0 }, h.price);
    if (!isFinite(px)) return;
    var shape = vertical ? { x1: g.left, y1: px, x2: this.chart.getWidth() - g.right, y2: px }
        : { x1: px, y1: g.top, x2: px, y2: this.chart.getHeight() - g.bottom };
    this.chart.setOption({ graphic: [{
        id: 'fagex-blink', $action: 'replace', type: 'line', silent: true, z: 100,
        shape: shape,
        style: { stroke: s.color, lineWidth: s.width, lineDash: s.type === 'dashed' ? [6, 4] : s.type === 'dotted' ? [2, 3] : null, opacity: base },
        keyframeAnimation: {
            duration: BLINK_MS, loop: true,
            keyframes: [
                { percent: 0.5, easing: 'sinusoidalInOut', style: { opacity: 0.08 } },
                { percent: 1, easing: 'sinusoidalInOut', style: { opacity: base } }
            ]
        }
    }] });
    this._blinkOn = true;
};
Gex.prototype.priceTagText = function () {
    var price = this.model ? this.model.spot : null;
    return typeof price === 'number' && isFinite(price) ? 'Spot ' + M.fmtPrice(price, this.cur) : '';
};
Gex.prototype.renderPriceTag = function () {
    if (!this.chart) return;
    var m = this.model, win = this.win;
    var price = m ? m.spot : null;
    var vertical = this.vertical();
    var x = this.status === 'ready' && typeof price === 'number' && isFinite(price) && win && price >= win.lo && price <= win.hi
        ? this.chart.convertToPixel(vertical ? { yAxisIndex: 0 } : { xAxisIndex: 0 }, price) : NaN;
    if (!isFinite(x)) {
        if (this._priceTagOn) this.chart.setOption({ graphic: [{ id: 'fagex-price', $action: 'remove' }] });
        this._priceTagOn = false;
        return;
    }
    var p = T.palette(this.theme());
    var size = this.layout === 'mobile' ? 10 : 11;
    var text = this.priceTagText();
    var g = this.grid();
    if (vertical) {
        var y = Math.min(Math.max(x, g.top + 8), this.chart.getHeight() - g.bottom - 8);
        this.chart.setOption({ graphic: [{
            id: 'fagex-price', $action: 'replace', type: 'text', silent: true, z: 120,
            x: g.left - 2, y: y,
            style: {
                text: text, fill: p.bg, backgroundColor: p.spot, padding: [3, 6], borderRadius: 3,
                fontSize: size, fontWeight: 600, align: 'right', verticalAlign: 'middle'
            }
        }] });
        this._priceTagOn = true;
        return;
    }
    var half = (labelWidth(text, size) + 12) / 2;
    x = Math.min(Math.max(x, g.left + half), this.chart.getWidth() - g.right - half);
    this.chart.setOption({ graphic: [{
        id: 'fagex-price', $action: 'replace', type: 'text', silent: true, z: 120,
        x: x, y: this.chart.getHeight() - g.bottom + 3,
        style: {
            text: text, fill: p.bg, backgroundColor: p.spot, padding: [3, 6], borderRadius: 3,
            fontSize: size, fontWeight: 600, align: 'center', verticalAlign: 'top'
        }
    }] });
    this._priceTagOn = true;
};
Gex.prototype.renderVLabels = function () {
    if (!this.chart) return;
    var on = this.vertical() && this.labelsOn && this.status === 'ready' && !!this.win && !!this.model;
    if (!on) {
        if (this._vlabelsOn) this.chart.setOption({ graphic: this.removeVLabels(0, []) });
        this._vlabelsOn = 0;
        return;
    }
    var self = this;
    var key = this.labelsKey();
    var size = key === 'mobile' ? 10 : 11;
    var g = this.grid();
    var edge = this.chart.getWidth() - g.right;
    var yOf = function (price) { return self.chart.convertToPixel({ yAxisIndex: 0 }, price); };
    var items = this.vLevelGroups().map(function (grp) {
        var first = grp.items[0];
        var ls = self.levelStyle(first.key, first.verified);
        return { y: yOf(grp.price), text: grp.text, color: ls.color, opacity: ls.opacity === undefined ? 1 : ls.opacity };
    });
    var h = this.highlight, win = this.win;
    if (h && h.group === 'chain' && h.price >= win.lo && h.price <= win.hi) {
        items.push({ y: yOf(h.price), text: 'All exp. ' + h.label, color: this.levelStyle(h.key, true).color, opacity: 1 });
    }
    items = items.filter(function (it) { return isFinite(it.y); }).sort(function (a, b) { return a.y - b.y; });
    var ys = M.stackLabels(items.map(function (it) { return { y: it.y, h: V_LABEL_H[key] }; }), g.top, this.chart.getHeight() - g.bottom, V_LABEL_GAP);
    var els = [];
    items.forEach(function (it, i) {
        els.push({
            id: 'fagex-vl-line-' + i, $action: 'replace', type: 'polyline', silent: true, z: 110,
            shape: { points: [[edge, it.y], [edge + 4, it.y], [edge + 8, ys[i]]] },
            style: { stroke: it.color, lineWidth: 1, opacity: it.opacity }
        }, {
            id: 'fagex-vl-text-' + i, $action: 'replace', type: 'text', silent: true, z: 110, x: edge + 10, y: ys[i],
            style: {
                text: it.text, fill: it.color, opacity: it.opacity, fontSize: size, fontWeight: 600,
                align: 'left', verticalAlign: 'middle', width: V_GUTTER[key] - 12, overflow: 'truncate'
            }
        });
    });
    this.removeVLabels(items.length, els);
    this.chart.setOption({ graphic: els });
    this._vlabelsOn = items.length;
};
Gex.prototype.removeVLabels = function (from, els) {
    for (var i = from; i < (this._vlabelsOn || 0); i++) els.push({ id: 'fagex-vl-line-' + i, $action: 'remove' }, { id: 'fagex-vl-text-' + i, $action: 'remove' });
    return els;
};
Gex.prototype.renderZdteCaption = function () {
    if (!this.chart || this.lite) return;
    var z = this.view === 'net' && this.model ? this.model.zdte : null;
    if (!z) {
        if (this._zdteCapOn) this.chart.setOption({ graphic: [{ id: 'fagex-zdte', $action: 'remove' }] });
        this._zdteCapOn = false;
        return;
    }
    var p = T.palette(this.theme());
    this.chart.setOption({ graphic: [{
        id: 'fagex-zdte', $action: 'replace', type: 'text', silent: true, z: 90,
        left: 'center', bottom: this.grid().bottom + 6,
        style: {
            text: '0DTE ' + z.expiry + ' · net ' + M.fmtGex(z.netGex), fill: p.muted, fontSize: 11, fontWeight: 600,
            backgroundColor: p.tooltipBg, padding: [2, 6], borderRadius: 4
        }
    }] });
    this._zdteCapOn = true;
};
Gex.prototype.gridSides = function () {
    var lay = this.layout;
    if (this.vertical()) {
        var key = this.labelsKey();
        var tag = this.priceTagText();
        var left = Math.max(key === 'mobile' ? 48 : 64, tag ? Math.ceil(labelWidth(tag, key === 'mobile' ? 10 : 11)) + 18 : 0);
        return { left: left, right: (this.labelsOn ? V_GUTTER[key] : 0) + (this.zoomBar ? V_ZOOM_PX : 12) };
    }
    return {
        left: lay === 'mobile' ? 44 : 64,
        right: 16
    };
};
Gex.prototype.grid = function () {
    var lay = this.layout;
    var sides = this.gridSides();
    if (this.vertical()) return { left: sides.left, right: sides.right, top: 16, bottom: lay === 'mobile' ? 28 : 44 };
    var extraTiers = this.model && this.labelsOn ? this.labelPlan().tiers - 2 : 0;
    return {
        left: sides.left,
        right: sides.right,
        top: (lay === 'mobile' ? 44 : 62) + extraTiers * LABEL_TIER_PX,
        bottom: this.zoomBar ? (lay === 'mobile' ? 58 : 64) : (lay === 'mobile' ? 30 : 40)
    };
};
Gex.prototype.isGexView = function () { return this.view === 'net' || this.view === 'callput' || this.view === 'flow'; };
Gex.prototype.visibleStrikes = function () {
    var w = this.win;
    return w ? M.inWindow(this.model.strikes, w.lo, w.hi) : this.model.strikes;
};
Gex.prototype.seriesOption = function () {
    if (this.vertical()) return this.seriesOptionV();
    var self = this;
    var p = T.palette(this.theme());
    var m = this.model;
    var visible = this.visibleStrikes();
    var top = this.isGexView() && this.labelsOn ? M.topStrikes(visible, this.view, 3) : [];
    var labelSize = this.layout === 'mobile' ? 9 : 10;
    var fmt = this.isGexView() ? M.fmtGex : function (v) { return M.fmtCount(v); };
    var anim = !reducedMotion();
    function item(x, y, color, isTop) {
        var it = { value: [x, y], itemStyle: { color: color } };
        if (isTop) it.label = { show: true, position: y < 0 ? 'bottom' : 'top', formatter: fmt(y), fontSize: labelSize, color: color };
        return it;
    }
    var common = {
        type: 'bar', barMaxWidth: 28, barMinWidth: 1, large: false,
        emphasis: { focus: 'self', itemStyle: { shadowBlur: 10, shadowColor: p.glow } },
        blur: { itemStyle: { opacity: 0.45 }, label: { opacity: 0.45 } },
        universalTransition: { enabled: anim },
        animationDurationUpdate: anim ? 300 : 0
    };
    var series = [];
    var netKey = M.netKey(this.view);
    if (this.view === 'net' || this.view === 'flow') {
        series.push(Object.assign({}, common, {
            id: 'gex-main', name: this.view === 'flow' ? 'Flow GEX' : 'Net GEX', stack: 'gex',
            data: m.strikes.map(function (s) { var v = s[netKey] || 0; return item(s.strike, v, v >= 0 ? p.pos : p.neg, top.indexOf(s.strike) !== -1); }),
            markLine: this.markLines(), markArea: this.markArea()
        }));
        series.push({ id: 'gex-down', name: '', type: 'bar', stack: 'gex', data: [] });
    } else {
        var names = { callput: ['Call GEX', 'Put GEX'], oi: ['Call OI', 'Put OI'] }[this.view];
        var upTop = {}, downTop = {};
        if (this.view === 'callput') top.forEach(function (k) {
            var s = self.byStrike[k];
            if (Math.abs(s.callGex) >= Math.abs(s.putGex)) upTop[k] = 1; else downTop[k] = 1;
        });
        series.push(Object.assign({}, common, {
            id: 'gex-main', name: names[0], stack: 'gex',
            data: m.strikes.map(function (s) { var v = M.viewValues(s, self.view).up; return item(s.strike, v === null ? 0 : v, p.pos, !!upTop[s.strike]); }),
            markLine: this.markLines(), markArea: this.markArea()
        }));
        series.push(Object.assign({}, common, {
            id: 'gex-down', name: names[1], stack: 'gex',
            data: m.strikes.map(function (s) { var v = M.viewValues(s, self.view).down; return item(s.strike, v === null ? 0 : v, p.neg, !!downTop[s.strike]); })
        }));
    }
    var zdte = this.view === 'net' ? m.zdte : null;
    series.push({
        id: 'gex-zdte', name: '0DTE net GEX', type: 'bar', barGap: '-100%', barMaxWidth: 28, barMinWidth: 1, large: false,
        silent: true, z: 3, animation: false, emphasis: { disabled: true },
        data: zdte ? zdte.points.map(function (pt) {
            return { value: pt, itemStyle: { color: 'rgba(0,0,0,0)', borderColor: pt[1] >= 0 ? p.pos : p.neg, borderWidth: 1.5 } };
        }) : []
    });
    return series;
};
Gex.prototype.seriesOptionV = function () {
    var self = this;
    var p = T.palette(this.theme());
    var m = this.model;
    var visible = this.visibleStrikes();
    var top = this.isGexView() && this.labelsOn ? M.topStrikes(visible, this.view, 3) : [];
    var labelSize = this.layout === 'mobile' ? 9 : 10;
    var fmt = this.isGexView() ? M.fmtGex : function (v) { return M.fmtCount(v); };
    var gap = M.minGap(m.strikes) || 1;
    var clipRect = this.ec.graphic.clipRectByRect;
    function render(colors, labels, outline) {
        return function (params, api) {
            var from = api.value(0), to = api.value(1), k = api.value(2);
            var a = api.coord([from, k]), b = api.coord([to, k]);
            var h = Math.min(Math.max(Math.abs(api.size([0, gap])[1]) * 0.7, 1), 28);
            var cs = params.coordSys;
            var shape = clipRect({ x: Math.min(a[0], b[0]), y: a[1] - h / 2, width: Math.abs(b[0] - a[0]), height: h },
                { x: cs.x, y: cs.y, width: cs.width, height: cs.height });
            if (!shape) return null;
            var color = colors[params.dataIndex];
            if (outline) return { type: 'rect', shape: shape, silent: true, style: { fill: 'none', stroke: color, lineWidth: 1.5 } };
            var rect = {
                type: 'rect', shape: shape, style: { fill: color },
                emphasis: { style: { shadowBlur: 10, shadowColor: p.glow } },
                blur: { style: { opacity: 0.45 } }
            };
            var text = labels && labels[params.dataIndex];
            if (!text) return rect;

            var neg = to < from;
            var w = labelWidth(text, labelSize) + 4;
            var inside = neg ? b[0] - w < cs.x : b[0] + w > cs.x + cs.width;
            var out = inside ? !neg : neg;
            return { type: 'group', children: [rect, {
                type: 'text', silent: true,
                style: { text: text, x: b[0] + (out ? -4 : 4), y: a[1], align: out ? 'right' : 'left', verticalAlign: 'middle', fill: inside ? p.bg : color, fontSize: labelSize, fontWeight: inside ? 600 : 'normal' },
                blur: { style: { opacity: 0.45 } }
            }] };
        };
    }
    function bars(id, name, rows, extra) {
        var colors = [], labels = [];
        var data = rows.map(function (r, i) { colors[i] = r.color; labels[i] = r.label || null; return [r.from, r.to, r.strike]; });
        return Object.assign({
            id: id, name: name, type: 'custom', coordinateSystem: 'cartesian2d',
            dimensions: ['from', 'to', 'strike'], encode: { x: [0, 1], y: 2 },
            renderItem: render(colors, labels, false), data: data,
            emphasis: { focus: 'self' },
            animationDurationUpdate: reducedMotion() ? 0 : 300
        }, extra || {});
    }
    var marks = { markLine: this.markLines(), markArea: this.markArea() };
    var series = [];
    var netKey = M.netKey(this.view);
    if (this.view === 'net' || this.view === 'flow') {
        series.push(bars('gex-main', this.view === 'flow' ? 'Flow GEX' : 'Net GEX', m.strikes.map(function (s) {
            var v = s[netKey] || 0;
            return { from: 0, to: v, strike: s.strike, color: v >= 0 ? p.pos : p.neg, label: top.indexOf(s.strike) !== -1 ? fmt(v) : null };
        }), marks));
        series.push(bars('gex-down', '', []));
    } else {
        var names = { callput: ['Call GEX', 'Put GEX'], oi: ['Call OI', 'Put OI'] }[this.view];
        var upTop = {}, downTop = {};
        if (this.view === 'callput') top.forEach(function (k) {
            var s = self.byStrike[k];
            if (Math.abs(s.callGex) >= Math.abs(s.putGex)) upTop[k] = 1; else downTop[k] = 1;
        });
        var parts = m.strikes.map(function (s) {
            var v = M.viewValues(s, self.view);
            var up = v.up === null ? 0 : v.up, down = v.down === null ? 0 : v.down;
            var base = up !== 0 && (up > 0) === (down > 0) ? up : 0;
            return { s: s, up: up, down: down, base: base };
        });
        series.push(bars('gex-main', names[0], parts.map(function (x) {
            return { from: 0, to: x.up, strike: x.s.strike, color: p.pos, label: upTop[x.s.strike] ? fmt(x.up) : null };
        }), marks));
        series.push(bars('gex-down', names[1], parts.map(function (x) {
            return { from: x.base, to: x.base + x.down, strike: x.s.strike, color: p.neg, label: downTop[x.s.strike] ? fmt(x.down) : null };
        })));
    }
    var zdte = this.view === 'net' ? m.zdte : null;
    var zColors = [];
    series.push({
        id: 'gex-zdte', name: '0DTE net GEX', type: 'custom', coordinateSystem: 'cartesian2d',
        dimensions: ['from', 'to', 'strike'], encode: { x: [0, 1], y: 2 },
        silent: true, z: 3, animation: false, emphasis: { disabled: true },
        renderItem: render(zColors, null, true),
        data: zdte ? zdte.points.map(function (pt, i) { zColors[i] = pt[1] >= 0 ? p.pos : p.neg; return [0, pt[1], pt[0]]; }) : []
    });
    return series;
};
Gex.prototype.ySplit = function () { return this.layout === 'desktop' ? 6 : 4; };
Gex.prototype.maxAbsValue = function () {
    var view = this.view;
    var max = 0;
    var w = this.win, zdte = view === 'net' && this.model.zdte;
    if (zdte) zdte.points.forEach(function (pt) {
        if (!w || (pt[0] >= w.lo && pt[0] <= w.hi)) max = Math.max(max, Math.abs(pt[1]));
    });
    this.visibleStrikes().forEach(function (s) {
        if (view === 'net' || view === 'flow') { max = Math.max(max, Math.abs(s[M.netKey(view)] || 0)); return; }
        var v = M.viewValues(s, view);
        var up = v.up || 0, down = v.down || 0;
        var pos = Math.max(0, up) + Math.max(0, down), neg = Math.min(0, up) + Math.min(0, down);
        max = Math.max(max, pos, -neg);
    });
    return max;
};

Gex.prototype.valueAxisOption = function () {
    var p = T.palette(this.theme());
    var lay = this.layout;
    var split = this.ySplit();
    var gexView = this.isGexView();
    var main = symmetricAxis(this.maxAbsValue(), split);
    var vertical = this.vertical();
    return [{
        type: 'value', splitNumber: split, scale: false,
        min: main.min, max: main.max, interval: main.interval,
        name: lay === 'mobile' ? '' : this.view === 'flow' ? 'Flow-signed GEX ($ per 1% move)' :
            (gexView ? 'GEX ($ per 1% move)' : 'Open interest (contracts)'),
        nameLocation: 'middle', nameGap: vertical ? 26 : 48, nameTextStyle: { color: p.muted, fontSize: 11 },
        axisLabel: { color: p.muted, fontSize: lay === 'mobile' ? 9 : 11, hideOverlap: vertical, formatter: gexView ? M.fmtGex : function (v) { return M.fmtCount(v); } },
        splitLine: { lineStyle: { color: p.grid } }
    }];
};
Gex.prototype.fullOption = function () {
    var self = this;
    var p = T.palette(this.theme());
    var lay = this.layout;
    var ext = this.extent();
    var desktop = lay === 'desktop';
    var cur = this.cur;
    var vertical = this.vertical();
    var g = this.grid();
    var strikeAxis = {
        type: 'value', scale: true, min: ext.lo, max: ext.hi,
        name: lay === 'mobile' ? '' : 'Strike', nameLocation: 'middle', nameGap: vertical ? g.left - 16 : 24, nameTextStyle: { color: p.muted, fontSize: 11 },
        splitNumber: vertical ? (desktop ? 10 : lay === 'tablet' ? 8 : 6) : (lay === 'mobile' ? 4 : 8),
        axisLabel: { color: p.muted, fontSize: lay === 'mobile' ? 9 : 11, hideOverlap: true, rotate: 0, formatter: function (v) { return M.fmtAxisStrike(v, cur); } },
        splitLine: { show: false },
        axisPointer: { show: true, type: 'line', snap: false, label: { show: false } }
    };
    if (vertical) {
        strikeAxis.nameRotate = 90;

        strikeAxis.axisLabel.showMinLabel = false;
        strikeAxis.axisLabel.showMaxLabel = false;
    }
    var zoomAxis = vertical ? 'yAxisIndex' : 'xAxisIndex';
    var inside = {
        type: 'inside', filterMode: 'filter',
        startValue: this.win.lo, endValue: this.win.hi,
        zoomOnMouseWheel: desktop, moveOnMouseWheel: false,
        moveOnMouseMove: desktop, preventDefaultMouseMove: desktop
    };
    var slider = vertical ? {
        type: 'slider', orient: 'vertical', filterMode: 'filter', width: lay === 'mobile' ? 22 : 18, right: 8,
        top: g.top, bottom: g.bottom, startValue: this.win.lo, endValue: this.win.hi, showDetail: false
    } : {
        type: 'slider', filterMode: 'filter', height: lay === 'mobile' ? 22 : 18, bottom: 8,
        startValue: this.win.lo, endValue: this.win.hi, showDetail: lay !== 'mobile',
        labelFormatter: function (v) { return M.fmtAxisStrike(v, cur); }
    };
    inside[zoomAxis] = 0;
    slider[zoomAxis] = 0;
    return {
        animation: !reducedMotion(),
        aria: { enabled: true, label: { description: this.conclusionText() } },
        grid: g,
        xAxis: vertical ? this.valueAxisOption() : strikeAxis,
        yAxis: vertical ? strikeAxis : this.valueAxisOption(),
        dataZoom: this.zoomBar ? [inside, slider] : [inside],
        tooltip: {
            trigger: 'axis', confine: true, showContent: lay !== 'mobile', enterable: false,
            backgroundColor: p.tooltipBg, borderColor: p.tooltipBorder, textStyle: { color: p.text, fontSize: 12 },
            axisPointer: { type: 'line', axis: vertical ? 'y' : 'auto', lineStyle: { color: p.faint, type: 'dashed' } },
            formatter: function (params) {
                var first = params && params[0];
                var v = first && first.value;
                var k = v ? (vertical ? v[2] : v[0]) : undefined;
                if (!isFinite(k) && first) k = first.axisValue;
                var s = self.nearestStrike(k);
                return s ? self.tipHtml(s) : '';
            }
        },
        series: this.seriesOption()
    };
};
Gex.prototype.nearestStrike = function (x) {
    if (!isFinite(x)) return null;
    var best = null, d = Infinity;
    this.visibleStrikes().forEach(function (s) {
        var dd = Math.abs(s.strike - x);
        if (dd < d) { d = dd; best = s; }
    });
    return best;
};
Gex.prototype.tipHtml = function (s) {
    var m = this.model, cur = this.cur;
    var flow = this.view === 'flow';
    var levels = this.chartLevels().filter(function (l) { return l.key !== 'spot' && Math.abs(l.price - s.strike) < 1e-9; })
        .map(function (l) { return l.label; });
    if (m.scope === 'single' && m.chain.maxPain !== null && Math.abs(m.chain.maxPain - s.strike) < 1e-9) levels.push('Max Pain (all expiries)');
    function row(k, v) { return '<div class="flex justify-between gap-3 [&>span]:text-[color:var(--fagex-muted)] [&>b]:tabular-nums [&_small]:font-normal [&_small]:text-[color:var(--fagex-muted)]"><span>' + k + '</span><b>' + v + '</b></div>'; }
    var lite = this.lite;
    function pair(k, a, b, fmt) { return lite && !M.hasAny(a, b) ? '' : row(k, esc(fmt(a)) + ' / ' + esc(fmt(b))); }
    var count = function (v) { return M.fmtCount(v); }, delta = function (v) { return M.fmtCount(v, true); };
    return '<div class="min-w-[220px] text-xs">' +
        '<div class="mb-1 text-[13px]"><b>' + esc(M.fmtStrike(s.strike, cur)) + '</b></div>' +
        (flow
            ? row('Flow GEX', esc(M.fmtGex(s.flowNet))) +
              row('Call / Put flow GEX', esc(M.fmtGex(s.flowCall)) + ' / ' + esc(M.fmtGex(s.flowPut))) +
              row('Dealer pos call / put', esc(M.fmtCount(s.callPos, true)) + ' / ' + esc(M.fmtCount(s.putPos, true))) +
              row('Net GEX (open interest)', esc(M.fmtGex(s.netGex)))
            : (lite && !M.hasAny(s.netGex) ? '' : row('Net GEX', esc(M.fmtGex(s.netGex)))) +
              (m.zdte && this.view === 'net' ? row('0DTE net GEX', esc(M.fmtGex(m.zdte.byStrike[s.strike]))) : '') +
              pair('Call / Put GEX', s.callGex, s.putGex, M.fmtGex)) +
        pair('Call / Put OI', s.callOi, s.putOi, count) +
        (flow ? '' :
            pair('Call / Put Vol', s.callVol, s.putVol, count) +
            (this.zdte ? '' : pair('ΔOI call / put', s.dCallOi, s.dPutOi, delta))) +
        (levels.length ? '<div class="mt-1 font-bold text-[color:var(--fagex-flip)]">' + esc(levels.join(' · ')) + '</div>' : '') +
        '</div>';
};

Gex.prototype.conclusionText = function () {
    if (!this.model) return '';
    var text = M.conclusion(this.model, { currency: this.cur });
    if (this.view === 'flow' && this.model.flow) text += ' ' + M.flowSentence(this.model);
    return this.model.scope === 'single' && this.expiry && text ? 'Exp ' + fmtExpiry(this.expiry, this.today) + ': ' + text : text;
};
Gex.prototype.renderAll = function () {
    this.el.removeAttribute('data-booting');
    this.applyLayers();
    this.renderHeader();
    this.renderToolbar();
    this.renderLevels();
    this.renderFooter();
    if (this.status === 'ready') { this.renderOverlay(null); this.renderChart(); }
    else { this.renderOverlay(this.status); this.clearChart(); }
    this.renderTrail();
    this.syncQuote();
};
Gex.prototype.renderHeader = function () {
    if (this.lite) return;
    var m = this.model;
    this.$('sym').textContent = this.symbol;
    var badge = this.$('badge'), net = this.$('net'), reason = this.$('reason');
    var regime = m ? m.headerRegime : 'unknown';
    badge.setAttribute('data-regime', regime);
    badge.textContent = !m ? '–' : M.regimeLabel(regime);
    net.innerHTML = m && m.netGex !== null ? 'Net GEX <b>' + esc(M.fmtGex(m.netGex)) + '</b> <small>$ / 1% move</small>' : '';
    if (m && m.netGex !== null) net.setAttribute('data-sign', m.netGex >= 0 ? 'pos' : 'neg');
    this.$('all-tag').hidden = !m || (!this.zdte && !this.summary);
    var sampleTag = this.$('sample-tag');
    if (sampleTag) sampleTag.hidden = !m || !this.sample;
    var note = m ? m.headerRegimeNote : null;
    var why = !m || regime !== 'unknown' ? '' :
        note === 'at_flip' ? 'Spot is at the gamma flip - regime undetermined' :
        note === 'unverified' ? 'Gamma flip shown but unverified - regime undetermined' :
        M.noFlipReason(m.headerFlipStatus) + ' - regime undetermined';
    if (why && m.scope === 'single') why = 'All expiries: ' + why.charAt(0).toLowerCase() + why.slice(1);
    reason.textContent = why;
    reason.hidden = !why || this.status === 'guest' || m.scope !== 'single';
    var chip = this.$('scope-chip');
    var showChip = this.status === 'ready' || this.status === 'empty';
    chip.hidden = !showChip;
    if (showChip) chip.textContent = 'Chart: ' + (this.zdte ? '0DTE ' + (m && m.expiry ? m.expiry : '') : this.expiry === 'all' ? 'All expiries' : 'Exp ' + fmtExpiry(this.expiry, this.today));
    var asOf = this.$('asof'), delayed = this.$('delayed');
    var iso = m && m.asOf;
    if (iso) {
        asOf.textContent = (this.zdte ? 'As of ' : M.asOfPrefix(m.marketOpen, this.assetType)) + fmtAsOf(iso);
    } else asOf.textContent = '';
    delayed.hidden = !(m && (m.delayed || M.isStale(iso, Date.now(), m.marketOpen)));
    var delayedCta = this.$('delayed-cta');
    var showDelayedCta = !!(this.delayedCta && m && m.delayed);
    delayedCta.hidden = !showDelayedCta;
    if (showDelayedCta) {
        delayedCta.textContent = this.delayedCta.text || 'See live data';
        delayedCta.setAttribute('href', this.delayedCta.href);
        setAttrs(delayedCta, this.delayedCta.attrs);
    }
    this.renderLive();
    var concl = this.$('concl');
    concl.hidden = this.zdte;
    if (this.zdte) return;
    if (this.status === 'guest') {
        var gtext = this.conclusionText();
        concl.textContent = gtext;
        concl.title = gtext;
        concl.hidden = !gtext;
    } else {
        var text = this.conclusionText();
        concl.textContent = text;
        concl.title = text;
    }
};
Gex.prototype.quotaSpent = function () {
    return this.status === 'limit' && !!this.error && this.error.kind === 'quota';
};

Gex.prototype.renderToolbar = function () {
    var tb = this.$('toolbar');
    if (!tb) return;
    var self = this;
    this.applyLayers();
    this.renderLayersMenu();
    var interactive = this.status === 'ready' || this.status === 'empty' || this.status === 'loading' || this.status === 'limit' || this.status === 'error' || this.status === 'not_found';
    tb.hidden = !interactive || this.status === 'locked' || this.status === 'guest' || this.quotaSpent();
    var flowLocked = !(this.rank >= FLOW_RANK);
    tb.querySelectorAll('[data-view]').forEach(function (b) {
        var v = b.dataset.view, option = b.getAttribute('role') === 'option';
        b.setAttribute(option ? 'aria-selected' : 'aria-pressed', v === self.view ? 'true' : 'false');
        var name = (VIEWS.filter(function (x) { return x[0] === v; })[0] || [v, v])[1];
        var locked = v === 'flow' && flowLocked;
        b.innerHTML = option
            ? '<span>' + esc(name) + '</span>' + (locked ? LOCK + '<span class="text-[11px] font-bold text-[color:var(--fagex-flip)]">Alpha</span>' : '')
            : esc(name) + (locked ? LOCK_INLINE : '');
        if (v !== 'flow') { b.removeAttribute('title'); return; }
        if (locked) b.setAttribute('data-locked', '1'); else b.removeAttribute('data-locked');
        b.title = locked ? 'Flow-signed GEX needs the FlashAlpha Alpha plan' : 'Flow-signed GEX: dealer positioning from today’s tape (since 09:30 ET)';
    });
    function pickerLabel(btn, name, value) {
        if (!btn) return;
        btn.innerHTML = '<span class="min-w-0 truncate"><span class="' + MOBILE + 'hidden">' + name + ': </span><b>' + esc(value) + '</b></span>' + CHEVRON;
        btn.title = name + ': ' + value;
    }
    var viewName = VIEWS.filter(function (v) { return v[0] === self.view; })[0];
    pickerLabel(this.$('view-btn'), 'View', viewName ? viewName[1] : '');
    var range = this.range();
    var rangeLabel = 'Auto';
    tb.querySelectorAll('[data-range]').forEach(function (b) {
        var v = b.dataset.range === 'all' ? 'all' : Number(b.dataset.range);
        b.setAttribute('aria-selected', v === range ? 'true' : 'false');
        if (v === range) rangeLabel = b.textContent;
    });
    pickerLabel(this.$('range-btn'), 'Range', rangeLabel);
    var lbl = this.$('labels');
    if (lbl) lbl.setAttribute('aria-pressed', this.labelsOn ? 'true' : 'false');
    var mlbl = this.$('m-labels');
    if (mlbl) mlbl.textContent = this.labelsOn ? 'Hide labels' : 'Show labels';
    var expBtn = this.$('exp-btn');
    pickerLabel(expBtn, 'Expiry', !this.expiry ? '…' : this.expiry === 'all' ? 'All' : fmtExpiry(this.expiry, this.today));
    var ready = this.status === 'ready';
    ['reset', 'export'].forEach(function (n) { var b = self.$(n); if (b) b.disabled = !ready; });
    var exp = this.$('export');
    if (exp && this.sample) { exp.disabled = true; exp.title = 'Export is off for the sample snapshot'; }
    else if (exp) exp.title = 'Export GEX';
    this.renderZoomButton();
    this.renderOrientButton();
};
Gex.prototype.renderZoomButton = function () {
    var zoom = this.$('reset');
    if (!zoom) return;
    var back = !!this.zoomBack, five = this.zoomGoesToFive();
    var zoomLabel = back ? 'Back to previous zoom' : five ? 'Zoom to ±' + (this.zoomInRange() * 100) + '%' : 'Reset zoom';
    zoom.innerHTML = toolIcon(back || five ? 'zoomIn' : 'zoomOut');
    zoom.setAttribute('aria-label', zoomLabel);
    zoom.title = zoomLabel;
};
Gex.prototype.levelRowsHtml = function (levels, group, chip) {
    var cur = this.cur;
    var perRow = MOBILE + 'basis-[calc((100%-0.5rem)/3)] ';
    return levels.map(function (l) {
        var price = fmtLevel(l.key, l.price, cur);
        var extra = l.key === 'flip' && !l.verified ? ' <em>unverified</em>' : '';
        if (chip) {

            var fit = MOBILE + 'max-w-full ' + MOBILE + 'truncate';
            return '<button type="button" role="listitem" class="flex-none inline-flex items-center gap-1.5 min-h-[26px] px-3 rounded-full border border-[color:var(--fagex-border)] bg-[color:var(--fagex-surface)] text-xs whitespace-nowrap ' +
                MOBILE + 'flex-1 ' + MOBILE + 'min-w-0 ' + MOBILE + 'flex-col ' + MOBILE + 'gap-0 ' + MOBILE + 'px-1 ' + MOBILE + 'py-1 ' + MOBILE + 'rounded-lg ' +
                perRow +
                '[&_small]:text-[color:var(--fagex-muted)] ' + TW.picked + '" data-level="' + l.key + '" data-level-group="' + group + '" data-k="' + l.key + '">' +
                '<span class="' + LEVEL_TEXT[l.key] + ' ' + fit + ' ' + MOBILE + 'text-[11px]">' + esc(l.label) + '</span> <b class="' + fit + '">' + esc(price) + '</b></button>';
        }
        return '<li><button type="button" class="grid grid-cols-[1fr_auto] gap-x-2 w-full min-h-[26px] px-2 py-1.5 rounded-lg border border-transparent bg-transparent text-left hover:bg-[color:var(--fagex-btn-hover)] ' + TW.picked + '"' +
            ' data-level="' + l.key + '" data-level-group="' + group + '" data-k="' + l.key + '">' +
            '<span class="col-start-1 row-start-1 text-[13px] font-semibold ' + LEVEL_TEXT[l.key] + ' [&_em]:not-italic [&_em]:text-[11px] [&_em]:text-[color:var(--fagex-muted)]">' + esc(l.label) + extra + '</span>' +
            '<span class="col-start-2 row-start-1 font-bold tabular-nums">' + esc(price) + '</span></button></li>';
    }).join('');
};
Gex.prototype.renderLevels = function () {
    var rail = this.$('rail'), chips = this.$('chips');
    if (this.lite || !rail || !chips) return;
    var body = this.$('body');
    var noRail = function () {
        rail.hidden = true; chips.hidden = true; rail.innerHTML = ''; chips.innerHTML = '';
        if (body) body.style.gridTemplateColumns = 'minmax(0,1fr)';
    };
    var m = this.model;
    var show = !!m && this.features.levelsRail;
    var desktop = this.layout === 'desktop';
    if (!show) { noRail(); return; }
    if (body) body.style.gridTemplateColumns = '';
    rail.hidden = !desktop;
    chips.hidden = desktop;
    var hasStrikes = this.status === 'ready';
    var scopeLevels = hasStrikes ? M.levelList(m, m.spot, { maxPain: this.features.maxPain && m.scope !== 'single', flowFlip: this.view === 'flow' }).reverse() : [];
    if (hasStrikes && this.zdte && m.magnet !== null) {
        scopeLevels.push({ key: 'magnet', label: LAYER_LEVEL.magnet.label, short: LAYER_LEVEL.magnet.short, price: m.magnet, verified: true, order: LAYER_LEVEL.magnet.order });
        scopeLevels.sort(function (a, b) { return a.price - b.price || b.order - a.order; });
    }
    var chainLevels = this.summary ? M.levelList(m.chain, m.spot, { maxPain: this.features.maxPain }).reverse() : [];
    var groups = [];
    if (hasStrikes && m.scope === 'single') {
        groups.push(['scope', 'This expiry', scopeLevels]);
        if (chainLevels.length) groups.push(['chain', 'All expiries', chainLevels]);
    } else if (hasStrikes) {
        groups.push(['scope', null, scopeLevels]);
    } else if (chainLevels.length) {
        groups.push(['chain', 'All expiries', chainLevels]);
    }
    this.applyLayers();
    if (hasStrikes && m.em) {
        var emLevels = ['emLow', 'emHigh'].map(function (k) {
            return { key: k, label: LAYER_LEVEL[k].label, short: LAYER_LEVEL[k].short, price: m[k], verified: true };
        });
        groups.push(['scope', this.zdte ? 'Expected move (remaining)' : 'Expected move · ' + m.em.expiry, emLevels, M.fmtEmRange(m.em, this.cur)]);
    }
    var pin = hasStrikes && m.pin;
    var pinBadge = pin ? '<button type="button" class="flex-none ' + MOBILE + 'basis-full ' + MOBILE + 'justify-center inline-flex items-center min-h-[26px] px-3 rounded-full border border-current bg-transparent text-xs font-bold whitespace-nowrap text-[color:var(--fagex-magnet)]" data-r="pin-info"' +
        ' title="' + esc(this.pinText(pin)) + '" aria-label="' + esc(this.pinText(pin)) + '">Pin risk ' + esc(pin.score) + '/100</button>' : '';
    if (!groups.length && !pinBadge) { noRail(); return; }
    var self = this;
    var extraRow = function (txt, chip) {
        return !txt ? '' : chip
            ? '<span class="flex-none text-xs tabular-nums text-[color:var(--fagex-muted)]" role="listitem">' + esc(txt) + '</span>'
            : '<li class="px-2 py-1 text-xs tabular-nums text-[color:var(--fagex-muted)]">' + esc(txt) + '</li>';
    };
    var railGroups = this.vertical() ? groups.map(function (g) { return [g[0], g[1], g[2].slice().reverse(), g[3]]; }) : groups;
    rail.innerHTML = '<h3 class="mx-0 mt-0 mb-2 text-[13px] font-bold uppercase tracking-[.05em] text-[color:var(--fagex-muted)]">Key levels</h3>' +
        (pinBadge ? '<div class="mb-2">' + pinBadge + '</div>' : '') + railGroups.map(function (g) {
        return (g[1] ? '<h4 class="mx-0 mt-3 mb-1 text-xs font-bold text-[color:var(--fagex-muted)]">' + esc(g[1]) + '</h4>' : '') + '<ul>' + self.levelRowsHtml(g[2], g[0], false) + extraRow(g[3], false) + '</ul>';
    }).join('');
    chips.innerHTML = groups.map(function (g, i) {
        return '<div class="flex flex-wrap items-center justify-start gap-2 ' + MOBILE + 'gap-1" role="list" aria-label="' + esc(g[1] || 'Key levels') + '">' +
            (g[1] && groups.length > 1 ? '<span class="flex-none text-[11px] font-bold uppercase tracking-[.04em] text-[color:var(--fagex-muted)] ' + MOBILE + 'basis-full" role="presentation">' + esc(g[1]) + '</span>' : '') +
            (i === 0 ? pinBadge : '') + self.levelRowsHtml(g[2], g[0], true) + extraRow(g[3], true) + '</div>';
    }).join('');
    this.markPickedLevel();
};
Gex.prototype.levelClick = function (group, key) {
    var m = this.model;
    if (!m) return;
    var src = group === 'chain' ? m.chain : m;
    var price = key === 'spot' ? m.spot : src[key];
    if (price === null || price === undefined) return;
    var label = { callWall: 'Call Wall', putWall: 'Put Wall', flip: 'Flip', maxPain: 'Max Pain', spot: 'Spot', flowFlip: 'Flow flip' }[key] ||
        (LAYER_LEVEL[key] && LAYER_LEVEL[key].label);
    var h = this.highlight;
    if (h && h.from === group && h.key === key) {
        this.highlight = null;
    } else {
        var onChart = group === 'scope' || (group === 'chain' && (m.scope === 'all' || key === 'callWall' || key === 'putWall'));
        this.highlight = { group: onChart ? 'scope' : 'chain', from: group, key: key, price: price, label: label + ' ' + fmtLevel(key, price, this.cur) };
        this.emit('level-click', { key: key, price: price, scope: group === 'chain' ? 'all' : m.scope });
    }
    this.markPickedLevel();
    if (this.status === 'ready' && this.chart) this.onZoomed();
};
Gex.prototype.markPickedLevel = function () {
    var h = this.highlight;
    this.el.querySelectorAll('[data-level]').forEach(function (b) {
        b.setAttribute('aria-current', h && b.dataset.level === h.key && b.dataset.levelGroup === h.from ? 'true' : 'false');
    });
};
Gex.prototype.renderEdges = function () {
    var l = this.$('edge-l'), r = this.$('edge-r'), row = this.$('edge-row');
    if (!l || !r) return;
    l.innerHTML = ''; r.innerHTML = '';
    if (row) { row.innerHTML = ''; row.hidden = true; }
    if (this.status !== 'ready' || !this.win) return;
    var win = this.win, cur = this.cur, mobile = this.layout === 'mobile';
    var levels = this.chartLevels().filter(function (x) { return x.key !== 'emLow' && x.key !== 'emHigh'; });
    var vertical = this.vertical();
    function btn(x, low) {
        var name = mobile ? x.short : x.label;
        var text = esc(name + ' ' + fmtLevel(x.key, x.price, cur));
        return '<button type="button" class="min-h-[44px] px-2.5 rounded-lg border border-[color:var(--fagex-border)] bg-[color:var(--fagex-raised)] text-xs font-semibold whitespace-nowrap opacity-[.92]" data-edge="' + x.price + '" title="Show ' + esc(x.label) + '">' +
            (vertical ? (low ? '↓ ' : '↑ ') + text : (low ? '← ' : '') + text + (low ? '' : ' →')) + '</button>';
    }
    var lower = levels.filter(function (x) { return x.price < win.lo; }).sort(function (a, b) { return b.price - a.price; }).map(function (x) { return btn(x, true); }).join('');
    var higher = levels.filter(function (x) { return x.price > win.hi; }).sort(function (a, b) { return a.price - b.price; }).map(function (x) { return btn(x, false); }).join('');
    if (mobile && row) {
        row.innerHTML = lower + higher;
        row.hidden = !(lower || higher);
        return;
    }
    l.innerHTML = lower;
    r.innerHTML = higher;
    var g = this.grid();
    var flow = vertical ? 'absolute z-[4] flex flex-wrap justify-end gap-1' : null;
    l.className = flow || 'absolute z-[4] flex flex-col gap-1';
    r.className = flow || 'absolute z-[4] flex flex-col items-end gap-1';
    if (vertical) {
        var maxW = Math.max(0, (this.chart ? this.chart.getWidth() : this.$('chart').clientWidth) - g.left - g.right - 8) + 'px';
        l.style.left = r.style.left = '';
        l.style.right = r.style.right = g.right + 4 + 'px';
        l.style.maxWidth = r.style.maxWidth = maxW;
        r.style.top = g.top + 4 + 'px';
        r.style.bottom = '';
        l.style.top = '';
        var below = Math.max(0, this.$('stage').clientHeight - this.$('chart').clientHeight);
        l.style.bottom = below + g.bottom + 4 + 'px';
        return;
    }
    l.style.right = l.style.bottom = r.style.left = r.style.bottom = l.style.maxWidth = r.style.maxWidth = '';
    l.style.left = g.left + 4 + 'px';
    r.style.right = g.right + 4 + 'px';
    l.style.top = r.style.top = g.top + 4 + 'px';
};
Gex.prototype.renderFooter = function () {
    var foot = this.$('foot');
    if (!foot) return;
    var m = this.model;
    foot.hidden = this.status === 'guest' || this.status === 'locked' || this.quotaSpent();
    var filter = this.zdte ? 'Strikes within ±3% of spot (API default)' : 'Strikes with open interest ≥ ' + MIN_OI;
    if (this.status !== 'ready' || !m) {
        foot.innerHTML = foot.hidden ? '' :
            [[FOOT_ICON.source, 'Source: FlashAlpha Lab API'], [FOOT_ICON.filter, filter]].map(footItem).join('');
        return;
    }
    var items = [
        [FOOT_ICON.source, 'Source: FlashAlpha Lab API'],
        [FOOT_ICON.filter, filter],
        [FOOT_ICON.shown, 'Showing ' + this.visibleStrikes().length + ' of ' + m.strikes.length + ' strikes']
    ];
    if (this.view === 'flow' && m.flow) items.push([FOOT_ICON.unit, this.flowFootText()]);
    else if (this.isGexView()) items.push([FOOT_ICON.unit, 'GEX = $ dealers hedge per 1% move']);
    foot.innerHTML = items.map(footItem).join('');
};
Gex.prototype.flowFootText = function () {
    var f = this.model.flow, c = f.coverage;
    if (c && c.sourceOk === false) return 'Session flow source unavailable';
    var txt = 'Flow = dealer position change since 09:30 ET';
    if (c && c.total) txt += ' · ' + M.fmtCount(c.withFlow) + ' of ' + M.fmtCount(c.total) + ' contracts traded';
    return txt;
};
Gex.prototype.renderOverlay = function (state) {
    var ov = this.$('overlay');
    if (!ov) return;
    if (!state) { ov.hidden = true; ov.innerHTML = ''; ov.removeAttribute('data-state'); return; }
    ov.hidden = false;
    ov.setAttribute('data-state', state);
    var sym = esc(this.symbol);
    var html;
    var lockIcon = '<svg class="block w-10 h-10 mx-auto mb-2 text-[color:var(--fagex-muted)]" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/></svg>';
    var cta = function (href, label, attrs) { return '<a href="' + esc(href) + '"' + linkTarget(href) + attrHtml(attrs) + ' class="' + TW.cta + '">' + esc(label) + '</a>'; };
    switch (state) {
        case 'loading':
            html = loaderHtml('Loading gamma exposure data…');
            break;
        case 'refreshing':
            html = loaderHtml('Refreshing gamma exposure data…');
            break;
        case 'guest':
            var gc = this.guestCta || {};
            var bad = this.invalidKey;
            html = skeletonHtml(this.vertical()) +
                '<div class="' + TW.ovCard + '">' + lockIcon +
                '<p class="' + TW.ovTitle + '">' + esc(gc.title || (bad ? 'FlashAlpha API key not accepted' : 'GEX by strike for ' + this.symbol)) + '</p>' +
                '<p class="' + TW.ovText + '">' + esc(gc.text || (bad
                    ? 'Check the FlashAlpha API key passed to the chart, then reload the page.'
                    : 'Add your FlashAlpha API key to see gamma exposure at every strike, with the call wall, put wall and gamma flip for ' + this.symbol + '.')) + '</p>' +
                cta(gc.href || (bad ? brand.keyUrl() : brand.signupUrl()), gc.label || (bad ? 'Find your API key' : 'Get a free API key'), gc.attrs) + '</div>';
            break;
        case 'locked':
            var li = this.lockInfo || { rank: 2 };
            var plan = M.PLAN_NAME[li.rank];
            var what = li.reason === 'futures' ? 'Per-strike GEX for futures' : li.reason === 'symbol' ? this.symbol + ' data' : this.zdte ? '0DTE gamma exposure' : 'This view';
            var lead = li.message ? esc(li.message)
                : this.model ? 'Regime, net GEX and the whole-chain levels above are what your plan includes for ' + sym + '.'
                : 'Upgrade to see the GEX by strike chart for ' + sym + '.';
            html = skeletonHtml(this.vertical()) +
                '<div class="' + TW.ovCard + '">' + lockIcon +
                '<p class="' + TW.ovTitle + '">' + esc(what) + ' is included from the FlashAlpha ' + esc(plan) + ' plan</p>' +
                '<p class="' + TW.ovText + '">' + lead + '</p>' +
                cta(this.upgradeUrl(li.rank, 'upgrade_' + (li.reason || 'plan')), 'Upgrade to ' + plan) + '</div>';
            break;
        case 'limit':
            var e = this.error || {};
            if (e.kind === 'concurrency') {
                html = '<div class="' + TW.ovCard + '"><p class="' + TW.ovTitle + '">Still catching up</p>' +
                    '<p class="' + TW.ovText + '">Too many requests were in flight at once. Your daily quota has not been used up.</p>' +
                    '<button type="button" class="' + TW.cta + '" data-r="retry">Load again</button></div>';
            } else {
                var reset = e.resetAt ? fmtAsOf(e.resetAt) : e.retryAfter ? 'in ' + Math.ceil(e.retryAfter / 60) + ' min' : 'at midnight UTC';
                html = '<div class="' + TW.ovCard + '"><p class="' + TW.ovTitle + '">Daily FlashAlpha API limit reached</p>' +
                    '<p class="' + TW.ovText + '">Your quota resets ' + (e.resetAt ? 'at ' : '') + esc(reset) + '.</p>' +
                    cta(this.upgradeUrl(Math.min(3, (this.rank || 0) + 1), 'quota'), 'See FlashAlpha plans') + '</div>';
            }
            break;
        case 'empty':
            html = this.zdte
                ? '<div class="' + TW.ovCard + '"><p class="' + TW.ovTitle + '">No 0DTE expiry today</p>' +
                    '<p class="' + TW.ovText + '">' + sym + ' has no option expiring today.</p></div>'
                : '<div class="' + TW.ovCard + '"><p class="' + TW.ovTitle + '">No strikes to show</p>' +
                    '<p class="' + TW.ovText + '">No ' + sym + ' strikes have open interest of ' + MIN_OI + ' or more' + (this.expiry && this.expiry !== 'all' ? ' for this expiry' : '') + '. Try another expiry.</p>' +
                    '<button type="button" class="' + TW.cta + '" data-r="pick-expiry">Choose expiry</button></div>';
            break;
        case 'not_found':
            html = '<div class="' + TW.ovCard + '"><p class="' + TW.ovTitle + '">No options data for ' + sym + '</p>' +
                '<p class="' + TW.ovText + '">The symbol is unknown or has no live options data.</p></div>';
            break;
        default:
            if (this.error && this.error.kind === 'echarts') {
                html = '<div class="' + TW.ovCard + '"><p class="' + TW.ovTitle + '">ECharts is not loaded</p>' +
                    '<p class="' + TW.ovText + '">Load Apache ECharts 6 before the chart, or pass it with the echarts option.</p></div>';
                break;
            }
            html = '<div class="' + TW.ovCard + '"><p class="' + TW.ovTitle + '">Couldn’t load GEX data</p>' +
                '<p class="' + TW.ovText + '">A network or server error stopped the request.</p>' +
                '<button type="button" class="' + TW.cta + '" data-r="retry">Retry</button></div>';
    }
    ov.innerHTML = html;
};
Gex.prototype.clearChart = function () {
    if (this.chart) { this.chart.dispose(); this.chart = null; }
    this._blinkOn = false;
    this._zdteCapOn = false;
    this._priceTagOn = false;
    this._vlabelsOn = 0;
    var tip = this.$('tip');
    if (tip) tip.hidden = true;
    this.renderEdges();
};
Gex.prototype.renderChart = function () {
    var self = this;
    if (this.status !== 'ready' || !this.ec) return;
    this.applyLayers();
    var box = this.$('chart');
    var vertical = this.vertical();
    if (this.chart && this._chartVertical !== vertical) {
        this.chart.dispose();
        this.chart = null;
        this._blinkOn = this._zdteCapOn = this._priceTagOn = this._vlabelsOn = 0;
    }
    if (!this.chart) {
        this.chart = this.ec.init(box, this.theme(), { renderer: 'canvas', devicePixelRatio: root.devicePixelRatio || 1 });
        this._chartVertical = vertical;
        this.chart.on('datazoom', function () {

            if (!self._zooming) {
                self.forgetZoomBack();
                if (self.atDefault) { self.atDefault = false; self.renderZoomButton(); }
            }
            self.onZoomed();
        });
        this.chart.on('updateAxisPointer', function (e) {
            if (self.layout !== 'mobile') return;
            var dim = self.vertical() ? 'y' : 'x';
            var info = e && e.axesInfo && e.axesInfo.filter(function (a) { return a.axisDim === dim; })[0];
            var s = info && self.nearestStrike(info.value);
            var tip = self.$('tip');
            if (s) { self._tipStrike = s.strike; tip.innerHTML = self.tipHtml(s); tip.hidden = false; }
        });
    }
    if (!this.win) {
        var w = this.defaultWindow();
        var gap = M.minGap(this.model.strikes) || 0;
        this.win = { lo: w.lo - gap * 0.6, hi: w.hi + gap * 0.6 };
        this.atDefault = true;
        this.renderZoomButton();
    }
    this.chart.setOption(this.fullOption(), { replaceMerge: ['series', 'dataZoom', vertical ? 'xAxis' : 'yAxis'] });
    this.renderBlink();
    this.renderPriceTag();
    this.renderVLabels();
    this.renderZdteCaption();
    var tip = this.$('tip');
    if (this.layout === 'mobile') {
        if (tip.hidden) { tip.innerHTML = '<span class="' + TW.muted + '">Tap a bar for strike details.</span>'; tip.hidden = false; }
    } else tip.hidden = true;
    this.renderEdges();
    this.renderFooter();
};
Gex.prototype.onResize = function () {
    var lay = layoutFor(this.el.clientWidth || 1024);
    var changed = lay !== this.layout;
    var wasVertical = this.vertical();
    this.layout = lay;
    this.el.setAttribute('data-layout', lay);
    if (changed) {
        this.labelsOn = this.labelsPref[this.labelsKey()];
        if (this.vertical() !== wasVertical) {
            this.applyOrientation();
            if (this.status === 'guest' || this.status === 'locked') this.renderOverlay(this.status);
        }
        this.renderToolbar();
        this.renderLevels();
        if (this.chart) {
            this.chart.resize();
            this.renderChart();
        }
        this.disposeTrail();
        this.renderTrail();
    } else if (this.chart) {
        this.chart.resize();
        this.onZoomed();
        if (this.trailChart) this.trailChart.resize();
    }
};
Gex.prototype.exportPng = function () {
    if (!this.chart || this.status !== 'ready' || this.sample) return;
    var p = T.palette(this.theme());
    var m = this.model;
    var url = this.chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: p.bg, excludeComponents: ['dataZoom'] });
    var sym = this.symbol;
    var file = sym + '-gex-' + (m.scope === 'zdte' ? '0dte-' : '') + M.todayET() + '.png';
    var title = sym + ' GEX by strike · ' + (m.scope === 'all' ? 'All expiries' : m.scope === 'zdte' ? '0DTE ' + m.expiry : 'Exp ' + m.expiry) + (m.asOf ? ' · ' + fmtAsOf(m.asOf) : '');
    var chartImg = new Image();
    chartImg.onload = function () {
        var logo = new Image();
        var draw = function (withLogo) {
            var head = 88, foot = 56;
            var c = document.createElement('canvas');
            c.width = chartImg.width;
            c.height = chartImg.height + head + foot;
            var ctx = c.getContext('2d');
            ctx.fillStyle = p.bg;
            ctx.fillRect(0, 0, c.width, c.height);
            ctx.fillStyle = p.text;
            ctx.font = '600 30px system-ui, -apple-system, Segoe UI, sans-serif';
            ctx.textBaseline = 'middle';
            ctx.fillText(title, 32, head / 2);
            ctx.drawImage(chartImg, 0, head);
            var x = c.width - 32;
            ctx.font = '600 26px system-ui, -apple-system, Segoe UI, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillStyle = p.muted;
            ctx.fillText('flashalpha.com', x, c.height - foot / 2);
            if (withLogo) {
                var w = ctx.measureText('flashalpha.com').width;
                var lw = 36 * brand.LOGO_RATIO;
                ctx.drawImage(logo, x - w - 12 - lw, c.height - foot / 2 - 18, lw, 36);
            }
            c.toBlob(function (blob) {
                if (!blob) return;
                var a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = file;
                document.body.appendChild(a);
                a.click();
                setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
            }, 'image/png');
        };
        logo.onload = function () { draw(true); };
        logo.onerror = function () { draw(false); };
        logo.src = brand.LOGO;
    };
    chartImg.src = url;
};
Gex.prototype.getDataURL = function (o) {
    if (!this.chart || this.status !== 'ready') return null;
    var p = T.palette(this.theme());
    return this.chart.getDataURL(Object.assign({ type: 'png', pixelRatio: 2, backgroundColor: p.bg, excludeComponents: ['dataZoom'] }, o || {}));
};
Gex.prototype.setData = function (d) {
    d = d || {};
    if (this.destroyed) return;
    this.staticData = true;
    if (this.zdte) return this.updateZdte({ data: d.zeroDte, symbol: d.symbol, sample: d.sample });
    if (this.lite) {
        if (!this.expiry) this.expiry = 'all';
        return this.updateLite({ summary: d.summary, data: d.gex });
    }
    if (this.status === 'guest' || this.rank === null || this.rank === undefined) return;
    if (Object.prototype.hasOwnProperty.call(d, 'summary')) { this.summary = d.summary || null; this.summaryProvided = true; }
    if (d.gex) this.gexRaw = d.gex;
    this.load();
};
Gex.prototype.setLayers = function (layers) {
    if (this.pageData || !layers || typeof layers !== 'object') return;
    var self = this;
    M.LAYER_KEYS.forEach(function (k) { if (Object.prototype.hasOwnProperty.call(layers, k)) self.layers[k] = layers[k] === true; });
    this.layersChosen = true;
    this.savePrefs();
    this.renderLayers();
    this.syncLayers('toggle');
};
export function createChart(el, opts, emit) {
    var g = new Gex(el, opts, emit);
    g.start();
    return g;
}
