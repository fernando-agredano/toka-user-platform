import { Logger } from '@nestjs/common';

// Services log warnings by design (degraded mode, cache down); keep test output readable.
Logger.overrideLogger(false);
