import React from "react";
import { Calendar, Star, MapPin, Heart } from "lucide-react";
import useWishlist from "../../hooks/useWishlist";
import { optimizeImage } from "../../lib/image";

export function EventCard({
  id,
  image,
  title,
  description,
  date,
  location,
  avgRating,
  price,
  category
}) {
  const { isSaved, toggle } = useWishlist();
  const saved = id ? isSaved(id) : false;

  return (
    <div className="group bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col justify-between hover:-translate-y-1">
      {/* Image Header */}
      <div className="relative h-48 w-full overflow-hidden bg-slate-100">
        <img
          src={optimizeImage(image, 600) || "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=600&q=80"}
          alt={title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-3 left-3 bg-indigo-600/90 backdrop-blur-md text-white text-xs font-semibold px-3 py-1 rounded-full shadow">
          {category || "Event"}
        </div>
        {id && (
          <button
            type="button"
            onClick={(e) => {
              // The card sits inside a <Link>; don't navigate when saving
              e.preventDefault();
              e.stopPropagation();
              toggle(id);
            }}
            aria-pressed={saved}
            aria-label={saved ? `Remove ${title} from saved events` : `Save ${title}`}
            className="absolute bottom-3 right-3 p-2 rounded-full bg-white/90 backdrop-blur-md shadow hover:scale-110 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <Heart className={`w-4 h-4 ${saved ? "fill-rose-500 text-rose-500" : "text-slate-500"}`} />
          </button>
        )}
        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md text-slate-800 text-xs font-bold px-2.5 py-1 rounded-full shadow flex items-center gap-1">
          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
          <span>{avgRating || "4.8"}</span>
        </div>
      </div>

      {/* Body Content */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-2">
          <div className="flex items-center text-xs font-medium text-indigo-600 gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>{date ? new Date(date).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }) : "Upcoming"}</span>
          </div>
          <h3 className="font-bold text-lg text-slate-900 line-clamp-1 group-hover:text-indigo-600 transition-colors">
            {title}
          </h3>
          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
            {description}
          </p>
        </div>

        {/* Footer info */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-slate-500 line-clamp-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate max-w-[120px]">{location || "Venue"}</span>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400 block">Price</span>
            <span className="text-base font-extrabold text-indigo-600">₹{price}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
