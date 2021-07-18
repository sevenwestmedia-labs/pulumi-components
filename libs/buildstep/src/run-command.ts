import * as pulumi from '@pulumi/pulumi'

import * as child_process from 'child_process'
import * as readline from 'readline'

function logEphemeral(message: string, logResource: pulumi.Resource) {
    pulumi.log.info(
        message,
        logResource,
        /*streamId:*/ undefined,
        /*ephemeral:*/ true,
    )
}

function logDebug(message: string, logResource: pulumi.Resource) {
    pulumi.log.debug(
        message,
        logResource,
        /*streamId:*/ undefined,
        /*ephemeral:*/ true,
    )
}

interface CommandResult {
    code: number
    stdout: string
}

function getCommandLineMessage(
    cmd: string,
    args: string[],
    reportFullCommandLine: boolean,
    env?: Record<string, string>,
) {
    const argString = reportFullCommandLine ? args.join(' ') : args[0]
    const envString =
        env === undefined
            ? ''
            : Object.keys(env)
                  .map((k) => `${k}=${env[k]}`)
                  .join(' ')
    return `'${envString} ${cmd} ${argString}'`
}

function getFailureMessage(
    cmd: string,
    args: string[],
    reportFullCommandLine: boolean,
    code: number,
    env?: Record<string, string>,
) {
    return `${getCommandLineMessage(
        cmd,
        args,
        reportFullCommandLine,
        env,
    )} failed with exit code ${code}`
}

// [reportFullCommandLine] is used to determine if the full command line should be reported
// when an error happens.  In general reporting the full command line is fine.  But it should be set
// to false if it might contain sensitive information (like a username/password)
export async function runCommandThatMustSucceed({
    cmd,
    args,
    logResource,
    reportFullCommandLine = true,
    stdin,
    env,
    cwd,
    reportErrorAsWarning = false,
}: {
    cmd: string
    args: string[]
    logResource: pulumi.Resource
    reportFullCommandLine?: boolean
    stdin?: string
    env?: { [name: string]: string }
    cwd?: string
    reportErrorAsWarning?: boolean
}): Promise<string> {
    const { code, stdout } = await runCommandThatCanFail({
        cmd,
        args,
        logResource,
        reportFullCommandLine,
        reportErrorAsWarning,
        stdin,
        env,
        cwd,
    })

    if (code !== 0) {
        // Fail the entire build and push.  This includes the full output of the command so that at
        // the end the user can review the full docker message about what the problem was.
        //
        // Note: a message about the command failing will have already been ephemerally reported to
        // the status column.
        throw new pulumi.ResourceError(
            `${getFailureMessage(
                cmd,
                args,
                reportFullCommandLine,
                code,
            )}\n${stdout}`,
            logResource,
        )
    }

    return stdout
}

// Runs a CLI command in a child process, returning a promise for the process's exit. Both stdout
// and stderr are redirected to process.stdout and process.stder by default.
//
// If the [stdin] argument is defined, it's contents are piped into stdin for the child process.
//
// [logResource] is used to specify the resource to associate command output with. Stderr messages
// are always sent (since they may contain important information about something that's gone wrong).
// Stdout messages will be logged ephemerally to this resource.  This lets the user know there is
// progress, without having that dumped on them at the end.  If an error occurs though, the stdout
// content will be printed.
//
// The promise returned by this function should never reach the rejected state.  Even if the
// underlying spawned command has a problem, this will result in a resolved promise with the
// [CommandResult.code] value set to a non-zero value.
export async function runCommandThatCanFail({
    cmd,
    args,
    logResource,
    reportFullCommandLine,
    reportErrorAsWarning,
    stdin,
    env,
    cwd,
}: {
    cmd: string
    args: string[]
    logResource: pulumi.Resource
    reportFullCommandLine: boolean
    reportErrorAsWarning: boolean
    stdin?: string
    env?: { [name: string]: string }
    cwd?: string
}): Promise<CommandResult> {
    // Let the user ephemerally know the command we're going to execute.
    logDebug(
        `Executing ${getCommandLineMessage(
            cmd,
            args,
            reportFullCommandLine,
            env,
        )}`,
        logResource,
    )

    // Generate a unique stream-ID that we'll associate all the docker output with. This will allow
    // each spawned CLI command's output to associated with 'resource' and also streamed to the UI
    // in pieces so that it can be displayed live.  The stream-ID is so that the UI knows these
    // messages are all related and should be considered as one large message (just one that was
    // sent over in chunks).
    //
    // We use Math.random here in case our package is loaded multiple times in memory (i.e. because
    // different downstream dependencies depend on different versions of us).  By being random we
    // effectively make it completely unlikely that any two cli outputs could map to the same stream
    // id.
    //
    // Pick a reasonably distributed number between 0 and 2^30.  This will fit as an int32
    // which the grpc layer needs.
    const streamID = Math.floor(Math.random() * (1 << 30))

    return new Promise<CommandResult>((resolve) => {
        const osEnv = Object.assign({}, process.env)
        env = Object.assign(osEnv, env)
        const p = child_process.spawn(cmd, args, { env, cwd })

        // We store the results from stdout in memory and will return them as a string.
        let stdOutChunks: Buffer[] = []
        let stdErrChunks: Buffer[] = []
        p.stdout.on('data', (chunk: Buffer) => stdOutChunks.push(chunk))
        p.stderr.on('data', (chunk: Buffer) => stdErrChunks.push(chunk))

        // Also report all stdout messages as ephemeral messages.  That way they show up in the
        // info bar as they're happening.  But they do not overwhelm the user as the end
        // of the run.
        const rl = readline.createInterface({ input: p.stdout })
        rl.on('line', (line) => logEphemeral(line, logResource))

        // In both cases of 'error' or 'close' we execute the same 'finish up' codepath. This
        // codepath effectively flushes (and clears) the stdout and stderr streams we've been
        // buffering.  We'll also return the stdout stream to the caller, and we'll appropriately
        // return if we failed or not depending on if we got an actual exception, or if the spawned
        // process returned a non-0 error code.
        //
        // Effectively, we are ensuring that we never reject the promise we're returning.  It will
        // always 'resolve', and we will always have the behaviors that:
        //
        // 1. all stderr information is flushed (including the message of an exception if we got one).
        // 2. an ephemeral info message is printed stating if there were any exceptions/status-codes
        // 3. all stdout information is returned to the caller.
        // 4. the caller gets a 0-code on success, and a non-0-code for either an exception or an
        //    error status code.
        //
        // The caller can then decide what to do with this.  Nearly all callers will will be coming
        // through runCommandThatMustSucceed, which will see a non-0 code and will then throw with
        // a full message.

        p.on('error', (err) => {
            // received some sort of real error.  push the message of that error to our stdErr
            // stream (so it will get reported) and then move this promise to the resolved, 1-code
            // state to indicate failure.
            stdErrChunks.push(Buffer.from(err.message))
            finish(/*code: */ 1)
        })

        p.on('close', (code) => {
            finish(code ?? -1)
        })

        if (stdin) {
            p.stdin.end(stdin)
        }

        return

        // Moves our promise to the resolved state, after appropriately dealing with any errors
        // we've encountered.  Importantly, this function can be called multiple times safely.
        // It will clean up after itself so that multiple calls don't end up causing any issues.

        function finish(code: number) {
            // Collapse our stored stdout/stderr messages into single strings.
            const stderr = Buffer.concat(stdErrChunks).toString()
            const stdout = Buffer.concat(stdOutChunks).toString()

            // Clear out our output buffers.  This ensures that if we get called again, we don't
            // double print these messages.
            stdOutChunks = []
            stdErrChunks = []

            // If we got any stderr messages, report them as an error/warning depending on the
            // result of the operation.
            if (stderr.length > 0) {
                if (code && !reportErrorAsWarning) {
                    // Command returned non-zero code.  Treat these stderr messages as an error.
                    pulumi.log.error(stderr, logResource, streamID)
                } else {
                    // command succeeded.  These were just warning.
                    pulumi.log.warn(stderr, logResource, streamID)
                }
            }

            // If the command failed report an ephemeral message indicating which command it was.
            // That way the user can immediately see something went wrong in the info bar.  The
            // caller (normally runCommandThatMustSucceed) can choose to also report this
            // non-ephemerally.
            if (code) {
                logEphemeral(
                    getFailureMessage(cmd, args, reportFullCommandLine, code),
                    logResource,
                )
            }

            resolve({ code, stdout })
        }
    })
}
