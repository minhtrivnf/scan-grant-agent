import { GraphStateType } from "../state.js";
import { run as runLogScan } from "../tools/log_scan_excel.js";
import { AIMessage } from "../messages.js";
import { getRunTrackerPath } from "../output_paths.js";
import { logStep } from "../logger.js";

function todayDDMMYYYY(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export async function skipAndLogNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  const grant = state.currentGrant;
  const name = grant?.name ?? "Chưa rõ";
  const ts = state.runTimestamp;
  const output = state.excelPath ?? getRunTrackerPath(ts);
  logStep("skip_and_log", "enter", { grant: name, tracker: output });

  const retrivRows = state.eligibility?.retriv ?? [];
  const vnfRows = state.eligibility?.vnf ?? [];
  const failReasons = [...retrivRows, ...vnfRows]
    .filter((r) => r.result === "fail")
    .map((r) => `${r.criterion}: ${r.note}`)
    .join("; ");

  const result = await runLogScan({
    entry: {
      ten_chuong_trinh: name,
      de_xuat: "SKIP",
      ly_do: failReasons || "Fail eligibility hard-stop",
      owner_follow_up: "Không cần follow-up",
      retriv_scores: { khop_linh_vuc: 0, doi_moi: 0, tac_dong_mt: 0, tiem_nang_qt: 0, dat_giai: 0 },
      vnf_scores: { khop_linh_vuc: 0, doi_moi: 0, tac_dong_mt: 0, tiem_nang_qt: 0, dat_giai: 0 },
      ref: grant?.website ?? "",
    },
    output,
  });

  return {
    excelPath: output,
    chatComplement: `skip_and_log: ${name} → SKIP.\n${result}`,
    messages: [AIMessage({ content: `skip_and_log: ${name} → SKIP` })],
  };
}
