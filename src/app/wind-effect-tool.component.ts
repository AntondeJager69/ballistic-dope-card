import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
  imports: [CommonModule, FormsModule],
  templateUrl: './wind-effect-tool.component.html',
})
export class WindEffectToolComponent implements OnInit {
  // Inputs
  windSpeedMph = 10;
  windClock = 3; // 1–12

  // Arrow rotation (0° = 12 o'clock / straight up)
  arrowAngleDeg = 90; // default 3 o’clock

  // SVG hour markers
  hours: HourMarker[] = [];

  // Pointer dragging state
  private isDragging = false;
  private activePointerId: number | null = null;

  @ViewChild('circleArea')
  circleArea!: ElementRef<HTMLDivElement>;

  ngOnInit(): void {
    this.buildHourMarkers();
    this.updateArrowFromClock();
  }

  // Convert 1–12 clock to arrow rotation (arrow sits on outer edge and
  // points outward FROM the wind direction)
  private updateArrowFromClock(): void {
    const normalized = ((this.windClock % 12) + 12) % 12; // 0–11
    const angleFromTop = normalized * 30; // each hour = 30°
    this.arrowAngleDeg = angleFromTop === 360 ? 0 : angleFromTop;
  }

  // Build hour ticks and labels around the circle
  private buildHourMarkers(): void {
    const cx = 50;
    const cy = 50;
    const innerR = 38;
    const outerR = 42;
    const labelR = 46;

    this.hours = [];
    for (let hour = 1; hour <= 12; hour++) {
      // angle from top (12 o'clock) increasing clockwise
      const angleFromTop = hour * 30;
      const angleFromRight = angleFromTop - 90;
      const rad = (angleFromRight * Math.PI) / 180;

      const tickX1 = cx + innerR * Math.cos(rad);
      const tickY1 = cy + innerR * Math.sin(rad);
      const tickX2 = cx + outerR * Math.cos(rad);
      const tickY2 = cy + outerR * Math.sin(rad);
      const labelX = cx + labelR * Math.cos(rad);
      const labelY = cy + labelR * Math.sin(rad);

      this.hours.push({
        hour,
        tickX1,
        tickY1,
        tickX2,
        tickY2,
        labelX,
        labelY,
      });
    }
  }

  // --- Pointer / dragging logic ---

  startDrag(event: PointerEvent): void {
    this.isDragging = true;
    this.activePointerId = event.pointerId;

    (event.target as HTMLElement).setPointerCapture(event.pointerId);

    this.updateDirectionFromPointer(event);
  }

  onDrag(event: PointerEvent): void {
    if (!this.isDragging || this.activePointerId !== event.pointerId) {
      return;
    }
    this.updateDirectionFromPointer(event);
  }

  endDrag(event?: PointerEvent): void {
    if (
      event &&
      this.activePointerId !== null &&
      event.pointerId !== this.activePointerId
    ) {
      return;
    }
    this.isDragging = false;
    this.activePointerId = null;
  }

  private updateDirectionFromPointer(event: PointerEvent): void {
    if (!this.circleArea) return;

    const rect = this.circleArea.nativeElement.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const dx = event.clientX - cx;
    const dy = event.clientY - cy;

    // angleFromRight: 0° at +X (right), 90° at +Y (down)
    const angleFromRight = (Math.atan2(dy, dx) * 180) / Math.PI;

    // Convert to angle from top (12 o'clock), clockwise 0–360
    let angleFromTop = angleFromRight + 90;
    angleFromTop = (angleFromTop + 360) % 360;

    // Convert angle to nearest hour (1–12)
    const raw = Math.round(angleFromTop / 30) % 12; // 0–11
    const hour = raw === 0 ? 12 : raw;

    this.windClock = hour;
    this.updateArrowFromClock();
  }

  // --- POI red-dot position (visual only) ---

  get poiX(): number {
    const { radius, radFromTop } = this.getPoiGeometry();
    return 50 + radius * Math.sin(radFromTop);
  }

  get poiY(): number {
    const { radius, radFromTop } = this.getPoiGeometry();
    return 50 - radius * Math.cos(radFromTop);
  }

  private getPoiGeometry(): { radius: number; radFromTop: number } {
    const maxRadius = 18;
    const minRadius = 4;

    const clampedSpeed = Math.max(0, Math.min(this.windSpeedMph, 30));
    const fraction = clampedSpeed / 30; // 0–1

    const radius = minRadius + (maxRadius - minRadius) * fraction;
    const angleFromTopDeg = (this.windClock % 12) * 30;
    const radFromTop = (angleFromTopDeg * Math.PI) / 180;

    return { radius, radFromTop };
  }

  // --- Simple drift model (reference only) ---
  //  Full-value 10 mph ≈ 1.0 mil, MOA = mil * 3.438

  private getCrosswindFactor(clock: number): number {
    // 3 / 9 = full value, 2 / 4 / 8 / 10 ≈ 0.87, 1 / 5 / 7 / 11 ≈ 0.5, 6 / 12 = 0
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

  get milDrift(): number {
    const factor = this.getCrosswindFactor(this.windClock);
    return (this.windSpeedMph / 10) * factor;
  }

  get moaDrift(): number {
    return this.milDrift * 3.438;
  }
}
