import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BleClient } from '@capacitor-community/bluetooth-le';

// If you have typed models / DataService, you can swap the `any` types below
// to your real ones. Using `any` here keeps it compatible even if your models differ.
import { DataService } from '../data.service';

type WizardStep = 'setup' | 'environment' | 'shots' | 'complete';

interface KestrelSnapshot {
  temperatureC: number | null;
  humidityPercent: number | null;
  pressureHpa: number | null;
  densityAltitudeM: number | null;
  windSpeedMph: number | null;
  windClock: number | null; // 1–12
}

@Component({
  selector: 'app-session-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './session-tab.component.html'
})
export class SessionTabComponent implements OnInit {

  // ------------------------------------------------------
  // Wizard / navigation
  // ------------------------------------------------------
  step: WizardStep = 'setup';

  // ------------------------------------------------------
  // Session setup
  // ------------------------------------------------------
  title = '';

  rifles: any[] = [];
  venues: any[] = [];
  subRanges: any[] = [];

  selectedRifleId: string | null = null;
  selectedVenueId: string | null = null;
  selectedSubRangeId: string | null = null;

  // ------------------------------------------------------
  // Environment
  // ------------------------------------------------------
  environment: any = {
    temperatureC: null as number | null,
    pressureHpa: null as number | null,
    humidityPercent: null as number | null,
    densityAltitudeM: null as number | null,
    windSpeedMps: null as number | null,    // NOTE: your HTML uses "windSpeedMps"
    lightConditions: '' as string
  };

  windClock: number | null = null;
  windHint: string | null = null;

  // ------------------------------------------------------
  // Shot plan
  // ------------------------------------------------------
  distanceOptions: number[] = [];
  selectedDistances: number[] = [];
  shotCount: number | null = null;
  notes = '';

  // ------------------------------------------------------
  // Completion message
  // ------------------------------------------------------
  completeMessage = '';

  // ------------------------------------------------------
  // Kestrel BLE state
  // ------------------------------------------------------
  kestrelIsConnecting = false;
  kestrelConnected = false;
  kestrelStatus = 'Idle';
  kestrelError: string | null = null;
  kestrelLastUpdate: Date | null = null;
  kestrelData: KestrelSnapshot | null = null;

  // These UUIDs are the ones we used before – adjust if needed
  private kestrelServiceUuid = 'db743802-ec44-4eb2-a1de-b4ea00002903';
  private sensorMeasurementsUuid = 'db743802-ec44-4eb2-a1de-b4ea10032903';

  constructor(private dataService: DataService) {}

  // ------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------
  ngOnInit(): void {
    this.loadReferenceData();
  }

  private loadReferenceData(): void {
    try {
      // Swap these to your actual DataService API names if different
      if (this.dataService && typeof (this.dataService as any).getRifles === 'function') {
        this.rifles = (this.dataService as any).getRifles();
      }
      if (this.dataService && typeof (this.dataService as any).getVenues === 'function') {
        this.venues = (this.dataService as any).getVenues();
      }
    } catch (err) {
      console.error('Error loading rifles/venues from DataService:', err);
    }
  }

  // ------------------------------------------------------
  // Setup step handlers
  // ------------------------------------------------------
  onVenueChange(): void {
    const venue = this.venues.find(v => v.id === this.selectedVenueId);
    this.subRanges = venue?.subRanges ?? [];
    this.selectedSubRangeId = null;
    this.updateDistanceOptions();
  }

  onSubRangeChange(): void {
    this.updateDistanceOptions();
  }

  private updateDistanceOptions(): void {
    const sr = this.subRanges.find(x => x.id === this.selectedSubRangeId);
    this.distanceOptions = Array.isArray(sr?.distancesM) ? sr.distancesM : [];
    // Keep only distances that still exist in the selected sub-range
    this.selectedDistances = this.selectedDistances.filter(d => this.distanceOptions.includes(d));
  }

  nextFromSetup(): void {
    if (!this.selectedRifleId || !this.selectedVenueId || !this.selectedSubRangeId) {
      // You can add a toast/snackbar later
      console.warn('Session setup incomplete: rifle/venue/sub-range missing');
    }
    this.step = 'environment';
  }

  backToSetup(): void {
    this.step = 'setup';
  }

  // ------------------------------------------------------
  // Environment step
  // ------------------------------------------------------
  nextFromEnvironment(): void {
    this.updateWindHint();
    this.step = 'shots';
  }

  backToEnvironment(): void {
    this.step = 'environment';
  }

  private updateWindHint(): void {
    const speed = this.environment.windSpeedMps as number | null;
    const clock = this.windClock;

    if (!speed || !clock) {
      this.windHint = null;
      return;
    }

    // Simple “clock system” crosswind factor
    let factor = 0.25; // default 25%
    if ([3, 4, 5, 7, 8, 9].includes(clock)) {
      factor = 1.0;   // full value
    } else if ([2, 10].includes(clock)) {
      factor = 0.5;   // half value
    }

    const cross = speed * factor;
    this.windHint = `Approx crosswind ${cross.toFixed(1)} mph (${Math.round(
      factor * 100
    )}% value) from ${clock} o'clock.`;
  }

  // ------------------------------------------------------
  // Shot plan step
  // ------------------------------------------------------
  toggleDistance(d: number): void {
    if (this.selectedDistances.includes(d)) {
      this.selectedDistances = this.selectedDistances.filter(x => x !== d);
    } else {
      this.selectedDistances = [...this.selectedDistances, d].sort((a, b) => a - b);
    }
  }

  goShoot(): void {
    // Build a simple session object. Adapt to your actual Session model if needed.
    const session: any = {
      id: Date.now().toString(),
      title: this.title || 'New session',
      rifleId: this.selectedRifleId,
      venueId: this.selectedVenueId,
      subRangeId: this.selectedSubRangeId,
      environment: { ...this.environment, windClock: this.windClock },
      distancesM: this.selectedDistances,
      plannedShotCount: this.shotCount,
      notes: this.notes,
      createdAt: new Date().toISOString()
    };

    try {
      if (this.dataService && typeof (this.dataService as any).saveSession === 'function') {
        (this.dataService as any).saveSession(session);
      } else {
        console.log('Session object (no saveSession method found):', session);
      }
      this.completeMessage = 'Session saved successfully.';
    } catch (err) {
      console.error('Error saving session:', err);
      this.completeMessage = 'Error saving session – see console for details.';
    }

    this.step = 'complete';
  }

  newSession(): void {
    // Reset main state but keep rifles/venues loaded
    this.step = 'setup';
    this.title = '';
    this.selectedRifleId = null;
    this.selectedVenueId = null;
    this.selectedSubRangeId = null;
    this.subRanges = [];
    this.distanceOptions = [];
    this.selectedDistances = [];
    this.shotCount = null;
    this.notes = '';
    this.completeMessage = '';

    this.environment = {
      temperatureC: null,
      pressureHpa: null,
      humidityPercent: null,
      densityAltitudeM: null,
      windSpeedMps: null,
      lightConditions: ''
    };
    this.windClock = null;
    this.windHint = null;
  }

  // ------------------------------------------------------
  // Kestrel Bluetooth integration
  // ------------------------------------------------------
  async connectKestrelBluetooth(): Promise<void> {
    this.kestrelError = null;
    this.kestrelIsConnecting = true;
    this.kestrelStatus = 'Scanning for Kestrel…';

    try {
      await BleClient.initialize({ androidNeverForLocation: true });

      const enabled = await BleClient.isEnabled().catch(() => true);
      if (!enabled) {
        this.kestrelStatus = 'Bluetooth is off – asking to enable…';
        await BleClient.requestEnable();
      }

      const device = await BleClient.requestDevice({
        services: [this.kestrelServiceUuid]
      });

      this.kestrelStatus = `Connecting to ${device.name || 'Kestrel'}…`;
      await BleClient.connect(device.deviceId);
      this.kestrelConnected = true;
      this.kestrelStatus = 'Connected. Subscribing to measurements…';

      await BleClient.startNotifications(
        device.deviceId,
        this.kestrelServiceUuid,
        this.sensorMeasurementsUuid,
        (value) => {
          try {
            const raw = new Uint8Array((value as any).buffer);
            const dec = Array.from(raw);
            const hex = dec.map(b => b.toString(16).padStart(2, '0')).join(' ');

            console.log('Kestrel RAW dec =', dec, 'hex =', hex);

            // TODO: Decode real fields once we agree on format.
            // For now, we just stamp the last update and keep raw logged.
            this.kestrelLastUpdate = new Date();

            // Example dummy decode (you can replace when we know the mapping):
            const snapshot: KestrelSnapshot = {
              temperatureC: null,
              humidityPercent: null,
              pressureHpa: null,
              densityAltitudeM: null,
              windSpeedMph: null,
              windClock: this.windClock
            };

            this.kestrelData = snapshot;

            // You can optionally map some decoded values into environment here:
            // if (snapshot.temperatureC != null) this.environment.temperatureC = snapshot.temperatureC;

          } catch (err) {
            console.error('Error handling Kestrel notification:', err);
          } finally {
            this.kestrelIsConnecting = false;
            this.kestrelStatus = 'Receiving measurements…';
          }
        }
      );
    } catch (err: any) {
      console.error('Kestrel Bluetooth error:', err);
      this.kestrelError = err?.message || String(err);
      this.kestrelStatus = 'Error during Kestrel connection.';
      this.kestrelIsConnecting = false;
      this.kestrelConnected = false;
    }
  }
}
