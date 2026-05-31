"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type PricePoint = {
  date: string | Date;
  lowestTrustedPrice?: number;
  minNewPrice?: number;
  avgNewPrice?: number;
};

type PriceHistoryChartProps = {
  history: PricePoint[];
  currentPrice?: number;
  height?: number;
};

export function PriceHistoryChart({ history, currentPrice, height = 260 }: PriceHistoryChartProps) {
  const data = history.map((point) => ({
    date: formatDate(point.date),
    price: point.lowestTrustedPrice ?? point.minNewPrice ?? 0,
    average: point.avgNewPrice,
  }));

  return (
    <div className="h-[260px] w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#e4e4e7" strokeDasharray="3 3" />
          <XAxis dataKey="date" minTickGap={28} tick={{ fontSize: 12, fill: "#52525b" }} />
          <YAxis
            tickFormatter={(value) => `$${value}`}
            tick={{ fontSize: 12, fill: "#52525b" }}
            width={52}
            domain={["dataMin - 15", "dataMax + 15"]}
          />
          <Tooltip
            formatter={(value) => [`$${Math.round(Number(value ?? 0))}`, "Price"]}
            labelStyle={{ color: "#18181b" }}
            contentStyle={{ borderColor: "#d4d4d8", borderRadius: 8 }}
          />
          {currentPrice ? <ReferenceLine y={currentPrice} stroke="#0f766e" strokeDasharray="4 4" /> : null}
          <Line type="monotone" dataKey="price" stroke="#0f766e" strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="average" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
