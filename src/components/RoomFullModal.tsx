import React, { useState, useEffect } from 'react';
import { X, Lock, Users, RefreshCw, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Room } from '../types';

interface RoomFullModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room | null;
  onRetry: () => void;
  isRetrying?: boolean;
}

export const RoomFullModal: React.FC<RoomFullModalProps> = ({
  isOpen,
  onClose,
  room,
  onRetry,
  isRetrying = false,
}) => {
  const [autoRetryActive, setAutoRetryActive] = useState(false);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    let timer: any;
    if (autoRetryActive && isOpen) {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            onRetry();
            return 5;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [autoRetryActive, isOpen, onRetry]);

  if (!isOpen || !room) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-rose-500/40 rounded-2xl shadow-2xl shadow-rose-950/50 p-6 overflow-hidden">
        {/* Glow */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
                Accès Refusé • Verrou Atomique
              </span>
              <h2 className="text-xl font-bold text-white">Salle Complète</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Conférence :</span>
            <span className="font-semibold text-white truncate max-w-[200px]">{room.title}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Capacité maximale fixée :</span>
            <span className="font-mono font-bold text-rose-400">{room.maxParticipants} participants</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Places restantes :</span>
            <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-xs">
              0 place disponible
            </span>
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-400 leading-relaxed">
          Le serveur a rejeté votre demande d'admission car la limite stricte de participants configurée par l'animateur est atteinte. Dès qu'un participant quitte la réunion, sa place est immédiatement libérée dans Redis.
        </p>

        {autoRetryActive && (
          <div className="mt-3 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between text-xs text-indigo-300">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span>Surveillance active d'une place libre...</span>
            </div>
            <span className="font-mono font-bold">{countdown}s</span>
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row items-center gap-2.5">
          <button
            type="button"
            onClick={() => setAutoRetryActive(!autoRetryActive)}
            className={`w-full sm:flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition ${
              autoRetryActive
                ? 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/25'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>{autoRetryActive ? 'Arrêter la tentative auto' : 'Réessayer dès libération'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Retour</span>
          </button>
        </div>
      </div>
    </div>
  );
};
