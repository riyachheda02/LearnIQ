// import React, { useState } from "react";
// import { useNavigate } from "react-router-dom";
// import { createUserWithEmailAndPassword } from "firebase/auth";
// import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
// import { auth, db, signInWithGoogle } from "./firebase";
// import lightLogo from "./assets/ff_light_logo.png";

// export default function Register() {
//   const navigate = useNavigate();
//   const [username, setUsername] = useState("");  
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");

//   const handleRegister = async (e) => {
//     e.preventDefault();
//     try {
//       const userCredential = await createUserWithEmailAndPassword(auth, email, password);
//       const user = userCredential.user;
//       await setDoc(doc(db, "users", user.uid), {
//         uid: user.uid,
//         username: username,
//         email: email,
//         createdAt: serverTimestamp(),
//         createdServers: [],
//         joinedServers: [],
//       });
//       navigate("/dashboard");
//     } catch (err) {
//       alert("Registration Failed: " + err.message);
//     }
//   };

//   const handleGoogleLogin = async () => {
//     try {
//       const result = await signInWithGoogle();
//       const user = result.user;
//       const userRef = doc(db, "users", user.uid);
//       const snap = await getDoc(userRef);
//       if (!snap.exists()) {
//         await setDoc(userRef, {
//           uid: user.uid,
//           username: user.displayName || user.email.split("@")[0],
//           email: user.email,
//           createdAt: serverTimestamp(),
//           createdServers: [],
//           joinedServers: [],
//         });
//       }
//       navigate("/DashBoard");
//     } catch (err) {
//       alert("Google Login Failed: " + err.message);
//     }
//   };

//   return (
//     <div className="h-screen flex items-center justify-center bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 relative overflow-hidden">
//       {/* Decorative circles */}
//       <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-white opacity-10 rounded-full blur-3xl"></div>
//       <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-black opacity-10 rounded-full blur-3xl"></div>

//       <div className="bg-white/90 backdrop-blur-md p-8 rounded-2xl shadow-2xl w-full max-w-md z-10 border border-white/50">
//         <div className="flex justify-center mb-6">
//           <img src={lightLogo} alt="Focus Forge" className="h-16 object-contain" />
//         </div>
//         <h2 className="text-3xl font-bold text-center mb-2 text-gray-800">Create Account</h2>
//         <p className="text-center text-gray-500 mb-6">Join us and start your journey</p>

//         {/* <form onSubmit={handleRegister} className="flex flex-col space-y-4">
//           <input
//             type="text"
//             placeholder="Username"
//             className="p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 transition-all"
//             value={username}
//             onChange={(e) => setUsername(e.target.value)}
//           />

//           <input
//             type="email"
//             placeholder="Email"
//             className="p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 transition-all"
//             value={email}
//             onChange={(e) => setEmail(e.target.value)}
//           />

//           <input
//             type="password"
//             placeholder="Password"
//             className="p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 transition-all"
//             value={password}
//             onChange={(e) => setPassword(e.target.value)}
//           />

//           <button
//             type="submit"
//             className="bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition shadow-lg transform active:scale-95"
//           >
//             Register
//           </button>
//         </form>

//         <div className="my-6 flex items-center">
//           <div className="flex-grow border-t border-gray-300"></div>
//           <span className="mx-4 text-gray-500 text-sm">OR</span>
//           <div className="flex-grow border-t border-gray-300"></div>
//         </div> */}

//         <button
//           onClick={handleGoogleLogin}
//           className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition shadow-sm"
//         >
//           <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
//           Sign up with Google
//         </button>

//         <p className="text-center mt-6 text-gray-600">
//           Already have an account?{" "}
//           <span
//             onClick={() => navigate("/login")}
//             className="text-purple-600 font-bold cursor-pointer hover:underline"
//           >
//             Login
//           </span>
//         </p>
//       </div>
//     </div>
//   );
// }

// //haha1



import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, signInWithGoogle } from "./firebase";
import lightLogo from "./assets/ff_light_logo.png";

export default function Register() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        username: username,
        email: email,
        createdAt: serverTimestamp(),
        createdServers: [],
        joinedServers: [],
      });
      navigate("/dashboard");
    } catch (err) {
      alert("Registration Failed: " + err.message);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithGoogle();
      const user = result.user;
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          username: user.displayName || user.email.split("@")[0],
          email: user.email,
          createdAt: serverTimestamp(),
          createdServers: [],
          joinedServers: [],
        });
      }
      navigate("/DashBoard");
    } catch (err) {
      alert("Google Login Failed: " + err.message);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 relative overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-white opacity-10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-black opacity-10 rounded-full blur-3xl"></div>

      <div className="bg-white/90 backdrop-blur-md p-8 rounded-2xl shadow-2xl w-full max-w-md z-10 border border-white/50">
        <div className="flex justify-center mb-6">
          <img src={lightLogo} alt="Focus Forge" className="h-16 object-contain" />
        </div>
        <h2 className="text-3xl font-bold text-center mb-2 text-gray-800">Create Account</h2>
        <p className="text-center text-gray-500 mb-6">Join us and start your journey</p>

        {/* <form onSubmit={handleRegister} className="flex flex-col space-y-4">
          <input
            type="text"
            placeholder="Username"
            className="p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <input
            type="email"
            placeholder="Email"
            className="p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            className="p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            type="submit"
            className="bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition shadow-lg transform active:scale-95"
          >
            Register
          </button>
        </form>

        <div className="my-6 flex items-center">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="mx-4 text-gray-500 text-sm">OR</span>
          <div className="flex-grow border-t border-gray-300"></div>
        </div> */}

        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition shadow-sm"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
          Sign up with Google
        </button>

        <p className="text-center mt-6 text-gray-600">
          Already have an account?{" "}
          <span
            onClick={() => navigate("/login")}
            className="text-purple-600 font-bold cursor-pointer hover:underline"
          >
            Login
          </span>
        </p>
      </div>
    </div>
  );
}

//haha1