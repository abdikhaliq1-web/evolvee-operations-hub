const buckets = new Map();
const MAX_BUCKETS = 20000;

function hit(key, now, windowMs, max) {
    const rec = buckets.get(key);

    if (!rec || now - rec.start > windowMs) {
        buckets.set(key, { start: now, count: 1, windowMs: windowMs });
        return false;
    }

    rec.count += 1;
    return rec.count > max;
}

function sweep(now) {
    if (buckets.size <= MAX_BUCKETS) {
        return;
    }

    for (const [key, rec] of buckets) {
        if (now - rec.start > rec.windowMs) {
            buckets.delete(key);
        }
    }
}

function rateLimit(rules, message) {
    const text = message || 'Too many requests. Please wait and try again.';

    return function limiter(req, res, next) {
        const now = Date.now();
        sweep(now);

        let blocked = false;

        for (const rule of rules) {
            const value = rule.key(req);

            if (value === null || value === undefined || value === '') {
                continue;
            }
            if (hit(rule.name + '|' + value, now, rule.windowMs, rule.max)) {
                blocked = true;
            }
        }

        if (blocked) {
            return res.status(429).json({ error: text });
        }

        next();
    };
}

function resetRateLimits() {
    buckets.clear();
}

if (require.main === module) {
    const assert = require('assert');

    const call = (limiter, req) => {
        let status = 200;
        const res = { status(s) { status = s; return this; }, json() { return this; } };
        limiter(req, res, () => { status = 200; });
        return status;
    };

    const perEmail = rateLimit([
        { name: 'ip-email', key: (r) => r.ip + '|' + r.body.email, windowMs: 60000, max: 10 },
        { name: 'email', key: (r) => r.body.email, windowMs: 60000, max: 20 },
        { name: 'ip', key: (r) => r.ip, windowMs: 60000, max: 50 },
    ]);

    for (let i = 0; i < 20; i++) {
        const ip = '10.0.0.' + i;
        assert.strictEqual(call(perEmail, { ip: ip, body: { email: 'v@x.com' } }), 200, 'attempt ' + i + ' must pass');
    }
    assert.strictEqual(
        call(perEmail, { ip: '10.0.0.99', body: { email: 'v@x.com' } }),
        429,
        'per-account cap must hold across rotating IPs'
    );
    assert.strictEqual(call(perEmail, { ip: '10.0.0.99', body: { email: 'other@x.com' } }), 200);

    resetRateLimits();

    const perUser = rateLimit([{ name: 'u', key: (r) => r.user.id, windowMs: 60000, max: 2 }]);
    assert.strictEqual(call(perUser, { user: { id: 1 } }), 200);
    assert.strictEqual(call(perUser, { user: { id: 1 } }), 200);
    assert.strictEqual(call(perUser, { user: { id: 1 } }), 429);
    assert.strictEqual(call(perUser, { user: { id: 2 } }), 200);

    resetRateLimits();

    const missing = rateLimit([{ name: 'm', key: () => null, windowMs: 60000, max: 1 }]);
    assert.strictEqual(call(missing, {}), 200);
    assert.strictEqual(call(missing, {}), 200);

    resetRateLimits();

    const expiring = rateLimit([{ name: 'e', key: () => 'k', windowMs: -1, max: 1 }]);
    assert.strictEqual(call(expiring, {}), 200);
    assert.strictEqual(call(expiring, {}), 200);

    console.log('rateLimit self-check passed.');
}

module.exports = { rateLimit, resetRateLimits };
