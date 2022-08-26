# @wanews/pulumi-static-site

## 0.7.0

### Minor Changes

- 3d4b363: bucketPolicyOverrides is now a Promise -- allows using aws.iam.getPolicyDocument

## 0.6.2

### Patch Changes

- 3d92918: fix permission error when creating a certificate with a DNS provider in a different account

## 0.6.1

### Patch Changes

- ae34883: Fix missing allowOverwrite on A record

## 0.6.0

### Minor Changes

- 7e4ce26: allow the provider to be overridden for DNS records

## 0.5.4

### Patch Changes

- a2c1038: allow the bucket arn to be inserted into the bucket policy overrides using "{{BUCKETARN}}"

## 0.5.3

### Patch Changes

- c6d13d4: Allow bucket and distribution to be protected from accidental deletion

## 0.5.2

### Patch Changes

- 651511f: fix bucketPolicyOverrides

## 0.5.1

### Patch Changes

- 859b0b1: Fix bucket policy overrides

## 0.5.0

### Minor Changes

- c4fad16: Allow Bucket and Distribution to be imported

## 0.4.2

### Patch Changes

- 512a118: bump dependencies to fix tsc error
- Updated dependencies [512a118]
  - @wanews/pulumi-certificate-validation@0.5.2

## 0.4.1

### Patch Changes

- b6a2f11: export StaticSiteArgs

## 0.4.0

### Minor Changes

- 115e942: Upgraded dependencies

### Patch Changes

- Updated dependencies [115e942]
  - @wanews/pulumi-certificate-validation@0.5.0

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
