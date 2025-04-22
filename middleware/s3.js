const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const multer = require('multer');
const path = require('path');

// Configure AWS S3 client
const s3 = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1', // Default to us-east-1 if not set
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});
console.log('AWS S3 client initialized with region:', process.env.AWS_REGION || 'us-east-1');

// Configure multer for memory storage
const storage = multer.memoryStorage();
console.log('Multer memory storage configured');

// Helper function to generate clean filename
const generateCleanFilename = (user, originalname) => {
    console.log('Generating clean filename for:', {
        user: `${user.firstName} ${user.lastName}`,
        originalname
    });
    
    const ext = path.extname(originalname);
    const timestamp = new Date().toISOString().split('T')[0];
    const cleanFirstName = user.firstName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const cleanLastName = user.lastName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const filename = `${cleanFirstName}-${cleanLastName}-${timestamp}${ext}`;
    
    console.log('Generated filename:', filename);
    return filename;
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        console.log('Processing file upload:', {
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size
        });
        
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(file.mimetype)) {
            console.log('Invalid file type:', file.mimetype);
            cb(new Error('Invalid file type. Only JPEG, PNG, and GIF are allowed.'));
        } else {
            console.log('File type accepted');
            cb(null, true);
        }
    }
});

const uploadToS3 = async (req, res, next) => {
    console.log('=== S3 UPLOAD MIDDLEWARE START ===');
    console.log('Full request object:', {
        headers: req.headers,
        body: req.body,
        file: req.file,
        user: req.user
    });

    try {
        console.log('Checking if file exists in request...');
        if (!req.file) {
            console.log('No file found in request');
            return next();
        }

        console.log('File details:', {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size
        });

        console.log('Checking user information...');
        if (!req.user) {
            console.error('No user information found in request');
            return res.status(401).json({ message: 'User not authenticated' });
        }

        console.log('User details:', {
            id: req.user.id,
            firstName: req.user.firstName,
            lastName: req.user.lastName
        });

        // Generate clean filename
        const filename = generateCleanFilename(req.user, req.file.originalname);
        console.log('Generated filename:', filename);

        // Create directory path using user's name
        const userDir = `${req.user.firstName}-${req.user.lastName}`.toLowerCase();
        const filePath = `profile-pictures/${userDir}/${filename}`;
        console.log('Full file path:', filePath);

        const command = new PutObjectCommand({
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
        });

        console.log('S3 upload parameters:', {
            bucket: command.input.Bucket,
            key: command.input.Key,
            contentType: command.input.ContentType,
            metadata: command.input.Metadata,
            region: process.env.AWS_REGION || 'us-east-1'
        });

        console.log('Uploading to S3...');
        const result = await s3.send(command);
        console.log('S3 upload result:', result);

        // Construct the file URL
        const fileUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${filePath}`;
        req.file.location = fileUrl;
        console.log('File location set to:', req.file.location);

        console.log('=== S3 UPLOAD MIDDLEWARE END ===');
        next();
    } catch (error) {
        console.error('S3 upload error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            message: 'Failed to upload file to S3', 
            error: error.message,
            details: error.stack
        });
    }
};

module.exports = { upload, uploadToS3 };
