import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as esbuild from 'esbuild';
import { transform } from 'lightningcss';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const tmp = join(root, '.build');
const dist = join(root, 'dist');
const SCOPE = 'flashalpha-gex';

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
mkdirSync(tmp, { recursive: true });

const chartSource = readFileSync(join(root, 'src/chart.js'), 'utf8');
const mobilePrefix = (chartSource.match(/var MOBILE = '([^']+)';/) || [])[1];
const safelist = new Set();
for (const m of chartSource.matchAll(/MOBILE \+ '([^'\s]+)/g)) safelist.add(mobilePrefix + m[1]);
writeFileSync(join(tmp, 'safelist.txt'), Array.from(safelist).join('\n'));
writeFileSync(join(tmp, 'input.css'), '@import "../src/styles.css";\n@source "./safelist.txt";\n');

const twCli = join(dirname(require.resolve('@tailwindcss/cli/package.json')), 'dist/index.mjs');
execFileSync(process.execPath, [twCli, '-i', join(tmp, 'input.css'), '-o', join(tmp, 'tailwind.css')], { cwd: root, stdio: 'inherit' });

function scopeSelector(selector) {
    const first = selector[0];
    if (first && first.type === 'pseudo-class' && (first.kind === 'root' || first.kind === 'host')) {
        return [{ type: 'class', name: SCOPE }].concat(selector.slice(1));
    }
    return [{ type: 'class', name: SCOPE }, { type: 'combinator', value: 'descendant' }].concat(selector);
}

const TARGETS = { chrome: 100 << 16, firefox: 100 << 16, safari: (15 << 16) | (4 << 8) };
const flat = transform({ filename: 'tailwind.css', code: readFileSync(join(tmp, 'tailwind.css')), targets: TARGETS }).code;

function unlayer(css) {
    let out = '';
    let i = 0;
    const depthStack = [];
    while (i < css.length) {
        if (css.startsWith('@layer', i)) {
            const semi = css.indexOf(';', i);
            const brace = css.indexOf('{', i);
            if (semi !== -1 && (brace === -1 || semi < brace)) { i = semi + 1; continue; }
            depthStack.push(0);
            i = brace + 1;
            continue;
        }
        const ch = css[i];
        if (depthStack.length) {
            if (ch === '{') depthStack[depthStack.length - 1]++;
            else if (ch === '}') {
                if (depthStack[depthStack.length - 1] === 0) { depthStack.pop(); i++; continue; }
                depthStack[depthStack.length - 1]--;
            }
        }
        out += ch;
        i++;
    }
    return out;
}

const scoped = unlayer(transform({
    filename: 'tailwind.css',
    code: flat,
    targets: TARGETS,
    visitor: {
        Selector(selector) { return scopeSelector(selector); }
    }
}).code.toString());

const base = readFileSync(join(root, 'src/base.css'), 'utf8');
const css = transform({
    filename: 'gex-charts.css',
    code: Buffer.from(base + '\n' + scoped),
    minify: true,
    targets: TARGETS
}).code.toString();

const banner = '/*! ' + pkg.name + ' v' + pkg.version + ' | ' + pkg.license + ' | https://flashalpha.com */';
writeFileSync(join(dist, 'gex-charts.css'), banner + '\n' + css);

const shared = {
    bundle: true,
    target: ['es2019'],
    legalComments: 'none',
    charset: 'utf8',
    banner: { js: banner },
    define: {
        __FAGEX_CSS__: JSON.stringify(css),
        __FAGEX_VERSION__: JSON.stringify(pkg.version)
    }
};

await esbuild.build({ ...shared, entryPoints: [join(root, 'src/index.js')], format: 'esm', outfile: join(dist, 'gex-charts.mjs') });
await esbuild.build({ ...shared, entryPoints: [join(root, 'src/index.js')], format: 'cjs', platform: 'neutral', outfile: join(dist, 'gex-charts.cjs') });
await esbuild.build({ ...shared, entryPoints: [join(root, 'src/umd.js')], format: 'iife', globalName: 'FlashAlphaGex', outfile: join(dist, 'gex-charts.js') });
await esbuild.build({ ...shared, entryPoints: [join(root, 'src/umd.js')], format: 'iife', globalName: 'FlashAlphaGex', minify: true, outfile: join(dist, 'gex-charts.min.js') });
await esbuild.build({ ...shared, entryPoints: [join(root, 'src/model-entry.js')], format: 'esm', outfile: join(dist, 'model.mjs') });
await esbuild.build({ ...shared, entryPoints: [join(root, 'src/model-entry.js')], format: 'cjs', platform: 'neutral', footer: { js: 'module.exports = module.exports.default;' }, outfile: join(dist, 'model.cjs') });
await esbuild.build({ ...shared, entryPoints: [join(root, 'src/model-global.js')], format: 'iife', minify: true, outfile: join(dist, 'gex-charts-model.min.js') });

console.log('tailwind safelist: ' + safelist.size + ' classes');
rmSync(tmp, { recursive: true, force: true });
console.log('built dist/ for ' + pkg.name + ' v' + pkg.version);
