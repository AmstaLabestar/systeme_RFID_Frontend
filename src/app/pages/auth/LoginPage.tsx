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
  const { isAuthenticated, signIn } = useAuth();

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

  return (
    <AuthShell
      title="Connexion"
      subtitle="Accedez a la console de gestion des boitiers IoT et services digitaux."
      footerText="Pas encore de compte ?"
      footerLinkLabel="Creer un compte"
      footerLinkTo="/auth/register"
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <label className="form-control">
          <span className="label-text text-[var(--text-secondary)]">Email</span>
          <input
            type="email"
            className="input input-bordered mt-1 bg-[var(--surface-muted)]"
            placeholder="admin@techsouveraine.io"
            {...register('email', { required: 'Email requis' })}
          />
          {errors.email ? <span className="mt-1 text-xs text-[var(--error-main)]">{errors.email.message}</span> : null}
        </label>

        <label className="form-control">
          <span className="label-text text-[var(--text-secondary)]">Mot de passe</span>
          <input
            type="password"
            className="input input-bordered mt-1 bg-[var(--surface-muted)]"
            placeholder="********"
            {...register('password', { required: 'Mot de passe requis', minLength: 6 })}
          />
          {errors.password ? (
            <span className="mt-1 text-xs text-[var(--error-main)]">Mot de passe invalide.</span>
          ) : null}
        </label>

        <button type="submit" className="btn btn-info w-full text-[var(--app-bg)]" disabled={isSubmitting}>
          {isSubmitting ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>

      <p className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-3 text-xs text-[var(--text-secondary)]">
        Compte demo: admin@techsouveraine.io / demo12345
      </p>
    </AuthShell>
  );
}
