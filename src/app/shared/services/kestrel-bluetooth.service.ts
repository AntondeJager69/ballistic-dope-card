import { Injectable } from '@angular/core';
import { BleClient } from '@capacitor-community/bluetooth-le';
import { BehaviorSubject } from 'rxjs';

export interface KestrelEnvironmentSnapshot {
  temperatureC: number | null;
  humidityPercent: number | null;
  pressureHpa: number | null;
  pressureInHg: number | null;
  windSpeedMps: number | null;
}

export interface KestrelDataSnapshot {
  temperatureC?: number;
  humidityPercent?: number;
  pressureHpa?: number;
  pressureInHg?: number;
  windSpeedMph?: number;
  windClock?: number;
  windDirectionClock?: number;
  windSpeedMps?: number;
}

@Injectable({
  providedIn: 'root'
})
export class KestrelService {
  /** Shared environment snapshot (simple object for easy access) */
  environment: KestrelEnvironmentSnapshot = {
    temperatureC: null,
    humidityPercent: null,
    pressureHpa: null,
    pressureInHg: null,
    windSpeedMps: null
  };

  /** Wind clock (1–12) the app wants to associate with this reading */
  windClock = 12;
  kestrelLastUpdated: Date | null = null;
  /** Error string for simple display */
  kestrelError: string | null = null;

  /** Internal BLE device ID */
  private kestrelDeviceId: string | null = null;

  /** Auto-disconnect timer handle */
  private autoDisconnectTimer: any = null;

  // ---------- Observable state (subscribe in any component) ----------

  /** True while scanning/connecting/reading */
  public kestrelIsConnecting$ = new BehaviorSubject<boolean>(false);

  /** True when we have an active BLE connection */
  public kestrelConnected$ = new BehaviorSubject<boolean>(false);

  /** Human-readable status line */
  public kestrelStatus$ = new BehaviorSubject<string>('Not connected');

  /** Last snapshot of Kestrel data (or null if none) */
  public kestrelData$ = new BehaviorSubject<KestrelDataSnapshot | null>(null);

  constructor() {}

  // ---------- Public helpers ----------------------------------------

  /** Set wind clock externally (e.g., from your wind dial UI) */
  setWindClock(clock: number): void {
    if (clock < 1 || clock > 12) return;
    this.windClock = clock;
  }

  /** Manual disconnect you can call from components if needed */
  async disconnect(): Promise<void> {
    this.clearKestrelAutoDisconnect();
    if (this.kestrelDeviceId && this.kestrelConnected$.value) {
      try {
        await BleClient.disconnect(this.kestrelDeviceId);
      } catch (err) {
        console.warn('KestrelService manual disconnect error:', err);
      }
    }

    this.kestrelDeviceId = null;
    this.kestrelConnected$.next(false);
    this.kestrelStatus$.next('Not connected');
    this.kestrelData$.next(null);
  }

  // ---------- Main connect + read flow -------------------------------

  async connectKestrelBluetooth(): Promise<void> {
    // Clean up previous timer/connection
    await this.disconnect();

    this.kestrelError = null;
    this.kestrelIsConnecting$.next(true);
    this.kestrelStatus$.next('Scanning for Kestrel…');

    const kestrelServiceUuid = '03290000-eab4-dea1-b24e-44ec023874db';
    const sensorMeasurementsUuid = '03290310-eab4-dea1-b24e-44ec023874db';

    try {
      await BleClient.initialize({ androidNeverForLocation: true });

      const enabled = await BleClient.isEnabled().catch(() => true);
      if (!enabled) {
        this.kestrelStatus$.next('Bluetooth is off – asking to enable…');
        await BleClient.requestEnable();
      }

      let foundDevice: any = null;

      this.kestrelStatus$.next('Scanning for Kestrel (up to 8s)…');
      console.log('KestrelService: Starting BLE scan…');

      await BleClient.requestLEScan(
        {} as any,
        (result) => {
          const dev = result.device;
          const name = (dev?.name || '').trim();
          console.log('KestrelService scan result:', dev);

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
              this.kestrelStatus$.next(`Found ${name}, preparing to connect…`);
              console.log('KestrelService selected candidate:', dev);
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
        console.warn('KestrelService stopLEScan failed (not fatal):', err)
      );
      console.log('KestrelService: Stopped BLE scan');

      if (!foundDevice) {
        this.kestrelStatus$.next('No Kestrel device found during scan.');
        this.kestrelError =
          'No Kestrel seen in BLE scan. Ensure LiNK/Bluetooth is enabled on the device.';
        this.kestrelIsConnecting$.next(false);
        return;
      }

      const device = foundDevice;
      this.kestrelDeviceId = device.deviceId || device.id || null;

      this.kestrelStatus$.next(
        `Connecting to ${device.name || device.deviceId}…`
      );
      console.log('KestrelService connecting to device:', device);

      await BleClient.connect(device.deviceId, (id) => {
        console.log('KestrelService: device disconnected', id);
        this.clearKestrelAutoDisconnect();
        this.kestrelDeviceId = null;
        this.kestrelConnected$.next(false);
        this.kestrelStatus$.next('Not connected');
        this.kestrelData$.next(null);
      });

      let services: any[] = [];
      try {
        services = await BleClient.getServices(device.deviceId);
        console.log(
          'KestrelService services discovered:',
          JSON.stringify(services, null, 2)
        );
      } catch (e) {
        console.warn('KestrelService getServices failed (not fatal):', e);
      }

      const service = services.find(s =>
        s.uuid?.toLowerCase() === kestrelServiceUuid.toLowerCase()
      );

      if (!service) {
        this.kestrelStatus$.next(
          'Connected to device, but Kestrel Weather service UUID was not found.'
        );
        this.kestrelError =
          'Check console for full service list; Weather service 03290000-… must be present.';
        this.kestrelConnected$.next(true); // connected, but no weather service
        this.kestrelIsConnecting$.next(false);
        return;
      }

      const char = (service.characteristics || []).find((c: any) =>
        c.uuid?.toLowerCase() === sensorMeasurementsUuid.toLowerCase()
      );

      if (!char) {
        this.kestrelStatus$.next(
          'Connected, Weather service found, but Sensor Measurements characteristic (03290310-…) not found.'
        );
        this.kestrelError =
          'Check console for characteristics under 03290000-… and adjust sensorMeasurementsUuid if needed.';
        this.kestrelConnected$.next(true);
        this.kestrelIsConnecting$.next(false);
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

      console.log('KestrelService SensorMeasurements raw DataView:', dv);

      // Byte layout from LiNK docs, Table 142 – Sensor Measurements Characteristic Detail:
      // 0–1: Wind Speed (uint16, exponent -3, units m/s, bad = 0xFFFF)
      // 2–3: Temperature (int16, exponent -2, units °C, bad = 0x8001)
      // 4–5: Globe Temp (int16, exponent -2, units °C, bad = 0x8001)
      // 6–7: Humidity (uint16, exponent -2, units %,   bad = 0xFFFF)
      // 8–9: Station Pressure (uint16, exponent -1, units mb/hPa, bad = 0xFFFF)
      // 10–11: Mag Direction
      // 12–13: Air Speed
      // 14–19: Unused :contentReference[oaicite:1]{index=1}

      const BAD_UINT16 = 0xFFFF;
      const BAD_INT16 = 0x8001;

      const windRaw = dv.getUint16(0, true);
      const tempRaw = dv.getInt16(2, true);
      const globeRaw = dv.getInt16(4, true);       // currently unused, but parsed for completeness
      const humidityRaw = dv.getUint16(6, true);
      const stationPressureRaw = dv.getUint16(8, true);

      console.log('KestrelService SensorMeasurements raw:', {
        windRaw,
        tempRaw,
        globeRaw,
        humidityRaw,
        stationPressureRaw
      });

      this.kestrelLastUpdated = new Date();

      // Convert to engineering units with bad-value checks
      let windMps: number | null = null;
      if (windRaw !== BAD_UINT16) {
        windMps = windRaw / 1000; // exponent -3, units m/s
      }

      let tempC: number | null = null;
      if (tempRaw !== BAD_INT16) {
        tempC = tempRaw / 100; // exponent -2, °C
      }

      let humidity: number | null = null;
      if (humidityRaw !== BAD_UINT16) {
        humidity = humidityRaw / 100; // exponent -2, %
      }

      let pressureHpa: number | null = null;
      if (stationPressureRaw !== BAD_UINT16) {
        pressureHpa = stationPressureRaw / 10; // exponent -1, mb/hPa
      }

      let pressureInHg: number | null = null;
      if (pressureHpa != null) {
        // 1 hPa ≈ 0.029529983071445 inHg
        pressureInHg = pressureHpa * 0.029529983071445;
      }

      // Update environment snapshot
      this.environment.temperatureC = tempC;
      this.environment.humidityPercent = humidity;
      this.environment.pressureHpa = pressureHpa;
      this.environment.pressureInHg =
        pressureInHg != null ? parseFloat(pressureInHg.toFixed(2)) : null;
      this.environment.windSpeedMps =
        windMps != null ? parseFloat(windMps.toFixed(3)) : null;

      // Emit data snapshot via observable
      this.kestrelData$.next({
        temperatureC: tempC ?? undefined,
        humidityPercent: humidity ?? undefined,
        pressureHpa: pressureHpa ?? undefined,
        pressureInHg:
          pressureInHg != null ? parseFloat(pressureInHg.toFixed(2)) : undefined,
        windSpeedMps: windMps ?? undefined,
        windSpeedMph:
          windMps != null
            ? parseFloat((windMps * 2.23694).toFixed(1))
            : undefined,
        windClock: this.windClock
      });

      this.kestrelConnected$.next(true);
      this.kestrelStatus$.next(
        `Connected to ${device.name || 'Kestrel'} and imported data.`
      );
      this.kestrelIsConnecting$.next(false);

      this.scheduleKestrelAutoDisconnect();
    } catch (err: any) {
      console.error('KestrelService Bluetooth error:', err);
      this.kestrelStatus$.next('Kestrel connection failed.');
      this.kestrelError = err?.message || String(err);
      this.kestrelIsConnecting$.next(false);
      this.kestrelConnected$.next(false);
    }
  }

  // ---------- Internal helpers ---------------------------------------

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private clearKestrelAutoDisconnect(): void {
    if (this.autoDisconnectTimer) {
      clearTimeout(this.autoDisconnectTimer);
      this.autoDisconnectTimer = null;
    }
  }

  private scheduleKestrelAutoDisconnect(): void {
    this.clearKestrelAutoDisconnect();
    // Auto-disconnect after 5 minutes of inactivity
    this.autoDisconnectTimer = setTimeout(async () => {
      if (this.kestrelDeviceId && this.kestrelConnected$.value) {
        try {
          await BleClient.disconnect(this.kestrelDeviceId);
        } catch (err) {
          console.warn('KestrelService auto-disconnect error:', err);
        }
      }
      this.kestrelDeviceId = null;
      this.kestrelConnected$.next(false);
      this.kestrelStatus$.next('Auto-disconnected due to inactivity.');
      this.kestrelData$.next(null);
    }, 5 * 60_000);
  }
}
