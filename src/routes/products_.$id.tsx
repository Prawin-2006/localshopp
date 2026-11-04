import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Heart, MapPin, Minus, Plus, Star, Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCT_SELECT, productsQuery, type ProductRow } from "@/lib/queries";
import { ProductThumb } from "@/components/CategoryIcon";
import { ProductCard } from "@/components/ProductCard";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useWishlist } from "@/lib/wishlist";
import { discountPct, distanceKm, inr } from "@/lib/market";

export const Route = createFileRoute("/products_/$id")({
  head: () => ({
    meta: [
      { title: "Product details — LocalLoop" },
      { name: "description", content: "Price, stock, shop location and reviews for this local product." },
      { property: "og:title", content: "Product details — LocalLoop" },
      { property: "og:description", content: "See price, stock and reviews from a shop near you." },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { add, location } = useStore();
  const { user } = useAuth();
  const wish = useWishlist();
  const qc = useQueryClient();
  const [qty, setQty] = useState(1);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const { data: p, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data } = await supabase.from("products").select(PRODUCT_SELECT).eq("id", id).maybeSingle();
      return data as unknown as ProductRow | null;
    },
  });
  const { data: reviews = [] } = useQuery({
    queryKey: ["reviews", id],
    queryFn: async () => (await supabase.from("reviews").select("*").eq("product_id", id).order("created_at", { ascending: false })).data ?? [],
  });
  const { data: all = [] } = useQuery(productsQuery);

  if (isLoading) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  if (!p) return <div className="p-10 text-center">Product not found. <Link to="/products" className="text-primary">Browse products</Link></div>;

  const similar = all.filter((x) => x.category_id === p.category_id && x.id !== p.id).slice(0, 5);
  const d = distanceKm(location, p.shop ?? {});
  const off = discountPct(p.price, p.mrp);
  const item = { product_id: p.id, shop_id: p.shop_id, shop_name: p.shop?.name ?? "", name: p.name, price: Number(p.price), unit: p.unit, stock: p.stock };

  async function submitReview() {
    if (!user) return navigate({ to: "/auth" });
    const { error } = await supabase.from("reviews").insert({ product_id: id, user_id: user.id, rating, comment, author_name: user.email?.split("@")[0] });
    if (error) return toast.error(error.message);
    setComment("");
    toast.success("Thanks for your review!");
    qc.invalidateQueries({ queryKey: ["reviews", id] });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-3xl border">
          <ProductThumb src={p.image_url} icon={p.category?.icon} alt={p.name} />
        </div>
        <div>
          <Link to="/products" search={{ category: p.category?.slug }} className="text-sm font-semibold text-primary">{p.category?.name}</Link>
          <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">{p.name}</h1>
          <p className="text-muted-foreground">{p.brand} · {p.unit}</p>
          <div className="mt-2 flex items-center gap-1 text-sm"><Star className="h-4 w-4 fill-primary text-primary" />{Number(p.rating).toFixed(1)} · {reviews.length} reviews · {p.sold_count} sold</div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold">{inr(p.price)}</span>
            {off > 0 && <><span className="text-muted-foreground line-through">{inr(p.mrp)}</span><span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">{off}% off</span></>}
          </div>
          <p className={`mt-2 text-sm font-semibold ${p.stock > 0 ? "text-success" : "text-destructive"}`}>{p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}</p>
          <p className="mt-4 text-foreground/80">{p.description}</p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-full border">
              <Button variant="ghost" size="icon" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Decrease"><Minus className="h-4 w-4" /></Button>
              <span className="w-8 text-center font-semibold">{qty}</span>
              <Button variant="ghost" size="icon" onClick={() => setQty(Math.min(p.stock, qty + 1))} aria-label="Increase"><Plus className="h-4 w-4" /></Button>
            </div>
            <Button disabled={p.stock < 1} onClick={() => { add(item, qty); toast.success("Added to cart"); }}>Add to cart</Button>
            <Button disabled={p.stock < 1} variant="secondary" onClick={() => { add(item, qty); navigate({ to: "/cart" }); }}>Buy now</Button>
            <Button variant="outline" size="icon" onClick={() => wish.toggle(p.id)} aria-label="Wishlist">
              <Heart className={`h-4 w-4 ${wish.has(p.id) ? "fill-destructive text-destructive" : ""}`} />
            </Button>
          </div>

          {p.shop && (
            <Link to="/shops/$id" params={{ id: p.shop.id }} className="mt-6 flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-soft">
              <Store className="h-8 w-8 text-primary" />
              <div>
                <div className="font-semibold">{p.shop.name}</div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{p.shop.area}{d != null && ` · ${d.toFixed(1)} km away`}</div>
              </div>
            </Link>
          )}
        </div>
      </div>

      <section className="mt-12 grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="text-2xl font-bold">Customer reviews</h2>
          {reviews.length === 0 && <p className="mt-2 text-muted-foreground">No reviews yet.</p>}
          <div className="mt-3 space-y-3">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-xl border bg-card p-3">
                <div className="flex items-center gap-2 text-sm font-semibold">{r.author_name}<span className="flex">{Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="h-3 w-3 fill-primary text-primary" />)}</span></div>
                <p className="text-sm text-muted-foreground">{r.comment}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-muted p-4">
          <h3 className="font-semibold">Write a review</h3>
          <div className="mt-2 flex gap-1">{[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`}><Star className={`h-6 w-6 ${n <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`} /></button>
          ))}</div>
          <Textarea className="mt-2 bg-card" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="How was it?" />
          <Button className="mt-2" onClick={submitReview}>{user ? "Submit review" : "Sign in to review"}</Button>
        </div>
      </section>

      {similar.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-2xl font-bold">Similar products</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{similar.map((x) => <ProductCard key={x.id} p={x} />)}</div>
        </section>
      )}
    </div>
  );
}
