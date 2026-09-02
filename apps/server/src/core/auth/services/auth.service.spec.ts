import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { mockProviders } from '../../../test-utils/mock-providers';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService, ...mockProviders],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
