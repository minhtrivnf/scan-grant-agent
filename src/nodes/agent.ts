import { GraphStateType } from "../state.js";
import { openai, DEFAULT_MODEL } from "../llm.js";
import { AIMessage, ToolMessage } from "@langchain/core/messages";
import { toolNode } from "./tools.js";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";

function toOpenAIMessages(messages: GraphStateType["messages"]): ChatCompletionMessageParam[] {
  return messages.map((m) => {
    const type = m.getType();
    if (type === "system") {
      return { role: "system", content: String(m.content) };
    }
    if (type === "human") {
      return { role: "user", content: String(m.content) };
    }
    if (type === "ai") {
      const ai = m as AIMessage;
      const toolCalls =
        ai.tool_calls?.map((tc) => ({
          id: tc.id ?? "",
          type: "function" as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.args),
          },
        })) ?? [];
      return {
        role: "assistant",
        content: String(m.content ?? ""),
        tool_calls: toolCalls,
      };
    }
    if (type === "tool") {
      const tm = m as ToolMessage;
      return {
        role: "tool",
        content: String(m.content),
        tool_call_id: tm.tool_call_id,
      };
    }
    return { role: "user", content: String(m.content) };
  });
}

export async function agentNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  const tools: ChatCompletionTool[] = toolNode.tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description ?? "",
      parameters: t.schema as Record<string, unknown>,
    },
  }));

  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: toOpenAIMessages(state.messages),
    tools,
    tool_choice: "auto",
    temperature: 0,
  });

  const choice = response.choices[0];
  const message = choice.message;

  const aiMessage = new AIMessage({
    content: message.content ?? "",
    tool_calls: message.tool_calls
      ?.filter((tc): tc is typeof tc & { type: "function"; function: { name: string; arguments: string } } => tc.type === "function")
      .map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        args: JSON.parse(tc.function.arguments) as Record<string, unknown>,
      })),
  });

  return { messages: [aiMessage] };
}
