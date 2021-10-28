# @wanews/pulumi-static-site

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
