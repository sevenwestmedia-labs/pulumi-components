# Pulumi Invoke Lambda

Invokes a lambda as part of the `up` process.

## Usage

```ts
import { LambdaInvocation } from '@wanews/pulumi-invoke-lambda'

new LambdaInvocation(`invoke-lambda`, {
  functionName: myLambda.arn,
})
```
