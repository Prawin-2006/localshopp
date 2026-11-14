import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { inr } from "@/lib/market";
import { StatusBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({ meta: [{ title: "My orders — LocalLoop" }, { name: "description", content: "Your LocalLoop order history." },
      { property: "og:title", content: "My orders \u2014 LocalLoop" },
      { property: "og:description", content: "Your LocalLoop order history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ] }),
  component: Orders,
});

function Orders() {
  const { user } = useAuth();
  const { data = [], isLoading } = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("orders").select("*, shop:shops(name), items:order_items(name,quantity)").eq("customer_id", user!.id).order("created_at", { ascending: false })).data ?? [],
  });
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-3xl font-extrabold">My orders</h1>
      {isLoading && <p className="mt-4 text-muted-foreground">Loading…</p>}
      {!isLoading && data.length === 0 && <p className="mt-4 text-muted-foreground">No orders yet. <Link to="/products" className="text-primary">Start shopping</Link></p>}
      <div className="mt-4 space-y-3">
        {data.map((o) => (
          <Link key={o.id} to="/orders/$id" params={{ id: o.id }} className="block rounded-2xl border bg-card p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <div className="font-semibold">{o.shop?.name}</div>
              <StatusBadge status={o.status} />
            </div>
            <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</p>
            <div className="mt-1 flex justify-between text-sm"><span>{new Date(o.created_at).toLocaleString("en-IN")}</span><span className="font-bold">{inr(o.total)}</span></div>
          </Link>
        ))}
      </div>
    </div>
  );
}
