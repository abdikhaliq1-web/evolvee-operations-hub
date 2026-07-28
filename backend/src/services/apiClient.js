// Centralised external API handler.
// All live API calls from every integration service go through callExternal()
// so timeouts, error shaping, and sync-status recording live in one place.

const { query } = require('../config/db');

function getHost(url) {
    const parsed = new URL(url);
    return parsed.host;
}

// Retry-After is either a number of seconds or an HTTP-date. Number() alone turns
// the date form into NaN and the server's wait hint is silently lost.
function parseRetryAfter(header) {
    if (!header) return 0;
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const dateMs = Date.parse(header);
    if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
    return 0;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function attempt(url, options, config, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const requestOptions = Object.assign({}, options, { signal: controller.signal });
        const response = await fetch(url, requestOptions);

        if (!response.ok) {
            let body = '';
            try {
                body = await response.text();
            } catch (readError) {
                body = '';
            }

            const host = getHost(url);
            const err = new Error(`HTTP ${response.status} from ${host}: ${body.slice(0, 200)}`);
            err.status = response.status;
            err.retryAfterMs = parseRetryAfter(response.headers.get('retry-after'));
            throw err;
        }

        // 204/empty body has nothing to parse.
        if (response.status === 204) {
            return config.includeHeaders ? { data: null, headers: response.headers } : null;
        }

        let json;
        try {
            json = await response.json();
        } catch (parseError) {
            // A malformed/empty 2xx body is a deterministic contract error, not a
            // transient network fault — flag it so shouldRetry() won't retry it.
            const err = new Error(`Invalid JSON from ${getHost(url)}: ${parseError.message}`);
            err.parse = true;
            throw err;
        }
        return config.includeHeaders ? { data: json, headers: response.headers } : json;
    } catch (error) {
        if (error.name === 'AbortError') {
            const seconds = timeoutMs / 1000;
            const timeoutErr = new Error(`Request to ${getHost(url)} timed out after ${seconds}s`);
            timeoutErr.timeout = true;
            throw timeoutErr;
        }
        if (error.status == null && !error.parse) {
            error.network = true;
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_BACKOFF_MS = 8000;

function shouldRetry(error, retryableMethod, attemptsLeft) {
    if (attemptsLeft <= 0) return false;
    if (!retryableMethod) return false;

    if (error.status != null) return RETRYABLE_STATUS.has(error.status);

    return error.timeout === true || error.network === true;
}

function backoffMs(attemptNo, retryAfterMs, baseMs) {
    if (retryAfterMs > 0) return Math.min(retryAfterMs, MAX_BACKOFF_MS);
    const capped = Math.min(baseMs * 2 ** attemptNo, MAX_BACKOFF_MS);
    return Math.round(capped / 2 + Math.random() * (capped / 2));
}

async function callExternal(url, options = {}, config = {}) {
    const timeoutMs = config.timeoutMs ?? 15000;
    const maxRetries = config.retries ?? 3;
    const baseMs = config.retryBaseMs ?? 500;
    const method = (options.method || 'GET').toUpperCase();
    // GET/HEAD retry by default; a read-only POST (e.g. a GraphQL query) can opt in
    // with config.idempotent so transient 429/5xx get the same backoff.
    const retryableMethod = method === 'GET' || method === 'HEAD' || config.idempotent === true;

    for (let attemptNo = 0; ; attemptNo++) {
        try {
            return await attempt(url, options, config, timeoutMs);
        } catch (error) {
            if (!shouldRetry(error, retryableMethod, maxRetries - attemptNo)) throw error;
            await wait(backoffMs(attemptNo, error.retryAfterMs || 0, baseMs));
        }
    }
}

// Record the result of a sync attempt so the frontend can surface failures
// instead of silently showing stale data.
async function recordSync(source, mode, ok, message = null) {
    const sql = `
        INSERT INTO sync_status (source, mode, last_run_at, last_success, ok, message)
        VALUES ($1, $2, NOW(), CASE WHEN $3 THEN NOW() ELSE NULL END, $3, $4)
        ON CONFLICT (source) DO UPDATE SET
            mode         = EXCLUDED.mode,
            last_run_at  = NOW(),
            last_success = CASE WHEN $3 THEN NOW() ELSE sync_status.last_success END,
            ok           = $3,
            message      = $4
    `;

    try {
        await query(sql, [source, mode, ok, message]);
    } catch (error) {
        console.error('Failed to record sync status:', error.message);
    }
}

const CACHE_TTL_MS = Number(process.env.INTEGRATION_CACHE_TTL_MS || 60000);
const cacheStore = new Map();

function cached(key, fn) {
    const hit = cacheStore.get(key);

    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
        return hit.value;
    }

    const value = Promise.resolve().then(fn);
    cacheStore.set(key, { at: Date.now(), value });
    value.catch(() => cacheStore.delete(key));

    return value;
}

function cacheAll(source, fns) {
    const out = {};
    for (const name of Object.keys(fns)) {
        out[name] = () => cached(source + ':' + name, fns[name]);
    }
    return out;
}

async function withSync(source, mode, run, offValue = []) {
    if (mode === 'off') {
        await recordSync(source, 'off', true);
        return offValue;
    }

    try {
        const data = await run();
        await recordSync(source, mode, true);
        return data;
    } catch (error) {
        await recordSync(source, mode, false, error.message);
        // Never let an upstream status (Shopify 401/429, Zoho 5xx) become our own
        // response status — a leaked 401 would trip the frontend logout interceptor.
        // Retry logic already ran inside callExternal (reads the real error.status);
        // this runs after, so overriding here is safe. Message kept for server logs.
        error.status = 502;
        throw error;
    }
}

if (require.main === module) {
    const assert = require('assert');
    (async () => {
        let calls = 0;
        const slow = () => new Promise((r) => setTimeout(() => r(++calls), 10));
        const [a, b] = await Promise.all([cached('k', slow), cached('k', slow)]);
        assert.strictEqual(a, 1);
        assert.strictEqual(b, 1);
        assert.strictEqual(calls, 1);

        let boom = 0;
        await cached('e', () => Promise.reject(new Error('x'))).catch(() => {});
        await cached('e', () => Promise.resolve(++boom));
        assert.strictEqual(boom, 1);

        // Retry policy: transient statuses on a retryable method only.
        assert.strictEqual(shouldRetry({ status: 429 }, true, 3), true);
        assert.strictEqual(shouldRetry({ status: 503 }, true, 3), true);
        assert.strictEqual(shouldRetry({ status: 404 }, true, 3), false);
        assert.strictEqual(shouldRetry({ status: 429 }, false, 3), false);   // non-idempotent POST
        assert.strictEqual(shouldRetry({ timeout: true }, true, 3), true);
        assert.strictEqual(shouldRetry({ network: true }, true, 3), true);
        assert.strictEqual(shouldRetry({ parse: true }, true, 3), false);    // parse error never retried
        assert.strictEqual(shouldRetry({ timeout: true }, true, 0), false);
        // Retry-After: seconds and HTTP-date both yield a non-negative ms hint.
        assert.strictEqual(parseRetryAfter('120'), 120000);
        assert.strictEqual(parseRetryAfter(null), 0);
        assert.ok(parseRetryAfter('Wed, 21 Oct 2099 07:28:00 GMT') > 0);
        assert.strictEqual(parseRetryAfter('not-a-date'), 0);
        const b0 = backoffMs(0, 0, 500);
        assert.ok(b0 >= 250 && b0 <= 500, `backoff ${b0} out of range`);
        assert.strictEqual(backoffMs(5, 3000, 500), 3000);
        assert.strictEqual(backoffMs(0, 100000, 500), 8000);
        assert.ok(backoffMs(20, 0, 500) <= 8000);
        const up = Object.assign(new Error('HTTP 401 from shopify'), { status: 401 });
        const caught = await withSync('shopify', 'live', () => Promise.reject(up)).catch((e) => e);
        assert.strictEqual(caught.status, 502);
        assert.strictEqual(caught.message, 'HTTP 401 from shopify');
        console.log('apiClient cache + retry self-check passed.');
    })();
}

module.exports = { callExternal, withSync, cached, cacheAll };