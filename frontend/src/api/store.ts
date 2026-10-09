import { getErrorMessage } from '@/utils/problem-details';
import { configureStore, createListenerMiddleware, isRejectedWithValue } from '@reduxjs/toolkit';
import { api } from './api';
import { authReducer, sessionCleared } from './auth-slice';
import { isSessionExpired } from './base-query';
import { toastPushed, toastReducer } from './toast-slice';

const listeners = createListenerMiddleware();

// Every failed request surfaces the server's ProblemDetails `detail` as a toast.
listeners.startListening({
  matcher: isRejectedWithValue,
  effect: ({ payload }, { dispatch }) => {
    if (isSessionExpired(payload)) return;
    dispatch(toastPushed('error', getErrorMessage(payload)));
  },
});

// Never leave one user's cached data around for the next session.
listeners.startListening({
  actionCreator: sessionCleared,
  effect: (_, { dispatch }) => {
    dispatch(api.util.resetApiState());
  },
});

export const store = configureStore({
  reducer: { [api.reducerPath]: api.reducer, auth: authReducer, toasts: toastReducer },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(listeners.middleware).concat(api.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
