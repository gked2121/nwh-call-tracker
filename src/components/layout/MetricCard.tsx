"use client";

import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  onClick?: () => void;
}

export default function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconBg = "bg-[#F4F7FE]",
  iconColor = "text-[#0f172a]",
  trend,
  trendValue,
  onClick,
}: MetricCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-300 border border-[#f1f5f9] ${
        onClick ? "cursor-pointer hover:-translate-y-0.5" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-[#64748b] tracking-wide uppercase mb-2">{title}</p>
          <div className="flex items-baseline gap-3">
            <h3 className="text-4xl font-bold text-[#0f172a] tracking-tight">{value}</h3>
            {trend && trendValue && (
              <div
                className={`flex items-center gap-1 text-sm font-semibold px-2 py-0.5 rounded-full ${
                  trend === "up"
                    ? "text-[#059669] bg-[#d1fae5]"
                    : trend === "down"
                    ? "text-[#dc2626] bg-[#fee2e2]"
                    : "text-[#64748b] bg-[#f1f5f9]"
                }`}
              >
                {trend === "up" ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : trend === "down" ? (
                  <TrendingDown className="w-3.5 h-3.5" />
                ) : (
                  <Minus className="w-3.5 h-3.5" />
                )}
                <span>{trendValue}</span>
              </div>
            )}
          </div>
          {subtitle && (
            <p className="text-sm text-[#64748b] mt-2">{subtitle}</p>
          )}
        </div>
        <div className={`p-3.5 rounded-2xl ${iconBg} transition-transform duration-300 group-hover:scale-105`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}

// Mini version for secondary stats
export function MiniMetricCard({
  title,
  value,
  icon: Icon,
  color = "brand",
}: {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: "brand" | "success" | "warning" | "error";
}) {
  const colors = {
    brand: { bg: "bg-[#f1f5f9]", icon: "text-[#0f172a]" },
    success: { bg: "bg-[#d1fae5]", icon: "text-[#059669]" },
    warning: { bg: "bg-[#fef3c7]", icon: "text-[#d97706]" },
    error: { bg: "bg-[#fee2e2]", icon: "text-[#dc2626]" },
  };

  return (
    <div className="flex items-center gap-4 bg-white rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-[#f1f5f9] hover:shadow-md transition-all duration-200">
      <div className={`p-3 rounded-xl ${colors[color].bg}`}>
        <Icon className={`w-5 h-5 ${colors[color].icon}`} />
      </div>
      <div>
        <p className="text-sm text-[#64748b] font-medium">{title}</p>
        <p className="text-xl font-bold text-[#0f172a]">{value}</p>
      </div>
    </div>
  );
}
