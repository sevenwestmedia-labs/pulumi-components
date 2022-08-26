# pulumi-static-site

Provides an S3 bucket behind a CloudFront distribution for use as a static site.

Implements the `Using a website endpoint as the origin, with access restricted by a Referer header` behaviour as described by https://aws.amazon.com/premiumsupport/knowledge-center/cloudfront-serve-static-website/

## Usage

```ts
import { StaticSite } from '@wanews/pulumi-static-site'

new StaticSite('example.com', {
  primaryDomain: 'example.com',
  getTags: (name) => ({ name }),
})
```

## Running unit tests

Run `nx test pulumi-static-site` to execute the unit tests via [Jest](https://jestjs.io).

## Importing existing resources

This module allows existing buckets and distributions to be imported instead of creating new ones.

## S3 Bucket

To import an existing bucket, use `importPrimaryBucket`. However, pulumi refuses to import a resources unless its args match those of the resource to be imported, so the bucket args will typically need to be overridden too.

```ts
import { StaticSite } from '@wanews/pulumi-static-site'

new StaticSite('example.com', {
  primaryDomain: 'example.com',
  getTags: (name) => ({ name }),
  importPrimaryBucket: {
    bucketId: 'my-bucket',
    overrideBucketArgs: {
      bucket: 'my-bucket',
      tags: { /* my-tags */ },
      // etc
    }
  },
})
```

Once the resource has been imported, remove the `importPrimaryBucket` to apply the new settings. If you still need to override any bucket args, use `bucketOptions`.

```ts
import { StaticSite } from '@wanews/pulumi-static-site'

new StaticSite('example.com', {
  primaryDomain: 'example.com',
  getTags: (name) => ({ name }),
  bucketOptions: {
    bucket: 'my-bucket',
  },
})
```
