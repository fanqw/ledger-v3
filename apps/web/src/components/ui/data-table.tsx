import { ReactNode } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./table";
import { Button } from "./button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface Column<T> {
  key: string;
  label: string;
  render?: (value: unknown, row: T) => ReactNode;
  width?: string;
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading,
  pagination,
  onPageChange,
}: DataTableProps<T>) {
  const totalPages = Math.ceil(pagination.total / pagination.pageSize);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-[13px] text-[#94A3B8]">
        暂无数据
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[#E2E8F0] dark:border-[#334155]">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key} style={{ width: col.width }}>
                {col.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, idx) => (
            <TableRow key={(row.id as string) || idx}>
              {columns.map((col) => (
                <TableCell key={col.key}>
                  {col.render
                    ? col.render(row[col.key], row)
                    : (row[col.key] as ReactNode) ?? "-"}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[#E2E8F0] px-4 py-3 dark:border-[#334155]">
          <span className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
            共 {pagination.total} 条
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="default"
              className="h-8 w-8 p-0"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(pagination.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Button
                key={p}
                variant={p === pagination.page ? "default" : "ghost"}
                size="default"
                className="h-8 w-8 p-0 text-[13px]"
                onClick={() => onPageChange(p)}
              >
                {p}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="default"
              className="h-8 w-8 p-0"
              disabled={pagination.page >= totalPages}
              onClick={() => onPageChange(pagination.page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
