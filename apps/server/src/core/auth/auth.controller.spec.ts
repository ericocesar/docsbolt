import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { mockProviders } from '../../test-utils/mock-providers';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [...mockProviders],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
