import { useCallback } from "react";
import type { Node } from "@xyflow/react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Copy, X } from "lucide-react";

interface Props {
  node: Node;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (node: Node) => void;
  onClose: () => void;
}

export function NodeConfigPanel({ node, onUpdate, onDelete, onDuplicate, onClose }: Props) {
  const update = useCallback(
    (key: string, value: unknown) => {
      onUpdate(node.id, { ...node.data, [key]: value });
    },
    [node, onUpdate]
  );

  const handleDelete = () => {
    if (confirm(`Delete "${node.data.label}" node?`)) {
      onDelete(node.id);
    }
  };

  return (
    <div className="w-72 border-l border-border bg-card/80 backdrop-blur-sm flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground truncate">Configure Node</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Common: label */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Node Label</label>
          <Input
            value={(node.data.label as string) || ""}
            onChange={(e) => update("label", e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        {/* Type-specific fields */}
        {(node.type === "greetingNode" || node.type === "askQuestionNode") && (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {node.type === "greetingNode" ? "Message Text" : "Question Text"}
              </label>
              <Textarea
                value={(node.data.message as string) || ""}
                onChange={(e) => update("message", e.target.value)}
                rows={3}
                className="text-sm"
                placeholder={node.type === "greetingNode" ? "Hello, how can I help?" : "What is your account number?"}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Voice</label>
              <Select value={(node.data.voice as string) || "alloy"} onValueChange={(v) => update("voice", v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["alloy", "echo", "fable", "onyx", "nova", "shimmer"].map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {node.type === "askQuestionNode" && (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Max Retries</label>
              <Input type="number" value={(node.data.retries as number) ?? 2} onChange={(e) => update("retries", parseInt(e.target.value))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Timeout (sec)</label>
              <Input type="number" value={(node.data.timeout as number) ?? 10} onChange={(e) => update("timeout", parseInt(e.target.value))} className="h-8 text-sm" />
            </div>
          </>
        )}

        {node.type === "conditionNode" && (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Variable</label>
              <Input value={(node.data.variable as string) || ""} onChange={(e) => update("variable", e.target.value)} className="h-8 text-sm" placeholder="e.g. intent" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Operator</label>
              <Select value={(node.data.operator as string) || "equals"} onValueChange={(v) => update("operator", v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["equals", "not_equals", "contains", "greater_than", "less_than"].map((o) => (
                    <SelectItem key={o} value={o}>{o.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Value</label>
              <Input value={(node.data.conditionValue as string) || ""} onChange={(e) => update("conditionValue", e.target.value)} className="h-8 text-sm" placeholder="e.g. yes" />
            </div>
          </>
        )}

        {node.type === "webhookNode" && (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Endpoint URL</label>
              <Input value={(node.data.endpoint as string) || ""} onChange={(e) => update("endpoint", e.target.value)} className="h-8 text-sm" placeholder="https://api.example.com/..." />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Method</label>
              <Select value={(node.data.method as string) || "POST"} onValueChange={(v) => update("method", v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Payload Template</label>
              <Textarea value={(node.data.payload as string) || ""} onChange={(e) => update("payload", e.target.value)} rows={4} className="text-sm font-mono" placeholder='{"key": "{{variable}}"}' />
            </div>
          </>
        )}

        {node.type === "transferNode" && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Transfer Number</label>
            <Input value={(node.data.transferNumber as string) || ""} onChange={(e) => update("transferNumber", e.target.value)} className="h-8 text-sm" placeholder="+1234567890" />
          </div>
        )}

        {node.type === "smsNode" && (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">To Number</label>
              <Input value={(node.data.toNumber as string) || ""} onChange={(e) => update("toNumber", e.target.value)} className="h-8 text-sm" placeholder="{{caller_number}}" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Message</label>
              <Textarea value={(node.data.smsMessage as string) || ""} onChange={(e) => update("smsMessage", e.target.value)} rows={3} className="text-sm" />
            </div>
          </>
        )}

        {node.type === "waitNode" && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Delay (seconds)</label>
            <Input type="number" value={(node.data.delay as number) ?? 5} onChange={(e) => update("delay", parseInt(e.target.value))} className="h-8 text-sm" />
          </div>
        )}

        {node.type === "captureInputNode" && (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Variable Name</label>
              <Input value={(node.data.variableName as string) || ""} onChange={(e) => update("variableName", e.target.value)} className="h-8 text-sm" placeholder="e.g. account_number" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Input Type</label>
              <Select value={(node.data.inputType as string) || "speech"} onValueChange={(v) => update("inputType", v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="speech">Speech</SelectItem>
                  <SelectItem value="dtmf">DTMF (keypad)</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {node.type === "variableNode" && (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Variable Name</label>
              <Input value={(node.data.varName as string) || ""} onChange={(e) => update("varName", e.target.value)} className="h-8 text-sm" placeholder="e.g. status" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Value</label>
              <Input value={(node.data.varValue as string) || ""} onChange={(e) => update("varValue", e.target.value)} className="h-8 text-sm" placeholder="e.g. confirmed" />
            </div>
          </>
        )}
      </div>

      {/* Footer actions */}
      <div className="p-3 border-t border-border flex items-center gap-2">
        <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => onDuplicate(node)}>
          <Copy className="h-3.5 w-3.5" /> Duplicate
        </Button>
        <Button variant="destructive" size="sm" className="gap-1.5" onClick={handleDelete}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
      </div>
    </div>
  );
}
