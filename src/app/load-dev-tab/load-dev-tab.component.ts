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
}

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
    notes: ''
  };

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

    const withSize = p.entries.filter(e => e.groupSize != null);
    if (withSize.length === 0) return null;

    return withSize.reduce((best, current) =>
      current.groupSize! < (best.groupSize ?? Infinity) ? current : best
    );
  }

  // ---------- Rifle & project loading ----------

  onRifleChange() {
    this.loadProjects();
    this.selectedProjectId = null;
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
    this.loadProjects();
  }

  openProject(p: LoadDevProject) {
    this.selectedProjectId = p.id;
    this.entryFormVisible = false;
    this.editingEntry = null;
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
      notes: ''
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
      groupUnit: entry.groupUnit ?? 'MOA',
      poiNote: entry.poiNote || '',
      notes: entry.notes || ''
    };
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

    const base: Omit<LoadDevEntry, 'id'> = {
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

    if (this.editingEntry) {
      const updated: LoadDevEntry = {
        ...this.editingEntry,
        ...base
      };
      this.data.updateLoadDevEntry(project.id, updated);
    } else {
      this.data.addLoadDevEntry(project.id, base);
    }

    // Reload project list and re-select
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
    if (e.groupSize != null) parts.push(`${e.groupSize} ${e.groupUnit ?? 'MOA'}`);
    return parts.join(' • ');
  }
}
