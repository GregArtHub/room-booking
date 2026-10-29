import { INestApplication, ValidationError, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppException, ErrorDetail } from './common/app-exception';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { env } from './config/env';

function flatten(errors: ValidationError[], parent = ''): ErrorDetail[] {
  return errors.flatMap((e) => {
    const field = parent ? `${parent}.${e.property}` : e.property;
    const own = Object.values(e.constraints ?? {}).map((message) => ({ field, message }));
    return [...own, ...flatten(e.children ?? [], field)];
  });
}

/** Общая настройка приложения: используется и в main.ts, и в e2e-тестах. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.use(helmet({ contentSecurityPolicy: false }));
  // CORS настроен на конкретный домен клиента
  app.enableCors({ origin: env.frontendUrl, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (errors) =>
        new AppException(400, 'VALIDATION_ERROR', 'Ошибка валидации', flatten(errors)),
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
}
