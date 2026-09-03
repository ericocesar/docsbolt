import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { InsertableAiChat, InsertableAiChatMessage } from '@docmost/db/types/entity.types';
import { generateSlugId } from '../../common/helpers';
import { sql } from 'kysely';

@Injectable()
export class AiChatRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async createChat(input: InsertableAiChat) {
    return this.db
      .insertInto('aiChats')
      .values(input)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async findChatById(chatId: string, workspaceId: string) {
    return this.db
      .selectFrom('aiChats')
      .selectAll()
      .where('id', '=', chatId)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async listChatsByCreator(workspaceId: string, creatorId: string, limit: number) {
    return this.db
      .selectFrom('aiChats')
      .selectAll()
      .where('workspaceId', '=', workspaceId)
      .where('creatorId', '=', creatorId)
      .where('deletedAt', 'is', null)
      .orderBy('updatedAt', 'desc')
      .limit(limit)
      .execute();
  }

  async softDeleteChat(chatId: string, workspaceId: string) {
    await this.db
      .updateTable('aiChats')
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where('id', '=', chatId)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .execute();
  }

  async updateChatTitle(chatId: string, workspaceId: string, title: string) {
    return this.db
      .updateTable('aiChats')
      .set({ title, updatedAt: new Date() })
      .where('id', '=', chatId)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .returningAll()
      .executeTakeFirst();
  }

  async searchChats(workspaceId: string, creatorId: string, query: string, limit = 20) {
    const q = `%${query.toLowerCase()}%`;
    return this.db
      .selectFrom('aiChats')
      .selectAll()
      .where('workspaceId', '=', workspaceId)
      .where('creatorId', '=', creatorId)
      .where('deletedAt', 'is', null)
      .where((eb) =>
        eb.or([
          eb(eb.fn('lower', ['title']), 'like', q),
          eb('id', 'in', (sub) =>
            sub
              .selectFrom('aiChatMessages')
              .select('chatId')
              .where('workspaceId', '=', workspaceId)
              .where(sql<string>`lower(content)`, 'like', q)
              .distinct(),
          ),
        ]),
      )
      .orderBy('updatedAt', 'desc')
      .limit(limit)
      .execute();
  }

  async insertMessage(input: InsertableAiChatMessage) {
    return this.db
      .insertInto('aiChatMessages')
      .values(input)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async listMessages(chatId: string, workspaceId: string, limit = 200) {
    return this.db
      .selectFrom('aiChatMessages')
      .select([
        'id',
        'chatId',
        'workspaceId',
        'userId',
        'role',
        'content',
        'toolCalls',
        'metadata',
        'createdAt',
        'updatedAt',
      ])
      .where('chatId', '=', chatId)
      .where('workspaceId', '=', workspaceId)
      .orderBy('createdAt', 'asc')
      .limit(limit)
      .execute();
  }

  /** Used for the dedupe check on `page_id` collision when generating slug. */
  generateSlugId(): string {
    return generateSlugId();
  }
}
