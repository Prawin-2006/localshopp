import {
  Apple, Croissant, Package, PenTool, Pill, Refrigerator, Shirt, ShoppingBasket, Smartphone, Sparkles, Tv, Wrench,
  type LucideIcon,
} from "lucide-react";
import { productImage } from "@/lib/product-images";

const MAP: Record<string, LucideIcon> = {
  Apple, Croissant, Package, PenTool, Pill, Refrigerator, Shirt, ShoppingBasket, Smartphone, Sparkles, Tv, Wrench,
};

export function CategoryIcon({ name, className }: { name?: string | null | undefined; className?: string }) {
  const Icon = MAP[name ?? ""] ?? Package;
  return <Icon className={className} />;
}

/** Seller photo or matching catalog picture, with category fallback for new products. */
export function ProductThumb({ src, icon, alt, className = "" }: { src?: string | null | undefined; icon?: string | null | undefined; alt: string; className?: string }) {
  const image = productImage(alt, src);
  if (image) return <img src={image} alt={alt} loading="lazy" width={512} height={512} className={`h-full w-full object-cover ${className}`} />;
  return (
    <div className={`flex h-full w-full items-center justify-center bg-accent ${className}`}>
      <CategoryIcon name={icon} className="h-1/3 w-1/3 text-accent-foreground/60" />
    </div>
  );
}
