import React, { useState } from 'react';
import { X, Key, Database, CheckCircle2, Copy, Check, ExternalLink, RotateCcw, Trash2, AlertTriangle, Zap } from 'lucide-react';

interface SetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: {
    supabaseConnected: boolean;
    supabaseUrl: string;
    supabaseAnonKey: string;
    geminiConfigured: boolean;
    fitbitConnected?: boolean;
    googlePermanentSync?: boolean;
    fitbitAccessToken?: string;
  };
  onSaved: () => void;
}

const SUPABASE_SQL_SNIPPET = `create extension if not exists "uuid-ossp";

-- 1. EXERCISE BLUEPRINTS TABLE
create table if not exists public.exercises (
  id text primary key,
  name text not null,
  category text not null default 'calisthenics',
  is_active_focus boolean not null default true,
  metrics jsonb not null default '[]'::jsonb,
  modifier jsonb default null,
  created_at timestamptz not null default now()
);

-- 2. LOGS TABLE (Decoupled Instances)
create table if not exists public.logs (
  id text primary key,
  exercise_id text not null references public.exercises(id) on delete cascade,
  timestamp timestamptz not null default now(),
  metric_values jsonb not null default '{}'::jsonb,
  modifier_value text default null,
  session_tags jsonb not null default '[]'::jsonb,
  notes text,
  raw_transcript text
);

alter table public.exercises enable row level security;
alter table public.logs enable row level security;

drop policy if exists "Allow public read/write on exercises" on public.exercises;
create policy "Allow public read/write on exercises" on public.exercises for all using (true) with check (true);

drop policy if exists "Allow public read/write on logs" on public.logs;
create policy "Allow public read/write on logs" on public.logs for all using (true) with check (true);

alter publication supabase_realtime add table public.exercises, public.logs;`;

export const SetupModal: React.FC<SetupModalProps> = ({
  isOpen,
  onClose,
  status,
  onSaved,
}) => {
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [supabaseUrl, setSupabaseUrl] = useState(status.supabaseUrl || '');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(status.supabaseAnonKey || '');
  const [fitbitAccessToken, setFitbitAccessToken] = useState(status.fitbitAccessToken || '');
  const [saving, setSaving] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMessage(null);
    try {
      const payload: Record<string, string> = {};
      if (geminiApiKey.trim()) payload.geminiApiKey = geminiApiKey.trim();
      if (supabaseUrl.trim()) payload.supabaseUrl = supabaseUrl.trim();
      if (supabaseAnonKey.trim()) payload.supabaseAnonKey = supabaseAnonKey.trim();
      if (fitbitAccessToken.trim()) payload.fitbitAccessToken = fitbitAccessToken.trim();

      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        setSaveMessage('Configuration saved to .env and services hot-reloaded!');
        onSaved();
      }
    } catch (err) {
      setSaveMessage(`Error saving configuration: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SNIPPET);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="vasco-card rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-purple-500/60 p-6">
        <div className="flex items-center justify-between pb-4 border-b border-purple-500/30">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-emerald-400" />
              V.A.S.C.O Cloud & Database Setup (100% Free Tier)
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Connect Gemini Multimodal AI and Supabase Realtime WebSockets
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-purple-900/40 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* 1. Gemini API Key */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                1. Google Gemini API Key (Voice & MCP Tool Calling)
                {status.geminiConfigured && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/20 text-emerald-300">
                    <CheckCircle2 className="w-3 h-3" /> Active
                  </span>
                )}
              </label>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
              >
                Google AI Studio <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              placeholder={status.geminiConfigured ? '•••••••••••••••••••••••• (Configured)' : 'Paste Gemini API Key...'}
              className="w-full px-3 py-2 rounded-lg bg-[#090b10] border border-slate-700 text-sm text-white focus:border-emerald-500 focus:outline-none font-mono"
            />
          </div>

          {/* 2. Supabase PostgreSQL + Realtime */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                2. Supabase Project URL & Anon Key (Blueprint & Instance Schema)
                {status.supabaseConnected && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/20 text-emerald-300">
                    <CheckCircle2 className="w-3 h-3" /> Connected
                  </span>
                )}
              </label>
              <button
                type="button"
                onClick={handleCopySql}
                className="text-xs px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedSql ? 'Copied SQL Schema!' : 'Copy Supabase SQL Schema'}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-slate-400 block mb-1">Project URL</span>
                <input
                  type="text"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://xyzcompany.supabase.co"
                  className="w-full px-3 py-2 rounded-lg bg-[#090b10] border border-slate-700 text-sm text-white focus:border-emerald-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <span className="text-xs text-slate-400 block mb-1">Anon Public Key</span>
                <input
                  type="password"
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                  className="w-full px-3 py-2 rounded-lg bg-[#090b10] border border-slate-700 text-sm text-white focus:border-emerald-500 focus:outline-none font-mono"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              Full SQL migration is also saved in <code className="text-emerald-300">supabase/schema.sql</code>.
            </p>
          </div>

          {/* 3. Google Health / Fitbit Cloud Sync */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                3. Google Health & Fitbit Cloud Sync
                {status.fitbitConnected && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/20 text-emerald-300">
                    <CheckCircle2 className="w-3 h-3" /> {status.googlePermanentSync ? 'Permanent Cloud Sync Active' : 'Connected'}
                  </span>
                )}
              </label>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-xl bg-[#090b10] border border-cyan-500/30">
              <div className="space-y-0.5 text-left w-full">
                <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  Hands-Free Google Cloud OAuth
                </div>
                <p className="text-[11px] text-slate-400">
                  Direct connection with Google Health. Syncs Sleep, Deep, REM, Resting HR & HRV automatically.
                </p>
              </div>
              <a
                href="/api/auth/google"
                className="w-full sm:w-auto px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shrink-0 transition flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer text-center"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {status.fitbitConnected ? 'Re-link Google Account' : 'Connect Google Health'}
              </a>
            </div>

            <details className="text-[11px] text-slate-400 pt-1">
              <summary className="cursor-pointer text-slate-400 hover:text-slate-300">Advanced: Manual Token Override</summary>
              <div className="pt-2 space-y-1.5">
                <input
                  type="password"
                  value={fitbitAccessToken}
                  onChange={(e) => setFitbitAccessToken(e.target.value)}
                  placeholder={status.fitbitConnected ? '•••••••••••••••••••••••• (Managed automatically via OAuth)' : 'Paste manual access token if needed...'}
                  className="w-full px-3 py-2 rounded-lg bg-[#090b10] border border-slate-700 text-xs text-white focus:border-cyan-500 focus:outline-none font-mono"
                />
              </div>
            </details>
          </div>

          {/* 4. Safeguarded Data Maintenance */}
          <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/40 space-y-3">
            <div className="flex items-center gap-2 text-rose-300 text-xs font-semibold uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Database Safeguards & Reset Zone</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              These destructive developer actions have been safely moved here to prevent accidental clicks on your live dashboard.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm('⚠️ Reset to baseline sample data? This will overwrite existing workout and sleep logs.')) {
                    await fetch('/api/reset', { method: 'POST' });
                    onSaved();
                    alert('Database has been reset to baseline.');
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-purple-500/40 text-purple-300 hover:text-white text-xs font-mono flex items-center gap-1.5 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Sample Progression
              </button>
              <button
                type="button"
                onClick={async () => {
                  const confirmation = window.prompt('⚠️ WARNING: To permanently erase all workout and sleep logs, type "DELETE":');
                  if (confirmation === 'DELETE') {
                    await fetch('/api/clear', { method: 'POST' });
                    onSaved();
                    alert('All logs wiped. Blueprints preserved.');
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-700/60 text-rose-300 hover:text-rose-100 text-xs font-mono flex items-center gap-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Wipe All Logs (Clean Slate)
              </button>
            </div>
          </div>

          {saveMessage && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
              {saveMessage}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-700 text-sm text-slate-300 hover:bg-slate-800 transition cursor-pointer"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Saving & Syncing...' : 'Save & Activate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
