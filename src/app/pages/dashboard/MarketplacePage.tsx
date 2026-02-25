import { AlertTriangle, CheckCircle2, ShoppingBag } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MODULE_LABEL_KEYS, MODULE_PATHS } from '@/app/data';
import { useI18n, useMarketplace } from '@/app/contexts';
import { formatCurrencyMinor, MarketplaceCheckoutError } from '@/app/services';
import type { ModuleKey, PurchaseResult } from '@/app/types';
import { PageHeader } from '@/app/shared/components';

interface CheckoutIssue {
  title: string;
  message: string;
  hint?: string;
  retryable?: boolean;
}

function toCheckoutIssue(
  error: unknown,
  t: (key: string, params?: Record<string, string | number>) => string,
): CheckoutIssue {
  if (error instanceof MarketplaceCheckoutError) {
    switch (error.code) {
      case 'OUT_OF_STOCK':
        return {
          title: t('marketplace.checkout.stockInsufficient.title'),
          message: error.message,
          hint: t('marketplace.checkout.stockInsufficient.hint'),
          retryable: false,
        };
      case 'CONFLICT':
        return {
          title: t('marketplace.checkout.conflict.title'),
          message: error.message,
          hint: t('marketplace.checkout.conflict.hint'),
          retryable: error.retryable,
        };
      case 'NETWORK':
        return {
          title: t('marketplace.checkout.network.title'),
          message: error.message,
          hint: t('marketplace.checkout.network.hint'),
          retryable: error.retryable,
        };
      case 'UNAUTHORIZED':
      case 'FORBIDDEN':
        return {
          title: t('marketplace.checkout.forbidden.title'),
          message: error.message,
          hint: t('marketplace.checkout.forbidden.hint'),
          retryable: false,
        };
      case 'SERVER':
        return {
          title: t('marketplace.checkout.server.title'),
          message: error.message,
          hint: t('marketplace.checkout.server.hint'),
          retryable: error.retryable,
        };
      default:
        return {
          title: t('marketplace.checkout.impossible.title'),
          message: error.message,
          retryable: error.retryable,
        };
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return {
      title: t('marketplace.checkout.impossible.title'),
      message: error.message,
      retryable: false,
    };
  }

  return {
    title: t('marketplace.checkout.impossible.title'),
    message: t('marketplace.checkout.impossible.message'),
    retryable: false,
  };
}

function getModuleLabel(
  module: ModuleKey,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  return t(MODULE_LABEL_KEYS[module]);
}

export function MarketplacePage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const {
    deviceProducts,
    identifierProducts,
    inventory,
    devices,
    isPurchasing,
    purchaseProduct,
    getProductRemainingStock,
    isProductSoldOut,
  } = useMarketplace();

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [lastPurchase, setLastPurchase] = useState<PurchaseResult | null>(null);
  const [checkoutIssue, setCheckoutIssue] = useState<CheckoutIssue | null>(null);
  const [retryPayload, setRetryPayload] = useState<{ productId: string; quantity: number } | null>(null);
  const [screenReaderStatus, setScreenReaderStatus] = useState('');

  const inventoryByModule = useMemo(
    () =>
      inventory.reduce<Record<string, number>>((accumulator, identifier) => {
        accumulator[identifier.module] = (accumulator[identifier.module] ?? 0) + 1;
        return accumulator;
      }, {}),
    [inventory],
  );

  const onboardingChecklist = useMemo(
    () =>
      devices.map((device) => ({
        id: device.id,
        name: device.name,
        module: device.module,
        hasName: Boolean(device.name && !device.name.startsWith('Boitier')),
        hasLocation: Boolean(device.location && device.location !== 'A configurer'),
        activated: device.configured,
      })),
    [devices],
  );

  const getQuantity = (productId: string): number => quantities[productId] ?? 1;

  const executePurchase = async (productId: string, quantity: number) => {
    if (isProductSoldOut(productId)) {
      const soldOutIssue: CheckoutIssue = {
        title: t('marketplace.checkout.soldOut.title'),
        message: t('marketplace.checkout.soldOut.message'),
        hint: t('marketplace.checkout.soldOut.hint'),
        retryable: false,
      };
      setCheckoutIssue(soldOutIssue);
      setRetryPayload(null);
      setScreenReaderStatus(`${soldOutIssue.title}. ${soldOutIssue.message}`);
      toast.error(soldOutIssue.message);
      return;
    }

    setCheckoutIssue(null);

    try {
      const result = await purchaseProduct(productId, quantity);
      setLastPurchase(result);
      setCheckoutIssue(null);
      setRetryPayload(null);
      setScreenReaderStatus(
        `${t('marketplace.success.title')}. ${t('marketplace.toast.allocationSuccess')}`,
      );
      toast.success(t('marketplace.toast.allocationSuccess'));
    } catch (error) {
      const issue = toCheckoutIssue(error, t);
      setCheckoutIssue(issue);
      setRetryPayload(issue.retryable ? { productId, quantity } : null);
      setScreenReaderStatus(`${issue.title}. ${issue.message}`);
      toast.error(issue.message);
    }
  };

  const handlePurchase = async (productId: string) => {
    const quantity = getQuantity(productId);
    await executePurchase(productId, quantity);
  };

  const handleRetryCheckout = async () => {
    if (!retryPayload || isPurchasing) {
      return;
    }
    await executePurchase(retryPayload.productId, retryPayload.quantity);
  };

  return (
    <div className="space-y-6" aria-busy={isPurchasing}>
      <p className="sr-only" role="status" aria-live="polite">
        {screenReaderStatus}
      </p>
      <PageHeader title={t('marketplace.title')} description={t('marketplace.description')} />

      {checkoutIssue ? (
        <section
          className="alert border-[var(--warning-main)]/40 bg-[var(--warning-main)]/10"
          role="alert"
          aria-live="assertive"
        >
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold text-[var(--text-primary)]">{checkoutIssue.title}</p>
            <p className="text-sm text-[var(--text-secondary)]">{checkoutIssue.message}</p>
            {checkoutIssue.hint ? (
              <p className="text-xs text-[var(--text-secondary)]">
                {t('marketplace.checkout.tip', { hint: checkoutIssue.hint })}
              </p>
            ) : null}
            {checkoutIssue.retryable && retryPayload ? (
              <div className="pt-1">
                <button
                  type="button"
                  className="btn btn-xs btn-outline"
                  disabled={isPurchasing}
                  aria-label={t('marketplace.checkout.retry.aria')}
                  onClick={handleRetryCheckout}
                >
                  {isPurchasing ? t('marketplace.checkout.retrying') : t('marketplace.checkout.retry')}
                </button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {lastPurchase ? (
        <section
          className="card border border-[var(--success-main)]/40 bg-[var(--success-main)]/10"
          role="status"
          aria-live="polite"
        >
          <div className="card-body space-y-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  {t('marketplace.success.title')}
                </h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  {t('marketplace.success.subtitle')}
                </p>
              </div>
              <CheckCircle2 className="h-6 w-6 text-[var(--success-main)]" aria-hidden="true" />
            </div>

            {lastPurchase.createdDevices.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                  {t('marketplace.success.devices')}
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  {lastPurchase.createdDevices.map((device) => (
                    <div
                      key={device.id}
                      className="rounded-lg border border-[var(--border-soft)] bg-[var(--card-bg)] p-3"
                    >
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{device.name}</p>
                      <p className="font-mono text-xs text-[var(--text-secondary)]">
                        MAC: {device.provisionedMacAddress}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {t('marketplace.success.statusReady')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {lastPurchase.createdIdentifiers.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                  {t('marketplace.success.identifiers')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {lastPurchase.createdIdentifiers.slice(0, 12).map((identifier) => (
                    <span key={identifier.id} className="badge badge-outline">
                      {identifier.code}
                    </span>
                  ))}
                  {lastPurchase.createdIdentifiers.length > 12 ? (
                    <span className="badge badge-ghost">
                      {t('marketplace.success.extraIdentifiers', {
                        count: lastPurchase.createdIdentifiers.length - 12,
                      })}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}

            <button
              type="button"
              className="btn btn-success w-fit"
              onClick={() => navigate(MODULE_PATHS[lastPurchase.redirectModule])}
            >
              {t('marketplace.success.continue')}
            </button>
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <article className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
          <div className="card-body p-4">
            <p className="text-sm text-[var(--text-secondary)]">{t('marketplace.cards.devicesAllocated')}</p>
            <p className="text-3xl font-bold text-[var(--text-primary)]">{devices.length}</p>
          </div>
        </article>
        <article className="card border border-[var(--border-soft)] bg-[var(--card-bg)] md:col-span-2">
          <div className="card-body p-4">
            <p className="text-sm text-[var(--text-secondary)]">
              {t('marketplace.cards.realtimeAvailability')}
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              {Object.entries(MODULE_LABEL_KEYS).map(([module, labelKey]) => (
                <div key={module} className="rounded-lg bg-[var(--surface-muted)] p-3">
                  <p className="text-xs uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                    {t(labelKey)}
                  </p>
                  <p className="mt-1 text-xl font-bold text-[var(--accent-primary)]">
                    {inventoryByModule[module] ?? 0}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </article>
      </div>

      <section className="space-y-4" aria-labelledby="marketplace-devices-heading">
        <h2 id="marketplace-devices-heading" className="text-lg font-semibold text-[var(--text-primary)]">
          {t('marketplace.catalog.devices')}
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {deviceProducts.map((product) => {
            const quantityInputId = `quantity-${product.id}`;
            const stockHintId = `stock-hint-${product.id}`;
            const remainingStock = getProductRemainingStock(product.id);
            const isSoldOut = isProductSoldOut(product.id);

            return (
              <article key={product.id} className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
                <div className="card-body p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">{product.label}</h3>
                    <span className="badge badge-info badge-outline">
                      {getModuleLabel(product.module, t)}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)]">{product.description}</p>
                  {product.module === 'feedback' ? (
                    <div className="rounded-lg bg-[var(--surface-muted)] p-3 text-sm text-[var(--text-secondary)]">
                      {t('marketplace.device.feedbackBundle')}
                    </div>
                  ) : (
                    <div className="rounded-lg bg-[var(--surface-muted)] p-3 text-sm text-[var(--text-secondary)]">
                      {t('marketplace.device.includes')}{' '}
                      <strong className="text-[var(--text-primary)]">{product.includedIdentifiers ?? 0}</strong>{' '}
                      {t('marketplace.device.identifiers')}
                    </div>
                  )}
                  <p className="text-2xl font-bold text-[var(--text-primary)]">
                    {formatCurrencyMinor(product.unitPriceMinor, product.currency)}
                  </p>
                  <p id={stockHintId} className="text-xs text-[var(--text-secondary)]">
                    {t('marketplace.stock.available')}{' '}
                    <span className="font-semibold">
                      {remainingStock ?? t('marketplace.stock.na')}
                    </span>
                  </p>

                  <label className="form-control">
                    <span className="label-text text-xs text-[var(--text-secondary)]">
                      {t('marketplace.quantity.maxStock')}
                    </span>
                    <input
                      id={quantityInputId}
                      type="number"
                      min={1}
                      max={remainingStock ?? undefined}
                      value={getQuantity(product.id)}
                      className="input input-bordered mt-1 bg-[var(--surface-muted)]"
                      disabled={isSoldOut}
                      aria-describedby={stockHintId}
                      onChange={(event) =>
                        setQuantities((current) => ({
                          ...current,
                          [product.id]: Math.max(
                            1,
                            Math.min(Number(event.target.value) || 1, remainingStock ?? Number.MAX_SAFE_INTEGER),
                          ),
                        }))
                      }
                    />
                  </label>

                  <button
                    type="button"
                    className="btn btn-info mt-2 text-[var(--app-bg)]"
                    disabled={isPurchasing || isSoldOut}
                    aria-label={
                      isSoldOut
                        ? t('marketplace.allocate.productUnavailable', { product: product.label })
                        : t('marketplace.allocate.product', {
                            quantity: getQuantity(product.id),
                            product: product.label,
                          })
                    }
                    onClick={() => handlePurchase(product.id)}
                  >
                    <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                    {isSoldOut ? t('marketplace.stock.soldOut') : t('marketplace.allocate.hardware')}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="marketplace-extensions-heading">
        <h2 id="marketplace-extensions-heading" className="text-lg font-semibold text-[var(--text-primary)]">
          {t('marketplace.catalog.extensions')}
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {identifierProducts.map((product) => {
            const quantityInputId = `quantity-${product.id}`;
            const stockHintId = `stock-hint-${product.id}`;
            const remainingStock = getProductRemainingStock(product.id);
            const isSoldOut = isProductSoldOut(product.id);

            return (
              <article key={product.id} className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
                <div className="card-body p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">{product.label}</h3>
                    <span className="badge badge-outline">
                      {t('marketplace.badge.pack', { count: product.quantityPerPack ?? 0 })}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)]">{product.description}</p>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">
                    {formatCurrencyMinor(product.unitPriceMinor, product.currency)}
                  </p>
                  <p id={stockHintId} className="text-xs text-[var(--text-secondary)]">
                    {t('marketplace.stock.available')}{' '}
                    <span className="font-semibold">
                      {remainingStock ?? t('marketplace.stock.na')}
                    </span>
                  </p>

                  <label className="form-control">
                    <span className="label-text text-xs text-[var(--text-secondary)]">
                      {t('marketplace.quantity')}
                    </span>
                    <input
                      id={quantityInputId}
                      type="number"
                      min={1}
                      max={remainingStock ?? undefined}
                      value={getQuantity(product.id)}
                      className="input input-bordered mt-1 bg-[var(--surface-muted)]"
                      disabled={isSoldOut}
                      aria-describedby={stockHintId}
                      onChange={(event) =>
                        setQuantities((current) => ({
                          ...current,
                          [product.id]: Math.max(
                            1,
                            Math.min(Number(event.target.value) || 1, remainingStock ?? Number.MAX_SAFE_INTEGER),
                          ),
                        }))
                      }
                    />
                  </label>

                  <button
                    type="button"
                    className="btn btn-outline btn-info mt-2"
                    disabled={isPurchasing || isSoldOut}
                    aria-label={
                      isSoldOut
                        ? t('marketplace.allocate.productUnavailable', { product: product.label })
                        : t('marketplace.allocate.product', {
                            quantity: getQuantity(product.id),
                            product: product.label,
                          })
                    }
                    onClick={() => handlePurchase(product.id)}
                  >
                    {isSoldOut ? t('marketplace.stock.soldOut') : t('marketplace.allocate.extensions')}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section
        className="card border border-[var(--border-soft)] bg-[var(--card-bg)]"
        aria-labelledby="onboarding-heading"
      >
        <div className="card-body space-y-2 p-5">
          <h2 id="onboarding-heading" className="text-lg font-semibold text-[var(--text-primary)]">
            {t('marketplace.onboarding.title')}
          </h2>
          {(onboardingChecklist ?? []).map((device) => (
            <div
              key={device.id}
              className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3 text-sm"
            >
              <p className="font-medium text-[var(--text-primary)]">{device.name}</p>
              <p className="text-[var(--text-secondary)]">{getModuleLabel(device.module, t)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className={`badge ${device.hasName ? 'badge-success' : 'badge-warning'}`}>
                  {t('marketplace.onboarding.name')}
                </span>
                <span className={`badge ${device.hasLocation ? 'badge-success' : 'badge-warning'}`}>
                  {t('marketplace.onboarding.location')}
                </span>
                <span className={`badge ${device.activated ? 'badge-success' : 'badge-warning'}`}>
                  {t('marketplace.onboarding.activation')}
                </span>
              </div>
            </div>
          ))}
          {onboardingChecklist.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">{t('marketplace.onboarding.none')}</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
