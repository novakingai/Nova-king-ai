import React from 'react';
import { AssistantState } from '../services/audioStreamer';
import { Sparkles, Mic, Volume2, AlertCircle, RefreshCw } from 'lucide-react';

interface AudioOrbProps {
  state: AssistantState;
  inputVolume: number;
  outputVolume: number;
  onClick: () => void;
}

export const AudioOrb: React.FC<AudioOrbProps> = ({ state, inputVolume, outputVolume, onClick }) => {
  // Compute dynamic scale based on volume and state
  const isListening = state === 'LISTENING';
  const isSpeaking = state === 'SPEAKING';
  const isConnecting = state === 'CONNECTING';
  const isError = state === 'ERROR';

  const audioScale = isListening
    ? 1 + Math.min(inputVolume * 0.45, 0.45)
    : isSpeaking
    ? 1 + Math.min(0.25 + Math.random() * 0.15, 0.4)
    : 1;

  // Color schemes for states
  let coreBg = 'from-violet-600/80 via-fuchsia-600/70 to-pink-500/80';
  let glowColor = 'rgba(217, 70, 239, 0.35)';
  let borderColor = 'border-fuchsia-400/40';

  if (isListening) {
    coreBg = 'from-cyan-500/80 via-blue-600/70 to-indigo-600/80';
    glowColor = 'rgba(6, 182, 212, 0.45)';
    borderColor = 'border-cyan-400/50';
  } else if (isSpeaking) {
    coreBg = 'from-rose-500/85 via-pink-600/80 to-purple-600/85';
    glowColor = 'rgba(244, 63, 94, 0.55)';
    borderColor = 'border-rose-400/60';
  } else if (isConnecting) {
    coreBg = 'from-amber-500/70 via-indigo-600/70 to-cyan-500/70';
    glowColor = 'rgba(245, 158, 11, 0.35)';
    borderColor = 'border-amber-400/40';
  } else if (isError) {
    coreBg = 'from-red-600/80 via-rose-700/70 to-orange-600/80';
    glowColor = 'rgba(239, 68, 68, 0.45)';
    borderColor = 'border-red-400/50';
  }

  return (
    <div className="relative flex flex-col items-center justify-center my-6 select-none">
      {/* Outer ambient glow */}
      <div
        className="absolute rounded-full transition-all duration-300 pointer-events-none"
        style={{
          width: `${260 * audioScale}px`,
          height: `${260 * audioScale}px`,
          backgroundColor: glowColor,
          filter: 'blur(50px)',
          opacity: isConnecting ? 0.4 : isListening || isSpeaking ? 0.9 : 0.4,
        }}
      />

      {/* Ripple ring for Listening / Speaking */}
      {(isListening || isSpeaking) && (
        <div
          className={`absolute rounded-full border ${borderColor} animate-ripple pointer-events-none`}
          style={{ width: '220px', height: '220px' }}
        />
      )}

      {/* Orbital rotating ring during connecting */}
      {isConnecting && (
        <div className="absolute w-56 h-56 rounded-full border-2 border-dashed border-cyan-400/40 animate-spin-slow pointer-events-none" />
      )}

      {/* Main Interactive Orb */}
      <button
        type="button"
        onClick={onClick}
        aria-label={
          state === 'IDLE'
            ? 'Start Arushi voice session'
            : state === 'ERROR'
            ? 'Retry connection'
            : 'Stop Arushi voice session'
        }
        className="group relative cursor-pointer focus:outline-none transition-transform duration-200 active:scale-95"
        style={{
          transform: `scale(${audioScale})`,
        }}
      >
        {/* Outer glass boundary */}
        <div
          className={`w-44 h-44 sm:w-52 sm:h-52 rounded-full p-2.5 transition-all duration-500 border ${borderColor} shadow-2xl backdrop-blur-md flex items-center justify-center`}
          style={{
            boxShadow: `0 0 40px ${glowColor}, inset 0 0 25px rgba(255,255,255,0.15)`,
            background: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.12), rgba(0,0,0,0.6) 80%)',
          }}
        >
          {/* Inner pulsating core */}
          <div
            className={`w-full h-full rounded-full bg-gradient-to-br ${coreBg} p-1 flex flex-col items-center justify-center relative overflow-hidden transition-all duration-500 shadow-inner`}
          >
            {/* Shimmer light effect */}
            <div className="absolute -top-10 -left-10 w-28 h-28 bg-white/20 rounded-full blur-xl pointer-events-none" />

            {/* Central icon & label */}
            <div className="z-10 flex flex-col items-center justify-center text-white text-center">
              {isConnecting ? (
                <RefreshCw className="w-10 h-10 animate-spin text-cyan-200" />
              ) : isSpeaking ? (
                <div className="flex items-center gap-1.5 h-10">
                  <span className="w-1.5 h-6 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-9 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-12 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="w-1.5 h-8 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                </div>
              ) : isListening ? (
                <div className="flex flex-col items-center">
                  <Mic className="w-11 h-11 text-cyan-200 animate-pulse" />
                  <span className="text-[11px] font-semibold tracking-wider uppercase text-cyan-200 mt-1">Listening</span>
                </div>
              ) : isError ? (
                <div className="flex flex-col items-center">
                  <AlertCircle className="w-11 h-11 text-rose-200" />
                  <span className="text-[11px] font-semibold tracking-wider uppercase text-rose-200 mt-1">Error • Tap</span>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Sparkles className="w-10 h-10 text-pink-200 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-semibold tracking-wider uppercase text-pink-200/90 mt-1">Tap to Talk</span>
                </div>
              )}
            </div>

            {/* Subtle waveform grid in background */}
            <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px]" />
          </div>
        </div>
      </button>

      {/* State Badge below Orb */}
      <div className="mt-5 flex items-center gap-2 px-4 py-1.5 rounded-full glass-card border border-white/10 text-xs font-medium tracking-wide">
        <span
          className={`w-2 h-2 rounded-full ${
            isSpeaking
              ? 'bg-rose-400 animate-ping'
              : isListening
              ? 'bg-cyan-400 animate-pulse'
              : isConnecting
              ? 'bg-amber-400 animate-bounce'
              : isError
              ? 'bg-red-500'
              : 'bg-slate-400'
          }`}
        />
        <span className="text-slate-200 font-medium">
          {isSpeaking
            ? 'Arushi is Speaking'
            : isListening
            ? 'Arushi is Listening...'
            : isConnecting
            ? 'Connecting to Gemini Live...'
            : isError
            ? 'Connection Error'
            : 'Arushi is Idle'}
        </span>
      </div>
    </div>
  );
};
