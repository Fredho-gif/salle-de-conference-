import React, { useState } from 'react';
import { X, Users, Sparkles, ShieldCheck, Check } from 'lucide-react';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (roomData: { title: string; description: string; maxParticipants: number }) => Promise<void>;
  isLoading?: boolean;
}

const CAPACITY_PRESETS = [
  { value: 2, label: '2 places', desc: 'Entretien privé (1:1)' },
  { value: 5, label: '5 places', desc: 'Petite équipe / Pair' },
  { value: 10, label: '10 places', desc: 'Daily / Sprint standard' },
  { value: 25, label: '25 places', desc: 'Workshop / Atelier' },
  { value: 50, label: '50 places', desc: 'Séminaire interactif' },
  { value: 200, label: '200 places', desc: 'Conférence All-Hands' },
];

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  isLoading = false,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [maxParticipants, setMaxParticipants] = useState<number>(10);
  const [isCustom, setIsCustom] = useState(false);
  const [customValue, setCustomValue] = useState('10');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Veuillez saisir un titre pour la conférence.');
      return;
    }

    const finalCapacity = isCustom ? Number(customValue) : maxParticipants;
    if (isNaN(finalCapacity) || finalCapacity < 2 || finalCapacity > 500) {
      setError('Le nombre maximum de participants doit être compris entre 2 et 500.');
      return;
    }

    setError(null);
    try {
      await onCreate({
        title: title.trim(),
        description: description.trim(),
        maxParticipants: finalCapacity,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création de la salle');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Créer une salle de conférence</h2>
              <p className="text-xs text-slate-400">Configuration du plafond atomique de participants</p>
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

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Titre de la réunion *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ex: Daily Standup, Rétrospective Q3, Architecture Review..."
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Description ou Ordre du jour (optionnel)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Objectif de la séance, règles de parole, liens préparatoires..."
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition resize-none"
            />
          </div>

          {/* Max Capacity Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>Capacité maximale autorisée</span>
                <span className="text-[10px] lowercase px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  verrou Redis
                </span>
              </label>
              <button
                type="button"
                onClick={() => setIsCustom(!isCustom)}
                className="text-xs text-indigo-400 hover:text-indigo-300 underline"
              >
                {isCustom ? 'Utiliser les pré-réglages' : 'Nombre personnalisé'}
              </button>
            </div>

            {!isCustom ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CAPACITY_PRESETS.map((preset) => {
                  const isSelected = maxParticipants === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setMaxParticipants(preset.value)}
                      className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition ${
                        isSelected
                          ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-sm shadow-indigo-500/20'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-sm font-bold text-slate-100">{preset.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                      </div>
                      <span className="text-[11px] text-slate-400 mt-0.5">{preset.desc}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={2}
                  max={500}
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  className="w-32 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                />
                <span className="text-xs text-slate-400">
                  participants maximum (plage autorisée : 2 à 500)
                </span>
              </div>
            )}
          </div>

          {/* Architecture Guarantee Info */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-2.5 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p>
              <strong className="text-slate-200">Garantie anti-surréservation :</strong> Un script
              atomique Redis Lua empêche tout dépassement lors des pointes de connexions simultanées. Tout
              participant supplémentaire au-delà du quota sera automatiquement rejeté.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-medium transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-semibold shadow-md shadow-indigo-600/20 transition active:scale-95 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isLoading ? 'Création en cours...' : 'Générer la salle'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
