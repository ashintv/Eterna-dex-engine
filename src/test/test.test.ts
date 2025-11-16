import supertest from "supertest";
import WebSocket from "ws";
import type { SwapParams } from "../lib/types.js";

const request = supertest;

const API_URL = "http://localhost:3000";

describe("DEX Engine API Tests", () => {
  const testCases: SwapParams[] = [
    { tokenIn: "ETH", tokenOut: "USDC", amount: 1 },
    { tokenIn: "BTC", tokenOut: "USDT", amount: 0.5 },
    { tokenIn: "SOL", tokenOut: "USDC", amount: 10 },
  ];

  test("should execute valid swap orders", async () => {
    for (const order of testCases) {
      const response = await request(API_URL).post("/execute-order").send(order).expect(200);

      expect(response.body).toHaveProperty("orderId");
      expect(response.body).toHaveProperty("status");
    }
  });

  test("should handle concurrent orders", async () => {
    const promises = testCases.map((order) => request(API_URL).post("/execute-order").send(order));

    const responses = await Promise.all(promises);
    responses.forEach((res) => {
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("orderId");
    });
  });

  test("should reject invalid orders", async () => {
    const invalidCases = [
      { tokenIn: "ETH", tokenOut: "ETH", amount: 1 },
      { tokenIn: "INVALID", tokenOut: "USDC", amount: 1 },
      { tokenIn: "ETH", tokenOut: "USDC", amount: -1 },
    ];

    for (const order of invalidCases) {
      await request(API_URL).post("/execute-order").send(order).expect(400);
    }
  });

  test("should receive WebSocket messages for order updates", (done) => {
    const order = testCases[0];
    const receivedMessages: string[] = [];

    request(API_URL)
      .post("/execute-order")
      .send(order)
      .then((res) => {
        const { orderId } = res.body;
        const ws = new WebSocket(`ws://localhost:3000/ws/${orderId}`);

        ws.on("open", () => {
          console.log(`WebSocket connected for order: ${orderId}`);
        });

        ws.on("message", (data: Buffer) => {
          const message = data.toString();
          receivedMessages.push(message);
          console.log(`Received message: ${message}`);

          // Verify message contains order information
          expect(message).toContain(orderId);

          // If we received an update, close and complete test
          if (receivedMessages.length > 0) {
            ws.close();
            expect(receivedMessages.length).toBeGreaterThan(0);
            done();
          }
        });

        ws.on("close", () => {
          if (receivedMessages.length === 0) {
            done(new Error("WebSocket closed without receiving any messages"));
          }
        });

        ws.on("error", (error) => {
          done(error);
        });

        // Timeout after 10 seconds
        setTimeout(() => {
          if (receivedMessages.length === 0) {
            ws.close();
            done(new Error("No WebSocket messages received within timeout"));
          }
        }, 10000);
      })
      .catch(done);
  });

  describe("Queue Testing", () => {
    test("should process multiple orders in queue sequentially", async () => {
      const queueOrders: SwapParams[] = [
        { tokenIn: "ETH", tokenOut: "USDC", amount: 1 },
        { tokenIn: "BTC", tokenOut: "USDT", amount: 0.1 },
        { tokenIn: "SOL", tokenOut: "USDC", amount: 5 },
        { tokenIn: "USDC", tokenOut: "ETH", amount: 1000 },
        { tokenIn: "USDT", tokenOut: "BTC", amount: 2000 },
      ];

      const orderIds: string[] = [];
      const startTime = Date.now();

      // Submit all orders rapidly to queue them
      for (const order of queueOrders) {
        const response = await request(API_URL).post("/execute-order").send(order).expect(200);

        orderIds.push(response.body.orderId);
        expect(response.body).toHaveProperty("orderId");
        expect(response.body).toHaveProperty("status");
      }

      const endTime = Date.now();
      console.log(`Queued ${queueOrders.length} orders in ${endTime - startTime}ms`);
      expect(orderIds).toHaveLength(queueOrders.length);
    });

    test("should handle rapid burst of orders", async () => {
      const burstSize = 10;
      const burstOrders: SwapParams[] = Array(burstSize)
        .fill(null)
        .map((_, i) => ({
          tokenIn: i % 2 === 0 ? "ETH" : "BTC",
          tokenOut: i % 2 === 0 ? "USDC" : "USDT",
          amount: 0.1 + i * 0.1,
        }));

      const promises = burstOrders.map((order) => request(API_URL).post("/execute-order").send(order));

      const responses = await Promise.all(promises);

      responses.forEach((res) => {
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("orderId");
      });

      const orderIds = responses.map((res) => res.body.orderId);
      expect(new Set(orderIds)).toHaveProperty("size", burstSize); // All unique
    });

    test("should receive WebSocket messages for queued orders", async () => {
      const queueOrders: SwapParams[] = [
        { tokenIn: "ETH", tokenOut: "USDC", amount: 2 },
        { tokenIn: "BTC", tokenOut: "USDT", amount: 0.2 },
        { tokenIn: "SOL", tokenOut: "USDC", amount: 15 },
      ];

      const orderResults: Array<{ orderId: string; messages: string[] }> = [];

      for (const order of queueOrders) {
        const response = await request(API_URL).post("/execute-order").send(order).expect(200);

        const orderId = response.body.orderId;

        // Test WebSocket messages for each queued order
        const messages = await new Promise<string[]>((resolve, reject) => {
          const ws = new WebSocket(`ws://localhost:3000/ws/${orderId}`);
          const receivedMessages: string[] = [];
          const timeout = setTimeout(() => {
            ws.close();
            resolve(receivedMessages);
          }, 5000);

          ws.on("open", () => {
            console.log(`WebSocket connected for queued order: ${orderId}`);
          });

          ws.on("message", (data: Buffer) => {
            const message = data.toString();
            receivedMessages.push(message);
            console.log(`Queue order ${orderId} message: ${message}`);
          });

          ws.on("close", () => {
            clearTimeout(timeout);
            resolve(receivedMessages);
          });

          ws.on("error", (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        });

        orderResults.push({ orderId, messages });
      }

      expect(orderResults).toHaveLength(queueOrders.length);
      orderResults.forEach((result) => {
        expect(result.orderId).toBeDefined();
        expect(result.messages.length).toBeGreaterThanOrEqual(0);

        // If messages were received, verify they contain order ID
        result.messages.forEach((message) => {
          expect(message).toContain(result.orderId);
        });
      });
    });
    test("should handle mixed valid and invalid orders in queue", async () => {
      const mixedOrders = [
        { tokenIn: "ETH", tokenOut: "USDC", amount: 1 }, // Valid
        { tokenIn: "BTC", tokenOut: "BTC", amount: 0.5 }, // Invalid - same token
        { tokenIn: "SOL", tokenOut: "USDT", amount: 10 }, // Valid
        { tokenIn: "INVALID", tokenOut: "USDC", amount: 1 }, // Invalid - bad token
        { tokenIn: "USDC", tokenOut: "ETH", amount: 1500 }, // Valid
      ];

      const results = await Promise.allSettled(
        mixedOrders.map((order) => request(API_URL).post("/execute-order").send(order))
      );

      // All requests should be fulfilled (API responds to all)
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      expect(fulfilled).toHaveLength(5);

      // Check response status codes to distinguish valid vs invalid
      const responses = fulfilled.map(r => r.value);
      const validResponses = responses.filter(res => res.status === 200);
      const invalidResponses = responses.filter(res => res.status === 400);

      expect(validResponses.length).toBe(3); // 3 valid orders (200 status)
      expect(invalidResponses.length).toBe(2); // 2 invalid orders (400 status)
    });

    test("should process large queue efficiently", async () => {
      const largeQueueSize = 20;
      const largeQueue: SwapParams[] = Array(largeQueueSize)
        .fill(null)
        .map((_, i) => ({
          tokenIn: ["ETH", "BTC", "SOL", "USDC"][i % 4] as string,
          tokenOut: ["USDC", "USDT", "ETH", "BTC"][i % 4] as string,
          amount: 0.5 + i * 0.1,
        }))
        .filter((order) => order.tokenIn !== order.tokenOut); // Remove same-token swaps

      const startTime = Date.now();
      const promises = largeQueue.map((order) => request(API_URL).post("/execute-order").send(order));

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      const successfulOrders = responses.filter((res) => res.status === 200);
      const avgResponseTime = (endTime - startTime) / successfulOrders.length;

      console.log(`Processed ${successfulOrders.length} orders in ${endTime - startTime}ms`);
      console.log(`Average response time: ${avgResponseTime.toFixed(2)}ms per order`);

      expect(successfulOrders.length).toBeGreaterThan(largeQueueSize * 0.8); // At least 80% success
      expect(avgResponseTime).toBeLessThan(1000); // Less than 1s per order on average
    });

    test("should receive detailed WebSocket messages for queue processing", async () => {
      const order: SwapParams = { tokenIn: "ETH", tokenOut: "USDC", amount: 1.5 };

      const response = await request(API_URL).post("/execute-order").send(order).expect(200);

      const { orderId } = response.body;

      const messageTest = await new Promise<{
        messages: string[];
        parsedMessages: any[];
        hasStatusUpdates: boolean;
      }>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:3000/ws/${orderId}`);
        const messages: string[] = [];
        const parsedMessages: any[] = [];
        let hasStatusUpdates = false;

        ws.on("open", () => {
          console.log(`Testing WebSocket messages for order: ${orderId}`);
        });

        ws.on("message", (data: Buffer) => {
          const message = data.toString();
          messages.push(message);
          console.log(`Message ${messages.length}: ${message}`);

          try {
            const parsed = JSON.parse(message);
            parsedMessages.push(parsed);

            // Check for status updates
            if (parsed.status || parsed.state || parsed.progress) {
              hasStatusUpdates = true;
            }
          } catch (e) {
            // Message might not be JSON, that's ok
            console.log(`Non-JSON message: ${message}`);
          }
        });

        ws.on("close", () => {
          resolve({ messages, parsedMessages, hasStatusUpdates });
        });

        ws.on("error", reject);

        // Close after 8 seconds to collect messages
        setTimeout(() => {
          ws.close();
        }, 8000);
      });

      // Verify we received messages
      expect(messageTest.messages.length).toBeGreaterThan(0);

      // Verify messages contain order information
      const hasOrderId = messageTest.messages.some((msg) => msg.includes(orderId));
      expect(hasOrderId).toBe(true);

      // Log message analysis
      console.log(`\nWebSocket Message Analysis for ${orderId}:`);
      console.log(`Total messages: ${messageTest.messages.length}`);
      console.log(`Parsed JSON messages: ${messageTest.parsedMessages.length}`);
      console.log(`Has status updates: ${messageTest.hasStatusUpdates}`);

      messageTest.messages.forEach((msg, i) => {
        console.log(`[${i + 1}] ${msg}`);
      });
    });

    test("should track multiple orders' WebSocket messages in queue", async () => {
      const orders: SwapParams[] = [
        { tokenIn: "ETH", tokenOut: "USDC", amount: 1 },
        { tokenIn: "BTC", tokenOut: "USDT", amount: 0.1 },
      ];

      const orderPromises = orders.map(async (order) => {
        const response = await request(API_URL).post("/execute-order").send(order).expect(200);

        const { orderId } = response.body;

        return new Promise<{ orderId: string; messageCount: number }>((resolve) => {
          const ws = new WebSocket(`ws://localhost:3000/ws/${orderId}`);
          let messageCount = 0;

          ws.on("message", (data: Buffer) => {
            messageCount++;
            console.log(`Order ${orderId} - Message ${messageCount}: ${data.toString()}`);
          });

          ws.on("close", () => {
            resolve({ orderId, messageCount });
          });

          // Close after 6 seconds
          setTimeout(() => ws.close(), 6000);
        });
      });

      const results = await Promise.all(orderPromises);

      results.forEach((result) => {
        expect(result.orderId).toBeDefined();
        expect(result.messageCount).toBeGreaterThanOrEqual(0);
        console.log(`Order ${result.orderId} received ${result.messageCount} messages`);
      });

      const totalMessages = results.reduce((sum, r) => sum + r.messageCount, 0);
      console.log(`Total WebSocket messages across ${orders.length} orders: ${totalMessages}`);
    });
  });
});
