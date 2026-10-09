import { Body, Controller, Get, Headers, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  type AuthenticatedUser,
  CurrentUser,
  JwtAuthGuard,
  Permissions,
  PermissionsGuard,
  Roles,
  getCorrelationId,
} from '@toka/common';
import type { Request } from 'express';
import { ChatRequestDto, type ChatOutput, IngestRequestDto, MetricsQueryDto } from '../../application/dtos/chat.dtos';
import type { MetricsSummary } from '../../domain/entities/query-metric';
import { ChatUseCase } from '../../application/use-cases/chat.use-case';
import { GetMetricsUseCase } from '../../application/use-cases/get-metrics.use-case';
import { type IngestSummary, IngestKnowledgeUseCase } from '../../application/use-cases/ingest-knowledge.use-case';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AiController {
  constructor(
    private readonly chatUseCase: ChatUseCase,
    private readonly ingestUseCase: IngestKnowledgeUseCase,
    private readonly metricsUseCase: GetMetricsUseCase,
  ) {}

  @Post('chat')
  @HttpCode(200)
  @Permissions('ai:use')
  chat(
    @Body() dto: ChatRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('authorization') authorization: string,
    @Req() request: Request,
  ): Promise<ChatOutput> {
    return this.chatUseCase.execute({
      user: { userId: user.userId, email: user.email, roles: user.roles, permissions: user.permissions },
      authorization,
      message: dto.message,
      conversationId: dto.conversationId,
      ip: request.ip ?? null,
      correlationId: getCorrelationId() ?? null,
    });
  }

  @Post('ingest')
  @HttpCode(200)
  @Roles('ADMIN')
  ingest(@Body() dto: IngestRequestDto): Promise<IngestSummary> {
    return this.ingestUseCase.execute({ force: dto.force });
  }

  @Get('metrics')
  @Permissions('audit:read')
  metrics(@Query() query: MetricsQueryDto): Promise<MetricsSummary> {
    return this.metricsUseCase.execute(query);
  }
}
