import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
} from 'recharts';
import { GitCompare, Layers, Plus, X, ChevronDown } from 'lucide-react';
import { ExerciseBlueprint, ExerciseLog } from '../../server/types';

interface OverlayCorrelationChartProps {
  exercises: ExerciseBlueprint[];
  logs: ExerciseLog[];
  flashTrigger: number;
}

interface MetricOption {
  key: string; // e.g. 'muscle_up_transition_pulses::Reps'
  exerciseId: string;
  exerciseName: string;
  metricName: string;
  unit: string;
  label: string;
  personal_best?: number;
}

function computePearsonR(pairs: Array<{ a: number; b: number }>): number | null {
  if (pairs.length < 2) return null;
  const n = pairs.length;
  const meanA = pairs.reduce((s, p) => s + p.a, 0) / n;
  const meanB = pairs.reduce((s, p) => s + p.b, 0) / n;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (const p of pairs) {
    const da = p.a - meanA;
    const db = p.b - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  if (den === 0) return 0;
  return Math.round((num / den) * 100) / 100;
}

const VARIABLE_STYLES = [
  {
    stroke: '#00f59b',
    text: 'text-emerald-400',
    border: 'border-emerald-400/60',
    bgBadge: 'pill-emerald',
    name: 'VARIABLE 1',
  },
  {
    stroke: '#00f0ff',
    text: 'text-sky-400',
    border: 'border-cyan-400/60',
    bgBadge: 'pill-cyan',
    name: 'VARIABLE 2',
  },
  {
    stroke: '#c084fc',
    text: 'text-purple-400',
    border: 'border-purple-400/60',
    bgBadge: 'pill-purple',
    name: 'VARIABLE 3',
  },
  {
    stroke: '#f59e0b',
    text: 'text-amber-400',
    border: 'border-amber-400/60',
    bgBadge: 'pill-amber',
    name: 'VARIABLE 4',
  },
];

export const OverlayCorrelationChart: React.FC<OverlayCorrelationChartProps> = ({
  exercises,
  logs,
  flashTrigger,
}) => {
  const metricOptions = useMemo<MetricOption[]>(() => {
    const opts: MetricOption[] = [];
    for (const ex of exercises) {
      for (const m of ex.metrics) {
        opts.push({
          key: `${ex.id}::${m.name}`,
          exerciseId: ex.id,
          exerciseName: ex.name,
          metricName: m.name,
          unit: m.unit,
          label: `${ex.name} — ${m.name} (${m.unit})${ex.personal_best ? ` [PR: ${ex.personal_best}${m.unit}]` : ''}`,
          personal_best: ex.personal_best,
        });
      }
    }
    return opts;
  }, [exercises]);

  // Support comparing up to 4 variables (default: 4 variables comparing Recovery Biometrics & Performance)
  const [selectedKeys, setSelectedKeys] = useState<string[]>([
    'deep_sleep::Minutes',
    'hrv::rMSSD',
    'dips::Reps',
    'weighted_pullups::Weight',
  ]);
  const [normalizedMode, setNormalizedMode] = useState<boolean>(true);

  // Fallback defaults if options don't match
  const activeMetrics = useMemo(() => {
    return selectedKeys.map((key, idx) => {
      const match = metricOptions.find((o) => o.key === key);
      return match || metricOptions[idx % metricOptions.length];
    });
  }, [selectedKeys, metricOptions]);

  const handleKeyChange = (index: number, newKey: string) => {
    setSelectedKeys((prev) => {
      const next = [...prev];
      next[index] = newKey;
      return next;
    });
  };

  const handleAddVariable = () => {
    if (selectedKeys.length >= 4) return;
    const unused = metricOptions.find((o) => !selectedKeys.includes(o.key));
    const nextKey = unused ? unused.key : metricOptions[0].key;
    setSelectedKeys((prev) => [...prev, nextKey]);
  };

  const handleRemoveVariable = (index: number) => {
    if (selectedKeys.length <= 2) return; // Keep at least 2 for correlation
    setSelectedKeys((prev) => prev.filter((_, i) => i !== index));
  };

  const { chartData, correlations } = useMemo(() => {
    if (activeMetrics.length < 2) return { chartData: [], correlations: [] };

    const activeExerciseIds = new Set(activeMetrics.map((m) => m.exerciseId));

    // Group logs by date bucket (YYYY-MM-DD)
    const dayBuckets = new Map<
      string,
      {
        dateKey: string;
        timestamp: number;
        label: string;
        rawValues: Record<number, number>;
        modifiers: Record<number, string | number | null>;
        tags: Set<string>;
      }
    >();

    const sortedLogs = [...logs].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    for (const log of sortedLogs) {
      if (!activeExerciseIds.has(log.exercise_id)) continue;

      const d = new Date(log.timestamp);
      const dateKey = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      if (!dayBuckets.has(dateKey)) {
        dayBuckets.set(dateKey, {
          dateKey,
          timestamp: d.getTime(),
          label,
          rawValues: {},
          modifiers: {},
          tags: new Set<string>(),
        });
      }

      const bucket = dayBuckets.get(dateKey)!;
      const isRecovery = ["total_sleep_duration", "deep_sleep", "rem_sleep", "resting_heart_rate", "hrv"].includes(log.exercise_id);
      if (!isRecovery) {
        (log.session_tags || []).forEach((t) => bucket.tags.add(t));
      }

      activeMetrics.forEach((m, idx) => {
        if (log.exercise_id === m.exerciseId) {
          const val = log.metric_values?.[m.metricName];
          if (val !== undefined) {
            bucket.rawValues[idx] = val;
            bucket.modifiers[idx] = log.modifier_value ?? null;
          }
        }
      });
    }

    const rows = Array.from(dayBuckets.values()).sort((a, b) => a.timestamp - b.timestamp);

    // Compute min / max for each active metric
    const minMaxMap: Record<number, { min: number; max: number }> = {};
    activeMetrics.forEach((_, idx) => {
      const vals = rows
        .map((r) => r.rawValues[idx])
        .filter((v): v is number => v !== undefined);
      minMaxMap[idx] = {
        min: vals.length ? Math.min(...vals) : 0,
        max: vals.length ? Math.max(...vals) : 100,
      };
    });

    const normalize = (val: number | undefined, idx: number, min: number, max: number) => {
      if (val === undefined) return undefined;
      const opt = activeMetrics[idx];
      if (opt?.personal_best && opt.personal_best > 0) {
        // Direct PR-anchored percentage (e.g. 20kg / 25kg PR = 80%)
        return Math.min(110, Math.round((val / opt.personal_best) * 100));
      }
      if (max === min) return 100;
      return Math.round(((val - min) / (max - min)) * 80 + 20);
    };

    const data = rows.map((r) => {
      const rowItem: Record<string, any> = {
        label: r.label,
        primaryTag: r.tags.has('Sore') ? 'Sore' : 'Fresh',
        tags: Array.from(r.tags).join(', ') || 'Fresh',
      };

      activeMetrics.forEach((_, idx) => {
        const raw = r.rawValues[idx];
        rowItem[`raw_${idx}`] = raw;
        rowItem[`norm_${idx}`] = normalize(raw, idx, minMaxMap[idx].min, minMaxMap[idx].max);
        rowItem[`mod_${idx}`] = r.modifiers[idx];
      });

      return rowItem;
    });

    // Pairwise correlations between Variable 0 and subsequent variables
    const corrs: Array<{ label: string; r: number; pairText: string }> = [];
    for (let i = 1; i < activeMetrics.length; i++) {
      const pairs: Array<{ a: number; b: number }> = [];
      rows.forEach((r) => {
        if (r.rawValues[0] !== undefined && r.rawValues[i] !== undefined) {
          pairs.push({ a: r.rawValues[0], b: r.rawValues[i] });
        }
      });
      const rVal = computePearsonR(pairs);
      if (rVal !== null) {
        corrs.push({
          label: `${activeMetrics[0].exerciseName} ↔ ${activeMetrics[i].exerciseName}`,
          r: rVal,
          pairText: `r(${activeMetrics[0].exerciseName.split(' ')[0]}, ${activeMetrics[i].exerciseName.split(' ')[0]}) = ${
            rVal >= 0 ? `+${rVal}` : rVal
          }`,
        });
      }
    }

    return { chartData: data, correlations: corrs };
  }, [logs, activeMetrics]);

  return (
    <div
      key={flashTrigger}
      className="vasco-card p-5 sm:p-6 shadow-2xl flex flex-col justify-between"
    >
      <div>
        {/* Header & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-400/60 flex items-center justify-center text-cyan-300 shadow-[0_0_16px_rgba(6,182,212,0.45)]">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                CORRELATION CHART
              </h3>
              <p className="text-xs text-slate-300/80 mt-0.5">
                Compare up to 4 variables (biometric and exercise) on normalized dual-axis
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setNormalizedMode((prev) => !prev)}
              className="pill-purple px-4 py-1.5 rounded-full text-xs font-mono font-medium flex items-center gap-1.5 transition cursor-pointer hover:brightness-110"
            >
              <Layers className="w-3.5 h-3.5 text-purple-300" />
              {normalizedMode ? 'Normalized (0–100%)' : 'Raw Values'}
            </button>
            {selectedKeys.length < 4 && (
              <button
                type="button"
                onClick={handleAddVariable}
                className="pill-cyan px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 transition cursor-pointer hover:brightness-110"
                title="Add up to 4 variables for multi-variable correlation"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Variable</span>
              </button>
            )}
          </div>
        </div>

        {/* Up to 4 Metric Dropdowns in Responsive Grid */}
        <div
          className={`grid gap-2.5 mb-4 ${
            activeMetrics.length === 2
              ? 'grid-cols-1 sm:grid-cols-2'
              : activeMetrics.length === 3
              ? 'grid-cols-1 sm:grid-cols-3'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
          }`}
        >
          {activeMetrics.map((opt, idx) => {
            const style = VARIABLE_STYLES[idx];
            return (
              <div key={idx} className={`p-3 vasco-select-box relative border ${style.border}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={`text-[10px] font-mono uppercase tracking-wider font-bold ${style.text}`}>
                    {style.name}
                  </label>
                  {selectedKeys.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveVariable(idx)}
                      title="Remove this variable"
                      className="text-slate-400 hover:text-rose-400 transition cursor-pointer p-0.5 z-10"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="relative">
                  {/* Clean closed view: ONLY the clean exercise name and chevron */}
                  <div className="flex items-center justify-between pointer-events-none text-xs font-bold text-white truncate pr-5 py-0.5">
                    <span className="truncate">{opt.exerciseName}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-purple-300 shrink-0 absolute right-0 top-1/2 -translate-y-1/2" />
                  </div>

                  {/* Fully functional native select on click */}
                  <select
                    value={selectedKeys[idx] || opt.key}
                    onChange={(e) => handleKeyChange(idx, e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-xs"
                  >
                    {metricOptions.map((o) => (
                      <option key={o.key} value={o.key} className="bg-[#0b071b] text-white">
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>

        {/* Chart Area */}
        <div className="h-[290px] w-full">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center border border-dashed border-purple-500/30 rounded-2xl text-xs text-slate-400">
              No logs recorded yet for the selected metrics. Speak or log an entry above!
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#23184a" />
                <XAxis dataKey="label" stroke="#818cf8" tick={{ fill: '#c7d2fe', fontSize: 11 }} />
                <YAxis
                  yAxisId="left"
                  domain={normalizedMode ? [0, 110] : ['auto', 'auto']}
                  ticks={normalizedMode ? [0, 30, 60, 110] : undefined}
                  unit={normalizedMode ? '%' : ''}
                  stroke="#818cf8"
                  tick={{ fill: '#c7d2fe', fontSize: 11 }}
                />

                {/* Contextual Session Tag Background Tinting for Sore */}
                {chartData.map((pt, idx) => {
                  if (pt.primaryTag === 'Sore') {
                    return (
                      <ReferenceArea
                        key={idx}
                        yAxisId="left"
                        x1={pt.label}
                        x2={pt.label}
                        fill="#f43f5e"
                        fillOpacity={0.14}
                      />
                    );
                  }
                  return null;
                })}

                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const row = payload[0].payload;
                    return (
                      <div className="p-3.5 rounded-2xl vasco-card border border-purple-500/50 text-xs space-y-2 shadow-2xl min-w-[220px]">
                        <div className="flex items-center justify-between gap-4 border-b border-purple-500/30 pb-1.5">
                          <span className="font-bold text-white">{row.label}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                              row.primaryTag === 'Sore' ? 'pill-rose' : 'pill-emerald'
                            }`}
                          >
                            Tag: {row.tags}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {activeMetrics.map((m, idx) => {
                            const raw = row[`raw_${idx}`];
                            if (raw === undefined) return null;
                            const style = VARIABLE_STYLES[idx];
                            return (
                              <div
                                key={idx}
                                className="flex items-center justify-between gap-2"
                                style={{ color: style.stroke }}
                              >
                                <span>{m.exerciseName}:</span>
                                <strong>
                                  {raw} {m.unit}
                                  {m.personal_best ? (
                                    <span className="font-normal text-[10px] ml-1 opacity-80">
                                      ({Math.round((raw / m.personal_best) * 100)}% PR)
                                    </span>
                                  ) : null}
                                </strong>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }}
                />

                {/* Dynamic Lines for up to 4 variables */}
                {activeMetrics.map((_, idx) => {
                  const style = VARIABLE_STYLES[idx];
                  return (
                    <Line
                      key={idx}
                      yAxisId="left"
                      type="monotone"
                      connectNulls
                      dataKey={normalizedMode ? `norm_${idx}` : `raw_${idx}`}
                      stroke={style.stroke}
                      strokeWidth={3}
                      dot={{ r: 5.5, fill: style.stroke, strokeWidth: 2, stroke: '#0c0721' }}
                      activeDot={{ r: 8, stroke: '#fff', strokeWidth: 2 }}
                    />
                  );
                })}
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Footer Legend */}
      <div className="flex flex-wrap items-center justify-between pt-3 border-t border-purple-500/30 text-xs text-slate-300 gap-2">
        <div className="flex flex-wrap items-center gap-4">
          {activeMetrics.map((opt, idx) => {
            const style = VARIABLE_STYLES[idx];
            return (
              <span key={idx} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block shadow-md"
                  style={{ backgroundColor: style.stroke }}
                />
                <span className="font-medium text-white">{opt.exerciseName}</span>
                <span className="text-slate-400 font-mono text-[11px]">({opt.metricName})</span>
              </span>
            );
          })}
        </div>
        <span className="text-[11px] font-mono text-purple-300">
          Session Tags: Fresh / Sore
        </span>
      </div>
    </div>
  );
};
