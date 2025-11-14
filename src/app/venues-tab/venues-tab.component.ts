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

  constructor(private data: DataService) {}

  ngOnInit(): void {
    this.refresh();
  }

  refresh() {
    this.venues = this.data.getVenues();
  }

  // ----- Sub-ranges inside the venue form -----

  addSubRangeRow() {
    if (!this.form.subRanges) this.form.subRanges = [];
    const id = Date.now() + Math.random();
    const subRange: SubRange = {
      id,
      name: '',
      distanceM: 100
    };
    this.form.subRanges.push(subRange);
  }

  removeSubRangeRow(sr: SubRange) {
    if (!this.form.subRanges) return;
    this.form.subRanges = this.form.subRanges.filter(s => s.id !== sr.id);
  }

  // ----- Editing -----

  edit(venue: Venue) {
    this.editing = venue;
    this.form = {
      id: venue.id,
      name: venue.name,
      location: venue.location,
      altitudeM: venue.altitudeM,
      notes: venue.notes,
      subRanges: venue.subRanges.map(sr => ({ ...sr }))
    };
  }

  resetForm() {
    this.editing = null;
    this.form = {
      name: '',
      location: '',
      altitudeM: undefined,
      notes: '',
      subRanges: []
    };
  }

  // ----- Save / delete -----

  save() {
    if (!this.form.name) {
      alert('Venue name is required.');
      return;
    }

    if (!this.form.subRanges || this.form.subRanges.length === 0) {
      alert('Add at least one sub-range (distance & optional name) for this venue.');
      return;
    }

    const cleanedSubRanges: SubRange[] = (this.form.subRanges || [])
      .filter(sr => sr.distanceM && sr.distanceM > 0)
      .map(sr => ({
        ...sr,
        name: sr.name?.trim() || undefined
      }));

    if (cleanedSubRanges.length === 0) {
      alert('At least one sub-range must have a valid distance.');
      return;
    }

    if (this.editing) {
      const updated: Venue = {
        id: this.editing.id,
        name: this.form.name!,
        location: this.form.location,
        altitudeM: this.form.altitudeM,
        notes: this.form.notes,
        subRanges: cleanedSubRanges
      };
      this.data.updateVenue(updated);
    } else {
      this.data.addVenue({
        name: this.form.name!,
        location: this.form.location,
        altitudeM: this.form.altitudeM,
        notes: this.form.notes,
        subRanges: cleanedSubRanges
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
