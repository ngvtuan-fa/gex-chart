import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { fakeEcharts, host } from './helpers.js';

const distUrl = new URL('../dist/', import.meta.url);
const built = existsSync(new URL('gex-charts.mjs', distUrl));
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

describe('built package', { skip: built ? false : 'run npm run build first' }, () => {
    it('the ESM build injects its CSS once and reports its version', async () => {
        const G = await import(new URL('gex-charts.mjs', distUrl));
        assert.equal(G.version, pkg.version);
        const a = G.init(host(), { mode: 'compact', data: { summary: null, gex: { strikes: [] } }, echarts: fakeEcharts() });
        const b = G.init(host(), { mode: 'compact', data: { summary: null, gex: { strikes: [] } }, echarts: fakeEcharts() });
        const styles = document.querySelectorAll('style#flashalpha-gex-css');
        assert.equal(styles.length, 1);
        assert.match(styles[0].textContent, /\.flashalpha-gex \.fagex-root\{--fagex-text:/);
        assert.doesNotMatch(styles[0].textContent, /@layer/);
        a.dispose();
        b.dispose();
    });

    it('the CSS never styles anything outside the chart', () => {
        const css = readFileSync(new URL('gex-charts.css', distUrl), 'utf8').replace(/^\/\*![^*]*\*\/\s*/, '');
        const splitList = (sel) => {
            const out = [];
            let depth = 0, cur = '';
            for (let i = 0; i < sel.length; i++) {
                const ch = sel[i];
                if (ch === '\\') { cur += ch + sel[i + 1]; i++; continue; }
                if (ch === '(') depth++;
                if (ch === ')') depth--;
                if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
                cur += ch;
            }
            out.push(cur);
            return out;
        };
        const selectors = [];
        css.replace(/(^|[{};])([^{}@;]+)\{/g, (m, p, sel) => { selectors.push(...splitList(sel)); return m; });
        const loose = selectors.map((s) => s.trim()).filter((s) => s && !s.startsWith('.flashalpha-gex') && !/^(from|to|\d+%)$/.test(s));
        assert.deepEqual(loose, []);
    });

    it('the script build sets window.FlashAlphaGex and starts every [data-flashalpha-gex] element', async () => {
        const dom = new JSDOM('<!doctype html><body><div data-flashalpha-gex data-symbol="NVDA" data-mode="compact"></div></body>', { runScripts: 'outside-only', url: 'https://example.com/' });
        dom.window.HTMLCanvasElement.prototype.getContext = () => ({ font: '', measureText: (t) => ({ width: String(t).length * 6 }) });
        dom.window.eval(readFileSync(new URL('gex-charts.min.js', distUrl), 'utf8'));
        if (dom.window.document.readyState === 'loading') await new Promise((r) => dom.window.document.addEventListener('DOMContentLoaded', r));
        const G = dom.window.FlashAlphaGex;
        assert.equal(typeof G.init, 'function');
        assert.equal(G.version, pkg.version);
        const el = dom.window.document.querySelector('[data-flashalpha-gex]');
        assert.ok(G.getInstanceByDom(el));
        assert.ok(el.classList.contains('flashalpha-gex'));
        G.dispose(el);
    });
    it('the model build works without the DOM, in ESM, CommonJS and as a script', async () => {
        const esm = (await import(new URL('model.mjs', distUrl))).default;
        const { createRequire } = await import('node:module');
        const { fileURLToPath } = await import('node:url');
        const cjs = createRequire(import.meta.url)(fileURLToPath(new URL('model.cjs', distUrl)));
        for (const m of [esm, cjs]) {
            assert.equal(typeof m.buildModel, 'function');
            assert.equal(m.fmtGex(1.5e9).includes('B'), true);
        }
        const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
        dom.window.eval(readFileSync(new URL('gex-charts-model.min.js', distUrl), 'utf8'));
        assert.equal(typeof dom.window.FlashAlphaGexModel.asOfPrefix, 'function');
        assert.equal(dom.window.FlashAlphaGex, undefined);
    });
});
