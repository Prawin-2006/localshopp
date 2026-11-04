import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

export function useWishlist() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ["wishlist", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("wishlist").select("product_id");
      return new Set((data ?? []).map((r) => r.product_id));
    },
  });
  const m = useMutation({
    mutationFn: async (id: string) => {
      if (q.data?.has(id)) await supabase.from("wishlist").delete().eq("product_id", id).eq("user_id", user!.id);
      else await supabase.from("wishlist").insert({ product_id: id, user_id: user!.id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wishlist"] }),
  });
  return {
    has: (id: string) => !!q.data?.has(id),
    toggle: (id: string) => {
      if (!user) {
        toast("Sign in to save items to your wishlist");
        navigate({ to: "/auth" });
        return;
      }
      m.mutate(id);
    },
  };
}
