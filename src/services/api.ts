import { Room, User } from '../types';

export const API_BASE = '/api';

export const api = {
  // Authentication
  async login(email: string, name?: string): Promise<{ user: User; token: string }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur de connexion');
    }
    return res.json();
  },

  async register(email: string, name: string): Promise<{ user: User; token: string }> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur lors de la création du compte');
    }
    return res.json();
  },

  // Rooms
  async getRooms(): Promise<Room[]> {
    const res = await fetch(`${API_BASE}/rooms`);
    if (!res.ok) throw new Error('Impossible de charger les salles');
    return res.json();
  },

  async getRoom(identifier: string): Promise<Room & { participants: any[] }> {
    const res = await fetch(`${API_BASE}/rooms/${encodeURIComponent(identifier)}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Salle introuvable');
    }
    return res.json();
  },

  async createRoom(data: {
    title: string;
    description?: string;
    maxParticipants: number;
    hostId: string;
    hostName: string;
  }): Promise<Room> {
    const res = await fetch(`${API_BASE}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur lors de la création de la salle');
    }
    return res.json();
  },

  async stressTestCapacity(roomId: string, attempts: number = 20) {
    const res = await fetch(`${API_BASE}/rooms/${roomId}/stress-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attempts }),
    });
    if (!res.ok) throw new Error('Erreur lors du test de charge');
    return res.json();
  },

  async resetParticipants(roomId: string) {
    const res = await fetch(`${API_BASE}/rooms/${roomId}/reset-participants`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Erreur de réinitialisation');
    return res.json();
  }
};
