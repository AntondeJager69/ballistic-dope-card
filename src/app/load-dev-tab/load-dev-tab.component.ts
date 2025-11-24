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
  bulletBc: string;                 // ✅ BC per entry
  distanceM: number | null;
  shotsFired: number | null;
  groupSize: number | null;
  groupUnit: GroupSizeUnit;
  poiNote: string;
  notes: string;
  velocityInput: string;
}

interface PlannerForm {
  powder: string;
  bullet: string;
  bulletWeightGr: number | null;
  coal: string;
  primer: string;
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

@Component({
  selector: 'app-load-dev-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './load-dev-tab.component.html'
})
export class LoadDevTabComponent implements OnInit {
  rifles: Rifle[] = [];
  selectedRifleId: number | null = null;

  projects: LoadDevProject[] = [];
  selectedProjectId: number | null = null;
  selectedProject: LoadDevProject | null = null;

  projectFormVisible = false;
  editingProject: LoadDevProject | null = null;
  projectForm: ProjectForm = this.createEmptyProjectForm();

  planner: PlannerForm = this.createEmptyPlannerForm();
  plannerPanelOpen = false;

  entryFormVisible = false;
  editingEntry: LoadDevEntry | null = null;
  entryForm: EntryForm = this.createEmptyEntryForm();

  entrySortMode: 'default' | 'chargeAsc' | 'groupAsc' | 'groupDesc' = 'default';

  resultsPanelOpen = false;

  constructor(private data: DataService) {}

  // ---------------- lifecycle ----------------

  ngOnInit(): void {
    this.rifles = this.data.getRifles();
    if (this.rifles.length > 0) {
      this.selectedRifleId = this.rifles[0].id;
      this.loadProjects();
    }
  }

  // ---------------- helpers ----------------

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
      poiNote: '',
      notes: '',
      velocityInput: ''
    };
  }

  private createEmptyPlannerForm(): PlannerForm {
    return {
      powder: '',
      bullet: '',
      bulletWeightGr: null,
      coal: '',
      primer: '',
      distanceM: null,
      shotsPerStep: null,
      startChargeGr: null,
      endChargeGr: null,
      stepGr: null
    };
  }

  private shortDate(value: string | Date | null | undefined): string {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit'
    });
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
        return String(type);
    }
  }

  asDateString(value: string | Date | null | undefined): string {
    return this.shortDate(value);
  }

  // ---------------- rifles & projects ----------------

  onRifleChange(): void {
    this.loadProjects();
  }

  private loadProjects(): void {
    if (this.selectedRifleId == null) {
      this.projects = [];
      this.selectedProject = null;
      this.selectedProjectId = null;
      this.updatePanelStates();
      return;
    }

    this.projects = this.data.getLoadDevProjectsForRifle(this.selectedRifleId);
    if (this.selectedProjectId) {
      this.selectedProject =
        this.projects.find(p => p.id === this.selectedProjectId) ?? null;
    } else {
      this.selectedProject = this.projects.length ? this.projects[0] : null;
      this.selectedProjectId = this.selectedProject?.id ?? null;
    }

    this.resetPlannerForProject();
    this.updatePanelStates();
  }

  newProject(): void {
    if (this.selectedRifleId == null) {
      alert('Please select a rifle first.');
      return;
    }
    this.editingProject = null;
    this.projectForm = this.createEmptyProjectForm();
    this.projectForm.rifleId = this.selectedRifleId;
    this.projectForm.type = 'ladder';

    // Auto-suggest a simple name: "<Rifle> Ladder test <date>"
    const rifle = this.rifles.find(r => r.id === this.selectedRifleId);
    const dateLabel = this.shortDate(new Date().toISOString());
    if (rifle) {
      this.projectForm.name = `${rifle.name} ${this.projectTypeLabel(
        this.projectForm.type
      )} ${dateLabel}`;
    }

    this.projectFormVisible = true;
  }

  editProject(project: LoadDevProject): void {
    this.editingProject = project;
    this.projectForm = {
      rifleId: project.rifleId,
      name: project.name,
      type: project.type,
      notes: project.notes ?? ''
    };
    this.projectFormVisible = true;
  }

  cancelProjectForm(): void {
    this.projectFormVisible = false;
    this.editingProject = null;
  }

  saveProject(): void {
    if (this.projectForm.rifleId == null) {
      alert('Please select a rifle for this project.');
      return;
    }
    if (!this.projectForm.name.trim()) {
      alert('Please enter a project name.');
      return;
    }

    const rifleId = this.projectForm.rifleId;
    const name = this.projectForm.name.trim();
    const type = this.projectForm.type;
    const notes = this.projectForm.notes.trim() || undefined;

    if (this.editingProject) {
      const updated: LoadDevProject = {
        ...this.editingProject,
        rifleId,
        name,
        type,
        notes
      };
      this.data.updateLoadDevProject(updated);
      this.selectedProjectId = updated.id;
    } else {
      const created = this.data.addLoadDevProject({
        rifleId,
        name,
        type,
        notes,
        dateStarted: new Date().toISOString(),
        entries: []
      });
      this.selectedProjectId = created.id;
    }

    this.projectFormVisible = false;
    this.editingProject = null;
    this.loadProjects();
  }

  deleteProject(project: LoadDevProject): void {
    if (!confirm(`Delete load development project "${project.name}"?`)) {
      return;
    }
    this.data.deleteLoadDevProject(project.id);
    if (this.selectedProjectId === project.id) {
      this.selectedProjectId = null;
      this.selectedProject = null;
    }
    this.loadProjects();
  }

  openProject(project: LoadDevProject): void {
    this.selectedProjectId = project.id;
    this.selectedProject = project;
    this.resetPlannerForProject();
    this.updatePanelStates();
  }

  // ---------------- planner ----------------

  private resetPlannerForProject(): void {
    const defaults: PlannerForm = this.createEmptyPlannerForm();

    const p = this.selectedProject;
    if (!p) {
      this.planner = defaults;
      return;
    }

    const entries = p.entries ?? [];
    if (entries.length > 0) {
      const last = entries[entries.length - 1];
      defaults.powder = last.powder ?? '';
      defaults.bullet = last.bullet ?? '';
      defaults.bulletWeightGr = last.bulletWeightGr ?? null;
      defaults.coal = last.coal ?? '';
      defaults.primer = last.primer ?? '';
      defaults.distanceM = last.distanceM ?? null;
    }

    if (entries.length >= 2) {
      const charges = entries
        .map(e => e.chargeGr ?? null)
        .filter((v): v is number => v != null);

      if (charges.length >= 2) {
        charges.sort((a, b) => a - b);
        defaults.startChargeGr = charges[0];
        defaults.endChargeGr = charges[charges.length - 1];

        if (charges.length >= 3) {
          const diffs: number[] = [];
          for (let i = 1; i < charges.length; i++) {
            diffs.push(charges[i] - charges[i - 1]);
          }
          const avgDiff =
            diffs.reduce((sum, v) => sum + v, 0) / Math.max(diffs.length, 1);
          defaults.stepGr = Number(avgDiff.toFixed(2));
        }
      }
    }

    if (p.type === 'ocw') {
      defaults.shotsPerStep = 3;
    } else if (p.type === 'ladder') {
      defaults.shotsPerStep = 1;
    } else {
      defaults.shotsPerStep = 3;
    }

    this.planner = defaults;
  }

  usePlannerDefaultsForExisting(): void {
    this.resetPlannerForProject();
  }

  get isPlannerVisible(): boolean {
    // Planner is useful for all test types (ladder, OCW, groups)
    return !!this.selectedProject;
  }

  private updatePanelStates(): void {
    if (!this.selectedProject) {
      this.resultsPanelOpen = false;
      this.plannerPanelOpen = false;
      return;
    }
    const hasEntries =
      Array.isArray(this.selectedProject.entries) &&
      this.selectedProject.entries.length > 0;

    this.resultsPanelOpen = hasEntries;
    this.plannerPanelOpen = !hasEntries && this.isPlannerVisible;
  }

  get hasResultsForSelectedProject(): boolean {
    if (!this.selectedProject || !this.selectedProject.entries) return false;
    return this.selectedProject.entries.some(e => this.hasResultData(e));
  }

  private hasResultData(entry: LoadDevEntry): boolean {
    if (!entry) return false;
    const anyEntry = entry as any;
    const raw = (anyEntry.velocityInput as string | undefined) ?? '';
    const hasVelocities = raw.trim().length > 0;
    const hasGroupSize = entry.groupSize != null && entry.groupSize > 0;
    const hasShots = entry.shotsFired != null && entry.shotsFired > 0;
    return hasVelocities || hasGroupSize || hasShots;
  }

  isAwaitingData(project: LoadDevProject): boolean {
    if (!project || !project.entries || project.entries.length === 0) {
      return false;
    }
    return !project.entries.some(e => this.hasResultData(e));
  }

  generateSeriesFromPlanner(): void {
    const project = this.selectedProject;
    if (!project) return;

    const {
      powder,
      bullet,
      bulletWeightGr,
      coal,
      primer,
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
      stepGr <= 0
    ) {
      alert('Please enter valid start, end and step charges.');
      return;
    }

    if (endChargeGr < startChargeGr) {
      alert('End charge must be greater than or equal to start charge.');
      return;
    }

    const totalSteps = Math.floor((endChargeGr - startChargeGr) / stepGr) + 1;
    if (totalSteps <= 0 || totalSteps > 60) {
      alert('Please choose a reasonable number of steps (1–60).');
      return;
    }

    const shots = shotsPerStep && shotsPerStep > 0 ? shotsPerStep : undefined;

    for (let i = 0; i < totalSteps; i++) {
      const charge = Number((startChargeGr + i * stepGr).toFixed(2));

      const labelParts: string[] = [];
      labelParts.push(`${charge} gr`);
      if (powder.trim()) labelParts.push(powder.trim());
      if (bulletWeightGr != null && bullet.trim()) {
        labelParts.push(`${bulletWeightGr} gr ${bullet.trim()}`);
      } else if (bullet.trim()) {
        labelParts.push(bullet.trim());
      }
      const loadLabel = labelParts.join(' ');

      const base: any = {
        loadLabel,
        powder: powder.trim() || undefined,
        chargeGr: charge,
        coal: coal.trim() || undefined,
        primer: primer.trim() || undefined,
        bullet: bullet.trim() || undefined,
        bulletWeightGr: bulletWeightGr ?? undefined,
        distanceM: distanceM ?? undefined,
        shotsFired: shots ?? undefined
      };

      this.data.addLoadDevEntry(project.id, base);
    }

    this.loadProjects();
  }

  // ---------------- entries ----------------

  get entriesForSelectedProject(): LoadDevEntry[] {
    if (!this.selectedProject) return [];
    const list = [...this.selectedProject.entries];

    switch (this.entrySortMode) {
      case 'chargeAsc':
        return list.sort((a, b) => {
          const aa = a.chargeGr ?? Number.POSITIVE_INFINITY;
          const bb = b.chargeGr ?? Number.POSITIVE_INFINITY;
          return aa - bb;
        });
      case 'groupAsc':
        return list.sort((a, b) => {
          const aa = a.groupSize ?? Number.POSITIVE_INFINITY;
          const bb = b.groupSize ?? Number.POSITIVE_INFINITY;
          return aa - bb;
        });
      case 'groupDesc':
        return list.sort((a, b) => {
          const aa = a.groupSize ?? Number.NEGATIVE_INFINITY;
          const bb = b.groupSize ?? Number.NEGATIVE_INFINITY;
          return bb - aa;
        });
      default:
        return list;
    }
  }

  newEntry(): void {
    if (!this.selectedProject) return;
    const project = this.selectedProject;

    this.entryForm = this.createEmptyEntryForm();
    this.editingEntry = null;

    const entries = this.selectedProject.entries;
    if (entries && entries.length > 0) {
      const last = entries[entries.length - 1];
      const anyLast = last as any;

      this.entryForm.powder = last.powder ?? '';
      this.entryForm.bullet = last.bullet ?? '';
      this.entryForm.bulletWeightGr = last.bulletWeightGr ?? null;
      this.entryForm.bulletBc = anyLast.bulletBc || '';   // ✅ carry BC forward
      this.entryForm.coal = last.coal ?? '';
      this.entryForm.primer = last.primer ?? '';
      this.entryForm.distanceM = last.distanceM ?? null;
      this.entryForm.shotsFired = last.shotsFired ?? null;
      this.entryForm.groupUnit = (last.groupUnit ?? 'MOA') as GroupSizeUnit;
    }

    this.entryFormVisible = true;
  }

  editEntry(entry: LoadDevEntry): void {
    if (!this.selectedProject) return;

    const anyEntry = entry as any;

    this.editingEntry = entry;
    this.entryFormVisible = true;

    this.entryForm.loadLabel = entry.loadLabel ?? '';
    this.entryForm.powder = entry.powder ?? '';
    this.entryForm.chargeGr = entry.chargeGr ?? null;
    this.entryForm.coal = entry.coal ?? '';
    this.entryForm.primer = entry.primer ?? '';
    this.entryForm.bullet = entry.bullet ?? '';
    this.entryForm.bulletWeightGr = entry.bulletWeightGr ?? null;
    this.entryForm.bulletBc = anyEntry.bulletBc || '';
    this.entryForm.distanceM = entry.distanceM ?? null;
    this.entryForm.shotsFired = entry.shotsFired ?? null;
    this.entryForm.groupSize = entry.groupSize ?? null;
    this.entryForm.groupUnit = (entry.groupUnit ?? 'MOA') as GroupSizeUnit;
    this.entryForm.poiNote = entry.poiNote ?? '';
    this.entryForm.notes = entry.notes ?? '';
    this.entryForm.velocityInput = anyEntry.velocityInput || '';
  }

  duplicateEntry(entry: LoadDevEntry): void {
    if (!this.selectedProject) return;
    const project = this.selectedProject;

    const anyEntry = entry as any;

    const clone: any = {
      ...anyEntry,
      id: undefined,
      velocityInput: anyEntry.velocityInput || '',
      createdAt: new Date().toISOString()
    };
    this.data.addLoadDevEntry(project.id, clone);
    this.loadProjects();
  }

  deleteEntry(entry: LoadDevEntry): void {
    if (!this.selectedProject) return;
    if (!confirm('Delete this test entry?')) return;
    this.data.deleteLoadDevEntry(this.selectedProject.id, entry.id);
    this.loadProjects();
  }

  cancelEntryForm(): void {
    this.entryFormVisible = false;
    this.editingEntry = null;
  }

  saveEntry(): void {
    if (!this.selectedProject) return;
    const project = this.selectedProject;

    const trimmedLabel = this.entryForm.loadLabel.trim();
    if (!trimmedLabel) {
      alert('Please enter a load label.');
      return;
    }

    const anyForm = this.entryForm as any;

    const base: any = {
      loadLabel: trimmedLabel,
      powder: this.entryForm.powder.trim() || undefined,
      chargeGr: this.entryForm.chargeGr ?? undefined,
      coal: this.entryForm.coal.trim() || undefined,
      primer: this.entryForm.primer.trim() || undefined,
      bullet: this.entryForm.bullet.trim() || undefined,
      bulletWeightGr: this.entryForm.bulletWeightGr ?? undefined,
      distanceM: this.entryForm.distanceM ?? undefined,
      shotsFired: this.entryForm.shotsFired ?? undefined,
      groupSize: this.entryForm.groupSize ?? undefined,
      groupUnit: this.entryForm.groupUnit ?? 'MOA',
      poiNote: this.entryForm.poiNote.trim() || undefined,
      notes: this.entryForm.notes.trim() || undefined,
      velocityInput: this.entryForm.velocityInput.trim() || undefined,
      bulletBc: this.entryForm.bulletBc.trim() || undefined
    };

    if (this.editingEntry) {
      const updated: LoadDevEntry = {
        ...(this.editingEntry as any),
        ...base
      };
      this.data.updateLoadDevEntry(project.id, updated);
    } else {
      this.data.addLoadDevEntry(project.id, base);
    }

    this.entryFormVisible = false;
    this.editingEntry = null;
    this.loadProjects();
  }

  // ---------------- entry summary & "best" ----------------

  bestEntryForProject(p: LoadDevProject): LoadDevEntry | null {
    if (!p.entries || p.entries.length === 0) return null;
    const withGroup = p.entries.filter(e => e.groupSize != null);
    if (withGroup.length === 0) return null;

    let best: LoadDevEntry | null = null;
    let bestGroup = Infinity;
    let bestSd = Infinity;

    for (const e of withGroup) {
      const g = e.groupSize ?? Infinity;
      const stats = this.statsForEntry(e);
      const sd = stats?.sd ?? Infinity;

      if (g < bestGroup || (g === bestGroup && sd < bestSd)) {
        best = e;
        bestGroup = g;
        bestSd = sd;
      }
    }

    return best;
  }

  get bestEntryForSelectedProject(): LoadDevEntry | null {
    if (!this.selectedProject) return null;
    return this.bestEntryForProject(this.selectedProject);
  }

  // ---------------- velocities & stats ----------------

  get entryVelocityStats(): VelocityStats | null {
    return this.computeVelocityStats(
      this.parseVelocityInput(this.entryForm.velocityInput)
    );
  }

  private parseVelocityInput(raw: string | undefined | null): number[] {
    if (!raw) return [];
    const tokens = raw
      .split(/[\s,;]+/g)
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const values: number[] = [];
    for (const token of tokens) {
      const v = Number(token);
      if (!Number.isNaN(v)) {
        values.push(v);
      }
    }
    return values;
  }

  private computeVelocityStats(values: number[]): VelocityStats | null {
    if (!values || values.length < 2) return null;
    const n = values.length;
    const sum = values.reduce((acc, v) => acc + v, 0);
    const avg = sum / n;

    let min = values[0];
    let max = values[0];
    for (const v of values) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const es = max - min;

    let varianceSum = 0;
    for (const v of values) {
      const diff = v - avg;
      varianceSum += diff * diff;
    }
    const variance = varianceSum / (n - 1);
    const sd = Math.sqrt(variance);

    return {
      avg: Math.round(avg),
      es: Math.round(es),
      sd: Math.round(sd * 10) / 10,
      n
    };
  }

  statsForEntry(entry: LoadDevEntry): VelocityStats | null {
    const anyEntry = entry as any;
    const raw = anyEntry.velocityInput as string | undefined;
    const values = this.parseVelocityInput(raw);
    return this.computeVelocityStats(values);
  }
}
