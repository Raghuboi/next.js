import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { run, useTempDir } from './utils'

describe('create-next-app Biome configuration', () => {
  let nextTgzFilename: string

  beforeAll(() => {
    if (!process.env.NEXT_TEST_PKG_PATHS) {
      throw new Error('This test needs to be run with `node run-tests.js`.')
    }

    const pkgPaths = new Map<string, string>(
      JSON.parse(process.env.NEXT_TEST_PKG_PATHS)
    )

    nextTgzFilename = pkgPaths.get('next')
  })

  it('should generate biome.json for TypeScript project with Biome', async () => {
    await useTempDir(async (cwd) => {
      const projectName = 'test-biome-ts'
      const { exitCode } = await run(
        [
          projectName,
          '--ts',
          '--biome',
          '--no-tailwind',
          '--no-src-dir',
          '--app',
          '--no-turbopack',
          '--no-import-alias',
          '--skip-install',
        ],
        nextTgzFilename,
        { cwd }
      )

      expect(exitCode).toBe(0)

      const projectDir = join(cwd, projectName)

      // Should have biome.json
      expect(existsSync(join(projectDir, 'biome.json'))).toBe(true)

      // Should NOT have eslint.config.mjs
      expect(existsSync(join(projectDir, 'eslint.config.mjs'))).toBe(false)

      // Check package.json scripts
      const packageJson = JSON.parse(
        await readFile(join(projectDir, 'package.json'), 'utf8')
      )
      expect(packageJson.scripts.lint).toBe('biome check .')
      expect(packageJson.scripts.format).toBe('biome format --write .')
      expect(packageJson.devDependencies['@biomejs/biome']).toBeTruthy()
      expect(packageJson.devDependencies.eslint).toBeFalsy()
      expect(packageJson.devDependencies['eslint-config-next']).toBeFalsy()
    })
  })

  it('should generate biome.json for JavaScript project with Biome', async () => {
    await useTempDir(async (cwd) => {
      const projectName = 'test-biome-js'
      const { exitCode } = await run(
        [
          projectName,
          '--js',
          '--biome',
          '--no-tailwind',
          '--no-src-dir',
          '--app',
          '--no-turbopack',
          '--no-import-alias',
          '--skip-install',
        ],
        nextTgzFilename,
        { cwd }
      )

      expect(exitCode).toBe(0)

      const projectDir = join(cwd, projectName)

      // Should have biome.json
      expect(existsSync(join(projectDir, 'biome.json'))).toBe(true)

      // Should NOT have eslint.config.mjs
      expect(existsSync(join(projectDir, 'eslint.config.mjs'))).toBe(false)

      // Check package.json scripts
      const packageJson = JSON.parse(
        await readFile(join(projectDir, 'package.json'), 'utf8')
      )
      expect(packageJson.scripts.lint).toBe('biome check .')
      expect(packageJson.scripts.format).toBe('biome format --write .')
      expect(packageJson.devDependencies['@biomejs/biome']).toBeTruthy()
      expect(packageJson.devDependencies.eslint).toBeFalsy()
    })
  })

  it('should check biome.json content is properly configured', async () => {
    await useTempDir(async (cwd) => {
      const projectName = 'test-biome-content'
      const { exitCode } = await run(
        [
          projectName,
          '--ts',
          '--biome',
          '--no-tailwind',
          '--no-src-dir',
          '--app',
          '--no-turbopack',
          '--no-import-alias',
          '--skip-install',
        ],
        nextTgzFilename,
        { cwd }
      )

      expect(exitCode).toBe(0)

      const projectDir = join(cwd, projectName)
      const biomeConfig = JSON.parse(
        await readFile(join(projectDir, 'biome.json'), 'utf8')
      )

      // Check key biome configuration properties
      expect(biomeConfig.vcs.enabled).toBe(true)
      expect(biomeConfig.formatter.enabled).toBe(true)
      expect(biomeConfig.linter.enabled).toBe(true)
      expect(biomeConfig.linter.rules.recommended).toBe(true)
      expect(biomeConfig.linter.domains.next).toBe('recommended')
      expect(biomeConfig.linter.domains.react).toBe('recommended')
    })
  })
})
