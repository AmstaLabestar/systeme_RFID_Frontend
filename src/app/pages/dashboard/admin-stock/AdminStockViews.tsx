import { ImportsSection } from './sections/ImportsSection';
import { LogsSection } from './sections/LogsSection';
import { StockAlertsSection } from './sections/StockAlertsSection';
import { StockSection } from './sections/StockSection';
import { WebhooksSection } from './sections/WebhooksSection';

export function AdminStockAllView() {
  return (
    <>
      <StockAlertsSection />
      <ImportsSection />
      <StockSection />
      <LogsSection />
      <WebhooksSection />
    </>
  );
}

export function AdminStockStockView() {
  return (
    <>
      <StockAlertsSection />
      <StockSection />
    </>
  );
}

export function AdminStockImportsView() {
  return <ImportsSection />;
}

export function AdminStockWebhooksView() {
  return <WebhooksSection />;
}

export function AdminStockLogsView() {
  return <LogsSection />;
}
