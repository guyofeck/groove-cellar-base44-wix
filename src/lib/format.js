export const money = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n ?? 0);
