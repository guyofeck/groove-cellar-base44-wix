import { Link, NavLink, Outlet } from "react-router-dom";
import { ShoppingBag, Disc3, User, LogOut, BadgeCheck, Loader2 } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";

function WixBadge({ wix }) {
  if (!wix || wix.state === "idle") return null;
  const map = {
    syncing: { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, text: "Syncing Wix", cls: "text-neutral-400 border-neutral-700" },
    member: { icon: <BadgeCheck className="w-3.5 h-3.5" />, text: "Wix member", cls: "text-emerald-400 border-emerald-500/40" },
    synced: { icon: <BadgeCheck className="w-3.5 h-3.5" />, text: "Wix synced", cls: "text-amber-400 border-amber-500/40" },
    error: { icon: null, text: "Wix sync failed", cls: "text-red-400 border-red-500/40" },
  };
  const s = map[wix.state] || map.syncing;
  return (
    <span
      title={wix.state === "synced" ? "Identity synced. Add 'Manage Members Authentication' to enable sticky login." : wix.error || ""}
      className={`hidden md:inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full border text-xs ${s.cls}`}
    >
      {s.icon}
      {s.text}
    </span>
  );
}

export default function Layout() {
  const { count } = useCart();
  const { user, logout, wix } = useAuth();

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="sticky top-0 z-30 border-b border-violet-500/20 bg-neutral-950/90 backdrop-blur-md shadow-[0_1px_20px_-4px_rgba(124,92,255,0.35)]">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 group">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-violet-500/20 to-amber-400/10 ring-1 ring-violet-400/30">
              <Disc3 className="w-5 h-5 text-amber-400 group-hover:rotate-180 transition-transform duration-700" />
            </span>
            <span className="font-bold text-lg tracking-tight uppercase">
              Groove <span className="text-violet-400">Cellar</span>
            </span>
          </Link>

          <nav className="hidden sm:flex items-center gap-6 text-sm font-medium uppercase tracking-wide text-neutral-400">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `relative pb-1 transition-colors ${isActive ? "text-white after:absolute after:left-0 after:right-0 after:-bottom-[1px] after:h-[2px] after:bg-violet-400" : "hover:text-white"}`
              }
              end
            >
              Shop
            </NavLink>
            {user && (
              <NavLink
                to="/account"
                className={({ isActive }) =>
                  `relative pb-1 transition-colors ${isActive ? "text-white after:absolute after:left-0 after:right-0 after:-bottom-[1px] after:h-[2px] after:bg-violet-400" : "hover:text-white"}`
                }
              >
                My Orders
              </NavLink>
            )}
          </nav>

          <div className="flex items-center gap-2">
            {user && <WixBadge wix={wix} />}
            <Link
              to="/cart"
              className="relative inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-neutral-800 transition-colors"
              aria-label="Cart"
            >
              <ShoppingBag className="w-5 h-5" />
              {count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-amber-400 text-neutral-950 text-xs font-bold flex items-center justify-center">
                  {count}
                </span>
              )}
            </Link>

            {user ? (
              <div className="flex items-center gap-1">
                <Link
                  to="/account"
                  className="hidden sm:inline-flex items-center gap-2 px-3 h-10 rounded-full hover:bg-neutral-800 text-sm"
                >
                  <User className="w-4 h-4" />
                  <span className="max-w-[140px] truncate">{user.full_name || user.email}</span>
                </Link>
                <button
                  onClick={logout}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-neutral-800"
                  aria-label="Log out"
                  title="Log out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-4 h-10 rounded-full bg-violet-500 text-white text-sm font-semibold hover:bg-violet-400 transition-colors"
              >
                <User className="w-4 h-4" />
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-neutral-800 py-8 mt-16">
        <div className="max-w-6xl mx-auto px-5 text-sm text-neutral-500 flex items-center gap-2">
          <Disc3 className="w-4 h-4" />
          Groove Cellar — independent vinyl since 2026. Built on Base44.
        </div>
      </footer>
    </div>
  );
}
