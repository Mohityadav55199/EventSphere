import React from 'react';
import Login from '../Components/Login/Login';

function LogIn() {
  return (
    <div className="min-h-[calc(100vh-4.5rem)] w-full flex items-center justify-center relative overflow-hidden bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      {/* One soft brand-colour glow, same indigo as the rest of the site */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[28rem] h-[28rem] bg-indigo-200/50 dark:bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        <Login />
      </div>
    </div>
  );
}

export default LogIn;