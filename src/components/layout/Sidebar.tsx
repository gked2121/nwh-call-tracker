"use client";

import { useState } from "react";
import Image from "next/image";
import {
  LayoutDashboard,
  Users,
  Phone,
  Settings,
  Upload,
  ChevronLeft,
  ChevronRight,
  Target,
  Megaphone,
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  hasResults: boolean;
}

const navItems = [
  { id: "upload", label: "Upload & Analyze", icon: Upload, requiresResults: false },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, requiresResults: true },
  { id: "calls", label: "Call Details", icon: Phone, requiresResults: true },
  { id: "reps", label: "Rep Performance", icon: Users, requiresResults: true },
  { id: "leads", label: "Lead Source Scores", icon: Target, requiresResults: true },
  { id: "sources", label: "Lead Sources", icon: Megaphone, requiresResults: true },
];

export default function Sidebar({ activeTab, onTabChange, hasResults }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-white z-30 transition-all duration-300 flex flex-col border-r border-[#e2e8f0] ${
        collapsed ? "w-[72px]" : "w-[260px]"
      }`}
    >
      {/* Logo */}
      <div className="h-[72px] flex items-center px-4 border-b border-[#e2e8f0]">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden">
            <Image
              src="/logo.webp"
              alt="Nationwide Haul"
              fill
              className="object-contain"
              priority
            />
          </div>
          {!collapsed && (
            <div>
              <h1 className="font-semibold text-[#0f172a] text-base tracking-tight leading-tight">Nationwide Haul</h1>
              <p className="text-xs text-[#94a3b8]">Call Analytics</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="space-y-1">
          {navItems.map((item) => {
            const isDisabled = item.requiresResults && !hasResults;
            const isActive = activeTab === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => !isDisabled && onTabChange(item.id)}
                disabled={isDisabled}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                  isActive
                    ? "bg-[#0f172a] text-white"
                    : isDisabled
                    ? "text-[#cbd5e1] cursor-not-allowed"
                    : "text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${collapsed ? "mx-auto" : ""} ${isActive ? "" : "group-hover:scale-105 transition-transform"}`} />
                {!collapsed && (
                  <span className="font-medium text-sm">{item.label}</span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Settings at bottom */}
      <div className="px-3 py-3 border-t border-[#e2e8f0]">
        <button
          onClick={() => onTabChange("settings")}
          title={collapsed ? "Settings" : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
            activeTab === "settings"
              ? "bg-[#0f172a] text-white"
              : "text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
          }`}
        >
          <Settings className={`w-5 h-5 flex-shrink-0 ${collapsed ? "mx-auto" : ""} ${activeTab === "settings" ? "" : "group-hover:scale-105 transition-transform"}`} />
          {!collapsed && <span className="font-medium text-sm">Settings</span>}
        </button>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-[80px] w-6 h-6 bg-white border border-[#e2e8f0] rounded-full flex items-center justify-center shadow-sm hover:shadow-md hover:border-[#cbd5e1] transition-all"
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3 text-[#64748b]" />
        ) : (
          <ChevronLeft className="w-3 h-3 text-[#64748b]" />
        )}
      </button>
    </aside>
  );
}
