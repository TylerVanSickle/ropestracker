import { supabaseAdmin } from "./supabaseAdmin";

export async function getSiteIdOrThrow() {
  const slug = process.env.ROPES_SITE_SLUG || "main";
  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from("ropes_sites")
    .select("id, slug")
    .eq("slug", slug)
    .single();

  if (error || !data?.id) {
    throw new Error(`Site not found for slug "${slug}"`);
  }

  return data.id;
}
