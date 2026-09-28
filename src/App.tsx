import React, { useState, useEffect, useRef } from 'react';
import { audioStreamer, AssistantState, DiagnosticLog } from './services/audioStreamer';
import { liveClient, TranscriptEntry } from './services/liveClient';
import { deviceBridge, ActionResult, Contact } from './services/deviceBridge';
import { AudioOrb } from './components/AudioOrb';
import { ActionHistory } from './components/ActionHistory';
import { DiagnosticDrawer } from './components/DiagnosticDrawer';
import { ContactsModal } from './components/ContactsModal';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Smartphone,
  Globe,
  Terminal,
  Users,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  Languages,
  PhoneCall,
  Play,
  RotateCcw,
} from 'lucide-react';

export default function App() {
  const [state, setState] = useState<AssistantState>(audioStreamer.getState());
  const [inputVolume, setInputVolume] = useState<number>(0);
  const [outputVolume, setOutputVolume] = useState<number>(0);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [actions, setActions] = useState<ActionResult[]>([]);
  const [logs, setLogs] = useState<DiagnosticLog[]>([]);
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState<boolean>(false);
  const [isContactsOpen, setIsContactsOpen] = useState<boolean>(false);
  const [speakerTestResult, setSpeakerTestResult] = useState<string | null>(null);
  const [isTestingSpeaker, setIsTestingSpeaker] = useState<boolean>(false);
  const [isNative, setIsNative] = useState<boolean>(false);

  const transcriptsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsNative(deviceBridge.isNativeAndroid());

    // Listen to streamer events
    const unsubState = audioStreamer.onStateChange((newState) => {
      setState(newState);
    });

    const unsubVol = audioStreamer.onVolumeChange(({ input, output }) => {
      setInputVolume(input);
      setOutputVolume(output);
    });

    const unsubLogs = audioStreamer.onLog((log) => {
      setLogs((prev) => [...prev.slice(-300), log]);
    });

    // Listen to live client events
    liveClient.setEvents({
      onStateChange: (s) => setState(s),
      onTranscript: (entry) => {
        setTranscripts((prev) => {
          // If latest transcript is from same sender within last 1 second, we can merge or append
          return [...prev.slice(-15), entry];
        });
      },
      onAction: (act) => {
        setActions((prev) => [...prev, act]);
      },
      onError: (err) => {
        console.error('App error from liveClient:', err);
      },
    });

    return () => {
      liveClient.stop();
    };
  }, []);

  useEffect(() => {
    transcriptsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  const toggleSession = async () => {
    if (state === 'IDLE' || state === 'ERROR') {
      try {
        await liveClient.start();
      } catch (err) {
        console.error('Failed to start Arushi session', err);
      }
    } else {
      liveClient.stop();
    }
  };

  const handleSpeakerTest = async () => {
    setIsTestingSpeaker(true);
    setSpeakerTestResult(null);
    try {
      const success = await audioStreamer.testSpeaker();
      if (success) {
        setSpeakerTestResult('Tone played successfully (440Hz A4)');
      } else {
        setSpeakerTestResult('Speaker test failed. Check audio permissions.');
      }
    } catch (e: any) {
      setSpeakerTestResult(`Error: ${e?.message || e}`);
    } finally {
      setIsTestingSpeaker(false);
      setTimeout(() => setSpeakerTestResult(null), 4000);
    }
  };

  const handleContactCall = async (contact: Contact) => {
    await deviceBridge.makeCall(contact.phoneNumber);
  };

  const quickPrompts = [
    { label: 'Hello Arushi', lang: 'English' },
    { label: 'WhatsApp kholo', lang: 'Hindi / Hinglish' },
    { label: 'Call Mom', lang: 'English' },
    { label: 'Rahul ko call karo', lang: 'Hinglish' },
    { label: 'Open YouTube', lang: 'English' },
    { label: 'Tum kaisi ho aaj?', lang: 'Hindi' },
  ];

  return (
    <div className="min-h-screen bg-[#050814] text-slate-100 flex flex-col justify-between selection:bg-pink-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="border-b border-white/5 bg-slate-950/60 backdrop-blur-xl sticky top-0 z-40 px-4 py-3 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 via-rose-500 to-violet-600 flex items-center justify-center shadow-lg shadow-pink-500/25">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white font-heading">
                  Arushi
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-300 border border-pink-500/30">
                  Live Voice AI
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Native Gemini Live Audio-to-Audio • Multilingual Voice Assistant
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* Bridge Status Indicator */}
            <div
              className={`hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                isNative
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
              }`}
              title={
                isNative
                  ? 'Connected via Android Native Bridge'
                  : 'Connected via Browser Web Bridge (Safe Deep Links)'
              }
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>{isNative ? 'Android Native Bridge' : 'Browser Web Bridge'}</span>
            </div>

            {/* Speaker Diagnostic Test Button */}
            <button
              onClick={handleSpeakerTest}
              disabled={isTestingSpeaker}
              className="px-3 py-1.5 rounded-xl glass-card hover:bg-slate-800 text-xs font-medium text-slate-200 hover:text-white transition-all flex items-center gap-1.5 border border-white/10"
              title="Test Web Audio output speaker with a 440Hz tone"
            >
              <Volume2 className={`w-3.5 h-3.5 ${isTestingSpeaker ? 'text-amber-400 animate-spin' : 'text-cyan-400'}`} />
              <span className="hidden sm:inline">Test Speaker</span>
            </button>

            {/* Contacts Modal Button */}
            <button
              onClick={() => setIsContactsOpen(true)}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl glass-card hover:bg-slate-800 text-xs font-medium text-slate-200 hover:text-white transition-all flex items-center gap-1.5 border border-white/10"
              title="View contacts address book"
            >
              <Users className="w-4 h-4 text-violet-400" />
              <span className="hidden sm:inline">Contacts</span>
            </button>

            {/* Diagnostics Drawer Button */}
            <button
              onClick={() => setIsDiagnosticOpen(true)}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl glass-card hover:bg-slate-800 text-xs font-medium text-slate-200 hover:text-white transition-all flex items-center gap-1.5 border border-white/10"
              title="Open audio pipeline telemetry"
            >
              <Terminal className="w-4 h-4 text-pink-400" />
              <span className="hidden sm:inline">Diagnostics</span>
              {logs.filter((l) => l.level === 'error').length > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Speaker test result toast notification */}
      {speakerTestResult && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-slate-900 border border-cyan-500/40 shadow-2xl text-xs text-cyan-200 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle className="w-4 h-4 text-cyan-400" />
          <span>{speakerTestResult}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 max-w-4xl mx-auto w-full">
        {/* Multilingual Support Pill Bar */}
        <div className="flex items-center flex-wrap justify-center gap-1.5 mb-2 select-none">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-[11px] font-medium text-pink-300">
            <Languages className="w-3 h-3" />
            <span>Automatic Multi-Language:</span>
          </div>
          {['Hindi', 'English', 'Hinglish', 'Marathi', 'Gujarati', 'Bengali', 'Tamil', 'Telugu', 'Punjabi'].map(
            (lang, i) => (
              <span
                key={i}
                className="text-[10px] px-2 py-0.5 rounded-md bg-slate-900 text-slate-300 border border-slate-800"
              >
                {lang}
              </span>
            )
          )}
        </div>

        {/* Central Audio Visualizer Orb */}
        <AudioOrb
          state={state}
          inputVolume={inputVolume}
          outputVolume={outputVolume}
          onClick={toggleSession}
        />

        {/* Primary Activation Button */}
        <div className="flex flex-col items-center gap-2 mb-6">
          <button
            onClick={toggleSession}
            className={`px-8 py-3.5 rounded-2xl font-semibold text-sm tracking-wide shadow-xl flex items-center gap-3 transition-all duration-300 cursor-pointer ${
              state === 'IDLE'
                ? 'bg-gradient-to-r from-pink-500 via-rose-500 to-violet-600 hover:opacity-95 text-white shadow-pink-500/25 scale-100 hover:scale-105'
                : state === 'CONNECTING'
                ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40 animate-pulse'
                : state === 'ERROR'
                ? 'bg-red-500/20 text-red-200 border border-red-500/40'
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
            }`}
          >
            {state === 'IDLE' ? (
              <>
                <Mic className="w-5 h-5 text-white" />
                <span>Start Talking with Arushi</span>
              </>
            ) : state === 'CONNECTING' ? (
              <>
                <RotateCcw className="w-5 h-5 animate-spin text-amber-300" />
                <span>Connecting to Gemini Live...</span>
              </>
            ) : state === 'ERROR' ? (
              <>
                <RotateCcw className="w-5 h-5 text-red-300" />
                <span>Retry Connection</span>
              </>
            ) : (
              <>
                <MicOff className="w-5 h-5 text-rose-400" />
                <span>End Voice Session</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-slate-400 text-center">
            {state === 'IDLE'
              ? 'Press to initiate 16kHz raw mic capture & direct 24kHz Gemini audio streaming'
              : state === 'LISTENING'
              ? 'Speak naturally in Hindi, English, Hinglish or any Indian language. Arushi is listening!'
              : state === 'SPEAKING'
              ? 'Arushi is speaking through your device speaker. You can interrupt anytime!'
              : 'Tap to re-establish the Gemini Live audio session.'}
          </p>
        </div>

        {/* Live Subtitle / Transcript Section */}
        {transcripts.length > 0 && (
          <div className="w-full max-w-xl mx-auto my-3 glass-panel rounded-2xl p-4 border border-white/10 shadow-2xl max-h-48 overflow-y-auto space-y-2.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400 uppercase tracking-wider font-semibold border-b border-white/5 pb-1.5">
              <span>Live Dialogue & Transcription</span>
              <span className="text-[10px] text-pink-400">Gemini Live Audio</span>
            </div>

            {transcripts.map((t) => (
              <div
                key={t.id}
                className={`flex flex-col ${t.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                    t.sender === 'user'
                      ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-100 rounded-br-none'
                      : 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/30 text-pink-100 rounded-bl-none'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] opacity-70 mb-0.5">
                    <span className="font-semibold uppercase tracking-wider">
                      {t.sender === 'user' ? 'You' : 'Arushi'}
                    </span>
                    <span>• {t.timestamp}</span>
                  </div>
                  <p>{t.text}</p>
                </div>
              </div>
            ))}
            <div ref={transcriptsEndRef} />
          </div>
        )}

        {/* Action Execution Cards */}
        <ActionHistory actions={actions} onSelectContactMatch={handleContactCall} />

        {/* Quick Voice Suggestions */}
        <div className="w-full max-w-xl mx-auto mt-6">
          <div className="text-center mb-2.5">
            <span className="text-xs text-slate-400 font-medium">Try saying aloud to Arushi:</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {quickPrompts.map((q, i) => (
              <div
                key={i}
                className="px-3 py-1.5 rounded-xl glass-card text-xs text-slate-300 border border-white/5 hover:border-pink-500/30 hover:text-white transition-all flex items-center gap-1.5"
              >
                <span className="text-pink-400">“</span>
                <span>{q.label}</span>
                <span className="text-pink-400">”</span>
                <span className="text-[9px] text-slate-500 ml-1">({q.lang})</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer / Status info */}
      <footer className="py-4 px-6 border-t border-white/5 bg-slate-950/80 backdrop-blur-md text-center text-xs text-slate-400">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Voice-to-Voice AI Engine: Gemini Live Audio</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>Input: 16kHz PCM</span>
            <span>•</span>
            <span>Output: 24kHz Native PCM</span>
            <span>•</span>
            <span>Zero-Latency Interruption</span>
          </div>
        </div>
      </footer>

      {/* Contacts Drawer Modal */}
      <ContactsModal
        isOpen={isContactsOpen}
        onClose={() => setIsContactsOpen(false)}
        onSelectCall={handleContactCall}
      />

      {/* Real-time Diagnostics Drawer */}
      <DiagnosticDrawer
        isOpen={isDiagnosticOpen}
        onClose={() => setIsDiagnosticOpen(false)}
        logs={logs}
        onClear={() => setLogs([])}
      />
    </div>
  );
}
