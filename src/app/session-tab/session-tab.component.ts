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
  venueWizardSubRanges: SubRange[] = [];

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

  // ----- Venue selection & dope rows -----

  onVenueChange() {
    const venue = this.data.getVenueById(this.selectedVenueId);
    if (!venue) {
      this.dopeRows = [];
      return;
    }

    this.dopeRows = venue.subRanges.map(sr => ({
      subRangeId: sr.id,
      distanceM: sr.distanceM
    }));
  }

  // ----- Rifle wizard -----

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

  // ----- Venue wizard -----

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
      distanceM: 100
    });
  }

  removeVenueWizardSubRange(sr: SubRange) {
    this.venueWizardSubRanges = this.venueWizardSubRanges.filter(s => s.id !== sr.id);
  }

  saveVenueFromWizard() {
    if (!this.venueWizardForm.name) {
      alert('Please enter a venue name.');
      return;
    }

    const cleanedSubRanges = this.venueWizardSubRanges
      .filter(sr => sr.distanceM && sr.distanceM > 0)
      .map(sr => ({
        ...sr,
        name: sr.name?.trim() || undefined
      }));

    if (cleanedSubRanges.length === 0) {
      alert('Add at least one sub-range with a valid distance.');
      return;
    }

    const newVenue = this.data.addVenue({
      name: this.venueWizardForm.name!,
      location: this.venueWizardForm.location,
      altitudeM: this.venueWizardForm.altitudeM,
      notes: this.venueWizardForm.notes,
      subRanges: cleanedSubRanges
    });

    this.venues = this.data.getVenues();
    this.selectedVenueId = newVenue.id;
    this.onVenueChange();

    this.cancelVenueWizard();
  }

  // ----- Session saving -----

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
