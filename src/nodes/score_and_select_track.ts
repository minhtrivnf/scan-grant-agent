import { GraphStateType } from "../state.js";
import { openai, DEFAULT_MODEL } from "../llm.js";
import { AIMessage } from "../messages.js";
import { logStep } from "../logger.js";

const SCORE_PROMPT = `Bạn là strategic scorer. Dựa trên kết quả research + eligibility, chấm 6 tiêu chí (1-5, tổng 30):
1. Strategic fit
2. Funding vs effort
3. Win probability
4. Deadline feasibility
5. Restrictions
6. Network value

25-30 = GO, 18-24 = MAYBE, <18 = SKIP.

Trả về JSON:
{
  "strategyScore": { "Strategic fit": 4, "Funding vs effort": 3, ... },
  "total": 18,
  "trackSelection": "...",
  "retriv_scores": { "khop_linh_vuc": 8, "doi_moi": 7, "tac_dong_mt": 6, "tiem_nang_qt": 5, "dat_giai": 7 },
  "vnf_scores": { "khop_linh_vuc": 8, "doi_moi": 7, "tac_dong_mt": 6, "tiem_nang_qt": 5, "dat_giai": 7 },
  "de_xuat": "GO|MAYBE|SKIP",
  "ly_do_de_xuat": "...",
  "next_steps": ["..."],
  "maybe_questions": ["..."]
}

Không thêm nội dung ngoài JSON.`;

export async function scoreAndSelectTrackNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  const lastAi = [...state.messages].reverse().find((m) => m.role === "ai" && m.content.includes("check_eligibility: PASS"));
  logStep("score_and_select_track", "enter", { hasEligibilityPass: Boolean(lastAi), grant: state.currentGrant?.name ?? null });

  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      { role: "system", content: SCORE_PROMPT },
      { role: "user", content: lastAi?.content ?? "Không có dữ liệu eligibility" },
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
    strategyScore: parsed.strategyScore ?? {},
    trackSelection: parsed.trackSelection ?? "",
    chatComplement: `score_and_select_track: total=${parsed.total ?? 0}, de_xuat=${parsed.de_xuat ?? "MAYBE"}, track=${parsed.trackSelection ?? ""}`,
    messages: [AIMessage({ content: `score_and_select_track: ${parsed.de_xuat ?? "MAYBE"} (total ${parsed.total ?? 0})` })],
  };
}
