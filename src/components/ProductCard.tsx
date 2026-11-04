import { Link } from "@tanstack/react-router";
import { Heart, MapPin, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProductThumb } from "./CategoryIcon";
import { useStore } from "@/lib/store";
import { discountPct, distanceKm, inr } from "@/lib/market";
import type { ProductRow } from "@/lib/queries";
import { useWishlist } from "@/lib/wishlist";

export function ProductCard({ p }: { p: ProductRow }) {
  const { add, location } = useStore();
  const wish = useWishlist();
  const d = p.shop ? distanceKm(location, p.shop) : null;
  const off = discountPct(p.price, p.mrp);
  const inStock = p.stock > 0;
  const liked = wish.has(p.id);

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
      <Link to="/products/$id" params={{ id: p.id }} className="relative block aspect-square overflow-hidden">
        <ProductThumb src={p.image_url} icon={p.category?.icon} alt={p.name} className="transition group-hover:scale-105" />
        {off > 0 && (
          <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
            {off}% off
          </span>
        )}
      </Link>
      <button
        aria-label={liked ? "Remove from wishlist" : "Add to wishlist"}
        onClick={() => wish.toggle(p.id)}
        className="absolute right-2 top-2 rounded-full bg-card/90 p-1.5 shadow-soft"
      >
        <Heart className={`h-4 w-4 ${liked ? "fill-destructive text-destructive" : "text-muted-foreground"}`} />
      </button>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <Link to="/products/$id" params={{ id: p.id }} className="line-clamp-1 font-semibold">
          {p.name}
        </Link>
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {p.shop?.name} · {p.unit}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-0.5"><Star className="h-3 w-3 fill-primary text-primary" />{Number(p.rating).toFixed(1)}</span>
          {d != null && <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" />{d.toFixed(1)} km</span>}
          <span className={inStock ? (p.stock <= p.low_stock_threshold ? "text-warning" : "text-success") : "text-destructive"}>
            {inStock ? (p.stock <= p.low_stock_threshold ? `Only ${p.stock} left` : "In stock") : "Out of stock"}
          </span>
        </div>
        <div className="mt-auto flex items-end justify-between pt-2">
          <div>
            <span className="text-lg font-bold">{inr(p.price)}</span>
            {off > 0 && <span className="ml-1 text-xs text-muted-foreground line-through">{inr(p.mrp)}</span>}
          </div>
          <Button
            size="sm"
            disabled={!inStock}
            onClick={() => {
              add({ product_id: p.id, shop_id: p.shop_id, shop_name: p.shop?.name ?? "", name: p.name, price: Number(p.price), unit: p.unit, stock: p.stock });
              toast.success(`${p.name} added to cart`);
            }}
          >
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>
    </div>
  );
}
