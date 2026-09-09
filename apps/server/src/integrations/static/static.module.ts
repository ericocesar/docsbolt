import { Module, OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { join } from 'path';
import * as fs from 'node:fs';
import fastifyStatic from '@fastify/static';
import { EnvironmentService } from '../environment/environment.service';

@Module({})
export class StaticModule implements OnModuleInit {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly environmentService: EnvironmentService,
  ) {}

  public async onModuleInit() {
    const httpAdapter = this.httpAdapterHost.httpAdapter;
    const app = httpAdapter.getInstance();

    const clientDistPath = join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'client/dist',
    );

    const indexFilePath = join(clientDistPath, 'index.html');

    if (fs.existsSync(clientDistPath) && fs.existsSync(indexFilePath)) {
      const indexTemplateFilePath = join(clientDistPath, 'index-template.html');
      const windowVar = '<!--window-config-->';

      const configString = {
        ENV: this.environmentService.getNodeEnv(),
        APP_URL: this.environmentService.getAppUrl(),
        CLOUD: this.environmentService.isCloud(),
        FILE_UPLOAD_SIZE_LIMIT:
          this.environmentService.getFileUploadSizeLimit(),
        FILE_IMPORT_SIZE_LIMIT:
          this.environmentService.getFileImportSizeLimit(),
        DRAWIO_URL: this.environmentService.getDrawioUrl(),
        SUBDOMAIN_HOST: this.environmentService.isCloud()
          ? this.environmentService.getSubdomainHost()
          : undefined,
        COLLAB_URL: this.environmentService.getCollabUrl(),
        BILLING_TRIAL_DAYS: this.environmentService.isCloud()
          ? this.environmentService.getBillingTrialDays()
          : undefined,
        BETA_PUBLIC_SPACES: this.environmentService.isBetaPublicSpaces(),
        POSTHOG_HOST: this.environmentService.getPostHogHost(),
        POSTHOG_KEY: this.environmentService.getPostHogKey(),
        AI_VECTOR_DRIVER:
          this.environmentService.getAiVectorDriver() === 'turbopuffer'
            ? 'turbopuffer'
            : undefined,
      };

      const windowScriptContent = `<script>window.CONFIG=${JSON.stringify(configString)};</script>`;

      const syncIndexHtml = () => {
        try {
          let template = fs.readFileSync(indexFilePath, 'utf8');
          if (template.includes(windowVar)) {
            fs.writeFileSync(indexTemplateFilePath, template);
          } else if (fs.existsSync(indexTemplateFilePath)) {
            template = fs.readFileSync(indexTemplateFilePath, 'utf8');
          }

          const transformedHtml = template.replace(
            windowVar,
            windowScriptContent,
          );
          fs.writeFileSync(indexFilePath, transformedHtml);
        } catch {
          // ignore error if file cannot be read/written
        }
      };

      syncIndexHtml();

      const RENDER_PATH = '*';

      await app.register(fastifyStatic, {
        root: clientDistPath,
        wildcard: false,
        index: false,
        setHeaders: (reply: any, pathName: string) => {
          // Vite content-hashes everything under /assets, so they can be cached forever
          if (/[\\/]assets[\\/]/.test(pathName)) {
            reply.header(
              'Cache-Control',
              'public, max-age=31536000, immutable',
            );
          }
        },
      });

      app.get(RENDER_PATH, (req: any, res: any) => {
        const rawUrl = (req.raw?.url || req.url || '').split('?')[0];
        const cleanPath = decodeURIComponent(rawUrl.replace(/^\/+/, ''));
        const candidatePath = join(clientDistPath, cleanPath);

        // If a static file exists on disk (e.g. newly built chunk created while server was running),
        // serve it directly with proper MIME type
        if (
          cleanPath &&
          candidatePath.startsWith(clientDistPath) &&
          fs.existsSync(candidatePath) &&
          fs.statSync(candidatePath).isFile()
        ) {
          return res.sendFile(cleanPath);
        }

        // If an asset/script/style was requested and does not exist, return 404 instead of index.html.
        // This prevents the browser from receiving HTML for module scripts (fixing the MIME type error).
        if (
          cleanPath.startsWith('assets/') ||
          /\.(js|mjs|cjs|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|json|map)$/i.test(
            cleanPath,
          )
        ) {
          return res.status(404).send('Not Found');
        }

        syncIndexHtml();

        const stream = fs.createReadStream(indexFilePath);
        res
          .header('Cache-Control', 'no-cache, no-store, must-revalidate')
          .type('text/html')
          .send(stream);
      });
    }
  }
}
