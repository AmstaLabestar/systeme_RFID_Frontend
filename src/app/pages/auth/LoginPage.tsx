import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useAuth } from '@/app/contexts';
import {
  isGoogleOAuthConfigured,
  isTwoFactorChallenge,
  type SignInTwoFactorChallenge,
} from '@/app/services';
import { AuthShell } from './AuthShell';

interface LoginFormValues {
  identifier: string;
  password: string;
}

interface LocationStateShape {
  from?: string;
  twoFactorChallenge?: unknown;
}

function resolveRedirectTarget(redirectTo: string, navigate: ReturnType<typeof useNavigate>) {
  if (/^https?:\/\//i.test(redirectTo)) {
    window.location.assign(redirectTo);
    return;
  }

  navigate(redirectTo, { replace: true });
}

function getLocationState(locationState: unknown): LocationStateShape {
  if (!locationState || typeof locationState !== 'object') {
    return {};
  }

  return locationState as LocationStateShape;
}

function GoogleLogoIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        d="M22.5 12.2c0-.8-.1-1.6-.2-2.3H12v4.4h5.9c-.3 1.4-1.1 2.5-2.3 3.3v2.8h3.7c2.2-2 3.2-4.9 3.2-8.2Z"
        fill="#4285F4"
      />
      <path
        d="M12 23c3 0 5.5-1 7.3-2.7l-3.7-2.8c-1 .7-2.3 1.2-3.6 1.2-2.8 0-5.1-1.9-5.9-4.4H2.3v2.9C4 20.7 7.7 23 12 23Z"
        fill="#34A853"
      />
      <path
        d="M6.1 14.3c-.2-.7-.3-1.5-.3-2.3 0-.8.1-1.6.3-2.3V6.8H2.3C1.5 8.3 1 10.1 1 12s.5 3.7 1.3 5.2l3.8-2.9Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.3c1.5 0 2.9.5 4 1.6l3-3C17.5 2.1 15 1 12 1 7.7 1 4 3.3 2.3 6.8l3.8 2.9c.8-2.5 3.1-4.4 5.9-4.4Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    isAuthenticated,
    signIn,
    verifySignInTwoFactor,
    startGoogleOAuth,
    requestMagicLink,
  } = useAuth();
  const isGoogleOAuthAvailable = isGoogleOAuthConfigured();
  const fieldWrapperClassName = 'flex w-full flex-col gap-1.5';
  const fieldLabelClassName = 'text-sm font-medium text-[var(--text-secondary)]';
  const fieldInputClassName = 'input input-bordered w-full bg-[var(--surface-muted)]';
  const fieldErrorClassName = 'min-h-4 text-xs text-[var(--error-main)]';
  const [isGoogleRedirecting, setIsGoogleRedirecting] = useState(false);
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [isVerifyingTwoFactor, setIsVerifyingTwoFactor] = useState(false);
  const locationState = getLocationState(location.state);
  const initialChallenge = isTwoFactorChallenge(locationState.twoFactorChallenge)
    ? locationState.twoFactorChallenge
    : null;
  const [twoFactorChallenge, setTwoFactorChallenge] = useState<SignInTwoFactorChallenge | null>(
    initialChallenge,
  );

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    defaultValues: {
      identifier: '',
      password: '',
    },
  });

  if (isAuthenticated) {
    return <Navigate to="/dashboard/overview" replace />;
  }

  const redirectPath = locationState.from || '/dashboard/overview';

  const onSubmit = async (values: LoginFormValues) => {
    try {
      const result = await signIn({
        ...values,
        redirectTo: redirectPath,
      });

      if (isTwoFactorChallenge(result)) {
        setTwoFactorChallenge(result);
        setTwoFactorCode('');
        toast.success('Authentification 2FA requise.');
        return;
      }

      toast.success('Connexion reussie.');
      resolveRedirectTarget(result.redirectTo || redirectPath, navigate);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible de se connecter.';
      toast.error(message);
    }
  };

  const onRequestMagicLink = async () => {
    const identifier = getValues('identifier')?.trim();
    if (!identifier || !identifier.includes('@')) {
      toast.error('Entrez une adresse email valide pour recevoir un Magic Link.');
      return;
    }

    try {
      setIsSendingMagicLink(true);
      const response = await requestMagicLink({
        email: identifier,
        redirectTo: redirectPath,
      });
      toast.success(response.message || 'Magic Link envoye.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible d envoyer le Magic Link.';
      toast.error(message);
    } finally {
      setIsSendingMagicLink(false);
    }
  };

  const onVerifyTwoFactor = async () => {
    if (!twoFactorChallenge) {
      return;
    }

    if (twoFactorCode.trim().length !== 6) {
      toast.error('Le code 2FA doit contenir 6 chiffres.');
      return;
    }

    try {
      setIsVerifyingTwoFactor(true);
      await verifySignInTwoFactor({
        twoFactorToken: twoFactorChallenge.twoFactorToken,
        code: twoFactorCode,
        redirectTo: twoFactorChallenge.redirectTo || redirectPath,
      });
      toast.success('Connexion 2FA reussie.');
      resolveRedirectTarget(twoFactorChallenge.redirectTo || redirectPath, navigate);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification 2FA impossible.';
      toast.error(message);
    } finally {
      setIsVerifyingTwoFactor(false);
    }
  };

  const onRestartLogin = () => {
    setTwoFactorChallenge(null);
    setTwoFactorCode('');
  };

  const onGoogleSignIn = () => {
    try {
      setIsGoogleRedirecting(true);
      startGoogleOAuth(redirectPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible de se connecter.';
      toast.error(message);
      setIsGoogleRedirecting(false);
    }
  };

  return (
    <AuthShell
      title="Connexion"
      subtitle={
        twoFactorChallenge
          ? 'Verification 2FA requise: entrez le code TOTP a 6 chiffres de votre application Authenticator.'
          : 'Accedez a la console de gestion des boitiers IoT et services digitaux.'
      }
      footerText="Pas encore de compte ?"
      footerLinkLabel="Creer un compte"
      footerLinkTo="/auth/register"
    >
      {twoFactorChallenge ? (
        <div className="grid gap-4">
          <label className={fieldWrapperClassName}>
            <span className={fieldLabelClassName}>Code 2FA (TOTP)</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              className={fieldInputClassName}
              placeholder="000000"
              value={twoFactorCode}
              onChange={(event) =>
                setTwoFactorCode(event.target.value.replace(/\D/g, '').slice(0, 6))
              }
            />
          </label>

          <button
            type="button"
            className="btn btn-info w-full text-[var(--app-bg)]"
            onClick={() => void onVerifyTwoFactor()}
            disabled={isVerifyingTwoFactor}
          >
            {isVerifyingTwoFactor ? 'Verification...' : 'Valider la double authentification'}
          </button>

          <button
            type="button"
            className="btn btn-outline w-full"
            onClick={onRestartLogin}
            disabled={isVerifyingTwoFactor}
          >
            Revenir a la connexion
          </button>
        </div>
      ) : (
        <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
          <label className={fieldWrapperClassName}>
            <span className={fieldLabelClassName}>Email ou telephone</span>
            <input
              type="text"
              className={fieldInputClassName}
              placeholder="email@exemple.com ou +2250700000000"
              {...register('identifier', { required: 'Identifiant requis' })}
            />
            <span className={fieldErrorClassName}>{errors.identifier?.message ?? ''}</span>
          </label>

          <label className={fieldWrapperClassName}>
            <span className={fieldLabelClassName}>Mot de passe</span>
            <input
              type="password"
              className={fieldInputClassName}
              placeholder="********"
              {...register('password', { required: 'Mot de passe requis', minLength: 8 })}
            />
            <span className={fieldErrorClassName}>
              {errors.password ? 'Mot de passe invalide.' : ''}
            </span>
          </label>

          <button
            type="submit"
            className="btn btn-info w-full text-[var(--app-bg)]"
            disabled={isSubmitting || isGoogleRedirecting || isSendingMagicLink}
          >
            {isSubmitting ? 'Connexion...' : 'Se connecter'}
          </button>

          <button
            type="button"
            className="btn btn-outline w-full"
            disabled={isSubmitting || isGoogleRedirecting || isSendingMagicLink}
            onClick={() => void onRequestMagicLink()}
          >
            {isSendingMagicLink ? 'Envoi du Magic Link...' : 'Envoyer un Magic Link'}
          </button>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-[var(--border-soft)]" />
            <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">
              ou
            </span>
            <span className="h-px flex-1 bg-[var(--border-soft)]" />
          </div>

          <div className="grid gap-3">
            {isGoogleOAuthAvailable ? (
              <button
                type="button"
                className="btn btn-outline w-full gap-2"
                disabled={isSubmitting || isGoogleRedirecting || isSendingMagicLink}
                onClick={onGoogleSignIn}
              >
                <GoogleLogoIcon />
                {isGoogleRedirecting ? 'Redirection Google...' : 'Continuer avec Google'}
              </button>
            ) : null}
          </div>
        </form>
      )}

      <p className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-3 text-xs text-[var(--text-secondary)]">
        Cette version utilise un 2FA TOTP standard (application Authenticator) apres la connexion.
      </p>
    </AuthShell>
  );
}
