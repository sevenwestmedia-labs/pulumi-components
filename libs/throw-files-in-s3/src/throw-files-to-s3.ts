import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'
import { RandomString } from '@pulumi/random'
import * as sdk from 'aws-sdk'
import mime from 'mime'
import fs from 'fs'
import path from 'path'
import { crawlDirectory } from './crawl-directory'
import { Unwrap } from '@pulumi/pulumi'

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
    const sentFiles: Array<Promise<string>> = []
    const s3 = new sdk.S3({
        region: awsRegion,
        credentials: assumeRole
            ? new aws.sdk.TemporaryCredentials({
                  RoleSessionName: 'ThrowFilesInS3',
                  RoleArn: assumeRole,
              })
            : undefined,
    })

    crawlDirectory(sourceFolder, (filePath: string) => {
        let relativeFilePath = filePath.replace(sourceFolder + '/', '')

        const cacheControl = getCacheControl(relativeFilePath)

        /**
         * When uploading a HTML page to the S3 bucket, we need to replace the .html
         * prefix to support linking to pages by their page name, e.g. /about. We also
         * add an index file for these HTML files in a folder to support linking to them
         * with a trailing slash. So any NextJS page.ts file becomes a page (with content
         * type of HTML) and /page/index.html.
         */
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

        sentFiles.push(
            new Promise((resolve, reject) => {
                fs.readFile(`./${relativeToCwd}`, (err, data) => {
                    if (err) {
                        reject(err)
                    }

                    const args = {
                        CacheControl: cacheControl,
                        Bucket: targetBucket,
                        Key: relativeFilePath,
                        ContentType:
                            mime.getType(`./${relativeToCwd}`) || undefined,
                    }

                    let putFile = s3
                        .putObject({ ...args, Body: data })
                        .promise()

                    if (nonIndexPage) {
                        putFile = putFile.then(() => {
                            return s3
                                .putObject({
                                    Bucket: targetBucket,
                                    Key: relativeFilePath,
                                    ContentType:
                                        mime.getType(`./${relativeToCwd}`) ||
                                        undefined,
                                    Body: data,
                                })
                                .promise()
                        })
                    }

                    putFile
                        .then(() => resolve(filePath))
                        .catch(() => reject(`Could not send ${filePath} to S3`))
                })
            }),
        )
    })

    try {
        await Promise.all(sentFiles)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
        console.log('Failed to throw files to S3', err.message)
        throw new Error('Failed to throw files to S3')
    }
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
