ALTER TABLE public.inventory_items ADD COLUMN image_url text;

COMMENT ON COLUMN public.inventory_items.image_url IS 'Optional storage object path (product-images bucket) of a product photo uploaded by the store owner.';

CREATE POLICY "Product images are publicly viewable"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'product-images');

CREATE POLICY "Store owners upload their product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.owner_id = auth.uid()
      AND s.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Store owners update their product images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.owner_id = auth.uid()
      AND s.id::text = (storage.foldername(name))[1]
  )
)
WITH CHECK (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.owner_id = auth.uid()
      AND s.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Store owners delete their product images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.owner_id = auth.uid()
      AND s.id::text = (storage.foldername(name))[1]
  )
);