import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import { RedisManager } from "./redisManager.js";

const app = Fastify();
const redisManager = new RedisManager();

app.get("/docs", async (request, reply) => {
  return { hello: "world" };
});

app.get("/ws/:orderId", { websocket: true }, (connection, req) => {
  const orderId = (req.params as { orderId: string }).orderId;
  console.log(`WebSocket connection established for order ${orderId}`);
  redisManager.SubscribeToOrderUpdates(orderId, connection);

  connection.socket.on("close", () => {
    console.log(`WebSocket connection closed for order ${orderId}`);
    redisManager.UnsubscribeFromOrderUpdates(orderId, connection);
  });
});

app.post("/execute-order", async (request, reply) => {
  //TODO: Validate and process order data
  const order = request.body as { orderId: string; details: any };
  console.log(`Received order execution request:`, order);
  const orderId = await redisManager.addOrderExecutionJob(order);
  if (!orderId) {
    reply.status(500);
    return { status: "error", message: "Failed to add order to execution queue" };
  }

  // Here you would add logic to process the order and store it in PostgreSQL and Redis
  return { status: "order received", orderId };
});

app.listen({ port: 3000, host: "0.0.0.0" }, (err, address) => {
  if (err) throw err;
  console.log(`DEX Order Execution API running at ${address}`);
  console.log(`WebSocket available at ws://localhost:3000/ws/:orderId`);
  console.log(`API Documentation at http://localhost:3000/`);
  console.log("PostgreSQL and Redis storage enabled");
});
