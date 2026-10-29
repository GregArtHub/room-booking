import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { diskStorage } from 'multer';
import { env } from '../../config/env';
import { AppException } from '../app-exception';

const EXT_BY_MIME: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png' };

/** Загрузка изображений: только JPG/PNG и ограничение размера. */
export function imageUploadOptions(subdir: string, maxBytes: number): MulterOptions {
  return {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        const dir = join(env.uploadDir, subdir);
        mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => cb(null, `${randomUUID()}${EXT_BY_MIME[file.mimetype]}`),
    }),
    limits: { fileSize: maxBytes },
    fileFilter: (_req, file, cb) => {
      if (EXT_BY_MIME[file.mimetype]) return cb(null, true);
      cb(
        new AppException(400, 'INVALID_FILE_TYPE', 'Допустимы только изображения JPG и PNG'),
        false,
      );
    },
  };
}

export function publicUploadPath(subdir: string, filename: string): string {
  return `/uploads/${subdir}/${filename}`;
}
