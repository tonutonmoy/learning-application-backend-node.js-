import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';



export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    // fileSize: 250 * 1024 * 1024, // ২৫০MB = 250 * 1024 * 1024 bytes
       fileSize: 1024 * 1024 * 1024, // 1GB limit
  },
  fileFilter(req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
    cb(null, true);
  }
});

