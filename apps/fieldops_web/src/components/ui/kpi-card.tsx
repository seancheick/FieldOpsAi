"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: number | string;
  icon?: React.ReactNode;
  subtitle?: string;
  href?: string;
  className?: string;
}

function KpiCard({
  title,
  value,
  icon,
  subtitle,
  href,
  className,
}: KpiCardProps) {
  const content = (
    <div
      data-slot="kpi-card"
      className={cn(
        "rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition-all hover:border-stone-300 hover:shadow-md",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
        {icon && <span className="shrink-0">{icon}</span>}
        <span>{title}</span>
      </div>
      <span className="mt-1 block text-3xl font-bold tracking-tight tabular-nums text-slate-900">
        {value}
      </span>
      {subtitle && (
        <div className="mt-1 text-[11px] text-slate-400">{subtitle}</div>
      )}
    </div>
  );

  if (href) {
    return <a href={href}>{content}</a>;
  }

  return content;
}

export { KpiCard };
export type { KpiCardProps };
