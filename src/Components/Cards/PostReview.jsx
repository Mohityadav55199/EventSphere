import { useState, useEffect } from "react";
import { postReview, updateReview } from "../../services/reviewservices/reviewapi";
import { toast, ToastContainer } from "react-toastify";

const ReviewForm = ({ eventId, onSuccess, initialData = null }) => {
  const [rating, setRating] = useState(initialData?.rating || 0);
  const [comment, setComment] = useState(initialData?.comment || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sync state when initialData changes
  useEffect(() => {
    if (initialData) {
      setRating(initialData.rating);
      setComment(initialData.comment);
    } else {
      setRating(0);
      setComment("");
    }
  }, [initialData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let res;
      if (initialData) {
        res = await updateReview(initialData._id, { rating, comment });
      } else {
        res = await postReview(eventId, { rating, comment });
      }

      if (!initialData) {
        setRating(0);
        setComment("");
      }

      if (onSuccess) onSuccess(res);

      toast.success(`Review ${initialData ? "updated" : "posted"} successfully`);
      window.location.reload();
    } catch (err) {
      setError(err?.message || "Something went wrong");
      toast.error(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <ToastContainer autoClose={3000} position="top-center"  />
    <form
      onSubmit={handleSubmit}
      className=" bg-transparent text-slate-200 rounded-2xl w-full shadow-md space-y-4"
    >
      <h2 className="text-lg font-semibold">
        {initialData ? "Edit Review" : "Post a Review"}
      </h2>

      {/* Rating */}
      <div>
        <label className="block text-sm mb-1">Rating (1–5)</label>
        <select
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          className="border rounded-lg p-2 w-full text-slate-200"
          required
        >
          <option value={0} style={{ backgroundColor: "black" }} >Select rating</option>
          {[1, 2, 3, 4, 5].map((r) => (
            <option key={r} value={r} style={{ backgroundColor: "black" }}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {/* Comment */}
      <div>
        <label className="block text-sm mb-1">Comment</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="border border-slate-200 text-slate-200 rounded-lg p-2 w-full"
          rows="3"
          required
        />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {loading
          ? initialData
            ? "Updating..."
            : "Submitting..."
          : initialData
          ? "Update Review"
          : "Submit Review"}
      </button>
    </form>
    </>
  );
};

export default ReviewForm;
