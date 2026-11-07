import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { shoppingAssistant } from "@/lib/ai.functions";
import { productsQuery } from "@/lib/queries";
import { useStore } from "@/lib/store";
import { inr } from "@/lib/market";

export const Route = createFileRoute("/assistant")({
  head: () => ({
    meta: [
      { title: "AI shopping assistant — LocalLoop" },
      { name: "description", content: "Tell the assistant what you need and your budget; it picks real in-stock items from nearby shops." },
      { property: "og:title", content: "AI shopping assistant — LocalLoop" },
      { property: "og:description", content: "Ask in English or Tamil, get a real basket from nearby shops." },
    ],
  }),
  component: Assistant,
});

type Answer = Awaited<ReturnType<typeof shoppingAssistant>>;

function Assistant() {
  const ask = useServerFn(shoppingAssistant);
  const { data: products = [] } = useQuery(productsQuery);
  const { add } = useStore();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [ans, setAns] = useState<Answer | null>(null);

  async function go(text = msg) {
    if (!text.trim()) return;
    setBusy(true);
    try { setAns(await ask({ data: { message: text } })); }
    catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  }
  const rows = (ans?.items ?? []).map((i: { id: string; quantity: number; why: string }) => ({ ...i, p: products.find((p) => p.id === i.id) })).filter((r) => r.p);
  const total = rows.reduce((a, r) => a + Number(r.p!.price) * r.quantity, 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warm text-primary-foreground"><Bot className="h-6 w-6" /></span>
        <div><h1 className="text-3xl font-extrabold">Loop, your shopping helper</h1><p className="text-muted-foreground">Picks only real, in-stock items from nearby shops. English or தமிழ்.</p></div>
      </div>
      <div className="mt-6 rounded-2xl border bg-card p-3">
        <Textarea autoFocus value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="I need ingredients for biryani under ₹500" className="border-0 shadow-none focus-visible:ring-0"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(); } }} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {["Biryani ingredients under ₹500", "Snacks for evening tea", "பிறந்தநாள் கேக் வேண்டும்"].map((s) => (
              <button key={s} onClick={() => { setMsg(s); go(s); }} className="rounded-full bg-muted px-3 py-1 text-xs">{s}</button>
            ))}
          </div>
          <Button onClick={() => go()} disabled={busy}><Send className="h-4 w-4" />{busy ? "Thinking…" : "Ask"}</Button>
        </div>
      </div>
      {ans && (
        <div className="mt-6 space-y-3">
          <p className="rounded-2xl bg-accent p-4 text-accent-foreground">{ans.reply}</p>
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
              <div className="flex-1">
                <Link to="/products/$id" params={{ id: r.id }} className="font-semibold">{r.quantity} × {r.p!.name}</Link>
                <div className="text-xs text-muted-foreground">{r.p!.shop?.name} · {r.why}</div>
              </div>
              <span className="font-semibold">{inr(Number(r.p!.price) * r.quantity)}</span>
            </div>
          ))}
          {ans.missing.length > 0 && <p className="text-sm text-muted-foreground">Not available nearby: {ans.missing.join(", ")}</p>}
          {rows.length > 0 && (
            <div className="flex items-center justify-between rounded-2xl bg-secondary p-4 text-secondary-foreground">
              <span className="text-lg font-bold">Basket: {inr(total)}</span>
              <Button onClick={() => { rows.forEach((r) => add({ product_id: r.id, shop_id: r.p!.shop_id, shop_name: r.p!.shop?.name ?? "", name: r.p!.name, price: Number(r.p!.price), unit: r.p!.unit, stock: r.p!.stock }, r.quantity)); toast.success("Added to cart"); }}>Add all to cart</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
