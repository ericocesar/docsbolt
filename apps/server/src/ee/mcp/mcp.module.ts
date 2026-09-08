import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';
import { PageModule } from '../../core/page/page.module';
import { SpaceModule } from '../../core/space/space.module';
import { SearchModule } from '../../core/search/search.module';
import { CommentModule } from '../../core/comment/comment.module';

@Module({
  imports: [
    PageModule,
    SpaceModule,
    SearchModule,
    CommentModule,
  ],
  controllers: [McpController],
  providers: [McpService],
  exports: [McpService],
})
export class McpModule {}
