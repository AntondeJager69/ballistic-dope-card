import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';   // 👈 NEW

type WindUnit = 'mph' | 'kmh' | 'mps';

interface HourMarker {
  hour: number;
  tickX1: number;
  tickY1: number;
  tickX2: number;
  tickY2: number;
  labelX: number;
  labelY: number;
}

@Component({
  selector: 'app-wind-effect-tool',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './wind-effect-tool.component.html',
})
export class WindEffectToolComponent implements OnInit {
  @ViewChild('circleArea', { static: true })
  circleAreaRef!: ElementRef<HTMLDivElement>;

  constructor(private router: Router) {}   // 👈 NEW

  // --- Rifle / ballistics (placeholder – later from Rifles tab) ---
  rangeMeters = 600;
  muzzleVelocityFps = 2800;
  ballisticCoeff = 0.5;

  // --- Wind speed (canonical stored in mph) ---
  windSpeedMph = 10;
  windUnit: WindUnit = 'mph';
  windSpeedInput = 10;

  // Wind COMING FROM this clock (1–12)
  windFromClock = 9;

  // Arrow angle (0° = 12 o’clock, clockwise) – shows DRIFT (push) direction
  arrowAngleDeg = 0;

  // Clock markers
  hours: HourMarker[] = [];

  // POI dot coordinates
  poiX = 50;
  poiY = 50;

  private dragging = false;

  ngOnInit(): void {
    this.buildHourMarkers();
    this.updateArrowFromClock();
    this.windSpeedInput = this.fromMph(this.windSpeedMph, this.windUnit);
    this.updatePoiFromDrift();
  }

  // ========================================
  // Unit conversion & inputs
  // ========================================

  onWindSpeedInputChange(raw: any): void {
    const v = Number(raw);
    if (!Number.isFinite(v)) {
      this.windSpeedInput = 0;
      this.windSpeedMph = 0;
      this.updatePoiFromDrift();
      return;
    }
    this.windSpeedInput = v;
    this.windSpeedMph = this.toMph(v, this.windUnit);
    this.updatePoiFromDrift();
  }

  onWindUnitChange(raw: any): void {
    const unit = (raw ?? 'mph') as WindUnit;
    this.windUnit = unit;
    this.windSpeedInput = this.fromMph(this.windSpeedMph, unit);
  }

  private toMph(v: number, u: WindUnit): number {
    if (!Number.isFinite(v)) return 0;
    switch (u) {
      case 'mph':
        return v;
      case 'kmh':
        return v * 0.621371;
      case 'mps':
        return v * 2.23694;
      default:
        return v;
    }
  }

  private fromMph(v: number, u: WindUnit): number {
    if (!Number.isFinite(v)) return 0;
    switch (u) {
      case 'mph':
        return v;
      case 'kmh':
        return v / 0.621371;
      case 'mps':
        return v / 2.23694;
      default:
        return v;
    }
  }

  // ========================================
  // Build hour markers for the clock
  // ========================================

  private buildHourMarkers(): void {
    const cx = 50;
    const cy = 50;
    const innerR = 37;
    const outerR = 40;
    const labelR = 44;

    const result: HourMarker[] = [];

    for (let hour = 1; hour <= 12; hour++) {
      const angleFromTop = (hour % 12) * 30; // 0° at 12, clockwise
      const angleFromRight = angleFromTop - 90;
      const rad = (angleFromRight * Math.PI) / 180;

      result.push({
        hour,
        tickX1: cx + innerR * Math.cos(rad),
        tickY1: cy + innerR * Math.sin(rad),
        tickX2: cx + outerR * Math.cos(rad),
        tickY2: cy + outerR * Math.sin(rad),
        labelX: cx + labelR * Math.cos(rad),
        labelY: cy + labelR * Math.sin(rad),
      });
    }

    this.hours = result;
  }

  // ========================================
  // Pointer drag → sets windFromClock
  // ========================================

  startDrag(e: PointerEvent): void {
    this.dragging = true;
    this.circleAreaRef.nativeElement.setPointerCapture(e.pointerId);
    this.updateDirectionFromPointer(e);
  }

  onDrag(e: PointerEvent): void {
    if (!this.dragging) return;
    this.updateDirectionFromPointer(e);
  }

  endDrag(e: PointerEvent): void {
    this.dragging = false;
    try {
      this.circleAreaRef.nativeElement.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }

  private updateDirectionFromPointer(e: PointerEvent): void {
    const rect = this.circleAreaRef.nativeElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const dx = x - cx;
    const dy = y - cy;

    // SVG / screen coords: x right, y down.
    const angleFromRightRad = Math.atan2(dy, dx);
    let angleFromRightDeg = (angleFromRightRad * 180) / Math.PI;

    if (angleFromRightDeg < 0) angleFromRightDeg += 360;

    // Convert to “from top, clockwise”
    const angleFromTopDeg = (angleFromRightDeg + 90) % 360;

    // Sector numbers: 12 at top, 3 at right, etc.
    const sector = Math.round(angleFromTopDeg / 30) || 12;
    const hour = sector === 0 ? 12 : sector;

    // This is “wind FROM … o’clock”
    this.windFromClock = hour;

    // Arrow + red dot show push direction
    this.updateArrowFromClock();
    this.updatePoiFromDrift();
  }

  // ========================================
  // Drift math (simple, but physically shaped)
  // ========================================

  private mphToFps(mph: number): number {
    return mph * 1.46667;
  }

  private metersToFeet(m: number): number {
    return m * 3.28084;
  }

  private get timeOfFlightSeconds(): number {
    const distanceFt = this.metersToFeet(this.rangeMeters);
    const v = this.muzzleVelocityFps || 1;
    return distanceFt / v;
  }

  /**
   * Crosswind component from clock:
   *  - 3/9 o'clock = full value
   *  - 12/6 o'clock = 0 (no sideways drift, only head/tail)
   *  - 1/5/7/11 etc. in between
   */
  private getCrosswindComponents(): { factorAbs: number; sign: number } {
    const angleFromTopDeg = (this.windFromClock % 12) * 30;
    const rad = (angleFromTopDeg * Math.PI) / 180;

    // Lateral component ~ sin(angleFromTop).
    // Use minus so: 3 o'clock (from right) => negative (push left),
    //               9 o'clock (from left)  => positive (push right).
    const lateral = -Math.sin(rad);

    return {
      factorAbs: Math.abs(lateral),
      sign: Math.sign(lateral),
    };
  }

  /** Signed lateral drift (inches) – + right, − left */
  private computeLateralInches(): number {
    if (
      !this.windSpeedMph ||
      this.rangeMeters <= 0 ||
      this.muzzleVelocityFps <= 0
    ) {
      return 0;
    }

    const { factorAbs, sign } = this.getCrosswindComponents();
    if (!factorAbs) return 0;

    const windFps = this.mphToFps(this.windSpeedMph) * factorAbs;
    const tof = this.timeOfFlightSeconds;

    // Bullet does not fully "sail" at wind speed – use an efficiency factor
    const windEfficiency = 0.12;

    const lateralFeet = windFps * tof * windEfficiency;
    const lateralInches = lateralFeet * 12;

    return lateralInches * sign;
  }

  // Magnitudes for display in the cards

  get driftInches(): number {
    return Math.abs(this.computeLateralInches());
  }

  get driftCm(): number {
    return this.driftInches * 2.54;
  }

  get milDrift(): number {
    const lateralInches = Math.abs(this.computeLateralInches());
    if (!lateralInches) return 0;

    const rangeInches = this.rangeMeters * 39.3701;
    if (!rangeInches) return 0;

    // small-angle approximation: angle (rad) ≈ offset / distance
    const angleRad = lateralInches / rangeInches;

    // 1 mil ≈ 0.001 rad
    let mils = angleRad / 0.001;

    // crude BC scaling (higher BC = less drift)
    const bc = this.ballisticCoeff || 0.5;
    mils = mils / (bc / 0.5);

    return mils;
  }

  get moaDrift(): number {
    return this.milDrift * 3.438;
  }

  // ========================================
  // Arrow = DRIFT direction (downwind)
  // ========================================

  private updateArrowFromClock(): void {
    // Wind is COMING FROM windFromClock.
    // Drift/push is 180° opposite in the “from top, clockwise” frame.
    const fromTopDeg = (this.windFromClock % 12) * 30;
    const downwindTopDeg = (fromTopDeg + 180) % 360;
    this.arrowAngleDeg = downwindTopDeg === 360 ? 0 : downwindTopDeg;
  }

  // ========================================
  // POI red dot – same direction as arrow
  // ========================================

  private updatePoiFromDrift(): void {
    const centerX = 50;
    const centerY = 50;
    const mils = this.milDrift;

    if (!mils) {
      this.poiX = centerX;
      this.poiY = centerY;
      return;
    }

    // Clamp visually so it doesn’t leave the ring
    const magMil = Math.min(3, mils); // up to ~3 mil
    const pixelsPerMil = 4;
    const radius = magMil * pixelsPerMil;

    // arrowAngleDeg is already downwind (push) direction from TOP.
    const downwindTopDeg = this.arrowAngleDeg;
    const rad = ((downwindTopDeg - 90) * Math.PI) / 180;

    this.poiX = centerX + radius * Math.cos(rad);
    this.poiY = centerY + radius * Math.sin(rad);
  }

  // ========================================
  // Bottom Back button → go to Menu (root route)
  // ========================================

  goBack(): void {
    // Assuming the Menu is the default '' route.
    // If you have an explicit '/menu' route, change to ['/menu'].
    this.router.navigate(['/']);
  }
}
