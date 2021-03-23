import {
    Tree,
    formatFiles,
    installPackagesTask,
    updateJson,
    writeJson,
} from '@nrwl/devkit'
import { libraryGenerator } from '@nrwl/workspace/generators'

export default async function (host: Tree, schema: any) {
    await libraryGenerator(host, {
        name: schema.name,
        unitTestRunner: 'jest',
        testEnvironment: 'node',
        importPath: `@wanews/pulumi-${schema.name}`,
        linter: 'eslint',
        strict: true,
        babelJest: true,
    })

    updateJson(host, `./libs/${schema.name}/.eslintrc.json`, (eslint) => {
        delete eslint.overrides[0].parserOptions

        return eslint
    })

    host.delete(`./libs/${schema.name}/tsconfig.json`)
    host.delete(`./libs/${schema.name}/tsconfig.lib.json`)
    createTypeScriptConfig(host, schema)

    createProjectPackageJson(host, schema)

    // Add into root typescript project references config
    updateJson(host, `./tsconfig.json`, (tsconfig) => {
        tsconfig.references.push({
            path: `./libs/${schema.name}`,
        })

        return tsconfig
    })

    await formatFiles(host)
    return () => {
        installPackagesTask(host)
    }
}
function createProjectPackageJson(host: Tree, schema: any) {
    writeJson(host, `./libs/${schema.name}/package.json`, {
        name: `@wanews/pulumi-${schema.name}`,
        version: '0.0.1',
        main: 'dist/cjs/index.js',
        module: 'dist/esm/index.js',
        author: 'Seven West Media WA',
        license: 'MIT',
        repository: {
            type: 'git',
            url:
                'git+https://github.com/sevenwestmedia-labs/pulumi-components.git',
        },
        keywords: ['Pulumi'],
        bugs: {
            url:
                'https://github.com/sevenwestmedia-labs/pulumi-components/issues',
        },
        homepage: `https://github.com/sevenwestmedia-labs/pulumi-components/tree/master/libs/${schema.name}#readme`,
        peerDependencies: {
            tslib: '^2.1.0',
        },
    })
}

function createTypeScriptConfig(host: Tree, schema: any) {
    writeJson(host, `./libs/${schema.name}/tsconfig.json`, {
        extends: '../../tsconfig.settings.json',
        compilerOptions: {
            outDir: './dist/esm',
            rootDir: './src',
            types: ['jest', 'node'],
            forceConsistentCasingInFileNames: true,
            strict: true,
            noImplicitReturns: true,
            noFallthroughCasesInSwitch: true,
        },
        include: ['src/**/*.ts', 'src/**/*.spec.ts'],
        references: [
            {
                path: './tsconfig.cjs.json',
            },
        ],
    })
    writeJson(host, `./libs/${schema.name}/tsconfig.cjs.json`, {
        extends: './tsconfig.json',
        compilerOptions: {
            outDir: './dist/cjs',
            module: 'CommonJS',
        },
    })
}
