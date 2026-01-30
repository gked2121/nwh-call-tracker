"use client";

import { Sparkles, Cpu } from "lucide-react";

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  aiModel?: "claude" | "openai";
}

export default function DashboardHeader({ title, subtitle, aiModel }: DashboardHeaderProps) {
  return (
    <header className="h-[72px] bg-white/90 backdrop-blur-lg sticky top-0 z-20 border-b border-[#e2e8f0]">
      <div className="h-full px-8 flex items-center justify-between">
        {/* Left: Page Title */}
        <div>
          <h1 className="text-xl font-semibold text-[#0f172a] tracking-tight">{title}</h1>
          {subtitle && (
            <p className="text-sm text-[#64748b] mt-0.5">{subtitle}</p>
          )}
        </div>

        {/* Right: AI Model Badge */}
        {aiModel && (
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-colors ${
            aiModel === "claude"
              ? "bg-[#f8fafc] border-[#e2e8f0] text-[#0f172a]"
              : "bg-[#ecfdf5] border-[#a7f3d0] text-[#059669]"
          }`}>
            {aiModel === "claude" ? (
              <Sparkles className="w-4 h-4" />
            ) : (
              <Cpu className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">
              {aiModel === "claude" ? "Claude Sonnet 4.5" : "GPT-4.1"}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
