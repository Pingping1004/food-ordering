import { BadRequestException } from '@nestjs/common';

const IMAGE_EXT = /\.(jpe?g|png|gif|webp)$/i;
const IMAGE_MIME = /^image\/(jpeg|png|gif|webp)$/;

/**
 * Accepts only real image uploads: both the file extension AND the declared content type must be an image type
 * (case-insensitive, so IMG_0001.JPG from a phone works). The bytes are verified again when the image is decoded
 * for resizing, so a renamed HTML/script file cannot reach storage.
 */
export const imageFileFilter = (req, file, callback) => {
  if (!IMAGE_EXT.test(file.originalname) || !IMAGE_MIME.test(file.mimetype ?? '')) {
    return callback(
      new BadRequestException(
        'Only image files (jpg, jpeg, png, gif, webp) are allowed!',
      ),
      false,
    );
  }
  callback(null, true);
};

/** Memory-storage uploads are buffered whole, so every upload route must cap size and count. */
export const IMAGE_FILE_SIZE_LIMIT = 8 * 1024 * 1024;
export const imageUploadLimits = (files = 1) => ({
  fileSize: IMAGE_FILE_SIZE_LIMIT,
  files,
  fields: 40,
});
