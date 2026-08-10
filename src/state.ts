import { Annotation } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";

function append<T>(existing?: T[], incoming?: T[]): T[] {
  if (!incoming || incoming.length === 0) return existing ?? [];
  if (!existing || existing.length === 0) return incoming;
  return [...existing, ...incoming];
}

function appendString(existing?: string, incoming?: string): string {
  if (!incoming) return existing ?? "";
  if (!existing) return incoming;
  return `${existing}\n---\n${incoming}`;
}

export const GraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: append,
    default: () => [],
  }),
  chatComplement: Annotation<string>({
    reducer: appendString,
    default: () => "",
  }),
});

export type GraphStateType = typeof GraphState.State;
