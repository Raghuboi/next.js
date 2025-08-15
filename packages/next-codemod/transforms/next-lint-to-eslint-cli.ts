import { readFileSync, writeFileSync, existsSync } from 'fs'
import path from 'path'
import { getPkgManager, installPackages } from '../lib/handle-package'

const ESLINT_CONFIG_TEMPLATE_TYPESCRIPT = `import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
`

const ESLINT_CONFIG_TEMPLATE_JAVASCRIPT = `import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
`

function detectTypeScript(projectRoot: string): boolean {
  return existsSync(path.join(projectRoot, 'tsconfig.json'))
}

function findExistingEslintConfig(projectRoot: string): {
  exists: boolean
  path?: string
  isFlat?: boolean
} {
  const flatConfigs = [
    'eslint.config.js',
    'eslint.config.mjs',
    'eslint.config.cjs',
    'eslint.config.ts',
    'eslint.config.mts',
    'eslint.config.cts',
  ]

  const legacyConfigs = [
    '.eslintrc.js',
    '.eslintrc.cjs',
    '.eslintrc.yaml',
    '.eslintrc.yml',
    '.eslintrc.json',
    '.eslintrc',
  ]

  // Check for flat configs first (preferred for v9+)
  for (const config of flatConfigs) {
    const configPath = path.join(projectRoot, config)
    if (existsSync(configPath)) {
      return { exists: true, path: configPath, isFlat: true }
    }
  }

  // Check for legacy configs
  for (const config of legacyConfigs) {
    const configPath = path.join(projectRoot, config)
    if (existsSync(configPath)) {
      return { exists: true, path: configPath, isFlat: false }
    }
  }

  return { exists: false }
}

function updateExistingFlatConfig(
  configPath: string,
  isTypeScript: boolean
): boolean {
  try {
    const configContent = readFileSync(configPath, 'utf8')

    // Check if Next.js configs are already imported
    if (
      configContent.includes('next/core-web-vitals') ||
      configContent.includes('next/typescript')
    ) {
      console.log('   Next.js ESLint configs already present in flat config')
      return false
    }

    // TypeScript config files need special handling
    if (
      configPath.endsWith('.ts') ||
      configPath.endsWith('.mts') ||
      configPath.endsWith('.cts')
    ) {
      console.log('   TypeScript config files require manual migration')
      console.log('   Please add the following to your config:')
      console.log('   - Import: import { FlatCompat } from "@eslint/eslintrc"')
      console.log(
        '   - Extend: ...compat.extends("next/core-web-vitals"' +
          (isTypeScript ? ', "next/typescript"' : '') +
          ')'
      )
      return false
    }

    // Check if the config exports an array
    const hasArrayExport =
      /export\s+default\s+\[/.test(configContent) ||
      /module\.exports\s*=\s*\[/.test(configContent) ||
      /const\s+\w+\s*:\s*.*\[\]?\s*=\s*\[/.test(configContent)

    if (!hasArrayExport) {
      console.log(
        '   Config does not export an array. Manual migration required.'
      )
      console.log(
        '   ESLint flat configs must export an array of configuration objects.'
      )
      return false
    }

    // Determine the import style (require vs import)
    const isCommonJS =
      configPath.endsWith('.cjs') ||
      (configPath.endsWith('.js') && configContent.includes('module.exports'))

    let updatedContent = configContent

    if (isCommonJS) {
      // Add FlatCompat import for CommonJS
      const compatImport = `const { FlatCompat } = require('@eslint/eslintrc')
const path = require('path')

const compat = new FlatCompat({
  baseDirectory: __dirname,
})\n\n`

      // Add import at the top if not already present
      if (!configContent.includes('FlatCompat')) {
        updatedContent = compatImport + updatedContent
      }

      // Find module.exports and insert Next.js configs
      const nextConfigs = isTypeScript
        ? `...compat.extends('next/core-web-vitals', 'next/typescript'),`
        : `...compat.extends('next/core-web-vitals'),`

      updatedContent = updatedContent.replace(
        /module\.exports\s*=\s*\[/,
        `module.exports = [\n  ${nextConfigs}\n`
      )
    } else {
      // ES modules
      const compatImport = `import { dirname } from "path"
import { fileURLToPath } from "url"
import { FlatCompat } from "@eslint/eslintrc"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})\n\n`

      // Add import at the top if not already present
      if (!configContent.includes('FlatCompat')) {
        const lastImportIndex = configContent.lastIndexOf('import ')
        if (lastImportIndex !== -1) {
          const nextLineIndex = configContent.indexOf('\n', lastImportIndex)
          updatedContent =
            configContent.slice(0, nextLineIndex + 1) +
            '\n' +
            compatImport +
            configContent.slice(nextLineIndex + 1)
        } else {
          updatedContent = compatImport + updatedContent
        }
      }

      // Find export default and insert Next.js configs
      const nextConfigs = isTypeScript
        ? `...compat.extends('next/core-web-vitals', 'next/typescript'),`
        : `...compat.extends('next/core-web-vitals'),`

      updatedContent = updatedContent.replace(
        /export\s+default\s+\[/,
        `export default [\n  ${nextConfigs}\n`
      )
    }

    if (updatedContent !== configContent) {
      writeFileSync(configPath, updatedContent)
      console.log(
        `   Updated ${path.basename(configPath)} with Next.js ESLint configs`
      )
      return true
    }

    return false
  } catch (error) {
    console.error(`   Error updating existing flat config: ${error}`)
    return false
  }
}

function updatePackageJsonScripts(packageJsonContent: string): {
  updated: boolean
  content: string
} {
  try {
    const packageJson = JSON.parse(packageJsonContent)
    let needsUpdate = false

    if (!packageJson.scripts) {
      packageJson.scripts = {}
    }

    // Process all scripts that contain "next lint"
    for (const scriptName in packageJson.scripts) {
      const scriptValue = packageJson.scripts[scriptName]
      if (
        typeof scriptValue === 'string' &&
        scriptValue.includes('next lint')
      ) {
        // Replace "next lint" with "eslint" and handle special arguments
        const updatedScript = scriptValue.replace(
          /\bnext\s+lint\b([^&|;]*)/gi,
          (match, args = '') => {
            // Check for redirects (2>, 1>, etc.) and preserve them
            let redirect = ''
            const redirectMatch = args.match(/\s+(\d*>[>&]?.*)$/)
            if (redirectMatch) {
              redirect = ' ' + redirectMatch[1]
              args = args.substring(0, redirectMatch.index)
            }

            // Parse arguments
            const argTokens = args.trim().split(/\s+/).filter(Boolean)
            const eslintArgs = []
            const paths = []

            for (let i = 0; i < argTokens.length; i++) {
              const token = argTokens[i]

              if (token === '--strict') {
                eslintArgs.push('--max-warnings', '0')
              } else if (token === '--dir' && i + 1 < argTokens.length) {
                paths.push(argTokens[++i])
              } else if (token === '--file' && i + 1 < argTokens.length) {
                paths.push(argTokens[++i])
              } else if (token === '--rulesdir' && i + 1 < argTokens.length) {
                // Skip rulesdir and its value
                i++
              } else if (token === '--ext' && i + 1 < argTokens.length) {
                // Skip ext and its value
                i++
              } else if (token.startsWith('--')) {
                // Keep other flags and their values
                eslintArgs.push(token)
                if (
                  i + 1 < argTokens.length &&
                  !argTokens[i + 1].startsWith('--')
                ) {
                  eslintArgs.push(argTokens[++i])
                }
              } else {
                // Positional arguments (paths)
                paths.push(token)
              }
            }

            // Build the result
            let result = 'eslint'
            if (eslintArgs.length > 0) {
              result += ' ' + eslintArgs.join(' ')
            }

            // Add paths or default to .
            if (paths.length > 0) {
              result += ' ' + paths.join(' ')
            } else {
              result += ' .'
            }

            // Add redirect if present
            result += redirect

            // Preserve trailing space if original had it and there's something after
            if (match.endsWith(' ') && !args.trim() && !redirect) {
              result += ' '
            } else if (!match.endsWith(' ') && args === '') {
              // Handle cases like "next lint&&" - no space before operator
              // The space is already included in the result
            }

            return result
          }
        )

        if (updatedScript !== scriptValue) {
          packageJson.scripts[scriptName] = updatedScript
          needsUpdate = true
          console.log(
            `   Updated script "${scriptName}": "${scriptValue}" → "${updatedScript}"`
          )

          // Note about unsupported flags
          if (scriptValue.includes('--rulesdir')) {
            console.log(`   Note: --rulesdir is not supported in ESLint v9`)
          }
          if (scriptValue.includes('--ext')) {
            console.log(`   Note: --ext is not needed in ESLint v9 flat config`)
          }
        }
      }
    }

    // Ensure required devDependencies exist
    if (!packageJson.devDependencies) {
      packageJson.devDependencies = {}
    }

    // Check if eslint exists in either dependencies or devDependencies
    if (
      !packageJson.devDependencies.eslint &&
      !packageJson.dependencies?.eslint
    ) {
      packageJson.devDependencies.eslint = '^9'
      needsUpdate = true
    }

    // Check if eslint-config-next exists in either dependencies or devDependencies
    if (
      !packageJson.devDependencies['eslint-config-next'] &&
      !packageJson.dependencies?.['eslint-config-next']
    ) {
      // Use the same version as next if available
      const nextVersion =
        packageJson.dependencies?.next || packageJson.devDependencies?.next
      packageJson.devDependencies['eslint-config-next'] =
        nextVersion || 'latest'
      needsUpdate = true
    }

    // Check if @eslint/eslintrc exists in either dependencies or devDependencies
    if (
      !packageJson.devDependencies['@eslint/eslintrc'] &&
      !packageJson.dependencies?.['@eslint/eslintrc']
    ) {
      packageJson.devDependencies['@eslint/eslintrc'] = '^3'
      needsUpdate = true
    }

    const updatedContent = JSON.stringify(packageJson, null, 2) + '\n'
    return { updated: needsUpdate, content: updatedContent }
  } catch (error) {
    console.error('Error updating package.json:', error)
    return { updated: false, content: packageJsonContent }
  }
}

export default function transformer(files: string[], options: any = {}): void {
  // The codemod CLI passes arguments as an array for consistency with file-based transforms,
  // but project-level transforms like this one only process a single directory.
  // Usage: npx @next/codemod next-lint-to-eslint-cli <project-directory>
  const dir = files[0]
  if (!dir) {
    console.error('Error: Please specify a directory path')
    return
  }

  // Allow skipping installation via option
  const skipInstall = options.skipInstall === true

  const projectRoot = path.resolve(dir)
  const packageJsonPath = path.join(projectRoot, 'package.json')

  if (!existsSync(packageJsonPath)) {
    console.error('Error: package.json not found in the specified directory')
    return
  }

  const isTypeScript = detectTypeScript(projectRoot)

  console.log('Migrating from next lint to the ESLint CLI...')

  // Check for existing ESLint config
  const existingConfig = findExistingEslintConfig(projectRoot)

  if (existingConfig.exists) {
    if (existingConfig.isFlat) {
      // Try to update existing flat config
      console.log(
        `   Found existing flat config: ${path.basename(existingConfig.path!)}`
      )
      const updated = updateExistingFlatConfig(
        existingConfig.path!,
        isTypeScript
      )

      if (!updated) {
        console.log(
          '   Could not automatically update the existing flat config.'
        )
        console.log(
          '   Please manually ensure your ESLint config extends "next/core-web-vitals"'
        )
        if (isTypeScript) {
          console.log('   and "next/typescript" for TypeScript projects.')
        }
      }
    } else {
      // Legacy config exists
      console.log(
        `   Found legacy ESLint config: ${path.basename(existingConfig.path!)}`
      )
      console.log('   Legacy .eslintrc configs are not automatically migrated.')
      console.log(
        '   Please migrate to flat config format (eslint.config.js) and ensure it extends:'
      )
      console.log('   - "next/core-web-vitals"')
      if (isTypeScript) {
        console.log('   - "next/typescript"')
      }
      console.log(
        '   Learn more: https://eslint.org/docs/latest/use/configure/migration-guide'
      )
    }
  } else {
    // Create new ESLint flat config
    const eslintConfigPath = path.join(projectRoot, 'eslint.config.mjs')
    const template = isTypeScript
      ? ESLINT_CONFIG_TEMPLATE_TYPESCRIPT
      : ESLINT_CONFIG_TEMPLATE_JAVASCRIPT

    try {
      writeFileSync(eslintConfigPath, template)
      console.log(`   Created ${path.basename(eslintConfigPath)}`)
    } catch (error) {
      console.error('   Error creating ESLint config:', error)
    }
  }

  // Update package.json
  const packageJsonContent = readFileSync(packageJsonPath, 'utf8')
  const result = updatePackageJsonScripts(packageJsonContent)

  if (result.updated) {
    try {
      writeFileSync(packageJsonPath, result.content)
      console.log('Updated package.json scripts and dependencies')

      // Parse the updated package.json to find new dependencies
      const updatedPackageJson = JSON.parse(result.content)
      const originalPackageJson = JSON.parse(packageJsonContent)

      const newDependencies: string[] = []

      // Check for new devDependencies
      if (updatedPackageJson.devDependencies) {
        for (const [pkg, version] of Object.entries(
          updatedPackageJson.devDependencies
        )) {
          if (
            !originalPackageJson.devDependencies?.[pkg] &&
            !originalPackageJson.dependencies?.[pkg]
          ) {
            newDependencies.push(`${pkg}@${version}`)
          }
        }
      }

      // Install new dependencies if any were added
      if (newDependencies.length > 0) {
        if (skipInstall) {
          console.log('\nNew dependencies added to package.json:')
          newDependencies.forEach((dep) => console.log(`   - ${dep}`))
          console.log(`Please run: ${getPkgManager(projectRoot)} install`)
        } else {
          console.log('\nInstalling new dependencies...')
          try {
            const packageManager = getPkgManager(projectRoot)
            console.log(`   Using ${packageManager}...`)

            installPackages(newDependencies, {
              packageManager,
              dev: true,
              silent: false,
            })

            console.log('   Dependencies installed successfully!')
          } catch (error) {
            console.error('   Failed to install dependencies automatically.')
            console.error(
              `   Please run: ${getPkgManager(projectRoot)} install`
            )
          }
        }
      }
    } catch (error) {
      console.error('Error writing package.json:', error)
    }
  }

  console.log('\nMigration complete! Your project now uses the ESLint CLI.')
}
