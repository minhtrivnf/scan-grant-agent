import { GraphStateType } from "../state.js";
import { tool } from "@langchain/core/tools";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import {
  TOOL_DEFINITIONS,
  type LogScanExcelInput,
  type MarketScanExcelInput,
  type QACheckInput,
} from "../tools/definitions.js";
import { run as runLogScan } from "../tools/log_scan_excel.js";
import { run as runMarketScan } from "../tools/market_scan_excel.js";
import { run as runQA } from "../tools/qa_check.js";

const logScanTool = tool(
  async (input: LogScanExcelInput) => {
    try {
      const result = await runLogScan(input);
      return result;
    } catch (err: any) {
      return `Lỗi log_scan_excel: ${err?.message || String(err)}`;
    }
  },
  {
    name: TOOL_DEFINITIONS.log_scan_excel.name,
    description: TOOL_DEFINITIONS.log_scan_excel.description,
    schema: TOOL_DEFINITIONS.log_scan_excel.schema,
  }
);

const marketScanTool = tool(
  async (input: MarketScanExcelInput) => {
    try {
      const result = await runMarketScan(input);
      return result;
    } catch (err: any) {
      return `Lỗi market_scan_excel: ${err?.message || String(err)}`;
    }
  },
  {
    name: TOOL_DEFINITIONS.market_scan_excel.name,
    description: TOOL_DEFINITIONS.market_scan_excel.description,
    schema: TOOL_DEFINITIONS.market_scan_excel.schema,
  }
);

const qaCheckTool = tool(
  async (input: QACheckInput) => {
    try {
      const { ok, report } = await runQA(input);
      return `[QA ${ok ? "PASS" : "FAIL"}]\n${report}`;
    } catch (err: any) {
      return `Lỗi qa_check: ${err?.message || String(err)}`;
    }
  },
  {
    name: TOOL_DEFINITIONS.qa_check.name,
    description: TOOL_DEFINITIONS.qa_check.description,
    schema: TOOL_DEFINITIONS.qa_check.schema,
  }
);

export const toolNode = new ToolNode<{ messages: GraphStateType["messages"] }>([
  logScanTool,
  marketScanTool,
  qaCheckTool,
]);

export type ToolNodeType = typeof toolNode;
