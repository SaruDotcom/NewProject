import { useEffect, useState } from 'react';
import { Check, Palette, Store } from 'lucide-react';
import { useWholesaler } from '@/context/WholesalerContext';
import api, { type WholesalerStoreTheme } from '@/lib/api';

const THEMES: Array<{
  id: WholesalerStoreTheme;
  name: string;
  description: string;
  colors: [string, string, string];
}> = [
  {
    id: 'DEFAULT',
    name: 'TradeFlow Classic',
    description: 'The current TradeFlow green and navy storefront.',
    colors: ['#20A66A', '#12304A', '#F4F7F8'],
  },
  {
    id: 'ROYAL',
    name: 'Royal Indigo',
    description: 'A refined indigo palette with an editorial product-card style.',
    colors: ['#6554C0', '#29234F', '#F7F5FF'],
  },
  {
    id: 'FESTIVE',
    name: 'Festive Maroon',
    description: 'Warm maroon and gold accents for seasonal storefronts.',
    colors: ['#A52B43', '#5C1F2D', '#FFF8F0'],
  },
  {
    id: 'MINIMAL',
    name: 'Modern Slate',
    description: 'A calm slate-and-blue palette with a clean, compact layout.',
    colors: ['#2877A5', '#243B4A', '#F3F7FA'],
  },
];

export default function StoreThemePage() {
  const { profile, updateProfile } = useWholesaler();
  const [selectedTheme, setSelectedTheme] = useState<WholesalerStoreTheme>(profile.activeStoreTheme || 'DEFAULT');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setSelectedTheme(profile.activeStoreTheme || 'DEFAULT');
  }, [profile.activeStoreTheme]);

  const saveTheme = async () => {
    setIsSaving(true);
    setMessage('');
    setError('');
    try {
      await api.updateStoreTheme(selectedTheme);
      updateProfile({ activeStoreTheme: selectedTheme });
      setMessage('Your retailer storefront theme has been updated.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save the storefront theme.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <div className="rounded-xl bg-tradeflow-green/10 p-3 text-tradeflow-green">
          <Palette className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-tradeflow-navy">Store Theme</h1>
          <p className="mt-1 text-sm text-gray-500">Choose how your connected retailers see your storefront.</p>
        </div>
      </header>

      <section className="rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center gap-2 text-sm font-bold text-tradeflow-navy">
          <Store className="h-4 w-4 text-tradeflow-green" />
          Active retailer storefront
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {THEMES.map((theme) => {
            const isSelected = selectedTheme === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedTheme(theme.id)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  isSelected
                    ? 'border-tradeflow-green ring-2 ring-tradeflow-green/20'
                    : 'border-tradeflow-gray-200 hover:border-tradeflow-green/50'
                }`}
              >
                <span className="mb-4 flex h-16 overflow-hidden rounded-lg border border-black/5">
                  {theme.colors.map((color) => (
                    <span key={color} className="flex-1" style={{ backgroundColor: color }} />
                  ))}
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span className="font-bold text-tradeflow-navy">{theme.name}</span>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-tradeflow-green" />}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-gray-500">{theme.description}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-tradeflow-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div aria-live="polite">
            {message && <p className="text-sm font-semibold text-green-700">{message}</p>}
            {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
          </div>
          <button
            type="button"
            onClick={() => void saveTheme()}
            disabled={isSaving || selectedTheme === profile.activeStoreTheme}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-tradeflow-green px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-tradeflow-green-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save theme'}
          </button>
        </div>
      </section>
    </div>
  );
}
