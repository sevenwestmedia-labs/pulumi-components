import * as pagerduty from '@pulumi/pagerduty'
import * as pulumi from '@pulumi/pulumi'

const config = new pulumi.Config('wanews:pagerduty')
const scheduleName = config.get('schedule') ?? 'Weekly DevOps'
const teamName = config.get('team') ?? 'Production Engineering'
const escalationPolicyName = config.get('escalation-policy') ?? 'Default'

export function getPagerDutyConfig() {
    return {
        defaultSchedule: pulumi.output(
            pagerduty
                .getSchedule({ name: scheduleName }, { async: true })
                .catch((err) =>
                    pulumi.log.error(
                        `Unable to find default pagerduty schedule: ${err}`,
                    ),
                ),
        ),
        defaultTeam: pulumi.output(
            pagerduty
                .getTeam({ name: teamName }, { async: true })
                .catch((err) =>
                    pulumi.log.error(
                        `Unable to find default pagerduty team: ${err}`,
                    ),
                ),
        ),
        defaultEscalationPolicy: pulumi.output(
            pagerduty
                .getEscalationPolicy(
                    { name: escalationPolicyName },
                    { async: true },
                )
                .catch((err) =>
                    pulumi.log.error(
                        `Unable to find default pagerduty escalation policy: ${err}`,
                    ),
                ),
        ),
    }
}
