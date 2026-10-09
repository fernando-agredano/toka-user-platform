import type { RoleView } from '@/@types/api';
import { api } from './api';

interface UserRoleParams {
  userId: string;
  roleId: string;
}

export const rolesApi = api.injectEndpoints({
  endpoints: (build) => ({
    listRoles: build.query<RoleView[], void>({
      query: () => 'roles',
      providesTags: ['Role'],
    }),
    getUserRoles: build.query<RoleView[], string>({
      query: (userId) => `roles/users/${userId}`,
      providesTags: (_result, _error, userId) => [{ type: 'UserRoles', id: userId }],
    }),
    assignRole: build.mutation<void, UserRoleParams>({
      query: ({ userId, roleId }) => ({
        url: `roles/users/${userId}/assign`,
        method: 'POST',
        body: { roleId },
      }),
      invalidatesTags: (_result, _error, { userId }) => [{ type: 'UserRoles', id: userId }],
    }),
    revokeRole: build.mutation<void, UserRoleParams>({
      query: ({ userId, roleId }) => ({ url: `roles/users/${userId}/roles/${roleId}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, { userId }) => [{ type: 'UserRoles', id: userId }],
    }),
  }),
});

export const { useListRolesQuery, useGetUserRolesQuery, useAssignRoleMutation, useRevokeRoleMutation } =
  rolesApi;
