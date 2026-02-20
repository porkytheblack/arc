import type { ToolConfig } from "glove-react";
import { executeQueryTool } from "./execute-query";
import { getSchemaTool } from "./get-schema";
import { confirmActionTool } from "./confirm-action";
import { collectFormTool } from "./collect-form";
import { showChartTool } from "./show-chart";
import { saveQueryTool } from "./save-query";
import { importCsvTool } from "./import-csv";
import { databaseStatsTool } from "./database-stats";
import { scanQueriesTool } from "./scan-queries";
import { showSuggestionsTool } from "./show-suggestions";
import { disambiguateTool } from "./disambiguate";
import { showSuccessTool } from "./show-success";
import { connectionStatusTool } from "./connection-status";
import { setupConnectionTool } from "./setup-connection";
import { buildFilterTool } from "./build-filter";
import { compactResultTool } from "./compact-result";
import { getTableMetadataTool } from "./get-table-metadata";
import { explainQueryTool } from "./explain-query";
import { executeSavedQueryTool } from "./execute-saved-query";
import { mergeResultsTool } from "./merge-results";

type ToolResult = Awaited<ReturnType<ToolConfig["do"]>>;

const rawTools: ToolConfig[] = [
  executeQueryTool,
  getSchemaTool,
  confirmActionTool,
  collectFormTool,
  showChartTool,
  saveQueryTool,
  importCsvTool,
  databaseStatsTool,
  scanQueriesTool,
  showSuggestionsTool,
  disambiguateTool,
  showSuccessTool,
  connectionStatusTool,
  setupConnectionTool,
  buildFilterTool,
  compactResultTool,
  getTableMetadataTool,
  explainQueryTool,
  executeSavedQueryTool,
  mergeResultsTool,
];

const TOOL_UI_DISPLAY = "UI_DISPLAY: yes. This tool renders its own UI output in the chat interface. Do not repeat the full displayed payload in assistant text unless the user explicitly asks for it.";

function withStableToolMessage(result: ToolResult): ToolResult {
  if (result.message) return result;
  if (typeof result.data === "string") return result;

  return {
    ...result,
    message:
      result.status === "error"
        ? "Tool failed. See tool output for details."
        : "Tool completed. See tool output for details.",
  };
}

function withDisplayMetadata(tool: ToolConfig): ToolConfig {
  return {
    ...tool,
    description: `${tool.description} ${TOOL_UI_DISPLAY}`,
    async do(input, display) {
      const result = await tool.do(input, display);
      return withStableToolMessage(result);
    },
  };
}

export const arcTools: ToolConfig[] = rawTools.map(withDisplayMetadata);

export {
  executeQueryTool,
  getSchemaTool,
  confirmActionTool,
  collectFormTool,
  showChartTool,
  saveQueryTool,
  importCsvTool,
  databaseStatsTool,
  scanQueriesTool,
  showSuggestionsTool,
  disambiguateTool,
  showSuccessTool,
  connectionStatusTool,
  setupConnectionTool,
  buildFilterTool,
  compactResultTool,
  getTableMetadataTool,
  explainQueryTool,
  executeSavedQueryTool,
  mergeResultsTool,
};
