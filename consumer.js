const { Kafka } = require("kafkajs");

// Initialize Kafka instance and consumer
const kafka = new Kafka({
  clientId: "test-performance-app",
  brokers: ["localhost:9092"],
});

const consumer = kafka.consumer({ groupId: "test-group" });

async function consumeMessages() {
  await consumer.connect();
  await consumer.subscribe({
    topic: "test-performance",
    fromBeginning: true,
  });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      console.log(`Consumer ${process.pid} received message:`, {
        partition,
        offset: message.offset,
        key: message.key.toString(),
        value: message.value.toString(),
      });
    },
  });
}

consumeMessages().catch(console.error);
