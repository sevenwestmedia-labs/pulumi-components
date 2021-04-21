# API Gateway Lambda Proxy

Pulumi component which provisions an APIGateway v2, Lambda and optionally cloudfront to quickly be able to stand up a single lambda which handles all APIGateway requests.

## Why

Using fastify.io or similar with https://github.com/fastify/aws-lambda-fastify to host a fastify application in a lambda.

This means local dev just means you need to `.listen()` on your fastify app to start the server locally, and this resource will ensure it is deployed into AWS ready to go.

## Usage

### No custom domain name

```ts
import { ApiGatewayLambdaProxy } from '@wanews/pulumi-apigateway-lambda-proxy'

new ApiGatewayLambdaProxy(`my-api`, {
  // Specify any Lambda options here, see https://www.pulumi.com/docs/reference/pkg/aws/lambda/function/#inputs
  lambdaOptions: {
    code: new pulumi.asset.FileArchive('path/to/code/'),
    runtime: 'nodejs12.x',
    handler: 'index.handler',
    memorySize: 512,
  },
})
```

### With custom domain name

```ts
import { ValidateCertificate } from '@wanews/pulumi-certificate-validation'
import { ApiGatewayLambdaProxy } from '@wanews/pulumi-apigateway-lambda-proxy'
import { Certificate } from '@pulumi/aws/acm'

const cert = new Certificate(`${name}-cert`, {
  domainName: 'my.customdomain.net',
  validationMethod: 'DNS',
})

// Get the route53 zone
const zone = pulumi.output(aws.route53.getZone({ name: 'customdomain.net' }))
  .zoneId

// Use @wanews/pulumi-certificate-validation to perform dns validation
const validCertificate = new ValidateCertificate(`cert-validation`, {
  cert,
  zones: [
    {
      domain: 'my.customdomain.net',
      zoneId,
    },
  ],
})

new ApiGatewayLambdaProxy(`my-api`, {
  hostname: 'my.customdomain.net',
  apiGatewayCertificateArn: validCertificate.validCertificateArn,

  lambdaOptions: {
    code: new pulumi.asset.FileArchive('path/to/code/'),
    runtime: 'nodejs12.x',
    handler: 'index.handler',
    memorySize: 512,
  },
})
```
