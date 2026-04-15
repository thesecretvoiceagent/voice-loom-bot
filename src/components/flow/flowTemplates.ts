import type { Node, Edge } from "@xyflow/react";

export interface FlowTemplate {
  name: string;
  description: string;
  nodes: Node[];
  edges: Edge[];
}

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    name: "Blank Flow",
    description: "Start from scratch with just a start node",
    nodes: [
      { id: "start-1", type: "startNode", position: { x: 400, y: 50 }, data: { label: "Start" } },
    ],
    edges: [],
  },
  {
    name: "Outbound Debt Collection",
    description: "Basic outbound flow for payment follow-ups",
    nodes: [
      { id: "s1", type: "startNode", position: { x: 400, y: 0 }, data: { label: "Start" } },
      { id: "g1", type: "greetingNode", position: { x: 400, y: 100 }, data: { label: "Greeting", message: "Hi, this is {{agent_name}} calling from {{company}}. Am I speaking with {{contact_name}}?" } },
      { id: "q1", type: "askQuestionNode", position: { x: 400, y: 220 }, data: { label: "Confirm Identity", message: "Can you confirm your date of birth for verification?", retries: 2, timeout: 15 } },
      { id: "c1", type: "conditionNode", position: { x: 400, y: 360 }, data: { label: "Verified?", variable: "verified", operator: "equals", conditionValue: "yes" } },
      { id: "g2", type: "greetingNode", position: { x: 200, y: 500 }, data: { label: "Payment Reminder", message: "We're calling regarding an outstanding balance of {{amount}}. Would you like to make a payment today?" } },
      { id: "t1", type: "transferNode", position: { x: 200, y: 640 }, data: { label: "Transfer to Agent", transferNumber: "" } },
      { id: "e1", type: "endCallNode", position: { x: 600, y: 500 }, data: { label: "End - Unverified" } },
    ],
    edges: [
      { id: "e-s1-g1", source: "s1", target: "g1" },
      { id: "e-g1-q1", source: "g1", target: "q1" },
      { id: "e-q1-c1", source: "q1", target: "c1" },
      { id: "e-c1-g2", source: "c1", sourceHandle: "true", target: "g2" },
      { id: "e-c1-e1", source: "c1", sourceHandle: "false", target: "e1" },
      { id: "e-g2-t1", source: "g2", target: "t1" },
    ],
  },
  {
    name: "Inbound Support",
    description: "Handle incoming customer support calls",
    nodes: [
      { id: "s1", type: "startNode", position: { x: 400, y: 0 }, data: { label: "Start" } },
      { id: "g1", type: "greetingNode", position: { x: 400, y: 100 }, data: { label: "Welcome", message: "Thank you for calling {{company}} support. How can I help you today?" } },
      { id: "ci1", type: "captureInputNode", position: { x: 400, y: 220 }, data: { label: "Get Intent", variableName: "intent", inputType: "speech" } },
      { id: "c1", type: "conditionNode", position: { x: 400, y: 360 }, data: { label: "Route Intent", variable: "intent", operator: "contains", conditionValue: "billing" } },
      { id: "t1", type: "transferNode", position: { x: 200, y: 500 }, data: { label: "Billing Team", transferNumber: "" } },
      { id: "q1", type: "askQuestionNode", position: { x: 600, y: 500 }, data: { label: "More Details", message: "Can you describe the issue in more detail?", retries: 2, timeout: 20 } },
      { id: "w1", type: "webhookNode", position: { x: 600, y: 640 }, data: { label: "Create Ticket", endpoint: "", method: "POST" } },
      { id: "e1", type: "endCallNode", position: { x: 400, y: 780 }, data: { label: "End Call" } },
    ],
    edges: [
      { id: "e-s1-g1", source: "s1", target: "g1" },
      { id: "e-g1-ci1", source: "g1", target: "ci1" },
      { id: "e-ci1-c1", source: "ci1", target: "c1" },
      { id: "e-c1-t1", source: "c1", sourceHandle: "true", target: "t1" },
      { id: "e-c1-q1", source: "c1", sourceHandle: "false", target: "q1" },
      { id: "e-q1-w1", source: "q1", target: "w1" },
      { id: "e-w1-e1", source: "w1", target: "e1" },
    ],
  },
  {
    name: "Lead Qualification",
    description: "Qualify leads with a series of questions",
    nodes: [
      { id: "s1", type: "startNode", position: { x: 400, y: 0 }, data: { label: "Start" } },
      { id: "g1", type: "greetingNode", position: { x: 400, y: 100 }, data: { label: "Intro", message: "Hi {{contact_name}}, this is {{agent_name}} from {{company}}. Do you have a moment to chat?" } },
      { id: "q1", type: "askQuestionNode", position: { x: 400, y: 220 }, data: { label: "Budget", message: "What budget are you working with for this project?", retries: 1, timeout: 15 } },
      { id: "q2", type: "askQuestionNode", position: { x: 400, y: 360 }, data: { label: "Timeline", message: "When are you looking to get started?", retries: 1, timeout: 15 } },
      { id: "v1", type: "variableNode", position: { x: 400, y: 500 }, data: { label: "Set Qualified", varName: "qualified", varValue: "true" } },
      { id: "sms1", type: "smsNode", position: { x: 400, y: 620 }, data: { label: "Send Summary", toNumber: "{{contact_number}}", smsMessage: "Thanks for chatting! We'll follow up shortly." } },
      { id: "e1", type: "endCallNode", position: { x: 400, y: 740 }, data: { label: "End Call" } },
    ],
    edges: [
      { id: "e-s1-g1", source: "s1", target: "g1" },
      { id: "e-g1-q1", source: "g1", target: "q1" },
      { id: "e-q1-q2", source: "q1", target: "q2" },
      { id: "e-q2-v1", source: "q2", target: "v1" },
      { id: "e-v1-sms1", source: "v1", target: "sms1" },
      { id: "e-sms1-e1", source: "sms1", target: "e1" },
    ],
  },
];
