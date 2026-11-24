import { describe, expect, it } from 'vitest';
import i18n, {
  changeAppLanguage,
  getAvailableLanguages,
  i18nReady,
  resources,
} from '../app/providers/i18n';
import { languages } from '../app/providers/languageCatalog';

function collectKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...collectKeys(v as Record<string, unknown>, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

describe('23-Language Unicode & RTL i18n System', () => {
  it('approves and registers all 23 official AgriVoice languages', async () => {
    await i18nReady;
    expect(languages).toHaveLength(23);
    expect(getAvailableLanguages()).toHaveLength(23);
    for (const lang of languages) {
      expect(resources[lang.code]).toBeDefined();
    }
  });

  it('ensures every locale has full key parity with English', () => {
    const masterKeys = collectKeys(resources.en.common as unknown as Record<string, unknown>);
    for (const lang of languages) {
      const localeKeys = collectKeys(
        resources[lang.code].common as unknown as Record<string, unknown>
      );
      expect(localeKeys).toEqual(masterKeys);
    }
  });

  it('sets RTL document direction for Kashmiri, Sindhi, and Urdu and LTR for others', async () => {
    await i18nReady;

    for (const rtlCode of ['ks', 'sd', 'ur'] as const) {
      await changeAppLanguage(rtlCode);
      expect(document.documentElement.lang).toBe(rtlCode);
      expect(document.documentElement.dir).toBe('rtl');
      expect(window.localStorage.getItem('agrivoice_language')).toBe(rtlCode);
    }

    await changeAppLanguage('te');
    expect(document.documentElement.lang).toBe('te');
    expect(document.documentElement.dir).toBe('ltr');
    expect(i18n.t('navigation.home', { ns: 'common' })).toBe('హోమ్');

    await changeAppLanguage('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });
});
