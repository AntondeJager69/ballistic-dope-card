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
  windSpeed = 5;        // m/s or mph – just for scale
  windClock = 3;        // 3 o'clock = from the right
  windAngleDeg = 90;    // 0° = from 12 o'clock, clockwise

  // Drawing
  circleDiameter = 220; // px
  impactX = 0;          // px offset from centre
  impactY = 0;          // px offset from centre

  // Drag state
  private isDragging = false;

  ngOnInit(): void {
    this.syncAngleFromClock();
    this.computeImpact();
  }

   // Radius for fat arrow – slightly OUTSIDE the circle rim
  get arrowRadius(): number {
    return this.circleDiameter / 2 + 10; // 10px outside the border
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
    c = ((c - 1) % 12 + 12) % 12 + 1; // clamp 1..12
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
    event.preventDefault(); // stop scroll
    this.isDragging = true;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    this.updateAngleFromPointer(event);
  }

  @HostListener('window:pointermove', ['$event'])
  onWindowPointerMove(event: PointerEvent): void {
    if (!this.isDragging) return;
    event.preventDefault(); // lock screen movement while dragging
    this.updateAngleFromPointer(event);
  }

  @HostListener('window:pointerup', ['$event'])
  @HostListener('window:pointercancel', ['$event'])
  endDrag(event: PointerEvent): void {
    if (!this.isDragging) return;
    this.isDragging = false;
    try {
      (event.target as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
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

  // ---------------- Visualised POI shift ----------------

    private computeImpact(): void {
    // Normalise speed into 0..1 (cap at 20 units)
    const speedNorm = Math.max(0, Math.min(this.windSpeed, 20)) / 20;
    const angleRad = (this.windAngleDeg * Math.PI) / 180;

    // Horizontal (left/right) component ~ sin
    const cross = Math.sin(angleRad);

    // Vertical (up/down) component ~ cos
    // Smaller influence, to show high/low for head/tail winds
    const vertical = Math.cos(angleRad);

    const maxRadius = this.circleDiameter / 2 - 20;
    const driftRadius = maxRadius * speedNorm;

    // 🔁 IMPORTANT:
    // Red dot should move OPPOSITE the wind arrow.
    // - Wind from 3 o'clock (right) => impact left  (negative X)
    // - Wind from 9 o'clock (left)  => impact right (positive X)
    this.impactX = -cross * driftRadius;

    // Simple ballistic-ish feel:
    // - Headwind (12 o'clock)  => slightly LOWER impact  (dot down)
    // - Tailwind (6 o'clock)   => slightly HIGHER impact (dot up)
    this.impactY = vertical * driftRadius * 0.3; // 30% of lateral effect
  }


  private degreesToClock(deg: number): number {
    // 0° = 12, 90° = 3, 180° = 6, 270° = 9
    let d = ((deg % 360) + 360) % 360;
    let hour = Math.round(d / 30) % 12;
    if (hour === 0) hour = 12;
    return hour;
  }
}
