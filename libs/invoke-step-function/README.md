# invoke-step-function

Invokes a express step function synchronously as part of the `up` process.

## Usage

```ts
import { StepFunctionInvocation } from '@wanews/pulumi-invoke-step-function'

new StepFunctionInvocation(`invoke-step-function`, {
  stateMachineArn: myStepFunction.arn,
  input: 'My input',
})
```
