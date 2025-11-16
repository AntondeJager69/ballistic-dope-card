import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService } from '../data.service';
import { Venue, SubRange } from '../models';

interface SubRangeRow {
  id: number;
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

  venueForm: Partial<Venue> = {
    name: '',
    location: '',
    altitudeM: undefined,
    notes: ''
  };

  // Sub-ranges being edited/added in the top form
  venueSubRangesForm: SubRangeRow[] = [];

  // For collapsing / expanding stored venue cards
  expandedVenueId: number | null = null;

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

    return { ...v, subRanges };
  }

  private parseDistances(text: string): number[] {
    return (text || '')
      .split(/[;,]/)
      .map(t => parseFloat(t.trim()))
      .filter(n => !isNaN(n) && n > 0);
  }

  private ensureAtLeastOneSubRangeRow() {
    if (this.venueSubRangesForm.length === 0) {
      this.venueSubRangesForm.push({
        id: Date.now() + Math.random(),
        name: '',
        distancesText: ''
      });
    }
  }

  // ---------- Load venues from storage ----------

  refresh() {
    this.venues = this.data.getVenues().map(v => this.normalizeVenue(v));
  }

  // ---------- Top form: add / edit venue & its subranges ----------

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
      notes: ''
    };
    this.venueSubRangesForm = [];
    this.ensureAtLeastOneSubRangeRow();
    this.formVisible = true;
  }

  editVenue(v: Venue) {
    const normalized = this.normalizeVenue(v);
    this.editingVenue = normalized;

    this.venueForm = {
      id: normalized.id,
      name: normalized.name,
      location: normalized.location,
      altitudeM: normalized.altitudeM,
      notes: normalized.notes
    };

    this.venueSubRangesForm =
      normalized.subRanges.length > 0
        ? normalized.subRanges.map(sr => ({
            id: sr.id,
            name: sr.name,
            distancesText: (sr.distancesM || []).join(', ')
          }))
        : [];

    this.ensureAtLeastOneSubRangeRow();
    this.formVisible = true;
  }

  addSubRangeRow() {
    this.venueSubRangesForm.push({
      id: Date.now() + Math.random(),
      name: '',
      distancesText: ''
    });
  }

  removeSubRangeRow(row: SubRangeRow) {
    this.venueSubRangesForm = this.venueSubRangesForm.filter(r => r.id !== row.id);
    this.ensureAtLeastOneSubRangeRow();
  }

  // Clean up the subrange rows but do NOT save the venue yet
   saveSubrangesOnly() {
    const cleaned: SubRangeRow[] = [];

    // keep only rows where something was typed
    for (const row of this.venueSubRangesForm) {
      const name = (row.name || '').trim();
      const distances = (row.distancesText || '').trim();

      if (!name && !distances) {
        continue; // skip completely empty rows
      }

      cleaned.push({
        ...row,
        name,
        distancesText: row.distancesText
      });
    }

    // always add a fresh empty row at the end
    cleaned.push({
      id: Date.now() + Math.random(),
      name: '',
      distancesText: ''
    });

    this.venueSubRangesForm = cleaned;
  }


  saveVenue() {
    if (!this.venueForm.name) {
      alert('Venue name is required.');
      return;
    }

    // Build subRanges from the rows under "Add subranges"
    const subRanges: SubRange[] = [];
    for (const row of this.venueSubRangesForm) {
      const name = (row.name || '').trim();
      const distances = this.parseDistances(row.distancesText || '');
      if (!name || distances.length === 0) {
        continue;
      }
      subRanges.push({
        id: row.id,
        name,
        distancesM: distances
      });
    }

    if (subRanges.length === 0) {
      alert('Add at least one subrange with valid distances.');
      return;
    }

    if (this.editingVenue) {
      const updated: Venue = {
        id: this.editingVenue.id,
        name: this.venueForm.name!,
        location: this.venueForm.location,
        altitudeM: this.venueForm.altitudeM,
        notes: this.venueForm.notes,
        subRanges
      };
      this.data.updateVenue(updated);
    } else {
      const toAdd: Omit<Venue, 'id'> = {
        name: this.venueForm.name!,
        location: this.venueForm.location,
        altitudeM: this.venueForm.altitudeM,
        notes: this.venueForm.notes,
        subRanges
      };
      this.data.addVenue(toAdd);
    }

    this.formVisible = false;
    this.editingVenue = null;
    this.venueSubRangesForm = [];
    this.refresh();
  }

  cancelVenueForm() {
    this.formVisible = false;
    this.editingVenue = null;
    this.venueSubRangesForm = [];
  }

  // ---------- Stored venues list ----------

  toggleExpanded(v: Venue) {
    this.expandedVenueId = this.expandedVenueId === v.id ? null : v.id;
  }

  deleteVenue(v: Venue) {
    if (!confirm(`Delete venue "${v.name}"?`)) return;
    this.data.deleteVenue(v.id);
    this.refresh();
    if (this.expandedVenueId === v.id) {
      this.expandedVenueId = null;
    }
  }
}
