import { graph } from "./graph.js";
import { HumanMessage } from "@langchain/core/messages";

async function main() {
  const result = await graph.invoke({
    messages: [new HumanMessage("Xin chào, hãy giới thiệu bản thân và tìm kiếm thông tin về LangGraph.")],
  });

  console.dir(result.messages, { depth: null });
  console.log("\n--- chatComplement ---\n");
  console.log(result.chatComplement);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
