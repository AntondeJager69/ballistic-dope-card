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
  distanceM: number | null;
  shotsFired: number | null;
  groupSize: number | null;
  groupUnit: GroupSizeUnit | '';
  velocityInput: string;
  poiNote: string;
  notes: string;
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

type EntrySortMode = 'default' | 'chargeAsc' | 'groupAsc' | 'groupDesc';

@Component({
  standalone: true,
  selector: 'app-load-dev-tab',
  templateUrl: './load-dev-tab.component.html',
  styleUrls: ['./load-dev-tab.component.css'],
  imports: [CommonModule, FormsModule]
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

  entryFormVisible = false;
  editingEntry: LoadDevEntry | null = null;
  entryForm: EntryForm = this.createEmptyEntryForm();

  planner: PlannerForm = this.createEmptyPlannerForm();

  entrySortMode: EntrySortMode = 'chargeAsc';

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
      type: 'ladder' as LoadDevType,
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
  }

  newProject(): void {
    if (this.selectedRifleId == null) {
      alert('Please select a rifle first.');
      return;
    }
    this.editingProject = null;
    this.projectForm = this.createEmptyProjectForm();
    this.projectForm.rifleId = this.selectedRifleId;
    this.projectForm.type = 'ladder' as LoadDevType;
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

  openProject(project: LoadDevProject): void {
    this.selectedProjectId = project.id;
    this.selectedProject = project;
    this.resetPlannerForProject();
  }

  deleteProject(project: LoadDevProject): void {
    if (!confirm('Delete this load development project?')) {
      return;
    }
    this.data.deleteLoadDevProject(project.id);
    if (this.selectedProjectId === project.id) {
      this.selectedProjectId = null;
      this.selectedProject = null;
    }
    this.loadProjects();
  }

  // ---------------- planner: ladder / OCW range ----------------

  /** MUST be public because the template calls it */
  resetPlannerForProject(): void {
    const p = this.selectedProject;
    const defaults = this.createEmptyPlannerForm();

    if (!p) {
      this.planner = defaults;
      return;
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
    return !!this.selectedProject &&
      (this.selectedProject.type === 'ladder' ||
        this.selectedProject.type === 'ocw');
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
    this.editingEntry = null;
    this.entryForm = this.createEmptyEntryForm();

    const entries = this.selectedProject.entries;
    if (entries && entries.length > 0) {
      const last = entries[entries.length - 1];
      this.entryForm.powder = last.powder ?? '';
      this.entryForm.bullet = last.bullet ?? '';
      this.entryForm.bulletWeightGr = last.bulletWeightGr ?? null;
      this.entryForm.coal = last.coal ?? '';
      this.entryForm.primer = last.primer ?? '';
      this.entryForm.distanceM = last.distanceM ?? null;
      this.entryForm.shotsFired = last.shotsFired ?? null;
      this.entryForm.groupUnit = (last.groupUnit ?? 'MOA') as GroupSizeUnit;
    }

    this.entryFormVisible = true;
  }

  editEntry(entry: LoadDevEntry): void {
    this.editingEntry = entry;
    const anyEntry = entry as any;

    this.entryForm = {
      loadLabel: entry.loadLabel,
      powder: entry.powder ?? '',
      chargeGr: entry.chargeGr ?? null,
      coal: entry.coal ?? '',
      primer: entry.primer ?? '',
      bullet: entry.bullet ?? '',
      bulletWeightGr: entry.bulletWeightGr ?? null,
      distanceM: entry.distanceM ?? null,
      shotsFired: entry.shotsFired ?? null,
      groupSize: entry.groupSize ?? null,
      groupUnit: (entry.groupUnit ?? 'MOA') as GroupSizeUnit,
      velocityInput: anyEntry.velocityInput ?? '',
      poiNote: entry.poiNote ?? '',
      notes: entry.notes ?? ''
    };

    this.entryFormVisible = true;
  }

  duplicateEntry(entry: LoadDevEntry): void {
    if (!this.selectedProject) return;
    const anyEntry = entry as any;
    const clone: any = {
      loadLabel: entry.loadLabel,
      powder: entry.powder,
      chargeGr: entry.chargeGr,
      coal: entry.coal,
      primer: entry.primer,
      bullet: entry.bullet,
      bulletWeightGr: entry.bulletWeightGr,
      distanceM: entry.distanceM,
      shotsFired: entry.shotsFired,
      groupSize: entry.groupSize,
      groupUnit: entry.groupUnit,
      velocityInput: anyEntry.velocityInput,
      poiNote: entry.poiNote,
      notes: entry.notes
    };
    this.data.addLoadDevEntry(this.selectedProject.id, clone);
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
    const project = this.selectedProject;
    if (!project) return;

    if (!this.entryForm.loadLabel.trim()) {
      alert('Please enter a load label.');
      return;
    }

    const velocities = this.parseVelocityInput(this.entryForm.velocityInput);
    const stats = this.computeVelocityStats(velocities);

    const base: any = {
      loadLabel: this.entryForm.loadLabel.trim(),
      powder: this.entryForm.powder.trim() || undefined,
      chargeGr: this.entryForm.chargeGr ?? undefined,
      coal: this.entryForm.coal.trim() || undefined,
      primer: this.entryForm.primer.trim() || undefined,
      bullet: this.entryForm.bullet.trim() || undefined,
      bulletWeightGr: this.entryForm.bulletWeightGr ?? undefined,
      distanceM: this.entryForm.distanceM ?? undefined,
      shotsFired: this.entryForm.shotsFired ?? undefined,
      groupSize: this.entryForm.groupSize ?? undefined,
      groupUnit: this.entryForm.groupUnit || undefined,
      velocityInput: this.entryForm.velocityInput.trim() || undefined,
      poiNote: this.entryForm.poiNote.trim() || undefined,
      notes: this.entryForm.notes.trim() || undefined
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

  entrySummary(e: LoadDevEntry): string {
    const parts: string[] = [];

    if (e.chargeGr != null && e.powder) {
      parts.push(`${e.chargeGr} gr ${e.powder}`);
    } else if (e.chargeGr != null) {
      parts.push(`${e.chargeGr} gr`);
    }

    if (e.bulletWeightGr != null && e.bullet) {
      parts.push(`${e.bulletWeightGr} gr ${e.bullet}`);
    } else if (e.bulletWeightGr != null) {
      parts.push(`${e.bulletWeightGr} gr`);
    }

    if (e.distanceM != null) {
      parts.push(`${e.distanceM} m`);
    }

    if (e.shotsFired != null) {
      parts.push(`${e.shotsFired} shots`);
    }

    if (e.groupSize != null) {
      const unit = e.groupUnit ? e.groupUnit : ('MOA' as GroupSizeUnit);
      parts.push(`${e.groupSize} ${unit}`);
    }

    const stats = this.statsForEntry(e);
    if (stats) {
      parts.push(`v̄ ${stats.avg} (ES ${stats.es}, SD ${stats.sd})`);
    }

    return parts.join(' • ');
  }

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
      if (!Number.isFinite(v)) continue;
      if (v < 100 || v > 5000) continue;
      values.push(v);
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
      const d = v - avg;
      varianceSum += d * d;
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
