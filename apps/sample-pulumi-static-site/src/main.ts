import { StaticSite } from '@wanews/pulumi-static-site'

new StaticSite('static-site-example.com', {
    primaryDomain: 'example.com',
    primaryHostname: 'example.com',
    getTags: (name) => ({
        Name: name,
        Environment: 'dev',
        CreatedBy: 'pulumi',
    }),
})

new StaticSite('sub-domain-static-site-example.com', {
    primaryDomain: 'example.com',
    primaryHostname: 'sub.example.com',
    getTags: (name) => ({
        Name: name,
        Environment: 'dev',
        CreatedBy: 'pulumi',
    }),
})
