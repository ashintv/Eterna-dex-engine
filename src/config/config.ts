export const CONFIG = {
  redis: {
    host: 'localhost',
    port: 6379,
  },
  ORDER_QUEUE: 'execute_orders',
  ORDER_UPDATES_CHANNEL: 'order_updates',


  MAX_RETRY: 3,
  BACK_OFF: {
    type: 'exponential',
    delay: 5000,
  },
};
