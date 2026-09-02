import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from './search.controller';
import { mockProviders } from '../../test-utils/mock-providers';

describe('SearchController', () => {
  let controller: SearchController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [...mockProviders],
    }).compile();

    controller = module.get<SearchController>(SearchController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
