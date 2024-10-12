const express = require("express");
const path = require("path");
const { MongoClient } = require("mongodb");
const { Client } = require("pg");
const { createClient } = require("redis");
const amqp = require("amqplib/callback_api");
const { Kafka } = require("kafkajs");
const {produceMessages} = require("./producer");

const app = express();
const PORT = 3000;
const mongo_uri = "mongodb://localhost:27017";
const postgres_uri = "postgresql://postgres:password@localhost:5432/performanceTest";
const redis_uri = "redis://localhost:6379";
const dbName = "performanceTest"; 
const collectionName = "entries"; 

let db;
let channel;

// Middleware to parse JSON requests  
app.use(express.json({ limit: "100mb" }));

// Connect to MongoDB
MongoClient.connect(mongo_uri)
  .then((client) => {
    db = client.db(dbName);
    console.log(`Connected to MongoDB: ${mongo_uri}`);
  })
  .catch((err) => console.error(err));

// Connect to Redis
const redisClient = createClient({
  url: redis_uri, // Use the container name as the host
});

redisClient.on("connect", () => {
  console.log(`Connected to Redis: ${redis_uri}`);
});

redisClient.on("error", (err) => {
  console.error("Redis connection error:", err);
});


// Kafka Admin Client to ensure topic partitions
const kafka = new Kafka({
  clientId: "test-performance-app",
  brokers: ["localhost:9092"],
});

const admin = kafka.admin();

async function ensureTopicPartitions() {
  await admin.connect();
  const topics = await admin.listTopics();
  if (!topics.includes("test-performance")) {
    await admin.createTopics({
      topics: [
        {
          topic: "test-performance",
          numPartitions: 4,
          replicationFactor: 1,
        },
      ],
    });
    console.log("Created topic 'test-performance' with 4 partitions");
  } else {
    const topicMetadata = await admin.fetchTopicMetadata({ topics: ["test-performance"] });
    const partitions = topicMetadata.topics[0].partitions.length;
    if (partitions < 4) {
      await admin.createPartitions({
        topicPartitions: [
          {
            topic: "test-performance",
            count: 4,
          },
        ],
      });
      console.log("Updated topic 'test-performance' to 4 partitions");
    }
  }
  await admin.disconnect();
}
(async () => {
  try {
    // Connect to Redis
    await redisClient.connect();
    
    // Connect to RabbitMQ
    amqp.connect("amqp://localhost", (err, connection) => {
      if (err) throw err;
      connection.createChannel((err, ch) => {
        if (err) throw err;
        channel = ch;
        channel.assertQueue("request_queue", { durable: true });
        console.log("Connected to RabbitMQ and channel created");
      });
    });
    
    // Connect to Kafka Admin
    await ensureTopicPartitions();
    console.log(
      "Kafka topic 'test-performance' is ensured to have 4 partitions"
    );
    
    // Serve the index.html file
    app.get("/", (req, res) => {
      res.sendFile(path.join(__dirname, "index.html"));
    });

    app.listen(PORT, () => {
      console.log(`Server is running on port http://localhost:${PORT}`);
    });

    // API to test the server on many requests
    app.get("/api/test", (req, res) => {
      res.json({ message: "Hello, World!" });
    });

    // API to insert entries into mongoDB
    app.post("/api/populate", async (req, res) => {
      try {
        const { entryCount } = req.body;
        if (!entryCount || entryCount <= 0) {
          return res.status(400).json({ message: "Invalid entry count" });
        }
        const entries = Array.from({ length: entryCount }, (_, i) => ({
          value: `${i + 1}`,
          createdAt: new Date(),
        }));

        const start = performance.now(); // Start timing the operation

        // Insert 100 entries into the collection
        await db.collection(collectionName).insertMany(entries);

        const end = performance.now(); // End timing the operation
        if (end - start > 1000) {
          res.json({
            message: `Inserted ${entryCount} entries successfully in ${(
              (end - start) /
              1000
            ).toFixed(2)} s`,
          });
        } else {
          res.json({
            message: `Inserted ${entryCount} entries successfully in ${(
              end - start
            ).toFixed(2)} ms`,
          });
        }
      } catch (error) {
        console.error("Error inserting entries:", error);
        res.status(500).json({ message: "Failed to insert entries" });
      }
    });

    // API to retrieve a specific entry by value from mongoDB
    app.get("/api/retrieve/:entryValue", async (req, res) => {
      const entryValue = req.params.entryValue;
      const collection = db.collection(collectionName);
      const entry = await collection.findOne({ value: entryValue });
      if (entry) {
        res.json({ message: `Found: ${entry.value}`, entry });
      } else {
        res.json({ message: "Entry not found" });
      }
    });

    // API to clear the database
    app.delete("/api/clear", async (req, res) => {
      try {
        const result = await db.collection(collectionName).deleteMany({});
        res.json({
          message: `Cleared ${result.deletedCount} entries from the database`,
        });
      } catch (error) {
        console.error("Error clearing the database:", error);
        res.status(500).json({ message: "Failed to clear the database" });
      }
    });
    
    // API to insert entries into PostgreSQL
    app.post("/api/populate-postgres", async (req, res) => {
      try {
        const { entryCount } = req.body;
        if (!entryCount || entryCount <= 0) {
          return res.status(400).json({ message: "Invalid entry count" });
        }
        const startTime = Date.now();
        for (let i = 0; i < entryCount; i++) {
          await client.query(`INSERT INTO entries (value) VALUES ($1)`, [i]);
        }
        const endTime = Date.now();
        const duration = endTime - startTime;
        if (duration > 1000) {
          res.json({
            message: `${entryCount} entries inserted into PostgreSQL in ${
              duration / 1000
            } s`,
          });
        } else {
          res.json({
            message: `${entryCount} entries inserted into PostgreSQL in ${duration} ms`,
          });
        }
      } catch (err) {
        console.error("Error populating PostgreSQL:", err);
        res.status(500).json({ message: "Error populating PostgreSQL" });
      }
    });
    
    // API to retrieve a specific entry by value from PostgreSQL
    app.get("/api/retrieve-postgres/:key", async (req, res) => {
      try {
        const key = req.params.key;
        const result = await client.query(`SELECT * FROM entries WHERE value = $1`, [key]);
        if (result.rows.length) {
          res.json({ message: `Found: ${result.rows[0].value}` });
        } else {
          res.json({ message: "Entry not found" });
        }
      } catch (err) {
        console.error("Error retrieving from PostgreSQL:", err);
        res.status(500).json({ message: "Error retrieving from PostgreSQL" });
      }
    });
    
    // API to clear the PostgreSQL
    app.delete("/api/clear-postgres", async (req, res) => {
      try {
        const result = await client.query(`DELETE FROM entries`);
        res.json({
          message: `Cleared ${result.rowCount} entries from PostgreSQL`,
        });
      } catch (err) {
        console.error("Error clearing PostgreSQL:", err);
        res.status(500).json({ message: "Error clearing PostgreSQL" });
      }
    });
    
    // API to insert entries into redis
    app.post("/api/populate-redis", async (req, res) => {
      try {
        const { entryCount } = req.body;
        if (!entryCount || entryCount <= 0) {
          return res.status(400).json({ message: "Invalid entry count" });
        }
        const startTime = Date.now();
        for (let i = 0; i < entryCount; i++) {
          await redisClient.set(`${i}`, `${i}`);
        }
        const endTime = Date.now();
        const duration = endTime - startTime;
        await redisClient.set("latestPopulateTime", duration.toString());
        if (duration > 1000) {
          res.json({
            message: `${entryCount} entries inserted into Redis in ${
              duration / 1000
            } s`,
          });
        } else {
          res.json({
            message: `${entryCount} entries inserted into Redis in ${duration} ms`,
          });
        }
      } catch (err) {
        console.error("Error populating Redis:", err);
        res.status(500).json({ message: "Error populating Redis" });
      }
    });
    // API to retrieve a specific entry by value from Redis
    app.get("/api/retrieve-redis/:key", async (req, res) => {
      try {
        const key = req.params.key;
        const value = await redisClient.get(key);
        if (value) {
          res.json({ message: `Found: ${value}` });
        } else {
          res.json({ message: "Entry not found" });
        }
      } catch (err) {
        console.error("Error retrieving from Redis:", err);
        res.status(500).json({ message: "Error retrieving from Redis" });
      }
    });

    // API to clear the redis
    app.delete("/api/clear-redis", async (req, res) => {
      try {
        const result = await db.collection(collectionName).deleteMany({});
        console.log(result);
        await redisClient.flushAll();

        res.json({
          message: `Cleared ${result.deletedCount} entries from Redis`,
        });
      } catch (err) {
        console.error("Error clearing Redis:", err);
        res.status(500).json({ message: "Error clearing Redis" });
      }
    });

    // API Route to send message to the queue
    app.get("/api/test-mq", (req, res) => {
      const index = req.query.index;
      if (channel) {
        channel.sendToQueue(
          "request_queue",
          Buffer.from(JSON.stringify(index)),
          {
            persistent: true,
          }
        );

        res.status(200).json({ message: "Request queued" });
      } else {
        res.status(500).json({ message: "Channel not available" });
      }
    });

    app.post("/api/test-kafka", async (req, res) => {
      const reqCount = req.body.reqCount;
      const startBulk = performance.now();

      await produceMessages(reqCount);

      const endBulk = performance.now();
      const bulkDuration = endBulk - startBulk;

      res.json({
        message: `${reqCount} requests sent to Kafka took ${(
          bulkDuration / 1000
        ).toFixed(2)} seconds.`,
      });
    });
  } catch (error) {
      console.error("Failed to connect to Redis:", error);
  }
})();
