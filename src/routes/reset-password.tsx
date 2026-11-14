import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — LocalLoop" },
      { name: "description", content: "Choose a new password for your LocalLoop account." },
      { property: "og:title", content: "Reset password — LocalLoop" },
      { property: "og:description", content: "Reset your password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Reset,
});

function Reset() {
  const [pw, setPw] = useState("");
  const navigate = useNavigate();
  return (
    <form
      className="mx-auto max-w-md space-y-3 px-4 py-16"
      onSubmit={async (e) => {
        e.preventDefault();
        const { error } = await supabase.auth.updateUser({ password: pw });
        if (error) return toast.error(error.message);
        toast.success("Password updated");
        navigate({ to: "/" });
      }}
    >
      <h1 className="text-2xl font-bold">Set a new password</h1>
      <Input type="password" minLength={6} required value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" />
      <Button className="w-full">Update password</Button>
    </form>
  );
}
