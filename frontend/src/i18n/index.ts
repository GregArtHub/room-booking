import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en';
import ru from './ru';

const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('locale') : null;
const browser =
  typeof navigator !== 'undefined' && navigator.language?.startsWith('en') ? 'en' : 'ru';

i18n.use(initReactI18next).init({
  resources: { ru: { translation: ru }, en: { translation: en } },
  lng: stored ?? browser,
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
});

export default i18n;
