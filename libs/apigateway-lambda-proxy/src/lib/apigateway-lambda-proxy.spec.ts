import fs from 'fs'
import cuid from 'cuid'
import pulumi from '@pulumi/pulumi'
import { LocalWorkspace, OutputMap, Stack } from '@pulumi/pulumi/x/automation'
import { dir, DirectoryResult } from 'tmp-promise'
import { ApiGatewayLambdaProxy } from './apigateway-lambda-proxy'
import fetch from 'node-fetch'
import debug from 'debug'

// To get pulumi outputs from tests set DEBUG=pulumi
const pulumiDebug = debug('pulumi')
jest.setTimeout(5 * 60 * 1000) /* 5 mins */

let tmpPath: DirectoryResult
let workspace: LocalWorkspace
let stackname: string
let stack: Stack
let outputs: OutputMap

beforeAll(async () => {
    tmpPath = await dir()
    pulumiDebug('Temp path: %s', tmpPath.path)
    const integrationTestId = cuid.slug()
    stackname = `pulumi-libs.${integrationTestId}`
    process.env.PULUMI_CONFIG_PASSPHRASE = 'integration-test'
    process.env.PULUMI_DEBUG_PROMISE_LEAKS = 'true'

    workspace = await LocalWorkspace.create({
        workDir: tmpPath.path,
        projectSettings: {
            name: 'TestProject',
            runtime: 'nodejs',
            backend: {
                url: `file://./state`,
            },
        },
    })
    fs.mkdirSync(`${tmpPath.path}/state`)

    workspace.program = async function pulumiTestProgram() {
        const code = pulumi.output(
            new pulumi.asset.AssetArchive({
                ['index.js']: new pulumi.asset.StringAsset(`exports.handler = async function(event) {
    return {
        headers: {
            'Content-Type': 'application/json',
        },
        statusCode: '200',
        body: JSON.stringify({ path: event.path }),
    }
}`),
            }),
        )

        const proxy = new ApiGatewayLambdaProxy(
            `test-proxy-${integrationTestId}`,
            {
                getTags(name) {
                    return { name }
                },
                lambdaOptions: {
                    memorySize: 512,
                    handler: 'index.handler',
                    timeout: 5,
                    code,
                },
            },
        )

        return {
            invokeUrl: proxy.invokeUrl,
            publicHostname: proxy.publicHostname,
            apiGatewayHostname: proxy.apiGatewayHostname,
        }
    }

    await workspace.createStack(stackname)
    await workspace.setAllConfig(stackname, {
        'aws:region': { value: 'ap-southeast-2' },
    })
    if (process.env.AWS_PROFILE) {
        await workspace.setConfig(stackname, 'aws:profile', {
            value: process.env.AWS_PROFILE,
        })
    }

    stack = await Stack.select(stackname, workspace)
    try {
        const stackUpResult = await stack.up({
            onOutput: pulumiDebug,
        })
        outputs = stackUpResult.outputs
        pulumiDebug('Stack created: %O', {
            summary: stackUpResult.summary,
            outputs: stackUpResult.outputs,
        })
    } catch (err) {
        console.error({ err }, 'Stack creation failed')
    }
})

it('can deploy lambda proxy', async () => {
    const response = await fetch(`${outputs.invokeUrl.value}/test/path`)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ path: `/test/path` })
})

afterAll(async () => {
    if (stack) {
        await stack.destroy({
            onOutput: pulumiDebug,
        })
    }
    await workspace.removeStack(stackname)
    fs.rmdirSync(tmpPath.path, { recursive: true })
})
