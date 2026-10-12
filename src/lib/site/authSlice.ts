import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { GoogleAuthProvider, signInWithPopup, signOut } from "@firebase/auth";
import { apiUrl, errorMessage } from "./api";
import { firebaseAuth, getIdTokenSafely } from "./firebase";
import { clearMenuCache } from "./menuCache";
import { getJson, removeItem, setItem } from "./storage";
import type { SessionUser } from "./types";
import type { AppDispatch, RootState } from "./store";

/**
 * Authentication state and the Google sign-in flow.
 *
 * Firebase is the source of truth for whether a session exists; localStorage
 * only lets the signed-in UI paint immediately on load. The stored object is
 * display data (name, email, username) - never a token.
 */

const USER_KEY = "user";

function asSessionUser(value: unknown): SessionUser | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.uid !== "string" || !v.uid) return null;
  const str = (x: unknown) => (typeof x === "string" ? x : null);
  return {
    uid: v.uid,
    email: str(v.email),
    displayName: str(v.displayName),
    photoURL: str(v.photoURL),
    emailVerified: Boolean(v.emailVerified),
    ...(typeof v.username === "string" && v.username ? { username: v.username } : {}),
  };
}

export const signInWithGoogle = createAsyncThunk<SessionUser, void, { rejectValue: string }>(
  "auth/signInWithGoogle",
  async (_, { rejectWithValue }) => {
    try {
      const result = await signInWithPopup(firebaseAuth(), new GoogleAuthProvider());
      const idToken = await result.user.getIdToken();

      const response = await fetch(apiUrl("/api/user/auth/google"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      let data: { success?: boolean; user?: unknown; message?: string } = {};
      try {
        data = await response.json();
      } catch {
        throw new Error("Invalid response from server");
      }

      const user = asSessionUser(data.user);
      if (!response.ok || !data.success || !user) {
        // Do not leave a Firebase session the backend refused
        await signOut(firebaseAuth()).catch(() => undefined);
        throw new Error(typeof data.message === "string" ? data.message : "Authentication failed");
      }

      clearMenuCache();
      setItem(USER_KEY, JSON.stringify(user));
      return user;
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        return rejectWithValue("Sign-in cancelled");
      }
      if (code === "auth/popup-blocked") {
        return rejectWithValue("Your browser blocked the sign-in popup. Allow popups for this site and try again.");
      }
      return rejectWithValue((error as Error)?.message || "Authentication failed");
    }
  }
);

export const signOutUser = createAsyncThunk<null, void, { rejectValue: string }>(
  "auth/signOut",
  async (_, { rejectWithValue }) => {
    try {
      await signOut(firebaseAuth());
      removeItem(USER_KEY);
      clearMenuCache();
      return null;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const restoreSession = createAsyncThunk("auth/restoreSession", async () =>
  asSessionUser(getJson<unknown>(USER_KEY))
);

/** Backfill the public username onto a session stored before usernames existed. */
export const ensureUsername = createAsyncThunk<string | null, void, { state: RootState }>(
  "auth/ensureUsername",
  async (_, { getState }) => {
    const existing = getState().auth.user;
    if (!existing || existing.username) return null;

    const idToken = await getIdTokenSafely();
    if (!idToken) return null;
    const response = await fetch(apiUrl("/api/user/profile"), {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!response.ok) {
      await errorMessage(response, "");
      return null;
    }
    const data = (await response.json()) as { user?: { username?: unknown } };
    return typeof data.user?.username === "string" ? data.user.username : null;
  }
);

/**
 * Keep Redux in step with Firebase: sign-outs in other tabs, revoked or
 * evicted sessions, and sessions Firebase has that localStorage lost.
 * Returns the unsubscribe function.
 */
export const watchAuthState = () => (dispatch: AppDispatch, getState: () => RootState) =>
  firebaseAuth().onAuthStateChanged((firebaseUser) => {
    const storedUser = getState().auth.user;

    if (!firebaseUser) {
      if (storedUser) dispatch(sessionExpired());
      return;
    }

    if (storedUser && storedUser.uid === firebaseUser.uid) {
      if (!storedUser.username) dispatch(ensureUsername());
      return;
    }

    dispatch(
      authStateRestored({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        emailVerified: firebaseUser.emailVerified,
      })
    );
    dispatch(ensureUsername());
  });

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = { user: null, loading: false, error: null };

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    sessionExpired: (state) => {
      state.user = null;
      state.error = null;
      removeItem(USER_KEY);
      clearMenuCache();
    },
    authStateRestored: (state, action: PayloadAction<SessionUser>) => {
      state.user = { ...(state.user ?? {}), ...action.payload };
      setItem(USER_KEY, JSON.stringify(state.user));
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(signInWithGoogle.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signInWithGoogle.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
      })
      .addCase(signInWithGoogle.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Authentication failed";
      })
      .addCase(signOutUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signOutUser.fulfilled, (state) => {
        state.loading = false;
        state.user = null;
      })
      .addCase(signOutUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? null;
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.user = action.payload;
      })
      .addCase(ensureUsername.fulfilled, (state, action) => {
        if (action.payload && state.user) {
          state.user = { ...state.user, username: action.payload };
          setItem(USER_KEY, JSON.stringify(state.user));
        }
      });
  },
});

export const { clearError, sessionExpired, authStateRestored } = authSlice.actions;
export const authReducer = authSlice.reducer;
