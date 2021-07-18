import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'

/** Validates a certificate using DNS */
export class ValidateCertificate extends pulumi.ComponentResource {
    validCertificateArn: pulumi.Output<string>

    constructor(
        name: string,
        args: {
            cert: aws.acm.Certificate
            /**
             * A lookup for the domains, and which zone they live in
             * @example [{ domain: 'thewest.com.au', zoneId: westZoneId }, { domain: 'countryman.com.au': countrymanZoneId }]
             */
            zones: Array<{
                domain: string | pulumi.Input<string>
                zoneId: string | pulumi.Input<string>
                provider?: pulumi.ProviderResource
            }>
        },
        opts?: pulumi.ComponentResourceOptions | undefined,
    ) {
        super('cert-validation', name, args, opts)

        const validationRecords = pulumi
            .all([args.cert.domainValidationOptions, args.zones])
            .apply(([validationOptions, zones]) =>
                validationOptions.map((validationOption) => {
                    const zoneConfig = zones.find((zone) =>
                        validationOption.domainName.endsWith(zone.domain),
                    )

                    if (!zoneConfig) {
                        throw new pulumi.ResourceError(
                            `Cannot find zone info for ${validationOption.domainName}`,
                            this,
                        )
                    }

                    const validationRecord = new aws.route53.Record(
                        `${name}-validation-record-${validationOption.domainName}`,
                        {
                            zoneId: zoneConfig.zoneId,
                            name: validationOption.resourceRecordName,
                            type: validationOption.resourceRecordType,
                            records: [validationOption.resourceRecordValue],
                            allowOverwrite: true,
                            // 10 minutes
                            ttl: 10 * 60,
                        },
                        {
                            parent: this,
                            deleteBeforeReplace: true,
                            provider: zoneConfig.provider,
                        },
                    )
                    return validationRecord.fqdn
                }),
            )

        const validation = new aws.acm.CertificateValidation(
            `${name}-validation`,
            {
                certificateArn: args.cert.arn,
                validationRecordFqdns: validationRecords,
            },
            { parent: this },
        )

        this.validCertificateArn = validation.certificateArn
        this.registerOutputs({
            validCertificateArn: this.validCertificateArn,
        })
    }
}
