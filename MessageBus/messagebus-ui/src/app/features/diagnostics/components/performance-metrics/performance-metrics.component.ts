import { Component, Input, OnChanges, SimpleChanges, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DiagnosticsService } from '../../services';
import {
  PerformanceMetrics,
  TimeRange,
  MetricDataPoint,
  QueueProcessingTime,
  ServiceActivity,
  ConversationAgeDistribution
} from '../../models';

@Component({
  selector: 'app-performance-metrics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './performance-metrics.component.html',
  styleUrls: ['./performance-metrics.component.scss']
})
export class PerformanceMetricsComponent implements OnChanges, AfterViewInit {
  @Input() metrics: PerformanceMetrics | null = null;
  @Input() timeRange: TimeRange = '1h';
  @Input() loading = false;

  @ViewChild('messageRateCanvas') messageRateCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('queueDepthCanvas') queueDepthCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('ageDistributionCanvas') ageDistributionCanvas!: ElementRef<HTMLCanvasElement>;

  timeRangeOptions: { value: TimeRange; label: string }[] = [
    { value: '1h', label: '1 Hour' },
    { value: '6h', label: '6 Hours' },
    { value: '24h', label: '24 Hours' },
    { value: '7d', label: '7 Days' }
  ];

  private chartColors = {
    primary: '#0d6efd',
    success: '#28a745',
    warning: '#ffc107',
    danger: '#dc3545',
    info: '#17a2b8',
    secondary: '#6c757d'
  };

  constructor(private diagnosticsService: DiagnosticsService) {}

  ngAfterViewInit(): void {
    this.renderCharts();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['metrics'] && !changes['metrics'].firstChange) {
      setTimeout(() => this.renderCharts(), 0);
    }
  }

  onTimeRangeChange(range: TimeRange): void {
    this.diagnosticsService.setMetricsTimeRange(range);
  }

  private renderCharts(): void {
    if (!this.metrics) return;

    this.renderMessageRateChart();
    this.renderQueueDepthChart();
    this.renderAgeDistributionChart();
  }

  private renderMessageRateChart(): void {
    if (!this.messageRateCanvas?.nativeElement || !this.metrics?.messageRate) return;

    const canvas = this.messageRateCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = this.metrics.messageRate.dataPoints;
    this.renderLineChart(ctx, canvas, data, this.chartColors.primary, 'Messages/sec');
  }

  private renderQueueDepthChart(): void {
    if (!this.queueDepthCanvas?.nativeElement || !this.metrics?.queueDepthTrend) return;

    const canvas = this.queueDepthCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = this.metrics.queueDepthTrend.dataPoints;
    this.renderLineChart(ctx, canvas, data, this.chartColors.info, 'Queue Depth');
  }

  private renderAgeDistributionChart(): void {
    if (!this.ageDistributionCanvas?.nativeElement || !this.metrics?.conversationAgeDistribution) return;

    const canvas = this.ageDistributionCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = this.metrics.conversationAgeDistribution;
    this.renderBarChart(ctx, canvas, data);
  }

  private renderLineChart(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    data: MetricDataPoint[],
    color: string,
    label: string
  ): void {
    const width = canvas.width = canvas.offsetWidth * 2;
    const height = canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);

    const actualWidth = width / 2;
    const actualHeight = height / 2;
    const padding = { top: 20, right: 20, bottom: 30, left: 50 };
    const chartWidth = actualWidth - padding.left - padding.right;
    const chartHeight = actualHeight - padding.top - padding.bottom;

    ctx.clearRect(0, 0, actualWidth, actualHeight);

    if (data.length === 0) {
      ctx.fillStyle = '#6c757d';
      ctx.font = '14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('No data available', actualWidth / 2, actualHeight / 2);
      return;
    }

    const values = data.map(d => d.value);
    const maxValue = Math.max(...values, 1);
    const minValue = Math.min(...values, 0);
    const range = maxValue - minValue || 1;

    // Draw grid
    ctx.strokeStyle = '#e9ecef';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartWidth, y);
      ctx.stroke();

      // Y-axis labels
      const value = maxValue - (range / 4) * i;
      ctx.fillStyle = '#6c757d';
      ctx.font = '11px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(this.formatValue(value), padding.left - 8, y + 4);
    }

    // Draw line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';

    data.forEach((point, index) => {
      const x = padding.left + (index / (data.length - 1 || 1)) * chartWidth;
      const y = padding.top + chartHeight - ((point.value - minValue) / range) * chartHeight;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw area fill
    ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
    ctx.lineTo(padding.left, padding.top + chartHeight);
    ctx.closePath();
    ctx.fillStyle = color + '20';
    ctx.fill();
  }

  private renderBarChart(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    data: ConversationAgeDistribution[]
  ): void {
    const width = canvas.width = canvas.offsetWidth * 2;
    const height = canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);

    const actualWidth = width / 2;
    const actualHeight = height / 2;
    const padding = { top: 20, right: 20, bottom: 50, left: 50 };
    const chartWidth = actualWidth - padding.left - padding.right;
    const chartHeight = actualHeight - padding.top - padding.bottom;

    ctx.clearRect(0, 0, actualWidth, actualHeight);

    if (data.length === 0) {
      ctx.fillStyle = '#6c757d';
      ctx.font = '14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('No data available', actualWidth / 2, actualHeight / 2);
      return;
    }

    const maxCount = Math.max(...data.map(d => d.count), 1);
    const barWidth = (chartWidth / data.length) * 0.7;
    const barGap = (chartWidth / data.length) * 0.3;

    // Draw bars
    data.forEach((item, index) => {
      const barHeight = (item.count / maxCount) * chartHeight;
      const x = padding.left + index * (barWidth + barGap) + barGap / 2;
      const y = padding.top + chartHeight - barHeight;

      // Bar
      ctx.fillStyle = this.chartColors.primary;
      ctx.fillRect(x, y, barWidth, barHeight);

      // Label
      ctx.fillStyle = '#6c757d';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      ctx.save();
      ctx.translate(x + barWidth / 2, padding.top + chartHeight + 10);
      ctx.rotate(-Math.PI / 4);
      ctx.fillText(item.ageRangeMinutes, 0, 0);
      ctx.restore();

      // Value on top
      if (barHeight > 15) {
        ctx.fillStyle = '#fff';
        ctx.font = '11px system-ui';
        ctx.fillText(item.count.toString(), x + barWidth / 2, y + 14);
      }
    });
  }

  private formatValue(value: number): string {
    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
    return value.toFixed(0);
  }

  getTrendIcon(trend: 'Increasing' | 'Decreasing' | 'Stable'): string {
    switch (trend) {
      case 'Increasing': return '↑';
      case 'Decreasing': return '↓';
      case 'Stable': return '→';
    }
  }

  getTrendClass(trend: 'Increasing' | 'Decreasing' | 'Stable'): string {
    switch (trend) {
      case 'Increasing': return 'trend-up';
      case 'Decreasing': return 'trend-down';
      case 'Stable': return 'trend-stable';
    }
  }

  formatProcessingTime(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  trackByQueue(index: number, queue: QueueProcessingTime): string {
    return queue.queueName;
  }

  trackByService(index: number, service: ServiceActivity): string {
    return service.serviceName;
  }
}
