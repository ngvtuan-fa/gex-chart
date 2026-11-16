import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import M from '../src/model.js';
describe('fmtAxisStrike', () => {
    it('rounds the edge of a zoom window to cents', () => {
        assert.equal(M.fmtAxisStrike(772.896, '$'), '$772.9');
        assert.equal(M.fmtAxisStrike(176.435, '$'), '$176.44');
    });
    it('leaves a real strike as it is', () => {
        assert.equal(M.fmtAxisStrike(700, '$'), '$700');
        assert.equal(M.fmtAxisStrike(772.5, '$'), '$772.5');
        assert.equal(M.fmtAxisStrike(7650, ''), '7,650');
    });
});
describe('conclusion: the API sentence on the chart', () => {
    const model = (gamma) => ({ interpretation: gamma, scope: 'all', flip: null, callWall: null, putWall: null });
    it('has no em dash', () => {
        const text = M.conclusion(model('Dealers short gamma — moves amplified, trend following likely'));
        assert.ok(text.startsWith('Dealers short gamma - moves amplified, trend following likely.'), text);
    });
    it('has no raw status code', () => {
        const text = M.conclusion(model('Gamma regime undetermined — gamma flip shown but unverified (sensitive_root); treat the level as indicative'));
        assert.ok(text.startsWith('Gamma regime undetermined - gamma flip shown but unverified; treat the level as indicative.'), text);
    });
    it('keeps ordinary brackets', () => {
        const text = M.conclusion(model('Moves amplified (near the flip)'));
        assert.ok(text.startsWith('Moves amplified (near the flip).'), text);
    });
});
describe('asOfPrefix', () => {
    it('says last close for a stock while its market is closed', () => {
        assert.equal(M.asOfPrefix(false, 'stock'), 'As of last close · ');
    });
    it('does not say last close while the market is open or unknown', () => {
        assert.equal(M.asOfPrefix(true, 'stock'), 'As of ');
        assert.equal(M.asOfPrefix(null, 'stock'), 'As of ');
    });
    it('never says last close for futures, which trade through the US night', () => {
        assert.equal(M.asOfPrefix(false, 'futures'), 'As of ');
    });
});
describe('belowQuotaReserve', () => {
    it('is true under the reserve', () => {
        assert.equal(M.belowQuotaReserve({ limit: 100, remaining: 19, unlimited: false }, 0.2), true);
    });
    it('is false at the reserve and above', () => {
        assert.equal(M.belowQuotaReserve({ limit: 100, remaining: 20, unlimited: false }, 0.2), false);
    });

    it('is false on an unlimited plan', () => {
        assert.equal(M.belowQuotaReserve({ limit: 0, remaining: 0, unlimited: true }, 0.2), false);
    });
});
