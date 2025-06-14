import { extname } from 'path';
import { HttpException, HttpStatus } from '@nestjs/common';

export const imageFileFilter = (req, file, callback) => {
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
    // Reject file with a specific HTTP exception
    return callback(
      new HttpException(
        'Only image files (jpg, jpeg, png, gif, webp) are allowed!',
        HttpStatus.BAD_REQUEST, // Or HttpStatus.UNSUPPORTED_MEDIA_TYPE (415)
      ),
      false,
    );
  }
  callback(null, true); // Accept file
};

export const editFileName = (req, file, callback) => {
  const name = file.originalname.split('.')[0];
  const fileExtName = extname(file.originalname);
  const randomName = Array(16) // Generates a 16-character random hex string
    .fill(null)
    .map(() => Math.round(Math.random() * 16).toString(16))
    .join('');
  callback(null, `${name}-${randomName}${fileExtName}`); // e.g., 'my-restaurant-image-a1b2c3d4e5f6g7h8.png'
};