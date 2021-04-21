# AWS Certificate Validation

This resource makes it easy to validate any certificates you provision. It supports certificates with multiple domain names attached, creating all required validation records.

## Usage

```ts
import { ValidateCertificate } from '@wanews/pulumi-certificate-validation'
import { Certificate } from '@pulumi/aws/acm'

const cert = new Certificate(`${name}-cert`, {
  domainName: 'my.customdomain.net',
  validationMethod: 'DNS',
})

// Get the route53 zone
const zone = pulumi.output(aws.route53.getZone({ name: 'customdomain.net' }))
  .zoneId

// Use @wanews/pulumi-certificate-validation to perform dns validation
const validCertificate = new ValidateCertificate(`cert-validation`, {
  cert,
  // Certificates can be for multiple domains
  // You need to specify the domain, plus the hosting route53 zone id
  // (the validation DNS records will be created in those zone)
  zones: [
    {
      domain: 'my.customdomain.net',
      zoneId,
    },
  ],
})

// use this arn which will be resolved once the certificate is validated
const certArn = validCertificate.validCertificateArn
```
