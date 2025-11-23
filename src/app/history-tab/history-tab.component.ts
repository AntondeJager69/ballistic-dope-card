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
  selectedSessionId: string | null = null;
  editSession: any | null = null;
  validationError: string | null = null;
  saveMessage: string | null = null;
  private saveMessageTimeout: any = null;

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
  }

  // --------------------------------------------------
  // State helpers
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

  /**
   * Editable only if:
   * - has DOPE rows, and
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
  // Selecting / deleting sessions
  // --------------------------------------------------
  selectSession(s: any): void {
    this.selectedSessionId = s.id;
    this.validationError = null;
    this.clearSaveMessage();

    // Deep clone so we can edit safely
    this.editSession = JSON.parse(JSON.stringify(s));

    if (!this.editSession.dope) {
      this.editSession.dope = [];
    }

    this.applyWindDefaultsToDope();
  }

  deleteSession(s: any): void {
    if (!confirm('Delete this session from history?')) return;

    this.sessions = this.sessions.filter(sess => sess.id !== s.id);
    if (this.selectedSessionId === s.id) {
      this.selectedSessionId = null;
      this.editSession = null;
    }

    // Persist deletion if DataService supports it
    try {
      const ds: any = this.dataService;
      if (ds && typeof ds.saveSessions === 'function') {
        ds.saveSessions(this.sessions);
      } else if (ds && typeof ds.deleteSession === 'function') {
        ds.deleteSession(s.id);
      }
    } catch (err) {
      console.error('Error deleting session via DataService:', err);
    }
  }

  // --------------------------------------------------
  // Wind defaults + arrows (display + assists)
  // --------------------------------------------------
  /**
   * Fill windSpeed / windDirection from recorded environment
   * for rows that don't have values yet.
   * windDirection is stored as CLOCK (1–12) when auto-filled.
   */
  private applyWindDefaultsToDope(): void {
    if (!this.editSession || !Array.isArray(this.editSession.dope)) return;

    const env = this.editSession.environment || {};
    const envWindSpeed = env.windSpeedMps ?? env.windSpeed ?? null;
    const envWindDirRaw = env.windDirectionDeg ?? env.windDirection ?? null;

    let envClock: number | null = null;
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

  /**
   * Compute a wind arrow symbol based on wind direction.
   * Accepts:
   * - clock values 1–12 (or "3 o'clock")
   * - degrees (0–360)
   * If only env has it, uses env as fallback.
   */
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
      // Otherwise treat as degrees
      return this.degreesToArrow(num);
    }

    return '•';
  }

  /**
   * 8-way arrow: ↑, ↗, →, ↘, ↓, ↙, ←, ↖
   */
  private degreesToArrow(deg: number): string {
    let d = deg % 360;
    if (d < 0) d += 360;

    if (d >= 337.5 || d < 22.5) return '↑';
    if (d >= 22.5 && d < 67.5) return '↗';
    if (d >= 67.5 && d < 112.5) return '→';
    if (d >= 112.5 && d < 157.5) return '↘';
    if (d >= 157.5 && d < 202.5) return '↓';
    if (d >= 202.5 && d < 247.5) return '↙';
    if (d >= 247.5 && d < 292.5) return '←';
    return '↖';
  }

  /** Convert clock (1–12, target at 12) to degrees “from” direction */
  private clockToDegrees(clock: number): number {
    const c = ((clock % 12) + 12) % 12; // normalize
    // 12 -> 0°, 3 -> 90°, 6 -> 180°, 9 -> 270°
    return c === 0 ? 0 : (c / 12) * 360;
  }

  /** Convert degrees (0–360) to nearest clock number 1–12 (target at 12) */
  private degreesToClock(deg: number): number {
    let d = deg % 360;
    if (d < 0) d += 360;
    // 30° per “hour”; round to nearest
    let hour = Math.round(d / 30) % 12;
    if (hour === 0) hour = 12;
    return hour;
  }

  // --------------------------------------------------
  // Save behaviour: in-progress vs complete
  // --------------------------------------------------
  onPrimarySaveClick(): void {
    if (!this.editSession) return;

    if (this.isSessionFullyCompleted(this.editSession)) {
      this.saveAndComplete();
    } else {
      this.saveInProgress();
    }
  }

  /** Save partial DOPE, keep session In progress, show toast. */
  private saveInProgress(): void {
    if (!this.editSession) return;

    this.validationError = null;

    const idx = this.sessions.findIndex(s => s.id === this.editSession!.id);
    if (idx >= 0) {
      this.sessions[idx] = { ...this.editSession };
    }

    // Persist updated sessions if DataService supports it
    try {
      const ds: any = this.dataService;
      if (ds && typeof ds.saveSessions === 'function') {
        ds.saveSessions(this.sessions);
      } else if (ds && typeof ds.updateSession === 'function') {
        ds.updateSession(this.editSession);
      }
    } catch (err) {
      console.error('Error saving in-progress session from HistoryTab:', err);
    }

    this.showSaveMessage('Saved. Session remains In Progress.');
  }

  /** Save ONLY if all rows complete, then mark completed and close. */
  private saveAndComplete(): void {
    if (!this.editSession) return;

    if (!this.isSessionEditable(this.editSession)) {
      this.validationError =
        'This session is not editable here. Only "In progress" sessions with DOPE can be edited.';
      return;
    }

    // Double-check completeness before finalising
    if (!this.isSessionFullyCompleted(this.editSession)) {
      this.validationError =
        'Please complete Elevation, Windage, Wind speed and Wind direction for every distance before marking this session as completed.';
      return;
    }

    this.validationError = null;

    // Mark completed
    this.editSession.completed = true;

    // Write edited session back into sessions list
    const idx = this.sessions.findIndex(s => s.id === this.editSession!.id);
    if (idx >= 0) {
      this.sessions[idx] = { ...this.editSession };
    }

    // Persist updated sessions if DataService supports it
    try {
      const ds: any = this.dataService;
      if (ds && typeof ds.saveSessions === 'function') {
        ds.saveSessions(this.sessions);
      } else if (ds && typeof ds.updateSession === 'function') {
        ds.updateSession(this.editSession);
      }
    } catch (err) {
      console.error('Error saving completed session from HistoryTab:', err);
    }

    // Close detail view
    this.editSession = null;
    this.clearSaveMessage();
  }

  // --------------------------------------------------
  // Toast helper
  // --------------------------------------------------
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
  // Closing detail (no changes)
  // --------------------------------------------------
  closeEdit(): void {
    this.editSession = null;
    this.validationError = null;
    this.clearSaveMessage();
  }
}
