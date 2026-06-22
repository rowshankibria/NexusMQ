import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThroughputSummary, TimeRange, ThroughputData } from '../../models';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-throughput-chart',
  standalone: true,
  imports: [CommonModule, LoadingSpinnerComponent],
  templateUrl: './throughput-chart.component.html',
  styleUrls: ['./throughput-chart.component.scss']
})
export class ThroughputChartComponent implements OnChanges, AfterViewInit {
  @Input() throughput: ThroughputSummary | null = null;
  @Input() selectedTimeRange: TimeRange = '1h';
  @Input() loading: boolean = false;

  @Output() timeRangeChange = new EventEmitter<TimeRange>();

  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  timeRanges: TimeRange[] = ['1h', '6h', '24h'];
  chartHeight = 200;
  chartWidth = 600;

  ngAfterViewInit(): void {
    this.drawChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['throughput'] && this.chartCanvas) {
      this.drawChart();
    }
  }

  onTimeRangeSelect(range: TimeRange): void {
    this.timeRangeChange.emit(range);
  }

  get timeRangeLabel(): string {
    const labels: Record<TimeRange, string> = {
      '1h': 'Last Hour',
      '6h': 'Last 6 Hours',
      '24h': 'Last 24 Hours'
    };
    return labels[this.selectedTimeRange];
  }

  private drawChart(): void {
    if (!this.chartCanvas || !this.throughput?.dataPoints?.length) {
      return;
    }

    const canvas = this.chartCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 20, bottom: 30, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, height);

    const dataPoints = this.throughput.dataPoints;
    const maxValue = Math.max(
      ...dataPoints.map(d => Math.max(d.messagesReceived, d.messagesSent, d.messagesProcessed)),
      1
    );

    // Draw grid lines
    ctx.strokeStyle = '#e9ecef';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Y-axis labels
      ctx.fillStyle = '#6c757d';
      ctx.font = '11px system-ui';
      ctx.textAlign = 'right';
      const value = Math.round(maxValue - (maxValue / 4) * i);
      ctx.fillText(value.toString(), padding.left - 8, y + 4);
    }

    // Draw data lines
    if (dataPoints.length > 1) {
      const drawLine = (getData: (d: ThroughputData) => number, color: string) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();

        dataPoints.forEach((point, i) => {
          const x = padding.left + (chartWidth / (dataPoints.length - 1)) * i;
          const y = padding.top + chartHeight - (getData(point) / maxValue) * chartHeight;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });

        ctx.stroke();
      };

      drawLine(d => d.messagesReceived, '#007bff');
      drawLine(d => d.messagesSent, '#28a745');
      drawLine(d => d.messagesProcessed, '#6c757d');
    }

    // X-axis labels
    ctx.fillStyle = '#6c757d';
    ctx.font = '11px system-ui';
    ctx.textAlign = 'center';

    const labelCount = Math.min(6, dataPoints.length);
    for (let i = 0; i < labelCount; i++) {
      const index = Math.floor((dataPoints.length - 1) * (i / (labelCount - 1)));
      const x = padding.left + (chartWidth / (dataPoints.length - 1)) * index;
      const point = dataPoints[index];
      if (point) {
        const date = new Date(point.timestamp);
        const label = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        ctx.fillText(label, x, height - 8);
      }
    }
  }
}
