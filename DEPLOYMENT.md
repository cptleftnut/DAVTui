# DAVClaw Deployment Guide

This guide provides instructions for deploying DAVClaw in production environments.

## Pre-Deployment Checklist

- [ ] All tests passing (`npm test`)
- [ ] Environment variables configured
- [ ] Database migrations completed
- [ ] API keys validated
- [ ] CORS settings configured for production
- [ ] SSL/TLS certificates prepared
- [ ] Backup strategy implemented
- [ ] Monitoring setup configured

## Environment Configuration

### Production .env

```env
# Server Configuration
PORT=3001
NODE_ENV=production

# Project Directory
PROJECT_DIR=/opt/davclaw

# AI API Keys (use secure secret management)
GEMINI_API_KEY=${GEMINI_API_KEY}
CLAUDE_API_KEY=${CLAUDE_API_KEY}

# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434

# Database
DATABASE_PATH=/var/lib/davclaw/davclaw.db

# WebSocket Configuration
WEBSOCKET_CORS_ORIGIN=https://yourdomain.com

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/davclaw/app.log
```

## Docker Deployment

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application
COPY backend ./backend
COPY frontend ./frontend

# Build frontend
WORKDIR /app/frontend
RUN npm ci
RUN npm run build

# Create data directory
RUN mkdir -p /app/data

WORKDIR /app

# Expose ports
EXPOSE 3001 5173

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/adb/devices', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start application
CMD ["npm", "start"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  davclaw-backend:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DATABASE_PATH=/data/davclaw.db
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
    volumes:
      - davclaw-data:/data
      - /var/run/adb:/var/run/adb
    restart: unless-stopped
    networks:
      - davclaw-network

  davclaw-frontend:
    image: node:18-alpine
    working_dir: /app
    command: npm run preview
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
    depends_on:
      - davclaw-backend
    restart: unless-stopped
    networks:
      - davclaw-network

volumes:
  davclaw-data:

networks:
  davclaw-network:
```

## Kubernetes Deployment

### Deployment Manifest

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: davclaw
  labels:
    app: davclaw
spec:
  replicas: 1
  selector:
    matchLabels:
      app: davclaw
  template:
    metadata:
      labels:
        app: davclaw
    spec:
      containers:
      - name: davclaw
        image: davclaw:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: GEMINI_API_KEY
          valueFrom:
            secretKeyRef:
              name: davclaw-secrets
              key: gemini-api-key
        - name: CLAUDE_API_KEY
          valueFrom:
            secretKeyRef:
              name: davclaw-secrets
              key: claude-api-key
        volumeMounts:
        - name: data
          mountPath: /data
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/adb/devices
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/adb/devices
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: davclaw-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: davclaw-service
spec:
  selector:
    app: davclaw
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3001
  type: LoadBalancer
```

## Nginx Reverse Proxy

```nginx
upstream davclaw_backend {
    server localhost:3001;
}

server {
    listen 80;
    server_name davclaw.example.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name davclaw.example.com;
    
    # SSL Configuration
    ssl_certificate /etc/ssl/certs/davclaw.crt;
    ssl_certificate_key /etc/ssl/private/davclaw.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # API Proxy
    location /api/ {
        proxy_pass http://davclaw_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }
    
    # WebSocket Proxy
    location /socket.io/ {
        proxy_pass http://davclaw_backend;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    # Frontend
    location / {
        root /var/www/davclaw/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

## Systemd Service

### /etc/systemd/system/davclaw.service

```ini
[Unit]
Description=DAVClaw Coding Agent
After=network.target

[Service]
Type=simple
User=davclaw
WorkingDirectory=/opt/davclaw
Environment="NODE_ENV=production"
Environment="PORT=3001"
ExecStart=/usr/bin/node backend/index.js
Restart=on-failure
RestartSec=10

# Security
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

### Enable and Start Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable davclaw
sudo systemctl start davclaw
sudo systemctl status davclaw
```

## Database Backup

### Automated Backup Script

```bash
#!/bin/bash
# backup-davclaw.sh

BACKUP_DIR="/var/backups/davclaw"
DB_PATH="/var/lib/davclaw/davclaw.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/davclaw_$TIMESTAMP.db"

mkdir -p "$BACKUP_DIR"

# Backup database
cp "$DB_PATH" "$BACKUP_FILE"

# Compress backup
gzip "$BACKUP_FILE"

# Remove backups older than 30 days
find "$BACKUP_DIR" -name "*.db.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE.gz"
```

### Cron Job

```bash
0 2 * * * /usr/local/bin/backup-davclaw.sh
```

## Monitoring & Logging

### Prometheus Metrics

Add to backend for Prometheus scraping:

```javascript
const promClient = require('prom-client');

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration.labels(req.method, req.route?.path || req.path, res.statusCode).observe(duration);
  });
  next();
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});
```

### Log Aggregation

Configure ELK Stack or similar for centralized logging:

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: '/var/log/davclaw/error.log', level: 'error' }),
    new winston.transports.File({ filename: '/var/log/davclaw/combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

## Performance Optimization

### Database Indexing

```sql
CREATE INDEX idx_logs_timestamp ON logs(timestamp);
CREATE INDEX idx_logs_type ON logs(type);
CREATE INDEX idx_adb_commands_device_id ON adb_commands(device_id);
CREATE INDEX idx_adb_commands_timestamp ON adb_commands(timestamp);
CREATE INDEX idx_ai_interactions_model ON ai_interactions(model);
CREATE INDEX idx_device_state_device_id ON device_state(device_id);
```

### Caching

```javascript
const redis = require('redis');
const client = redis.createClient();

app.get('/api/adb/devices', async (req, res) => {
  const cacheKey = 'adb:devices';
  const cached = await client.get(cacheKey);
  
  if (cached) {
    return res.json(JSON.parse(cached));
  }
  
  // Fetch devices
  const devices = await getDevices();
  
  // Cache for 5 seconds
  await client.setex(cacheKey, 5, JSON.stringify(devices));
  res.json(devices);
});
```

## Security Hardening

1. **API Rate Limiting**
   ```javascript
   const rateLimit = require('express-rate-limit');
   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000,
     max: 100
   });
   app.use('/api/', limiter);
   ```

2. **CORS Configuration**
   ```javascript
   app.use(cors({
     origin: process.env.ALLOWED_ORIGINS?.split(','),
     credentials: true
   }));
   ```

3. **Input Validation**
   ```javascript
   const { body, validationResult } = require('express-validator');
   
   app.post('/api/adb/execute', [
     body('command').trim().notEmpty(),
     body('deviceId').optional().trim()
   ], (req, res) => {
     const errors = validationResult(req);
     if (!errors.isEmpty()) {
       return res.status(400).json({ errors: errors.array() });
     }
     // Process request
   });
   ```

## Troubleshooting

### High Memory Usage
- Check for memory leaks in long-running processes
- Implement periodic log archiving
- Monitor WebSocket connections

### Database Locks
- Optimize queries
- Implement connection pooling
- Check for long-running transactions

### WebSocket Disconnections
- Verify firewall rules
- Check proxy timeout settings
- Implement automatic reconnection

## Rollback Procedure

1. Stop current service: `systemctl stop davclaw`
2. Restore previous database: `cp /var/backups/davclaw/previous.db /var/lib/davclaw/davclaw.db`
3. Checkout previous version: `git checkout <previous-tag>`
4. Install dependencies: `npm install`
5. Start service: `systemctl start davclaw`

## Support & Monitoring

- Monitor application logs: `journalctl -u davclaw -f`
- Check database size: `ls -lh /var/lib/davclaw/davclaw.db`
- Monitor disk space: `df -h`
- Check system resources: `top` or `htop`

---

For additional support, refer to the main README.md or GitHub issues.
