import { Download, X } from 'lucide-react';
import { formatDateTime } from '@/app/services';

export interface DeviceHistoryDialogEntry {
  id: string;
  occurredAt: string;
  actor: string;
  identifier: string;
  action: string;
}

interface DeviceHistoryDialogProps {
  moduleLabel: string;
  deviceName: string;
  deviceId: string;
  systemIdentifier?: string;
  identifierLabel?: string;
  entries: DeviceHistoryDialogEntry[];
  onClose: () => void;
  onDownloadPdf: () => void;
}

export function DeviceHistoryDialog({
  moduleLabel,
  deviceName,
  deviceId,
  systemIdentifier,
  identifierLabel = 'Identifiant',
  entries,
  onClose,
  onDownloadPdf,
}: DeviceHistoryDialogProps) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
      <div className="card h-[80vh] w-full max-w-5xl border border-[var(--border-soft)] bg-[var(--card-bg)] shadow-2xl">
        <div className="card-body gap-4 p-4 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-[var(--text-secondary)]">{moduleLabel}</p>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">{deviceName}</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                ID: <span className="font-mono">{deviceId}</span> | MAC:{' '}
                <span className="font-mono">{systemIdentifier ?? 'N/A'}</span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button type="button" className="btn btn-outline btn-info btn-sm" onClick={onDownloadPdf}>
                <Download className="h-4 w-4" />
                PDF
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto rounded-xl border border-[var(--border-soft)]">
            <table className="table">
              <thead>
                <tr>
                  <th>Date / Heure</th>
                  <th>Acteur</th>
                  <th>{identifierLabel}</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center text-sm text-[var(--text-secondary)]">
                      Aucun evenement enregistre pour ce boitier.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDateTime(entry.occurredAt)}</td>
                      <td>{entry.actor}</td>
                      <td className="font-mono text-[var(--accent-primary)]">{entry.identifier}</td>
                      <td>{entry.action}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
