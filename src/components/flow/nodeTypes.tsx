import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Play, MessageSquare, HelpCircle, Keyboard, GitBranch, Variable,
  Globe, PhoneForwarded, MessageCircle, Clock, PhoneOff, type LucideIcon,
} from "lucide-react";

interface FlowNodeData {
  label: string;
  [key: string]: unknown;
}

const nodeStyles: Record<string, { icon: LucideIcon; accent: string; bg: string }> = {
  startNode: { icon: Play, accent: "text-emerald-400", bg: "border-emerald-500/40 bg-emerald-500/10" },
  greetingNode: { icon: MessageSquare, accent: "text-cyan-400", bg: "border-cyan-500/40 bg-cyan-500/10" },
  askQuestionNode: { icon: HelpCircle, accent: "text-blue-400", bg: "border-blue-500/40 bg-blue-500/10" },
  captureInputNode: { icon: Keyboard, accent: "text-violet-400", bg: "border-violet-500/40 bg-violet-500/10" },
  conditionNode: { icon: GitBranch, accent: "text-amber-400", bg: "border-amber-500/40 bg-amber-500/10" },
  variableNode: { icon: Variable, accent: "text-pink-400", bg: "border-pink-500/40 bg-pink-500/10" },
  webhookNode: { icon: Globe, accent: "text-orange-400", bg: "border-orange-500/40 bg-orange-500/10" },
  transferNode: { icon: PhoneForwarded, accent: "text-teal-400", bg: "border-teal-500/40 bg-teal-500/10" },
  smsNode: { icon: MessageCircle, accent: "text-green-400", bg: "border-green-500/40 bg-green-500/10" },
  waitNode: { icon: Clock, accent: "text-yellow-400", bg: "border-yellow-500/40 bg-yellow-500/10" },
  endCallNode: { icon: PhoneOff, accent: "text-red-400", bg: "border-red-500/40 bg-red-500/10" },
};

function FlowNode({ data, type, selected }: NodeProps) {
  const style = nodeStyles[type || "startNode"] || nodeStyles.startNode;
  const Icon = style.icon;
  const isStart = type === "startNode";
  const isEnd = type === "endCallNode";
  const isCondition = type === "conditionNode";

  return (
    <div
      className={`rounded-xl border px-4 py-3 min-w-[180px] shadow-lg transition-all duration-200 ${style.bg} ${
        selected ? "ring-2 ring-primary shadow-neon" : ""
      }`}
    >
      {!isStart && (
        <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-primary !border-2 !border-background" />
      )}
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${style.accent}`} />
        <span className="text-sm font-medium text-foreground truncate">{(data as FlowNodeData).label}</span>
      </div>
      {!isEnd && !isCondition && (
        <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-primary !border-2 !border-background" />
      )}
      {isCondition && (
        <>
          <Handle type="source" position={Position.Bottom} id="true" style={{ left: "30%" }} className="!w-3 !h-3 !bg-emerald-400 !border-2 !border-background" />
          <Handle type="source" position={Position.Bottom} id="false" style={{ left: "70%" }} className="!w-3 !h-3 !bg-red-400 !border-2 !border-background" />
          <div className="flex justify-between text-[10px] mt-1 px-1 text-muted-foreground">
            <span>True</span>
            <span>False</span>
          </div>
        </>
      )}
    </div>
  );
}

export const customNodeTypes = {
  startNode: memo(FlowNode),
  greetingNode: memo(FlowNode),
  askQuestionNode: memo(FlowNode),
  captureInputNode: memo(FlowNode),
  conditionNode: memo(FlowNode),
  variableNode: memo(FlowNode),
  webhookNode: memo(FlowNode),
  transferNode: memo(FlowNode),
  smsNode: memo(FlowNode),
  waitNode: memo(FlowNode),
  endCallNode: memo(FlowNode),
};

export const NODE_PALETTE = [
  { type: "greetingNode", label: "Say Text", icon: MessageSquare },
  { type: "askQuestionNode", label: "Ask Question", icon: HelpCircle },
  { type: "captureInputNode", label: "Capture Input", icon: Keyboard },
  { type: "conditionNode", label: "Condition", icon: GitBranch },
  { type: "variableNode", label: "Set Variable", icon: Variable },
  { type: "webhookNode", label: "API / Webhook", icon: Globe },
  { type: "transferNode", label: "Transfer Call", icon: PhoneForwarded },
  { type: "smsNode", label: "Send SMS", icon: MessageCircle },
  { type: "waitNode", label: "Wait / Delay", icon: Clock },
  { type: "endCallNode", label: "End Call", icon: PhoneOff },
] as const;
