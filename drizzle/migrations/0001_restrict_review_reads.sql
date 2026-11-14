DROP POLICY IF EXISTS "rev read" ON public.reviews;
CREATE POLICY "rev read" ON public.reviews FOR SELECT TO public USING (
  EXISTS (SELECT 1 FROM public.products p JOIN public.shops s ON s.id = p.shop_id
          WHERE p.id = reviews.product_id AND p.active AND s.status = 'approved'::shop_status)
  OR user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
);