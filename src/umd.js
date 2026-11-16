import { autoInit } from './index.js';

export * from './index.js';

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { autoInit(); });
    else autoInit();
}
