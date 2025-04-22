// Set test environment
process.env.NODE_ENV = 'test';

// Mock environment variables for testing
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_mock_key';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.SMTP_HOST = 'smtp.example.com';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'test@example.com';
process.env.SMTP_PASS = 'test_password';
process.env.AWS_ACCESS_KEY_ID = 'test_aws_key';
process.env.AWS_SECRET_ACCESS_KEY = 'test_aws_secret';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_BUCKET_NAME = 'test-bucket'; 