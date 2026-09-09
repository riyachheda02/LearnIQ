// //src/firebase.js
// import { initializeApp } from "firebase/app";
// import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
// import { getFirestore } from "firebase/firestore";

// const firebaseConfig = {
//   apiKey: "AIzaSyC_E7rGBeWLl_Iqz9bU9Qgtr7NCtWUqqtM",
//   authDomain: "major-project-cd81d.firebaseapp.com",
//   projectId: "major-project-cd81d",
//   storageBucket: "major-project-cd81d.appspot.com",
//   messagingSenderId: "983228819232",
//   appId: "1:983228819232:web:1a6ab13d6eff48b7c85945",
//   measurementId: "G-DDEP54J8DS"
// };

// const app = initializeApp(firebaseConfig);

// export const auth = getAuth(app);
// export const googleProvider = new GoogleAuthProvider();
// export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
// export const db = getFirestore(app);

// //haha1



//src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC_E7rGBeWLl_Iqz9bU9Qgtr7NCtWUqqtM",
  authDomain: "major-project-cd81d.firebaseapp.com",
  projectId: "major-project-cd81d",
  storageBucket: "major-project-cd81d.appspot.com",
  messagingSenderId: "983228819232",
  appId: "1:983228819232:web:1a6ab13d6eff48b7c85945",
  measurementId: "G-DDEP54J8DS"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const db = getFirestore(app);

//haha1
