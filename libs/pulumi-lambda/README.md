# pulumi-lambda

A higher level lambda resource which creates the log group ahead of time so it can be tagged and has a default execution policy which can write to the created log group, but be prevented from creating a new log group.

This ensures logging costs are tagged appropriately.

## Usage

Ensure the `DenyLogGroupCreationPolicy` resource has been created in the account you are creating the lambda in, then

```ts
new LambdaFunction(`my-lambda', {
  lambdaOptions: {
    ...
  },
  getTags(name) {
    return { name }
  }
})
```
