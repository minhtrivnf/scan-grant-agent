import { GraphStateType } from "../state.js";
import { AIMessage } from "../messages.js";
import { openai, DEFAULT_MODEL } from "../llm.js";
import { logStep } from "../logger.js";

interface TavilySearchResult {
  title: string;
  url: string;
  content?: string;
  snippet?: string;
  score?: number;
  raw_content?: string;
}

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function tavilySearch(query: string, apiKey: string): Promise<TavilySearchResult[]> {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "advanced",
      include_answer: true,
      include_raw_content: true,
      max_results: 5,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Tavily search failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as { results?: TavilySearchResult[] };
  return data.results ?? [];
}

export async function retrievePastWinnersNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  const url = state.currentGrant?.website?.trim() ?? "";
  const name = state.currentGrant?.name ?? "chưa rõ";
  const domain = domainFromUrl(url);
  logStep("retrieve_past_winners", "enter", { name, domain, url });

  const apiKey = process.env.TAVILY_KEY;
  if (!apiKey || !domain) {
    return {
      pastWinnersContent: undefined,
      grantResearch: {
        ...(state.grantResearch ?? {}),
        past_winners: (state.grantResearch as any)?.past_winners ?? [],
      },
      chatComplement: "retrieve_past_winners: thiếu TAVILY_KEY hoặc domain hợp lệ.",
      messages: [AIMessage({ content: "retrieve_past_winners: skipped" })],
    };
  }

  const queries = [
    `site:${domain} (winners OR winner OR cohort OR alumni OR finalists) "${name}"`,
    `site:${domain} (past winners OR previous winners OR press release) "${name}"`,
    `site:${domain} (winner OR cohort OR alumni) "${name}"`,
    `"${name}" past winners press release`,
    `"${name}" winner LinkedIn`,
    `"${name}" alumni cohort industry news`,
  ];

  const results: TavilySearchResult[] = [];
  for (const q of queries) {
    try {
      logStep("retrieve_past_winners", "tavily request", q);
      const rows = await tavilySearch(q, apiKey);
      logStep("retrieve_past_winners", "tavily response", { query: q, results: rows.length });
      results.push(...rows);
    } catch (err: any) {
      logStep("retrieve_past_winners", "tavily failed", { query: q, error: err?.message ?? String(err) });
    }
  }

  const sourceText = results
    .slice(0, 12)
    .map((r, i) => `[#${i + 1}] ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet ?? r.content ?? ""}\nRaw: ${(r.raw_content ?? "").slice(0, 1200)}`)
    .join("\n\n");

  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Bạn là bộ trích xuất past winners. Từ các search results bên dưới, hãy trả về JSON với keys:\n{
  "past_winners": [
    {"nam_mua":"...","doi":"...","linh_vuc":"...","ly_do_thang":"...","source_url":"...","confidence":"high|medium|low"}
  ],
  "summary": "..."
}\nChỉ dùng thông tin có thể suy ra từ nguồn. Nếu không đủ dữ liệu thì để mảng rỗng. Không thêm nội dung ngoài JSON.`,
      },
      { role: "user", content: `Grant: ${name}\nDomain: ${domain}\n\n[SEARCH RESULTS]\n${sourceText || "(empty)"}` },
    ],
  });

  let parsed: { past_winners?: any[]; summary?: string } = {};
  try {
    parsed = JSON.parse(response.choices[0].message.content ?? "{}");
  } catch {
    parsed = {};
  }

  const structured = (parsed.past_winners ?? []).map((w: any) => ({
    nam_mua: String(w.nam_mua ?? ""),
    doi: String(w.doi ?? ""),
    linh_vuc: String(w.linh_vuc ?? ""),
    ly_do_thang: String(w.ly_do_thang ?? ""),
    source_url: String(w.source_url ?? ""),
    confidence: String(w.confidence ?? "low"),
  }));

  logStep("retrieve_past_winners", "exit", { items: structured.length, queries: queries.length, results: results.length });

  return {
    pastWinnersContent: sourceText,
    grantResearch: {
      ...(state.grantResearch ?? {}),
      past_winners: structured,
      past_winners_summary: parsed.summary ?? "",
    },
    chatComplement: `retrieve_past_winners: ${structured.length} item(s)`,
    messages: [AIMessage({ content: `retrieve_past_winners: ${structured.length}` })],
  };
}
