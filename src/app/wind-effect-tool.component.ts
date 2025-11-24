import {
  Component,
  ElementRef,
  ViewChild,
  HostListener,
  OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from './data.service';
import { Rifle } from './models';

@Component({
  standalone: true,
  selector: 'app-wind-effect-tool',
  templateUrl: './wind-effect-tool.component.html',
  imports: [CommonModule, FormsModule]
})
export class WindEffectToolComponent implements OnInit {
  @ViewChild('circle', { static: true }) circleRef!: ElementRef<HTMLDivElement>;

  // Wind inputs
  windSpeed = 5;        // m/s
  windClock = 3;        // 3 o'clock = from the right
  windAngleDeg = 90;    // 0° = from 12 o'clock, clockwise

  // Drawing
  circleDiameter = 220; // px
  impactX = 0;          // px offset from centre
  impactY = 0;          // px offset from centre

  // Drag state
  private isDragging = false;

  // Rifle integration
  rifles: Rifle[] = [];
  selectedRifleId: number | null = null;
  distanceM = 500;      // range to evaluate drift at

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.syncAngleFromClock();
    this.computeImpact();
    this.loadRifles();
  }

  private loadRifles(): void {
    try {
      const ds: any = this.dataService;
      if (ds && typeof ds.getRifles === 'function') {
        this.rifles = ds.getRifles() || [];
        if (this.rifles.length > 0) {
          this.selectedRifleId = this.rifles[0].id;
        }
      }
    } catch (err) {
      console.warn('WindEffectTool: unable to load rifles from DataService', err);
      this.rifles = [];
    }
  }

  get selectedRifle(): Rifle | null {
    if (!this.rifles || this.rifles.length === 0 || this.selectedRifleId == null) {
      return null;
    }
    return this.rifles.find(r => r.id === this.selectedRifleId) || null;
  }

  // Radius for fat arrow – slightly outside the circle rim
  get arrowRadius(): number {
    return this.circleDiameter / 2 + 10; // px
  }

  // Crosswind % of a pure 90° crosswind
  get crosswindPercent(): number {
    const angleRad = (this.windAngleDeg * Math.PI) / 180;
    const factor = Math.abs(Math.sin(angleRad)); // 0..1
    return Math.round(factor * 100);
  }

  // Approximate wind drift (mil) for the selected rifle & distance
  get approxDriftMil(): number | null {
    const rifle = this.selectedRifle;
    if (!rifle) return null;
    if (!this.distanceM || this.distanceM <= 0) return null;
    if (!this.windSpeed || this.windSpeed === 0) return 0;

    // Use muzzle velocity if available, otherwise a generic 800 m/s
    const vFps = rifle.muzzleVelocityFps ?? 0;
    let v0 = vFps > 0 ? vFps * 0.3048 : 800; // m/s

    const angleRad = (this.windAngleDeg * Math.PI) / 180;
    const crossFactor = Math.abs(Math.sin(angleRad)); // 0..1
    const crosswindMps = this.windSpeed * crossFactor;

    // Very rough time-of-flight estimate (include deceleration fudge factor)
    const effectiveVel = v0 * 0.9;
    if (effectiveVel <= 0) return null;

    const distanceM = this.distanceM;
    const timeOfFlight = distanceM / effectiveVel; // seconds

    // Lateral drift in meters = crosswind * time of flight
    const driftMeters = crosswindMps * timeOfFlight;

    // Convert to mils: 1 mil at distance d(m) = d/1000 meters
    const mil = (driftMeters * 1000) / distanceM;
    return +mil.toFixed(2);
  }

  get driftDirectionLabel(): string {
    // use impactX sign for side indication
    if (Math.abs(this.impactX) < 1) {
      return 'Minimal lateral drift';
    }
    if (this.impactX < 0) {
      // red dot left of centre -> wind from right
      return 'Drift left (hold right)';
    }
    return 'Drift right (hold left)';
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
    try {
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }
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
    if (!this.circleRef) return;
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
    const vertical = Math.cos(angleRad);

    const maxRadius = this.circleDiameter / 2 - 20;
    const driftRadius = maxRadius * speedNorm;

    // Bullet drifts AWAY from wind direction:
    // wind FROM the right (3 o'clock) pushes bullet LEFT -> negative X
    this.impactX = -cross * driftRadius;

    // Headwind (12 o'clock) -> slightly lower impact (dot down)
    // Tailwind (6 o'clock)  -> slightly higher impact (dot up)
    this.impactY = vertical * driftRadius * 0.3;
  }

  private degreesToClock(deg: number): number {
    // 0° = 12, 90° = 3, 180° = 6, 270° = 9
    let d = ((deg % 360) + 360) % 360;
    let hour = Math.round(d / 30) % 12;
    if (hour === 0) hour = 12;
    return hour;
  }
}
