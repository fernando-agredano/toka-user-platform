import type { Page, UserStatus, UserView } from '@/@types/api';
import type { EditUserValues, NewAccountValues } from '@/validators/account';
import { api } from './api';

export interface ListUsersParams {
  page: number;
  limit: number;
  search?: string;
  status?: UserStatus;
}

const LIST_TAG = { type: 'User', id: 'LIST' } as const;

export const usersApi = api.injectEndpoints({
  endpoints: (build) => ({
    listUsers: build.query<Page<UserView>, ListUsersParams>({
      query: (params) => ({ url: 'users', params }),
      providesTags: [LIST_TAG],
    }),
    createUser: build.mutation<UserView, NewAccountValues>({
      query: (body) => ({ url: 'users', method: 'POST', body }),
      invalidatesTags: [LIST_TAG],
    }),
    updateUser: build.mutation<UserView, { id: string } & EditUserValues>({
      query: ({ id, ...body }) => ({ url: `users/${id}`, method: 'PATCH', body }),
      invalidatesTags: [LIST_TAG],
    }),
    deactivateUser: build.mutation<UserView, string>({
      query: (id) => ({ url: `users/${id}/deactivate`, method: 'POST' }),
      invalidatesTags: [LIST_TAG],
    }),
    activateUser: build.mutation<UserView, string>({
      query: (id) => ({ url: `users/${id}/activate`, method: 'POST' }),
      invalidatesTags: [LIST_TAG],
    }),
  }),
});

export const {
  useListUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeactivateUserMutation,
  useActivateUserMutation,
} = usersApi;
