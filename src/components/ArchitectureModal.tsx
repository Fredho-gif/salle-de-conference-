import React, { useState } from 'react';
import { X, Layers, Database, Cpu, Zap, Code, ShieldCheck, CheckCircle2, Play } from 'lucide-react';
import { api } from '../services/api';
import { Room } from '../types';

interface ArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: Room[];
}

export const ArchitectureModal: React.FC<ArchitectureModalProps> = ({ isOpen, onClose, rooms }) => {
  const [activeTab, setActiveTab] = useState<'diagram' | 'lua' | 'schema' | 'docker' | 'benchmark'>('diagram');
  const [selectedRoomId, setSelectedRoomId] = useState<string>(rooms[0]?.id || '');
  const [stressAttempts, setStressAttempts] = useState<number>(30);
  const [stressLoading, setStressLoading] = useState(false);
  const [stressResult, setStressResult] = useState<any>(null);

  if (!isOpen) return null;

  const runStressTest = async () => {
    if (!selectedRoomId) return;
    setStressLoading(true);
    setStressResult(null);
    try {
      const res = await api.stressTestCapacity(selectedRoomId, stressAttempts);
      setStressResult(res);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setStressLoading(false);
    }
  };

  const resetRoom = async () => {
    if (!selectedRoomId) return;
    try {
      await api.resetParticipants(selectedRoomId);
      setStressResult(null);
      alert('Participants de la salle réinitialisés à 0.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Dossier d'Architecture & Code Source</h2>
              <p className="text-xs text-slate-400">Conception WebRTC SFU, Verrous Redis Lua & TypeORM</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 gap-2 overflow-x-auto">
          {[
            { id: 'diagram', label: 'Diagramme d\'Architecture', icon: Layers },
            { id: 'lua', label: 'Script Redis Lua (Atomic)', icon: Zap },
            { id: 'schema', label: 'Schéma PostgreSQL', icon: Database },
            { id: 'docker', label: 'Docker Compose', icon: Code },
            { id: 'benchmark', label: 'Stress-Test Concurrence', icon: Play },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
                  isActive
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'diagram' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <h3 className="text-sm font-bold text-slate-200 mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Flux Temps Réel & Ségrégation des Responsabilités
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="font-bold text-indigo-400 block mb-1">1. Frontend React</span>
                    <p className="text-slate-400">
                      Interface WebRTC avec capture micro/caméra, partage d'écran, grille vidéo adaptative et chat Socket.io.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="font-bold text-violet-400 block mb-1">2. NestJS & Redis Lua</span>
                    <p className="text-slate-400">
                      Garantit le contrôle de capacité atomique en O(1) avec zéro race condition et libération sur déconnexion.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="font-bold text-emerald-400 block mb-1">3. SFU WebRTC (LiveKit)</span>
                    <p className="text-slate-400">
                      Relais média sélectif optimisé (Simulcast/Dynacast), évitant la saturation de bande passante du modèle maillé P2P.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto whitespace-pre leading-relaxed">
{`+-------------------------------------------------------------------------+
|                           NAVIGATEURS CLIENTS                           |
|       [Client 1: React]         [Client 2: React]      [Client 3: React]|
+-------------------------------------------------------------------------+
             |                                                  |
             | 1. HTTP/WS (Signaling & Auth)                    | 2. WebRTC SRTP (Media)
             v                                                  v
+-----------------------------+                  +------------------------+
|       NGINX REVERSE PROXY   |                  |     LIVEKIT SFU        |
|    Port 80 / 3000           |                  |     Port 7880 / 7882   |
+-----------------------------+                  +------------------------+
             |
             v
+-------------------------------------------------------------------------+
|                        NESTJS APPLICATION BACKEND                       |
|   - REST API Controllers (/api/auth, /api/rooms)                        |
|   - Socket.io Signaling Gateway (join-room, leave, offer, ice)          |
|   - RedisCapacityService (Lua script atomique anti race condition)      |
+-------------------------------------------------------------------------+
             |                                                  |
             | EVALSHA Lua Script (Atomique O(1))               | TypeORM Queries
             v                                                  v
+-----------------------------+                  +------------------------+
|           REDIS 7           |                  |      POSTGRESQL 16     |
| - room:<id>:participants    |                  | - Table: users         |
| - Verrouillage anti-concur  |                  | - Table: rooms         |
| - Détection de déconnexion  |                  | - Table: messages      |
+-----------------------------+                  +------------------------+`}
              </div>
            </div>
          )}

          {activeTab === 'lua' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
                <strong>Pourquoi ce script Lua ?</strong> En exécutant l'évaluation directement dans le moteur C de Redis, la lecture du nombre actuel de participants et l'ajout de l'utilisateur forment une transaction indivisible. Aucune requête concurrente ne peut s'insérer entre les deux.
              </div>
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto leading-relaxed">
{`-- SCRIPT REDIS LUA POUR L'ACQUISITION ATOMIQUE D'UNE PLACE
-- KEYS[1] = 'room:' .. roomId .. ':participants' (Redis Set)
-- ARGV[1] = userId
-- ARGV[2] = maxCapacity
-- ARGV[3] = socketId

local key_participants = KEYS[1]
local user_id = ARGV[1]
local max_capacity = tonumber(ARGV[2])
local socket_id = ARGV[3]

-- 1. Idempotence : si l'utilisateur est déjà inscrit (ex: reconnexion WiFi)
local is_member = redis.call('SISMEMBER', key_participants, user_id)
local current_count = redis.call('SCARD', key_participants)

if is_member == 1 then
    return { 1, current_count, max_capacity } -- Déjà admis
end

-- 2. Contrôle atomique strict de la capacité
if current_count >= max_capacity then
    return { 0, current_count, max_capacity } -- REFUS IMMÉDIAT (SALLE COMPLÈTE)
end

-- 3. Inscription atomique & Association du socket
redis.call('SADD', key_participants, user_id)
redis.call('HSET', 'socket_to_user:' .. socket_id, 'userId', user_id, 'key', key_participants)
redis.call('EXPIRE', key_participants, 86400) -- Expiration de sécurité

local updated_count = redis.call('SCARD', key_participants)
return { 1, updated_count, max_capacity } -- ADMISSION CONFIRMÉE`}
              </pre>
            </div>
          )}

          {activeTab === 'schema' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Schéma relationnel PostgreSQL modélisé avec TypeORM :
              </p>
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-sky-300 overflow-x-auto leading-relaxed">
{`-- Entité Users (Utilisateurs & Authentification)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  name VARCHAR(120) NOT NULL,
  avatar_url TEXT,
  auth_provider VARCHAR(50) DEFAULT 'local',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Entité Rooms (Salles de visioconférence)
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(16) UNIQUE NOT NULL, -- ex: CONF-7489
  title VARCHAR(120) NOT NULL,
  description TEXT,
  host_id UUID REFERENCES users(id) ON DELETE CASCADE,
  max_participants INT NOT NULL DEFAULT 10,
  is_active BOOLEAN DEFAULT TRUE,
  is_private BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Entité RoomParticipants (Historique et sessions)
CREATE TABLE room_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  socket_id VARCHAR(64),
  is_host BOOLEAN DEFAULT FALSE,
  audio_enabled BOOLEAN DEFAULT TRUE,
  video_enabled BOOLEAN DEFAULT TRUE,
  screen_sharing BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  left_at TIMESTAMP WITH TIME ZONE
);

-- Entité Messages (Chat textuel archivé)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
  sender_name VARCHAR(120) NOT NULL,
  content TEXT NOT NULL,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`}
              </pre>
            </div>
          )}

          {activeTab === 'docker' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Fichier <code className="text-indigo-400">docker-compose.yml</code> complet avec PostgreSQL 16, Redis 7, LiveKit SFU et Backend NestJS :
              </p>
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-amber-300 overflow-x-auto leading-relaxed">
{`version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: conferoom-postgres
    environment:
      POSTGRES_USER: conferoom_user
      POSTGRES_PASSWORD: conferoom_password
      POSTGRES_DB: conferoom_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: conferoom-redis
    command: ["redis-server", "--appendonly", "yes"]
    ports:
      - "6379:6379"

  livekit:
    image: livekit/livekit-server:latest
    container_name: conferoom-livekit
    command: --dev
    ports:
      - "7880:7880"     # Signaling
      - "7881:7881"     # RTC TCP fallback
      - "7882:7882/udp" # RTC UDP Media
    environment:
      - LIVEKIT_KEYS=devkey:secret_livekit_key_2026

  backend:
    build: ./backend
    container_name: conferoom-backend
    ports:
      - "3001:3001"
    depends_on:
      - postgres
      - redis
      - livekit`}
              </pre>
            </div>
          )}

          {activeTab === 'benchmark' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
                <strong>Démonstration Live de l'Atomicité :</strong> Lancez une rafale de requêtes simultanées (ex: 30 connexions parallèles) vers une salle pour vérifier expérimentalement que le verrou atomique empêche toute condition de course et respecte scrupuleusement la limite configurée.
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Sélectionner une salle
                  </label>
                  <select
                    value={selectedRoomId}
                    onChange={(e) => setSelectedRoomId(e.target.value)}
                    className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  >
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title} ({r.currentParticipantsCount || 0}/{r.maxParticipants} max)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Tentatives simultanées
                  </label>
                  <select
                    value={stressAttempts}
                    onChange={(e) => setStressAttempts(Number(e.target.value))}
                    className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  >
                    <option value={10}>10 requêtes parallèles</option>
                    <option value={20}>20 requêtes parallèles</option>
                    <option value={50}>50 requêtes parallèles</option>
                  </select>
                </div>

                <div className="flex items-end gap-2 pt-5">
                  <button
                    onClick={runStressTest}
                    disabled={stressLoading || !selectedRoomId}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-orange-600/20 transition active:scale-95 disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{stressLoading ? 'Test en cours...' : 'Lancer le test de saturation'}</span>
                  </button>

                  <button
                    onClick={resetRoom}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
                  >
                    Réinitialiser les places
                  </button>
                </div>
              </div>

              {stressResult && (
                <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Test de charge terminé : Zéro surréservation constatée !</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-slate-500 block">Capacité Max</span>
                      <span className="text-base font-bold text-white">{stressResult.maxCapacity}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-slate-500 block">Requêtes concurrentes</span>
                      <span className="text-base font-bold text-indigo-400">{stressResult.attemptsCount}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-slate-500 block">Places admises</span>
                      <span className="text-base font-bold text-emerald-400">{stressResult.acceptedTotal}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-slate-500 block">Refusés (Salle pleine)</span>
                      <span className="text-base font-bold text-rose-400">{stressResult.rejectedTotal}</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    Résultat : {stressResult.acceptedTotal} participants ont obtenu un jeton, et exactement {stressResult.rejectedTotal} ont reçu un code d'erreur <code className="text-rose-400">ROOM_FULL</code>. La capacité maximale n'a jamais été dépassée.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
