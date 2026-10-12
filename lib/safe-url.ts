/**
 * True only for images stored in this project's Supabase Storage.
 * Profile fields can be written straight to the API, so any image URL
 * from the database is checked before it reaches next/image. Without this,
 * a URL pointing at an unconfigured host would make the page error out.
 */
export function isStorageImageUrl(value: unknown): value is string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || typeof value !== "string") return false;

  return value.startsWith(`${base.replace(/\/$/, "")}/storage/v1/object/public/`);
}