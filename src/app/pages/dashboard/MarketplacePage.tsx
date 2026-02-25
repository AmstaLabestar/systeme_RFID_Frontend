import { CheckCircle2, ShoppingBag } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MODULE_LABELS, MODULE_PATHS } from '@/app/data';
import { useMarketplace } from '@/app/contexts';
import { formatCurrencyFcfa } from '@/app/services';
import type { PurchaseResult } from '@/app/types';
import { PageHeader } from '@/app/shared/components';

export function MarketplacePage() {
  const navigate = useNavigate();
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

  const handlePurchase = async (productId: string) => {
    if (isProductSoldOut(productId)) {
      toast.error('Ce materiel est epuise et ne peut plus etre achete.');
      return;
    }

    const quantity = getQuantity(productId);

    try {
      const result = await purchaseProduct(productId, quantity);
      setLastPurchase(result);
      toast.success('Allocation reussie: materiel existant attribue.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Achat impossible.';
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketplace"
        description="Catalogue adosse au stock reel: aucun boitier n est cree a l achat, le checkout alloue uniquement du materiel deja provisionne."
      />

      {lastPurchase ? (
        <section className="card border border-[var(--success-main)]/40 bg-[var(--success-main)]/10">
          <div className="card-body space-y-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  Allocation reussie
                </h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  Aucun materiel n a ete cree: stock existant attribue a votre compte.
                </p>
              </div>
              <CheckCircle2 className="h-6 w-6 text-[var(--success-main)]" />
            </div>

            {lastPurchase.createdDevices.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">Boitiers alloues</p>
                <div className="grid gap-2 md:grid-cols-2">
                  {lastPurchase.createdDevices.map((device) => (
                    <div key={device.id} className="rounded-lg border border-[var(--border-soft)] bg-[var(--card-bg)] p-3">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{device.name}</p>
                      <p className="font-mono text-xs text-[var(--text-secondary)]">
                        MAC: {device.provisionedMacAddress}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">Statut: pret a configurer</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {lastPurchase.createdIdentifiers.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">Identifiants alloues</p>
                <div className="flex flex-wrap gap-2">
                  {lastPurchase.createdIdentifiers.slice(0, 12).map((identifier) => (
                    <span key={identifier.id} className="badge badge-outline">
                      {identifier.code}
                    </span>
                  ))}
                  {lastPurchase.createdIdentifiers.length > 12 ? (
                    <span className="badge badge-ghost">
                      +{lastPurchase.createdIdentifiers.length - 12}
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
              Continuer la configuration
            </button>
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <article className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
          <div className="card-body p-4">
            <p className="text-sm text-[var(--text-secondary)]">Boitiers alloues</p>
            <p className="text-3xl font-bold text-[var(--text-primary)]">{devices.length}</p>
          </div>
        </article>
        <article className="card border border-[var(--border-soft)] bg-[var(--card-bg)] md:col-span-2">
          <div className="card-body p-4">
            <p className="text-sm text-[var(--text-secondary)]">Disponibilite en temps reel</p>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              {Object.entries(MODULE_LABELS).map(([module, label]) => (
                <div key={module} className="rounded-lg bg-[var(--surface-muted)] p-3">
                  <p className="text-xs uppercase tracking-[0.1em] text-[var(--text-secondary)]">{label}</p>
                  <p className="mt-1 text-xl font-bold text-[var(--accent-primary)]">{inventoryByModule[module] ?? 0}</p>
                </div>
              ))}
            </div>
          </div>
        </article>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Catalogue boitiers</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {deviceProducts.map((product) => (
            <article key={product.id} className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
              <div className="card-body p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold text-[var(--text-primary)]">{product.label}</h3>
                  <span className="badge badge-info badge-outline">{MODULE_LABELS[product.module]}</span>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">{product.description}</p>
                {product.module === 'feedback' ? (
                  <div className="rounded-lg bg-[var(--surface-muted)] p-3 text-sm text-[var(--text-secondary)]">
                    Livre: <strong className="text-[var(--text-primary)]">boitier physique + adresse MAC</strong>
                  </div>
                ) : (
                  <div className="rounded-lg bg-[var(--surface-muted)] p-3 text-sm text-[var(--text-secondary)]">
                    Inclut:{' '}
                    <strong className="text-[var(--text-primary)]">{product.includedIdentifiers ?? 0}</strong>{' '}
                    identifiants
                  </div>
                )}
                <p className="text-2xl font-bold text-[var(--text-primary)]">{formatCurrencyFcfa(product.unitPrice)}</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Stock reel disponible: <span className="font-semibold">{getProductRemainingStock(product.id) ?? 'N/A'}</span>
                </p>

                <label className="form-control">
                  <span className="label-text text-xs text-[var(--text-secondary)]">Quantite (max stock)</span>
                  <input
                    type="number"
                    min={1}
                    max={getProductRemainingStock(product.id) ?? undefined}
                    value={getQuantity(product.id)}
                    className="input input-bordered mt-1 bg-[var(--surface-muted)]"
                    disabled={isProductSoldOut(product.id)}
                    onChange={(event) =>
                      setQuantities((current) => ({
                        ...current,
                        [product.id]: Math.max(
                          1,
                          Math.min(
                            Number(event.target.value) || 1,
                            getProductRemainingStock(product.id) ?? Number.MAX_SAFE_INTEGER,
                          ),
                        ),
                      }))
                    }
                  />
                </label>

                <button
                  type="button"
                  className="btn btn-info mt-2 text-[var(--app-bg)]"
                  disabled={isPurchasing || isProductSoldOut(product.id)}
                  onClick={() => handlePurchase(product.id)}
                >
                  <ShoppingBag className="h-4 w-4" />
                  {isProductSoldOut(product.id) ? 'Stock epuise' : 'Allouer materiel existant'}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Catalogue extensions</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {identifierProducts.map((product) => (
            <article key={product.id} className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
              <div className="card-body p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold text-[var(--text-primary)]">{product.label}</h3>
                  <span className="badge badge-outline">Pack x{product.quantityPerPack}</span>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">{product.description}</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{formatCurrencyFcfa(product.unitPrice)}</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Stock reel disponible: <span className="font-semibold">{getProductRemainingStock(product.id) ?? 'N/A'}</span>
                </p>

                <label className="form-control">
                  <span className="label-text text-xs text-[var(--text-secondary)]">Quantite</span>
                  <input
                    type="number"
                    min={1}
                    max={getProductRemainingStock(product.id) ?? undefined}
                    value={getQuantity(product.id)}
                    className="input input-bordered mt-1 bg-[var(--surface-muted)]"
                    disabled={isProductSoldOut(product.id)}
                    onChange={(event) =>
                      setQuantities((current) => ({
                        ...current,
                        [product.id]: Math.max(
                          1,
                          Math.min(
                            Number(event.target.value) || 1,
                            getProductRemainingStock(product.id) ?? Number.MAX_SAFE_INTEGER,
                          ),
                        ),
                      }))
                    }
                  />
                </label>

                <button
                  type="button"
                  className="btn btn-outline btn-info mt-2"
                  disabled={isPurchasing || isProductSoldOut(product.id)}
                  onClick={() => handlePurchase(product.id)}
                >
                  {isProductSoldOut(product.id) ? 'Stock epuise' : 'Allouer extensions'}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
        <div className="card-body space-y-2 p-5">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Mes equipements: checklist onboarding</h2>
          {(onboardingChecklist ?? []).map((device) => (
            <div key={device.id} className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3 text-sm">
              <p className="font-medium text-[var(--text-primary)]">{device.name}</p>
              <p className="text-[var(--text-secondary)]">{MODULE_LABELS[device.module]}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className={`badge ${device.hasName ? 'badge-success' : 'badge-warning'}`}>Nom</span>
                <span className={`badge ${device.hasLocation ? 'badge-success' : 'badge-warning'}`}>Emplacement</span>
                <span className={`badge ${device.activated ? 'badge-success' : 'badge-warning'}`}>Activation</span>
              </div>
            </div>
          ))}
          {onboardingChecklist.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">Aucun equipement pour le moment.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
