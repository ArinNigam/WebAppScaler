# Web Application Scalability Testing

This repository contains a web application designed to test the scalability of various services like MongoDB, PostgreSQL, Redis, RabbitMQ, and Kafka. The application is containerized using Docker and provides APIs to populate, retrieve, and clear data in each service, as well as send messages to queues for performance testing.

## Services

The following services are containerized and utilized in this application:
- MongoDB: Stores entries and provides endpoints to insert, retrieve, and clear data.
- PostgreSQL: Similar to MongoDB but stores data in relational format.
- Redis: Stores data in-memory for fast retrieval and provides endpoints to interact with it.
- RabbitMQ: Acts as a message broker for sending tasks to the queue.
- Kafka: A distributed event streaming platform used to handle high-throughput message processing.

## Features

- Insert, retrieve, and clear data from MongoDB, PostgreSQL, and Redis.
- Publish messages to RabbitMQ and Kafka.
- Automatically manage Kafka topic partitions.
- Performance monitoring of bulk inserts and retrieval operations.

## Prerequisites

Ensure you have the following installed:
- Docker
- Node.js

## Setup
1. Clone the repository:

```
git clone https://github.com/yourusername/webapp-scalability-test.git
cd webapp-scalability-test
```

2. Build and run the Docker containers:

```
docker-compose up --build
```

3. Start the server

```
npm run dev
```

4. Serevr is up and available to run at:

```
http://localhost:3000
```
## API Endpoints
- MongoDB
  1. Insert Data: POST /api/populate
     Body: { "entryCount": 100 }
  2. Retrieve Data: GET /api/retrieve/:entryValue
  3. Clear Data: DELETE /api/clear

- Redis
  1. Insert Data: POST /api/populate-redis
     Body: { "entryCount": 100 }
  2. Retrieve Data: GET /api/retrieve-redis/:key
  3. Clear Data: DELETE /api/clear-redis

- RabbitMQ
  1. Send Message: GET /api/test-mq?index=1

- Kafka
  1. Send Bulk Messages: POST /api/test-kafka
     Body: { "reqCount": 1000 }

## Running Tests
To test the performance and scalability of each service, you can use the provided endpoints to send a large number of requests, monitor the time taken for the operations, and inspect the logs for any bottlenecks.


