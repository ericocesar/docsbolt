import { Test, TestingModule } from '@nestjs/testing';
import { GroupService } from './group.service';
import { mockProviders } from '../../../test-utils/mock-providers';

describe('GroupService', () => {
  let service: GroupService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GroupService, ...mockProviders],
    }).compile();

    service = module.get<GroupService>(GroupService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
