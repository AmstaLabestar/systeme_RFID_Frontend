import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  it('records HTTP metrics with normalized paths and status classes', () => {
    const service = new MetricsService();

    service.recordHttpRequest({
      method: 'get',
      path: '/Orders/550e8400-e29b-41d4-a716-446655440000/items/42?expand=true',
      statusCode: 200,
      durationMs: 12.345,
    });
    service.recordHttpRequest({
      method: 'POST',
      path: '/orders/42',
      statusCode: 503,
      durationMs: 8,
    });

    const metrics = service.renderPrometheus();

    expect(metrics).toContain(
      'rfid_http_requests_total{method="GET",route="/orders/:id/items/:id",status_class="2xx"} 1',
    );
    expect(metrics).toContain(
      'rfid_http_requests_total{method="POST",route="/orders/:id",status_class="5xx"} 1',
    );
    expect(metrics).toContain(
      'rfid_http_request_duration_ms_sum{method="GET",route="/orders/:id/items/:id"} 12.345',
    );
    expect(metrics).toContain(
      'rfid_http_request_duration_ms_sum{method="POST",route="/orders/:id"} 8.000',
    );
    expect(metrics).toContain('rfid_http_5xx_total 1');
  });

  it('records outbox failure counters', () => {
    const service = new MetricsService();

    service.recordOutboxDispatchFailure();
    service.recordOutboxWebhookFailure();
    service.recordOutboxWebhookFailure();

    const metrics = service.renderPrometheus();

    expect(metrics).toContain('rfid_outbox_dispatch_failures_total 1');
    expect(metrics).toContain('rfid_outbox_webhook_failures_total 2');
  });

  it('records device ingestion and dispatch counters', () => {
    const service = new MetricsService();

    service.recordDeviceIngestionAccepted();
    service.recordDeviceIngestionDuplicate();
    service.recordDeviceIngestionRejected();
    service.recordDeviceIngestionAuthFailure();
    service.recordDeviceDispatchProcessed();
    service.recordDeviceDispatchProcessed(2);
    service.recordDeviceDispatchFailure();

    const metrics = service.renderPrometheus();

    expect(metrics).toContain('rfid_device_ingestion_events_accepted_total 1');
    expect(metrics).toContain('rfid_device_ingestion_events_duplicate_total 1');
    expect(metrics).toContain('rfid_device_ingestion_events_rejected_total 1');
    expect(metrics).toContain('rfid_device_ingestion_auth_failures_total 1');
    expect(metrics).toContain('rfid_device_dispatch_processed_total 3');
    expect(metrics).toContain('rfid_device_dispatch_failures_total 1');
  });
});
