import React from 'react';

export const PageLoader = () => (
  <div className="flex justify-center items-center h-screen bg-slate-50 dark:bg-slate-950 text-indigo-600 font-semibold text-sm">
    <div className="flex items-center gap-2.5">
      <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      <span>Loading EventSphere...</span>
    </div>
  </div>
);

export default PageLoader;
