import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { inr, shopTotals } from "@/lib/market";
import { shopsQuery } from "@/lib/queries";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your cart — LocalLoop" },
      { name: "description", content: "Review items grouped by shop before checkout." },
      { property: "og:title", content: "Your cart — LocalLoop" },
      { property: "og:description", content: "Review your LocalLoop cart." },
    ],
  }),
  component: Cart,
});

function Cart() {
  const { cart, setQty, remove } = useStore();
  const { data: shops = [] } = useQuery(shopsQuery);
  const groups = Object.values(
    cart.reduce<Record<string, typeof cart>>((acc, i) => ((acc[i.shop_id] ??= []).push(i), acc), {}),
  );

  if (cart.length === 0)
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-3xl font-extrabold">Your cart is empty</h1>
        <p className="mt-2 text-muted-foreground">Find something from a shop around the corner.</p>
        <Button asChild className="mt-6"><Link to="/products">Browse products</Link></Button>
      </div>
    );

  let grand = 0;
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="text-3xl font-extrabold">Cart</h1>
      <p className="text-sm text-muted-foreground">Each shop is a separate order with its own delivery charge.</p>
      <div className="mt-6 space-y-6">
        {groups.map((items) => {
          const shop = shops.find((s) => s.id === items[0].shop_id);
          const sub = items.reduce((a, i) => a + i.price * i.quantity, 0);
          const t = shopTotals(sub, shop ?? { delivery_fee: 0, free_delivery_above: 0 }, "delivery");
          grand += t.total;
          return (
            <div key={items[0].shop_id} className="rounded-2xl border bg-card p-4 shadow-soft">
              <div className="font-display text-lg font-bold">{items[0].shop_name}</div>
              <div className="divide-y">
                {items.map((i) => (
                  <div key={i.product_id} className="flex items-center gap-3 py-3">
                    <div className="flex-1">
                      <div className="font-medium">{i.name}</div>
                      <div className="text-xs text-muted-foreground">{i.unit} · {inr(i.price)} each</div>
                    </div>
                    <div className="flex items-center rounded-full border">
                      <Button variant="ghost" size="icon" onClick={() => setQty(i.product_id, i.quantity - 1)} aria-label="Decrease"><Minus className="h-4 w-4" /></Button>
                      <span className="w-6 text-center text-sm font-semibold">{i.quantity}</span>
                      <Button variant="ghost" size="icon" onClick={() => setQty(i.product_id, i.quantity + 1)} aria-label="Increase" disabled={i.quantity >= i.stock}><Plus className="h-4 w-4" /></Button>
                    </div>
                    <div className="w-16 text-right font-semibold">{inr(i.price * i.quantity)}</div>
                    <Button variant="ghost" size="icon" onClick={() => remove(i.product_id)} aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
              <div className="mt-2 space-y-1 border-t pt-3 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{inr(t.subtotal)}</span></div>
                <div className="flex justify-between"><span>Delivery</span><span>{t.delivery ? inr(t.delivery) : "Free"}</span></div>
                {shop && t.delivery > 0 && <p className="text-xs text-muted-foreground">Add {inr(shop.free_delivery_above - sub)} more for free delivery.</p>}
                <div className="flex justify-between font-bold"><span>Shop total</span><span>{inr(t.total)}</span></div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-6 flex items-center justify-between rounded-2xl bg-secondary p-4 text-secondary-foreground">
        <div><div className="text-sm opacity-80">Estimated total (with delivery)</div><div className="text-2xl font-bold">{inr(grand)}</div></div>
        <Button asChild size="lg"><Link to="/checkout">Checkout</Link></Button>
      </div>
    </div>
  );
}
