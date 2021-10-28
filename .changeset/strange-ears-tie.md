---
'@wanews/pulumi-static-site': patch
---

`bucketOptions` pulumi input accepts every aws.s3.Bucket pulumi input
Added `additionalOrigins` and `orderedCacheBehaviours` options to the `distributionOptions` pulumi input
Added aliases for the route53 records for easy module migrations
