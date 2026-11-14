import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateChatCompletion, GatewayError } from "@lovable.dev/ai-gateway";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { descriptionInput, descriptionOutput, descriptionMessages } from "@/lib/product-description";

const MODEL = "google/gemini-3.8-flash" as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
async function askJson(system: string, user: string): Promise<Json> {
  try {
    const res = await generateChatCompletion({
      model: MODEL,
      messages: [
        { role: "system", content: system + "\nRespond ONLY with a JSON object." },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    });
    const text = res.choices?.[0]?.message?.content;
    const raw = typeof text === "string" ? text : "";
    return JSON.parse(raw.replace(/^```json\s*|```$/g, ""));
  } catch (e) {
    if (e instanceof GatewayError) {
      if (e.httpStatus === 429) throw new Error("The assistant is busy — try again in a minute.");
      if (e.httpStatus === 402) throw new Error("AI credits are exhausted for this workspace.");
    }
    throw new Error("The assistant couldn't answer right now.");
  }
}

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/** Customer shopping assistant: only recommends products that exist in the database. */
export const shoppingAssistant = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ message: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: products } = await sb
      .from("products")
      .select("id,name,brand,unit,price,stock,shop:shops(name,area)")
      .eq("active", true)
      .gt("stock", 0)
      .limit(300);
    const catalog = ((products ?? []) as Json[]).map((p: Json) => ({ id: p.id, n: p.name, b: p.brand, u: p.unit, price: Number(p.price), shop: p.shop?.name }));
    const out = await askJson(
      `You are LocalLoop's shopping assistant for local shops in Chennai. Reply in the user's language (English or Tamil).
Only recommend items from this CATALOG (in-stock only). Never invent products, prices or shops. Respect any budget. If something needed isn't available, say so in "missing".
CATALOG: ${JSON.stringify(catalog)}
JSON shape: {"reply": string, "items": [{"id": string, "quantity": number, "why": string}], "missing": string[]}`,
      data.message,
    );
    const valid = new Map(catalog.map((c) => [c.id, c]));
    const items = (Array.isArray(out.items) ? out.items : [])
      .filter((i: { id?: string }) => i?.id && valid.has(i.id))
      .map((i: { id: string; quantity?: number; why?: string }) => ({ id: i.id, quantity: Math.max(1, Math.round(i.quantity ?? 1)), why: String(i.why ?? "") })) as { id: string; quantity: number; why: string }[];
    return { reply: String(out.reply ?? ""), items, missing: Array.isArray(out.missing) ? out.missing.map(String) : [] };
  });

/** Shop inventory assistant: interprets a command into a proposed action; the UI confirms before executing. */
export const inventoryAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ shopId: z.string().uuid(), command: z.string().min(1).max(400) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: products, error } = await context.supabase.from("products").select("id,name,price,stock,sold_count,unit").eq("shop_id", data.shopId);
    if (error) throw new Error(error.message);
    const r: { action: string; product_id: string | null; value: number | null; summary: string; answer: string } = await askJson(
      `You help a shopkeeper manage inventory. Their products: ${JSON.stringify(products)}.
Interpret the command into ONE action. Use only product ids from the list.
JSON shape: {"action": "add_stock"|"set_stock"|"set_price"|"query"|"unknown", "product_id": string|null, "value": number|null, "summary": string, "answer": string}
- add_stock: value = units to add. set_stock: new stock. set_price: new price in rupees.
- query: answer questions (low stock, best sellers) in "answer", using the data. Mention sold_count is all-time.
- summary: a one-line human description of the change for confirmation.`,
      data.command,
    );
    return { action: String(r.action ?? "unknown"), product_id: r.product_id ?? null, value: r.value == null ? null : Number(r.value), summary: String(r.summary ?? ""), answer: String(r.answer ?? "") };
  });

/** Product description generator for shop owners. */
export const describeProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => descriptionInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: owner, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "shop_owner" });
    if (error || !owner) throw new Error("A shop-owner account is required to generate product descriptions.");
    try {
      const response = await generateChatCompletion({ model: MODEL, messages: descriptionMessages(data), response_format: { type: "json_object" } });
      const message = response.choices?.[0]?.message;
      if (message?.refusal) throw new Error("The assistant cannot write a description for these details.");
      const text = message?.content;
      if (typeof text !== "string") throw new Error("No description returned");
      return descriptionOutput.parse(JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")));
    } catch (e) {
      if (e instanceof GatewayError) {
        console.error("Product description generation failed", { code: e.code, ids: e.ids });
        if (e.httpStatus === 429) throw new Error("The assistant is busy — try again in a minute.");
        if (e.httpStatus === 402) throw new Error("AI credits are exhausted for this workspace.");
        if (e.httpStatus === 403) throw new Error("AI generation is unavailable under this workspace’s settings.");
      }
      if (e instanceof Error && e.message === "The assistant cannot write a description for these details.") throw e;
      throw new Error("The assistant couldn't write a description right now. Your details have been kept.");
    }
  });
