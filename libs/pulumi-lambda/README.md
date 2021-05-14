# pulumi-lambda

A higher level lambda resource which creates the log group ahead of time so it can be tagged.

This ensures logging costs are tagged appropriately.

## Usage

```ts
import { LambdaFunction } from '@wanews/pulumi-lambda'

new LambdaFunction(`my-lambda`, {
  lambdaOptions: {
    // See https://www.pulumi.com/docs/reference/pkg/aws/lambda/function/#inputs
  },
  getTags(name) {
    return { name }
  },
})
```

To enable monitoring:

```ts
import { LambdaFunction } from '@wanews/pulumi-lambda'

new LambdaFunction(`my-lambda`, {
  lambdaOptions: {
    // See https://www.pulumi.com/docs/reference/pkg/aws/lambda/function/#inputs
  },
  monitoring: {
    enabled: true,
    snsTopicArn: 'arn:aws:sns:<region>:<account>:<topic>',
    // optional, but recommended: override thresholds
    thresholds: {
      avgDurationMs: 3000, // 3 seconds
      maxDurationMs: 15000, // 15 seconds
      errorRatePercent: 2, // 2 percent
      throttles: 1,
      concurrents: 450,
    },
  },
  getTags(name) {
    return { name }
  },
})
```
