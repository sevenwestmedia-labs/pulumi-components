import { StaticSite } from '@wanews/pulumi-static-site'

new StaticSite('static-site-example.com', {
    primaryDomain: 'example.com',
    getTags: (name) => ({
        Name: name,
        Environment: 'dev',
        CreatedBy: 'pulumi',
    }),
})
