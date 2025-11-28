import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService } from '../data.service';
import {
  Rifle,
  LoadDevProject,
  LoadDevEntry,
  LoadDevType,
  GroupSizeUnit
} from '../models';

interface ProjectForm {
  rifleId: number | null;
  name: string;
  type: LoadDevType;
  notes: string;
}

interface EntryForm {
  loadLabel: string;
  powder: string;
  chargeGr: number | null;
  coal: string;
  primer: string;
  bullet: string;
  bulletWeightGr: number | null;
  bulletBc: string;
  distanceM: number | null;
  shotsFired: number | null;
  groupSize: number | null;
  groupUnit: GroupSizeUnit;
  velocityInput: string;
  poiNote: string;
  notes: string;
}

interface PlannerForm {
  distanceM: number | null;
  shotsPerStep: number | null;
  startChargeGr: number | null;
  endChargeGr: number | null;
  stepGr: number | null;
}

interface VelocityStats {
  avg: number;
  es: number;
  sd: number;
  n: number;
}

interface NodeEntry {
  entry: LoadDevEntry;
  stats: VelocityStats;
}

@Component({
  selector: 'app-load-dev-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './load-dev-tab.component.html'
})
export class LoadDevTabComponent implements OnInit {
  // Rifles
  rifles: Rifle[] = [];
  selectedRifleId: number | null = null;

  // Projects
  projects: LoadDevProject[] = [];
  selectedProjectId: number | null = null;
  selectedProject: LoadDevProject | null = null;

  // New / edit project form
  projectFormVisible = false;
  editingProject: LoadDevProject | null = null;
  projectForm: ProjectForm = this.createEmptyProjectForm();

  // Ladder planner
  planner: PlannerForm = this.createEmptyPlannerForm();

  // Entries
  entryFormVisible = false;
  editingEntry: LoadDevEntry | null = null;
  entryForm: EntryForm = this.createEmptyEntryForm();
  entrySortMode: 'default' | 'chargeAsc' | 'groupAsc' | 'groupDesc' = 'default';

  // Results visibility
  resultsCollapsed = false;
  hasResultsForSelectedProject = false;

  // Ladder wizard
  ladderWizardActive = false;
  ladderWizardEntries: LoadDevEntry[] = [];
  ladderWizardIndex = 0;
  velocityEditEntry: LoadDevEntry | null = null;
  velocityEditValue: string | number = '';

  // Single-row velocity edit
  singleVelocityEditActive = false;

  constructor(private data: DataService) {}

  // ---------- lifecycle ----------

  ngOnInit(): void {
    this.rifles = this.data.getRifles();
    if (this.rifles.length > 0) {
      this.selectedRifleId = this.rifles[0].id;
      this.loadProjects();
    }
  }

  // ---------- basic helpers ----------

  private createEmptyProjectForm(): ProjectForm {
    return {
      rifleId: null,
      name: '',
      type: 'ladder',
      notes: ''
    };
  }

  private createEmptyEntryForm(): EntryForm {
    return {
      loadLabel: '',
      powder: '',
      chargeGr: null,
      coal: '',
      primer: '',
      bullet: '',
      bulletWeightGr: null,
      bulletBc: '',
      distanceM: null,
      shotsFired: null,
      groupSize: null,
      groupUnit: 'MOA',
      velocityInput: '',
      poiNote: '',
      notes: ''
    };
  }

  private createEmptyPlannerForm(): PlannerForm {
    return {
      distanceM: null,
      shotsPerStep: null,
      startChargeGr: null,
      endChargeGr: null,
      stepGr: null
    };
  }

  shortDate(value: string | Date | null | undefined): string {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit'
    });
  }

  asDateString(value: string | Date | null | undefined): string {
    return this.shortDate(value);
  }

  projectTypeLabel(type: LoadDevType): string {
    switch (type) {
      case 'ladder':
        return 'Ladder test';
      case 'ocw':
        return 'OCW';
      case 'groups':
        return 'Group comparison';
      default:
        return 'Other';
    }
  }

  // ---------- rifle / project loading ----------

  onRifleChange(): void {
    this.loadProjects();
  }

  private loadProjects(): void {
    if (this.selectedRifleId == null) {
      this.projects = [];
      this.selectedProject = null;
      this.selectedProjectId = null;
      this.hasResultsForSelectedProject = false;
      return;
    }

    this.projects = this.data.getLoadDevProjectsForRifle(this.selectedRifleId);

    if (this.selectedProjectId != null) {
      this.selectedProject =
        this.projects.find(p => p.id === this.selectedProjectId) ?? null;
      if (!this.selectedProject) this.selectedProjectId = null;
    }

    if (!this.selectedProject && this.projects.length > 0) {
      this.selectedProject = this.projects[0];
      this.selectedProjectId = this.selectedProject.id;
    }

    this.updateHasResultsFlag();
  }

  private refreshSelectedProject(): void {
    if (!this.selectedRifleId || !this.selectedProjectId) return;
    this.projects = this.data.getLoadDevProjectsForRifle(this.selectedRifleId);
    this.selectedProject =
      this.projects.find(p => p.id === this.selectedProjectId) ?? null;
    this.updateHasResultsFlag();
  }

  onProjectSelectChange(): void {
    if (this.selectedProjectId == null) {
      this.selectedProject = null;
      this.updateHasResultsFlag();
    } else {
      this.selectedProject =
        this.projects.find(p => p.id === this.selectedProjectId) ?? null;
      this.updateHasResultsFlag();
    }
  }

  private updateHasResultsFlag(): void {
    this.hasResultsForSelectedProject =
      !!this.selectedProject &&
      !!this.selectedProject.entries &&
      this.selectedProject.entries.length > 0;
  }

  toggleResultsCollapsed(): void {
    this.resultsCollapsed = !this.resultsCollapsed;
  }

  // ---------- project CRUD ----------

  newProject(): void {
    if (!this.selectedRifleId) {
      alert('Select rifle first');
      return;
    }
    this.editingProject = null;
    this.projectForm = this.createEmptyProjectForm();
    this.projectForm.rifleId = this.selectedRifleId;
    this.projectForm.type = 'ladder';
    this.planner = this.createEmptyPlannerForm();
    this.projectFormVisible = true;
  }

  cancelProjectForm(): void {
    this.projectFormVisible = false;
    this.editingProject = null;
    this.projectForm = this.createEmptyProjectForm();
    this.planner = this.createEmptyPlannerForm();
  }

  private createLadderEntriesFromPlanner(projectId: number): void {
    if (this.projectForm.type !== 'ladder') return;

    const {
      distanceM,
      shotsPerStep,
      startChargeGr,
      endChargeGr,
      stepGr
    } = this.planner;

    if (
      startChargeGr == null ||
      endChargeGr == null ||
      stepGr == null ||
      stepGr <= 0 ||
      endChargeGr < startChargeGr
    ) {
      return;
    }

    const dist = distanceM ?? undefined;
    const shots = shotsPerStep && shotsPerStep > 0 ? shotsPerStep : undefined;

    let charge = startChargeGr;
    let localId = 1;

    while (charge <= endChargeGr + 1e-6) {
      const roundedCharge = Number(charge.toFixed(2));

      const entry: LoadDevEntry = {
        id: localId++,
        loadLabel: '',
        powder: undefined,
        chargeGr: roundedCharge,
        coal: undefined,
        primer: undefined,
        bullet: undefined,
        bulletWeightGr: undefined,
        bulletBc: undefined,
        distanceM: dist,
        shotsFired: shots,
        groupSize: undefined,
        groupUnit: 'MOA',
        poiNote: undefined,
        notes: undefined
      } as LoadDevEntry;

      this.data.updateLoadDevEntry(projectId, entry);

      charge = Number((charge + stepGr).toFixed(2));
    }
  }

  saveProject(): void {
    if (!this.projectForm.rifleId || !this.projectForm.name.trim()) {
      alert('Please select rifle and enter name.');
      return;
    }

    if (this.editingProject) {
      const updated: LoadDevProject = {
        ...this.editingProject,
        rifleId: this.projectForm.rifleId,
        name: this.projectForm.name.trim(),
        type: this.projectForm.type,
        notes: this.projectForm.notes.trim()
      };
      this.data.updateLoadDevProject(updated);
      this.selectedProjectId = updated.id;
    } else {
      const newProject: LoadDevProject = {
        id: Date.now(),
        rifleId: this.projectForm.rifleId,
        name: this.projectForm.name.trim(),
        type: this.projectForm.type,
        notes: this.projectForm.notes.trim() || undefined,
        dateStarted: new Date().toISOString(),
        entries: []
      };
      this.data.updateLoadDevProject(newProject);
      this.selectedProjectId = newProject.id;

      // auto-create ladder entries from planner
      this.createLadderEntriesFromPlanner(newProject.id);
    }

    this.projectFormVisible = false;
    this.editingProject = null;
    this.projectForm = this.createEmptyProjectForm();
    this.planner = this.createEmptyPlannerForm();
    this.loadProjects();
  }

  deleteProject(project: LoadDevProject): void {
    if (!confirm(`Delete project "${project.name}"?`)) return;
    this.data.deleteLoadDevProject(project.id);
    if (this.selectedProjectId === project.id) {
      this.selectedProject = null;
      this.selectedProjectId = null;
    }
    this.loadProjects();
  }

  // ---------- entries ----------

  newEntry(): void {
    if (!this.selectedProject) {
      alert('Select project first');
      return;
    }
    this.editingEntry = null;
    this.entryFormVisible = true;
    this.entryForm = this.createEmptyEntryForm();
  }

  editEntry(entry: LoadDevEntry): void {
    this.editingEntry = entry;
    this.entryFormVisible = true;

    const any = entry as any;

    this.entryForm = {
      loadLabel: entry.loadLabel || '',
      powder: entry.powder || '',
      chargeGr: entry.chargeGr ?? null,
      coal: entry.coal || '',
      primer: entry.primer || '',
      bullet: entry.bullet || '',
      bulletWeightGr: entry.bulletWeightGr ?? null,
      bulletBc: entry.bulletBc || '',
      distanceM: entry.distanceM ?? null,
      shotsFired: entry.shotsFired ?? null,
      groupSize: entry.groupSize ?? null,
      groupUnit: entry.groupUnit ?? 'MOA',
      velocityInput: any.velocityInput || '',
      poiNote: entry.poiNote || '',
      notes: entry.notes || ''
    };
  }

  cancelEntryForm(): void {
    this.entryFormVisible = false;
    this.editingEntry = null;
    this.entryForm = this.createEmptyEntryForm();
  }

  saveEntry(): void {
    if (!this.selectedProject) return;

    const f = this.entryForm;

    const payload: any = {
      loadLabel: f.loadLabel || undefined,
      powder: f.powder || undefined,
      chargeGr: f.chargeGr ?? undefined,
      coal: f.coal || undefined,
      primer: f.primer || undefined,
      bullet: f.bullet || undefined,
      bulletWeightGr: f.bulletWeightGr ?? undefined,
      bulletBc: f.bulletBc || undefined,
      distanceM: f.distanceM ?? undefined,
      shotsFired: f.shotsFired ?? undefined,
      groupSize: f.groupSize ?? undefined,
      groupUnit: f.groupUnit,
      poiNote: f.poiNote || undefined,
      notes: f.notes || undefined,
      velocityInput: f.velocityInput.trim() || undefined
    };

    if (this.editingEntry) {
      const updated = { ...this.editingEntry, ...payload };
      this.data.updateLoadDevEntry(this.selectedProject.id, updated);
    } else {
      const existing = this.selectedProject.entries ?? [];
      const newId = existing.length
        ? Math.max(...existing.map(x => x.id)) + 1
        : 1;
      const newEntry: LoadDevEntry = { id: newId, ...payload };
      this.data.updateLoadDevEntry(this.selectedProject.id, newEntry);
    }

    this.entryFormVisible = false;
    this.editingEntry = null;
    this.entryForm = this.createEmptyEntryForm();
    this.loadProjects();
  }

  deleteEntry(entry: LoadDevEntry): void {
    if (!this.selectedProject) return;
    if (!confirm('Delete this entry?')) return;
    this.data.deleteLoadDevEntry(this.selectedProject.id, entry.id);
    this.loadProjects();
  }

  entriesForSelectedProject(): LoadDevEntry[] {
    if (!this.selectedProject) return [];
    const list = [...this.selectedProject.entries];

    switch (this.entrySortMode) {
      case 'chargeAsc':
        return list.sort(
          (a, b) => (a.chargeGr ?? 9999) - (b.chargeGr ?? 9999)
        );
      case 'groupAsc':
        return list.sort(
          (a, b) => (a.groupSize ?? 9999) - (b.groupSize ?? 9999)
        );
      case 'groupDesc':
        return list.sort(
          (a, b) => (b.groupSize ?? -9999) - (a.groupSize ?? -9999)
        );
      default:
        return list;
    }
  }

  // ---------- velocity stats & parsing ----------

  private parseVelocityInput(raw: string | undefined | null): number[] {
    if (!raw) return [];
    return raw
      .split(/[\s,;]+/)
      .map(x => Number(x))
      .filter(v => Number.isFinite(v));
  }

  statsForEntry(entry: LoadDevEntry): VelocityStats | null {
    const any = entry as any;
    const values = this.parseVelocityInput(any.velocityInput);
    return this.computeVelocityStats(values);
  }

  private computeVelocityStats(values: number[]): VelocityStats | null {
    if (!values.length) return null;

    const n = values.length;
    const avg = values.reduce((a, b) => a + b, 0) / n;
    const sorted = [...values].sort((a, b) => a - b);
    const es = sorted[n - 1] - sorted[0];
    const variance =
      values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / n;
    const sd = Math.sqrt(variance);

    return { avg, es, sd, n };
  }

  private computeSimpleSd(values: number[]): number {
    if (!values.length) return 0;
    const n = values.length;
    const mean = values.reduce((s, v) => s + v, 0) / n;
    const variance =
      values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    return Math.sqrt(variance);
  }

  // ---------- node detection & colouring ----------

  private computeNodesForSelectedProject(): Map<number, number> {
    const map = new Map<number, number>();

    if (!this.selectedProject || this.selectedProject.type !== 'ladder') {
      return map;
    }
    if (!this.selectedProject.entries || this.selectedProject.entries.length < 3) {
      return map;
    }

    const withStats: NodeEntry[] = this.selectedProject.entries
      .map(e => ({ entry: e, stats: this.statsForEntry(e) }))
      .filter((x): x is NodeEntry => !!x.stats);

    if (withStats.length < 3) return map;

    const sorted = withStats.sort(
      (a, b) => (a.entry.chargeGr ?? 9999) - (b.entry.chargeGr ?? 9999)
    );

    const groups: number[][] = [];
    let i = 0;

    while (i + 2 < sorted.length) {
      let window = [sorted[i], sorted[i + 1], sorted[i + 2]];
      let vals = window.map(w => w.stats.avg);

      if (this.computeSimpleSd(vals) >= 10) {
        i++;
        continue;
      }

      let j = i + 3;
      while (j < sorted.length) {
        const extended = [...window, sorted[j]];
        const extVals = extended.map(w => w.stats.avg);
        if (this.computeSimpleSd(extVals) < 10) {
          window = extended;
          vals = extVals;
          j++;
        } else break;
      }

      groups.push(window.map(w => w.entry.id));
      i = j;
    }

    groups.forEach((ids, index) => {
      ids.forEach(id => map.set(id, index));
    });

    return map;
  }

  nodeCssClass(entry: LoadDevEntry) {
    const map = this.computeNodesForSelectedProject();
    const idx = map.get(entry.id);
    return {
      'bg-green-900/40': idx === 0,
      'bg-orange-900/40': idx === 1,
      'bg-red-900/40': idx === 2
    };
  }

  // ---------- helper: are all entries populated with velocity? ----------

  allEntriesHaveVelocity(): boolean {
    if (!this.selectedProject || !this.selectedProject.entries?.length) {
      return false;
    }

    return this.selectedProject.entries.every(e => {
      const any = e as any;
      const values = this.parseVelocityInput(any.velocityInput);
      return values.length > 0;
    });
  }

  // ---------- wizard: append helper ----------

  private appendVelocityToEntry(entry: LoadDevEntry, value: number): void {
    if (!this.selectedProject) return;

    const any = entry as any;
    const existing = this.parseVelocityInput(any.velocityInput);
    const updated = [...existing, value];

    any.velocityInput = updated.join(' ');
    entry.shotsFired = updated.length;

    this.data.updateLoadDevEntry(this.selectedProject.id, entry);
    this.refreshSelectedProject();
  }

  // ---------- ladder wizard ----------

  startLadderWizard(): void {
    if (!this.selectedProject || this.selectedProject.type !== 'ladder') {
      alert('This is not a ladder test');
      return;
    }

    if (this.allEntriesHaveVelocity()) {
      alert(
        'All ladder steps already have velocities. Use the Edit buttons for changes.'
      );
      return;
    }

    const entries = [...(this.selectedProject.entries ?? [])].sort(
      (a, b) => (a.chargeGr ?? 9999) - (b.chargeGr ?? 9999)
    );

    if (!entries.length) {
      alert('No ladder entries created');
      return;
    }

    this.ladderWizardEntries = entries;
    this.ladderWizardIndex = 0;
    this.ladderWizardActive = true;
    this.singleVelocityEditActive = false;

    this.setWizardCurrentEntry();
  }

  private setWizardCurrentEntry(): void {
    if (!this.ladderWizardActive) return;

    if (this.ladderWizardIndex >= this.ladderWizardEntries.length) {
      this.finishLadderWizard();
      return;
    }

    this.velocityEditEntry = this.ladderWizardEntries[this.ladderWizardIndex];
    const any = this.velocityEditEntry as any;
    this.velocityEditValue = any.velocityInput ?? '';
  }

  private finishLadderWizard(): void {
    this.ladderWizardActive = false;
    this.velocityEditEntry = null;
    this.velocityEditValue = '';
    this.ladderWizardEntries = [];
    this.ladderWizardIndex = 0;
  }

  private goToNextWizardEntry(): void {
    if (!this.selectedProject || !this.velocityEditEntry) {
      this.finishLadderWizard();
      return;
    }

    const sorted = [...(this.selectedProject.entries ?? [])].sort(
      (a, b) => (a.chargeGr ?? 9999) - (b.chargeGr ?? 9999)
    );

    const currentIndex = sorted.findIndex(
      e => e.id === this.velocityEditEntry!.id
    );

    if (currentIndex < 0 || currentIndex + 1 >= sorted.length) {
      this.finishLadderWizard();
      return;
    }

    this.ladderWizardEntries = sorted;
    this.ladderWizardIndex = currentIndex + 1;
    this.velocityEditEntry = sorted[this.ladderWizardIndex];
    const any = this.velocityEditEntry as any;
    this.velocityEditValue = any.velocityInput ?? '';
  }

  saveVelocityAndNext(): void {
    if (!this.selectedProject || !this.velocityEditEntry) return;

    const raw = this.velocityEditValue ?? '';
    const trimmed = raw.toString().trim();

    if (trimmed) {
      const v = Number(trimmed);
      if (Number.isFinite(v) && v > 0) {
        this.appendVelocityToEntry(this.velocityEditEntry, v);
      } else {
        alert('Invalid velocity');
        return;
      }
    }

    this.goToNextWizardEntry();
  }

  skipVelocityAndNext(): void {
    this.goToNextWizardEntry();
  }

  cancelLadderWizard(): void {
    this.finishLadderWizard();
  }

  // ---------- single-row velocity edit (REPLACE set) ----------

  editVelocityForEntry(entry: LoadDevEntry): void {
    this.ladderWizardActive = false;
    this.singleVelocityEditActive = true;
    this.velocityEditEntry = entry;
    const any = entry as any;
    this.velocityEditValue = any.velocityInput ?? '';
  }

  saveSingleVelocity(): void {
    if (!this.selectedProject || !this.velocityEditEntry) {
      this.singleVelocityEditActive = false;
      return;
    }

    const raw = this.velocityEditValue ?? '';
    const trimmed = raw.toString().trim();

    // If user clears it completely, remove velocities for this row
    if (!trimmed) {
      const any = this.velocityEditEntry as any;
      any.velocityInput = undefined;
      this.velocityEditEntry.shotsFired = undefined;
      this.data.updateLoadDevEntry(this.selectedProject.id, this.velocityEditEntry);
      this.refreshSelectedProject();
      this.singleVelocityEditActive = false;
      this.cancelVelocityEdit();
      return;
    }

    // User may type one or more numbers: "2805", or "2805 2810 2808"
    const values = this.parseVelocityInput(trimmed);
    if (!values.length) {
      alert(
        'Enter one or more numeric velocities, separated by spaces or commas.'
      );
      return;
    }

    const any = this.velocityEditEntry as any;
    any.velocityInput = values.join(' ');
    this.velocityEditEntry.shotsFired = values.length;

    this.data.updateLoadDevEntry(this.selectedProject.id, this.velocityEditEntry);
    this.refreshSelectedProject();

    this.singleVelocityEditActive = false;
    this.cancelVelocityEdit();
  }

  cancelSingleVelocityEdit(): void {
    this.singleVelocityEditActive = false;
    this.cancelVelocityEdit();
  }

  private cancelVelocityEdit(): void {
    if (this.ladderWizardActive) {
      this.finishLadderWizard();
    } else {
      this.velocityEditEntry = null;
      this.velocityEditValue = '';
    }
  }
}
