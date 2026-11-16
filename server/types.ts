export interface ExerciseMetricDefinition {
  name: string; // e.g. 'Time', 'Reps', 'Weight'
  type: 'duration' | 'count' | 'load';
  unit: string; // e.g. 'seconds', 'reps', 'kg'
}

export interface ExerciseModifierDefinition {
  name: string; // e.g. 'Band Assistance', 'Form Quality', 'Deficit / Range of Motion', 'Additional Weight'
  type: 'categorical' | 'scale';
  options: Array<string | number>; // e.g. ['None', 'Light', 'Medium', 'Heavy'] or [1, 2, 3, 4, 5]
}

export interface ExerciseBlueprint {
  id: string;
  name: string;
  category?: 'isometric' | 'calisthenics' | 'weighted_calisthenics' | 'barbell' | 'dumbbell' | 'recovery';
  is_active_focus: boolean;
  metrics: ExerciseMetricDefinition[];
  modifier?: ExerciseModifierDefinition | null;
  personal_best?: number; // Target / All-Time Personal Best for 100% normalization ceiling
  notes?: string;
}

export type SessionTag = 'Fresh' | 'Sore' | string;

export interface ExerciseLog {
  id: string;
  exercise_id: string;
  timestamp: string;
  metric_values: Record<string, number>; // e.g. { Time: 14 } or { Weight: 25, Reps: 5 }
  modifier_value?: string | number | null; // e.g. 'Light', 'Parallettes', '+10kg', 4
  session_tags: SessionTag[]; // e.g. ['Fresh'], ['Sore'], ['Heavy']
  notes?: string;
  raw_transcript?: string;
}

export interface ExecutedToolCall {
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
}

export interface VascoDatabase {
  exercises: ExerciseBlueprint[];
  logs: ExerciseLog[];
}

export const VASCO_MCP_TOOL_DEFINITIONS = [
  {
    name: 'log_exercise',
    description:
      'Logs an exercise instance into V.A.S.C.O. following the Blueprint & Instance Model. Supports single metrics and compound metrics, plus Modifier values and Session Tags.',
    inputSchema: {
      type: 'object',
      properties: {
        exercise_id: { type: 'string' },
        metric_values: { type: 'object' },
        modifier_value: { type: 'string' },
        session_tags: { type: 'array', items: { type: 'string' } },
        notes: { type: 'string' },
      },
      required: ['exercise_id', 'metric_values'],
    },
  },
  {
    name: 'upsert_exercise_blueprint',
    description: 'Creates or updates an Exercise Blueprint definition in V.A.S.C.O.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        is_active_focus: { type: 'boolean' },
        metrics: { type: 'array' },
        modifier: { type: 'object' },
      },
      required: ['id', 'name', 'metrics'],
    },
  },
];
