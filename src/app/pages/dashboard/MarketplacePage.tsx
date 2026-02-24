import { ShoppingBag } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MODULE_PATHS, MODULE_LABELS } from '@/app/data';
import { useMarketplace } from '@/app/contexts';
import { formatCurrencyFcfa } from '@/app/services';
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

  const inventoryByModule = useMemo(
    () =>
      inventory.reduce<Record<string, number>>((accumulator, identifier) => {
        accumulator[identifier.module] = (accumulator[identifier.module] ?? 0) + 1;
        return accumulator;
      }, {}),
    [inventory],
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
      const redirectPath = MODULE_PATHS[result.redirectModule];
      navigate(redirectPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Achat impossible.';
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketplace"
        description="Point d entree unique: chaque achat provisionne boitiers et identifiants. Activation finale via MAC obligatoire."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <article className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
          <div className="card-body p-4">
            <p className="text-sm text-[var(--text-secondary)]">Boitiers achetes</p>
            <p className="text-3xl font-bold text-[var(--text-primary)]">{devices.length}</p>
            <p className="text-xs text-[var(--text-secondary)]">Multipliez les unites centrales selon vos sites.</p>
          </div>
        </article>
        <article className="card border border-[var(--border-soft)] bg-[var(--card-bg)] md:col-span-2">
          <div className="card-body p-4">
            <p className="text-sm text-[var(--text-secondary)]">Inventaire identifiants</p>
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
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Boitiers</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {deviceProducts.map((product) => (
            <article key={product.id} className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
              <div className="card-body p-5">
                {product.apiSku ? (
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                    Ref materiel: {product.apiSku}
                  </p>
                ) : null}
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold text-[var(--text-primary)]">{product.label}</h3>
                  <span className="badge badge-info badge-outline">{MODULE_LABELS[product.module]}</span>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">{product.description}</p>
                <div className="rounded-lg bg-[var(--surface-muted)] p-3 text-sm text-[var(--text-secondary)]">
                  Inclut par defaut: <strong className="text-[var(--text-primary)]">{product.includedIdentifiers ?? 0}</strong>{' '}
                  identifiants
                </div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{formatCurrencyFcfa(product.unitPrice)}</p>
                {getProductRemainingStock(product.id) !== null ? (
                  <p className="text-xs text-[var(--text-secondary)]">
                    Stock restant: <span className="font-semibold">{getProductRemainingStock(product.id)}</span>
                  </p>
                ) : null}

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
                  className="btn btn-info mt-2 text-[var(--app-bg)]"
                  disabled={isPurchasing || isProductSoldOut(product.id)}
                  onClick={() => handlePurchase(product.id)}
                >
                  <ShoppingBag className="h-4 w-4" />
                  {isProductSoldOut(product.id) ? 'Stock epuise' : 'Acheter maintenant'}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Identifiants</h2>
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

                <label className="form-control">
                  <span className="label-text text-xs text-[var(--text-secondary)]">Quantite</span>
                  <input
                    type="number"
                    min={1}
                    value={getQuantity(product.id)}
                    className="input input-bordered mt-1 bg-[var(--surface-muted)]"
                    onChange={(event) =>
                      setQuantities((current) => ({
                        ...current,
                        [product.id]: Math.max(1, Number(event.target.value) || 1),
                      }))
                    }
                  />
                </label>

                <button
                  type="button"
                  className="btn btn-outline btn-info mt-2"
                  disabled={isPurchasing}
                  onClick={() => handlePurchase(product.id)}
                >
                  Acheter le pack
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
