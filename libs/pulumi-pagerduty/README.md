# pulumi-pagerduty

Resources for creating Pagerduty resources, and subscribing them to SNS topics.

## Getting started

The PagerDuty provider requires an API Key for authentication. See the
[https://www.pulumi.com/docs/intro/cloud-providers/pagerduty/setup/](PagerDuty setup page)
for details.

For smaller teams, it may be easier to set the API key using pulumi secrets.

```ts
import * as aws from '@pulumi/aws'
import { RecommendedAlarms } from '@wanews/pulumi-lambda'
import {
  PagerdutyService,
  PagerdutySnsTopicSubscription,
} from '@wanews/pulumi-pagerduty'

// create an SNS topic
const topic = new aws.sns.Topic('lambda-alarms', {
  // ...
})

// create a Pagerduty Service
const service = new PagerdutyService('lambda-service', {
  pagerdutyServiceName: 'auth-prd-lambda',
  escalationPolicyId: pagerduty
    .getEscalationPolicy({ name: 'AfterHours' }, { async: true })
    .then((policy) => policy.id)
    .catch((err) => {
      throw new pulumi.ResourceError(err, this)
    }),
})

// add a CloudWatch integration to the Pagerduty Service
const topicSubscription = new PagerdutySnsTopicSubscription('subscription', {
  notificationTopicArn: topic.arn,
  pagerdutyServiceId: service.id,
  cloudwatchVendorName: 'Cloudwatch',
})

// Optional: create cloudwatch metric alarms
const alarms = new RecommendedAlarms('alarms', {
  snsTopicArn: topic.arn,
  // ...
})
```

## Running unit tests

Run `nx test pulumi-pagerduty` to execute the unit tests via [Jest](https://jestjs.io).
