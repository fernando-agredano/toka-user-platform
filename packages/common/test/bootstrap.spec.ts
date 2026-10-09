import { ProblemDetailsFilter } from '../src/errors/problem-details.filter';
import { configureApp } from '../src/bootstrap';

describe('configureApp', () => {
  const buildApp = () => {
    const logger = { name: 'pino-logger' };
    const app = {
      get: jest.fn().mockReturnValue(logger),
      useLogger: jest.fn(),
      set: jest.fn(),
      use: jest.fn(),
      setGlobalPrefix: jest.fn(),
      useGlobalPipes: jest.fn(),
      useGlobalFilters: jest.fn(),
      enableCors: jest.fn(),
      enableShutdownHooks: jest.fn(),
    };
    return { app, logger };
  };

  afterEach(() => {
    delete process.env.CORS_ORIGINS;
  });

  it('wires logger, proxy trust, security headers, prefix, validation, filter and shutdown hooks', () => {
    const { app, logger } = buildApp();

    expect(configureApp(app as never, 'api/auth')).toBe(app);

    expect(app.useLogger).toHaveBeenCalledWith(logger);
    expect(app.set).toHaveBeenCalledWith('trust proxy', 1);
    expect(app.use).toHaveBeenCalledTimes(2);
    expect(app.setGlobalPrefix).toHaveBeenCalledWith('api/auth', { exclude: ['health'] });
    expect(app.useGlobalPipes).toHaveBeenCalledWith(
      expect.objectContaining({
        validatorOptions: expect.objectContaining({ whitelist: true, forbidNonWhitelisted: true }),
      }),
    );
    expect(app.useGlobalFilters).toHaveBeenCalledWith(expect.any(ProblemDetailsFilter));
    expect(app.enableShutdownHooks).toHaveBeenCalled();
  });

  it('allows the default CORS origin when CORS_ORIGINS is unset', () => {
    const { app } = buildApp();
    configureApp(app as never, 'api/auth');
    expect(app.enableCors).toHaveBeenCalledWith({ origin: ['http://localhost:8080'], credentials: true });
  });

  it('splits CORS_ORIGINS into a list', () => {
    process.env.CORS_ORIGINS = 'https://a.test,https://b.test';
    const { app } = buildApp();
    configureApp(app as never, 'api/auth');
    expect(app.enableCors).toHaveBeenCalledWith({ origin: ['https://a.test', 'https://b.test'], credentials: true });
  });
});
