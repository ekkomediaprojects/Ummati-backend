# Configuration Guide for Ummati Backend

## Environment Variables Setup

Create a `.env` file in your project root with the following variables:

### Required Variables

```bash
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/ummati
# or for MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/ummati

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random
JWT_EXPIRES_IN=24h

# Server Configuration
PORT=5002
NODE_ENV=development
```

### Optional Variables

```bash
# AWS S3 Configuration (if using file uploads)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-s3-bucket-name

# Email Configuration (if using nodemailer)
EMAIL=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password

# Stripe Configuration (if using payments)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Logging
LOG_LEVEL=debug
LOG_FILE=server.log
```

## Frontend Domain Configuration

Update the `allowedOrigins` array in `middleware/cors.js` with your actual frontend domains:

```javascript
const allowedOrigins = [
    'http://localhost:3000',        // React dev server
    'http://localhost:3001',        // Alternative dev port
    'http://localhost:5173',        // Vite default
    'https://ummati-frontend.vercel.app',  // Your Vercel frontend
    'https://ummati-admin.vercel.app',     // Your admin dashboard
    'https://ummati.vercel.app'            // Your main domain
];
```

## JWT Secret Generation

Generate a secure JWT secret:

```bash
# Option 1: Using Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Option 2: Using OpenSSL
openssl rand -hex 64

# Option 3: Online generator (less secure)
# Visit: https://generate-secret.vercel.app/64
```

## MongoDB Setup

### Local MongoDB
```bash
# Install MongoDB
brew install mongodb-community  # macOS
sudo apt-get install mongodb   # Ubuntu

# Start MongoDB service
brew services start mongodb-community  # macOS
sudo systemctl start mongodb          # Ubuntu

# Create database
mongosh
use ummati
```

### MongoDB Atlas (Cloud)
1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Create a free cluster
3. Get connection string
4. Replace `MONGODB_URI` in `.env`

## Testing Configuration

### 1. Test Database Connection
```bash
npm start
# Should see: "Connected to MongoDB"
```

### 2. Test CORS Configuration
```bash
node scripts/testCors.js
# Should see: "🎉 CORS tests completed successfully!"
```

### 3. Test Authentication
```bash
# Test with curl
curl -X POST http://localhost:5002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

## Production Deployment

### Environment Variables
```bash
NODE_ENV=production
PORT=5002
JWT_SECRET=your_production_jwt_secret
MONGODB_URI=your_production_mongodb_uri
```

### CORS Origins
```javascript
const allowedOrigins = [
    'https://yourdomain.com',
    'https://www.yourdomain.com',
    'https://admin.yourdomain.com'
];
```

### Security Checklist
- [ ] JWT_SECRET is at least 64 characters
- [ ] NODE_ENV is set to 'production'
- [ ] MongoDB connection uses SSL
- [ ] Only necessary CORS origins are allowed
- [ ] Rate limiting is implemented (consider adding)
- [ ] HTTPS is enforced in production

## Troubleshooting

### Common Issues

1. **"MongoDB connection error"**
   - Check if MongoDB is running
   - Verify connection string format
   - Check network/firewall settings

2. **"JWT_SECRET is not defined"**
   - Ensure `.env` file exists
   - Check file permissions
   - Restart server after changes

3. **"CORS Error: Origin not allowed"**
   - Verify frontend domain in `allowedOrigins`
   - Check protocol (http vs https)
   - Restart server after CORS changes

4. **"Port already in use"**
   - Change PORT in `.env`
   - Kill process using the port: `lsof -ti:5002 | xargs kill -9`

### Debug Mode

Enable debug logging by setting:
```bash
LOG_LEVEL=debug
NODE_ENV=development
```

This will show detailed CORS and authentication logs.

## Monitoring

### Log Files
- Check server logs for CORS issues
- Monitor authentication failures
- Watch for token expiry patterns

### Health Checks
```bash
# Basic health check
curl http://localhost:5002/api/health

# CORS test
curl -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS \
     http://localhost:5002/api/events
```

## Support

If you encounter issues:
1. Check server logs for error details
2. Verify environment variables are set correctly
3. Test CORS configuration with the test script
4. Ensure MongoDB is accessible
5. Check frontend domain is in allowed origins
