import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { InternalApiKeyGuard } from '@toka/common';
import { CreateInternalCredentialDto } from '../../application/dtos/auth.dtos';
import { CreateCredentialInternalUseCase } from '../../application/use-cases/create-credential-internal.use-case';

@Controller('internal/credentials')
@UseGuards(InternalApiKeyGuard)
export class InternalCredentialsController {
  constructor(private readonly createCredential: CreateCredentialInternalUseCase) {}

  @Post()
  create(@Body() dto: CreateInternalCredentialDto): Promise<{ userId: string }> {
    return this.createCredential.execute({ ...dto, userId: dto.userId ?? crypto.randomUUID() });
  }
}
