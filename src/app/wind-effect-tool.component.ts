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

  // Wind inputs
  windSpeed = 5;   // arbitrary units (m/s or mph – just visual)
  windClock = 3;   // 3 o'clock = from the right
  windAngleDeg = 90; // 0° = from 12 o'clock, clockwise

  // Drawing
  circleDiameter = 220; // px
  impactX = 0; // px offset from centre
  impactY = 0; // px offset from centre

  // Drag state
  private isDragging = false;

  ngOnInit(): void {
    this.syncAngleFromClock();
    this.computeImpact();
  }

  // Crosswind % of a pure 90° crosswind
  get crosswindPercent(): number {
    const angleRad = (this.windAngleDeg * Math.PI) / 180;
    const factor = Math.abs(Math.sin(angleRad)); // 0..1
    return Math.round(factor * 100);
  }

  // When user edits wind speed
  onWindSpeedChange(value: number | null): void {
    this.windSpeed = value ?? 0;
    this.computeImpact();
  }

  // When user edits the clock value
  onWindClockChange(): void {
    this.syncAngleFromClock();
    this.computeImpact();
  }

  // Map clock → angle (12 = 0°, 3 = 90°, 6 = 180°, 9 = 270°)
  private syncAngleFromClock(): void {
    let c = this.windClock ?? 12;
    c = ((c - 1) % 12 + 12) % 12 + 1; // clamp to 1..12
    this.windClock = c;

    let deg = c * 30;
    if (deg >= 360) deg = 0;
    this.windAngleDeg = deg;
  }

  // Map angle → nearest clock number
  private syncClockFromAngle(): void {
    this.windClock = this.degreesToClock(this.windAngleDeg);
  }

  // ---------------- Pointer / drag handling ----------------

  onCirclePointerDown(event: PointerEvent): void {
    event.preventDefault();
    this.isDragging = true;
    this.updateAngleFromPointer(event);
  }

  @HostListener('window:pointermove', ['$event'])
  onWindowPointerMove(event: PointerEvent): void {
    if (!this.isDragging) return;
    this.updateAngleFromPointer(event);
  }

  @HostListener('window:pointerup')
  @HostListener('window:pointercancel')
  endDrag(): void {
    this.isDragging = false;
  }

  private updateAngleFromPointer(event: PointerEvent): void {
    const rect = this.circleRef.nativeElement.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const dx = event.clientX - cx;
    const dy = event.clientY - cy;

    // 0° at top (12 o'clock), clockwise positive
    let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (deg < 0) deg += 360;

    this.windAngleDeg = Math.round(deg);
    this.syncClockFromAngle();
    this.computeImpact();
  }

  // ---------------- Physics-ish visualisation ----------------

  private computeImpact(): void {
    // Normalise speed into 0..1 (cap at 20 units)
    const speedNorm = Math.max(0, Math.min(this.windSpeed, 20)) / 20;
    const angleRad = (this.windAngleDeg * Math.PI) / 180;

    // Horizontal (left/right) component ~ sin
    const cross = Math.sin(angleRad);

    // Vertical (up/down) component ~ cos
    // (smaller influence, just to show high/low on head/tail winds)
    const vertical = Math.cos(angleRad);

    const maxRadius = this.circleDiameter / 2 - 20;
    const driftRadius = maxRadius * speedNorm;

    // X right positive, Y down positive (we invert Y so "up" on screen is positive lift)
    this.impactX = cross * driftRadius;
    this.impactY = -vertical * driftRadius * 0.4; // 40% of lateral effect
  }

  private degreesToClock(deg: number): number {
    // 0° = 12, 90° = 3, 180° = 6, 270° = 9
    let d = ((deg % 360) + 360) % 360;
    let hour = Math.round(d / 30) % 12;
    if (hour === 0) hour = 12;
    return hour;
  }
}
