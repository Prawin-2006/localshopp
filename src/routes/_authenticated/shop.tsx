import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Bot, IndianRupee, Package, ShoppingBag, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { categoriesQuery } from "@/lib/queries";
import { AREAS, forecast, inr } from "@/lib/market";
import { StatusBadge } from "@/components/StatusBadge";
import { inventoryAssistant } from "@/lib/ai.functions";
import { ProductDescriptionGenerator } from "@/components/ProductDescriptionGenerator";

export const Route = createFileRoute("/_authenticated/shop")({
  head: () => ({ meta: [{ title: "Shop dashboard — LocalLoop" }, { name: "description", content: "Manage your shop, products and orders." },
      { property: "og:title", content: "Shop dashboard \u2014 LocalLoop" },
      { property: "og:description", content: "Manage your shop, products and orders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ] }),
  component: ShopDashboard,
});

const NEXT: Record<string, { s: string; l: string }[]> = {
  placed: [{ s: "accepted", l: "Accept" }, { s: "cancelled", l: "Reject" }],
  accepted: [{ s: "preparing", l: "Start preparing" }],
  preparing: [{ s: "ready", l: "Ready for pickup" }, { s: "out_for_delivery", l: "Out for delivery" }],
  ready: [{ s: "delivered", l: "Mark delivered" }],
  out_for_delivery: [{ s: "delivered", l: "Mark delivered" }],
  delivered: [{ s: "completed", l: "Complete" }],
};

function ShopDashboard() {
  const { user, hasRole, loading } = useAuth();
  const { data: shop, isLoading, refetch } = useQuery({
    queryKey: ["my-shop", user?.id],
    queryFn: async () => (await supabase.from("shops").select("*").eq("owner_id", user!.id).maybeSingle()).data,
  });
  if (loading || isLoading) return <div className="p-16 text-center text-muted-foreground">Loading…</div>;
  if (!hasRole("shop_owner"))
    return <div className="mx-auto max-w-md p-16 text-center"><h1 className="text-2xl font-bold">Shop owner account needed</h1><p className="mt-2 text-muted-foreground">Create a new account and choose "I own a shop" to sell on LocalLoop.</p><Button asChild className="mt-4"><Link to="/auth">Go to sign up</Link></Button></div>;
  if (!shop) return <RegisterShop onDone={refetch} />;
  if (shop.status !== "approved")
    return <div className="mx-auto max-w-md p-16 text-center"><h1 className="text-2xl font-bold">{shop.name}</h1><div className="mt-3"><StatusBadge status={shop.status} /></div><p className="mt-3 text-muted-foreground">{shop.status === "pending" ? "Your registration is being reviewed by our team. You can start selling once it's approved." : "Your shop is not active. Raise a complaint from your account's Help tab for details."}</p></div>;
  return <Dashboard shop={shop} />;
}

function RegisterShop({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const { data: cats = [] } = useQuery(categoriesQuery);
  const [f, setF] = useState({ name: "", description: "", category_id: "", address: "", area: AREAS[0].name as string, phone: "", gstin: "" });
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-3xl font-extrabold">Register your shop</h1>
      <p className="text-muted-foreground">An administrator will verify your details before you go live.</p>
      <div className="mt-4 space-y-3 rounded-2xl border bg-card p-5">
        {(["name", "description", "address", "phone", "gstin"] as const).map((k) => (
          <div key={k}><Label className="capitalize">{k === "gstin" ? "GSTIN (optional)" : k}</Label>
            {k === "description" ? <Textarea value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /> : <Input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />}</div>
        ))}
        <div><Label>Category</Label><Select value={f.category_id} onValueChange={(v) => setF({ ...f, category_id: v })}><SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Area</Label><Select value={f.area} onValueChange={(v) => setF({ ...f, area: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{AREAS.map((a) => <SelectItem key={a.name} value={a.name}>{a.name}</SelectItem>)}</SelectContent></Select></div>
        <Button className="w-full" onClick={async () => {
          if (!f.name || !f.address || !f.category_id) return toast.error("Name, address and category are required");
          const a = AREAS.find((x) => x.name === f.area)!;
          const { error } = await supabase.from("shops").insert({ ...f, gstin: f.gstin || null, owner_id: user!.id, lat: a.lat + (Math.random() - 0.5) * 0.01, lng: a.lng + (Math.random() - 0.5) * 0.01 });
          if (error) return toast.error(error.message);
          toast.success("Submitted for verification"); onDone();
        }}>Submit for verification</Button>
      </div>
    </div>
  );
}

type Shop = { id: string; name: string };

function Stat({ icon: I, label, value }: { icon: typeof Package; label: string; value: string | number }) {
  return <div className="rounded-2xl border bg-card p-4 shadow-soft"><I className="h-5 w-5 text-primary" /><div className="mt-2 text-2xl font-bold">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>;
}

function Dashboard({ shop }: { shop: Shop }) {
  const qc = useQueryClient();
  const { data: products = [] } = useQuery({ queryKey: ["shop-products", shop.id], queryFn: async () => (await supabase.from("products").select("*").eq("shop_id", shop.id).order("name")).data ?? [] });
  const { data: orders = [] } = useQuery({ queryKey: ["shop-orders", shop.id], queryFn: async () => (await supabase.from("orders").select("*, items:order_items(*)").eq("shop_id", shop.id).order("created_at", { ascending: false })).data ?? [] });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["shop-products"] }); qc.invalidateQueries({ queryKey: ["shop-orders"] }); qc.invalidateQueries({ queryKey: ["products"] }); };

  const valid = orders.filter((o) => o.status !== "cancelled");
  const today = new Date().toDateString();
  const revenue = valid.reduce((a, o) => a + Number(o.total), 0);
  const todayRev = valid.filter((o) => new Date(o.created_at).toDateString() === today).reduce((a, o) => a + Number(o.total), 0);
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 13 + i); return d; });
  const daily = days.map((d) => valid.filter((o) => new Date(o.created_at).toDateString() === d.toDateString()).reduce((a, o) => a + Number(o.total), 0));
  const fc = forecast(daily, 7);
  const max = Math.max(1, ...daily, ...fc);
  const low = products.filter((p) => p.stock <= p.low_stock_threshold);

  function exportCsv() {
    const rows = [["order_id", "date", "status", "payment", "total"], ...orders.map((o) => [o.id, o.created_at, o.status, o.payment_status, o.total])];
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `${shop.name}-orders.csv`; a.click();
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-3xl font-extrabold">{shop.name}</h1><Button variant="outline" onClick={exportCsv}>Download sales report</Button></div>
      <Tabs defaultValue="overview" className="mt-4">
        <TabsList className="flex-wrap"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="orders">Orders ({orders.filter((o) => o.status === "placed").length})</TabsTrigger><TabsTrigger value="products">Products & stock</TabsTrigger><TabsTrigger value="ai">AI assistant</TabsTrigger></TabsList>
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat icon={IndianRupee} label="Total revenue" value={inr(revenue)} />
            <Stat icon={TrendingUp} label="Today's revenue" value={inr(todayRev)} />
            <Stat icon={ShoppingBag} label={`Orders · ${orders.filter((o) => !["completed", "delivered", "cancelled"].includes(o.status)).length} pending`} value={orders.length} />
            <Stat icon={AlertTriangle} label={`Products · ${low.length} low stock`} value={products.length} />
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <h2 className="font-semibold">Sales: last 14 days + 7-day forecast</h2>
            <div className="mt-4 flex h-40 items-end gap-1">
              {daily.map((v, i) => <div key={i} title={inr(v)} className="flex-1 rounded-t bg-primary" style={{ height: `${(v / max) * 100}%`, minHeight: 2 }} />)}
              {fc.map((v, i) => <div key={`f${i}`} title={`Forecast ${inr(v)}`} className="flex-1 rounded-t border-2 border-dashed border-secondary bg-secondary/20" style={{ height: `${(v / max) * 100}%`, minHeight: 2 }} />)}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Dashed bars are a trend estimate from your recent sales, not a guarantee. Expected next 7 days: {inr(fc.reduce((a, b) => a + b, 0))}.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border bg-card p-4"><h2 className="font-semibold">Top sellers</h2>{[...products].sort((a, b) => b.sold_count - a.sold_count).slice(0, 5).map((p) => <div key={p.id} className="flex justify-between py-1 text-sm"><span>{p.name}</span><span>{p.sold_count} sold</span></div>)}</div>
            <div className="rounded-2xl border bg-card p-4"><h2 className="font-semibold">Low stock — restock soon</h2>{low.length === 0 && <p className="text-sm text-muted-foreground">All good.</p>}{low.map((p) => <div key={p.id} className="flex justify-between py-1 text-sm"><span>{p.name}</span><span className="text-destructive">{p.stock} left</span></div>)}</div>
          </div>
        </TabsContent>
        <TabsContent value="orders" className="space-y-3">
          {orders.length === 0 && <p className="text-muted-foreground">No orders yet.</p>}
          {orders.map((o) => (
            <div key={o.id} className="rounded-2xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">#{o.id.slice(0, 8)} · {inr(o.total)}</span><StatusBadge status={o.status} /></div>
              <p className="text-sm text-muted-foreground">{o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</p>
              <p className="text-xs text-muted-foreground">{o.fulfilment === "pickup" ? "Pickup" : o.address_text} · {o.payment_method.toUpperCase()} ({o.payment_status}) · {new Date(o.created_at).toLocaleString("en-IN")}</p>
              <div className="mt-2 flex flex-wrap gap-2">{(NEXT[o.status] ?? []).map((n) => (
                <Button key={n.s} size="sm" variant={n.s === "cancelled" ? "destructive" : "default"} onClick={async () => { const { error } = await supabase.rpc("update_order_status", { _order: o.id, _status: n.s as never }); if (error) toast.error(error.message); else refresh(); }}>{n.l}</Button>
              ))}</div>
            </div>
          ))}
        </TabsContent>
        <TabsContent value="products"><ProductsTab shopId={shop.id} products={products} onChange={refresh} /></TabsContent>
        <TabsContent value="ai"><InventoryAI shopId={shop.id} products={products} onChange={refresh} /></TabsContent>
      </Tabs>
    </div>
  );
}

type P = { id: string; name: string; price: number; mrp: number; stock: number; unit: string | null; description: string | null; brand: string | null; category_id: string | null; active: boolean; low_stock_threshold: number; image_url: string | null };
const EMPTY = { name: "", price: 0, mrp: 0, stock: 0, unit: "1 pc", description: "", brand: "", category_id: "", image_url: "" };

function ProductsTab({ shopId, products, onChange }: { shopId: string; products: P[]; onChange: () => void }) {
  const { data: cats = [] } = useQuery(categoriesQuery);
  const [edit, setEdit] = useState<(typeof EMPTY & { id?: string }) | null>(null);
  const [q, setQ] = useState("");

  async function save() {
    if (!edit?.name || edit.price <= 0) return toast.error("Name and price are required");
    const row = { name: edit.name, price: edit.price, mrp: Math.max(edit.mrp, edit.price), stock: edit.stock, unit: edit.unit, description: edit.description, brand: edit.brand, category_id: edit.category_id || null, image_url: edit.image_url || null, shop_id: shopId };
    const { error } = edit.id ? await supabase.from("products").update(row).eq("id", edit.id) : await supabase.from("products").insert(row);
    if (error) return toast.error(error.message);
    toast.success("Saved"); setEdit(null); onChange();
  }

  return (
    <div>
      <div className="flex gap-2"><Input placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" /><Button onClick={() => setEdit({ ...EMPTY })}>Add product</Button></div>
      <div className="mt-3 overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left"><tr><th className="p-3">Product</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3 font-medium">{p.name}<div className="text-xs text-muted-foreground">{p.unit}</div></td>
                <td>{inr(p.price)}</td>
                <td><div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={async () => { await supabase.from("products").update({ stock: Math.max(0, p.stock - 1) }).eq("id", p.id); onChange(); }}>−</Button>
                  <span className={`w-8 text-center ${p.stock <= p.low_stock_threshold ? "font-bold text-destructive" : ""}`}>{p.stock}</span>
                  <Button size="sm" variant="outline" onClick={async () => { await supabase.from("products").update({ stock: p.stock + 1 }).eq("id", p.id); onChange(); }}>+</Button>
                </div></td>
                <td><button className="text-xs underline" onClick={async () => { await supabase.from("products").update({ active: !p.active }).eq("id", p.id); onChange(); }}>{p.active ? "Listed" : "Hidden"}</button></td>
                <td className="pr-3 text-right"><Button size="sm" variant="ghost" onClick={() => setEdit({ id: p.id, name: p.name, price: p.price, mrp: p.mrp, stock: p.stock, unit: p.unit ?? "", description: p.description ?? "", brand: p.brand ?? "", category_id: p.category_id ?? "", image_url: p.image_url ?? "" })}>Edit</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Edit product" : "Add product"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-2">
              <div><Label htmlFor="product-name">Name</Label><Input id="product-name" maxLength={120} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Price ₹</Label><Input type="number" value={edit.price} onChange={(e) => setEdit({ ...edit, price: +e.target.value })} /></div>
                <div><Label>MRP ₹</Label><Input type="number" value={edit.mrp} onChange={(e) => setEdit({ ...edit, mrp: +e.target.value })} /></div>
                <div><Label>Stock</Label><Input type="number" value={edit.stock} onChange={(e) => setEdit({ ...edit, stock: +e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Unit</Label><Input value={edit.unit} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} /></div>
                <div><Label>Brand</Label><Input value={edit.brand} onChange={(e) => setEdit({ ...edit, brand: e.target.value })} /></div>
              </div>
              <div><Label htmlFor="product-category">Category</Label><Select value={edit.category_id} onValueChange={(v) => setEdit({ ...edit, category_id: v })}><SelectTrigger id="product-category"><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Image URL (optional)</Label><Input value={edit.image_url} onChange={(e) => setEdit({ ...edit, image_url: e.target.value })} /></div>
              <div>
                <Label htmlFor="product-description">Description</Label>
                <Textarea id="product-description" rows={4} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
              </div>
              <ProductDescriptionGenerator name={edit.name} category={cats.find((c) => c.id === edit.category_id)?.name ?? ""} brand={edit.brand} unit={edit.unit} onApply={(description) => { setEdit((current) => current ? { ...current, description } : null); toast.success("Description applied"); }} />
              <Button className="w-full" onClick={save}>Save product</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

type Plan = { action: string; product_id: string | null; value: number | null; summary: string; answer: string };

function InventoryAI({ shopId, products, onChange }: { shopId: string; products: P[]; onChange: () => void }) {
  const run = useServerFn(inventoryAssistant);
  const [cmd, setCmd] = useState("");
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);

  async function confirm() {
    if (!plan?.product_id || plan.value == null) return;
    const p = products.find((x) => x.id === plan.product_id);
    if (!p) return toast.error("Product not found");
    const patch = plan.action === "add_stock" ? { stock: p.stock + plan.value } : plan.action === "set_stock" ? { stock: plan.value } : { price: plan.value };
    const { error } = await supabase.from("products").update(patch).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Done: " + plan.summary); setPlan(null); setCmd(""); onChange();
  }

  return (
    <div className="max-w-2xl space-y-3">
      <div className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" /><h2 className="font-semibold">Tell me what to change</h2></div>
      <div className="flex gap-2">
        <Input value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder='e.g. "Add 20 units of basmati rice"' onKeyDown={(e) => e.key === "Enter" && document.getElementById("ai-go")?.click()} />
        <Button id="ai-go" disabled={busy || !cmd} onClick={async () => { setBusy(true); try { setPlan((await run({ data: { shopId, command: cmd } })) as Plan); } catch (e) { toast.error((e as Error).message); } setBusy(false); }}>{busy ? "…" : "Go"}</Button>
      </div>
      <div className="flex flex-wrap gap-1">{["Show products with stock below 5", "Which products sold the most?", "Update toor dal price to ₹155"].map((s) => <button key={s} onClick={() => setCmd(s)} className="rounded-full bg-muted px-3 py-1 text-xs">{s}</button>)}</div>
      {plan && (
        <div className="rounded-2xl border bg-card p-4">
          {plan.action === "query" || plan.action === "unknown" ? <p className="whitespace-pre-wrap">{plan.answer || plan.summary}</p> : (
            <>
              <p className="font-medium">{plan.summary}</p>
              <div className="mt-3 flex gap-2"><Button onClick={confirm}>Confirm change</Button><Button variant="outline" onClick={() => setPlan(null)}>Cancel</Button></div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
