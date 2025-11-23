import { CommonModule } from '@angular/common';
import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService } from '../data.service';
import {
  Rifle,
  Venue,
  SubRange,
  Environment,
  DistanceDope,
  Session
} from '../models';
import { BleClient } from '@capacitor-community/bluetooth-le';

type WizardStep = 'setup' | 'environment' | 'shots' | 'complete';

interface KestrelSnapshot {
  temperatureC: number;
  humidityPercent: number;
  pressureHpa: number;
  windSpeedMph: number;
  windClock: number; // 1–12
}

@Component({
  selector: 'app-session-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './session-tab.component.html',
  styleUrls: ['./session-tab.component.css']
})
export class SessionTabComponent implements OnInit {
  step: WizardStep = 'setup';

  rifles: Rifle[] = [];
  venues: Venue[] = [];
  // Notify parent app when user wants to jump to History
  @Output() jumpToHistory = new EventEmitter<void>();

  // IDs used in the HTML template
  rifleId: number | null = null;
  venueId: number | null = null;
  subRangeId: number | null = null;

  title = '';
  environment: Environment = {};

  // Wind clock (1–12, relative to target at 12)
  windClock: number | null = null;

  shotCount: number | null = null;
  selectedDistances: number[] = [];
  notes = '';

  dopeRows: DistanceDope[] = [];
  completeMessage = '';

  // Kestrel integration state
  kestrelConnected = false;
  kestrelStatus = 'Not connected';
  kestrelLastUpdate: Date | null = null;
  kestrelData: KestrelSnapshot | null = null;
  kestrelError: string | null = null;
  kestrelIsConnecting = false;

  // Track current device + auto-disconnect timer
  private kestrelDeviceId: string | null = null;
  private kestrelAutoDisconnectTimer: any | null = null;

  constructor(private data: DataService) {}

  ngOnInit(): void {
    this.rifles = this.data.getRifles();
    this.venues = this.data.getVenues();
  }

  // ---------- Derived getters ----------

  get selectedVenue(): Venue | undefined {
    return this.venues.find(v => v.id === this.venueId);
  }

  get subRanges(): SubRange[] {
    const v = this.selectedVenue;
    return v?.subRanges ?? [];
  }

  get selectedSubRange(): SubRange | undefined {
    const list = this.subRanges;
    return list.find(sr => sr.id === this.subRangeId);
  }

  get distanceOptions(): number[] {
    const sr = this.selectedSubRange;
    return sr?.distancesM ?? [];
  }

  get windHint(): string {
    const speed = this.environment.windSpeedMps;
    let clock = this.windClock;
    if (!clock || !speed || speed <= 0) return '';

    // Normalize clock to 1..12
    clock = ((clock - 1) % 12) + 1;

    const c = clock;
    const isFront = c === 11 || c === 12 || c === 1;
    const isBack = c === 5 || c === 6 || c === 7;
    const isRight = c >= 1 && c <= 5;   // wind from right side
    const isLeft = c >= 7 && c <= 11;   // wind from left side

    let directionText = '';

    if (isFront && isRight) directionText = 'slightly low with drift to the left';
    else if (isFront && isLeft) directionText = 'slightly low with drift to the right';
    else if (isFront) directionText = 'slightly low, minimal left/right drift';
    else if (isBack && isRight) directionText = 'slightly high with drift to the left';
    else if (isBack && isLeft) directionText = 'slightly high with drift to the right';
    else if (isBack) directionText = 'slightly high, minimal left/right drift';
    else if (isRight) directionText = 'drift to the left';
    else if (isLeft) directionText = 'drift to the right';

    let intensity = '';
    if (speed < 2) intensity = 'Very light wind – small effect.';
    else if (speed < 5) intensity = 'Light wind – moderate correction.';
    else if (speed < 8) intensity = 'Medium wind – expect noticeable drift.';
    else intensity = 'Strong wind – expect significant drift.';

    // Note: variable is named windSpeedMps but we describe in mph here; keep text as-is for now.
    return `Wind from ${c} o'clock at ${speed} mph: expect ${directionText}. ${intensity}`;
  }

  // Called by (ngModelChange) in the template – logic is in the getter
  updateWindHint(): void {
    // no-op: windHint is computed on the fly
  }

  // ---------- Setup step ----------

  onVenueChange(): void {
    const srs = this.subRanges;
    if (srs.length > 0) {
      this.subRangeId = srs[0].id;
    } else {
      this.subRangeId = null;
    }
    this.selectedDistances = [];
  }

  canGoToEnvironment(): boolean {
    if (!this.rifleId) return false;
    if (!this.venueId) return false;
    // subRange is optional – you allow "Whole venue / no sub-range"
    return true;
  }

  goToEnvironmentStep(): void {
    if (!this.rifleId) {
      alert('Please select a rifle.');
      return;
    }
    if (!this.venueId) {
      alert('Please select a venue.');
      return;
    }
    // Sub-range can be null (whole venue)

    this.step = 'environment';
  }

  cancelSession(): void {
    this.newSession();
    this.step = 'setup';
  }

  // ---------- Kestrel integration ----------

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private clearKestrelAutoDisconnect(): void {
    if (this.kestrelAutoDisconnectTimer) {
      clearTimeout(this.kestrelAutoDisconnectTimer);
      this.kestrelAutoDisconnectTimer = null;
    }
  }

  private async forceKestrelDisconnect(): Promise<void> {
    this.clearKestrelAutoDisconnect();

    if (this.kestrelDeviceId) {
      try {
        await BleClient.disconnect(this.kestrelDeviceId);
      } catch (err) {
        console.warn('Error during Kestrel auto-disconnect:', err);
      }
    }

    this.kestrelConnected = false;
    this.kestrelIsConnecting = false;
    this.kestrelDeviceId = null;
    this.kestrelStatus = 'Not connected (auto-disconnected after 1 minute)';
    // Intentionally do NOT clear environment.* so values stay for the session
  }

  private scheduleKestrelAutoDisconnect(): void {
    this.clearKestrelAutoDisconnect();

    if (!this.kestrelConnected || !this.kestrelDeviceId) {
      return;
    }

    this.kestrelAutoDisconnectTimer = setTimeout(() => {
      console.log('Kestrel auto-disconnect: 60 seconds elapsed, disconnecting…');
      void this.forceKestrelDisconnect();
    }, 60_000);
  }

  async connectKestrelBluetooth(): Promise<void> {
    // Clean up previous timer/connection
    this.clearKestrelAutoDisconnect();
    if (this.kestrelConnected && this.kestrelDeviceId) {
      try {
        await BleClient.disconnect(this.kestrelDeviceId);
      } catch (err) {
        console.warn('Error disconnecting previous Kestrel connection:', err);
      } finally {
        this.kestrelConnected = false;
        this.kestrelDeviceId = null;
      }
    }

    this.kestrelError = null;
    this.kestrelIsConnecting = true;
    this.kestrelStatus = 'Scanning for Kestrel…';

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
      console.log('Starting BLE scan…');

      await BleClient.requestLEScan(
        {} as any,
        (result) => {
          const dev = result.device;
          const name = (dev?.name || '').trim();
          console.log('Scan result:', dev);

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
              console.log('Selected Kestrel candidate:', dev);
            }
          }
        }
      );

      const timeoutMs = 10000;
      const start = Date.now();
      while (!foundDevice && Date.now() - start < timeoutMs) {
        await this.sleep(400);
      }

      await BleClient.stopLEScan().catch(err =>
        console.warn('stopLEScan failed (not fatal):', err)
      );
      console.log('Stopped BLE scan');

      if (!foundDevice) {
        this.kestrelStatus = 'No Kestrel device found during scan.';
        this.kestrelError =
          'No Kestrel seen in BLE scan. Ensure LiNK/Bluetooth is enabled on the device.';
        return;
      }

      const device = foundDevice;
      this.kestrelDeviceId = device.deviceId || device.id || null;

      this.kestrelStatus = `Connecting to ${device.name || device.deviceId}…`;
      console.log('Connecting to device:', device);

      await BleClient.connect(device.deviceId, (id) => {
        console.log('Kestrel disconnected', id);
        this.kestrelConnected = false;
        this.clearKestrelAutoDisconnect();
        this.kestrelDeviceId = null;
        this.kestrelStatus = 'Not connected';
      });

      let services: any[] = [];
      try {
        services = await BleClient.getServices(device.deviceId);
        console.log(
          'Kestrel services discovered (FULL LIST):',
          JSON.stringify(services, null, 2)
        );
      } catch (e) {
        console.warn('getServices failed (not fatal):', e);
      }

      const service = services.find(s =>
        s.uuid?.toLowerCase() === kestrelServiceUuid.toLowerCase()
      );

      if (!service) {
        this.kestrelStatus =
          'Connected to device, but Kestrel Weather service UUID was not found.';
        this.kestrelError =
          'Check console for full service list; Weather service 03290000-… must be present.';
        this.kestrelConnected = true; // connected, but no weather service
        this.kestrelLastUpdate = new Date();
        return;
      }

      const char = (service.characteristics || []).find((c: any) =>
        c.uuid?.toLowerCase() === sensorMeasurementsUuid.toLowerCase()
      );

      if (!char) {
        this.kestrelStatus =
          'Connected, Weather service found, but Sensor Measurements characteristic (03290310-…) not found.';
        this.kestrelError =
          'Check console for characteristics under 03290000-… and adjust sensorMeasurementsUuid if needed.';
        this.kestrelConnected = true;
        this.kestrelLastUpdate = new Date();
        return;
      }

      const value = await BleClient.read(
        device.deviceId,
        kestrelServiceUuid,
        sensorMeasurementsUuid
      );

      const dv =
        value instanceof DataView
          ? value
          : new DataView(
              (value as any).buffer
                ? (value as any).buffer
                : new Uint8Array(value as any).buffer
            );

      // Byte layout guess:
      // wind, temp, humidity, pressure – each 2 bytes, LE, x10
      const windRaw = dv.getUint16(0, true);     // m/s * 10
      const tempRaw = dv.getInt16(2, true);      // °C * 10
      const rhRaw = dv.getUint16(4, true);       // % * 10
      const pressureRaw = dv.getUint16(6, true); // hPa * 10

      const windMs = windRaw / 100;
      const windMph = windMs * 2.23694;
      const tempC = tempRaw / 100;
      const humidity = rhRaw / 10;
      const pressureHpa = pressureRaw / 10;

      console.log('Kestrel SensorMeasurements raw:', {
        windRaw,
        tempRaw,
        rhRaw,
        pressureRaw
      });

      // Push into environment model (mph in UI)
      this.environment.temperatureC = tempC;
      this.environment.humidityPercent = humidity;
      this.environment.pressureHpa = pressureHpa;
      this.environment.windSpeedMps = parseFloat(windMph.toFixed(1));

      // NOTE: DA explicitly removed here – we do not read or store DA in sessions.
      this.kestrelData = {
        temperatureC: tempC,
        humidityPercent: humidity,
        pressureHpa,
        windSpeedMph: parseFloat(windMph.toFixed(1)),
        windClock: this.windClock ?? 12
      };

      this.kestrelConnected = true;
      this.kestrelLastUpdate = new Date();
      this.kestrelStatus = `Connected to ${device.name || 'Kestrel'} and imported data.`;
    } catch (err: any) {
      console.error('Kestrel Bluetooth error:', err);
      this.kestrelStatus = 'Kestrel connection failed.';
      this.kestrelError = err?.message || String(err);
    } finally {
      this.kestrelIsConnecting = false;
      this.scheduleKestrelAutoDisconnect();
    }
  }

  // ---------- Environment step ----------

  nextFromEnvironment(): void {
    // Convert windClock -> approximate windDirectionDeg (0° = from target / headwind)
    if (this.windClock != null) {
      let c = ((this.windClock - 1) % 12) + 1; // 1..12
      const fraction = c === 12 ? 0 : c / 12;
      const deg = Math.round(fraction * 360);
      this.environment.windDirectionDeg = deg;
    } else {
      this.environment.windDirectionDeg = undefined;
    }

    this.step = 'shots';
  }

  // Alias for template name
  backToEnvironmentStep(): void {
    this.step = 'environment';
  }

  // ---------- Shot planning step ----------

  toggleDistance(d: number): void {
    if (this.selectedDistances.includes(d)) {
      this.selectedDistances = this.selectedDistances.filter(x => x !== d);
    } else {
      this.selectedDistances = [...this.selectedDistances, d].sort((a, b) => a - b);
    }
  }

  canCompleteSession(): boolean {
    return this.selectedDistances.length > 0;
  }

  completeSession(): void {
    if (this.selectedDistances.length === 0) {
      alert('Select at least one distance to shoot.');
      return;
    }
    if (!this.rifleId || !this.venueId) {
      alert('Setup is incomplete. Please go back and select rifle and venue.');
      return;
    }

    // Build dope rows for each selected distance
    this.dopeRows = this.selectedDistances.map(distance => ({
      subRangeId: this.subRangeId ?? undefined,
      distanceM: distance
    }));

    const sessionNotesParts: string[] = [];
    if (this.notes?.trim()) {
      sessionNotesParts.push(this.notes.trim());
    }
    const sr = this.selectedSubRange;
    const countText =
      this.shotCount && this.shotCount > 0
        ? `${this.shotCount} shots planned`
        : 'Shot count not specified';

    sessionNotesParts.push(
      `${countText} at distances: ${this.selectedDistances.join(', ')} m` +
        (sr ? ` on sub-range "${sr.name}"` : '')
    );

    const sessionToSave: Omit<Session, 'id'> = {
      date: new Date().toISOString(),
      rifleId: this.rifleId,
      venueId: this.venueId,
      title: this.title || undefined,
      environment: this.environment,
      dope: this.dopeRows,
      notes: sessionNotesParts.join(' | '),
      completed: false
    };

    this.data.addSession(sessionToSave);

    // increment rifle round count using planned shot count (if set)
    if (this.shotCount && this.shotCount > 0) {
      this.data.incrementRifleRoundCount(this.rifleId!, this.shotCount);
    }

    this.completeMessage =
      'Session saved to History. Go shoot! After you are done, open the History tab to enter your actual dope.';
    this.step = 'complete';
  }

  // ---------- Navigation ----------

  backToSetup(): void {
    this.step = 'setup';
  }  onJumpToHistory(): void {
    // Optional: reset the wizard so Sessions tab is clean next time
    this.newSession();
    // Tell AppComponent to switch to History tab
    this.jumpToHistory.emit();
  }


  backToEnvironment(): void {
    this.step = 'environment';
  }

  // Called from the Step 4 button – here we just reset the wizard
  returnToMenu(): void {
    this.newSession();
    this.step = 'setup';
  }

  newSession(): void {
    this.step = 'setup';
    this.title = '';
    this.rifleId = null;
    this.venueId = null;
    this.subRangeId = null;
    this.environment = {};
    this.windClock = null;
    this.shotCount = null;
    this.selectedDistances = [];
    this.notes = '';
    this.dopeRows = [];
    this.completeMessage = '';

    this.kestrelConnected = false;
    this.kestrelStatus = 'Not connected';
    this.kestrelLastUpdate = null;
    this.kestrelData = null;
    this.kestrelError = null;
    this.kestrelIsConnecting = false;

    this.clearKestrelAutoDisconnect();
    this.kestrelDeviceId = null;

    this.rifles = this.data.getRifles();
    this.venues = this.data.getVenues();
  }
}
