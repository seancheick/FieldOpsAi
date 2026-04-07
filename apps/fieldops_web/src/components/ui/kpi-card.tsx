"use client";

import * as React from "react";
import { ResponsiveContainer, AreaChart, Area } from "recharts";

import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: number | string;
  trend?: "up" | "down" | "flat";
  sparkData?: { value: number }[];
  sparkColor?: string;
  icon?: React.ReactNode;
  subtitle?: string;
  href?: string;
  className?: string;
}

function KpiCard({
  title,
  value,
  trend,
  sparkData,
  sparkColor = "#334155",
  icon,
  subtitle,
  href,
  className,
}: KpiCardProps) {
  const trendArrow =
    trend === "up" ? (
      <span className="text-green-500">&#8593;</span>
    ) : trend === "down" ? (
      <span className="text-red-500">&#8595;</span>
    ) : null;

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
      <div className="flex items-center gap-2">
        <span className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          {value}
        </span>
        {trendArrow}
      </div>
      {subtitle && (
        <div className="mt-1 text-[11px] text-slate-400">{subtitle}</div>
      )}
      {sparkData && sparkData.length > 0 && (
        <div className="mt-2 h-8 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData}>
              <Area
                type="monotone"
                dataKey="value"
                stroke={sparkColor}
                fill={sparkColor}
                fillOpacity={0.1}
                strokeWidth={1.5}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
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
