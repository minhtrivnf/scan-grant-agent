import { GraphStateType } from "../state.js";
import { AIMessage } from "../messages.js";
import { logStep } from "../logger.js";

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export async function extractCandidateContentNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  const url = state.currentGrant?.website?.trim() ?? "";
  logStep("extract_candidate_content", "enter", { url, grant: state.currentGrant?.name ?? null });

  if (!url || !url.startsWith("http")) {
    return {
      sourceContent: undefined,
      chatComplement: "extract_candidate_content: không có URL hợp lệ để lấy nội dung.",
      messages: [AIMessage({ content: "extract_candidate_content: no url" })],
    };
  }

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (scan-grant-agent)",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();
    const cleaned = contentType.includes("text/html") ? stripHtml(text) : text.replace(/\s+/g, " ").trim();
    const clipped = cleaned.slice(0, 20000);

    logStep("extract_candidate_content", "fetched", { url, contentType, chars: clipped.length });
    return {
      sourceContent: clipped,
      chatComplement: `extract_candidate_content: ${clipped.length} chars from ${url}`,
      messages: [AIMessage({ content: `extract_candidate_content: ${url}` })],
    };
  } catch (err: any) {
    logStep("extract_candidate_content", "failed", { url, error: err?.message ?? String(err) });
    return {
      sourceContent: undefined,
      chatComplement: `extract_candidate_content: lỗi lấy nội dung từ ${url}`,
      messages: [AIMessage({ content: `extract_candidate_content failed: ${url}` })],
    };
  }
}
