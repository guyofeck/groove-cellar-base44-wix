import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Disc3, ArrowLeft, ShoppingBag, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useCart } from "@/lib/cart";
import { money } from "@/lib/format";

const Record = base44.entities.Record;

export default function RecordDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    Record.get(id)
      .then(setRecord)
      .catch(() => setRecord(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <Disc3 className="w-10 h-10 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="max-w-6xl mx-auto px-5 py-24 text-center text-neutral-400">
        <p>This record isn't in our crate.</p>
        <Link to="/" className="text-amber-400 hover:underline mt-4 inline-block">
          Back to shop
        </Link>
      </div>
    );
  }

  const soldOut = (record.stock ?? 0) <= 0;

  return (
    <div className="max-w-6xl mx-auto px-5 py-10">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white mb-8"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="grid md:grid-cols-2 gap-10">
        <div className="aspect-square rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800">
          {record.cover_image_url ? (
            <img src={record.cover_image_url} alt={record.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-700">
              <Disc3 className="w-24 h-24" />
            </div>
          )}
        </div>

        <div>
          {record.genre && (
            <span className="inline-block px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-amber-300 text-xs">
              {record.genre}
              {record.year ? ` · ${record.year}` : ""}
            </span>
          )}
          <h1 className="mt-4 text-3xl font-bold tracking-tight">{record.title}</h1>
          <p className="text-lg text-neutral-400 mt-1">{record.artist}</p>

          <div className="mt-6 text-3xl font-bold text-amber-400">{money(record.price)}</div>
          <p className="mt-2 text-sm text-neutral-500">
            {soldOut ? "Currently sold out" : `${record.stock} in stock`}
          </p>

          {record.description && (
            <p className="mt-6 text-neutral-300 leading-relaxed">{record.description}</p>
          )}

          <button
            disabled={soldOut}
            onClick={() => {
              addItem(record);
              setAdded(true);
              setTimeout(() => setAdded(false), 1400);
            }}
            className="mt-8 inline-flex items-center gap-2 px-6 h-12 rounded-full bg-amber-400 text-neutral-950 font-semibold hover:bg-amber-300 disabled:opacity-40 transition-colors"
          >
            {added ? <Check className="w-5 h-5" /> : <ShoppingBag className="w-5 h-5" />}
            {soldOut ? "Sold out" : added ? "Added to cart" : "Add to cart"}
          </button>
        </div>
      </div>
    </div>
  );
}
