# @wanews/pulumi-static-site

## 0.3.0

### Minor Changes

- 50c2ba0: Added responseHeadersPolicyId

## 0.2.0

### Minor Changes

- e086603: allow overriding bucket policy to make the Referer Allowed instead of Deny

## 0.1.1

### Patch Changes

- 3092562: Fix conflicting operation error when bucket policy and ownership controls are applied simultaneously

## 0.1.0

### Minor Changes

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

- 63801e5: allow bucket ownership to be set to BucketOwnerPreferred

## 0.0.6

### Patch Changes

- 2b31a24: `bucketOptions` pulumi input accepts every aws.s3.Bucket pulumi input
  Added `additionalOrigins` and `orderedCacheBehaviours` options to the `distributionOptions` pulumi input
  Added aliases for the route53 records for easy module migrations

## 0.0.5

### Patch Changes

- fecaea7: Removed hard coded webAclId and added `distributionIgnoreChanges`

## 0.0.4

### Patch Changes

- 5ca2da4: Added lambdaFunctionAssociations to distributionOptions input

## 0.0.3

### Patch Changes

- 1b9285f: Added `primaryHostname` pulumi input

## 0.0.2

### Patch Changes

- b356955: Initial version of the pulumi-static-site module
