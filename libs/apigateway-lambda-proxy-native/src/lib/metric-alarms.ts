import * as pulumi from '@pulumi/pulumi'
import {cloudwatch} from '@pulumi/aws-native'

const namespace = 'AWS/ApiGateway'

/**
 * Dimensions to identify an HTTP API in CloudWatch.
 */
export type HttpGateway = {
    /**
     * The API Gateway ID to monitor. Only valid for HTTP endpoints.
     */
    id: pulumi.Input<string>

    /**
     * The stage to monitor
     */
    stage?: pulumi.Input<string>
}

/**
 * Provides an opinionated set of recommended alarms for an API Gateway stage.
 *
 * Raise alarms for the following:
 *  - 5xx error rate exceeded (default: 2%)
 *  - 4xx error rate exceeded (default: 50%)
 *  - integration latency too high (anomaly detection)
 */
export class RecommendedAlarms extends pulumi.ComponentResource {
    constructor(
        name: string,
        args: {
            /**
             * Alerts will be sent to this SNS topic
             */
            snsTopicArn: pulumi.Input<string>
            /**
             * Set thresholds for the alarms
             */
            thresholds?: {
                errorRate5xxPercent?: pulumi.Input<number>
                errorRate4xxPercent?: pulumi.Input<number>
                integrationLatencyStdDeviations?: pulumi.Input<number>
            }
            /** Set periods for the alarms, in seconds */
            periods?: {
                errorRate5xxPeriod?: pulumi.Input<number>
                errorRate4xxPeriod?: pulumi.Input<number>
                integrationLatencyPeriod?: pulumi.Input<number>
            }
            /**
             * The API Gateway to monitor
             */
            apiGateway: HttpGateway
            /**
             * a callback function that returns tags for
             * each resource
             */
            getTags: (
                name: string,
            ) => {
                [key: string]: pulumi.Input<string>
            }
        },
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('wanews:apigateway/RecommendedAlarms', name, {}, opts)

        new ErrorRate5xxAlarm(
            name,
            {
                snsTopicArn: args.snsTopicArn,
                apiGateway: args.apiGateway,
                getTags: args.getTags,
                errorRate5xxPercent: args.thresholds?.errorRate5xxPercent,
                period: args.periods?.errorRate5xxPeriod,
            },
            { parent: this },
        )

        new ErrorRate4xxAlarm(
            name,
            {
                snsTopicArn: args.snsTopicArn,
                apiGateway: args.apiGateway,
                getTags: args.getTags,
                errorRate4xxPercent: args.thresholds?.errorRate4xxPercent,
                period: args.periods?.errorRate4xxPeriod,
            },
            { parent: this },
        )

        new IntegrationLatencyAlarm(
            name,
            {
                snsTopicArn: args.snsTopicArn,
                apiGateway: args.apiGateway,
                getTags: args.getTags,
                stdDeviations: args.thresholds?.integrationLatencyStdDeviations,
                period: args.periods?.integrationLatencyPeriod,
            },
            { parent: this },
        )
    }
}

/**
 * Get dimensions for a cloudwatch alarm
 *
 * @param api the APIGateway to test
 * @returns the dimensions for passing to CloudWatch alarms
 */
function getDimensions(api: HttpGateway) {
    return pulumi.all([api.id, api.stage]).apply(([id, stage]) => ({
        ApiId: id,
        ...(stage
            ? {
                  Stage: stage,
              }
            : {}),
    }))
}

/** raise an alarm if the 5xx error rate exceeds errorRate5xxPercent */
export class ErrorRate5xxAlarm extends pulumi.ComponentResource {
    constructor(
        name: string,
        args: {
            /**
             * Alerts will be sent to this SNS topic
             */
            snsTopicArn: pulumi.Input<string>
            /**
             * The API Gateway to monitor
             */
            apiGateway: HttpGateway
            /**
             * Alert if the 5xx error rate exceeds this
             * (default: 2 percent)
             */
            errorRate5xxPercent?: pulumi.Input<number>
            /**
             * The length of each sampling period, in seconds
             * (default: 60 seconds)
             */
            period?: pulumi.Input<number>
            /**
             * a callback function that returns tags for
             * each resource
             */
            getTags: (
                name: string,
            ) => {
                [key: string]: pulumi.Input<string>
            }
        },
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('wanews:apigateway/ErrorRate5xxAlarm', name, {}, opts)

        const metricName = '5xx'
        const dimensions = getDimensions(args.apiGateway)
        const thresholdPercent = args.errorRate5xxPercent ?? 2
        const threshold = pulumi
            .output(thresholdPercent)
            .apply((percent) => percent / 100)
        const period = args.period ?? 60
        const resourceName = `${name}-5xx-rate`

        new cloudwatch.MetricAlarm(
            resourceName,
            {
                period,
                evaluationPeriods: 2,
                datapointsToAlarm: 2,
                comparisonOperator: 'GreaterThanThreshold',
                namespace,
                metricName,
                dimensions,
                threshold,
                statistic: 'Average',
                alarmDescription: pulumi.interpolate`threshold: 5xx rate > ${thresholdPercent}%: ${args.apiGateway.id}`,
                alarmActions: [args.snsTopicArn],
                okActions: [args.snsTopicArn],
                insufficientDataActions: [args.snsTopicArn],
                treatMissingData: 'notBreaching',
                tags: args.getTags(resourceName),
            },
            {
                parent: this,
                deleteBeforeReplace: true,
            },
        )
    }
}

/** raise an alarm if the 4xx error rate exceeds errorRate4xxPercent */
export class ErrorRate4xxAlarm extends pulumi.ComponentResource {
    constructor(
        name: string,
        args: {
            /**
             * Alerts will be sent to this SNS topic
             */
            snsTopicArn: pulumi.Input<string>
            /**
             * The API Gateway to monitor
             */
            apiGateway: HttpGateway
            /**
             * Alert if the 4xx error rate exceeds this
             * (default: 50 percent)
             */
            errorRate4xxPercent?: pulumi.Input<number>
            /**
             * The length of each sampling period, in seconds
             * (default: 60 seconds)
             */
            period?: pulumi.Input<number>
            /**
             * a callback function that returns tags for
             * each resource
             */
            getTags: (
                name: string,
            ) => {
                [key: string]: pulumi.Input<string>
            }
        },
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('wanews:apigateway/ErrorRate4xxAlarm', name, {}, opts)

        const metricName = '4xx'
        const dimensions = getDimensions(args.apiGateway)
        const thresholdPercent = args.errorRate4xxPercent ?? 50
        const threshold = pulumi
            .output(thresholdPercent)
            .apply((percent) => percent / 100)
        const period = args.period ?? 60
        const resourceName = `${name}-4xx-rate`

        new cloudwatch.MetricAlarm(
            resourceName,
            {
                period,
                evaluationPeriods: 2,
                datapointsToAlarm: 2,
                comparisonOperator: 'GreaterThanThreshold',
                namespace,
                metricName,
                dimensions,
                threshold,
                statistic: 'Average',
                alarmDescription: pulumi.interpolate`threshold: 4xx rate > ${thresholdPercent}%: ${args.apiGateway.id}`,
                alarmActions: [args.snsTopicArn],
                okActions: [args.snsTopicArn],
                insufficientDataActions: [args.snsTopicArn],
                treatMissingData: 'notBreaching',
                tags: args.getTags(resourceName),
            },
            {
                parent: this,
                deleteBeforeReplace: true,
            },
        )
    }
}

/** raise an alarm if integration latency is too high */
export class IntegrationLatencyAlarm extends pulumi.ComponentResource {
    constructor(
        name: string,
        args: {
            /**
             * Alerts will be sent to this SNS topic
             */
            snsTopicArn: pulumi.Input<string>
            /**
             * The API Gateway to monitor
             */
            apiGateway: HttpGateway
            /**
             * The number of standard deviations to use for the anomaly detection.
             *
             * Default: 5
             */
            stdDeviations?: pulumi.Input<number>
            /**
             * The length of each sampling period, in seconds
             * (default: 60 seconds)
             */
            period?: pulumi.Input<number>
            /**
             * a callback function that returns tags for
             * each resource
             */
            getTags: (
                name: string,
            ) => {
                [key: string]: pulumi.Input<string>
            }
        },
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('wanews:apigateway/IntegrationLatencyAlarm', name, {}, opts)

        const resourceName = `${name}-integration-latency`
        const metricName = 'IntegrationLatency'
        const dimensions = getDimensions(args.apiGateway)
        args.stdDeviations = args.stdDeviations ?? 5
        const period = args.period ?? 60

        new cloudwatch.MetricAlarm(
            resourceName,
            {
                evaluationPeriods: 2,
                datapointsToAlarm: 2,
                comparisonOperator: 'GreaterThanUpperThreshold',
                metricQueries: [
                    {
                        id: 'm1',

                        // Counter-intuitively, BOTH metrics need to returnData
                        // when using anomaly detection alarms. This is
                        // contrary to the AWS documentation!
                        // https://docs.aws.amazon.com/AmazonCloudWatch/latest/APIReference/API_PutMetricAlarm.htmlAPI_PutMetricAlarm_Example_3
                        returnData: true,

                        metric: {
                            metricName,
                            dimensions,
                            namespace,
                            stat: 'Average',
                            period,
                        },
                    },
                    {
                        id: 't1',
                        expression: pulumi.interpolate`ANOMALY_DETECTION_BAND(m1, ${args.stdDeviations})`,
                        label: `${metricName} (expected)`,
                        returnData: true,
                    },
                ],
                thresholdMetricId: 't1',
                alarmDescription: pulumi.interpolate`anomaly: ${metricName} (${args.stdDeviations} standard deviations): ${args.apiGateway.id}`,
                alarmActions: [args.snsTopicArn],
                okActions: [args.snsTopicArn],
                insufficientDataActions: [args.snsTopicArn],
                treatMissingData: 'notBreaching',
                tags: args.getTags(resourceName),
            },
            {
                parent: this,
                deleteBeforeReplace: true,
            },
        )
    }
}
