import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/app/contexts';
import { isTwoFactorChallenge } from '@/app/services';
import { AuthShell } from './AuthShell';

export function MagicLinkCallbackPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, completeMagicLink } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasProcessedRef = useRef(false);

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const token = searchParams.get('token');
  const redirectTo = searchParams.get('redirectTo') || undefined;

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard/overview', { replace: true });
      return;
    }

    if (hasProcessedRef.current) {
      return;
    }
    hasProcessedRef.current = true;

    if (!token) {
      setErrorMessage('Token Magic Link manquant.');
      return;
    }

    void (async () => {
      try {
        const result = await completeMagicLink({ token, redirectTo });
        if (isTwoFactorChallenge(result)) {
          toast.success('Magic Link valide. Verification 2FA requise.');
          navigate('/auth/login', {
            replace: true,
            state: {
              from: result.redirectTo || '/dashboard/overview',
              twoFactorChallenge: result,
            },
          });
          return;
        }

        const target = result.redirectTo || '/dashboard/overview';
        toast.success('Connexion via Magic Link reussie.');

        if (/^https?:\/\//i.test(target)) {
          window.location.assign(target);
          return;
        }

        navigate(target, { replace: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Magic Link invalide ou expire.';
        setErrorMessage(message);
        toast.error(message);
      }
    })();
  }, [completeMagicLink, isAuthenticated, navigate, redirectTo, token]);

  return (
    <AuthShell
      title="Magic Link"
      subtitle="Verification du lien de connexion..."
      footerText="Retourner a la connexion classique ?"
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
