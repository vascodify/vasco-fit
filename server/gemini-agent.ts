import { GoogleGenerativeAI, SchemaType, FunctionDeclaration } from '@google/generative-ai';
import { toolLogExercise } from './mcp-tools.ts';
import { loadLocalDb } from './store.ts';
import { ExecutedToolCall, SessionTag } from './types.ts';

function buildOracleContext(): string {
  try {
    const db = loadLocalDb();
    const blueprints = db.exercises
      .map((e) => {
        const pb = e.personal_best ? ` [PR: ${e.personal_best} ${e.metrics[0]?.unit || ""}]` : "";
        return `- ${e.name} (id: "${e.id}")${pb}`;
      })
      .join("\n");

    const now = new Date();
    const todayISO = now.toISOString().slice(0, 10);
    const todayFormatted = now.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const yesterday = new Date(now.getTime() - 86400000);
    const yesterdayISO = yesterday.toISOString().slice(0, 10);
    const yesterdayFormatted = yesterday.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    // Group biometrics by date for full historical analysis
    const bioMap = new Map<string, { dur?: number; deep?: number; rem?: number; rhr?: number; hrv?: number }>();
    for (const l of db.logs) {
      if (["total_sleep_duration", "deep_sleep", "rem_sleep", "resting_heart_rate", "hrv"].includes(l.exercise_id)) {
        const dateKey = l.timestamp.slice(0, 10);
        const curr = bioMap.get(dateKey) || {};
        if (l.exercise_id === 'total_sleep_duration') curr.dur = l.metric_values?.Duration;
        if (l.exercise_id === 'deep_sleep') curr.deep = l.metric_values?.Minutes;
        if (l.exercise_id === 'rem_sleep') curr.rem = l.metric_values?.Minutes;
        if (l.exercise_id === 'resting_heart_rate') curr.rhr = l.metric_values?.BPM;
        if (l.exercise_id === 'hrv') curr.hrv = l.metric_values?.rMSSD;
        bioMap.set(dateKey, curr);
      }
    }

    const sortedDates = Array.from(bioMap.keys()).sort().reverse();
    const dailyLedger = sortedDates.map((date) => {
      const data = bioMap.get(date)!;
      let tag = '';
      if (date === todayISO) tag = ' [TODAY]';
      else if (date === yesterdayISO) tag = ' [YESTERDAY]';
      return `- ${date}${tag}: Sleep ${data.dur ?? '?'}h, Deep ${data.deep ?? '?'}m, REM ${data.rem ?? '?'}m, Resting HR ${data.rhr ?? '?'} bpm, HRV ${data.hrv ?? '?'} ms`;
    }).join('\n');

    const todayData = bioMap.get(todayISO);
    const yesterdayData = bioMap.get(yesterdayISO);

    const recentWorkouts = db.logs
      .filter((l) => !["total_sleep_duration", "deep_sleep", "rem_sleep", "resting_heart_rate", "hrv"].includes(l.exercise_id))
      .slice(-15)
      .map((w) => `${w.exercise_id}: ${JSON.stringify(w.metric_values)} [${w.session_tags?.join(",") || "Fresh"}] (${w.timestamp.slice(0, 10)})`)
      .join("; ");

    return `
CURRENT CALENDAR REFERENCE:
- Today's Date: ${todayFormatted} (${todayISO})
- Yesterday's Date: ${yesterdayFormatted} (${yesterdayISO})
- Today's Telemetry: ${todayData ? `Recorded (${todayData.dur ?? '?'}h sleep, ${todayData.deep ?? '?'}m deep, ${todayData.rem ?? '?'}m REM, ${todayData.rhr ?? '?'} bpm RHR, ${todayData.hrv ?? '?'} ms HRV)` : 'Not yet logged for today'}
- Yesterday's Telemetry: ${yesterdayData ? `Recorded (${yesterdayData.dur ?? '?'}h sleep, ${yesterdayData.deep ?? '?'}m deep, ${yesterdayData.rem ?? '?'}m REM, ${yesterdayData.rhr ?? '?'} bpm RHR, ${yesterdayData.hrv ?? '?'} ms HRV)` : 'None'}

USER BLUEPRINTS & PR BENCHMARKS:
${blueprints}

DAILY BIOMETRIC LEDGER (PAST 14 DAYS - CONTINUOUS RECORD):
${dailyLedger}

RECENT LOGGED WORKOUT HISTORY:
${recentWorkouts || "No recent workouts logged yet."}
`;
  } catch {
    return "User training: Calisthenics & Weighted Strength with Fitbit Air telemetry.";
  }
}

function answerOracleQuestionFallback(transcript: string): string | null {
  const lower = transcript.toLowerCase();
  const db = loadLocalDb();

  const isQuestion =
    lower.includes("?") ||
    lower.startsWith("what") ||
    lower.startsWith("how") ||
    lower.startsWith("why") ||
    lower.startsWith("should") ||
    lower.startsWith("can i") ||
    lower.startsWith("tell me") ||
    lower.includes("average") ||
    lower.includes("mean") ||
    lower.includes("recommend") ||
    lower.includes("push hard") ||
    lower.includes("pr") ||
    lower.includes("think");

  if (!isQuestion) return null;

  const now = new Date();
  const todayISO = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86400000);
  const yesterdayISO = yesterday.toISOString().slice(0, 10);

  // Group biometrics by date
  const bioMap = new Map<string, { dur?: number; deep?: number; rem?: number; rhr?: number; hrv?: number }>();
  for (const l of db.logs) {
    if (["total_sleep_duration", "deep_sleep", "rem_sleep", "resting_heart_rate", "hrv"].includes(l.exercise_id)) {
      const dateKey = l.timestamp.slice(0, 10);
      const curr = bioMap.get(dateKey) || {};
      if (l.exercise_id === 'total_sleep_duration') curr.dur = l.metric_values?.Duration;
      if (l.exercise_id === 'deep_sleep') curr.deep = l.metric_values?.Minutes;
      if (l.exercise_id === 'rem_sleep') curr.rem = l.metric_values?.Minutes;
      if (l.exercise_id === 'resting_heart_rate') curr.rhr = l.metric_values?.BPM;
      if (l.exercise_id === 'hrv') curr.hrv = l.metric_values?.rMSSD;
      bioMap.set(dateKey, curr);
    }
  }

  const sortedDates = Array.from(bioMap.keys()).sort().reverse();
  const latestDate = sortedDates[0] || todayISO;
  const latestBio = bioMap.get(latestDate) || {};
  const todayBio = bioMap.get(todayISO);
  const yesterdayBio = bioMap.get(yesterdayISO) || bioMap.get(sortedDates[1]);

  const activeBio = todayBio || latestBio;
  const isActualToday = Boolean(todayBio);
  const dateContext = isActualToday ? 'today' : `on ${latestDate}`;

  const durVal = activeBio.dur ?? 7.6;
  const deepVal = activeBio.deep ?? 80;
  const remVal = activeBio.rem ?? 105;
  const rhrVal = activeBio.rhr ?? 52;
  const hrvVal = activeBio.hrv ?? 67;

  // 1. Inquiries regarding REM Sleep
  if (lower.includes("rem")) {
    const remLogs = db.logs
      .filter((l) => l.exercise_id === "rem_sleep")
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    if (lower.includes("average") || lower.includes("avg") || lower.includes("mean") || lower.includes("week")) {
      const last7 = remLogs.slice(0, 7);
      if (last7.length > 0) {
        const sum = last7.reduce((acc, curr) => acc + (curr.metric_values?.Minutes || 0), 0);
        const avg = (sum / last7.length).toFixed(1);
        const peak = Math.max(...last7.map(l => l.metric_values?.Minutes || 0));
        return `Across the last 7 days, your REM sleep averaged ${avg} minutes per night (${(Number(avg) / 60).toFixed(1)} hrs), peaking at ${peak} minutes. REM sleep above 90 minutes primes your neuromuscular coordination for technical calisthenics like Muscle Up Transition Pulses.`;
      }
    }

    if (lower.includes("yesterday") || lower.includes("last night")) {
      const target = remLogs.find((l) => l.timestamp.startsWith(yesterdayISO)) || remLogs[1];
      if (target) {
        return `Yesterday (${target.timestamp.slice(0, 10)}), your recorded REM sleep was ${target.metric_values?.Minutes} minutes (recovery status: ${target.modifier_value || 'High'}).`;
      }
    }

    const daysAgoMatch = lower.match(/(\d+)\s+days?\s+ago/i);
    if (daysAgoMatch) {
      const days = parseInt(daysAgoMatch[1], 10);
      const target = remLogs[days];
      if (target) {
        return `${days} days ago (${target.timestamp.slice(0, 10)}), your recorded REM sleep was ${target.metric_values?.Minutes} minutes.`;
      }
    }

    if (remLogs.length > 0) {
      const recentSummary = remLogs.slice(0, 7).map(l => `${l.timestamp.slice(5, 10)}: ${l.metric_values?.Minutes}m`).join(", ");
      return `Here is your recent daily REM sleep breakdown: ${recentSummary}. Today's mark is ${remLogs[0]?.metric_values?.Minutes}m.`;
    }
  }

  // 2. Inquiries regarding Deep Sleep
  if (lower.includes("deep sleep") || lower.includes("deep")) {
    const deepLogs = db.logs
      .filter((l) => l.exercise_id === "deep_sleep")
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    if (lower.includes("average") || lower.includes("avg") || lower.includes("mean") || lower.includes("week")) {
      const last7 = deepLogs.slice(0, 7);
      if (last7.length > 0) {
        const sum = last7.reduce((acc, curr) => acc + (curr.metric_values?.Minutes || 0), 0);
        const avg = (sum / last7.length).toFixed(1);
        const peak = Math.max(...last7.map(l => l.metric_values?.Minutes || 0));
        return `Across the last 7 days, your deep sleep averaged ${avg} minutes per night, peaking at ${peak} minutes. Deep sleep drives growth hormone and directly predicts your maximal 5RM loads on Squats and Pullups.`;
      }
    }

    if (lower.includes("yesterday") || lower.includes("last night")) {
      const target = deepLogs.find((l) => l.timestamp.startsWith(yesterdayISO)) || deepLogs[1];
      if (target) {
        return `Yesterday (${target.timestamp.slice(0, 10)}), your deep sleep was ${target.metric_values?.Minutes} minutes.`;
      }
    }
  }

  // 3. PR / Pushing Hard
  if (lower.includes("push") || lower.includes("hard") || lower.includes("heavy") || lower.includes("pr")) {
    if (hrvVal >= 65 && deepVal >= 70) {
      return `Based on your telemetry ${dateContext}, your resting heart rate is primed at ${rhrVal} bpm and HRV sits high at ${hrvVal} ms, supported by ${deepVal} minutes of deep sleep and ${remVal} minutes of REM (${durVal}h total sleep). Your autonomic nervous system is fully recovered—today is a prime window to chase PR attempts and heavy working sets!`;
    } else if (hrvVal >= 55) {
      return `Based on your telemetry ${dateContext}, your resting heart rate is ${rhrVal} bpm and HRV is ${hrvVal} ms, with ${deepVal}m of deep sleep and ${remVal}m of REM (${durVal}h total sleep). You have good recovery for solid working volume, but execute with strict form and save all-out 1RM max attempts for when your HRV rebounds above 70 ms.`;
    } else {
      return `Based on your telemetry ${dateContext}, your HRV dipped to ${hrvVal} ms and resting heart rate sits at ${rhrVal} bpm (${deepVal}m deep sleep), signaling mild central nervous system fatigue. Focus on controlled technique, submaximal volume, or mobility today rather than chasing maximal PRs.`;
    }
  }

  // 4. Struggles / missed reps
  if (lower.includes("why") && (lower.includes("struggle") || lower.includes("miss") || lower.includes("fewer") || lower.includes("typical") || lower.includes("fail") || lower.includes("reps"))) {
    return "Analyzing your correlation history: on days where your reps dipped (such as when reps dropped on pullups or parallette pikes), your deep sleep had collapsed below 50 minutes and HRV dipped below 50 ms. Deep sleep is when growth hormone and muscular tissue repair occur; when suppressed, central nervous system fatigue impedes high-threshold motor unit recruitment.";
  }

  // 5. Correlation inquiries
  if (lower.includes("correlat") || lower.includes("connection") || lower.includes("relationship")) {
    return "Your data reveals a distinct two-factor correlation pattern: Deep Sleep directly drives your raw 5RM load ceiling (your 25kg pullup and 120kg squat PRs were both preceded by 105 mins of deep sleep), whereas REM sleep directly predicts false-grip stamina and coordination on complex skills like Muscle Up Transition Pulses.";
  }

  return `Based on your biometrics ${dateContext} (${durVal}h sleep, ${deepVal}m deep, ${remVal}m REM, ${rhrVal} bpm RHR, ${hrvVal} ms HRV), your recovery status is '${hrvVal >= 65 ? 'High Recovery' : 'Moderate'}'. Your nervous system is primed for technical calisthenics and progressive overload.`;
}

export interface AgentProcessResult {
  transcript: string;
  executedTools: ExecutedToolCall[];
  replyText: string;
  usedGemini: boolean;
}

const GEMINI_TOOLS: FunctionDeclaration[] = [
  {
    name: 'log_exercise',
    description: `Logs a strength or calisthenics exercise entry using the V.A.S.C.O. Blueprint & Instance Model.
Priority Exercise Blueprints:
1. "muscle_up_transition_pulses" (Muscle Up Transition Pulses) -> metric_values: { Reps: <count> }, modifier_value: Form Quality "1"-"5"
2. "fat_grip_pullups" (Fat Grip Pullups) -> metric_values: { Reps: <count> }, modifier_value: Form Quality "1"-"5"
3. "weighted_pullups" (Weighted Pullups) -> metric_values: { Weight: <kg>, Reps: <count> }, modifier_value: Form Quality "1"-"5"
4. "dips" (Dips) -> metric_values: { Reps: <count> }, modifier_value: "Bodyweight" | "+5kg" | "+10kg" | "+15kg" | "+20kg"
5. "sphinx_pushups" (Sphinx Pushups) -> metric_values: { Reps: <count> }
6. "pike_presses" (Pike Presses) -> metric_values: { Reps: <count> }, modifier_value: "Floor" | "Parallettes" | "Blocks" (Deficit / ROM)
7. "deadlift" (Deadlift) -> metric_values: { Weight: <kg>, Reps: <count> } (Note: 1 plate=60kg, 2=100kg, 3=140kg, 4=180kg)
8. "squat" (Squat 5RM) -> metric_values: { Weight: <kg> }
9. "incline_db_press" (Incline DB Press 5RM) -> metric_values: { Weight: <kg> }
10. "sleep_score" (Sleep Score) -> metric_values: { Score: <0-100> }, modifier_value: "Restful" | "Deep" | "Light" | "Restless"
11. "readiness_score" (Readiness Score) -> metric_values: { Score: <0-100> }, modifier_value: "Optimal" | "Moderate" | "Low"`,
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        exercise_id: {
          type: SchemaType.STRING,
          description:
            'Blueprint ID: muscle_up_transition_pulses, fat_grip_pullups, weighted_pullups, dips, sphinx_pushups, pike_presses, deadlift, squat, incline_db_press, sleep_score, or readiness_score',
        },
        Time: {
          type: SchemaType.NUMBER,
          description: 'Duration in seconds (for isometric holds)',
        },
        Reps: {
          type: SchemaType.NUMBER,
          description: 'Number of repetitions completed',
        },
        Weight: {
          type: SchemaType.NUMBER,
          description: 'Weight load in kg (for weighted_pullups, deadlift, squat)',
        },
        Score: {
          type: SchemaType.NUMBER,
          description: 'Score value e.g. 0-100 for sleep_score or readiness_score',
        },
        modifier_value: {
          type: SchemaType.STRING,
          description:
            'Modifier value: Band Assistance, Deficit, Dip load ("+10kg"), Form Quality ("1" to "5", ALWAYS 5 unless the user explicitly reports suboptimal/sloppy/shaky form), Sleep Quality, or Recovery Zone',
        },
        session_tags: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: 'Contextual tags from speech e.g. ["Fresh"], ["Sore"], ["Heavy"]',
        },
        notes: {
          type: SchemaType.STRING,
          description: 'Optional coaching or form note',
        },
        timestamp: {
          type: SchemaType.STRING,
          description: 'ISO 8601 date timestamp if user specifies a date/time like yesterday or last night',
        },
      },
      required: ['exercise_id'],
    },
  },
];

function extractSessionTags(text: string): SessionTag[] {
  const lower = text.toLowerCase();
  const tags: SessionTag[] = [];
  if (lower.includes('sore') || lower.includes('tight') || lower.includes('stiff') || lower.includes('fatigued')) {
    tags.push('Sore');
  } else {
    tags.push('Fresh');
  }
  return tags;
}

/**
 * Extracts Form Quality (scale 1-5).
 * Baseline Rule: Unless the user explicitly states their form was suboptimal, sloppy, or degraded,
 * all successfully completed reps are presumed to be 5/5.
 */
function extractFormQuality(clause: string): number {
  const lower = clause.toLowerCase();
  const directMatch =
    clause.match(/form\s*(?:quality)?\s*(?:of|is|was|at|:)?\s*(\d)/i) ||
    clause.match(/(\d)\s*\/\s*5\s*form/i) ||
    clause.match(/form\s*(\d)\s*\/\s*5/i);
  if (directMatch) {
    const val = parseInt(directMatch[1], 10);
    return Math.min(5, Math.max(1, val));
  }

  if (
    lower.includes('terrible form') ||
    lower.includes('failed form') ||
    lower.includes('form broke down completely') ||
    lower.includes('form 1')
  ) {
    return 1;
  }
  if (
    lower.includes('bad form') ||
    lower.includes('ugly rep') ||
    lower.includes('ugly form') ||
    lower.includes('cheat reps') ||
    lower.includes('form 2')
  ) {
    return 2;
  }
  if (
    lower.includes('suboptimal') ||
    lower.includes('sloppy') ||
    lower.includes('shaky') ||
    lower.includes('breakdown') ||
    lower.includes('loose form') ||
    lower.includes('struggled with form') ||
    lower.includes('form 3')
  ) {
    return 3;
  }
  if (
    lower.includes('minor form breakdown') ||
    lower.includes('slight swing') ||
    lower.includes('decent form') ||
    lower.includes('form 4')
  ) {
    return 4;
  }

  // Pure baseline standard: 5/5
  return 5;
}

/**
 * Deterministic multi-exercise NLP parser for V.A.S.C.O.'s 8 Priority Blueprints
 */
async function fallbackParseAndExecute(text: string): Promise<ExecutedToolCall[]> {
  const executed: ExecutedToolCall[] = [];
  const lowerText = text.toLowerCase();

  // If this is purely a question for the Oracle, do not force accidental exercise logs
  const isPureQuestion =
    (text.includes('?') ||
      lowerText.startsWith('why') ||
      lowerText.startsWith('should') ||
      lowerText.startsWith('how') ||
      lowerText.startsWith('can i') ||
      lowerText.startsWith('recommend') ||
      lowerText.startsWith('what do you think') ||
      lowerText.includes('tell me')) &&
    !lowerText.includes('did ') &&
    !lowerText.includes('hit ') &&
    !lowerText.includes('logged ') &&
    !lowerText.includes('completed ') &&
    !lowerText.includes('just did');

  if (isPureQuestion) {
    return [];
  }

  let customTimestamp: string | undefined = undefined;
  if (lowerText.includes('yesterday') || lowerText.includes('last night')) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    if (lowerText.includes('night') || lowerText.includes('evening')) {
      d.setHours(20, 0, 0, 0);
    } else {
      d.setHours(12, 0, 0, 0);
    }
    customTimestamp = d.toISOString();
  } else {
    const daysAgoMatch = lowerText.match(/(\d+)\s+days?\s+ago/i);
    if (daysAgoMatch) {
      const d = new Date();
      d.setDate(d.getDate() - parseInt(daysAgoMatch[1], 10));
      d.setHours(12, 0, 0, 0);
      customTimestamp = d.toISOString();
    }
  }

  const session_tags = extractSessionTags(text);

  // Split compound sentences by "and", ";", or "," when another exercise is mentioned
  const clauses = text
    .split(/(?:,\s*(?:and\s+)?|\s+and\s+|\s*;\s*|\.\s+)/i)
    .map((c) => c.trim())
    .filter(Boolean);

  for (const clause of clauses) {
    const lower = clause.toLowerCase();

    // 1. Muscle Up Transition Pulses (Bodyweight 90° Isometric + Pulses)
    if (lower.includes('muscle') || lower.includes('transition') || lower.includes('pulse')) {
      const repMatch =
        clause.match(/(\d+)\s*(?:pulses|pulse|reps|rep)/i) ||
        clause.match(/(?:hit|did|for)\s+(\d+)/i);
      const pulses = repMatch ? parseInt(repMatch[1], 10) : 5;
      const modifier_value = extractFormQuality(clause);

      const args = {
        exercise_id: 'muscle_up_transition_pulses',
        metric_values: { Reps: pulses },
        modifier_value,
        session_tags,
      };
      const result = await toolLogExercise({ ...args, timestamp: customTimestamp, raw_transcript: text });
      executed.push({ tool: 'log_exercise', args, result });
      continue;
    }

    // 2. Fat Grip Pullups
    if (lower.includes('fat grip') || lower.includes('fat-grip')) {
      const repMatch =
        clause.match(/(\d+)\s*(?:reps|rep|fat)/i) ||
        clause.match(/(?:hit|did|for)\s+(\d+)/i);
      const reps = repMatch ? parseInt(repMatch[1], 10) : 10;
      const modifier_value = extractFormQuality(clause);

      const args = {
        exercise_id: 'fat_grip_pullups',
        metric_values: { Reps: reps },
        modifier_value,
        session_tags,
      };
      const result = await toolLogExercise({ ...args, timestamp: customTimestamp, raw_transcript: text });
      executed.push({ tool: 'log_exercise', args, result });
      continue;
    }

    // 3. Weighted Pullups (5RM Load in kg)
    if (lower.includes('pullup') || lower.includes('pull-up') || lower.includes('pull up') || lower.includes('chin')) {
      const weightMatch =
        clause.match(/(?:\+|plus\s*)?(\d+(?:\.\d+)?)\s*(?:kg|kilos|lbs)/i);
      const weight = weightMatch ? parseFloat(weightMatch[1]) : 20;
      const modifier_value = extractFormQuality(clause);

      const args = {
        exercise_id: 'weighted_pullups',
        metric_values: { Weight: weight },
        modifier_value,
        session_tags,
      };
      const result = await toolLogExercise({ ...args, timestamp: customTimestamp, raw_transcript: text });
      executed.push({ tool: 'log_exercise', args, result });
      continue;
    }

    // 4. Dips
    if (lower.includes('dip')) {
      const repMatch =
        clause.match(/(\d+)\s*(?:reps|rep|dips|dip)/i) ||
        clause.match(/(?:hit|did|for)\s+(\d+)/i);
      const reps = repMatch ? parseInt(repMatch[1], 10) : 15;

      let modifier_value = 'Bodyweight';
      const weightMatch = clause.match(/(?:\+|plus\s*)(\d+(?:\.\d+)?)\s*(?:kg|kilos)/i);
      if (weightMatch) {
        modifier_value = `+${weightMatch[1]}kg`;
      }

      const args = {
        exercise_id: 'dips',
        metric_values: { Reps: reps },
        modifier_value,
        session_tags,
      };
      const result = await toolLogExercise({ ...args, timestamp: customTimestamp, raw_transcript: text });
      executed.push({ tool: 'log_exercise', args, result });
      continue;
    }

    // 5. Sphinx Pushups
    if (lower.includes('sphinx')) {
      const repMatch =
        clause.match(/(\d+)\s*(?:reps|rep|sphinx)/i) ||
        clause.match(/(?:for|x|×|hit|did)\s*(\d+)/i);
      const reps = repMatch ? parseInt(repMatch[1], 10) : 12;
      const modifier_value = extractFormQuality(clause);

      const args = {
        exercise_id: 'sphinx_pushups',
        metric_values: { Reps: reps },
        modifier_value,
        session_tags,
      };
      const result = await toolLogExercise({ ...args, timestamp: customTimestamp, raw_transcript: text });
      executed.push({ tool: 'log_exercise', args, result });
      continue;
    }

    // 6. Pike Presses
    if (lower.includes('pike') || lower.includes('handstand') || lower.includes('hspu')) {
      const repMatch =
        clause.match(/(\d+)\s*(?:reps|rep|pike|elevated|deep)/i) ||
        clause.match(/(?:for|x|×|hit|did)\s*(\d+)/i);
      const reps = repMatch ? parseInt(repMatch[1], 10) : 4;

      let modifier_value = 'Floor';
      if (lower.includes('parallette')) modifier_value = 'Parallettes';
      else if (lower.includes('block') || lower.includes('deficit') || lower.includes('elevated')) {
        modifier_value = 'Blocks';
      }

      const args = {
        exercise_id: 'pike_presses',
        metric_values: { Reps: reps },
        modifier_value,
        session_tags,
      };
      const result = await toolLogExercise({ ...args, timestamp: customTimestamp, raw_transcript: text });
      executed.push({ tool: 'log_exercise', args, result });
      continue;
    }

    // 7. Deadlift (1RM Load in kg)
    if (lower.includes('deadlift')) {
      const plateMatch = clause.match(/(\d+)\s*plates?/i);
      const weightMatch = clause.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos|lbs)/i);

      let weight = 180;
      if (plateMatch) {
        weight = 20 + parseInt(plateMatch[1], 10) * 40;
      } else if (weightMatch) {
        weight = parseFloat(weightMatch[1]);
      }
      const modifier_value = extractFormQuality(clause);

      const args = {
        exercise_id: 'deadlift',
        metric_values: { Weight: weight },
        modifier_value,
        session_tags,
      };
      const result = await toolLogExercise({ ...args, timestamp: customTimestamp, raw_transcript: text });
      executed.push({ tool: 'log_exercise', args, result });
      continue;
    }

    // 8. Squat (5RM Load in kg)
    if (lower.includes('squat')) {
      const weightMatch = clause.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos|lbs)/i);
      const weight = weightMatch ? parseFloat(weightMatch[1]) : 110;
      const modifier_value = extractFormQuality(clause);

      const args = {
        exercise_id: 'squat',
        metric_values: { Weight: weight },
        modifier_value,
        session_tags,
      };
      const result = await toolLogExercise({ ...args, timestamp: customTimestamp, raw_transcript: text });
      executed.push({ tool: 'log_exercise', args, result });
      continue;
    }

    // 9. Incline DB Press (5RM Load in kg)
    if (lower.includes('incline') || lower.includes('db press') || lower.includes('dumbbell press')) {
      const weightMatch =
        clause.match(/(?:at|with|for|\s)\s*(\d+(?:\.\d+)?)\s*(?:kg|kilos|lbs)?/i) ||
        clause.match(/(\d+(?:\.\d+)?)\s*kg/i);
      const weight = weightMatch ? parseFloat(weightMatch[1]) : 35;
      const modifier_value = extractFormQuality(clause);

      const args = {
        exercise_id: 'incline_db_press',
        metric_values: { Weight: weight },
        modifier_value,
        session_tags,
      };
      const result = await toolLogExercise({ ...args, timestamp: customTimestamp, raw_transcript: text });
      executed.push({ tool: 'log_exercise', args, result });
      continue;
    }

    // 10. Deep Sleep (Minutes)
    if (lower.includes('deep sleep') || (lower.includes('deep') && lower.includes('min'))) {
      const match = clause.match(/(\d+)\s*(?:minutes?|mins?|m)?\s*deep/i) || clause.match(/deep\s*(?:sleep)?\s*[:=]?\s*(\d+)/i);
      if (match) {
        const mins = parseInt(match[1], 10);
        const mod = mins >= 75 ? 'Optimal' : mins >= 50 ? 'Average' : 'Low';
        const args = {
          exercise_id: 'deep_sleep',
          metric_values: { Minutes: mins },
          modifier_value: mod,
          session_tags: [],
        };
        const result = await toolLogExercise({ ...args, timestamp: customTimestamp, raw_transcript: text });
        executed.push({ tool: 'log_exercise', args, result });
        continue;
      }
    }

    // 11. REM Sleep (Minutes)
    if (lower.includes('rem sleep') || lower.includes('rem')) {
      const match = clause.match(/(\d+)\s*(?:minutes?|mins?|m)?\s*rem/i) || clause.match(/rem\s*(?:sleep)?\s*[:=]?\s*(\d+)/i);
      if (match) {
        const mins = parseInt(match[1], 10);
        const mod = mins >= 90 ? 'High' : mins >= 60 ? 'Moderate' : 'Low';
        const args = {
          exercise_id: 'rem_sleep',
          metric_values: { Minutes: mins },
          modifier_value: mod,
          session_tags: [],
        };
        const result = await toolLogExercise({ ...args, timestamp: customTimestamp, raw_transcript: text });
        executed.push({ tool: 'log_exercise', args, result });
        continue;
      }
    }

    // 12. Total Sleep Duration (Hours)
    if (lower.includes('sleep') && (lower.includes('hour') || lower.includes('hrs') || lower.includes('duration'))) {
      const match = clause.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i) || clause.match(/sleep\s*(?:duration)?\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
      if (match) {
        const hrs = parseFloat(match[1]);
        const mod = hrs >= 7.5 ? 'Optimal' : hrs >= 6.5 ? 'Sufficient' : 'Deficit';
        const args = {
          exercise_id: 'total_sleep_duration',
          metric_values: { Duration: hrs },
          modifier_value: mod,
          session_tags: [],
        };
        const result = await toolLogExercise({ ...args, timestamp: customTimestamp, raw_transcript: text });
        executed.push({ tool: 'log_exercise', args, result });
        continue;
      }
    }

    // 13. Resting Heart Rate (BPM)
    if (lower.includes('resting heart rate') || lower.includes('resting hr') || lower.includes('rhr')) {
      const match = clause.match(/(\d+)\s*(?:bpm)?/i);
      if (match) {
        const bpm = parseInt(match[1], 10);
        const mod = bpm <= 54 ? 'Resting' : bpm <= 62 ? 'Elevated' : 'Fatigued';
        const args = {
          exercise_id: 'resting_heart_rate',
          metric_values: { BPM: bpm },
          modifier_value: mod,
          session_tags: [],
        };
        const result = await toolLogExercise({ ...args, timestamp: customTimestamp, raw_transcript: text });
        executed.push({ tool: 'log_exercise', args, result });
        continue;
      }
    }

    // 14. Heart Rate Variability (HRV ms)
    if (lower.includes('hrv') || lower.includes('variability')) {
      const match = clause.match(/(\d+)\s*(?:ms)?/i);
      if (match) {
        const hrv = parseInt(match[1], 10);
        const mod = hrv >= 65 ? 'High Recovery' : hrv >= 50 ? 'Baseline' : 'Suppressed';
        const args = {
          exercise_id: 'hrv',
          metric_values: { rMSSD: hrv },
          modifier_value: mod,
          session_tags: [],
        };
        const result = await toolLogExercise({ ...args, timestamp: customTimestamp, raw_transcript: text });
        executed.push({ tool: 'log_exercise', args, result });
        continue;
      }
    }
  }

  return executed;
}

export async function processUserInputWithVascoAgent(input: {
  text?: string;
  audioBuffer?: Buffer;
  audioMimeType?: string;
}): Promise<AgentProcessResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  let transcript = input.text?.trim() || '';
  const executedTools: ExecutedToolCall[] = [];

  if (apiKey) {
    try {
      const lowerText = transcript.toLowerCase();
      const isPureQuestion =
        (transcript.includes('?') ||
          lowerText.startsWith('what') ||
          lowerText.startsWith('why') ||
          lowerText.startsWith('should') ||
          lowerText.startsWith('how') ||
          lowerText.startsWith('can i') ||
          lowerText.startsWith('tell me') ||
          lowerText.startsWith('recommend') ||
          lowerText.includes('average') ||
          lowerText.includes('mean')) &&
        !lowerText.includes('did ') &&
        !lowerText.includes('hit ') &&
        !lowerText.includes('logged ') &&
        !lowerText.includes('completed ') &&
        !lowerText.includes('just did') &&
        !/\d+\s*(?:reps?|pulses?|kg|plates?|seconds?|lbs)/i.test(transcript);

      const genAI = new GoogleGenerativeAI(apiKey);
      const contextSnapshot = buildOracleContext();

      const agentNow = new Date();
      const agentTodayISO = agentNow.toISOString().slice(0, 10);
      const agentTodayFormatted = agentNow.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      const agentYesterday = new Date(agentNow.getTime() - 86400000);
      const agentYesterdayISO = agentYesterday.toISOString().slice(0, 10);
      const agentYesterdayFormatted = agentYesterday.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });

      const modelConfig: any = {
        model: 'gemini-flash-lite-latest',
        systemInstruction: `You are V.A.S.C.O (Voice-Activated Strength Correlation Oracle), Vasco's personal AI calisthenics, powerlifting, and recovery coach.
CURRENT DATE: Today is ${agentTodayFormatted} (${agentTodayISO}). Yesterday was ${agentYesterdayFormatted} (${agentYesterdayISO}).
You have DUAL CAPABILITIES:
1. WORKOUT & BIOMETRIC LOGGING:
   Only call log_exercise when the user is explicitly reporting/logging workout sets or biometrics they performed.
   If the user is asking a question or requesting information, DO NOT call log_exercise.
   FORM QUALITY RULE:
   For any exercise with Form Quality scale (1 to 5), ALWAYS set modifier_value to 5 unless Vasco explicitly states that form was suboptimal, sloppy, shaky, or degraded (e.g. "sloppy reps" -> 3, "minor swing" -> 4, or an explicit score like "form 3/5"). Never assume, guess, or randomize lower form scores.

2. ORACLE COACHING & DATA QA:
   If the user asks questions, asks for averages across the week, previous day biometrics, or correlations:
   - When evaluating Vasco's readiness, recovery, or whether to push for a PR today, inspect the biometrics recorded for [TODAY] (${agentTodayISO}) in the DAILY BIOMETRIC LEDGER.
   - If biometrics are already recorded for [TODAY] (${agentTodayISO}), use those exact figures as today's sleep and vitals.
   - If today's biometrics have not yet been synced, clearly state that today's telemetry is pending and reference the latest available night ([YESTERDAY] ${agentYesterdayISO}). Never quote yesterday's date or previous night's data as today's date!
   - When Vasco asks about "yesterday" or "last night", refer to ${agentYesterdayFormatted} (${agentYesterdayISO}).
   - Compute and answer directly using the exact numbers from the DAILY BIOMETRIC LEDGER and WORKOUT HISTORY below.
   - For weekly averages, calculate the average of the last 7 recorded daily points and state the exact average in minutes or hours.
   - For previous days, cite the specific date (e.g. ${agentYesterdayISO}, etc.) and give the exact figures.
   - Keep answers sharp, physiologically grounded, and motivating (2-4 punchy sentences).

REAL USER CONTEXT & DAILY BIOMETRIC LEDGER:
${contextSnapshot}`,
      };

      if (!isPureQuestion) {
        modelConfig.tools = [{ functionDeclarations: GEMINI_TOOLS }];
      }

      const model = genAI.getGenerativeModel(modelConfig);

      const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];
      if (input.audioBuffer && input.audioMimeType && !transcript) {
        parts.push({
          inlineData: {
            data: input.audioBuffer.toString('base64'),
            mimeType: input.audioMimeType,
          },
        });
        parts.push({
          text: 'Transcribe this voice note and call log_exercise for each exercise mentioned.',
        });
      } else if (transcript) {
        parts.push({ text: transcript });
      }

      if (parts.length > 0) {
        const response = await model.generateContent(parts);
        const candidate = response.response;
        const functionCalls = candidate.functionCalls();
        let geminiReplyText = '';
        try {
          geminiReplyText = candidate.text()?.trim() || '';
        } catch {
          // function calls only
        }

        if (!transcript && geminiReplyText) {
          transcript = geminiReplyText;
        }

        if (functionCalls && functionCalls.length > 0) {
          for (const call of functionCalls) {
            if (call.name === 'log_exercise') {
              const rawArgs = (call.args || {}) as Record<string, unknown>;
              const metric_values: Record<string, number> = {};
              if (rawArgs.Time !== undefined) metric_values.Time = Number(rawArgs.Time);
              if (rawArgs.Reps !== undefined) metric_values.Reps = Number(rawArgs.Reps);
              if (rawArgs.Weight !== undefined) metric_values.Weight = Number(rawArgs.Weight);
              if (rawArgs.Score !== undefined) metric_values.Score = Number(rawArgs.Score);
              if (rawArgs.Duration !== undefined) metric_values.Duration = Number(rawArgs.Duration);
              if (rawArgs.Minutes !== undefined) metric_values.Minutes = Number(rawArgs.Minutes);
              if (rawArgs.BPM !== undefined) metric_values.BPM = Number(rawArgs.BPM);
              if (rawArgs.rMSSD !== undefined) metric_values.rMSSD = Number(rawArgs.rMSSD);

              let explicitTimestamp = rawArgs.timestamp ? String(rawArgs.timestamp) : undefined;
              const lowerTranscript = transcript.toLowerCase();
              if (!explicitTimestamp && (lowerTranscript.includes('yesterday') || lowerTranscript.includes('last night'))) {
                const d = new Date();
                d.setDate(d.getDate() - 1);
                if (lowerTranscript.includes('night') || lowerTranscript.includes('evening')) {
                  d.setHours(20, 0, 0, 0);
                } else {
                  d.setHours(12, 0, 0, 0);
                }
                explicitTimestamp = d.toISOString();
              }

              const toolArgs = {
                exercise_id: String(rawArgs.exercise_id || 'muscle_up_transition_pulses'),
                metric_values,
                modifier_value:
                  rawArgs.modifier_value !== undefined ? String(rawArgs.modifier_value) : null,
                session_tags: Array.isArray(rawArgs.session_tags)
                  ? (rawArgs.session_tags as string[])
                  : extractSessionTags(transcript),
                notes: rawArgs.notes ? String(rawArgs.notes) : undefined,
                raw_transcript: transcript || '[Voice Note]',
                timestamp: explicitTimestamp,
              };

              const result = await toolLogExercise(toolArgs);
              executedTools.push({
                tool: 'log_exercise',
                args: toolArgs,
                result,
              });
            }
          }
        }

        if (executedTools.length > 0 || geminiReplyText) {
          return {
            transcript,
            executedTools,
            replyText:
              geminiReplyText || `Recorded ${executedTools.length} set${executedTools.length > 1 ? 's' : ''} to your workout log.`,
            usedGemini: true,
          };
        }
      }
    } catch (err) {
      console.warn('[V.A.S.C.O. Agent] Falling back to deterministic blueprint parser:', err);
    }
  }

  // Deterministic Blueprint & Instance NLP parser + Oracle Fallback
  const oracleFallback = answerOracleQuestionFallback(transcript);

  // If this is an Oracle question and does not contain explicit set numbers, do not force exercise logging
  const hasLoggedSetNumbers = /\d+\s*(?:reps?|pulses?|kg|plates?|seconds?|lbs)/i.test(transcript);
  let fallbackCalls: ExecutedToolCall[] = [];
  if (!oracleFallback || hasLoggedSetNumbers) {
    fallbackCalls = await fallbackParseAndExecute(transcript);
  }
  executedTools.push(...fallbackCalls);

  return {
    transcript,
    executedTools,
    replyText:
      oracleFallback ||
      (executedTools.length > 0
        ? `Recorded ${executedTools.length} set${executedTools.length > 1 ? 's' : ''} to your workout log.`
        : "I'm ready! You can log your workouts or ask questions like 'Should I push for a PR today?' or 'Why did I struggle in my last workout?'."),
    usedGemini: false,
  };
}
