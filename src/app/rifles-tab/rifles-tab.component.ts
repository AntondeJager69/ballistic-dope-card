import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService } from '../data.service';
import { Rifle, ScopeClickUnit } from '../models';

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
  expandedId: number | null = null;

  form: Partial<Rifle> = {
    name: '',
    caliber: '',
    scopeClickUnit: 'MIL'
  };

  clickUnits: ScopeClickUnit[] = ['MIL', 'MOA'];

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
      totalRounds: undefined,
      muzzleVelocityFps: undefined,
      bulletWeightGr: undefined,
      bcG1: undefined,
      zeroRangeYd: undefined,
      twist: '',
      scopeClickUnit: 'MIL',
      powder: '',
      powderChargeGn: undefined,
      tpl: '',
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
    const copy: Omit<Rifle, 'id'> = {
      ...rifle,
      name: rifle.name + ' (copy)'
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (copy as any).id;
    const added = this.data.addRifle(copy);
    this.refresh();
    this.expandedId = added.id;
  }

  delete(rifle: Rifle) {
    if (confirm(`Delete rifle "${rifle.name}"?`)) {
      this.data.deleteRifle(rifle.id);
      this.refresh();
      if (this.editing?.id === rifle.id) {
        this.formVisible = false;
        this.editing = null;
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
        id: this.editing.id
      };
      this.data.updateRifle(updated);
      this.expandedId = updated.id;
    } else {
      const toAdd: Omit<Rifle, 'id'> = {
        name: this.form.name!,
        caliber: this.form.caliber!,
        totalRounds: this.form.totalRounds,
        muzzleVelocityFps: this.form.muzzleVelocityFps,
        bulletWeightGr: this.form.bulletWeightGr,
        bcG1: this.form.bcG1,
        zeroRangeYd: this.form.zeroRangeYd,
        twist: this.form.twist,
        scopeClickUnit: this.form.scopeClickUnit,
        powder: this.form.powder,
        powderChargeGn: this.form.powderChargeGn,
        tpl: this.form.tpl,
        notes: this.form.notes
      };
      const added = this.data.addRifle(toAdd);
      this.expandedId = added.id;
    }

    this.refresh();
    this.formVisible = false;
    this.editing = null;
  }

  toggleExpand(r: Rifle) {
    this.expandedId = this.expandedId === r.id ? null : r.id;
  }
}
