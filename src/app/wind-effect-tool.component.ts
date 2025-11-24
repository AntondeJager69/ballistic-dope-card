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
  @ViewChild('circleCanvas', { static: true })
  circleCanvasRef!: ElementRef<HTMLCanvasElement>;

  @ViewChild('impactCanvas', { static: true })
  impactCanvasRef!: ElementRef<HTMLCanvasElement>;

  // Wind + geometry state
  windSpeedMps = 5;
  windClock = 3;
  rangeMeters = 500;
  bulletFlightTime = 1.2;

  arrowAngleDeg = 90;
  arrowAngleRad = Math.PI / 2;

  private isDragging = false;

  rifles: Rifle[] = [];
  selectedRifleId: number | null = null;
  distanceM = 500;

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.syncAngleFromClock();
    this.computeImpact();
    this.loadRifles();
  }

  private loadRifles(): void {
    try {
      const allRifles = this.dataService.getRifles?.() ?? [];
      this.rifles = allRifles;

      if (allRifles.length > 0) {
        this.selectedRifleId = allRifles[0].id;
        const first = allRifles[0] as any;
        if (typeof first.defaultRangeM === 'number') {
          this.rangeMeters = first.defaultRangeM;
          this.distanceM = first.defaultRangeM;
        }
        if (typeof first.flightTimeS === 'number') {
          this.bulletFlightTime = first.flightTimeS;
        }
      }
    } catch (err) {
      console.error('[WindEffectTool] Error loading rifles:', err);
    }
  }

  onRifleChange(): void {
    const r = this.rifles.find(r => r.id === this.selectedRifleId) as any;
    if (!r) return;

    if (typeof r.defaultRangeM === 'number') {
      this.rangeMeters = r.defaultRangeM;
      this.distanceM = r.defaultRangeM;
    }
    if (typeof r.flightTimeS === 'number') {
      this.bulletFlightTime = r.flightTimeS;
    }
    this.computeImpact();
  }

  onWindSpeedChange(): void {
    this.computeImpact();
  }

  onWindClockChange(): void {
    if (this.windClock < 1) this.windClock = 1;
    if (this.windClock > 12) this.windClock = 12;
    this.syncAngleFromClock();
    this.computeImpact();
  }

  onRangeChange(): void {
    if (this.rangeMeters < 50) this.rangeMeters = 50;
    this.computeImpact();
  }

  private syncAngleFromClock(): void {
    const clock = ((this.windClock % 12) + 12) % 12;
    const angleDeg = clock === 0 ? 0 : clock * 30;

    this.arrowAngleDeg = angleDeg;
    this.arrowAngleRad = (angleDeg * Math.PI) / 180;
  }

  get directionLabel(): string {
    const c = ((this.windClock - 1 + 12) % 12) + 1;
    if (c === 3) return 'Full value, left → right';
    if (c === 9) return 'Full value, right → left';
    if (c === 12) return 'Head wind';
    if (c === 6) return 'Tail wind';
    if (c > 3 && c < 9) return 'Right quartering';
    if (c > 9 || c < 3) return 'Left quartering';
    return 'Quartering wind';
  }

  get crosswindFactor(): number {
    const clock = ((this.windClock % 12) + 12) % 12;
    const angleDeg = clock === 0 ? 0 : clock * 30;
    const rad = (angleDeg * Math.PI) / 180;
    return Math.abs(Math.sin(rad));
  }

  get driftCm(): number {
    const baseTime = this.bulletFlightTime || 1.2;
    const effectiveSpeed = this.windSpeedMps * this.crosswindFactor;
    const driftMeters = effectiveSpeed * baseTime;
    return driftMeters * 100;
  }

  get holdMil(): number {
    const cmPerMilAtDist = (this.rangeMeters / 100) * 10;
    const drift = this.driftCm;
    if (cmPerMilAtDist <= 0) return 0;
    return drift / cmPerMilAtDist;
  }

  get holdMoa(): number {
    return this.holdMil * 3.43775;
  }

  get impactOffset(): { x: number; y: number } {
    const radiusPx = 70;
    const factor = Math.min(Math.abs(this.holdMil) / 1.5, 1);
    const r = radiusPx * factor;

    const rad = this.arrowAngleRad + Math.PI / 2;
    const x = Math.cos(rad) * r;
    const y = Math.sin(rad) * r;

    return { x, y: -y };
  }

  private computeImpact(): void {
    this.drawCircleLayer();
    this.drawImpactLayer();
  }

  private drawCircleLayer(): void {
    const canvas = this.circleCanvasRef?.nativeElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const radius = size / 2 - 8;

    ctx.clearRect(0, 0, size, size);

    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const drawTick = (angleDeg: number, label: string) => {
      const rad = (angleDeg * Math.PI) / 180;
      const x1 = center + Math.cos(rad) * (radius - 6);
      const y1 = center + Math.sin(rad) * (radius - 6);
      const x2 = center + Math.cos(rad) * radius;
      const y2 = center + Math.sin(rad) * radius;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = '#6b7280';
      ctx.lineWidth = 1;
      ctx.stroke();

      const labelR = radius + 10;
      const lx = center + Math.cos(rad) * labelR;
      const ly = center + Math.sin(rad) * labelR + 3;

      ctx.fillStyle = '#9ca3af';
      ctx.font = '9px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(label, lx, ly);
    };

    drawTick(0, '12');
    drawTick(90, '3');
    drawTick(180, '6');
    drawTick(270, '9');

    const arrowRad = this.arrowAngleRad;
    const ax1 = center;
    const ay1 = center;
    const ax2 = center + Math.cos(arrowRad) * (radius - 10);
    const ay2 = center + Math.sin(arrowRad) * (radius - 10);

    ctx.beginPath();
    ctx.moveTo(ax1, ay1);
    ctx.lineTo(ax2, ay2);
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.stroke();

    const headLen = 8;
    const headAngle1 = arrowRad + Math.PI / 7;
    const headAngle2 = arrowRad - Math.PI / 7;

    ctx.beginPath();
    ctx.moveTo(ax2, ay2);
    ctx.lineTo(
      ax2 - Math.cos(headAngle1) * headLen,
      ay2 - Math.sin(headAngle1) * headLen
    );
    ctx.lineTo(
      ax2 - Math.cos(headAngle2) * headLen,
      ay2 - Math.sin(headAngle2) * headLen
    );
    ctx.closePath();
    ctx.fillStyle = '#f97316';
    ctx.fill();
  }

  private drawImpactLayer(): void {
    const canvas = this.impactCanvasRef?.nativeElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;

    ctx.clearRect(0, 0, size, size);

    ctx.beginPath();
    ctx.arc(center, center, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#e5e7eb';
    ctx.fill();

    const offset = this.impactOffset;

    ctx.beginPath();
    ctx.arc(center + offset.x, center + offset.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    this.isDragging = false;
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(ev: MouseEvent): void {
    if (!this.isDragging) return;

    const canvas = this.circleCanvasRef?.nativeElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const dx = x - centerX;
    const dy = y - centerY;

    const angle = Math.atan2(dy, dx);
    let deg = (angle * 180) / Math.PI;
    if (deg < 0) deg += 360;

    this.arrowAngleDeg = deg;
    this.arrowAngleRad = angle;
    this.windClock = this.angleToClock(deg);

    this.computeImpact();
  }

  onMouseDown(ev: MouseEvent): void {
    const canvas = this.circleCanvasRef?.nativeElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const dx = x - centerX;
    const dy = y - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const radius = canvas.width / 2 - 8;
    if (Math.abs(dist - radius) < 18) {
      this.isDragging = true;
    }
  }

  private angleToClock(deg: number): number {
    let c = Math.round(deg / 30);
    if (c === 0) c = 12;
    if (c < 1) c += 12;
    if (c > 12) c -= 12;
    return c;
  }
}
