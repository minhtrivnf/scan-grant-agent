import { GraphStateType } from "../state.js";
import * as fs from "fs";
import { buildVNFReport } from "../tools/build_vnf_report.js";
import { run as runLogScan } from "../tools/log_scan_excel.js";
import { AIMessage } from "../messages.js";
import { getRunReportsDir, getRunTrackerPath } from "../output_paths.js";
import { logStep } from "../logger.js";

function toRows(items: unknown, source: "retriv" | "vnf"): { tieu_chi: string; ket_qua: string; ghi_chu: string }[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((x) => x && typeof x === "object")
    .map((x: any) => ({
      tieu_chi: `${source.toUpperCase()}: ${x.tieu_chi ?? x.criterion ?? "Chưa rõ"}`,
      ket_qua: String(x.ket_qua ?? x.result ?? "Chưa rõ"),
      ghi_chu: String(x.ghi_chu ?? x.note ?? ""),
    }));
}

function toScoringRows(items: unknown): { tieu_chi: string; diem: number | string; ly_do: string }[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((x) => x && typeof x === "object")
    .map((x: any) => ({
      tieu_chi: String(x.tieu_chi ?? x.criterion ?? "Chưa rõ"),
      diem: x.diem ?? x.score ?? "",
      ly_do: String(x.ly_do ?? x.reason ?? ""),
    }));
}

function todayDDMMYYYY(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export async function buildDocxAndLogNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  const grant = state.currentGrant;
  const research = (state.grantResearch ?? {}) as any;
  const name = grant?.name ?? "Chưa rõ";
  logStep("build_docx_and_log", "enter", { grant: name, existingReports: state.reportPaths.length, queue: state.selectedCandidateQueue ?? [] });
  const stt = (state.reportPaths.length + 1).toString();
  const ts = state.runTimestamp;
  const reportDir = getRunReportsDir(ts);
  fs.mkdirSync(reportDir, { recursive: true });
  const output = state.excelPath ?? getRunTrackerPath(ts);
  logStep("build_docx_and_log", "paths", { reportDir, tracker: output });

  const reportPath = await buildVNFReport({
    projectName: state.companyTarget ?? "RetriV",
    grantName: name,
    scanDate: todayDDMMYYYY(),
    stt,
    outputDir: reportDir,
    trackerPath: output,
    info: {
      ten_chuong_trinh: name,
      loai: research.loai ?? (grant?.sourceNote?.includes("competition") ? "competition" : "Chưa rõ"),
      quy_mo: research.quy_mo ?? "Chưa rõ",
      don_vi_to_chuc: research.don_vi_to_chuc ?? "Chưa rõ",
      muc_do_uu_tien: research.muc_do_uu_tien ?? "Chưa rõ",
      status: research.status ?? "Chưa rõ",
      mo_dk: research.mo_dk ?? "Chưa rõ",
      dong_dk: research.dong_dk ?? "Chưa rõ",
      chung_ket: research.chung_ket ?? "Chưa rõ",
      dia_diem: research.dia_diem ?? "Chưa rõ",
      nha_tai_tro: research.nha_tai_tro ?? grant?.sponsor ?? "Chưa rõ",
      funding: research.funding ?? grant?.funding ?? "Chưa rõ",
      deadline: research.deadline ?? grant?.deadline ?? "Chưa rõ",
      timeline: research.timeline ?? "Chưa rõ",
      website: research.website ?? grant?.website ?? "Chưa rõ",
      nguon_xac_nhan: research.nguon_xac_nhan ?? grant?.sourceNote ?? "Chưa rõ",
      eligibility: [
        ...toRows(research.eligibility?.retriv, "retriv"),
        ...toRows(research.eligibility?.vnf, "vnf"),
        ...(state.eligibility?.retriv.map((e) => ({ tieu_chi: `RetriV: ${e.criterion}`, ket_qua: e.result, ghi_chu: e.note })) ?? []),
      ],
      scoring: toScoringRows(research.scoring),
      challenge_phu_hop_nhat: research.challenge_phu_hop_nhat ?? "Chưa rõ",
      ly_do_challenge: research.ly_do_challenge ?? "Chưa rõ",
      challenge_du_phong: research.challenge_du_phong ?? "Chưa rõ",
      application_form: research.application_form ?? "Chưa rõ",
      attachments: research.attachments ?? "Chưa rõ",
      word_limits: research.word_limits ?? "Chưa rõ",
      rubric: research.rubric ?? "Chưa rõ",
      past_winners: research.past_winners ?? [],
      diem_chung_quan_quan: research.diem_chung_quan_quan ?? "Chưa rõ",
      bai_hoc: research.bai_hoc ?? "Chưa rõ",
      risks: research.risks ?? "Chưa rõ",
      de_xuat: research.de_xuat ?? "MAYBE",
      ly_do_de_xuat: research.ly_do_de_xuat ?? "Chưa rõ",
      next_steps: research.next_steps ?? [],
      maybe_questions: research.maybe_questions ?? [],
      retriv_vnf_note: state.eligibility ? `RetriV/VNF eligibility đã được đánh giá song song.` : undefined,
    },
  });

  const logResult = await runLogScan({
    entry: {
      ten_chuong_trinh: name,
      loai: research.loai ?? "",
      quy_mo: research.quy_mo ?? "",
      don_vi_to_chuc: research.don_vi_to_chuc ?? "",
      muc_do_uu_tien: research.muc_do_uu_tien ?? "",
      status: research.status ?? "",
      mo_dk: research.mo_dk ?? "",
      dong_dk: research.dong_dk ?? "",
      chung_ket: research.chung_ket ?? "",
      dia_diem: research.dia_diem ?? "",
      de_xuat: research.de_xuat ?? "MAYBE",
      ly_do: research.ly_do_de_xuat ?? "Chưa rõ",
      owner_follow_up: research.next_steps?.[0] ?? "Team VNF",
      retriv_scores: research.retriv_scores ?? { khop_linh_vuc: 0, doi_moi: 0, tac_dong_mt: 0, tiem_nang_qt: 0, dat_giai: 0 },
      vnf_scores: research.vnf_scores ?? { khop_linh_vuc: 0, doi_moi: 0, tac_dong_mt: 0, tiem_nang_qt: 0, dat_giai: 0 },
      link_bao_cao: reportPath,
      ref: grant?.website ?? "",
    },
    output,
  });
  logStep("build_docx_and_log", "exit", { reportPath, logResult });

  return {
    reportPaths: [reportPath],
    excelPath: output,
    chatComplement: `build_docx_and_log: ${reportPath}\n${logResult}`,
    messages: [AIMessage({ content: `build_docx_and_log: ${reportPath}` })],
  };
}
