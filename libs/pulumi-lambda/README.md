# pulumi-lambda

A higher level lambda resource which creates the log group ahead of time so it can be tagged.

This ensures logging costs are tagged appropriately.

## Usage

```ts
import { LambdaFunction } from '@wanews/pulumi-lambda'

const lambda = new LambdaFunction(`my-lambda`, {
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
import { MetricAlarms } from '@wanews/pulumi-lambda'

new MetricAlarms(name, {
  snsTopicArn: 'arn:aws:sns:<region>:<account>:<topic>>',
  thresholds: {
    timeoutMs: pulumi
      .output(lambda.function.timeout)
      .apply((timeout) => (timeout ?? 3) * 1000),
  },
  lambdaFunctionName: lambda.function.name,
  getTags(name) {
    return { name }
  },
})
```
