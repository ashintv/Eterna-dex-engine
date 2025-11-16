# Eterna DEX Engine

A decentralized exchange (DEX) order execution engine built with TypeScript, featuring real-time WebSocket updates, queue-based order processing, and mock DEX routing between Raydium and Meteora.

## 🏗️ Architecture

```
                    ┌─────────────────┐
                    │     Client      │
                    └─────────┬───────┘
                              │
                    ┌─────────▼───────┐     ┌─────────────────┐
                    │   Fastify API   │◄────┤ Redis Subscriber│
                    │                 │     │                 │
                    │ POST /execute-  │     │   WebSocket     │
                    │ order           │     │   Updates       │
                    │ GET /ws/:orderId│     │                 │
                    └─────────┬───────┘     └─────────────────┘
                              │                       ▲
                              │                       │
                    ┌─────────▼───────┐               │
                    │     BullMQ      │               │
                    │    Job Queue    │               │
                    └─────────┬───────┘               │
                              │                       │
                              │                       │
                    ┌─────────▼───────┐     ┌─────────┴───────┐
                    │ SWAP: Market    │────►│ Redis Publisher │
                    │ Order Engine    │     │                 │
                    │                 │     │   Status        │
                    │ - Raydium Mock  │     │   Updates       │
                    │ - Meteora Mock  │     │                 │
                    └─────────────────┘     └─────────────────┘
```

### Core Components

- **API Server** (`src/api/`): Fastify-based REST API with WebSocket support
- **Order Engine** (`src/engine/`): Background worker for order processing
- **Redis Manager** (`src/api/redisManager.ts`): Handles pub/sub and queue operations
- **Database Layer**: PostgreSQL with Prisma ORM for order persistence

### Data Flow

1. **Order Submission**: Client submits order via REST API
2. **Order Queuing**: Order is validated and queued using BullMQ
3. **Order Processing**: Engine worker picks up order from queue
4. **Route Finding**: System compares quotes from Raydium and Meteora mock DEXs
5. **Execution**: Order is executed on selected mock DEX
6. **Real-time Updates**: Status updates sent via Redis pub/sub to WebSocket clients

## 📁 File Structure

```
Eterna_Assignment/
├── src/
│   ├── api/                    # API server components
│   │   ├── index.ts           # Main Fastify server with WebSocket
│   │   └── redisManager.ts    # Redis pub/sub and queue management
│   ├── config/
│   │   └── config.ts          # Application configuration
│   ├── engine/                # Order execution engine
│   │   ├── engine.ts          # Main engine worker with BullMQ
│   │   ├── services.ts        # DEX routing and execution services
│   │   └── mock.ts            # Mock DEX implementations
│   ├── lib/                   # Shared utilities
│   │   ├── schema.ts          # Zod validation schemas
│   │   ├── types.ts           # TypeScript type definitions
│   │   └── utils.ts           # Utility functions
│   └── test/
│       └── test.test.ts       # Comprehensive test suite
├── prisma/
│   ├── schema.prisma          # Database schema definition
│   └── migrations/            # Database migration files
├── docker-compose.yml         # Docker services configuration
├── package.json              # Node.js dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── jest.config.js            # Testing configuration
└── readme.md                 # This file
```

## 🚀 How to Run

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- PostgreSQL (for local development)
- Redis (for local development)

### Local Development

1. **Clone and Install Dependencies**
   ```bash
   git clone <repository-url>
   cd Eterna_Assignment
   npm install
   ```

2. **Start Infrastructure Services**
   ```bash
   npm run up
   # This starts Redis and PostgreSQL via Docker Compose
   ```

3. **Database Setup**
   ```bash
   # Set DATABASE_URL environment variable
   export DATABASE_URL="postgresql://user:password@localhost:5432/eterna"

   # Run database migrations
   npx prisma migrate dev
   ```

4. **Start Services**

   **Terminal 1 - API Server:**
   ```bash
   npm run dev:api
   ```

   **Terminal 2 - Engine Worker:**
   ```bash
   npm run dev:engine
   ```

5. **Access the Application**
   - API Server: `http://localhost:3000`
   - WebSocket: `ws://localhost:3000/ws/:orderId`
   - Prisma Studio: `npx prisma studio`

### Docker Development

```bash
# Start all services
npm run up

# Stop all services
npm run down
```

### Testing

```bash
# Run comprehensive test suite
npm test
```

## 🌐 API Endpoints

### REST API

#### Execute Order
- **POST** `/execute-order`
- **Body**:
  ```json
  {
    "tokenIn": "ETH",
    "tokenOut": "USDC",
    "amount": 1.0
  }
  ```
- **Response**:
  ```json
  {
    "status": "order received",
    "orderId": "uuid-string"
  }
  ```

### WebSocket API

#### Order Updates
- **Endpoint**: `ws://localhost:3000/ws/:orderId`
- **Description**: Real-time order status updates
- **Message Format**: JSON messages with order status updates
  ```json
  {
    "orderId": "uuid-string",
    "status": "pending|routing|building|submitted|confirmed|failed",
    "message": "Status description"
  }
  ```

## 🔧 Technology Stack

### Core Technologies
- **Runtime**: Node.js with TypeScript
- **Web Framework**: Fastify (high-performance alternative to Express)
- **WebSocket**: @fastify/websocket for real-time communication
- **Queue System**: BullMQ for reliable job processing
- **Database**: PostgreSQL with Prisma ORM
- **Cache/Pub-Sub**: Redis (ioredis client)
- **Validation**: Zod for runtime type checking
- **Testing**: Jest with Supertest for API testing

### Development Tools
- **Containerization**: Docker & Docker Compose
- **Type Safety**: TypeScript with strict configuration
- **Database Migrations**: Prisma Migrate

## 🧠 Design Decisions

### Why BullMQ?
- **Reliability**: Persistent job storage with Redis
- **Retry Logic**: Built-in exponential backoff and retry mechanisms
- **Concurrency**: Handles multiple workers and job priorities
- **Monitoring**: Built-in job progress tracking and metrics
- **Scalability**: Can distribute across multiple processes/servers

### Why Pub/Sub Pattern?
- **Decoupling**: API server and engine operate independently
- **Real-time Updates**: Immediate status propagation to WebSocket clients
- **Scalability**: Multiple subscribers can listen to same updates
- **Flexibility**: Easy to add new subscribers (analytics, logging, etc.)

### Why In-Memory Map Subscription System?
- **Memory Efficiency**: JavaScript Map provides O(1) lookup for active connections
- **Clean Cleanup**: Automatic removal of disconnected clients from in-memory storage
- **Multiple Subscribers**: Multiple clients can subscribe to same order updates
- **Broadcast Capability**: Efficient message distribution to relevant clients via in-memory tracking

### Pub/Sub vs Direct Queue Communication
- **Queue**: Guarantees single message delivery, perfect for job processing
- **Pub/Sub**: Enables broadcasting to multiple consumers, ideal for real-time updates
- **Separation of Concerns**: Job processing and status updates serve different purposes
- **System Resilience**: If WebSocket clients disconnect, order processing continues

## 🔌 Adding New Mock DEXs

The system currently uses mock DEX implementations. To add a new mock DEX:

### 1. Create Mock DEX Class

Add a new mock class in `src/engine/mock.ts`:

```typescript
export class NewDexMock {
  private basePrice = 100;

  async getQuote(tokenIn: string, tokenOut: string, amount: number): Promise<Quote> {
    await sleep(2000);
    const variance = 0.96 + Math.random() * 0.08;
    const price = this.basePrice * variance * amount;

    return {
      dex: "newdex",
      price,
      fee: 0.0025, // 0.25% fee
    };
  }

  async executeSwap(params: SwapParams): Promise<SwapResult> {
    const executionTime = 1500 + Math.random() * 1000;
    await sleep(executionTime);

    const slippage = 0.993 + Math.random() * 0.014;
    const executedPrice = this.basePrice * params.amount * slippage;

    return {
      txHash: this.generateTxHash(),
      executedPrice,
    };
  }

  private generateTxHash(): string {
    return randomBytes(32).toString("hex");
  }
}
```

### 2. Register in dexHandler

Update `src/engine/services.ts` to include your new mock:

```typescript
export class dexHandler {
  private raydium: RaydiumMock;
  private meteora: MeteoraMock;
  private newdex: NewDexMock; // Add new mock

  constructor() {
    this.raydium = new RaydiumMock();
    this.meteora = new MeteoraMock();
    this.newdex = new NewDexMock(); // Initialize
  }

  async getBestRoute(tokenIn: string, tokenOut: string, amount: number): Promise<Quote> {
    // Add to Promise.all for quote comparison
    const [raydiumQuote, meteoraQuote, newdexQuote] = await Promise.all([
      this.raydium.getQuote(tokenIn, tokenOut, amount),
      this.meteora.getQuote(tokenIn, tokenOut, amount),
      this.newdex.getQuote(tokenIn, tokenOut, amount), // Add new quote
    ]);

    // Update comparison logic
  }
}
```

## 📊 Order Status Flow

1. **pending** → Order received and queued
2. **routing** → Finding best route across DEXs
3. **building** → Constructing transaction on selected DEX
4. **submitted** → Transaction submitted to blockchain
5. **confirmed** → Transaction confirmed on-chain
6. **failed** → Order failed (with retry logic)

## 🧪 Testing

The system includes comprehensive tests covering:

- **API Endpoint Testing**: Validates REST API functionality
- **WebSocket Testing**: Tests real-time communication
- **Queue Processing**: Verifies order queuing and processing
- **Concurrent Operations**: Load testing with multiple orders
- **Error Handling**: Invalid order scenarios and edge cases
- **Integration Testing**: End-to-end order flow validation

Run specific test suites:
```bash
# All tests
npm test

# Watch mode for development
npm test -- --watch

# Specific test file
npm test -- test.test.ts
```

## 🔒 Environment Variables

```bash
# Database (for Prisma)
DATABASE_URL="postgresql://user:password@localhost:5432/eterna"
```

Redis and API configurations are currently hardcoded in the config files.

## 📈 Performance Considerations

- **Connection Pooling**: Prisma handles database connection pooling
- **Queue Processing**: BullMQ handles job processing with retry logic
- **WebSocket Management**: In-memory Map tracks active WebSocket connections
- **Mock DEX Simulation**: Artificial delays simulate real DEX response times

## 🚦 Monitoring & Observability

- **Console Logging**: Basic logging throughout the application
- **Order Tracking**: Database persistence of order status and execution details
- **Queue Processing**: BullMQ built-in job tracking and retry mechanisms
- **WebSocket Connection Management**: In-memory tracking of active connections

## 📄 License

This project is licensed under the ISC License - see the package.json file for details.

---

**Author**: Ashin T V
**Version**: 1.0.0

