# pulumi-lambda

A higher level lambda resource which creates the log group ahead of time so it can be tagged.

This ensures logging costs are tagged appropriately.

## Usage

```ts
new LambdaFunction(`my-lambda`, {
  lambdaOptions: {
    // See https://www.pulumi.com/docs/reference/pkg/aws/lambda/function/#inputs
  },
  getTags(name) {
    return { name }
  },
})
```
