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
  resultsCollapsed = false;

  // Ladder wizard / velocity edit state
  velocityEditEntry: LoadDevEntry | null = null;
  velocityEditValue = '';

  ladderWizardActive = false;
  singleVelocityEditActive = false;
  ladderWizardEntries: LoadDevEntry[] = [];
  ladderWizardIndex = 0;

  hasResultsForSelectedProject = false;

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

  getLadderSummary(project: LoadDevProject): string {
    if (!project.entries || project.entries.length === 0) {
      return 'No entries yet';
    }
    const charges = project.entries
      .map(e => e.chargeGr)
      .filter(v => v != null) as number[];
    if (!charges.length) return `${project.entries.length} entries`;
    const min = Math.min(...charges);
    const max = Math.max(...charges);
    return `${project.entries.length} entries • ${min.toFixed(
      1
    )}–${max.toFixed(1)} gr`;
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
      this.hasResultsForSelectedProject = false;
      return;
    }

    this.projects = this.data.getLoadDevProjectsForRifle(this.selectedRifleId);
    if (this.selectedProjectId != null) {
      const found =
        this.projects.find(p => p.id === this.selectedProjectId) ?? null;
      this.selectedProject = found;
      if (!found) {
        this.selectedProjectId = null;
      }
    }

    if (!this.selectedProject && this.projects.length > 0) {
      this.selectedProject = this.projects[0];
      this.selectedProjectId = this.selectedProject.id;
    }

    this.updatePanelStates();
    this.updateHasResultsFlag();
  }

  onProjectSelectChange(): void {
    if (this.selectedProjectId == null) {
      this.selectedProject = null;
      this.updatePanelStates();
      this.updateHasResultsFlag();
      return;
    }

    const project =
      this.projects.find(p => p.id === this.selectedProjectId) ?? null;
    this.selectedProject = project;
    this.updatePanelStates();
    this.updateHasResultsFlag();
  }

  private updateHasResultsFlag(): void {
    if (!this.selectedProject || !this.selectedProject.entries) {
      this.hasResultsForSelectedProject = false;
      return;
    }
    this.hasResultsForSelectedProject =
      this.selectedProject.entries.length > 0 &&
      this.selectedProject.entries.some(e => !!this.statsForEntry(e));
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
    this.projectFormVisible = true;
  }

  cancelProjectForm(): void {
    this.projectFormVisible = false;
    this.editingProject = null;
    this.projectForm = this.createEmptyProjectForm();
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
    } else {
      const newProject: LoadDevProject = {
        id: Date.now(),
        rifleId: this.projectForm.rifleId,
        name: this.projectForm.name.trim(),
        type: this.projectForm.type,
        notes: this.projectForm.notes.trim() || undefined,
        dateStarted: new Date().toISOString(),
        entries: []
      } as LoadDevProject;
      this.data.updateLoadDevProject(newProject);
    }

    this.projectFormVisible = false;
    this.editingProject = null;
    this.projectForm = this.createEmptyProjectForm();
    this.loadProjects();
    if (this.selectedProject) {
      this.updatePanelStates();
    }
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

  isAwaitingData(project: LoadDevProject): boolean {
    // “Awaiting data” = entries created but no velocity stats yet
    if (!project.entries || project.entries.length === 0) return false;
    return project.entries.every(e => !this.statsForEntry(e));
  }

  private updatePanelStates(): void {
    if (!this.selectedProject) {
      this.resultsPanelOpen = false;
      this.plannerPanelOpen = false;
      return;
    }
    const hasEntries =
      this.selectedProject.entries && this.selectedProject.entries.length > 0;
    this.resultsPanelOpen = hasEntries;
  }

  get isPlannerVisible(): boolean {
    return !!this.selectedProject;
  }

  get isLadderWizardActive(): boolean {
    return (
      this.ladderWizardActive &&
      !!this.selectedProject &&
      this.selectedProject.type === 'ladder'
    );
  }

  toggleResultsCollapsed(): void {
    this.resultsCollapsed = !this.resultsCollapsed;
  }

  // ---------------- entries ----------------

  newEntry(): void {
    if (!this.selectedProject) {
      alert('Please create or select a load test first.');
      return;
    }
    this.editingEntry = null;
    this.entryFormVisible = true;
    this.entryForm = this.createEmptyEntryForm();
  }

  editEntry(entry: LoadDevEntry): void {
    this.editingEntry = entry;
    this.entryFormVisible = true;

    this.entryForm = {
      loadLabel: entry.loadLabel ?? '',
      powder: entry.powder ?? '',
      chargeGr: entry.chargeGr ?? null,
      coal: entry.coal ?? '',
      primer: entry.primer ?? '',
      bullet: entry.bullet ?? '',
      bulletWeightGr: entry.bulletWeightGr ?? null,
      bulletBc: entry.bulletBc ?? '',
      distanceM: entry.distanceM ?? null,
      shotsFired: entry.shotsFired ?? null,
      groupSize: entry.groupSize ?? null,
      groupUnit: entry.groupUnit ?? 'MOA',
      velocityInput: (entry as any).velocityInput ?? '',
      poiNote: entry.poiNote ?? '',
      notes: entry.notes ?? ''
    };
  }

  cancelEntryForm(): void {
    this.entryFormVisible = false;
    this.editingEntry = null;
    this.entryForm = this.createEmptyEntryForm();
  }

  saveEntry(): void {
    if (!this.selectedProject) return;

    const form = this.entryForm;
    const payload: Partial<LoadDevEntry> = {
      loadLabel: form.loadLabel.trim() || undefined,
      powder: form.powder.trim() || undefined,
      chargeGr: form.chargeGr ?? undefined,
      coal: form.coal.trim() || undefined,
      primer: form.primer.trim() || undefined,
      bullet: form.bullet.trim() || undefined,
      bulletWeightGr: form.bulletWeightGr ?? undefined,
      bulletBc: form.bulletBc.trim() || undefined,
      distanceM: form.distanceM ?? undefined,
      shotsFired: form.shotsFired ?? undefined,
      groupSize: form.groupSize ?? undefined,
      groupUnit: form.groupUnit ?? 'MOA',
      poiNote: form.poiNote.trim() || undefined,
      notes: form.notes.trim() || undefined
    };

    const anyPayload = payload as any;
    anyPayload.velocityInput = form.velocityInput.trim() || undefined;

    if (this.editingEntry) {
      const updatedEntry: LoadDevEntry = {
        ...this.editingEntry,
        ...anyPayload
      } as LoadDevEntry;
      this.data.updateLoadDevEntry(this.selectedProject.id, updatedEntry);
    } else {
      const existing = this.selectedProject.entries ?? [];
      const maxId = existing.length
        ? Math.max(...existing.map(e => e.id ?? 0))
        : 0;
      const newEntry: LoadDevEntry = {
        id: maxId + 1,
        ...anyPayload
      } as LoadDevEntry;
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

  // ---------------- velocity parsing & stats ----------------

  private parseVelocityInput(raw: string | undefined | null): number[] {
    if (!raw) return [];
    return raw
      .split(/[\s,;]+/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(str => Number(str))
      .filter(v => Number.isFinite(v));
  }

  statsForEntry(entry: LoadDevEntry): VelocityStats | null {
    const anyEntry = entry as any;
    const raw = anyEntry.velocityInput as string | undefined;
    const values = this.parseVelocityInput(raw);
    return this.computeVelocityStats(values);
  }

  private computeVelocityStats(values: number[]): VelocityStats | null {
    if (!values.length) return null;
    const n = values.length;
    const sorted = [...values].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const avg = values.reduce((sum, v) => sum + v, 0) / n;
    const es = max - min;

    const variance =
      values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / n;
    const sd = Math.sqrt(variance);

    return { avg, es, sd, n };
  }

  private computeSimpleSd(values: number[]): number {
    if (!values.length) return 0;
    const n = values.length;
    const mean = values.reduce((sum, v) => sum + v, 0) / n;
    const variance =
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
    return Math.sqrt(variance);
  }

  // ---------------- ladder node detection ----------------

  private computeNodesForSelectedProject(): Map<number, number> {
    const map = new Map<number, number>();

    if (!this.selectedProject || this.selectedProject.type !== 'ladder') {
      return map;
    }
    if (!this.selectedProject.entries || this.selectedProject.entries.length < 3) {
      return map;
    }

    const withStats = this.selectedProject.entries
      .map(e => ({ entry: e, stats: this.statsForEntry(e) }))
      .filter(x => !!x.stats) as { entry: LoadDevEntry; stats: VelocityStats }[];

    if (withStats.length < 3) {
      return map;
    }

    // Sort by charge for ladder order
    const sorted = withStats.sort((a, b) => {
      const aa = a.entry.chargeGr ?? Number.POSITIVE_INFINITY;
      const bb = b.entry.chargeGr ?? Number.POSITIVE_INFINITY;
      return aa - bb;
    });

    const n = sorted.length;
    const nodeGroups: number[][] = [];

    let i = 0;
    while (i + 2 < n) {
      let window = [sorted[i], sorted[i + 1], sorted[i + 2]];
      let j = i + 3;

      while (j < n) {
        const extended = [...window, sorted[j]];
        const velocities = extended.map(x => x.stats!.avg);
        const sd = this.computeSimpleSd(velocities);
        if (sd < 10) {
          window = extended;
          j++;
        } else {
          break;
        }
      }

      const velocities = window.map(x => x.stats!.avg);
      const sd = this.computeSimpleSd(velocities);
      if (window.length >= 3 && sd < 10) {
        nodeGroups.push(window.map(w => w.entry.id));
        i = j;
      } else {
        i++;
      }
    }

    nodeGroups.forEach((ids, nodeIndex) => {
      ids.forEach(id => {
        if (!map.has(id)) {
          map.set(id, nodeIndex);
        }
      });
    });

    return map;
  }

  nodeCssClass(entry: LoadDevEntry): { [klass: string]: boolean } {
    const nodes = this.computeNodesForSelectedProject();
    const nodeIndex = nodes.get(entry.id);
    return {
      'bg-green-900/40': nodeIndex === 0,
      'bg-orange-900/40': nodeIndex === 1,
      'bg-red-900/40': nodeIndex === 2
    };
  }

  // ---------------- best entry ----------------

  bestEntryForProject(project: LoadDevProject): LoadDevEntry | null {
    if (!project.entries || project.entries.length === 0) return null;

    const withStats = project.entries
      .map(e => ({ entry: e, stats: this.statsForEntry(e) }))
      .filter(x => !!x.stats) as { entry: LoadDevEntry; stats: VelocityStats }[];

    if (!withStats.length) return null;

    withStats.sort((a, b) => {
      if (!a.stats || !b.stats) return 0;
      if (a.stats.sd !== b.stats.sd) return a.stats.sd - b.stats.sd;
      return a.stats.es - b.stats.es;
    });

    return withStats[0].entry;
  }

  get bestEntryForSelectedProject(): LoadDevEntry | null {
    return this.selectedProject
      ? this.bestEntryForProject(this.selectedProject)
      : null;
  }

  // ---------------- ladder planner ----------------

  applyLadderPlan(): void {
    if (!this.selectedProject) return;

    const p = this.planner;
    if (
      p.startChargeGr == null ||
      p.endChargeGr == null ||
      p.stepGr == null ||
      p.stepGr <= 0
    ) {
      alert('Please fill in valid start, end and step.');
      return;
    }

    const [minCharge, maxCharge] = [p.startChargeGr, p.endChargeGr].sort(
      (a, b) => a - b
    );
    const entries = this.selectedProject.entries ?? [];

    const generated: LoadDevEntry[] = [];
    for (
      let charge = minCharge;
      charge <= maxCharge + 1e-6;
      charge += p.stepGr
    ) {
      const rounded = Number(charge.toFixed(2));
      const existing = entries.find(e => e.chargeGr === rounded);
      if (existing) {
        generated.push(existing);
      } else {
        const anyPayload: any = {
          chargeGr: rounded,
          distanceM: p.distanceM ?? undefined,
          shotsFired: p.shotsPerStep ?? undefined
        };
        this.data.updateLoadDevEntry(this.selectedProject.id, anyPayload);
      }
    }

    this.loadProjects();
  }

  // ---------------- ladder wizard (velocity input) ----------------

  startLadderWizard(): void {
    if (!this.selectedProject || this.selectedProject.type !== 'ladder') {
      alert('Ladder wizard is only available for Ladder tests.');
      return;
    }

    const entries = [...(this.selectedProject.entries ?? [])].sort(
      (a, b) => (a.chargeGr ?? 0) - (b.chargeGr ?? 0)
    );

    if (!entries.length) {
      alert('Please create at least one ladder entry first.');
      return;
    }

    this.ladderWizardEntries = entries;
    this.ladderWizardIndex = 0;
    this.ladderWizardActive = true;
    this.singleVelocityEditActive = false;

    this.setWizardCurrentEntry();
  }

  private setWizardCurrentEntry(): void {
    if (
      this.ladderWizardIndex < 0 ||
      this.ladderWizardIndex >= this.ladderWizardEntries.length
    ) {
      this.finishLadderWizard();
      return;
    }

    this.velocityEditEntry = this.ladderWizardEntries[this.ladderWizardIndex];
    const anyEntry = this.velocityEditEntry as any;
    this.velocityEditValue = anyEntry.velocityInput ?? '';
  }

  private finishLadderWizard(): void {
    this.ladderWizardActive = false;
    this.velocityEditEntry = null;
    this.velocityEditValue = '';
  }

  saveVelocityAndNext(): void {
    this.saveVelocityEdit();
  }

  skipVelocityAndNext(): void {
    this.ladderWizardIndex++;
    this.setWizardCurrentEntry();
  }

  cancelLadderWizard(): void {
    this.finishLadderWizard();
  }

  /**
   * Save current velocity and go to the next load.
   * Empty / 0 / invalid => behave like Skip.
   */
  saveVelocityEdit(): void {
    if (!this.selectedProject || !this.velocityEditEntry) return;

    const trimmed = this.velocityEditValue.trim();
    const v = Number(trimmed || '0');

    // If the user leaves it empty/0/invalid, treat as skip
    if (!Number.isFinite(v) || v <= 0) {
      this.skipVelocityAndNext();
      return;
    }

    const anyEntry = this.velocityEditEntry as any;
    const existing = this.parseVelocityInput(anyEntry.velocityInput);
    const updated = [...existing, v];
    anyEntry.velocityInput = updated.join(' ');

    this.data.updateLoadDevEntry(this.selectedProject.id, this.velocityEditEntry);

    // Next in wizard
    this.ladderWizardIndex++;
    this.setWizardCurrentEntry();
    this.updateHasResultsFlag();
  }

  // ---------------- single entry velocity edit (from table) ----------------

  editVelocityForEntry(entry: LoadDevEntry): void {
    this.ladderWizardActive = false;
    this.singleVelocityEditActive = true;
    this.velocityEditEntry = entry;
    const anyEntry = entry as any;
    this.velocityEditValue = anyEntry.velocityInput ?? '';
  }

  /**
   * Save a single-entry velocity edit (non-wizard mode).
   */
  saveSingleVelocity(): void {
    this.singleVelocityEditActive = false;
    this.saveVelocityEdit();
  }

  /**
   * Cancel a single-entry velocity edit (non-wizard mode).
   */
  cancelSingleVelocityEdit(): void {
    this.singleVelocityEditActive = false;
    this.cancelVelocityEdit();
  }

  /**
   * Cancel wizard / panel.
   */
  cancelVelocityEdit(): void {
    if (this.ladderWizardActive) {
      this.finishLadderWizard();
    } else {
      this.velocityEditEntry = null;
      this.velocityEditValue = '';
    }
  }
}
