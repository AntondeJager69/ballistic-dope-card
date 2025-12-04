import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

type WindUnit = 'mph' | 'mps' | 'kmh';

interface WindHourMark {
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

  // --- Rifle / ballistic placeholders (later from Rifles tab) ---
  rangeMeters = 600;          // m
  muzzleVelocityFps = 2800;   // fps
  ballisticCoeff = 0.5;       // G1

  // --- Wind speed & units ---
  // canonical value in mph
  windSpeedMph = 10;
  // current UI unit
  windUnit: WindUnit = 'mph';
  // value shown in the input (in current unit)
  windSpeedInput = 10;

  // --- Wind direction (clock) ---
  windClock = 3;              // 1–12 clock

  // --- Arrow and clock rendering ---
  arrowAngleDeg = 90;         // deg from top, clockwise
  hours: WindHourMark[] = [];

  // --- POI dot position (for [attr.cx]/[attr.cy]) ---
  poiX = 50;
  poiY = 50;

  // Pointer drag state
  private dragging = false;

  ngOnInit(): void {
    this.buildHourMarkers();
    this.updateArrowFromClock();
    // sync UI input from canonical mph
    this.windSpeedInput = this.fromMph(this.windSpeedMph, this.windUnit);
    this.updatePoiFromDrift();
  }

  // =======================================
  // Wind speed + unit conversion
  // =======================================

  onWindSpeedInputChange(raw: any): void {
    const val = Number(raw);
    if (!Number.isFinite(val)) {
      this.windSpeedInput = 0;
      this.windSpeedMph = 0;
      this.updatePoiFromDrift();
      return;
    }
    this.windSpeedInput = val;
    this.windSpeedMph = this.toMph(val, this.windUnit);
    this.updatePoiFromDrift();
  }

  onWindUnitChange(raw: any): void {
    const unit = (raw ?? 'mph') as WindUnit;
    if (unit === this.windUnit) return;

    // convert current canonical mph into new unit for display
    this.windUnit = unit;
    this.windSpeedInput = this.fromMph(this.windSpeedMph, unit);
  }

  private toMph(value: number, unit: WindUnit): number {
    if (!Number.isFinite(value)) return 0;
    switch (unit) {
      case 'mph':
        return value;
      case 'kmh':
        return value * 0.621371;
      case 'mps':
        return value * 2.23694;
      default:
        return value;
    }
  }

  private fromMph(value: number, unit: WindUnit): number {
    if (!Number.isFinite(value)) return 0;
    switch (unit) {
      case 'mph':
        return value;
      case 'kmh':
        return value / 0.621371;
      case 'mps':
        return value / 2.23694;
      default:
        return value;
    }
  }

  // =======================================
  // Live wind label
  // =======================================

  get windLabel(): string {
    const h = this.windClock;

    if ([2, 3, 4].includes(h)) {
      return 'Left → Right';
    }
    if ([8, 9, 10].includes(h)) {
      return 'Right → Left';
    }
    if ([11, 12, 1].includes(h)) {
      return 'Headwind';
    }
    if ([5, 6, 7].includes(h)) {
      return 'Tailwind';
    }
    return '';
  }

  // =======================================
  // Hour markers & arrow
  // =======================================

  private buildHourMarkers(): void {
    const cx = 50;
    const cy = 50;
    const innerR = 36;
    const outerR = 40;
    const labelR = 44;

    const result: WindHourMark[] = [];

    for (let hour = 1; hour <= 12; hour++) {
      // angleFromTop: 0° at 12 o'clock, clockwise
      const angleFromTop = (hour % 12) * 30;
      const angleFromRight = angleFromTop - 90;
      const rad = (angleFromRight * Math.PI) / 180;

      const tickX1 = cx + innerR * Math.cos(rad);
      const tickY1 = cy + innerR * Math.sin(rad);
      const tickX2 = cx + outerR * Math.cos(rad);
      const tickY2 = cy + outerR * Math.sin(rad);
      const labelX = cx + labelR * Math.cos(rad);
      const labelY = cy + labelR * Math.sin(rad);

      result.push({
        hour,
        tickX1,
        tickY1,
        tickX2,
        tickY2,
        labelX,
        labelY,
      });
    }

    this.hours = result;
  }

  private updateArrowFromClock(): void {
    const angleFromTop = (this.windClock % 12) * 30;
    this.arrowAngleDeg = angleFromTop === 360 ? 0 : angleFromTop;
  }

  // =======================================
  // Pointer dragging
  // =======================================

  startDrag(event: PointerEvent): void {
    if (!this.circleAreaRef?.nativeElement) return;
    this.dragging = true;
    this.circleAreaRef.nativeElement.setPointerCapture(event.pointerId);
    this.updateDirectionFromPointer(event);
  }

  onDrag(event: PointerEvent): void {
    if (!this.dragging) return;
    this.updateDirectionFromPointer(event);
  }

  endDrag(event: PointerEvent): void {
    if (!this.dragging) return;
    this.dragging = false;
    try {
      this.circleAreaRef.nativeElement.releasePointerCapture(event.pointerId);
    } catch {
      // ignore if capture wasn't set
    }
  }

  private updateDirectionFromPointer(event: PointerEvent): void {
    const rect = this.circleAreaRef.nativeElement.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const dx = event.clientX - cx;
    const dy = event.clientY - cy;

    // angleFromRight: 0° at +X; want angleFromTop (12 o'clock), clockwise
    const angleFromRight = (Math.atan2(dy, dx) * 180) / Math.PI;
    let angleFromTop = angleFromRight + 90;
    angleFromTop = (angleFromTop + 360) % 360;

    // map to nearest hour
    const sector = Math.round(angleFromTop / 30) % 12; // 0–11
    const hour = sector === 0 ? 12 : sector;
    this.windClock = hour;

    this.updateArrowFromClock();
    this.updatePoiFromDrift();
  }

  // =======================================
  // Simple drift model + POI dot
  // =======================================

  private getCrosswindFactor(clock: number): number {
    // 3 / 9 = full value, 2 / 4 / 8 / 10 ≈ 0.87, 1 / 5 / 7 / 11 ≈ 0.5
    const map: Record<number, number> = {
      3: 1,
      9: 1,
      2: 0.87,
      4: 0.87,
      8: 0.87,
      10: 0.87,
      1: 0.5,
      5: 0.5,
      7: 0.5,
      11: 0.5,
      6: 0,
      12: 0,
    };
    return map[clock] ?? 0;
  }

  private mphToFps(speedMph: number): number {
    return speedMph * 1.46667;
  }

  private metersToFeet(meters: number): number {
    return meters * 3.28084;
  }

  private get timeOfFlightSeconds(): number {
    const v = this.muzzleVelocityFps || 1;
    const distanceFt = this.metersToFeet(this.rangeMeters);
    return distanceFt / v;
  }

  get milDrift(): number {
    if (this.rangeMeters <= 0 || this.muzzleVelocityFps <= 0) return 0;

    const factor = this.getCrosswindFactor(this.windClock);
    if (!factor) return 0;

    const effectiveMph = this.windSpeedMph * factor;
    if (!effectiveMph) return 0;

    const windFps = this.mphToFps(effectiveMph);
    const tof = this.timeOfFlightSeconds;

    const lateralFeet = windFps * tof;
    const lateralInches = lateralFeet * 12;
    const rangeInches = this.rangeMeters * 39.3701;
    if (rangeInches <= 0) return 0;

    const angleRad = lateralInches / rangeInches;
    let mils = angleRad / 0.001;

    const bc = this.ballisticCoeff || 0.5;
    mils = mils / (bc / 0.5);

    return mils;
  }

  get moaDrift(): number {
    return this.milDrift * 3.438;
  }

  private updatePoiFromDrift(): void {
    const centerX = 50;
    const centerY = 50;

    const driftMil = this.milDrift;
    const factor = this.getCrosswindFactor(this.windClock);
    const sign =
      [3, 2, 4, 1, 5].includes(this.windClock) ? 1 :
      [9, 8, 10, 7, 11].includes(this.windClock) ? -1 : 0;

    // clamp drift for visual
    const clamped = Math.max(-2, Math.min(2, driftMil * factor));
    const pixelsPerMil = 4;

    const dx = sign * clamped * pixelsPerMil;
    const dy = 0;

    this.poiX = centerX + dx;
    this.poiY = centerY + dy;
  }
}
