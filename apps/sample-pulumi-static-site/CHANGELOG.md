# sample-pulumi-static-site

## 0.1.2

### Patch Changes

- Updated dependencies [c4fad16]
  - @wanews/pulumi-static-site@0.5.0

## 0.1.1

### Patch Changes

- 512a118: bump dependencies to fix tsc error
- Updated dependencies [512a118]
  - @wanews/pulumi-static-site@0.4.2

## 0.1.0

### Minor Changes

- 115e942: Upgraded dependencies

### Patch Changes

- Updated dependencies [115e942]
  - @wanews/pulumi-static-site@0.4.0

## 0.0.6

### Patch Changes

- Updated dependencies [50c2ba0]
  - @wanews/pulumi-static-site@0.3.0

## 0.0.5

### Patch Changes

- e086603: allow overriding bucket policy to make the Referer Allowed instead of Deny
- Updated dependencies [e086603]
  - @wanews/pulumi-static-site@0.2.0

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
