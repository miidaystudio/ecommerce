import { SkipThrottle } from '@nestjs/throttler';
import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { HealthService, HealthStatus } from './health.service';

// Polled by load balancers and uptime monitoring; throttling it would turn
// a healthy service into a failing one.
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  check(): Promise<HealthStatus> {
    return this.healthService.check();
  }
}
