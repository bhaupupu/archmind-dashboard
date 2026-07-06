import { Kafka } from 'kafkajs';

const kafka = new Kafka({ clientId: 'billing', brokers: ['kafka:9092'] });
const producer = kafka.producer();

export async function emitPaymentEvent(id: string) {
  await producer.send({ topic: 'payment.events', messages: [{ value: id }] });
}
