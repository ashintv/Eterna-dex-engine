import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { RedisManager } from "./redisManager.js";
import { RequestSwapSchema } from "../lib/schema.js";
import { PrismaClient } from "@prisma/client";


const app = Fastify({logger: true});
await app.register(websocket);
const redisManager = new RedisManager();
const prisma = new PrismaClient();


app.get("/ws/:orderId", { websocket: true }, (connection, req) => {
  const {orderId} = req.params as { orderId: string };
  console.log(`WebSocket connection established for order ${orderId}`);
  connection.send(`Connected to order ${orderId} updates`);
  redisManager.SubscribeToOrderUpdates(orderId, connection);
  connection.on("close", () => {
    console.log(`WebSocket connection closed for order ${orderId}`);
    redisManager.UnsubscribeFromOrderUpdates(orderId, connection);
  });
});

app.post("/execute-order", async (request, reply) => {
  try {
    //validate order data
    const order = RequestSwapSchema.safeParse(request.body);
    if (!order.success) {
      reply.status(400);
      return { status: "error", message: "Invalid order data", errors: order.error};
    }
    if ( order.data.tokenIn === order.data.tokenOut ) {
      reply.status(400);
      return { status: "error", message: "tokenIn and tokenOut cannot be the same"};
    }
    // create a order entry
    const orderId = await prisma.orders.create({
      data: {
        orderType: "swap",
        tokenIn: order.data.tokenIn,
        tokenOut: order.data.tokenOut,
        amount: order.data.amount,
        status: "pending",
      },
    });

    //sense order to engine via redis
    console.log(`Received order execution request:`, order.data);
    const Neworder = {
      orderId: orderId.id,
      tokenIn: order.data.tokenIn,
      tokenOut: order.data.tokenOut,
      amount: order.data.amount,
    }
    await redisManager.addOrderExecutionJob(Neworder);
    return { status: "order received", orderId: orderId.id };
  } catch (err) {
    console.error("Error processing order execution request:", err);
    reply.status(500);
    return { status: "error", message: "Internal server error" };
  }
});

app.listen({ port: 3000, host: "0.0.0.0" }, (err, address) => {
  if (err) throw err;
  console.log(`DEX Order Execution API running at ${address}`);
  console.log(`WebSocket available at ws://localhost:3000/ws/:orderId`);
  console.log(`API Documentation at http://localhost:3000/`);
  console.log("PostgreSQL and Redis storage enabled");
});

app.after(() => {
  console.log("Fastify server is ready to accept requests.");
  console.log(app.printRoutes());
})
