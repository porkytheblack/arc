import { z } from "zod";
import { defineTool } from "glove-react";
import { SAGE, CREAM, FONTS } from "../theme";
import { Database } from "lucide-react";
import { parseRenderData } from "./render-data";

const inputSchema = z.object({
  name: z.string().describe("Connection name"),
  dbType: z.string().describe("Database type (PostgreSQL, MySQL, etc.)"),
  host: z.string().describe("Hostname"),
  port: z.number().describe("Port number"),
  connected: z.boolean().describe("Whether currently connected"),
  latencyMs: z.number().optional().describe("Latency in milliseconds"),
});

export const connectionStatusTool = defineTool({
  name: "show_connection_status",
  description: "Display the current connection status inline in chat.",
  inputSchema,
  displayPropsSchema: inputSchema,
  resolveSchema: z.void(),
  async do(input, display) {
    await display.pushAndForget(input);
    return {
      status: "success",
      data: input.connected
        ? `Connected to ${input.name} (${input.dbType}).`
        : `Not connected to ${input.name}.`,
      renderData: input,
    };
  },
  render({ props }) {
    const { name, dbType, host, port, connected, latencyMs } = props;
    const statusColor = connected ? "#4caf50" : SAGE[300];
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: CREAM[50],
          border: `1px solid ${SAGE[100]}`,
          padding: "12px 16px",
          marginTop: 8,
        }}
      >
        <Database size={18} color={connected ? SAGE[500] : SAGE[300]} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontFamily: FONTS.body,
                fontSize: 14,
                fontWeight: 500,
                color: SAGE[900],
              }}
            >
              {name}
            </span>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: 6,
                background: statusColor,
              }}
            />
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 11,
                color: statusColor,
              }}
            >
              {connected ? "Connected" : "Disconnected"}
              {connected && latencyMs !== undefined && ` \u2014 ${latencyMs}ms`}
            </span>
          </div>
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: 11,
              color: SAGE[400],
              marginTop: 2,
            }}
          >
            {dbType} \u2014 {host}:{port}
          </div>
        </div>
      </div>
    );
  },
  renderResult({ data }) {
    const parsed = parseRenderData(inputSchema, data);
    if (!parsed) return null;

    const { name, dbType, host, port, connected, latencyMs } = parsed;
    const statusColor = connected ? "#4caf50" : SAGE[300];
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: CREAM[50],
          border: `1px solid ${SAGE[100]}`,
          padding: "12px 16px",
          marginTop: 8,
        }}
      >
        <Database size={18} color={connected ? SAGE[500] : SAGE[300]} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontFamily: FONTS.body,
                fontSize: 14,
                fontWeight: 500,
                color: SAGE[900],
              }}
            >
              {name}
            </span>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: 6,
                background: statusColor,
              }}
            />
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 11,
                color: statusColor,
              }}
            >
              {connected ? "Connected" : "Disconnected"}
              {connected && latencyMs !== undefined && ` \u2014 ${latencyMs}ms`}
            </span>
          </div>
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: 11,
              color: SAGE[400],
              marginTop: 2,
            }}
          >
            {dbType} \u2014 {host}:{port}
          </div>
        </div>
      </div>
    );
  },
});
