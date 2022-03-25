---
'@wanews/pulumi-static-site': minor
'sample-pulumi-static-site': patch
---

Add permittedAccounts to S3BucketOptions

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

