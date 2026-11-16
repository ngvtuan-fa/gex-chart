import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

export const fixture = (name) => JSON.parse(readFileSync(new URL('./fixtures/' + name, import.meta.url), 'utf8'));

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://example.com/page', pretendToBeVisual: true });
const g = globalThis;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
g.localStorage = dom.window.localStorage;
g.requestAnimationFrame = (fn) => setTimeout(fn, 0);
dom.window.HTMLCanvasElement.prototype.getContext = function () {
    return { font: '', measureText: (t) => ({ width: String(t).length * 6 }) };
};
dom.window.requestAnimationFrame = g.requestAnimationFrame;

export const window = dom.window;

export function fakeEcharts() {
    const charts = [];
    const themes = [];
    return {
        charts,
        themes,
        registerTheme(name) { themes.push(name); },
        graphic: { clipRectByRect: (a) => a },
        init(el, theme) {
            const handlers = {};
            const c = {
                el, theme, options: [], disposed: false,
                setOption(o) { this.options.push(o); },
                getOption() { return { dataZoom: [{ startValue: 600, endValue: 760 }] }; },
                on(name, fn) { handlers[name] = fn; },
                dispatchAction() {},
                convertToPixel() { return 100; },
                getWidth() { return 900; },
                getHeight() { return 480; },
                resize() {},
                setTheme(t) { this.theme = t; },
                getDataURL() { return 'data:image/png;base64,AAAA'; },
                dispose() { this.disposed = true; }
            };
            charts.push(c);
            return c;
        }
    };
}

export function jsonResponse(status, body) {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: () => null },
        json: async () => body
    };
}

export function fakeFetch(routes) {
    const calls = [];
    const fn = async (url, init) => {
        const u = new URL(url);
        calls.push({ url, path: u.pathname, search: u.search, headers: (init && init.headers) || {} });
        for (const [test, reply] of routes) {
            if (typeof test === 'string' ? u.pathname === test : test.test(u.pathname + u.search)) {
                const r = typeof reply === 'function' ? reply(u) : reply;
                return jsonResponse(r[0], r[1]);
            }
        }
        return jsonResponse(404, { error: 'not_found' });
    };
    fn.calls = calls;
    return fn;
}

export function nextEvent(chart, name, ms = 2000) {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('timeout waiting for ' + name)), ms);
        chart.on(name, (p) => { clearTimeout(t); resolve(p); });
    });
}

export function host() {
    const el = document.createElement('div');
    Object.defineProperty(el, 'clientWidth', { value: 1200, configurable: true });
    document.body.appendChild(el);
    return el;
}

export function futureDates(n) {
    const out = [];
    const d = new Date();
    for (let i = 3; out.length < n; i += 7) {
        const x = new Date(d.getTime() + i * 86400000);
        out.push(x.toISOString().slice(0, 10));
    }
    return out;
}
