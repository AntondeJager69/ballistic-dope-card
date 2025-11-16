import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService } from '../data.service';
import {
  Rifle,
  Venue,
  SubRange,
  Environment,
  DistanceDope,
  Session
} from '../models';

type WizardStep = 'setup' | 'environment' | 'shots' | 'complete';

@Component({
  selector: 'app-session-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './session-tab.component.html',
  styleUrls: ['./session-tab.component.css']
})
export class SessionTabComponent implements OnInit {
  step: WizardStep = 'setup';

  rifles: Rifle[] = [];
  venues: Venue[] = [];

  selectedRifleId: number | null = null;
  selectedVenueId: number | null = null;
  selectedSubRangeId: number | null = null;

  title = '';
  environment: Environment = {};

  // NEW: wind clock (1–12, relative to 12 o’clock = target)
  windClock: number | null = null;

  shotCount: number | null = null;
  selectedDistances: number[] = [];
  notes = '';

  dopeRows: DistanceDope[] = [];
  completeMessage = '';

  constructor(private data: DataService) {}

  ngOnInit(): void {
    this.rifles = this.data.getRifles();
    this.venues = this.data.getVenues();
  }

  get selectedVenue(): Venue | undefined {
    return this.venues.find(v => v.id === this.selectedVenueId);
  }

  get subRanges(): SubRange[] {
    const v = this.selectedVenue;
    return v?.subRanges ?? [];
  }

  get selectedSubRange(): SubRange | undefined {
    const list = this.subRanges;
    return list.find(sr => sr.id === this.selectedSubRangeId);
  }

  get distanceOptions(): number[] {
    const sr = this.selectedSubRange;
    return sr?.distancesM ?? [];
  }

  // ---------- Wind hint text ----------

  get windHint(): string {
    const speed = this.environment.windSpeedMps;
    let clock = this.windClock;
    if (!clock || !speed || speed <= 0) return '';

    // Normalize clock to 1..12
    clock = ((clock - 1) % 12) + 1;

    const c = clock;
    const isFront = c === 11 || c === 12 || c === 1;
    const isBack = c === 5 || c === 6 || c === 7;
    const isRight = c >= 1 && c <= 5;   // wind from right side
    const isLeft = c >= 7 && c <= 11;   // wind from left side

    let directionText = '';

    if (isFront && isRight) directionText = 'slightly low with drift to the left';
    else if (isFront && isLeft) directionText = 'slightly low with drift to the right';
    else if (isFront) directionText = 'slightly low, minimal left/right drift';
    else if (isBack && isRight) directionText = 'slightly high with drift to the left';
    else if (isBack && isLeft) directionText = 'slightly high with drift to the right';
    else if (isBack) directionText = 'slightly high, minimal left/right drift';
    else if (isRight) directionText = 'drift to the left';
    else if (isLeft) directionText = 'drift to the right';

    let intensity = '';
    if (speed < 2) intensity = 'Very light wind – small effect.';
    else if (speed < 5) intensity = 'Light wind – moderate correction.';
    else if (speed < 8) intensity = 'Medium wind – expect noticeable drift.';
    else intensity = 'Strong wind – expect significant drift.';

    return `Wind from ${c} o'clock at ${speed} m/s: expect ${directionText}. ${intensity}`;
  }

  // ---------- Setup step ----------

  onVenueChange() {
    const srs = this.subRanges;
    if (srs.length > 0) {
      this.selectedSubRangeId = srs[0].id;
    } else {
      this.selectedSubRangeId = null;
    }
    this.selectedDistances = [];
  }

  onSubRangeChange() {
    this.selectedDistances = [];
  }

  nextFromSetup() {
    if (!this.title.trim()) {
      alert('Please enter a session title.');
      return;
    }
    if (!this.selectedRifleId) {
      alert('Please select a rifle.');
      return;
    }
    if (!this.selectedVenueId) {
      alert('Please select a venue.');
      return;
    }
    if (!this.selectedSubRangeId) {
      alert('Please select a sub-range at the venue.');
      return;
    }

    this.step = 'environment';
  }

  // ---------- Environment step ----------

  nextFromEnvironment() {
    // Convert windClock -> approximate windDirectionDeg (0° = from target / headwind)
    if (this.windClock != null) {
      let c = ((this.windClock - 1) % 12) + 1; // 1..12
      const fraction = c === 12 ? 0 : c / 12;
      const deg = Math.round(fraction * 360);
      this.environment.windDirectionDeg = deg;
    } else {
      this.environment.windDirectionDeg = undefined;
    }

    this.step = 'shots';
  }

  // ---------- Shot planning step ----------

  toggleDistance(d: number) {
    if (this.selectedDistances.includes(d)) {
      this.selectedDistances = this.selectedDistances.filter(x => x !== d);
    } else {
      this.selectedDistances = [...this.selectedDistances, d].sort((a, b) => a - b);
    }
  }

  goShoot() {
    if (this.selectedDistances.length === 0) {
      alert('Select at least one distance to shoot.');
      return;
    }
    if (!this.selectedRifleId || !this.selectedVenueId || !this.selectedSubRangeId) {
      alert('Setup is incomplete. Please go back and select rifle, venue and sub-range.');
      return;
    }

    // Build dope rows for each selected distance
    this.dopeRows = this.selectedDistances.map(distance => ({
      subRangeId: this.selectedSubRangeId!,
      distanceM: distance
    }));

    const sessionNotesParts: string[] = [];
    if (this.notes?.trim()) {
      sessionNotesParts.push(this.notes.trim());
    }
    const sr = this.selectedSubRange;
    const countText =
      this.shotCount && this.shotCount > 0
        ? `${this.shotCount} shots planned`
        : 'Shot count not specified';

    sessionNotesParts.push(
      `${countText} at distances: ${this.selectedDistances.join(', ')} m` +
        (sr ? ` on sub-range "${sr.name}"` : '')
    );

    const sessionToSave: Omit<Session, 'id'> = {
      date: new Date().toISOString(),
      rifleId: this.selectedRifleId,
      venueId: this.selectedVenueId,
      title: this.title || undefined,
      environment: this.environment,
      dope: this.dopeRows,
      notes: sessionNotesParts.join(' | '),
      completed: false
    };

    this.data.addSession(sessionToSave);

    // increment rifle round count using planned shot count (if set)
    if (this.shotCount && this.shotCount > 0) {
      this.data.incrementRifleRoundCount(this.selectedRifleId, this.shotCount);
    }

    this.completeMessage =
      'Session saved to History. Go shoot! After you are done, open the History tab to enter your actual dope.';
    this.step = 'complete';
  }

  // ---------- Navigation ----------

  backToSetup() {
    this.step = 'setup';
  }

  backToEnvironment() {
    this.step = 'environment';
  }

  newSession() {
    this.step = 'setup';
    this.title = '';
    this.selectedRifleId = null;
    this.selectedVenueId = null;
    this.selectedSubRangeId = null;
    this.environment = {};
    this.windClock = null;
    this.shotCount = null;
    this.selectedDistances = [];
    this.notes = '';
    this.dopeRows = [];
    this.completeMessage = '';
    this.rifles = this.data.getRifles();
    this.venues = this.data.getVenues();
  }
}
