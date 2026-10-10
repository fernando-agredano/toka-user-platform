import type { Session } from '@/@types/api';
import { api } from '@/api/api';
import { sessionCleared, sessionStarted } from '@/api/auth-slice';
import { store } from '@/api/store';
import { toastDismissed } from '@/api/toast-slice';
import { Toaster } from '@/components/ui/Toaster';
import { ConfirmProvider } from '@/hooks/use-confirm';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { Provider } from 'react-redux';
import { type RouteObject, RouterProvider, createMemoryRouter } from 'react-router-dom';

interface RenderOptions {
  path?: string;
  routes?: RouteObject[];
  session?: Session | null;
}

// The app store is a module singleton, so every test starts from a clean slate.
const resetStore = (session: Session | null) => {
  store.dispatch(api.util.resetApiState());
  for (const toast of store.getState().toasts) {
    store.dispatch(toastDismissed(toast.id));
  }
  store.dispatch(session ? sessionStarted(session) : sessionCleared());
};

/** Renders a route tree with the real store, router (in memory) and toaster. */
export const renderWithProviders = (ui: ReactElement, options: RenderOptions = {}) => {
  const { path = '/', session = null } = options;
  resetStore(session);
  const routes = options.routes ?? [{ path, element: ui }];
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return {
    store,
    router,
    ...render(
      <Provider store={store}>
        <ConfirmProvider>
          <RouterProvider router={router} />
          <Toaster />
        </ConfirmProvider>
      </Provider>,
    ),
  };
};
