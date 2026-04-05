"use client";

import { useState } from "react";

export default function CompanySettingsPage() {
  const [companyName, setCompanyName] = useState("Test Company");
  const [logoUrl, setLogoUrl] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [industry, setIndustry] = useState("electrical");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(false);

  function handleSave() {
    // TODO: Save to Supabase companies table
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">
        Company Settings
      </h1>
      <p className="mt-1 text-sm text-slate-400">
        Manage your company information and preferences.
      </p>

      <div className="mt-8 space-y-6">
        {/* Company Info Card */}
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-sm font-bold uppercase tracking-wider text-slate-400">
            Company Information
          </h2>

          <div className="space-y-4">
            <Field
              label="Company Name"
              value={companyName}
              onChange={setCompanyName}
              required
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Industry
                </label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm focus:border-slate-900 focus:bg-white focus:outline-none"
                >
                  <option value="electrical">Electrical</option>
                  <option value="construction">General Construction</option>
                  <option value="plumbing">Plumbing</option>
                  <option value="hvac">HVAC</option>
                  <option value="telecom">Telecom / Infrastructure</option>
                  <option value="solar">Solar / Renewable</option>
                  <option value="landscaping">Landscaping</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm focus:border-slate-900 focus:bg-white focus:outline-none"
                >
                  <option value="America/New_York">Eastern (ET)</option>
                  <option value="America/Chicago">Central (CT)</option>
                  <option value="America/Denver">Mountain (MT)</option>
                  <option value="America/Los_Angeles">Pacific (PT)</option>
                  <option value="Europe/London">London (GMT)</option>
                  <option value="Europe/Paris">Paris (CET)</option>
                  <option value="Africa/Abidjan">West Africa (WAT)</option>
                  <option value="Asia/Bangkok">Bangkok (ICT)</option>
                  <option value="Asia/Shanghai">Shanghai (CST)</option>
                </select>
              </div>
            </div>

            <Field label="Company Address" value={address} onChange={setAddress} placeholder="123 Main St, Boston, MA" />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Company Phone" value={phone} onChange={setPhone} placeholder="+1 555-0100" type="tel" />
              <Field label="Company Email" value={email} onChange={setEmail} placeholder="office@company.com" type="email" />
            </div>
          </div>
        </div>

        {/* Branding Card */}
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-sm font-bold uppercase tracking-wider text-slate-400">
            Branding
          </h2>

          <div className="space-y-4">
            <Field
              label="Logo URL"
              value={logoUrl}
              onChange={setLogoUrl}
              placeholder="https://yoursite.com/logo.png"
              hint="Used on proof stamps, reports, and the dashboard."
            />

            {logoUrl && (
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
                  <img
                    src={logoUrl}
                    alt="Company logo preview"
                    className="h-full w-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
                <span className="text-xs text-slate-400">Logo preview</span>
              </div>
            )}
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center justify-between">
          {saved && (
            <span className="text-sm font-medium text-green-600">
              Settings saved
            </span>
          )}
          <button
            onClick={handleSave}
            className="ml-auto rounded-xl bg-slate-900 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
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
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}
