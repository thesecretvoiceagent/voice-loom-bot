import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface ChartDataPoint {
  time: string;
  inbound: number;
  outbound: number;
}

interface CallChartProps {
  data: ChartDataPoint[];
  loading?: boolean;
  title?: string;
}

export function CallChart({ data, loading, title = "Call Volume (Today)" }: CallChartProps) {
  if (loading) {
    return (
      <div className="glass-card rounded-xl p-6">
        <Skeleton className="h-6 w-32 mb-6" />
        <Skeleton className="h-[280px] w-full" />
      </div>
    );
  }

  const hasData = data.some((d) => d.inbound > 0 || d.outbound > 0);

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-success" />
            <span className="text-muted-foreground">Inbound</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-muted-foreground">Outbound</span>
          </div>
        </div>
      </div>
      <div className="h-[280px]">
        {!hasData ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No calls in this range yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="inboundGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142 76% 45%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(142 76% 45%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="outboundGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(173 80% 50%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(173 80% 50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(222 30% 18%)"
                vertical={false}
              />
              <XAxis
                dataKey="time"
                stroke="hsl(215 20% 55%)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="hsl(215 20% 55%)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(222 47% 10%)",
                  border: "1px solid hsl(222 30% 18%)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                labelStyle={{ color: "hsl(210 40% 98%)" }}
              />
              <Area
                type="monotone"
                dataKey="inbound"
                stroke="hsl(142 76% 45%)"
                strokeWidth={2}
                fill="url(#inboundGradient)"
              />
              <Area
                type="monotone"
                dataKey="outbound"
                stroke="hsl(173 80% 50%)"
                strokeWidth={2}
                fill="url(#outboundGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
