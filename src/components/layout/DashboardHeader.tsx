"use client";

import { Bell, Search, ChevronDown } from "lucide-react";

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  aiModel?: "claude" | "openai";
}

export default function DashboardHeader({ title, subtitle, aiModel }: DashboardHeaderProps) {
  return (
    <header className="h-[80px] bg-white/80 backdrop-blur-md sticky top-0 z-20 border-b border-[#edf2f7]">
      <div className="h-full px-8 flex items-center justify-between">
        {/* Left: Page Title */}
        <div>
          <h1 className="text-2xl font-bold text-[#1B254B]">{title}</h1>
          {subtitle && <p className="text-sm text-[#a0aec0]">{subtitle}</p>}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a0aec0]" />
            <input
              type="text"
              placeholder="Search..."
              className="w-[200px] h-10 pl-11 pr-4 bg-[#F4F7FE] rounded-full text-sm text-[#1B254B] placeholder-[#a0aec0] border-none focus:outline-none focus:ring-2 focus:ring-[#422AFB]/20"
            />
          </div>

          {/* AI Model Badge */}
          {aiModel && (
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-[#F4F7FE] rounded-full">
              <div className={`w-2 h-2 rounded-full ${aiModel === "claude" ? "bg-[#422AFB]" : "bg-[#10a37f]"}`} />
              <span className="text-sm font-medium text-[#1B254B]">
                {aiModel === "claude" ? "Claude Sonnet 4.5" : "GPT-4.1"}
              </span>
            </div>
          )}

          {/* Notifications */}
          <button className="relative p-2 hover:bg-[#F4F7FE] rounded-full transition-colors">
            <Bell className="w-5 h-5 text-[#718096]" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-[#E31A1A] rounded-full" />
          </button>

          {/* User Avatar */}
          <button className="flex items-center gap-2 p-1.5 hover:bg-[#F4F7FE] rounded-full transition-colors">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7551FF] to-[#422AFB] flex items-center justify-center">
              <span className="text-white font-semibold text-sm">NW</span>
            </div>
            <ChevronDown className="w-4 h-4 text-[#718096] hidden sm:block" />
          </button>
        </div>
      </div>
    </header>
  );
}
