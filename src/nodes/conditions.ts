import { GraphStateType } from "../state.js";

export function shouldContinue(state: GraphStateType): "tools" | "__end__" {
  const lastMessage = state.messages[state.messages.length - 1];
  if (!lastMessage || lastMessage.getType() !== "ai") return "__end__";
  const aiMessage = lastMessage as import("@langchain/core/messages").AIMessage;
  if (Array.isArray(aiMessage.tool_calls) && aiMessage.tool_calls.length > 0) {
    return "tools";
  }
  return "__end__";
}
