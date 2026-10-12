import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { apiUrl, errorMessage } from "./api";
import { getIdTokenSafely } from "./firebase";
import type { MealComment } from "./types";
import type { RootState } from "./store";

/**
 * Reviews per meal, keyed by mealId. Upvotes are optimistic: applied on
 * pending, settled on success, rolled back on failure. Order is preserved on
 * vote so a row never jumps away from the cursor.
 */

export const COMMENTS_PAGE_SIZE = 8;

export interface Thread {
  items: MealComment[];
  total: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
}

const emptyThread: Thread = { items: [], total: 0, hasMore: false, loading: false, loadingMore: false, error: null };

export const fetchMealComments = createAsyncThunk<
  { mealId: string; append: boolean; comments: MealComment[]; total: number; hasMore: boolean },
  { mealId: string; offset?: number; append?: boolean },
  { rejectValue: { mealId: string; message: string } }
>("comments/fetchMealComments", async ({ mealId, offset = 0, append = false }, { rejectWithValue }) => {
  try {
    const headers: Record<string, string> = {};
    const idToken = await getIdTokenSafely();
    if (idToken) headers.Authorization = `Bearer ${idToken}`;

    const response = await fetch(
      apiUrl("/api/ratings/meal/comments", { mealId, limit: String(COMMENTS_PAGE_SIZE), offset: String(offset) }),
      { headers }
    );
    if (!response.ok) throw new Error("Could not load reviews");
    const data = (await response.json()) as { comments?: MealComment[]; total?: number; hasMore?: boolean };
    return {
      mealId,
      append,
      comments: Array.isArray(data.comments) ? data.comments : [],
      total: typeof data.total === "number" ? data.total : 0,
      hasMore: Boolean(data.hasMore),
    };
  } catch (error) {
    return rejectWithValue({ mealId, message: (error as Error).message || "Could not load reviews" });
  }
});

export const upvoteComment = createAsyncThunk<
  { mealId: string; commentId: string; upvotes: number; hasUpvoted: boolean },
  { mealId: string; commentId: string; upvote: boolean },
  { rejectValue: { mealId: string; commentId: string; upvote: boolean; message: string } }
>("comments/upvoteComment", async ({ mealId, commentId, upvote }, { rejectWithValue }) => {
  try {
    const idToken = await getIdTokenSafely();
    if (!idToken) throw new Error("Your session has expired. Please sign in again.");

    const response = await fetch(apiUrl("/api/ratings/meal/comments/upvote"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ mealId, commentId, upvote }),
    });
    if (!response.ok) throw new Error(await errorMessage(response, "Could not save your upvote"));
    const data = (await response.json()) as { upvotes: number; hasUpvoted: boolean };
    return { mealId, commentId, upvotes: data.upvotes, hasUpvoted: data.hasUpvoted };
  } catch (error) {
    return rejectWithValue({ mealId, commentId, upvote, message: (error as Error).message });
  }
});

function applyUpvote(
  state: { byMeal: Record<string, Thread> },
  mealId: string,
  commentId: string,
  update: (c: MealComment) => MealComment
) {
  const thread = state.byMeal[mealId];
  if (!thread) return;
  const index = thread.items.findIndex((item) => item.id === commentId);
  if (index !== -1) thread.items[index] = update(thread.items[index]);
}

const commentsSlice = createSlice({
  name: "comments",
  initialState: { byMeal: {} as Record<string, Thread> },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchMealComments.pending, (state, action) => {
        const { mealId, append } = action.meta.arg;
        const thread = state.byMeal[mealId] ?? { ...emptyThread };
        state.byMeal[mealId] = {
          ...thread,
          loading: append ? thread.loading : true,
          loadingMore: Boolean(append),
          error: null,
        };
      })
      .addCase(fetchMealComments.fulfilled, (state, action) => {
        const { mealId, append, comments, total, hasMore } = action.payload;
        const existing = state.byMeal[mealId]?.items ?? [];
        state.byMeal[mealId] = {
          items: append ? [...existing, ...comments] : comments,
          total,
          hasMore,
          loading: false,
          loadingMore: false,
          error: null,
        };
      })
      .addCase(fetchMealComments.rejected, (state, action) => {
        const mealId = action.payload?.mealId ?? action.meta.arg.mealId;
        const thread = state.byMeal[mealId] ?? { ...emptyThread };
        state.byMeal[mealId] = {
          ...thread,
          loading: false,
          loadingMore: false,
          error: action.payload?.message ?? "Could not load reviews",
        };
      })
      .addCase(upvoteComment.pending, (state, action) => {
        const { mealId, commentId, upvote } = action.meta.arg;
        applyUpvote(state, mealId, commentId, (c) => ({
          ...c,
          hasUpvoted: upvote,
          upvotes: Math.max(0, c.upvotes + (upvote ? 1 : -1)),
        }));
      })
      .addCase(upvoteComment.fulfilled, (state, action) => {
        const { mealId, commentId, upvotes, hasUpvoted } = action.payload;
        applyUpvote(state, mealId, commentId, (c) => ({ ...c, upvotes, hasUpvoted }));
      })
      .addCase(upvoteComment.rejected, (state, action) => {
        const { mealId, commentId, upvote } = action.payload ?? action.meta.arg;
        applyUpvote(state, mealId, commentId, (c) => ({
          ...c,
          hasUpvoted: !upvote,
          upvotes: Math.max(0, c.upvotes + (upvote ? -1 : 1)),
        }));
      });
  },
});

export const commentsReducer = commentsSlice.reducer;

export const selectMealThread = (state: RootState, mealId: string): Thread =>
  state.comments.byMeal[mealId] ?? emptyThread;
