"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

interface StaffMember {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  is_active: boolean;
  metadata: Record<string, unknown>;
}

interface EditingStaff {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  driverLicense: string;
  address: string;
  notes: string;
  isActive: boolean;
}

const ROLES = [
  { value: "worker", label: "Worker", description: "Clock in, photos, tasks" },
  {
    value: "foreman",
    label: "Foreman",
    description: "Worker + crew oversight, shift reports",
  },
  {
    value: "supervisor",
    label: "Supervisor",
    description: "Full dashboard access, approvals, reports",
  },
  {
    value: "admin",
    label: "Admin",
    description: "Everything + company settings, billing",
  },
];

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditingStaff | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadStaff = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { data } = await supabase
        .from("users")
        .select("id, full_name, email, phone, role, is_active, metadata")
        .order("full_name");
      setStaff((data as StaffMember[]) ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  function startEdit(member: StaffMember) {
    const meta = (member.metadata ?? {}) as Record<string, string>;
    setEditing({
      id: member.id,
      fullName: member.full_name,
      email: member.email ?? "",
      phone: member.phone ?? "",
      role: member.role,
      driverLicense: meta.driver_license ?? "",
      address: meta.address ?? "",
      notes: meta.notes ?? "",
      isActive: member.is_active,
    });
    setShowAdd(false);
  }

  function startAdd() {
    setEditing({
      id: "",
      fullName: "",
      email: "",
      phone: "",
      role: "worker",
      driverLicense: "",
      address: "",
      notes: "",
      isActive: true,
    });
    setShowAdd(true);
  }

  async function saveStaff() {
    if (!editing) return;

    // TODO: Call Supabase to update/insert user record
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setEditing(null);
      setShowAdd(false);
      loadStaff();
    }, 1500);
  }

  const activeCount = staff.filter((s) => s.is_active).length;
  const roleLabel = (role: string) =>
    ROLES.find((r) => r.value === role)?.label ?? role;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Staff Management
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {activeCount} active · {staff.length} total
          </p>
        </div>
        <button
          onClick={startAdd}
          className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
        >
          + Add Staff
        </button>
      </div>

      <div className="flex gap-6">
        {/* Staff List */}
        <div className="flex-1">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-stone-200 border-t-slate-900" />
              Loading staff...
            </div>
          )}

          {!loading && staff.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-stone-200 bg-white p-10 text-center">
              <p className="text-sm text-slate-400">No staff members yet.</p>
              <button
                onClick={startAdd}
                className="mt-3 rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
              >
                + Add First Staff Member
              </button>
            </div>
          )}

          <div className="space-y-2">
            {staff.map((member) => {
              const isSelected = editing?.id === member.id;
              return (
                <button
                  key={member.id}
                  onClick={() => startEdit(member)}
                  className={`w-full rounded-xl border p-4 text-left transition-all ${
                    isSelected
                      ? "border-slate-900 bg-slate-50 shadow-sm"
                      : "border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {member.full_name}
                        </span>
                        {!member.is_active && (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-500">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        {member.email ?? member.phone ?? "No contact"}
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                        member.role === "admin"
                          ? "bg-purple-50 text-purple-600"
                          : member.role === "supervisor"
                            ? "bg-blue-50 text-blue-600"
                            : member.role === "foreman"
                              ? "bg-amber-50 text-amber-600"
                              : "bg-stone-100 text-slate-500"
                      }`}
                    >
                      {roleLabel(member.role)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Edit Panel */}
        {editing && (
          <div className="w-96 flex-shrink-0">
            <div className="sticky top-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                  {showAdd ? "Add Staff" : "Edit Staff"}
                </h2>
                <button
                  onClick={() => {
                    setEditing(null);
                    setShowAdd(false);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Close
                </button>
              </div>

              <div className="space-y-4">
                <EditField
                  label="Full Name"
                  value={editing.fullName}
                  onChange={(v) => setEditing({ ...editing, fullName: v })}
                  required
                />
                <EditField
                  label="Email"
                  value={editing.email}
                  onChange={(v) => setEditing({ ...editing, email: v })}
                  type="email"
                />
                <EditField
                  label="Phone"
                  value={editing.phone}
                  onChange={(v) => setEditing({ ...editing, phone: v })}
                  type="tel"
                />
                <EditField
                  label="Address"
                  value={editing.address}
                  onChange={(v) => setEditing({ ...editing, address: v })}
                  placeholder="Optional"
                />
                <EditField
                  label="Driver License #"
                  value={editing.driverLicense}
                  onChange={(v) =>
                    setEditing({ ...editing, driverLicense: v })
                  }
                  placeholder="Optional"
                />
                <EditField
                  label="Notes"
                  value={editing.notes}
                  onChange={(v) => setEditing({ ...editing, notes: v })}
                  placeholder="e.g. Speaks Spanish, certified electrician"
                />

                {/* Role selector */}
                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-600">
                    Permission Level
                  </label>
                  <div className="space-y-2">
                    {ROLES.map((role) => (
                      <button
                        key={role.value}
                        onClick={() =>
                          setEditing({ ...editing, role: role.value })
                        }
                        className={`w-full rounded-lg border p-3 text-left transition-all ${
                          editing.role === role.value
                            ? "border-slate-900 bg-slate-50"
                            : "border-stone-200 hover:border-stone-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-900">
                            {role.label}
                          </span>
                          {editing.role === role.value && (
                            <span className="text-xs font-bold text-slate-900">
                              ✓
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {role.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active toggle */}
                {!showAdd && (
                  <div className="flex items-center justify-between rounded-lg border border-stone-200 p-3">
                    <div>
                      <span className="text-sm font-medium text-slate-700">
                        Active Status
                      </span>
                      <p className="text-[11px] text-slate-400">
                        Inactive workers cannot clock in or access the app.
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        setEditing({
                          ...editing,
                          isActive: !editing.isActive,
                        })
                      }
                      className={`relative h-6 w-11 rounded-full transition-colors ${
                        editing.isActive ? "bg-green-500" : "bg-stone-300"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                          editing.isActive
                            ? "translate-x-5"
                            : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>
                )}

                <div className="pt-2">
                  {saved && (
                    <p className="mb-2 text-center text-sm font-medium text-green-600">
                      Saved
                    </p>
                  )}
                  <button
                    onClick={saveStaff}
                    disabled={!editing.fullName.trim()}
                    className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-40"
                  >
                    {showAdd ? "Add Staff Member" : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-600">
        {label}
        {required && <span className="text-red-400"> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm transition-colors focus:border-slate-900 focus:bg-white focus:outline-none"
      />
    </div>
  );
}
