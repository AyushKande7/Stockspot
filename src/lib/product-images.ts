import { supabase } from "@/integrations/supabase/client";

const BUCKET = "product-images";
const PATH_PREFIX = `${BUCKET}/`;

export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function isProductImagePath(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PATH_PREFIX);
}

/** Validate a chosen image file; returns an error message or null when valid. */
export function validateProductImage(file: File): string | null {
  if (!(file.type in IMAGE_TYPES)) return "Use a JPG, PNG, WebP or GIF photo.";
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) return "Photo must be smaller than 5 MB.";
  return null;
}

/** Storage path (inside the bucket) for a new upload, namespaced by store. */
export function productImageUploadPath(storeId: string, file: File): string {
  const ext = IMAGE_TYPES[file.type] ?? "jpg";
  return `${storeId}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

/**
 * Sign product image paths once for the whole list.
 * Returns a map of full path ("product-images/...") to a temporary view URL.
 */
export async function signProductImagePaths(
  paths: string[],
  ttlSeconds = 3600,
): Promise<Map<string, string>> {
  const signed = new Map<string, string>();
  const unique = [...new Set(paths.filter(isProductImagePath))];
  if (unique.length === 0) return signed;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(unique.map((path) => path.slice(PATH_PREFIX.length)), ttlSeconds);
  if (error || !data) return signed;
  for (const entry of data) {
    const original = unique.find((path) => path.endsWith(entry.path));
    if (entry.signedUrl && original) signed.set(original, entry.signedUrl);
  }
  return signed;
}
