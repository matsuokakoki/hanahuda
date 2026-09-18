import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';

const emulatorConfig = {
  apiKey: 'demo-key',
  authDomain: 'demo-extreme-hanafuda.firebaseapp.com',
  projectId: 'demo-extreme-hanafuda',
  appId: '1:123:web:demo'
};
// Firebase Web config is intentionally public: it identifies this browser app,
// while Authentication and Firestore Rules enforce access control.
const productionConfig = {
  apiKey: 'AIzaSyCaDBhtGSnHcvu-_0iUXnxIE0l5YCDYJIM',
  authDomain: 'hanahuda-adf91.firebaseapp.com',
  projectId: 'hanahuda-adf91',
  storageBucket: 'hanahuda-adf91.firebasestorage.app',
  messagingSenderId: '58488227129',
  appId: '1:58488227129:web:afc31291a46434979e94e8'
};
const useEmulators = import.meta.env.DEV || import.meta.env.VITE_USE_EMULATORS === 'true';
const firebaseConfig = useEmulators ? emulatorConfig : productionConfig;
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'asia-northeast1');
if (useEmulators) {
  const host = window.location.hostname;
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
  connectFunctionsEmulator(functions, host, 5001);
}
export async function ensureAnonymousUser() { return auth.currentUser ?? (await signInAnonymously(auth)).user; }
