# Error Handling Runbook

This runbook provides step-by-step procedures for diagnosing and resolving common error scenarios in the N8N StreamDeck application.

## 🚨 Emergency Response Procedures

### Critical System Failures

#### Application Won't Start

**Symptoms:** Server fails to start, crashes immediately, or exits with error code

**Immediate Actions:**

1. Check system resources (memory, disk space, CPU)
2. Verify environment variables and configuration
3. Check log files for startup errors
4. Validate database connectivity

**Diagnostic Commands:**

```bash
# Check system resources
df -h                    # Disk space
free -h                  # Memory usage
top                      # CPU and process info

# Check application logs
tail -f logs/error-$(date +%Y-%m-%d).log
tail -f logs/combined-$(date +%Y-%m-%d).log

# Test configuration
npm run typecheck        # Verify TypeScript compilation
npm run test:config      # Validate configuration

# Test database connection
npm run test:db          # Database connectivity test
```

**Resolution Steps:**

1. **Resource Issues:** Free up disk space, restart services, scale resources
2. **Configuration Issues:** Fix environment variables, update config files
3. **Database Issues:** Restart database, check connection strings, verify credentials
4. **Code Issues:** Rollback to last known good version, fix compilation errors

#### Memory Leaks / High Memory Usage

**Symptoms:** Memory usage continuously increasing, application becomes slow, eventual crash

**Immediate Actions:**

1. Monitor memory usage trends
2. Identify memory-intensive processes
3. Check for memory leaks in logs
4. Consider immediate restart if critical

**Diagnostic Commands:**

```bash
# Monitor memory usage
node --inspect app.js    # Enable debugging
npm run memory:profile   # Generate memory profile

# Check memory metrics
curl http://localhost:3001/api/health/metrics | jq '.data.memory'

# Monitor process memory
ps aux | grep node
pmap -x <pid>           # Detailed memory mapping
```

**Resolution Steps:**

1. **Immediate:** Restart application to free memory
2. **Short-term:** Increase memory limits, enable garbage collection logging
3. **Long-term:** Profile application, fix memory leaks, optimize caching

## 🔧 Common Error Scenarios

### Device Connection Issues

#### Device Not Found (DEVICE_NOT_FOUND)

**Error Code:** `DEVICE_NOT_FOUND`
**HTTP Status:** 404

**Symptoms:**

- API returns 404 when accessing device endpoints
- Device appears offline in dashboard
- StreamDeck hardware is connected but not recognized

**Diagnostic Steps:**

1. **Check Physical Connection:**

   ```bash
   # List USB devices (Linux/Mac)
   lsusb | grep -i elgato

   # Check device permissions
   ls -la /dev/bus/usb/
   ```

2. **Check Application Logs:**

   ```bash
   # Filter device-related logs
   grep "DEVICE" logs/device-$(date +%Y-%m-%d).log
   grep "StreamDeck" logs/combined-$(date +%Y-%m-%d).log
   ```

3. **Test Device Discovery:**

   ```bash
   # Run device discovery test
   npm run test:devices

   # Manual device scan
   curl http://localhost:3001/api/devices/scan
   ```

**Resolution Steps:**

1. **Hardware Issues:**
   - Reconnect USB cable
   - Try different USB port
   - Check cable integrity
   - Restart StreamDeck device

2. **Permission Issues:**
   - Add user to appropriate groups (Linux)
   - Update udev rules (Linux)
   - Check system permissions

3. **Software Issues:**
   - Restart application
   - Clear device cache
   - Update StreamDeck drivers
   - Reinstall device dependencies

#### Device Connection Timeout (DEVICE_TIMEOUT)

**Error Code:** `DEVICE_TIMEOUT`
**HTTP Status:** 408

**Symptoms:**

- Operations timeout when communicating with device
- Slow response from device operations
- Intermittent connection issues

**Diagnostic Steps:**

1. **Check Device Response Times:**

   ```bash
   # Monitor device operation times
   curl -w "@curl-format.txt" http://localhost:3001/api/devices/test-device/buttons/0/press

   # Check performance metrics
   curl http://localhost:3001/api/health/metrics | jq '.data.performance'
   ```

2. **Network and USB Analysis:**

   ```bash
   # Check USB bus utilization
   lsusb -t

   # Monitor system performance
   iostat -x 1
   vmstat 1
   ```

**Resolution Steps:**

1. **Immediate:** Increase timeout values in configuration
2. **Hardware:** Check USB hub quality, use direct connection
3. **Software:** Optimize device communication, implement connection pooling
4. **System:** Reduce system load, check for resource contention

### Authentication and Authorization Errors

#### Unauthorized Access (UNAUTHORIZED)

**Error Code:** `UNAUTHORIZED`
**HTTP Status:** 401

**Symptoms:**

- API requests return 401 status
- Users cannot log in
- Token validation failures

**Diagnostic Steps:**

1. **Check Authentication Logs:**

   ```bash
   # Filter authentication events
   grep "UNAUTHORIZED\|authentication" logs/security-$(date +%Y-%m-%d).log
   grep "token" logs/audit-$(date +%Y-%m-%d).log
   ```

2. **Validate Token Configuration:**

   ```bash
   # Check JWT configuration
   echo $JWT_SECRET | wc -c  # Should be at least 32 characters

   # Test token generation
   npm run test:auth
   ```

**Resolution Steps:**

1. **Token Issues:**
   - Verify JWT secret configuration
   - Check token expiration settings
   - Validate token signing algorithm

2. **User Issues:**
   - Reset user credentials
   - Check user account status
   - Verify user permissions

3. **System Issues:**
   - Restart authentication service
   - Clear authentication cache
   - Check system clock synchronization

#### Rate Limit Exceeded (RATE_LIMIT_EXCEEDED)

**Error Code:** `RATE_LIMIT_EXCEEDED`
**HTTP Status:** 429

**Symptoms:**

- Clients receive 429 responses
- High request volume from specific IPs
- Performance degradation

**Diagnostic Steps:**

1. **Analyze Request Patterns:**

   ```bash
   # Check rate limiting logs
   grep "rate.*limit" logs/combined-$(date +%Y-%m-%d).log

   # Analyze request sources
   awk '{print $1}' logs/access.log | sort | uniq -c | sort -nr | head -20
   ```

2. **Monitor Rate Limit Metrics:**
   ```bash
   # Check current rate limit status
   curl http://localhost:3001/api/health/metrics | jq '.data.rateLimiting'
   ```

**Resolution Steps:**

1. **Immediate:** Temporarily increase rate limits for legitimate traffic
2. **Security:** Block malicious IPs, implement CAPTCHA for suspicious patterns
3. **Scaling:** Implement distributed rate limiting, add load balancing
4. **Optimization:** Cache responses, optimize API performance

### Network and External Service Errors

#### N8N Connection Error (N8N_CONNECTION_ERROR)

**Error Code:** `N8N_CONNECTION_ERROR`
**HTTP Status:** 502

**Symptoms:**

- Cannot connect to N8N instance
- Workflow execution failures
- N8N API timeouts

**Diagnostic Steps:**

1. **Test N8N Connectivity:**

   ```bash
   # Test N8N API endpoint
   curl -H "X-N8N-API-KEY: $N8N_API_KEY" $N8N_BASE_URL/api/v1/workflows

   # Check network connectivity
   ping n8n-server.com
   telnet n8n-server.com 5678
   ```

2. **Check N8N Service Status:**

   ```bash
   # Check N8N logs
   docker logs n8n-container

   # Verify N8N configuration
   curl $N8N_BASE_URL/healthz
   ```

**Resolution Steps:**

1. **Network Issues:**
   - Check firewall rules
   - Verify DNS resolution
   - Test network connectivity

2. **N8N Service Issues:**
   - Restart N8N service
   - Check N8N configuration
   - Verify API key validity

3. **Configuration Issues:**
   - Update N8N endpoint URLs
   - Refresh API credentials
   - Check SSL/TLS configuration

### Database and Storage Errors

#### Database Connection Error (DATABASE_ERROR)

**Error Code:** `DATABASE_ERROR`
**HTTP Status:** 500

**Symptoms:**

- Database operations fail
- Connection pool exhaustion
- Query timeouts

**Diagnostic Steps:**

1. **Test Database Connectivity:**

   ```bash
   # Test database connection
   npm run test:db

   # Check connection pool status
   curl http://localhost:3001/api/health/detailed | jq '.data.database'
   ```

2. **Monitor Database Performance:**

   ```bash
   # Check database logs
   tail -f /var/log/postgresql/postgresql.log

   # Monitor connection count
   psql -c "SELECT count(*) FROM pg_stat_activity;"
   ```

**Resolution Steps:**

1. **Connection Issues:**
   - Restart database service
   - Check connection string configuration
   - Verify network connectivity

2. **Performance Issues:**
   - Increase connection pool size
   - Optimize slow queries
   - Add database indexes

3. **Resource Issues:**
   - Increase database memory
   - Check disk space
   - Monitor CPU usage

## 📊 Monitoring and Alerting

### Key Metrics to Monitor

#### Application Health

- **Response Time:** 95th percentile < 500ms
- **Error Rate:** < 1% of total requests
- **Memory Usage:** < 80% of available memory
- **CPU Usage:** < 70% average

#### Device Connectivity

- **Connected Devices:** Monitor device count
- **Connection Failures:** Track connection error rate
- **Device Response Time:** Monitor operation latency

#### External Dependencies

- **N8N Availability:** Monitor N8N API response time
- **Database Performance:** Track query execution time
- **Network Latency:** Monitor external service calls

### Alert Thresholds

#### Critical Alerts (Immediate Response Required)

- Application down or unresponsive
- Memory usage > 95%
- Error rate > 5%
- Database connection failures
- Security incidents

#### Warning Alerts (Response Within 1 Hour)

- Memory usage > 80%
- Response time > 1 second (95th percentile)
- Error rate > 2%
- Device connection issues
- High rate limiting activity

#### Info Alerts (Response Within 24 Hours)

- Memory usage > 70%
- Response time > 500ms (95th percentile)
- Unusual traffic patterns
- Performance degradation

### Monitoring Commands

```bash
# Application health check
curl http://localhost:3001/api/health/detailed

# Performance metrics
curl http://localhost:3001/api/health/metrics

# System resources
htop
iotop
nethogs

# Log analysis
tail -f logs/error-$(date +%Y-%m-%d).log
grep -i "error\|warning\|critical" logs/combined-$(date +%Y-%m-%d).log | tail -20

# Database monitoring
psql -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"

# Network monitoring
netstat -tulpn | grep :3001
ss -tulpn | grep :3001
```

## 🔍 Debugging Procedures

### Log Analysis

#### Finding Relevant Logs

```bash
# Error logs by category
ls logs/
# - error-YYYY-MM-DD.log (error events)
# - security-YYYY-MM-DD.log (security events)
# - performance-YYYY-MM-DD.log (performance metrics)
# - audit-YYYY-MM-DD.log (audit trail)
# - device-YYYY-MM-DD.log (device operations)

# Search for specific errors
grep -r "DEVICE_NOT_FOUND" logs/
grep -r "request-id-123" logs/  # Track specific request

# Analyze error patterns
awk '/ERROR/ {print $1, $2, $5}' logs/combined-$(date +%Y-%m-%d).log | sort | uniq -c
```

#### Log Correlation

```bash
# Find all logs for a specific request
REQUEST_ID="req_1234567890"
grep -r "$REQUEST_ID" logs/

# Find all logs for a specific user
USER_ID="user_123"
grep -r "$USER_ID" logs/

# Find all logs for a specific device
DEVICE_ID="streamdeck-ABC123"
grep -r "$DEVICE_ID" logs/
```

### Performance Debugging

#### Memory Analysis

```bash
# Generate heap dump
kill -USR2 <node-pid>  # Generates heap dump

# Analyze memory usage
node --inspect --inspect-port=9229 app.js
# Then connect Chrome DevTools to chrome://inspect

# Monitor garbage collection
node --trace-gc app.js
```

#### CPU Profiling

```bash
# CPU profiling
node --prof app.js
# Generate profile report
node --prof-process isolate-*.log > profile.txt

# Real-time CPU monitoring
top -p <node-pid>
htop -p <node-pid>
```

### Network Debugging

#### Connection Issues

```bash
# Test connectivity
curl -v http://localhost:3001/api/health
wget --spider http://localhost:3001/api/health

# Check port availability
netstat -tulpn | grep 3001
lsof -i :3001

# DNS resolution
nslookup api.example.com
dig api.example.com
```

#### SSL/TLS Issues

```bash
# Test SSL connection
openssl s_client -connect api.example.com:443
curl -vI https://api.example.com/api/health

# Check certificate validity
openssl x509 -in certificate.crt -text -noout
```

## 🚀 Recovery Procedures

### Application Recovery

#### Quick Recovery (< 5 minutes)

1. **Restart Application:**

   ```bash
   pm2 restart n8n-streamdeck
   # or
   systemctl restart n8n-streamdeck
   # or
   docker restart n8n-streamdeck-container
   ```

2. **Clear Caches:**

   ```bash
   # Clear application cache
   curl -X DELETE http://localhost:3001/api/cache/clear

   # Clear system caches
   sync && echo 3 > /proc/sys/vm/drop_caches
   ```

3. **Verify Recovery:**
   ```bash
   curl http://localhost:3001/api/health
   curl http://localhost:3001/api/devices
   ```

#### Full Recovery (< 30 minutes)

1. **Stop All Services:**

   ```bash
   pm2 stop all
   systemctl stop n8n-streamdeck
   systemctl stop postgresql
   systemctl stop redis
   ```

2. **Check System Resources:**

   ```bash
   df -h          # Disk space
   free -h        # Memory
   top            # CPU usage
   ```

3. **Start Services in Order:**

   ```bash
   systemctl start postgresql
   systemctl start redis
   systemctl start n8n-streamdeck
   pm2 start ecosystem.config.js
   ```

4. **Verify All Components:**

   ```bash
   # Database
   psql -c "SELECT 1;"

   # Cache
   redis-cli ping

   # Application
   curl http://localhost:3001/api/health/detailed

   # Devices
   curl http://localhost:3001/api/devices/scan
   ```

### Data Recovery

#### Database Recovery

```bash
# Restore from backup
pg_restore -d n8n_streamdeck backup_file.sql

# Check data integrity
psql -d n8n_streamdeck -c "SELECT count(*) FROM devices;"
psql -d n8n_streamdeck -c "SELECT count(*) FROM buttons;"

# Rebuild indexes if needed
psql -d n8n_streamdeck -c "REINDEX DATABASE n8n_streamdeck;"
```

#### Configuration Recovery

```bash
# Restore configuration from backup
cp /backup/config/.env .env
cp /backup/config/ecosystem.config.js ecosystem.config.js

# Validate configuration
npm run test:config
```

## 📞 Escalation Procedures

### Severity Levels

#### Severity 1 (Critical) - Response Time: Immediate

- **Conditions:** Complete service outage, data loss, security breach
- **Actions:**
  - Page on-call engineer immediately
  - Create incident ticket
  - Start incident response process
  - Notify stakeholders

#### Severity 2 (High) - Response Time: 1 Hour

- **Conditions:** Partial service outage, performance degradation, device failures
- **Actions:**
  - Alert on-call engineer
  - Create incident ticket
  - Begin troubleshooting
  - Monitor for escalation

#### Severity 3 (Medium) - Response Time: 4 Hours

- **Conditions:** Minor functionality issues, non-critical errors
- **Actions:**
  - Create support ticket
  - Schedule investigation
  - Document workarounds

#### Severity 4 (Low) - Response Time: 24 Hours

- **Conditions:** Enhancement requests, minor bugs, documentation issues
- **Actions:**
  - Add to backlog
  - Schedule for next sprint
  - Update documentation

### Contact Information

#### On-Call Engineers

- **Primary:** [Engineer Name] - [Phone] - [Email]
- **Secondary:** [Engineer Name] - [Phone] - [Email]
- **Escalation:** [Manager Name] - [Phone] - [Email]

#### External Contacts

- **N8N Support:** support@n8n.io
- **StreamDeck Support:** [Elgato Support]
- **Infrastructure Team:** [Internal Team]

### Communication Templates

#### Incident Notification

```
INCIDENT: [Severity] - [Brief Description]
Time: [Timestamp]
Impact: [User Impact Description]
Status: [Investigating/Identified/Monitoring/Resolved]
ETA: [Estimated Resolution Time]
Updates: [Communication Channel]
```

#### Status Update

```
UPDATE: [Incident ID] - [Brief Description]
Time: [Timestamp]
Progress: [What has been done]
Next Steps: [What will be done next]
ETA: [Updated ETA if changed]
```

#### Resolution Notice

```
RESOLVED: [Incident ID] - [Brief Description]
Resolution Time: [Timestamp]
Root Cause: [Brief explanation]
Actions Taken: [Summary of resolution steps]
Prevention: [Steps to prevent recurrence]
```

---

**Last Updated:** $(date)
**Version:** 1.0.0
**Maintained By:** Development Team

For questions or updates to this runbook, please contact the development team or create an issue in the project repository.
