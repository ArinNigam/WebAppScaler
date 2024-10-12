const amqp = require("amqplib/callback_api");

// Connect to RabbitMQ and create a worker
amqp.connect("amqp://localhost", (err, connection) => {
  if (err) throw err;
  connection.createChannel((err, channel) => {
    if (err) throw err;
    const queue = "request_queue";

    channel.assertQueue(queue, { durable: true });
    channel.prefetch(1); 

    console.log("Waiting for messages...");

    channel.consume(
      queue,
      (msg) => {
        const requestData = JSON.parse(msg.content.toString());
        console.log("Processing request: ", requestData);

        // Simulate a request handler (e.g., DB operation, API call)
        setTimeout(() => {
          channel.ack(msg); // Acknowledge the message after processing
        }, 500); // Simulating some delay in processing
      },
      { noAck: false }
    );
  });
});
