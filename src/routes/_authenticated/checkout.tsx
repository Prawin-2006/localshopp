import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { shopsQuery } from "@/lib/queries";
import { inr, shopTotals } from "@/lib/market";

export const Route = createFileRoute("/_authenticated/checkout")({
  head: () => ({ meta: [{ title: "Checkout — LocalLoop" }, { name: "description", content: "Confirm address, delivery and payment." },
      { property: "og:title", content: "Checkout \u2014 LocalLoop" },
      { property: "og:description", content: "Confirm address, delivery and payment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ] }),
  component: Checkout,
});

function Checkout() {
  const { cart, clearShop } = useStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: shops = [] } = useQuery(shopsQuery);
  const { data: addresses = [], refetch } = useQuery({
    queryKey: ["addresses", user?.id],
    queryFn: async () => (await supabase.from("addresses").select("*").order("created_at")).data ?? [],
  });
  const [addrId, setAddrId] = useState<string>("");
  const [fulfil, setFulfil] = useState<"delivery" | "pickup">("delivery");
  const [pay, setPay] = useState("cod");
  const [coupon, setCoupon] = useState("");
  const [newAddr, setNewAddr] = useState({ line1: "", area: "", pincode: "" });
  const [busy, setBusy] = useState(false);

  const groups = Object.values(cart.reduce<Record<string, typeof cart>>((a, i) => ((a[i.shop_id] ??= []).push(i), a), {}));
  if (cart.length === 0) return <div className="p-16 text-center">Cart is empty. <Link to="/products" className="text-primary">Shop now</Link></div>;
  const selected = addresses.find((a) => a.id === (addrId || addresses[0]?.id));

  async function saveAddress() {
    if (!newAddr.line1) return toast.error("Enter address line");
    const { data, error } = await supabase.from("addresses").insert({ ...newAddr, user_id: user!.id }).select().single();
    if (error) return toast.error(error.message);
    setAddrId(data.id);
    setNewAddr({ line1: "", area: "", pincode: "" });
    refetch();
  }

  async function placeOrders() {
    if (fulfil === "delivery" && !selected) return toast.error("Add a delivery address");
    setBusy(true);
    const ids: string[] = [];
    for (const items of groups) {
      const { data, error } = await supabase.rpc("place_order", {
        _shop_id: items[0].shop_id,
        _items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        _fulfilment: fulfil,
        _payment_method: pay,
        _address: fulfil === "delivery" && selected ? `${selected.line1}, ${selected.area ?? ""} ${selected.pincode ?? ""}` : "Store pickup",
        _coupon: coupon || undefined,
      });
      if (error) { toast.error(`${items[0].shop_name}: ${error.message}`); continue; }
      ids.push(data as string);
      clearShop(items[0].shop_id);
    }
    setBusy(false);
    qc.invalidateQueries({ queryKey: ["products"] });
    if (ids.length) { toast.success(`${ids.length} order(s) placed`); navigate({ to: "/orders" }); }
  }

  let grand = 0;
  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 md:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <h1 className="text-3xl font-extrabold">Checkout</h1>
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="font-semibold">Delivery or pickup</h2>
          <RadioGroup value={fulfil} onValueChange={(v) => setFulfil(v as never)} className="mt-2 grid grid-cols-2 gap-2">
            {[["delivery", "Home delivery"], ["pickup", "Store pickup"]].map(([v, l]) => (
              <Label key={v} className="flex cursor-pointer items-center gap-2 rounded-xl border p-3"><RadioGroupItem value={v} />{l}</Label>
            ))}
          </RadioGroup>
        </section>
        {fulfil === "delivery" && (
          <section className="rounded-2xl border bg-card p-4">
            <h2 className="font-semibold">Delivery address</h2>
            <RadioGroup value={selected?.id ?? ""} onValueChange={setAddrId} className="mt-2 space-y-2">
              {addresses.map((a) => (
                <Label key={a.id} className="flex cursor-pointer items-center gap-2 rounded-xl border p-3"><RadioGroupItem value={a.id} />{a.label}: {a.line1}, {a.area} {a.pincode}</Label>
              ))}
            </RadioGroup>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <Input placeholder="House / street" value={newAddr.line1} onChange={(e) => setNewAddr({ ...newAddr, line1: e.target.value })} />
              <Input placeholder="Area" value={newAddr.area} onChange={(e) => setNewAddr({ ...newAddr, area: e.target.value })} />
              <Input placeholder="Pincode" value={newAddr.pincode} onChange={(e) => setNewAddr({ ...newAddr, pincode: e.target.value })} />
            </div>
            <Button variant="outline" size="sm" className="mt-2" onClick={saveAddress}>Add address</Button>
          </section>
        )}
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="font-semibold">Payment</h2>
          <RadioGroup value={pay} onValueChange={setPay} className="mt-2 space-y-2">
            <Label className="flex cursor-pointer items-center gap-2 rounded-xl border p-3"><RadioGroupItem value="cod" />Cash / UPI on delivery</Label>
            <Label className="flex items-center gap-2 rounded-xl border border-dashed p-3 opacity-60"><RadioGroupItem value="razorpay" disabled />Razorpay online payment <span className="ml-auto rounded bg-muted px-2 text-xs">Not connected yet</span></Label>
          </RadioGroup>
        </section>
      </div>
      <aside className="h-fit space-y-3 rounded-2xl border bg-card p-4 shadow-soft md:sticky md:top-24">
        <h2 className="font-semibold">Order summary</h2>
        {groups.map((items) => {
          const shop = shops.find((s) => s.id === items[0].shop_id) ?? { delivery_fee: 0, free_delivery_above: 0 };
          const t = shopTotals(items.reduce((a, i) => a + i.price * i.quantity, 0), shop, fulfil, coupon);
          grand += t.total;
          return (
            <div key={items[0].shop_id} className="border-b pb-2 text-sm">
              <div className="font-medium">{items[0].shop_name}</div>
              {items.map((i) => <div key={i.product_id} className="flex justify-between text-muted-foreground"><span>{i.quantity} × {i.name}</span><span>{inr(i.price * i.quantity)}</span></div>)}
              <div className="flex justify-between"><span>Delivery</span><span>{t.delivery ? inr(t.delivery) : "Free"}</span></div>
              {t.discount > 0 && <div className="flex justify-between text-success"><span>Coupon</span><span>−{inr(t.discount)}</span></div>}
            </div>
          );
        })}
        <div className="flex gap-2"><Input placeholder="Coupon (try LOOP10)" value={coupon} onChange={(e) => setCoupon(e.target.value)} /></div>
        <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{inr(grand)}</span></div>
        <Button className="w-full" size="lg" disabled={busy} onClick={placeOrders}>{busy ? "Placing…" : "Confirm order"}</Button>
      </aside>
    </div>
  );
}
