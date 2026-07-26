const DEFAULT_BASE_CURRENCY_FALLBACK = 'CHF';

const FALLBACK_SUPPORTED_BASE_CURRENCIES = [
  'AUD', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP', 'HKD', 'HUF',
  'ILS', 'INR', 'JPY', 'MXN', 'NOK', 'NZD', 'PLN', 'SEK', 'SGD', 'TRY',
  'USD', 'ZAR',
] as const;

type IntlWithSupportedValuesOf = typeof Intl & {
  supportedValuesOf?: (key: string) => string[];
};

function normalizeCurrencyCode(devise: string | null | undefined): string | null {
  const normalized = devise?.trim().toUpperCase();
  return normalized ? normalized : null;
}

function uniqueCurrencyCodes(devises: Iterable<string | null | undefined>): string[] {
  const uniques = new Set<string>();

  for (const devise of devises) {
    const normalized = normalizeCurrencyCode(devise);
    if (normalized) {
      uniques.add(normalized);
    }
  }

  return [...uniques];
}

function resolveSupportedBaseCurrencies(): string[] {
  const runtimeCurrencies = (Intl as IntlWithSupportedValuesOf).supportedValuesOf?.('currency');
  const devises = runtimeCurrencies?.length
    ? uniqueCurrencyCodes(runtimeCurrencies)
    : uniqueCurrencyCodes(FALLBACK_SUPPORTED_BASE_CURRENCIES);

  return devises.sort((a, b) => a.localeCompare(b));
}

export const DEFAULT_BASE_CURRENCY =
  normalizeCurrencyCode(DEFAULT_BASE_CURRENCY_FALLBACK) ?? 'CHF';

export const SUPPORTED_FOYER_BASE_CURRENCIES = resolveSupportedBaseCurrencies();

export function buildConfiguredCurrencyOptions(
  deviseBase: string | null | undefined,
  devisesAvecTaux: readonly (string | null | undefined)[],
): string[] {
  const normalizedBase = normalizeCurrencyCode(deviseBase) ?? DEFAULT_BASE_CURRENCY;
  const autresDevises = uniqueCurrencyCodes(devisesAvecTaux)
    .filter(devise => devise !== normalizedBase)
    .sort((a, b) => a.localeCompare(b));

  return [normalizedBase, ...autresDevises];
}
