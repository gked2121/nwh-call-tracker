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
  iconColor = "text-[#422AFB]",
  trend,
  trendValue,
  onClick,
}: MetricCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-[20px] p-6 shadow-sm hover:shadow-md transition-all duration-300 ${
        onClick ? "cursor-pointer hover:-translate-y-1" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-[#a0aec0] mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-bold text-[#1B254B]">{value}</h3>
            {trend && trendValue && (
              <div
                className={`flex items-center gap-1 text-sm font-medium ${
                  trend === "up"
                    ? "text-[#01B574]"
                    : trend === "down"
                    ? "text-[#E31A1A]"
                    : "text-[#a0aec0]"
                }`}
              >
                {trend === "up" ? (
                  <TrendingUp className="w-4 h-4" />
                ) : trend === "down" ? (
                  <TrendingDown className="w-4 h-4" />
                ) : (
                  <Minus className="w-4 h-4" />
                )}
                <span>{trendValue}</span>
              </div>
            )}
          </div>
          {subtitle && (
            <p className="text-sm text-[#718096] mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${iconBg}`}>
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
    brand: { bg: "bg-[#E9E3FF]", icon: "text-[#422AFB]" },
    success: { bg: "bg-[#E6FAF5]", icon: "text-[#01B574]" },
    warning: { bg: "bg-[#FFF6E5]", icon: "text-[#FFB547]" },
    error: { bg: "bg-[#FFE5E5]", icon: "text-[#E31A1A]" },
  };

  return (
    <div className="flex items-center gap-4 bg-white rounded-2xl p-4 shadow-sm">
      <div className={`p-3 rounded-xl ${colors[color].bg}`}>
        <Icon className={`w-5 h-5 ${colors[color].icon}`} />
      </div>
      <div>
        <p className="text-sm text-[#a0aec0]">{title}</p>
        <p className="text-xl font-bold text-[#1B254B]">{value}</p>
      </div>
    </div>
  );
}
