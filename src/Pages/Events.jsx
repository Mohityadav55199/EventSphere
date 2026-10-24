import React, { useEffect, useState, useMemo } from 'react';
import { getAllEvents, getAllEventsByAdmin } from '../services/eventservices/eventapi';
import { Link, useSearchParams } from 'react-router-dom';
import { EventCard } from '../Components/Cards/EventCard';
import SkeletonCard from '../Components/SkeletonCard';
import { useSelector } from 'react-redux';
import { useSearch } from '../Context/SearchContext';
import {
  SlidersHorizontal,
  Calendar,
  IndianRupee,
  Search,
  X,
  RotateCcw,
  Sparkles,
  ArrowUpDown,
  Tag,
  Filter
} from 'lucide-react';

const PAGE_SIZE = 9;

const CATEGORIES = [
  "All",
  "Music",
  "Workshop",
  "Conference",
  "Movie",
  "Sports",
  "Tech",
  "Networking"
];

const DATE_OPTIONS = [
  { id: "any", label: "Any Date" },
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "weekend", label: "This Weekend" },
  { id: "month", label: "This Month" },
  { id: "custom", label: "Custom Date" },
];

function isSameDay(d1, d2) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function isThisWeekend(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();

  const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
  const diffToSaturday = currentDay === 0 ? -1 : 6 - currentDay;

  const saturday = new Date(now);
  saturday.setDate(now.getDate() + diffToSaturday);
  saturday.setHours(0, 0, 0, 0);

  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);
  sunday.setHours(23, 59, 59, 999);

  return d >= saturday && d <= sunday;
}

function isThisMonth(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const user = useSelector((state) => state.auth.user);

  // Search context integration & local page search isolation
  const { searchQuery, setSearchQuery } = useSearch();
  const [searchParams] = useSearchParams();
  const [eventSearch, setEventSearch] = useState("");

  // Populate from URL query or incoming navigation search query once, then decouple
  useEffect(() => {
    const urlQuery = searchParams.get("search");
    if (urlQuery !== null && urlQuery !== undefined) {
      setEventSearch(urlQuery);
    } else if (searchQuery) {
      setEventSearch(searchQuery);
      if (setSearchQuery) setSearchQuery("");
    }
  }, [searchParams]);

  // Filter states
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [priceType, setPriceType] = useState("all"); // 'all' | 'free' | 'paid'
  const [maxPrice, setMaxPrice] = useState(5000);
  const [dateFilter, setDateFilter] = useState("any");
  const [customDate, setCustomDate] = useState("");
  const [sortBy, setSortBy] = useState("upcoming"); // 'upcoming' | 'priceAsc' | 'priceDesc' | 'rating'
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const fetchEventsFunc = user?.role === "admin" ? getAllEventsByAdmin : getAllEvents;
        const response = await fetchEventsFunc();
        const eventData = response.data || [];
        setEvents(eventData);

        // Dynamically compute max price ceiling from events
        if (eventData.length > 0) {
          const highest = Math.max(...eventData.map(e => Number(e.Price) || 0), 2000);
          setMaxPrice(highest);
        }
      } catch (error) {
        console.error("Failed to load events:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [user]);

  // Start from the first page again whenever the result set changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [eventSearch, selectedCategory, priceType, maxPrice, dateFilter, customDate, sortBy]);

  // Determine highest price bound for slider
  const dynamicMaxPrice = useMemo(() => {
    if (!events.length) return 5000;
    const highest = Math.max(...events.map(e => Number(e.Price) || 0));
    return highest > 0 ? highest : 5000;
  }, [events]);

  // Reset all filters to default
  const handleResetFilters = () => {
    setSelectedCategory("All");
    setPriceType("all");
    setMaxPrice(dynamicMaxPrice);
    setDateFilter("any");
    setCustomDate("");
    setSortBy("upcoming");
    setEventSearch("");
  };

  // Count active non-default filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategory !== "All") count++;
    if (priceType !== "all") count++;
    if (maxPrice < dynamicMaxPrice) count++;
    if (dateFilter !== "any") count++;
    if (eventSearch && eventSearch.trim() !== "") count++;
    return count;
  }, [selectedCategory, priceType, maxPrice, dynamicMaxPrice, dateFilter, eventSearch]);

  // Main filter and sort computation
  const filteredAndSortedEvents = useMemo(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);

    const result = events.filter((event) => {
      const eventPrice = Number(event.Price) || 0;
      const eventDate = event.date ? new Date(event.date) : null;

      // 1. Search Query
      if (eventSearch && eventSearch.trim() !== "") {
        const q = eventSearch.toLowerCase().trim();
        const titleMatch = event.title?.toLowerCase().includes(q);
        const descMatch = event.description?.toLowerCase().includes(q);
        const locMatch = event.location?.toLowerCase().includes(q);
        const catMatch = event.category?.toLowerCase().includes(q);
        if (!titleMatch && !descMatch && !locMatch && !catMatch) return false;
      }

      // 2. Category
      if (selectedCategory !== "All") {
        if (event.category?.toLowerCase() !== selectedCategory.toLowerCase()) {
          return false;
        }
      }

      // 3. Price Type (Free vs Paid)
      if (priceType === "free" && eventPrice > 0) return false;
      if (priceType === "paid" && eventPrice === 0) return false;

      // 4. Price Range Slider
      if (priceType !== "free" && eventPrice > maxPrice) return false;

      // 5. Date Filter
      if (dateFilter === "today") {
        if (!eventDate || !isSameDay(eventDate, now)) return false;
      } else if (dateFilter === "tomorrow") {
        if (!eventDate || !isSameDay(eventDate, tomorrow)) return false;
      } else if (dateFilter === "weekend") {
        if (!isThisWeekend(event.date)) return false;
      } else if (dateFilter === "month") {
        if (!isThisMonth(event.date)) return false;
      } else if (dateFilter === "custom" && customDate) {
        const target = new Date(customDate);
        if (!eventDate || !isSameDay(eventDate, target)) return false;
      }

      return true;
    });

    // 6. Sorting
    return result.sort((a, b) => {
      if (sortBy === "priceAsc") {
        return (Number(a.Price) || 0) - (Number(b.Price) || 0);
      }
      if (sortBy === "priceDesc") {
        return (Number(b.Price) || 0) - (Number(a.Price) || 0);
      }
      if (sortBy === "rating") {
        return (Number(b.avgRating) || 0) - (Number(a.avgRating) || 0);
      }
      // Default: "upcoming" - soonest date first
      const dateA = a.date ? new Date(a.date).getTime() : Infinity;
      const dateB = b.date ? new Date(b.date).getTime() : Infinity;
      return dateA - dateB;
    });
  }, [events, eventSearch, selectedCategory, priceType, maxPrice, dateFilter, customDate, sortBy]);

  // Sidebar filter markup
  const FilterSidebarContent = (
    <div className="space-y-6">
      {/* Header with Reset */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
          <h2 className="font-bold text-slate-900 text-sm tracking-tight">Filter Events</h2>
          {activeFilterCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button
            onClick={handleResetFilters}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        )}
      </div>

      {/* Ticket Price Type (Free vs Paid) */}
      <div className="space-y-2.5">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <IndianRupee className="w-3.5 h-3.5 text-indigo-500" />
          Ticket Type
        </label>
        <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl">
          {[
            { id: "all", label: "All" },
            { id: "free", label: "Free" },
            { id: "paid", label: "Paid" }
          ].map((type) => (
            <button
              key={type.id}
              onClick={() => setPriceType(type.id)}
              className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                priceType === type.id
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Price Slider (Only active if not strictly 'Free') */}
      {priceType !== "free" && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Max Price
            </label>
            <span className="text-xs font-extrabold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
              Up to ₹{maxPrice.toLocaleString("en-IN")}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max={dynamicMaxPrice}
            step="50"
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
          <div className="flex justify-between text-[11px] text-slate-400 font-medium">
            <span>₹0</span>
            <span>₹{dynamicMaxPrice.toLocaleString("en-IN")}</span>
          </div>
        </div>
      )}

      {/* Date Filters */}
      <div className="space-y-2.5">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-indigo-500" />
          Date & Timing
        </label>
        <div className="flex flex-wrap gap-1.5">
          {DATE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setDateFilter(opt.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                dateFilter === opt.id
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {dateFilter === "custom" && (
          <div className="pt-2">
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="w-full text-xs font-medium bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}
      </div>

      {/* Categories in Sidebar */}
      <div className="space-y-2.5">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-indigo-500" />
          Categories
        </label>
        <div className="space-y-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`w-full text-left px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-between transition-colors ${
                selectedCategory === cat
                  ? "bg-indigo-50 text-indigo-700 font-bold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span>{cat}</span>
              {selectedCategory === cat && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 py-8 px-4 sm:px-6 md:px-10 lg:px-16">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Page Hero Header */}
        <div className="text-center space-y-2.5 max-w-2xl mx-auto pt-2">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-indigo-100/80 text-indigo-700 border border-indigo-200/60 shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Discover Unforgettable Moments</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Explore Live Events & Experiences
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Real-time seat reservation, dynamic QR passes, instant rewards & community chat.
          </p>
        </div>

        {/* Top Search & Filter Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full md:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by title, venue, or keyword..."
              value={eventSearch}
              onChange={(e) => setEventSearch(e.target.value)}
              className="w-full pl-10 pr-9 py-2 text-xs sm:text-sm bg-slate-50 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
            {eventSearch && (
              <button
                onClick={() => setEventSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Actions (Category Pills + Mobile Filter Toggle + Sort) */}
          <div className="flex items-center justify-between w-full md:w-auto gap-2.5">
            {/* Mobile Filter Toggle */}
            <button
              onClick={() => setIsMobileFilterOpen(true)}
              className="lg:hidden flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200/70"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold ml-0.5">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 ml-auto md:ml-0">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0 hidden sm:block" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
              >
                <option value="upcoming">Upcoming Soonest</option>
                <option value="priceAsc">Price: Low to High</option>
                <option value="priceDesc">Price: High to Low</option>
                <option value="rating">Top Rated</option>
              </select>
            </div>
          </div>
        </div>

        {/* Quick Horizontal Category Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all shrink-0 ${
                selectedCategory === cat
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 scale-105"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Active Filters Badges */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-slate-400 font-medium">Active filters:</span>
            {selectedCategory !== "All" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold">
                Category: {selectedCategory}
                <button onClick={() => setSelectedCategory("All")} className="hover:text-indigo-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {priceType !== "all" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold">
                {priceType === "free" ? "Free Events" : "Paid Events"}
                <button onClick={() => setPriceType("all")} className="hover:text-indigo-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {priceType !== "free" && maxPrice < dynamicMaxPrice && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold">
                Under ₹{maxPrice.toLocaleString("en-IN")}
                <button onClick={() => setMaxPrice(dynamicMaxPrice)} className="hover:text-indigo-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {dateFilter !== "any" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold">
                Date: {DATE_OPTIONS.find(o => o.id === dateFilter)?.label || dateFilter}
                <button onClick={() => { setDateFilter("any"); setCustomDate(""); }} className="hover:text-indigo-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {eventSearch && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold">
                Search: &quot;{eventSearch}&quot;
                <button onClick={() => setEventSearch("")} className="hover:text-indigo-900">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
            <button
              onClick={handleResetFilters}
              className="text-indigo-600 font-bold hover:underline ml-1"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Main Content Layout: Sidebar + Events Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          
          {/* Desktop Filter Sidebar */}
          <aside className="hidden lg:block lg:col-span-1 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs sticky top-24">
            {FilterSidebarContent}
          </aside>

          {/* Events Grid Area */}
          <main className="lg:col-span-3 space-y-4">
            {/* Results Counter Header */}
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>
                Showing <strong className="text-slate-900">{filteredAndSortedEvents.length}</strong> events
              </span>
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
              ) : filteredAndSortedEvents.length > 0 ? (
                filteredAndSortedEvents.slice(0, visibleCount).map((event) => (
                  <Link key={event._id} to={`/event/${event._id}`}>
                    <EventCard
                      id={event._id}
                      organizer={event.organizer?.name || "EventSphere"}
                      image={event.image}
                      title={event.title}
                      description={event.description}
                      date={event.date}
                      location={event.location}
                      avgRating={event.avgRating}
                      price={event.Price}
                      category={event.category}
                    />
                  </Link>
                ))
              ) : (
                <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-slate-200 p-8 shadow-xs">
                  <div className="w-12 h-12 mx-auto rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                    <Filter className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">No events found matching your filters</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    Try adjusting your price ceiling, date selection, or category pills to see more experiences.
                  </p>
                  <button
                    onClick={handleResetFilters}
                    className="mt-4 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition shadow-sm shadow-indigo-200"
                  >
                    Reset All Filters
                  </button>
                </div>
              )}
            </div>

            {/* Load more: renders events in pages of PAGE_SIZE so long lists stay fast */}
            {!loading && filteredAndSortedEvents.length > visibleCount && (
              <div className="pt-2 text-center">
                <button
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className="px-6 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-bold text-indigo-600 hover:bg-indigo-50 transition shadow-xs"
                >
                  Load more ({filteredAndSortedEvents.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </main>
        </div>

        {/* Mobile Filter Drawer Modal */}
        {isMobileFilterOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4">
            <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="font-bold text-slate-900 text-base">Filters</span>
                <button
                  onClick={() => setIsMobileFilterOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {FilterSidebarContent}

              <div className="pt-4 border-t border-slate-100 flex gap-2">
                <button
                  onClick={handleResetFilters}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Reset
                </button>
                <button
                  onClick={() => setIsMobileFilterOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition shadow-sm shadow-indigo-200"
                >
                  Show {filteredAndSortedEvents.length} Events
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default Events;
