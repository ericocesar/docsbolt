import { Test, TestingModule } from '@nestjs/testing';
import { TokenService } from './token.service';
import { mockProviders } from '../../../test-utils/mock-providers';

describe('TokenService', () => {
  let service: TokenService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TokenService, ...mockProviders],
    }).compile();

    service = module.get<TokenService>(TokenService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
