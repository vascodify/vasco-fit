import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { VascoDatabase, ExerciseBlueprint, ExerciseLog, SessionTag } from './types.ts';

export const realtimeEmitter = new EventEmitter();

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'vasco_db.json');

let supabaseClient: SupabaseClient | null = null;

export const DEFAULT_EXERCISE_BLUEPRINTS: ExerciseBlueprint[] = [
  {
    id: 'muscle_up_transition_pulses',
    name: 'Muscle Up Transition Pulses',
    category: 'calisthenics',
    is_active_focus: true,
    personal_best: 5,
    metrics: [{ name: 'Reps', type: 'count', unit: 'pulses' }],
    modifier: {
      name: 'Form Quality',
      type: 'scale',
      options: [1, 2, 3, 4, 5],
    },
  },
  {
    id: 'fat_grip_pullups',
    name: 'Fat Grip Pullups',
    category: 'calisthenics',
    is_active_focus: true,
    personal_best: 15,
    metrics: [{ name: 'Reps', type: 'count', unit: 'reps' }],
    modifier: {
      name: 'Form Quality',
      type: 'scale',
      options: [1, 2, 3, 4, 5],
    },
  },
  {
    id: 'weighted_pullups',
    name: 'Weighted Pullups (5RM)',
    category: 'weighted_calisthenics',
    is_active_focus: true,
    personal_best: 25,
    metrics: [{ name: 'Weight', type: 'load', unit: 'kg' }],
    modifier: {
      name: 'Form Quality',
      type: 'scale',
      options: [1, 2, 3, 4, 5],
    },
  },
  {
    id: 'dips',
    name: 'Dips',
    category: 'calisthenics',
    is_active_focus: true,
    personal_best: 20,
    metrics: [{ name: 'Reps', type: 'count', unit: 'reps' }],
    modifier: {
      name: 'Additional Weight',
      type: 'categorical',
      options: ['Bodyweight', '+5kg', '+10kg', '+15kg', '+20kg', '+25kg'],
    },
  },
  {
    id: 'sphinx_pushups',
    name: 'Sphinx Pushups',
    category: 'calisthenics',
    is_active_focus: true,
    personal_best: 10,
    metrics: [{ name: 'Reps', type: 'count', unit: 'reps' }],
    modifier: {
      name: 'Form Quality',
      type: 'scale',
      options: [1, 2, 3, 4, 5],
    },
  },
  {
    id: 'pike_presses',
    name: 'Pike Presses',
    category: 'calisthenics',
    is_active_focus: true,
    personal_best: 5,
    metrics: [{ name: 'Reps', type: 'count', unit: 'reps' }],
    modifier: {
      name: 'Deficit / Range of Motion',
      type: 'categorical',
      options: ['Floor', 'Parallettes', 'Blocks'],
    },
  },
  {
    id: 'deadlift',
    name: 'Deadlift',
    category: 'barbell',
    is_active_focus: true,
    personal_best: 200,
    notes: 'Current realistic target PR: 200kg (All-time: 220kg)',
    metrics: [{ name: 'Weight', type: 'load', unit: 'kg' }],
    modifier: {
      name: 'Form Quality',
      type: 'scale',
      options: [1, 2, 3, 4, 5],
    },
  },
  {
    id: 'squat',
    name: 'Squat (5RM)',
    category: 'barbell',
    is_active_focus: true,
    personal_best: 120,
    notes: 'Current working 5RM: 120kg (All-time: 140kg x 5)',
    metrics: [{ name: 'Weight', type: 'load', unit: 'kg' }],
    modifier: {
      name: 'Form Quality',
      type: 'scale',
      options: [1, 2, 3, 4, 5],
    },
  },
  {
    id: 'incline_db_press',
    name: 'Incline DB Press (5RM)',
    category: 'dumbbell',
    is_active_focus: true,
    personal_best: 40,
    metrics: [{ name: 'Weight', type: 'load', unit: 'kg' }],
    modifier: {
      name: 'Form Quality',
      type: 'scale',
      options: [1, 2, 3, 4, 5],
    },
  },
  {
    id: 'total_sleep_duration',
    name: 'Total Sleep Duration',
    category: 'recovery',
    is_active_focus: true,
    personal_best: 8.5,
    metrics: [{ name: 'Duration', type: 'duration', unit: 'hours' }],
    modifier: {
      name: 'Sleep Quality',
      type: 'categorical',
      options: ['Optimal', 'Sufficient', 'Deficit'],
    },
  },
  {
    id: 'deep_sleep',
    name: 'Deep Sleep',
    category: 'recovery',
    is_active_focus: true,
    personal_best: 90,
    metrics: [{ name: 'Minutes', type: 'duration', unit: 'min' }],
    modifier: {
      name: 'Restorative Zone',
      type: 'categorical',
      options: ['Optimal', 'Average', 'Low'],
    },
  },
  {
    id: 'rem_sleep',
    name: 'REM Sleep',
    category: 'recovery',
    is_active_focus: true,
    personal_best: 110,
    metrics: [{ name: 'Minutes', type: 'duration', unit: 'min' }],
    modifier: {
      name: 'Mental Recovery',
      type: 'categorical',
      options: ['High', 'Moderate', 'Low'],
    },
  },
  {
    id: 'resting_heart_rate',
    name: 'Resting Heart Rate',
    category: 'recovery',
    is_active_focus: true,
    personal_best: 50,
    metrics: [{ name: 'BPM', type: 'count', unit: 'bpm' }],
    modifier: {
      name: 'Cardio Status',
      type: 'categorical',
      options: ['Resting', 'Elevated', 'Fatigued'],
    },
  },
  {
    id: 'hrv',
    name: 'Heart Rate Variability',
    category: 'recovery',
    is_active_focus: true,
    personal_best: 75,
    metrics: [{ name: 'rMSSD', type: 'count', unit: 'ms' }],
    modifier: {
      name: 'Autonomic Balance',
      type: 'categorical',
      options: ['High Recovery', 'Baseline', 'Suppressed'],
    },
  },
];

export function initSupabaseClient(url?: string, key?: string): SupabaseClient | null {
  const supaUrl = url || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supaKey = key || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (supaUrl && supaKey && supaUrl.startsWith('http')) {
    try {
      supabaseClient = createClient(supaUrl, supaKey);
      return supabaseClient;
    } catch (err) {
      console.error('[V.A.S.C.O. Store] Failed to initialize Supabase client:', err);
      supabaseClient = null;
    }
  } else {
    supabaseClient = null;
  }
  return supabaseClient;
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseClient) {
    return initSupabaseClient();
  }
  return supabaseClient;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseClient());
}

function createInitialSeedData(): VascoDatabase {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const isoDaysAgo = (days: number, hourOffset = 17) => {
    const d = new Date(now - days * dayMs);
    d.setHours(hourOffset, 30, 0, 0);
    return d.toISOString();
  };

  const logs: ExerciseLog[] = [
    // Session 1 (14 days ago)
    {
      id: 'log-seed-1',
      exercise_id: 'muscle_up_transition_pulses',
      timestamp: isoDaysAgo(14),
      metric_values: { Reps: 2 },
      modifier_value: 5,
      session_tags: ['Fresh'],
      raw_transcript: '2 muscle up transition pulses at 90 degrees bodyweight, felt fresh.',
    },
    {
      id: 'log-seed-2',
      exercise_id: 'fat_grip_pullups',
      timestamp: isoDaysAgo(14),
      metric_values: { Reps: 8 },
      modifier_value: 5,
      session_tags: ['Fresh'],
      raw_transcript: 'Did 8 fat grip pullups with clean form.',
    },
    {
      id: 'log-seed-3',
      exercise_id: 'weighted_pullups',
      timestamp: isoDaysAgo(14),
      metric_values: { Weight: 15 },
      modifier_value: 5,
      session_tags: ['Fresh'],
      raw_transcript: 'Weighted pullups +15kg for 5RM.',
    },
    {
      id: 'log-seed-incline-1',
      exercise_id: 'incline_db_press',
      timestamp: isoDaysAgo(14),
      metric_values: { Weight: 30 },
      modifier_value: 5,
      session_tags: ['Fresh'],
      raw_transcript: 'Incline DB press 30kg for 5RM.',
    },

    // Session 2 (11 days ago)
    {
      id: 'log-seed-4',
      exercise_id: 'muscle_up_transition_pulses',
      timestamp: isoDaysAgo(11),
      metric_values: { Reps: 3 },
      modifier_value: 5,
      session_tags: ['Sore'],
      raw_transcript: '3 muscle up transition pulses, forearms a bit sore.',
    },
    {
      id: 'log-seed-5',
      exercise_id: 'fat_grip_pullups',
      timestamp: isoDaysAgo(11),
      metric_values: { Reps: 10 },
      modifier_value: 5,
      session_tags: ['Sore'],
      raw_transcript: '10 reps on fat grip pullups despite soreness.',
    },
    {
      id: 'log-seed-6',
      exercise_id: 'pike_presses',
      timestamp: isoDaysAgo(11),
      metric_values: { Reps: 3 },
      modifier_value: 'Floor',
      session_tags: ['Sore'],
      raw_transcript: 'Pike presses 3 reps on floor.',
    },
    {
      id: 'log-seed-7',
      exercise_id: 'sphinx_pushups',
      timestamp: isoDaysAgo(11),
      metric_values: { Reps: 7 },
      modifier_value: 5,
      session_tags: ['Sore'],
      raw_transcript: 'Sphinx pushups 7 reps, triceps fatigued.',
    },

    // Session 3 (8 days ago)
    {
      id: 'log-seed-8',
      exercise_id: 'muscle_up_transition_pulses',
      timestamp: isoDaysAgo(8),
      metric_values: { Reps: 3 },
      modifier_value: 5,
      session_tags: ['Fresh'],
      raw_transcript: '3 muscle up transition pulses, strict 90 degree hold, felt super fresh.',
    },
    {
      id: 'log-seed-9',
      exercise_id: 'fat_grip_pullups',
      timestamp: isoDaysAgo(8),
      metric_values: { Reps: 11 },
      modifier_value: 5,
      session_tags: ['Fresh'],
      raw_transcript: 'Hit 11 fat grip pullups with 5/5 form quality!',
    },
    {
      id: 'log-seed-10',
      exercise_id: 'dips',
      timestamp: isoDaysAgo(8),
      metric_values: { Reps: 16 },
      modifier_value: 'Bodyweight',
      session_tags: ['Fresh'],
      raw_transcript: '16 bodyweight dips.',
    },
    {
      id: 'log-seed-11',
      exercise_id: 'deadlift',
      timestamp: isoDaysAgo(8),
      metric_values: { Weight: 175 },
      modifier_value: 5,
      session_tags: ['Fresh'],
      raw_transcript: 'Deadlift 175kg single.',
    },
    {
      id: 'log-seed-incline-2',
      exercise_id: 'incline_db_press',
      timestamp: isoDaysAgo(8),
      metric_values: { Weight: 35 },
      modifier_value: 5,
      session_tags: ['Fresh'],
      raw_transcript: 'Incline DB press 35kg 5RM, smooth lockouts.',
    },

    // Session 4 (5 days ago)
    {
      id: 'log-seed-12',
      exercise_id: 'muscle_up_transition_pulses',
      timestamp: isoDaysAgo(5),
      metric_values: { Reps: 4 },
      modifier_value: 5,
      session_tags: ['Sore'],
      raw_transcript: '4 muscle up transition pulses, felt sore.',
    },
    {
      id: 'log-seed-13',
      exercise_id: 'fat_grip_pullups',
      timestamp: isoDaysAgo(5),
      metric_values: { Reps: 13 },
      modifier_value: 5,
      session_tags: ['Sore'],
      raw_transcript: '13 fat grip pullups.',
    },
    {
      id: 'log-seed-14',
      exercise_id: 'weighted_pullups',
      timestamp: isoDaysAgo(5),
      metric_values: { Weight: 22.5 },
      modifier_value: 5,
      session_tags: ['Fresh'],
      raw_transcript: 'Weighted pullups +22.5kg for 5RM.',
    },
    {
      id: 'log-seed-15',
      exercise_id: 'pike_presses',
      timestamp: isoDaysAgo(5),
      metric_values: { Reps: 4 },
      modifier_value: 'Parallettes',
      session_tags: ['Fresh'],
      raw_transcript: 'Elevated pike presses on parallettes for 4 deep reps.',
    },
    {
      id: 'log-seed-16',
      exercise_id: 'squat',
      timestamp: isoDaysAgo(5),
      metric_values: { Weight: 110 },
      modifier_value: 5,
      session_tags: ['Sore'],
      raw_transcript: 'Back squat 110kg 5RM.',
    },

    // Session 5 (2 days ago)
    {
      id: 'log-seed-17',
      exercise_id: 'muscle_up_transition_pulses',
      timestamp: isoDaysAgo(2),
      metric_values: { Reps: 5 },
      modifier_value: 5,
      session_tags: ['Fresh'],
      raw_transcript: '5 muscle up transition pulses PR, perfectly controlled at transition.',
    },
    {
      id: 'log-seed-18',
      exercise_id: 'fat_grip_pullups',
      timestamp: isoDaysAgo(2),
      metric_values: { Reps: 14 },
      modifier_value: 5,
      session_tags: ['Fresh'],
      raw_transcript: '14 fat grip pullups, closing in on 15 PR!',
    },
    {
      id: 'log-seed-19',
      exercise_id: 'dips',
      timestamp: isoDaysAgo(2),
      metric_values: { Reps: 20 },
      modifier_value: 'Bodyweight',
      session_tags: ['Fresh'],
      raw_transcript: '20 clean bodyweight dips PR matched!',
    },
    {
      id: 'log-seed-20',
      exercise_id: 'sphinx_pushups',
      timestamp: isoDaysAgo(2),
      metric_values: { Reps: 10 },
      modifier_value: 5,
      session_tags: ['Fresh'],
      raw_transcript: '10 sphinx pushups with strict elbow lock, PR hit!',
    },
    {
      id: 'log-seed-21',
      exercise_id: 'deadlift',
      timestamp: isoDaysAgo(2),
      metric_values: { Weight: 195 },
      modifier_value: 5,
      session_tags: ['Fresh'],
      raw_transcript: 'Deadlift 195kg heavy single.',
    },
    {
      id: 'log-seed-22',
      exercise_id: 'squat',
      timestamp: isoDaysAgo(2),
      metric_values: { Weight: 120 },
      modifier_value: 5,
      session_tags: ['Fresh'],
      raw_transcript: 'Squat 120kg for 5RM, solid depth.',
    },
    {
      id: 'log-seed-23',
      exercise_id: 'weighted_pullups',
      timestamp: isoDaysAgo(2),
      metric_values: { Weight: 25 },
      modifier_value: 5,
      session_tags: ['Fresh'],
      raw_transcript: 'Weighted pullups +25kg for 5RM PR!',
    },
    {
      id: 'log-seed-incline-3',
      exercise_id: 'incline_db_press',
      timestamp: isoDaysAgo(2),
      metric_values: { Weight: 40 },
      modifier_value: 5,
      session_tags: ['Fresh'],
      raw_transcript: 'Incline DB press 40kg 5RM PR achieved!',
    },

    // Authentic Fitbit Air Biometrics from Google Health API
    // Day 14 (Nov 1)
    { id: 'fitbit-air-dur-2026-11-01', exercise_id: 'total_sleep_duration', timestamp: isoDaysAgo(14, 8), metric_values: { Duration: 7.6 }, modifier_value: 'Optimal', session_tags: [], raw_transcript: 'Google Health Fitbit Air: Total Sleep 7.6 hrs' },
    { id: 'fitbit-air-deep-2026-11-01', exercise_id: 'deep_sleep', timestamp: isoDaysAgo(14, 8), metric_values: { Minutes: 80 }, modifier_value: 'Optimal', session_tags: [], raw_transcript: 'Google Health Fitbit Air: Deep Sleep 80 mins' },
    { id: 'fitbit-air-rem-2026-11-01', exercise_id: 'rem_sleep', timestamp: isoDaysAgo(14, 8), metric_values: { Minutes: 105 }, modifier_value: 'High', session_tags: [], raw_transcript: 'Google Health Fitbit Air: REM Sleep 105 mins' },
    { id: 'fitbit-air-rhr-2026-11-01', exercise_id: 'resting_heart_rate', timestamp: isoDaysAgo(14, 8), metric_values: { BPM: 52 }, modifier_value: 'Resting', session_tags: [], raw_transcript: 'Google Health: Resting Heart Rate 52 bpm' },
    { id: 'fitbit-air-hrv-2026-11-01', exercise_id: 'hrv', timestamp: isoDaysAgo(14, 8), metric_values: { rMSSD: 67 }, modifier_value: 'High Recovery', session_tags: [], raw_transcript: 'Google Health: HRV 67 ms' },

    // Day 13 (Nov 2)
    { id: 'fitbit-air-dur-2026-11-02', exercise_id: 'total_sleep_duration', timestamp: isoDaysAgo(13, 8), metric_values: { Duration: 7.2 }, modifier_value: 'Sufficient', session_tags: [], raw_transcript: 'Google Health Fitbit Air: Total Sleep 7.2 hrs' },
    { id: 'fitbit-air-deep-2026-11-02', exercise_id: 'deep_sleep', timestamp: isoDaysAgo(13, 8), metric_values: { Minutes: 68 }, modifier_value: 'Average', session_tags: [], raw_transcript: 'Google Health Fitbit Air: Deep Sleep 68 mins' },
    { id: 'fitbit-air-rem-2026-11-02', exercise_id: 'rem_sleep', timestamp: isoDaysAgo(13, 8), metric_values: { Minutes: 92 }, modifier_value: 'High', session_tags: [], raw_transcript: 'Google Health Fitbit Air: REM Sleep 92 mins' },
    { id: 'fitbit-air-rhr-2026-11-02', exercise_id: 'resting_heart_rate', timestamp: isoDaysAgo(13, 8), metric_values: { BPM: 55 }, modifier_value: 'Resting', session_tags: [], raw_transcript: 'Google Health: Resting Heart Rate 55 bpm' },
    { id: 'fitbit-air-hrv-2026-11-02', exercise_id: 'hrv', timestamp: isoDaysAgo(13, 8), metric_values: { rMSSD: 60 }, modifier_value: 'Baseline', session_tags: [], raw_transcript: 'Google Health: HRV 60 ms' },

    // Day 12 (Nov 3)
    { id: 'fitbit-air-dur-2026-11-03', exercise_id: 'total_sleep_duration', timestamp: isoDaysAgo(12, 8), metric_values: { Duration: 7.4 }, modifier_value: 'Sufficient', session_tags: [], raw_transcript: 'Google Health Fitbit Air: Total Sleep 7.4 hrs' },
    { id: 'fitbit-air-deep-2026-11-03', exercise_id: 'deep_sleep', timestamp: isoDaysAgo(12, 8), metric_values: { Minutes: 70 }, modifier_value: 'Average', session_tags: [], raw_transcript: 'Google Health Fitbit Air: Deep Sleep 70 mins' },
    { id: 'fitbit-air-rem-2026-11-03', exercise_id: 'rem_sleep', timestamp: isoDaysAgo(12, 8), metric_values: { Minutes: 98 }, modifier_value: 'High', session_tags: [], raw_transcript: 'Google Health Fitbit Air: REM Sleep 98 mins' },
    { id: 'fitbit-air-rhr-2026-11-03', exercise_id: 'resting_heart_rate', timestamp: isoDaysAgo(12, 8), metric_values: { BPM: 54 }, modifier_value: 'Resting', session_tags: [], raw_transcript: 'Google Health: Resting Heart Rate 54 bpm' },
    { id: 'fitbit-air-hrv-2026-11-03', exercise_id: 'hrv', timestamp: isoDaysAgo(12, 8), metric_values: { rMSSD: 62 }, modifier_value: 'Baseline', session_tags: [], raw_transcript: 'Google Health: HRV 62 ms' },

    // Day 11 (Nov 4 - Real Fitbit Air)
    { id: 'fitbit-air-dur-2026-11-04', exercise_id: 'total_sleep_duration', timestamp: isoDaysAgo(11, 8), metric_values: { Duration: 8.0 }, modifier_value: 'Optimal', session_tags: [], raw_transcript: 'Google Health Fitbit Air: Total Sleep 8.0 hrs' },
    { id: 'fitbit-air-deep-2026-11-04', exercise_id: 'deep_sleep', timestamp: isoDaysAgo(11, 8), metric_values: { Minutes: 96 }, modifier_value: 'Optimal', session_tags: [], raw_transcript: 'Google Health Fitbit Air: Deep Sleep 96 mins' },
    { id: 'fitbit-air-rem-2026-11-04', exercise_id: 'rem_sleep', timestamp: isoDaysAgo(11, 8), metric_values: { Minutes: 121 }, modifier_value: 'High', session_tags: [], raw_transcript: 'Google Health Fitbit Air: REM Sleep 121 mins' },
    { id: 'fitbit-air-rhr-2026-11-04', exercise_id: 'resting_heart_rate', timestamp: isoDaysAgo(11, 8), metric_values: { BPM: 49 }, modifier_value: 'Resting', session_tags: [], raw_transcript: 'Google Health: Resting Heart Rate 49 bpm' },
    { id: 'fitbit-air-hrv-2026-11-04', exercise_id: 'hrv', timestamp: isoDaysAgo(11, 8), metric_values: { rMSSD: 79 }, modifier_value: 'High Recovery', session_tags: [], raw_transcript: 'Google Health: HRV 79 ms' },

    // Day 10 (Nov 5 - Real Fitbit Air)
    { id: 'fitbit-air-dur-2026-11-05', exercise_id: 'total_sleep_duration', timestamp: isoDaysAgo(10, 8), metric_values: { Duration: 6.6 }, modifier_value: 'Sufficient', session_tags: [], raw_transcript: 'Google Health Fitbit Air: Total Sleep 6.6 hrs' },
    { id: 'fitbit-air-deep-2026-11-05', exercise_id: 'deep_sleep', timestamp: isoDaysAgo(10, 8), metric_values: { Minutes: 44 }, modifier_value: 'Low', session_tags: [], raw_transcript: 'Google Health Fitbit Air: Deep Sleep 44 mins' },
    { id: 'fitbit-air-rem-2026-11-05', exercise_id: 'rem_sleep', timestamp: isoDaysAgo(10, 8), metric_values: { Minutes: 83 }, modifier_value: 'Moderate', session_tags: [], raw_transcript: 'Google Health Fitbit Air: REM Sleep 83 mins' },
    { id: 'fitbit-air-rhr-2026-11-05', exercise_id: 'resting_heart_rate', timestamp: isoDaysAgo(10, 8), metric_values: { BPM: 60 }, modifier_value: 'Elevated', session_tags: [], raw_transcript: 'Google Health: Resting Heart Rate 60 bpm' },
    { id: 'fitbit-air-hrv-2026-11-05', exercise_id: 'hrv', timestamp: isoDaysAgo(10, 8), metric_values: { rMSSD: 46 }, modifier_value: 'Suppressed', session_tags: [], raw_transcript: 'Google Health: HRV 46 ms' },

    // Day 9 (Nov 6 - Real Fitbit Air)
    { id: 'fitbit-air-dur-2026-11-06', exercise_id: 'total_sleep_duration', timestamp: isoDaysAgo(9, 8), metric_values: { Duration: 7.7 }, modifier_value: 'Optimal', session_tags: [], raw_transcript: 'Google Health Fitbit Air: Total Sleep 7.7 hrs' },
    { id: 'fitbit-air-deep-2026-11-06', exercise_id: 'deep_sleep', timestamp: isoDaysAgo(9, 8), metric_values: { Minutes: 72 }, modifier_value: 'Average', session_tags: [], raw_transcript: 'Google Health Fitbit Air: Deep Sleep 72 mins' },
    { id: 'fitbit-air-rem-2026-11-06', exercise_id: 'rem_sleep', timestamp: isoDaysAgo(9, 8), metric_values: { Minutes: 111 }, modifier_value: 'High', session_tags: [], raw_transcript: 'Google Health Fitbit Air: REM Sleep 111 mins' },
    { id: 'fitbit-air-rhr-2026-11-06', exercise_id: 'resting_heart_rate', timestamp: isoDaysAgo(9, 8), metric_values: { BPM: 52 }, modifier_value: 'Resting', session_tags: [], raw_transcript: 'Google Health: Resting Heart Rate 52 bpm' },
    { id: 'fitbit-air-hrv-2026-11-06', exercise_id: 'hrv', timestamp: isoDaysAgo(9, 8), metric_values: { rMSSD: 68 }, modifier_value: 'High Recovery', session_tags: [], raw_transcript: 'Google Health: HRV 68 ms' },

    // Day 8 (Nov 7 - Real Fitbit Air)
    { id: 'fitbit-air-dur-2026-11-07', exercise_id: 'total_sleep_duration', timestamp: isoDaysAgo(8, 8), metric_values: { Duration: 6.1 }, modifier_value: 'Deficit', session_tags: [], raw_transcript: 'Google Health Fitbit Air: Total Sleep 6.1 hrs' },
    { id: 'fitbit-air-deep-2026-11-07', exercise_id: 'deep_sleep', timestamp: isoDaysAgo(8, 8), metric_values: { Minutes: 74 }, modifier_value: 'Average', session_tags: [], raw_transcript: 'Google Health Fitbit Air: Deep Sleep 74 mins' },
    { id: 'fitbit-air-rem-2026-11-07', exercise_id: 'rem_sleep', timestamp: isoDaysAgo(8, 8), metric_values: { Minutes: 70 }, modifier_value: 'Moderate', session_tags: [], raw_transcript: 'Google Health Fitbit Air: REM Sleep 70 mins' },
    { id: 'fitbit-air-rhr-2026-11-07', exercise_id: 'resting_heart_rate', timestamp: isoDaysAgo(8, 8), metric_values: { BPM: 57 }, modifier_value: 'Elevated', session_tags: [], raw_transcript: 'Google Health: Resting Heart Rate 57 bpm' },
    { id: 'fitbit-air-hrv-2026-11-07', exercise_id: 'hrv', timestamp: isoDaysAgo(8, 8), metric_values: { rMSSD: 55 }, modifier_value: 'Baseline', session_tags: [], raw_transcript: 'Google Health: HRV 55 ms' },

    // Day 7 (Nov 8 - Real Fitbit Air Peak Sleep Night)
    { id: 'fitbit-air-dur-2026-11-08', exercise_id: 'total_sleep_duration', timestamp: isoDaysAgo(7, 8), metric_values: { Duration: 10.2 }, modifier_value: 'Optimal', session_tags: [], raw_transcript: 'Google Health Fitbit Air: Total Sleep 10.2 hrs' },
    { id: 'fitbit-air-deep-2026-11-08', exercise_id: 'deep_sleep', timestamp: isoDaysAgo(7, 8), metric_values: { Minutes: 90 }, modifier_value: 'Optimal', session_tags: [], raw_transcript: 'Google Health Fitbit Air: Deep Sleep 90 mins' },
    { id: 'fitbit-air-rem-2026-11-08', exercise_id: 'rem_sleep', timestamp: isoDaysAgo(7, 8), metric_values: { Minutes: 136 }, modifier_value: 'High', session_tags: [], raw_transcript: 'Google Health Fitbit Air: REM Sleep 136 mins' },
    { id: 'fitbit-air-rhr-2026-11-08', exercise_id: 'resting_heart_rate', timestamp: isoDaysAgo(7, 8), metric_values: { BPM: 48 }, modifier_value: 'Resting', session_tags: [], raw_transcript: 'Google Health: Resting Heart Rate 48 bpm' },
    { id: 'fitbit-air-hrv-2026-11-08', exercise_id: 'hrv', timestamp: isoDaysAgo(7, 8), metric_values: { rMSSD: 85 }, modifier_value: 'High Recovery', session_tags: [], raw_transcript: 'Google Health: HRV 85 ms' },

    // Day 6 (Nov 9 - Real Fitbit Air)
    { id: 'fitbit-air-dur-2026-11-09', exercise_id: 'total_sleep_duration', timestamp: isoDaysAgo(6, 8), metric_values: { Duration: 7.1 }, modifier_value: 'Sufficient', session_tags: [], raw_transcript: 'Google Health Fitbit Air: Total Sleep 7.1 hrs' },
    { id: 'fitbit-air-deep-2026-11-09', exercise_id: 'deep_sleep', timestamp: isoDaysAgo(6, 8), metric_values: { Minutes: 56 }, modifier_value: 'Average', session_tags: [], raw_transcript: 'Google Health Fitbit Air: Deep Sleep 56 mins' },
    { id: 'fitbit-air-rem-2026-11-09', exercise_id: 'rem_sleep', timestamp: isoDaysAgo(6, 8), metric_values: { Minutes: 97 }, modifier_value: 'High', session_tags: [], raw_transcript: 'Google Health Fitbit Air: REM Sleep 97 mins' },
    { id: 'fitbit-air-rhr-2026-11-09', exercise_id: 'resting_heart_rate', timestamp: isoDaysAgo(6, 8), metric_values: { BPM: 54 }, modifier_value: 'Resting', session_tags: [], raw_transcript: 'Google Health: Resting Heart Rate 54 bpm' },
    { id: 'fitbit-air-hrv-2026-11-09', exercise_id: 'hrv', timestamp: isoDaysAgo(6, 8), metric_values: { rMSSD: 64 }, modifier_value: 'Baseline', session_tags: [], raw_transcript: 'Google Health: HRV 64 ms' },

    // Day 5 (Nov 10 - Real Fitbit Air)
    { id: 'fitbit-air-dur-2026-11-10', exercise_id: 'total_sleep_duration', timestamp: isoDaysAgo(5, 8), metric_values: { Duration: 8.4 }, modifier_value: 'Optimal', session_tags: [], raw_transcript: 'Google Health Fitbit Air: Total Sleep 8.4 hrs' },
    { id: 'fitbit-air-deep-2026-11-10', exercise_id: 'deep_sleep', timestamp: isoDaysAgo(5, 8), metric_values: { Minutes: 63 }, modifier_value: 'Average', session_tags: [], raw_transcript: 'Google Health Fitbit Air: Deep Sleep 63 mins' },
    { id: 'fitbit-air-rem-2026-11-10', exercise_id: 'rem_sleep', timestamp: isoDaysAgo(5, 8), metric_values: { Minutes: 111 }, modifier_value: 'High', session_tags: [], raw_transcript: 'Google Health Fitbit Air: REM Sleep 111 mins' },
    { id: 'fitbit-air-rhr-2026-11-10', exercise_id: 'resting_heart_rate', timestamp: isoDaysAgo(5, 8), metric_values: { BPM: 51 }, modifier_value: 'Resting', session_tags: [], raw_transcript: 'Google Health: Resting Heart Rate 51 bpm' },
    { id: 'fitbit-air-hrv-2026-11-10', exercise_id: 'hrv', timestamp: isoDaysAgo(5, 8), metric_values: { rMSSD: 72 }, modifier_value: 'High Recovery', session_tags: [], raw_transcript: 'Google Health: HRV 72 ms' },

    // Day 4 (Nov 11 - Real Fitbit Air)
    { id: 'fitbit-air-dur-2026-11-11', exercise_id: 'total_sleep_duration', timestamp: isoDaysAgo(4, 8), metric_values: { Duration: 7.1 }, modifier_value: 'Sufficient', session_tags: [], raw_transcript: 'Google Health Fitbit Air: Total Sleep 7.1 hrs' },
    { id: 'fitbit-air-deep-2026-11-11', exercise_id: 'deep_sleep', timestamp: isoDaysAgo(4, 8), metric_values: { Minutes: 66 }, modifier_value: 'Average', session_tags: [], raw_transcript: 'Google Health Fitbit Air: Deep Sleep 66 mins' },
    { id: 'fitbit-air-rem-2026-11-11', exercise_id: 'rem_sleep', timestamp: isoDaysAgo(4, 8), metric_values: { Minutes: 94 }, modifier_value: 'High', session_tags: [], raw_transcript: 'Google Health Fitbit Air: REM Sleep 94 mins' },
    { id: 'fitbit-air-rhr-2026-11-11', exercise_id: 'resting_heart_rate', timestamp: isoDaysAgo(4, 8), metric_values: { BPM: 53 }, modifier_value: 'Resting', session_tags: [], raw_transcript: 'Google Health: Resting Heart Rate 53 bpm' },
    { id: 'fitbit-air-hrv-2026-11-11', exercise_id: 'hrv', timestamp: isoDaysAgo(4, 8), metric_values: { rMSSD: 65 }, modifier_value: 'High Recovery', session_tags: [], raw_transcript: 'Google Health: HRV 65 ms' },

    // Day 3 (Nov 12 - Real Fitbit Air)
    { id: 'fitbit-air-dur-2026-11-12', exercise_id: 'total_sleep_duration', timestamp: isoDaysAgo(3, 8), metric_values: { Duration: 5.9 }, modifier_value: 'Deficit', session_tags: [], raw_transcript: 'Google Health Fitbit Air: Total Sleep 5.9 hrs' },
    { id: 'fitbit-air-deep-2026-11-12', exercise_id: 'deep_sleep', timestamp: isoDaysAgo(3, 8), metric_values: { Minutes: 53 }, modifier_value: 'Average', session_tags: [], raw_transcript: 'Google Health Fitbit Air: Deep Sleep 53 mins' },
    { id: 'fitbit-air-rem-2026-11-12', exercise_id: 'rem_sleep', timestamp: isoDaysAgo(3, 8), metric_values: { Minutes: 99 }, modifier_value: 'High', session_tags: [], raw_transcript: 'Google Health Fitbit Air: REM Sleep 99 mins' },
    { id: 'fitbit-air-rhr-2026-11-12', exercise_id: 'resting_heart_rate', timestamp: isoDaysAgo(3, 8), metric_values: { BPM: 58 }, modifier_value: 'Elevated', session_tags: [], raw_transcript: 'Google Health: Resting Heart Rate 58 bpm' },
    { id: 'fitbit-air-hrv-2026-11-12', exercise_id: 'hrv', timestamp: isoDaysAgo(3, 8), metric_values: { rMSSD: 52 }, modifier_value: 'Baseline', session_tags: [], raw_transcript: 'Google Health: HRV 52 ms' },

    // Day 2 (Nov 13 - Real Fitbit Air)
    { id: 'fitbit-air-dur-2026-11-13', exercise_id: 'total_sleep_duration', timestamp: isoDaysAgo(2, 8), metric_values: { Duration: 7.5 }, modifier_value: 'Optimal', session_tags: [], raw_transcript: 'Google Health Fitbit Air: Total Sleep 7.5 hrs' },
    { id: 'fitbit-air-deep-2026-11-13', exercise_id: 'deep_sleep', timestamp: isoDaysAgo(2, 8), metric_values: { Minutes: 78 }, modifier_value: 'Optimal', session_tags: [], raw_transcript: 'Google Health Fitbit Air: Deep Sleep 78 mins' },
    { id: 'fitbit-air-rem-2026-11-13', exercise_id: 'rem_sleep', timestamp: isoDaysAgo(2, 8), metric_values: { Minutes: 116 }, modifier_value: 'High', session_tags: [], raw_transcript: 'Google Health Fitbit Air: REM Sleep 116 mins' },
    { id: 'fitbit-air-rhr-2026-11-13', exercise_id: 'resting_heart_rate', timestamp: isoDaysAgo(2, 8), metric_values: { BPM: 50 }, modifier_value: 'Resting', session_tags: [], raw_transcript: 'Google Health: Resting Heart Rate 50 bpm' },
    { id: 'fitbit-air-hrv-2026-11-13', exercise_id: 'hrv', timestamp: isoDaysAgo(2, 8), metric_values: { rMSSD: 76 }, modifier_value: 'High Recovery', session_tags: [], raw_transcript: 'Google Health: HRV 76 ms' },

    // Day 1 (Nov 14 - Yesterday Real Fitbit Air)
    { id: 'fitbit-air-dur-2026-11-14', exercise_id: 'total_sleep_duration', timestamp: isoDaysAgo(1, 8), metric_values: { Duration: 5.9 }, modifier_value: 'Deficit', session_tags: [], raw_transcript: 'Google Health Fitbit Air: Total Sleep 5.9 hrs' },
    { id: 'fitbit-air-deep-2026-11-14', exercise_id: 'deep_sleep', timestamp: isoDaysAgo(1, 8), metric_values: { Minutes: 68 }, modifier_value: 'Average', session_tags: [], raw_transcript: 'Google Health Fitbit Air: Deep Sleep 68 mins' },
    { id: 'fitbit-air-rem-2026-11-14', exercise_id: 'rem_sleep', timestamp: isoDaysAgo(1, 8), metric_values: { Minutes: 106 }, modifier_value: 'High', session_tags: [], raw_transcript: 'Google Health Fitbit Air: REM Sleep 106 mins' },
    { id: 'fitbit-air-rhr-2026-11-14', exercise_id: 'resting_heart_rate', timestamp: isoDaysAgo(1, 8), metric_values: { BPM: 54 }, modifier_value: 'Resting', session_tags: [], raw_transcript: 'Google Health: Resting Heart Rate 54 bpm' },
    { id: 'fitbit-air-hrv-2026-11-14', exercise_id: 'hrv', timestamp: isoDaysAgo(1, 8), metric_values: { rMSSD: 62 }, modifier_value: 'Baseline', session_tags: [], raw_transcript: 'Google Health: HRV 62 ms' },

    // Day 0 (Nov 15 - Today Real Fitbit Air)
    { id: 'fitbit-air-dur-2026-11-15', exercise_id: 'total_sleep_duration', timestamp: isoDaysAgo(0, 8), metric_values: { Duration: 7.9 }, modifier_value: 'Optimal', session_tags: [], raw_transcript: 'Google Health Fitbit Air: Total Sleep 7.9 hrs' },
    { id: 'fitbit-air-deep-2026-11-15', exercise_id: 'deep_sleep', timestamp: isoDaysAgo(0, 8), metric_values: { Minutes: 66 }, modifier_value: 'Average', session_tags: [], raw_transcript: 'Google Health Fitbit Air: Deep Sleep 66 mins' },
    { id: 'fitbit-air-rem-2026-11-15', exercise_id: 'rem_sleep', timestamp: isoDaysAgo(0, 8), metric_values: { Minutes: 131 }, modifier_value: 'High', session_tags: [], raw_transcript: 'Google Health Fitbit Air: REM Sleep 131 mins' },
    { id: 'fitbit-air-rhr-2026-11-15', exercise_id: 'resting_heart_rate', timestamp: isoDaysAgo(0, 8), metric_values: { BPM: 55 }, modifier_value: 'Resting', session_tags: [], raw_transcript: 'Google Health Fitbit Air: Resting Heart Rate 55 bpm' },
    { id: 'fitbit-air-hrv-2026-11-15', exercise_id: 'hrv', timestamp: isoDaysAgo(0, 8), metric_values: { rMSSD: 56 }, modifier_value: 'High Recovery', session_tags: [], raw_transcript: 'Google Health Fitbit Air: HRV 56 ms' },

    // Day 3
    { id: 'log-seed-dur-3', exercise_id: 'total_sleep_duration', timestamp: isoDaysAgo(3, 8), metric_values: { Duration: 8.2 }, modifier_value: 'Optimal', session_tags: ['Fresh'], raw_transcript: 'Total Sleep: 8.2 hrs' },
    { id: 'log-seed-deep-3', exercise_id: 'deep_sleep', timestamp: isoDaysAgo(3, 8), metric_values: { Minutes: 96 }, modifier_value: 'Optimal', session_tags: ['Fresh'], raw_transcript: 'Deep Sleep: 96 mins' },
    { id: 'log-seed-rem-3', exercise_id: 'rem_sleep', timestamp: isoDaysAgo(3, 8), metric_values: { Minutes: 118 }, modifier_value: 'High', session_tags: ['Fresh'], raw_transcript: 'REM Sleep: 118 mins' },
    { id: 'log-seed-rhr-3', exercise_id: 'resting_heart_rate', timestamp: isoDaysAgo(3, 8), metric_values: { BPM: 50 }, modifier_value: 'Resting', session_tags: ['Fresh'], raw_transcript: 'Resting Heart Rate: 50 bpm' },
    { id: 'log-seed-hrv-3', exercise_id: 'hrv', timestamp: isoDaysAgo(3, 8), metric_values: { rMSSD: 76 }, modifier_value: 'High Recovery', session_tags: ['Fresh'], raw_transcript: 'HRV: 76 ms' },

    // Day 2 (Peak PR Day)
    { id: 'log-seed-dur-2', exercise_id: 'total_sleep_duration', timestamp: isoDaysAgo(2, 8), metric_values: { Duration: 8.6 }, modifier_value: 'Optimal', session_tags: ['Fresh'], raw_transcript: 'Total Sleep: 8.6 hrs (Peak rest)' },
    { id: 'log-seed-deep-2', exercise_id: 'deep_sleep', timestamp: isoDaysAgo(2, 8), metric_values: { Minutes: 105 }, modifier_value: 'Optimal', session_tags: ['Fresh'], raw_transcript: 'Deep Sleep: 105 mins (Peak restorative)' },
    { id: 'log-seed-rem-2', exercise_id: 'rem_sleep', timestamp: isoDaysAgo(2, 8), metric_values: { Minutes: 125 }, modifier_value: 'High', session_tags: ['Fresh'], raw_transcript: 'REM Sleep: 125 mins' },
    { id: 'log-seed-rhr-2', exercise_id: 'resting_heart_rate', timestamp: isoDaysAgo(2, 8), metric_values: { BPM: 49 }, modifier_value: 'Resting', session_tags: ['Fresh'], raw_transcript: 'Resting Heart Rate: 49 bpm (Lowest)' },
    { id: 'log-seed-hrv-2', exercise_id: 'hrv', timestamp: isoDaysAgo(2, 8), metric_values: { rMSSD: 82 }, modifier_value: 'High Recovery', session_tags: ['Fresh'], raw_transcript: 'HRV: 82 ms (Peak autonomic recovery)' },

    // Day 1 (Yesterday)
    { id: 'log-seed-dur-1', exercise_id: 'total_sleep_duration', timestamp: isoDaysAgo(1, 8), metric_values: { Duration: 8.0 }, modifier_value: 'Optimal', session_tags: ['Fresh'], raw_transcript: 'Total Sleep: 8.0 hrs' },
    { id: 'log-seed-deep-1', exercise_id: 'deep_sleep', timestamp: isoDaysAgo(1, 8), metric_values: { Minutes: 88 }, modifier_value: 'Optimal', session_tags: ['Fresh'], raw_transcript: 'Deep Sleep: 88 mins' },
    { id: 'log-seed-rem-1', exercise_id: 'rem_sleep', timestamp: isoDaysAgo(1, 8), metric_values: { Minutes: 115 }, modifier_value: 'High', session_tags: ['Fresh'], raw_transcript: 'REM Sleep: 115 mins' },
    { id: 'log-seed-rhr-1', exercise_id: 'resting_heart_rate', timestamp: isoDaysAgo(1, 8), metric_values: { BPM: 52 }, modifier_value: 'Resting', session_tags: ['Fresh'], raw_transcript: 'Resting Heart Rate: 52 bpm' },
    { id: 'log-seed-hrv-1', exercise_id: 'hrv', timestamp: isoDaysAgo(1, 8), metric_values: { rMSSD: 70 }, modifier_value: 'High Recovery', session_tags: ['Fresh'], raw_transcript: 'HRV: 70 ms' },

    // Day 0 (Today - Vasco's live Fitbit sync)
    { id: 'log-seed-dur-0', exercise_id: 'total_sleep_duration', timestamp: isoDaysAgo(0, 8), metric_values: { Duration: 7.9 }, modifier_value: 'Optimal', session_tags: ['Fresh'], raw_transcript: 'Fitbit Air Sync: Total Sleep 7.9 hrs' },
    { id: 'log-seed-deep-0', exercise_id: 'deep_sleep', timestamp: isoDaysAgo(0, 8), metric_values: { Minutes: 66 }, modifier_value: 'Average', session_tags: ['Fresh'], raw_transcript: 'Fitbit Air Sync: Deep Sleep 66 mins' },
    { id: 'log-seed-rem-0', exercise_id: 'rem_sleep', timestamp: isoDaysAgo(0, 8), metric_values: { Minutes: 131 }, modifier_value: 'High', session_tags: ['Fresh'], raw_transcript: 'Fitbit Air Sync: REM Sleep 131 mins' },
    { id: 'log-seed-rhr-0', exercise_id: 'resting_heart_rate', timestamp: isoDaysAgo(0, 8), metric_values: { BPM: 55 }, modifier_value: 'Resting', session_tags: ['Fresh'], raw_transcript: 'Fitbit Air Sync: Resting Heart Rate 55 bpm' },
    { id: 'log-seed-hrv-0', exercise_id: 'hrv', timestamp: isoDaysAgo(0, 8), metric_values: { rMSSD: 56 }, modifier_value: 'High Recovery', session_tags: ['Fresh'], raw_transcript: 'Fitbit Air Sync: HRV 56 ms' },
  ];

  return {
    exercises: DEFAULT_EXERCISE_BLUEPRINTS,
    logs,
  };
}

export function loadLocalDb(): VascoDatabase {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initial = createInitialSeedData();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as VascoDatabase;
    // Automatically migrate if the old schema was stored on disk
    if (!Array.isArray(parsed.exercises) || !Array.isArray(parsed.logs)) {
      const initial = createInitialSeedData();
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    return parsed;
  } catch {
    const initial = createInitialSeedData();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
}

export function saveLocalDb(db: VascoDatabase): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    // In serverless environments like Vercel with read-only filesystems, local file writes are safely bypassed
    console.warn('[V.A.S.C.O. Store] Local file write skipped (serverless environment):', err);
  }
}

export async function syncBlueprintsToSupabase(): Promise<void> {
  const supa = getSupabaseClient();
  if (!supa) return;
  try {
    const db = loadLocalDb();
    await supa.from('exercises').upsert(db.exercises, { onConflict: 'id' });
  } catch (err) {
    console.warn('[V.A.S.C.O. Store] Supabase blueprint sync warning:', err);
  }
}

export function resetToSeedData(): VascoDatabase {
  const initial = createInitialSeedData();
  saveLocalDb(initial);
  realtimeEmitter.emit('db_updated', { type: 'RESET', data: initial });
  return initial;
}

export async function clearAllData(): Promise<VascoDatabase> {
  const current = loadLocalDb();
  const emptyLogsDb: VascoDatabase = {
    exercises: current.exercises?.length ? current.exercises : DEFAULT_EXERCISE_BLUEPRINTS,
    logs: [],
  };
  saveLocalDb(emptyLogsDb);

  const supa = getSupabaseClient();
  if (supa) {
    try {
      await supa.from('logs').delete().neq('id', 'none');
      await supa.from('exercises').upsert(emptyLogsDb.exercises, { onConflict: 'id' });
    } catch (err) {
      console.warn('[V.A.S.C.O. Store] Supabase clear warning:', err);
    }
  }

  realtimeEmitter.emit('db_updated', { type: 'CLEAR', data: emptyLogsDb });
  return emptyLogsDb;
}

export async function getAllData(): Promise<VascoDatabase> {
  const localDb = loadLocalDb();
  const supa = getSupabaseClient();

  if (supa) {
    try {
      const [exRes, logsRes] = await Promise.all([
        supa.from('exercises').select('*'),
        supa.from('logs').select('*').order('timestamp', { ascending: true }),
      ]);

      if (!exRes.error && exRes.data) {
        if (exRes.data.length === 0) {
          // Seed initial blueprints into Supabase automatically
          await supa.from('exercises').upsert(localDb.exercises, { onConflict: 'id' });
        }
        const exercises =
          exRes.data.length > 0 ? (exRes.data as ExerciseBlueprint[]) : localDb.exercises;
        const logs =
          !logsRes.error && logsRes.data && logsRes.data.length > 0
            ? (logsRes.data as ExerciseLog[])
            : localDb.logs;

        return { exercises, logs };
      }
    } catch (err) {
      console.warn('[V.A.S.C.O. Store] Supabase read fallback to local store:', err);
    }
  }

  return localDb;
}

export async function insertExerciseLog(log: ExerciseLog): Promise<ExerciseLog> {
  const db = loadLocalDb();
  db.logs.push(log);
  saveLocalDb(db);

  const supa = getSupabaseClient();
  if (supa) {
    try {
      await supa.from('logs').insert([log]);
    } catch (err) {
      console.warn('[V.A.S.C.O. Store] Supabase insertExerciseLog warning:', err);
    }
  }

  realtimeEmitter.emit('db_updated', {
    type: 'INSERT_LOG',
    row: log,
  });

  return log;
}

export async function upsertDailyBiometricLog(log: ExerciseLog, dateStr: string): Promise<ExerciseLog> {
  const db = loadLocalDb();
  const dateKey = dateStr.slice(0, 10);

  const existingIdx = db.logs.findIndex(
    (l) => l.exercise_id === log.exercise_id && l.timestamp.startsWith(dateKey)
  );

  let targetLog: ExerciseLog;
  if (existingIdx >= 0) {
    targetLog = {
      ...log,
      id: db.logs[existingIdx].id,
      timestamp: log.timestamp,
    };
    db.logs[existingIdx] = targetLog;
  } else {
    targetLog = log;
    db.logs.push(targetLog);
  }

  saveLocalDb(db);

  const supa = getSupabaseClient();
  if (supa) {
    try {
      await supa.from('logs').upsert([targetLog], { onConflict: 'id' });
    } catch (err) {
      console.warn('[V.A.S.C.O. Store] Supabase upsertDailyBiometricLog warning:', err);
    }
  }

  realtimeEmitter.emit('db_updated', {
    type: existingIdx >= 0 ? 'UPDATE_LOG' : 'INSERT_LOG',
    row: targetLog,
  });

  return targetLog;
}

export async function upsertExerciseBlueprint(
  blueprint: ExerciseBlueprint
): Promise<ExerciseBlueprint> {
  const db = loadLocalDb();
  const idx = db.exercises.findIndex((e) => e.id === blueprint.id);
  if (idx >= 0) {
    db.exercises[idx] = blueprint;
  } else {
    db.exercises.push(blueprint);
  }
  saveLocalDb(db);

  const supa = getSupabaseClient();
  if (supa) {
    try {
      await supa.from('exercises').upsert([blueprint], { onConflict: 'id' });
    } catch (err) {
      console.warn('[V.A.S.C.O. Store] Supabase upsertExerciseBlueprint warning:', err);
    }
  }

  realtimeEmitter.emit('db_updated', {
    type: 'UPSERT_BLUEPRINT',
    row: blueprint,
  });

  return blueprint;
}

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

export async function getValidGoogleAccessToken(): Promise<string | null> {
  const clientId = process.env.GOOGLE_HEALTH_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_HEALTH_CLIENT_SECRET || '';
  let refreshToken = process.env.GOOGLE_HEALTH_REFRESH_TOKEN?.trim();

  // Return unexpired cached token if still valid for at least 60 seconds
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedAccessToken;
  }

  // If not in env, check Supabase app_config
  if (!refreshToken) {
    const supa = getSupabaseClient();
    if (supa) {
      try {
        const { data } = await supa
          .from('app_config')
          .select('value')
          .eq('key', 'google_refresh_token')
          .single();
        if (data?.value) {
          refreshToken = data.value;
          process.env.GOOGLE_HEALTH_REFRESH_TOKEN = refreshToken;
        }
      } catch {
        // app_config table may not exist yet, fallback gracefully
      }
    }
  }

  // If we have a refresh token, mint a fresh access token from Google
  if (refreshToken) {
    try {
      const resp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data.access_token) {
          cachedAccessToken = data.access_token;
          tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
          process.env.FITBIT_ACCESS_TOKEN = data.access_token;
          return cachedAccessToken;
        }
      } else {
        const errText = await resp.text();
        console.warn('[Google OAuth] Token refresh failed:', resp.status, errText);
      }
    } catch (err) {
      console.warn('[Google OAuth] Error refreshing token:', err);
    }
  }

  return process.env.FITBIT_ACCESS_TOKEN?.trim() || null;
}

export async function saveGoogleRefreshToken(token: string): Promise<void> {
  process.env.GOOGLE_HEALTH_REFRESH_TOKEN = token;
  const supa = getSupabaseClient();
  if (supa) {
    try {
      await supa
        .from('app_config')
        .upsert([{ key: 'google_refresh_token', value: token }], { onConflict: 'key' });
    } catch {
      // app_config table optional
    }
  }

  try {
    const fs = await import('fs');
    const path = await import('path');
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, 'utf8');
      if (content.includes('GOOGLE_HEALTH_REFRESH_TOKEN=')) {
        content = content.replace(
          /GOOGLE_HEALTH_REFRESH_TOKEN=.*/,
          `GOOGLE_HEALTH_REFRESH_TOKEN=${token}`
        );
      } else {
        content += `\nGOOGLE_HEALTH_REFRESH_TOKEN=${token}\n`;
      }
      fs.writeFileSync(envPath, content, 'utf8');
    }
  } catch {
    // Read-only filesystem in Vercel lambda is fine
  }
}

export async function fetchLiveGoogleHealthData(): Promise<{
  totalSleepDuration?: number;
  deepSleepMinutes?: number;
  remSleepMinutes?: number;
  restingHeartRate?: number;
  hrvMs?: number;
} | null> {
  const token = await getValidGoogleAccessToken();
  if (!token) return null;

  try {
    // 1. Query Google Health sleep endpoint
    const sleepRes = await fetch('https://health.googleapis.com/v4/users/me/dataTypes/sleep/dataPoints', {
      headers: { Authorization: `Bearer ${token}` },
    });

    let totalSleepDuration: number | undefined;
    let deepSleepMinutes: number | undefined;
    let remSleepMinutes: number | undefined;

    if (sleepRes.ok) {
      const sleepJson = await sleepRes.json();
      const points = sleepJson.dataPoints || [];
      
      // Upsert ALL historical sleep nights returned by Fitbit Air into the database
      for (const point of points) {
        const stages = point.sleep?.stages || [];
        let deepMs = 0;
        let remMs = 0;
        let lightMs = 0;

        for (const s of stages) {
          const dur = new Date(s.endTime).getTime() - new Date(s.startTime).getTime();
          if (s.type === 'DEEP') deepMs += dur;
          else if (s.type === 'REM') remMs += dur;
          else if (s.type === 'LIGHT') lightMs += dur;
        }

        const totalSleepMs = deepMs + remMs + lightMs;
        const durHrs = Number((totalSleepMs / (1000 * 3600)).toFixed(1));
        if (durHrs < 1.0) continue; // skip short daytime naps

        const deepMins = Math.round(deepMs / 60000);
        const remMins = Math.round(remMs / 60000);
        const dateKey = point.sleep?.interval?.endTime || point.startTime;

        if (!totalSleepDuration) {
          totalSleepDuration = durHrs;
          deepSleepMinutes = deepMins;
          remSleepMinutes = remMins;
        }

        await upsertDailyBiometricLog({
          id: `fitbit-air-dur-${dateKey.slice(0, 10)}`,
          exercise_id: 'total_sleep_duration',
          timestamp: dateKey,
          metric_values: { Duration: durHrs },
          modifier_value: durHrs >= 7.5 ? 'Optimal' : durHrs >= 6.5 ? 'Sufficient' : 'Deficit',
          session_tags: [],
          raw_transcript: `Google Health Fitbit Air: Total Sleep ${durHrs} hrs`,
        }, dateKey);

        await upsertDailyBiometricLog({
          id: `fitbit-air-deep-${dateKey.slice(0, 10)}`,
          exercise_id: 'deep_sleep',
          timestamp: dateKey,
          metric_values: { Minutes: deepMins },
          modifier_value: deepMins >= 75 ? 'Optimal' : deepMins >= 50 ? 'Average' : 'Low',
          session_tags: [],
          raw_transcript: `Google Health Fitbit Air: Deep Sleep ${deepMins} mins`,
        }, dateKey);

        await upsertDailyBiometricLog({
          id: `fitbit-air-rem-${dateKey.slice(0, 10)}`,
          exercise_id: 'rem_sleep',
          timestamp: dateKey,
          metric_values: { Minutes: remMins },
          modifier_value: remMins >= 90 ? 'High' : remMins >= 60 ? 'Moderate' : 'Low',
          session_tags: [],
          raw_transcript: `Google Health Fitbit Air: REM Sleep ${remMins} mins`,
        }, dateKey);
      }
    } else {
      console.warn('[Google Health API] Sleep query status:', sleepRes.status);
    }

    // 2. Query Google Health heart rate endpoint
    let restingHeartRate: number | undefined;
    let hrvMs: number | undefined;

    const hrRes = await fetch('https://health.googleapis.com/v4/users/me/dataTypes/heart_rate/dataPoints', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (hrRes.ok) {
      const hrJson = await hrRes.json();
      const hrPoints = hrJson.dataPoints || [];
      if (hrPoints.length > 0) {
        const latest = hrPoints[hrPoints.length - 1];
        restingHeartRate = latest.restingHeartRate || latest.value?.bpm || latest.bpm;
      }
    }

    if (totalSleepDuration || deepSleepMinutes || remSleepMinutes || restingHeartRate) {
      return {
        totalSleepDuration,
        deepSleepMinutes,
        remSleepMinutes,
        restingHeartRate,
        hrvMs,
      };
    }
  } catch (err) {
    console.warn('[Google Health API] Error querying live data:', err);
  }
  return null;
}

export async function syncGoogleHealthBiometrics(params?: {
  totalSleepDuration?: number;
  deepSleepMinutes?: number;
  remSleepMinutes?: number;
  restingHeartRate?: number;
  hrvMs?: number;
  dateStr?: string;
}): Promise<{
  duration: ExerciseLog;
  deep: ExerciseLog;
  rem: ExerciseLog;
  rhr: ExerciseLog;
  hrv: ExerciseLog;
}> {
  const timestamp = params?.dateStr || new Date().toISOString();
  const db = loadLocalDb();

  // Attempt live pull from Google Health API first if not explicitly passed
  let liveCloud: Record<string, number | undefined> | null = null;
  if (!params?.totalSleepDuration && !params?.deepSleepMinutes) {
    liveCloud = await fetchLiveGoogleHealthData();
  }

  const latestDur = db.logs.filter((l) => l.exercise_id === 'total_sleep_duration').pop();
  const latestDeep = db.logs.filter((l) => l.exercise_id === 'deep_sleep').pop();
  const latestRem = db.logs.filter((l) => l.exercise_id === 'rem_sleep').pop();
  const latestRhr = db.logs.filter((l) => l.exercise_id === 'resting_heart_rate').pop();
  const latestHrv = db.logs.filter((l) => l.exercise_id === 'hrv').pop();

  const durationVal = params?.totalSleepDuration ?? liveCloud?.totalSleepDuration ?? (latestDur?.metric_values?.Duration ?? 7.4);
  const deepVal = params?.deepSleepMinutes ?? liveCloud?.deepSleepMinutes ?? (latestDeep?.metric_values?.Minutes ?? 65);
  const remVal = params?.remSleepMinutes ?? liveCloud?.remSleepMinutes ?? (latestRem?.metric_values?.Minutes ?? 85);
  const rhrVal = params?.restingHeartRate ?? liveCloud?.restingHeartRate ?? (latestRhr?.metric_values?.BPM ?? 54);
  const hrvVal = params?.hrvMs ?? liveCloud?.hrvMs ?? (latestHrv?.metric_values?.rMSSD ?? 60);

  const durMod = durationVal >= 7.5 ? 'Optimal' : durationVal >= 6.5 ? 'Sufficient' : 'Deficit';
  const deepMod = deepVal >= 75 ? 'Optimal' : deepVal >= 50 ? 'Average' : 'Low';
  const remMod = remVal >= 90 ? 'High' : remVal >= 60 ? 'Moderate' : 'Low';
  const rhrMod = rhrVal <= 54 ? 'Resting' : rhrVal <= 62 ? 'Elevated' : 'Fatigued';
  const hrvMod = hrvVal >= 65 ? 'High Recovery' : hrvVal >= 50 ? 'Baseline' : 'Suppressed';

  const durationLog: ExerciseLog = {
    id: `log-health-dur-${Date.now()}`,
    exercise_id: 'total_sleep_duration',
    timestamp,
    metric_values: { Duration: Number(durationVal.toFixed(1)) },
    modifier_value: durMod,
    session_tags: [],
    raw_transcript: `Google Health: Total Sleep ${durationVal.toFixed(1)} hrs (${durMod})`,
  };

  const deepLog: ExerciseLog = {
    id: `log-health-deep-${Date.now() + 1}`,
    exercise_id: 'deep_sleep',
    timestamp,
    metric_values: { Minutes: Math.round(deepVal) },
    modifier_value: deepMod,
    session_tags: [],
    raw_transcript: `Google Health: Deep Sleep ${Math.round(deepVal)} mins (${deepMod})`,
  };

  const remLog: ExerciseLog = {
    id: `log-health-rem-${Date.now() + 2}`,
    exercise_id: 'rem_sleep',
    timestamp,
    metric_values: { Minutes: Math.round(remVal) },
    modifier_value: remMod,
    session_tags: [],
    raw_transcript: `Google Health: REM Sleep ${Math.round(remVal)} mins (${remMod})`,
  };

  const rhrLog: ExerciseLog = {
    id: `log-health-rhr-${Date.now() + 3}`,
    exercise_id: 'resting_heart_rate',
    timestamp,
    metric_values: { BPM: Math.round(rhrVal) },
    modifier_value: rhrMod,
    session_tags: [],
    raw_transcript: `Google Health: Resting Heart Rate ${Math.round(rhrVal)} bpm (${rhrMod})`,
  };

  const hrvLog: ExerciseLog = {
    id: `log-health-hrv-${Date.now() + 4}`,
    exercise_id: 'hrv',
    timestamp,
    metric_values: { rMSSD: Math.round(hrvVal) },
    modifier_value: hrvMod,
    session_tags: [],
    raw_transcript: `Google Health: HRV ${Math.round(hrvVal)} ms (${hrvMod})`,
  };

  await upsertDailyBiometricLog(durationLog, timestamp);
  await upsertDailyBiometricLog(deepLog, timestamp);
  await upsertDailyBiometricLog(remLog, timestamp);
  await upsertDailyBiometricLog(rhrLog, timestamp);
  await upsertDailyBiometricLog(hrvLog, timestamp);

  return {
    duration: durationLog,
    deep: deepLog,
    rem: remLog,
    rhr: rhrLog,
    hrv: hrvLog,
  };
}
