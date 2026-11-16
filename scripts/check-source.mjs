import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

const FORBIDDEN = [
    /\bowner\b/i,
    /\bspec\b/i,
    /Tecware/,
    /FlashAuth/,
    /fa_user/,
    /FaFetchPool/,
    /FaTelemetry/,
    /FaUpgradeModal/,
    /faToolUsage/,
    /faGatePlanCtas/,
    /data-analytics/,
    /requestCount/,
    /telemetry/i,
    /['"]\/pricing/,
    /['"]\/images\//,
    /localhost/
];

const problems = [];

for (const name of readdirSync(src)) {
    const file = join(src, name);
    const text = readFileSync(file, 'utf8');
    if (extname(name) === '.js') {
        acorn.parse(text, {
            ecmaVersion: 'latest',
            sourceType: 'module',
            onComment: (block, value, start) => {
                const line = text.slice(0, start).split('\n').length;
                problems.push(name + ':' + line + ' comment');
            }
        });
    } else if (extname(name) === '.css' && /\/\*/.test(text)) {
        problems.push(name + ' comment');
    }
    FORBIDDEN.forEach((re) => {
        if (name === 'brand.js' && /pricing/.test(re.source)) return;
        const m = text.match(re);
        if (m) problems.push(name + ' contains "' + m[0] + '"');
    });
}

if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
}
console.log('src: no comments, no internal references');
