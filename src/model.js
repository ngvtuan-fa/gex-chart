var MINUS = '−';
var BASIC = 1, GROWTH = 2, ALPHA = 3;
var PLAN_SLUG = { 1: 'basic', 2: 'growth', 3: 'alpha' };
var PLAN_NAME = { 1: 'Basic', 2: 'Growth', 3: 'Alpha' };
var RANGES = [0.05, 0.10, 0.20, 'all'];
var ZDTE_RANGES = [0.005, 0.01, 0.02, 'all'];
var VIEWS = ['net', 'callput', 'oi', 'flow'];
var MERGE_PCT = 0.005;
var STALE_MS = 15 * 60 * 1000;
function num(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
}
function sign(v) { return v < 0 ? MINUS : '+'; }
function trimZeros(s) {
    return s.indexOf('.') === -1 ? s : s.replace(/0+$/, '').replace(/\.$/, '');
}
function grouped(v, minFrac, maxFrac) {
    return Number(v).toLocaleString('en-US', { minimumFractionDigits: minFrac, maximumFractionDigits: maxFrac });
}

function sigFixed(v, sig) {
    var intDigits = v >= 1 ? Math.floor(Math.log10(v)) + 1 : 1;
    return trimZeros(v.toFixed(Math.max(0, sig - intDigits)));
}
function compact(abs, sig) {
    var units = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
    for (var i = 0; i < units.length; i++) {
        if (abs >= units[i][0]) {
            var s = sigFixed(abs / units[i][0], sig);
            if (Number(s) >= 1000 && i > 0) return sigFixed(abs / units[i - 1][0], sig) + units[i - 1][1];
            return s + units[i][1];
        }
    }
    return sigFixed(abs, sig);
}
function fmtGex(v) {
    v = num(v);
    if (v === null) return '–';
    if (v === 0) return '0';
    return sign(v) + compact(Math.abs(v), 3);
}
function fmtCount(v, signed) {
    v = num(v);
    if (v === null) return '–';
    var s = grouped(Math.abs(Math.round(v)), 0, 0);
    if (!signed) return (v < 0 ? MINUS : '') + s;
    return v === 0 ? '0' : sign(v) + s;
}
function fmtStrike(v, cur) {
    v = num(v);
    if (v === null) return '–';
    return (cur === undefined ? '$' : cur) + grouped(v, 0, 4);
}
function fmtAxisStrike(v, cur) {
    v = num(v);
    return fmtStrike(v === null ? v : Math.round(v * 100) / 100, cur);
}
function fmtPrice(v, cur) {
    v = num(v);
    if (v === null) return '–';
    return (cur === undefined ? '$' : cur) + grouped(v, 2, 2);
}
function fmtPct(frac, digits) {
    frac = num(frac);
    if (frac === null) return '–';
    var d = digits === undefined ? 1 : digits;
    var abs = Math.abs(frac * 100).toFixed(d);
    if (Number(abs) === 0) return '0.' + new Array(d + 1).join('0') + '%';
    return sign(frac) + abs + '%';
}
function fmtDiff(v, cur) {
    v = num(v);
    if (v === null) return '–';
    return sign(v) + (cur === undefined ? '$' : cur) + grouped(Math.abs(v), 2, 2);
}
function fmtNotional(v) {
    v = num(v);
    if (v === null) return '–';
    return '$' + compact(Math.abs(v), 2);
}
function todayET(nowMs) {
    var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' })
        .formatToParts(new Date(nowMs === undefined ? Date.now() : nowMs));
    var get = function (t) { for (var i = 0; i < parts.length; i++) if (parts[i].type === t) return parts[i].value; return ''; };
    return get('year') + '-' + get('month') + '-' + get('day');
}
function isStale(asOf, nowMs, marketOpen) {
    if (!marketOpen || !asOf) return false;
    var t = Date.parse(asOf);
    if (!isFinite(t)) return false;
    return (nowMs === undefined ? Date.now() : nowMs) - t > STALE_MS;
}

function cleanApiText(s) {
    return String(s).replace(/\s*\([a-z]+(?:_[a-z]+)+\)/g, '').replace(/\s*[\u2014\u2013]\s*/g, ' - ');
}
function asOfPrefix(marketOpen, assetType) {
    return marketOpen === false && assetType !== 'futures' ? 'As of last close · ' : 'As of ';
}

function belowQuotaReserve(q, reserve) {
    return !q.unlimited && q.remaining < q.limit * reserve;
}
function isFutures(symbol, assetType) {
    return assetType === 'futures' || /=F$/i.test(String(symbol || ''));
}
function symbolAccess(symbol, assetType, rank, denied) {
    var s = String(symbol || '').trim().toUpperCase();
    var r = rank || 0;
    if (isFutures(s, assetType)) return r >= GROWTH ? open() : locked(GROWTH, 'futures');
    if (denied && r < denied.rank) {
        var out = locked(denied.rank, 'symbol');
        out.message = denied.message || null;
        return out;
    }
    return open();
    function open() { return { locked: false, requiredRank: null, reason: null }; }
    function locked(req, why) { return { locked: true, requiredRank: req, reason: why }; }
}
function expiryLocked(expiry, rank, today) {
    if ((rank || 0) >= GROWTH) return false;
    return expiry === 'all' || expiry === today;
}

function defaultExpiry(expiries, rank, today) {
    if ((rank || 0) >= GROWTH) return 'all';
    var list = (expiries || []).slice().sort();
    for (var i = 0; i < list.length; i++) if (list[i] > today) return list[i];
    return null;
}
function rankFromPlanName(name) {
    var n = String(name || '').toLowerCase();
    if (n === 'basic') return BASIC;
    if (n === 'growth') return GROWTH;
    if (n === 'alpha' || n === 'pro') return ALPHA;
    return null;
}
function expiriesFromOptions(resp) {
    var out = [];
    var list = resp && Array.isArray(resp.expirations) ? resp.expirations : [];
    for (var i = 0; i < list.length; i++) {
        var e = typeof list[i] === 'string' ? list[i] : (list[i] && list[i].expiration);
        if (e && out.indexOf(e) === -1) out.push(e);
    }
    return out.sort();
}

function normalizeStrikes(raw, keepNulls) {
    var val = keepNulls ? num : function (v) { return num(v) || 0; };
    var out = [];
    (raw || []).forEach(function (s) {
        var k = num(s && s.strike);
        if (k === null) return;
        out.push({
            strike: k,
            callGex: val(s.call_gex),
            putGex: val(s.put_gex),
            netGex: num(s.net_gex),
            callOi: val(s.call_oi),
            putOi: val(s.put_oi),
            callVol: val(s.call_volume),
            putVol: val(s.put_volume),
            dCallOi: num(s.call_oi_change),
            dPutOi: num(s.put_oi_change)
        });
    });
    return out.sort(function (a, b) { return a.strike - b.strike; });
}
function regimeNoteFor(flip, regime, status) {
    if (num(flip) === null) return null;
    if (status && status !== 'available') return 'unverified';
    var r = String(regime || '').toLowerCase();
    return r && r.indexOf('positive') === -1 && r.indexOf('negative') === -1 ? 'at_flip' : null;
}
function regimeKey(regime) {
    var r = String(regime || '').toLowerCase();
    if (r.indexOf('positive') !== -1) return 'positive';
    if (r.indexOf('negative') !== -1) return 'negative';
    return 'unknown';
}
function regimeLabel(regime) {
    var k = regimeKey(regime);
    return k === 'positive' ? 'Positive gamma' : k === 'negative' ? 'Negative gamma' : 'Undetermined';
}
function flipNote(flip, status) {
    return num(flip) !== null && status && status !== 'available' ? 'unverified' : null;
}
function optionsFeedAsOf(symbol, assetType, responses) {
    var keys = isFutures(symbol, assetType) ? ['futures_options_feed'] : ['equity_options_feed', 'index_options_feed'];
    for (var i = 0; i < responses.length; i++) {
        var d = responses[i] && responses[i].data_as_of;
        if (!d) continue;
        var found = null;
        keys.forEach(function (k) {
            if (d[k] && (found === null || Date.parse(d[k]) < Date.parse(found))) found = d[k];
        });
        if (found) return found;
    }
    return null;
}
function buildModel(opts) {
    var summary = opts.summary || null;
    var gex = opts.gex || {};
    var exp = (summary && summary.exposure) || {};
    var scope = opts.expiry && opts.expiry !== 'all' ? 'single' : 'all';
    var strikes = normalizeStrikes(gex.strikes, opts.keepNulls === true);
    var price = summary && summary.price;
    var spot = num(price && (price.mid !== undefined && price.mid !== null ? price.mid : price.last));
    if (spot === null) spot = num(gex.underlying_price);
    var chainFlip = num(exp.gamma_flip);
    var chainStatus = exp.gamma_flip_status || (chainFlip === null ? null : 'available');
    var chainRegime = summary ? regimeKey(exp.regime) : 'unknown';
    var chain = {
        netGex: num(exp.net_gex),
        regime: chainRegime,
        regimeNote: summary ? regimeNoteFor(chainFlip, exp.regime, exp.gamma_flip_status) : null,
        flip: chainFlip,
        flipStatus: exp.gamma_flip_status || null,
        flipVerified: chainFlip !== null && chainStatus === 'available',
        callWall: num(exp.call_wall),
        putWall: num(exp.put_wall),
        maxPain: num(exp.max_pain)
    };
    var flip, flipVerified, flipStatus, callWall, putWall, maxPain, regime, regimeNote, scopeNet;
    if (scope === 'all' && summary) {
        flip = chain.flip; flipVerified = chain.flipVerified; flipStatus = chain.flipStatus;
        callWall = chain.callWall; putWall = chain.putWall; maxPain = chain.maxPain;
        regime = chain.regime; regimeNote = chain.regimeNote;
        scopeNet = chain.netGex !== null ? chain.netGex : num(gex.net_gex);
    } else {
        flip = num(gex.gamma_flip);
        flipVerified = flip !== null && (gex.gamma_flip_status || 'available') === 'available';
        flipStatus = gex.gamma_flip_status || null;
        regime = 'unknown';
        regimeNote = flipNote(flip, flipStatus);
        callWall = null; putWall = null; maxPain = null;
        scopeNet = num(gex.net_gex);
    }

    var hedge = scope === 'all' ? exp.hedging_estimate || null : null;
    var interpretation = scope === 'all' && exp.interpretation && exp.interpretation.gamma ? String(exp.interpretation.gamma) : null;
    return {
        symbol: opts.symbol || (summary && summary.symbol) || gex.symbol || '',
        spot: spot,
        asOf: optionsFeedAsOf(opts.symbol || gex.symbol, opts.assetType, [gex, summary]) || gex.as_of || (summary && summary.as_of) || null,
        marketOpen: summary ? summary.market_open !== false : null,
        delayed: !!(summary && summary.snapshot_as_of && summary.snapshot_as_of.delayed),
        expiry: scope === 'all' ? 'all' : opts.expiry,
        scope: scope,
        netGex: chain.netGex !== null ? chain.netGex : scopeNet,
        headerRegime: summary ? chain.regime : regime,
        headerRegimeNote: summary ? chain.regimeNote : regimeNote,
        headerFlipStatus: summary ? chain.flipStatus : flipStatus,
        scopeNetGex: scopeNet,
        regime: regime,
        regimeNote: regimeNote,
        flip: flip,
        flipVerified: flipVerified,
        flipStatus: flipStatus,
        callWall: callWall,
        putWall: putWall,
        maxPain: maxPain,
        chain: chain,
        hedge: hedge && (hedge.spot_up_1pct || hedge.spot_down_1pct) ? hedge : null,
        interpretation: interpretation,
        strikes: strikes,
        filter: { minOi: opts.minOi === undefined ? 100 : opts.minOi, shown: strikes.length, total: strikes.length }
    };
}
function modelFromZeroDte(raw) {
    if (!raw || raw.no_zero_dte === true) return null;
    var reg = raw.regime || {}, ex = raw.exposures || {}, lv = raw.levels || {};
    var pr = raw.pin_risk || null, em = raw.expected_move || null;
    var strikes = normalizeStrikes(raw.strikes, true);
    var flip = num(reg.gamma_flip);
    var flipStatus = reg.gamma_flip_status || null;
    var regime = regimeKey(reg.label);
    var net = num(ex.net_gex);
    var expiry = raw.expiration || null;
    var pin = null;
    if (pr && num(pr.pin_score) !== null) {
        var c = pr.components || {};
        pin = {
            score: num(pr.pin_score),
            magnet: num(pr.magnet_strike),
            expiry: expiry,
            hours: num(raw.time_to_close_hours),
            asOf: raw.as_of || null,
            breakdown: { oi: num(c.oi_score), proximity: num(c.proximity_score), time: num(c.time_score), gamma: num(c.gamma_score) }
        };
    }
    var move = em ? {
        expiry: expiry,
        days: 0,
        atmIv: num(em.atm_iv),
        move: num(em.remaining_1sd_dollars),
        pct: num(em.remaining_1sd_pct),
        lo: num(em.lower_bound),
        hi: num(em.upper_bound)
    } : null;
    if (move && (move.lo === null || move.hi === null)) move = null;
    return {
        symbol: raw.symbol || '',
        spot: num(raw.underlying_price),
        asOf: raw.as_of || null,
        marketOpen: raw.market_open === true ? true : raw.market_open === false ? false : null,
        delayed: false,
        expiry: expiry,
        scope: 'zdte',
        netGex: net,
        headerRegime: regime,
        headerRegimeNote: regimeNoteFor(flip, reg.label, flipStatus),
        headerFlipStatus: flipStatus,
        scopeNetGex: net,
        regime: regime,
        regimeNote: regimeNoteFor(flip, reg.label, flipStatus),
        flip: flip,
        flipVerified: flip !== null && (flipStatus || 'available') === 'available',
        flipStatus: flipStatus,
        callWall: num(lv.call_wall),
        putWall: num(lv.put_wall),
        maxPain: pr ? num(pr.max_pain) : null,
        pin: pin,
        magnet: pin ? pin.magnet : null,
        em: move,
        emLow: move ? move.lo : null,
        emHigh: move ? move.hi : null,
        chain: null,
        hedge: null,
        interpretation: null,
        flow: null,
        zdte: null,
        strikes: strikes,
        filter: { strikeRange: 0.03, shown: strikes.length, total: strikes.length }
    };
}

function normalizeFlow(raw) {
    raw = raw || {};
    var byStrike = {};
    var count = 0;
    (raw.strikes || []).forEach(function (s) {
        var k = num(s && s.strike);
        if (k === null) return;
        byStrike[k] = {
            flowCall: num(s.call_gex),
            flowPut: num(s.put_gex),
            flowNet: num(s.net_gex),
            callPos: num(s.call_dealer_pos),
            putPos: num(s.put_dealer_pos)
        };
        count++;
    });
    var cov = raw.flow_coverage;
    return {
        asOf: raw.as_of || null,
        netGex: num(raw.live_net_gex),
        flip: num(raw.live_gamma_flip),
        coverage: cov ? { total: num(cov.contracts_total), withFlow: num(cov.contracts_with_flow), sourceOk: cov.flow_source_ok !== false } : null,
        byStrike: byStrike,
        count: count
    };
}
function attachFlow(m, raw) {
    var f = normalizeFlow(raw);
    var matched = 0;
    (m.strikes || []).forEach(function (s) {
        var x = f.byStrike[s.strike];
        if (x) matched++;
        s.flowNet = x ? x.flowNet : null;
        s.flowCall = x ? x.flowCall : null;
        s.flowPut = x ? x.flowPut : null;
        s.callPos = x ? x.callPos : null;
        s.putPos = x ? x.putPos : null;
    });
    m.flow = { netGex: f.netGex, flip: f.flip, coverage: f.coverage, asOf: f.asOf, matched: matched, unmatched: f.count - matched };
    m.flowFlip = f.flip;
    return m;
}
function flowSentence(m) {
    var f = m && m.flow;
    if (!f) return '';
    if (f.coverage && f.coverage.sourceOk === false) return 'Session flow is unavailable right now.';
    var net = num(f.netGex);
    if (net === null || net === 0) return 'No classified session flow since 09:30 ET yet.';
    return 'Session flow GEX since 09:30 ET: ' + fmtGex(net) + ' per 1% move.';
}
function rangeWindow(strikes, spot, range) {
    if (!strikes.length) return null;
    var min = strikes[0].strike, max = strikes[strikes.length - 1].strike;
    if (range === 'all' || num(spot) === null) return { lo: min, hi: max };
    return { lo: spot * (1 - range), hi: spot * (1 + range) };
}
function inWindow(strikes, lo, hi) {
    return (strikes || []).filter(function (s) { return s.strike >= lo && s.strike <= hi; });
}
function minGap(strikes) {
    var g = Infinity;
    for (var i = 1; i < strikes.length; i++) {
        var d = strikes[i].strike - strikes[i - 1].strike;
        if (d > 0 && d < g) g = d;
    }
    return isFinite(g) ? g : null;
}
function fitWindow(strikes, spot, lo, hi, maxSlots) {
    var all = strikes || [];
    var inside = inWindow(all, lo, hi);
    var gap = minGap(inside);
    if (!maxSlots || gap === null || (hi - lo) / gap <= maxSlots) {
        return { lo: lo, hi: hi, shown: inside.length, total: all.length, narrowed: false };
    }
    var width = gap * maxSlots;
    var c = num(spot) === null ? (lo + hi) / 2 : spot;
    var nlo = Math.max(lo, c - width / 2);
    var nhi = nlo + width;
    if (nhi > hi) { nhi = hi; nlo = hi - width; }
    return { lo: nlo, hi: nhi, shown: inWindow(all, nlo, nhi).length, total: all.length, narrowed: true };
}
function viewValues(s, view) {
    switch (view) {
        case 'callput': return { up: s.callGex, down: s.putGex };
        case 'oi': return { up: s.callOi, down: -Math.abs(s.putOi) };
        case 'flow': return { net: s.flowNet };
        default: return { net: s.netGex };
    }
}
function quotePrice(raw) {
    if (!raw) return null;
    var p = num(raw.mid);
    if (p === null) p = num(raw.lastPrice);
    return p === null ? null : { price: p, at: raw.lastUpdate || null };
}
function currentPrice(summary, quote, live) {
    var pr = (summary && summary.price) || {};
    var first = live ? num(pr.mid) : num(pr.last), second = live ? num(pr.last) : num(pr.mid);
    var s = first !== null ? first : second;
    var fromSummary = s === null ? null : { price: s, at: pr.last_update || (summary && summary.as_of) || null, source: 'summary' };
    var q = quote && num(quote.price) !== null ? { price: num(quote.price), at: quote.at || null, source: 'quote' } : null;
    var pick = !q ? fromSummary : !fromSummary ? q : (Date.parse(q.at) || 0) >= (Date.parse(fromSummary.at) || 0) ? q : fromSummary;
    return pick ? { price: pick.price, at: pick.at, source: pick.source, live: !!live } : null;
}
function hasAny() {
    for (var i = 0; i < arguments.length; i++) if (num(arguments[i]) !== null) return true;
    return false;
}
function netKey(view) { return view === 'flow' ? 'flowNet' : 'netGex'; }

function topStrikes(windowStrikes, view, n) {
    var mag = function (s) {
        if (view === 'callput') return Math.max(Math.abs(s.callGex), Math.abs(s.putGex));
        return Math.abs(s[netKey(view)] || 0);
    };
    return (windowStrikes || []).slice()
        .filter(function (s) { return mag(s) > 0; })
        .sort(function (a, b) { return mag(b) - mag(a); })
        .slice(0, n === undefined ? 3 : n)
        .map(function (s) { return s.strike; });
}

var ZONE_TEXT = {
    pos: { full: 'Positive gamma · moves tend to dampen', short: '+γ · dampen' },
    neg: { full: 'Negative gamma · moves tend to amplify', short: MINUS + 'γ · amplify' }
};
function regimeZones(m, lo, hi) {
    var flip = m ? num(m.flip) : null;
    if (flip === null || !m.flipVerified || (m.regime !== 'positive' && m.regime !== 'negative')) return [];
    if (num(lo) === null || num(hi) === null || hi <= lo) return [];
    var out = [];
    if (flip > lo) out.push({ side: 'neg', lo: lo, hi: Math.min(flip, hi) });
    if (flip < hi) out.push({ side: 'pos', lo: Math.max(flip, lo), hi: hi });
    return out;
}
function zoneLabel(side, mobile) {
    var t = ZONE_TEXT[side];
    return t ? (mobile ? t.short : t.full) : '';
}
function zoneLabelFits(zone, lo, hi, plotPx, textPx) {
    if (!zone || !(hi > lo) || !(plotPx > 0)) return false;
    return (zone.hi - zone.lo) / (hi - lo) * plotPx >= textPx;
}

function stackLabels(items, top, bottom, gap) {
    var list = items || [];
    var g = num(gap) === null ? 0 : gap;
    var out = [];
    var i, half;
    for (i = 0; i < list.length; i++) {
        half = list[i].h / 2;
        var minY = i === 0 ? top + half : out[i - 1] + list[i - 1].h / 2 + g + half;
        out.push(Math.max(list[i].y, minY));
    }
    for (i = list.length - 1; i >= 0; i--) {
        half = list[i].h / 2;
        var maxY = i === list.length - 1 ? bottom - half : out[i + 1] - list[i + 1].h / 2 - g - half;
        out[i] = Math.min(out[i], maxY);
    }
    return out;
}

var LEVEL_META = {
    callWall: { label: 'Call Wall', short: 'CW' },
    spot: { label: 'Spot', short: 'Spot' },
    flip: { label: 'Flip', short: 'Flip' },
    putWall: { label: 'Put Wall', short: 'PW' },
    maxPain: { label: 'Max Pain', short: 'MP' },
    flowFlip: { label: 'Flow flip', short: 'FF' }
};
var LEVEL_ORDER = ['callWall', 'spot', 'flip', 'putWall', 'maxPain', 'flowFlip'];
function levelList(src, spot, opts) {
    opts = opts || {};
    var out = [];
    LEVEL_ORDER.forEach(function (key, i) {
        var price = key === 'spot' ? spot : src[key];
        if (num(price) === null) return;
        if (key === 'maxPain' && opts.maxPain === false) return;
        if (key === 'flowFlip' && opts.flowFlip !== true) return;
        if (key === 'spot' && opts.spot === false) return;
        out.push({
            key: key,
            label: LEVEL_META[key].label,
            short: LEVEL_META[key].short,
            price: price,
            verified: key === 'flip' ? !!src.flipVerified : true,
            order: i
        });
    });
    return out.sort(function (a, b) { return b.price - a.price || a.order - b.order; });
}
function mergeLevels(levels, spot, threshold) {
    var t = threshold === undefined ? MERGE_PCT : threshold;
    var ref = num(spot);
    var sorted = (levels || []).slice().sort(function (a, b) { return a.price - b.price || a.order - b.order; });
    var groups = [];
    sorted.forEach(function (l) {
        var g = groups[groups.length - 1];
        var base = ref || l.price;
        if (g && Math.abs(l.price - g.items[g.items.length - 1].price) / base < t) g.items.push(l);
        else groups.push({ items: [l] });
    });
    return groups.map(function (g) {
        var items = g.items.slice().sort(function (a, b) { return a.order - b.order; });
        return {
            price: items[0].price,
            keys: items.map(function (i) { return i.key; }),
            items: items,
            label: items.map(function (i) { return i.label; }).join(' · ')
        };
    });
}
function conclusion(m, opts) {
    opts = opts || {};
    var cur = opts.currency === undefined ? '$' : opts.currency;
    var parts = [];
    var flip = num(m.flip);
    var net = num(m.scopeNetGex);
    var netTxt = net !== null && net !== 0 ? 'Net GEX is ' + fmtGex(net) + '.' : '';
    if (m.scope === 'single') {
        parts.push(flip === null ? noFlipReason(m.flipStatus) + '.'
            : 'Gamma flip ' + fmtPrice(flip, cur) + (m.flipVerified ? '' : ' (unverified)') + '.');
        if (netTxt) parts.push(netTxt);
        var chainWalls = wallsText(m.chain);
        if (chainWalls) parts.push('All expiries: ' + chainWalls + '.');
        return parts.join(' ');
    }
    if (m.interpretation) {
        var apiText = cleanApiText(m.interpretation);
        parts.push(/[.!?]$/.test(apiText) ? apiText : apiText + '.');
    } else if (flip === null) {
        parts.push(noFlipReason(m.flipStatus) + (m.regime === 'positive' || m.regime === 'negative'
            ? '. ' + tendency(m.regime) : ', so the regime is undetermined.'));
    } else if (!m.flipVerified || m.regimeNote === 'unverified') {
        parts.push('Gamma flip ' + fmtPrice(flip, cur) + ' is unverified, so the regime is undetermined.');
    } else if (m.regime === 'positive' || m.regime === 'negative') {
        parts.push('Gamma flip ' + fmtPrice(flip, cur) + ': ' + (m.regime === 'positive' ? 'positive' : 'negative') + ' gamma, ' +
            tendency(m.regime).charAt(0).toLowerCase() + tendency(m.regime).slice(1));
    } else {
        parts.push('Spot is at the gamma flip (' + fmtPrice(flip, cur) + '): the regime is undetermined.');
    }
    if (flip === null && netTxt) parts.push(netTxt);
    var walls = wallsText(m);
    if (walls) parts.push(walls.charAt(0).toUpperCase() + walls.slice(1) + '.');
    var h = hedgeSentence(m.hedge, m.symbol);
    if (h) parts.push(h);
    return parts.join(' ');

    function tendency(regime) {
        return 'Dealer hedging tends to ' + (regime === 'positive' ? 'dampen' : 'amplify') + ' moves.';
    }
    function wallsText(src) {
        var w = [];
        if (src && num(src.callWall) !== null) w.push('call wall ' + fmtStrike(src.callWall, cur));
        if (src && num(src.putWall) !== null) w.push('put wall ' + fmtStrike(src.putWall, cur));
        return w.join(', ');
    }
}
function noFlipReason(status) {
    return status === 'no_boundary' ? 'No gamma flip within 8% of spot' : 'Gamma flip not published';
}
function hedgeSentence(hedge, sym) {
    var up = hedge && hedge.spot_up_1pct;
    if (!up || num(up.notional_usd) === null || !up.direction) return '';
    var dir = String(up.direction).toLowerCase();
    if (dir !== 'buy' && dir !== 'sell') return '';
    return 'A 1% rise would have dealers ' + dir + ' about ' + fmtNotional(up.notional_usd) + ' of ' + sym + '.';
}
function etClock(nowMs) {
    var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
        .formatToParts(new Date(nowMs === undefined ? Date.now() : nowMs));
    var get = function (t) { for (var i = 0; i < parts.length; i++) if (parts[i].type === t) return parts[i].value; return ''; };
    return { day: get('year') + '-' + get('month') + '-' + get('day'), minutes: (Number(get('hour')) % 24) * 60 + Number(get('minute')) };
}
function afterCloseET(nowMs) { return etClock(nowMs).minutes >= 16 * 60; }

function sessionBoundsET(day) {
    var p = String(day).split('-').map(Number);
    var noonUtc = Date.UTC(p[0], p[1] - 1, p[2], 12, 0);
    var off = 12 * 60 - etClock(noonUtc).minutes;
    return { open: Date.UTC(p[0], p[1] - 1, p[2], 9, 30) + off * 60000, close: Date.UTC(p[0], p[1] - 1, p[2], 16, 0) + off * 60000 };
}
var LAYERS = [
    { key: 'em', label: 'Expected move', rank: BASIC, what: 'Expected move', lead: 'See the straddle-implied range for the expiry you’re viewing, right on the GEX chart.' },
    { key: 'pin', label: 'Pin risk', rank: GROWTH, what: 'Pin risk', lead: '0–100 pin score and magnet strike for the expiry you’re viewing.' },
    { key: 'zdte', label: '0DTE', rank: GROWTH, what: '0DTE gamma', lead: 'Overlay today’s expiry on the full chain to see which strikes matter intraday.' },
    { key: 'trail', label: 'Flip trail', rank: BASIC, what: 'Flip trail', lead: 'Track how the gamma flip moves against spot through the session.' }
];
var LAYER_KEYS = LAYERS.map(function (l) { return l.key; });
function layerMeta(key) {
    for (var i = 0; i < LAYERS.length; i++) if (LAYERS[i].key === key) return LAYERS[i];
    return null;
}
function defaultLayers(rank) {
    var on = (rank || 0) >= GROWTH;
    return { em: on, pin: on, zdte: false, trail: false };
}
function normalizeLayerPrefs(raw, rank) {
    if (!raw || typeof raw !== 'object') return defaultLayers(rank);
    var out = {};
    LAYER_KEYS.forEach(function (k) { out[k] = raw[k] === true; });
    return out;
}
function nearestExpiry(expiries, today, afterClose) {
    var list = (expiries || []).slice().sort();
    for (var i = 0; i < list.length; i++) {
        if (list[i] > today || (list[i] === today && !afterClose)) return list[i];
    }
    return null;
}
function layerRank(key, ctx) {
    var l = layerMeta(key);
    var learned = ctx && ctx.lockedRank && ctx.lockedRank[key];
    return Math.max(l ? l.rank : GROWTH, learned || 0);
}

function layerAccess(key, rank, ctx) {
    ctx = ctx || {};
    if (!layerMeta(key)) return 'Not available';
    if ((rank || 0) < layerRank(key, ctx)) return 'locked';
    if (key === 'zdte') {
        if (ctx.scope !== 'all') return 'All expiries only';
        if (ctx.view === 'flow') return 'Not in Flow view';
        if (ctx.view !== 'net') return 'Net GEX view only';
        if (ctx.afterClose) return '0DTE expired at 16:00 ET';
        if (ctx.hasToday === false) return 'No 0DTE expiry today';
    }
    return 'ok';
}

function pickExpectedMove(raw, expiry, today, afterClose) {
    var rows = ((raw && raw.expected_moves) || []).map(function (r) {
        return {
            expiry: r && r.expiry ? String(r.expiry) : null,
            days: num(r && r.daysToExpiry),
            atmIv: num(r && r.atmIv),
            move: num(r && r.expectedMove),
            pct: num(r && r.expectedMovePct),
            lo: num(r && r.lowerBound),
            hi: num(r && r.upperBound)
        };
    }).filter(function (r) { return r.expiry; }).sort(function (a, b) { return a.expiry < b.expiry ? -1 : a.expiry > b.expiry ? 1 : 0; });
    var usable = function (r) { return r.move !== null && r.move > 0 && r.atmIv !== null && r.lo !== null && r.hi !== null; };
    if (expiry && expiry !== 'all') {
        var row = rows.filter(function (r) { return r.expiry === expiry; })[0];
        return { em: row && usable(row) ? row : null, expiry: expiry };
    }
    for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (today && (r.expiry < today || (r.expiry === today && afterClose))) continue;
        if (usable(r)) return { em: r, expiry: r.expiry };
    }
    return { em: null, expiry: null };
}
function fmtEmRange(em, cur) {
    if (!em || em.move === null) return '–';
    return '±' + fmtPrice(em.move, cur) + (em.pct !== null ? ' (' + grouped(em.pct, 2, 2) + '%)' : '');
}
function normalizePinRisk(raw) {
    if (!raw) return null;
    var b = raw.breakdown || {};
    var score = num(raw.live_pin_risk);
    if (score === null) return null;
    return {
        score: score,
        magnet: num(raw.magnet_strike),
        expiry: raw.expiry || null,
        hours: num(raw.time_to_close_hours),
        asOf: raw.as_of || null,
        breakdown: { oi: num(b.oi_score), proximity: num(b.proximity_score), time: num(b.time_score), gamma: num(b.gamma_score) }
    };
}

function pinBreakdownText(pin) {
    if (!pin) return '';
    var b = pin.breakdown, f = function (v) { return v === null ? '–' : String(v); };
    return 'OI ' + f(b.oi) + ' · Proximity ' + f(b.proximity) + ' · Time ' + f(b.time) + ' · Gamma ' + f(b.gamma);
}
function normalizeZdte(raw, expiry) {
    if (!raw) return null;
    var byStrike = {};
    var points = [];
    normalizeStrikes(raw.strikes).forEach(function (s) {
        byStrike[s.strike] = s.netGex;
        if (s.netGex !== null) points.push([s.strike, s.netGex]);
    });
    return { expiry: expiry || null, netGex: num(raw.net_gex), byStrike: byStrike, points: points };
}
function trailPoint(summary, lastT) {
    if (!summary) return null;
    var exp = summary.exposure || {}, price = summary.price || {};
    var t = Date.parse(summary.as_of);
    var spot = num(price.mid !== undefined && price.mid !== null ? price.mid : price.last);
    if (!isFinite(t) || spot === null) return null;
    if (lastT !== undefined && lastT !== null && !(t > lastT)) return null;
    return [t, spot, num(exp.gamma_flip), exp.gamma_flip_status || null];
}
var TRAIL_MAX = 500;
function trailAdd(store, symbol, point, day, max) {
    var cap = max || TRAIL_MAX;
    var base = store && store.day === day && store.symbols ? store.symbols : {};
    var out = { day: day, symbols: {} };
    Object.keys(base).forEach(function (k) { out.symbols[k] = base[k]; });
    var sym = String(symbol || '').toUpperCase();
    var list = (out.symbols[sym] || []).slice();
    if (point && isFinite(point[0]) && todayET(point[0]) === day && !list.some(function (p) { return p[0] === point[0]; })) {
        list.push(point);
        list.sort(function (a, b) { return a[0] - b[0]; });
        if (list.length > cap) list = list.slice(list.length - cap);
    }
    out.symbols[sym] = list;
    return out;
}

var LIVE_SUMMARY_MS = 5 * 60000;
var EM_LIVE_MS = 30 * 60000;
var api = {
    MINUS: MINUS,
    RANGES: RANGES,
    ZDTE_RANGES: ZDTE_RANGES,
    VIEWS: VIEWS,
    MERGE_PCT: MERGE_PCT,
    PLAN_SLUG: PLAN_SLUG,
    PLAN_NAME: PLAN_NAME,
    num: num,
    fmtGex: fmtGex,
    fmtCount: fmtCount,
    fmtStrike: fmtStrike,
    fmtPrice: fmtPrice,
    fmtPct: fmtPct,
    fmtDiff: fmtDiff,
    fmtNotional: fmtNotional,
    todayET: todayET,
    isStale: isStale,
    optionsFeedAsOf: optionsFeedAsOf,
    fmtAxisStrike: fmtAxisStrike,
    asOfPrefix: asOfPrefix,
    belowQuotaReserve: belowQuotaReserve,
    isFutures: isFutures,
    symbolAccess: symbolAccess,
    expiryLocked: expiryLocked,
    defaultExpiry: defaultExpiry,
    rankFromPlanName: rankFromPlanName,
    expiriesFromOptions: expiriesFromOptions,
    normalizeStrikes: normalizeStrikes,
    regimeNoteFor: regimeNoteFor,
    regimeKey: regimeKey,
    regimeLabel: regimeLabel,
    flipNote: flipNote,
    buildModel: buildModel,
    modelFromZeroDte: modelFromZeroDte,
    rangeWindow: rangeWindow,
    inWindow: inWindow,
    minGap: minGap,
    fitWindow: fitWindow,
    viewValues: viewValues,
    hasAny: hasAny,
    quotePrice: quotePrice,
    currentPrice: currentPrice,
    topStrikes: topStrikes,
    regimeZones: regimeZones,
    zoneLabel: zoneLabel,
    zoneLabelFits: zoneLabelFits,
    stackLabels: stackLabels,
    levelList: levelList,
    mergeLevels: mergeLevels,
    conclusion: conclusion,
    hedgeSentence: hedgeSentence,
    noFlipReason: noFlipReason,
    normalizeFlow: normalizeFlow,
    attachFlow: attachFlow,
    flowSentence: flowSentence,
    netKey: netKey,
    etClock: etClock,
    afterCloseET: afterCloseET,
    sessionBoundsET: sessionBoundsET,
    LAYERS: LAYERS,
    LAYER_KEYS: LAYER_KEYS,
    layerMeta: layerMeta,
    defaultLayers: defaultLayers,
    normalizeLayerPrefs: normalizeLayerPrefs,
    nearestExpiry: nearestExpiry,
    layerRank: layerRank,
    layerAccess: layerAccess,
    pickExpectedMove: pickExpectedMove,
    fmtEmRange: fmtEmRange,
    normalizePinRisk: normalizePinRisk,
    pinBreakdownText: pinBreakdownText,
    normalizeZdte: normalizeZdte,
    trailPoint: trailPoint,
    trailAdd: trailAdd,
    TRAIL_MAX: TRAIL_MAX,
    LIVE_SUMMARY_MS: LIVE_SUMMARY_MS,
    EM_LIVE_MS: EM_LIVE_MS
};

export default api;
