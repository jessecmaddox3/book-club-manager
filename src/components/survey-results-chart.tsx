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

interface BookAverage {
  title: string;
  averageRating: number;
  voteCount: number;
  isLeader: boolean;
}

export function BookAveragesChart({ data }: { data: BookAverage[] }) {
  const sorted = [...data].sort((a, b) => b.averageRating - a.averageRating);

  return (
    <ResponsiveContainer width="100%" height={sorted.length * 52 + 20}>
      <BarChart
        data={sorted}
        layout="vertical"
        margin={{ left: 10, right: 30 }}
      >
        <XAxis
          type="number"
          domain={[0, 5]}
          tick={{ fill: "#7a6e5e", fontSize: 12 }}
          ticks={[0, 1, 2, 3, 4, 5]}
        />
        <YAxis
          type="category"
          dataKey="title"
          width={180}
          tick={{ fill: "#b8a990", fontSize: 12 }}
        />
        <Tooltip
          contentStyle={{
            background: "#211d17",
            border: "1px solid #3d3428",
            color: "#f5f0e8",
          }}
          formatter={(value) => [Number(value).toFixed(2), "Average"]}
        />
        <Bar dataKey="averageRating" radius={[0, 4, 4, 0]}>
          {sorted.map((entry, i) => (
            <Cell key={i} fill={entry.isLeader ? "#e2a63d" : "#3d3428"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

interface DateAvailability {
  label: string;
  yes: number;
  maybe: number;
  no: number;
  score: number;
  isBest: boolean;
}

export function DateAvailabilityChart({ data }: { data: DateAvailability[] }) {
  return (
    <div className="space-y-2">
      {data.map((date) => {
        const total = date.yes + date.maybe + date.no;
        if (total === 0) return null;
        return (
          <div key={date.label} className="flex items-center gap-3">
            <span className="text-xs text-secondary w-32 shrink-0 truncate">
              {date.label}
              {date.isBest && (
                <span className="ml-1.5 text-amber font-medium">*</span>
              )}
            </span>
            <div className="flex-1 flex h-5 rounded overflow-hidden bg-card">
              {date.yes > 0 && (
                <div
                  className="bg-success/40 flex items-center justify-center"
                  style={{ width: `${(date.yes / total) * 100}%` }}
                >
                  <span className="text-[10px] font-mono text-success">{date.yes}</span>
                </div>
              )}
              {date.maybe > 0 && (
                <div
                  className="bg-amber/30 flex items-center justify-center"
                  style={{ width: `${(date.maybe / total) * 100}%` }}
                >
                  <span className="text-[10px] font-mono text-amber">{date.maybe}</span>
                </div>
              )}
              {date.no > 0 && (
                <div
                  className="bg-error/30 flex items-center justify-center"
                  style={{ width: `${(date.no / total) * 100}%` }}
                >
                  <span className="text-[10px] font-mono text-error">{date.no}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-4 mt-2 text-[10px] text-muted">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-success/40" /> Yes</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber/30" /> Maybe</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-error/30" /> No</span>
        <span>* = best availability (yes counts 2, maybe counts 1)</span>
      </div>
    </div>
  );
}
