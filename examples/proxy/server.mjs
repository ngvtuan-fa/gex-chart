import { createServer } from 'node:http';

const API_KEY = process.env.FLASHALPHA_API_KEY;
const LAB = 'https://lab.flashalpha.com';
const PREFIX = '/api/flashalpha';
const ALLOWED = /^\/(v1\/(account|stock\/[^/]+\/summary|exposure\/(gex|zero-dte)\/[^/]+|options\/[^/]+|flow\/(gex|pin-risk)\/[^/]+|expected-move\/[^/]+)|stockquote\/[^/]+)$/;

if (!API_KEY) {
    console.error('Set FLASHALPHA_API_KEY first.');
    process.exit(1);
}

createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (req.method !== 'GET' || !url.pathname.startsWith(PREFIX)) {
        res.writeHead(404).end();
        return;
    }
    const path = url.pathname.slice(PREFIX.length);
    if (!ALLOWED.test(path)) {
        res.writeHead(403, { 'Content-Type': 'application/json' }).end('{"error":"path_not_allowed"}');
        return;
    }
    const upstream = await fetch(LAB + path + url.search, { headers: { 'X-Api-Key': API_KEY, 'X-Source': 'gex-charts-proxy' } });
    res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
    res.end(Buffer.from(await upstream.arrayBuffer()));
}).listen(8787, () => console.log('FlashAlpha proxy on http://localhost:8787' + PREFIX));
