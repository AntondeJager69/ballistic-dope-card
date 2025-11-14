import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService } from '../data.service';
import {
  Rifle,
  ScopeClickUnit,
  Venue,
  SubRange,
  Environment,
  DistanceDope,
  Session
} from '../models';

interface WizardSubRange {
  id: number;
  name: string;
  distancesText: string;
}

@Component({
  selector: 'app-session-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './session-tab.component.html',
  styleUrls: ['./session-tab.component.css']
})
export class SessionTabComponent implements OnInit {
  rifles: Rifle[] = [];
  venues: Venue[] = [];

  selectedRifleId: number | null = null;
  selectedVenueId: number | null = null;

  environment: Environment = {};
  dopeRows: DistanceDope[] = [];
  notes = '';
  title = '';

  // ----- Rifle wizard -----
  showRifleWizard = false;
  rifleWizardForm: Partial<Rifle> = {
    name: '',
    caliber: '',
    scopeClickUnit: 'MIL'
  };
  clickUnits: ScopeClickUnit[] = ['MIL', 'MOA'];

  // ----- Venue wizard -----
  showVenueWizard = false;
  venueWizardForm: Partial<Venue> = {
    name: '',
    location: '',
    altitudeM: undefined,
    notes: ''
  };
  venueWizardSubRanges: WizardSubRange[] = [];

  constructor(private data: DataService) {}

  ngOnInit(): void {
    this.rifles = this.data.getRifles();
    this.venues = this.data.getVenues();

    if (this.rifles.length === 0) {
      this.showRifleWizard = true;
    }
    if (this.venues.length === 0) {
      this.showVenueWizard = true;
      if (this.venueWizardSubRanges.length === 0) {
        this.addVenueWizardSubRange();
      }
    }
  }

  // ---------- Utilities ----------

  private parseDistances(text: string): number[] {
    return (text || '')
      .split(/[;,]/)
      .map((t) => parseFloat(t.trim()))
      .filter((n) => !isNaN(n) && n > 0);
  }

  // ---------- Venue selection & dope rows ----------

  onVenueChange() {
    const venue = this.data.getVenueById(this.selectedVenueId);
    if (!venue) {
      this.dopeRows = [];
      return;
    }

    const rows: DistanceDope[] = [];
    (venue.subRanges || []).forEach((sr: any) => {
      let distances: number[] = [];
      if (Array.isArray(sr.distancesM)) {
        distances = sr.distancesM;
      } else if (typeof sr.distanceM === 'number') {
        // backward compatibility with older shape
        distances = [sr.distanceM];
      }

      distances.forEach((d: number) => {
        rows.push({
          subRangeId: sr.id,
          distanceM: d
        });
      });
    });

    this.dopeRows = rows;
  }

  // ---------- Rifle wizard ----------

  startRifleWizard() {
    this.showRifleWizard = true;
  }

  cancelRifleWizard() {
    this.showRifleWizard = false;
    this.rifleWizardForm = {
      name: '',
      caliber: '',
      scopeClickUnit: 'MIL'
    };
  }

  saveRifleFromWizard() {
    if (!this.rifleWizardForm.name || !this.rifleWizardForm.caliber) {
      alert('Please enter at least a rifle name and caliber.');
      return;
    }

    const newRifle = this.data.addRifle({
      name: this.rifleWizardForm.name!,
      caliber: this.rifleWizardForm.caliber!,
      scopeClickUnit: this.rifleWizardForm.scopeClickUnit
    });

    this.rifles = this.data.getRifles();
    this.selectedRifleId = newRifle.id;

    this.cancelRifleWizard();
  }

  // ---------- Venue wizard ----------

  startVenueWizard() {
    this.showVenueWizard = true;
    if (this.venueWizardSubRanges.length === 0) {
      this.addVenueWizardSubRange();
    }
  }

  cancelVenueWizard() {
    this.showVenueWizard = false;
    this.venueWizardForm = {
      name: '',
      location: '',
      altitudeM: undefined,
      notes: ''
    };
    this.venueWizardSubRanges = [];
  }

  addVenueWizardSubRange() {
    const id = Date.now() + Math.random();
    this.venueWizardSubRanges.push({
      id,
      name: '',
      distancesText: ''
    });
  }

  removeVenueWizardSubRange(sr: WizardSubRange) {
    this.venueWizardSubRanges = this.venueWizardSubRanges.filter(
      (s) => s.id !== sr.id
    );
  }

  saveVenueFromWizard() {
    if (!this.venueWizardForm.name) {
      alert('Please enter a venue name.');
      return;
    }

    const subRanges: SubRange[] = [];
    for (const ws of this.venueWizardSubRanges) {
      const name = ws.name.trim();
      const distances = this.parseDistances(ws.distancesText);
      if (!name || distances.length === 0) {
        continue;
      }
      subRanges.push({
        id: ws.id,
        name,
        distancesM: distances
      });
    }

    if (subRanges.length === 0) {
      alert('Add at least one sub-range with valid distances.');
      return;
    }

    const newVenue = this.data.addVenue({
      name: this.venueWizardForm.name!,
      location: this.venueWizardForm.location,
      altitudeM: this.venueWizardForm.altitudeM,
      notes: this.venueWizardForm.notes,
      subRanges
    });

    this.venues = this.data.getVenues();
    this.selectedVenueId = newVenue.id;
    this.onVenueChange();

    this.cancelVenueWizard();
  }

  // ---------- Session saving ----------

  saveSession() {
    if (!this.selectedRifleId || !this.selectedVenueId) {
      alert('Select a rifle and a venue before saving the session.');
      return;
    }

    const session: Omit<Session, 'id'> = {
      date: new Date().toISOString(),
      rifleId: this.selectedRifleId,
      venueId: this.selectedVenueId,
      title: this.title || undefined,
      environment: this.environment,
      dope: this.dopeRows,
      notes: this.notes || undefined
    };

    this.data.addSession(session);
    alert('Session saved to history.');
    this.reset();
  }

  reset() {
    this.selectedRifleId = null;
    this.selectedVenueId = null;
    this.environment = {};
    this.dopeRows = [];
    this.notes = '';
    this.title = '';

    this.rifles = this.data.getRifles();
    this.venues = this.data.getVenues();

    if (this.rifles.length === 0) {
      this.showRifleWizard = true;
    }
    if (this.venues.length === 0) {
      this.showVenueWizard = true;
      if (this.venueWizardSubRanges.length === 0) {
        this.addVenueWizardSubRange();
      }
    }
  }
}
