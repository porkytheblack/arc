import { useState, useEffect } from "react";
import { SAGE, CREAM, FONTS } from "../lib/theme";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Badge } from "../components/Badge";
import { scanQueries } from "../lib/commands";
import type { ScanResult } from "../lib/commands";
import { Search, FileCode, AlertCircle } from "lucide-react";

type BadgeVariant = "default" | "success" | "warning" | "error";

function queryTypeBadgeVariant(queryType: string): BadgeVariant {
  switch (queryType) {
    case "SELECT":
      return "success";
    case "INSERT":
    case "UPDATE":
      return "warning";
    case "DELETE":
    case "DROP":
    case "ALTER":
      return "error";
    default:
      return "default";
  }
}

function shortenPath(filePath: string): string {
  const parts = filePath.split("/");
  if (parts.length <= 4) {
    return filePath;
  }
  return ".../" + parts.slice(-3).join("/");
}

export function QueryScanner() {
  const [directoryPath, setDirectoryPath] = useState("");
  const [results, setResults] = useState<ScanResult[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasScanned, setHasScanned] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleScan = async () => {
    const trimmed = directoryPath.trim();
    if (!trimmed) {
      setError("Please enter a directory path");
      return;
    }

    setScanning(true);
    setError(null);
    setResults([]);
    setHasScanned(false);

    try {
      const scanResults = await scanQueries(trimmed);
      setResults(scanResults);
      setHasScanned(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : typeof err === "string" ? err : "An unexpected error occurred during scanning";
      setError(message);
    } finally {
      setScanning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !scanning) {
      handleScan();
    }
  };

  return (
    <div
      style={{
        flex: 1,
        overflow: "auto",
        padding: 24,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        transition: "all 0.35s ease",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Search controls */}
        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }} onKeyDown={handleKeyDown}>
              <Input
                value={directoryPath}
                onChange={setDirectoryPath}
                placeholder="/path/to/your/project"
                label="Directory Path"
              />
            </div>
            <Button
              onClick={handleScan}
              disabled={scanning}
              size="md"
            >
              <Search size={14} />
              {scanning ? "Scanning..." : "Scan"}
            </Button>
          </div>
          <p
            style={{
              fontFamily: FONTS.mono,
              fontSize: 11,
              color: SAGE[400],
              margin: "12px 0 0",
            }}
          >
            Scans .rs, .ts, .tsx, .js, .jsx, .py, .go, .java, .rb files for SQL patterns
          </p>
        </Card>

        {/* Error display */}
        {error && (
          <Card style={{ marginBottom: 24, borderColor: "#c45c5c" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <AlertCircle size={16} color="#c45c5c" />
              <span
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 14,
                  color: "#c45c5c",
                }}
              >
                {error}
              </span>
            </div>
          </Card>
        )}

        {/* Results summary */}
        {hasScanned && !error && (
          <div
            style={{
              marginBottom: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontFamily: FONTS.body,
                fontSize: 13,
                fontWeight: 600,
                color: SAGE[900],
              }}
            >
              {results.length === 0
                ? "No SQL queries found"
                : `Found ${results.length} SQL ${results.length === 1 ? "query" : "queries"}`}
            </span>
            {results.length > 0 && (
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 10,
                  color: SAGE[400],
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                {new Set(results.map((r) => r.file_path)).size} files
              </span>
            )}
          </div>
        )}

        {/* Results list */}
        {results.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {results.map((result, index) => (
              <ResultCard key={`${result.file_path}-${result.line_number}-${index}`} result={result} index={index} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!hasScanned && !scanning && !error && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 64,
              gap: 16,
            }}
          >
            <FileCode size={40} color={SAGE[200]} strokeWidth={1} />
            <span
              style={{
                fontFamily: FONTS.body,
                fontSize: 14,
                color: SAGE[400],
              }}
            >
              Enter a directory path and click Scan to find SQL queries in your codebase
            </span>
          </div>
        )}

        {/* Scanning indicator */}
        {scanning && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 64,
              gap: 16,
            }}
          >
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
            <span
              style={{
                fontFamily: FONTS.body,
                fontSize: 14,
                color: SAGE[400],
              }}
            >
              Scanning directory for SQL patterns...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultCard({ result, index }: { result: ScanResult; index: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30 + index * 20);
    return () => clearTimeout(t);
  }, [index]);

  return (
    <Card
      style={{
        padding: 16,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        transition: "all 0.3s ease",
      }}
    >
      {/* Header: file path + line number + badge */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0, flex: 1 }}>
          <FileCode size={14} color={SAGE[400]} style={{ flexShrink: 0 }} />
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 12,
              color: SAGE[700],
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={result.file_path}
          >
            {shortenPath(result.file_path)}
          </span>
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 11,
              color: SAGE[400],
              flexShrink: 0,
            }}
          >
            L{result.line_number}
          </span>
        </div>
        <Badge variant={queryTypeBadgeVariant(result.query_type)}>
          {result.query_type}
        </Badge>
      </div>

      {/* SQL snippet */}
      <div
        style={{
          background: CREAM[200],
          padding: "10px 12px",
          overflow: "auto",
        }}
      >
        <code
          style={{
            fontFamily: FONTS.mono,
            fontSize: 12,
            color: SAGE[800],
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            lineHeight: 1.5,
          }}
        >
          {result.query_snippet}
        </code>
      </div>
    </Card>
  );
}
