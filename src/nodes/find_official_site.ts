import { GraphStateType } from "../state.js";
import { openai, DEFAULT_MODEL } from "../llm.js";
import { AIMessage } from "../messages.js";
import { logStep } from "../logger.js";

const TAVILY_API_URL = "https://api.tavily.com";

interface TavilySearchResult {
  title: string;
  url: string;
  content?: string;
  snippet?: string;
  score?: number;
  raw_content?: string;
}

interface TavilySearchResponse {
  query: string;
  results: TavilySearchResult[];
  answer?: string;
}

async function tavilySearch(query: string, apiKey: string): Promise<TavilySearchResponse> {
  const response = await fetch(`${TAVILY_API_URL}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "advanced",
      include_answer: false,
      include_raw_content: false,
      max_results: 8,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Tavily search failed: ${response.status} ${text}`);
  }

  return response.json() as Promise<TavilySearchResponse>;
}

const FIND_SITE_PROMPT = `Bạn cần chọn website chính thức của chương trình grant/dựa trên tên và kết quả tìm kiếm dưới đây. Hãy trả về JSON:
{ "officialUrl": "https://...", "confidence": "high" | "medium" | "low", "note": "..." }

Lưu ý:
- Ưu tiên trang chính thức của nhà tài trợ / tổ chức tổ chức, không phải bài báo/aggregator.
- Trang phải là mùa giải/đợt hiện tại nếu có thể (tránh trang winners mùa cũ, archive, press release).
- Nếu không chắc chắn, confidence = low và note giải thích.
- Không thêm nội dung ngoài JSON.`;

const FALLBACK_PROMPT = `Bạn cần tìm website chính thức của chương trình grant dựa trên tên. Hãy trả về JSON:
{ "officialUrl": "https://...", "confidence": "high" | "medium" | "low", "note": "..." }

Lưu ý:
- Ưu tiên trang chính thức của nhà tài trợ / tổ chức tổ chức, không phải bài báo/aggregator.
- Trang phải là mùa giải/đợt hiện tại nếu có thể.
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

  const apiKey = process.env.TAVILY_KEY;
  let selectedUrl = "";
  let confidence = "unknown";
  let note = "Không tìm kiếm được";

  if (apiKey) {
    const queries = [
      `"${name}" official site`,
      `"${name}" apply application`,
      `"${name}" eligibility`,
      `"${name}" 2026`,
    ];
    const allResults: TavilySearchResult[] = [];
    for (const query of queries) {
      try {
        logStep("find_official_site", "tavily request", query);
        const result = await tavilySearch(query, apiKey);
        logStep("find_official_site", "tavily response", { query, count: result.results.length });
        allResults.push(...result.results);
      } catch (err: any) {
        logStep("find_official_site", "tavily error", { query, error: err?.message ?? String(err) });
      }
    }

    const seen = new Set<string>();
    const deduped = allResults.filter((r) => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });

    if (deduped.length > 0) {
      const response = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: FIND_SITE_PROMPT },
          {
            role: "user",
            content: [
              `Tên chương trình: ${name}`,
              "",
              "Kết quả tìm kiếm:",
              deduped
                .map(
                  (r, i) =>
                    `${i + 1}. ${r.title}\nURL: ${r.url}\n${r.content ?? r.snippet ?? ""}`.trim()
                )
                .join("\n\n"),
            ].join("\n"),
          },
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

      selectedUrl = parsed.officialUrl ?? "";
      confidence = parsed.confidence ?? "unknown";
      note = parsed.note ?? "";
      logStep("find_official_site", "llm selected from search", { selectedUrl, confidence, note });
    }
  }

  if (!selectedUrl) {
    logStep("find_official_site", "fallback to llm", { reason: apiKey ? "no search results" : "missing TAVILY_KEY" });
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: "system", content: FALLBACK_PROMPT },
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

    selectedUrl = parsed.officialUrl ?? "";
    confidence = parsed.confidence ?? "unknown";
    note = parsed.note ?? (apiKey ? "Không có kết quả tìm kiếm" : "Thiếu TAVILY_KEY");
    logStep("find_official_site", "fallback result", { selectedUrl, confidence, note });
  }

  const url = selectedUrl;
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

  logStep("find_official_site", "exit", { url, confidence, note });

  return {
    currentGrant: updatedGrant,
    chatComplement: `find_official_site: ${url} (confidence: ${confidence}) — ${note}`,
    messages: [AIMessage({ content: `find_official_site: ${url}` })],
  };
}
