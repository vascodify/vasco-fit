import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import path from 'path';
import http from 'http';
import express from 'express';
import cors from 'cors';
import {
  getAllData,
  loadLocalDb,
  initSupabaseClient,
  isSupabaseConfigured,
  realtimeEmitter,
  resetToSeedData,
  clearAllData,
  syncBlueprintsToSupabase,
  syncGoogleHealthBiometrics,
} from './store.ts';
import { toolLogExercise, toolUpsertBlueprint } from './mcp-tools.ts';
import { processUserInputWithVascoAgent } from './gemini-agent.ts';
import { ExerciseBlueprint, VASCO_MCP_TOOL_DEFINITIONS } from './types.ts';

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));

const PORT = Number(process.env.PORT || 3001);
const server = http.createServer(app);

// WebSocket server for local development real-time dashboard push (bypassed on Vercel)
let wss: any = null;
if (!process.env.VERCEL) {
  try {
    const { WebSocketServer } = await import('ws');
    wss = new WebSocketServer({ server, path: '/ws' });
  } catch (err) {
    console.warn('[V.A.S.C.O.] WebSocketServer initialization warning:', err);
  }
}

function broadcastWs(payload: unknown) {
  if (!wss) return;
  const msg = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === 1) { // 1 = WebSocket.OPEN
      client.send(msg);
    }
  }
}

realtimeEmitter.on('db_updated', async (event) => {
  const db = await getAllData();
  broadcastWs({
    type: 'REALTIME_SYNC',
    trigger: event.type,
    row: event.row || null,
    db,
    timestamp: new Date().toISOString(),
  });
});

// Initialize Supabase if keys exist in .env
initSupabaseClient();

const APP_PASSWORD = process.env.APP_PASSWORD || 'vasco';
const SESSION_TOKEN = Buffer.from(`vasco_auth_session_${APP_PASSWORD}`).toString('base64');

// Lightweight public health check for Render & Keep-Alive Ping Services
app.get(['/health', '/api/health'], (_req, res) => {
  res.status(200).json({ status: 'ok', oracle: 'V.A.S.C.O', uptime: Math.round(process.uptime()) });
});

// Authentication endpoints
app.post(['/api/auth/login', '/auth/login'], (req, res) => {
  const { password } = req.body || {};
  if (password && String(password).trim() === APP_PASSWORD.trim()) {
    return res.json({ ok: true, token: SESSION_TOKEN });
  }
  return res.status(401).json({ ok: false, error: 'Incorrect password' });
});

app.get(['/api/auth/check', '/auth/check'], (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : null;
  if (token === SESSION_TOKEN) {
    return res.json({ ok: true, authenticated: true });
  }
  return res.status(401).json({ ok: false, authenticated: false });
});

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : null;
  if (!token || token !== SESSION_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized: Access password required.' });
  }
  next();
}

app.get(['/api/state', '/state'], requireAuth, async (_req, res) => {
  try {
    const db = await getAllData();
    res.json({
      db,
      mcpTools: VASCO_MCP_TOOL_DEFINITIONS,
      status: {
        supabaseConnected: isSupabaseConfigured(),
        supabaseUrl: process.env.SUPABASE_URL || '',
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
        fitbitConnected: Boolean(process.env.FITBIT_ACCESS_TOKEN?.trim()),
        fitbitAccessToken: process.env.FITBIT_ACCESS_TOKEN || '',
        mcpServerActive: true,
      },
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post(['/api/ingest', '/ingest'], requireAuth, async (req, res) => {
  try {
    const { text, audioBase64, audioMimeType } = req.body as {
      text?: string;
      audioBase64?: string;
      audioMimeType?: string;
    };

    const audioBuffer = audioBase64 ? Buffer.from(audioBase64, 'base64') : undefined;
    const result = await processUserInputWithVascoAgent({
      text,
      audioBuffer,
      audioMimeType,
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post(['/api/log', '/log'], requireAuth, async (req, res) => {
  try {
    const entry = await toolLogExercise(req.body);
    res.json(entry);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post(['/api/health/sync', '/health/sync'], requireAuth, async (req, res) => {
  try {
    const {
      totalSleepDuration,
      deepSleepMinutes,
      remSleepMinutes,
      restingHeartRate,
      hrvMs,
    } = req.body || {};

    const result = await syncGoogleHealthBiometrics({
      totalSleepDuration: totalSleepDuration ? Number(totalSleepDuration) : undefined,
      deepSleepMinutes: deepSleepMinutes ? Number(deepSleepMinutes) : undefined,
      remSleepMinutes: remSleepMinutes ? Number(remSleepMinutes) : undefined,
      restingHeartRate: restingHeartRate ? Number(restingHeartRate) : undefined,
      hrvMs: hrvMs ? Number(hrvMs) : undefined,
    });

    res.json({
      ok: true,
      message: 'Google Health biometrics synced successfully!',
      result,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post(['/api/blueprint', '/blueprint'], requireAuth, async (req, res) => {
  try {
    const bp = await toolUpsertBlueprint(req.body as ExerciseBlueprint);
    res.json(bp);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post(['/api/reset', '/reset'], requireAuth, async (_req, res) => {
  try {
    const db = resetToSeedData();
    res.json({ db });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post(['/api/clear', '/clear'], requireAuth, async (_req, res) => {
  try {
    const db = await clearAllData();
    res.json({ db });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post(['/api/config', '/config'], requireAuth, async (req, res) => {
  try {
    const { geminiApiKey, supabaseUrl, supabaseAnonKey, fitbitAccessToken } = req.body as {
      geminiApiKey?: string;
      supabaseUrl?: string;
      supabaseAnonKey?: string;
      fitbitAccessToken?: string;
    };

    if (geminiApiKey !== undefined) process.env.GEMINI_API_KEY = geminiApiKey.trim();
    if (supabaseUrl !== undefined) {
      process.env.SUPABASE_URL = supabaseUrl.trim();
      process.env.VITE_SUPABASE_URL = supabaseUrl.trim();
    }
    if (supabaseAnonKey !== undefined) {
      process.env.SUPABASE_ANON_KEY = supabaseAnonKey.trim();
      process.env.VITE_SUPABASE_ANON_KEY = supabaseAnonKey.trim();
    }
    if (fitbitAccessToken !== undefined) {
      process.env.FITBIT_ACCESS_TOKEN = fitbitAccessToken.trim();
    }

    const envPath = path.resolve(process.cwd(), '.env');
    const envContent = [
      '# V.A.S.C.O Configuration',
      `GEMINI_API_KEY=${process.env.GEMINI_API_KEY || ''}`,
      `SUPABASE_URL=${process.env.SUPABASE_URL || ''}`,
      `SUPABASE_ANON_KEY=${process.env.SUPABASE_ANON_KEY || ''}`,
      `VITE_SUPABASE_URL=${process.env.SUPABASE_URL || ''}`,
      `VITE_SUPABASE_ANON_KEY=${process.env.SUPABASE_ANON_KEY || ''}`,
      `FITBIT_ACCESS_TOKEN=${process.env.FITBIT_ACCESS_TOKEN || ''}`,
      `PORT=${PORT}`,
      '',
    ].join('\n');
    fs.writeFileSync(envPath, envContent, 'utf-8');

    initSupabaseClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    if (isSupabaseConfigured()) {
      await syncBlueprintsToSupabase();
    }

    res.json({
      ok: true,
      status: {
        supabaseConnected: isSupabaseConfigured(),
        supabaseUrl: process.env.SUPABASE_URL || '',
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
        fitbitConnected: Boolean(process.env.FITBIT_ACCESS_TOKEN?.trim()),
        fitbitAccessToken: process.env.FITBIT_ACCESS_TOKEN || '',
        mcpServerActive: true,
      },
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

// Daily 8:00 AM Automated Sync for Google Health / Wearables
function checkAndAutoSyncDailyHealth() {
  try {
    const now = new Date();
    const dateKey = now.toISOString().slice(0, 10);
    const hour = now.getHours();

    const db = loadLocalDb();
    const hasTodayBiometrics = db.logs.some(
      (l) => l.exercise_id === 'total_sleep_duration' && l.timestamp.startsWith(dateKey)
    );

    // Runs automatically at or after 8:00 AM every morning if not already logged
    if (!hasTodayBiometrics && hour >= 8) {
      console.log(`[V.A.S.C.O. 8:00 AM Scheduler] Auto-syncing daily biometrics (Sleep, Deep, REM, RHR, HRV) for ${dateKey}...`);
      syncGoogleHealthBiometrics();
    }
  } catch (err) {
    console.warn('[V.A.S.C.O. Health Scheduler] Auto-sync check warning:', err);
  }
}

// Check every 15 minutes in the background (local server mode only)
if (!process.env.VERCEL) {
  setInterval(checkAndAutoSyncDailyHealth, 15 * 60 * 1000);
  checkAndAutoSyncDailyHealth();
}

// Serve static production Vite build if dist/ exists
const distPath = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Vercel Cron Endpoint for 8:00 AM Daily Google Health Telemetry Auto-Sync
app.get('/api/health/auto-sync', async (_req, res) => {
  try {
    console.log('[Vercel Cron] 8:00 AM Automated Health Sync Triggered...');
    const result = await syncGoogleHealthBiometrics();
    res.json({ ok: true, message: 'Google Health biometrics auto-synced via Vercel Cron!', result });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

if (!process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log(`🚀 [V.A.S.C.O Server] Listening on http://localhost:${PORT} (WebSocket: ws://localhost:${PORT}/ws)`);
  });
}

export default app;
export { app };
