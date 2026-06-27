import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Disc3, Check, Plus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useCart } from "@/lib/cart";
import { money } from "@/lib/format";

const Record = base44.entities.Record;

function RecordCard({ record }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const soldOut = (record.stock ?? 0) <= 0;

  const handleAdd = (e) => {
    e.preventDefault();
    addItem(record);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <Link
      to={`/records/${record.id}`}
      className="group rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-all"
    >
      <div className="aspect-square bg-neutral-800 overflow-hidden relative">
        {record.cover_image_url ? (
          <img
            src={record.cover_image_url}
            alt={`${record.title} cover`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-600">
            <Disc3 className="w-16 h-16" />
          </div>
        )}
        {soldOut && (
          <span className="absolute top-3 left-3 px-2 py-1 rounded-full bg-neutral-950/80 text-xs font-semibold text-neutral-300">
            Sold out
          </span>
        )}
        {record.genre && (
          <span className="absolute top-3 right-3 px-2 py-1 rounded-full bg-neutral-950/70 text-xs text-amber-300">
            {record.genre}
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold leading-tight truncate">{record.title}</h3>
        <p className="text-sm text-neutral-400 truncate">{record.artist}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="font-bold text-amber-400">{money(record.price)}</span>
          <button
            onClick={handleAdd}
            disabled={soldOut}
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-full bg-neutral-800 text-sm font-medium hover:bg-amber-400 hover:text-neutral-950 disabled:opacity-40 disabled:hover:bg-neutral-800 disabled:hover:text-neutral-100 transition-colors"
          >
            {added ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {added ? "Added" : "Add"}
          </button>
        </div>
      </div>
    </Link>
  );
}

export default function Shop() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [genre, setGenre] = useState("All");

  useEffect(() => {
    Record.list("-featured")
      .then(setRecords)
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, []);

  const genres = useMemo(
    () => ["All", ...Array.from(new Set(records.map((r) => r.genre).filter(Boolean)))],
    [records],
  );
  const visible = genre === "All" ? records : records.filter((r) => r.genre === genre);

  return (
    <div>
      {/* Hero */}
      <section className="border-b border-neutral-800 bg-gradient-to-b from-neutral-900 to-neutral-950">
        <div className="max-w-6xl mx-auto px-5 py-16 sm:py-24">
          <p className="text-amber-400 font-medium tracking-wide uppercase text-sm">Now spinning</p>
          <h1 className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight max-w-2xl">
            Hand-picked vinyl for people who still drop the needle.
          </h1>
          <p className="mt-4 text-neutral-400 max-w-xl">
            Rare pressings, reissues, and crate-digging finds — shipped straight to your turntable.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 py-10">
        {/* Genre filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          {genres.map((g) => (
            <button
              key={g}
              onClick={() => setGenre(g)}
              className={`px-4 h-9 rounded-full text-sm font-medium transition-colors ${
                genre === g
                  ? "bg-amber-400 text-neutral-950"
                  : "bg-neutral-900 border border-neutral-800 text-neutral-300 hover:border-neutral-700"
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <Disc3 className="w-10 h-10 text-amber-400 animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-24 text-neutral-500">
            No records in the crate yet. Check back soon.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {visible.map((r) => (
              <RecordCard key={r.id} record={r} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
