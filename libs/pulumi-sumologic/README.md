# pulumi-sumologic

This library was generated with [Nx](https://nx.dev).

It's currently a _very_ early test of the new sumologic pulumi provider, and is probably not suitable for production use yet.

## Some random notes

Setup: https://www.pulumi.com/docs/intro/cloud-providers/sumologic/setup/

It's probably a lot easier to set up using pulumi config instead of environment vars.

It stores AWS creds in plaintext???? see https://www.pulumi.com/docs/reference/pkg/sumologic/cloudwatchsource/ &mdash; only a problem if we store creds, let's stick to role-based auth!

A lot of things are undocumented :(
... but documentation is available for the terraform module -- https://registry.terraform.io/providers/SumoLogic/sumologic/latest/docs/resources -- might be a bug in pulumi-terraform-bridge

Pulumi API docs: https://www.pulumi.com/docs/reference/pkg/sumologic/

A hosted collector has one or more sources:

1. Create a hosted collector using new sumologic.Collector
2. Create a source of the desired type using new `sumologic.*Source`, eg `new sumologic.CloudwatchSource`

There's a weird type mismatch between collector.id and collectorId :shrug:

Workaround:

```ts
const collector = new sumologic.Collector(/* ... */)
const collectorId = collector.id.apply((id) => Number(id))
collectorId.apply((collectorId) => {
  if (Number.isNaN(collectorId)) {
    throw new pulumi.ResourceError(`non-numeric id ${collector.id} `, this)
  }
})
```

It's still not really clear how to set up a Cloudwatch Logs source, though we've already solved that elsewhere :p

SUMOLOGIC_ENVIRONMENT wasn't really documented in the pulumi or terraform docs, and they didn't really link out to the relevent sumo docs (our sumo account is at au.service.sumologic.com, so the correct value for SUMOLOGIC_ENVIRONMENT is `au`)

I wasn't able to get any metrics out of the CloudWatch Metrics source, or any traces out of the Xray source :(

I was, however, able to get metrics out of the tracing source. I'm sure I've set it up wrong, probably need help from Sumo.

## Running unit tests

Run `nx test pulumi-sumologic` to execute the unit tests via [Jest](https://jestjs.io).
