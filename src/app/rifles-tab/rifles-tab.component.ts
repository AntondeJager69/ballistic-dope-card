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

  edit(rifle: Rifle) {
    this.editing = rifle;
    this.form = { ...rifle };
  }

  resetForm() {
    this.editing = null;
    this.form = {
      name: '',
      caliber: '',
      scopeClickUnit: 'MIL'
    };
  }

  save() {
    if (!this.form.name || !this.form.caliber) {
      alert('Name and caliber are required.');
      return;
    }

    if (this.editing) {
      const updated: Rifle = { ...(this.editing as Rifle), ...(this.form as Rifle) };
      this.data.updateRifle(updated);
    } else {
      this.data.addRifle({
        name: this.form.name!,
        caliber: this.form.caliber!,
        barrelLengthCm: this.form.barrelLengthCm,
        twistRate: this.form.twistRate,
        bulletWeightGr: this.form.bulletWeightGr,
        muzzleVelocityMs: this.form.muzzleVelocityMs,
        zeroRangeM: this.form.zeroRangeM,
        scopeModel: this.form.scopeModel,
        scopeClickUnit: this.form.scopeClickUnit,
        scopeClickValue: this.form.scopeClickValue,
        notes: this.form.notes
      });
    }

    this.resetForm();
    this.refresh();
  }

  delete(rifle: Rifle) {
    if (confirm(`Delete rifle "${rifle.name}"?`)) {
      this.data.deleteRifle(rifle.id);
      this.refresh();
      if (this.editing?.id === rifle.id) {
        this.resetForm();
      }
    }
  }
}
