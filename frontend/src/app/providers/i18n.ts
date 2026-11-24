
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from '../../locales/en/common.json';

import {
  languages,
  DEFAULT_LANGUAGE,
  type LanguageCode,
} from './languageCatalog';

const resources = {
  en: {
    common: enCommon,
  },
};

function updateDocumentLanguage(languageCode: string): void {
  const baseLanguage = languageCode.toLowerCase().split('-')[0];

  const selectedLanguage = languages.find(
    (language) => language.code === baseLanguage
  );

  document.documentElement.lang =
    selectedLanguage?.code ?? DEFAULT_LANGUAGE;

  document.documentElement.dir =
    selectedLanguage?.direction ?? 'ltr';
}

i18n.on('languageChanged', updateDocumentLanguage);

export const i18nReady = i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,

    supportedLngs: languages.map(
      (language) => language.code
    ),

    defaultNS: 'common',
    ns: ['common'],

    interpolation: {
      escapeValue: false,
    },

    returnNull: false,
  })
  .then(() => {
    updateDocumentLanguage(DEFAULT_LANGUAGE);
  });

export async function changeAppLanguage(
  languageCode: LanguageCode
): Promise<void> {
  const selectedLanguage = languages.find(
    (language) => language.code === languageCode
  );

  if (
    !selectedLanguage ||
    selectedLanguage.status !== 'approved'
  ) {
    throw new Error(
      'This language is not approved for release.'
    );
  }

  await i18n.changeLanguage(languageCode);
}

export function getAvailableLanguages() {
  return languages.filter(
    (language) => language.status === 'approved'
  );
}

export default i18n;
