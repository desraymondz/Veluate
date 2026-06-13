"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatTimestamp } from "@/lib/format";
import type { HeatmapPoint } from "@/lib/types";

type Props = {
  heatmap: HeatmapPoint[];
};

/** DESIGN.md heatmap palette — data encoding only */
function heatColor(severity: number): string {
  if (severity >= 0.85) return "#9E1B1B";
  if (severity >= 0.65) return "#E05C2A";
  if (severity >= 0.4) return "#F4A26A";
  if (severity >= 0.15) return "#FDE8D8";
  return "#F0F0F0";
}

export function ConfusionHeatmap({ heatmap }: Props) {
  if (!heatmap.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No confusion points detected.
      </p>
    );
  }

  const data = heatmap.map((point, i) => ({
    name: formatTimestamp(point.start_sec),
    severity: Math.round(point.severity * 100),
    reason: point.reason,
    index: i,
    raw: point,
  }));

  return (
    <div className="space-y-6">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#D9D9D9" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "#8A8A8A", fontFamily: "var(--font-jetbrains)" }}
              axisLine={{ stroke: "#D9D9D9" }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: "#8A8A8A", fontFamily: "var(--font-jetbrains)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "#F0F0F0" }}
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const item = payload[0].payload as (typeof data)[0];
                return (
                  <div className="max-w-xs border border-border bg-card px-3 py-2.5 text-sm shadow-none">
                    <p className="font-data font-medium text-foreground">
                      {formatTimestamp(item.raw.start_sec)} –{" "}
                      {formatTimestamp(item.raw.end_sec)}
                    </p>
                    <p className="mt-1 text-muted-foreground">{item.reason}</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="severity" radius={0}>
              {data.map((entry) => (
                <Cell key={entry.index} fill={heatColor(entry.raw.severity)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="divide-y divide-border border border-border">
        {heatmap.map((point, i) => (
          <div key={i} className="px-4 py-3.5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-data text-xs text-muted-foreground">
                {formatTimestamp(point.start_sec)} –{" "}
                {formatTimestamp(point.end_sec)}
              </span>
              <span className="font-data text-xs font-medium tabular-nums text-foreground">
                {Math.round(point.severity * 100)}%
              </span>
            </div>
            <p className="mt-2 leading-relaxed text-foreground">{point.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
