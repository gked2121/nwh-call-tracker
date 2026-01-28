"use client";

import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Phone,
  BarChart3,
  Settings,
  Upload,
  ChevronLeft,
  ChevronRight,
  Target,
  TrendingUp,
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
  { id: "leads", label: "Lead Scores", icon: Target, requiresResults: true },
  { id: "trends", label: "Trends", icon: TrendingUp, requiresResults: true },
];

export default function Sidebar({ activeTab, onTabChange, hasResults }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-white z-30 transition-all duration-300 flex flex-col shadow-xl ${
        collapsed ? "w-[80px]" : "w-[280px]"
      }`}
    >
      {/* Logo */}
      <div className="h-[80px] flex items-center px-6 border-b border-[#edf2f7]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7551FF] to-[#422AFB] flex items-center justify-center shadow-lg shadow-[#422AFB]/25">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="font-bold text-[#1B254B] text-lg tracking-tight">NWH</h1>
              <p className="text-xs text-[#a0aec0]">Call Analytics</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 overflow-y-auto">
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
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-gradient-to-r from-[#7551FF] to-[#422AFB] text-white shadow-lg shadow-[#422AFB]/30"
                    : isDisabled
                    ? "text-[#cbd5e0] cursor-not-allowed"
                    : "text-[#718096] hover:bg-[#F4F7FE] hover:text-[#422AFB]"
                }`}
              >
                <Icon className={`w-5 h-5 ${collapsed ? "mx-auto" : ""}`} />
                {!collapsed && (
                  <span className="font-medium text-sm">{item.label}</span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Settings at bottom */}
      <div className="px-4 py-4 border-t border-[#edf2f7]">
        <button
          onClick={() => onTabChange("settings")}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
            activeTab === "settings"
              ? "bg-gradient-to-r from-[#7551FF] to-[#422AFB] text-white shadow-lg shadow-[#422AFB]/30"
              : "text-[#718096] hover:bg-[#F4F7FE] hover:text-[#422AFB]"
          }`}
        >
          <Settings className={`w-5 h-5 ${collapsed ? "mx-auto" : ""}`} />
          {!collapsed && <span className="font-medium text-sm">Settings</span>}
        </button>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-[90px] w-6 h-6 bg-white border border-[#e2e8f0] rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-shadow"
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3 text-[#718096]" />
        ) : (
          <ChevronLeft className="w-3 h-3 text-[#718096]" />
        )}
      </button>
    </aside>
  );
}
