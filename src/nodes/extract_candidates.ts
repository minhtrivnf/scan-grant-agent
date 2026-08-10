import { GraphStateType, GrantCandidate, EligibilityResult } from "../state.js";
import { openai, DEFAULT_MODEL } from "../llm.js";
import { AIMessage } from "../messages.js";
import { logStep } from "../logger.js";

const EXTRACT_PROMPT = `Bạn là extractor cho Market Scan Mode. Dựa trên kết quả tìm kiếm Tavily (JSON gồm title, url, snippet/content, raw_content nếu có), hãy trích xuất các candidate grant thành JSON:
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
      }
    }
  ]
}

Tiêu chí eligibility sơ bộ: geography, entity type, TRL, IP, deadline, double-dipping, giai đoạn dự án.
RetriV là Vietnam Food JSC spin-off: công nghệ thu hồi protein/lipid từ nước thải chế biến thực phẩm, dùng chitosan từ phụ phẩm tôm, containerized, TRL 7-9, đã pilot tại Việt Nam.
VNF là Vietnam Food JSC: công ty chế biến phụ phẩm tôm, chitosan, biopolymer, circular bioeconomy, Việt Nam.
Mục tiêu 8-15 candidate. Nếu không đủ, trả về đúng số lượng tìm được.
Không thêm nội dung ngoài JSON.`;

export async function extractCandidatesNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  const searchResults = state.searchResults ?? "Không có kết quả tìm kiếm";
  logStep("extract_candidates", "enter", { searchResultsChars: searchResults.length });

  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      { role: "system", content: EXTRACT_PROMPT },
      { role: "user", content: searchResults },
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

  logStep("extract_candidates", "exit", { candidates: candidates.length });
  return {
    candidates,
    chatComplement: `extract_candidates: ${candidates.length} candidate(s)`,
    messages: [AIMessage({ content: `extract_candidates: ${candidates.length}` })],
  };
}
