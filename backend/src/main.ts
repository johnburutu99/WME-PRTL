import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  // Capture raw body for HMAC webhook signature verification
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  const configService = app.get(ConfigService);

  // Validate required secrets are present before accepting any traffic
  const jwtSecret = configService.get<string>('JWT_SECRET');
  const webhookSecret = configService.get<string>('WEBHOOK_SECRET');
  if (!jwtSecret) {
    throw new Error('FATAL: JWT_SECRET environment variable is not set. Refusing to start.');
  }
  if (!webhookSecret) {
    throw new Error('FATAL: WEBHOOK_SECRET environment variable is not set. Refusing to start.');
  }

  // Lock CORS to the configured frontend origin only
  const frontendOrigin = configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  app.enableCors({
    origin: frontendOrigin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Global validation pipe — strip unknown fields, auto-transform types
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = configService.get<number>('PORT') || 3001;
  await app.listen(port);
  console.log(`WME API Backend is running on port ${port}`);
}
bootstrap();
