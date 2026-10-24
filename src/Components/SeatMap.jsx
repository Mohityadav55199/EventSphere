import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper for tailwind classes
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

function SeatMap({ 
  capacity = 100, 
  bookedSeats = [], 
  heldSeats = [], 
  selectedSeats = [], 
  onSeatToggle,
  maxSelectable = 10
}) {
  const columns = 10;
  const rows = Math.min(Math.ceil(capacity / columns), 10);
  
  const getSeatId = (rowIndex, colIndex) => {
    const rowLetter = String.fromCharCode(65 + rowIndex);
    const colNumber = colIndex + 1;
    return `${rowLetter}${colNumber}`;
  };

  const handleSeatClick = (seatId, isAvailable) => {
    if (!isAvailable) return;
    
    if (selectedSeats.includes(seatId)) {
      onSeatToggle(selectedSeats.filter(id => id !== seatId));
    } else {
      if (selectedSeats.length >= maxSelectable) {
        return;
      }
      onSeatToggle([...selectedSeats, seatId]);
    }
  };

  const renderSeat = (rowIndex, colIndex) => {
    const seatIndex = rowIndex * columns + colIndex;
    if (seatIndex >= capacity) {
      return <div key={`empty-${rowIndex}-${colIndex}`} className="w-7 h-7 sm:w-8 sm:h-8" />;
    }

    const seatId = getSeatId(rowIndex, colIndex);
    const isBooked = bookedSeats.includes(seatId);
    const isHeld = heldSeats.includes(seatId) && !selectedSeats.includes(seatId); 
    const isSelected = selectedSeats.includes(seatId);
    const isAvailable = !isBooked && !isHeld;

    return (
      <button
        key={seatId}
        type="button"
        disabled={!isAvailable && !isSelected}
        onClick={() => handleSeatClick(seatId, isAvailable)}
        className={cn(
          "w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-[10px] sm:text-xs font-bold font-mono transition-all duration-150 flex items-center justify-center relative select-none cursor-pointer",
          isBooked && "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-300/40 dark:border-slate-700/40 opacity-70",
          isHeld && !isSelected && "bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 cursor-not-allowed animate-pulse",
          isSelected && "bg-indigo-600 border border-indigo-700 text-white shadow-md shadow-indigo-300/40 dark:shadow-none scale-105 z-10 font-black ring-2 ring-indigo-300 dark:ring-indigo-700",
          isAvailable && !isSelected && "bg-white dark:bg-slate-900 border border-emerald-500/70 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:scale-105"
        )}
        title={isBooked ? `Seat ${seatId} (Booked)` : isHeld ? `Seat ${seatId} (In Checkout)` : `Seat ${seatId} (Available)`}
      >
        {seatId}
      </button>
    );
  };

  const layout = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < columns; c++) {
      row.push(renderSeat(r, c));
    }
    layout.push(
      <div key={`row-${r}`} className="flex items-center gap-1.5 sm:gap-2 justify-center">
        <span className="w-5 text-center text-[10px] sm:text-xs font-bold text-slate-400 select-none">
          {String.fromCharCode(65 + r)}
        </span>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {row.slice(0, 5)}
          <span className="w-2 sm:w-3" /> {/* Aisle spacer */}
          {row.slice(5, 10)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full bg-slate-50 dark:bg-slate-950/60 p-3 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
      {/* Screen / Stage Curved Banner */}
      <div className="w-full max-w-xs mx-auto mb-3 text-center">
        <div className="h-2 w-full bg-gradient-to-r from-transparent via-indigo-500 to-transparent rounded-full shadow-sm" />
        <span className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-slate-400 block mt-1">Stage / Screen</span>
      </div>

      {/* Seats Container */}
      <div className="w-full overflow-x-auto pb-2 scrollbar-thin">
        <div className="min-w-max mx-auto flex flex-col gap-1.5 sm:gap-2 px-2 items-center">
          {layout}
        </div>
      </div>

      {/* Compact Legend */}
      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 mt-2.5 pt-2.5 border-t border-slate-200/80 dark:border-slate-800 w-full text-[11px] font-semibold text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-white dark:bg-slate-900 border border-emerald-500" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-indigo-600 border border-indigo-700" />
          <span>Selected</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-300" />
          <span>In Checkout</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-slate-200 border border-slate-300" />
          <span>Booked</span>
        </div>
      </div>
    </div>
  );
}

export default SeatMap;
