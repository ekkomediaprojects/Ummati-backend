const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const multer = require('multer');
const { Readable } = require('stream');

// Initialize S3 Client
const s3Client = new S3Client({
    region: 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// Multer configuration
const multerStorage = multer.memoryStorage();

const upload = multer({
    storage: multerStorage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB limit
});

// Middleware to upload file to S3
const uploadToS3 = async (req, res, next) => {
  try {

      if (!req.file) {
          return res.status(400).json({ message: 'No file uploaded' });
      }

      const { originalname, buffer, mimetype } = req.file;
      const key = `user_anonymous/${Date.now()}-${originalname}`;

      console.log('Preparing to upload to S3:', {
          bucket: process.env.AWS_S3_BUCKET_NAME,
          key: key,
          mimetype: mimetype,
      });

      // Upload to S3
      const response = await s3Client.send(
          new PutObjectCommand({
              Bucket: process.env.AWS_S3_BUCKET_NAME, // Your bucket name
              Key: key,               // File path in S3
              Body: buffer,           // Use the buffer directly
              ContentType: mimetype,
              //ACL: 'public-read',    // Optional: Adjust based on your needs
          })
      );

      console.log('S3 upload successful:', response);

      // Set the file location
      req.file.location = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${key}`;
      console.log('File location set to:', req.file.location);

      next();
  } catch (error) {
      console.error('Error during S3 upload:', error);
      res.status(500).json({ message: 'Failed to upload image', error: error.message });
  }
};





module.exports = { upload, uploadToS3 };
