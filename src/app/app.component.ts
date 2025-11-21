import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { RiflesTabComponent } from './rifles-tab/rifles-tab.component';
import { VenuesTabComponent } from './venues-tab/venues-tab.component';
import { SessionTabComponent } from './session-tab/session-tab.component';
import { HistoryTabComponent } from './history-tab/history-tab.component';
import { LoadDevTabComponent } from './load-dev-tab/load-dev-tab.component';

import { BleClient } from '@capacitor-community/bluetooth-le';

type AppTab = 'menu' | 'rifles' | 'venues' | 'session' | 'history' | 'loaddev';

interface QuickKestrelSnapshot {
  temperatureC: number;
  humidityPercent: number;
  pressureHpa: number;
  windSpeedMph: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RiflesTabComponent,
    VenuesTabComponent,
    SessionTabComponent,
    HistoryTabComponent,
    LoadDevTabComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  // Basic app info
  appTitle = 'Gunstuff Ballistics';
  appSubtitle = 'ELR / Precision shooting logbook';
  appVersion = '1.0.0';

  // Tabs
  currentTab: AppTab = 'menu';

  // Reports mini-wizard
  showReportsForm = false;
  reportTopic = '';
  reportDetails = '';

  // ---------------- Quick Kestrel (Main menu) ----------------

  // Same UUIDs as in your Sessions tab
  private readonly kestrelServiceUuid = '03290000-eab4-dea1-b24e-44ec023874db';
  private readonly sensorMeasurementsUuid = '03290310-eab4-dea1-b24e-44ec023874db';

  kestrelStatus = 'Idle – tap to read from Kestrel.';
  kestrelError: string | null = null;
  kestrelIsConnecting = false;
  kestrelLastUpdate: Date | null = null;
  kestrelData: QuickKestrelSnapshot | null = null;

  private kestrelDeviceId: string | null = null;
  private kestrelAutoDisconnectTimer: any | null = null;

  // ---------------- Tabs / menu ----------------

  setTab(tab: AppTab) {
    this.currentTab = tab;
  }

  startEvent() {
    this.currentTab = 'session';
  }

  openLoadDevelopment() {
    this.currentTab = 'loaddev';
  }

  openReports() {
    this.showReportsForm = !this.showReportsForm;
  }

  submitReportRequest() {
    // You can persist or route this to a more advanced reporting system later.
    // For now we just close the form.
    this.showReportsForm = false;
  }

  // ---------------- Quick Kestrel helpers ----------------

  resetKestrelQuick() {
    this.clearKestrelAutoDisconnect();
    this.kestrelStatus = 'Idle – tap to read from Kestrel.';
    this.kestrelError = null;
    this.kestrelLastUpdate = null;
    this.kestrelData = null;
    this.kestrelIsConnecting = false;
    this.kestrelDeviceId = null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private clearKestrelAutoDisconnect() {
    if (this.kestrelAutoDisconnectTimer) {
      clearTimeout(this.kestrelAutoDisconnectTimer);
      this.kestrelAutoDisconnectTimer = null;
    }
  }

  private scheduleKestrelAutoDisconnect() {
    this.clearKestrelAutoDisconnect();

    if (!this.kestrelDeviceId) {
      return;
    }

    this.kestrelAutoDisconnectTimer = setTimeout(() => {
      console.log('[Quick Kestrel] Auto-disconnect after 1 minute');
      void this.forceKestrelDisconnect();
    }, 60_000);
  }

  private async forceKestrelDisconnect() {
    this.clearKestrelAutoDisconnect();

    if (this.kestrelDeviceId) {
      try {
        await BleClient.disconnect(this.kestrelDeviceId);
      } catch (err) {
        console.warn('[Quick Kestrel] Error during auto-disconnect', err);
      }
    }

    this.kestrelDeviceId = null;
    this.kestrelIsConnecting = false;
    this.kestrelStatus = 'Idle – Kestrel disconnected after 1 minute.';
  }

  // ---------------- Main entry: button on menu ----------------

  async startQuickKestrelReading(): Promise<void> {
    // Clean previous state
    this.clearKestrelAutoDisconnect();
    if (this.kestrelDeviceId) {
      try {
        await BleClient.disconnect(this.kestrelDeviceId);
      } catch (err) {
        console.warn('[Quick Kestrel] Error disconnecting previous device', err);
      }
      this.kestrelDeviceId = null;
    }

    this.kestrelIsConnecting = true;
    this.kestrelError = null;
    this.kestrelStatus = 'Initializing Bluetooth…';

    try {
      await BleClient.initialize({ androidNeverForLocation: true });

      const enabled = await BleClient.isEnabled().catch(() => true);
      if (!enabled) {
        this.kestrelStatus = 'Requesting Bluetooth enable…';
        await BleClient.requestEnable();
      }

      // Scan
      this.kestrelStatus = 'Scanning for Kestrel (up to 8s)…';
      let foundDevice: any = null;

      await BleClient.requestLEScan(
        {} as any,
        (result) => {
          const dev = result.device;
          const name = (dev?.name || '').trim();
          if (!name) return;

          const lower = name.toLowerCase();
          const looksLikeKestrel =
            lower.startsWith('elite') ||
            lower.includes('elite') ||
            lower.includes('kestrel') ||
            lower.includes('5700') ||
            lower.includes('2998');

          if (!foundDevice && looksLikeKestrel) {
            console.log('[Quick Kestrel] Found candidate:', dev);
            foundDevice = dev;
          }
        }
      );

      const timeoutMs = 8000;
      const start = Date.now();
      while (!foundDevice && Date.now() - start < timeoutMs) {
        await this.sleep(400);
      }

      await BleClient.stopLEScan().catch(err =>
        console.warn('[Quick Kestrel] stopLEScan failed (not fatal)', err)
      );

      if (!foundDevice) {
        this.kestrelStatus = 'No Kestrel found in scan.';
        this.kestrelError = 'Ensure LiNK/Bluetooth is enabled on your Kestrel.';
        return;
      }

      const device = foundDevice;
      this.kestrelDeviceId = device.deviceId || device.id || null;

      this.kestrelStatus = `Connecting to ${device.name || device.deviceId}…`;
      await BleClient.connect(device.deviceId, (id) => {
        console.log('[Quick Kestrel] Disconnected callback', id);
        this.kestrelDeviceId = null;
        this.clearKestrelAutoDisconnect();
        this.kestrelIsConnecting = false;
        this.kestrelStatus = 'Idle – Kestrel disconnected.';
      });

      // Discover services
      let services: any[] = [];
      try {
        services = await BleClient.getServices(device.deviceId);
        console.log('[Quick Kestrel] Services:', services);
      } catch (err) {
        console.warn('[Quick Kestrel] getServices failed (not fatal)', err);
      }

      const service = services.find(s =>
        s.uuid?.toLowerCase() === this.kestrelServiceUuid.toLowerCase()
      );

      if (!service) {
        this.kestrelStatus =
          'Connected, but Kestrel Weather service (03290000-…) not found.';
        this.kestrelError =
          'Check console for full service list and confirm UUIDs.';
        this.kestrelIsConnecting = false;
        return;
      }

      const char = (service.characteristics || []).find((c: any) =>
        c.uuid?.toLowerCase() === this.sensorMeasurementsUuid.toLowerCase()
      );

      if (!char) {
        this.kestrelStatus =
          'Connected, Weather service found, but Sensor Measurements (03290310-…) missing.';
        this.kestrelError =
          'Check characteristics list under 03290000-… and adjust UUID if needed.';
        this.kestrelIsConnecting = false;
        return;
      }

      // Read one sample
      const value = await BleClient.read(
        device.deviceId,
        this.kestrelServiceUuid,
        this.sensorMeasurementsUuid
      );

      const dv =
        value instanceof DataView
          ? value
          : new DataView(
              (value as any).buffer
                ? (value as any).buffer
                : new Uint8Array(value as any).buffer
            );

      // Byte layout as used in Sessions tab
      const windRaw = dv.getUint16(0, true);     // m/s * 100
      const tempRaw = dv.getInt16(2, true);      // °C * 100
      const rhRaw = dv.getUint16(4, true);       // % * 100
      const pressureRaw = dv.getUint16(6, true); // hPa * 100

      const windMs = windRaw / 100;
      const windMph = windMs * 2.23694;
      const tempC = tempRaw / 100;
      const humidity = rhRaw / 100;
      const pressureHpa = pressureRaw / 100;

      this.kestrelData = {
        temperatureC: tempC,
        humidityPercent: humidity,
        pressureHpa,
        windSpeedMph: parseFloat(windMph.toFixed(1))
      };

      this.kestrelLastUpdate = new Date();
      this.kestrelStatus = `Reading imported from ${device.name || 'Kestrel'}.`;
      this.kestrelIsConnecting = false;

      // Keep the link alive for 1 minute, then disconnect and reset
      this.scheduleKestrelAutoDisconnect();
    } catch (err: any) {
      console.error('[Quick Kestrel] Error:', err);
      this.kestrelError = err?.message || String(err);
      this.kestrelStatus = 'Kestrel reading failed.';
      this.kestrelIsConnecting = false;

      // Make sure we cleanup
      await this.forceKestrelDisconnect();
    }
  }
}
