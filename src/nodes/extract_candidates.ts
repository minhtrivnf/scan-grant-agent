import { GraphStateType, GrantCandidate, EligibilityResult } from "../state.js";
import { openai, DEFAULT_MODEL } from "../llm.js";
import { AIMessage } from "../messages.js";
import { logStep } from "../logger.js";

const CURRENT_YEAR = new Date().getFullYear();
const TODAY = new Date().toLocaleDateString("vi-VN");

const EXTRACT_PROMPT = `Bạn là extractor cho Market Scan Mode. Dựa trên kết quả tìm kiếm Tavily (JSON gồm title, url, snippet/content), hãy trích xuất các candidate grant thành JSON:
{
  "candidates": [
    {
      "name": "tên chương trình",
      "sponsor": "nhà tài trợ",
      "field": "lĩnh vực",
      "funding": "funding/award",
      "deadline": "dd/mm/yyyy hoặc Rolling / Chưa rõ",
      "geography": "geography",
      "website": "https://...",
      "sourceNote": "Tavily: <title> (<url>)",
      "prelimEligibility": {
        "retriv": [{ "criterion": "geography", "result": "pass|fail|unclear", "note": "..." }, ...],
        "vnf": [{ "criterion": "geography", "result": "pass|fail|unclear", "note": "..." }, ...]
      },
      "status": "open|upcoming|closed|unknown",
      "year": "2026|2027|unknown"
    }
  ]
}

Ngày hôm nay là ${TODAY}. Khi đánh status:
- Nếu deadline đã qua so với ${TODAY} → status = "closed".
- Nếu deadline trong tương lai hoặc Rolling → status = "open".
- Nếu chưa mở nhưng sắp mở → status = "upcoming".
- Nếu không rõ → status = "unknown".
Tiêu chí eligibility sơ bộ: geography, entity type, TRL, IP, deadline, double-dipping, giai đoạn dự án.
RetriV là Vietnam Food JSC spin-off: công nghệ thu hồi protein/lipid từ nước thải chế biến thực phẩm, dùng chitosan từ phụ phẩm tôm, containerized, TRL 7-9, đã pilot tại Việt Nam.
VNF là Vietnam Food JSC: công ty chế biến phụ phẩm tôm, chitosan, biopolymer, circular bioeconomy, Việt Nam.

Năm hiện tại là ${new Date().getFullYear()}. ƯU TIÊN các candidate:
- Đang mở (status: open) hoặc sắp mở (status: upcoming) trong năm ${new Date().getFullYear()} hoặc ${new Date().getFullYear() + 1}.
- Có deadline rõ ràng hoặc ghi "Rolling".

LOẠI BỎ hoặc GHI CHÚ candidate:
- Đã đóng hoàn toàn (closed) trước năm ${new Date().getFullYear()}.
- Không còn tổ chức nữa, chỉ là tin tức/bài báo về grant cũ.
- Không có website hoặc thông tin quá sơ sài.

Mục tiêu 8-15 candidate. Nếu không đủ, trả về đúng số lượng tìm được.
Không thêm nội dung ngoài JSON.`;

export async function extractCandidatesNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  const searchResults = state.searchResults ?? "Không có kết quả tìm kiếm";
  logStep("extract_candidates", "enter", { searchResultsChars: searchResults.length });

  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      { role: "system", content: EXTRACT_PROMPT },
      { role: "user", content: searchResults.slice(0, 20000) },
    ],
    temperature: 0,
    response_format: { type: "json_object" },
  });

  let parsed: { candidates?: any[] } = {};
  try {
    parsed = JSON.parse(response.choices[0].message.content ?? "{}");
  } catch {
    parsed = { candidates: [] };
  }

  const candidates: GrantCandidate[] = (parsed.candidates ?? []).map((c: any) => ({
    name: c.name ?? "Chưa rõ",
    sponsor: c.sponsor ?? "",
    field: c.field ?? "",
    funding: c.funding ?? "",
    deadline: c.deadline ?? "Chưa rõ",
    geography: c.geography ?? "",
    website: c.website ?? "",
    sourceNote: c.sourceNote ?? (c.website ? `Tavily/Website: ${c.website}` : "Tavily search result"),
    prelimEligibility: c.prelimEligibility ?? { retriv: [], vnf: [] },
  }));

  // Log chi tiết candidate để theo dõi nguồn mới/cũ.
  logStep("extract_candidates", "candidates detail", candidates.map((c) => ({
    name: c.name,
    deadline: c.deadline,
    status: (c as any).status ?? "unknown",
    year: (c as any).year ?? "unknown",
    website: c.website,
  })));

  logStep("extract_candidates", "exit", { candidates: candidates.length });
  return {
    candidates,
    chatComplement: `extract_candidates: ${candidates.length} candidate(s)`,
    messages: [AIMessage({ content: `extract_candidates: ${candidates.length}` })],
  };
}
