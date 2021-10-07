# pulumi-static-site

Provides an S3 bucket behind a CloudFront distribution for use as a static site.

Implements the `Using a website endpoint as the origin, with access restricted by a Referer header` behaviour as described https://aws.amazon.com/premiumsupport/knowledge-center/cloudfront-serve-static-website/

## Usage

```
import { StaticSite } from '@wanews/pulumi-static-site'

new StaticSite('example.com', {
    primaryDomain: 'example.com',
    getTags: (name) => ({ name }),
})
```

## Running unit tests

Run `nx test pulumi-static-site` to execute the unit tests via [Jest](https://jestjs.io).
