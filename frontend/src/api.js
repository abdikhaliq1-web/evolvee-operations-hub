// API base URL; empty means same origin.
const BASE = import.meta.env.VITE_API_BASE || '';

// The session token itself is NOT here. It lives in an httpOnly cookie the server sets,
// which this code cannot read — that is the point. Only display data and the expiry
// hint are stored locally, so an injected script has nothing worth stealing.
const USER_KEY = 'opshub_user';
const VIEW_AS_KEY = 'opshub_view_as';
const EXPIRES_KEY = 'opshub_expires_at';
const CSRF_COOKIE = 'opshub_csrf';

// Readable (non-httpOnly) companion to the session cookie, echoed back in a header so
// the server can tell a real request from a cross-site forgery.
function getCsrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)opshub_csrf=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
}

export function hasSession() {
    return Boolean(getUser() && getCsrfToken());
}

export function setSession(user, expiresAt) {
    localStorage.removeItem(VIEW_AS_KEY);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    if (expiresAt) localStorage.setItem(EXPIRES_KEY, String(expiresAt));
}

export function setExpiry(expiresAt) {
    if (expiresAt) localStorage.setItem(EXPIRES_KEY, String(expiresAt));
}

export function clearSession() {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(VIEW_AS_KEY);
    localStorage.removeItem(EXPIRES_KEY);
    // Best effort only: the session cookie is httpOnly and can only be cleared by the
    // server. The CSRF cookie is readable, so drop it to fail closed if logout 404s.
    document.cookie = CSRF_COOKIE + '=; Max-Age=0; path=/';
}

export function getViewAsRole() {
    return localStorage.getItem(VIEW_AS_KEY);
}

export function setViewAsRole(role) {
    if (role) localStorage.setItem(VIEW_AS_KEY, role);
    else localStorage.removeItem(VIEW_AS_KEY);
}

export function getEffectivePermissions() {
    const user = getUser();
    if (!user) return [];

    const real = user.permissions || [];
    const viewAs = getViewAsRole();
    const map = user.role_permissions;
    // Not previewing as another role, or role has no defined permission set.
    if (!viewAs || !map || !map[viewAs]) return real;

    // Intersect the previewed role's permissions with what the real user actually has.
    return map[viewAs].filter((p) => real.includes(p));
}

// Seeing a module and being able to change it are separate grants. This only decides
// which controls to render — the server enforces the same split on every request.
export function getEffectiveWritable() {
    const user = getUser();
    if (!user) return [];

    const real = user.writable || [];
    const viewAs = getViewAsRole();
    const map = user.role_writable;
    if (!viewAs || !map || !map[viewAs]) return real;

    return map[viewAs].filter((p) => real.includes(p));
}

export function canWrite(moduleKey) {
    return getEffectiveWritable().includes(moduleKey);
}

// The role actually in force, honouring a "view as" preview.
export function effectiveRole() {
    const user = getUser();
    if (!user) return null;

    return getViewAsRole() || user.role;
}

// Deleting an alert is narrower than alerts write access. The server decides which
// roles qualify and sends the list; this only hides the button.
export function canDeleteAlerts() {
    const user = getUser();
    const roles = user?.alert_delete_roles || [];

    return canWrite('alerts') && roles.includes(effectiveRole());
}

export function viewableRoles() {
    const user = getUser();
    const map = user?.role_permissions;
    if (!map) return [];

    const real = user.permissions || [];
    // Only offer roles that are a subset of what the user can already do.
    return Object.keys(map).filter(
        (role) => role !== user.role && map[role].every((p) => real.includes(p))
    );
}

// The token is no longer readable here, so the server reports its expiry instead.
export function getTokenExp() {
    const raw = localStorage.getItem(EXPIRES_KEY);
    const exp = raw ? Number(raw) : NaN;

    return Number.isFinite(exp) ? exp : null;
}

export function getUser() {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) {
        return null;
    }

    try {
        return JSON.parse(raw);
    } catch {
        // Stored value isn't valid JSON.
        return null;
    }
}

// fetch wrapper: prefixes /api, sends the session cookie, normalises errors.
export async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json' };

    if (options.headers) {
        Object.assign(headers, options.headers);
    }

    const csrf = getCsrfToken();
    if (csrf) {
        headers['X-CSRF-Token'] = csrf;
    }

    // credentials:'include' is what actually attaches the session cookie when the API
    // is on a different origin than the app.
    const response = await fetch(`${BASE}/api${path}`, {
        ...options,
        headers,
        credentials: 'include',
    });

    // Read the JSON body if there is one; not all responses have one (e.g. 204).
    let data = null;
    try {
        data = await response.json();
    } catch {
        data = null;
    }

    // Token rejected: sign out and go back to login.
    if (response.status === 401) {
        clearSession();
        window.location.href = '/login';
        throw new Error('Signed out');
    }

    // Any other failure: use the server's message if it sent one.
    if (!response.ok) {
        throw new Error(data?.error || `Request failed (${response.status})`);
    }

    if (data === null && response.status !== 204) {
        throw new Error('Server did not return JSON — check VITE_API_BASE points to the backend.');
    }

    return data;
}

// Ask the server to invalidate the token before dropping it locally. Clearing
// localStorage on its own leaves a copied token usable until it expires.
export async function signOut() {
    try {
        await api('/auth/logout', { method: 'POST' });
    } catch {
        // Already signed out, or the server is unreachable — clear locally regardless.
    }

    clearSession();
}