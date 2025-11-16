/**
 * the order execution engine its a different service that process orders from the queue
 * and send back updates through redis pub/sub to the main api server
 *
 */

import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { CONFIG } from "../config/config.js";
import { dexHandler } from "./services.js";
import type { OrderData } from "../lib/types.js";
import { sleep } from "../lib/utils.js";
import { PrismaClient } from "@prisma/client";

class Engine {
  private redisPublisher: Redis;
  private connection = {
    host: CONFIG.redis.host,
    port: CONFIG.redis.port,
    maxRetriesPerRequest: null,
  };
  constructor() {
    this.redisPublisher = new Redis(this.connection);
    this.START();
  }
  private handler = new dexHandler();
  private prisma = new PrismaClient();
  private async START() {
    const worker = new Worker(
      CONFIG.ORDER_QUEUE,
      async (job) => {
        // Process the order execution job
        console.log("Processing order execution job:", job.data, "Attempt:", job.attemptsMade + 1);

        const result = await this.ExecuteOrder(job.data);
        if (!result) {
          throw new Error("Order execution failed");
        }
      },
      { connection: this.connection }
    );

    worker.on("completed", (job) => {
      console.log(`Job with id ${job.id} has been completed`);
    });

    worker.on("failed", async (job, err) => {
      console.error(`Job ${job?.id} failed attempt ${job?.attemptsMade}: ${err.message}`);

      // Retry not exhausted → do nothing
      if (job!.attemptsMade < job!.opts.attempts!) return;

      // Now retries are fully exhausted → permanent failure
      await this.prisma.orders.update({
        where: { id: job!.data.orderId },
        data: { status: "failed" },
      });

      await this.publishOrderUpdate({
        orderId: job!.data.orderId,
        status: "failed",
        message: "Order permanently failed after retries",
      });
    });
  }

  private async ExecuteOrder(orderData: OrderData): Promise<boolean> {
    try {
      console.log("Executing order:", orderData);
      await this.prisma.orders.update({
        where: { id: orderData.orderId },
        data: { status: "routing" },
      });

      await this.publishOrderUpdate({
        orderId: orderData.orderId,
        status: "routing",
        message: "finding best route",
      });
      const bestRoute = await this.handler.getBestRoute(orderData.tokenIn, orderData.tokenOut, orderData.amount);
      console.log(`${orderData.orderId} - Selected DEX: ${bestRoute.dex}, price = ${bestRoute.price}`);

      await this.prisma.orders.update({
        where: { id: orderData.orderId },
        data: { status: "building", selectedDex: bestRoute.dex },
      });
      // After processing, publish an update  about order execution start
      await this.publishOrderUpdate({
        orderId: orderData.orderId,
        status: "building",
        message: `building transaction on ${bestRoute.dex}`,
      });
      await sleep(3000);

      await this.prisma.orders.update({
        where: { id: orderData.orderId },
        data: { status: "submitted" },
      });

      await this.publishOrderUpdate({
        orderId: orderData.orderId,
        status: "submitted",
        message: `submitted transaction on  network via ${bestRoute.dex}`,
      });

      await sleep(3000);
      const result = await this.handler.executeSwap(bestRoute.dex, {
        tokenIn: orderData.tokenIn,
        tokenOut: orderData.tokenOut,
        amount: orderData.amount,
      });
      await this.prisma.orders.update({
        where: { id: orderData.orderId },
        data: { status: "confirmed", txHash: result.txHash, executedPrice: result.executedPrice },
      });
      await this.publishOrderUpdate({
        orderId: orderData.orderId,
        status: "confirmed",
        message: "transaction successfull",
      });
      return true;
    } catch (err) {
      console.error("Error executing order:", err);
      await this.publishOrderUpdate({
        orderId: orderData.orderId,
        status: "failed",
        message: `order execution failed:`,
        error: (err as Error).message,
      });
      return false;
    }
  }
  private async publishOrderUpdate(updateData: any) {
    try {
      await this.redisPublisher.publish(CONFIG.ORDER_UPDATES_CHANNEL, JSON.stringify(updateData));
    } catch (err) {
      console.error("Error publishing order update:", err);
    }
  }
}

// Start the engine
new Engine();


