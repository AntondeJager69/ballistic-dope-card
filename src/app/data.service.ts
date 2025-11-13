// src/app/data.service.ts
import { Injectable } from '@angular/core';
import { Rifle, Venue, Session, SubRange, Environment, DistanceDope } from './models';

interface StoredData {
  rifles: Rifle[];
  venues: Venue[];
  sessions: Session[];
  lastId: number;
}

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private storageKey = 'ballisticDopeApp';
  private data: StoredData = {
    rifles: [],
    venues: [],
    sessions: [],
    lastId: 0
  };

  constructor() {
    this.load();
  }

  private load() {
    const raw = localStorage.getItem(this.storageKey);
    if (raw) {
      this.data = JSON.parse(raw);
    }
  }

  private save() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.data));
  }

  private nextId(): number {
    this.data.lastId += 1;
    return this.data.lastId;
  }

  // ---- Rifles ----
  getRifles(): Rifle[] {
    return [...this.data.rifles];
  }

  addRifle(rifle: Omit<Rifle, 'id'>): Rifle {
    const newRifle: Rifle = { ...rifle, id: this.nextId() };
    this.data.rifles.push(newRifle);
    this.save();
    return newRifle;
  }

  updateRifle(rifle: Rifle) {
    const idx = this.data.rifles.findIndex(r => r.id === rifle.id);
    if (idx >= 0) {
      this.data.rifles[idx] = rifle;
      this.save();
    }
  }

  deleteRifle(id: number) {
    this.data.rifles = this.data.rifles.filter(r => r.id !== id);
    this.save();
  }

  // ---- Venues ----
  getVenues(): Venue[] {
    return [...this.data.venues];
  }

  addVenue(venue: Omit<Venue, 'id'>): Venue {
    const newVenue: Venue = { ...venue, id: this.nextId() };
    this.data.venues.push(newVenue);
    this.save();
    return newVenue;
  }

  updateVenue(venue: Venue) {
    const idx = this.data.venues.findIndex(v => v.id === venue.id);
    if (idx >= 0) {
      this.data.venues[idx] = venue;
      this.save();
    }
  }

  deleteVenue(id: number) {
    this.data.venues = this.data.venues.filter(v => v.id !== id);
    this.save();
  }

  // ---- Sessions ----
  getSessions(): Session[] {
    return [...this.data.sessions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  addSession(session: Omit<Session, 'id'>): Session {
    const newSession: Session = { ...session, id: this.nextId() };
    this.data.sessions.push(newSession);
    this.save();
    return newSession;
  }

  deleteSession(id: number) {
    this.data.sessions = this.data.sessions.filter(s => s.id !== id);
    this.save();
  }

  // Convenience lookups
  getRifleById(id: number | null | undefined): Rifle | undefined {
    if (!id) return undefined;
    return this.data.rifles.find(r => r.id === id);
  }

  getVenueById(id: number | null | undefined): Venue | undefined {
    if (!id) return undefined;
    return this.data.venues.find(v => v.id === id);
  }
}
