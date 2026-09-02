import { Test, TestingModule } from '@nestjs/testing';
import { SpaceService } from './space.service';
import { mockProviders } from '../../../test-utils/mock-providers';

describe('SpaceService', () => {
  let service: SpaceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SpaceService, ...mockProviders],
    }).compile();

    service = module.get<SpaceService>(SpaceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
