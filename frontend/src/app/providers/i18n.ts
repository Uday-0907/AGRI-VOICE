import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import asCommon from '../../locales/as/common.json';
import bnCommon from '../../locales/bn/common.json';
import brxCommon from '../../locales/brx/common.json';
import doiCommon from '../../locales/doi/common.json';
import enCommon from '../../locales/en/common.json';
import guCommon from '../../locales/gu/common.json';
import hiCommon from '../../locales/hi/common.json';
import knCommon from '../../locales/kn/common.json';
import kokCommon from '../../locales/kok/common.json';
import ksCommon from '../../locales/ks/common.json';
import maiCommon from '../../locales/mai/common.json';
import mlCommon from '../../locales/ml/common.json';
import mniCommon from '../../locales/mni/common.json';
import mrCommon from '../../locales/mr/common.json';
import neCommon from '../../locales/ne/common.json';
import orCommon from '../../locales/or/common.json';
import paCommon from '../../locales/pa/common.json';
import saCommon from '../../locales/sa/common.json';
import satCommon from '../../locales/sat/common.json';
import sdCommon from '../../locales/sd/common.json';
import taCommon from '../../locales/ta/common.json';
import teCommon from '../../locales/te/common.json';
import urCommon from '../../locales/ur/common.json';

import {
  languages,
  DEFAULT_LANGUAGE,
  type LanguageCode,
  type LanguageMeta,
} from './languageCatalog';

const STORAGE_KEY = 'agrivoice_language';

export const resources = {
  as: { common: asCommon },
  bn: { common: bnCommon },
  brx: { common: brxCommon },
  doi: { common: doiCommon },
  en: { common: enCommon },
  gu: { common: guCommon },
  hi: { common: hiCommon },
  kn: { common: knCommon },
  kok: { common: kokCommon },
  ks: { common: ksCommon },
  mai: { common: maiCommon },
  ml: { common: mlCommon },
  mni: { common: mniCommon },
  mr: { common: mrCommon },
  ne: { common: neCommon },
  or: { common: orCommon },
  pa: { common: paCommon },
  sa: { common: saCommon },
  sat: { common: satCommon },
  sd: { common: sdCommon },
  ta: { common: taCommon },
  te: { common: teCommon },
  ur: { common: urCommon },
};

export function getLanguageMeta(languageCode: string): LanguageMeta {
  const baseLanguage = languageCode.toLowerCase().split('-')[0];
  return (
    languages.find((language) => language.code === baseLanguage) ??
    languages[0]
  );
}

function readStoredLanguage(): LanguageCode {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && languages.some((l) => l.code === saved && l.status === 'approved')) {
      return saved as LanguageCode;
    }
  } catch {
    // Ignore storage access errors in sandboxed/test contexts
  }
  return DEFAULT_LANGUAGE;
}

function updateDocumentLanguage(languageCode: string): void {
  const selectedLanguage = getLanguageMeta(languageCode);

  if (typeof document !== 'undefined') {
    document.documentElement.lang = selectedLanguage.code;
    document.documentElement.dir = selectedLanguage.direction;
  }
}

i18n.on('languageChanged', updateDocumentLanguage);

const initialLanguage = readStoredLanguage();

export const i18nReady = i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLanguage,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: languages.map((language) => language.code),
    defaultNS: 'common',
    ns: ['common'],
    interpolation: {
      escapeValue: false,
    },
    returnNull: false,
  })
  .then(() => {
    updateDocumentLanguage(initialLanguage);
  });

export async function changeAppLanguage(
  languageCode: LanguageCode
): Promise<void> {
  const selectedLanguage = languages.find(
    (language) => language.code === languageCode
  );

  if (!selectedLanguage || selectedLanguage.status !== 'approved') {
    throw new Error('This language is not approved for release.');
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, languageCode);
  } catch {
    // Ignore storage access errors
  }

  await i18n.changeLanguage(languageCode);
  updateDocumentLanguage(languageCode);
}

export function getAvailableLanguages() {
  return languages.filter((language) => language.status === 'approved');
}

export default i18n;
