import { IsBoolean, IsDateString, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import type { QualityChecks } from '../../domain/services/quality-evaluator';
import type { AiSourceView } from '../services/evidence-ledger';
import type { SessionUser } from './session-user';

export class ChatRequestDto {
  @IsString() @MinLength(1) @MaxLength(2000) message!: string;
  @IsOptional() @IsUUID('4') conversationId?: string;
}

export class IngestRequestDto {
  @IsOptional() @IsBoolean() force?: boolean;
}

export class MetricsQueryDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export interface ChatInput {
  user: SessionUser;
  authorization: string;
  message: string;
  conversationId?: string;
  ip: string | null;
  correlationId: string | null;
}

export interface ChatOutput {
  answer: string;
  conversationId: string;
  sources: AiSourceView[];
  toolsUsed: string[];
  metrics: {
    latencyMs: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    cached: boolean;
    /** Who generated the answer: "gemini", "ollama", "mock" or "cache". Extension of the base contract. */
    provider: string;
    model: string;
  };
  quality: { score: number; checks: QualityChecks };
}
