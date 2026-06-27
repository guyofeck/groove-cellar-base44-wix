import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Disc3, Package } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";

const Order = base44.entities.Order;

const statusStyles = {
  paid: "text-emerald-400 bg-emerald-400/10",
  pending: "text-amber-400 bg-amber-400/10",
  cancelled: "text-neutral-400 bg-neutral-700/30",
};

export default function Account() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Order.list("-created_date")
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [user]);

  if (authLoading) {
    return (
      <div className="flex justify-center py-32">
        <Disc3 className="w-10 h-10 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ returnTo: "/account" }} replace />;
  }

  return (
    <div className="max-w-3xl mx-auto px-5 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">My account</h1>
          <p className="text-neutral-400 mt-1">{user.full_name || user.email}</p>
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Package className="w-5 h-5 text-amber-400" /> Order history
      </h2>

      {loading ? (
        <div className="flex justify-center py-16">
          <Disc3 className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-10 text-center text-neutral-400">
          <p>No orders yet.</p>
          <Link to="/" className="mt-4 inline-block text-amber-400 hover:underline">
            Find your first record →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="rounded-2xl bg-neutral-900 border border-neutral-800 p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold">Order #{order.id?.slice(-8)}</p>
                  <p className="text-xs text-neutral-500">
                    {order.created_date ? new Date(order.created_date).toLocaleDateString() : ""}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                    statusStyles[order.status] || statusStyles.pending
                  }`}
                >
                  {order.status}
                </span>
              </div>
              <div className="divide-y divide-neutral-800">
                {(order.items || []).map((it, idx) => (
                  <div key={idx} className="flex justify-between py-2 text-sm">
                    <span className="text-neutral-300">
                      {it.title} — {it.artist} <span className="text-neutral-500">×{it.quantity}</span>
                    </span>
                    <span>{money(it.price * it.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between pt-3 mt-1 border-t border-neutral-800 font-bold">
                <span>Total</span>
                <span className="text-amber-400">{money(order.total)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
