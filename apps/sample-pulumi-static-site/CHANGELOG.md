# sample-pulumi-static-site

## 0.0.4

### Patch Changes

- Updated dependencies [3092562]
  - @wanews/pulumi-static-site@0.1.1

## 0.0.3

### Patch Changes

- a5392a3: Add permittedAccounts to S3BucketOptions

  Usage:

  ```
  new Bucket('bucket', {
     ...
     bucketOptions: {
       pertmittedAccounts: [
         '11111111',
         '22222222',
       ],
     },
  })
  ```

- Updated dependencies [a5392a3]
- Updated dependencies [63801e5]
  - @wanews/pulumi-static-site@0.1.0

## 0.0.2

### Patch Changes

- Updated dependencies [b356955]
  - @wanews/pulumi-static-site@0.0.2
