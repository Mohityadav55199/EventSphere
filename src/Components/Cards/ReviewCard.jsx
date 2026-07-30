import React, { useEffect, useState } from "react";
import { Star, Edit, Trash2 } from "lucide-react";
import { deleteReview, getEventReviews } from "../../services/reviewservices/reviewapi";
import ReviewForm from "./PostReview";

function ReviewCard({ eventId }) {
  const [reviewsData, setReviewsData] = useState(null);
  const [editingReview, setEditingReview] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [expandedReviews, setExpandedReviews] = useState({}); // track expanded comments

  // ✅ Get current user id from token or localStorage
  useEffect(() => {
    const userId = localStorage.getItem("userId"); // store userId at login
    setCurrentUserId(userId);
  }, []);

  // ✅ Fetch reviews
  const fetchReviews = async () => {
    try {
      const res = await getEventReviews(eventId);
      setReviewsData(res.data); // { average, totalReviews, reviews }
    } catch (error) {
      console.error("Error fetching reviews:", error);
    }
  };

  useEffect(() => {
    if (eventId) fetchReviews();
  }, [eventId]);

  // ✅ Delete review
  const handleDelete = async (reviewId) => {
    try {
      await deleteReview(reviewId);
      fetchReviews(); // refresh after delete
    } catch (err) {
      console.error("Error deleting review:", err);
    }
  };

  // ✅ Toggle expand/collapse for a review
  const toggleExpand = (id) => {
    setExpandedReviews((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  if (!reviewsData) return null;

  return (
    <div className=" bg-transparent text-slate-200 shadow-xl rounded-2xl p-4 lg:w-[28rem] z-50 border">
      {/* Header */}
      <div className="flex  items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Reviews</h2>
        <div className="flex items-center space-x-1">
          {[...Array(5)].map((_, idx) => (
            <Star
              key={idx}
              size={18}
              className={`${
                idx < Math.round(reviewsData.average)
                  ? "text-yellow-500 fill-yellow-500"
                  : "text-gray-300"
              }`}
            />
          ))}
          <span className="text-sm text-gray-400">
            ({reviewsData.totalReviews})
          </span>
        </div>
      </div>

      {/* Scrollable reviews list */}
      <div className="max-h-64 overflow-y-auto space-y-3 pr-2">
        {reviewsData.reviews.length > 0 ? (
          reviewsData.reviews.map((review) => {
            const isExpanded = expandedReviews[review._id];
            const isLong = review.comment.length > 150; // threshold for truncation

            return (
              <div
                key={review._id}
                className="bg-gray-50 text-gray-800 rounded-xl p-3 shadow-md relative"
              >
                {/* Rating */}
                <div className="flex items-center mb-1">
                  {[...Array(5)].map((_, idx) => (
                    <Star
                      key={idx}
                      size={14}
                      className={`${
                        idx < review.rating
                          ? "text-yellow-500 fill-yellow-500"
                          : "text-gray-300"
                      }`}
                    />
                  ))}
                </div>

                {/* Comment */}
                <p
                  className={`text-sm italic  break-words whitespace-pre-wrap  ${
                    !isExpanded && isLong ? "line-clamp-3" : ""
                  }`}
                >
                  "{review.comment}"
                </p>

                {/* Show More / Less */}
                {isLong && (
                  <button
                    onClick={() => toggleExpand(review._id)}
                    className="text-xs text-black  underline mt-1"
                  >
                    {isExpanded ? "Show less" : "Read more"}
                  </button>
                )}

                {/* User */}
                <p className="mt-1 text-xs text-gray-500 text-right">
                  – {(review.user?.name).toUpperCase() || "Anonymous"}
                </p>

                {/* Edit + Delete buttons (only if current user is the author) */}
                {currentUserId === review.user?._id && (
                  <div className="flex space-x-2 absolute top-2 right-2">
                    <button
                      onClick={() => setEditingReview(review)}
                      className="p-1 rounded hover:bg-gray-200"
                    >
                      <Edit size={14} className="text-blue-600" />
                    </button>
                    <button
                      onClick={() => handleDelete(review._id)}
                      className="p-1 rounded hover:bg-gray-200"
                    >
                      <Trash2 size={14} className="text-red-600" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <p className="text-gray-400 text-sm">No reviews yet.</p>
        )}
      </div>

      {/* Edit Form (inline modal style) */}
      {editingReview && (
        <div className="mt-4 border-t border-gray-600 pt-4">
          <h3 className="text-sm font-semibold mb-2">Edit Your Review</h3>
          <ReviewForm
            eventId={eventId}
            onSuccess={() => {
              setEditingReview(null);
              fetchReviews();
            }}
            initialData={editingReview} // pass down to prefill
          />
          <button
            className="mt-2 text-xs text-red-400 underline"
            onClick={() => setEditingReview(null)}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

export default ReviewCard;
