import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from './base-query';

// Endpoints live in their own files and are injected here to keep each module small.
export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['User', 'UserRoles', 'Role'],
  endpoints: () => ({}),
});
