import { Link, NavLink, Outlet } from "react-router";

import { useAuth } from "../auth/AuthContext";
import { RouteGlyph } from "./RouteGlyph";
import { ui } from "./ui";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/applications", label: "Applications", end: false },
  { to: "/resumes", label: "Resumes", end: false },
];

export function Layout() {
  const { username, logout } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="border-b border-rule bg-panel">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3">
          <span className="flex items-center gap-2.5 text-chalk">
            <RouteGlyph />
            <span className="font-display text-lg font-bold uppercase tracking-[0.14em]">Job Tracker</span>
          </span>
          <nav className="flex gap-6 self-stretch">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `relative flex items-center pt-1 pb-1 font-display text-sm font-semibold uppercase tracking-[0.12em] ${
                    isActive ? "text-chalk" : "text-fog hover:text-chalk"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {item.label}
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 right-0 bottom-0 h-[3px] bg-signal lg:-bottom-[13px]"
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <Link to="/applications/new" className={ui.primary}>
              + New application
            </Link>
            <span className={`${ui.muted} font-mono`}>{username}</span>
            <button type="button" className={ui.secondary} onClick={() => void logout()}>
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
