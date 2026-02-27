import { Injectable } from '@nestjs/common';

interface HttpMetricInput {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
}

function escapePrometheusLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

@Injectable()
export class MetricsService {
  private readonly startedAt = Date.now();
  private readonly httpRequestCounts = new Map<string, number>();
  private readonly httpDurationSums = new Map<string, number>();
  private readonly httpDurationCounts = new Map<string, number>();
  private http5xxTotal = 0;
  private outboxDispatchFailuresTotal = 0;
  private outboxWebhookFailuresTotal = 0;

  recordHttpRequest(input: HttpMetricInput): void {
    const method = input.method.toUpperCase();
    const route = this.normalizePath(input.path);
    const statusClass = this.statusClass(input.statusCode);

    const requestKey = `${method}|${route}|${statusClass}`;
    this.httpRequestCounts.set(requestKey, (this.httpRequestCounts.get(requestKey) ?? 0) + 1);

    const durationKey = `${method}|${route}`;
    this.httpDurationSums.set(durationKey, (this.httpDurationSums.get(durationKey) ?? 0) + input.durationMs);
    this.httpDurationCounts.set(durationKey, (this.httpDurationCounts.get(durationKey) ?? 0) + 1);

    if (input.statusCode >= 500) {
      this.http5xxTotal += 1;
    }
  }

  recordOutboxDispatchFailure(): void {
    this.outboxDispatchFailuresTotal += 1;
  }

  recordOutboxWebhookFailure(): void {
    this.outboxWebhookFailuresTotal += 1;
  }

  renderPrometheus(): string {
    const lines: string[] = [];

    lines.push('# HELP rfid_http_requests_total Total HTTP requests grouped by method/route/status class.');
    lines.push('# TYPE rfid_http_requests_total counter');
    this.httpRequestCounts.forEach((value, compositeKey) => {
      const [method, route, statusClass] = compositeKey.split('|');
      lines.push(
        `rfid_http_requests_total{method="${escapePrometheusLabel(method ?? '')}",route="${escapePrometheusLabel(route ?? '')}",status_class="${escapePrometheusLabel(statusClass ?? '')}"} ${value}`,
      );
    });

    lines.push('# HELP rfid_http_request_duration_ms_sum Sum of HTTP request durations in milliseconds.');
    lines.push('# TYPE rfid_http_request_duration_ms_sum counter');
    this.httpDurationSums.forEach((value, compositeKey) => {
      const [method, route] = compositeKey.split('|');
      lines.push(
        `rfid_http_request_duration_ms_sum{method="${escapePrometheusLabel(method ?? '')}",route="${escapePrometheusLabel(route ?? '')}"} ${value.toFixed(3)}`,
      );
    });

    lines.push('# HELP rfid_http_request_duration_ms_count Count of HTTP request durations in milliseconds.');
    lines.push('# TYPE rfid_http_request_duration_ms_count counter');
    this.httpDurationCounts.forEach((value, compositeKey) => {
      const [method, route] = compositeKey.split('|');
      lines.push(
        `rfid_http_request_duration_ms_count{method="${escapePrometheusLabel(method ?? '')}",route="${escapePrometheusLabel(route ?? '')}"} ${value}`,
      );
    });

    lines.push('# HELP rfid_http_5xx_total Total number of HTTP 5xx responses.');
    lines.push('# TYPE rfid_http_5xx_total counter');
    lines.push(`rfid_http_5xx_total ${this.http5xxTotal}`);

    lines.push('# HELP rfid_outbox_dispatch_failures_total Total number of outbox dispatch loop failures.');
    lines.push('# TYPE rfid_outbox_dispatch_failures_total counter');
    lines.push(`rfid_outbox_dispatch_failures_total ${this.outboxDispatchFailuresTotal}`);

    lines.push('# HELP rfid_outbox_webhook_failures_total Total number of failed webhook deliveries.');
    lines.push('# TYPE rfid_outbox_webhook_failures_total counter');
    lines.push(`rfid_outbox_webhook_failures_total ${this.outboxWebhookFailuresTotal}`);

    const uptimeSeconds = Math.max((Date.now() - this.startedAt) / 1000, 0);
    lines.push('# HELP rfid_process_uptime_seconds Backend process uptime in seconds.');
    lines.push('# TYPE rfid_process_uptime_seconds gauge');
    lines.push(`rfid_process_uptime_seconds ${uptimeSeconds.toFixed(3)}`);

    const memory = process.memoryUsage();
    lines.push('# HELP rfid_process_resident_memory_bytes Resident memory usage in bytes.');
    lines.push('# TYPE rfid_process_resident_memory_bytes gauge');
    lines.push(`rfid_process_resident_memory_bytes ${memory.rss}`);

    return `${lines.join('\n')}\n`;
  }

  private normalizePath(path: string): string {
    const [withoutQuery] = String(path).split('?');
    const withLeadingSlash = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
    const noTrailingSlash =
      withLeadingSlash.length > 1 && withLeadingSlash.endsWith('/')
        ? withLeadingSlash.slice(0, -1)
        : withLeadingSlash;

    return noTrailingSlash
      .toLowerCase()
      .replace(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?=\/|$)/g,
        '/:id',
      )
      .replace(/\/\d+(?=\/|$)/g, '/:id');
  }

  private statusClass(statusCode: number): string {
    if (statusCode < 100 || statusCode > 599) {
      return 'unknown';
    }
    return `${Math.floor(statusCode / 100)}xx`;
  }
}
