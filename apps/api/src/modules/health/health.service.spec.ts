import { Test } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;
  const prismaMock = { isHealthy: jest.fn() };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [HealthService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = moduleRef.get(HealthService);
    jest.clearAllMocks();
  });

  it('reports ok when the database is reachable', async () => {
    prismaMock.isHealthy.mockResolvedValue(true);
    const result = await service.check();
    expect(result.status).toBe('ok');
    expect(result.database).toBe('up');
    expect(typeof result.timestamp).toBe('string');
  });

  it('reports error when the database is unreachable', async () => {
    prismaMock.isHealthy.mockResolvedValue(false);
    const result = await service.check();
    expect(result.status).toBe('error');
    expect(result.database).toBe('down');
  });
});
