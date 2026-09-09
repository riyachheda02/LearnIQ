import { useTheme } from "../context/ThemeContext";
import { useState, useEffect } from "react";
import { db, auth } from "../firebase";

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

export default function About() {
  const { theme } = useTheme();

  const [reviewText, setReviewText] = useState("");
  const [rating, setRating] = useState(0);
  const [reviews, setReviews] = useState([]);
  const [editingId, setEditingId] = useState(null);

  const user = auth.currentUser;

  const reviewsRef = collection(db, "reviews");

  // Fetch reviews in realtime
  useEffect(() => {
    const q = query(reviewsRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(q, (snapshot) => {
      setReviews(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
      );
    });

    return () => unsub();
  }, []);

  // Add or Update Review
  const handleSubmit = async () => {
    if (!reviewText || rating === 0) return;

    try {
      if (editingId) {
        const reviewDoc = doc(db, "reviews", editingId);

        await updateDoc(reviewDoc, {
          reviewText,
          rating,
        });

        setEditingId(null);
      } else {
        await addDoc(reviewsRef, {
          userId: user.uid,
          userName: user.displayName || user.email,
          reviewText,
          rating,
          createdAt: serverTimestamp(),
        });
      }

      setReviewText("");
      setRating(0);
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Review
  const handleDelete = async (id) => {
    await deleteDoc(doc(db, "reviews", id));
  };

  // Edit Review
  const handleEdit = (review) => {
    setReviewText(review.reviewText);
    setRating(review.rating);
    setEditingId(review.id);
  };

  // Star UI
  const renderStars = (value, clickable = false) => {
    return [...Array(5)].map((_, i) => (
      <span
        key={i}
        onClick={() => clickable && setRating(i + 1)}
        style={{
          cursor: clickable ? "pointer" : "default",
          color: i < value ? "#facc15" : "#9ca3af",
          fontSize: "clamp(16px, 5vw, 20px)",
        }}
      >
        ★
      </span>
    ));
  };

  return (
    <div
      className="p-3 sm:p-4 md:p-6 lg:p-8 min-h-screen"
      style={{
        background: theme.background,
        color: theme.textPrimary,
      }}
    >
      <h1
        className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-5 md:mb-6"
        style={{ color: theme.textPrimary }}
      >
        About Us
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 md:gap-6 lg:gap-8">
        {/* Company Info */}
        <div
          className="p-4 sm:p-5 md:p-6 rounded-xl"
          style={{
            background: theme.card,
            border: `1px solid ${theme.border}`,
          }}
        >
          <h2
            className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4"
            style={{ color: theme.textPrimary }}
          >
            Our Mission
          </h2>
          <p className="mb-3 sm:mb-4 text-sm sm:text-base" style={{ color: theme.textSecondary }}>
            We are dedicated to creating innovative AI solutions that empower
            individuals and businesses to achieve more. Our AI Assistant is
            designed to be your reliable partner in productivity and creativity.
          </p>
          <p className="text-sm sm:text-base" style={{ color: theme.textSecondary }}>
            With cutting-edge technology and user-centric design, we strive to
            make AI accessible and beneficial for everyone.
          </p>
        </div>

        {/* Features */}
        <div
          className="p-4 sm:p-5 md:p-6 rounded-xl"
          style={{
            background: theme.card,
            border: `1px solid ${theme.border}`,
          }}
        >
          <h2
            className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4"
            style={{ color: theme.textPrimary }}
          >
            What We Offer
          </h2>
          <ul
            className="space-y-2 sm:space-y-3 text-sm sm:text-base"
            style={{ color: theme.textSecondary }}
          >
            <li className="flex items-center flex-wrap">
              <span className="mr-2 sm:mr-3">✨</span>
              Advanced AI-powered conversations
            </li>
            <li className="flex items-center flex-wrap">
              <span className="mr-2 sm:mr-3">🔒</span>
              Secure and private data handling
            </li>
            <li className="flex items-center flex-wrap">
              <span className="mr-2 sm:mr-3">📁</span>
              Intelligent file organization
            </li>
            <li className="flex items-center flex-wrap">
              <span className="mr-2 sm:mr-3">🌐</span>
              Multi-platform accessibility
            </li>
            <li className="flex items-center flex-wrap">
              <span className="mr-2 sm:mr-3">⚡</span>
              Lightning-fast responses
            </li>
          </ul>
        </div>
      </div>

      {/* Team Section */}
      <div
        className="mt-6 sm:mt-7 md:mt-8 p-4 sm:p-5 md:p-6 rounded-xl"
        style={{
          background: theme.card,
          border: `1px solid ${theme.border}`,
        }}
      >
        <h2
          className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 sm:mb-5 md:mb-6"
          style={{ color: theme.textPrimary }}
        >
          Our Team
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 md:gap-6">

          <div className="text-center">
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-2 sm:mb-3 rounded-full flex items-center justify-center text-white font-bold text-lg sm:text-xl"
              style={{ background: theme.gradientPrimary }}
            >
              BG
            </div>
            <h3 className="font-semibold text-sm sm:text-base" style={{ color: theme.textPrimary }}>
              Bhoomi Gupta
            </h3>
            <p className="text-xs sm:text-sm" style={{ color: theme.textSecondary }}>
              Founder & AI Integrater
            </p>
          </div>

          <div className="text-center">
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-2 sm:mb-3 rounded-full flex items-center justify-center text-white font-bold text-lg sm:text-xl"
              style={{ background: theme.gradientPrimary }}
            >
              RC
            </div>
            <h3 className="font-semibold text-sm sm:text-base" style={{ color: theme.textPrimary }}>
              Riya Chheda
            </h3>
            <p className="text-xs sm:text-sm" style={{ color: theme.textSecondary }}>
              Founder & Lead Developer
            </p>
          </div>

          <div className="text-center">
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-2 sm:mb-3 rounded-full flex items-center justify-center text-white font-bold text-lg sm:text-xl"
              style={{ background: theme.gradientPrimary }}
            >
              GM
            </div>
            <h3 className="font-semibold text-sm sm:text-base" style={{ color: theme.textPrimary }}>
              Girisha Mestry
            </h3>
            <p className="text-xs sm:text-sm" style={{ color: theme.textSecondary }}>
              Founder & Navi-Developer
            </p>
          </div>

          <div className="text-center">
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-2 sm:mb-3 rounded-full flex items-center justify-center text-white font-bold text-lg sm:text-xl"
              style={{ background: theme.gradientPrimary }}
            >
              DS
            </div>
            <h3 className="font-semibold text-sm sm:text-base" style={{ color: theme.textPrimary }}>
              Dhanuja Shukla
            </h3>
            <p className="text-xs sm:text-sm" style={{ color: theme.textSecondary }}>
              Founder & Employee
            </p>
          </div>

        </div>
      </div>

      {/* Contact Info */}
      <div
        className="mt-6 sm:mt-7 md:mt-8 p-4 sm:p-5 md:p-6 rounded-xl"
        style={{
          background: theme.card,
          border: `1px solid ${theme.border}`,
        }}
      >
        <h2
          className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4"
          style={{ color: theme.textPrimary }}
        >
          Get In Touch
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
          <div>
            <h3
              className="font-semibold mb-1.5 sm:mb-2 text-sm sm:text-base"
              style={{ color: theme.textPrimary }}
            >
              Email
            </h3>
            <p className="text-sm sm:text-base break-all" style={{ color: theme.textSecondary }}>
              internship081@gmail.com
            </p>
          </div>

          <div>
            <h3
              className="font-semibold mb-1.5 sm:mb-2 text-sm sm:text-base"
              style={{ color: theme.textPrimary }}
            >
              Support
            </h3>
            <p className="text-sm sm:text-base" style={{ color: theme.textSecondary }}>
              Available 24/7 for all users
            </p>
          </div>
        </div>
      </div>

      {/* ================= REVIEW SECTION ================= */}

      <div
        className="mt-6 sm:mt-7 md:mt-8 p-4 sm:p-5 md:p-6 rounded-xl"
        style={{
          background: theme.card,
          border: `1px solid ${theme.border}`,
        }}
      >
        <h2
          className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4"
          style={{ color: theme.textPrimary }}
        >
          User Reviews
        </h2>

        {user && (
          <div className="mb-4 sm:mb-5 md:mb-6">

            <div className="mb-2">{renderStars(rating, true)}</div>

            <textarea
              className="w-full p-2.5 sm:p-3 rounded-lg mb-3 text-sm sm:text-base"
              rows="3"
              style={{
                background: theme.background,
                border: `1px solid ${theme.border}`,
                color: theme.textPrimary,
              }}
              placeholder="Write your review..."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
            />

            <button
              onClick={handleSubmit}
              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm sm:text-base transition-opacity hover:opacity-90 active:opacity-80"
              style={{
                background: theme.gradientPrimary,
                color: "white",
              }}
            >
              {editingId ? "Update Review" : "Submit Review"}
            </button>

          </div>
        )}

        <div className="space-y-3 sm:space-y-4">

          {reviews.map((review) => (

            <div
              key={review.id}
              className="p-3 sm:p-4 rounded-lg"
              style={{
                background: theme.background,
                border: `1px solid ${theme.border}`,
              }}
            >

              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">

                <h3
                  className="font-semibold text-sm sm:text-base truncate"
                  style={{ color: theme.textPrimary }}
                >
                  {review.userName}
                </h3>

                <div className="flex-shrink-0">{renderStars(review.rating)}</div>

              </div>

              <p className="text-sm sm:text-base break-words" style={{ color: theme.textSecondary }}>
                {review.reviewText}
              </p>

              {user && review.userId === user.uid && (

                <div className="mt-2 sm:mt-3 space-x-3 sm:space-x-4">

                  <button
                    onClick={() => handleEdit(review)}
                    style={{ color: "#3b82f6" }}
                    className="text-sm sm:text-base hover:underline"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => handleDelete(review.id)}
                    style={{ color: "#ef4444" }}
                    className="text-sm sm:text-base hover:underline"
                  >
                    Delete
                  </button>

                </div>

              )}

            </div>

          ))}

          {reviews.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm sm:text-base" style={{ color: theme.textSecondary }}>
                No reviews yet. Be the first to share your experience!
              </p>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}