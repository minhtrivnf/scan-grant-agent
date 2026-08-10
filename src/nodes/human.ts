import { GraphStateType } from "../state.js";

export async function humanNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  // Node stub cho human-in-the-loop / feedback.
  // Trong thực tế, nơi này tạm dừng graph để lấy phản hồi người dùng.
  return {
    chatComplement: `Human node invoked with ${state.messages.length} messages.`,
  };
}
