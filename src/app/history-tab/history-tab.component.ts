import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService } from '../data.service';

@Component({
  selector: 'app-history-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './history-tab.component.html'
})
export class HistoryTabComponent implements OnInit {
  sessions: any[] = [];
  // NEW: highlighted sessions that still need DOPE capture
  pendingSessions: any[] = [];
  notesExpanded: boolean = false; 
  selectedSessionId: string | null = null;
  editSession: any | null = null;
  validationError: string | null = null;
  saveMessage: string | null = null;
  private saveMessageTimeout: any = null;

  searchTerm: string = '';
  expandedVenueId: number | null = null;

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.loadSessions();
  }

  private loadSessions(): void {
    try {
      const ds: any = this.dataService;
      if (ds && typeof ds.getSessions === 'function') {
        this.sessions = ds.getSessions() || [];
      } else if (ds && typeof ds.loadSessions === 'function') {
        this.sessions = ds.loadSessions() || [];
      } else {
        console.warn('DataService has no getSessions/loadSessions – using empty history.');
        this.sessions = [];
      }
    } catch (err) {
      console.error('Error loading sessions in HistoryTab:', err);
      this.sessions = [];
    }

    this.rebuildPendingSessions();
  }

  // --------------------------------------------------
  // Status helpers
  // --------------------------------------------------
  getStatusLabel(s: any): string {
    if (s.completed) return 'Completed';
    if (s.dope && s.dope.length > 0) return 'In progress';
    return 'Planned';
  }

  getStatusClass(s: any): string {
    const base = 'px-2 py-[2px] rounded-full text-[10px] font-semibold ';
    if (s.completed) {
      return base + 'bg-emerald-500 text-slate-900';
    }
    if (s.dope && s.dope.length > 0) {
      return base + 'bg-amber-400 text-slate-900';
    }
    return base + 'bg-slate-600 text-slate-100';
  }

  // --------------------------------------------------
  // Rifle / venue lookup helpers
  // --------------------------------------------------
  getRifleName(rifleId: string | null | undefined): string {
    try {
      const ds: any = this.dataService;
      if (!rifleId || !ds || typeof ds.getRifles !== 'function') {
        return 'Unknown rifle';
      }
      const rifle = ds.getRifles().find((r: any) => r.id === rifleId);
      return rifle ? rifle.name : 'Unknown rifle';
    } catch {
      return 'Unknown rifle';
    }
  }

  getVenueName(venueId: string | null | undefined): string {
    try {
      const ds: any = this.dataService;
      if (!venueId || !ds || typeof ds.getVenues !== 'function') {
        return 'Unknown venue';
      }
      const venue = ds.getVenues().find((v: any) => v.id === venueId);
      return venue ? venue.name : 'Unknown venue';
    } catch {
      return 'Unknown venue';
    }
  }

  // --------------------------------------------------
  // Search & grouping for venue-based history view
  // --------------------------------------------------
  get filteredSessions(): any[] {
    // Normal History block shows only non-editable sessions.
    const base = (this.sessions || []).filter(
      (s: any) => !this.isSessionEditable(s)
    );

    const term = this.searchTerm?.trim().toLowerCase();
    if (!term) {
      return base;
    }

    return base.filter((s: any) => {
      const venueName = (this.getVenueName(s.venueId) || '').toLowerCase();
      const rifleName = (this.getRifleName(s.rifleId) || '').toLowerCase();
      const title = (s.title || '').toLowerCase();
      const notes = (s.notes || '').toLowerCase();
      return (
        venueName.includes(term) ||
        rifleName.includes(term) ||
        title.includes(term) ||
        notes.includes(term)
      );
    });
  }

  get venueGroups(): { venueId: number | null; venueName: string; sessions: any[] }[] {
    const map = new Map<number | null, { venueId: number | null; venueName: string; sessions: any[] }>();

    for (const s of this.filteredSessions) {
      const vid = (s.venueId ?? null) as number | null;
      const vname = this.getVenueName(s.venueId) || 'Unknown venue';
      let group = map.get(vid);
      if (!group) {
        group = { venueId: vid, venueName: vname, sessions: [] };
        map.set(vid, group);
      }
      group.sessions.push(s);
    }

    const groups = Array.from(map.values());

    // sort sessions in each group by date (oldest → newest)
    for (const g of groups) {
      g.sessions.sort((a, b) => this.getSessionTime(a) - this.getSessionTime(b));
    }

    // sort venues alphabetically
    groups.sort((a, b) => a.venueName.localeCompare(b.venueName));
    return groups;
  }

  private getSessionTime(s: any): number {
    if (!s || !s.date) return 0;
    return new Date(s.date).getTime();
  }

  // Build the “needs DOPE” list (highlighted at top)
  private rebuildPendingSessions(): void {
    if (!Array.isArray(this.sessions)) {
      this.pendingSessions = [];
      return;
    }

    this.pendingSessions = this.sessions
      .filter(s => this.isSessionEditable(s) && !s.completed)
      .sort((a, b) => this.getSessionTime(b) - this.getSessionTime(a)); // newest first
  }

  clearSearch(): void {
    this.searchTerm = '';
  }

  toggleVenue(venueId: number | null): void {
    this.expandedVenueId = this.expandedVenueId === venueId ? null : venueId;
  }

  summarizeDateRange(sessions: any[]): string {
    if (!sessions || sessions.length === 0) return '';
    const sorted = [...sessions].sort((a, b) => this.getSessionTime(a) - this.getSessionTime(b));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const firstDate = new Date(first.date);
    const lastDate = new Date(last.date);
    const firstStr = firstDate.toLocaleDateString();
    const lastStr = lastDate.toLocaleDateString();
    if (firstStr === lastStr) {
      return firstStr;
    }
    return `${firstStr} → ${lastStr}`;
  }

  // --------------------------------------------------
  // Selecting / deleting sessions
  // --------------------------------------------------
  selectSession(s: any): void {
    this.selectedSessionId = s.id;
    this.validationError = null;
    this.clearSaveMessage();

    // Deep clone so we can edit safely
    this.editSession = JSON.parse(JSON.stringify(s));
  }
deleteSession(s: any): void {
  if (!s || !s.id) return;

  const confirmed = confirm(
    'Delete this session from history? This cannot be undone.'
  );
  if (!confirmed) return;

  const id = s.id;

  // Remove from local sessions array
  const idx = this.sessions.findIndex(sess => sess.id === id);
  if (idx >= 0) {
    this.sessions.splice(idx, 1);
  }

  // Persist via DataService
  try {
    const ds: any = this.dataService;
    if (ds && typeof ds.deleteSession === 'function') {
      ds.deleteSession(id);
    }
  } catch (err) {
    console.error('Error deleting session from DataService:', err);
  }

  // If this was the open session, close the detail view
  if (this.selectedSessionId === id) {
    this.selectedSessionId = null;
    this.editSession = null;
  }

  // 🔥 IMPORTANT: refresh yellow block at the top
  this.rebuildPendingSessions();
}

  // --------------------------------------------------
  // Editable rules for DOPE
  // --------------------------------------------------

  /**
   * Session is editable (In progress) if:
   * - has DOPE array,
   * - not completed yet
   */
  isSessionEditable(session: any | null): boolean {
    return !!(
      session &&
      !session.completed &&
      Array.isArray(session.dope) &&
      session.dope.length > 0
    );
  }

  /**
   * True only if every DOPE row has all fields filled:
   * elevationMil, windageMil, windSpeed, windDirection.
   */
  isSessionFullyCompleted(session: any | null): boolean {
    if (
      !session ||
      !Array.isArray(session.dope) ||
      session.dope.length === 0
    ) {
      return false;
    }
    return !session.dope.some((row: any) => !this.isRowComplete(row));
  }

  private isRowComplete(row: any): boolean {
    if (!row) return false;
    if (row.distanceM == null) return false;
    if (row.elevationMil === null || row.elevationMil === undefined || row.elevationMil === '') return false;
    if (row.windageMil === null || row.windageMil === undefined || row.windageMil === '') return false;
    if (row.windSpeed === null || row.windSpeed === undefined || row.windSpeed === '') return false;
    if (row.windDirection === null || row.windDirection === undefined || row.windDirection === '') return false;
    return true;
  }

  // --------------------------------------------------
  // Wind auto-fill & helpers
  // --------------------------------------------------
  autoFillWindFromEnvironment(): void {
    if (!this.editSession || !this.editSession.environment || !Array.isArray(this.editSession.dope)) {
      return;
    }

    const env = this.editSession.environment;

    const envWindSpeed =
      env.windSpeedMps ??
      env.windSpeedKph ??
      env.windSpeedMph ??
      null;

    let envClock: number | null = null;

    if (env.windDirectionDeg != null) {
      envClock = this.degreesToClock(env.windDirectionDeg);
    } else {
      let envWindDirRaw: any = env.windDirection ?? null;
      if (envWindDirRaw != null) {
        if (typeof envWindDirRaw === 'number') {
          envClock = this.degreesToClock(envWindDirRaw);
        } else {
          const str = String(envWindDirRaw);
          const parsed = parseFloat(str);
          if (!isNaN(parsed)) {
            if (parsed > 12 || str.includes('°')) {
              // treat as degrees
              envClock = this.degreesToClock(parsed);
            } else {
              // already a clock value
              envClock = parsed;
            }
          }
        }
      }
    }

    for (const row of this.editSession.dope) {
      if (row.windSpeed == null && envWindSpeed != null) {
        row.windSpeed = envWindSpeed;
        row._windSpeedAuto = true;
      }
      if (row.windDirection == null && envClock != null) {
        row.windDirection = envClock.toString(); // store as "3", "9", etc.
        row._windDirectionAuto = true;
      }
    }
  }

  wasAutoFilled(row: any, field: 'windSpeed' | 'windDirection'): boolean {
    if (!row) return false;
    return field === 'windSpeed' ? !!row._windSpeedAuto : !!row._windDirectionAuto;
  }

  private degreesToArrow(deg: number): string {
    const normalized = ((deg % 360) + 360) % 360;

    if (normalized >= 337.5 || normalized < 22.5) return '↑';
    if (normalized >= 22.5 && normalized < 67.5) return '↗';
    if (normalized >= 67.5 && normalized < 112.5) return '→';
    if (normalized >= 112.5 && normalized < 157.5) return '↘';
    if (normalized >= 157.5 && normalized < 202.5) return '↓';
    if (normalized >= 202.5 && normalized < 247.5) return '↙';
    if (normalized >= 247.5 && normalized < 292.5) return '←';
    return '↖';
  }

  // 12 o'clock (headwind) = 0°, 3 o'clock (from right) = 90°, etc.
  private clockToDegrees(clock: number): number {
    let c = clock;
    if (c < 1) c = 1;
    if (c > 12) c = 12;
    return (c % 12) * 30;
  }

  private degreesToClock(deg: number): number {
    let d = ((deg % 360) + 360) % 360;
    const hour = Math.round(d / 30) % 12 || 12;
    return hour;
  }

  getWindArrow(row: any): string {
    if (!row) return '•';

    let dirRaw: any = row.windDirection;

    // If row has nothing, try environment
    if (dirRaw == null && this.editSession?.environment) {
      dirRaw =
        this.editSession.environment.windDirectionDeg ??
        this.editSession.environment.windDirection ??
        null;
    }

    if (dirRaw == null) return '•';

    const str = String(dirRaw).trim();

    // Case 1: "3 o'clock" style
    if (str.includes("o'clock")) {
      const num = parseFloat(str);
      if (!isNaN(num) && num >= 1 && num <= 12) {
        const degFromClock = this.clockToDegrees(num);
        return this.degreesToArrow(degFromClock);
      }
    }

    const num = parseFloat(str);
    if (!isNaN(num)) {
      if (num >= 1 && num <= 12 && !str.includes('°')) {
        // Treat 1–12 as clock (target at 12 o'clock)
        const degFromClock = this.clockToDegrees(num);
        return this.degreesToArrow(degFromClock);
      }

      // Treat anything else as degrees
      return this.degreesToArrow(num);
    }

    // Fallback: no idea, show dot
    return '•';
  }

  // --------------------------------------------------
  // Save logic (in-progress vs completed)
  // --------------------------------------------------
  onPrimarySaveClick(): void {
    if (!this.editSession) return;

    if (!this.isSessionEditable(this.editSession)) {
      // In read-only states, primary button is simply Close, so bail here.
      return;
    }

    if (!this.isSessionFullyCompleted(this.editSession)) {
      // Partial, still in-progress.
      this.saveInProgress();
      return;
    }

    // Fully completed DOPE -> mark session completed
    this.saveAndComplete();
  }

  /** Save partial DOPE, keep session In progress, show toast. */
  private saveInProgress(): void {
    if (!this.editSession) return;

    this.validationError = null;

    const idx = this.sessions.findIndex(s => s.id === this.editSession!.id);
    if (idx >= 0) {
      this.sessions[idx] = { ...this.editSession, completed: false };
      this.persistSessions();
      this.rebuildPendingSessions();
      this.showSaveMessage('Session saved (In progress).');
    }
  }

  /** Save DOPE and mark as Completed, show toast. */
  private saveAndComplete(): void {
    if (!this.editSession) return;

    // Final validation
    if (!this.isSessionFullyCompleted(this.editSession)) {
      this.validationError = 'Please fill all DOPE fields (elevation, wind, speed, direction).';
      return;
    }

    this.validationError = null;

    const idx = this.sessions.findIndex(s => s.id === this.editSession!.id);
    if (idx >= 0) {
      this.sessions[idx] = { ...this.editSession, completed: true };
      this.persistSessions();
      this.rebuildPendingSessions();
      this.showSaveMessage('Session saved & marked as completed.');

      // NEW: collapse back to History view
      this.editSession = null;
      this.selectedSessionId = null;
      this.expandedVenueId = null;
    }
  }

   private persistSessions(): void {
    try {
      const ds: any = this.dataService;
      // DataService has updateSession(), not saveSessions().
      if (ds && typeof ds.updateSession === 'function') {
        for (const s of this.sessions) {
          ds.updateSession(s);
        }
      }
    } catch (err) {
      console.error('Error persisting sessions from HistoryTab:', err);
    }
  }

  private showSaveMessage(msg: string): void {
    this.saveMessage = msg;
    if (this.saveMessageTimeout) {
      clearTimeout(this.saveMessageTimeout);
    }
    this.saveMessageTimeout = setTimeout(() => {
      this.saveMessage = null;
      this.saveMessageTimeout = null;
    }, 2500);
  }

  private clearSaveMessage(): void {
    if (this.saveMessageTimeout) {
      clearTimeout(this.saveMessageTimeout);
      this.saveMessageTimeout = null;
    }
    this.saveMessage = null;
  }

  // --------------------------------------------------
  // Closing detail
  // --------------------------------------------------
  closeEdit(): void {
    this.editSession = null;
    this.validationError = null;
    this.clearSaveMessage();
  }
}
