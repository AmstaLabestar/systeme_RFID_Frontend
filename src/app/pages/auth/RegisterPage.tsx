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
  password: string;
  confirmPassword: string;
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

  const onWhatsAppSignIn = () => {
    navigate('/auth/whatsapp', {
      state: {
        from: '/dashboard/overview',
      },
    });
  };

  return (
    <AuthShell
      title="Inscription"
      subtitle="Creez votre espace SaaS pour centraliser vos acces IoT."
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

        <div className={`grid gap-3 ${isGoogleOAuthAvailable ? 'sm:grid-cols-2' : ''}`}>
          {isGoogleOAuthAvailable ? (
            <button
              type="button"
              className="btn btn-outline w-full"
              disabled={isSubmitting || isGoogleRedirecting}
              onClick={onGoogleSignIn}
            >
              {isGoogleRedirecting ? 'Redirection Google...' : 'Continuer avec Google'}
            </button>
          ) : null}
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
    </AuthShell>
  );
}
