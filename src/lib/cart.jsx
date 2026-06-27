import { createContext, useContext, useEffect, useMemo, useState } from "react";

const CartContext = createContext(null);
const STORAGE_KEY = "groove-cellar-cart";

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = (record, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.record_id === record.id);
      if (existing) {
        return prev.map((i) =>
          i.record_id === record.id ? { ...i, quantity: i.quantity + quantity } : i,
        );
      }
      return [
        ...prev,
        {
          record_id: record.id,
          title: record.title,
          artist: record.artist,
          price: record.price,
          cover_image_url: record.cover_image_url,
          quantity,
        },
      ];
    });
  };

  const setQuantity = (recordId, quantity) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.record_id !== recordId)
        : prev.map((i) => (i.record_id === recordId ? { ...i, quantity } : i)),
    );
  };

  const removeItem = (recordId) =>
    setItems((prev) => prev.filter((i) => i.record_id !== recordId));

  const clear = () => setItems([]);

  const count = useMemo(() => items.reduce((n, i) => n + i.quantity, 0), [items]);
  const total = useMemo(
    () => Math.round(items.reduce((s, i) => s + i.price * i.quantity, 0) * 100) / 100,
    [items],
  );

  return (
    <CartContext.Provider
      value={{ items, addItem, setQuantity, removeItem, clear, count, total }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
