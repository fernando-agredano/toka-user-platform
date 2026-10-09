import type { ChatRequest, ChatResponse } from '@/@types/api';
import { api } from './api';

export const aiApi = api.injectEndpoints({
  endpoints: (build) => ({
    chat: build.mutation<ChatResponse, ChatRequest>({
      query: (body) => ({ url: 'ai/chat', method: 'POST', body }),
    }),
  }),
});

export const { useChatMutation } = aiApi;
