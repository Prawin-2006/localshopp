import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ProductCard } from "@/components/ProductCard";
import { categoriesQuery, productsQuery, shopsQuery } from "@/lib/queries";
import { useStore } from "@/lib/store";
import { discountPct, distanceKm } from "@/lib/market";

const searchSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  shop: z.string().optional(),
  sort: z.enum(["relevance", "price_asc", "price_desc", "rating", "nearest"]).optional(),
  instock: z.boolean().optional(),
  deals: z.boolean().optional(),
});

export const Route = createFileRoute("/products")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Browse nearby products — LocalLoop" },
      { name: "description", content: "Search and filter products from shops near you by price, rating, distance and availability." },
      { property: "og:title", content: "Browse nearby products — LocalLoop" },
      { property: "og:description", content: "Filter local products by price, rating, distance and stock." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Products,
});

function Products() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/products" });
  const set = (patch: Partial<z.infer<typeof searchSchema>>) => navigate({ search: (p) => ({ ...p, ...patch }), replace: true });
  const { location } = useStore();
  const { data: cats = [] } = useQuery(categoriesQuery);
  const { data: shops = [] } = useQuery(shopsQuery);
  const { data: products = [], isLoading } = useQuery(productsQuery);

  const q = (s.q ?? "").toLowerCase();
  let list = products.filter((p) =>
    (!q || [p.name, p.brand, p.description, p.shop?.name, p.category?.name].some((f) => f?.toLowerCase().includes(q))) &&
    (!s.category || p.category?.slug === s.category) &&
    (!s.shop || p.shop_id === s.shop) &&
    (!s.instock || p.stock > 0) &&
    (!s.deals || discountPct(p.price, p.mrp) > 0),
  );
  const dist = (p: (typeof list)[number]) => distanceKm(location, p.shop ?? {}) ?? 99;
  if (s.sort === "price_asc") list = [...list].sort((a, b) => a.price - b.price);
  if (s.sort === "price_desc") list = [...list].sort((a, b) => b.price - a.price);
  if (s.sort === "rating") list = [...list].sort((a, b) => b.rating - a.rating);
  if (s.sort === "nearest") list = [...list].sort((a, b) => dist(a) - dist(b));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="text-3xl font-extrabold">{s.category ? cats.find((c) => c.slug === s.category)?.name : "All products"}</h1>
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3">
        <Input defaultValue={s.q} onChange={(e) => set({ q: e.target.value || undefined })} placeholder="Search…" className="w-full sm:w-56" />
        <Select value={s.category ?? "all"} onValueChange={(v) => set({ category: v === "all" ? undefined : v })}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All categories</SelectItem>{cats.map((c) => <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={s.shop ?? "all"} onValueChange={(v) => set({ shop: v === "all" ? undefined : v })}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Shop" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All shops</SelectItem>{shops.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={s.sort ?? "relevance"} onValueChange={(v) => set({ sort: v as never })}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="relevance">Relevance</SelectItem>
            <SelectItem value="price_asc">Price: low to high</SelectItem>
            <SelectItem value="price_desc">Price: high to low</SelectItem>
            <SelectItem value="rating">Highest rated</SelectItem>
            <SelectItem value="nearest">Nearest shops</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2"><Switch id="st" checked={!!s.instock} onCheckedChange={(v) => set({ instock: v || undefined })} /><Label htmlFor="st">In stock</Label></div>
        <div className="flex items-center gap-2"><Switch id="dl" checked={!!s.deals} onCheckedChange={(v) => set({ deals: v || undefined })} /><Label htmlFor="dl">Discounted</Label></div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{isLoading ? "Loading…" : `${list.length} products`}</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {list.map((p) => <ProductCard key={p.id} p={p} />)}
      </div>
      {!isLoading && list.length === 0 && <p className="py-16 text-center text-muted-foreground">No products match these filters.</p>}
    </div>
  );
}
