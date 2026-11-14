import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { inr } from "@/lib/market";
import { StatusBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — LocalLoop" }, { name: "description", content: "Platform administration." },
      { property: "og:title", content: "Admin \u2014 LocalLoop" },
      { property: "og:description", content: "Platform administration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ] }),
  component: Admin,
});

function Admin() {
  const { hasRole, loading } = useAuth();
  if (loading) return <div className="p-16 text-center text-muted-foreground">Loading…</div>;
  if (!hasRole("admin")) return <div className="p-16 text-center"><h1 className="text-2xl font-bold">Administrators only</h1></div>;
  return <Panel />;
}

function Panel() {
  const qc = useQueryClient();
  const q = <T,>(key: string, fn: () => PromiseLike<{ data: T[] | null }>) => useQuery({ queryKey: ["admin", key], queryFn: async () => (await fn()).data ?? [] });
  const { data: shops = [] } = q("shops", () => supabase.from("shops").select("*").order("created_at", { ascending: false }));
  const { data: orders = [] } = q("orders", () => supabase.from("orders").select("*, shop:shops(name)").order("created_at", { ascending: false }).limit(200));
  const { data: users = [] } = q("users", () => supabase.from("profiles").select("*").order("created_at", { ascending: false }));
  const { data: roles = [] } = q("roles", () => supabase.from("user_roles").select("*"));
  const { data: products = [] } = q("products", () => supabase.from("products").select("id,name,price,stock,active,shop:shops(name)").order("name"));
  const { data: complaints = [] } = q("complaints", () => supabase.from("complaints").select("*").order("created_at", { ascending: false }));
  const { data: cats = [] } = q("cats", () => supabase.from("categories").select("*").order("sort"));
  const [newCat, setNewCat] = useState("");
  const inv = () => { qc.invalidateQueries({ queryKey: ["admin"] }); qc.invalidateQueries({ queryKey: ["shops"] }); qc.invalidateQueries({ queryKey: ["products"] }); qc.invalidateQueries({ queryKey: ["categories"] }); };
  const act = async (p: PromiseLike<{ error: { message: string } | null }>) => { const { error } = await p; if (error) toast.error(error.message); else { toast.success("Updated"); inv(); } };

  const gmv = orders.filter((o) => o.status !== "cancelled").reduce((a, o) => a + Number(o.total), 0);
  const pending = shops.filter((s) => s.status === "pending");

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="text-3xl font-extrabold">Admin panel</h1>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[["Users", users.length], ["Shops", shops.length], ["Pending verification", pending.length], ["Orders", orders.length], ["Gross order value", inr(gmv)]].map(([l, v]) => (
          <div key={l as string} className="rounded-2xl border bg-card p-4 shadow-soft"><div className="text-2xl font-bold">{v}</div><div className="text-xs text-muted-foreground">{l}</div></div>
        ))}
      </div>
      <Tabs defaultValue="shops" className="mt-6">
        <TabsList className="flex-wrap"><TabsTrigger value="shops">Shops</TabsTrigger><TabsTrigger value="users">Users</TabsTrigger><TabsTrigger value="orders">Orders</TabsTrigger><TabsTrigger value="products">Products</TabsTrigger><TabsTrigger value="categories">Categories</TabsTrigger><TabsTrigger value="complaints">Complaints</TabsTrigger></TabsList>
        <TabsContent value="shops" className="space-y-2">
          {shops.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3">
              <div><div className="font-semibold">{s.name} <StatusBadge status={s.status} /></div><div className="text-xs text-muted-foreground">{s.address}, {s.area} · {s.phone} {s.gstin && `· GSTIN ${s.gstin}`}</div></div>
              <div className="flex gap-1">
                {s.status !== "approved" && <Button size="sm" onClick={() => act(supabase.from("shops").update({ status: "approved" }).eq("id", s.id))}>Approve</Button>}
                {s.status === "pending" && <Button size="sm" variant="outline" onClick={() => act(supabase.from("shops").update({ status: "rejected" }).eq("id", s.id))}>Reject</Button>}
                {s.status === "approved" && <Button size="sm" variant="destructive" onClick={() => act(supabase.from("shops").update({ status: "suspended" }).eq("id", s.id))}>Suspend</Button>}
              </div>
            </div>
          ))}
        </TabsContent>
        <TabsContent value="users" className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-xl border bg-card p-3">
              <div><div className="font-semibold">{u.full_name}</div><div className="text-xs text-muted-foreground">{roles.filter((r) => r.user_id === u.id).map((r) => r.role).join(", ")} · joined {new Date(u.created_at).toLocaleDateString("en-IN")}</div></div>
              <Button size="sm" variant={u.suspended ? "default" : "outline"} onClick={() => act(supabase.from("profiles").update({ suspended: !u.suspended }).eq("id", u.id))}>{u.suspended ? "Reactivate" : "Suspend"}</Button>
            </div>
          ))}
        </TabsContent>
        <TabsContent value="orders">
          <div className="overflow-x-auto rounded-2xl border bg-card"><table className="w-full text-sm"><thead className="bg-muted text-left"><tr><th className="p-3">Order</th><th>Shop</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>{orders.map((o) => <tr key={o.id} className="border-t"><td className="p-3">#{o.id.slice(0, 8)}</td><td>{o.shop?.name}</td><td>{inr(o.total)}</td><td><StatusBadge status={o.status} /></td><td>{new Date(o.created_at).toLocaleDateString("en-IN")}</td></tr>)}</tbody></table></div>
        </TabsContent>
        <TabsContent value="products" className="space-y-2">
          {products.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl border bg-card p-3 text-sm">
              <span>{p.name} · {p.shop?.name} · {inr(p.price)} · {p.stock} in stock</span>
              <Button size="sm" variant="outline" onClick={() => act(supabase.from("products").update({ active: !p.active }).eq("id", p.id))}>{p.active ? "Hide" : "Restore"}</Button>
            </div>
          ))}
        </TabsContent>
        <TabsContent value="categories" className="space-y-2">
          <div className="flex gap-2"><Input placeholder="New category" value={newCat} onChange={(e) => setNewCat(e.target.value)} className="max-w-xs" />
            <Button onClick={async () => { if (!newCat) return; await act(supabase.from("categories").insert({ name: newCat, slug: newCat.toLowerCase().replace(/[^a-z0-9]+/g, "-"), sort: cats.length + 1 })); setNewCat(""); }}>Add</Button></div>
          {cats.map((c) => <div key={c.id} className="flex items-center justify-between rounded-xl border bg-card p-3"><span>{c.name}</span><Button size="sm" variant="ghost" onClick={() => act(supabase.from("categories").delete().eq("id", c.id))}>Delete</Button></div>)}
        </TabsContent>
        <TabsContent value="complaints" className="space-y-2">
          {complaints.length === 0 && <p className="text-muted-foreground">No complaints.</p>}
          {complaints.map((c) => (
            <div key={c.id} className="rounded-xl border bg-card p-3">
              <div className="flex items-center justify-between"><span className="font-semibold">{c.subject}</span><StatusBadge status={c.status} /></div>
              <p className="text-sm text-muted-foreground">{c.message}</p>
              {c.status !== "resolved" && <Button size="sm" className="mt-2" onClick={() => act(supabase.from("complaints").update({ status: "resolved" }).eq("id", c.id))}>Mark resolved</Button>}
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
