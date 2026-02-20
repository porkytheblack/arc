import { useState, useMemo, useCallback } from "react";
import { SAGE, CREAM, FONTS, SEMANTIC } from "../lib/theme";
import { save } from "@tauri-apps/plugin-dialog";
import { downloadDir, join } from "@tauri-apps/api/path";
import { writeFile } from "../lib/commands";
import { Download } from "lucide-react";

type CellValue = string | number | boolean | null;

export interface DataTableProps {
  columns: string[];
  rows: CellValue[][];
  pageSize?: number;
  style?: React.CSSProperties;
}

export function DataTable({ columns, rows, pageSize = 25, style }: DataTableProps) {
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);

  const handleSort = (col: number) => {
    if (sortCol === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
    setPage(0);
  };

  const sortedRows = useMemo(() => {
    if (sortCol === null) return rows;
    return [...rows].sort((a, b) => {
      const aVal = a[sortCol];
      const bVal = b[sortCol];
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const pagedRows = sortedRows.slice(page * pageSize, (page + 1) * pageSize);
  const [exportingMode, setExportingMode] = useState<"downloads" | "save-as" | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const buildCsvFileName = () => {
    const now = new Date();
    const pad = (v: number) => String(v).padStart(2, "0");
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    return `arc-export-${stamp}.csv`;
  };

  const buildCsv = useCallback(() => {
    const escapeCsvField = (val: unknown): string => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    const header = columns.map(escapeCsvField).join(",");
    const body = rows.map((row) => row.map(escapeCsvField).join(",")).join("\n");
    return header + "\n" + body;
  }, [columns, rows]);

  const handleExportToDownloads = useCallback(async () => {
    if (exportingMode || columns.length === 0) return;
    setExportingMode("downloads");
    setExportNotice(null);
    try {
      const downloadsPath = await downloadDir();
      const fileName = buildCsvFileName();
      const filePath = await join(downloadsPath, fileName);
      await writeFile(filePath, buildCsv());
      setExportNotice(`Exported to Downloads as ${fileName}`);
    } catch {
      setExportNotice("Failed to export CSV to Downloads");
    } finally {
      setExportingMode(null);
    }
  }, [columns.length, exportingMode, buildCsv]);

  const handleSaveAsCsv = useCallback(async () => {
    if (exportingMode || columns.length === 0) return;
    setExportingMode("save-as");
    setExportNotice(null);
    try {
      let defaultPath = "export.csv";
      try {
        defaultPath = await join(await downloadDir(), "export.csv");
      } catch {
        // Fallback to plain filename if Downloads path resolution fails.
      }

      const filePath = await save({
        defaultPath,
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });
      if (!filePath) return;
      await writeFile(filePath, buildCsv());
      setExportNotice("CSV exported");
    } catch {
      setExportNotice("Failed to export CSV");
    } finally {
      setExportingMode(null);
    }
  }, [columns.length, exportingMode, buildCsv]);

  if (columns.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: "center",
          border: `1px solid ${SAGE[100]}`,
          background: CREAM[50],
          ...style,
        }}
      >
        <span style={{ fontFamily: FONTS.body, fontSize: 13, color: SAGE[400] }}>
          No data to display
        </span>
      </div>
    );
  }

  return (
    <div style={{ ...style }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ minHeight: 16 }}>
          {exportNotice && (
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 10,
                color: SAGE[500],
              }}
            >
              {exportNotice}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={handleExportToDownloads}
            disabled={Boolean(exportingMode)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              border: `1px solid ${SAGE[300]}`,
              background: SAGE[50],
              fontFamily: FONTS.mono,
              fontSize: 11,
              color: exportingMode ? SAGE[300] : SAGE[700],
              cursor: exportingMode ? "default" : "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <Download size={11} />
            {exportingMode === "downloads" ? "Exporting..." : "Export CSV"}
          </button>
          <button
            onClick={handleSaveAsCsv}
            disabled={Boolean(exportingMode)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              border: `1px solid ${SAGE[200]}`,
              background: CREAM[50],
              fontFamily: FONTS.mono,
              fontSize: 11,
              color: exportingMode ? SAGE[300] : SAGE[600],
              cursor: exportingMode ? "default" : "pointer",
              transition: "all 0.15s ease",
            }}
          >
            Save As
          </button>
        </div>
      </div>
      <div
        style={{
          border: `1px solid ${SAGE[100]}`,
          overflow: "auto",
          background: CREAM[50],
          maxHeight: 400,
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: FONTS.mono,
            fontSize: 13,
          }}
        >
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th
                  key={i}
                  onClick={() => handleSort(i)}
                  style={{
                    padding: "10px 16px",
                    textAlign: "left",
                    fontFamily: FONTS.body,
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: SAGE[500],
                    borderBottom: `1px solid ${SAGE[100]}`,
                    background: SAGE[50],
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    userSelect: "none",
                    position: "sticky",
                    top: 0,
                    zIndex: 1,
                  }}
                >
                  {col}
                  {sortCol === i && (
                    <span style={{ marginLeft: 4, fontSize: 9 }}>
                      {sortDir === "asc" ? "\u25B2" : "\u25BC"}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    padding: 24,
                    textAlign: "center",
                    fontFamily: FONTS.body,
                    fontSize: 13,
                    color: SAGE[400],
                  }}
                >
                  No rows returned
                </td>
              </tr>
            ) : (
              pagedRows.map((row, ri) => (
                <tr
                  key={ri}
                  style={{ transition: "background 0.15s ease" }}
                  onMouseEnter={(e: React.MouseEvent<HTMLTableRowElement>) =>
                    (e.currentTarget.style.background = CREAM[100])
                  }
                  onMouseLeave={(e: React.MouseEvent<HTMLTableRowElement>) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      style={{
                        padding: "8px 16px",
                        color: cell === null ? SAGE[300] : SAGE[700],
                        borderBottom: `1px solid ${SAGE[50]}`,
                        whiteSpace: "nowrap",
                        fontStyle: cell === null ? "italic" : "normal",
                      }}
                    >
                      {cell === null ? (
                        "NULL"
                      ) : typeof cell === "boolean" ? (
                        <span
                          style={{
                            color: cell ? SEMANTIC.success : SAGE[300],
                            fontSize: 11,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          {cell ? "true" : "false"}
                        </span>
                      ) : typeof cell === "number" ? (
                        <span style={{ fontVariantNumeric: "tabular-nums" }}>
                          {cell.toLocaleString()}
                        </span>
                      ) : (
                        String(cell)
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {sortedRows.length > pageSize && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 0",
            marginTop: 4,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 11,
              color: SAGE[400],
            }}
          >
            {page * pageSize + 1}--{Math.min((page + 1) * pageSize, sortedRows.length)} of{" "}
            {sortedRows.length} rows
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              style={{
                padding: "4px 10px",
                border: `1px solid ${SAGE[200]}`,
                background: page === 0 ? CREAM[100] : CREAM[50],
                fontFamily: FONTS.mono,
                fontSize: 11,
                color: page === 0 ? SAGE[300] : SAGE[700],
                cursor: page === 0 ? "default" : "pointer",
              }}
            >
              Prev
            </button>
            <span
              style={{
                padding: "4px 8px",
                fontFamily: FONTS.mono,
                fontSize: 11,
                color: SAGE[500],
              }}
            >
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              style={{
                padding: "4px 10px",
                border: `1px solid ${SAGE[200]}`,
                background: page >= totalPages - 1 ? CREAM[100] : CREAM[50],
                fontFamily: FONTS.mono,
                fontSize: 11,
                color: page >= totalPages - 1 ? SAGE[300] : SAGE[700],
                cursor: page >= totalPages - 1 ? "default" : "pointer",
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
