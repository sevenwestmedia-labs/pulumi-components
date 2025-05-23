import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'
import { RandomString } from '@pulumi/random'
import mime from 'mime'
import fs from 'fs'
import path from 'path'
import { crawlDirectory } from './crawl-directory'
import { Unwrap } from '@pulumi/pulumi'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts'

interface ThrowIntoS3ResourceInputs {
    resourceId: pulumi.Output<string>
    sourceFolder: pulumi.Output<string>
    targetBucket: pulumi.Output<string>
    awsRegion: string
    assumeRole?: pulumi.Output<string>
}

type ThrowIntoS3Inputs = Unwrap<ThrowIntoS3ResourceInputs>

class ThrowIntoS3Resource extends pulumi.dynamic.Resource {
    constructor(
        name: string,
        args: ThrowIntoS3ResourceInputs,
        opts?: pulumi.CustomResourceOptions,
    ) {
        const provider: pulumi.dynamic.ResourceProvider = {
            async create(inputs: ThrowIntoS3Inputs) {
                await putFilesIntoS3(
                    inputs.sourceFolder,
                    inputs.targetBucket,
                    inputs.awsRegion,
                    inputs.assumeRole,
                )

                return { id: inputs.resourceId }
            },

            async update(
                _id: string,
                _oldInputs: ThrowIntoS3Inputs,
                newInputs: ThrowIntoS3Inputs,
            ) {
                await putFilesIntoS3(
                    newInputs.sourceFolder,
                    newInputs.targetBucket,
                    newInputs.awsRegion,
                    newInputs.assumeRole,
                )

                return {}
            },

            async diff() {
                return { changes: true }
            },
        }

        super(provider, name, args, opts)
    }
}

/**
 * Throwing files into S3 => putting the files into S3 and never deleting them,
 * these are unmanaged by Pulumi, so that old versions will persist and Pulumi
 * won't try to diff between the old and the new.
 */
export class ThrowIntoS3 extends pulumi.ComponentResource {
    constructor(
        name: string,
        args: Omit<ThrowIntoS3ResourceInputs, 'resourceId'>,
        opts?: pulumi.CustomResourceOptions,
    ) {
        super('ThrowIntoS3', name, { id: undefined }, opts)

        const id = new RandomString(
            `${name}-throw-into-s3-id`,
            {
                special: false,
                upper: false,
                length: 32,
            },
            {
                parent: this,
            },
        )

        new ThrowIntoS3Resource(
            `${name}-throw-into-s3-resource`,
            {
                ...args,
                resourceId: id.result,
            },
            { parent: this, dependsOn: [id] },
        )
    }
}

async function putFilesIntoS3(
    sourceFolder: string,
    targetBucket: string,
    awsRegion: string,
    assumeRole?: string,
) {
    const s3 = new S3Client({
        region: awsRegion,
        credentials: assumeRole
            ? await (async () => {
                  const stsClient = new STSClient({ region: awsRegion })
                  const assumeRoleResponse = await stsClient.send(
                      new AssumeRoleCommand({
                          RoleArn: assumeRole,
                          RoleSessionName: 'ThrowFilesInS3',
                      }),
                  )
                  return {
                      accessKeyId:
                          assumeRoleResponse.Credentials?.AccessKeyId || '',
                      secretAccessKey:
                          assumeRoleResponse.Credentials?.SecretAccessKey || '',
                      sessionToken:
                          assumeRoleResponse.Credentials?.SessionToken || '',
                  }
              })()
            : undefined,
    })

    await crawlDirectory(sourceFolder, async (filePath: string) => {
        let relativeFilePath = filePath.replace(sourceFolder + '/', '')

        const cacheControl = getCacheControl(relativeFilePath)

        let nonIndexPage = false
        if (
            relativeFilePath.endsWith('.html') &&
            !relativeFilePath.endsWith('index.html') &&
            !relativeFilePath.endsWith('app.html')
        ) {
            relativeFilePath = relativeFilePath.replace(/\.html$/, '')
            nonIndexPage = true
        }
        const relativeToCwd = path.relative(process.cwd(), filePath)

        try {
            const data = await new Promise<Buffer>((resolve, reject) => {
                fs.readFile(`./${relativeToCwd}`, (err, data) => {
                    if (err) {
                        reject(
                            new Error(
                                `Error reading file ${relativeToCwd}: ${err.message}`,
                            ),
                        )
                    } else {
                        resolve(data)
                    }
                })
            })

            const args = {
                CacheControl: cacheControl,
                Bucket: targetBucket,
                Key: relativeFilePath,
                ContentType: mime.getType(`./${relativeToCwd}`) || undefined,
            }

            let putFile = new PutObjectCommand({
                ...args,
                Body: data,
            })

            if (nonIndexPage) {
                putFile = new PutObjectCommand({
                    Bucket: targetBucket,
                    Key: relativeFilePath,

                    ContentType:
                        mime.getType(`./${relativeToCwd}`) || undefined,

                    Body: data,
                })
            }

            const putObjectOutput = await s3.send(putFile)
            return putObjectOutput
        } catch (err: any) {
            console.error('Failed to throw files to S3:', err.message)
            throw new Error('Failed to throw files to S3')
        }
    })
}
/**
 * Do not cache the HTML files or config file, this is so that they can be uploaded
 * with as plain files that point to hashed chunks, e.g.
 *
 * index.html -> main.chunk.29319239123.js
 *
 * This means that the small index file will always point to the latest source code,
 * but the code itself will be cached.
 */
function getCacheControl(fileName: string) {
    if (fileName === 'config.js' || fileName.endsWith('html')) {
        return 'no-store'
    }
    return 'public,max-age=31536000,immutable'
}
