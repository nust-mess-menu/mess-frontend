"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Provider } from "react-redux";
import { restoreSession, watchAuthState } from "@/lib/site/authSlice";
import { checkIn } from "@/lib/site/checkin";
import { startFeedback } from "@/lib/site/feedback";
import { cleanLegacyCache } from "@/lib/site/menuSlice";
import { makeStore } from "@/lib/site/store";

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

    // Problem-report widget, loaded in the background so the link opens instantly
    startFeedback();

    // Once-a-day visit count for the admin stats
    void checkIn();

    return unsubscribe;
  }, [store]);

  return (
    <Provider store={store}>
      {children}
    </Provider>
  );
}
