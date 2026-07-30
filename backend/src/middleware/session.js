const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const TOKEN_COOKIE = 'opshub_token';
const CSRF_COOKIE = 'opshub_csrf';
const CSRF_HEADER = 'x-csrf-token';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function parseCookies(header) {
    const out = {};

    if (!header) {
        return out;
    }

    for (const part of String(header).split(';')) {
        const eq = part.indexOf('=');
        if (eq < 1) continue;

        const name = part.slice(0, eq).trim();
        const value = part.slice(eq + 1).trim();

        if (name && !(name in out)) {
            out[name] = decodeURIComponent(value);
        }
    }

    return out;
}

function readCookie(req, name) {
    if (!req.parsedCookies) {
        req.parsedCookies = parseCookies(req.headers ? req.headers.cookie : '');
    }
    return req.parsedCookies[name];
}

// Netlify and Render are different sites, so the session cookie has to be
// SameSite=None in production — which requires Secure, and means CSRF protection is
// mandatory rather than optional. Locally the Vite proxy makes it same-origin.
function cookieOptions(maxAgeMs, httpOnly) {
    const crossSite = env.crossSiteCookies;

    return {
        httpOnly: httpOnly,
        secure: crossSite || env.isProduction,
        sameSite: crossSite ? 'none' : 'lax',
        maxAge: maxAgeMs,
        path: '/',
    };
}

function tokenLifetimeMs(token) {
    const decoded = jwt.decode(token);
    const expMs = decoded && decoded.exp ? decoded.exp * 1000 : 0;
    const remaining = expMs - Date.now();

    return remaining > 0 ? remaining : 0;
}

// Issues the session as an httpOnly cookie the page's JavaScript cannot read, plus a
// readable CSRF token the client echoes back in a header (double-submit).
function issueSession(res, token) {
    const maxAge = tokenLifetimeMs(token);
    const csrf = crypto.randomBytes(32).toString('base64url');

    res.cookie(TOKEN_COOKIE, token, cookieOptions(maxAge, true));
    res.cookie(CSRF_COOKIE, csrf, cookieOptions(maxAge, false));

    return { csrf: csrf, expiresAt: Math.floor((Date.now() + maxAge) / 1000) };
}

function clearSession(res) {
    res.clearCookie(TOKEN_COOKIE, cookieOptions(0, true));
    res.clearCookie(CSRF_COOKIE, cookieOptions(0, false));
}

function sessionToken(req) {
    const cookie = readCookie(req, TOKEN_COOKIE);

    if (cookie) {
        return { token: cookie, via: 'cookie' };
    }

    const header = req.headers.authorization || '';

    if (header.startsWith('Bearer ')) {
        return { token: header.slice(7), via: 'bearer' };
    }

    return { token: null, via: null };
}

function timingSafeEqual(a, b) {
    const left = Buffer.from(String(a));
    const right = Buffer.from(String(b));

    if (left.length !== right.length) {
        return false;
    }

    return crypto.timingSafeEqual(left, right);
}

// Only cookie-authenticated writes need this. A Bearer token is never attached by the
// browser automatically, so a cross-site form or image can't forge one.
function csrfOk(req) {
    if (req.authVia !== 'cookie' || SAFE_METHODS.has(req.method)) {
        return true;
    }

    const cookie = readCookie(req, CSRF_COOKIE);
    const header = req.headers[CSRF_HEADER];

    if (!cookie || !header) {
        return false;
    }

    return timingSafeEqual(cookie, header);
}

if (require.main === module) {
    const assert = require('assert');

    assert.deepStrictEqual(parseCookies('a=1; b=two'), { a: '1', b: 'two' });
    assert.deepStrictEqual(parseCookies(''), {});
    assert.deepStrictEqual(parseCookies(undefined), {});
    assert.deepStrictEqual(parseCookies('a=1; a=2').a, '1');
    assert.deepStrictEqual(parseCookies('weird; b=2'), { b: '2' });
    assert.deepStrictEqual(parseCookies('v=a%20b').v, 'a b');
    assert.deepStrictEqual(parseCookies('jwt=x.y.z=='), { jwt: 'x.y.z==' });

    const cookieReq = (cookie, extra) => Object.assign({ headers: { cookie: cookie } }, extra);

    assert.strictEqual(sessionToken(cookieReq('opshub_token=abc')).via, 'cookie');
    assert.strictEqual(sessionToken(cookieReq('opshub_token=abc')).token, 'abc');
    assert.strictEqual(sessionToken({ headers: { authorization: 'Bearer xyz' } }).via, 'bearer');
    assert.strictEqual(sessionToken({ headers: {} }).token, null);
    assert.strictEqual(
        sessionToken(cookieReq('opshub_token=fromcookie', { headers: { cookie: 'opshub_token=fromcookie', authorization: 'Bearer xyz' } })).token,
        'fromcookie',
        'cookie wins over a Bearer header'
    );

    const post = (cookie, header, via) => {
        const req = { method: 'POST', authVia: via, headers: { cookie: cookie } };
        if (header) req.headers[CSRF_HEADER] = header;
        return csrfOk(req);
    };

    assert.strictEqual(post('opshub_csrf=tok', 'tok', 'cookie'), true);
    assert.strictEqual(post('opshub_csrf=tok', 'different', 'cookie'), false, 'mismatched token must fail');
    assert.strictEqual(post('opshub_csrf=tok', null, 'cookie'), false, 'missing header must fail');
    assert.strictEqual(post('', 'tok', 'cookie'), false, 'missing cookie must fail');
    assert.strictEqual(post('opshub_csrf=tok', 'tokk', 'cookie'), false, 'length mismatch must fail');
    assert.strictEqual(post('', null, 'bearer'), true, 'bearer auth is exempt');
    assert.strictEqual(
        csrfOk({ method: 'GET', authVia: 'cookie', headers: {} }),
        true,
        'safe methods are exempt'
    );

    console.log('session self-check passed.');
}

module.exports = {
    issueSession,
    clearSession,
    sessionToken,
    csrfOk,
    parseCookies,
    TOKEN_COOKIE,
    CSRF_COOKIE,
    CSRF_HEADER,
};
