// Firebase 설정 - fitness-with-my-son 프로젝트
const firebaseConfig = {
  apiKey: "AIzaSyDx9718Ycryva1_akgsnTTISj647S12RMM",
  authDomain: "fitness-with-my-son.firebaseapp.com",
  projectId: "fitness-with-my-son",
  storageBucket: "fitness-with-my-son.firebasestorage.app",
  messagingSenderId: "555834936707",
  appId: "1:555834936707:web:ac31a980b25d1097d13ab6"
};

// Firebase 초기화
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// 오프라인 캐시 활성화
db.settings({ cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED, merge: true });
try {
  db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
} catch (e) {}
