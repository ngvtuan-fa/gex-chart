import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fixture, fakeEcharts, fakeFetch, nextEvent, host, futureDates, window } from './helpers.js';
import * as FlashAlphaGex from '../src/index.js';

const summary = fixture('stock-summary.json');
const gex = fixture('exposure-gex.json');
const zeroDte = fixture('exposure-zero-dte.json');

const opened = [];
function open(el, options) {
    const c = FlashAlphaGex.init(el, options);
    opened.push(c);
    return c;
}
afterEach(() => {
    while (opened.length) opened.pop().dispose();
    document.body.innerHTML = '';
    localStorage.clear();
});

function growthRoutes(extra) {
    return (extra || []).concat([
        ['/v1/account', [200, { plan: 'growth', daily_limit: 2500, remaining: 2400 }]],
        [/^\/v1\/stock\/[A-Z]+\/summary/, [200, summary]],
        [/^\/v1\/exposure\/gex\//, [200, gex]]
    ]);
}

describe('init with a FlashAlpha API key', () => {
    it('reads the plan, loads the summary and per-strike GEX, and draws the chart', async () => {
        const echarts = fakeEcharts();
        const fetch = fakeFetch(growthRoutes());
        const el = host();
        const chart = open(el, { apiKey: 'test-key', symbol: 'spy', echarts, fetch });
        const ready = await nextEvent(chart, 'ready');
        assert.equal(ready.model.symbol, 'SPY');
        assert.ok(ready.model.strikes.length > 0);
        const paths = fetch.calls.map((c) => c.path);
        assert.deepEqual(paths.slice(0, 1), ['/v1/account']);
        assert.ok(paths.includes('/v1/stock/SPY/summary'));
        const gexCall = fetch.calls.find((c) => c.path === '/v1/exposure/gex/SPY');
        assert.equal(gexCall.search, '?min_oi=100');
        for (const c of fetch.calls) {
            assert.equal(c.headers['X-Api-Key'], 'test-key');
            assert.equal(c.headers['X-Source'], 'gex-charts');
            assert.ok(c.url.startsWith('https://lab.flashalpha.com/'));
        }
        assert.equal(echarts.charts.length, 1);
        assert.deepEqual(echarts.themes, ['flashalpha-dark', 'flashalpha-light']);
        assert.ok(el.classList.contains('flashalpha-gex'));
        assert.equal(el.querySelector('[data-r="sym"]').textContent, 'SPY');
        assert.equal(chart.getStatus(), 'ready');
    });

    it('sends requests to a custom apiBase with extra headers and an async key', async () => {
        const inner = fakeFetch(growthRoutes());
        const seen = [];
        const fetch = (url, init) => { seen.push({ url, headers: init.headers }); return inner(url.replace('/fa/', '/'), init); };
        const chart = open(host(), {
            apiBase: 'https://proxy.example.com/fa/', getApiKey: async () => 'from-server',
            headers: () => ({ 'X-Tenant': 't1' }), echarts: fakeEcharts(), fetch
        });
        await nextEvent(chart, 'ready');
        assert.ok(seen.length >= 3);
        for (const c of seen) {
            assert.ok(c.url.startsWith('https://proxy.example.com/fa/v1/'), c.url);
            assert.equal(c.headers['X-Api-Key'], 'from-server');
            assert.equal(c.headers['X-Tenant'], 't1');
        }
    });

    it('a Free key loads the nearest expiry, not the whole chain', async () => {
        const days = futureDates(3);
        const fetch = fakeFetch([
            ['/v1/account', [200, { plan: 'free', daily_limit: 5, remaining: 5 }]],
            ['/v1/options/AAPL', [200, { symbol: 'AAPL', expirations: days.map((d) => ({ expiration: d })) }]],
            [/^\/v1\/stock\/AAPL\/summary/, [200, summary]],
            [/^\/v1\/exposure\/gex\//, [200, gex]]
        ]);
        const chart = open(host(), { apiKey: 'k', symbol: 'AAPL', echarts: fakeEcharts(), fetch });
        await nextEvent(chart, 'ready');
        const gexCall = fetch.calls.find((c) => c.path === '/v1/exposure/gex/AAPL');
        assert.equal(gexCall.search, '?expiration=' + days[0] + '&min_oi=100');
    });

    it('the plan option skips the account lookup', async () => {
        const fetch = fakeFetch(growthRoutes());
        const chart = open(host(), { apiKey: 'k', plan: 'growth', echarts: fakeEcharts(), fetch });
        await nextEvent(chart, 'ready');
        assert.ok(!fetch.calls.some((c) => c.path === '/v1/account'));
    });
});

describe('without an API key', () => {
    it('asks for a key, shows the public levels and never calls per-strike GEX', async () => {
        const fetch = fakeFetch([[/^\/v1\/stock\/SPY\/summary/, [200, summary]]]);
        const el = host();
        const chart = open(el, { symbol: 'SPY', echarts: fakeEcharts(), fetch });
        const locked = await nextEvent(chart, 'locked');
        assert.equal(locked.reason, 'api-key');
        await new Promise((r) => setTimeout(r, 20));
        assert.deepEqual(fetch.calls.map((c) => c.path), ['/v1/stock/SPY/summary']);
        assert.equal(fetch.calls[0].headers['X-Api-Key'], undefined);
        const overlay = el.querySelector('[data-r="overlay"]');
        assert.match(overlay.textContent, /Add your FlashAlpha API key/);
        const link = overlay.querySelector('a');
        assert.equal(link.textContent, 'Get a free API key');
        assert.match(link.href, /^https:\/\/flashalpha\.com\/pricing\?utm_source=npm&utm_medium=gex-charts&utm_campaign=get_api_key$/);
        assert.equal(link.target, '_blank');
        assert.notEqual(el.querySelector('[data-r="rail"]').hidden, true);
    });

    it('a key lab refuses shows "not accepted"', async () => {
        const fetch = fakeFetch([['/v1/account', [401, { error: 'invalid_api_key' }]]]);
        const el = host();
        const chart = open(el, { apiKey: 'wrong', echarts: fakeEcharts(), fetch });
        const locked = await nextEvent(chart, 'locked');
        assert.equal(locked.reason, 'invalid-key');
        assert.match(el.querySelector('[data-r="overlay"]').textContent, /FlashAlpha API key not accepted/);
    });

    it('apiKey null skips the plan lookup even with a custom apiBase', async () => {
        const fetch = fakeFetch([]);
        const chart = open(host(), { apiKey: null, apiBase: 'https://lab.example.test', summary: null, echarts: fakeEcharts(), fetch });
        const locked = await nextEvent(chart, 'locked');
        assert.equal(locked.reason, 'api-key');
        assert.ok(!fetch.calls.some((x) => x.path === '/v1/account'));
    });

    it('guestCta overrides the overlay text and link', async () => {
        const el = host();
        const chart = open(el, {
            echarts: fakeEcharts(), fetch: fakeFetch([]),
            guestCta: { title: 'Sign in', text: 'Create an account.', label: 'Sign up', href: '/signup', attrs: { 'data-analytics': 'cta-x', onclick: 'alert(1)' } }
        });
        await nextEvent(chart, 'locked');
        const a = el.querySelector('[data-r="overlay"] a');
        assert.equal(a.textContent, 'Sign up');
        assert.equal(a.getAttribute('href'), '/signup');
        assert.equal(a.target, '');
        assert.equal(a.getAttribute('data-analytics'), 'cta-x');
        assert.equal(a.getAttribute('onclick'), null);
    });
});

describe('plan gates', () => {
    it('a 403 shows the plan it needs with an upgrade link', async () => {
        const fetch = fakeFetch(growthRoutes([[/^\/v1\/exposure\/gex\//, [403, { error: 'tier_restricted', required_plan: 'Alpha', message: 'Needs Alpha.' }]]]));
        const el = host();
        const chart = open(el, { apiKey: 'k', symbol: 'TSLA', echarts: fakeEcharts(), fetch });
        const locked = await nextEvent(chart, 'locked');
        assert.equal(locked.requiredPlan, 'Alpha');
        const overlay = el.querySelector('[data-r="overlay"]');
        assert.match(overlay.textContent, /included from the FlashAlpha Alpha plan/);
        assert.match(overlay.querySelector('a').href, /\/pricing\?plan=alpha&utm_source=npm/);
    });

    it('the Flow view on Growth opens the upgrade modal and sends nothing', async () => {
        const fetch = fakeFetch(growthRoutes());
        const el = host();
        const chart = open(el, {
            apiKey: 'k', echarts: fakeEcharts(), fetch,
            upgradeNote: (plan) => plan === 'alpha' ? 'Alpha is $X/mo, billed yearly.' : null,
            upgradeAttrs: { 'data-analytics': 'cta-lock', onclick: 'x()' }
        });
        await nextEvent(chart, 'ready');
        const before = fetch.calls.length;
        const lockedP = nextEvent(chart, 'locked');
        const opener = el.querySelector('button[data-view="flow"]');
        opener.focus();
        opener.click();
        const locked = await lockedP;
        assert.equal(locked.requiredPlan, 'Alpha');
        const modal = el.querySelector('[data-r="upgrade"]');
        assert.ok(modal, 'modal shown inside the chart');
        assert.equal(modal.getAttribute('role'), 'dialog');
        assert.equal(modal.getAttribute('aria-modal'), 'true');
        assert.match(modal.querySelector('h3').textContent, /needs the FlashAlpha Alpha plan/);
        assert.equal(modal.querySelector('[data-um="note"]').textContent, 'Alpha is $X/mo, billed yearly.');
        const cta = modal.querySelector('[data-um="cta"]');
        assert.equal(cta.textContent, 'Upgrade to Alpha');
        assert.match(cta.href, /\/pricing\?plan=alpha&utm_source=npm&utm_medium=gex-charts&utm_campaign=upgrade_flow$/);
        assert.equal(cta.getAttribute('data-analytics'), 'cta-lock');
        assert.equal(cta.getAttribute('onclick'), null);
        assert.equal(document.activeElement, cta);
        assert.equal(el.querySelector('[data-r="pop"]').hidden, true);
        assert.ok(!fetch.calls.slice(before).some((x) => x.path.startsWith('/v1/flow/')));
        modal.querySelector('[data-um="close"]').click();
        assert.equal(el.querySelector('[data-r="upgrade"]'), null);
        assert.equal(document.activeElement, opener);
    });

    it('the upgrade modal closes on Esc and on the backdrop', async () => {
        const el = host();
        const chart = open(el, { apiKey: 'k', echarts: fakeEcharts(), fetch: fakeFetch(growthRoutes()) });
        await nextEvent(chart, 'ready');
        el.querySelector('button[data-view="flow"]').click();
        const cta = el.querySelector('[data-r="upgrade"] [data-um="cta"]');
        cta.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        assert.equal(el.querySelector('[data-r="upgrade"]'), null);
        el.querySelector('button[data-view="flow"]').click();
        const modal = el.querySelector('[data-r="upgrade"]');
        modal.click();
        assert.equal(el.querySelector('[data-r="upgrade"]'), null);
        el.querySelector('button[data-view="flow"]').click();
        chart.dispose();
        assert.equal(document.querySelector('[data-r="upgrade"]'), null);
    });

    it('upgradeUrl replaces the pricing link', async () => {
        const fetch = fakeFetch(growthRoutes([[/^\/v1\/exposure\/gex\//, [403, { required_plan: 'Growth' }]]]));
        const el = host();
        const chart = open(el, { apiKey: 'k', echarts: fakeEcharts(), fetch, upgradeUrl: (plan) => '/pricing?plan=' + plan });
        await nextEvent(chart, 'locked');
        assert.equal(el.querySelector('[data-r="overlay"] a').getAttribute('href'), '/pricing?plan=growth');
    });
});

describe('errors', () => {
    it('a quota 429 says the daily limit is reached', async () => {
        const fetch = fakeFetch(growthRoutes([[/^\/v1\/exposure\/gex\//, [429, { error: 'quota_exceeded' }]]]));
        const el = host();
        const chart = open(el, { apiKey: 'k', echarts: fakeEcharts(), fetch });
        const e = await nextEvent(chart, 'rate-limited');
        assert.equal(e.kind, 'quota');
        assert.match(el.querySelector('[data-r="overlay"]').textContent, /Daily FlashAlpha API limit reached/);
    });

    it('a concurrency 429 is retried', async () => {
        let n = 0;
        const fetch = fakeFetch(growthRoutes([[/^\/v1\/exposure\/gex\//, () => (n++ < 1 ? [429, { error: 'concurrency_limit' }] : [200, gex])]]));
        const chart = open(host(), { apiKey: 'k', echarts: fakeEcharts(), fetch });
        await nextEvent(chart, 'ready', 4000);
        assert.equal(fetch.calls.filter((c) => c.path === '/v1/exposure/gex/SPY').length, 2);
    });

    it('says so when ECharts is missing', async () => {
        const el = host();
        const chart = open(el, { apiKey: 'k', fetch: fakeFetch(growthRoutes()) });
        const e = await nextEvent(chart, 'error');
        assert.equal(e.kind, 'echarts');
        assert.match(el.querySelector('[data-r="overlay"]').textContent, /ECharts is not loaded/);
    });
});

describe('modes and data', () => {
    it('compact mode draws given API responses without any request', async () => {
        const fetch = fakeFetch([]);
        const el = host();
        const chart = open(el, { mode: 'compact', data: { summary, gex }, echarts: fakeEcharts(), fetch, top: 8 });
        const ready = await nextEvent(chart, 'ready');
        assert.equal(ready.model.strikes.length, 8);
        assert.equal(fetch.calls.length, 0);
        assert.equal(el.getAttribute('data-mode'), 'compact');
        assert.equal(el.querySelector('[data-r="toolbar"]'), null);
    });

    it('compact mode with a key fetches its own data', async () => {
        const fetch = fakeFetch(growthRoutes());
        const chart = open(host(), { mode: 'compact', apiKey: 'k', echarts: fakeEcharts(), fetch });
        await nextEvent(chart, 'ready');
        assert.ok(fetch.calls.some((c) => c.path === '/v1/exposure/gex/SPY' && c.search === '?min_oi=100'));
    });

    it('zero-dte mode fetches /v1/exposure/zero-dte', async () => {
        const fetch = fakeFetch([[/^\/v1\/exposure\/zero-dte\//, [200, zeroDte]]]);
        const chart = open(host(), { mode: 'zero-dte', apiKey: 'k', symbol: 'SPY', echarts: fakeEcharts(), fetch });
        const ready = await nextEvent(chart, 'ready');
        assert.ok(ready.model.strikes.length > 0);
        assert.deepEqual(fetch.calls.map((c) => c.path), ['/v1/exposure/zero-dte/SPY']);
    });

    it('setData redraws a compact chart', async () => {
        const chart = open(host(), { mode: 'compact', data: { summary, gex }, echarts: fakeEcharts(), fetch: fakeFetch([]) });
        await nextEvent(chart, 'ready');
        const again = nextEvent(chart, 'ready');
        chart.setData({ summary, gex: { ...gex, strikes: gex.strikes.slice(0, 20) } });
        const r = await again;
        assert.ok(r.model.strikes.length <= 20);
    });
});

describe('ECharts-style API', () => {
    it('getInstanceByDom, init on the same element and dispose', async () => {
        const el = host();
        const a = open(el, { mode: 'compact', data: { summary, gex }, echarts: fakeEcharts(), fetch: fakeFetch([]) });
        assert.equal(FlashAlphaGex.getInstanceByDom(el), a);
        const b = open(el, { mode: 'compact', data: { summary, gex }, echarts: fakeEcharts(), fetch: fakeFetch([]) });
        assert.equal(a.isDisposed(), true);
        assert.equal(el.querySelectorAll('.fagex-root').length, 1);
        b.dispose();
        assert.equal(FlashAlphaGex.getInstanceByDom(el), null);
        assert.equal(el.classList.contains('flashalpha-gex'), false);
        assert.equal(el.children.length, 0);
    });

    it('setOption changes the view and emits view-change', async () => {
        const el = host();
        const chart = open(el, { apiKey: 'k', echarts: fakeEcharts(), fetch: fakeFetch(growthRoutes()) });
        await nextEvent(chart, 'ready');
        const change = nextEvent(chart, 'view-change');
        chart.setOption({ view: 'oi' });
        assert.equal((await change).view, 'oi');
        assert.equal(el.querySelector('button[data-view="oi"]').getAttribute('aria-pressed'), 'true');
    });

    it('autoInit reads data attributes', async () => {
        const el = host();
        el.setAttribute('data-flashalpha-gex', '');
        el.setAttribute('data-symbol', 'qqq');
        el.setAttribute('data-mode', 'compact');
        el.setAttribute('data-attribution', 'false');
        globalThis.window.echarts = fakeEcharts();
        const fetch = fakeFetch([]);
        const charts = FlashAlphaGex.autoInit();
        opened.push(...charts);
        assert.equal(charts.length, 1);
        assert.equal(el.getAttribute('data-mode'), 'compact');
        assert.equal(el.querySelector('[data-r="attr"]'), null);
        assert.equal(FlashAlphaGex.autoInit().length, 0);
        delete globalThis.window.echarts;
        void fetch;
    });

    it('shows the FlashAlpha attribution unless turned off', async () => {
        const el = host();
        const chart = open(el, { mode: 'compact', data: { summary, gex }, echarts: fakeEcharts(), fetch: fakeFetch([]) });
        await nextEvent(chart, 'ready');
        const a = el.querySelector('[data-r="attr"] a');
        assert.equal(a.textContent.replace(/\s/g, ' '), 'GEX data by FlashAlpha');
        assert.match(a.href, /^https:\/\/flashalpha\.com\/\?utm_source=npm&utm_medium=gex-charts&utm_campaign=attribution$/);
    });

    it('storage none keeps prefs out of localStorage', async () => {
        const el = host();
        const chart = open(el, { apiKey: 'k', storage: 'none', echarts: fakeEcharts(), fetch: fakeFetch(growthRoutes()) });
        await nextEvent(chart, 'ready');
        chart.setOption({ view: 'callput' });
        assert.equal(localStorage.length, 0);
    });

    it('saves prefs under the storage prefix', async () => {
        const chart = open(host(), { apiKey: 'k', storagePrefix: 'my-app', echarts: fakeEcharts(), fetch: fakeFetch(growthRoutes()) });
        await nextEvent(chart, 'ready');
        chart.setOption({ view: 'callput' });
        assert.equal(JSON.parse(localStorage.getItem('my-app:prefs')).view, 'callput');
    });
});
