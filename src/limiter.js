export function createLimiter(limit) {
    var max = Math.max(1, Math.floor(Number(limit) || 3));
    var active = 0;
    var waiters = [];

    function acquire() {
        if (active < max) {
            active++;
            return Promise.resolve();
        }
        return new Promise(function (resolve) { waiters.push(resolve); });
    }

    function release() {
        var next = waiters.shift();
        if (next) { next(); return; }
        active--;
    }

    return {
        run: async function (task) {
            await acquire();
            try {
                return await task();
            } finally {
                release();
            }
        },
        inFlight: function () { return active; }
    };
}

var shared = {};

export function sharedLimiter(limit) {
    var key = String(Math.max(1, Math.floor(Number(limit) || 3)));
    if (!shared[key]) shared[key] = createLimiter(Number(key));
    return shared[key];
}
