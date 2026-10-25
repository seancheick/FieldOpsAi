import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const [compRes, usersRes, auditRes] = await Promise.all([
      supabase.from("company_summary").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("users")
        .select("id, email, full_name, role, is_active, created_at")
        .eq("company_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("admin_audit_log")
        .select("*")
        .eq("company_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (!compRes.data) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    return NextResponse.json({
      company: compRes.data,
      users: usersRes.data ?? [],
      audit: auditRes.data ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !["active", "suspended"].includes(status)) {
      return NextResponse.json(
        { error: "Valid status ('active' or 'suspended') is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 1. Update company status
    const { data: updatedCompany, error: compErr } = await supabase
      .from("companies")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (compErr) {
      return NextResponse.json({ error: compErr.message }, { status: 400 });
    }

    // 2. Killswitch: If suspended, deactivate all company users; if active, reactivate
    const shouldBeActive = status === "active";
    await supabase
      .from("users")
      .update({ is_active: shouldBeActive })
      .eq("company_id", id);

    // 3. Log audit event
    await supabase.from("admin_audit_log").insert({
      company_id: id,
      action: status === "suspended" ? "company.suspend" : "company.reactivate",
      target_type: "company",
      target_id: id,
      after_json: { status, user_access_restored: shouldBeActive },
    });

    return NextResponse.json({
      success: true,
      company: updatedCompany,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
