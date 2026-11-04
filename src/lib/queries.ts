import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const PRODUCT_SELECT =
  "id,name,description,brand,unit,price,mrp,stock,rating,sold_count,image_url,created_at,category_id,shop_id,low_stock_threshold,active,shop:shops(id,name,area,lat,lng,rating,delivery_fee,free_delivery_above),category:categories(id,name,slug,icon)";

export type ProductRow = {
  id: string; name: string; description: string | null; brand: string | null; unit: string | null;
  price: number; mrp: number; stock: number; rating: number; sold_count: number; image_url: string | null;
  created_at: string; category_id: string | null; shop_id: string; low_stock_threshold: number; active: boolean;
  shop: { id: string; name: string; area: string | null; lat: number | null; lng: number | null; rating: number; delivery_fee: number; free_delivery_above: number } | null;
  category: { id: string; name: string; slug: string; icon: string | null } | null;
};

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: async () => {
    const { data, error } = await supabase.from("categories").select("*").order("sort");
    if (error) throw error;
    return data;
  },
});

export const productsQuery = queryOptions({
  queryKey: ["products"],
  queryFn: async () => {
    const { data, error } = await supabase.from("products").select(PRODUCT_SELECT).eq("active", true).limit(500);
    if (error) throw error;
    return data as unknown as ProductRow[];
  },
});

export const shopsQuery = queryOptions({
  queryKey: ["shops"],
  queryFn: async () => {
    const { data, error } = await supabase.from("shops").select("*, category:categories(name,icon)").eq("status", "approved");
    if (error) throw error;
    return data;
  },
});
