import React from "react";

const SkeletonCard = () => {
  return (
    <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-slate-200/80 shadow-md animate-pulse space-y-4">
      <div className="w-full h-48 bg-slate-200 rounded-xl"></div>
      <div className="h-6 bg-slate-200 rounded w-3/4"></div>
      <div className="h-4 bg-slate-200 rounded w-1/2"></div>
      <div className="h-4 bg-slate-200 rounded w-full"></div>
      <div className="flex justify-between items-center pt-2">
        <div className="h-6 bg-slate-200 rounded w-1/4"></div>
        <div className="h-8 bg-slate-300 rounded-xl w-28"></div>
      </div>
    </div>
  );
};

export default SkeletonCard;
