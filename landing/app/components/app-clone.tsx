"use client";

import { useEffect, useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import type { MockMessage, MockExploration } from "../mock-data";
import { mockExplorations } from "../mock-data";

/* ------------------------------------------------------------------ */
/* Sub-components for the realistic app clone                          */
/* ------------------------------------------------------------------ */

function ArcAvatar() {
  return (
    <div
      className="shrink-0"
      style={{
        width: 28,
        height: 28,
        background: "#4a6b4a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        className="font-(family-name:--font-display) text-cream-50"
        style={{ fontSize: 16, lineHeight: 1 }}
      >
        A
      </span>
    </div>
  );
}

function UserBubble({ text, delay }: { text: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: "easeOut" }}
      className="flex justify-end mb-4"
    >
      <div
        className="bg-sage-900 text-cream-50 font-(family-name:--font-body) text-[13px] sm:text-sm"
        style={{
          padding: "8px 12px",
          maxWidth: "85%",
          lineHeight: 1.6,
        }}
      >
        {text}
      </div>
    </motion.div>
  );
}

function renderMarkdown(text: string): string {
  /* Process markdown tables before anything else (they span multiple lines) */
  let result = text.replace(
    /(?:^|\n)(\|.+\|)\n(\|[\s:|-]+\|)\n((?:\|.+\|\n?)+)/g,
    (_match, headerRow: string, _sep: string, bodyBlock: string) => {
      const headers = headerRow.split("|").filter((c: string) => c.trim());
      const dataRows = bodyBlock.trim().split("\n").filter((r: string) => r.trim());
      let html =
        '<div style="overflow-x:auto;margin:8px 0;-webkit-overflow-scrolling:touch">' +
        '<table style="border-collapse:collapse;width:100%;font-family:var(--font-mono);font-size:11px">';
      html += "<thead><tr>";
      headers.forEach((c: string) => {
        html += `<th style="border:1px solid #dce5dc;padding:6px 8px;text-align:left;background:#f0f4f0;color:#4a6b4a;font-family:var(--font-body);font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap">${c.trim()}</th>`;
      });
      html += "</tr></thead><tbody>";
      dataRows.forEach((r: string) => {
        const cells = r.split("|").filter((c: string) => c.trim());
        html += "<tr>";
        cells.forEach((c: string) => {
          html += `<td style="border-bottom:1px solid #f0f4f0;padding:5px 8px;color:#2d422d;white-space:nowrap">${c.trim()}</td>`;
        });
        html += "</tr>";
      });
      html += "</tbody></table></div>";
      return html;
    }
  );

  /* Inline formatting */
  result = result
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(
      /`(.+?)`/g,
      '<code style="font-family:var(--font-mono);font-size:11px;background:#f0f4f0;color:#111a11;padding:1px 4px">$1</code>'
    )
    .replace(/^- (.+)$/gm, '<div style="padding-left:12px">- $1</div>')
    .replace(/\n/g, "<br />");

  return result;
}

function AgentBubble({
  text,
  delay,
  showAvatar = true,
}: {
  text: string;
  delay: number;
  showAvatar?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: "easeOut" }}
      className="mb-4 sm:mb-6"
    >
      <div className="flex gap-1.5 sm:gap-2.5 items-start">
        {showAvatar ? <ArcAvatar /> : <div className="shrink-0 hidden sm:block" style={{ width: 28 }} />}
        <div
          className="font-(family-name:--font-body) text-sage-800 min-w-0 text-[13px] sm:text-sm"
          style={{ lineHeight: 1.7, wordBreak: "break-word" }}
          dangerouslySetInnerHTML={{
            __html: renderMarkdown(text),
          }}
        />
      </div>
    </motion.div>
  );
}

function SqlBlock({ sql, delay }: { sql: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: "easeOut" }}
      className="mb-2"
    >
      <div className="flex gap-1.5 sm:gap-2.5 items-start">
        <div className="shrink-0 hidden sm:block" style={{ width: 28 }} />
        <div
          className="font-(family-name:--font-mono) w-full overflow-x-auto text-[10px] sm:text-xs"
          style={{
            background: "#0a100a",
            color: "#e0e0e0",
            padding: "8px 10px",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
          }}
        >
          {sql}
        </div>
      </div>
    </motion.div>
  );
}

function DataTableMock({
  columns,
  rows,
  rowCount,
  executionTimeMs,
  delay,
}: {
  columns: string[];
  rows: (string | number | null)[][];
  rowCount: number;
  executionTimeMs: number;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className="mb-4"
    >
      <div className="flex gap-1.5 sm:gap-2.5 items-start">
        <div className="shrink-0 hidden sm:block" style={{ width: 28 }} />
        <div className="w-full min-w-0">
          {/* Table */}
          <div
            className="-mx-3 sm:mx-0"
            style={{
              border: "1px solid #dce5dc",
              overflow: "auto",
              background: "#fefdfb",
              maxHeight: 280,
              WebkitOverflowScrolling: "touch",
            }}
          >
            <table
              className="font-(family-name:--font-mono)"
              style={{
                width: "100%",
                minWidth: 320,
                borderCollapse: "collapse",
                fontSize: 11,
              }}
            >
              <thead>
                <tr>
                  {columns.map((col, i) => (
                    <th
                      key={i}
                      className="font-(family-name:--font-body)"
                      style={{
                        padding: "6px 8px",
                        textAlign: "left",
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "#4a6b4a",
                        borderBottom: "1px solid #dce5dc",
                        background: "#f0f4f0",
                        whiteSpace: "nowrap",
                        position: "sticky",
                        top: 0,
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <motion.tr
                    key={ri}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.25, delay: delay + 0.05 * ri }}
                  >
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        style={{
                          padding: "5px 8px",
                          color:
                            cell === null
                              ? "#8fa88f"
                              : typeof cell === "number"
                              ? "#2d422d"
                              : "#2d422d",
                          borderBottom: "1px solid #f0f4f0",
                          whiteSpace: "nowrap",
                          fontVariantNumeric:
                            typeof cell === "number"
                              ? "tabular-nums"
                              : undefined,
                        }}
                      >
                        {cell === null
                          ? "NULL"
                          : typeof cell === "number"
                          ? cell.toLocaleString()
                          : String(cell)}
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Meta row */}
          <div
            className="flex gap-3 mt-1.5 font-(family-name:--font-mono)"
            style={{ fontSize: 11, color: "#6b8a6b" }}
          >
            <span>{rowCount} rows</span>
            <span>{executionTimeMs}ms</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ChartMock({
  chart,
  delay,
}: {
  chart: { title: string; data: { name: string; value: number }[] };
  delay: number;
}) {
  const maxValue = Math.max(...chart.data.map((d) => d.value));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className="mb-4"
    >
      <div className="flex gap-1.5 sm:gap-2.5 items-start">
        <div className="shrink-0 hidden sm:block" style={{ width: 28 }} />
        <div
          className="w-full"
          style={{
            background: "#fefdfb",
            border: "1px solid #dce5dc",
            padding: 12,
          }}
        >
          {/* Chart title */}
          <span
            className="font-(family-name:--font-body)"
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#1e2e1e",
              display: "block",
              marginBottom: 12,
            }}
          >
            {chart.title}
          </span>

          {/* Static bar chart using divs */}
          <div className="flex items-end gap-1 sm:gap-2" style={{ height: 120 }}>
            {chart.data.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <motion.div
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{
                    duration: 0.5,
                    delay: delay + 0.1 * i,
                    ease: "easeOut",
                  }}
                  style={{
                    width: "100%",
                    height: `${(d.value / maxValue) * 100}px`,
                    background: "#4a6b4a",
                    transformOrigin: "bottom",
                  }}
                />
                <span
                  className="font-(family-name:--font-mono)"
                  style={{ fontSize: 10, color: "#4a6b4a" }}
                >
                  {d.name}
                </span>
              </div>
            ))}
          </div>

          {/* Y-axis labels */}
          <div
            className="flex justify-between mt-2 font-(family-name:--font-mono)"
            style={{ fontSize: 10, color: "#8fa88f" }}
          >
            <span>$0</span>
            <span>${(maxValue / 1000).toFixed(0)}K</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function TypingIndicator({ delay }: { delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay }}
      className="flex gap-2.5 items-start mb-6"
    >
      <ArcAvatar />
      <div className="flex gap-1 py-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              background: "#8fa88f",
              borderRadius: "50%",
              animation: `typing-dot 1.2s ease-in-out ${i * 0.15}s infinite`,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Message renderer                                                    */
/* ------------------------------------------------------------------ */

function MessageRenderer({
  messages,
  baseDelay = 0,
}: {
  messages: MockMessage[];
  baseDelay?: number;
}) {
  let cumulativeDelay = baseDelay;

  return (
    <>
      {messages.map((msg) => {
        const delay = cumulativeDelay;
        cumulativeDelay += 0.3;

        switch (msg.kind) {
          case "user":
            return <UserBubble key={msg.id} text={msg.text!} delay={delay} />;
          case "agent_text":
            return (
              <AgentBubble key={msg.id} text={msg.text!} delay={delay} />
            );
          case "sql_result": {
            const r = msg.sqlResult!;
            return (
              <div key={msg.id}>
                <SqlBlock sql={r.sql} delay={delay} />
                <DataTableMock
                  columns={r.columns}
                  rows={r.rows}
                  rowCount={r.rowCount}
                  executionTimeMs={r.executionTimeMs}
                  delay={delay + 0.2}
                />
              </div>
            );
          }
          case "chart":
            return (
              <ChartMock key={msg.id} chart={msg.chart!} delay={delay} />
            );
          case "typing":
            return <TypingIndicator key={msg.id} delay={delay} />;
          default:
            return null;
        }
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Sidebar                                                              */
/* ------------------------------------------------------------------ */

function Sidebar({ explorations }: { explorations: MockExploration[] }) {
  return (
    <div
      className="shrink-0 flex flex-col border-r border-sage-100 bg-cream-50"
      style={{ width: 260 }}
    >
      {/* Header */}
      <div
        className="flex justify-between items-center border-b border-sage-100"
        style={{ padding: 16 }}
      >
        <span
          className="font-(family-name:--font-body) text-sage-900"
          style={{ fontSize: 13, fontWeight: 600 }}
        >
          Explorations
        </span>
        <div
          className="flex items-center justify-center border border-sage-200"
          style={{ width: 28, height: 28, cursor: "default" }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 3v8M3 7h8" stroke="#4a6b4a" strokeWidth="1.5" />
          </svg>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: "8px 8px 0" }}>
        <div className="relative">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#8fa88f"
            strokeWidth="2"
            className="absolute"
            style={{ left: 8, top: "50%", transform: "translateY(-50%)" }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            readOnly
            placeholder="Filter explorations..."
            className="font-(family-name:--font-body) text-sage-700 border border-sage-100 bg-cream-50 w-full outline-none"
            style={{ padding: "6px 8px 6px 26px", fontSize: 12 }}
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto" style={{ padding: 8 }}>
        {explorations.map((exp) => (
          <div
            key={exp.id}
            style={{
              padding: 12,
              background: exp.active ? "#f0f4f0" : "transparent",
              borderLeft: exp.active
                ? "2px solid #111a11"
                : "2px solid transparent",
              marginBottom: 2,
              transition: "all 0.15s ease",
            }}
          >
            <span
              className="font-(family-name:--font-body) block overflow-hidden text-ellipsis whitespace-nowrap"
              style={{
                fontSize: 13,
                color: exp.active ? "#111a11" : "#2d422d",
                fontWeight: exp.active ? 500 : 400,
              }}
            >
              {exp.title}
            </span>
            <div className="flex gap-2 mt-1">
              <span
                className="font-(family-name:--font-mono)"
                style={{ fontSize: 10, color: "#6b8a6b" }}
              >
                {exp.date}
              </span>
              <span
                className="font-(family-name:--font-mono)"
                style={{ fontSize: 10, color: "#8fa88f" }}
              >
                {exp.messageCount} msgs
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Input bar                                                            */
/* ------------------------------------------------------------------ */

function InputBar() {
  return (
    <div
      className="border-t border-sage-100 bg-cream-50 px-3 py-3 sm:px-4 md:px-6 md:py-4"
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            placeholder="Ask about your data..."
            className="font-(family-name:--font-body) text-sage-900 border border-sage-200 bg-cream-50 flex-1 outline-none text-xs sm:text-sm"
            style={{ padding: "8px 12px" }}
          />
          <div
            className="bg-sage-900 flex items-center justify-center"
            style={{ padding: "8px 14px", minWidth: 40 }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#f0f4f0"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 2 11 13" />
              <path d="M22 2 15 22 11 13 2 9Z" />
            </svg>
          </div>
        </div>

        {/* Powered by footer */}
        <div
          className="flex justify-center items-center gap-1.5 mt-2.5"
        >
          <span
            className="font-(family-name:--font-mono) text-sage-300"
            style={{ fontSize: 9, letterSpacing: "0.1em" }}
          >
            POWERED BY
          </span>
          <a
            href="https://glove.dterminal.net"
            target="_blank"
            rel="noreferrer"
            className="font-(family-name:--font-display) text-sage-500 hover:text-sage-700"
            style={{ fontSize: 12, textDecoration: "none", transition: "color 0.2s ease" }}
          >
            Glove
          </a>
          <span
            className="font-(family-name:--font-mono) text-sage-300"
            style={{ fontSize: 9 }}
          >
            &middot;
          </span>
          <a
            href="https://dterminal.net"
            target="_blank"
            rel="noreferrer"
            className="font-(family-name:--font-mono) text-sage-300 hover:text-sage-500"
            style={{ fontSize: 9, letterSpacing: "0.05em", textDecoration: "none", transition: "color 0.2s ease" }}
          >
            dterminal.net
          </a>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main app clone component                                            */
/* ------------------------------------------------------------------ */

export function AppClone({
  messages,
  showTyping = false,
}: {
  messages: MockMessage[];
  showTyping?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (isInView && !hasAnimated) {
      setHasAnimated(true);
    }
  }, [isInView, hasAnimated]);

  return (
    <div
      ref={ref}
      className="border border-sage-100 bg-cream-100 overflow-hidden"
      style={{
        width: "100%",
        maxWidth: 960,
        display: "flex",
      }}
    >
      {/* Sidebar - hidden on mobile */}
      <div className="hidden md:flex">
        <Sidebar explorations={mockExplorations} />
      </div>

      {/* Chat panel */}
      <div className="flex-1 flex flex-col bg-cream-100 min-h-[360px] md:min-h-[560px] max-h-[560px]">
        {/* Messages area */}
        <div
          className="flex-1 overflow-y-auto px-3 pt-4 sm:px-4 md:px-6 md:pt-6"
        >
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            {hasAnimated && (
              <>
                <MessageRenderer messages={messages} baseDelay={0.1} />
                {showTyping && (
                  <TypingIndicator delay={messages.length * 0.3 + 0.3} />
                )}
              </>
            )}
          </div>
        </div>

        {/* Input */}
        <InputBar />
      </div>
    </div>
  );
}
