import { useState, useRef, useCallback } from "react";
import { SAGE, CREAM, FONTS } from "../lib/theme";
import { createCsvConnection, importCsv } from "../lib/commands";
import type { DatabaseConnection, QueryResult } from "../lib/commands";
import { DataTable } from "./DataTable";
import { Upload, X, FileSpreadsheet, CheckCircle } from "lucide-react";
import { Button } from "./Button";

interface CsvImportProps {
  projectId?: string;
  onImported?: (conn: DatabaseConnection) => void;
  onPreviewImported?: (result: QueryResult, tableName: string) => void;
}

export function CsvImport({ projectId, onImported, onPreviewImported }: CsvImportProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [connection, setConnection] = useState<DatabaseConnection | null>(null);
  const [previewResult, setPreviewResult] = useState<QueryResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      setError("Please select a CSV file");
      return;
    }

    setError(null);
    setImporting(true);
    setFileName(file.name);

    try {
      const content = await file.text();
      if (projectId) {
        // Connection mode: create SQLite DB and connection
        const conn = await createCsvConnection(content, file.name, projectId);
        setConnection(conn);
        onImported?.(conn);
      } else {
        // Preview mode: just parse and show preview
        const tableName = file.name.replace(/\.csv$/i, "").replace(/[^a-zA-Z0-9_]/g, "_");
        const result = await importCsv(content, tableName);
        setPreviewResult(result);
        onPreviewImported?.(result, tableName);
      }
    } catch (e) {
      setError(typeof e === "string" ? e : e instanceof Error ? e.message : "Failed to import CSV");
    }
    setImporting(false);
  }, [projectId, onImported, onPreviewImported]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleReset = useCallback(() => {
    setConnection(null);
    setPreviewResult(null);
    setFileName("");
    setError(null);
  }, []);

  const hasResult = connection || previewResult;

  return (
    <div style={{ marginBottom: 20 }}>
      {!hasResult ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragOver ? SAGE[500] : SAGE[200]}`,
            background: isDragOver ? SAGE[50] : CREAM[50],
            padding: 32,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileInput}
            style={{ display: "none" }}
          />
          {importing ? (
            <>
              <div style={{ display: "flex", gap: 4 }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 6,
                      height: 6,
                      background: SAGE[300],
                      borderRadius: "50%",
                      animation: `typingDot 1.2s ease-in-out ${i * 0.15}s infinite`,
                    }}
                  />
                ))}
              </div>
              <span style={{ fontFamily: FONTS.body, fontSize: 13, color: SAGE[500] }}>
                {projectId ? `Creating connection from ${fileName}...` : `Importing ${fileName}...`}
              </span>
            </>
          ) : (
            <>
              <Upload size={24} color={isDragOver ? SAGE[500] : SAGE[300]} />
              <span style={{ fontFamily: FONTS.body, fontSize: 14, color: SAGE[700] }}>
                Drop a CSV file here or click to browse
              </span>
              <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: SAGE[400], textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {projectId ? "Creates a queryable SQLite connection" : "CSV files only"}
              </span>
            </>
          )}
          {error && (
            <span style={{ fontFamily: FONTS.body, fontSize: 12, color: "#c45c5c" }}>
              {error}
            </span>
          )}
        </div>
      ) : connection ? (
        <div
          style={{
            background: CREAM[50],
            border: `1px solid ${SAGE[100]}`,
            padding: 20,
            animation: "slideUp 0.25s ease",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle size={16} color={SAGE[500]} />
              <span style={{ fontFamily: FONTS.body, fontSize: 13, fontWeight: 600, color: SAGE[900] }}>
                {fileName}
              </span>
              <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: SAGE[400] }}>
                Connection created
              </span>
            </div>
            <button
              onClick={handleReset}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
            >
              <X size={14} color={SAGE[400]} />
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FileSpreadsheet size={14} color={SAGE[400]} />
            <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: SAGE[600] }}>
              {connection.name} — SQLite connection ready
            </span>
          </div>
          <div style={{ marginTop: 12 }}>
            <Button size="sm" variant="secondary" onClick={handleReset}>
              Import another
            </Button>
          </div>
        </div>
      ) : previewResult ? (
        <div
          style={{
            background: CREAM[50],
            border: `1px solid ${SAGE[100]}`,
            padding: 20,
            animation: "slideUp 0.25s ease",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FileSpreadsheet size={16} color={SAGE[500]} />
              <span style={{ fontFamily: FONTS.body, fontSize: 13, fontWeight: 600, color: SAGE[900] }}>
                {fileName}
              </span>
              <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: SAGE[400] }}>
                {previewResult.row_count} rows, {previewResult.columns.length} columns
              </span>
            </div>
            <button
              onClick={handleReset}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
            >
              <X size={14} color={SAGE[400]} />
            </button>
          </div>
          <DataTable
            columns={previewResult.columns}
            rows={previewResult.rows.slice(0, 10) as (string | number | boolean | null)[][]}
          />
          {previewResult.row_count > 10 && (
            <div style={{ marginTop: 8 }}>
              <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: SAGE[400] }}>
                Showing 10 of {previewResult.row_count} rows
              </span>
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <Button size="sm" variant="secondary" onClick={handleReset}>
              Import another
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
