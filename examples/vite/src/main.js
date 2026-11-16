import * as echarts from 'echarts';
import * as FlashAlphaGex from '@flashalpha-lab/gex-charts';

const chart = FlashAlphaGex.init(document.getElementById('gex'), {
    apiKey: import.meta.env.VITE_FLASHALPHA_API_KEY,
    symbol: 'SPY',
    theme: 'dark',
    echarts
});

chart.on('ready', ({ model }) => {
    console.log(model.symbol, 'call wall', model.callWall, 'put wall', model.putWall, 'gamma flip', model.flip);
});
