const { Kafka } = require("kafkajs");

const kafka = new Kafka({
  clientId: "test-performance-app",
  brokers: ["localhost:9092"],
});

const producer = kafka.producer();

async function produceMessages(reqCount) {
  await producer.connect();
  const partitions = [0,1,2,3];
  const messages = Array.from({ length: reqCount }, (_, i) => ({
    key: `key-${i}`,
    value: `Message ${i + 1}`,
    partition: partitions[i % partitions.length],
  }));

  await producer.send({
    topic: "test-performance",
    messages: messages,
  });
  console.log("Processing request: ", messages);
  await producer.disconnect();
}

module.exports = {produceMessages};