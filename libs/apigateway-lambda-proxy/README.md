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
const zoneId = pulumi.output(aws.route53.getZone({ name: 'customdomain.net' }))
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

function getTags(name: string) {
    // Use whatever logic you like to construct your tags
    return {
      Name: name,
      Product: 'my-product',
      /* ... */
    }
}

new ApiGatewayLambdaProxy(`my-api`, {
  hostname: 'my.customdomain.net',
  apiGatewayCertificateArn: validCertificate.validCertificateArn,
  getTags,

  lambdaOptions: {
    code: new pulumi.asset.FileArchive('path/to/code/'),
    runtime: 'nodejs12.x',
    handler: 'index.handler',
    memorySize: 512,
  },
})
```

### Monitoring

```ts
import {
  ApiGatewayLambdaProxy,
  RecommendedAlarms,
} from '@wanews/pulumi-apigateway-lambda-proxy'

const gw = new ApiGatewayLambdaProxy('apigw-prod', {
  /* ... */
})

new RecommendedAlarms('alarms', {
  snsTopicArn: 'arn:aws:sns:<region>:<account>:<topic>',
  apiGateway: {
    id: gw.apiGateway.id,
    name: httpApi.name,
    stage: gw.stage?.name,
})
```

You can also create alarms for APIs created elsewhere:

```ts
import * as aws from '@pulumi/aws'
import { RecommendedAlarms } from '@wanews/pulumi-apigateway-lambda-proxy'

const httpApi = new aws.apigatewayv2.Api('apigw-http', {
  /* ... */
})

new RecommendedAlarms('alarms', {
  snsTopicArn: 'arn:aws:sns:<region>:<account>:<topic>',
  apiGateway: {
    id: httpApi.id,
    name: httpApi.name,
    stage: gw.stage?.name,
  },
})
```

Note that the name is only used for cosmetic purposes. You should set it to a value that easily identifies the API.

By default, the following metrics are monitored:

- 5xx error rate
- 4xx error rate
- integration latency

However, if you're not happy with the defaults, you can override the default thresholds, or create individual alarms instead:

```ts
import {
  ApiGatewayLambdaProxy,
  RecommendedAlarms,
} from '@wanews/pulumi-apigateway-lambda-proxy'

const gw = new ApiGatewayLambdaProxy('apigw-prod', {
  /* ... */
})

new RecommendedAlarms('alarms', {
  snsTopicArn: 'arn:aws:sns:<region>:<account>:<topic>',
  apiGateway: {
    name: restApi.name,
    stage: gw.stage?.name,
  },
  thresholds: {
    errorRate5xxPercent: 1,
  },
})

new ErrorRate5xxAlarm('alarm', {
  snsTopicArn: 'arn:aws:sns:<region>:<account>:<topic>',
  apiGateway: {
    id: gw.apiGateway.id,
    name: httpApi.name,
    stage: gw.stage?.name,
  },
})
```
