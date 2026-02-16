// src/app/api/archive/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const SITE_ID = process.env.NEXT_PUBLIC_ROPES_SITE_ID; // UUID from ropes_sites.id

export async function GET() {
  try {
    if (!SITE_ID) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_ROPES_SITE_ID" },
        { status: 500 },
      );
    }

    const { data, error } = await supabase
      .from("ropes_flag_archive")
      .select("*")
      .eq("site_id", SITE_ID)
      .order("archived_at", { ascending: false })
      .limit(300);

    if (error) throw error;

    return NextResponse.json({ records: data || [] });
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || "Failed to load archive" },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    if (!SITE_ID) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_ROPES_SITE_ID" },
        { status: 500 },
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Missing body" }, { status: 400 });
    }

    const reason = String(body.reason || "").trim();
    const archived_by =
      String(body.archivedBy || "top").toLowerCase() === "bottom"
        ? "bottom"
        : "top";

    const entry_snapshot = body.entrySnapshot ?? body.entry_snapshot;
    if (!entry_snapshot || typeof entry_snapshot !== "object") {
      return NextResponse.json(
        { error: "Missing entrySnapshot" },
        { status: 400 },
      );
    }

    const guest_notes = Array.isArray(body.guestNotes ?? body.guest_notes)
      ? (body.guestNotes ?? body.guest_notes)
      : [];

    const insertRow = {
      site_id: SITE_ID,
      archived_by,
      reason: reason || "Flagged", // keep non-empty
      entry_snapshot,
      guest_notes,
    };

    const { data, error } = await supabase
      .from("ropes_flag_archive")
      .insert(insertRow)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ record: data });
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || "Failed to archive" },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  try {
    if (!SITE_ID) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_ROPES_SITE_ID" },
        { status: 500 },
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const { error } = await supabase
      .from("ropes_flag_archive")
      .delete()
      .eq("id", id)
      .eq("site_id", SITE_ID);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || "Failed to delete record" },
      { status: 500 },
    );
  }
}
