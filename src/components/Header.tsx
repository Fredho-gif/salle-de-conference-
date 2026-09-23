import React from 'react';
import { Video, ShieldCheck, Cpu, Plus, Sparkles, User as UserIcon } from 'lucide-react';
import { User } from '../types';

interface HeaderProps {
  currentUser: User | null;
  onOpenCreate: () => void;
  onOpenArchitecture: () => void;
  onOpenAuth: () => void;
  activeRoomTitle?: string;
  onLeaveRoom?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onOpenCreate,
  onOpenArchitecture,
  onOpenAuth,
  activeRoomTitle,
  onLeaveRoom,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/25 ring-1 ring-white/20">
            <Video className="w-5 h-5 text-white" />
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                ConfeRoom
              </span>
              <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                SFU & Redis
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Visioconférence Haute Capacité & Contrôle Atomique
            </p>
          </div>
        </div>

        {/* Room Title if currently in a room */}
        {activeRoomTitle && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-300 font-medium truncate max-w-xs">{activeRoomTitle}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Architecture & Docs Modal */}
          <button
            onClick={onOpenArchitecture}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs sm:text-sm font-medium transition"
            title="Explorer l'Architecture & Code Source"
          >
            <Cpu className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">Architecture & Code</span>
          </button>

          {!activeRoomTitle && (
            <button
              onClick={onOpenCreate}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium text-xs sm:text-sm shadow-md shadow-indigo-600/20 transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Créer une salle</span>
            </button>
          )}

          {/* User Profile */}
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-2 p-1.5 sm:px-2.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 transition"
          >
            {currentUser?.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.name}
                className="w-7 h-7 rounded-full ring-1 ring-indigo-500/50 object-cover"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-indigo-950 flex items-center justify-center text-indigo-300 text-xs font-bold">
                <UserIcon className="w-3.5 h-3.5" />
              </div>
            )}
            <span className="text-xs font-medium text-slate-200 hidden md:block max-w-[120px] truncate">
              {currentUser?.name || 'Connexion'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
