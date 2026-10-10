import { getErrorMessage } from '@/utils/problem-details';
import { configureStore, createListenerMiddleware, isRejectedWithValue } from '@reduxjs/toolkit';
import { api } from './api';
import { authReducer, sessionCleared } from './auth-slice';
import { isSessionExpired } from './base-query';
import { notificationPushed, notificationReducer } from './notification-slice';
import { TOAST_TITLES, toastPushed, toastReducer } from './toast-slice';

const listeners = createListenerMiddleware();

// Every failed request surfaces the server's ProblemDetails `detail` as a toast.
listeners.startListening({
  matcher: isRejectedWithValue,
  effect: ({ payload }, { dispatch }) => {
    if (isSessionExpired(payload)) return;
    dispatch(toastPushed('error', getErrorMessage(payload)));
  },
});

// Every toast is also kept in the notification center, so it can be reviewed after it fades.
listeners.startListening({
  actionCreator: toastPushed,
  effect: ({ payload }, { dispatch }) => {
    dispatch(notificationPushed(payload.kind, payload.title ?? TOAST_TITLES[payload.kind], payload.message));
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
  reducer: {
    [api.reducerPath]: api.reducer,
    auth: authReducer,
    toasts: toastReducer,
    notifications: notificationReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(listeners.middleware).concat(api.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
