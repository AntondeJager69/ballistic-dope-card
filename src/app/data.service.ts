import { Injectable } from '@angular/core';
import {
  Rifle,
  Venue,
  Session,
} from './models';

interface AppStore {
  nextRifleId: number;
  nextVenueId: number;
  nextSessionId: number;
  rifles: Rifle[];
  venues: Venue[];
  sessions: Session[];
}

const STORAGE_KEY = 'ballistic-dope-card-v1';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private store: AppStore;

  constructor() {
    this.store = this.loadStore();
  }

  // ---------- Storage helpers ----------

  private loadStore(): AppStore {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: AppStore = JSON.parse(raw);
        return {
          nextRifleId: parsed.nextRifleId ?? 1,
          nextVenueId: parsed.nextVenueId ?? 1,
          nextSessionId: parsed.nextSessionId ?? 1,
          rifles: parsed.rifles ?? [],
          venues: parsed.venues ?? [],
          sessions: parsed.sessions ?? []
        };
      }
    } catch {
      // ignore
    }

    return {
      nextRifleId: 1,
      nextVenueId: 1,
      nextSessionId: 1,
      rifles: [],
      venues: [],
      sessions: []
    };
  }

  private saveStore() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.store));
    } catch {
      // ignore for now
    }
  }

  // ---------- Rifles ----------

  getRifles(): Rifle[] {
    return this.store.rifles;
  }

  addRifle(rifle: Omit<Rifle, 'id'>): Rifle {
    const newRifle: Rifle = {
      ...rifle,
      id: this.store.nextRifleId++
    };
    this.store.rifles.push(newRifle);
    this.saveStore();
    return newRifle;
  }

  updateRifle(rifle: Rifle) {
    const idx = this.store.rifles.findIndex(r => r.id === rifle.id);
    if (idx >= 0) {
      this.store.rifles[idx] = rifle;
      this.saveStore();
    }
  }

  deleteRifle(id: number) {
    this.store.rifles = this.store.rifles.filter(r => r.id !== id);
    this.saveStore();
  }

  // 🔥 increment round count, never decreases
  incrementRifleRoundCount(rifleId: number, delta: number) {
    if (!delta || delta <= 0) return;
    const rifle = this.store.rifles.find(r => r.id === rifleId);
    if (!rifle) return;
    rifle.roundCount = (rifle.roundCount || 0) + delta;
    this.saveStore();
  }

  // ---------- Venues ----------

  getVenues(): Venue[] {
    return this.store.venues;
  }

  getVenueById(id: number): Venue | undefined {
    return this.store.venues.find(v => v.id === id);
  }

  addVenue(venue: Omit<Venue, 'id'>): Venue {
    const newVenue: Venue = {
      ...venue,
      id: this.store.nextVenueId++
    };
    this.store.venues.push(newVenue);
    this.saveStore();
    return newVenue;
  }

  updateVenue(venue: Venue) {
    const idx = this.store.venues.findIndex(v => v.id === venue.id);
    if (idx >= 0) {
      this.store.venues[idx] = venue;
      this.saveStore();
    }
  }

  deleteVenue(id: number) {
    this.store.venues = this.store.venues.filter(v => v.id !== id);
    this.saveStore();
  }

  // ---------- Sessions ----------

  getSessions(): Session[] {
    return this.store.sessions;
  }

  addSession(session: Omit<Session, 'id'>): Session {
    const newSession: Session = {
      ...session,
      id: this.store.nextSessionId++
    };
    this.store.sessions.push(newSession);
    this.saveStore();
    return newSession;
  }

  updateSession(session: Session) {
    const idx = this.store.sessions.findIndex(s => s.id === session.id);
    if (idx >= 0) {
      this.store.sessions[idx] = session;
      this.saveStore();
    }
  }

  deleteSession(id: number) {
    this.store.sessions = this.store.sessions.filter(s => s.id !== id);
    this.saveStore();
  }
}
