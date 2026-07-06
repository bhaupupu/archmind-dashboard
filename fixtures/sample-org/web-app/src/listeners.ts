import { Kafka } from 'kafkajs';

const kafka = new Kafka({ clientId: 'web', brokers: ['kafka:9092'] });
const consumer = kafka.consumer({ groupId: 'web-group' });

export async function listenToPayments() {
  await consumer.subscribe({ topic: 'payment.events', fromBeginning: true });
  await consumer.run({
    eachMessage: async ({ message }) => {
      console.log('payment event:', message.value?.toString());
    },
  });
}
