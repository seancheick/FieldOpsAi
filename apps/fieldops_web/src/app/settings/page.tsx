"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";

const INDUSTRY_VALUES = [
  "electrical",
  "construction",
  "plumbing",
  "hvac",
  "telecom",
  "solar",
  "landscaping",
  "other",
] as const;

const TIMEZONE_VALUES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Africa/Abidjan",
  "Asia/Bangkok",
  "Asia/Shanghai",
] as const;

export default function CompanySettingsPage() {
  const { t } = useI18n();
  const [companyName, setCompanyName] = useState("Test Company");
  const [logoUrl, setLogoUrl] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [industry, setIndustry] = useState("electrical");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">
        {t("settingsPage.title")}
      </h1>
      <p className="mt-1 text-sm text-slate-400">{t("settingsPage.subtitle")}</p>

      <div className="mt-8 space-y-6">
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-sm font-bold uppercase tracking-wider text-slate-400">
            {t("settingsPage.companyInformation")}
          </h2>

          <div className="space-y-4">
            <Field
              label={t("settingsPage.companyName")}
              value={companyName}
              onChange={setCompanyName}
              required
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  {t("settingsPage.industry")}
                </label>
                <select
                  value={industry}
                  onChange={(event) => setIndustry(event.target.value)}
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm focus:border-slate-900 focus:bg-white focus:outline-none"
                >
                  {INDUSTRY_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {t(`commonOptions.industries.${value}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  {t("settingsPage.timezone")}
                </label>
                <select
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm focus:border-slate-900 focus:bg-white focus:outline-none"
                >
                  {TIMEZONE_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {t(`commonOptions.timezones.${value}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Field
              label={t("settingsPage.companyAddress")}
              value={address}
              onChange={setAddress}
              placeholder={t("settingsPage.placeholders.address")}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t("settingsPage.companyPhone")}
                value={phone}
                onChange={setPhone}
                placeholder={t("settingsPage.placeholders.phone")}
                type="tel"
              />
              <Field
                label={t("settingsPage.companyEmail")}
                value={email}
                onChange={setEmail}
                placeholder={t("settingsPage.placeholders.email")}
                type="email"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-sm font-bold uppercase tracking-wider text-slate-400">
            {t("settingsPage.branding")}
          </h2>

          <div className="space-y-4">
            <Field
              label={t("settingsPage.logoUrl")}
              value={logoUrl}
              onChange={setLogoUrl}
              placeholder={t("settingsPage.placeholders.logoUrl")}
              hint={t("settingsPage.logoHint")}
            />

            {logoUrl && (
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
                  <img
                    src={logoUrl}
                    alt={t("settingsPage.logoPreviewAlt")}
                    className="h-full w-full object-contain"
                    onError={(event) => {
                      (event.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
                <span className="text-xs text-slate-400">{t("settingsPage.logoPreview")}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          {saved && <span className="text-sm font-medium text-green-600">{t("settingsPage.saved")}</span>}
          <button
            onClick={handleSave}
            className="ml-auto rounded-xl bg-slate-900 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            {t("settingsPage.saveChanges")}
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
  onChange: (value: string) => void;
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
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm transition-colors focus:border-slate-900 focus:bg-white focus:outline-none"
      />
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}
