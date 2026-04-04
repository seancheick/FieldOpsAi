"use client";

import { useState } from "react";

interface WorkerEntry {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
}

const STEPS = [
  { title: "Company", description: "Basic company information" },
  { title: "Team", description: "Add your workers" },
  { title: "First Job", description: "Create your first job site" },
  { title: "Go Live", description: "Start tracking" },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [companyName, setCompanyName] = useState("");
  const [companyLogo, setCompanyLogo] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [industry, setIndustry] = useState("electrical");
  const [workers, setWorkers] = useState<WorkerEntry[]>([]);
  const [jobName, setJobName] = useState("");
  const [jobAddress, setJobAddress] = useState("");
  const [jobCode, setJobCode] = useState("");

  function addWorker() {
    setWorkers((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        address: "",
        notes: "",
      },
    ]);
  }

  function updateWorker(id: string, field: keyof WorkerEntry, value: string) {
    setWorkers((prev) =>
      prev.map((w) => (w.id === id ? { ...w, [field]: value } : w)),
    );
  }

  function removeWorker(id: string) {
    setWorkers((prev) => prev.filter((w) => w.id !== id));
  }

  const canProceedStep0 = companyName.trim().length > 0;
  const canProceedStep1 = workers.length > 0 && workers.every((w) => w.firstName.trim());
  const canProceedStep2 = jobName.trim().length > 0;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center">
              <button
                onClick={() => i < step && setStep(i)}
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all ${
                  i === step
                    ? "bg-slate-900 text-white shadow-md ring-4 ring-slate-900/10"
                    : i < step
                      ? "bg-green-500 text-white"
                      : "bg-stone-200 text-stone-400"
                }`}
              >
                {i < step ? "✓" : i + 1}
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className={`mx-2 h-0.5 w-12 sm:w-20 ${
                    i < step ? "bg-green-500" : "bg-stone-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-4">
          <h2 className="text-xl font-bold text-slate-900">
            {STEPS[step].title}
          </h2>
          <p className="text-sm text-slate-500">{STEPS[step].description}</p>
        </div>
      </div>

      {/* Step 0: Company */}
      {step === 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Company Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Apex Electrical"
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm transition-colors focus:border-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/5"
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Industry
                </label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm focus:border-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/5"
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
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm focus:border-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/5"
                >
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="America/Anchorage">Alaska (AKT)</option>
                  <option value="Pacific/Honolulu">Hawaii (HST)</option>
                  <option value="Europe/London">London (GMT)</option>
                  <option value="Europe/Paris">Paris (CET)</option>
                  <option value="Africa/Abidjan">West Africa (WAT)</option>
                  <option value="Asia/Bangkok">Bangkok (ICT)</option>
                  <option value="Asia/Shanghai">Shanghai (CST)</option>
                  <option value="Asia/Dubai">Dubai (GST)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Logo URL <span className="text-slate-400">(optional)</span>
              </label>
              <input
                type="url"
                value={companyLogo}
                onChange={(e) => setCompanyLogo(e.target.value)}
                placeholder="https://yoursite.com/logo.png"
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm focus:border-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/5"
              />
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={() => setStep(1)}
              disabled={!canProceedStep0}
              className="rounded-xl bg-slate-900 px-8 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Add Workers */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">
              {workers.length} worker{workers.length !== 1 ? "s" : ""} added
            </span>
            <button
              onClick={addWorker}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800"
            >
              + Add Worker
            </button>
          </div>

          {workers.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-stone-200 bg-white p-12 text-center">
              <div className="text-3xl text-stone-300">👷</div>
              <p className="mt-3 text-sm font-medium text-slate-500">
                No workers yet
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Click &quot;+ Add Worker&quot; to start building your team.
              </p>
              <button
                onClick={addWorker}
                className="mt-5 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
              >
                + Add First Worker
              </button>
            </div>
          )}

          {workers.map((worker, index) => (
            <div
              key={worker.id}
              className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">
                  Worker {index + 1}
                </span>
                <button
                  onClick={() => removeWorker(worker.id)}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  Remove
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    First Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={worker.firstName}
                    onChange={(e) =>
                      updateWorker(worker.id, "firstName", e.target.value)
                    }
                    placeholder="John"
                    className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm focus:border-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={worker.lastName}
                    onChange={(e) =>
                      updateWorker(worker.id, "lastName", e.target.value)
                    }
                    placeholder="Smith"
                    className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm focus:border-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Email
                  </label>
                  <input
                    type="email"
                    value={worker.email}
                    onChange={(e) =>
                      updateWorker(worker.id, "email", e.target.value)
                    }
                    placeholder="john@company.com"
                    className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm focus:border-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={worker.phone}
                    onChange={(e) =>
                      updateWorker(worker.id, "phone", e.target.value)
                    }
                    placeholder="+1 555-0100"
                    className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm focus:border-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Address <span className="text-slate-300">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={worker.address}
                    onChange={(e) =>
                      updateWorker(worker.id, "address", e.target.value)
                    }
                    placeholder="123 Main St"
                    className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm focus:border-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Notes <span className="text-slate-300">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={worker.notes}
                    onChange={(e) =>
                      updateWorker(worker.id, "notes", e.target.value)
                    }
                    placeholder="e.g. Electrician, speaks Spanish"
                    className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm focus:border-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
            </div>
          ))}

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setStep(0)}
              className="rounded-xl px-6 py-3 text-sm font-semibold text-slate-500 hover:bg-stone-100"
            >
              Back
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={!canProceedStep1}
              className="rounded-xl bg-slate-900 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Create First Job */}
      {step === 2 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Job Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                placeholder="e.g. Grid Restoration — Phase 1"
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm focus:border-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/5"
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Job Code
                </label>
                <input
                  type="text"
                  value={jobCode}
                  onChange={(e) => setJobCode(e.target.value)}
                  placeholder="JOB-001"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm focus:border-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/5"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Site Address
                </label>
                <input
                  type="text"
                  value={jobAddress}
                  onChange={(e) => setJobAddress(e.target.value)}
                  placeholder="123 Main St, Boston, MA"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm focus:border-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/5"
                />
              </div>
            </div>

            {workers.length > 0 && (
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Assign Workers
                </label>
                <div className="flex flex-wrap gap-2">
                  {workers.map((w) => (
                    <span
                      key={w.id}
                      className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-slate-600"
                    >
                      {w.firstName} {w.lastName}
                    </span>
                  ))}
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  All {workers.length} workers will be assigned to this job.
                </p>
              </div>
            )}
          </div>

          <div className="mt-8 flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="rounded-xl px-6 py-3 text-sm font-semibold text-slate-500 hover:bg-stone-100"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!canProceedStep2}
              className="rounded-xl bg-slate-900 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Go Live */}
      {step === 3 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50">
            <span className="text-3xl">✓</span>
          </div>
          <h3 className="mt-5 text-2xl font-bold text-slate-900">
            {companyName} is ready
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            {workers.length} worker{workers.length !== 1 ? "s" : ""} added
            &middot; 1 job created &middot; Ready for first clock-in
          </p>

          <div className="mx-auto mt-8 max-w-md rounded-xl bg-stone-50 p-5 text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Next steps
            </p>
            <ol className="mt-3 space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                  1
                </span>
                Share the app download link with your crew
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                  2
                </span>
                Workers sign in and clock in at the job site
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                  3
                </span>
                Open the Live Map to see them in real-time
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                  4
                </span>
                Check the Photo Feed for proof photos
              </li>
            </ol>
          </div>

          <div className="mt-8 flex justify-center gap-3">
            <a
              href="/map"
              className="rounded-xl bg-slate-900 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              Open Live Map
            </a>
            <a
              href="/"
              className="rounded-xl bg-stone-100 px-8 py-3 text-sm font-semibold text-slate-600 hover:bg-stone-200"
            >
              Go to Dashboard
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
