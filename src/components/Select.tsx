import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { SAGE, CREAM, FONTS } from "../lib/theme";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minWidth?: number;
  style?: React.CSSProperties;
}

export function Select({
  value,
  options,
  onChange,
  placeholder = "Select",
  disabled = false,
  minWidth = 180,
  style,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = useMemo(
    () => options.find((opt) => opt.value === value) || null,
    [options, value]
  );

  useEffect(() => {
    if (!open) return;
    const handleOutside = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handleOutside);
    return () => window.removeEventListener("mousedown", handleOutside);
  }, [open]);

  return (
    <div
      ref={rootRef}
      style={{
        position: "relative",
        minWidth,
        ...style,
      }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
        style={{
          width: "100%",
          border: `1px solid ${open ? SAGE[500] : SAGE[200]}`,
          background: CREAM[50],
          color: selected ? SAGE[800] : SAGE[400],
          fontFamily: FONTS.body,
          fontSize: 12,
          padding: "6px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.65 : 1,
          transition: "border-color 0.15s ease",
          textAlign: "left",
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={14}
          color={SAGE[400]}
          style={{
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
          }}
        />
      </button>

      {open && !disabled && (
        <div
          style={{
            position: "absolute",
            zIndex: 100,
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: CREAM[50],
            border: `1px solid ${SAGE[200]}`,
            maxHeight: 220,
            overflowY: "auto",
            boxShadow: "0 6px 18px rgba(12, 18, 12, 0.08)",
          }}
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  border: "none",
                  background: active ? SAGE[100] : "transparent",
                  color: active ? SAGE[900] : SAGE[700],
                  fontFamily: FONTS.body,
                  fontSize: 12,
                  textAlign: "left",
                  padding: "7px 10px",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = CREAM[100];
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = "transparent";
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

