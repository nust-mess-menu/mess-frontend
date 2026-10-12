import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import { authReducer } from "./authSlice";
import { commentsReducer } from "./commentsSlice";
import { menuReducer } from "./menuSlice";

export function makeStore() {
  return configureStore({
    reducer: { menu: menuReducer, auth: authReducer, comments: commentsReducer },
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
