import React, { useState } from 'react';
import { Room } from '../types';
import { Users, Copy, Check, ArrowRight, ShieldAlert, Zap, Lock } from 'lucide-react';

interface RoomCardProps {
  room: Room;
  onJoin: (room: Room) => void;
  onStressTest?: (room: Room) => void;
}

export const RoomCard: React.FC<RoomCardProps> = ({ room, onJoin, onStressTest }) => {
  const [copied, setCopied] = useState(false);

  const count = room.currentParticipantsCount || 0;
  const max = room.maxParticipants;
  const remaining = Math.max(0, max - count);
  const fillPercent = Math.min(100, Math.round((count / max) * 100));
  const isFull = count >= max;

  const handleCopyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Color theme according to saturation
  let progressColor = 'bg-emerald-500';
  let badgeColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';

  if (fillPercent >= 100) {
    progressColor = 'bg-rose-500';
    badgeColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  } else if (fillPercent >= 75) {
    progressColor = 'bg-amber-500';
    badgeColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  }

  return (
    <div className="relative group flex flex-col justify-between p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 hover:border-slate-700 hover:shadow-xl hover:shadow-indigo-500/5 transition duration-200">
      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/60 flex items-center gap-1.5">
              <span>{room.code}</span>
              <button
                onClick={handleCopyCode}
                className="text-slate-400 hover:text-white transition"
                title="Copier le code de la réunion"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </span>
          </div>

          {/* Live Capacity Pill */}
          <div className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border flex items-center gap-1.5 ${badgeColor}`}>
            {isFull ? (
              <>
                <Lock className="w-3 h-3" />
                <span>COMPLET</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{remaining} {remaining > 1 ? 'places libres' : 'place libre'}</span>
              </>
            )}
          </div>
        </div>

        {/* Title & Description */}
        <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition line-clamp-1 mb-1">
          {room.title}
        </h3>
        <p className="text-xs text-slate-400 line-clamp-2 min-h-[32px] mb-4">
          {room.description || 'Salle de conférence interactive sans ordre du jour particulier.'}
        </p>
      </div>

      {/* Capacity Progress Bar */}
      <div className="pt-2 border-t border-slate-800/80">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span>Participants</span>
          </span>
          <span className="font-medium text-slate-200">
            {count} / {max} <span className="text-slate-500 font-normal">({fillPercent}%)</span>
          </span>
        </div>

        {/* Progress Track */}
        <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden p-0.5 border border-slate-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
            style={{ width: `${fillPercent}%` }}
          />
        </div>

        {/* Host details & Actions */}
        <div className="mt-4 pt-3 flex items-center justify-between gap-2">
          <div className="text-[11px] text-slate-400 truncate max-w-[130px]">
            Hôte: <span className="text-slate-300 font-medium">{room.hostName}</span>
          </div>

          <div className="flex items-center gap-1.5">
            {onStressTest && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStressTest(room);
                }}
                className="px-2 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-indigo-300 text-xs font-medium flex items-center gap-1 transition"
                title="Tester l'afflux atomique de participants"
              >
                <Zap className="w-3 h-3 text-amber-400" />
                <span className="hidden sm:inline">Stress Test</span>
              </button>
            )}

            <button
              onClick={() => onJoin(room)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition active:scale-95 ${
                isFull
                  ? 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/20'
              }`}
            >
              <span>{isFull ? 'Tenter d\'entrer' : 'Rejoindre'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
