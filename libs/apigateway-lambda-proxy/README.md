# API Gateway Lambda Proxy

Pulumi component which provisions an APIGateway v2, Lambda and optionally cloudfront to quickly be able to stand up a single lambda which handles all APIGateway requests.

## Why

Using fastify.io or similar with https://github.com/fastify/aws-lambda-fastify to host a fastify application in a lambda.

This means local dev just means you need to `.listen()` on your fastify app to start the server locally, and this resource will ensure it is deployed into AWS ready to go.

## Usage
