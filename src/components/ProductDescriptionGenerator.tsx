import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { describeProduct } from "@/lib/ai.functions";

export function ProductDescriptionGenerator({ name, category, brand, unit, onApply }: {
  name: string; category: string; brand: string; unit: string; onApply: (description: string) => void;
}) {
  const generate = useServerFn(describeProduct);
  const [details, setDetails] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState("");
  const input = { name: name.trim(), category, details: [details.trim(), brand && `Brand: ${brand}`, unit && `Unit: ${unit}`].filter(Boolean).join("\n") };
  const currentSource = JSON.stringify(input);
  const currentDraft = source === currentSource;

  async function write() {
    setBusy(true);
    setError("");
    try {
      const result = await generate({ data: input });
      setDraft(result.description);
      setSource(currentSource);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate a description. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-3 border-t pt-3">
    <div><Label htmlFor="product-key-details">Key details</Label>
      <Textarea id="product-key-details" rows={3} maxLength={1000} value={details} disabled={busy} onChange={(e) => setDetails(e.target.value)} placeholder="Features, material, flavour, size, or intended use" />
    </div>
    <Button type="button" variant="outline" disabled={busy || !input.name || !category || !details.trim()} onClick={write}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Sparkles className="h-4 w-4" />}
      {busy ? "Writing…" : draft ? "Generate again" : "Generate description"}
    </Button>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {draft && currentDraft && <div className="space-y-2">
      <Label htmlFor="generated-description">AI draft</Label>
      <Textarea id="generated-description" rows={4} maxLength={3000} disabled={busy} value={draft} onChange={(e) => setDraft(e.target.value)} />
      <Button type="button" size="sm" disabled={busy || !draft.trim()} onClick={() => onApply(draft.trim())}><Check className="h-4 w-4" />Use description</Button>
    </div>}
  </div>;
}