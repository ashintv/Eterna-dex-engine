import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { CONFIG } from "../config/config.js";

const connection = {
  host: CONFIG.redis.host,
  port: CONFIG.redis.port,
  maxRetriesPerRequest: null,
};

export class RedisManager {
  private queue: Queue;
  private sub: Redis = null as any;
  private OrderMap: Map<string, { status: string; clients: Set<any> }> = new Map();

  constructor() {
    this.queue = new Queue(CONFIG.ORDER_QUEUE, { connection });
  }

  async addOrderExecutionJob(orderData: any): Promise<string> {
    try {
      const orderId = crypto.randomUUID();
      await this.queue.add("execute_order", orderData);
      this.OrderMap.set(orderId, { status: "pending", clients: new Set() });
      return orderId;
    } catch (err) {
      console.error("Error adding job to queue:", err);
      return "";
    }
  }

  SubscribeToOrderUpdates(orderId: string, client: any) {
    this.OrderMap.get(orderId)?.clients.add(client);
  }

  UnsubscribeFromOrderUpdates(orderId: string, client: any) {
    this.OrderMap.get(orderId)?.clients.delete(client);
  }

  async SendUpdateToClients() {
    try {
      this.sub = new Redis(connection);
      await this.sub.subscribe(CONFIG.ORDER_UPDATES_CHANNEL, (err, count) => {
        if (err) {
          console.error("Failed to subscribe: ", err);
        } else {
          console.log(`Subscribed successfully! This client is currently subscribed to ${count} channels.`);
          this.sub.on("message", async (channel, message) => {
            const data = JSON.parse(message);
            const clients = this.OrderMap.get(data.orderId)?.clients;
            if (clients) {
              clients.forEach((client) => {
                client.socket.send(JSON.stringify(data));
              });
            }
          });
        }
      });
    } catch (err) {
      console.error("Error processing job updates:", err);
    }
  }
}
