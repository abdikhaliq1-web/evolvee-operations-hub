import React from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate, Outlet } from 'react-router-dom';
import {
    getUser,
    getToken,
    clearSession,
    getEffectivePermissions,
    getViewAsRole,
    setViewAsRole,
    viewableRoles,
    getTokenExp,
} from './api.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Manufacturers from './pages/Manufacturers.jsx';
import ManufacturerDetail from './pages/ManufacturerDetail.jsx';
import Products from './pages/Products.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import Alerts from './pages/Alerts.jsx';
import ProductionRuns from './pages/ProductionRuns.jsx';
import Users from './pages/Users.jsx';
import Account from './pages/Account.jsx';

// Button that switches between light and dark mode.
function ThemeToggle() {
    const [dark, setDark] = React.useState(
        () => document.documentElement.dataset.theme === 'dark'
    );
    const toggle = () => {
        const next = dark ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        localStorage.setItem('theme', next);
        setDark(!dark);
    };
    return (
        <button className="link" onClick={toggle} aria-pressed={dark} title="Toggle dark mode">
            {dark ? '☀ Light' : '☾ Dark'}
        </button>
    );
}

// Dropdown letting a user preview the app as a lower-permission role.
function ViewAsControl() {
    const user = getUser();
    const roles = viewableRoles();
    if (roles.length === 0) return null;

    const current = getViewAsRole() || user.role;
    const change = (e) => {
        const value = e.target.value;
        setViewAsRole(value === user.role ? null : value);
        window.location.reload();
    };

    return (
        <label className="view-as" title="Preview the app as another role (view only)">
            View as{' '}
            <select value={current} onChange={change}>
                <option value={user.role}>{user.role.replace('_', ' ')} (you)</option>
                {roles.map((r) => (
                    <option key={r} value={r}>{r.replace('_', ' ')}</option>
                ))}
            </select>
        </label>
    );
}

// Warning banner shown while previewing as another role.
function ImpersonationBanner() {
    const viewAs = getViewAsRole();
    if (!viewAs) return null;

    const exit = () => {
        setViewAsRole(null);
        window.location.reload();
    };

    return (
        <div className="banner warn">
            Viewing as <strong>{viewAs.replace('_', ' ')}</strong> — this only changes what
            you see, not what you can do.{' '}
            <button className="link" onClick={exit}>Exit preview</button>
        </div>
    );
}

// Watches token expiry and warns/logs out the user before it expires.
function SessionWatcher() {
    const navigate = useNavigate();
    const [warn, setWarn] = React.useState(false);
    const token = getToken();

    React.useEffect(() => {
        const exp = getTokenExp();
        if (!exp) return;
        setWarn(false);

        const msLeft = exp * 1000 - Date.now();
        // setTimeout delay is a 32-bit int; skip scheduling if it would overflow.
        if (msLeft <= 0 || msLeft > 2147483647) return;

        const warnLead = 2 * 60 * 1000;
        const warnTimer = setTimeout(() => setWarn(true), Math.max(0, msLeft - warnLead));
        const outTimer = setTimeout(() => {
            clearSession();
            navigate('/login');
        }, msLeft);

        return () => {
            clearTimeout(warnTimer);
            clearTimeout(outTimer);
        };
    }, [navigate, token]);

    if (!warn) return null;

    return (
        <div className="banner warn">
            Your session is about to expire. Save your work and sign in again to continue.
        </div>
    );
}

// App frame: top nav plus the active route.
function Shell() {
    const user = getUser();
    const navigate = useNavigate();
    const perms = React.useMemo(() => getEffectivePermissions(), []);
    const can = (p) => perms.includes(p);

    // No token means not signed in.
    if (!getToken()) {
        return <Navigate to="/login" replace />;
    }

    return (
        <>
            <header className="topbar">
                <div className="topbar-inner">
                    <div className="wordmark">
                        Evolvée Radiance
                        <small>Operations Hub</small>
                    </div>
                    <nav className="main" aria-label="Main">
                        <NavLink to="/" end>
                            Dashboard
                        </NavLink>
                        {can('manufacturers') && (
                            <NavLink to="/manufacturers">
                                Manufacturers
                            </NavLink>
                        )}
                        {can('manufacturers') && (
                            <NavLink to="/products">
                                Products &amp; thresholds
                            </NavLink>
                        )}
                        {can('alerts') && (
                            <NavLink to="/alerts">
                                Reorder alerts
                            </NavLink>
                        )}
                        {can('manufacturers') && (
                            <NavLink to="/production">
                                Production runs
                            </NavLink>
                        )}
                        {can('users') && (
                            <NavLink to="/users">
                                Team access
                            </NavLink>
                        )}
                    </nav>
                    <div className="userbox">
                        <span>
                            {user?.name} · {user?.role?.replace('_', ' ')}
                        </span>
                        <ViewAsControl />
                        <NavLink to="/account">Account</NavLink>
                        <ThemeToggle />
                        <button
                            onClick={() => {
                                clearSession();
                                navigate('/login');
                            }}
                        >
                            Sign out
                        </button>
                    </div>
                </div>
            </header>
            <main className="page">
                <ImpersonationBanner />
                <SessionWatcher />
                <Outlet />
            </main>
        </>
    );
}

// Top-level route table.
export default function App() {
    return (
        <Routes>
            {/* Login is public; everything in Shell needs a token. */}
            <Route path="/login" element={<Login />} />
            <Route element={<Shell />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/manufacturers" element={<Manufacturers />} />
                <Route path="/manufacturers/:id" element={<ManufacturerDetail />} />
                <Route path="/products" element={<Products />} />
                <Route path="/products/:id" element={<ProductDetail />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/production" element={<ProductionRuns />} />
                <Route path="/users" element={<Users />} />
                <Route path="/account" element={<Account />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
