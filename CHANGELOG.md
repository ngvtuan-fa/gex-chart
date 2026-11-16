# Changelog

## 0.1.1

- README, examples, llms.txt and TSDoc use the published package name `@flashalpha-lab/gex-charts`.

## 0.1.0

First release of FlashAlpha GEX Charts.

- Gamma exposure (GEX) by strike chart for stocks, ETFs, indices and futures from the FlashAlpha API.
- ECharts-style API: `init`, `setOption`, `setData`, `on`, `off`, `refresh`, `resize`, `dispose`, `getInstanceByDom`.
- Three modes: `full`, `compact` and `zero-dte`.
- Views: Net GEX, Call vs Put, Open Interest, Flow.
- Levels: call wall, put wall, gamma flip, max pain, spot; overlays for expected move, pin risk, 0DTE and the flip trail.
- Plan read from the API key; a locked feature opens an upgrade dialog inside the chart that links to the FlashAlpha pricing page (`upgradeUrl`, `upgradeNote`, `upgradeAttrs`).
- HTML attribute setup with `data-flashalpha-gex` in the script build.
- Scoped CSS injected at runtime, or `@flashalpha-lab/gex-charts/style.css`.
- TypeScript types.
