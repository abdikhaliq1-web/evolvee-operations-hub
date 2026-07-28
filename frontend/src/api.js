// API base URL; empty means same origin.
const BASE = import.meta.env.VITE_API_BASE || '';

// localStorage keys for the saved session.
const TOKEN_KEY = 'opshub_token';
const USER_KEY = 'opshub_user';
const VIEW_AS_KEY = 'opshub_view_as';

export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function setSession(token, user) {
    localStorage.removeItem(VIEW_AS_KEY);
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

export function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(VIEW_AS_KEY);
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

export function getTokenExp() {
    const token = getToken();
    if (!token) return null;

    try {
        // Decode the JWT payload (base64url, no signature check needed client-side).
        const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const claims = JSON.parse(atob(payload));
        return typeof claims.exp === 'number' ? claims.exp : null;
    } catch {
        return null;
    }
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

// fetch wrapper: prefixes /api, adds JSON and auth headers, normalises errors.
export async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json' };

    if (options.headers) {
        Object.assign(headers, options.headers);
    }

    const token = getToken();
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE}/api${path}`, { ...options, headers });

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