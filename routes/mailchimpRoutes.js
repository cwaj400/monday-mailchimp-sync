const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { getMailchimpClient } = require('../utils/mailchimpClient');
const { logger } = require('../utils/logger');

// Rate limiting for batch monitoring endpoints
const batchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Rate limit exceeded',
    message: 'Too many batch status requests. Please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.warn('Rate limit exceeded for batch monitoring', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      route: req.originalUrl
    });
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many batch status requests. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// IP whitelist middleware (optional)
function ipWhitelist(req, res, next) {
  const allowedIPs = process.env.ALLOWED_IPS?.split(',') || [];
  
  // If no IPs are configured, allow all (for development)
  if (allowedIPs.length === 0) {
    return next();
  }
  
  const clientIP = req.ip || req.connection.remoteAddress;
  
  if (!allowedIPs.includes(clientIP)) {
    logger.warn('IP not allowed for batch monitoring', {
      ip: clientIP,
      allowedIPs: allowedIPs,
      route: req.originalUrl
    });
    return res.status(403).json({ 
      error: 'Forbidden', 
      message: 'Your IP address is not allowed to access this endpoint.' 
    });
  }
  
  next();
}



// Apply rate limiting and IP whitelist to all batch endpoints
router.use('/batches', batchLimiter, ipWhitelist);

// Get all batches
router.get('/batches', async (req, res) => {
  try {
    // Log the request
    logger.info('Batch monitoring request', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      route: '/api/mailchimp/batches'
    });
    
    const mailchimp = getMailchimpClient();
    const batches = await mailchimp.batches.list();
    
    logger.info('Retrieved Mailchimp batches', {
      count: batches.batches?.length || 0,
      route: '/api/mailchimp/batches'
    });
    
    // Add security headers
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    });
    
    res.json({
      success: true,
      batches: batches.batches || [],
      total: batches.total_items || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error retrieving Mailchimp batches', {
      error: error.message,
      ip: req.ip,
      route: '/api/mailchimp/batches'
    });
    
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get pending/processing batches only
router.get('/batches/active', async (req, res) => {
  try {
    // Log the request
    logger.info('Active batches request', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      route: '/api/mailchimp/batches/active'
    });
    
    const mailchimp = getMailchimpClient();
    const batches = await mailchimp.batches.list();
    
    const activeBatches = (batches.batches || []).filter(batch => 
      batch.status === 'pending' || batch.status === 'processing'
    );
    
    logger.info('Retrieved active Mailchimp batches', {
      count: activeBatches.length,
      route: '/api/mailchimp/batches/active'
    });
    
    // Add security headers
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    });
    
    res.json({
      success: true,
      batches: activeBatches,
      count: activeBatches.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error retrieving active Mailchimp batches', {
      error: error.message,
      ip: req.ip,
      route: '/api/mailchimp/batches/active'
    });
    
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get specific batch status
router.get('/batches/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    
    // Log the request
    logger.info('Batch status request', {
      batchId: batchId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      route: '/api/mailchimp/batches/:batchId'
    });
    
    // Validate batch ID format
    if (!batchId || typeof batchId !== 'string' || batchId.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Invalid batch ID format'
      });
    }
    
    const mailchimp = getMailchimpClient();
    const batchStatus = await mailchimp.batches.status(batchId);
    
    logger.info('Retrieved Mailchimp batch status', {
      batchId: batchId,
      status: batchStatus.status,
      route: '/api/mailchimp/batches/:batchId'
    });
    
    // Add security headers
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    });
    
    res.json({
      success: true,
      batch: batchStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error retrieving Mailchimp batch status', {
      batchId: req.params.batchId,
      error: error.message,
      ip: req.ip,
      route: '/api/mailchimp/batches/:batchId'
    });
    
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});



module.exports = router;
