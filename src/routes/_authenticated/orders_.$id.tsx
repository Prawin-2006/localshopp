import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ORDER_STAGES, inr, stageIndex } from "@/lib/market";
import { StatusBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/_authenticated/orders_/$id")({
  head: () => ({ meta: [{ title: "Track order — LocalLoop" }, { name: "description", content: "Live order tracking." },
      { property: "og:title", content: "Track order \u2014 LocalLoop" },
      { property: "og:description", content: "Live order tracking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ] }),
  component: Track,
});

function Track() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: o } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => (await supabase.from("orders").select("*, shop:shops(name,phone,area), items:order_items(*)").eq("id", id).maybeSingle()).data,
  });
  useEffect(() => {
    const ch = supabase.channel(`order-${id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` }, () => qc.invalidateQueries({ queryKey: ["order", id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);
  if (!o) return <div className="p-16 text-center text-muted-foreground">Loading…</div>;
  const history = (o.history as { status: string; at: string }[]) ?? [];
  const at = (k: string) => history.find((h) => h.status === k || (k === "ready" && h.status === "out_for_delivery"))?.at;
  const cur = stageIndex(o.status);

  async function cancel() {
    const { error } = await supabase.rpc("update_order_status", { _order: id, _status: "cancelled" });
    if (error) toast.error(error.message); else { toast.success("Order cancelled"); qc.invalidateQueries({ queryKey: ["order", id] }); }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Order from {o.shop?.name}</h1>
        <StatusBadge status={o.status} />
      </div>
      <p className="text-sm text-muted-foreground">#{o.id.slice(0, 8)} · {o.fulfilment === "pickup" ? "Store pickup" : o.address_text}</p>
      {o.status !== "cancelled" && (
        <ol className="mt-6 space-y-4">
          {ORDER_STAGES.map((s, i) => (
            <li key={s.key} className="flex items-center gap-3">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full ${i <= cur ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {i <= cur ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <div>
                <div className={i <= cur ? "font-semibold" : "text-muted-foreground"}>{s.label}</div>
                {at(s.key) && <div className="text-xs text-muted-foreground">{new Date(at(s.key)!).toLocaleString("en-IN")}</div>}
              </div>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-6 rounded-2xl border bg-card p-4 text-sm">
        {o.items.map((i) => <div key={i.id} className="flex justify-between"><span>{i.quantity} × {i.name}</span><span>{inr(i.price * i.quantity)}</span></div>)}
        <div className="mt-2 flex justify-between border-t pt-2"><span>Delivery</span><span>{inr(o.delivery_fee)}</span></div>
        {o.discount > 0 && <div className="flex justify-between"><span>Discount</span><span>−{inr(o.discount)}</span></div>}
        <div className="flex justify-between font-bold"><span>Total</span><span>{inr(o.total)}</span></div>
        <div className="mt-1 text-muted-foreground">Payment: {o.payment_method.toUpperCase()} · {o.payment_status}</div>
      </div>
      {["placed", "accepted"].includes(o.status) && <Button variant="destructive" className="mt-4" onClick={cancel}>Cancel order</Button>}
    </div>
  );
}
