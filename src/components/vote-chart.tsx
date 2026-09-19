"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface VoteChartProps {
  data: { title: string; average_rating: number; was_selected: boolean }[];
}

export function VoteChart({ data }: VoteChartProps) {
  const sorted = [...data].sort(
    (a, b) => (b.average_rating || 0) - (a.average_rating || 0)
  );

  return (
    <ResponsiveContainer width="100%" height={sorted.length * 48 + 20}>
      <BarChart
        data={sorted}
        layout="vertical"
        margin={{ left: 10, right: 20 }}
      >
        <XAxis
          type="number"
          domain={[0, 5]}
          tick={{ fill: "#7a6e5e", fontSize: 12 }}
        />
        <YAxis
          type="category"
          dataKey="title"
          width={200}
          tick={{ fill: "#b8a990", fontSize: 12 }}
        />
        <Tooltip
          contentStyle={{
            background: "#211d17",
            border: "1px solid #3d3428",
            color: "#f5f0e8",
          }}
        />
        <Bar dataKey="average_rating" radius={[0, 4, 4, 0]}>
          {sorted.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.was_selected ? "#e2a63d" : "#3d3428"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
