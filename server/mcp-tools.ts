import crypto from 'crypto';
import {
  ExerciseBlueprint,
  ExerciseLog,
  SessionTag,
} from './types.ts';
import {
  getAllData,
  insertExerciseLog,
  upsertExerciseBlueprint,
} from './store.ts';

export function resolveExerciseBlueprintId(rawNameOrId: string, blueprints: ExerciseBlueprint[]): string {
  const lower = rawNameOrId.toLowerCase().trim();

  // Direct ID match
  const exact = blueprints.find((b) => b.id === lower || b.name.toLowerCase() === lower);
  if (exact) return exact.id;

  if (lower.includes('muscle') || lower.includes('transition') || lower.includes('pulse')) {
    return 'muscle_up_transition_pulses';
  }
  if (lower.includes('fat') && (lower.includes('grip') || lower.includes('pull'))) {
    return 'fat_grip_pullups';
  }
  if (lower.includes('weighted') && (lower.includes('pull') || lower.includes('chin'))) {
    return 'weighted_pullups';
  }
  if (lower.includes('pullup') || lower.includes('pull_up') || lower.includes('pull-up') || lower.includes('pull up')) {
    return lower.includes('fat') ? 'fat_grip_pullups' : 'weighted_pullups';
  }
  if (lower.includes('dip')) {
    return 'dips';
  }
  if (lower.includes('sphinx')) {
    return 'sphinx_pushups';
  }
  if (lower.includes('pike') || lower.includes('hspu') || lower.includes('handstand')) {
    return 'pike_presses';
  }
  if (lower.includes('deadlift') || lower === 'dl') {
    return 'deadlift';
  }
  if (lower.includes('squat')) {
    return 'squat';
  }

  return lower.replace(/[\s-]+/g, '_');
}

export async function toolLogExercise(args: {
  exercise_id: string;
  metric_values: Record<string, number>;
  modifier_value?: string | number | null;
  session_tags?: SessionTag[];
  notes?: string;
  raw_transcript?: string;
  timestamp?: string;
}): Promise<ExerciseLog> {
  const db = await getAllData();
  const resolvedId = resolveExerciseBlueprintId(args.exercise_id, db.exercises);

  // Check if blueprint exists; if user logged a brand new exercise, auto-register a blueprint for it
  let blueprint = db.exercises.find((e) => e.id === resolvedId);
  if (!blueprint) {
    const metricDefs = Object.keys(args.metric_values).map((k) => ({
      name: k,
      type: k.toLowerCase().includes('time')
        ? ('duration' as const)
        : k.toLowerCase().includes('weight')
        ? ('load' as const)
        : ('count' as const),
      unit: k.toLowerCase().includes('time')
        ? 'seconds'
        : k.toLowerCase().includes('weight')
        ? 'kg'
        : 'reps',
    }));

    blueprint = await upsertExerciseBlueprint({
      id: resolvedId,
      name: resolvedId
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' '),
      category: 'calisthenics',
      is_active_focus: true,
      metrics: metricDefs.length > 0 ? metricDefs : [{ name: 'Reps', type: 'count', unit: 'reps' }],
      modifier: {
        name: 'Form Quality',
        type: 'scale',
        options: [1, 2, 3, 4, 5],
      },
    });
  }

  // Normalize metric keys to match blueprint metric names (e.g. 'time' -> 'Time', 'reps' -> 'Reps', 'weight' -> 'Weight')
  const normalizedMetrics: Record<string, number> = {};
  for (const [key, val] of Object.entries(args.metric_values || {})) {
    const numVal = Number(val);
    if (Number.isNaN(numVal)) continue;
    const matchedDef = blueprint.metrics.find(
      (m) => m.name.toLowerCase() === key.toLowerCase() || m.type.toLowerCase() === key.toLowerCase()
    );
    if (matchedDef) {
      normalizedMetrics[matchedDef.name] = numVal;
    } else {
      const capKey = key.charAt(0).toUpperCase() + key.slice(1);
      normalizedMetrics[capKey] = numVal;
    }
  }

  const logEntry: ExerciseLog = {
    id: `log-${crypto.randomUUID().slice(0, 8)}`,
    exercise_id: blueprint.id,
    timestamp: args.timestamp || new Date().toISOString(),
    metric_values: normalizedMetrics,
    modifier_value: args.modifier_value ?? null,
    session_tags: Array.isArray(args.session_tags) && args.session_tags.length > 0
      ? args.session_tags
      : ['Fresh'],
    notes: args.notes,
    raw_transcript: args.raw_transcript,
  };

  await insertExerciseLog(logEntry);
  return logEntry;
}

export async function toolUpsertBlueprint(args: ExerciseBlueprint): Promise<ExerciseBlueprint> {
  return upsertExerciseBlueprint(args);
}
