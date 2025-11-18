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
  groupUnit: GroupSizeUnit;
  poiNote: string;
  notes: string;
  /** Comma-separated velocities, e.g. "2780, 2784, 2775" */
  velocityInput: string;
}

type EntrySortMode = 'default' | 'chargeAsc' | 'groupAsc' | 'groupDesc';

@Component({
  selector: 'app-load-dev-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './load-dev-tab.component.html',
  styleUrls: ['./load-dev-tab.component.css']
})
export class LoadDevTabComponent implements OnInit {
  rifles: Rifle[] = [];
  selectedRifleId: number | null = null;

  projects: LoadDevProject[] = [];
  selectedProjectId: number | null = null;

  // Project create/edit form
  projectFormVisible = false;
  editingProject: LoadDevProject | null = null;
  projectForm: ProjectForm = {
    rifleId: null,
    name: '',
    type: 'ladder',
    notes: ''
  };

  // Entry create/edit form
  entryFormVisible = false;
  editingEntry: LoadDevEntry | null = null;
  entryForm: EntryForm = {
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
    poiNote: '',
    notes: '',
    velocityInput: ''
  };

  // Sorting mode for entries in the selected project
  entrySortMode: EntrySortMode = 'default';

  constructor(private data: DataService) {}

  ngOnInit(): void {
    this.rifles = this.data.getRifles();
    if (this.rifles.length > 0) {
      this.selectedRifleId = this.rifles[0].id;
      this.loadProjects();
    }
  }

  // ---------- Helper getters ----------

  get selectedRifle(): Rifle | undefined {
    return this.rifles.find(r => r.id === this.selectedRifleId);
  }

  get selectedProject(): LoadDevProject | undefined {
    return this.projects.find(p => p.id === this.selectedProjectId);
  }

  get bestEntryForSelectedProject(): LoadDevEntry | null {
    const p = this.selectedProject;
    if (!p || !p.entries || p.entries.length === 0) return null;
    return this.bestEntryForProject(p);
  }

  get sortedEntries(): LoadDevEntry[] {
    const p = this.selectedProject;
    if (!p || !p.entries) return [];

    const entries = [...p.entries];

    if (this.entrySortMode === 'default') return entries;

    if (this.entrySortMode === 'chargeAsc') {
      return entries.sort((a, b) => {
        const ca = a.chargeGr ?? Number.POSITIVE_INFINITY;
        const cb = b.chargeGr ?? Number.POSITIVE_INFINITY;
        return ca - cb;
      });
    }

    if (this.entrySortMode === 'groupAsc' || this.entrySortMode === 'groupDesc') {
      return entries.sort((a, b) => {
        const ga = a.groupSize ?? Number.POSITIVE_INFINITY;
        const gb = b.groupSize ?? Number.POSITIVE_INFINITY;
        const diff = ga - gb;
        return this.entrySortMode === 'groupAsc' ? diff : -diff;
      });
    }

    return entries;
  }

  bestEntryForProject(p: LoadDevProject): LoadDevEntry | null {
    if (!p.entries || p.entries.length === 0) return null;
    const withSize = p.entries.filter(e => e.groupSize != null);
    if (withSize.length === 0) return null;
    return withSize.reduce((best, current) =>
      (current.groupSize ?? Infinity) < (best.groupSize ?? Infinity) ? current : best
    );
  }

  // ---------- Velocity helpers ----------

  private parseVelocityString(raw?: string): number[] {
    if (!raw) return [];
    return raw
      .split(/[,;\s]+/)
      .map(v => parseFloat(v))
      .filter(v => !Number.isNaN(v));
  }

  private computeVelocityStats(values: number[]):
    { avg: number; es: number; sd: number } | null {
    if (!values || values.length === 0) return null;
    const n = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / n;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const es = max - min;
    const variance =
      values.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / n;
    const sd = Math.sqrt(variance);

    const round1 = (x: number) => Math.round(x * 10) / 10;

    return {
      avg: Math.round(avg),
      es: round1(es),
      sd: round1(sd)
    };
  }

  /** Live stats for the entry form velocities */
  get entryVelocityStats():
    | { avg: number; es: number; sd: number }
    | null {
    const vals = this.parseVelocityString(this.entryForm.velocityInput);
    if (vals.length < 2) return null;
    return this.computeVelocityStats(vals);
  }

  /** Stats taken from a saved entry (values stored in the entry object) */
  statsForEntry(e: LoadDevEntry):
    | { avg: number; es: number; sd: number }
    | null {
    const anyE = e as any;
    if (anyE.avgVelocity == null || anyE.esVelocity == null || anyE.sdVelocity == null) {
      // Try to compute from saved string, if present
      const velString: string | undefined = anyE.velocityString;
      const vals = this.parseVelocityString(velString);
      if (vals.length < 2) return null;
      return this.computeVelocityStats(vals);
    }
    return {
      avg: anyE.avgVelocity,
      es: anyE.esVelocity,
      sd: anyE.sdVelocity
    };
  }

  // ---------- Rifle & project loading ----------

  onRifleChange() {
    this.loadProjects();
    this.selectedProjectId = null;
    this.entryFormVisible = false;
    this.editingEntry = null;
  }

  loadProjects() {
    if (!this.selectedRifleId) {
      this.projects = [];
      return;
    }
    this.projects = this.data.getLoadDevProjectsForRifle(this.selectedRifleId);
  }

  // ---------- Project form ----------

  newProject() {
    this.editingProject = null;
    this.projectFormVisible = true;
    this.projectForm = {
      rifleId: this.selectedRifleId ?? null,
      name: '',
      type: 'ladder',
      notes: ''
    };
  }

  editProject(p: LoadDevProject) {
    this.editingProject = p;
    this.projectFormVisible = true;
    this.projectForm = {
      rifleId: p.rifleId,
      name: p.name,
      type: p.type,
      notes: p.notes ?? ''
    };
  }

  cancelProjectForm() {
    this.projectFormVisible = false;
    this.editingProject = null;
  }

  saveProject() {
    if (!this.projectForm.rifleId) {
      alert('Please select a rifle for this project.');
      return;
    }
    if (!this.projectForm.name.trim()) {
      alert('Please enter a project name.');
      return;
    }

    if (this.editingProject) {
      const updated: LoadDevProject = {
        ...this.editingProject,
        rifleId: this.projectForm.rifleId,
        name: this.projectForm.name.trim(),
        type: this.projectForm.type,
        notes: this.projectForm.notes.trim() || undefined
      };
      this.data.updateLoadDevProject(updated);
      this.selectedProjectId = updated.id;
    } else {
      const created = this.data.addLoadDevProject({
        rifleId: this.projectForm.rifleId,
        name: this.projectForm.name.trim(),
        type: this.projectForm.type,
        notes: this.projectForm.notes.trim() || undefined
      });
      this.selectedProjectId = created.id;
    }

    this.projectFormVisible = false;
    this.editingProject = null;
    this.loadProjects();
  }

  deleteProject(p: LoadDevProject) {
    if (!confirm(`Delete project "${p.name}"?`)) return;
    this.data.deleteLoadDevProject(p.id);
    if (this.selectedProjectId === p.id) {
      this.selectedProjectId = null;
    }
    this.entryFormVisible = false;
    this.editingEntry = null;
    this.loadProjects();
  }

  openProject(p: LoadDevProject) {
    this.selectedProjectId = p.id;
    this.entryFormVisible = false;
    this.editingEntry = null;
    this.entrySortMode = 'default';
  }

  // ---------- Entry form ----------

  resetEntryForm() {
    this.entryForm = {
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
      poiNote: '',
      notes: '',
      velocityInput: ''
    };
    this.editingEntry = null;
  }

  newEntry() {
    if (!this.selectedProject) {
      alert('Select a project first.');
      return;
    }
    this.resetEntryForm();
    this.entryFormVisible = true;
  }

  editEntry(entry: LoadDevEntry) {
    const anyEntry = entry as any;
    this.editingEntry = entry;
    this.entryFormVisible = true;
    this.entryForm = {
      loadLabel: entry.loadLabel || '',
      powder: entry.powder || '',
      chargeGr: entry.chargeGr ?? null,
      coal: entry.coal || '',
      primer: entry.primer || '',
      bullet: entry.bullet || '',
      bulletWeightGr: entry.bulletWeightGr ?? null,
      distanceM: entry.distanceM ?? null,
      shotsFired: entry.shotsFired ?? null,
      groupSize: entry.groupSize ?? null,
      groupUnit: (entry.groupUnit as GroupSizeUnit) || 'MOA',
      poiNote: entry.poiNote || '',
      notes: entry.notes || '',
      velocityInput: anyEntry.velocityString || ''
    };
  }

  duplicateEntry(entry: LoadDevEntry) {
    const project = this.selectedProject;
    if (!project) return;

    const anyEntry = entry as any;
    const base: any = {
      loadLabel: entry.loadLabel ? `${entry.loadLabel} (copy)` : 'Copy of entry',
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
      poiNote: entry.poiNote,
      notes: entry.notes ? `${entry.notes} (copy)` : 'Copy of entry',
      velocityString: anyEntry.velocityString,
      avgVelocity: anyEntry.avgVelocity,
      esVelocity: anyEntry.esVelocity,
      sdVelocity: anyEntry.sdVelocity
    };

    this.data.addLoadDevEntry(project.id, base);
    this.loadProjects();
    const refreshed = this.projects.find(p => p.id === project.id);
    if (refreshed) {
      this.selectedProjectId = refreshed.id;
    }
  }

  cancelEntryForm() {
    this.entryFormVisible = false;
    this.editingEntry = null;
  }

  saveEntry() {
    const project = this.selectedProject;
    if (!project) {
      alert('Select a project first.');
      return;
    }
    if (!this.entryForm.loadLabel.trim()) {
      alert('Please fill in a load label (e.g. powder/charge/bullet).');
      return;
    }

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
      groupUnit: this.entryForm.groupUnit ?? 'MOA',
      poiNote: this.entryForm.poiNote.trim() || undefined,
      notes: this.entryForm.notes.trim() || undefined
    };

    // Attach velocity info to the entry (flexible "any" fields)
    const rawVel = this.entryForm.velocityInput.trim();
    if (rawVel) {
      base.velocityString = rawVel;
      const stats = this.entryVelocityStats;
      if (stats) {
        base.avgVelocity = stats.avg;
        base.esVelocity = stats.es;
        base.sdVelocity = stats.sd;
      }
    } else {
      base.velocityString = undefined;
      base.avgVelocity = undefined;
      base.esVelocity = undefined;
      base.sdVelocity = undefined;
    }

    if (this.editingEntry) {
      const updated: LoadDevEntry = {
        ...this.editingEntry,
        ...base
      };
      this.data.updateLoadDevEntry(project.id, updated);
    } else {
      this.data.addLoadDevEntry(project.id, base);
    }

    this.loadProjects();
    const refreshed = this.projects.find(p => p.id === project.id);
    if (refreshed) {
      this.selectedProjectId = refreshed.id;
    }

    this.entryFormVisible = false;
    this.editingEntry = null;
  }

  deleteEntry(entry: LoadDevEntry) {
    const project = this.selectedProject;
    if (!project) return;
    if (!confirm(`Delete entry "${entry.loadLabel}"?`)) return;

    this.data.deleteLoadDevEntry(project.id, entry.id);
    this.loadProjects();
    const refreshed = this.projects.find(p => p.id === project.id);
    if (refreshed) {
      this.selectedProjectId = refreshed.id;
    }
  }

  // ---------- Display helpers ----------

  projectTypeLabel(t: LoadDevType): string {
    switch (t) {
      case 'ladder': return 'Ladder test';
      case 'ocw': return 'OCW';
      case 'groups': return 'Group comparison';
      default: return t;
    }
  }

  shortDate(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString();
  }

  entrySummary(e: LoadDevEntry): string {
    const parts: string[] = [];
    if (e.chargeGr != null) parts.push(`${e.chargeGr} gr`);
    if (e.distanceM != null) parts.push(`${e.distanceM} m`);
    if (e.groupSize != null) {
      parts.push(`${e.groupSize} ${e.groupUnit ?? 'MOA'}`);
    }

    const stats = this.statsForEntry(e);
    if (stats) {
      parts.push(`v̄ ${stats.avg} (ES ${stats.es}, SD ${stats.sd})`);
    }

    return parts.join(' • ');
  }
}
