"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { safePhotoUrl } from "@/lib/site/avatars";
import { signOutUser } from "@/lib/site/authSlice";
import { useAppDispatch, useAppSelector } from "@/lib/site/store";
import LoginModal from "./LoginModal";
import { cx } from "./shellClasses";

const NAV_LINK =
  "relative inline-block py-2 px-0 min-[992px]:px-2 text-black no-underline transition-colors duration-150 ease-in-out hover:text-black " +
  "after:content-[''] after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:bg-[#979ea1] after:scale-x-0 after:origin-bottom-right after:transition-transform after:duration-500 after:ease-out " +
  "hover:after:scale-x-100 hover:after:origin-bottom-left";

const getFirstName = (displayName: string | null | undefined) =>
  displayName ? displayName.split(" ")[0] : "User";

export default function Navbar() {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

  // Other components (e.g. rating buttons) can ask for the login modal
  useEffect(() => {
    const openLogin = () => setShowLoginModal(true);
    window.addEventListener("open-login-modal", openLogin);
    return () => window.removeEventListener("open-login-modal", openLogin);
  }, []);

  const handleSignOut = () => {
    dispatch(signOutUser());
    setShowDropdown(false);
  };

  const photo = safePhotoUrl(user?.photoURL);

  return (
    <>
      <nav className="relative flex flex-wrap items-center justify-between py-2 bg-[#f8f9fa] min-[992px]:flex-nowrap min-[992px]:justify-start">
        <div className="w-full px-3 mx-auto flex flex-wrap items-center justify-between min-[992px]:flex-nowrap">
          <Link href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/android-chrome-192x192.png" alt="logo" height="70" width="70" />
          </Link>
          <Link className="py-[0.3125rem] mr-4 text-[1.25rem] text-black no-underline whitespace-nowrap hover:text-black" href="/">
            Nust Mess Menu
          </Link>
          <button
            className="px-3 py-1 text-[1.25rem] leading-none text-black/65 bg-transparent border border-black/15 rounded-[0.375rem] transition-shadow duration-150 ease-in-out focus:outline-0 focus:shadow-[0_0_0_0.25rem] min-[992px]:hidden"
            type="button"
            onClick={() => setNavOpen((open) => !open)}
            aria-controls="navbarSupportedContent"
            aria-expanded={navOpen}
            aria-label="Toggle navigation"
          >
            <svg className="inline-block w-[1.5em] h-[1.5em] align-middle" viewBox="0 0 30 30" aria-hidden="true">
              <path
                stroke="rgba(33, 37, 41, 0.75)"
                strokeLinecap="round"
                strokeMiterlimit="10"
                strokeWidth="2"
                d="M4 7h22M4 15h22M4 23h22"
              />
            </svg>
          </button>
          <div
            className={cx("basis-full grow items-center min-[992px]:flex! min-[992px]:basis-auto", !navOpen && "hidden")}
            id="navbarSupportedContent"
          >
            <ul className="flex flex-col pl-0 mb-2 mr-auto list-none min-[992px]:flex-row min-[992px]:mb-0">
              <li>
                <Link className={NAV_LINK} aria-current="page" href="/daily">
                  Today
                </Link>
              </li>
              <li>
                <Link className={NAV_LINK} aria-current="page" href="/weekly">
                  This Week
                </Link>
              </li>
            </ul>

            <div className="flex items-center ml-auto max-[992px]:mt-3 max-[992px]:ml-0">
              {user ? (
                <div className="relative">
                  <button
                    className="user-button group flex items-center gap-2 bg-white border-2 border-[#e0e0e0] px-3 py-[6px] rounded-[25px] font-system transition-all duration-200 ease-[ease] hover:border-[#9bb158] hover:shadow-[0_2px_8px_rgba(155,177,88,0.2)] max-[992px]:w-full max-[992px]:justify-center"
                    onClick={() => setShowDropdown(!showDropdown)}
                    aria-label="User menu"
                    aria-expanded={showDropdown}
                  >
                    {photo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo}
                        alt={user.displayName || "User"}
                        className="w-8 h-8 rounded-full object-cover border-2 border-[#9bb158] max-[481px]:w-7 max-[481px]:h-7"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <span className="user-name text-[#535151] text-[15px] font-medium max-w-[120px] truncate max-[481px]:text-[14px]">
                      {getFirstName(user.displayName)}
                    </span>
                    <svg
                      className="text-[#979ea1] transition-transform duration-200 ease-[ease] group-hover:text-[#9bb158]"
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      aria-hidden="true"
                    >
                      <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>

                  {showDropdown && (
                    <>
                      <div className="dropdown-overlay fixed inset-0 z-[999]" onClick={() => setShowDropdown(false)} />
                      <div className="absolute top-[calc(100%+8px)] right-0 min-w-[220px] bg-white border-2 border-[#e0e0e0] rounded-[8px] shadow-[0_4px_12px_rgba(0,0,0,0.15)] z-[1000] animate-dropdown-in max-[992px]:right-auto max-[992px]:left-0 max-[992px]:w-full">
                        <div className="p-4 border-b border-[#e0e0e0]">
                          <div className="text-[#535151] text-[15px] font-semibold mb-1 truncate">{user.displayName}</div>
                          <div className="text-[#979ea1] text-[13px] truncate">{user.email}</div>
                          {user.username && (
                            <div className="dropdown-user-alias mt-2 pt-2 border-t border-[#eceef1] text-[#979ea1] text-[12px] truncate">
                              Posts as <strong className="text-[#7c9341] font-semibold">{user.username}</strong>
                            </div>
                          )}
                        </div>
                        <button
                          className="w-full px-4 py-3 bg-transparent border-none text-left text-[#535151] text-[14px] font-medium font-system transition-colors duration-200 ease-[ease] hover:bg-[#f5f5f5]"
                          onClick={handleSignOut}
                        >
                          Sign Out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <button
                  className="bg-[#9bb158] text-white border-none px-5 py-2 rounded-[6px] text-[15px] font-medium font-system transition-all duration-200 ease-[ease] hover:bg-[#8ba04a] hover:-translate-y-px hover:shadow-[0_2px_8px_rgba(155,177,88,0.3)] active:translate-y-0 max-[992px]:w-full max-[992px]:py-[10px] max-[481px]:text-[14px]"
                  onClick={() => setShowLoginModal(true)}
                >
                  Login
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
    </>
  );
}
