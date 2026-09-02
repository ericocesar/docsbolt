import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';
import { mockProviders } from '../../test-utils/mock-providers';

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StorageService, ...mockProviders],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
