import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Square,
  Send,
  Sparkles,
  Clock,
  Volume2,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { ExecutedToolCall, ExerciseBlueprint, SessionTag } from '../../server/types';

interface VoiceSimulatorProps {
  exercises: ExerciseBlueprint[];
  onProcessed: () => void;
}

export const VoiceSimulator: React.FC<VoiceSimulatorProps> = ({
  exercises,
  onProcessed,
}) => {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [speechRecognizedText, setSpeechRecognizedText] = useState<string>('');
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const [lastExecutedTools, setLastExecutedTools] = useState<ExecutedToolCall[]>([]);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [oracleReply, setOracleReply] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showQuickManual, setShowQuickManual] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>(
    () => localStorage.getItem('vasco_tts_voice') || ''
  );
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [manualDateYesterday, setManualDateYesterday] = useState(false);

  // Quick manual log state
  const [manualExId, setManualExId] = useState('muscle_up_transition_pulses');
  const [manualMetric1, setManualMetric1] = useState('10');
  const [manualMetric2, setManualMetric2] = useState('5');
  const [manualModifier, setManualModifier] = useState('5');
  const [manualTag, setManualTag] = useState<SessionTag>('Fresh');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);
  const chunksRef = useRef<Blob[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChipClick = (text: string) => {
    setInputText(text);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const len = text.length;
        inputRef.current.setSelectionRange(len, len);
      }
    }, 50);
  };

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;

    const populateVoices = () => {
      const all = window.speechSynthesis.getVoices();
      if (!all || all.length === 0) return;

      // Filter for English voices (or all if none found)
      const en = all.filter((v) => v.lang.startsWith('en'));
      const list = en.length > 0 ? en : all;

      // Priority scoring: enhanced / natural / neural voices to the top
      const sorted = [...list].sort((a, b) => {
        const score = (v: SpeechSynthesisVoice) => {
          let s = 0;
          const n = v.name.toLowerCase();
          if (n.includes('enhanced')) s += 10;
          if (n.includes('premium')) s += 9;
          if (n.includes('natural')) s += 8;
          if (n.includes('daniel')) s += 6; // macOS British favorite
          if (n.includes('samantha')) s += 5; // macOS US favorite
          if (n.includes('oliver') || n.includes('ava') || n.includes('serena') || n.includes('karen')) s += 4;
          if (n.includes('google')) s += 3;
          if (v.default) s += 1;
          return s;
        };
        return score(b) - score(a);
      });

      setVoices(sorted);

      const saved = localStorage.getItem('vasco_tts_voice');
      if (saved && sorted.some((v) => v.voiceURI === saved)) {
        setSelectedVoiceURI(saved);
      } else if (sorted.length > 0) {
        setSelectedVoiceURI(sorted[0].voiceURI);
      }
    };

    populateVoices();
    window.speechSynthesis.onvoiceschanged = populateVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setSpeechRecognizedText(currentTranscript);
        setInputText(currentTranscript);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const runIngest = async (payload: {
    text?: string;
    audioBase64?: string;
    audioMimeType?: string;
  }) => {
    setIsProcessing(true);
    const t0 = performance.now();
    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      const elapsed = Math.round(performance.now() - t0);
      setLastLatencyMs(elapsed);
      setLastExecutedTools(data.executedTools || []);
      setLastTranscript(data.transcript || payload.text || null);
      if (data.replyText) {
        setOracleReply(data.replyText);
        setInputText('');
      }
      if (data.executedTools && data.executedTools.length > 0) {
        setInputText('');
        onProcessed();
      }
    } catch (err) {
      console.error('Ingest error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSpeakOracle = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    if (selectedVoiceURI) {
      const chosen = voices.find((v) => v.voiceURI === selectedVoiceURI);
      if (chosen) utterance.voice = chosen;
    }
    utterance.rate = speechRate;
    utterance.pitch = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isProcessing) return;
    await runIngest({ text: inputText.trim() });
  };

  const startRecording = async () => {
    try {
      setSpeechRecognizedText('');
      setInputText('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        stream.getTracks().forEach((t) => t.stop());

        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64data = (reader.result as string).split(',')[1];
          const finalPrompt = speechRecognizedText.trim() || inputText.trim();
          await runIngest({
            text: finalPrompt || undefined,
            audioBase64: base64data,
            audioMimeType: blob.type || 'audio/webm',
          });
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch {
          // ignore
        }
      }
      setIsRecording(true);
    } catch (err) {
      alert('Microphone access was denied or is unavailable.');
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const selectedBlueprint = exercises.find((e) => e.id === manualExId) || exercises[0];

  const handleManualLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBlueprint) return;
    setIsProcessing(true);
    const t0 = performance.now();
    try {
      const metric_values: Record<string, number> = {};
      if (selectedBlueprint.metrics[0]) {
        metric_values[selectedBlueprint.metrics[0].name] = Number(manualMetric1);
      }
      if (selectedBlueprint.metrics[1]) {
        metric_values[selectedBlueprint.metrics[1].name] = Number(manualMetric2);
      }

      const manualTimestamp = manualDateYesterday
        ? new Date(Date.now() - 86400000).toISOString()
        : undefined;

      const res = await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exercise_id: selectedBlueprint.id,
          metric_values,
          modifier_value: manualModifier,
          session_tags: [manualTag],
          timestamp: manualTimestamp,
          raw_transcript: `Direct Blueprint Log: ${selectedBlueprint.name}${manualDateYesterday ? ' (Yesterday)' : ''}`,
        }),
      });
      const entry = await res.json();
      setLastLatencyMs(Math.round(performance.now() - t0));
      setLastExecutedTools([
        {
          tool: 'log_exercise',
          args: {
            exercise_id: selectedBlueprint.id,
            metric_values,
            modifier_value: manualModifier,
            session_tags: [manualTag],
          },
          result: entry,
        },
      ]);
      onProcessed();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="vasco-card p-4 sm:p-5 shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-400/60 flex items-center justify-center text-cyan-300 shadow-[0_0_16px_rgba(6,182,212,0.45)]">
            <Volume2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">
              VOICE & TEXT LOGGING
            </h2>
            <p className="text-xs text-slate-300/80">
              Speak or type your workout sets (e.g. "16s muscle up transition light band, 12 fat grip pullups, felt fresh")
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {lastLatencyMs !== null && (
            <div className="pill-emerald px-2.5 py-1 rounded-full text-[11px] font-mono flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              <span>{(lastLatencyMs / 1000).toFixed(2)}s</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowQuickManual((prev) => !prev)}
            className="pill-purple px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer hover:brightness-110"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-purple-300" />
            <span>{showQuickManual ? 'Hide Form' : 'Manual Form'}</span>
          </button>
        </div>
      </div>

      {/* Voice Note Input / Mic Recorder */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              isRecording
                ? '🎙️ Listening in real-time... Speak your workout sets, biometrics, or ask a question now!'
                : "Speak or type sets or ask questions (e.g. 'Should I push for a PR today?', '16 dips bodyweight')..."
            }
            className={`w-full px-5 py-3 rounded-full text-sm text-white placeholder-slate-400/80 focus:outline-none transition vasco-input-glow ${
              isRecording ? 'border-rose-500 ring-2 ring-rose-500/40 text-rose-100' : ''
            }`}
          />
        </div>

        <div className="flex items-center gap-2">
          {!isRecording ? (
            <button
              type="button"
              onClick={startRecording}
              disabled={isProcessing}
              className="pill-purple px-5 py-3 rounded-full text-xs font-semibold flex items-center gap-2 transition cursor-pointer hover:brightness-110"
            >
              <Mic className="w-4 h-4 text-purple-300" />
              <span>Record Mic</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              className="pill-rose px-5 py-3 rounded-full text-xs font-bold flex items-center gap-2 animate-pulse cursor-pointer shadow-lg shadow-rose-600/40"
            >
              <Square className="w-4 h-4" />
              <span>Done (Submit)</span>
            </button>
          )}

          <button
            type="submit"
            disabled={isProcessing || !inputText.trim()}
            className="btn-cyan-glow px-7 py-3 rounded-full text-xs tracking-wider uppercase flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
          >
            {isProcessing ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin" />
                <span>Thinking...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>SUBMIT / ASK</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Suggested Oracle Questions */}
      <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-purple-500/20">
        <span className="text-[11px] font-mono text-cyan-400 flex items-center gap-1.5 shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
          Ask Oracle:
        </span>
        <button
          type="button"
          onClick={() => handleChipClick('Based on my biometrics today, should I push hard for a PR or take it easy?')}
          className="text-[11px] px-3 py-1 rounded-full bg-[#110b29] hover:bg-[#1a113d] text-slate-300 hover:text-white border border-purple-500/40 hover:border-cyan-400/60 transition cursor-pointer"
        >
          ⚡ Should I push for a PR today?
        </button>
        <button
          type="button"
          onClick={() => handleChipClick('Why did I struggle in my last workout?')}
          className="text-[11px] px-3 py-1 rounded-full bg-[#110b29] hover:bg-[#1a113d] text-slate-300 hover:text-white border border-purple-500/40 hover:border-cyan-400/60 transition cursor-pointer"
        >
          🔍 Why did I struggle?
        </button>
        <button
          type="button"
          onClick={() => handleChipClick('How does my deep sleep correlate with my strength on [exercise]?')}
          className="text-[11px] px-3 py-1 rounded-full bg-[#110b29] hover:bg-[#1a113d] text-slate-300 hover:text-white border border-purple-500/40 hover:border-cyan-400/60 transition cursor-pointer"
        >
          🧠 Deep sleep correlation insight
        </button>
        <button
          type="button"
          onClick={() => handleChipClick("Yesterday's workout: ")}
          className="text-[11px] px-3 py-1 rounded-full bg-[#110b29] hover:bg-[#1a113d] text-emerald-300 hover:text-white border border-emerald-500/40 hover:border-emerald-400/60 transition cursor-pointer"
        >
          📅 Log yesterday's training
        </button>
      </div>

      {/* Oracle Coaching Insight Card */}
      {oracleReply && (
        <div className="mt-3.5 p-4 rounded-2xl bg-gradient-to-r from-[#170a38]/90 to-[#0e1629]/90 border border-cyan-400/60 shadow-[0_0_24px_rgba(6,182,212,0.25)] space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-300 border border-cyan-500/40">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-white tracking-wide">
                V.A.S.C.O. ORACLE COACHING INSIGHT
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSpeakOracle(oracleReply)}
                className="px-2.5 py-1 rounded-full bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 hover:text-white text-[11px] font-mono flex items-center gap-1.5 transition cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>{isSpeaking ? 'Stop Audio' : 'Listen'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                className="px-2 py-1 rounded-full bg-slate-800/80 hover:bg-slate-750 border border-slate-700 text-slate-300 hover:text-white text-[11px] font-mono flex items-center gap-1 transition cursor-pointer"
                title="Voice & Speed Settings"
              >
                <SlidersHorizontal className="w-3 h-3 text-cyan-400" />
                <span className="max-w-[100px] truncate text-[10px]">
                  {voices.find((v) => v.voiceURI === selectedVoiceURI)?.name?.split(' ')[0] || 'Voice'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                  setIsSpeaking(false);
                  setOracleReply(null);
                }}
                className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Voice Settings Popdown */}
          {showVoiceSettings && (
            <div className="p-2.5 rounded-xl bg-slate-900/95 border border-cyan-500/30 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div>
                <label className="text-[10px] font-mono uppercase text-cyan-300/80 block mb-1">
                  TTS Voice (Free System Neural)
                </label>
                <select
                  value={selectedVoiceURI}
                  onChange={(e) => {
                    setSelectedVoiceURI(e.target.value);
                    localStorage.setItem('vasco_tts_voice', e.target.value);
                  }}
                  className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                >
                  {voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-cyan-300/80 block mb-1">
                  Pacing ({speechRate}x)
                </label>
                <input
                  type="range"
                  min="0.8"
                  max="1.3"
                  step="0.05"
                  value={speechRate}
                  onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                  className="w-full mt-1 accent-cyan-400 cursor-pointer"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => handleSpeakOracle("Ready to train, Vasco. Let's analyze your biometric correlations.")}
                  className="w-full px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-mono transition cursor-pointer"
                >
                  Preview Voice
                </button>
              </div>
            </div>
          )}

          <p className="text-xs text-slate-200 leading-relaxed font-sans">
            {oracleReply}
          </p>
        </div>
      )}

      {/* Optional Direct Blueprint Form */}
      {showQuickManual && selectedBlueprint && (
        <form
          onSubmit={handleManualLog}
          className="mt-3 p-3.5 rounded-xl bg-[#090b10] border border-slate-800 grid grid-cols-1 sm:grid-cols-6 gap-3 items-end"
        >
          <div>
            <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
              Date
            </label>
            <button
              type="button"
              onClick={() => setManualDateYesterday(!manualDateYesterday)}
              className={`w-full px-2 py-2 rounded-lg border text-xs font-mono transition cursor-pointer ${
                manualDateYesterday
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                  : 'bg-[#11151f] border-slate-700 text-slate-300'
              }`}
            >
              {manualDateYesterday ? 'Yesterday' : 'Today'}
            </button>
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
              Exercise
            </label>
            <select
              value={manualExId}
              onChange={(e) => {
                setManualExId(e.target.value);
                const bp = exercises.find((x) => x.id === e.target.value);
                if (bp?.modifier?.options?.[0] !== undefined) {
                  setManualModifier(String(bp.modifier.options[0]));
                }
              }}
              className="w-full px-2.5 py-2 rounded-lg bg-[#11151f] border border-slate-700 text-xs text-white"
            >
              {exercises.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
              {selectedBlueprint.metrics[0]?.name} ({selectedBlueprint.metrics[0]?.unit})
            </label>
            <input
              type="number"
              step="0.5"
              value={manualMetric1}
              onChange={(e) => setManualMetric1(e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg bg-[#11151f] border border-slate-700 text-xs text-white font-mono"
            />
          </div>

          {selectedBlueprint.metrics[1] ? (
            <div>
              <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                {selectedBlueprint.metrics[1].name} ({selectedBlueprint.metrics[1].unit})
              </label>
              <input
                type="number"
                step="1"
                value={manualMetric2}
                onChange={(e) => setManualMetric2(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg bg-[#11151f] border border-slate-700 text-xs text-white font-mono"
              />
            </div>
          ) : (
            <div>
              <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                {selectedBlueprint.modifier?.name || 'Modifier'}
              </label>
              <select
                value={manualModifier}
                onChange={(e) => setManualModifier(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg bg-[#11151f] border border-slate-700 text-xs text-white"
              >
                {(selectedBlueprint.modifier?.options || ['None']).map((opt) => (
                  <option key={String(opt)} value={String(opt)}>
                    {String(opt)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
              Session Tag
            </label>
            <select
              value={manualTag}
              onChange={(e) => setManualTag(e.target.value as SessionTag)}
              className="w-full px-2.5 py-2 rounded-lg bg-[#11151f] border border-slate-700 text-xs text-white"
            >
              <option value="Fresh">Fresh</option>
              <option value="Sore">Sore</option>
            </select>
          </div>

          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
          >
            + Add Set
          </button>
        </form>
      )}

      {/* Direct Blueprint Form closed */}
    </div>
  );
};
