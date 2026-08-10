import { GraphStateType } from "../state.js";
import { openai, DEFAULT_MODEL } from "../llm.js";
import { AIMessage } from "../messages.js";
import { logStep } from "../logger.js";

const RESEARCH_PROMPT = `Bạn là researcher cho skill scan-grant-vnf. Nhiệm vụ:
1. Đọc hồ sơ công ty RetriV/VNF từ phần [HỒ SƠ CÔNG TY].
2. Thu thập thông tin đầy đủ về grant từ phần [KẾT QUẢ TÌM KIẾM] và URL được cung cấp.
3. So khớp để đánh giá eligibility, scoring, track phù hợp.

Trả về JSON:
{
  "ten_chuong_trinh": "...",
  "loai": "grant|competition|accelerator|unknown",
  "quy_mo": "...",
  "don_vi_to_chuc": "...",
  "muc_do_uu_tien": "...",
  "status": "open|closing|closed|unknown",
  "mo_dk": "dd/mm/yyyy | Chưa rõ",
  "dong_dk": "dd/mm/yyyy | Rolling | Chưa rõ",
  "chung_ket": "dd/mm/yyyy | Chưa rõ",
  "dia_diem": "...",
  "nha_tai_tro": "...",
  "funding": "...",
  "deadline": "...",
  "timeline": "...",
  "website": "...",
  "nguon_xac_nhan": "...",
  "eligibility": [{ "tieu_chi": "...", "ket_qua": "pass|fail|unclear", "ghi_chu": "..." }],
  "scoring": [{ "tieu_chi": "...", "diem": 0-5, "ly_do": "..." }],
  "challenge_phu_hop_nhat": "...",
  "ly_do_challenge": "...",
  "challenge_du_phong": "...",
  "application_form": "...",
  "attachments": "...",
  "word_limits": "...",
  "rubric": "...",
  "past_winners": [{ "nam_mua": "...", "doi": "...", "linh_vuc": "...", "ly_do_thang": "..." }],
  "diem_chung_quan_quan": "...",
  "bai_hoc": "...",
  "risks": "...",
  "de_xuat": "GO|MAYBE|SKIP",
  "ly_do_de_xuat": "...",
  "next_steps": ["..."],
  "maybe_questions": ["..."],
  "retriv_vnf_note": "...",
  "retriv_scores": { "khop_linh_vuc": 0-10, "doi_moi": 0-10, "tac_dong_mt": 0-10, "tiem_nang_qt": 0-10, "dat_giai": 0-10 },
  "vnf_scores": { "khop_linh_vuc": 0-10, "doi_moi": 0-10, "tac_dong_mt": 0-10, "tiem_nang_qt": 0-10, "dat_giai": 0-10 }
}

[HỒ SƠ CÔNG TY]
{{companyContext}}

[NỘI DUNG WEBSITE]
{{sourceContent}}

Không thêm nội dung ngoài JSON. Nếu thiếu thông tin, ghi "Chưa rõ — cần xác minh thủ công" thay vì đoán.`;

export async function researchGrantNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  const grant = state.currentGrant;
  const name = grant?.name ?? "chưa rõ";
  const website = grant?.website ?? "";
  const context = state.companyContext ?? "Chưa nạp hồ sơ công ty.";
  const searchResults = state.searchResults ?? "Chưa có kết quả tìm kiếm.";
  const sourceContent = state.sourceContent ?? "Chưa có nội dung sạch từ website candidate.";
  logStep("research_grant", "enter", { grant: name, website, contextChars: context.length, searchResultsChars: searchResults.length });

  const prompt = RESEARCH_PROMPT.replace("{{companyContext}}", context).replace("{{sourceContent}}", sourceContent);

  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: `Grant: ${name}\nWebsite: ${website}\n\n[KẾT QUẢ TÌM KIẾM]\n${searchResults.slice(0, 20000)}\n\nHãy nghiên cứu và trả về JSON.` },
    ],
    temperature: 0,
    response_format: { type: "json_object" },
  });

  let parsed: any = {};
  try {
    parsed = JSON.parse(response.choices[0].message.content ?? "{}");
  } catch {
    parsed = {};
  }

  return {
    grantResearch: parsed,
    chatComplement: `research_grant: ${name} — thu thập thông tin grant + hồ sơ công ty.\n\nKết quả nghiên cứu:\n${JSON.stringify(parsed, null, 2).slice(0, 4000)}`,
    messages: [AIMessage({ content: `research_grant completed for ${name}.` })],
  };
}
