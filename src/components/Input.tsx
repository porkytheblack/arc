import { SAGE, CREAM, FONTS } from "../lib/theme";

export interface InputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  style?: React.CSSProperties;
  label?: string;
}

export function Input({ value, onChange, placeholder, type = "text", style, label }: InputProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && (
        <label
          style={{
            fontFamily: FONTS.body,
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: SAGE[500],
          }}
        >
          {label}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "10px 12px",
          border: `1px solid ${SAGE[200]}`,
          background: CREAM[50],
          fontFamily: FONTS.body,
          fontSize: 14,
          color: SAGE[900],
          outline: "none",
          boxSizing: "border-box",
          transition: "border-color 0.2s ease",
          ...style,
        }}
        onFocus={(e: React.FocusEvent<HTMLInputElement>) => (e.target.style.borderColor = SAGE[500])}
        onBlur={(e: React.FocusEvent<HTMLInputElement>) => (e.target.style.borderColor = SAGE[200])}
      />
    </div>
  );
}
