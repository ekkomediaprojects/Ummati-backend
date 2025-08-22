# Deployment Checklist for CORS Fixes

## Pre-Deployment Checklist

### ✅ Code Changes
- [ ] `app.js` - Enhanced CORS configuration and error handling
- [ ] `middleware/cors.js` - New centralized CORS middleware
- [ ] `middleware/auth.js` - Enhanced authentication error responses
- [ ] `routes/events.js` - Fixed JSON response format
- [ ] `routes/admin.js` - Added CORS preflight handling
- [ ] `scripts/testCors.js` - CORS testing script
- [ ] `CORS_FIXES_README.md` - Documentation
- [ ] `CONFIGURATION_GUIDE.md` - Setup guide

### ✅ Environment Configuration
- [ ] `.env` file created with required variables
- [ ] `JWT_SECRET` set to secure random string (64+ characters)
- [ ] `MONGODB_URI` configured correctly
- [ ] `NODE_ENV` set appropriately
- [ ] `PORT` configured (default: 5002)

### ✅ Frontend Domain Configuration
- [ ] Update `allowedOrigins` in `middleware/cors.js`
- [ ] Add your actual frontend domains
- [ ] Remove placeholder domains
- [ ] Include both HTTP and HTTPS versions if needed

## Deployment Steps

### 1. Local Testing
```bash
# Install dependencies
npm install

# Test CORS configuration
node scripts/testCors.js

# Start server
npm start

# Verify in browser DevTools
# - Check Network tab for CORS headers
# - Test admin login
# - Test event creation
```

### 2. Production Deployment
```bash
# Set production environment
export NODE_ENV=production

# Update CORS origins for production domains
# Edit middleware/cors.js

# Restart server
pm2 restart your-app-name
# or
systemctl restart your-service-name
```

### 3. Post-Deployment Verification
- [ ] Admin login works from frontend
- [ ] Event creation works consistently
- [ ] No CORS errors in browser console
- [ ] Proper error messages for expired tokens
- [ ] All admin routes accessible

## Testing Scenarios

### ✅ Test Cases to Verify
1. **Login Flow**
   - [ ] Login from frontend domain
   - [ ] Login from different browser
   - [ ] Login after clearing cookies

2. **Event Management**
   - [ ] Create first event
   - [ ] Create multiple events
   - [ ] Edit existing event
   - [ ] Delete event
   - [ ] Upload event image

3. **Token Expiry**
   - [ ] Wait for token to expire
   - [ ] Try to access protected route
   - [ ] Verify proper error message
   - [ ] Redirect to login page

4. **CORS Validation**
   - [ ] Test from allowed origin
   - [ ] Test from blocked origin
   - [ ] Verify preflight requests
   - [ ] Check response headers

## Monitoring & Debugging

### ✅ Logs to Monitor
- [ ] CORS blocked origins
- [ ] Authentication failures
- [ ] Token expiry events
- [ ] Validation errors
- [ ] Database connection issues

### ✅ Error Response Verification
- [ ] All errors return JSON format
- [ ] Proper HTTP status codes
- [ ] CORS headers on error responses
- [ ] Consistent error structure

## Rollback Plan

### If Issues Occur
1. **Immediate Rollback**
   ```bash
   git checkout HEAD~1
   npm install
   restart server
   ```

2. **Partial Rollback**
   - Revert only CORS changes
   - Keep authentication improvements
   - Test incrementally

3. **Debug Mode**
   ```bash
   NODE_ENV=development
   LOG_LEVEL=debug
   ```

## Performance Impact

### ✅ Expected Changes
- [ ] Slightly larger error responses (better debugging)
- [ ] CORS preflight caching (24 hours)
- [ ] Minimal overhead from additional headers
- [ ] Better error handling and logging

## Security Considerations

### ✅ Security Checklist
- [ ] Only trusted domains in CORS origins
- [ ] JWT_SECRET is secure and unique
- [ ] Credentials properly configured
- [ ] Headers limited to necessary ones
- [ ] Methods restricted appropriately

## Frontend Integration

### ✅ Frontend Updates Needed
- [ ] Handle new error response format
- [ ] Implement token refresh logic
- [ ] Update error handling
- [ ] Test with new CORS configuration

### ✅ Error Handling Example
```javascript
try {
    const response = await api.post('/admin/events', eventData);
    // Handle success
} catch (error) {
    if (error.response?.data?.success === false) {
        // New structured error format
        console.error(error.response.data.message);
    } else {
        // Network/CORS error
        console.error('Network error:', error.message);
    }
}
```

## Final Verification

### ✅ Production Checklist
- [ ] All tests pass
- [ ] CORS errors resolved
- [ ] Authentication working consistently
- [ ] Event management stable
- [ ] Error responses standardized
- [ ] Monitoring in place
- [ ] Documentation updated
- [ ] Team informed of changes

## Support & Maintenance

### ✅ Ongoing Tasks
- [ ] Monitor CORS logs
- [ ] Track authentication failures
- [ ] Update CORS origins as needed
- [ ] Regular security reviews
- [ ] Performance monitoring

### ✅ Contact Information
- Backend Engineer: [Your Name]
- Frontend Team: [Frontend Team Contact]
- DevOps: [DevOps Contact]
- Documentation: [Link to README]

---

**Deployment Date:** _______________
**Deployed By:** _______________
**Status:** _______________
**Notes:** _______________
