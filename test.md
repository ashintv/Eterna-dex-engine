# DEX Engine Test Documentation

## Overview
This document describes the comprehensive test suite for the DEX Engine API, covering API endpoints, WebSocket functionality, queue processing, and error handling scenarios.

## Test Framework
- **Framework**: Jest with TypeScript supportimport request from "supertest";
- **HTTP Testing**: Supertest for API endpoint testing
- **WebSocket Testing**: Native WebSocket client for real-time message verification
- **ES Modules**: Configured with experimental VM modules support

---

## Test Cases

### 1. Basic API Functionality Tests

#### Test Case: `should execute valid swap orders`
**Purpose**: Validates that the API correctly processes valid swap orders

**How it's tested**:
- Sends POST requests to `/execute-order` endpoint with valid token pairs
- Test data includes: ETH→USDC, BTC→USDT, SOL→USDC swaps
- Verifies response contains `orderId` and `status` properties
- Expects HTTP 200 status code for all valid requests

```typescript
const testCases: SwapParams[] = [
  { tokenIn: "ETH", tokenOut: "USDC", amount: 1 },
  { tokenIn: "BTC", tokenOut: "USDT", amount: 0.5 },
  { tokenIn: "SOL", tokenOut: "USDC", amount: 10 }
];
```

#### Test Case: `should handle concurrent orders`
**Purpose**: Tests the API's ability to process multiple simultaneous requests

**How it's tested**:
- Sends multiple orders in parallel using `Promise.all()`
- Verifies all requests return HTTP 200 status
- Ensures each response contains unique `orderId`
- Tests system's concurrency handling capabilities

#### Test Case: `should reject invalid orders`
**Purpose**: Validates proper error handling for malformed requests

**How it's tested**:
- Tests invalid scenarios:
  - Same token for input and output (ETH→ETH)
  - Unsupported tokens (INVALID→USDC)
  - Negative amounts (amount: -1)
- Expects HTTP 400 status code for all invalid requests
- Verifies appropriate error messages are returned

---

### 2. WebSocket Message Testing

#### Test Case: `should receive WebSocket messages for order updates`
**Purpose**: Verifies real-time order update delivery via WebSocket

**How it's tested**:
- Creates order via REST API
- Establishes WebSocket connection to order-specific endpoint
- Listens for incoming messages with 10-second timeout
- Validates message content contains order ID
- Ensures proper connection lifecycle (open, message, close)

```typescript
const ws = new WebSocket(`ws://localhost:3000/ws/${orderId}`);
ws.on('message', (data: Buffer) => {
  const message = data.toString();
  expect(message).toContain(orderId);
});
```

---

### 3. Queue Processing Tests

#### Test Case: `should process multiple orders in queue sequentially`
**Purpose**: Tests sequential order processing and queue management

**How it's tested**:
- Submits 5 different swap orders rapidly
- Measures total submission time
- Verifies each order receives unique ID
- Confirms all orders are queued successfully
- Logs processing metrics for performance analysis

#### Test Case: `should handle rapid burst of orders`
**Purpose**: Tests system resilience under high-frequency order submission

**How it's tested**:
- Generates 10 orders with alternating token pairs
- Submits all orders simultaneously using `Promise.all()`
- Verifies unique order IDs for all requests
- Ensures no duplicate processing
- Tests burst load handling capabilities

#### Test Case: `should receive WebSocket messages for queued orders`
**Purpose**: Validates WebSocket functionality for orders in queue

**How it's tested**:
- Creates multiple orders (ETH→USDC, BTC→USDT, SOL→USDC)
- Establishes WebSocket connection for each order
- Collects messages over 5-second monitoring period
- Verifies message content contains correct order IDs
- Tests concurrent WebSocket connections

#### Test Case: `should handle mixed valid and invalid orders in queue`
**Purpose**: Tests queue behavior with both valid and invalid requests

**How it's tested**:
- Submits mixed batch: 3 valid + 2 invalid orders
- Uses `Promise.allSettled()` to handle mixed results
- Counts successful (HTTP 200) vs failed (HTTP 400) responses
- Verifies 60% success rate (3 valid out of 5 total)
- Ensures invalid orders don't break queue processing

#### Test Case: `should process large queue efficiently`
**Purpose**: Tests performance and scalability with large order volumes

**How it's tested**:
- Generates 20+ orders with rotating token combinations
- Filters out invalid same-token swaps
- Measures total processing time and average response time
- Expects >80% success rate and <1000ms average response time
- Validates system performance under load

```typescript
const largeQueue: SwapParams[] = Array(largeQueueSize)
  .fill(null)
  .map((_, i) => ({
    tokenIn: ["ETH", "BTC", "SOL", "USDC"][i % 4],
    tokenOut: ["USDC", "USDT", "ETH", "BTC"][i % 4],
    amount: 0.5 + i * 0.1
  }))
  .filter(order => order.tokenIn !== order.tokenOut);
```

---

### 4. Advanced WebSocket Testing

#### Test Case: `should receive detailed WebSocket messages for queue processing`
**Purpose**: Analyzes WebSocket message content and structure

**How it's tested**:
- Creates single order and monitors WebSocket for 8 seconds
- Captures all messages and attempts JSON parsing
- Analyzes message structure for status/progress indicators
- Logs comprehensive message analysis:
  - Total message count
  - JSON vs plain text messages
  - Presence of status updates
  - Individual message content

#### Test Case: `should track multiple orders' WebSocket messages in queue`
**Purpose**: Tests concurrent WebSocket message handling

**How it's tested**:
- Creates 2 orders simultaneously (ETH→USDC, BTC→USDT)
- Monitors each WebSocket connection for 6 seconds
- Counts messages per order
- Calculates total message volume across all connections
- Verifies concurrent message delivery

---

## Test Configuration

### Jest Setup
```javascript
export default {
  preset: "ts-jest/presets/default-esm",
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { useESM: true }]
  },
  testEnvironment: "node",
  testMatch: ["**/src/**/*.test.ts"],
  testTimeout: 30000
};
```

### Running Tests
```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test
npm test -- --testNamePattern="should execute valid swap orders"
```

---

## Performance Metrics

### Expected Performance Benchmarks
- **Single Order**: <100ms response time
- **Concurrent Orders**: <50ms average per order
- **Large Queue (20+ orders)**: <1000ms average per order
- **WebSocket Connection**: <2000ms establishment time
- **Message Delivery**: <100ms latency

### Success Rate Expectations
- **Valid Orders**: 100% success rate
- **Invalid Orders**: 100% rejection rate (HTTP 400)
- **Large Queue Processing**: >80% success rate
- **WebSocket Connections**: 100% establishment rate

---

## Error Handling Test Scenarios

### API Validation Errors
- Same input/output tokens → `tokenIn and tokenOut cannot be the same`
- Unsupported tokens → `tokenIn must be one of the supported tokens`
- Invalid amounts → Proper validation error responses

### WebSocket Error Scenarios
- Connection failures → Proper error callbacks
- Timeout handling → 10-second connection timeout
- Message parsing → Graceful handling of non-JSON messages

### Queue Error Scenarios
- Mixed valid/invalid orders → Partial success handling
- High-load scenarios → Graceful degradation
- Resource exhaustion → Proper error responses

---

## Test Data

### Supported Tokens
- ETH (Ethereum)
- BTC (Bitcoin)
- SOL (Solana)
- USDC (USD Coin)
- USDT (Tether USD)

### Test Order Patterns
- Small amounts: 0.001 - 1.0
- Medium amounts: 1.0 - 1000
- Large amounts: 1000+
- Edge cases: Micro/macro amounts

---

## Monitoring and Logging

### Test Output
- Real-time WebSocket message logging
- Performance timing measurements
- Order ID tracking and verification
- Queue processing statistics
- Error categorization and counting

### Success Criteria
All tests must pass with:
- ✅ 11/11 test cases passing
- ✅ All API endpoints responding correctly
- ✅ WebSocket messages delivered successfully
- ✅ Queue processing within performance bounds
- ✅ Proper error handling for edge cases
