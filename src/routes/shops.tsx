import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Sparkles, Star } from "lucide-react";
import { shopsQuery, productsQuery } from "@/lib/queries";
import { useStore } from "@/lib/store";
import { distanceKm } from "@/lib/market";
import { CategoryIcon } from "@/components/CategoryIcon";
import { ShopsMap, directionsUrl } from "@/components/ShopsMap";

export const Route = createFileRoute("/shops")({
  head: () => ({
    meta: [
      { title: "Nearby shops — LocalLoop" },
      { name: "description", content: "Verified local stores near you, ranked by distance, rating and delivery." },
      { property: "og:title", content: "Nearby shops — LocalLoop" },
      { property: "og:description", content: "Verified local stores ranked for you, with reasons." },
    ],
  }),
  component: Shops,
});

function Shops() {
  const { location } = useStore();
  const { data: shops = [] } = useQuery(shopsQuery);
  const { data: products = [] } = useQuery(productsQuery);

  const ranked = shops
    .map((s) => {
      const d = distanceKm(location, s) ?? 20;
      const inStock = products.filter((p) => p.shop_id === s.id && p.stock > 0).length;
      const score = Number(s.rating) * 2 - d * 0.6 + Math.min(inStock, 10) * 0.2 + (s.delivery_fee === 0 ? 0.5 : 0);
      const reasons = [
        d < 3 && `${d.toFixed(1)} km away`,
        Number(s.rating) >= 4.6 && `rated ${Number(s.rating).toFixed(1)}`,
        inStock > 0 && `${inStock} items in stock`,
        s.delivery_fee === 0 && "free delivery",
        s.offers_pickup && "store pickup",
      ].filter(Boolean) as string[];
      return { ...s, d, score, reasons };
    })
    .sort((a, b) => b.score - a.score);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="text-3xl font-extrabold">Shops near {location.name}</h1>
      <p className="text-muted-foreground">Ranked by distance, rating, stock and delivery cost — with the reasons shown.</p>
      <ShopsMap shops={ranked} center={location} className="mt-6 h-72 sm:h-96" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ranked.map((s, i) => (
          <Link key={s.id} to="/shops/$id" params={{ id: s.id }} className="rounded-2xl border bg-card p-5 shadow-soft transition hover:shadow-lift">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"><CategoryIcon name={s.category?.icon} className="h-6 w-6" /></span>
              <div>
                <div className="font-display text-lg font-bold">{s.name}</div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />{s.area} · {s.d.toFixed(1)} km
                  <Star className="h-3.5 w-3.5 fill-primary text-primary" />{Number(s.rating).toFixed(1)}
                </div>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{s.description}</p>
            {s.lat != null && s.lng != null && (
              <a href={directionsUrl(location, { lat: s.lat, lng: s.lng })} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="mt-3 inline-block text-sm font-semibold text-primary underline">Get directions</a>
            )}
            {i < 3 && s.reasons.length > 0 && (
              <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-accent p-2 text-xs text-accent-foreground">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Suggested because: {s.reasons.join(", ")}.
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
