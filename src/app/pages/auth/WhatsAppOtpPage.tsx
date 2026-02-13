import { useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/app/contexts';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/app/shared/ui/input-otp';
import { AuthShell } from './AuthShell';

function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, '');
}

function isValidPhone(phone: string): boolean {
  return /^\+?[1-9]\d{7,14}$/.test(phone);
}

export function WhatsAppOtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, requestWhatsAppOtp, verifyWhatsAppOtp } = useAuth();
  const [phone, setPhone] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const redirectPath =
    typeof location.state === 'object' && location.state && 'from' in location.state
      ? String((location.state as { from?: string }).from ?? '/dashboard/overview')
      : '/dashboard/overview';

  const normalizedPhone = useMemo(() => normalizePhone(phone), [phone]);

  if (isAuthenticated) {
    return <Navigate to="/dashboard/overview" replace />;
  }

  const onRequestOtp = async () => {
    if (!isValidPhone(normalizedPhone)) {
      toast.error('Entrez un numero WhatsApp valide au format international (ex: +2250700000000).');
      return;
    }

    try {
      setIsRequesting(true);
      const response = await requestWhatsAppOtp({ phone: normalizedPhone });
      setRequestId(response.requestId);
      setOtpCode('');
      setDebugCode(response.debugCode ?? null);
      toast.success('Code OTP envoye sur WhatsApp.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible d envoyer le code OTP.';
      toast.error(message);
    } finally {
      setIsRequesting(false);
    }
  };

  const onVerifyOtp = async () => {
    if (!requestId) {
      toast.error('Demandez d abord un code OTP.');
      return;
    }

    if (otpCode.length !== 6) {
      toast.error('Le code OTP doit contenir 6 chiffres.');
      return;
    }

    try {
      setIsVerifying(true);
      await verifyWhatsAppOtp({
        requestId,
        phone: normalizedPhone,
        code: otpCode,
      });
      toast.success('Connexion WhatsApp reussie.');
      navigate(redirectPath, { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Code OTP invalide.';
      toast.error(message);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <AuthShell
      title="Connexion WhatsApp"
      subtitle="Recevez un code OTP sur WhatsApp puis validez la connexion."
      footerText="Vous preferez une autre methode ?"
      footerLinkLabel="Retour connexion"
      footerLinkTo="/auth/login"
    >
      <div className="grid gap-4">
        <label className="flex w-full flex-col gap-1.5">
          <span className="text-sm font-medium text-[var(--text-secondary)]">Numero WhatsApp</span>
          <input
            type="tel"
            className="input input-bordered w-full bg-[var(--surface-muted)]"
            placeholder="+2250700000000"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            disabled={isRequesting || isVerifying}
          />
          <span className="text-xs text-[var(--text-secondary)]">Format international requis.</span>
        </label>

        <button
          type="button"
          className="btn btn-outline w-full"
          onClick={() => void onRequestOtp()}
          disabled={isRequesting || isVerifying}
        >
          {isRequesting ? 'Envoi du code...' : requestId ? 'Renvoyer le code OTP' : 'Recevoir mon code OTP'}
        </button>

        {requestId ? (
          <div className="grid gap-4 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
            <p className="text-sm text-[var(--text-secondary)]">Saisissez le code a 6 chiffres recu par WhatsApp.</p>

            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={otpCode}
                onChange={(value) => setOtpCode(value.replace(/\D/g, ''))}
                containerClassName="justify-center"
                disabled={isVerifying}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            {debugCode ? (
              <p className="rounded-lg border border-[var(--border-soft)] bg-[var(--app-bg)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                Code mock (dev): <span className="font-semibold text-[var(--text-primary)]">{debugCode}</span>
              </p>
            ) : null}

            <button
              type="button"
              className="btn btn-info w-full text-[var(--app-bg)]"
              onClick={() => void onVerifyOtp()}
              disabled={isVerifying || otpCode.length !== 6}
            >
              {isVerifying ? 'Verification...' : 'Verifier et se connecter'}
            </button>
          </div>
        ) : null}
      </div>
    </AuthShell>
  );
}
