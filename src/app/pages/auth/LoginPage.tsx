import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useAuth } from '@/app/contexts';
import { AuthShell } from './AuthShell';

interface LoginFormValues {
  email: string;
  password: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, signIn, startGoogleOAuth } = useAuth();
  const fieldWrapperClassName = 'flex w-full flex-col gap-1.5';
  const fieldLabelClassName = 'text-sm font-medium text-[var(--text-secondary)]';
  const fieldInputClassName = 'input input-bordered w-full bg-[var(--surface-muted)]';
  const fieldErrorClassName = 'min-h-4 text-xs text-[var(--error-main)]';
  const [isGoogleRedirecting, setIsGoogleRedirecting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    defaultValues: {
      email: 'admin@techsouveraine.io',
      password: 'demo12345',
    },
  });

  if (isAuthenticated) {
    return <Navigate to="/dashboard/overview" replace />;
  }

  const redirectPath =
    typeof location.state === 'object' && location.state && 'from' in location.state
      ? String((location.state as { from?: string }).from ?? '/dashboard/overview')
      : '/dashboard/overview';

  const onSubmit = async (values: LoginFormValues) => {
    try {
      await signIn(values);
      toast.success('Connexion reussie');
      navigate(redirectPath, { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible de se connecter.';
      toast.error(message);
    }
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

  const onWhatsAppSignIn = () => {
    navigate('/auth/whatsapp', {
      state: {
        from: redirectPath,
      },
    });
  };

  return (
    <AuthShell
      title="Connexion"
      subtitle="Accedez a la console de gestion des boitiers IoT et services digitaux."
      footerText="Pas encore de compte ?"
      footerLinkLabel="Creer un compte"
      footerLinkTo="/auth/register"
    >
      <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
        <label className={fieldWrapperClassName}>
          <span className={fieldLabelClassName}>Email</span>
          <input
            type="email"
            className={fieldInputClassName}
            placeholder="admin@techsouveraine.io"
            {...register('email', { required: 'Email requis' })}
          />
          <span className={fieldErrorClassName}>{errors.email?.message ?? ''}</span>
        </label>

        <label className={fieldWrapperClassName}>
          <span className={fieldLabelClassName}>Mot de passe</span>
          <input
            type="password"
            className={fieldInputClassName}
            placeholder="********"
            {...register('password', { required: 'Mot de passe requis', minLength: 6 })}
          />
          <span className={fieldErrorClassName}>{errors.password ? 'Mot de passe invalide.' : ''}</span>
        </label>

        <button
          type="submit"
          className="btn btn-info w-full text-[var(--app-bg)]"
          disabled={isSubmitting || isGoogleRedirecting}
        >
          {isSubmitting ? 'Connexion...' : 'Se connecter'}
        </button>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-[var(--border-soft)]" />
          <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">ou</span>
          <span className="h-px flex-1 bg-[var(--border-soft)]" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            className="btn btn-outline w-full"
            disabled={isSubmitting || isGoogleRedirecting}
            onClick={onGoogleSignIn}
          >
            {isGoogleRedirecting ? 'Redirection Google...' : 'Continuer avec Google'}
          </button>
          <button
            type="button"
            className="btn btn-outline w-full"
            disabled={isSubmitting || isGoogleRedirecting}
            onClick={onWhatsAppSignIn}
          >
            Continuer avec WhatsApp
          </button>
        </div>
      </form>

      <p className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-3 text-xs text-[var(--text-secondary)]">
        Compte demo: admin@techsouveraine.io / demo12345
      </p>
    </AuthShell>
  );
}
