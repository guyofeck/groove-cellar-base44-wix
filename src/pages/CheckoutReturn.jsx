import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Disc3, CheckCircle2, XCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useCart } from "@/lib/cart";
import { money } from "@/lib/format";

export default function CheckoutReturn() {
  const [searchParams] = useSearchParams();
  const { clear } = useCart();
  const [state, setState] = useState("loading"); // loading | success | error
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const ran = useRef(false);

  const orderId = searchParams.get("order");
  const sessionId = searchParams.get("session_id");
  const simulated = searchParams.get("simulated");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (!orderId) {
      setState("error");
      setError("Missing order reference.");
      return;
    }

    base44.functions
      .invoke("confirm-order", {
        order_id: orderId,
        session_id: sessionId || undefined,
        simulated: !!simulated,
      })
      .then((result) => {
        if (result?.order) {
          setOrder(result.order);
          setState("success");
          clear();
        } else {
          setError(result?.error || "We couldn't confirm your payment.");
          setState("error");
        }
      })
      .catch((e) => {
        setError(e?.message || "We couldn't confirm your payment.");
        setState("error");
      });
  }, [orderId, sessionId, simulated, clear]);

  if (state === "loading") {
    return (
      <div className="max-w-xl mx-auto px-5 py-32 text-center">
        <Disc3 className="w-12 h-12 mx-auto text-amber-400 animate-spin" />
        <p className="mt-6 text-neutral-400">Confirming your order…</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="max-w-xl mx-auto px-5 py-24 text-center">
        <XCircle className="w-14 h-14 mx-auto text-red-400" />
        <h1 className="mt-6 text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-neutral-400">{error}</p>
        <div className="mt-8 flex gap-3 justify-center">
          <Link to="/cart" className="px-5 h-11 inline-flex items-center rounded-full bg-neutral-800 hover:bg-neutral-700">
            Back to cart
          </Link>
          <Link to="/" className="px-5 h-11 inline-flex items-center rounded-full bg-amber-400 text-neutral-950 font-semibold hover:bg-amber-300">
            Keep shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-5 py-20 text-center">
      <CheckCircle2 className="w-16 h-16 mx-auto text-amber-400" />
      <h1 className="mt-6 text-3xl font-bold">Order confirmed!</h1>
      <p className="mt-2 text-neutral-400">
        Thanks for supporting independent vinyl. A copy of your receipt is on its way.
      </p>

      {order && (
        <div className="mt-8 text-left rounded-2xl bg-neutral-900 border border-neutral-800 p-5">
          <div className="flex justify-between text-sm text-neutral-400 mb-3">
            <span>Order #{order.id?.slice(-8)}</span>
            <span className="text-amber-400 capitalize">{order.status}</span>
          </div>
          {(order.items || []).map((it, idx) => (
            <div key={idx} className="flex justify-between py-1.5 border-t border-neutral-800 text-sm">
              <span className="text-neutral-300">
                {it.title} <span className="text-neutral-500">×{it.quantity}</span>
              </span>
              <span>{money(it.price * it.quantity)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-3 mt-1 border-t border-neutral-800 font-bold">
            <span>Total</span>
            <span>{money(order.total)}</span>
          </div>
        </div>
      )}

      <div className="mt-8 flex gap-3 justify-center">
        <Link to="/account" className="px-5 h-11 inline-flex items-center rounded-full bg-neutral-800 hover:bg-neutral-700">
          View my orders
        </Link>
        <Link to="/" className="px-5 h-11 inline-flex items-center rounded-full bg-amber-400 text-neutral-950 font-semibold hover:bg-amber-300">
          Keep shopping
        </Link>
      </div>
    </div>
  );
}
