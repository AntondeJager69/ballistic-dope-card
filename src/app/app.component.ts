import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Child tabs (standalone components)
import { RiflesTabComponent } from './rifles-tab/rifles-tab.component';
import { VenuesTabComponent } from './venues-tab/venues-tab.component';
import { SessionTabComponent } from './session-tab/session-tab.component';
import { HistoryTabComponent } from './history-tab/history-tab.component';
import { LoadDevTabComponent } from './load-dev-tab/load-dev-tab.component';

// Tools
import { WindEffectToolComponent } from './wind-effect-tool.component';

// Data / storage service
import { DataService } from './data.service';



// Optional: BLE if you want to hook up real Kestrel reading here
import { BleClient } from '@capacitor-community/bluetooth-le';

interface KestrelQuickSnapshot {
  temperatureC: number | null;
  pressureInHg: number | null;
  humidityPercent: number | null;
  windSpeedMps: number | null;
  windDirectionClock: number | null;
  densityAltitudeM: number | null;
}

interface ReportRequest {
  type: 'recent' | 'rifle' | 'venue' | 'dateRange';
  rifleId: string | null;
  venueId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  limit: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  imports: [
    CommonModule,
    FormsModule,
    SessionTabComponent,
    RiflesTabComponent,
    VenuesTabComponent,
     CommonModule,          // ⬅️ add this
    HistoryTabComponent,
    LoadDevTabComponent,
    WindEffectToolComponent
  ]
})
export class AppComponent implements OnInit {
  // App meta
  appTitle = 'Gunstuff Ballistic Dope Card';
  appSubtitle = 'Field log for rifles, venues & sessions';
  appVersion = '1.0.0';

  // Tabs
  currentTab: 'menu' | 'sessions' | 'rifles' | 'venues' | 'history' | 'loadDev' = 'menu';

  // Top summary values
  activeRifleName: string | null = null;
  activeVenueName: string | null = null;
  activeSubRangeLabel: string | null = null;
  activeSessionTitle: string | null = null;

  nextDistanceLabel: string | null = null;
  nextElevationLabel: string | null = null;
  nextWindageLabel: string | null = null;

  sessionsSummary = '';
  historySummary = '';
  riflesSummary = '';
  venuesSummary = '';

  // Reports
  showReportsForm = false;
  reportRequest: ReportRequest = {
    type: 'recent',
    rifleId: null,
    venueId: null,
    dateFrom: null,
    dateTo: null,
    limit: 10
  };

  riflesOptions: any[] = [];
  venuesOptions: any[] = [];

  // Tools
  showTools = false;
  selectedTool: 'kestrel' | 'converter' | 'windEffect' | null = null;


private sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}


  // Kestrel quick env state
  kestrelIsConnecting = false;
  kestrelStatus = 'Tap Kestrel to read environment';
  kestrelError: string | null = null;
  kestrelData: KestrelQuickSnapshot | null = null;
  kestrelLastUpdated: Date | null = null;

  // Converter
  converterMode: 'milToMoa' | 'moaToMil' = 'milToMoa';
  converterInput: number | null = null;

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.loadCoreData();
  }

  // ---------------------------------------------------------------------------
  // Data loading and summaries
  // ---------------------------------------------------------------------------
  private loadCoreData(): void {
    // Load rifles / venues options
    try {
      if (typeof this.dataService.getRifles === 'function') {
        this.riflesOptions = this.dataService.getRifles() || [];
      }
      if (typeof this.dataService.getVenues === 'function') {
        this.venuesOptions = this.dataService.getVenues() || [];
      }
    } catch (err) {
      console.error('Error loading rifles/venues in AppComponent:', err);
      this.riflesOptions = [];
      this.venuesOptions = [];
    }

    this.refreshSummaries();
    this.computeActiveSessionSummary();
  }

  private getSessionsSafe(): any[] {
    try {
      if (typeof (this.dataService as any).getSessions === 'function') {
        return (this.dataService as any).getSessions() || [];
      }
      if (typeof (this.dataService as any).loadSessions === 'function') {
        return (this.dataService as any).loadSessions() || [];
      }
    } catch (err) {
      console.error('Error getting sessions in AppComponent:', err);
    }
    return [];
  }

  private refreshSummaries(): void {
    const sessions = this.getSessionsSafe();

    const rifles = this.riflesOptions;
    const venues = this.venuesOptions;

    this.sessionsSummary = sessions.length === 0
      ? 'No sessions yet'
      : `${sessions.length} session${sessions.length === 1 ? '' : 's'} logged`;

    const completedSessions = sessions.filter(s => s.completed);
    this.historySummary = completedSessions.length === 0
      ? 'No completed sessions yet'
      : `${completedSessions.length} completed session${completedSessions.length === 1 ? '' : 's'}`;

    this.riflesSummary = rifles.length === 0
      ? 'No rifles set up yet'
      : `${rifles.length} rifle${rifles.length === 1 ? '' : 's'} configured`;

    this.venuesSummary = venues.length === 0
      ? 'No venues yet'
      : `${venues.length} venue${venues.length === 1 ? '' : 's'}`;
  }

  private computeActiveSessionSummary(): void {
    const sessions = this.getSessionsSafe();
    if (!sessions.length) {
      this.activeRifleName = null;
      this.activeVenueName = null;
      this.activeSubRangeLabel = null;
      this.activeSessionTitle = null;
      this.nextDistanceLabel = null;
      this.nextElevationLabel = null;
      this.nextWindageLabel = null;
      return;
    }

    // Heuristic: last session is active
    const active = sessions[sessions.length - 1];

    this.activeSessionTitle = active.title || 'Untitled session';

    // Resolve rifle name
    if (active.rifleId && this.riflesOptions.length) {
      const rifle = this.riflesOptions.find(r => r.id === active.rifleId);
      this.activeRifleName = rifle ? rifle.name : 'Unknown rifle';
    } else {
      this.activeRifleName = null;
    }

    // Resolve venue name
    if (active.venueId && this.venuesOptions.length) {
      const venue = this.venuesOptions.find(v => v.id === active.venueId);
      this.activeVenueName = venue ? venue.name : 'Unknown venue';
    } else {
      this.activeVenueName = null;
    }

    // Sub-range label (if present)
    if (active.subRange && active.subRange.name) {
      this.activeSubRangeLabel = active.subRange.name;
    } else if (active.subRangeLabel) {
      this.activeSubRangeLabel = active.subRangeLabel;
    } else {
      this.activeSubRangeLabel = null;
    }

    // Next distance & dope
    if (Array.isArray(active.dope) && active.dope.length > 0) {
      const first = active.dope[0];
      this.nextDistanceLabel = first.distanceM != null ? `${first.distanceM} m` : null;

      this.nextElevationLabel =
        first.elevationMil != null ? `${first.elevationMil.toFixed(2)} mil` : null;

      this.nextWindageLabel =
        first.windageMil != null ? `${first.windageMil.toFixed(2)} mil` : null;
    } else {
      this.nextDistanceLabel = null;
      this.nextElevationLabel = null;
      this.nextWindageLabel = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Tabs
  // ---------------------------------------------------------------------------
  setTab(tab: 'menu' | 'sessions' | 'rifles' | 'venues' | 'history' | 'loadDev'): void {
    this.currentTab = tab;
    if (tab !== 'menu') {
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
    console.log('Report request saved:', this.reportRequest);
    this.showReportsForm = false;
  }

  // ---------------------------------------------------------------------------
  // Tools: general
  // ---------------------------------------------------------------------------
  openTools(): void {
    this.showTools = !this.showTools;
    if (!this.showTools) {
      this.selectedTool = null;
    }
  }
// ---------------------------------------------------------------------------
// Kestrel quick env (Tools panel) – same decoding as SessionTab
// ---------------------------------------------------------------------------
async onKestrelToolClick(): Promise<void> {
  // Toggle off if already selected
  if (this.selectedTool === 'kestrel') {
    this.selectedTool = null;
    return;
  }

  this.selectedTool = 'kestrel';
  this.kestrelError = null;
  this.kestrelStatus = 'Scanning for Kestrel…';
  this.kestrelIsConnecting = true;

  // SAME UUIDs as SessionTabComponent
  const kestrelServiceUuid = '03290000-eab4-dea1-b24e-44ec023874db';
  const sensorMeasurementsUuid = '03290310-eab4-dea1-b24e-44ec023874db';

  try {
    // 1) Init BLE (Android 12+ friendly)
    await BleClient.initialize({ androidNeverForLocation: true });

    const enabled = await BleClient.isEnabled().catch(() => true);
    if (!enabled) {
      this.kestrelStatus = 'Bluetooth is off – asking to enable…';
      await BleClient.requestEnable();
    }

    // 2) Scan for devices and pick the first that looks like your ELITE Kestrel
    let foundDevice: any = null;

    this.kestrelStatus = 'Scanning for Kestrel (up to 8s)…';
    console.log('[Tools] Starting BLE scan…');

    await BleClient.requestLEScan(
      {} as any,
      (result) => {
        const dev = result.device;
        const name = (dev?.name || '').trim();
        console.log('[Tools] Scan result:', dev);

        if (!foundDevice && name) {
          const lower = name.toLowerCase();

          const looksLikeKestrel =
            lower.startsWith('elite') ||
            lower.includes('elite') ||
            lower.includes('2998') ||
            lower.includes('kestrel') ||
            lower.startsWith('k5') ||
            lower.startsWith('k7') ||
            lower.includes('5700');

          if (looksLikeKestrel) {
            foundDevice = dev;
            this.kestrelStatus = `Found ${name}, preparing to connect…`;
            console.log('[Tools] Selected Kestrel candidate:', dev);
          }
        }
      }
    );

    // Wait up to ~10 seconds for a match
    const timeoutMs = 10000;
    const start = Date.now();
    while (!foundDevice && Date.now() - start < timeoutMs) {
      await this.sleep(400);
    }

    await BleClient.stopLEScan().catch(err =>
      console.warn('[Tools] stopLEScan failed (not fatal):', err)
    );
    console.log('[Tools] Stopped BLE scan');

    if (!foundDevice) {
      this.kestrelStatus = 'No Kestrel device found during scan.';
      this.kestrelError =
        'No Kestrel seen in BLE scan. Ensure LiNK/Bluetooth is enabled on the device.';
      return;
    }

    const device = foundDevice;
    this.kestrelStatus = `Connecting to ${device.name || device.deviceId}…`;
    console.log('[Tools] Connecting to device:', device);

    // 3) Connect
    await BleClient.connect(device.deviceId);
    this.kestrelStatus = 'Reading measurements…';

    // 4) Read the Sensor Measurements characteristic (single read)
    const value = await BleClient.read(
      device.deviceId,
      kestrelServiceUuid,
      sensorMeasurementsUuid
    );

    console.log('[Tools] Kestrel SensorMeasurements raw:', value);

    // 5) Decode into a quick snapshot (same math as SessionTab)
    this.kestrelData = this.parseKestrelSnapshot(value);
    this.kestrelLastUpdated = new Date();
    this.kestrelStatus = 'Kestrel data updated.';

    // 6) Cleanly disconnect (Tools only needs a one-shot read)
    try {
      await BleClient.disconnect(device.deviceId);
    } catch {
      // ignore
    }

  } catch (err: any) {
    console.error('[Tools] Kestrel Bluetooth error:', err);
    this.kestrelError = err?.message || String(err);
    this.kestrelStatus = 'Kestrel error – see console for details.';
  } finally {
    this.kestrelIsConnecting = false;
  }
}

private parseKestrelSnapshot(value: DataView | Uint8Array): KestrelQuickSnapshot {
  // Make sure we have a DataView like in SessionTab
  const dv =
    value instanceof DataView
      ? value
      : new DataView(
          (value as any).buffer
            ? (value as any).buffer
            : new Uint8Array(value as any).buffer
        );

  // Byte layout (same as SessionTab):
  // wind, temp, humidity, pressure – each 2 bytes, LE
  const windRaw = dv.getUint16(0, true);     // m/s * 100
  const tempRaw = dv.getInt16(2, true);      // °C * 100
  const rhRaw = dv.getUint16(4, true);       // % * 10
  const pressureRaw = dv.getUint16(6, true); // hPa * 10

  const windMs = windRaw / 100;
  const tempC = tempRaw / 100;
  const humidity = rhRaw / 10;
  const pressureHpa = pressureRaw / 10;
  const pressureInHg = pressureHpa * 0.02953; // hPa → inHg

  console.log('[Tools] Parsed snapshot:', {
    windRaw,
    tempRaw,
    rhRaw,
    pressureRaw,
    windMs,
    tempC,
    humidity,
    pressureHpa,
    pressureInHg
  });

  return {
    temperatureC: +tempC.toFixed(1),
    pressureInHg: +pressureInHg.toFixed(2),
    humidityPercent: +humidity.toFixed(0),
    windSpeedMps: +windMs.toFixed(1),
    windDirectionClock: 12,   // we don’t get direction from this char – assume 12 o’clock
    densityAltitudeM: null    // DA intentionally not used in Tools
  };
}


  // ---------------------------------------------------------------------------
  // Converter
  // ---------------------------------------------------------------------------
  setConverterMode(mode: 'milToMoa' | 'moaToMil'): void {
    this.converterMode = mode;
  }

  get converterOutput(): number | null {
    if (this.converterInput == null || isNaN(this.converterInput as any)) {
      return null;
    }
    const factor = 3.43774677;
    if (this.converterMode === 'milToMoa') {
      const v = this.converterInput * factor;
      return +v.toFixed(2);
    } else {
      const v = this.converterInput / factor;
      return +v.toFixed(3);
    }
  }

  onConverterToolClick(): void {
    if (this.selectedTool === 'converter') {
      this.selectedTool = null;
    } else {
      this.selectedTool = 'converter';
    }
  }

  // ---------------------------------------------------------------------------
  // Wind Effect Tool
  // ---------------------------------------------------------------------------
  onWindEffectToolClick(): void {
    if (this.selectedTool === 'windEffect') {
      this.selectedTool = null;
    } else {
      this.selectedTool = 'windEffect';
    }
  }
}
