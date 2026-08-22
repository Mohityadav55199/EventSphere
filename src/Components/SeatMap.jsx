import React from 'react';
import { Armchair } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper for tailwind classes
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

function SeatMap({ 
  capacity, 
  bookedSeats = [], 
  heldSeats = [], 
  selectedSeats = [], 
  onSeatToggle,
  maxSelectable = 10
}) {
  // Generate a generic seat layout based on capacity
  // e.g. 10 seats per row
  const columns = 10;
  const rows = Math.ceil(capacity / columns);
  
  const getSeatId = (rowIndex, colIndex) => {
    const rowLetter = String.fromCharCode(65 + rowIndex); // A, B, C...
    const colNumber = colIndex + 1;
    return `${rowLetter}${colNumber}`;
  };

  const handleSeatClick = (seatId, isAvailable) => {
    if (!isAvailable) return;
    
    if (selectedSeats.includes(seatId)) {
      // Deselect
      onSeatToggle(selectedSeats.filter(id => id !== seatId));
    } else {
      // Select
      if (selectedSeats.length >= maxSelectable) {
        alert(`You can only select up to ${maxSelectable} seats.`);
        return;
      }
      onSeatToggle([...selectedSeats, seatId]);
    }
  };

  const renderSeat = (rowIndex, colIndex) => {
    // If it's the last row, we might not have a full row
    const seatIndex = rowIndex * columns + colIndex;
    if (seatIndex >= capacity) return <div key={`empty-${rowIndex}-${colIndex}`} className="w-8 h-8" />;

    const seatId = getSeatId(rowIndex, colIndex);
    const isBooked = bookedSeats.includes(seatId);
    const isHeld = heldSeats.includes(seatId) && !selectedSeats.includes(seatId); 
    const isSelected = selectedSeats.includes(seatId);
    const isAvailable = !isBooked && !isHeld;

    return (
      <button
        key={seatId}
        disabled={!isAvailable && !isSelected}
        onClick={() => handleSeatClick(seatId, isAvailable)}
        className={cn(
          "w-8 h-8 md:w-10 md:h-10 rounded-t-lg border-b-4 flex items-center justify-center transition-all duration-200 shadow-sm relative group",
          isBooked && "bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed opacity-60",
          isHeld && !isSelected && "bg-amber-100 border-amber-300 text-amber-500 cursor-not-allowed",
          isSelected && "bg-indigo-500 border-indigo-700 text-white shadow-indigo-200 transform scale-110 z-10",
          isAvailable && !isSelected && "bg-white border-emerald-500 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-600 cursor-pointer"
        )}
        title={isBooked ? `Seat ${seatId} (Booked)` : isHeld ? `Seat ${seatId} (Held)` : `Seat ${seatId}`}
      >
        <span className="text-[10px] md:text-xs font-bold font-mono">
          {seatId}
        </span>
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
      <div key={`row-${r}`} className="flex items-center gap-2 md:gap-3 mb-3">
        <div className="w-6 text-center text-xs font-bold text-slate-400">
          {String.fromCharCode(65 + r)}
        </div>
        <div className="flex gap-2 md:gap-3 flex-wrap">
          {row}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full bg-slate-50 p-4 md:p-6 rounded-3xl border border-slate-200/60 overflow-hidden">
      
      {/* Stage Area */}
      <div className="w-full max-w-lg mx-auto mb-10 relative">
        <div className="h-8 md:h-12 border-t-4 border-indigo-200 bg-gradient-to-b from-indigo-50 to-transparent rounded-t-[50%] flex items-center justify-center">
          <span className="text-xs md:text-sm font-black text-indigo-300 tracking-[0.3em] uppercase">Stage</span>
        </div>
      </div>

      {/* Seat Grid */}
      <div className="w-full overflow-x-auto pb-4">
        <div className="min-w-max mx-auto flex flex-col items-center px-4">
          {layout}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 mt-6 pt-6 border-t border-slate-200/80 w-full text-xs font-semibold text-slate-600">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-t bg-white border border-b-4 border-emerald-500"></div>
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-t bg-indigo-500 border border-b-4 border-indigo-700"></div>
          <span>Selected</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-t bg-amber-100 border border-b-4 border-amber-300"></div>
          <span>In Cart</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-t bg-slate-200 border border-b-4 border-slate-300"></div>
          <span>Booked</span>
        </div>
      </div>
      
    </div>
  );
}

export default SeatMap;
