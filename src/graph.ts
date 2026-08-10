import { StateGraph } from "@langchain/langgraph";
import { GraphState } from "./state.js";
import { agentNode } from "./nodes/agent.js";
import { toolNode } from "./nodes/tools.js";
import { shouldContinue } from "./nodes/conditions.js";

export const graph = new StateGraph(GraphState)
  .addNode("agent", agentNode)
  .addNode("tools", toolNode)
  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("tools", "agent")
  .compile();

export type AgentGraph = typeof graph;
