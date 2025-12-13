import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { time: "00:00", inbound: 12, outbound: 8 },
  { time: "04:00", inbound: 5, outbound: 3 },
  { time: "08:00", inbound: 28, outbound: 22 },
  { time: "12:00", inbound: 45, outbound: 38 },
  { time: "16:00", inbound: 52, outbound: 44 },
  { time: "20:00", inbound: 32, outbound: 28 },
  { time: "24:00", inbound: 18, outbound: 12 },
];

export function CallChart() {
  return (
    <div className="glass-card rounded-xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Call Volume</h3>
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
      </div>
    </div>
  );
}
