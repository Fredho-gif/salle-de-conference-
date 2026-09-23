import React, { useState } from 'react';
import { X, User, Lock, Mail, Sparkles, Check } from 'lucide-react';
import { User as UserType } from '../types';
import { api } from '../services/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserType | null;
  onUserChange: (user: UserType) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserChange,
}) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleQuickSwitch = (quickName: string, quickEmail: string) => {
    const newUser: UserType = {
      id: `usr_${Math.random().toString(36).substring(2, 9)}`,
      name: quickName,
      email: quickEmail,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(quickName)}`,
      createdAt: new Date().toISOString(),
    };
    onUserChange(newUser);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);

    try {
      if (isRegister) {
        const res = await api.register(email, name || email.split('@')[0]);
        onUserChange(res.user);
      } else {
        const res = await api.login(email, name || email.split('@')[0]);
        onUserChange(res.user);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur d\'authentification');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Identité & Authentification</h2>
              <p className="text-xs text-slate-400">JWT & Passport ou sessions rapides</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Quick Identity Switcher for Multi-tab testing */}
        <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800">
          <span className="block text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-wider">
            Test Multi-Utilisateurs Rapide (Changer de profil) :
          </span>
          <div className="grid grid-cols-2 gap-2">
            {[
              { name: 'Alexandre Martin', email: 'architect@conferoom.io', role: 'Architecte' },
              { name: 'Sophie Bernard', email: 'sophie@conferoom.io', role: 'Ingénieur Lead' },
              { name: 'Lucas Dupont', email: 'lucas@conferoom.io', role: 'Participant #1' },
              { name: 'Camille Leroy', email: 'camille@conferoom.io', role: 'Participant #2' },
            ].map((p) => {
              const isCurrent = currentUser?.email === p.email;
              return (
                <button
                  key={p.email}
                  type="button"
                  onClick={() => handleQuickSwitch(p.name, p.email)}
                  className={`p-2 rounded-lg border text-left flex items-center justify-between transition ${
                    isCurrent
                      ? 'bg-indigo-600/20 border-indigo-500 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="truncate">
                    <span className="text-xs font-bold block truncate">{p.name}</span>
                    <span className="text-[10px] text-slate-400 block">{p.role}</span>
                  </div>
                  {isCurrent && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Nom complet</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Jean Dupont"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Adresse Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre.email@entreprise.com"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsRegister(!isRegister)}
              className="text-xs text-indigo-400 hover:underline"
            >
              {isRegister ? 'Déjà un compte ? Se connecter' : 'Créer un nouveau compte'}
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
            >
              {loading ? 'Connexion...' : isRegister ? 'S\'inscrire' : 'Se connecter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
