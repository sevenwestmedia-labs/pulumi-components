import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'
import { LambdaFunction } from '@wanews/pulumi-lambda'

export class ApiGatewayLambdaProxy extends pulumi.ComponentResource {
    stage: aws.apigatewayv2.Stage
    apiGateway: aws.apigatewayv2.Api
    invokeUrl: pulumi.Output<string>
    publicHostname: pulumi.Output<string>
    apiGatewayDomainName: aws.apigatewayv2.DomainName | undefined
    apiGatewayHostname: pulumi.Output<string>
    lambdaExecutionRole: pulumi.Output<aws.iam.Role>
    lambdaFunction: LambdaFunction

    constructor(
        name: string,
        {
            apiGatewayCertificateArn,
            hostname,

            lambdaOptions,
            executionRoleName,
            executionRole,
            apiGatewayOptions = {},
            getTags,

            apiGatewayAccessLoggingEnabled,

            integrationOptions,
        }: {
            /** The custom hostname to map to the API Gateway */
            hostname?: pulumi.Input<string>
            /** If hostname is set must be specified */
            apiGatewayCertificateArn?: pulumi.Input<string>

            /**
             * Lambda options
             * @see https://www.pulumi.com/docs/reference/pkg/aws/lambda/function/#inputs
             */
            lambdaOptions: Omit<aws.lambda.FunctionArgs, 'role'>

            apiGatewayOptions?: Omit<
                aws.apigatewayv2.ApiArgs,
                'protocolType' | 'tags'
            >

            /**
             * Role must already exist, otherwise preview will fail
             *
             * If you are creating the role in the same program, use executionRole
             */
            executionRoleName?: string
            executionRole?: aws.iam.Role

            /** Callback to create tags for the resources created */
            getTags: (name: string) => {
                [key: string]: pulumi.Input<string>
            }

            /**
             * Enables API gateway logging
             *
             * WARNING: If your AWS account has a number of API gateways the managed resource policy may grow too big
             * and deployments start failing.
             */
            apiGatewayAccessLoggingEnabled?: boolean

            /**
             * Allow overriding the integration options for the API Gateway
             *
             * Example: pass the accept header to the lambda function
             * ```typescript
             * integrationOptions: {
             *   requestParameters: {
             *     'append:header.accept': '$request.header.accept',
             *   },
             * }
             * ```
             */
            integrationOptions?: Omit<
                aws.apigatewayv2.IntegrationArgs,
                'apiId' | 'integrationType' | 'integrationUri'
            >
        },
        opts?: pulumi.ComponentResourceOptions & {
            /**
             * Allow an existing aws.apigatewayv2.Api resource to be migrated
             * into this module without being deleted & recreated. More info:
             * https://www.pulumi.com/docs/intro/concepts/resources/#aliases
             */
            apiGatewayAliases?: pulumi.ComponentResourceOptions['aliases']

            /**
             * Allow an existing aws.apigatewayv2.DomainName resource to be migrated
             * into this module without being deleted & recreated. More info:
             * https://www.pulumi.com/docs/intro/concepts/resources/#aliases
             */
            domainNameAliases?: pulumi.ComponentResourceOptions['aliases']

            /**
             * Allow an existing aws.apigatewayv2.ApiMapping resource to be migrated
             * into this module without being deleted & recreated. More info:
             * https://www.pulumi.com/docs/intro/concepts/resources/#aliases
             */
            apiMappingAliases?: pulumi.ComponentResourceOptions['aliases']
        },
    ) {
        super('lambda-apigateway-proxy', name, {}, opts)

        this.apiGateway = new aws.apigatewayv2.Api(
            `${name}-gateway`,
            {
                ...apiGatewayOptions,
                protocolType: 'HTTP',
                tags: getTags(name),
            },
            { parent: this, aliases: opts?.apiGatewayAliases },
        )

        this.invokeUrl = hostname
            ? pulumi.interpolate`https://${hostname}`
            : pulumi.interpolate`${this.apiGateway.apiEndpoint}`

        const region = pulumi.output(aws.getRegion({}, { parent: this }))
        this.apiGatewayHostname = pulumi.interpolate`${this.apiGateway.id}.execute-api.${region.name}.amazonaws.com`

        this.publicHostname = hostname
            ? pulumi.output(hostname)
            : this.apiGatewayHostname

        this.lambdaFunction = new LambdaFunction(
            name,
            {
                getTags,
                lambdaOptions,
                executionRole,
                executionRoleName,
            },
            { parent: this },
        )
        this.lambdaExecutionRole = this.lambdaFunction.executionRole

        new aws.lambda.Permission(
            `${name}-permission`,
            {
                action: 'lambda:InvokeFunction',
                principal: 'apigateway.amazonaws.com',
                function: this.lambdaFunction.function,
                sourceArn: pulumi.interpolate`${this.apiGateway.executionArn}/*/*`,
            },
            {
                dependsOn: [this.apiGateway, this.lambdaFunction.function],
                parent: this,
            },
        )

        const integration = new aws.apigatewayv2.Integration(
            `${name}-integration`,
            {
                apiId: this.apiGateway.id,
                integrationType: 'AWS_PROXY',
                integrationUri: this.lambdaFunction.function.arn,
                ...integrationOptions,
            },
            { parent: this },
        )

        const route = new aws.apigatewayv2.Route(
            `${name}-route`,
            {
                apiId: this.apiGateway.id,
                routeKey: 'ANY /{proxy+}',
                target: pulumi.interpolate`integrations/${integration.id}`,
            },
            { parent: this },
        )

        const apiGatewayLogGroup = apiGatewayAccessLoggingEnabled
            ? new aws.cloudwatch.LogGroup(
                  `${name}-api-logs`,
                  {
                      name: pulumi.interpolate`/aws/lambda/apigateway-${this.lambdaFunction.function.name}`,
                      retentionInDays: 14,
                  },
                  {
                      parent: this,
                  },
              )
            : undefined

        this.stage = new aws.apigatewayv2.Stage(
            `${name}-gateway-stage`,
            {
                apiId: this.apiGateway.id,
                name: '$default',
                routeSettings: [],
                autoDeploy: true,
                accessLogSettings: apiGatewayLogGroup
                    ? {
                          destinationArn: apiGatewayLogGroup.arn,
                          format: JSON.stringify({
                              requestId: '$context.requestId',
                              ip: '$context.identity.sourceIp',
                              requestTime: '$context.requestTime',
                              httpMethod: '$context.httpMethod',
                              routeKey: '$context.routeKey',
                              status: '$context.status',
                              protocol: '$context.protocol',
                              responseLength: '$context.responseLength',
                              error: '$context.error.message',
                              integrationError:
                                  '$context.integrationErrorMessage',
                          }),
                      }
                    : undefined,
            },
            { dependsOn: [route], parent: this },
        )

        if (hostname) {
            if (!apiGatewayCertificateArn) {
                throw new pulumi.ResourceError(
                    'Must specify apiGatewayCertificateArn if desiredHostname is set',
                    this,
                )
            }
            this.apiGatewayDomainName = new aws.apigatewayv2.DomainName(
                `${name}-apigateway-domain`,
                {
                    domainName: hostname,
                    domainNameConfiguration: {
                        certificateArn: apiGatewayCertificateArn,
                        endpointType: 'REGIONAL',
                        securityPolicy: 'TLS_1_2',
                    },
                    tags: getTags(name),
                },
                { parent: this, aliases: opts?.domainNameAliases },
            )

            new aws.apigatewayv2.ApiMapping(
                `${name}-api-mapping`,
                {
                    apiId: this.apiGateway.id,
                    domainName: this.apiGatewayDomainName.id,
                    stage: this.stage.name,
                },
                { parent: this, aliases: opts?.apiMappingAliases },
            )
        }

        this.registerOutputs({
            invokeUrl: this.invokeUrl,
            publicHostname: this.publicHostname,
            apiGatewayHostname: this.apiGatewayHostname,
        })
    }
}
