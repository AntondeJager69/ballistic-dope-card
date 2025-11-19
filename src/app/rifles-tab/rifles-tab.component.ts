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
  styleUrls: ['./rifles-tab.component.css'],
})
export class RiflesTabComponent implements OnInit {
  rifles: Rifle[] = [];

  // rifle selection / forms
  selectedRifleId: string | number | null = null;

  // ⬇⬇⬇ change: start collapsed instead of true
  addFormVisible = false;

  editingRifle: Rifle | null = null;

  // load visibility / forms
  activeLoadsRifleId: string | number | null = null;      // which rifle’s loads table is open
  activeLoadFormRifleId: string | number | null = null;   // which rifle’s add/edit load form is open
  editingLoadId: string | number | null = null;

  rifleForm: RifleForm = {
    scopeUnit: 'MIL' as ScopeUnit,
    barrelUnit: 'inch',
    roundCount: 0,
  };

  loadForm: LoadForm = {};

  constructor(private data: DataService) {}

  ngOnInit(): void {
    this.refresh();
  }

  // --- Helpers ----------------------------------------------------------

  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  }

  refresh(): void {
    // Adjust to your DataService API if needed
    if ((this.data as any).getRifles) {
      this.rifles = (this.data as any).getRifles() as Rifle[];
    } else {
      // Fallback if your service exposes rifles directly
      this.rifles = (this.data as any).rifles ?? [];
    }

    if (this.rifles.length && !this.selectedRifleId) {
      this.selectedRifleId = this.rifles[0].id!;
    }
  }

  get selectedRifle(): Rifle | undefined {
    return this.rifles.find((r) => r.id === this.selectedRifleId);
  }

  // --- Rifle form logic -------------------------------------------------

  toggleAddForm(): void {
    this.addFormVisible = !this.addFormVisible;
    if (!this.addFormVisible) {
      this.clearRifleForm();
    }
  }

  clearRifleForm(): void {
    this.rifleForm = {
      scopeUnit: 'MIL' as ScopeUnit,
      barrelUnit: 'inch',
      roundCount: 0,
    };
    this.editingRifle = null;
  }

  onSelectedRifleChange(rifleId: string | number | null): void {
    this.selectedRifleId = rifleId;
  }

  editRifle(r: Rifle): void {
    this.addFormVisible = true;
    this.editingRifle = r;

    const { loads, ...rest } = r;
    this.rifleForm = { ...rest };
  }

  saveRifle(): void {
    const isEditing = !!this.editingRifle;
    const existingLoads = this.editingRifle?.loads ?? [];

    // Ensure round count is numeric
    const roundCount =
      this.rifleForm.roundCount != null
        ? Number(this.rifleForm.roundCount)
        : 0;

    const rifle: Rifle = {
      ...(this.editingRifle || {}),
      ...this.rifleForm,
      id:
        this.editingRifle?.id ??
        (this.rifleForm.id as any) ??
        this.generateId('rifle'),
      loads: existingLoads,
      roundCount,
    } as Rifle;

    if (isEditing) {
      if ((this.data as any).updateRifle) {
        (this.data as any).updateRifle(rifle);
      }
    } else {
      if ((this.data as any).addRifle) {
        (this.data as any).addRifle(rifle);
      } else if ((this.data as any).setRifles) {
        const rifles = [...this.rifles, rifle];
        (this.data as any).setRifles(rifles);
      }
    }

    this.clearRifleForm();
    this.refresh();
    this.selectedRifleId = rifle.id!;
    this.addFormVisible = false; // collapse again after save if you want
  }

  deleteRifle(r: Rifle): void {
    if (!confirm('Delete this rifle and all its loads?')) return;

    if ((this.data as any).deleteRifle) {
      (this.data as any).deleteRifle(r);
    } else if ((this.data as any).setRifles) {
      const rifles = this.rifles.filter((x) => x.id !== r.id);
      (this.data as any).setRifles(rifles);
    }

    this.refresh();

    if (this.rifles.length) {
      this.selectedRifleId = this.rifles[0].id!;
    } else {
      this.selectedRifleId = null;
    }

    this.activeLoadsRifleId = null;
    this.activeLoadFormRifleId = null;
    this.editingLoadId = null;
    this.resetLoadForm();
  }

  // --- Loads visibility -------------------------------------------------

  toggleLoads(r: Rifle): void {
    if (this.activeLoadsRifleId === r.id) {
      // collapse
      this.activeLoadsRifleId = null;
      this.activeLoadFormRifleId = null;
      this.editingLoadId = null;
      this.resetLoadForm();
    } else {
      // expand loads table but do NOT auto-open add/edit form
      this.activeLoadsRifleId = r.id!;
    }
  }

  toggleLoadForm(rifleId: string | number): void {
    if (this.activeLoadFormRifleId === rifleId) {
      // collapse form
      this.activeLoadFormRifleId = null;
      this.editingLoadId = null;
      this.resetLoadForm();
    } else {
      // open form for this rifle
      this.activeLoadFormRifleId = rifleId;
      if (!this.editingLoadId) {
        this.resetLoadForm();
      }
    }
  }

  // --- Load form logic --------------------------------------------------

  resetLoadForm(): void {
    this.loadForm = {};
    this.editingLoadId = null;
  }

  saveLoad(r: Rifle): void {
    const loads = [...(r.loads || [])];

    if (this.editingLoadId != null) {
      // update existing
      const idx = loads.findIndex((l) => l.id === this.editingLoadId);
      if (idx !== -1) {
        loads[idx] = {
          ...loads[idx],
          ...this.loadForm,
          id: this.editingLoadId,
          chargeGn:
            this.loadForm.chargeGn != null
              ? Number(this.loadForm.chargeGn)
              : loads[idx].chargeGn,
          bulletWeightGr:
            this.loadForm.bulletWeightGr != null
              ? Number(this.loadForm.bulletWeightGr)
              : loads[idx].bulletWeightGr,
        } as RifleLoad;
      }
    } else {
      // add new
      const newLoad: RifleLoad = {
        id:
          (this.loadForm.id as any) ??
          this.generateId('load'),
        powder: this.loadForm.powder || '',
        chargeGn:
          this.loadForm.chargeGn != null
            ? Number(this.loadForm.chargeGn)
            : 0,
        coal: this.loadForm.coal || '',
        primer: this.loadForm.primer || '',
        bullet: this.loadForm.bullet,
        bulletWeightGr:
          this.loadForm.bulletWeightGr != null
            ? Number(this.loadForm.bulletWeightGr)
            : undefined,
        bulletBc: this.loadForm.bulletBc,
      } as RifleLoad;

      loads.push(newLoad);
    }

    const updatedRifle: Rifle = {
      ...r,
      loads,
    };

    if ((this.data as any).updateRifle) {
      (this.data as any).updateRifle(updatedRifle);
    } else if ((this.data as any).setRifles) {
      const rifles = this.rifles.map((x) =>
        x.id === updatedRifle.id ? updatedRifle : x
      );
      (this.data as any).setRifles(rifles);
    }

    this.refresh();
    this.activeLoadsRifleId = updatedRifle.id!;
    this.resetLoadForm();
    this.editingLoadId = null;
  }

  editLoad(r: Rifle, load: RifleLoad): void {
    this.activeLoadsRifleId = r.id!;
    this.activeLoadFormRifleId = r.id!;
    this.editingLoadId = load.id as any;

    this.loadForm = {
      id: load.id,
      powder: load.powder,
      chargeGn: load.chargeGn,
      coal: load.coal,
      primer: load.primer,
      bullet: load.bullet,
      bulletWeightGr: load.bulletWeightGr,
      bulletBc: load.bulletBc,
    };
  }

  deleteLoad(r: Rifle, load: RifleLoad): void {
    if (!confirm('Delete this load?')) return;

    const loads = (r.loads || []).filter((l) => l.id !== load.id);
    const updatedRifle: Rifle = { ...r, loads };

    if ((this.data as any).updateRifle) {
      (this.data as any).updateRifle(updatedRifle);
    } else if ((this.data as any).setRifles) {
      const rifles = this.rifles.map((x) =>
        x.id === updatedRifle.id ? updatedRifle : x
      );
      (this.data as any).setRifles(rifles);
    }

    this.refresh();
    this.activeLoadsRifleId = r.id!;
    this.activeLoadFormRifleId = r.id!;
    this.editingLoadId = null;
    this.resetLoadForm();
  }
}
