import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data: admins, error } = await supabase
      .from("platform_admins")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      admins: admins ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { email, full_name } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Admin email is required" },
        { status: 400 }
      );
    }

    // Generate random invite token
    const token =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);

    // Insert into platform_admins directly
    const { data: newAdmin, error } = await supabase
      .from("platform_admins")
      .insert({
        email: email.trim().toLowerCase(),
        full_name: full_name || "Super Admin",
        role: "platform_admin",
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      admin: newAdmin,
      claim_token: token,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
