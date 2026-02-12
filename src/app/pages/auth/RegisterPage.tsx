import { Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useAuth } from '@/app/contexts';
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
  const { isAuthenticated, signUp } = useAuth();

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
          <label className="form-control">
            <span className="label-text text-[var(--text-secondary)]">Prenom</span>
            <input
              className="input input-bordered mt-1 bg-[var(--surface-muted)]"
              {...register('firstName', { required: 'Prenom requis' })}
            />
            {errors.firstName ? (
              <span className="mt-1 text-xs text-[var(--error-main)]">{errors.firstName.message}</span>
            ) : null}
          </label>

          <label className="form-control">
            <span className="label-text text-[var(--text-secondary)]">Nom</span>
            <input
              className="input input-bordered mt-1 bg-[var(--surface-muted)]"
              {...register('lastName', { required: 'Nom requis' })}
            />
            {errors.lastName ? (
              <span className="mt-1 text-xs text-[var(--error-main)]">{errors.lastName.message}</span>
            ) : null}
          </label>
        </div>

        <label className="form-control">
          <span className="label-text text-[var(--text-secondary)]">Entreprise</span>
          <input
            className="input input-bordered mt-1 bg-[var(--surface-muted)]"
            {...register('company', { required: 'Entreprise requise' })}
          />
          {errors.company ? (
            <span className="mt-1 text-xs text-[var(--error-main)]">{errors.company.message}</span>
          ) : null}
        </label>

        <label className="form-control">
          <span className="label-text text-[var(--text-secondary)]">Email</span>
          <input
            type="email"
            className="input input-bordered mt-1 bg-[var(--surface-muted)]"
            {...register('email', { required: 'Email requis' })}
          />
          {errors.email ? <span className="mt-1 text-xs text-[var(--error-main)]">{errors.email.message}</span> : null}
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="form-control">
            <span className="label-text text-[var(--text-secondary)]">Mot de passe</span>
            <input
              type="password"
              className="input input-bordered mt-1 bg-[var(--surface-muted)]"
              {...register('password', {
                required: 'Mot de passe requis',
                minLength: {
                  value: 8,
                  message: '8 caracteres minimum',
                },
              })}
            />
            {errors.password ? (
              <span className="mt-1 text-xs text-[var(--error-main)]">{errors.password.message}</span>
            ) : null}
          </label>

          <label className="form-control">
            <span className="label-text text-[var(--text-secondary)]">Confirmer</span>
            <input
              type="password"
              className="input input-bordered mt-1 bg-[var(--surface-muted)]"
              {...register('confirmPassword', {
                required: 'Confirmation requise',
                validate: (value) => value === passwordValue || 'Mots de passe differents',
              })}
            />
            {errors.confirmPassword ? (
              <span className="mt-1 text-xs text-[var(--error-main)]">{errors.confirmPassword.message}</span>
            ) : null}
          </label>
        </div>

        <button type="submit" className="btn btn-info mt-2 w-full text-[var(--app-bg)]" disabled={isSubmitting}>
          {isSubmitting ? 'Creation...' : 'Creer mon compte'}
        </button>
      </form>
    </AuthShell>
  );
}
