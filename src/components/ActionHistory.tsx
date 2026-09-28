import React from 'react';
import { ActionResult, Contact } from '../services/deviceBridge';
import { Activity, Phone, MessageSquare, Globe, ExternalLink, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ActionHistoryProps {
  actions: ActionResult[];
  onSelectContactMatch: (contact: Contact) => void;
}

export const ActionHistory: React.FC<ActionHistoryProps> = ({ actions, onSelectContactMatch }) => {
  if (actions.length === 0) return null;

  return (
    <div className="w-full max-w-xl mx-auto mt-4 px-2 select-none">
      <div className="flex items-center gap-2 mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <Activity className="w-3.5 h-3.5 text-cyan-400" />
        <span>Recent Device Actions</span>
      </div>

      <div className="space-y-2">
        {actions.slice(-3).reverse().map((act, idx) => {
          let ActionIcon = Globe;
          if (act.action === 'openWhatsApp') ActionIcon = MessageSquare;
          else if (act.action === 'makeCall' || act.action === 'callContact') ActionIcon = Phone;

          return (
            <div
              key={idx}
              className={`p-3 rounded-xl border backdrop-blur-md transition-all ${
                act.success
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                  : act.matches && act.matches.length > 1
                  ? 'bg-amber-950/25 border-amber-500/40 text-amber-200'
                  : 'bg-rose-950/20 border-rose-500/30 text-rose-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-white/10 shrink-0 mt-0.5">
                    <ActionIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-white">
                        {act.action}
                      </span>
                      {act.success ? (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" /> Executed
                        </span>
                      ) : act.matches && act.matches.length > 1 ? (
                        <span className="flex items-center gap-1 text-[11px] text-amber-400 font-medium">
                          Disambiguation Required
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] text-rose-400">
                          <AlertCircle className="w-3 h-3" /> Notice
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-300 mt-0.5">
                      {act.details || act.error}
                    </p>
                  </div>
                </div>
              </div>

              {/* Multiple contact choices if disambiguation was needed */}
              {act.matches && act.matches.length > 1 && (
                <div className="mt-3 pt-2 border-t border-amber-500/20">
                  <p className="text-[11px] font-medium text-amber-300 mb-1.5">
                    Tap to specify which contact:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {act.matches.map((match, mIdx) => (
                      <button
                        key={mIdx}
                        onClick={() => onSelectContactMatch(match)}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/40 border border-amber-500/40 text-xs text-amber-100 flex items-center gap-1.5 transition-colors"
                      >
                        <Phone className="w-3 h-3" />
                        <span>{match.name} ({match.label || match.phoneNumber})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
