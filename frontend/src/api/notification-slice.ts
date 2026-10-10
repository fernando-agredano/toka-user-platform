import { type PayloadAction, createSlice, nanoid } from '@reduxjs/toolkit';
import { sessionCleared } from './auth-slice';
import type { ToastKind } from './toast-slice';

const MAX_NOTIFICATIONS = 30;

export interface AppNotification {
  id: string;
  kind: ToastKind;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

const notificationSlice = createSlice({
  name: 'notifications',
  initialState: [] as AppNotification[],
  reducers: {
    notificationPushed: {
      reducer: (state, { payload }: PayloadAction<AppNotification>) => {
        state.unshift(payload);
        state.length = Math.min(state.length, MAX_NOTIFICATIONS);
      },
      prepare: (kind: ToastKind, title: string, message: string) => ({
        payload: { id: nanoid(), kind, title, message, createdAt: new Date().toISOString(), read: false },
      }),
    },
    notificationRead: (state, { payload }: PayloadAction<string>) => {
      const notification = state.find((item) => item.id === payload);
      if (notification) notification.read = true;
    },
    allNotificationsRead: (state) => {
      for (const notification of state) notification.read = true;
    },
    notificationsCleared: () => [],
  },
  // Notifications belong to a session: the next user must not see the previous one's.
  extraReducers: (builder) => {
    builder.addCase(sessionCleared, () => []);
  },
});

export const { notificationPushed, notificationRead, allNotificationsRead, notificationsCleared } =
  notificationSlice.actions;
export const notificationReducer = notificationSlice.reducer;

export const selectNotifications = (state: { notifications: AppNotification[] }) => state.notifications;
