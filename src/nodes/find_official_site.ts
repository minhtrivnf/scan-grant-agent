import { GraphStateType } from "../state.js";
import { openai, DEFAULT_MODEL } from "../llm.js";
import { AIMessage } from "../messages.js";
import { logStep } from "../logger.js";

const FIND_SITE_PROMPT = `Bạn cần tìm website chính thức của chương trình grant/dựa trên tên user cung cấp. Hãy trả về JSON:
{ "officialUrl": "https://...", "confidence": "high" | "medium" | "low", "note": "..." }

Lưu ý:
- Ưu tiên trang chính thức của nhà tài trợ / tổ chức tổ chức, không phải bài báo/aggregator.
- Nếu không chắc chắn, confidence = low và note giải thích.
- Không thêm nội dung ngoài JSON.`;

export async function findOfficialSiteNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  const grant = state.currentGrant;
  const name = grant?.name ?? "chưa rõ";
  logStep("find_official_site", "enter", { grant: name });

  if (grant?.website && grant.website.trim().startsWith("http")) {
    logStep("find_official_site", "skip, website already present", grant.website);
    return {
      currentGrant: { ...grant, sourceNote: grant.sourceNote || "User cung cấp link" },
      chatComplement: `find_official_site: giữ nguyên URL user cung cấp ${grant.website}`,
      messages: [AIMessage({ content: `find_official_site: ${grant.website}` })],
    };
  }

  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      { role: "system", content: FIND_SITE_PROMPT },
      { role: "user", content: `Tên chương trình: ${name}` },
    ],
    temperature: 0,
    response_format: { type: "json_object" },
  });

  let parsed: { officialUrl?: string; confidence?: string; note?: string } = {};
  try {
    parsed = JSON.parse(response.choices[0].message.content ?? "{}");
  } catch {
    parsed = {};
  }

  const url = parsed.officialUrl ?? "";
  const updatedGrant = grant
    ? { ...grant, website: url, sourceNote: url ? `Claude tìm website chính thức: ${url}` : "Claude tìm website chính thức" }
    : {
        name,
        sponsor: "",
        field: "",
        funding: "",
        deadline: "",
        geography: "",
        website: url,
        sourceNote: url ? `Claude tìm website chính thức: ${url}` : "Claude tìm website chính thức",
      };

  logStep("find_official_site", "exit", { url, confidence: parsed.confidence ?? "unknown" });

  return {
    currentGrant: updatedGrant,
    chatComplement: `find_official_site: ${url} (confidence: ${parsed.confidence ?? "unknown"}) — ${parsed.note ?? ""}`,
    messages: [AIMessage({ content: `find_official_site: ${url}` })],
  };
}
