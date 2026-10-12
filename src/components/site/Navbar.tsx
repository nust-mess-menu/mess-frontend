"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { safePhotoUrl } from "@/lib/site/avatars";
import { signOutUser } from "@/lib/site/authSlice";
import { useAppDispatch, useAppSelector } from "@/lib/site/store";
import LoginModal from "./LoginModal";

const getFirstName = (displayName: string | null | undefined) =>
  displayName ? displayName.split(" ")[0] : "User";

export default function Navbar() {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

  // Bootstrap's collapse behaviour for the mobile menu toggler, bundled locally
  useEffect(() => {
    import("bootstrap/js/dist/collapse").catch(() => undefined);
  }, []);

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
      <nav className="nav navbar navbar-expand-lg bg-body-tertiary">
        <div className="container-fluid">
          <Link href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/android-chrome-192x192.png" alt="logo" height="70" width="70" />
          </Link>
          <Link className="navbar-brand" href="/">
            Nust Mess Menu
          </Link>
          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarSupportedContent"
            aria-controls="navbarSupportedContent"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarSupportedContent">
            <ul className="navbar-nav me-auto mb-2 mb-lg-0">
              <li className="nav-item">
                <Link className="nav-link active hover-underline-animation" aria-current="page" href="/daily">
                  Today
                </Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link active hover-underline-animation" aria-current="page" href="/weekly">
                  This Week
                </Link>
              </li>
            </ul>

            <div className="auth-section">
              {user ? (
                <div className="user-menu">
                  <button
                    className="user-button"
                    onClick={() => setShowDropdown(!showDropdown)}
                    aria-label="User menu"
                    aria-expanded={showDropdown}
                  >
                    {photo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo}
                        alt={user.displayName || "User"}
                        className="user-avatar"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <span className="user-name">{getFirstName(user.displayName)}</span>
                    <svg className="dropdown-arrow" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                      <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>

                  {showDropdown && (
                    <>
                      <div className="dropdown-overlay" onClick={() => setShowDropdown(false)} />
                      <div className="dropdown-menu-custom">
                        <div className="dropdown-user-info">
                          <div className="dropdown-user-name">{user.displayName}</div>
                          <div className="dropdown-user-email">{user.email}</div>
                          {user.username && (
                            <div className="dropdown-user-alias">
                              Posts as <strong>{user.username}</strong>
                            </div>
                          )}
                        </div>
                        <button className="dropdown-item-custom" onClick={handleSignOut}>
                          Sign Out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <button className="login-button" onClick={() => setShowLoginModal(true)}>
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
