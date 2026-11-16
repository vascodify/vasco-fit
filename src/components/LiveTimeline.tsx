import React from 'react';
import { Dumbbell, Radio, CheckCircle2, Layers, Moon, Heart } from 'lucide-react';
import { ExerciseBlueprint, ExerciseLog } from '../../server/types';

interface LiveTimelineProps {
  exercises: ExerciseBlueprint[];
  logs: ExerciseLog[];
}

function getExerciseVisual(exerciseId: string) {
  const id = exerciseId.toLowerCase();

  // Sleep metrics: Total Sleep Duration, Deep Sleep, REM Sleep, Sleep Score
  if (
    id === 'total_sleep_duration' ||
    id === 'deep_sleep' ||
    id === 'rem_sleep' ||
    id === 'sleep_score' ||
    id.includes('sleep') ||
    id.includes('rem')
  ) {
    return {
      type: 'sleep' as const,
      Icon: Moon,
      iconColor: 'text-indigo-300',
      containerBg: 'bg-indigo-500/15 border-indigo-400/60 shadow-[0_0_12px_rgba(99,102,241,0.35)]',
    };
  }

  // Heart / Autonomic metrics: HRV, Resting Heart Rate, Readiness Score
  if (
    id === 'resting_heart_rate' ||
    id === 'hrv' ||
    id === 'readiness_score' ||
    id.includes('heart') ||
    id.includes('hrv') ||
    id.includes('rhr') ||
    id.includes('pulse_rate')
  ) {
    return {
      type: 'heart' as const,
      Icon: Heart,
      iconColor: 'text-rose-300',
      containerBg: 'bg-rose-500/15 border-rose-400/60 shadow-[0_0_12px_rgba(244,63,94,0.35)]',
    };
  }

  // Workouts & strength movements
  return {
    type: 'workout' as const,
    Icon: Dumbbell,
    iconColor: 'text-cyan-300',
    containerBg: 'bg-cyan-500/15 border-cyan-400/60 shadow-[0_0_12px_rgba(6,182,212,0.35)]',
  };
}

export const LiveTimeline: React.FC<LiveTimelineProps> = ({ exercises, logs }) => {
  const blueprintMap = new Map(exercises.map((e) => [e.id, e]));

  const sortedLogs = Array.from(
    new Map(
      [...logs]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .map((l) => [l.id, l])
    ).values()
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Left 7 Cols: Recent Workout Logs */}
      <div className="lg:col-span-7 vasco-card p-5 sm:p-6 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-pink-500/15 border border-pink-400/60 flex items-center justify-center text-pink-300 shadow-[0_0_16px_rgba(236,72,153,0.45)]">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                RECENT WORKOUT LOGS
              </h3>
              <p className="text-xs text-slate-300/80 mt-0.5">
                Live chronological history of your recorded sets
              </p>
            </div>
          </div>
          <span className="pill-purple px-3.5 py-1.5 rounded-full text-xs font-mono font-bold">
            {logs.length} Sets
          </span>
        </div>

        <div className="space-y-3 overflow-y-auto max-h-[380px] pr-1.5">
          {sortedLogs.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-purple-500/30 rounded-2xl text-xs text-slate-400">
              Clean slate active (0 sets). Speak or submit a set above to log your first workout!
            </div>
          ) : (
            sortedLogs.map((log) => {
              const bp = blueprintMap.get(log.exercise_id);
              const d = new Date(log.timestamp);
              const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

              const metricSummary = Object.entries(log.metric_values || {})
                .map(([k, v]) => {
                  const unit = bp?.metrics.find((m) => m.name === k)?.unit || '';
                  return `${k}: ${v} ${unit}`.trim();
                })
                .join(' • ');

              const visual = getExerciseVisual(log.exercise_id);
              const LogIcon = visual.Icon;

              return (
                <div
                  key={log.id}
                  className="p-4 rounded-2xl bg-[#0e0926]/90 border border-purple-500/50 shadow-[0_0_16px_rgba(168,85,247,0.2)] transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${visual.containerBg}`}>
                        <LogIcon className={`w-5 h-5 ${visual.iconColor}`} />
                      </div>
                      <div>
                        <div className="text-sm font-extrabold text-white flex items-center gap-2 flex-wrap">
                          <span>{bp?.name || log.exercise_id}</span>
                          {bp?.category === 'recovery' && (
                            <span className="pill-cyan px-2 py-0.5 rounded-full text-[9px] font-mono">
                              Biometric
                            </span>
                          )}
                          {log.modifier_value !== null && log.modifier_value !== undefined && (
                            <span className="pill-amber px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold">
                              {bp?.modifier?.name ? `${bp.modifier.name}: ` : ''}
                              {String(log.modifier_value)}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-cyan-300 font-mono font-bold mt-1">
                          {metricSummary}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {bp?.category !== 'recovery' && log.session_tags && log.session_tags.length > 0 && (
                        <div className="flex items-center justify-end gap-1.5">
                          {log.session_tags.map((tag, i) => (
                            <span
                              key={i}
                              className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold ${
                                tag === 'Sore' ? 'pill-rose' : 'pill-emerald'
                              }`}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="text-[11px] font-mono text-purple-300/80 mt-1">
                        {dateStr} • {timeStr}
                      </div>
                    </div>
                  </div>

                  {log.raw_transcript && (
                    <div className="mt-2 pt-2 border-t border-purple-500/30 text-[11px] text-slate-300/80 italic">
                      "{log.raw_transcript}"
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right 5 Cols: Your Target Exercises */}
      <div className="lg:col-span-5 vasco-card p-5 sm:p-6 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/15 border border-sky-400/60 flex items-center justify-center text-sky-300 shadow-[0_0_16px_rgba(56,189,248,0.45)]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                YOUR TARGET MOVEMENTS & BIOMETRICS ({exercises.length})
              </h3>
              <p className="text-xs text-slate-300/80 mt-0.5">
                The core calisthenics & recovery metrics you track
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2.5 overflow-y-auto max-h-[380px] pr-1.5">
          {exercises.map((ex, idx) => {
            const exVisual = getExerciseVisual(ex.id);
            const ExIcon = exVisual.Icon;

            return (
              <div
                key={ex.id}
                className="p-3.5 rounded-2xl bg-[#0e0926]/90 border border-purple-500/40 shadow-[0_0_14px_rgba(168,85,247,0.18)] flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${exVisual.containerBg}`}
                    title={exVisual.type === 'sleep' ? 'Sleep Biometric' : exVisual.type === 'heart' ? 'Autonomic/Cardio Biometric' : 'Movement Exercise'}
                  >
                    <ExIcon className={`w-3.5 h-3.5 ${exVisual.iconColor}`} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5 flex-wrap">
                      <span className="text-purple-300 font-mono">{idx + 1}.</span>
                      <span>{ex.name}</span>
                      {ex.category === 'recovery' && (
                        <span className="pill-cyan px-2 py-0.5 rounded-full text-[9px] font-mono">
                          Biometric
                        </span>
                      )}
                      {ex.is_active_focus && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                      )}
                    </div>
                    <div className="text-[11px] text-slate-300 mt-0.5">
                      Metrics:{' '}
                      <span className="text-emerald-300 font-mono font-medium">
                        {ex.metrics.map((m) => `${m.name} (${m.unit})`).join(' + ')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 flex flex-wrap items-center justify-end gap-1.5">
                  {ex.personal_best && (
                    <span className="pill-purple px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold">
                      PR: {ex.personal_best} {ex.metrics[0]?.unit}
                    </span>
                  )}
                  {ex.modifier && (
                    <span className="pill-amber px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold">
                      Mod: {ex.modifier.name}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
