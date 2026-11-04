// Pure marketplace helpers (shared by UI and tests).

export const AREAS = [
  { name: "T. Nagar", lat: 13.0418, lng: 80.2341 },
  { name: "Adyar", lat: 13.0012, lng: 80.2565 },
  { name: "Mylapore", lat: 13.0339, lng: 80.2687 },
  { name: "Vadapalani", lat: 13.05, lng: 80.2121 },
  { name: "Velachery", lat: 12.9791, lng: 80.2209 },
  { name: "Teynampet", lat: 13.041, lng: 80.2496 },
  { name: "Anna Nagar", lat: 13.085, lng: 80.2101 },
] as const;

export function distanceKm(a: { lat: number; lng: number }, b: { lat?: number | null; lng?: number | null }) {
  if (b.lat == null || b.lng == null) return null;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export const discountPct = (price: number, mrp: number) =>
  mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;

export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

/** Mirrors the database place_order rules so the cart preview matches what is charged. */
export function shopTotals(
  subtotal: number,
  shop: { delivery_fee: number; free_delivery_above: number },
  fulfilment: "delivery" | "pickup",
  coupon?: string,
) {
  const delivery = fulfilment === "delivery" && subtotal < shop.free_delivery_above ? shop.delivery_fee : 0;
  const discount = coupon?.trim().toUpperCase() === "LOOP10" ? Math.min(Math.round(subtotal * 0.1), 100) : 0;
  return { subtotal, delivery, discount, total: subtotal + delivery - discount };
}

export const ORDER_STAGES = [
  { key: "placed", label: "Order placed" },
  { key: "accepted", label: "Shop accepted" },
  { key: "preparing", label: "Preparing order" },
  { key: "ready", label: "Ready / Out for delivery" },
  { key: "delivered", label: "Delivered" },
  { key: "completed", label: "Completed" },
] as const;

export function stageIndex(status: string) {
  if (status === "out_for_delivery") return 3;
  return ORDER_STAGES.findIndex((s) => s.key === status);
}

/** Simple moving-average forecast with a linear trend; returns next-N-day estimates. */
export function forecast(daily: number[], days = 7) {
  if (daily.length === 0) return Array(days).fill(0);
  const n = daily.length;
  const mean = daily.reduce((a, b) => a + b, 0) / n;
  const xm = (n - 1) / 2;
  let num = 0, den = 0;
  daily.forEach((y, x) => { num += (x - xm) * (y - mean); den += (x - xm) ** 2; });
  const slope = den ? num / den : 0;
  return Array.from({ length: days }, (_, i) => Math.max(0, mean + slope * (n - xm + i)));
}
