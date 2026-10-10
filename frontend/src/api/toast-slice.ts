import { type PayloadAction, createSlice, nanoid } from '@reduxjs/toolkit';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export const TOAST_TITLES: Record<ToastKind, string> = {
  success: 'Listo',
  error: 'No se pudo completar',
  info: 'Información',
  warning: 'Atención',
};

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
  title?: string;
}

const toastSlice = createSlice({
  name: 'toasts',
  initialState: [] as Toast[],
  reducers: {
    toastPushed: {
      reducer: (state, { payload }: PayloadAction<Toast>) => {
        state.push(payload);
      },
      prepare: (kind: ToastKind, message: string, title?: string) => ({
        payload: { id: nanoid(), kind, message, title },
      }),
    },
    toastDismissed: (state, { payload }: PayloadAction<string>) =>
      state.filter((toast) => toast.id !== payload),
  },
});

export const { toastPushed, toastDismissed } = toastSlice.actions;
export const toastReducer = toastSlice.reducer;

export const selectToasts = (state: { toasts: Toast[] }) => state.toasts;
