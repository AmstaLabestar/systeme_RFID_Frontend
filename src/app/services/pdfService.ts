import { jsPDF } from 'jspdf';

export interface DeviceHistoryPdfEntry {
  occurredAt: string;
  actor: string;
  identifier: string;
  action: string;
}

export interface DeviceHistoryPdfPayload {
  moduleLabel: string;
  deviceName: string;
  deviceId: string;
  systemIdentifier?: string;
  generatedAt: string;
  entries: DeviceHistoryPdfEntry[];
}

function formatDateTimeForPdf(isoDate: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(isoDate));
}

function normalizeFileName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function ensureLineSpace(doc: jsPDF, y: number, extra = 6): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + extra <= pageHeight - 10) {
    return y;
  }

  doc.addPage();
  return 14;
}

export function downloadDeviceHistoryPdf(payload: DeviceHistoryPdfPayload): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const left = 12;
  const maxWidth = 186;
  let y = 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`Historique boitier - ${payload.moduleLabel}`, left, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Boitier: ${payload.deviceName}`, left, y);
  y += 5;
  doc.text(`ID boitier: ${payload.deviceId}`, left, y);
  y += 5;
  doc.text(`Adresse MAC: ${payload.systemIdentifier ?? 'N/A'}`, left, y);
  y += 5;
  doc.text(`Genere le: ${formatDateTimeForPdf(payload.generatedAt)}`, left, y);
  y += 8;

  if (payload.entries.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.text('Aucun evenement enregistre pour ce boitier.', left, y);
  } else {
    payload.entries.forEach((entry, index) => {
      y = ensureLineSpace(doc, y, 12);
      const line = `${index + 1}. ${formatDateTimeForPdf(entry.occurredAt)} | ${entry.actor} | ${entry.identifier} | ${entry.action}`;
      const wrapped = doc.splitTextToSize(line, maxWidth);

      doc.setFont('helvetica', 'normal');
      doc.text(wrapped, left, y);
      y += wrapped.length * 5 + 1;
    });
  }

  const fileNameSuffix = normalizeFileName(payload.deviceName || payload.deviceId || 'boitier');
  doc.save(`historique-${fileNameSuffix}.pdf`);
}
