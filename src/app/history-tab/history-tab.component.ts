import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService } from '../data.service';
import { Session, Rifle, Venue, SubRange, DistanceDope } from '../models';

@Component({
  selector: 'app-history-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './history-tab.component.html',
  styleUrls: ['./history-tab.component.css']
})
export class HistoryTabComponent implements OnInit {
  sessions: Session[] = [];
  rifles: Rifle[] = [];
  venues: Venue[] = [];

  // subRangeId -> SubRange lookup
  private subRangeMap = new Map<number, SubRange>();

  selectedSessionId: number | null = null;
  editSession: Session | null = null;

  constructor(private data: DataService) {}

  ngOnInit(): void {
    this.loadData();
  }

  private loadData() {
    this.sessions = [...this.data.getSessions()].sort((a, b) =>
      (b.date || '').localeCompare(a.date || '')
    );
    this.rifles = this.data.getRifles();
    this.venues = this.data.getVenues();

    this.subRangeMap.clear();
    for (const v of this.venues) {
      for (const sr of v.subRanges || []) {
        this.subRangeMap.set(sr.id, sr);
      }
    }
  }

  getRifleName(id: number): string {
    return this.rifles.find(r => r.id === id)?.name ?? 'Unknown rifle';
  }

  getVenueName(id: number): string {
    return this.venues.find(v => v.id === id)?.name ?? 'Unknown venue';
  }

  getSubRangeName(row: DistanceDope): string {
    if (!row.subRangeId) return '';
    return this.subRangeMap.get(row.subRangeId)?.name ?? '';
  }

  getStatusLabel(s: Session): string {
    return s.completed ? 'Completed' : 'Needs data';
  }

  getStatusClass(s: Session): string {
    return s.completed
      ? 'bg-emerald-500 text-slate-900'
      : 'bg-rose-400 text-slate-900';
  }

  selectSession(s: Session) {
    this.selectedSessionId = s.id;
    // deep clone so we don’t mutate list directly
    this.editSession = JSON.parse(JSON.stringify(s));
  }

  saveSession() {
    if (!this.editSession) return;
    const updated: Session = {
      ...this.editSession,
      completed: true  // Saving marks the session as completed
    };
    this.data.updateSession(updated);
    this.loadData();
    // Collapse editor after saving
    this.selectedSessionId = null;
    this.editSession = null;
  }

  deleteSession(s: Session) {
    if (!confirm('Delete this session from history?')) return;
    this.data.deleteSession(s.id);
    this.loadData();
    if (this.selectedSessionId === s.id) {
      this.selectedSessionId = null;
      this.editSession = null;
    }
  }
}
