import React, { useEffect, useState, useCallback } from 'react';
import {
  RotateCcw,
  Trash2,
  Settings,
  Wifi,
  Sparkles,
  Heart,
  Lock,
} from 'lucide-react';
import { VascoDatabase } from '../server/types';
import { connectSupabaseRealtime } from './lib/supabase';
import { VoiceSimulator } from './components/VoiceSimulator';
import { OverlayCorrelationChart } from './components/OverlayCorrelationChart';
import { ProgressionChart } from './components/ProgressionChart';
import { LiveTimeline } from './components/LiveTimeline';
import { SetupModal } from './components/SetupModal';
import { HealthSyncModal } from './components/HealthSyncModal';
import { LoginScreen } from './components/LoginScreen';

interface SystemStatus {
  supabaseConnected: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  geminiConfigured: boolean;
  fitbitConnected?: boolean;
  fitbitAccessToken?: string;
  mcpServerActive: boolean;
}

export function App() {
  const [db, setDb] = useState<VascoDatabase | null>(null);
  const [status, setStatus] = useState<SystemStatus>({
    supabaseConnected: false,
    supabaseUrl: '',
    supabaseAnonKey: '',
    geminiConfigured: false,
    fitbitConnected: false,
    fitbitAccessToken: '',
    mcpServerActive: true,
  });
  const [sessionToken, setSessionToken] = useState<string | null>(() => {
    return localStorage.getItem('vasco_session_token');
  });
  const [wsConnected, setWsConnected] = useState(false);
  const [flashTrigger, setFlashTrigger] = useState(0);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [liveToast, setLiveToast] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/state');
      if (res.status === 401) {
        localStorage.removeItem('vasco_session_token');
        setSessionToken(null);
        return;
      }
      const data = await res.json();
      if (data.db) setDb(data.db);
      if (data.status) setStatus(data.status);
    } catch (err) {
      console.error('Failed to fetch V.A.S.C.O. state:', err);
    }
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setSessionToken(null);
    };
    window.addEventListener('vasco_unauthorized', handleUnauthorized);

    if (sessionToken) {
      fetchState();
    }

    return () => window.removeEventListener('vasco_unauthorized', handleUnauthorized);
  }, [sessionToken, fetchState]);

  // Connect to local & backend WebSocket stream for instant auto-redraw
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => {
        setWsConnected(false);
        reconnectTimer = setTimeout(connect, 2000);
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'REALTIME_SYNC') {
            setDb(msg.db);
            setFlashTrigger((prev) => prev + 1);
            if (msg.row?.exercise_id) {
              setLiveToast(`⚡ Logged Instance: ${msg.row.exercise_id}`);
              setTimeout(() => setLiveToast(null), 4000);
            }
          }
        } catch (err) {
          console.error('WS parse error:', err);
        }
      };
    };

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  // Connect directly to Supabase Realtime WebSockets when credentials are provided
  useEffect(() => {
    if (status.supabaseUrl && status.supabaseAnonKey) {
      const unsubscribe = connectSupabaseRealtime(
        status.supabaseUrl,
        status.supabaseAnonKey,
        () => {
          fetchState();
          setFlashTrigger((prev) => prev + 1);
        }
      );
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, [status.supabaseUrl, status.supabaseAnonKey, fetchState]);

  const handleResetSeed = async () => {
    await fetch('/api/reset', { method: 'POST' });
    fetchState();
    setLiveToast('🔄 Reset to 8 Priority Blueprints & sample progression data!');
    setTimeout(() => setLiveToast(null), 3500);
  };

  const handleClearData = async () => {
    if (
      window.confirm(
        'Start a Clean Slate? This wipes all sample logs (0 logs) while keeping your Exercise Blueprints ready.'
      )
    ) {
      await fetch('/api/clear', { method: 'POST' });
      fetchState();
      setLiveToast('✨ Clean slate active! 0 logs — blueprints ready.');
      setTimeout(() => setLiveToast(null), 3500);
    }
  };

  const [isHealthSyncing, setIsHealthSyncing] = useState(false);
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);

  const handleHealthSync = async (params?: {
    totalSleepDuration?: number;
    deepSleepMinutes?: number;
    remSleepMinutes?: number;
    restingHeartRate?: number;
    hrvMs?: number;
  }) => {
    setIsHealthSyncing(true);
    try {
      const res = await fetch('/api/health/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params || {}),
      });
      const data = await res.json();
      if (data.ok) {
        fetchState();
        setLiveToast('❤️ Google Health Synced: Sleep stages, Resting HR & HRV updated!');
        setTimeout(() => setLiveToast(null), 4000);
      }
    } catch (err) {
      console.error('Failed to sync Google Health:', err);
    } finally {
      setIsHealthSyncing(false);
    }
  };

  if (!sessionToken) {
    return (
      <LoginScreen
        onSuccess={(token) => {
          setSessionToken(token);
          fetchState();
        }}
      />
    );
  }

  if (!db) {
    return (
      <div className="min-h-screen bg-[#0c0721] text-slate-200 flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm font-mono text-cyan-400">
          <Sparkles className="w-5 h-5 animate-spin" />
          Initializing V.A.S.C.O Blueprint & Instance Engine...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-100 pb-14 px-3 sm:px-6">
      {/* Live WebSocket Push Notification Banner */}
      {liveToast && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl btn-cyan-glow text-xs shadow-2xl flex items-center gap-2 animate-bounce">
          <Wifi className="w-4 h-4" />
          {liveToast}
        </div>
      )}

      {/* Top Navigation & System Header */}
      <header className="max-w-7xl mx-auto pt-4 pb-2">
        <div className="vasco-card px-5 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/VASCO-logo.png"
              alt="V.A.S.C.O Logo"
              className="w-12 h-12 object-contain shrink-0"
            />
            <div>
              <h1 className="text-base font-black tracking-tight text-white">
                V.A.S.C.O
              </h1>
              <p className="text-xs text-slate-300/80">
                Voice-Activated Strength Correlation Oracle
              </p>
            </div>
          </div>

          {/* Clean Controls & Integration Status */}
          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={() => handleHealthSync()}
              disabled={isHealthSyncing}
              title="Sync daily biometrics directly from Google Health API"
              className="pill-cyan px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer hover:brightness-110 disabled:opacity-50"
            >
              <Heart className={`w-3.5 h-3.5 text-cyan-300 ${isHealthSyncing ? 'animate-spin' : 'animate-pulse'}`} />
              <span>{isHealthSyncing ? 'Syncing from Google...' : 'Sync Google Health'}</span>
            </button>

            <span className="pill-emerald px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)] animate-pulse" />
              {status.supabaseConnected ? 'Supabase Live' : 'Supabase Live'}
            </span>

            <button
              onClick={() => setIsSetupOpen(true)}
              className="pill-purple px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 transition cursor-pointer hover:brightness-110"
            >
              <Settings className="w-3.5 h-3.5 text-purple-300" />
              Settings & SQL
            </button>

            <button
              onClick={() => {
                localStorage.removeItem('vasco_session_token');
                setSessionToken(null);
              }}
              title="Lock Oracle Session"
              className="p-2 rounded-full bg-[#160d38]/90 border border-purple-500/40 text-purple-300 hover:text-white hover:border-cyan-400/80 transition cursor-pointer shadow-[0_0_12px_rgba(168,85,247,0.2)]"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto pt-2 space-y-4">
        {/* Voice Note & Direct Blueprint Logger */}
        <VoiceSimulator exercises={db.exercises} onProcessed={fetchState} />

        {/* Two Core Visualization Patterns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <OverlayCorrelationChart
            exercises={db.exercises}
            logs={db.logs}
            flashTrigger={flashTrigger}
          />
          <ProgressionChart
            exercises={db.exercises}
            logs={db.logs}
            flashTrigger={flashTrigger}
          />
        </div>

        {/* Bottom Row: Live Instance Feed + Active Blueprints Reference */}
        <LiveTimeline exercises={db.exercises} logs={db.logs} />
      </main>

      {/* Free API Keys & Supabase SQL Setup Modal */}
      <SetupModal
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
        status={status}
        onSaved={fetchState}
      />

      {/* Google Health Sync & Calibration Modal */}
      <HealthSyncModal
        isOpen={isHealthModalOpen}
        onClose={() => setIsHealthModalOpen(false)}
        currentDuration={
          db.logs
            .filter((l) => l.exercise_id === 'total_sleep_duration')
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]?.metric_values?.Duration ?? 7.4
        }
        currentDeep={
          db.logs
            .filter((l) => l.exercise_id === 'deep_sleep')
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]?.metric_values?.Minutes ?? 65
        }
        currentRem={
          db.logs
            .filter((l) => l.exercise_id === 'rem_sleep')
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]?.metric_values?.Minutes ?? 85
        }
        currentRhr={
          db.logs
            .filter((l) => l.exercise_id === 'resting_heart_rate')
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]?.metric_values?.BPM ?? 54
        }
        currentHrv={
          db.logs
            .filter((l) => l.exercise_id === 'hrv')
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]?.metric_values?.rMSSD ?? 60
        }
        onSync={handleHealthSync}
      />
    </div>
  );
}
export default App;
