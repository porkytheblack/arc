import { useState, useEffect } from "react";
import { SAGE, CREAM, FONTS, SEMANTIC } from "../lib/theme";
import { Button } from "./Button";
import { AlertTriangle } from "lucide-react";

export interface ConfirmDialogProps {
  title: string;
  description: string;
  sql: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  description,
  sql,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: "fixed",
        inset: 0,
        background: `${SAGE[900]}88`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        opacity: visible ? 1 : 0,
        transition: "opacity 0.2s ease",
      }}
    >
      <div
        style={{
          background: CREAM[50],
          border: `1px solid ${SAGE[200]}`,
          padding: 32,
          maxWidth: 520,
          width: "90%",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(8px)",
          transition: "all 0.3s ease",
        }}
      >
        {/* Warning icon + title */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
          <div
            style={{
              width: 36,
              height: 36,
              background: "#fbe9e7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={18} color={SEMANTIC.error} />
          </div>
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 16,
              fontWeight: 600,
              color: SAGE[900],
            }}
          >
            {title}
          </span>
        </div>

        {/* Description */}
        <p
          style={{
            fontFamily: FONTS.body,
            fontSize: 14,
            lineHeight: 1.6,
            color: SAGE[700],
            margin: "0 0 16px",
          }}
        >
          {description}
        </p>

        {/* SQL display */}
        <div
          style={{
            background: SAGE[950],
            padding: "12px 16px",
            marginBottom: 24,
            overflow: "auto",
            maxHeight: 160,
          }}
        >
          <code
            style={{
              fontFamily: FONTS.mono,
              fontSize: 12,
              color: SAGE[200],
              whiteSpace: "pre-wrap",
              lineHeight: 1.6,
            }}
          >
            {sql}
          </code>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            style={{
              background: SEMANTIC.error,
              border: "none",
              color: CREAM[50],
            }}
          >
            Execute
          </Button>
        </div>
      </div>
    </div>
  );
}
