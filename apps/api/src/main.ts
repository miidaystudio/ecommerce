import { join } from 'path';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);

  const globalPrefix = config.get<string>('app.globalPrefix', 'api');
  const port = config.get<number>('app.port', 4000);
  const corsOrigins = config.get<string[]>('app.corsOrigins', []);

  app.use(cookieParser());
  // Uploaded images are user-provided content; block MIME-sniffing so a spoofed
  // Content-Type can't get a file interpreted as HTML/script by the browser.
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  });
  app.setGlobalPrefix(globalPrefix);
  app.enableCors({ origin: corsOrigins, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(port);
  Logger.log(`API running on http://localhost:${port}/${globalPrefix}`, 'Bootstrap');
}

void bootstrap();
