process.env.TZ = 'Asia/Bangkok';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import M from '../src/model.js';

const fixture = (name) => JSON.parse(readFileSync(new URL('./fixtures/' + name, import.meta.url), 'utf8'));
const MINUS = '−';
function strike(k, call, put, extra) {
    return Object.assign({ strike: k, call_gex: call, put_gex: put, net_gex: call + put, call_oi: 100, put_oi: 100 }, extra || {});
}
function summary(exp, extra) {
    return Object.assign({
        symbol: 'NVDA',
        as_of: '2026-10-05T18:30:00Z',
        market_open: true,
        price: { mid: 187.30, last: 187.30 },
        exposure: Object.assign({
            net_gex: 1.25e9, regime: 'positive_gamma', gamma_flip: 182.50, gamma_flip_status: 'available',
            call_wall: 195, put_wall: 175, max_pain: 180,
            hedging_estimate: {
                spot_up_1pct: { dealer_shares: 6400000, direction: 'sell', notional_usd: 1.2e9 },
                spot_down_1pct: { dealer_shares: 6400000, direction: 'buy', notional_usd: 1.2e9 }
            }
        }, exp || {})
    }, extra || {});
}
const GEX = { underlying_price: 187.31, as_of: '2026-10-05T18:30:05Z', gamma_flip: 184, net_gex: 3e8, strikes: [strike(180, 1e8, -2e8), strike(190, 3e8, -5e7)] };
describe('normalizeStrikes', () => {
    it('values are the API\'s as sent: net GEX is the row\'s net_gex, the put keeps its sign', () => {
        const out = M.normalizeStrikes([
            strike(100, 10, -8, { net_gex: 2.5 }),
            strike(95, 5, 8),
            strike(90, 0, 0)
        ]);
        assert.deepEqual(out.map(s => s.strike), [90, 95, 100], 'sorted by strike');
        assert.equal(out[2].netGex, 2.5);
        assert.equal(out[1].putGex, 8, 'no -|put|');
    });
    it('no net_gex on the row: null, never call + put', () => {
        const out = M.normalizeStrikes([{ strike: 100, call_gex: 10, put_gex: -8 }]);
        assert.equal(out[0].netGex, null);
    });
    it('drops rows without a numeric strike and keeps null OI change as null', () => {
        const out = M.normalizeStrikes([{ strike: null }, strike(10, 1, 1, { call_oi_change: 5 })]);
        assert.equal(out.length, 1);
        assert.equal(out[0].dCallOi, 5);
        assert.equal(out[0].dPutOi, null);
    });
});
describe('range window and "Showing X of Y"', () => {
    const strikes = M.normalizeStrikes(Array.from({ length: 101 }, (_, i) => strike(50 + i, 1, 1)));
    for (const [range, lo, hi, shown] of [[0.05, 95, 105, 11], [0.10, 90, 110, 21], [0.20, 80, 120, 41]]) {
        it(`±${range * 100}% around spot`, () => {
            const w = M.rangeWindow(strikes, 100, range);
            assert.ok(Math.abs(w.lo - lo) < 1e-9 && Math.abs(w.hi - hi) < 1e-9, JSON.stringify(w));
            const fit = M.fitWindow(strikes, 100, w.lo, w.hi, 1000);
            assert.equal(fit.shown, shown);
            assert.equal(fit.total, 101);
            assert.equal(fit.narrowed, false);
        });
    }
    it("'all' spans every strike", () => {
        assert.deepEqual(M.rangeWindow(strikes, 100, 'all'), { lo: 50, hi: 150 });
    });
    it('narrows around spot when the bars would be thinner than the minimum width', () => {
        const fit = M.fitWindow(strikes, 100, 50, 150, 40);
        assert.equal(fit.narrowed, true);
        assert.equal(fit.lo, 80);
        assert.equal(fit.hi, 120);
        assert.equal(fit.shown, 41);
        assert.equal(fit.total, 101);
    });
    it('a narrowed window stays inside the requested range', () => {
        const fit = M.fitWindow(strikes, 148, 50, 150, 20);
        assert.equal(fit.hi, 150);
        assert.equal(fit.lo, 130);
    });
});
describe('VIEWS', () => {
    it('has no OI change view (lab sends null OI change on every strike, removed 2026-10-13)', () => {
        assert.deepEqual(M.VIEWS, ['net', 'callput', 'oi', 'flow']);
    });
});
describe('lightweight chart: missing fields stay missing', () => {
    it('hasAny: true when one value is a number (0 included), false when all are null / absent', () => {
        assert.equal(M.hasAny(null, undefined), false);
        assert.equal(M.hasAny(), false);
        assert.equal(M.hasAny(null, 0), true, 'a 0 the API sent is data');
        assert.equal(M.hasAny(12, null), true);
        assert.equal(M.hasAny('', 'x'), false, 'empty / non-numeric strings are not values');
    });

    it('keepNulls: call / put GEX, OI and volume the API did not send stay null', () => {
        const raw = [{ strike: 100, net_gex: 5, call_gex: 7 }];
        const kept = M.normalizeStrikes(raw, true)[0];
        assert.equal(kept.callGex, 7);
        for (const k of ['putGex', 'callOi', 'putOi', 'callVol', 'putVol', 'dCallOi', 'dPutOi']) assert.equal(kept[k], null, k);
        assert.equal(M.hasAny(kept.callVol, kept.putVol), false, 'the Vol row is hidden');
        assert.equal(M.hasAny(kept.callGex, kept.putGex), true, 'one side sent: the row stays, the other reads "–"');
    });

    it('without keepNulls (full chart) the old 0s are unchanged', () => {
        const s = M.normalizeStrikes([{ strike: 100, net_gex: 5 }])[0];
        assert.deepEqual([s.callGex, s.putGex, s.callOi, s.putOi, s.callVol, s.putVol], [0, 0, 0, 0, 0, 0]);
    });
    it('quotePrice: the quote\'s mid (lastPrice when mid is missing), with lastUpdate', () => {
        assert.deepEqual(M.quotePrice({ mid: 773.1, lastPrice: 773.1, lastUpdate: '2026-10-09T14:32:00Z' }), { price: 773.1, at: '2026-10-09T14:32:00Z' });
        assert.deepEqual(M.quotePrice({ lastPrice: 772 }), { price: 772, at: null });
        assert.equal(M.quotePrice({ ticker: 'SPY' }), null);
        assert.equal(M.quotePrice(null), null);
    });
    it('currentPrice: not live = the summary\'s last price, live = mid; the newer of summary and quote wins', () => {
        const summary = { as_of: '2026-10-09T14:00:00Z', price: { mid: 772.85, last: 772.8, last_update: '2026-10-09T14:00:00Z' } };
        assert.deepEqual(M.currentPrice(summary, null, false), { price: 772.8, at: '2026-10-09T14:00:00Z', source: 'summary', live: false });
        assert.equal(M.currentPrice(summary, null, true).price, 772.85);
        const newer = { price: 773.1, at: '2026-10-09T14:32:00Z' }, older = { price: 770, at: '2026-10-09T13:00:00Z' };
        assert.deepEqual(M.currentPrice(summary, newer, true), { price: 773.1, at: newer.at, source: 'quote', live: true });
        assert.equal(M.currentPrice(summary, older, true).source, 'summary', 'an older quote does not replace a newer summary');
        assert.equal(M.currentPrice(summary, newer, false).price, 773.1, 'after the close the session\'s last quote is newer than an earlier summary');
        assert.equal(M.currentPrice(null, newer, true).price, 773.1);
        assert.equal(M.currentPrice(null, null, true), null);
        assert.equal(M.currentPrice({ price: { mid: null, last: null } }, null, false), null, 'no price sent: nothing shown');
    });
    it('buildModel passes keepNulls through', () => {
        const m = M.buildModel({ symbol: 'SPY', summary: null, gex: { strikes: [{ strike: 100, net_gex: 5 }] }, expiry: 'all', keepNulls: true });
        assert.equal(m.strikes[0].callOi, null);
        assert.equal(M.buildModel({ symbol: 'SPY', summary: null, gex: { strikes: [{ strike: 100, net_gex: 5 }] }, expiry: 'all' }).strikes[0].callOi, 0);
    });
});
describe('mergeLevels', () => {
    const levels = [
        { key: 'spot', label: 'Spot', price: 100, order: 1 },
        { key: 'flip', label: 'Flip', price: 100.4, order: 2 },
        { key: 'callWall', label: 'Call Wall', price: 105, order: 0 }
    ];
    it('levels closer than 0.5% of spot share one label', () => {
        const g = M.mergeLevels(levels, 100);
        assert.equal(g.length, 2);
        assert.equal(g[0].label, 'Spot · Flip');
        assert.deepEqual(g[0].keys, ['spot', 'flip']);
        assert.equal(g[1].label, 'Call Wall');
    });
    it('levels 0.5% apart or more stay separate', () => {
        const g = M.mergeLevels([{ key: 'spot', label: 'Spot', price: 100, order: 1 }, { key: 'flip', label: 'Flip', price: 100.6, order: 2 }], 100);
        assert.equal(g.length, 2);
    });
});
describe('conclusion', () => {
    it('positive gamma from the API regime: flip, walls and hedge, no distance to spot', () => {
        const m = M.buildModel({ symbol: 'NVDA', summary: summary(), gex: GEX, expiry: 'all' });
        assert.equal(M.conclusion(m),
            'Gamma flip $182.50: positive gamma, dealer hedging tends to dampen moves. ' +
            'Call wall $195, put wall $175. A 1% rise would have dealers sell about $1.2B of NVDA.');
    });
    it('negative gamma from the API regime', () => {
        const m = M.buildModel({
            symbol: 'NVDA',
            summary: summary({ regime: 'negative_gamma', gamma_flip: 190, hedging_estimate: { spot_up_1pct: { direction: 'buy', notional_usd: 4.8e8 } } }),
            gex: GEX, expiry: 'all'
        });
        const c = M.conclusion(m);
        assert.match(c, /^Gamma flip \$190\.00: negative gamma, dealer hedging tends to amplify moves\./);
        assert.match(c, /A 1% rise would have dealers buy about \$480M of NVDA\.$/);
    });
    it('the API interpretation.gamma sentence leads when the summary has it', () => {
        const gamma = 'Gamma regime undetermined — gamma flip shown but unverified (sensitive_root); treat the level as indicative';
        const m = M.buildModel({ symbol: 'NVDA', summary: summary({ gamma_flip_status: 'sensitive_root', regime: 'unknown', interpretation: { gamma } }), gex: GEX, expiry: 'all' });
        assert.equal(m.interpretation, gamma);
        assert.ok(M.conclusion(m).startsWith('Gamma regime undetermined - gamma flip shown but unverified; treat the level as indicative. Call wall $195, put wall $175.'));
    });
    it('no percentage or dollar distance anywhere', () => {
        const m = M.buildModel({ symbol: 'NVDA', summary: summary(), gex: GEX, expiry: 'all' });
        assert.doesNotMatch(M.conclusion(m), /\d%\)|above|below/);
        assert.ok(M.levelList(m, m.spot).every(l => l.dist === undefined));
    });
    it('flip null (no_boundary): the 8% reason, regime undetermined, no hedging tendency', () => {
        const m = M.buildModel({ symbol: 'NVDA', summary: summary({ gamma_flip: null, gamma_flip_status: 'no_boundary', regime: 'unknown' }), gex: GEX, expiry: 'all' });
        const c = M.conclusion(m);
        assert.match(c, /^No gamma flip within 8% of spot, so the regime is undetermined\. Net GEX is \+1\.25B\./);
        assert.doesNotMatch(c, /tends to/);
    });
    it('flip withheld (stored_sign_mismatch or no status): "not published", never the 8% reason', () => {
        for (const status of ['stored_sign_mismatch', undefined]) {
            const m = M.buildModel({ symbol: 'SPY', summary: summary({ gamma_flip: null, gamma_flip_status: status, regime: 'unknown' }), gex: GEX, expiry: 'all' });
            assert.equal(m.headerFlipStatus, status || null);
            assert.match(M.conclusion(m), /^Gamma flip not published, so the regime is undetermined\. Net GEX is \+1\.25B\./);
        }
        assert.equal(M.noFlipReason('no_boundary'), 'No gamma flip within 8% of spot');
        assert.equal(M.noFlipReason('stored_sign_mismatch'), 'Gamma flip not published');
    });
    it('one expiry: its flip and net GEX, the whole chain\'s walls; no regime, no hedge', () => {
        const m = M.buildModel({ symbol: 'NVDA', summary: summary(), gex: GEX, expiry: '2026-10-09' });
        assert.equal(m.hedge, null);
        assert.equal(M.conclusion(m), 'Gamma flip $184.00. Net GEX is +300M. All expiries: call wall $195, put wall $175.');
        const unverified = M.buildModel({ symbol: 'NVDA', summary: summary(), gex: Object.assign({}, GEX, { gamma_flip_status: 'sensitive_root' }), expiry: '2026-10-09' });
        assert.match(M.conclusion(unverified), /^Gamma flip \$184\.00 \(unverified\)\./);
        assert.doesNotMatch(M.conclusion(unverified), /gamma,|tends to|regime/);
    });

    it('unverified flip', () => {
        const m = M.buildModel({ symbol: 'NVDA', summary: summary({ gamma_flip_status: 'sensitive_root', regime: 'unknown' }), gex: GEX, expiry: 'all' });
        assert.equal(m.regimeNote, 'unverified');
        assert.match(M.conclusion(m), /^Gamma flip \$182\.50 is unverified, so the regime is undetermined\./);
    });
    it('spot at the flip', () => {
        const m = M.buildModel({ symbol: 'NVDA', summary: summary({ regime: 'unknown' }), gex: GEX, expiry: 'all' });
        assert.equal(m.regimeNote, 'at_flip');
        assert.match(M.conclusion(m), /^Spot is at the gamma flip \(\$182\.50\): the regime is undetermined\./);
    });
    it('no hedging_estimate: the last clause is dropped', () => {
        const m = M.buildModel({ symbol: 'NVDA', summary: summary({ hedging_estimate: null }), gex: GEX, expiry: 'all' });
        const c = M.conclusion(m);
        assert.doesNotMatch(c, /1% rise/);
        assert.match(c, /put wall \$175\.$/);
    });
    it('never uses forecast wording', () => {
        const m = M.buildModel({ symbol: 'NVDA', summary: summary(), gex: GEX, expiry: 'all' });
        assert.doesNotMatch(M.conclusion(m), /\b(will|must|acts as)\b/);
    });
});
describe('buildModel scope', () => {
    it('one expiry: flip and net GEX from the gex response; no walls, max pain or regime (the API sends none); header stays whole-chain', () => {
        const m = M.buildModel({ symbol: 'NVDA', summary: summary(), gex: GEX, expiry: '2026-10-09' });
        assert.equal(m.scope, 'single');
        assert.equal(m.flip, 184);
        assert.equal(m.scopeNetGex, 3e8);
        assert.equal(m.callWall, null);
        assert.equal(m.putWall, null);
        assert.equal(m.maxPain, null);
        assert.equal(m.regime, 'unknown', 'never read from spot vs the flip');
        assert.equal(m.netGex, 1.25e9, 'header net GEX is the summary (all expiries)');
        assert.equal(m.headerRegime, 'positive');
        assert.equal(m.chain.callWall, 195);
        assert.equal(m.chain.maxPain, 180);
    });
    it('whole chain: levels from the summary', () => {
        const m = M.buildModel({ symbol: 'NVDA', summary: summary(), gex: GEX, expiry: 'all' });
        assert.equal(m.scope, 'all');
        assert.equal(m.flip, 182.5);
        assert.equal(m.callWall, 195);
        assert.equal(m.maxPain, 180);
        assert.equal(m.spot, 187.30);
    });
});
describe('regime zones and their labels', () => {
    const chain = (exp) => M.buildModel({ symbol: 'NVDA', summary: summary(exp), gex: GEX, expiry: 'all' });
    it('whole chain, API regime and verified flip: negative left of the flip, positive right, clipped to the window', () => {
        assert.deepEqual(M.regimeZones(chain(), 170, 200), [
            { side: 'neg', lo: 170, hi: 182.5 },
            { side: 'pos', lo: 182.5, hi: 200 }
        ]);
        assert.deepEqual(M.regimeZones(chain({ regime: 'negative_gamma' }), 170, 200).map(z => z.side), ['neg', 'pos']);
    });
    it('flip outside the window: one zone only', () => {
        assert.deepEqual(M.regimeZones(chain(), 185, 200), [{ side: 'pos', lo: 185, hi: 200 }]);
        assert.deepEqual(M.regimeZones(chain(), 160, 180), [{ side: 'neg', lo: 160, hi: 180 }]);
    });
    it('no zones (so no labels) when the chart is not shaded', () => {
        assert.deepEqual(M.regimeZones(chain({ regime: 'unknown' }), 170, 200), [], 'regime unknown');
        assert.deepEqual(M.regimeZones(chain({ gamma_flip_status: 'sensitive_root' }), 170, 200), [], 'flip unverified');
        assert.deepEqual(M.regimeZones(chain({ gamma_flip: null, gamma_flip_status: 'no_boundary' }), 170, 200), [], 'no flip');
        const one = M.buildModel({ symbol: 'NVDA', summary: summary(), gex: GEX, expiry: '2026-10-09' });
        assert.deepEqual(M.regimeZones(one, 170, 200), [], 'one expiry: the API has no regime for it');
        assert.deepEqual(M.regimeZones(chain(), 200, 170), [], 'empty window');
        assert.deepEqual(M.regimeZones(null, 170, 200), []);
    });
    it('wording: "tends to", never "will"; short form on mobile', () => {
        assert.equal(M.zoneLabel('pos'), 'Positive gamma · moves tend to dampen');
        assert.equal(M.zoneLabel('neg'), 'Negative gamma · moves tend to amplify');
        assert.equal(M.zoneLabel('pos', true), '+γ · dampen');
        assert.equal(M.zoneLabel('neg', true), MINUS + 'γ · amplify');
        ['pos', 'neg'].forEach(s => assert.doesNotMatch(M.zoneLabel(s), /\bwill\b/));
        assert.equal(M.zoneLabel('x'), '');
    });

    it('label hidden when the zone is narrower than the label at the current zoom', () => {
        const z = { side: 'pos', lo: 190, hi: 200 };
        assert.equal(M.zoneLabelFits(z, 100, 200, 1000, 100), true, '100 px zone, 100 px label');
        assert.equal(M.zoneLabelFits(z, 100, 200, 1000, 101), false);
        assert.equal(M.zoneLabelFits(z, 100, 200, 0, 10), false, 'no plot width yet');
        assert.equal(M.zoneLabelFits(null, 100, 200, 1000, 10), false);
    });
});

describe('stackLabels (vertical chart label gutter)', () => {
    function assertNoOverlap(items, ys, gap) {
        for (let i = 1; i < ys.length; i++) {
            assert.ok(ys[i] - ys[i - 1] >= (items[i].h + items[i - 1].h) / 2 + gap - 1e-9, `label ${i} overlaps label ${i - 1}`);
        }
    }
    it('labels far apart stay where they are', () => {
        const items = [{ y: 50, h: 16 }, { y: 120, h: 16 }, { y: 300, h: 16 }];
        assert.deepEqual(M.stackLabels(items, 0, 400, 2), [50, 120, 300]);
    });
    it('a label overlapping the one above it is pushed down', () => {
        const items = [{ y: 100, h: 16 }, { y: 105, h: 16 }, { y: 108, h: 16 }];
        const ys = M.stackLabels(items, 0, 400, 2);
        assert.deepEqual(ys, [100, 118, 136]);
        assertNoOverlap(items, ys, 2);
    });
    it('labels past the bottom are pushed back up from it', () => {
        const items = [{ y: 380, h: 16 }, { y: 390, h: 16 }, { y: 398, h: 16 }];
        const ys = M.stackLabels(items, 0, 400, 2);
        assert.deepEqual(ys, [356, 374, 392]);
        assertNoOverlap(items, ys, 2);
        assert.ok(ys[2] + 8 <= 400, 'last label inside the bottom');
    });
    it('the first label is kept below the top', () => {
        assert.deepEqual(M.stackLabels([{ y: 2, h: 14 }], 10, 400, 2), [17]);
    });
    it('a single label and an empty list', () => {
        assert.deepEqual(M.stackLabels([{ y: 200, h: 16 }], 0, 400, 2), [200]);
        assert.deepEqual(M.stackLabels([], 0, 400, 2), []);
        assert.deepEqual(M.stackLabels(null, 0, 400, 2), []);
    });
    it('more labels than fit still never overlap (they run past the top)', () => {
        const items = Array.from({ length: 10 }, (_, i) => ({ y: 40 + i, h: 16 }));
        const ys = M.stackLabels(items, 0, 100, 2);
        assertNoOverlap(items, ys, 2);
        assert.equal(ys[9], 92, 'last label sits on the bottom');
    });
});
describe('asOf: option feed time, not response time', () => {
    const feed = (k, v) => ({ data_as_of: { equity_options_feed: null, index_options_feed: null, futures_options_feed: null, [k]: v } });
    it('equity, index and futures read their own options feed; gex before summary', () => {
        const gex = Object.assign({}, GEX, feed('equity_options_feed', '2026-10-06T20:15:00Z'));
        const m = M.buildModel({ symbol: 'NVDA', summary: summary(), gex, expiry: 'all' });
        assert.equal(m.asOf, '2026-10-06T20:15:00Z');
        assert.equal(M.optionsFeedAsOf('SPX', 'stock', [feed('index_options_feed', 'I')]), 'I');
        assert.equal(M.optionsFeedAsOf('ES=F', 'futures', [feed('equity_options_feed', 'E'), feed('futures_options_feed', 'F')]), 'F');
    });
    it('equity and index feeds both filled: the older one', () => {
        const both = { data_as_of: { equity_options_feed: '2026-10-07T14:00:00Z', index_options_feed: '2026-10-07T13:00:00Z' } };
        assert.equal(M.optionsFeedAsOf('SPX', 'stock', [both]), '2026-10-07T13:00:00Z');
    });
    it('falls back to as_of when no response carries the feed slot', () => {
        const m = M.buildModel({ symbol: 'NVDA', summary: summary(), gex: Object.assign({}, GEX, feed('equity_options_feed', null)), expiry: 'all' });
        assert.equal(m.asOf, GEX.as_of);
    });
    it('a last-close feed time during the session reads as stale', () => {
        assert.equal(M.isStale('2026-10-06T20:15:00Z', Date.parse('2026-10-07T14:00:00Z'), true), true);
    });
});
describe('todayET', () => {
    it('is the New York date even when the machine is at UTC+7', () => {
        const t = Date.parse('2026-10-06T00:00:00Z');
        assert.equal(new Date(t).getDate(), 6, 'local (UTC+7) date is the 6th');
        assert.equal(M.todayET(t), '2026-10-05');
    });
});

describe('plan: default expiry and gates', () => {
    const today = '2026-10-05';
    const list = ['2026-10-09', '2026-10-05', '2026-10-16'];
    it('below Growth: the nearest expiry after today, never 0DTE', () => {
        assert.equal(M.defaultExpiry(list, 0, today), '2026-10-09');
        assert.equal(M.defaultExpiry(list, 1, today), '2026-10-09');
        assert.equal(M.defaultExpiry(['2026-10-05'], 0, today), null);
    });
    it('Growth and Alpha: all expiries', () => {
        assert.equal(M.defaultExpiry(list, 2, today), 'all');
        assert.equal(M.defaultExpiry(list, 3, today), 'all');
    });
    it('full chain and 0DTE are locked below Growth', () => {
        assert.equal(M.expiryLocked('all', 0, today), true);
        assert.equal(M.expiryLocked(today, 1, today), true);
        assert.equal(M.expiryLocked('2026-10-09', 0, today), false);
        assert.equal(M.expiryLocked('all', 2, today), false);
        assert.equal(M.expiryLocked(today, 2, today), false);
    });

    it('symbol gates: no hard-coded ETF/index list, a symbol lab refused locks; futures need Growth', () => {
        assert.equal(M.INDEX_SYMBOLS, undefined);
        assert.equal(M.KNOWN_ETF_SYMBOLS, undefined);
        assert.equal(M.symbolAccess('SPY', 'stock', 0).locked, false);
        const denied = { rank: 1, message: 'ETF symbols require the Basic plan' };
        assert.deepEqual(M.symbolAccess('SPY', 'stock', 0, denied),
            { locked: true, requiredRank: 1, reason: 'symbol', message: 'ETF symbols require the Basic plan' });
        assert.equal(M.symbolAccess('SPY', 'stock', 1, denied).locked, false, 'the plan lab asked for opens it');
        assert.equal(M.symbolAccess('NVDA', 'stock', 0).locked, false);
        assert.deepEqual(M.symbolAccess('ES=F', 'futures', 1), { locked: true, requiredRank: 2, reason: 'futures' });
        assert.equal(M.symbolAccess('ES=F', 'futures', 2).locked, false);
    });
});
describe('formatting', () => {
    it('GEX with sign and B/M/K', () => {
        assert.equal(M.fmtGex(1.25e9), '+1.25B');
        assert.equal(M.fmtGex(-4.8e8), MINUS + '480M');
        assert.equal(M.fmtGex(12500), '+12.5K');
        assert.equal(M.fmtGex(0), '0');
    });
    it('strike, price, distance', () => {
        assert.equal(M.fmtStrike(187.5), '$187.5');
        assert.equal(M.fmtStrike(195), '$195');
        assert.equal(M.fmtPrice(187.3), '$187.30');
        assert.equal(M.fmtPct(0.041), '+4.1%');
        assert.equal(M.fmtDiff(7.7), '+$7.70');
    });
});

describe('session flow (Alpha, /v1/flow/gex?polarity=flow)', () => {
    const FLOW = {
        symbol: 'NVDA', as_of: '2026-10-06T13:46:03Z', polarity: 'flow',
        live_net_gex: 1.9e6, live_gamma_flip: 188.4,
        strikes: [
            { strike: 180, call_gex: 0, put_gex: 2e5, net_gex: 2e5, call_dealer_pos: 0, put_dealer_pos: 3 },
            { strike: 190, call_gex: -5e5, put_gex: 0, net_gex: -5e5, call_dealer_pos: -2, put_dealer_pos: 0 },
            { strike: 50, call_gex: 1, put_gex: 0, net_gex: 1 }
        ]
    };
    const model = () => M.buildModel({ symbol: 'NVDA', summary: summary(), gex: GEX, expiry: 'all' });
    it('Flow is a view of its own', () => {
        assert.ok(M.VIEWS.includes('flow'));
    });
    it('keeps the put sign the dealer position gives (no -|put| as for the structural view)', () => {
        const m = M.attachFlow(model(), FLOW);
        const k180 = m.strikes.find(s => s.strike === 180);
        assert.equal(k180.flowPut, 2e5);
        assert.equal(k180.flowNet, 2e5);
        assert.equal(k180.putPos, 3);
    });
    it('a row without net_gex has no flow net (null), never call + put', () => {
        const m = M.attachFlow(model(), { strikes: [{ strike: 190, call_gex: -5e5, put_gex: 0 }] });
        assert.equal(m.strikes.find(s => s.strike === 190).flowNet, null);
    });
    it('totals, flip, and flow rows for strikes the model does not carry', () => {
        const m = M.attachFlow(model(), FLOW);
        assert.equal(m.flow.netGex, 1.9e6);
        assert.equal(m.flowFlip, 188.4);
        assert.equal(m.flow.matched, 2);
        assert.equal(m.flow.unmatched, 1);
        assert.equal(m.flow.coverage, null, 'flow_coverage is optional');
    });

    it('strikes without a flow row have no flow values (null, shown as "–"), never 0', () => {
        const m = M.attachFlow(model(), { strikes: [] });
        m.strikes.forEach(s => {
            assert.equal(s.flowNet, null);
            assert.equal(s.flowCall, null);
            assert.equal(s.flowPut, null);
            assert.equal(s.callPos, null);
            assert.deepEqual(M.viewValues(s, 'flow'), { net: null });
        });
        assert.equal(M.fmtGex(null), '–');
    });
    it('flow_coverage, when present, is normalised', () => {
        const m = M.attachFlow(model(), Object.assign({}, FLOW, { flow_coverage: { contracts_total: 4586, contracts_with_flow: 1842, flow_source_ok: true } }));
        assert.deepEqual(m.flow.coverage, { total: 4586, withFlow: 1842, sourceOk: true });
    });
    it('view values and top strikes read the flow field in the Flow view', () => {
        const m = M.attachFlow(model(), FLOW);
        assert.deepEqual(M.viewValues(m.strikes[0], 'flow'), { net: 2e5 });
        assert.deepEqual(M.topStrikes(m.strikes, 'flow', 1), [190]);
    });
    it('the flow flip is a level only when asked for', () => {
        const m = M.attachFlow(model(), FLOW);
        assert.ok(!M.levelList(m, m.spot).some(l => l.key === 'flowFlip'));
        const ff = M.levelList(m, m.spot, { flowFlip: true }).find(l => l.key === 'flowFlip');
        assert.equal(ff.price, 188.4);
        assert.equal(ff.label, 'Flow flip');
    });
    describe('flowSentence', () => {
        it('the API live_net_gex only, no comparison with the structural map', () => {
            const m = M.attachFlow(model(), FLOW);
            assert.equal(M.flowSentence(m), 'Session flow GEX since 09:30 ET: +1.9M per 1% move.');
            const neg = M.attachFlow(model(), Object.assign({}, FLOW, { live_net_gex: -3.46e6 }));
            assert.equal(M.flowSentence(neg), 'Session flow GEX since 09:30 ET: ' + MINUS + '3.46M per 1% move.');
            assert.doesNotMatch(M.flowSentence(neg), /structural|reinforcing|against|longer|shorter/);
        });

        it('no classified flow yet', () => {
            const m = M.attachFlow(model(), Object.assign({}, FLOW, { live_net_gex: 0 }));
            assert.equal(M.flowSentence(m), 'No classified session flow since 09:30 ET yet.');
        });
        it('a zero with flow_source_ok false means unavailable, not flat', () => {
            const m = M.attachFlow(model(), Object.assign({}, FLOW, { live_net_gex: 0, flow_coverage: { contracts_total: 10, contracts_with_flow: 0, flow_source_ok: false } }));
            assert.equal(M.flowSentence(m), 'Session flow is unavailable right now.');
        });
        it('nothing without flow on the model', () => {
            assert.equal(M.flowSentence(model()), '');
        });
    });
});
describe('layers: plan gate and context (layerAccess)', () => {
    const CTX = { scope: 'all', view: 'net', hasToday: true, afterClose: false };
    it('each layer locks below its plan: em / trail Basic, pin / zdte Growth', () => {
        assert.deepEqual(M.LAYERS.map(l => [l.key, l.rank]), [['em', 1], ['pin', 2], ['zdte', 2], ['trail', 1]]);
        assert.equal(M.layerAccess('em', 0, CTX), 'locked');
        assert.equal(M.layerAccess('trail', 0, CTX), 'locked');
        assert.equal(M.layerAccess('em', 1, CTX), 'ok');
        assert.equal(M.layerAccess('trail', 1, CTX), 'ok');
        assert.equal(M.layerAccess('pin', 1, CTX), 'locked');
        assert.equal(M.layerAccess('zdte', 1, CTX), 'locked');
        assert.equal(M.layerAccess('pin', 2, CTX), 'ok');
        assert.equal(M.layerAccess('zdte', 3, CTX), 'ok');
        assert.equal(M.layerAccess('em', null, CTX), 'locked', 'signed out');
    });
    it('a 403 locks the layer at lab\'s required_plan', () => {
        const ctx = Object.assign({}, CTX, { lockedRank: { pin: 3 } });
        assert.equal(M.layerRank('pin', ctx), 3);
        assert.equal(M.layerAccess('pin', 2, ctx), 'locked');
        assert.equal(M.layerAccess('pin', 3, ctx), 'ok');
        assert.equal(M.layerRank('em', ctx), 1);
    });
    it('0DTE: whole chain, Net GEX view, an expiry today, before 16:00 ET', () => {
        assert.equal(M.layerAccess('zdte', 2, Object.assign({}, CTX, { scope: 'single' })), 'All expiries only');
        assert.equal(M.layerAccess('zdte', 2, Object.assign({}, CTX, { view: 'flow' })), 'Not in Flow view');
        assert.equal(M.layerAccess('zdte', 2, Object.assign({}, CTX, { view: 'oi' })), 'Net GEX view only');
        assert.equal(M.layerAccess('zdte', 2, Object.assign({}, CTX, { afterClose: true })), '0DTE expired at 16:00 ET');
        assert.equal(M.layerAccess('zdte', 2, Object.assign({}, CTX, { hasToday: false })), 'No 0DTE expiry today');
        assert.equal(M.layerAccess('zdte', 2, Object.assign({}, CTX, { hasToday: null })), 'ok', 'expiry list not loaded yet: ask');
    });

    it('the other layers work in any scope and view', () => {
        ['em', 'pin', 'trail'].forEach(k => {
            assert.equal(M.layerAccess(k, 3, { scope: 'single', view: 'flow', hasToday: false, afterClose: true }), 'ok', k);
        });
    });
    it('nothing saved yet: Expected move + Pin risk on for Growth+, every layer off below', () => {
        const off = { em: false, pin: false, zdte: false, trail: false };
        assert.deepEqual(M.normalizeLayerPrefs(undefined, null), off);
        assert.deepEqual(M.normalizeLayerPrefs(undefined, 0), off);
        assert.deepEqual(M.normalizeLayerPrefs(undefined, 1), off, 'Basic: no extra quota until chosen');
        assert.deepEqual(M.normalizeLayerPrefs(undefined, 2), { em: true, pin: true, zdte: false, trail: false });
        assert.deepEqual(M.normalizeLayerPrefs(null, 3), M.defaultLayers(3));
    });

    it('saved prefs win over the defaults: only true is on', () => {
        assert.deepEqual(M.normalizeLayerPrefs({ em: true, pin: 'yes', bogus: true }, 1), { em: true, pin: false, zdte: false, trail: false });
        assert.deepEqual(M.normalizeLayerPrefs({}, 3), { em: false, pin: false, zdte: false, trail: false }, 'all switched off by hand stays off');
    });
});
describe('nearestExpiry (whole-chain Pin risk)', () => {
    const LIST = ['2026-10-12', '2026-10-07', '2026-10-08', '2026-10-09'];
    it('today while it trades, else the next one; past days never', () => {
        assert.equal(M.nearestExpiry(LIST, '2026-10-08', false), '2026-10-08');
        assert.equal(M.nearestExpiry(LIST, '2026-10-08', true), '2026-10-09', 'after 16:00 ET');
        assert.equal(M.nearestExpiry(LIST, '2026-10-10', false), '2026-10-12', 'weekend');
        assert.equal(M.nearestExpiry(LIST, '2026-10-13', false), null);
        assert.equal(M.nearestExpiry(null, '2026-10-08', false), null);
    });
});
describe('ET clock', () => {
    it('after 16:00 ET, whatever the machine zone', () => {
        assert.equal(M.afterCloseET(Date.parse('2026-10-08T19:59:00Z')), false, '15:59 EDT');
        assert.equal(M.afterCloseET(Date.parse('2026-10-08T20:00:00Z')), true, '16:00 EDT');
        assert.equal(M.afterCloseET(Date.parse('2026-12-08T20:30:00Z')), false, '15:30 EST');
    });
    it('session bounds 09:30-16:00 ET, daylight saving or not', () => {
        assert.deepEqual(M.sessionBoundsET('2026-10-08'), { open: Date.parse('2026-10-08T13:30:00Z'), close: Date.parse('2026-10-08T20:00:00Z') });
        assert.deepEqual(M.sessionBoundsET('2026-12-08'), { open: Date.parse('2026-12-08T14:30:00Z'), close: Date.parse('2026-12-08T21:00:00Z') });
    });
});
describe('expected move layer (pickExpectedMove)', () => {
    const row = (expiry, move, extra) => Object.assign({ expiry, daysToExpiry: 1, atmIv: 0.16, expectedMove: move, expectedMovePct: move / 7.77, lowerBound: 777 - move, upperBound: 777 + move }, extra || {});
    const EM = { symbol: 'SPY', expected_moves: [row('2026-10-09', 5.96), row('2026-10-08', 2.5), row('2026-10-07', 9), row('2026-10-12', 0)] };
    it('one expiry: the row of that expiry, the API figures as sent', () => {
        const r = M.pickExpectedMove(EM, '2026-10-09', '2026-10-08', false);
        assert.equal(r.expiry, '2026-10-09');
        assert.deepEqual([r.em.lo, r.em.hi, r.em.move, r.em.atmIv], [771.04, 782.96, 5.96, 0.16]);
    });
    it('expectedMove 0 or atmIv null: nothing to draw, the expiry kept for the message', () => {
        assert.deepEqual(M.pickExpectedMove(EM, '2026-10-12', '2026-10-08', false), { em: null, expiry: '2026-10-12' });
        const iv = { expected_moves: [row('2026-10-09', 5.96, { atmIv: null })] };
        assert.equal(M.pickExpectedMove(iv, '2026-10-09', '2026-10-08', false).em, null);
        assert.equal(M.pickExpectedMove(EM, '2026-10-30', '2026-10-08', false).em, null, 'no row for it');
    });
    it('whole chain: nearest expiry with a move, past days skipped, today skipped after 16:00 ET', () => {
        assert.equal(M.pickExpectedMove(EM, 'all', '2026-10-08', false).em.expiry, '2026-10-08');
        assert.equal(M.pickExpectedMove(EM, 'all', '2026-10-08', true).em.expiry, '2026-10-09');
        const zeroFirst = { expected_moves: [row('2026-10-08', 0), row('2026-10-09', 5.96)] };
        assert.equal(M.pickExpectedMove(zeroFirst, 'all', '2026-10-08', false).em.expiry, '2026-10-09');
    });
    it('the API sample with every move 0: nothing', () => {
        const sample = fixture('expected-move.json');
        assert.deepEqual(M.pickExpectedMove(sample, 'all', '2026-06-08', false), { em: null, expiry: null });
    });
    it('"±$5.96 (0.77%)" from expectedMove and expectedMovePct', () => {
        assert.equal(M.fmtEmRange({ move: 5.96, pct: 0.7671 }, '$'), '±$5.96 (0.77%)');
        assert.equal(M.fmtEmRange({ move: 12.5, pct: null }, ''), '±12.50');
        assert.equal(M.fmtEmRange(null), '–');
    });
});
describe('pin risk layer', () => {
    const sample = fixture('flow-pin-risk.json');
    it('numbers as sent; expiry null when the API chose the nearest expiry', () => {
        const pin = M.normalizePinRisk(sample);
        assert.equal(pin.score, 34);
        assert.equal(pin.magnet, 739);
        assert.equal(pin.expiry, null);
        assert.deepEqual(pin.breakdown, { oi: 20, proximity: 30, time: 0, gamma: 100 });
    });
    it('breakdown text keeps each API score, never a sum', () => {
        assert.equal(M.pinBreakdownText(M.normalizePinRisk(sample)), 'OI 20 · Proximity 30 · Time 0 · Gamma 100');
        const partial = M.normalizePinRisk(Object.assign({}, sample, { breakdown: { oi_score: 46 } }));
        assert.equal(M.pinBreakdownText(partial), 'OI 46 · Proximity – · Time – · Gamma –');
    });
    it('no score: no layer', () => {
        assert.equal(M.normalizePinRisk(null), null);
        assert.equal(M.normalizePinRisk({ magnet_strike: 739 }), null);
    });
});
describe('0DTE layer (normalizeZdte)', () => {
    it('each strike\'s API net_gex and the response net, nothing added up', () => {
        const z = M.normalizeZdte({ net_gex: 4.51e6, strikes: [strike(190, 3e6, -1e6), strike(180, 1e6, -2e6), { strike: 185, call_gex: 1, put_gex: 1 }] }, '2026-10-08');
        assert.equal(z.expiry, '2026-10-08');
        assert.equal(z.netGex, 4.51e6);
        assert.deepEqual(z.points, [[180, -1e6], [190, 2e6]], 'sorted; a strike without net_gex is not drawn');
        assert.equal(z.byStrike[185], null, 'tooltip shows "–"');
        assert.equal(M.normalizeZdte(null), null);
    });
});
describe('flip trail', () => {
    const DAY = '2026-10-08';
    const t = (hhmm) => Date.parse(DAY + 'T' + hhmm + ':00-04:00');
    it('the summary\'s as_of, price.mid, gamma_flip and status: the Flip line\'s own figure, not the gex response\'s', () => {
        const s = summary({}, { as_of: '2026-10-08T14:00:00Z' });
        assert.deepEqual(M.trailPoint(s, null), [Date.parse('2026-10-08T14:00:00Z'), 187.30, 182.5, 'available']);
        const none = summary({ gamma_flip: null, gamma_flip_status: 'no_boundary' }, { as_of: '2026-10-08T14:00:00Z' });
        assert.deepEqual(M.trailPoint(none, null), [Date.parse('2026-10-08T14:00:00Z'), 187.30, null, 'no_boundary'], 'flip null kept: a gap');
    });
    it('only when the summary is newer than the last point', () => {
        const s = summary({}, { as_of: '2026-10-08T14:00:00Z' });
        assert.equal(M.trailPoint(s, Date.parse('2026-10-08T14:00:00Z')), null);
        assert.equal(M.trailPoint(s, Date.parse('2026-10-08T14:05:00Z')), null);
        assert.ok(M.trailPoint(s, Date.parse('2026-10-08T13:55:00Z')));
        assert.equal(M.trailPoint(null), null);
    });
    it('stores: same t skipped, sorted by t, other day skipped, new day starts afresh', () => {
        let st = M.trailAdd(null, 'spy', [t('10:00'), 1, 2, 'available'], DAY);
        st = M.trailAdd(st, 'SPY', [t('09:45'), 1, null, 'no_boundary'], DAY);
        st = M.trailAdd(st, 'SPY', [t('10:00'), 9, 9, 'available'], DAY);
        assert.deepEqual(st.symbols.SPY.map(p => p[0]), [t('09:45'), t('10:00')]);
        assert.equal(st.symbols.SPY[1][1], 1, 'the first point at a t stays');
        st = M.trailAdd(st, 'SPY', [Date.parse('2026-10-07T15:00:00Z'), 1, 2, 'available'], DAY);
        assert.equal(st.symbols.SPY.length, 2, 'a point of another day is not stored');
        st = M.trailAdd(st, 'NVDA', [t('10:05'), 3, 4, 'available'], DAY);
        assert.equal(st.symbols.SPY.length, 2, 'other symbols kept');
        const next = M.trailAdd(st, 'SPY', [Date.parse('2026-10-09T14:00:00Z'), 1, 2, 'available'], '2026-10-09');
        assert.deepEqual(Object.keys(next.symbols), ['SPY']);
        assert.equal(next.symbols.SPY.length, 1);
    });
    it('at most 500 points a symbol, the oldest dropped', () => {
        let st = null;
        const start = t('09:30');
        for (let i = 0; i < 505; i++) st = M.trailAdd(st, 'SPY', [start + i * 30000, 1, 2, 'available'], DAY);
        assert.equal(st.symbols.SPY.length, M.TRAIL_MAX);
        assert.equal(st.symbols.SPY[0][0], start + 5 * 30000);
    });
});

describe('modelFromZeroDte (zero-dte mode)', () => {
    const sample = fixture('exposure-zero-dte.json');
    it('the API sample: every field of the mapping, as sent', () => {
        const m = M.modelFromZeroDte(sample);
        assert.equal(m.symbol, 'SPY');
        assert.equal(m.spot, 699.29);
        assert.equal(m.asOf, '2026-04-16T14:02:46.9079251Z');
        assert.equal(m.marketOpen, true);
        assert.equal(m.expiry, '2026-04-16');
        assert.equal(m.scope, 'zdte');
        assert.equal(m.netGex, sample.exposures.net_gex);
        assert.equal(m.scopeNetGex, sample.exposures.net_gex);
        assert.equal(m.regime, 'positive');
        assert.equal(m.headerRegime, 'positive');
        assert.equal(m.flip, sample.regime.gamma_flip);
        assert.equal(m.flipVerified, true, 'a published flip without a status is taken as verified');
        assert.equal(m.flipStatus, null);
        assert.equal(m.callWall, 700);
        assert.equal(m.putWall, 697);
        assert.equal(m.maxPain, 696);
        assert.equal(m.pin.score, 40);
        assert.equal(m.pin.magnet, 697);
        assert.equal(m.magnet, 697);
        assert.equal(m.pin.expiry, '2026-04-16');
        assert.deepEqual(m.pin.breakdown, { oi: null, proximity: null, time: null, gamma: null }, 'the sample has no components');
        assert.equal(m.em.move, 3.8491);
        assert.equal(m.em.pct, 0.5504);
        assert.equal(m.em.lo, 695.4409);
        assert.equal(m.em.hi, 703.1391);
        assert.equal(m.em.atmIv, 0.211138);
        assert.equal(m.emLow, 695.4409);
        assert.equal(m.emHigh, 703.1391);
        assert.equal(M.fmtEmRange(m.em, '$'), '±$3.85 (0.55%)');
        assert.equal(m.chain, null);
        assert.equal(m.hedge, null);
        assert.equal(m.interpretation, null);
        assert.equal(m.flow, null);
        assert.equal(m.zdte, null);
        assert.deepEqual(m.filter, { strikeRange: 0.03, shown: sample.strikes.length, total: sample.strikes.length });
    });
    it('strikes: every row, sorted, values and signs as sent; no OI change in this response', () => {
        const m = M.modelFromZeroDte(sample);
        assert.equal(m.strikes.length, sample.strikes.length);
        const raw = sample.strikes[0];
        const s = m.strikes.find(x => x.strike === raw.strike);
        assert.equal(s.callGex, raw.call_gex);
        assert.equal(s.putGex, raw.put_gex);
        assert.ok(s.putGex < 0, 'put GEX keeps the API sign');
        assert.equal(s.netGex, raw.net_gex);
        assert.equal(s.callOi, raw.call_oi);
        assert.equal(s.putOi, raw.put_oi);
        assert.equal(s.callVol, raw.call_volume);
        assert.equal(s.putVol, raw.put_volume);
        assert.equal(s.dCallOi, null);
        assert.equal(s.dPutOi, null);
        for (let i = 1; i < m.strikes.length; i++) assert.ok(m.strikes[i].strike > m.strikes[i - 1].strike);
    });
    it('a field the API did not send stays null, never 0', () => {
        const m = M.modelFromZeroDte({
            symbol: 'SPY', underlying_price: 590, expiration: '2026-10-09',
            strikes: [{ strike: 591, call_gex: 1e6 }, { strike: 590, call_gex: null, put_gex: -2e6, net_gex: null, call_oi: 10 }]
        });
        const [a, b] = m.strikes;
        assert.equal(a.strike, 590);
        assert.equal(a.callGex, null);
        assert.equal(a.netGex, null);
        assert.equal(a.putOi, null);
        assert.equal(a.callVol, null);
        assert.equal(b.putGex, null);
        assert.equal(b.netGex, null, 'net GEX is never call + put');
        assert.equal(m.flip, null);
        assert.equal(m.regime, 'unknown');
        assert.equal(m.callWall, null);
        assert.equal(m.putWall, null);
        assert.equal(m.maxPain, null);
        assert.equal(m.pin, null);
        assert.equal(m.magnet, null);
        assert.equal(m.em, null);
        assert.equal(m.emLow, null);
        assert.equal(m.netGex, null);
        assert.equal(m.marketOpen, null);
    });
    it('the api.md example: pin components and the remaining move (590.42 ± 1.05)', () => {
        const m = M.modelFromZeroDte({
            symbol: 'SPY', underlying_price: 590.42, expiration: '2026-03-19', market_open: true,
            regime: { label: 'positive_gamma', gamma_flip: 588.5, gamma_flip_status: 'available' },
            expected_move: { remaining_1sd_dollars: 1.05, remaining_1sd_pct: 0.18, upper_bound: 591.47, lower_bound: 589.37, atm_iv: 0.123 },
            pin_risk: { magnet_strike: 590, pin_score: 82, max_pain: 590, components: { oi_score: 78, proximity_score: 92, time_score: 81, gamma_score: 70 } },
            strikes: [strike(590, 4.5e8, -3.8e8)]
        });
        assert.deepEqual(m.pin.breakdown, { oi: 78, proximity: 92, time: 81, gamma: 70 });
        assert.equal(M.pinBreakdownText(m.pin), 'OI 78 · Proximity 92 · Time 81 · Gamma 70');
        assert.equal(M.fmtEmRange(m.em, '$'), '±$1.05 (0.18%)');
        assert.equal(m.emLow, 589.37);
        assert.equal(m.emHigh, 591.47);
        assert.equal(m.flipVerified, true);
        assert.equal(m.flipStatus, 'available');
        const keys = M.levelList(m, m.spot, { maxPain: true }).map(l => l.key);
        assert.deepEqual(keys.sort(), ['flip', 'maxPain', 'spot']);
    });
    it('an unverified flip: kept, marked unverified, regime unknown (no shading)', () => {
        const m = M.modelFromZeroDte({
            symbol: 'SPY', underlying_price: 590, expiration: '2026-10-09',
            regime: { label: 'unknown', gamma_flip: 588.5, gamma_flip_status: 'sensitive_root' },
            strikes: [strike(585, 1e6, -2e6), strike(595, 3e6, -1e6)]
        });
        assert.equal(m.flip, 588.5);
        assert.equal(m.flipVerified, false);
        assert.equal(m.flipStatus, 'sensitive_root');
        assert.equal(m.regime, 'unknown');
        assert.equal(m.regimeNote, 'unverified');
        assert.equal(M.levelList(m, m.spot).find(l => l.key === 'flip').verified, false);
        assert.deepEqual(M.regimeZones(m, 580, 600), []);
    });
    it('a verified flip with a stated regime: the 0DTE regime zones', () => {
        const m = M.modelFromZeroDte({
            symbol: 'SPY', underlying_price: 590, expiration: '2026-10-09',
            regime: { label: 'negative_gamma', gamma_flip: 592, gamma_flip_status: 'available' },
            strikes: [strike(585, 1e6, -2e6)]
        });
        assert.deepEqual(M.regimeZones(m, 580, 600), [{ side: 'neg', lo: 580, hi: 592 }, { side: 'pos', lo: 592, hi: 600 }]);
    });

    it('no_zero_dte (and nothing at all): null', () => {
        assert.equal(M.modelFromZeroDte({ symbol: 'SPY', underlying_price: 590.42, expiration: null, no_zero_dte: true, next_zero_dte_expiry: '2026-03-18' }), null);
        assert.equal(M.modelFromZeroDte(null), null);
    });
    it('0DTE ranges stay within the API default ±3%', () => {
        assert.deepEqual(M.ZDTE_RANGES, [0.005, 0.01, 0.02, 'all']);
    });
});
