import React, { useState } from 'react';
import { X, Heart, Moon, Activity, Zap, CheckCircle2, Mic } from 'lucide-react';

interface HealthSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDuration?: number;
  currentDeep?: number;
  currentRem?: number;
  currentRhr?: number;
  currentHrv?: number;
  onSync: (params: {
    totalSleepDuration?: number;
    deepSleepMinutes?: number;
    remSleepMinutes?: number;
    restingHeartRate?: number;
    hrvMs?: number;
  }) => Promise<void>;
}

export const HealthSyncModal: React.FC<HealthSyncModalProps> = ({
  isOpen,
  onClose,
  currentDuration = 7.4,
  currentDeep = 65,
  currentRem = 85,
  currentRhr = 54,
  currentHrv = 60,
  onSync,
}) => {
  const [totalSleepDuration, setTotalSleepDuration] = useState<number>(currentDuration);
  const [deepSleepMinutes, setDeepSleepMinutes] = useState<number>(currentDeep);
  const [remSleepMinutes, setRemSleepMinutes] = useState<number>(currentRem);
  const [restingHeartRate, setRestingHeartRate] = useState<number>(currentRhr);
  const [hrvMs, setHrvMs] = useState<number>(currentHrv);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSync({
        totalSleepDuration: Number(totalSleepDuration),
        deepSleepMinutes: Number(deepSleepMinutes),
        remSleepMinutes: Number(remSleepMinutes),
        restingHeartRate: Number(restingHeartRate),
        hrvMs: Number(hrvMs),
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="vasco-card rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-cyan-500/50 p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-500/40 text-cyan-300">
              <Heart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Google Health Biometrics Sync</h3>
              <p className="text-xs text-slate-400">Sleep stages, Resting Heart Rate & HRV correlation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Total Sleep Duration */}
          <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Moon className="w-3.5 h-3.5 text-cyan-400" />
                Total Sleep Duration
              </label>
              <span className="text-[11px] text-slate-400">Target: 8.5 hours</span>
            </div>
            <div className="flex items-center gap-2 w-32 shrink-0">
              <input
                type="number"
                step="0.1"
                min="0"
                max="16"
                value={totalSleepDuration}
                onChange={(e) => setTotalSleepDuration(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-xl bg-[#090b10] border border-slate-700 text-sm font-bold text-white text-right focus:border-cyan-400 focus:outline-none"
              />
              <span className="text-xs text-slate-400 font-mono">hrs</span>
            </div>
          </div>

          {/* Deep Sleep Minutes */}
          <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Moon className="w-3.5 h-3.5 text-purple-400" />
                Deep Sleep (Restorative)
              </label>
              <span className="text-[11px] text-slate-400">Target: 90 mins</span>
            </div>
            <div className="flex items-center gap-2 w-32 shrink-0">
              <input
                type="number"
                min="0"
                max="300"
                value={deepSleepMinutes}
                onChange={(e) => setDeepSleepMinutes(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-xl bg-[#090b10] border border-slate-700 text-sm font-bold text-white text-right focus:border-purple-400 focus:outline-none"
              />
              <span className="text-xs text-slate-400 font-mono">min</span>
            </div>
          </div>

          {/* REM Sleep Minutes */}
          <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-sky-400" />
                REM Sleep (Mental Recovery)
              </label>
              <span className="text-[11px] text-slate-400">Target: 110 mins</span>
            </div>
            <div className="flex items-center gap-2 w-32 shrink-0">
              <input
                type="number"
                min="0"
                max="300"
                value={remSleepMinutes}
                onChange={(e) => setRemSleepMinutes(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-xl bg-[#090b10] border border-slate-700 text-sm font-bold text-white text-right focus:border-sky-400 focus:outline-none"
              />
              <span className="text-xs text-slate-400 font-mono">min</span>
            </div>
          </div>

          {/* Resting Heart Rate */}
          <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-rose-400" />
                Resting Heart Rate (RHR)
              </label>
              <span className="text-[11px] text-slate-400">Target: 50 bpm (Lower is better)</span>
            </div>
            <div className="flex items-center gap-2 w-32 shrink-0">
              <input
                type="number"
                min="35"
                max="120"
                value={restingHeartRate}
                onChange={(e) => setRestingHeartRate(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-xl bg-[#090b10] border border-slate-700 text-sm font-bold text-white text-right focus:border-rose-400 focus:outline-none"
              />
              <span className="text-xs text-slate-400 font-mono">bpm</span>
            </div>
          </div>

          {/* HRV */}
          <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                Heart Rate Variability (HRV)
              </label>
              <span className="text-[11px] text-slate-400">Target: 75 ms</span>
            </div>
            <div className="flex items-center gap-2 w-32 shrink-0">
              <input
                type="number"
                min="10"
                max="200"
                value={hrvMs}
                onChange={(e) => setHrvMs(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-xl bg-[#090b10] border border-slate-700 text-sm font-bold text-white text-right focus:border-emerald-400 focus:outline-none"
              />
              <span className="text-xs text-slate-400 font-mono">ms</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-800/40 text-[11px] text-slate-300 flex items-start gap-2">
            <Mic className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Tip: You can also say into the mic anytime: <br />
              <code className="text-emerald-300 font-mono">"{totalSleepDuration} hrs sleep, {deepSleepMinutes}m deep, {remSleepMinutes}m rem, resting hr {restingHeartRate}, hrv {hrvMs}"</code>
            </span>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:brightness-110 text-slate-950 font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSubmitting ? 'Syncing...' : 'Sync Biometrics'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
