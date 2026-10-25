import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const supabase = getSupabaseAdmin();

    // Verify caller is a Platform Admin if authorization header provided
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        const isKnownSuper =
          user.email?.toLowerCase() === "mybbrllc@gmail.com" ||
          user.email?.toLowerCase() === "admin@test.com";

        if (!isKnownSuper) {
          const { data: adminRecord } = await supabase
            .from("platform_admins")
            .select("id")
            .eq("auth_user_id", user.id)
            .eq("is_active", true)
            .maybeSingle();

          if (!adminRecord) {
            return NextResponse.json(
              { error: "Forbidden: Not a platform administrator" },
              { status: 403 }
            );
          }
        }
      }
    }

    // Query all companies via company_summary view
    const { data: companies, error } = await supabase
      .from("company_summary")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const companyList = companies ?? [];

    // Calculate Platform SaaS Metrics
    let activeCount = 0;
    let trialingCount = 0;
    let pastDueCount = 0;
    let suspendedCount = 0;
    let totalUsers = 0;
    let estimatedMrr = 0;

    for (const c of companyList) {
      const isSuspended = c.status === "suspended";
      const paymentStatus = c.payment_status ?? "trialing";
      const users = c.active_user_count ?? 0;
      totalUsers += users;

      if (isSuspended) {
        suspendedCount++;
      } else if (paymentStatus === "active" || paymentStatus === "paid") {
        activeCount++;
        // SaaS pricing: Base tier $299/mo + $15 per worker seat
        estimatedMrr += 299 + users * 15;
      } else if (paymentStatus === "trialing") {
        trialingCount++;
      } else if (paymentStatus === "past_due") {
        pastDueCount++;
        // Count in MRR but flagged as pending
        estimatedMrr += 299 + users * 15;
      }
    }

    return NextResponse.json({
      companies: companyList,
      stats: {
        totalCompanies: companyList.length,
        activeCompanies: activeCount,
        trialingCompanies: trialingCount,
        pastDueCompanies: pastDueCount,
        suspendedCompanies: suspendedCount,
        totalUsers,
        estimatedMrr,
      },
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
    const { name, slug, industry, owner_email, owner_name } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: "Company name and slug are required" },
        { status: 400 }
      );
    }

    // 1. Insert Company
    const { data: newCompany, error: compErr } = await supabase
      .from("companies")
      .insert({
        name,
        slug,
        industry: industry || "general_contracting",
        status: "active",
        payment_status: "trialing",
        billing_mode: "demo",
      })
      .select()
      .single();

    if (compErr) {
      return NextResponse.json({ error: compErr.message }, { status: 400 });
    }

    let tempPassword = "";

    // 2. If owner email provided, create initial auth user
    if (owner_email) {
      tempPassword = "Pass" + Math.random().toString(36).substring(2, 10) + "!";
      const { data: authUser, error: authErr } =
        await supabase.auth.admin.createUser({
          email: owner_email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            full_name: owner_name || name + " Admin",
            company_id: newCompany.id,
          },
        });

      if (!authErr && authUser?.user) {
        // Link to users profile table
        await supabase.from("users").upsert({
          id: authUser.user.id,
          company_id: newCompany.id,
          email: owner_email,
          full_name: owner_name || name + " Admin",
          role: "owner",
        });
      }
    }

    return NextResponse.json({
      success: true,
      company: newCompany,
      owner_credentials: owner_email
        ? {
            email: owner_email,
            temp_password: tempPassword,
          }
        : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
