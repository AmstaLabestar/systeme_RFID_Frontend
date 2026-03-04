import { useMemo } from 'react';
import { useAdminStockModel } from '../AdminStockModelContext';

export function useAdminStockWebhooksModule() {
  const model = useAdminStockModel();

  return useMemo(
    () => ({
      t: model.t,
      webhooksQuery: model.webhooksQuery,
      webhooks: model.webhooks,
      activeWebhooks: model.activeWebhooks,
      failingWebhooks: model.failingWebhooks,
      webhookForm: model.webhookForm,
      setWebhookForm: model.setWebhookForm,
      canCreateWebhook: model.canCreateWebhook,
      createWebhookMutation: model.createWebhookMutation,
      handleCreateWebhook: model.handleCreateWebhook,
      pendingWebhookAction: model.pendingWebhookAction,
      toggleWebhookMutation: model.toggleWebhookMutation,
      testWebhookMutation: model.testWebhookMutation,
    }),
    [model],
  );
}
