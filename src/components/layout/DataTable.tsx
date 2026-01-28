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
      <div className="bg-white rounded-[20px] p-12 text-center shadow-sm">
        <p className="text-[#a0aec0]">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[20px] shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#edf2f7]">
              {columns.map((column) => (
                <th
                  key={column.key as string}
                  onClick={() => handleSort(column)}
                  className={`px-6 py-4 text-left text-xs font-semibold text-[#a0aec0] uppercase tracking-wider ${
                    column.sortable ? "cursor-pointer hover:text-[#422AFB]" : ""
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
          <tbody>
            {sortedData.map((item, index) => (
              <tr
                key={item.id || index}
                onClick={() => onRowClick?.(item)}
                className={`border-b border-[#edf2f7] last:border-0 transition-colors ${
                  onRowClick
                    ? "cursor-pointer hover:bg-[#F4F7FE]"
                    : ""
                }`}
              >
                {columns.map((column) => (
                  <td
                    key={column.key as string}
                    className="px-6 py-4 text-sm text-[#1B254B]"
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
    if (score >= 8) return "bg-[#E6FAF5] text-[#01B574]";
    if (score >= 6) return "bg-[#E9E3FF] text-[#422AFB]";
    if (score >= 4) return "bg-[#FFF6E5] text-[#FFB547]";
    return "bg-[#FFE5E5] text-[#E31A1A]";
  };

  return (
    <span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl font-bold text-sm ${getScoreStyle(score)}`}>
      {score.toFixed(1)}
    </span>
  );
}

// Status badge component
export function StatusBadge({ status, variant }: { status: string; variant: "success" | "warning" | "error" | "info" }) {
  const variants = {
    success: "bg-[#E6FAF5] text-[#01B574]",
    warning: "bg-[#FFF6E5] text-[#FFB547]",
    error: "bg-[#FFE5E5] text-[#E31A1A]",
    info: "bg-[#E9E3FF] text-[#422AFB]",
  };

  return (
    <span className={`inline-flex px-3 py-1 rounded-lg text-xs font-semibold ${variants[variant]}`}>
      {status}
    </span>
  );
}
