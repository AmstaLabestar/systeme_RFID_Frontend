import { FormEvent, useState } from 'react';
import { useParams } from 'react-router-dom';
import { publicFeedbackService, type PublicFeedbackValue } from '@/app/services';

const FEEDBACK_OPTIONS: Array<{
  value: PublicFeedbackValue;
  label: string;
  icon: string;
  selectedClassName: string;
}> = [
  {
    value: 'NEGATIVE',
    label: 'Negatif',
    icon: ':-(',
    selectedClassName: 'border-[var(--error-main)] bg-[var(--error-main)]/15 text-[var(--error-main)]',
  },
  {
    value: 'NEUTRAL',
    label: 'Neutre',
    icon: ':-|',
    selectedClassName: 'border-[var(--warning-main)] bg-[var(--warning-main)]/15 text-[var(--warning-main)]',
  },
  {
    value: 'POSITIVE',
    label: 'Positif',
    icon: ':-)',
    selectedClassName: 'border-[var(--success-main)] bg-[var(--success-main)]/15 text-[var(--success-main)]',
  },
];

const COMMENT_MAX_LENGTH = 280;

export function PublicFeedbackPage() {
  const { qrToken } = useParams<{ qrToken: string }>();
  const [selectedValue, setSelectedValue] = useState<PublicFeedbackValue | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const normalizedToken = String(qrToken || '').trim();
  const hasValidToken = normalizedToken.length > 0;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!hasValidToken || !selectedValue) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await publicFeedbackService.submitByQrToken(normalizedToken, {
        value: selectedValue,
        comment,
      });
      setIsSubmitted(true);
      setSelectedValue(null);
      setComment('');
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Impossible d envoyer votre feedback. Veuillez reessayer.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--app-bg)] px-4 py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(0,191,255,0.2),transparent_50%),radial-gradient(circle_at_bottom_right,_rgba(0,230,118,0.12),transparent_45%)]" />

      <main className="relative w-full max-w-md">
        <section className="card border border-[var(--border-soft)] bg-[var(--card-bg)] shadow-2xl shadow-black/30">
          <div className="card-body gap-5 p-6 sm:p-8">
            <header className="space-y-2 text-center">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">Feedback Client</p>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Votre avis nous interesse</h1>
              <p className="text-sm text-[var(--text-secondary)]">
                Choisissez une note et laissez un commentaire si vous le souhaitez.
              </p>
            </header>

            {!hasValidToken ? (
              <article className="rounded-lg border border-[var(--error-main)]/40 bg-[var(--error-main)]/10 p-4 text-sm text-[var(--error-main)]">
                Lien de feedback invalide.
              </article>
            ) : isSubmitted ? (
              <article className="space-y-4 rounded-lg border border-[var(--success-main)]/40 bg-[var(--success-main)]/10 p-5 text-center">
                <p className="text-3xl font-bold text-[var(--success-main)]">OK</p>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Merci pour votre retour.</h2>
                <p className="text-sm text-[var(--text-secondary)]">Votre feedback a bien ete enregistre.</p>
                <button type="button" className="btn btn-outline btn-success w-full" onClick={() => setIsSubmitted(false)}>
                  Envoyer un autre feedback
                </button>
              </article>
            ) : (
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="grid grid-cols-3 gap-2">
                  {FEEDBACK_OPTIONS.map((option) => {
                    const isSelected = selectedValue === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`rounded-xl border px-2 py-3 text-center transition ${isSelected ? option.selectedClassName : 'border-[var(--border-soft)] bg-[var(--surface-muted)] text-[var(--text-primary)]'}`}
                        onClick={() => setSelectedValue(option.value)}
                        aria-pressed={isSelected}
                      >
                        <span className="block text-xl font-mono">{option.icon}</span>
                        <span className="mt-1 block text-xs font-semibold">{option.label}</span>
                      </button>
                    );
                  })}
                </div>

                <label className="form-control">
                  <span className="label-text text-xs text-[var(--text-secondary)]">Commentaire (optionnel)</span>
                  <textarea
                    className="textarea textarea-bordered mt-1 h-28 bg-[var(--surface-muted)]"
                    maxLength={COMMENT_MAX_LENGTH}
                    placeholder="Dites-nous ce que nous pouvons ameliorer..."
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                  />
                  <span className="mt-1 text-right text-xs text-[var(--text-secondary)]">
                    {comment.length}/{COMMENT_MAX_LENGTH}
                  </span>
                </label>

                {errorMessage ? (
                  <p className="rounded-md border border-[var(--error-main)]/40 bg-[var(--error-main)]/10 p-3 text-sm text-[var(--error-main)]">
                    {errorMessage}
                  </p>
                ) : null}

                <button type="submit" className="btn btn-info w-full text-[var(--app-bg)]" disabled={!selectedValue || isSubmitting}>
                  {isSubmitting ? 'Envoi...' : 'Envoyer mon feedback'}
                </button>
              </form>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
