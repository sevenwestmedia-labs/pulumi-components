import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'
import * as pagerduty from '@pulumi/pagerduty'

export class PagerdutySnsTopicSubscription extends pulumi.ComponentResource {
    serviceIntegration: pagerduty.ServiceIntegration
    serviceIntegrationUrl: pulumi.Output<string>

    constructor(
        name: string,
        args: {
            /**
             * The SNS Topic ARN for the subscription
             */
            notificationTopicArn: pulumi.Input<string>

            /**
             * The Pagerduty Service ID to subscribe to the SNS Topic
             */
            pagerdutyServiceId: pulumi.Input<string>

            /**
             * The type of service that posts to the SNS topic.
             * default: 'Cloudwatch'
             */
            vendorName?: pulumi.Input<string>
        },
        opts: pulumi.ComponentResourceOptions,
    ) {
        super('wanews:pagerduty/SnsTopicSubscription', name, args, opts)

        const vendor = pulumi.output(args.vendorName).apply((vendorName) =>
            pagerduty.getVendor(
                {
                    name: vendorName ?? 'Cloudwatch',
                },
                { async: true, parent: this },
            ),
        )

        this.serviceIntegration = new pagerduty.ServiceIntegration(
            name,
            {
                service: args.pagerdutyServiceId,
                vendor: vendor.id,
            },
            { parent: this },
        )

        this.serviceIntegrationUrl = pulumi.interpolate`https://events.pagerduty.com/integration/${this.serviceIntegration.integrationKey}/enqueue`

        new aws.sns.TopicSubscription(
            `${name}-pagerduty`,
            {
                topic: args.notificationTopicArn,
                protocol: 'https',
                endpoint: this.serviceIntegrationUrl,
                endpointAutoConfirms: true,
                rawMessageDelivery: false,
            },
            {
                parent: this,
            },
        )
    }
}
