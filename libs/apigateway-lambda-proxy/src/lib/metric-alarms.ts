import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'

const namespace = 'AWS/ApiGateway'

/**
 * Dimensions to identify an HTTP API in CloudWatch.
 *
 * The main difference is REST APIs are identified by name, while HTTP APIs are identified by id.
 */
export type HttpGateway = {
    /**
     * The API Gateway ID to monitor. Only valid for HTTP endpoints.
     */
    id: pulumi.Input<string>

    /**
     * The API name to monitor.
     *
     * For REST endpoints, this must be the name of the API created in AWS.
     * For HTTP endpoints, this can be anything (it's only used in alerts).
     */
    name: pulumi.Input<string> | undefined

    /**
     * The stage to monitor
     */
    stage?: pulumi.Input<string>
}

/**
 * Dimensions to identify an API in CloudWatch.
 */
export type ApiGateway = HttpGateway

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
            /**
             * The API Gateway to monitor
             */
            apiGateway: ApiGateway
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
            },
            { parent: this },
        )
    }
}

/**
 * Check if an ApiGateway is a REST API
 *
 * @param api the APIGateway to test
 * @returns true if api.id is undefined
 */
function isRestApi(api: ApiGateway) {
    return api.id === undefined
}

/**
 * Check if an ApiGateway is an HTTP API
 *
 * @param api the APIGateway to test
 * @returns true if api.id is defined
 */
function isHttpApi(api: ApiGateway) {
    return !isRestApi(api)
}

/**
 * Get dimensions for a cloudwatch alarm
 *
 * @param api the APIGateway to test
 * @returns the dimensions for passing to CloudWatch alarms
 */
function getDimensions(api: ApiGateway) {
    return pulumi
        .all([api.id, api.name, api.stage])
        .apply(([id, name, stage]) => ({
            ...(isHttpApi(api)
                ? {
                      ApiId: id,
                  }
                : {
                      ApiName: name,
                  }),
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
            apiGateway: ApiGateway
            /**
             * Alert if the 5xx error rate exceeds this
             * (default: 2 percent)
             */
            errorRate5xxPercent?: pulumi.Input<number>
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

        const metricName = isHttpApi(args.apiGateway) ? '5xx' : '5XXError'
        const dimensions = getDimensions(args.apiGateway)
        const thresholdPercent = args.errorRate5xxPercent ?? 2
        const threshold = pulumi
            .output(thresholdPercent)
            .apply((percent) => percent / 100)
        const resourceName = `${name}-5xx-rate`

        new aws.cloudwatch.MetricAlarm(
            resourceName,
            {
                evaluationPeriods: 2,
                datapointsToAlarm: 2,
                comparisonOperator: 'GreaterThanOrEqualToThreshold',
                namespace,
                metricName,
                dimensions,
                threshold,
                statistic: 'Average',
                alarmDescription: pulumi.interpolate`threshold: 5xx rate >= ${thresholdPercent}%: ${
                    args.apiGateway.name ?? args.apiGateway.id
                }`,
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
            apiGateway: ApiGateway
            /**
             * Alert if the 4xx error rate exceeds this
             * (default: 2 percent)
             */
            errorRate4xxPercent?: pulumi.Input<number>
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

        const metricName = isHttpApi(args.apiGateway) ? '4xx' : '4XXError'
        const dimensions = getDimensions(args.apiGateway)
        const thresholdPercent = args.errorRate4xxPercent ?? 50
        const threshold = pulumi
            .output(thresholdPercent)
            .apply((percent) => percent / 100)
        const resourceName = `${name}-4xx-rate`

        new aws.cloudwatch.MetricAlarm(
            resourceName,
            {
                evaluationPeriods: 2,
                datapointsToAlarm: 2,
                comparisonOperator: 'GreaterThanOrEqualToThreshold',
                namespace,
                metricName,
                dimensions,
                threshold,
                statistic: 'Average',
                alarmDescription: pulumi.interpolate`threshold: 4xx rate >= ${thresholdPercent}%: ${
                    args.apiGateway.name ?? args.apiGateway.id
                }`,
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
            apiGateway: ApiGateway
            /**
             * The number of standard deviations to use for the anomaly detection.
             *
             * Default: 5
             */
            stdDeviations?: pulumi.Input<number>
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

        new aws.cloudwatch.MetricAlarm(
            resourceName,
            {
                period: 60,
                evaluationPeriods: 2,
                datapointsToAlarm: 2,
                comparisonOperator: 'GreaterThanOrEqualToThreshold',
                metricQueries: [
                    {
                        id: 'e1',
                        expression: pulumi.interpolate`ANOMALY_DETECTION_BAND(m1, ${args.stdDeviations})`,
                        label: `${metricName} (expected)`,
                        returnData: true,
                    },
                    {
                        id: 'm1',
                        returnData: false,
                        metric: {
                            metricName,
                            dimensions,
                            namespace,
                            stat: 'Average',
                            period: 60,
                        },
                    },
                ],
                thresholdMetricId: 'e1',
                alarmDescription: pulumi.interpolate`anomaly: ${metricName} (${
                    args.stdDeviations
                } standard deviations): ${
                    args.apiGateway.name ?? args.apiGateway.id
                }`,
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
