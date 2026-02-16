import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { getSiteIdOrThrow } from "@/app/lib/ropesSite";

export const runtime = "nodejs";

/**
 * Public (kiosk) read-only state for /client
 * - No staff cookie required
 * - Uses service role server-side so client does NOT need RLS / anon DB reads
 */
export async function GET() {
  try {
    const sb = supabaseAdmin();
    const siteId = await getSiteIdOrThrow();

    const [{ data: settings, error: se }, { data: entries, error: ee }] =
      await Promise.all([
        sb.from("ropes_settings").select("*").eq("site_id", siteId).single(),
        sb
          .from("ropes_entries_live")
          .select("*")
          .eq("site_id", siteId)
          .order("queue_order", { ascending: true })
          .order("created_at", { ascending: true }),
      ]);

    if (se) throw se;
    if (ee) throw ee;

    return NextResponse.json({ ok: true, settings, entries });
  } catch (err) {
    const status = err?.status || 500;
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to load state." },
      { status },
    );
  }
}
