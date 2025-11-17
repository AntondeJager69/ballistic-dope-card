import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
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

type WizardStep = 'setup' | 'environment' | 'shots' | 'complete';

interface KestrelSnapshot {
  temperatureC: number;
  humidityPercent: number;
  pressureHpa: number;
  densityAltitudeM: number;
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

  selectedRifleId: number | null = null;
  selectedVenueId: number | null = null;
  selectedSubRangeId: number | null = null;

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


  constructor(private data: DataService) {}

  ngOnInit(): void {
    this.rifles = this.data.getRifles();
    this.venues = this.data.getVenues();
  }

  // ---------- Derived getters ----------

  get selectedVenue(): Venue | undefined {
    return this.venues.find(v => v.id === this.selectedVenueId);
  }

  get subRanges(): SubRange[] {
    const v = this.selectedVenue;
    return v?.subRanges ?? [];
  }

  get selectedSubRange(): SubRange | undefined {
    const list = this.subRanges;
    return list.find(sr => sr.id === this.selectedSubRangeId);
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

    return `Wind from ${c} o'clock at ${speed} mph: expect ${directionText}. ${intensity}`;
  }

  // ---------- Setup step ----------

  onVenueChange() {
    const srs = this.subRanges;
    if (srs.length > 0) {
      this.selectedSubRangeId = srs[0].id;
    } else {
      this.selectedSubRangeId = null;
    }
    this.selectedDistances = [];
  }

  onSubRangeChange() {
    this.selectedDistances = [];
  }

  nextFromSetup() {
    if (!this.title.trim()) {
      alert('Please enter a session title.');
      return;
    }
    if (!this.selectedRifleId) {
      alert('Please select a rifle.');
      return;
    }
    if (!this.selectedVenueId) {
      alert('Please select a venue.');
      return;
    }
    if (!this.selectedSubRangeId) {
      alert('Please select a sub-range at the venue.');
      return;
    }

    this.step = 'environment';
  }

  // ---------- Kestrel integration (mock for now) ----------

  mockReadFromKestrel(): void {
    // Simulated Kestrel snapshot (later replace with real Bluetooth read)
    const mock: KestrelSnapshot = {
      temperatureC: 23.7,
      humidityPercent: 38,
      pressureHpa: 1011.5,
      densityAltitudeM: 1350,
      windSpeedMph: 6.5,
      windClock: 3 // wind from right
    };

    this.kestrelData = mock;
    this.kestrelConnected = true;
    this.kestrelLastUpdate = new Date();
    this.kestrelStatus = 'Mock Kestrel data loaded';

    // Push mock values into environment fields
    this.environment.temperatureC = mock.temperatureC;
    this.environment.humidityPercent = mock.humidityPercent;
    this.environment.pressureHpa = mock.pressureHpa;
    this.environment.densityAltitudeM = mock.densityAltitudeM;
    this.environment.windSpeedMps = mock.windSpeedMph; // using mph in UI
    this.windClock = mock.windClock;
  }
// Real Kestrel Bluetooth connection (experimental)
async connectKestrelBluetooth(): Promise<void> {
  this.kestrelError = null;
  this.kestrelIsConnecting = true;
  this.kestrelStatus = 'Opening Bluetooth device chooser…';

  try {
    const navAny = navigator as any;
    if (!navAny.bluetooth) {
      throw new Error('Web Bluetooth is not supported in this browser.');
    }

    // NK Kestrel custom service & Sensor Measurements characteristic
    // Built from the custom UUID base in the LiNK doc + table UUIDs 0x0000 (service) and 0x0310 (Sensor Measurements). 
    const kestrelServiceUuid = 'db743802-ec44-4eb2-a1de-b4ea00002903';
    const sensorMeasurementsUuid = 'db743802-ec44-4eb2-a1de-b4ea10032903';

    const device = await navAny.bluetooth.requestDevice({
      filters: [
        { namePrefix: 'K5' },      // K5000 / 5700 etc.
        { namePrefix: 'K7' },      // other series
        { namePrefix: 'Kestrel' }  // generic
      ],
      optionalServices: [kestrelServiceUuid]
    });

    this.kestrelStatus = `Connecting to ${device.name || 'device'}…`;

    const server = await device.gatt!.connect();
    const service = await server.getPrimaryService(kestrelServiceUuid);
    const sensorChar = await service.getCharacteristic(sensorMeasurementsUuid);

    const value: DataView = await sensorChar.readValue();
    const dv = value;

    // ⚠️ Byte layout is based on the "Measurement Details" table from the Weather Protocol:
    // wind speed, temp, humidity, pressure each 2 bytes, metric, 0.1 resolution. 
    // This is a best guess for ordering. If values look wrong, we can adjust offsets.
    const windRaw = dv.getUint16(0, true);     // m/s * 10
    const tempRaw = dv.getInt16(2, true);      // °C * 10
    const rhRaw = dv.getUint16(4, true);       // % * 10
    const pressureRaw = dv.getUint16(6, true); // hPa * 10

    const windMs = windRaw / 10;
    const windMph = windMs * 2.23694;
    const tempC = tempRaw / 10;
    const humidity = rhRaw / 10;
    const pressureHpa = pressureRaw / 10;

    console.log('Kestrel SensorMeasurements raw (first 8 bytes):', {
      windRaw,
      tempRaw,
      rhRaw,
      pressureRaw
    });

    // Push into environment model
    this.environment.temperatureC = tempC;
    this.environment.humidityPercent = humidity;
    this.environment.pressureHpa = pressureHpa;
    this.environment.windSpeedMps = parseFloat(windMph.toFixed(1)); // using mph here

    // Update snapshot object for display
    this.kestrelData = {
      temperatureC: tempC,
      humidityPercent: humidity,
      pressureHpa,
      densityAltitudeM: this.environment.densityAltitudeM ?? 0,
      windSpeedMph: parseFloat(windMph.toFixed(1)),
      windClock: this.windClock ?? 12
    };

    this.kestrelConnected = true;
    this.kestrelLastUpdate = new Date();
    this.kestrelStatus = `Connected to ${device.name || 'Kestrel'} and imported data.`;
  } catch (err: any) {
    if (err && err.name === 'NotFoundError') {
      this.kestrelStatus = 'Bluetooth device picker was closed.';
    } else {
      console.error('Kestrel Bluetooth error:', err);
      this.kestrelStatus = 'Kestrel connection failed.';
      this.kestrelError = err?.message || String(err);
    }
  } finally {
    this.kestrelIsConnecting = false;
  }
}

  // ---------- Environment step ----------

  nextFromEnvironment() {
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

  // ---------- Shot planning step ----------

  toggleDistance(d: number) {
    if (this.selectedDistances.includes(d)) {
      this.selectedDistances = this.selectedDistances.filter(x => x !== d);
    } else {
      this.selectedDistances = [...this.selectedDistances, d].sort((a, b) => a - b);
    }
  }

  goShoot() {
    if (this.selectedDistances.length === 0) {
      alert('Select at least one distance to shoot.');
      return;
    }
    if (!this.selectedRifleId || !this.selectedVenueId || !this.selectedSubRangeId) {
      alert('Setup is incomplete. Please go back and select rifle, venue and sub-range.');
      return;
    }

    // Build dope rows for each selected distance
    this.dopeRows = this.selectedDistances.map(distance => ({
      subRangeId: this.selectedSubRangeId!,
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
      rifleId: this.selectedRifleId,
      venueId: this.selectedVenueId,
      title: this.title || undefined,
      environment: this.environment,
      dope: this.dopeRows,
      notes: sessionNotesParts.join(' | '),
      completed: false
    };

    this.data.addSession(sessionToSave);

    // increment rifle round count using planned shot count (if set)
    if (this.shotCount && this.shotCount > 0) {
      this.data.incrementRifleRoundCount(this.selectedRifleId, this.shotCount);
    }

    this.completeMessage =
      'Session saved to History. Go shoot! After you are done, open the History tab to enter your actual dope.';
    this.step = 'complete';
  }

  // ---------- Navigation ----------

  backToSetup() {
    this.step = 'setup';
  }

  backToEnvironment() {
    this.step = 'environment';
  }

  newSession() {
    this.step = 'setup';
    this.title = '';
    this.selectedRifleId = null;
    this.selectedVenueId = null;
    this.selectedSubRangeId = null;
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

    this.rifles = this.data.getRifles();
    this.venues = this.data.getVenues();
  }
}
