import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Child tabs (standalone components)
import { RiflesTabComponent } from './rifles-tab/rifles-tab.component';
import { VenuesTabComponent } from './venues-tab/venues-tab.component';
import { SessionTabComponent } from './session-tab/session-tab.component';
import { HistoryTabComponent } from './history-tab/history-tab.component';
import { LoadDevTabComponent } from './load-dev-tab/load-dev-tab.component';
import { BleClient } from '@capacitor-community/bluetooth-le';

// Data / storage service
import { DataService } from './data.service';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  imports: [
    CommonModule,
    FormsModule,
    RiflesTabComponent,
    VenuesTabComponent,
    SessionTabComponent,
    HistoryTabComponent,
    LoadDevTabComponent,
  ],
})
export class AppComponent implements OnInit {
  // ---------------------------------------------------------------------------
  // App meta + tab state
  // ---------------------------------------------------------------------------
  currentTab: 'menu' | 'sessions' | 'rifles' | 'venues' | 'history' | 'loadDev' = 'menu';

  appTitle = 'Gunstuff Ballistics';
  appSubtitle = 'Precision • Robust • Timeless';
  appVersion = '1.0.0';

  // ---------------------------------------------------------------------------
  // Menu: reports + tools visibility
  // ---------------------------------------------------------------------------
  showReportsForm = false;
  showTools = false;

  selectedTool: 'kestrel' | 'converter' | 'windEffect' | null = null;

  // ---------------------------------------------------------------------------
  // Reports panel state (used in app.component.html)
  // ---------------------------------------------------------------------------
  reportRequest: {
    type: 'recent' | 'rifle' | 'venue' | 'dateRange';
    rifleId: number | null;
    venueId: number | null;
    dateFrom: string | null;
    dateTo: string | null;
    limit: number;
  } = {
    type: 'recent',
    rifleId: null,
    venueId: null,
    dateFrom: null,
    dateTo: null,
    limit: 10,
  };

  riflesOptions: any[] = [];
  venuesOptions: any[] = [];

  // ---------------------------------------------------------------------------
  // Kestrel quick env display
  // ---------------------------------------------------------------------------
  kestrelIsConnecting = false;
  kestrelError: string | null = null;
  kestrelData: any = null;
  kestrelStatus = '';
  kestrelLastUpdated: Date | null = null;

  // ---------------------------------------------------------------------------
  // Mil / MOA converter
  // ---------------------------------------------------------------------------
  converterMode: 'milToMoa' | 'moaToMil' = 'milToMoa';
  converterInput: number | null = null;

  constructor(private dataService: DataService) {}

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------
  ngOnInit(): void {
    // Populate riflesOptions / venuesOptions for the reports dropdowns
    try {
      if (typeof this.dataService.getRifles === 'function') {
        this.riflesOptions = this.dataService.getRifles() || [];
      }
    } catch (err) {
      console.error('Error loading rifles in AppComponent:', err);
      this.riflesOptions = [];
    }

    try {
      if (typeof this.dataService.getVenues === 'function') {
        this.venuesOptions = this.dataService.getVenues() || [];
      }
    } catch (err) {
      console.error('Error loading venues in AppComponent:', err);
      this.venuesOptions = [];
    }
  }

  // ---------------------------------------------------------------------------
  // Tab navigation
  // ---------------------------------------------------------------------------
  setTab(tab: 'menu' | 'sessions' | 'rifles' | 'venues' | 'history' | 'loadDev'): void {
    this.currentTab = tab;

    // Reset menu-related UI when leaving/entering
    if (tab !== 'menu') {
      this.showReportsForm = false;
      this.showTools = false;
      this.selectedTool = null;
    }
  }

  goToSessionsTab(): void {
    this.setTab('sessions');
  }

  // ---------------------------------------------------------------------------
  // Reports
  // ---------------------------------------------------------------------------
  toggleReportsForm(): void {
    this.showReportsForm = !this.showReportsForm;
  }

  submitReportRequest(): void {
    // You can wire this up to real logic later; for now, just close the panel.
    console.log('Report request:', this.reportRequest);
    this.showReportsForm = false;
  }

  // ---------------------------------------------------------------------------
  // Tools & utilities
  // ---------------------------------------------------------------------------
  openTools(): void {
    this.showTools = !this.showTools;

    if (!this.showTools) {
      this.selectedTool = null;
    }
  }

  onKestrelToolClick(): void {
    this.selectedTool = this.selectedTool === 'kestrel' ? null : 'kestrel';
  }

  onConverterToolClick(): void {
    this.selectedTool = this.selectedTool === 'converter' ? null : 'converter';
  }

  onWindEffectToolClick(): void {
    // Wind effect tool component is temporarily removed from HTML;
    // we still toggle the state so the UI text ("Tap to open/close") behaves correctly.
    this.selectedTool = this.selectedTool === 'windEffect' ? null : 'windEffect';
  }

  // ---------------------------------------------------------------------------
  // Converter derived output (used as getter in the template)
  // ---------------------------------------------------------------------------
  get converterOutput(): number | null {
    if (this.converterInput == null || Number.isNaN(this.converterInput)) {
      return null;
    }

    const value = this.converterInput;

    if (this.converterMode === 'milToMoa') {
      // 1 mil ≈ 3.43775 MOA
      return Math.round(value * 3.43775 * 100) / 100;
    } else {
      return Math.round((value / 3.43775) * 1000) / 1000;
    }
  }
}
