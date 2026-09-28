import React, { useState } from 'react';
import { Contact, deviceBridge } from '../services/deviceBridge';
import { Users, Phone, Plus, Trash2, X, ShieldCheck } from 'lucide-react';

interface ContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCall: (contact: Contact) => void;
}

export const ContactsModal: React.FC<ContactsModalProps> = ({ isOpen, onClose, onSelectCall }) => {
  const [contacts, setContacts] = useState<Contact[]>(deviceBridge.getContacts());
  const [newName, setNewName] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [newRel, setNewRel] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newNumber.trim()) return;

    const contact: Contact = {
      name: newName.trim(),
      phoneNumber: newNumber.trim(),
      relationship: newRel.trim() || undefined,
      label: 'Custom',
    };

    deviceBridge.addContact(contact);
    setContacts([...deviceBridge.getContacts()]);
    setNewName('');
    setNewNumber('');
    setNewRel('');
    setIsAdding(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Device Address Book</h2>
              <p className="text-xs text-slate-400">
                Contacts used for Arushi's voice calling & disambiguation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info notice */}
        <div className="px-5 py-3 bg-cyan-950/30 border-b border-cyan-800/30 flex items-start gap-2.5 text-xs text-cyan-200">
          <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <p>
            Try saying <span className="font-semibold text-cyan-300">"Call Mom"</span> or{' '}
            <span className="font-semibold text-cyan-300">"Rahul ko call karo"</span> to test single match vs multi-contact
            disambiguation!
          </p>
        </div>

        {/* Contacts list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {contacts.map((c, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-cyan-500/30 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow">
                  {c.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-200 text-sm">{c.name}</span>
                    {c.relationship && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        {c.relationship}
                      </span>
                    )}
                    {c.label && (
                      <span className="text-[10px] text-slate-400 font-mono">({c.label})</span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 font-mono">{c.phoneNumber}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  onSelectCall(c);
                  onClose();
                }}
                className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all text-xs flex items-center gap-1.5"
                title={`Call ${c.name}`}
              >
                <Phone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline font-medium">Call</span>
              </button>
            </div>
          ))}
        </div>

        {/* Add Contact drawer / footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          {isAdding ? (
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Name (e.g. Priya)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-cyan-500"
                  required
                />
                <input
                  type="tel"
                  placeholder="Phone (e.g. +91 98765...)"
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>
              <input
                type="text"
                placeholder="Relationship / Label (Optional, e.g. Sister, Work)"
                value={newRel}
                onChange={(e) => setNewRel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
                >
                  Save Contact
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full py-2.5 rounded-xl border border-dashed border-slate-700 hover:border-cyan-500/50 text-slate-400 hover:text-cyan-300 transition-colors flex items-center justify-center gap-2 text-xs font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Custom Contact
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
