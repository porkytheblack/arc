import { useState, useEffect } from "react";
import { SAGE, CREAM, FONTS } from "../lib/theme";
import { Button } from "./Button";
import { Input } from "./Input";
import { oasis } from "../lib/oasis";
import { X } from "lucide-react";

type FeedbackCategory = "bug" | "feature" | "general";

const CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: "bug", label: "Bug Report" },
  { value: "feature", label: "Feature Request" },
  { value: "general", label: "General Feedback" },
];

export interface FeedbackDialogProps {
  onClose: () => void;
}

export function FeedbackDialog({ onClose }: FeedbackDialogProps) {
  const [visible, setVisible] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>("general");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await oasis.feedback.submit({
        category,
        message: message.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
      });
      setSubmitted(true);
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit feedback");
    } finally {
      setSubmitting(false);
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
          maxWidth: 480,
          width: "90%",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(8px)",
          transition: "all 0.3s ease",
          position: "relative",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
          }}
        >
          <X size={16} color={SAGE[400]} />
        </button>

        {/* Title */}
        <h2
          style={{
            fontFamily: FONTS.body,
            fontSize: 16,
            fontWeight: 600,
            color: SAGE[900],
            margin: "0 0 4px",
          }}
        >
          Send Feedback
        </h2>
        <p
          style={{
            fontFamily: FONTS.body,
            fontSize: 13,
            color: SAGE[500],
            margin: "0 0 24px",
          }}
        >
          Help us improve Arc by sharing your thoughts.
        </p>

        {submitted ? (
          <p
            style={{
              fontFamily: FONTS.body,
              fontSize: 14,
              color: SAGE[700],
              textAlign: "center",
              padding: "24px 0",
            }}
          >
            Thanks for your feedback!
          </p>
        ) : (
          <>
            {/* Category selector */}
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: SAGE[500],
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Category
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setCategory(cat.value)}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      fontFamily: FONTS.body,
                      fontSize: 12,
                      fontWeight: 500,
                      border: `1px solid ${category === cat.value ? SAGE[900] : SAGE[200]}`,
                      background: category === cat.value ? SAGE[900] : "transparent",
                      color: category === cat.value ? CREAM[50] : SAGE[600],
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: SAGE[500],
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your feedback..."
                rows={4}
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
                  resize: "vertical",
                  transition: "border-color 0.2s ease",
                }}
                onFocus={(e) => (e.target.style.borderColor = SAGE[500])}
                onBlur={(e) => (e.target.style.borderColor = SAGE[200])}
              />
            </div>

            {/* Email */}
            <div style={{ marginBottom: 24 }}>
              <Input
                value={email}
                onChange={setEmail}
                placeholder="you@example.com (optional)"
                type="email"
                label="Email"
              />
            </div>

            {error && (
              <p
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 12,
                  color: "#c62828",
                  margin: "0 0 16px",
                }}
              >
                {error}
              </p>
            )}

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!message.trim() || submitting}
              >
                {submitting ? "Sending..." : "Submit"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
