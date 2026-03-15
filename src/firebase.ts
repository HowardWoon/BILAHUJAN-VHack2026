import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "paste-your-new-apiKey-here",
  authDomain: "bilahujan-vhack.firebaseapp.com",
  databaseURL: "https://bilahujan-vhack-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "bilahujan-vhack",
  storageBucket: "bilahujan-vhack.appspot.com",
  messagingSenderId: "paste-your-messagingSenderId-here",
  appId: "paste-your-appId-here"
};

const app = initializeApp(firebaseConfig);
export const rtdb = getDatabase(app);
export const db = getFirestore(app);
export default app;