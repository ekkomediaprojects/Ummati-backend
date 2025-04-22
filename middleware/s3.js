const AWS = require('aws-sdk');
const multer = require('multer');
const path = require('path');
const logger = require('../utils/logger');

console.log('\n=== S3 MIDDLEWARE INITIALIZATION START ===');
console.log('Initializing AWS S3 client...');

// Configure AWS
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

const s3 = new AWS.S3();
logger.info('AWS S3 client initialized');

// Configure multer for memory storage
const storage = multer.memoryStorage();
logger.info('Multer memory storage configured');

// Helper function to generate clean filename
const generateCleanFilename = (user, originalname) => {
    logger.debug('Generating clean filename', { user, originalname });
    
    const ext = path.extname(originalname);
    const timestamp = new Date().toISOString().split('T')[0];
    const cleanFirstName = user.firstName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const cleanLastName = user.lastName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const filename = `${cleanFirstName}-${cleanLastName}-${timestamp}${ext}`;
    
    logger.debug('Generated filename', { filename });
    return filename;
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        logger.debug('Processing file upload', {
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size
        });
        
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(file.mimetype)) {
            logger.warn('Invalid file type attempted', { mimetype: file.mimetype });
            cb(new Error('Invalid file type. Only JPEG, PNG, and GIF are allowed.'));
        } else {
            logger.debug('File type accepted');
            cb(null, true);
        }
    }
});

const uploadToS3 = async (req, res, next) => {
    logger.info('Processing S3 upload request', {
        method: req.method,
        path: req.path,
        url: req.originalUrl
    });

    try {
        if (!req.file) {
            logger.warn('No file found in request');
            return res.status(400).json({ message: 'No file uploaded' });
        }

        if (!req.user) {
            logger.warn('No user information found in request');
            return res.status(400).json({ message: 'User information is required' });
        }

        if (!req.user.firstName || !req.user.lastName) {
            logger.warn('User missing first or last name', { user: req.user });
            return res.status(400).json({ message: 'User first and last name are required' });
        }

        const filename = generateCleanFilename(req.user, req.file.originalname);
        const filePath = `profile-pictures/${req.user.id}/${filename}`;
        logger.debug('Generated file path', { filePath });

        const params = {
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: filePath,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
            Metadata: {
                userId: String(req.user.id),
                firstName: req.user.firstName,
                lastName: req.user.lastName,
                uploadDate: new Date().toISOString()
            }
        };

        logger.debug('Uploading to S3', { params: { ...params, Body: '[Buffer]' } });
        const result = await s3.upload(params).promise();
        logger.info('S3 upload successful', { 
            location: result.Location,
            key: result.Key
        });

        req.file.location = result.Location;
        next();
    } catch (error) {
        logger.error('S3 upload failed', { 
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ 
            message: 'Failed to upload image to S3', 
            error: error.message
        });
    }
};

console.log('=== S3 MIDDLEWARE INITIALIZATION END ===\n');

module.exports = { upload, uploadToS3 };
