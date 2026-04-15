import { NODE_PALETTE } from "./nodeTypes";

export function FlowSidebar() {
  const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
    event.dataTransfer.setData("application/reactflow-type", nodeType);
    event.dataTransfer.setData("application/reactflow-label", label);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="w-56 border-r border-border bg-card/80 backdrop-blur-sm flex flex-col overflow-hidden">
      <div className="p-3 border-b border-border">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Node Types</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {NODE_PALETTE.map(({ type, label, icon: Icon }) => (
          <div
            key={type}
            draggable
            onDragStart={(e) => onDragStart(e, type, label)}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-border/50 bg-secondary/30 cursor-grab active:cursor-grabbing hover:bg-secondary/60 hover:border-primary/30 transition-all duration-200 text-sm"
          >
            <Icon className="h-4 w-4 text-primary shrink-0" />
            <span className="text-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
