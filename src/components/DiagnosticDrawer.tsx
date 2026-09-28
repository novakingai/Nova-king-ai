import React, { useState } from 'react';
import { DiagnosticLog } from '../services/audioStreamer';
import { Terminal, Copy, Check, Trash2, X, AlertTriangle, CheckCircle, Info, Bug } from 'lucide-react';

interface DiagnosticDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  logs: DiagnosticLog[];
  onClear: () => void;
}

export const DiagnosticDrawer: React.FC<DiagnosticDrawerProps> = ({ isOpen, onClose, logs, onClear }) => {
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState<'all' | 'error' | 'success'>('all');

  if (!isOpen) return null;

  const filteredLogs = logs.filter((log) => {
    if (filter === 'error') return log.level === 'error' || log.level === 'warn';
    if (filter === 'success') return log.level === 'success';
    return true;
  });

  const handleCopy = () => {
    const text = logs
      .map((l) => `[${l.time}] [${l.level.toUpperCase()}] ${l.message} ${l.details ? JSON.stringify(l.details) : ''}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl h-[85vh] sm:h-[75vh] flex flex-col bg-slate-950 border border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-pink-500/20 text-pink-400">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                Live Audio Pipeline Diagnostics
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  {logs.length} events
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                28-point real-time audio pipeline inspection (mic capture, PCM encode/decode, 24kHz buffer queue)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors text-xs flex items-center gap-1 px-2.5"
              title="Copy diagnostic logs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={onClear}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors text-xs flex items-center gap-1 px-2"
              title="Clear logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-850 bg-slate-900/40 text-xs">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === 'all' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({logs.length})
            </button>
            <button
              onClick={() => setFilter('error')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === 'error' ? 'bg-red-500/20 text-red-300 font-medium' : 'text-slate-400 hover:text-red-300'
              }`}
            >
              Errors & Warnings ({logs.filter((l) => l.level === 'error' || l.level === 'warn').length})
            </button>
            <button
              onClick={() => setFilter('success')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === 'success' ? 'bg-emerald-500/20 text-emerald-300 font-medium' : 'text-slate-400 hover:text-emerald-300'
              }`}
            >
              Success ({logs.filter((l) => l.level === 'success').length})
            </button>
          </div>

          <div className="text-[11px] text-slate-500 font-mono">
            PCM 16k mono ↔ 24k out
          </div>
        </div>

        {/* Logs container */}
        <div className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-1.5 select-text bg-slate-950">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-center">
              <Bug className="w-8 h-8 mb-2 opacity-40" />
              <p>No log events captured yet.</p>
              <p className="text-[11px]">Start Arushi or test speaker to see real-time pipeline telemetry.</p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              let badgeColor = 'text-blue-400 bg-blue-500/10 border-blue-500/20';
              let Icon = Info;
              if (log.level === 'success') {
                badgeColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
                Icon = CheckCircle;
              } else if (log.level === 'warn') {
                badgeColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
                Icon = AlertTriangle;
              } else if (log.level === 'error') {
                badgeColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
                Icon = AlertTriangle;
              }

              return (
                <div
                  key={log.id}
                  className="flex items-start gap-2.5 py-1 px-2 rounded-md hover:bg-slate-900/60 transition-colors border border-transparent hover:border-slate-800"
                >
                  <span className="text-slate-500 shrink-0 text-[11px] pt-0.5">{log.time}</span>
                  <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold border shrink-0 ${badgeColor}`}>
                    <Icon className="w-2.5 h-2.5" />
                    <span>{log.level}</span>
                  </div>
                  <div className="flex-1 break-all">
                    <span className="text-slate-200">{log.message}</span>
                    {log.details !== undefined && (
                      <pre className="mt-1 p-1.5 rounded bg-slate-900 text-slate-400 text-[11px] overflow-x-auto border border-slate-800">
                        {typeof log.details === 'object' ? JSON.stringify(log.details, null, 2) : String(log.details)}
                      </pre>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
