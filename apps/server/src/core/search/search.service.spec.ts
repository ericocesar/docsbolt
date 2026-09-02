import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { mockProviders } from '../../test-utils/mock-providers';

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SearchService, ...mockProviders],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
