import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService } from '../data.service';
import { Venue, SubRange } from '../models';

interface SubRangeForm {
  id: number | null;
  name: string;
  distancesText: string; // e.g. "500, 578, 780"
}

@Component({
  selector: 'app-venues-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './venues-tab.component.html',
  styleUrls: ['./venues-tab.component.css']
})
export class VenuesTabComponent implements OnInit {
  venues: Venue[] = [];

  formVisible = false;
  editingVenue: Venue | null = null;

  expandedVenueId: number | null = null;

  venueForm: Partial<Venue> = {
    name: '',
    location: '',
    altitudeM: undefined,
    notes: ''
  };

  // sub-range editor state (for the currently expanded venue)
  subForm: SubRangeForm = {
    id: null,
    name: '',
    distancesText: ''
  };

  constructor(private data: DataService) {}

  ngOnInit(): void {
    this.refresh();
  }

  // ---------- Helpers ----------

  private normalizeVenue(v: Venue): Venue {
    const subRanges: SubRange[] = (v.subRanges || []).map((s: any) => {
      let distances: number[] = [];
      if (Array.isArray(s.distancesM)) {
        distances = s.distancesM;
      } else if (typeof s.distanceM === 'number') {
        // backward compatibility with old data
        distances = [s.distanceM];
      } else if (Array.isArray(s.distances)) {
        distances = s.distances;
      }

      return {
        id: s.id,
        name: s.name || '',
        distancesM: distances || []
      };
    });

    return {
      ...v,
      subRanges
    };
  }

  private parseDistances(text: string): number[] {
    return (text || '')
      .split(/[;,]/)
      .map((t) => parseFloat(t.trim()))
      .filter((n) => !isNaN(n) && n > 0);
  }

  // ---------- Venue list / form ----------

  refresh() {
    this.venues = this.data.getVenues().map((v) => this.normalizeVenue(v));
  }

  toggleForm() {
    this.formVisible = !this.formVisible;
    if (this.formVisible && !this.editingVenue) {
      this.newVenue();
    }
  }

  newVenue() {
    this.editingVenue = null;
    this.venueForm = {
      name: '',
      location: '',
      altitudeM: undefined,
      notes: '',
      subRanges: []
    };
    this.formVisible = true;
  }

  editVenue(v: Venue) {
    this.editingVenue = v;
    this.venueForm = {
      id: v.id,
      name: v.name,
      location: v.location,
      altitudeM: v.altitudeM,
      notes: v.notes,
      subRanges: v.subRanges
    };
    this.formVisible = true;
  }

  saveVenue() {
    if (!this.venueForm.name) {
      alert('Venue name is required.');
      return;
    }

    const existingSubRanges: SubRange[] =
      (this.venueForm.subRanges as SubRange[]) || [];

    if (this.editingVenue) {
      const updated: Venue = {
        id: this.editingVenue.id,
        name: this.venueForm.name!,
        location: this.venueForm.location,
        altitudeM: this.venueForm.altitudeM,
        notes: this.venueForm.notes,
        subRanges: existingSubRanges
      };
      this.data.updateVenue(updated);
    } else {
      const toAdd: Omit<Venue, 'id'> = {
        name: this.venueForm.name!,
        location: this.venueForm.location,
        altitudeM: this.venueForm.altitudeM,
        notes: this.venueForm.notes,
        subRanges: existingSubRanges
      };
      this.data.addVenue(toAdd);
    }

    this.formVisible = false;
    this.editingVenue = null;
    this.refresh();
  }

  deleteVenue(v: Venue) {
    if (!confirm(`Delete venue "${v.name}"?`)) return;
    this.data.deleteVenue(v.id);
    this.refresh();
    if (this.expandedVenueId === v.id) {
      this.expandedVenueId = null;
    }
    if (this.editingVenue?.id === v.id) {
      this.formVisible = false;
      this.editingVenue = null;
    }
  }

  toggleExpanded(v: Venue) {
    this.expandedVenueId = this.expandedVenueId === v.id ? null : v.id;
    this.clearSubForm();
  }

  // ---------- Sub-range editing ----------

  clearSubForm() {
    this.subForm = {
      id: null,
      name: '',
      distancesText: ''
    };
  }

  startAddSubRange(v: Venue) {
    this.expandedVenueId = v.id;
    this.subForm = {
      id: null,
      name: '',
      distancesText: ''
    };
  }

  startEditSubRange(v: Venue, sr: SubRange) {
    this.expandedVenueId = v.id;
    this.subForm = {
      id: sr.id,
      name: sr.name,
      distancesText: (sr.distancesM || []).join(', ')
    };
  }

  saveSubRange(v: Venue) {
    if (!this.subForm.name.trim()) {
      alert('Sub-range name is required.');
      return;
    }

    const distances = this.parseDistances(this.subForm.distancesText);
    if (distances.length === 0) {
      alert('Enter at least one distance (comma separated).');
      return;
    }

    const venue = this.venues.find((x) => x.id === v.id);
    if (!venue) return;

    const subRanges = (venue.subRanges || []).map((sr) => ({ ...sr }));
    if (this.subForm.id == null) {
      const id = Date.now() + Math.random();
      subRanges.push({
        id,
        name: this.subForm.name.trim(),
        distancesM: distances
      });
    } else {
      const idx = subRanges.findIndex((sr) => sr.id === this.subForm.id);
      if (idx >= 0) {
        subRanges[idx] = {
          id: subRanges[idx].id,
          name: this.subForm.name.trim(),
          distancesM: distances
        };
      }
    }

    const updated: Venue = {
      ...venue,
      subRanges
    };
    this.data.updateVenue(updated);
    this.refresh();
    this.clearSubForm();
  }

  deleteSubRange(v: Venue, sr: SubRange) {
    if (!confirm(`Remove sub-range "${sr.name}"?`)) return;

    const venue = this.venues.find((x) => x.id === v.id);
    if (!venue) return;

    const subRanges = (venue.subRanges || []).filter((s) => s.id !== sr.id);
    const updated: Venue = { ...venue, subRanges };
    this.data.updateVenue(updated);
    this.refresh();

    if (this.subForm.id === sr.id) {
      this.clearSubForm();
    }
  }
}
