
export const languages = [
  { code: 'en', name: 'English', direction: 'ltr', status: 'approved' },
  { code: 'as', name: 'Assamese', direction: 'ltr', status: 'pending' },
  { code: 'bn', name: 'Bengali', direction: 'ltr', status: 'pending' },
  { code: 'brx', name: 'Bodo', direction: 'ltr', status: 'pending' },
  { code: 'doi', name: 'Dogri', direction: 'ltr', status: 'pending' },
  { code: 'gu', name: 'Gujarati', direction: 'ltr', status: 'pending' },
  { code: 'hi', name: 'Hindi', direction: 'ltr', status: 'pending' },
  { code: 'kn', name: 'Kannada', direction: 'ltr', status: 'pending' },
  { code: 'ks', name: 'Kashmiri', direction: 'rtl', status: 'pending' },
  { code: 'kok', name: 'Konkani', direction: 'ltr', status: 'pending' },
  { code: 'mai', name: 'Maithili', direction: 'ltr', status: 'pending' },
  { code: 'ml', name: 'Malayalam', direction: 'ltr', status: 'pending' },
  { code: 'mni', name: 'Manipuri', direction: 'ltr', status: 'pending' },
  { code: 'mr', name: 'Marathi', direction: 'ltr', status: 'pending' },
  { code: 'ne', name: 'Nepali', direction: 'ltr', status: 'pending' },
  { code: 'or', name: 'Odia', direction: 'ltr', status: 'pending' },
  { code: 'pa', name: 'Punjabi', direction: 'ltr', status: 'pending' },
  { code: 'sa', name: 'Sanskrit', direction: 'ltr', status: 'pending' },
  { code: 'sat', name: 'Santali', direction: 'ltr', status: 'pending' },
  { code: 'sd', name: 'Sindhi', direction: 'rtl', status: 'pending' },
  { code: 'ta', name: 'Tamil', direction: 'ltr', status: 'pending' },
  { code: 'te', name: 'Telugu', direction: 'ltr', status: 'pending' },
  { code: 'ur', name: 'Urdu', direction: 'rtl', status: 'pending' }
] as const;

export type LanguageCode =
  (typeof languages)[number]['code'];

export const DEFAULT_LANGUAGE: LanguageCode = 'en';