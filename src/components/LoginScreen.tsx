import React, { useState, useEffect, useRef } from 'react';
import { Lock, ArrowRight, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';

interface LoginScreenProps {
  onSuccess: (token: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || loading) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem('vasco_session_token', data.token);
        onSuccess(data.token);
      } else {
        setError(data.error || 'Incorrect password. Access denied.');
        setPassword('');
        inputRef.current?.focus();
      }
    } catch {
      setError('Unable to reach server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden select-none">
      {/* Background Ambient Glow Orbs matching main app */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md mx-auto">
        <div className="vasco-card p-8 sm:p-10 shadow-[0_0_60px_rgba(168,85,247,0.35)] flex flex-col items-center text-center">
          
          {/* Animated Rotating GIF in Large Size */}
          <div className="relative mb-6">
            <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-purple-500/30 to-cyan-500/30 blur-xl opacity-75" />
            <img
              src="/log-in-logo-rotating.gif"
              alt="V.A.S.C.O. Rotating Core"
              className="relative w-48 h-48 sm:w-56 sm:h-56 object-contain rounded-3xl drop-shadow-[0_0_30px_rgba(168,85,247,0.6)]"
            />
          </div>

          {/* Title & Description */}
          <h1 className="text-2xl sm:text-3xl font-black tracking-wider text-white uppercase drop-shadow-[0_0_20px_rgba(168,85,247,0.8)]">
            V.A.S.C.O.
          </h1>
          <p className="text-xs font-mono text-cyan-300/90 tracking-widest uppercase mt-1">
            Voice-Activated Strength Correlation Oracle
          </p>

          <p className="text-xs text-slate-300/80 mt-3 max-w-xs leading-relaxed">
            Personal biomechanical & recovery telemetry archive. Enter access password to decrypt dashboard.
          </p>

          {/* Password Form */}
          <form onSubmit={handleLogin} className="w-full mt-6 space-y-4">
            <div className="relative">
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Enter password..."
                disabled={loading}
                className={`w-full pl-5 pr-12 py-3.5 rounded-2xl text-sm text-white placeholder-slate-400/80 focus:outline-none transition vasco-input-glow font-mono ${
                  error ? 'border-rose-500 ring-2 ring-rose-500/40 text-rose-100' : ''
                }`}
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-300 transition cursor-pointer p-1"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-center justify-center gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="w-full btn-cyan-glow py-3.5 rounded-2xl text-xs font-extrabold tracking-wider uppercase flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer shadow-lg shadow-cyan-500/20"
            >
              {loading ? (
                <span>Decrypting & Authenticating...</span>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Unlock Oracle</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Safeguard Footer */}
          <div className="mt-6 pt-4 border-t border-purple-500/20 flex items-center justify-center gap-1.5 text-[11px] font-mono text-purple-300/70">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>End-to-end encrypted biometric telemetry</span>
          </div>

        </div>
      </div>
    </div>
  );
};
