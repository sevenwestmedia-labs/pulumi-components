import * as pulumi from '@pulumi/pulumi'
import { runCommandThatMustSucceed } from './run-command'

export interface BuildStepArgs {
    /**
     * The command to run
     */
    command: pulumi.Input<string>
    /**
     * The command arguments
     */
    args: pulumi.Input<string[]>

    /**
     * The cwd of the command
     */
    cwd?: pulumi.Input<string>

    /**
     * The env of the command
     */
    env?: {
        [key: string]: pulumi.Input<string>
    }
}

export class BuildStep extends pulumi.ComponentResource {
    public buildStdOut: pulumi.Output<string>
    public done: pulumi.Output<boolean>

    constructor(
        name: string,
        args: BuildStepArgs,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('build-step', name, {}, opts)

        const buildStdOut = pulumi.output(args).apply(async (buildArgs) => {
            // Only run during preview step
            if (
                pulumi.runtime.isDryRun() &&
                !pulumi.runtime.isTestModeEnabled()
            ) {
                const stdOut = await runCommandThatMustSucceed({
                    cmd: buildArgs.command,
                    args: buildArgs.args,
                    cwd: buildArgs.cwd,
                    logResource: this,
                    reportFullCommandLine: true,
                    env: buildArgs.env,
                })

                return stdOut
            }

            return 'Build run during preview'
        })

        this.buildStdOut = buildStdOut
        this.done = buildStdOut.apply(() => true)

        this.registerOutputs({
            buildStdOut: this.buildStdOut,
            done: this.done,
        })
    }
}
