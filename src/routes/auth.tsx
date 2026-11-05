import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — LocalLoop" },
      { name: "description", content: "Sign in or create a LocalLoop account as a customer or shop owner." },
      { property: "og:title", content: "Sign in — LocalLoop" },
      { property: "og:description", content: "Join LocalLoop." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("customer");
  const [busy, setBusy] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/" });
  }
  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin, data: { full_name: name, account_type: type } },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (data.session) navigate({ to: type === "shop_owner" ? "/shop" : "/" });
    else toast.success("Check your email to confirm your account.");
  }
  async function forgot() {
    if (!email) return toast.error("Enter your email first");
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) toast.error(error.message);
    else toast.success("Password reset link sent.");
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-center text-3xl font-extrabold">Welcome to LocalLoop</h1>
      <Tabs defaultValue="signin" className="mt-6">
        <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="signin">Sign in</TabsTrigger><TabsTrigger value="signup">Create account</TabsTrigger></TabsList>
        <TabsContent value="signin">
          <form onSubmit={signIn} className="space-y-3 rounded-2xl border bg-card p-5">
            <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label>Password</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <Button className="w-full" disabled={busy}>Sign in</Button>
            <button type="button" onClick={forgot} className="w-full text-sm text-primary">Forgot password?</button>
          </form>
        </TabsContent>
        <TabsContent value="signup">
          <form onSubmit={signUp} className="space-y-3 rounded-2xl border bg-card p-5">
            <div><Label>Full name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label>Password</Label><Input type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <RadioGroup value={type} onValueChange={setType} className="grid grid-cols-2 gap-2">
              {[["customer", "I'm shopping"], ["shop_owner", "I own a shop"]].map(([v, l]) => (
                <Label key={v} className="flex cursor-pointer items-center gap-2 rounded-xl border p-3"><RadioGroupItem value={v} />{l}</Label>
              ))}
            </RadioGroup>
            <Button className="w-full" disabled={busy}>Create account</Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
