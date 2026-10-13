"use client";

import { clearError, signInWithGoogle } from "@/lib/site/authSlice";
import { useAppDispatch, useAppSelector } from "@/lib/site/store";
import { POPUP_OVERLAY } from "./shellClasses";

export default function LoginModal({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((state) => state.auth);

  const handleGoogleSignIn = async () => {
    const result = await dispatch(signInWithGoogle());
    if (signInWithGoogle.fulfilled.match(result)) onClose();
  };

  const handleClose = () => {
    dispatch(clearError());
    onClose();
  };

  return (
    <div className={POPUP_OVERLAY} onClick={handleClose}>
      <div
        className="relative bg-white border-2 border-[#535151] rounded-[8px] px-[30px] py-10 max-w-[450px] w-[90%] shadow-[0_4px_20px_rgba(0,0,0,0.3)] animate-popup-rise max-[769px]:px-[25px] max-[769px]:py-[35px] max-[769px]:w-[92%] max-[481px]:px-5 max-[481px]:py-[30px] max-[481px]:w-[95%] max-[481px]:border"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mm-login-title"
      >
        <button className="absolute top-[15px] right-[15px] flex items-center justify-center w-[30px] h-[30px] p-0 bg-transparent border-none text-[28px] text-[#535151] transition-opacity duration-200 ease-[ease] hover:opacity-70 max-[481px]:top-[10px] max-[481px]:right-[10px] max-[481px]:w-[25px] max-[481px]:h-[25px] max-[481px]:text-[24px]" onClick={handleClose} aria-label="Close">
          &times;
        </button>

        <h2
          className="mt-0 mb-[15px] text-[26px] text-center font-semibold text-[#535151] max-[769px]:text-[24px] max-[769px]:mb-3 max-[481px]:text-[20px] max-[481px]:mb-[10px]"
          id="mm-login-title"
        >
          Sign In
        </h2>

        <p className="mt-0 mb-[30px] text-[16px] leading-[1.5] text-center text-[#535151] max-[769px]:text-[15px] max-[769px]:mb-[25px] max-[481px]:text-[14px] max-[481px]:mb-5">
          Sign in with your Google account to access personalized features and save your preferences.
        </p>

        {error && <div className="mb-5 p-3 rounded-[4px] border border-[#fcc] bg-[#fee] text-[#c33] text-center text-[14px] max-[481px]:text-[13px] max-[481px]:p-[10px]">{error}</div>}

        <button
          className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white text-[#535151] border-2 border-[#dadce0] rounded-[4px] text-[16px] font-medium font-google transition-all duration-200 ease-[ease] enabled:hover:bg-[#f8f9fa] enabled:hover:border-[#9bb158] enabled:hover:shadow-[0_1px_3px_rgba(0,0,0,0.1)] enabled:active:bg-[#f1f3f4] disabled:opacity-60 disabled:cursor-not-allowed max-[481px]:px-5 max-[481px]:py-[10px] max-[481px]:text-[15px]"
          onClick={handleGoogleSignIn} disabled={loading}>
          {loading ? (
            <>
              <div className="w-[18px] h-[18px] rounded-full border-2 border-[#f3f3f3] border-t-[#9bb158] animate-spin-btn" />
              Signing in...
            </>
          ) : (
            <>
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Sign in with Google
            </>
          )}
        </button>
      </div>
    </div>
  );
}
