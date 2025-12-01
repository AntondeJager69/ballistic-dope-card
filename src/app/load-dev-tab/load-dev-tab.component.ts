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
  type: LoadDevType | null;
  notes: string;

  powder: string;
  bullet: string;
  bulletWeightGr: number | null;
  brass: string;
  oal: number | null;
  distanceM: number | null;
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

  // Notes panel toggle for project form
  showNotesPanel = false;

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

  // Post-save yellow banner message
  postSaveMessage: string | null = null;

  // Ladder wizard
  ladderWizardActive = false;
  ladderWizardEntries: LoadDevEntry[] = [];
  ladderWizardIndex = 0;
  velocityEditEntry: LoadDevEntry | null = null;
  velocityEditValue: string | number = '';

  // Single-row velocity edit
  singleVelocityEditActive = false;

  // Graph state
  showGraph = false;
  graphCoords: { x: number; y: number; charge: number; avg: number }[] = [];
  graphSvgPoints = '';
  graphMinVel = 0;
  graphMaxVel = 0;

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
      // DEFAULT TO LADDER SO NEW PROJECT SHOWS LADDER FIELDS
      type: 'ladder',
      notes: '',
      powder: '',
      bullet: '',
      bulletWeightGr: null,
      brass: '',
      oal: null,
      distanceM: null
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
        return 'Ladder';
      case 'ocw':
        return 'OCW';
      case 'groups':
        return 'Group comparison';
      default:
        return 'Other';
    }
  }

  /** Rifle name for display in the form (we already selected rifle at top) */
  getSelectedRifleName(): string {
    if (!this.selectedRifleId) {
      return 'No rifle selected';
    }

    const rifle = this.rifles.find(r => r.id === this.selectedRifleId);
    if (rifle && rifle.name) {
      return rifle.name;
    }

    return 'Rifle ' + this.selectedRifleId;
  }

  /** Suggested project name based on rifle, type, powder, bullet etc. */
  getSuggestedProjectName(): string {
    const rifleName =
      this.rifles.find(r => r.id === this.selectedRifleId)?.name || 'Load';
    const typeLabel =
      this.projectForm.type === 'ladder'
        ? 'Ladder'
        : this.projectForm.type === 'ocw'
        ? 'OCW'
        : 'Dev';

    const powder = this.projectForm.powder?.trim()
      ? ` ${this.projectForm.powder.trim()}`
      : '';
    const bulletPart =
      this.projectForm.bulletWeightGr && this.projectForm.bullet?.trim()
        ? ` ${this.projectForm.bulletWeightGr}gr ${this.projectForm.bullet.trim()}`
        : '';

    return `${rifleName} ${typeLabel}${powder}${bulletPart}`.trim();
  }

  /** Detailed description text under the "Choose development type" field */
  get devTypeDescription(): string | null {
    switch (this.projectForm.type) {
      case 'ladder':
        return 'Ladder test: single shots with small powder charge steps. You look for a “flat spot” in velocity (low SD/ES) across 3 or more neighbouring charges – that usually indicates a stable node.';
      case 'ocw':
        return 'OCW (Optimal Charge Weight): 3–5 shot groups over a small charge window. You look for a range of charges where point of impact stays very similar while groups remain tight – that indicates a forgiving accuracy node.';
      default:
        return null;
    }
  }

  toggleNotesPanel(): void {
    this.showNotesPanel = !this.showNotesPanel;
  }

  // ---------- rifle / project loading ----------

  onRifleChange(): void {
    // When rifle changes, clear any selected project so user must choose / create one
    this.selectedProjectId = null;
    this.selectedProject = null;
    this.hasResultsForSelectedProject = false;
    this.resultsCollapsed = false;
    this.showGraph = false;
    this.graphCoords = [];
    this.graphSvgPoints = '';

    this.loadProjects();
  }

  private resetWizard(): void {
    this.showGraph = false;
  }

  private loadProjects(): void {
    if (this.selectedRifleId == null) {
      this.projects = [];
      this.selectedProject = null;
      this.selectedProjectId = null;
      this.hasResultsForSelectedProject = false;
      this.rebuildGraphData();
      this.resetWizard();
      return;
    }

    // Load all projects for this rifle
    this.projects = this.data.getLoadDevProjectsForRifle(this.selectedRifleId);

    // If we already have a selectedProjectId, try to restore it
    if (this.selectedProjectId != null) {
      this.selectedProject =
        this.projects.find(p => p.id === this.selectedProjectId) ?? null;

      // If it no longer exists, clear the selection
      if (!this.selectedProject) {
        this.selectedProjectId = null;
      }
    }

    // If no project is selected, keep everything clear –
    // user must either Select load development... or press New.
    if (this.selectedProjectId == null) {
      this.selectedProject = null;
    }

    this.updateHasResultsFlag();
    this.rebuildGraphData();
    if (!this.graphCoords.length) {
      this.showGraph = false;
    }
    this.resetWizard();
  }

  private refreshSelectedProject(): void {
    if (!this.selectedRifleId || !this.selectedProjectId) return;
    this.projects = this.data.getLoadDevProjectsForRifle(this.selectedRifleId);
    this.selectedProject =
      this.projects.find(p => p.id === this.selectedProjectId) ?? null;
    this.updateHasResultsFlag();
    this.rebuildGraphData();
    if (!this.graphCoords.length) this.showGraph = false;
  }

  onProjectSelectChange(): void {
    if (this.selectedProjectId == null) {
      this.selectedProject = null;
      this.updateHasResultsFlag();
      this.rebuildGraphData();
      this.showGraph = false;
      this.resetWizard();
    } else {
      this.selectedProject =
        this.projects.find(p => p.id === this.selectedProjectId) ?? null;
      this.updateHasResultsFlag();
      this.rebuildGraphData();
      if (!this.graphCoords.length) this.showGraph = false;
      this.resetWizard();
    }
  }

  /** Current behaviour: Open just makes sure the selectedProject is loaded and visible */
  openSelectedProject(): void {
    if (!this.selectedProjectId) {
      alert('Select a load development first.');
      return;
    }
    this.onProjectSelectChange();
    this.resultsCollapsed = false;
    this.resetWizard();
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

    // Clear any currently selected project / results / graph
    this.selectedProject = null;
    this.selectedProjectId = null;
    this.hasResultsForSelectedProject = false;
    this.resultsCollapsed = false;
    this.showGraph = false;
    this.graphCoords = [];
    this.graphSvgPoints = '';

    this.editingProject = null;
    this.projectForm = this.createEmptyProjectForm();
    this.projectForm.rifleId = this.selectedRifleId;
    // FORCE LADDER TYPE FOR NEW PROJECTS (LADDER ONLY FOR NOW)
    this.projectForm.type = 'ladder';
    this.planner = this.createEmptyPlannerForm();
    this.projectFormVisible = true;
    this.postSaveMessage = null;
    this.showNotesPanel = false;
  }

  cancelProjectForm(): void {
    this.projectFormVisible = false;
    this.editingProject = null;
    this.projectForm = this.createEmptyProjectForm();
    this.planner = this.createEmptyPlannerForm();
    this.showNotesPanel = false;
  }

  private createLadderEntriesFromPlanner(projectId: number): void {
    if (this.projectForm.type !== 'ladder') return;

    const { distanceM, startChargeGr, endChargeGr, stepGr } = this.planner;

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
    const shots = 1; // one shot per step in the ladder

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
    if (!this.selectedRifleId || !this.projectForm.name.trim()) {
      alert('Please select rifle and enter a name for the load development.');
      return;
    }

    const type: LoadDevType = (this.projectForm.type as LoadDevType) || 'ladder';

    this.postSaveMessage = null;

    if (this.editingProject) {
      const updated: LoadDevProject = {
        ...this.editingProject,
        rifleId: this.selectedRifleId,
        name: this.projectForm.name.trim(),
        type,
        notes: this.projectForm.notes.trim()
      };
      this.data.updateLoadDevProject(updated);
      this.selectedProjectId = updated.id;

      this.postSaveMessage =
        'Load development updated. Use the wizard to enter velocities, view the graph and see the highlighted nodes.';
    } else {
      const newProject: LoadDevProject = {
        id: Date.now(),
        rifleId: this.selectedRifleId,
        name: this.projectForm.name.trim(),
        type,
        notes: this.projectForm.notes.trim() || undefined,
        dateStarted: new Date().toISOString(),
        entries: []
      };
      this.data.updateLoadDevProject(newProject);
      this.selectedProjectId = newProject.id;

      this.createLadderEntriesFromPlanner(newProject.id);
      this.data.createSessionForLoadDevProject(newProject);

      this.postSaveMessage =
        'Load development planned and saved. Use the wizard to step through data entry, graph view and node highlights.';
    }

    setTimeout(() => {
      this.postSaveMessage = null;
    }, 15000);

    this.projectFormVisible = false;
    this.editingProject = null;
    this.projectForm = this.createEmptyProjectForm();
    this.planner = this.createEmptyPlannerForm();
    this.showNotesPanel = false;
    this.loadProjects();
    this.resetWizard();
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
      'bg-black text-white ring-4 ring-[#00ff00] shadow-[0_0_12px_#00ff00]':
        idx === 0,
      'bg-black text-white ring-4 ring-[#ff9900] shadow-[0_0_12px_#ff9900]':
        idx === 1,
      'bg-black text-white ring-4 ring-[#ff0000] shadow-[0_0_12px_#ff0000]':
        idx === 2
    };
  }

  // ---------- helpers for wizard / velocity input ----------

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

  // ---------- graph data builder ----------

  private rebuildGraphData(): void {
    this.graphCoords = [];
    this.graphSvgPoints = '';
    this.graphMinVel = 0;
    this.graphMaxVel = 0;

    if (!this.selectedProject || !this.selectedProject.entries?.length) {
      return;
    }

    const pts: { charge: number; avg: number }[] = [];

    for (const e of this.selectedProject.entries) {
      if (e.chargeGr == null) continue;
      const stats = this.statsForEntry(e);
      if (!stats) continue;
      pts.push({ charge: e.chargeGr, avg: stats.avg });
    }

    if (!pts.length) return;

    pts.sort((a, b) => a.charge - b.charge);

    let min = pts[0].avg;
    let max = pts[0].avg;
    for (const p of pts) {
      if (p.avg < min) min = p.avg;
      if (p.avg > max) max = p.avg;
    }

    const padding = (max - min) * 0.1 || 10;
    this.graphMinVel = min - padding;
    this.graphMaxVel = max + padding;

    const n = pts.length;
    const span = this.graphMaxVel - this.graphMinVel || 1;
    const coords: { x: number; y: number; charge: number; avg: number }[] = [];

    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const x = n === 1 ? 50 : (i / (n - 1)) * 100;
      const y = 55 - ((p.avg - this.graphMinVel) / span) * 45;
      coords.push({ x, y, charge: p.charge, avg: p.avg });
    }

    this.graphCoords = coords;
    this.graphSvgPoints = coords.map(c => `${c.x},${c.y}`).join(' ');
  }

  toggleGraph(): void {
    if (!this.graphCoords.length) {
      alert('No velocity data to graph yet.');
      return;
    }
    this.showGraph = !this.showGraph;
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

  // ---------- single-row velocity edit (replace set) ----------

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

  // ---------- back out of load dev ----------

  onBackFromLoadDev(): void {
    this.selectedProjectId = null;
    this.selectedProject = null;
    this.projectFormVisible = false;
    this.editingProject = null;

    this.entryFormVisible = false;
    this.editingEntry = null;

    this.hasResultsForSelectedProject = false;
    this.resultsCollapsed = false;
    this.showGraph = false;
    this.graphCoords = [];
    this.graphSvgPoints = '';

    this.singleVelocityEditActive = false;
    this.velocityEditEntry = null;
    this.velocityEditValue = '';

    this.ladderWizardActive = false;
    this.ladderWizardEntries = [];
    this.ladderWizardIndex = 0;

    this.postSaveMessage = null;
    this.resetWizard();
  }
}
