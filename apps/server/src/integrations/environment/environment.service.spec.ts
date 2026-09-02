import { Test, TestingModule } from '@nestjs/testing';
import { EnvironmentService } from './environment.service';
import { mockProviders } from '../../test-utils/mock-providers';

describe('EnvironmentService', () => {
  let service: EnvironmentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EnvironmentService, { provide: 'ConfigService', useValue: {} }, ...mockProviders.filter((p) => (p as any).provide !== 'ConfigService')],
    }).compile();

    service = module.get<EnvironmentService>(EnvironmentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
