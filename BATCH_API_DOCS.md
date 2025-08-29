# Mailchimp Batch Monitoring API

Secure API endpoints for monitoring Mailchimp batch operations.

## Authentication

All endpoints require API key authentication via the `x-api-key` header.

```bash
curl -H "x-api-key: YOUR_APP_API_KEY" \
  https://your-app.vercel.app/api/mailchimp/batches
```

## Rate Limiting

- **Limit**: 100 requests per 15 minutes per IP
- **Headers**: Rate limit info included in response headers
- **Response**: 429 status with retry information when exceeded

## IP Whitelisting (Optional)

Set `ALLOWED_IPS` environment variable to restrict access:
```bash
ALLOWED_IPS=192.168.1.1,10.0.0.1
```

## Endpoints

### 1. Get All Batches
```bash
GET /api/mailchimp/batches
```

**Response:**
```json
{
  "success": true,
  "batches": [
    {
      "id": "batch_123",
      "status": "finished",
      "total_operations": 1,
      "finished_operations": 1,
      "errored_operations": 0,
      "created_at": "2025-08-28T23:12:04.592Z"
    }
  ],
  "total": 1,
  "timestamp": "2025-08-28T23:12:04.592Z"
}
```

### 2. Get Specific Batch Status
```bash
GET /api/mailchimp/batches/{batchId}
```

**Response:**
```json
{
  "success": true,
  "batch": {
    "id": "batch_123",
    "status": "finished",
    "total_operations": 1,
    "finished_operations": 1,
    "errored_operations": 0,
    "response_body_url": "https://..."
  },
  "timestamp": "2025-08-28T23:12:04.592Z"
}
```

### 3. Get Active Batches Only
```bash
GET /api/mailchimp/batches/active
```

**Response:**
```json
{
  "success": true,
  "batches": [
    {
      "id": "batch_456",
      "status": "processing",
      "total_operations": 1,
      "finished_operations": 0,
      "errored_operations": 0
    }
  ],
  "count": 1,
  "timestamp": "2025-08-28T23:12:04.592Z"
}
```



## Security Features

✅ **API Key Authentication** - Required for all endpoints
✅ **Rate Limiting** - 100 requests per 15 minutes per IP
✅ **IP Whitelisting** - Optional IP restriction
✅ **Request Logging** - All requests logged with IP and User-Agent
✅ **Security Headers** - XSS protection, content type options
✅ **Input Validation** - Batch ID format validation
✅ **Error Handling** - Comprehensive error responses

## Error Responses

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing API key"
}
```

### 429 Rate Limit Exceeded
```json
{
  "error": "Rate limit exceeded",
  "message": "Too many batch status requests. Please try again later.",
  "retryAfter": 900
}
```

### 403 Forbidden (IP Whitelist)
```json
{
  "error": "Forbidden",
  "message": "Your IP address is not allowed to access this endpoint."
}
```

### 400 Bad Request
```json
{
  "success": false,
  "error": "Invalid batch ID format"
}
```

## Environment Variables

```bash
# Required
APP_API_KEY=your_api_key_here

# Optional
ALLOWED_IPS=192.168.1.1,10.0.0.1
```

## Usage Examples

### Monitor Active Batches
```bash
curl -H "x-api-key: YOUR_KEY" \
  https://your-app.vercel.app/api/mailchimp/batches/active
```

### Check Specific Batch
```bash
curl -H "x-api-key: YOUR_KEY" \
  https://your-app.vercel.app/api/mailchimp/batches/batch_123
```

### Get All Batches
```bash
curl -H "x-api-key: YOUR_KEY" \
  https://your-app.vercel.app/api/mailchimp/batches
```
