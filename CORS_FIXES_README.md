# CORS and Authentication Fixes for Ummati Backend

## Issues Fixed

### 1. CORS Configuration Problems
- **Before**: Basic `app.use(cors())` was too permissive and inconsistent
- **After**: Centralized CORS middleware with proper origin validation and headers

### 2. Authentication Response Issues
- **Before**: Inconsistent error response formats (sometimes plain text, sometimes JSON)
- **After**: Standardized JSON responses with proper error structure

### 3. Token Expiry Handling
- **Before**: Generic "Token expired" message without proper error structure
- **After**: Detailed error responses with proper HTTP status codes and JSON structure

### 4. Missing CORS Headers on Errors
- **Before**: Error responses didn't include CORS headers, causing browser blocking
- **After**: All responses (including errors) include proper CORS headers

## Files Modified

### 1. `app.js`
- Replaced basic CORS with enhanced configuration
- Added proper error handling middleware with CORS headers
- Added 404 handler with JSON response

### 2. `middleware/cors.js` (NEW)
- Centralized CORS configuration
- Preflight request handling
- Consistent CORS headers across all routes

### 3. `middleware/auth.js`
- Enhanced error responses with proper structure
- Better token expiry handling
- Consistent JSON response format

### 4. `routes/events.js`
- Fixed plain text responses to always return JSON
- Standardized response format

### 5. `routes/admin.js`
- Added CORS preflight handling for admin routes

## Configuration

### Frontend Domains
Update the `allowedOrigins` array in `middleware/cors.js` with your actual frontend domains:

```javascript
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173', // Vite default
    'https://yourfrontend.com', // Replace with your actual frontend domain
    'https://ummati-frontend.vercel.app', // Add your Vercel domain if using
    'https://ummati-admin.vercel.app', // Add your admin dashboard domain if different
    'https://ummati.vercel.app' // Add your main domain if different
];
```

### Environment Variables
Ensure these environment variables are set:
```bash
JWT_SECRET=your_jwt_secret_here
MONGODB_URI=your_mongodb_connection_string
NODE_ENV=production # or development
```

## Testing

### Run CORS Tests
```bash
node scripts/testCors.js
```

### Manual Testing
1. **Login Test**: Try logging in from different origins
2. **Event Creation Test**: Create events from admin dashboard
3. **Token Expiry Test**: Wait for token to expire and verify proper error response

## Response Format Standards

### Success Response
```json
{
    "success": true,
    "data": { ... },
    "message": "Optional message"
}
```

### Error Response
```json
{
    "success": false,
    "message": "Human readable message",
    "error": "Technical error details"
}
```

### Authentication Errors
```json
{
    "success": false,
    "message": "Token expired",
    "error": "Please login again to continue"
}
```

## CORS Headers Set

All responses now include:
- `Access-Control-Allow-Origin`: Origin-specific or `*`
- `Access-Control-Allow-Credentials`: `true`
- `Access-Control-Allow-Methods`: `GET, POST, PUT, DELETE, OPTIONS, PATCH`
- `Access-Control-Allow-Headers`: `Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key, Cache-Control`
- `Access-Control-Max-Age`: `86400` (24 hours)

## Troubleshooting

### Common Issues

1. **"CORS Error: Origin not allowed"**
   - Check if your frontend domain is in `allowedOrigins`
   - Verify the domain matches exactly (including protocol)

2. **"Invalid response format from server"**
   - Check server logs for validation errors
   - Verify all routes return JSON responses

3. **"Token expired" errors**
   - Implement frontend token refresh logic
   - Check JWT_SECRET environment variable

### Debug Steps

1. **Check Server Logs**
   ```bash
   # Look for CORS and authentication logs
   tail -f server.log | grep -E "(CORS|auth|token)"
   ```

2. **Verify CORS Headers**
   - Open browser DevTools → Network tab
   - Check if `Access-Control-Allow-Origin` header is present
   - Verify preflight OPTIONS requests return 204

3. **Test Token Validity**
   - Decode JWT token at jwt.io
   - Check expiration time
   - Verify signature

## Frontend Integration

### Axios Configuration
```javascript
import axios from 'axios';

const api = axios.create({
    baseURL: 'https://your-backend.com/api',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    }
});

// Add request interceptor for auth token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Add response interceptor for token expiry
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Handle token expiry - redirect to login
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);
```

### Error Handling
```javascript
try {
    const response = await api.post('/admin/events', eventData);
    // Handle success
} catch (error) {
    if (error.response?.data?.success === false) {
        // Handle structured error response
        console.error(error.response.data.message);
    } else {
        // Handle network/CORS errors
        console.error('Network error:', error.message);
    }
}
```

## Security Considerations

1. **Origin Validation**: Only allow trusted frontend domains
2. **Credentials**: Enable `credentials: true` for authenticated requests
3. **Headers**: Limit allowed headers to necessary ones only
4. **Methods**: Restrict HTTP methods to required ones
5. **Max Age**: Set reasonable cache duration for preflight requests

## Performance Impact

- **CORS Preflight**: Cached for 24 hours to reduce overhead
- **Response Headers**: Minimal overhead from additional CORS headers
- **Error Handling**: Slightly increased response size for better debugging

## Monitoring

### Logs to Watch
- CORS blocked origins
- Authentication failures
- Token expiry events
- Validation errors

### Metrics to Track
- CORS preflight request count
- Authentication success/failure rates
- Token expiry frequency
- Response time for admin routes

## Next Steps

1. **Update Frontend Domains**: Replace placeholder domains with actual ones
2. **Test Thoroughly**: Verify all admin operations work from frontend
3. **Monitor Logs**: Watch for any remaining CORS or auth issues
4. **Frontend Updates**: Ensure frontend handles new error response format
5. **Load Testing**: Test with multiple concurrent users if applicable
