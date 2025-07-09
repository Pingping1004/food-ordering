import { extname } from 'path';
import { BadRequestException } from '@nestjs/common';

export const imageFileFilter = (req, file, callback) => {
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
    // Reject file with a specific HTTP exception
    return callback(
      new BadRequestException(
        'Only image files (jpg, jpeg, png, gif, webp) are allowed!',
      ),
      false,
    );
  }
  callback(null, true); // Accept file
};

export const editFileName = (req, file: Express.Multer.File, callback: (error: Error | null, filename: string) => void) => {
  const name = file.originalname.split('.')[0];

  const fileExtName = extname(file.originalname);

  const randomName = require('crypto').randomBytes(16).toString('hex');

  callback(null, `${name}-${randomName}${fileExtName}`);
};