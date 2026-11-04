import {
  Apple, Croissant, Package, PenTool, Pill, Refrigerator, Shirt, ShoppingBasket, Smartphone, Sparkles, Tv, Wrench,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  Apple, Croissant, Package, PenTool, Pill, Refrigerator, Shirt, ShoppingBasket, Smartphone, Sparkles, Tv, Wrench,
};

export function CategoryIcon({ name, className }: { name?: string | null; className?: string }) {
  const Icon = MAP[name ?? ""] ?? Package;
  return <Icon className={className} />;
}

/** Product image or a warm tile with the category icon when no photo was uploaded. */
export function ProductThumb({ src, icon, alt, className = "" }: { src?: string | null; icon?: string | null; alt: string; className?: string }) {
  if (src) return <img src={src} alt={alt} loading="lazy" className={`h-full w-full object-cover ${className}`} />;
  return (
    <div className={`flex h-full w-full items-center justify-center bg-accent ${className}`}>
      <CategoryIcon name={icon} className="h-1/3 w-1/3 text-accent-foreground/60" />
    </div>
  );
}
