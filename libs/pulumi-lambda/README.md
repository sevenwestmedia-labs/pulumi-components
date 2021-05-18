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

## Monitoring

`RecommendedAlarms` provides an opinionated set of alarms for a lambda function:

```ts
import { RecommendedAlarms } from '@wanews/pulumi-lambda'

new RecommendedAlarms(name, {
  snsTopicArn: 'arn:aws:sns:<region>:<account>:<topic>',
  lambdaFunctionName: lambda.function.name,
  thresholds: {
    timeoutMs: pulumi
      .output(lambda.function.timeout)
      .apply((timeout) => (timeout ?? 3) * 1000),
  },
  getTags(name) {
    return { name }
  },
})
```

You can also create individual alarms, or set up multiple alarms for the same metric:

```ts
import { AvgDurationAlarm } from '@wanews/pulumi-lambda'

const warn = new AvgDurationAlarm(name, {
  snsTopicArn: 'arn:aws:sns:<region>:<account>:<topic-warn>',
  lambdaFunctionName: lambda.function.name,
  avgDurationMs: 3000,
  getTags(name) {
    return { name }
  },
})

const error = new AvgDurationAlarm(name, {
  snsTopicArn: 'arn:aws:sns:<region>:<account>:<topic-error>',
  lambdaFunctionName: lambda.function.name,
  avgDurationMs: 7000,
  getTags(name) {
    return { name }
  },
})
```
