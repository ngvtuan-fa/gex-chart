# FlashAlpha API proxy for GEX Charts

Keeps your FlashAlpha API key on the server. The browser calls this proxy, and the proxy adds the `X-Api-Key` header before it forwards the request to `lab.flashalpha.com`. It only forwards the endpoints the chart uses.

```bash
FLASHALPHA_API_KEY=YOUR_FLASHALPHA_API_KEY node server.mjs
```

Then point the chart at the proxy and leave out `apiKey`:

```js
FlashAlphaGex.init(el, { apiBase: 'http://localhost:8787/api/flashalpha', symbol: 'SPY' });
```

In production, serve the proxy from your own domain and add your own sign-in and rate limits in front of it.
