import {
  Component,
  ElementRef,
  ViewChild,
  HostListener,
  OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  standalone: true,
  selector: 'app-wind-effect-tool',
  templateUrl: './wind-effect-tool.component.html',
  imports: [CommonModule, FormsModule]
})
export class WindEffectToolComponent implements OnInit {
  @ViewChild('circle', { static: true }) circleRef!: ElementRef<HTMLDivElement>;

  // User input
  windSpeed: number = 5;          // m/s or whatever you use visually
  windAngleDeg: number = 90;      // 0° = from 12 o'clock, 90° = from 3 o'clock, etc.

  // Visual sizing
  circleRadiusPx = 110;           // radius used for arrow position
  maxImpactOffsetPx = 65;         // max red-dot offset from center

  // Computed red-dot position (CSS pixels)
  impactX = 0;
  impactY = 0;

  // Drag state
  private isDragging = false;

  ngOnInit(): void {
    this.computeImpact();
  }

  // ---------------------------------------------------------------------------
  // Pointer / drag handling
  // ---------------------------------------------------------------------------

  onCircleClick(event: MouseEvent | TouchEvent): void {
    this.updateAngleFromEvent(event);
  }

  onHandleDown(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    this.isDragging = true;
    this.updateAngleFromEvent(event);
  }

  @HostListener('window:mousemove', ['$event'])
  onWindowMouseMove(event: MouseEvent): void {
    if (!this.isDragging) return;
    this.updateAngleFromEvent(event);
  }

  @HostListener('window:touchmove', ['$event'])
  onWindowTouchMove(event: TouchEvent): void {
    if (!this.isDragging) return;
    this.updateAngleFromEvent(event);
  }

  @HostListener('window:mouseup')
  @HostListener('window:touchend')
  onWindowUp(): void {
    this.isDragging = false;
  }

  private updateAngleFromEvent(event: MouseEvent | TouchEvent): void {
    const circleEl = this.circleRef?.nativeElement;
    if (!circleEl) return;

    let clientX: number;
    let clientY: number;

    if (event instanceof MouseEvent) {
      clientX = event.clientX;
      clientY = event.clientY;
    } else {
      if (!event.touches.length) return;
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    }

    const rect = circleEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const dx = clientX - cx;
    const dy = clientY - cy;

    // atan2 is measured from +X axis (to the right), counter-clockwise
    let mathDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

    // Convert so that:
    //   0°  = FROM 12 o'clock (top, head-on),
    //   90° = FROM 3 o'clock (from the right),
    //   180°= FROM 6 o'clock (from behind), etc.
    const clockDeg = (mathDeg + 90 + 360) % 360;

    this.windAngleDeg = clockDeg;
    this.computeImpact();
  }

  // ---------------------------------------------------------------------------
  // Wind / impact model (visual only, not full ballistics)
  // ---------------------------------------------------------------------------

  computeImpact(): void {
    // Full value when wind is purely side-on (3 or 9 o'clock),
    // zero when head-on or tail-wind (12 or 6 o'clock).
    const angleRad = (this.windAngleDeg * Math.PI) / 180;
    const fullValueFactor = Math.sin(angleRad); // -1 .. 1

    // Scale by wind speed (clamped) for visual effect
    const refSpeed = 12; // “full” wind for this visual
    const strength = Math.min(Math.abs(this.windSpeed) / refSpeed, 1);

    const signed = fullValueFactor * strength;

    // Bullet drifts AWAY from wind direction:
    // wind FROM the right (3 o'clock) pushes bullet LEFT -> negative X
    this.impactX = -signed * this.maxImpactOffsetPx;
    this.impactY = 0; // you can add a vertical component later if desired
  }

  // Arrow position on circumference (CSS)
  get arrowX(): string {
    const rad = (this.windAngleDeg - 90) * (Math.PI / 180);
    return `${Math.cos(rad) * this.circleRadiusPx}px`;
  }

  get arrowY(): string {
    const rad = (this.windAngleDeg - 90) * (Math.PI / 180);
    return `${Math.sin(rad) * this.circleRadiusPx}px`;
  }

  // ---------------------------------------------------------------------------
  // Readouts
  // ---------------------------------------------------------------------------

  /** Clock label like "3 o'clock" based on windAngleDeg (FROM direction, target at 12) */
  get windClockLabel(): string {
    const hour = this.degreesToClock(this.windAngleDeg);
    return `${hour} o'clock`;
  }

  /** Crosswind factor 0–100% */
  get crosswindPercent(): number {
    const angleRad = (this.windAngleDeg * Math.PI) / 180;
    const factor = Math.abs(Math.sin(angleRad)); // 0..1
    return Math.round(factor * 100);
  }

  private degreesToClock(deg: number): number {
    // 0° = 12, 90° = 3, 180° = 6, 270° = 9
    let d = ((deg % 360) + 360) % 360;
    let hour = Math.round(d / 30) % 12;
    if (hour === 0) hour = 12;
    return hour;
  }
}
