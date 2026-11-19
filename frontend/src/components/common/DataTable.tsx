import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { STRINGS_GU } from '../../constants/stringsGu';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  width?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  pageSize?: number;
  emptyMessage?: string;
  keyExtractor: (row: T) => string;
}

export function DataTable<T>({
  columns,
  data,
  pageSize = 10,
  emptyMessage = STRINGS_GU.table.noData,
  keyExtractor,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(data.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = data.slice(startIndex, startIndex + pageSize);

  const handlePrev = () => setCurrentPage((p) => Math.max(1, p - 1));
  const handleNext = () => setCurrentPage((p) => Math.min(totalPages, p + 1));

  if (data.length === 0) {
    return (
      <div className="py-10 px-4 text-center bg-white rounded-xl border border-[#E2E8F0]">
        <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-xs font-medium text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-800">
          <thead className="bg-[#F8FAFB] text-[11px] font-semibold text-slate-500 border-b border-[#E2E8F0] uppercase tracking-wider">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-2.5 font-medium" style={{ width: col.width }}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0] text-xs">
            {paginatedData.map((row) => (
              <tr key={keyExtractor(row)} className="hover:bg-slate-50/70 transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-2.5 text-xs text-slate-700">
                    {col.render
                      ? col.render(row)
                      : (row as Record<string, unknown>)[col.key] != null
                      ? String((row as Record<string, unknown>)[col.key])
                      : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Linear-Style Pagination Footer */}
      <div className="px-4 py-2 bg-[#F8FAFB] border-t border-[#E2E8F0] flex items-center justify-between text-[11px] text-slate-500 font-medium">
        <span>
          {STRINGS_GU.table.totalRows} <strong className="text-slate-800 font-mono">{data.length}</strong>
        </span>
        <div className="flex items-center gap-3">
          <span>
            {STRINGS_GU.table.page} <strong className="text-slate-800 font-mono">{currentPage}</strong> /{' '}
            <strong className="text-slate-800 font-mono">{totalPages}</strong>
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              disabled={currentPage <= 1}
              className="p-1 rounded border border-[#E2E8F0] bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title={STRINGS_GU.table.prev}
            >
              <ChevronLeft className="w-3.5 h-3.5 text-slate-700" />
            </button>
            <button
              onClick={handleNext}
              disabled={currentPage >= totalPages}
              className="p-1 rounded border border-[#E2E8F0] bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title={STRINGS_GU.table.next}
            >
              <ChevronRight className="w-3.5 h-3.5 text-slate-700" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
