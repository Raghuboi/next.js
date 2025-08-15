/* global jest */
jest.autoMockOff()
const fs = require('fs')
const path = require('path')
const { tmpdir } = require('os')
const transformer = require('../next-lint-to-eslint-cli').default

describe('next-lint-to-eslint-cli', () => {
  let tempDir

  beforeEach(() => {
    // Create a unique temp directory for each test
    tempDir = fs.mkdtempSync(path.join(tmpdir(), 'codemod-test-'))
  })

  afterEach(() => {
    // Clean up temp directory
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  test('transforms correctly using basic data', () => {
    // Read input fixture
    const inputPath = path.join(__dirname, '../__testfixtures__/next-lint-to-eslint-cli/basic.input.json')
    const expectedOutputPath = path.join(__dirname, '../__testfixtures__/next-lint-to-eslint-cli/basic.output.json')
    
    const inputContent = fs.readFileSync(inputPath, 'utf8')
    const expectedOutput = fs.readFileSync(expectedOutputPath, 'utf8')

    // Set up test project
    const packageJsonPath = path.join(tempDir, 'package.json')
    const tsConfigPath = path.join(tempDir, 'tsconfig.json')
    
    fs.writeFileSync(packageJsonPath, inputContent)
    fs.writeFileSync(tsConfigPath, '{}') // Create tsconfig.json to indicate TypeScript project

    // Run transformer
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    
    transformer([tempDir], {})

    // Check package.json was updated correctly
    const actualPackageJson = fs.readFileSync(packageJsonPath, 'utf8')
    expect(JSON.parse(actualPackageJson)).toEqual(JSON.parse(expectedOutput))

    // Check eslint.config.mjs was created
    const eslintConfigPath = path.join(tempDir, 'eslint.config.mjs')
    expect(fs.existsSync(eslintConfigPath)).toBe(true)
    
    const eslintConfig = fs.readFileSync(eslintConfigPath, 'utf8')
    expect(eslintConfig).toContain('next/core-web-vitals')
    expect(eslintConfig).toContain('next/typescript')
    expect(eslintConfig).toContain('ignores:')

    consoleSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  test('transforms correctly using existing-eslint data', () => {
    // Read input fixture
    const inputPath = path.join(__dirname, '../__testfixtures__/next-lint-to-eslint-cli/existing-eslint.input.json')
    const expectedOutputPath = path.join(__dirname, '../__testfixtures__/next-lint-to-eslint-cli/existing-eslint.output.json')
    
    const inputContent = fs.readFileSync(inputPath, 'utf8')
    const expectedOutput = fs.readFileSync(expectedOutputPath, 'utf8')

    // Set up test project
    const packageJsonPath = path.join(tempDir, 'package.json')
    const existingEslintPath = path.join(tempDir, '.eslintrc.json')
    
    fs.writeFileSync(packageJsonPath, inputContent)
    fs.writeFileSync(existingEslintPath, '{"extends": ["next"]}') // Create existing ESLint config

    // Run transformer
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    
    transformer([tempDir], {})

    // Check package.json was updated correctly
    const actualPackageJson = fs.readFileSync(packageJsonPath, 'utf8')
    expect(JSON.parse(actualPackageJson)).toEqual(JSON.parse(expectedOutput))

    // Check that no new eslint.config.mjs was created (existing config should be preserved)
    const eslintConfigPath = path.join(tempDir, 'eslint.config.mjs')
    expect(fs.existsSync(eslintConfigPath)).toBe(false)

    // Check that existing config still exists
    expect(fs.existsSync(existingEslintPath)).toBe(true)

    consoleSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })
})