import { Test, TestingModule } from '@nestjs/testing';
import { PageService } from './page.service';
import { mockProviders } from '../../../test-utils/mock-providers';

describe('PageService', () => {
  let service: PageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PageService, ...mockProviders],
    }).compile();

    service = module.get<PageService>(PageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
