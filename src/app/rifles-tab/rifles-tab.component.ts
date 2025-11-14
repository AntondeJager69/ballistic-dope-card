import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService } from '../data.service';
import { Rifle, ScopeClickUnit, LoadData } from '../models';

@Component({
  selector: 'app-rifles-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rifles-tab.component.html',
  styleUrls: ['./rifles-tab.component.css']
})
export class RiflesTabComponent implements OnInit {
  rifles: Rifle[] = [];
  editing: Rifle | null = null;

  formVisible = false;

  // Rifle details form
  form: Partial<Rifle> = {
    name: '',
    caliber: '',
    barrelLengthUnit: 'cm',
    scopeClickUnit: 'MIL'
  };

  clickUnits: ScopeClickUnit[] = ['MIL', 'MOA'];

  // Load data panel state
  loadsExpandedId: number | null = null;       // which rifle's load panel is open
  editingLoadId: number | null = null;         // which load is being edited
  loadForm: Partial<LoadData> = {};            // temp form for add/edit load

  constructor(private data: DataService) {}

  ngOnInit(): void {
    this.refresh();
  }

  refresh() {
    this.rifles = this.data.getRifles();
  }

  toggleForm() {
    this.formVisible = !this.formVisible;
    if (this.formVisible && !this.editing) {
      this.newRifle();
    }
  }

  newRifle() {
    this.editing = null;
    this.form = {
      name: '',
      caliber: '',
      barrelLength: undefined,
      barrelLengthUnit: 'cm',
      twistRate: '',
      muzzleVelocityFps: undefined,
      scope: '',
      scopeClickUnit: 'MIL',
      bulletWeightGr: undefined,
      bulletBc: undefined,
      bulletName: '',
      notes: ''
    };
    this.formVisible = true;
  }

  edit(rifle: Rifle) {
    this.editing = rifle;
    this.form = { ...rifle };
    this.formVisible = true;
  }

  duplicate(rifle: Rifle) {
    const { id, ...rest } = rifle;
    const copy: Omit<Rifle, 'id'> = {
      ...rest,
      name: rifle.name + ' (copy)',
      loads: rifle.loads ? rifle.loads.map(l => ({ ...l, id: Date.now() + Math.random() })) : []
    };
    const added = this.data.addRifle(copy);
    this.refresh();
    this.loadsExpandedId = null;
    this.editing = null;
  }

  delete(rifle: Rifle) {
    if (confirm(`Delete rifle "${rifle.name}"?`)) {
      this.data.deleteRifle(rifle.id);
      this.refresh();
      if (this.editing?.id === rifle.id) {
        this.formVisible = false;
        this.editing = null;
      }
      if (this.loadsExpandedId === rifle.id) {
        this.loadsExpandedId = null;
      }
    }
  }

  save() {
    if (!this.form.name || !this.form.caliber) {
      alert('Rifle name and caliber are required.');
      return;
    }

    if (this.editing) {
      const updated: Rifle = {
        ...(this.editing as Rifle),
        ...this.form,
        id: this.editing.id,
        loads: this.editing.loads || []
      };
      this.data.updateRifle(updated);
    } else {
      const toAdd: Omit<Rifle, 'id'> = {
        name: this.form.name!,
        caliber: this.form.caliber!,
        barrelLength: this.form.barrelLength,
        barrelLengthUnit: this.form.barrelLengthUnit,
        twistRate: this.form.twistRate,
        muzzleVelocityFps: this.form.muzzleVelocityFps,
        scope: this.form.scope,
        scopeClickUnit: this.form.scopeClickUnit,
        bulletWeightGr: this.form.bulletWeightGr,
        bulletBc: this.form.bulletBc,
        bulletName: this.form.bulletName,
        notes: this.form.notes,
        loads: []
      };
      this.data.addRifle(toAdd);
    }

    this.refresh();
    this.formVisible = false;
    this.editing = null;
  }

  // ---------- Load data panel ----------

  toggleLoads(r: Rifle) {
    this.loadsExpandedId = this.loadsExpandedId === r.id ? null : r.id;
    this.editingLoadId = null;
    this.loadForm = {};
  }

  startAddLoad(r: Rifle) {
    this.loadsExpandedId = r.id;
    this.editingLoadId = null;
    this.loadForm = {
      powder: '',
      powderChargeGr: undefined,
      coal: '',
      primer: ''
    };
  }

  startEditLoad(r: Rifle, load: LoadData) {
    this.loadsExpandedId = r.id;
    this.editingLoadId = load.id;
    this.loadForm = { ...load };
  }

  saveLoad(r: Rifle) {
    if (!this.loadForm.powder || this.loadForm.powderChargeGr == null) {
      alert('Powder and charge weight are required.');
      return;
    }

    const rifle = this.rifles.find(x => x.id === r.id);
    if (!rifle) return;

    const loads = (rifle.loads || []).map(l => ({ ...l }));
    if (this.editingLoadId != null) {
      // update existing
      const idx = loads.findIndex(l => l.id === this.editingLoadId);
      if (idx >= 0) {
        loads[idx] = {
          id: loads[idx].id,
          powder: this.loadForm.powder!,
          powderChargeGr: this.loadForm.powderChargeGr!,
          coal: this.loadForm.coal || '',
          primer: this.loadForm.primer || ''
        };
      }
    } else {
      // add new
      const id = Date.now() + Math.random();
      loads.push({
        id,
        powder: this.loadForm.powder!,
        powderChargeGr: this.loadForm.powderChargeGr!,
        coal: this.loadForm.coal || '',
        primer: this.loadForm.primer || ''
      });
    }

    const updated: Rifle = { ...rifle, loads };
    this.data.updateRifle(updated);
    this.refresh();

    this.editingLoadId = null;
    this.loadForm = {};
  }

  deleteLoad(r: Rifle, load: LoadData) {
    if (!confirm('Delete this load?')) return;

    const rifle = this.rifles.find(x => x.id === r.id);
    if (!rifle || !rifle.loads) return;

    const loads = rifle.loads.filter(l => l.id !== load.id);
    const updated: Rifle = { ...rifle, loads };
    this.data.updateRifle(updated);
    this.refresh();

    if (this.editingLoadId === load.id) {
      this.editingLoadId = null;
      this.loadForm = {};
    }
  }
}
