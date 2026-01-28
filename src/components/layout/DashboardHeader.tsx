"use client";

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

        {/* Right: AI Model Badge */}
        {aiModel && (
          <div className="flex items-center gap-2 px-4 py-2 bg-[#F4F7FE] rounded-full">
            <div className={`w-2 h-2 rounded-full ${aiModel === "claude" ? "bg-[#422AFB]" : "bg-[#10a37f]"}`} />
            <span className="text-sm font-medium text-[#1B254B]">
              {aiModel === "claude" ? "Claude Sonnet 4.5" : "GPT-4.1"}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
