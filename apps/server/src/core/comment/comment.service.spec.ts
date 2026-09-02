import { Test, TestingModule } from '@nestjs/testing';
import { CommentService } from './comment.service';
import { mockProviders } from '../../test-utils/mock-providers';

describe('CommentService', () => {
  let service: CommentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CommentService, ...mockProviders],
    }).compile();

    service = module.get<CommentService>(CommentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
