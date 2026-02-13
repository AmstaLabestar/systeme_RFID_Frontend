import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/app/contexts';
import { AuthShell } from './AuthShell';

function getHashParams(hash: string): URLSearchParams {
  return new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
}

export function GoogleCallbackPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, completeGoogleOAuth } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasProcessedRef = useRef(false);

  const hashParams = useMemo(() => getHashParams(location.hash), [location.hash]);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard/overview', { replace: true });
      return;
    }

    if (hasProcessedRef.current) {
      return;
    }
    hasProcessedRef.current = true;

    const providerError = hashParams.get('error') || searchParams.get('error');
    const idToken = hashParams.get('id_token') || searchParams.get('id_token');
    const state = hashParams.get('state') || searchParams.get('state');

    if (providerError) {
      setErrorMessage(`Connexion Google annulee (${providerError}).`);
      return;
    }

    if (!idToken || !state) {
      setErrorMessage('Reponse OAuth Google incomplete.');
      return;
    }

    void (async () => {
      try {
        const redirectTo = await completeGoogleOAuth({ idToken, state });
        toast.success('Connexion Google reussie.');
        navigate(redirectTo, { replace: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Impossible de finaliser la connexion Google.';
        setErrorMessage(message);
        toast.error(message);
      }
    })();
  }, [completeGoogleOAuth, hashParams, isAuthenticated, navigate, searchParams]);

  return (
    <AuthShell
      title="Callback Google"
      subtitle="Finalisation de la connexion OAuth..."
      footerText="Retourner au formulaire classique ?"
      footerLinkLabel="Connexion email"
      footerLinkTo="/auth/login"
    >
      {errorMessage ? (
        <div className="grid gap-4">
          <p className="rounded-xl border border-[var(--error-main)]/40 bg-[var(--error-main)]/10 px-4 py-3 text-sm text-[var(--error-main)]">
            {errorMessage}
          </p>
          <Link className="btn btn-outline w-full" to="/auth/login">
            Revenir a la connexion
          </Link>
        </div>
      ) : (
        <div className="flex items-center justify-center py-6">
          <span className="loading loading-spinner loading-lg text-info" />
        </div>
      )}
    </AuthShell>
  );
}
