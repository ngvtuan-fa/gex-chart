import M from './model.js';
import { sharedLimiter } from './limiter.js';

export var DEFAULT_API_BASE = 'https://lab.flashalpha.com';
export var MIN_OI = 100;
var TIMEOUT_MS = 15000;

function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
}

function enc(symbol) {
    return encodeURIComponent(String(symbol || '').toUpperCase());
}

function classify429(body) {
    var err = body && body.error ? String(body.error).toLowerCase() : '';
    if (err.indexOf('concurrency') !== -1) return 'concurrency';
    if (err.indexOf('quota') !== -1) return 'quota';
    return null;
}

export function planRankFromName(name) {
    var n = String(name || '').toLowerCase();
    if (n === 'enterprise') return 3;
    var r = M.rankFromPlanName(n);
    return r === null ? 0 : r;
}

export function createApi(cfg) {
    cfg = cfg || {};
    var base = String(cfg.apiBase || DEFAULT_API_BASE).replace(/\/+$/, '');
    var store = cfg.storage;
    var limiter = cfg.limiter || sharedLimiter(cfg.maxConcurrent || 3);
    var doFetch = typeof cfg.fetch === 'function' ? cfg.fetch : function (url, init) { return fetch(url, init); };

    function hasCredentials() {
        if (cfg.apiKey === null) return false;
        return !!cfg.apiKey || typeof cfg.getApiKey === 'function' || base !== DEFAULT_API_BASE;
    }

    async function apiKey() {
        if (typeof cfg.getApiKey === 'function') {
            try { return (await cfg.getApiKey()) || null; } catch (e) { return null; }
        }
        return cfg.apiKey || null;
    }

    async function headers() {
        var h = {};
        if (cfg.source !== false) h['X-Source'] = cfg.source || 'gex-charts';
        var key = await apiKey();
        if (key) h['X-Api-Key'] = key;
        if (typeof cfg.headers === 'function') {
            try { Object.assign(h, cfg.headers() || {}); } catch (e) { return h; }
        }
        return h;
    }

    function init(h) {
        var o = { headers: h };
        if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) o.signal = AbortSignal.timeout(TIMEOUT_MS);
        return o;
    }

    async function request(path) {
        var delay = 250;
        for (var attempt = 0; attempt < 3; attempt++) {
            var res;
            try {
                var h = await headers();
                res = await limiter.run(function () { return doFetch(base + path, init(h)); });
            } catch (e) {
                return { ok: false, status: 0, data: null, error: { kind: 'network' } };
            }
            var body = null;
            try { body = await res.json(); } catch (e) { body = null; }
            if (res.ok) return { ok: true, status: res.status, data: body, error: null };
            var code = body && body.error ? String(body.error) : null;
            if (res.status === 429) {
                var kind = classify429(body);
                if (kind === 'concurrency' && attempt < 2) {
                    await sleep(Math.round(delay * (0.5 + Math.random())));
                    delay *= 2;
                    continue;
                }
                var retryAfter = null;
                try { retryAfter = M.num(res.headers && res.headers.get('Retry-After')); } catch (e) { retryAfter = null; }
                return {
                    ok: false, status: 429, data: null,
                    error: { kind: kind === 'concurrency' ? 'concurrency' : 'quota', code: code, resetAt: (body && body.reset_at) || null, retryAfter: retryAfter }
                };
            }
            if (res.status === 401) return { ok: false, status: 401, data: null, error: { kind: 'unauthorized', code: code } };
            if (res.status === 403) {
                return {
                    ok: false, status: 403, data: null,
                    error: { kind: 'locked', code: code, requiredRank: M.rankFromPlanName(body && body.required_plan), message: (body && body.message) || null }
                };
            }
            if (res.status === 404) return { ok: false, status: 404, data: null, error: { kind: 'not_found', code: code } };
            if (res.status >= 500) return { ok: false, status: res.status, data: null, error: { kind: 'network', code: code } };
            return { ok: false, status: res.status, data: null, error: { kind: 'http', code: code } };
        }
        return { ok: false, status: 429, data: null, error: { kind: 'concurrency' } };
    }

    async function account() {
        try {
            var res = await doFetch(base + '/v1/account', init(await headers()));
            if (!res.ok) return { status: res.status, body: null };
            return { status: res.status, body: await res.json() };
        } catch (e) {
            return { status: 0, body: null };
        }
    }

    async function fetchPlan() {
        if (cfg.plan !== undefined && cfg.plan !== null && cfg.plan !== '') return { rank: planRankFromName(cfg.plan), invalid: false };
        if (!hasCredentials()) return { rank: null, invalid: false };
        var a = await account();
        if (a.status === 401 || a.status === 403) return { rank: null, invalid: true };
        return { rank: a.body ? planRankFromName(a.body.plan) : 0, invalid: false };
    }

    async function fetchAccount() {
        var a = await account();
        var body = a.body;
        if (!body) return null;
        if (String(body.daily_limit).toLowerCase() === 'unlimited') return { unlimited: true };
        var limit = M.num(body.daily_limit);
        var remaining = M.num(body.remaining);
        if (remaining === null && limit !== null) remaining = Math.max(0, limit - (M.num(body.usage_today) || 0));
        return limit === null || remaining === null ? null : { unlimited: false, limit: limit, remaining: remaining };
    }

    function fetchSummary(symbol) {
        return request('/v1/stock/' + enc(symbol) + '/summary');
    }

    function fetchGex(symbol, expiry) {
        var q = '?min_oi=' + MIN_OI;
        if (expiry && expiry !== 'all') q = '?expiration=' + encodeURIComponent(expiry) + '&min_oi=' + MIN_OI;
        return request('/v1/exposure/gex/' + enc(symbol) + q);
    }

    function fetchFlow(symbol, expiry) {
        var q = '?polarity=flow';
        if (expiry && expiry !== 'all') q += '&expiry=' + encodeURIComponent(expiry);
        return request('/v1/flow/gex/' + enc(symbol) + q);
    }

    function fetchExpectedMove(symbol) {
        return request('/v1/expected-move/' + enc(symbol));
    }

    function fetchPinRisk(symbol, expiry) {
        var q = expiry && expiry !== 'all' ? '?expiry=' + encodeURIComponent(expiry) : '';
        return request('/v1/flow/pin-risk/' + enc(symbol) + q);
    }

    function fetchQuote(symbol) {
        return request('/stockquote/' + enc(symbol));
    }

    function fetchZeroDte(symbol) {
        return request('/v1/exposure/zero-dte/' + enc(symbol));
    }

    function expiryKey(symbol, today) { return 'exp:' + String(symbol).toUpperCase() + ':' + today; }

    function readCachedExpiries(symbol, today) {
        var list = store.get(expiryKey(symbol, today));
        return Array.isArray(list) && list.length ? list : null;
    }

    function hasCachedExpiries(symbol, today) { return !!readCachedExpiries(symbol, today); }

    var expiriesInFlight = {};

    function fetchExpiries(symbol, today) {
        var list = readCachedExpiries(symbol, today);
        if (list) return Promise.resolve({ ok: true, status: 200, data: list, error: null, cached: true });
        var key = expiryKey(symbol, today);
        if (!expiriesInFlight[key]) {
            expiriesInFlight[key] = loadExpiries(symbol, today).then(function (r) {
                delete expiriesInFlight[key];
                return r;
            });
        }
        return expiriesInFlight[key];
    }

    async function loadExpiries(symbol, today) {
        var r = await request('/v1/options/' + enc(symbol));
        if (!r.ok) return r;
        var expiries = M.expiriesFromOptions(r.data);
        store.prune('exp:', function (k) { return k.slice(-10) === today; });
        store.set(expiryKey(symbol, today), expiries);
        return { ok: true, status: r.status, data: expiries, error: null, cached: false };
    }

    function readDenied() {
        var d = store.get('denied');
        if (d && d.day === M.todayET() && d.symbols) return d;
        return { day: M.todayET(), symbols: {} };
    }

    function deniedSymbol(symbol) {
        return readDenied().symbols[String(symbol || '').toUpperCase()] || null;
    }

    function rememberDenied(symbol, err, rank) {
        var d = readDenied();
        var entry = { rank: (err && err.requiredRank) || (rank || 0) + 1, message: (err && err.message) || null };
        d.symbols[String(symbol || '').toUpperCase()] = entry;
        store.set('denied', d);
        return entry;
    }

    function readTrailStore() {
        var s = store.get('trail');
        if (s && s.day === M.todayET() && s.symbols) return s;
        return { day: M.todayET(), symbols: {} };
    }

    function readTrail(symbol) {
        return readTrailStore().symbols[String(symbol || '').toUpperCase()] || [];
    }

    function appendTrail(symbol, point) {
        var next = M.trailAdd(readTrailStore(), symbol, point, M.todayET());
        store.set('trail', next);
        return next.symbols[String(symbol || '').toUpperCase()] || [];
    }

    return {
        MIN_OI: MIN_OI,
        apiBase: base,
        hasCredentials: hasCredentials,
        fetchPlan: fetchPlan,
        fetchAccount: fetchAccount,
        fetchSummary: fetchSummary,
        fetchGex: fetchGex,
        fetchFlow: fetchFlow,
        fetchExpectedMove: fetchExpectedMove,
        fetchPinRisk: fetchPinRisk,
        fetchQuote: fetchQuote,
        fetchZeroDte: fetchZeroDte,
        fetchExpiries: fetchExpiries,
        hasCachedExpiries: hasCachedExpiries,
        deniedSymbol: deniedSymbol,
        rememberDenied: rememberDenied,
        readTrail: readTrail,
        appendTrail: appendTrail
    };
}
