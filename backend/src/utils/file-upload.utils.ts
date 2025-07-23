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