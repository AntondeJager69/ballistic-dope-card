import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService } from '../data.service';
import { Venue, SubRange } from '../models';

@Component({
  selector: 'app-venues-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './venues-tab.component.html',
  styleUrls: ['./venues-tab.component.css']
})
export class VenuesTabComponent implements OnInit {
  venues: Venue[] = [];
  editing: Venue | null = null;

  form: Partial<Venue> = {
    name: '',
    subRanges: []
  };

  subRangeDistance = 100;

  constructor(private data: DataService) {}

  ngOnInit(): void {
    this.refresh();
  }

  refresh() {
    this.venues = this.data.getVenues();
  }

  addSubRange() {
    if (!this.form.subRanges) this.form.subRanges = [];
    const id = Date.now() + Math.random();
    const subRange: SubRange = {
      id,
      distanceM: this.subRangeDistance
    };
    this.form.subRanges.push(subRange);
    this.subRangeDistance = this.subRangeDistance + 50;
  }

  removeSubRange(sr: SubRange) {
    if (!this.form.subRanges) return;
    this.form.subRanges = this.form.subRanges.filter(s => s.id !== sr.id);
  }

  edit(venue: Venue) {
    this.editing = venue;
    this.form = { ...venue, subRanges: venue.subRanges.map(sr => ({ ...sr })) };
  }

  resetForm() {
    this.editing = null;
    this.form = {
      name: '',
      subRanges: []
    };
    this.subRangeDistance = 100;
  }

  save() {
    if (!this.form.name) {
      alert('Venue name is required.');
      return;
    }

    const baseVenue: Venue = {
      id: this.editing?.id || 0,
      name: this.form.name!,
      location: this.form.location,
      altitudeM: this.form.altitudeM,
      notes: this.form.notes,
      subRanges: this.form.subRanges || []
    };

    if (this.editing) {
      this.data.updateVenue(baseVenue);
    } else {
      this.data.addVenue({
        name: baseVenue.name,
        location: baseVenue.location,
        altitudeM: baseVenue.altitudeM,
        notes: baseVenue.notes,
        subRanges: baseVenue.subRanges
      });
    }

    this.resetForm();
    this.refresh();
  }

  delete(venue: Venue) {
    if (confirm(`Delete venue "${venue.name}"?`)) {
      this.data.deleteVenue(venue.id);
      this.refresh();
      if (this.editing?.id === venue.id) {
        this.resetForm();
      }
    }
  }
}
