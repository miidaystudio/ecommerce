import { join } from 'path';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import express from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  // bodyParser disabled here so we can register a raw-body parser scoped to
  // the Razorpay webhook route before the general JSON parser — signature
  // verification needs the exact raw bytes Razorpay signed, which a
  // parsed-then-reserialized JSON body cannot guarantee byte-for-byte.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
    bodyParser: false,
  });
  const config = app.get(ConfigService);

  const globalPrefix = config.get<string>('app.globalPrefix', 'api');
  const port = config.get<number>('app.port', 4000);
  const corsOrigins = config.get<string[]>('app.corsOrigins', []);

  // Rate limiting keys anonymous requests on the client IP, so Express has to
  // be told whether X-Forwarded-For can be believed. This is deliberately
  // opt-in and defaults to off, because getting it wrong fails in one of two
  // bad ways: left off behind a load balancer, every visitor shares the
  // balancer's IP and one of them can exhaust the limit for everybody; turned
  // on while the API is directly reachable, a client can forge the header and
  // evade the limit entirely. Set TRUST_PROXY to the number of proxy hops in
  // front of the API (Vercel/Railway/Render in front of this service is 1).
  const trustProxy = config.get<string>('app.trustProxy', '');
  if (trustProxy) {
    const hops = Number(trustProxy);
    app.set('trust proxy', Number.isInteger(hops) && hops > 0 ? hops : trustProxy);
  }

  app.use(`/${globalPrefix}/payments/webhook/razorpay`, express.raw({ type: '*/*' }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

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

  await app.listen(port, '0.0.0.0');
  Logger.log(`API running on http://0.0.0.0:${port}/${globalPrefix}`, 'Bootstrap');
}

void bootstrap();
