import * as pagerduty from '@pulumi/pagerduty'
import * as pulumi from '@pulumi/pulumi'

export class PagerdutyService extends pulumi.ComponentResource {
    pagerdutyService: pagerduty.Service

    constructor(
        name: string,
        args: {
            /** a descriptive name for the service in PagerDuty */
            pagerdutyServiceName: string

            /** an optional description for the service in PagerDuty */
            pagerdutyServiceDescription?: string

            /**
             * an optional escalation policy ID used for the pagerduty service
             * if not specified, attempt to use the escalation policy named 'Default'
             */
            escalationPolicyId?: pulumi.Input<string>
        },
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('wanews:pagerduty/Service', name, args, opts)

        this.pagerdutyService = new pagerduty.Service(
            name,
            {
                name: args.pagerdutyServiceName,
                description:
                    args.pagerdutyServiceDescription ?? 'Managed by Pulumi',
                escalationPolicy:
                    args.escalationPolicyId ??
                    pagerduty
                        .getEscalationPolicy(
                            { name: 'Default' },
                            { async: true },
                        )
                        .then((policy) => policy.id)
                        .catch((err) => {
                            throw new pulumi.ResourceError(err, this)
                        }),
                autoResolveTimeout: 'null',

                /**
                 * The pulumi docs list the following valid values for alertCreation:
                 *  - createIncidents
                 *  - createAlertsAndIncidents
                 *
                 * However, the terraform provider and the underlying API both permit
                 * the values below, and throw errors if you attempt to use the above:
                 *  - create_incidents
                 *  - create_alerts_and_incidents
                 */
                alertCreation: 'create_alerts_and_incidents',
            },
            { parent: this },
        )
    }
}
