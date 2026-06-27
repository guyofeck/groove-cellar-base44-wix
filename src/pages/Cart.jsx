import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Disc3, Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { checkoutOnWix } from "@/lib/wix";
import { money } from "@/lib/format";

export default function Cart() {
  const { items, setQuantity, removeItem, total } = useCart();
  const { user, wix } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const canceled = searchParams.get("canceled");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const checkout = async () => {
    setError("");
    if (!user) {
      navigate("/login", { state: { returnTo: "/cart" } });
      return;
    }
    setWorking(true);
    try {
      // Builds a Wix eCom checkout server-side and redirects to the Wix-hosted checkout,
      // carrying the synced member session so the buyer stays logged in.
      await checkoutOnWix(items);
      // On success the browser navigates to Wix; nothing else to do here.
    } catch (e) {
      setError(e?.message || "Wix checkout failed.");
      setWorking(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-24 text-center">
        <ShoppingBag className="w-12 h-12 mx-auto text-neutral-700" />
        <h1 className="mt-6 text-2xl font-bold">Your crate is empty</h1>
        <p className="mt-2 text-neutral-400">Go find something worth spinning.</p>
        <Link
          to="/"
          className="mt-8 inline-flex px-6 h-12 items-center rounded-full bg-amber-400 text-neutral-950 font-semibold hover:bg-amber-300"
        >
          Browse records
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-5 py-10">
      <h1 className="text-3xl font-bold mb-8">Your cart</h1>

      {canceled && (
        <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Checkout canceled — your cart is still here.
        </div>
      )}
      {error && (
        <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.record_id}
            className="flex items-center gap-4 rounded-2xl bg-neutral-900 border border-neutral-800 p-3"
          >
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-neutral-800 shrink-0">
              {item.cover_image_url ? (
                <img src={item.cover_image_url} alt={item.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-neutral-600">
                  <Disc3 className="w-6 h-6" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{item.title}</p>
              <p className="text-sm text-neutral-400 truncate">{item.artist}</p>
              <p className="text-sm text-amber-400 mt-0.5">{money(item.price)}</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setQuantity(item.record_id, item.quantity - 1)}
                className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-8 text-center tabular-nums">{item.quantity}</span>
              <button
                onClick={() => setQuantity(item.record_id, item.quantity + 1)}
                className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => removeItem(item.record_id)}
              className="w-8 h-8 rounded-full hover:bg-neutral-800 flex items-center justify-center text-neutral-500 hover:text-red-400"
              aria-label="Remove"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl bg-neutral-900 border border-neutral-800 p-5">
        <div className="flex items-center justify-between text-lg">
          <span className="text-neutral-400">Total</span>
          <span className="font-bold">{money(total)}</span>
        </div>
        <button
          onClick={checkout}
          disabled={working}
          className="mt-5 w-full inline-flex items-center justify-center gap-2 h-12 rounded-full bg-amber-400 text-neutral-950 font-semibold hover:bg-amber-300 disabled:opacity-60 transition-colors"
        >
          {working ? <Disc3 className="w-5 h-5 animate-spin" /> : <ShoppingBag className="w-5 h-5" />}
          {working
            ? "Redirecting to Wix…"
            : user
              ? "Checkout on Wix"
              : "Sign in to checkout"}
        </button>
        <p className="mt-3 text-xs text-neutral-500 text-center">
          {user && wix?.state === "member"
            ? "You're signed in as a Wix member — your checkout will stay logged in."
            : "Secure Wix-hosted checkout. Prices shown in your store currency (EUR)."}
        </p>
      </div>
    </div>
  );
}
