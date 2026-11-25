export const languages = [
  { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr', status: 'approved' },
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া', direction: 'ltr', status: 'approved' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', direction: 'ltr', status: 'approved' },
  { code: 'brx', name: 'Bodo', nativeName: 'बड़ो', direction: 'ltr', status: 'approved' },
  { code: 'doi', name: 'Dogri', nativeName: 'डोगरी', direction: 'ltr', status: 'approved' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', direction: 'ltr', status: 'approved' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', direction: 'ltr', status: 'approved' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', direction: 'ltr', status: 'approved' },
  { code: 'ks', name: 'Kashmiri', nativeName: 'کشمیری', direction: 'rtl', status: 'approved' },
  { code: 'kok', name: 'Konkani', nativeName: 'कोंकणी', direction: 'ltr', status: 'approved' },
  { code: 'mai', name: 'Maithili', nativeName: 'मैथिली', direction: 'ltr', status: 'approved' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', direction: 'ltr', status: 'approved' },
  { code: 'mni', name: 'Manipuri', nativeName: 'ꯃꯩꯇꯩꯂꯣꯟ', direction: 'ltr', status: 'approved' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', direction: 'ltr', status: 'approved' },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली', direction: 'ltr', status: 'approved' },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', direction: 'ltr', status: 'approved' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', direction: 'ltr', status: 'approved' },
  { code: 'sa', name: 'Sanskrit', nativeName: 'संस्कृतम्', direction: 'ltr', status: 'approved' },
  { code: 'sat', name: 'Santali', nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ', direction: 'ltr', status: 'approved' },
  { code: 'sd', name: 'Sindhi', nativeName: 'سنڌي', direction: 'rtl', status: 'approved' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', direction: 'ltr', status: 'approved' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', direction: 'ltr', status: 'approved' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', direction: 'rtl', status: 'approved' }
] as const;

export type LanguageCode = (typeof languages)[number]['code'];
export type LanguageMeta = (typeof languages)[number];

export const DEFAULT_LANGUAGE: LanguageCode = 'en';
