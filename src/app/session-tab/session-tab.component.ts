import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService } from '../data.service';
import { Rifle, Venue, Environment, DistanceDope, Session } from '../models';

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

  constructor(private data: DataService) {}

  ngOnInit(): void {
    this.rifles = this.data.getRifles();
    this.venues = this.data.getVenues();
  }

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

  saveSession() {
    if (!this.selectedRifleId || !this.selectedVenueId) {
      alert('Select rifle and venue.');
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
  }
}
