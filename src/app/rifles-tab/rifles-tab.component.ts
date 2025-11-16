import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService } from '../data.service';
import { Rifle, RifleLoad, ScopeUnit } from '../models';

interface RifleForm extends Partial<Rifle> {}

interface LoadForm extends Partial<RifleLoad> {}

@Component({
  selector: 'app-rifles-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rifles-tab.component.html',
  styleUrls: ['./rifles-tab.component.css']
})
export class RiflesTabComponent implements OnInit {
  rifles: Rifle[] = [];

  addFormVisible = false;
  editingRifle: Rifle | null = null;

  rifleForm: RifleForm = {
    name: '',
    caliber: '',
    barrelLength: null,
    barrelUnit: 'cm',
    twistRate: '',
    muzzleVelocityFps: null,
    scopeUnit: 'MIL',
    bulletBc: '',
    bulletWeightGr: null,
    bulletName: '',
    notes: '',
    roundCount: 0,
    loads: []
  };

  // load data form per rifle
  activeLoadsRifleId: number | null = null;
  loadForm: LoadForm = {
    powder: '',
    chargeGn: null as any,
    coal: '',
    primer: ''
  };
  editingLoadId: number | null = null;

  constructor(private data: DataService) {}

  ngOnInit(): void {
    this.refresh();
  }

  refresh() {
    this.rifles = this.data.getRifles();
  }

  toggleAddForm() {
    this.addFormVisible = !this.addFormVisible;
    if (!this.addFormVisible) {
      this.clearRifleForm();
    }
  }

  clearRifleForm() {
    this.editingRifle = null;
    this.rifleForm = {
      name: '',
      caliber: '',
      barrelLength: null,
      barrelUnit: 'cm',
      twistRate: '',
      muzzleVelocityFps: null,
      scopeUnit: 'MIL',
      bulletBc: '',
      bulletWeightGr: null,
      bulletName: '',
      notes: '',
      roundCount: 0,
      loads: []
    };
  }

  newRifle() {
    this.clearRifleForm();
    this.addFormVisible = true;
  }

  editRifle(r: Rifle) {
    this.editingRifle = r;
    this.rifleForm = {
      ...r
    };
    this.addFormVisible = true;
  }

  saveRifle() {
    if (!this.rifleForm.name || !this.rifleForm.caliber) {
      alert('Name and caliber are required.');
      return;
    }

    const normalizedLoads: RifleLoad[] = (this.rifleForm.loads ?? []).map(l => ({
      id: l.id!,
      powder: l.powder || '',
      chargeGn: Number(l.chargeGn) || 0,
      coal: l.coal || '',
      primer: l.primer || ''
    }));

    const roundCount = this.rifleForm.roundCount != null
      ? Number(this.rifleForm.roundCount)
      : 0;

    if (this.editingRifle) {
      const updated: Rifle = {
        id: this.editingRifle.id,
        name: this.rifleForm.name!,
        caliber: this.rifleForm.caliber!,
        barrelLength: this.rifleForm.barrelLength ?? null,
        barrelUnit: (this.rifleForm.barrelUnit as 'cm' | 'inch') ?? 'cm',
        twistRate: this.rifleForm.twistRate || '',
        muzzleVelocityFps: this.rifleForm.muzzleVelocityFps ?? null,
        scopeUnit: (this.rifleForm.scopeUnit as ScopeUnit) ?? 'MIL',
        bulletBc: this.rifleForm.bulletBc || '',
        bulletWeightGr: this.rifleForm.bulletWeightGr ?? null,
        bulletName: this.rifleForm.bulletName || '',
        notes: this.rifleForm.notes,
        roundCount,
        loads: normalizedLoads
      };
      this.data.updateRifle(updated);
    } else {
      const toAdd: Omit<Rifle, 'id'> = {
        name: this.rifleForm.name!,
        caliber: this.rifleForm.caliber!,
        barrelLength: this.rifleForm.barrelLength ?? null,
        barrelUnit: (this.rifleForm.barrelUnit as 'cm' | 'inch') ?? 'cm',
        twistRate: this.rifleForm.twistRate || '',
        muzzleVelocityFps: this.rifleForm.muzzleVelocityFps ?? null,
        scopeUnit: (this.rifleForm.scopeUnit as ScopeUnit) ?? 'MIL',
        bulletBc: this.rifleForm.bulletBc || '',
        bulletWeightGr: this.rifleForm.bulletWeightGr ?? null,
        bulletName: this.rifleForm.bulletName || '',
        notes: this.rifleForm.notes,
        roundCount,
        loads: normalizedLoads
      };
      this.data.addRifle(toAdd);
    }

    this.clearRifleForm();
    this.addFormVisible = false;
    this.refresh();
  }

  deleteRifle(r: Rifle) {
    if (!confirm(`Delete rifle "${r.name}"?`)) return;
    this.data.deleteRifle(r.id);
    this.refresh();
  }

  // ---------- Load data management ----------

  toggleLoads(r: Rifle) {
    if (this.activeLoadsRifleId === r.id) {
      this.activeLoadsRifleId = null;
      this.editingLoadId = null;
      this.resetLoadForm();
      return;
    }
    this.activeLoadsRifleId = r.id;
    this.editingLoadId = null;
    this.resetLoadForm();
  }

  resetLoadForm() {
    this.loadForm = {
      powder: '',
      chargeGn: null as any,
      coal: '',
      primer: ''
    };
    this.editingLoadId = null;
  }

  getLoadsForRifle(r: Rifle): RifleLoad[] {
    return r.loads || [];
  }

  editLoad(r: Rifle, load: RifleLoad) {
    this.activeLoadsRifleId = r.id;
    this.editingLoadId = load.id;
    this.loadForm = { ...load };
  }

  saveLoad(r: Rifle) {
    if (!this.loadForm.powder || this.loadForm.chargeGn == null) {
      alert('Powder and charge are required.');
      return;
    }

    const loads = [...(r.loads || [])];

    if (this.editingLoadId != null) {
      const idx = loads.findIndex(l => l.id === this.editingLoadId);
      if (idx >= 0) {
        loads[idx] = {
          id: this.editingLoadId,
          powder: this.loadForm.powder!,
          chargeGn: Number(this.loadForm.chargeGn),
          coal: this.loadForm.coal || '',
          primer: this.loadForm.primer || ''
        };
      }
    } else {
      const newId =
        loads.length > 0 ? Math.max(...loads.map(l => l.id)) + 1 : 1;
      loads.push({
        id: newId,
        powder: this.loadForm.powder!,
        chargeGn: Number(this.loadForm.chargeGn),
        coal: this.loadForm.coal || '',
        primer: this.loadForm.primer || ''
      });
    }

    const updatedRifle: Rifle = { ...r, loads };
    this.data.updateRifle(updatedRifle);
    this.refresh();

    // keep loads panel open
    const updated = this.rifles.find(x => x.id === r.id);
    if (updated) {
      this.activeLoadsRifleId = updated.id;
    }
    this.resetLoadForm();
  }

  deleteLoad(r: Rifle, load: RifleLoad) {
    if (!confirm('Delete this load?')) return;
    const loads = (r.loads || []).filter(l => l.id !== load.id);
    const updatedRifle: Rifle = { ...r, loads };
    this.data.updateRifle(updatedRifle);
    this.refresh();
    this.activeLoadsRifleId = r.id;
  }
}
