import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Activity } from 'lucide-react';
import { ExerciseBlueprint, ExerciseLog } from '../../server/types';

interface ProgressionChartProps {
  exercises: ExerciseBlueprint[];
  logs: ExerciseLog[];
  flashTrigger: number;
}

/**
 * Maps Modifier values (e.g., Band Assistance: Heavy -> Medium -> Light -> None,
 * Deficit: Floor -> Parallettes -> Blocks, Form Quality: 1-5, or Additional Weight)
 * to distinct colors and dot radii so nuanced calisthenics progression is immediately visible.
 */
function getModifierVisualStyle(modifierVal: string | number | null | undefined): {
  color: string;
  radius: number;
  label: string;
} {
  if (modifierVal === null || modifierVal === undefined || modifierVal === '') {
    return { color: '#10b981', radius: 6, label: 'Standard' };
  }
  const str = String(modifierVal).toLowerCase();

  // Band Assistance progression: Heavy (purple/small) -> Medium (blue/med) -> Light (cyan/large) -> None (emerald/XL)
  if (str.includes('heavy')) return { color: '#a855f7', radius: 5, label: 'Band: Heavy' };
  if (str.includes('medium')) return { color: '#3b82f6', radius: 6.5, label: 'Band: Medium' };
  if (str.includes('light')) return { color: '#06b6d4', radius: 8, label: 'Band: Light' };
  if (str === 'none' || str.includes('unassisted')) {
    return { color: '#10b981', radius: 9.5, label: 'Unassisted (None)' };
  }

  // Pike Press Deficit progression: Floor -> Parallettes -> Blocks
  if (str.includes('floor')) return { color: '#3b82f6', radius: 5.5, label: 'ROM: Floor' };
  if (str.includes('parallette')) return { color: '#06b6d4', radius: 7.5, label: 'ROM: Parallettes' };
  if (str.includes('block')) return { color: '#10b981', radius: 9, label: 'ROM: Blocks' };

  // Additional Weight on Dips
  if (str.includes('bodyweight')) return { color: '#38bdf8', radius: 5.5, label: 'Bodyweight' };
  if (str.startsWith('+')) {
    const kg = parseFloat(str.replace('+', ''));
    const r = Math.min(10, Math.max(6, 5 + kg / 4));
    return { color: '#f59e0b', radius: r, label: `Load: ${modifierVal}` };
  }

  // Sleep & Readiness Recovery Biometrics
  if (str.includes('deep') || str.includes('optimal')) {
    return { color: '#00f59b', radius: 8, label: String(modifierVal) };
  }
  if (str.includes('restful') || str.includes('moderate')) {
    return { color: '#00f0ff', radius: 7, label: String(modifierVal) };
  }
  if (str.includes('restless') || str.includes('low') || str.includes('light')) {
    return { color: '#f43f5e', radius: 6, label: String(modifierVal) };
  }

  // Numeric Form Quality (1 - 5)
  const num = Number(modifierVal);
  if (!Number.isNaN(num)) {
    if (num >= 5) return { color: '#10b981', radius: 8, label: `Form: ${num}/5` };
    if (num >= 4) return { color: '#38bdf8', radius: 6.5, label: `Form: ${num}/5` };
    return { color: '#f43f5e', radius: 5.5, label: `Form: ${num}/5` };
  }

  return { color: '#10b981', radius: 6.5, label: String(modifierVal) };
}

function getTagRingColor(tags: string[]): string {
  if (tags.includes('Sore')) return '#f43f5e';  // Rose ring for Sore
  return '#090b10';                             // Clean dark ring for Fresh
}

export const ProgressionChart: React.FC<ProgressionChartProps> = ({
  exercises,
  logs,
  flashTrigger,
}) => {
  const [selectedExId, setSelectedExId] = useState<string>('muscle_up_transition_pulses');

  const blueprint =
    exercises.find((e) => e.id === selectedExId) || exercises[0];
  const primaryMetric = blueprint?.metrics[0] || { name: 'Value', unit: '' };
  const secondaryMetric = blueprint?.metrics[1] || null;

  const chartData = useMemo(() => {
    if (!blueprint) return [];
    return [...logs]
      .filter((l) => l.exercise_id === blueprint.id)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map((l) => {
        const d = new Date(l.timestamp);
        const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const primaryVal = l.metric_values?.[primaryMetric.name] ?? 0;
        const secondaryVal = secondaryMetric ? l.metric_values?.[secondaryMetric.name] : undefined;
        const modStyle = getModifierVisualStyle(l.modifier_value);
        const tags = blueprint?.category === 'recovery' ? [] : (l.session_tags || []);

        return {
          id: l.id,
          label: dateStr,
          primaryVal,
          secondaryVal,
          modifier_value: l.modifier_value,
          modColor: modStyle.color,
          modRadius: modStyle.radius,
          modLabel: modStyle.label,
          tags,
          tagRing: getTagRingColor(tags),
          raw_transcript: l.raw_transcript,
        };
      });
  }, [logs, blueprint, primaryMetric.name, secondaryMetric]);

  return (
    <div
      key={flashTrigger}
      className="vasco-card p-5 sm:p-6 shadow-2xl flex flex-col justify-between"
    >
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-400/60 flex items-center justify-center text-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.45)]">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                PROGRESSION CHART
              </h3>
              <p className="text-xs text-slate-300/80 mt-0.5">
                Track your strength progression, volume, and personal bests over time
              </p>
            </div>
          </div>
        </div>

        {/* Priority Exercise Blueprint Selector with balanced padding & layout */}
        <div className="p-3 sm:p-3.5 rounded-2xl bg-[#0d0724]/90 border border-purple-500/35 mb-4 space-y-2">
          {/* 8 Target Strength & Calisthenics Movements */}
          <div className="flex flex-wrap items-center gap-2">
            {exercises
              .filter((e) => e.category !== 'recovery')
              .map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => setSelectedExId(ex.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    blueprint?.id === ex.id
                      ? 'btn-tab-active shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-purple-900/30'
                  }`}
                >
                  {ex.name}
                </button>
              ))}
          </div>

          {/* Recovery Biometrics Row (Balanced & Separated) */}
          {exercises.some((e) => e.category === 'recovery') && (
            <div className="pt-2 border-t border-purple-500/25 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono text-purple-300/80 shrink-0">
                Recovery Biometrics:
              </span>
              {exercises
                .filter((e) => e.category === 'recovery')
                .map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => setSelectedExId(ex.id)}
                    className={`px-3.5 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      blueprint?.id === ex.id
                        ? 'btn-tab-active shadow-md'
                        : 'text-cyan-300/80 hover:text-cyan-200 hover:bg-cyan-950/40'
                    }`}
                  >
                    {ex.name}
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Chart Area */}
        <div className="h-[290px] w-full">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center border border-dashed border-purple-500/30 rounded-2xl text-xs text-slate-400">
              No logs recorded yet for {blueprint?.name}. Speak or log a set above!
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#23184a" />
                <XAxis dataKey="label" stroke="#818cf8" tick={{ fill: '#c7d2fe', fontSize: 11 }} />
                <YAxis
                  stroke="#818cf8"
                  tick={{ fill: '#c7d2fe', fontSize: 11 }}
                  unit={` ${primaryMetric.unit}`}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const pt = payload[0].payload;
                    return (
                      <div className="p-3 rounded-2xl vasco-card border border-purple-500/50 text-xs space-y-1.5 shadow-2xl max-w-xs">
                        <div className="flex items-center justify-between gap-3 border-b border-purple-500/30 pb-1">
                          <span className="font-bold text-white">
                            {blueprint?.name} ({pt.label})
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                              pt.tags.includes('Sore')
                                ? 'pill-rose'
                                : 'pill-emerald'
                            }`}
                          >
                            {pt.tags.join(', ')}
                          </span>
                        </div>
                        <div className="text-emerald-300">
                          {primaryMetric.name}:{' '}
                          <strong>
                            {pt.primaryVal} {primaryMetric.unit}
                          </strong>
                          {blueprint?.personal_best && (
                            <span className="text-purple-300 ml-1.5 font-mono text-[10px]">
                              ({Math.round((pt.primaryVal / blueprint.personal_best) * 100)}% of {blueprint.personal_best}{primaryMetric.unit} PR)
                            </span>
                          )}
                          {secondaryMetric && pt.secondaryVal !== undefined && (
                            <span className="ml-2 text-sky-300">
                              • {secondaryMetric.name}:{' '}
                              <strong>
                                {pt.secondaryVal} {secondaryMetric.unit}
                              </strong>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-amber-300">
                          <span
                            className="w-2.5 h-2.5 rounded-full inline-block"
                            style={{ backgroundColor: pt.modColor }}
                          />
                          <span>{pt.modLabel}</span>
                        </div>
                        {pt.raw_transcript && (
                          <div className="text-[11px] text-slate-300 italic pt-1 border-t border-purple-500/30">
                            "{pt.raw_transcript}"
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="primaryVal"
                  stroke="#a855f7"
                  strokeWidth={3.5}
                  dot={(props: any) => {
                    const { cx, cy, payload } = props;
                    if (cx === undefined || cy === undefined) return <g />;
                    const isSore = payload.tags?.includes('Sore');
                    return (
                      <g key={payload.id}>
                        {isSore && (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={(payload.modRadius || 6) + 3.5}
                            fill="none"
                            stroke="#f43f5e"
                            strokeWidth={2.5}
                            className="animate-pulse"
                          />
                        )}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={payload.modRadius || 6}
                          fill={payload.modColor || '#00f0ff'}
                          stroke="#0c0721"
                          strokeWidth={2}
                        />
                      </g>
                    );
                  }}
                  activeDot={{ r: 10, stroke: '#fff', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Modifier & Session Tag Legend */}
      <div className="flex flex-wrap items-center justify-between pt-3 border-t border-purple-500/30 text-xs text-slate-300 gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00f0ff] shadow-[0_0_8px_rgba(0,240,255,0.8)] inline-block" />
            Modifier: {blueprint?.modifier?.name || 'Form Quality'}
          </span>
          {blueprint?.personal_best && (
            <span className="pill-purple px-2.5 py-0.5 rounded-full text-[10px] font-mono">
              PR: {blueprint.personal_best} {primaryMetric.unit}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span className="text-rose-300 flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border-2 border-rose-400 inline-block shadow-[0_0_8px_rgba(244,63,94,0.7)]" />
            Sore Ring (Fatigued / Tight)
          </span>
        </div>
      </div>
    </div>
  );
};
