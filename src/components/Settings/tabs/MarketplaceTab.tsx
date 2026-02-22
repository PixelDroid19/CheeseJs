import { Store } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function MarketplaceTab() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Store className="w-12 h-12 mb-4 opacity-20" />
      <p>{t('common.comingSoon')}</p>
    </div>
  );
}
