"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Provider } from "react-redux";
import { publicEnv } from "@/lib/publicEnv";
import { restoreSession, watchAuthState } from "@/lib/site/authSlice";
import { cleanLegacyCache } from "@/lib/site/menuSlice";
import { makeStore } from "@/lib/site/store";

let userbackStarted = false;

/**
 * Store + one-time app startup (what the original App component did):
 * restore the cached session, then let Firebase be the authority.
 */
export default function Providers({ children }: { children: ReactNode }) {
  // One store per browser session (per request on the server)
  const [store] = useState(makeStore);

  useEffect(() => {
    cleanLegacyCache();
    store.dispatch(restoreSession());
    const unsubscribe = store.dispatch(watchAuthState());

    // Feedback widget (bottom-left), loaded only when configured
    if (publicEnv.userbackToken && !userbackStarted) {
      userbackStarted = true;
      import("@userback/widget")
        .then(({ default: Userback }) => Userback(publicEnv.userbackToken))
        .catch(() => {
          userbackStarted = false;
        });
    }

    return unsubscribe;
  }, [store]);

  return (
    <Provider store={store}>
      {children}
    </Provider>
  );
}
