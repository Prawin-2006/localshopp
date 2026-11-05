import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PRODUCT_SELECT, type ProductRow } from "@/lib/queries";
import { ProductCard } from "@/components/ProductCard";
import { StatusBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/_authenticated/account")({
  validateSearch: z.object({ tab: z.enum(["profile", "addresses", "wishlist", "help"]).optional() }),
  head: () => ({ meta: [{ title: "My account — LocalLoop" }, { name: "description", content: "Profile, addresses, wishlist and help." }] }),
  component: Account,
});

function Account() {
  const { tab = "profile" } = Route.useSearch();
  const navigate = useNavigate({ from: "/account" });
  const { user, hasRole, refreshRoles } = useAuth();
  const qc = useQueryClient();
  const uid = user!.id;

  const { data: profile } = useQuery({ queryKey: ["profile", uid], queryFn: async () => (await supabase.from("profiles").select("*").eq("id", uid).maybeSingle()).data });
  const [form, setForm] = useState({ full_name: "", phone: "" });
  useEffect(() => { if (profile) setForm({ full_name: profile.full_name ?? "", phone: profile.phone ?? "" }); }, [profile]);
  const { data: addresses = [] } = useQuery({ queryKey: ["addresses", uid], queryFn: async () => (await supabase.from("addresses").select("*")).data ?? [] });
  const { data: wish = [] } = useQuery({
    queryKey: ["wishlist-products", uid],
    queryFn: async () => {
      const ids = ((await supabase.from("wishlist").select("product_id")).data ?? []).map((r) => r.product_id);
      if (!ids.length) return [];
      return ((await supabase.from("products").select(PRODUCT_SELECT).in("id", ids)).data ?? []) as unknown as ProductRow[];
    },
  });
  const { data: complaints = [] } = useQuery({ queryKey: ["my-complaints", uid], queryFn: async () => (await supabase.from("complaints").select("*").order("created_at", { ascending: false })).data ?? [] });
  const [c, setC] = useState({ subject: "", message: "" });

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="text-3xl font-extrabold">My account</h1>
      <Tabs value={tab} onValueChange={(v) => navigate({ search: { tab: v as never } })} className="mt-4">
        <TabsList className="flex-wrap"><TabsTrigger value="profile">Profile</TabsTrigger><TabsTrigger value="addresses">Addresses</TabsTrigger><TabsTrigger value="wishlist">Wishlist</TabsTrigger><TabsTrigger value="help">Help</TabsTrigger></TabsList>
        <TabsContent value="profile" className="space-y-3 rounded-2xl border bg-card p-4">
          <div><Label>Email</Label><Input disabled value={user?.email ?? ""} /></div>
          <div><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <Button onClick={async () => { const { error } = await supabase.from("profiles").update(form).eq("id", uid); if (error) toast.error(error.message); else toast.success("Saved"); }}>Save profile</Button>
          {!hasRole("admin") && (
            <div className="border-t pt-3 text-sm text-muted-foreground">
              Setting up the platform? The first account to claim it becomes the administrator.
              <Button variant="link" onClick={async () => { const { data } = await supabase.rpc("claim_first_admin"); if (data) { await refreshRoles(); toast.success("You are now the administrator"); } else toast.error("An administrator already exists"); }}>Claim admin access</Button>
            </div>
          )}
        </TabsContent>
        <TabsContent value="addresses" className="space-y-2">
          {addresses.length === 0 && <p className="text-muted-foreground">No saved addresses. Add one at checkout.</p>}
          {addresses.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-xl border bg-card p-3">
              <span>{a.label}: {a.line1}, {a.area} {a.pincode}</span>
              <Button variant="ghost" size="icon" aria-label="Delete" onClick={async () => { await supabase.from("addresses").delete().eq("id", a.id); qc.invalidateQueries({ queryKey: ["addresses"] }); }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </TabsContent>
        <TabsContent value="wishlist">
          {wish.length === 0 && <p className="text-muted-foreground">Your wishlist is empty.</p>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{wish.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        </TabsContent>
        <TabsContent value="help" className="space-y-4">
          <div className="space-y-2 rounded-2xl border bg-card p-4">
            <h2 className="font-semibold">Raise a complaint</h2>
            <Input placeholder="Subject" value={c.subject} onChange={(e) => setC({ ...c, subject: e.target.value })} />
            <Textarea placeholder="Tell us what happened (include order number if any)" value={c.message} onChange={(e) => setC({ ...c, message: e.target.value })} />
            <Button onClick={async () => {
              if (!c.subject || !c.message) return toast.error("Fill both fields");
              const { error } = await supabase.from("complaints").insert({ ...c, user_id: uid });
              if (error) return toast.error(error.message);
              setC({ subject: "", message: "" }); toast.success("Complaint submitted"); qc.invalidateQueries({ queryKey: ["my-complaints"] });
            }}>Submit</Button>
          </div>
          {complaints.map((x) => <div key={x.id} className="flex justify-between rounded-xl border bg-card p-3 text-sm"><span>{x.subject}</span><StatusBadge status={x.status} /></div>)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
