import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useAuth } from '@/app/contexts';
import { isGoogleOAuthConfigured } from '@/app/services';
import { AuthShell } from './AuthShell';

interface RegisterFormValues {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phoneNumber?: string;
  password: string;
  confirmPassword: string;
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

export function RegisterPage() {
  const navigate = useNavigate();
  const { isAuthenticated, signUp, startGoogleOAuth } = useAuth();
  const isGoogleOAuthAvailable = isGoogleOAuthConfigured();
  const fieldWrapperClassName = 'flex w-full flex-col gap-1.5';
  const fieldLabelClassName = 'text-sm font-medium text-[var(--text-secondary)]';
  const fieldInputClassName = 'input input-bordered w-full bg-[var(--surface-muted)]';
  const fieldErrorClassName = 'min-h-4 text-xs text-[var(--error-main)]';
  const [isGoogleRedirecting, setIsGoogleRedirecting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>();

  if (isAuthenticated) {
    return <Navigate to="/dashboard/overview" replace />;
  }

  const passwordValue = watch('password');

  const onSubmit = async (values: RegisterFormValues) => {
    try {
      await signUp({
        firstName: values.firstName,
        lastName: values.lastName,
        company: values.company,
        email: values.email,
        password: values.password,
        phoneNumber: values.phoneNumber,
      });
      toast.success('Compte cree, bienvenue.');
      navigate('/dashboard/overview', { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible de creer ce compte.';
      toast.error(message);
    }
  };

  const onGoogleSignIn = () => {
    try {
      setIsGoogleRedirecting(true);
      startGoogleOAuth('/dashboard/overview');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible de se connecter.';
      toast.error(message);
      setIsGoogleRedirecting(false);
    }
  };

  return (
    <AuthShell
      title="Inscription"
      subtitle="Creez votre espace pour gerer vos service."
      footerText="Vous avez deja un compte ?"
      footerLinkLabel="Se connecter"
      footerLinkTo="/auth/login"
    >
      <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className={fieldWrapperClassName}>
            <span className={fieldLabelClassName}>Prenom</span>
            <input
              className={fieldInputClassName}
              {...register('firstName', { required: 'Prenom requis' })}
            />
            <span className={fieldErrorClassName}>{errors.firstName?.message ?? ''}</span>
          </label>

          <label className={fieldWrapperClassName}>
            <span className={fieldLabelClassName}>Nom</span>
            <input
              className={fieldInputClassName}
              {...register('lastName', { required: 'Nom requis' })}
            />
            <span className={fieldErrorClassName}>{errors.lastName?.message ?? ''}</span>
          </label>
        </div>

        <label className={fieldWrapperClassName}>
          <span className={fieldLabelClassName}>Entreprise</span>
          <input
            className={fieldInputClassName}
            {...register('company', { required: 'Entreprise requise' })}
          />
          <span className={fieldErrorClassName}>{errors.company?.message ?? ''}</span>
        </label>

        <label className={fieldWrapperClassName}>
          <span className={fieldLabelClassName}>Email</span>
          <input
            type="email"
            className={fieldInputClassName}
            {...register('email', { required: 'Email requis' })}
          />
          <span className={fieldErrorClassName}>{errors.email?.message ?? ''}</span>
        </label>

        <label className={fieldWrapperClassName}>
          <span className={fieldLabelClassName}>Numero de telephone (optionnel)</span>
          <input
            type="tel"
            className={fieldInputClassName}
            placeholder="+22670000000"
            {...register('phoneNumber', {
              pattern: {
                value: /^\+?[1-9]\d{7,11}$/,
                message: 'Format international invalide',
              },
            })}
          />
          <span className={fieldErrorClassName}>{errors.phoneNumber?.message ?? ''}</span>
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className={fieldWrapperClassName}>
            <span className={fieldLabelClassName}>Mot de passe</span>
            <input
              type="password"
              className={fieldInputClassName}
              {...register('password', {
                required: 'Mot de passe requis',
                minLength: {
                  value: 8,
                  message: '8 caracteres minimum',
                },
              })}
            />
            <span className={fieldErrorClassName}>{errors.password?.message ?? ''}</span>
          </label>

          <label className={fieldWrapperClassName}>
            <span className={fieldLabelClassName}>Confirmer</span>
            <input
              type="password"
              className={fieldInputClassName}
              {...register('confirmPassword', {
                required: 'Confirmation requise',
                validate: (value) => value === passwordValue || 'Mots de passe differents',
              })}
            />
            <span className={fieldErrorClassName}>{errors.confirmPassword?.message ?? ''}</span>
          </label>
        </div>

        <button
          type="submit"
          className="btn btn-info mt-2 w-full text-[var(--app-bg)]"
          disabled={isSubmitting || isGoogleRedirecting}
        >
          {isSubmitting ? 'Creation...' : 'Creer mon compte'}
        </button>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-[var(--border-soft)]" />
          <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">ou</span>
          <span className="h-px flex-1 bg-[var(--border-soft)]" />
        </div>

        <div className="grid gap-3">
          {isGoogleOAuthAvailable ? (
            <button
              type="button"
              className="btn btn-outline w-full gap-2"
              disabled={isSubmitting || isGoogleRedirecting}
              onClick={onGoogleSignIn}
            >
              <GoogleLogoIcon />
              {isGoogleRedirecting ? 'Redirection Google...' : 'Continuer avec Google'}
            </button>
          ) : null}
        </div>
      </form>
    </AuthShell>
  );
}
