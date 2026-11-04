import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bike, MapPin, Phone, Star, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { productsQuery } from "@/lib/queries";
import { ProductCard } from "@/components/ProductCard";
import { useStore } from "@/lib/store";
import { distanceKm, inr } from "@/lib/market";

export const Route = createFileRoute("/shops_/$id")({
  head: () => ({
    meta: [
      { title: "Shop — LocalLoop" },
      { name: "description", content: "Products, location and delivery details for this local shop." },
      { property: "og:title", content: "Shop — LocalLoop" },
      { property: "og:description", content: "Browse this neighbourhood store on LocalLoop." },
    ],
  }),
  component: ShopPage,
});

function ShopPage() {
  const { id } = Route.useParams();
  const { location } = useStore();
  const { data: shop } = useQuery({
    queryKey: ["shop", id],
    queryFn: async () => (await supabase.from("shops").select("*").eq("id", id).maybeSingle()).data,
  });
  const { data: products = [] } = useQuery(productsQuery);
  if (!shop) return <div className="p-10 text-center text-muted-foreground">Loading shop…</div>;
  const list = products.filter((p) => p.shop_id === id);
  const d = distanceKm(location, shop);
  const mapsUrl = shop.lat ? `https://www.google.com/maps/search/?api=1&query=${shop.lat},${shop.lng}` : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="rounded-3xl bg-secondary p-6 text-secondary-foreground sm:p-10">
        <Store className="h-10 w-10 text-primary" />
        <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">{shop.name}</h1>
        <p className="mt-1 max-w-2xl opacity-80">{shop.description}</p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{shop.address}, {shop.area}{d != null && ` · ${d.toFixed(1)} km`}</span>
          <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-primary text-primary" />{Number(shop.rating).toFixed(1)}</span>
          <span className="flex items-center gap-1"><Bike className="h-4 w-4" />{shop.delivery_fee > 0 ? `${inr(shop.delivery_fee)} delivery, free above ${inr(shop.free_delivery_above)}` : "Free delivery"}</span>
          {shop.phone && <span className="flex items-center gap-1"><Phone className="h-4 w-4" />{shop.phone}</span>}
          {mapsUrl && <a href={mapsUrl} target="_blank" rel="noreferrer" className="font-semibold text-primary underline">Open in Maps</a>}
        </div>
      </div>
      <h2 className="mt-8 text-2xl font-bold">Products ({list.length})</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{list.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      {list.length === 0 && <p className="text-muted-foreground">No products listed yet. <Link to="/products" className="text-primary">Browse others</Link></p>}
    </div>
  );
}
