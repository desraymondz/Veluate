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

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTimestamp } from "@/lib/format";
import type { HeatmapPoint } from "@/lib/types";

type Props = {
  heatmap: HeatmapPoint[];
};

function barColor(severity: number): string {
  if (severity >= 0.7) return "hsl(0 72% 51%)";
  if (severity >= 0.4) return "hsl(38 92% 50%)";
  return "hsl(142 71% 45%)";
}

export function ConfusionHeatmap({ heatmap }: Props) {
  if (!heatmap.length) {
    return (
      <p className="text-sm text-muted-foreground">No confusion points detected.</p>
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
    <div className="space-y-4">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 12 }}
              label={{ value: "Severity %", angle: -90, position: "insideLeft" }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const item = payload[0].payload as (typeof data)[0];
                return (
                  <div className="max-w-xs rounded-lg border bg-background p-3 text-sm shadow-md">
                    <p className="font-medium">
                      {formatTimestamp(item.raw.start_sec)} –{" "}
                      {formatTimestamp(item.raw.end_sec)}
                    </p>
                    <p className="mt-1 text-muted-foreground">{item.reason}</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="severity" radius={[4, 4, 0, 0]}>
              {data.map((entry) => (
                <Cell key={entry.index} fill={barColor(entry.raw.severity)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-2">
        {heatmap.map((point, i) => (
          <div
            key={i}
            className="rounded-lg border bg-muted/30 px-3 py-2 text-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                {formatTimestamp(point.start_sec)} –{" "}
                {formatTimestamp(point.end_sec)}
              </span>
              <span className="text-xs font-medium">
                {Math.round(point.severity * 100)}% severity
              </span>
            </div>
            <p className="mt-1">{point.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ConfusionHeatmapCard({ heatmap }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Confusion heatmap</CardTitle>
      </CardHeader>
      <CardContent>
        <ConfusionHeatmap heatmap={heatmap} />
      </CardContent>
    </Card>
  );
}
