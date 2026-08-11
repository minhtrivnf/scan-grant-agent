import { GraphStateType } from "../state.js";
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
        include_answer: true,
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

export async function runSearchNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  logStep("run_search", "enter", { queries: state.searchQueries.length, topic: state.topic ?? null });
  const apiKey = process.env.TAVILY_KEY;
  if (!apiKey) {
    logStep("run_search", "missing TAVILY_KEY");
    return {
      chatComplement: "run_search: thiếu TAVILY_KEY, trả về kết quả rỗng.",
      messages: [AIMessage({ content: "run_search: missing TAVILY_KEY" })],
      searchResults: JSON.stringify([]),
    };
  }

  const queries = state.searchQueries.length > 0 ? state.searchQueries : [state.topic ?? "foodtech grants circular economy"];
  logStep("run_search", "queries", queries);

  const allResults: TavilySearchResult[] = [];
  // Dùng toàn bộ queries sinh ra, tối đa 8 để đảm bảo đầy đủ dữ liệu mà vẫn có giới hạn an toàn.
  const searchQueries = queries.slice(0, 8);
  if (searchQueries.length < queries.length) {
    logStep("run_search", "queries truncated", { kept: searchQueries.length, dropped: queries.length - searchQueries.length });
  }
  for (const query of searchQueries) {
    try {
      logStep("run_search", "tavily request", query);
      const result = await tavilySearch(query, apiKey);
      logStep("run_search", "tavily response", { query, results: result.results.length });
      allResults.push(...result.results);
    } catch (err: any) {
      console.error(`Tavily error for query "${query}": ${err?.message ?? String(err)}`);
    }
  }

  // Deduplicate by URL.
  const seen = new Set<string>();
  const deduped = allResults.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  const output: TavilySearchResponse = {
    query: queries.join(" | "),
    results: deduped,
  };

  return {
    searchResults: JSON.stringify(output, null, 2),
    chatComplement: `run_search: ${deduped.length} unique results from Tavily (${searchQueries.length}/${queries.length} queries searched).`,
    messages: [AIMessage({ content: `run_search: ${deduped.length} results` })],
  };
}
