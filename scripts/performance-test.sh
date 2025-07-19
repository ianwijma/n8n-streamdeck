#!/bin/bash

# Performance Testing Script for N8N StreamDeck Application
# This script runs comprehensive performance tests and generates reports

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="http://localhost:3001"
FRONTEND_URL="http://localhost:3000"
RESULTS_DIR="./performance-results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo -e "${BLUE}🚀 Starting Performance Testing Suite${NC}"
echo "Timestamp: $TIMESTAMP"
echo "Backend URL: $BACKEND_URL"
echo "Frontend URL: $FRONTEND_URL"
echo "Results Directory: $RESULTS_DIR"
echo ""

# Create results directory
mkdir -p "$RESULTS_DIR/$TIMESTAMP"

# Function to check if service is running
check_service() {
    local url=$1
    local name=$2
    
    echo -e "${YELLOW}Checking $name service...${NC}"
    if curl -s "$url/api/health" > /dev/null; then
        echo -e "${GREEN}✓ $name service is running${NC}"
        return 0
    else
        echo -e "${RED}✗ $name service is not running${NC}"
        return 1
    fi
}

# Function to run Artillery load test
run_load_test() {
    echo -e "${BLUE}📊 Running Artillery Load Test...${NC}"
    
    if ! command -v artillery &> /dev/null; then
        echo -e "${RED}Artillery not found. Installing...${NC}"
        npm install -g artillery
    fi
    
    # Run the load test
    artillery run \
        --output "$RESULTS_DIR/$TIMESTAMP/artillery-report.json" \
        ./load-testing/artillery-config.yml
    
    # Generate HTML report
    artillery report \
        --output "$RESULTS_DIR/$TIMESTAMP/artillery-report.html" \
        "$RESULTS_DIR/$TIMESTAMP/artillery-report.json"
    
    echo -e "${GREEN}✓ Load test completed${NC}"
    echo "Report saved to: $RESULTS_DIR/$TIMESTAMP/artillery-report.html"
}

# Function to run Lighthouse audit
run_lighthouse_audit() {
    echo -e "${BLUE}🔍 Running Lighthouse Performance Audit...${NC}"
    
    if ! command -v lighthouse &> /dev/null; then
        echo -e "${RED}Lighthouse not found. Installing...${NC}"
        npm install -g lighthouse
    fi
    
    # Run Lighthouse audit
    lighthouse "$FRONTEND_URL" \
        --output=html \
        --output=json \
        --output-path="$RESULTS_DIR/$TIMESTAMP/lighthouse" \
        --chrome-flags="--headless --no-sandbox" \
        --only-categories=performance,best-practices \
        --throttling-method=simulate \
        --quiet
    
    echo -e "${GREEN}✓ Lighthouse audit completed${NC}"
    echo "Report saved to: $RESULTS_DIR/$TIMESTAMP/lighthouse.report.html"
}

# Function to analyze bundle size
analyze_bundle() {
    echo -e "${BLUE}📦 Analyzing Bundle Size...${NC}"
    
    cd apps/frontend
    
    # Build the application
    echo "Building application..."
    npm run build > "$RESULTS_DIR/$TIMESTAMP/build.log" 2>&1
    
    # Analyze bundle with webpack-bundle-analyzer
    if [ "$ANALYZE_BUNDLE" = "true" ]; then
        echo "Generating bundle analysis..."
        ANALYZE=true npm run build
    fi
    
    # Get build stats
    echo "Collecting build statistics..."
    du -sh .next/ > "$RESULTS_DIR/$TIMESTAMP/bundle-size.txt"
    find .next/static -name "*.js" -exec ls -lh {} \; >> "$RESULTS_DIR/$TIMESTAMP/bundle-size.txt"
    
    cd ../..
    
    echo -e "${GREEN}✓ Bundle analysis completed${NC}"
}

# Function to run memory leak detection
run_memory_test() {
    echo -e "${BLUE}🧠 Running Memory Leak Detection...${NC}"
    
    # Start memory monitoring
    node -e "
        const monitor = require('./scripts/memory-monitor.js');
        monitor.start('$BACKEND_URL', '$RESULTS_DIR/$TIMESTAMP/memory-usage.json');
    " &
    
    MONITOR_PID=$!
    
    # Run a sustained load test for memory monitoring
    echo "Running sustained load for memory monitoring..."
    artillery quick \
        --duration 300 \
        --rate 10 \
        "$BACKEND_URL/api/health" \
        > "$RESULTS_DIR/$TIMESTAMP/memory-load.log" 2>&1
    
    # Stop memory monitoring
    kill $MONITOR_PID 2>/dev/null || true
    
    echo -e "${GREEN}✓ Memory test completed${NC}"
}

# Function to generate performance report
generate_report() {
    echo -e "${BLUE}📋 Generating Performance Report...${NC}"
    
    cat > "$RESULTS_DIR/$TIMESTAMP/performance-summary.md" << EOF
# Performance Test Report

**Test Date:** $(date)
**Test Duration:** $TIMESTAMP

## Test Configuration
- Backend URL: $BACKEND_URL
- Frontend URL: $FRONTEND_URL
- Test Environment: $(uname -a)
- Node Version: $(node --version)
- NPM Version: $(npm --version)

## Test Results

### Load Testing (Artillery)
- Configuration: ./load-testing/artillery-config.yml
- Report: [artillery-report.html](./artillery-report.html)
- Raw Data: [artillery-report.json](./artillery-report.json)

### Frontend Performance (Lighthouse)
- Report: [lighthouse.report.html](./lighthouse.report.html)
- Raw Data: [lighthouse.report.json](./lighthouse.report.json)

### Bundle Analysis
- Build Log: [build.log](./build.log)
- Bundle Sizes: [bundle-size.txt](./bundle-size.txt)

### Memory Usage
- Memory Log: [memory-usage.json](./memory-usage.json)
- Load Test Log: [memory-load.log](./memory-load.log)

## Recommendations

### Performance Optimizations Implemented
- ✅ Backend caching with TTL
- ✅ Connection pooling for StreamDeck devices
- ✅ Comprehensive rate limiting
- ✅ React.memo for expensive components
- ✅ useMemo and useCallback optimizations
- ✅ Socket.io connection optimization with batching
- ✅ Bundle splitting and optimization
- ✅ Image optimization and lazy loading

### Key Metrics to Monitor
1. **Response Time**: API endpoints should respond within 200ms
2. **Memory Usage**: Heap usage should stay below 80%
3. **Cache Hit Rate**: Should be above 70% for frequently accessed data
4. **Bundle Size**: Main bundle should be under 500KB gzipped
5. **Lighthouse Score**: Performance score should be above 90

### Next Steps
1. Monitor production metrics continuously
2. Set up alerts for performance degradation
3. Regular performance testing in CI/CD pipeline
4. Consider CDN for static assets
5. Implement service worker for offline functionality

EOF

    echo -e "${GREEN}✓ Performance report generated${NC}"
    echo "Summary: $RESULTS_DIR/$TIMESTAMP/performance-summary.md"
}

# Main execution
main() {
    echo -e "${BLUE}Starting performance test suite...${NC}"
    
    # Check if services are running
    if ! check_service "$BACKEND_URL" "Backend"; then
        echo -e "${RED}Backend service is not running. Please start it first.${NC}"
        exit 1
    fi
    
    if ! check_service "$FRONTEND_URL" "Frontend"; then
        echo -e "${YELLOW}Frontend service is not running. Skipping Lighthouse audit.${NC}"
        SKIP_LIGHTHOUSE=true
    fi
    
    # Run tests
    run_load_test
    
    if [ "$SKIP_LIGHTHOUSE" != "true" ]; then
        run_lighthouse_audit
    fi
    
    analyze_bundle
    run_memory_test
    generate_report
    
    echo ""
    echo -e "${GREEN}🎉 Performance testing completed successfully!${NC}"
    echo -e "${BLUE}Results saved to: $RESULTS_DIR/$TIMESTAMP${NC}"
    echo ""
    echo "Open the following files to view results:"
    echo "- Artillery Report: $RESULTS_DIR/$TIMESTAMP/artillery-report.html"
    if [ "$SKIP_LIGHTHOUSE" != "true" ]; then
        echo "- Lighthouse Report: $RESULTS_DIR/$TIMESTAMP/lighthouse.report.html"
    fi
    echo "- Performance Summary: $RESULTS_DIR/$TIMESTAMP/performance-summary.md"
}

# Run main function
main "$@"