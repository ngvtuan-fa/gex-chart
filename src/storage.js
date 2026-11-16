export function createStorage(prefix, enabled) {
    var base = String(prefix || 'flashalpha-gex');
    var memory = {};

    function local() {
        if (enabled === false) return null;
        try {
            var s = window.localStorage;
            return s || null;
        } catch (e) {
            return null;
        }
    }

    function fullKey(name) { return base + ':' + name; }

    function getRaw(key) {
        var s = local();
        if (!s) return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
        try { return s.getItem(key); } catch (e) { return null; }
    }

    function setRaw(key, value) {
        var s = local();
        if (!s) { memory[key] = value; return; }
        try { s.setItem(key, value); } catch (e) { memory[key] = value; }
    }

    function keys() {
        var s = local();
        if (!s) return Object.keys(memory);
        var out = [];
        try {
            for (var i = 0; i < s.length; i++) out.push(s.key(i));
        } catch (e) {
            return out;
        }
        return out;
    }

    function removeRaw(key) {
        var s = local();
        delete memory[key];
        if (!s) return;
        try { s.removeItem(key); } catch (e) { return; }
    }

    return {
        get: function (name) {
            var raw = getRaw(fullKey(name));
            if (raw === null || raw === undefined) return null;
            try { return JSON.parse(raw); } catch (e) { return null; }
        },
        set: function (name, value) {
            setRaw(fullKey(name), JSON.stringify(value));
        },
        prune: function (startsWith, keep) {
            var head = fullKey(startsWith);
            keys().forEach(function (k) {
                if (k && k.indexOf(head) === 0 && !keep(k)) removeRaw(k);
            });
        }
    };
}
