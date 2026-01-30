"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface Column<T> {
  key: keyof T | string;
  title: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
}

export default function DataTable<T extends { id?: string | number }>({
  columns,
  data,
  onRowClick,
  emptyMessage = "No data available",
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = (column: Column<T>) => {
    if (!column.sortable) return;

    const key = column.key as string;
    if (sortColumn === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(key);
      setSortDirection("asc");
    }
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortColumn) return 0;

    const aVal = (a as Record<string, unknown>)[sortColumn];
    const bVal = (b as Record<string, unknown>)[sortColumn];

    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    }

    const aStr = String(aVal || "");
    const bStr = String(bVal || "");
    return sortDirection === "asc"
      ? aStr.localeCompare(bStr)
      : bStr.localeCompare(aStr);
  });

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-[#f1f5f9]">
        <p className="text-[#94a3b8]">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-[#f1f5f9] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
              {columns.map((column) => (
                <th
                  key={column.key as string}
                  onClick={() => handleSort(column)}
                  className={`px-6 py-4 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider ${
                    column.sortable ? "cursor-pointer hover:text-[#0f172a] transition-colors" : ""
                  }`}
                  style={{ width: column.width }}
                >
                  <div className="flex items-center gap-2">
                    {column.title}
                    {column.sortable && sortColumn === column.key && (
                      sortDirection === "asc" ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {sortedData.map((item, index) => (
              <tr
                key={item.id || index}
                onClick={() => onRowClick?.(item)}
                className={`transition-colors ${
                  onRowClick
                    ? "cursor-pointer hover:bg-[#f8fafc]"
                    : ""
                }`}
              >
                {columns.map((column) => (
                  <td
                    key={column.key as string}
                    className="px-6 py-4 text-sm text-[#1e293b]"
                  >
                    {column.render
                      ? column.render(item)
                      : String((item as Record<string, unknown>)[column.key as string] || "-")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Score badge component
export function ScoreBadge({ score }: { score: number }) {
  const getScoreStyle = (score: number) => {
    if (score >= 8) return "bg-gradient-to-br from-[#10b981] to-[#059669] text-white shadow-[0_2px_8px_rgba(16,185,129,0.3)]";
    if (score >= 6) return "bg-gradient-to-br from-[#0ea5e9] to-[#0284c7] text-white shadow-[0_2px_8px_rgba(14,165,233,0.3)]";
    if (score >= 4) return "bg-gradient-to-br from-[#f59e0b] to-[#d97706] text-white shadow-[0_2px_8px_rgba(245,158,11,0.3)]";
    return "bg-gradient-to-br from-[#ef4444] to-[#dc2626] text-white shadow-[0_2px_8px_rgba(239,68,68,0.3)]";
  };

  return (
    <span className={`inline-flex items-center justify-center w-11 h-11 rounded-xl font-bold text-sm ${getScoreStyle(score)}`}>
      {score.toFixed(1)}
    </span>
  );
}

// Status badge component
export function StatusBadge({ status, variant }: { status: string; variant: "success" | "warning" | "error" | "info" }) {
  const variants = {
    success: "bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]",
    warning: "bg-[#fffbeb] text-[#d97706] border border-[#fde68a]",
    error: "bg-[#fef2f2] text-[#dc2626] border border-[#fecaca]",
    info: "bg-[#f0f9ff] text-[#0284c7] border border-[#bae6fd]",
  };

  return (
    <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${variants[variant]}`}>
      {status}
    </span>
  );
}
