'use client';

import React, { useState, useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface WelcomePopupProps {
  onClose?: () => void;
}

export function WelcomePopup({ onClose }: WelcomePopupProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if this is a newly verified user
    const newlyVerified = localStorage.getItem('newlyVerified');
    if (newlyVerified && user) {
      setIsOpen(true);
      localStorage.removeItem('newlyVerified');
    }
  }, [user]);

  const handleClose = () => {
    setIsOpen(false);
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-amber-500/20 to-blue-500/20 border-b border-slate-800 px-6 py-8 rounded-t-2xl">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-amber-500" />
            <h2 className="text-2xl font-bold text-slate-100">Welcome to WME Portal!</h2>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-4">
          <p className="text-slate-300 text-center">
            <span className="font-semibold text-amber-400">{user?.name || 'New User'}</span>, your email has been verified and your account is ready to go!
          </p>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
              </div>
              <div>
                <p className="text-slate-200 font-medium">Access Your Portal</p>
                <p className="text-slate-400 text-sm">Start managing your {user?.role === 'TALENT' ? 'talent' : 'booking'} activities</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
              </div>
              <div>
                <p className="text-slate-200 font-medium">Complete Your Profile</p>
                <p className="text-slate-400 text-sm">Add more details to maximize your experience</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
              </div>
              <div>
                <p className="text-slate-200 font-medium">Get Support</p>
                <p className="text-slate-400 text-sm">Contact our team anytime for help or questions</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 rounded-b-2xl">
          <button
            onClick={handleClose}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-semibold py-3 px-4 rounded-xl transition-all shadow-lg"
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}
