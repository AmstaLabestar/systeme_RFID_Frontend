import { Toaster } from 'sonner';
import { AppProviders } from '@/app/providers';
import { AppRouter } from '@/app/router';

export default function App() {
  return (
    <AppProviders>
      <AppRouter />
      <Toaster
        richColors
        closeButton
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--card-bg)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-soft)',
          },
        }}
      />
    </AppProviders>
  );
}
