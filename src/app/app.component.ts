import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { RiflesTabComponent } from './rifles-tab/rifles-tab.component';
import { VenuesTabComponent } from './venues-tab/venues-tab.component';
import { SessionTabComponent } from './session-tab/session-tab.component';
import { HistoryTabComponent } from './history-tab/history-tab.component';
import { LoadDevTabComponent } from './load-dev-tab/load-dev-tab.component';
import { WindEffectToolComponent } from './wind-effect-tool.component';

import { DataService } from './data.service';
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
  styleUrls: ['./app.component.css'],
  imports: [
    CommonModule,
    FormsModule,
    RiflesTabComponent,
    VenuesTabComponent,
    SessionTabComponent,
    HistoryTabComponent,
    LoadDevTabComponent,
    WindEffectToolComponent,
  ],
})
export class AppComponent implements OnInit {
  appTitle = 'Gunstuff Ballistic Dope Card';
  appSubtitle = 'Field log for rifles, venues & sessions';
  appVersion = '1.0.0';

  currentTab: 'menu' | 'sessions' | 'rifles' | 'venues' | 'history' | 'loadDev' = 'menu';

  activeRifleName: string | null = null;
  activeVenueName: string | null = null;
  recentSessionsCount = 0;
  recentLoadDevCount = 0;

  showReportsForm = false;
  reportRequest: ReportRequest = {
    type: 'recent',
    rifleId: null,
    venueId: null,
    dateFrom: null,
    dateTo: null,
    limit: 10,
  };

  riflesOptions: any[] = [];
  venuesOptions: any[] = [];

  showTools = false;
  selectedTool: 'kestrel' | 'converter' | 'windEffect' | null = null;

  kestrelIsConnecting = false;
  kestrelStatus = 'Tap Kestrel to read environment';
  kestrelError: string | null = null;
  kestrelData: KestrelQuickSnapshot | null = null;
  kestrelLastUpdated: Date | null = null;

  converterMode: 'milToMoa' | 'moaToMil' = 'milToMoa';
  converterInput: number | null = null;

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.loadCoreData();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private loadCoreData(): void {
    try {
      const rifles = this.dataService.getRifles();
      const venues = this.dataService.getVenues();
      const sessions = this.dataService.getSessions?.() ?? [];

      this.riflesOptions = rifles || [];
      this.venuesOptions = venues || [];

      this.recentSessionsCount = sessions.length;
      this.recentLoadDevCount = 0;

      this.activeRifleName = rifles?.length ? rifles[0].name : null;
      this.activeVenueName = venues?.length ? venues[0].name : null;
    } catch (err) {
      console.error('Error loading core data in AppComponent:', err);
    }
  }

  setTab(tab: 'menu' | 'sessions' | 'rifles' | 'venues' | 'history' | 'loadDev'): void {
    this.currentTab = tab;

    if (tab !== 'menu') {
      this.showReportsForm = false;
      this.showTools = false;
      this.selectedTool = null;
    }
  }

  goToSessionsTab(): void {
    this.setTab('sessions');
  }

  toggleReportsForm(): void {
    this.showReportsForm = !this.showReportsForm;
  }

  submitReportRequest(): void {
    console.log('Report request:', this.reportRequest);
    this.showReportsForm = false;
  }

  openTools(): void {
    this.showTools = !this.showTools;
    if (!this.showTools) {
      this.selectedTool = null;
    }
  }

  onConverterToolClick(): void {
    this.selectedTool = this.selectedTool === 'converter' ? null : 'converter';
  }

  onWindEffectToolClick(): void {
    this.selectedTool = this.selectedTool === 'windEffect' ? null : 'windEffect';
  }

  get converterOutput(): number | null {
    if (this.converterInput == null || Number.isNaN(this.converterInput)) {
      return null;
    }
    const value = this.converterInput;
    return this.converterMode === 'milToMoa'
      ? Math.round(value * 3.43775 * 100) / 100
      : Math.round((value / 3.43775) * 1000) / 1000;
  }

  async onKestrelToolClick(): Promise<void> {
    if (this.selectedTool === 'kestrel') {
      this.selectedTool = null;
      return;
    }

    this.selectedTool = 'kestrel';
    this.kestrelError = null;
    this.kestrelStatus = 'Scanning for Kestrel…';
    this.kestrelIsConnecting = true;

    const kestrelServiceUuid = '03290000-eab4-dea1-b24e-44ec023874db';
    const sensorMeasurementsUuid = '03290310-eab4-dea1-b24e-44ec023874db';

    try {
      await BleClient.initialize({ androidNeverForLocation: true });

      const enabled = await BleClient.isEnabled().catch(() => true);
      if (!enabled) {
        this.kestrelStatus = 'Bluetooth is off – asking to enable…';
        await BleClient.requestEnable();
      }

      let foundDevice: any = null;

      this.kestrelStatus = 'Scanning for Kestrel (up to 8s)…';
      await BleClient.requestLEScan(
        {} as any,
        (result) => {
          const dev = result.device;
          const name = (dev?.name || '').trim();

          if (!foundDevice && name) {
            const lower = name.toLowerCase();
            const looksLikeKestrel =
              lower.startsWith('elite') ||
              lower.startsWith('kestrel') ||
              lower.includes('570') ||
              lower.includes('550');

            if (looksLikeKestrel) {
              foundDevice = dev;
            }
          }
        }
      );

      await this.sleep(8000);
      await BleClient.stopLEScan().catch(() => undefined);

      if (!foundDevice) {
        this.kestrelError = 'No Kestrel-like device found.';
        this.kestrelStatus = 'No Kestrel found – ensure it is on & broadcasting.';
        return;
      }

      this.kestrelStatus = `Connecting to ${foundDevice.name || 'Kestrel'}…`;

      await BleClient.connect(foundDevice.deviceId, () => {
        console.log('[Tools] Kestrel disconnected');
      });

      const services = await BleClient.getServices(foundDevice.deviceId);
      const hasService = services.some((svc: any) => {
        const uuid = (svc.uuid || '').toLowerCase();
        return uuid === kestrelServiceUuid;
      });

      if (!hasService) {
        throw new Error('Kestrel service not found on device');
      }

      this.kestrelStatus = 'Reading sensor measurements…';

      const raw = await BleClient.read(
        foundDevice.deviceId,
        kestrelServiceUuid,
        sensorMeasurementsUuid
      );

      const dataView = new DataView(raw.buffer);

      const getInt16 = (offset: number) => dataView.getInt16(offset, true);
      const getUint16 = (offset: number) => dataView.getUint16(offset, true);

      const tempRaw = getInt16(0);
      const rhRaw = getUint16(2);
      const pressureRaw = getUint16(4);
      const daRaw = getInt16(6);
      const windSpeedRaw = getUint16(8);
      const windDirRaw = getUint16(10);

      const temperatureC = tempRaw / 100;
      const humidityPercent = rhRaw / 100;
      const pressureInHg = pressureRaw / 1000;
      const densityAltitudeM = daRaw;
      const windSpeedMps = windSpeedRaw / 100;
      const windDirectionClock = Math.round(((windDirRaw / 360.0) * 12) || 0);

      this.kestrelData = {
        temperatureC,
        humidityPercent,
        pressureInHg,
        densityAltitudeM,
        windSpeedMps,
        windDirectionClock,
      };

      this.kestrelLastUpdated = new Date();
      this.kestrelStatus = 'Kestrel data updated.';
    } catch (err: any) {
      console.error('[Tools] Kestrel Bluetooth error:', err);
      this.kestrelError = err?.message || String(err);
      this.kestrelStatus = 'Kestrel read failed – see console for details.';
    } finally {
      this.kestrelIsConnecting = false;
    }
  }
}
