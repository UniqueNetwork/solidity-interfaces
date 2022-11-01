import packageVersions from 'pkg-versions'
import Semver, {SemVer} from 'semver'
import {program} from 'commander'
import fs from 'node:fs/promises'

import packageJson from './package.json'

const versions = Array.from(await packageVersions(packageJson.name))

const semvers = versions.map(version => Semver.parse(version)).filter(ver => ver!!) as Semver.SemVer[]
const regular = semvers.filter(ver => ver.prerelease.length === 0)
const beta = semvers.filter(ver => ver.prerelease.length !== 0)

const currentRegular: SemVer = regular.pop() || Semver.parse('0.0.0') as Semver.SemVer
const currentBeta: SemVer | null = beta.pop() || null

const regularNextPatch = Semver.parse(currentRegular.format())!.inc('patch')
const regularNextMinor = Semver.parse(currentRegular.format())!.inc('minor')
const regularNextMajor = Semver.parse(currentRegular.format())!.inc('major')

const nextBeta = (currentBeta && Semver.gt(currentBeta, currentRegular))
  ? Semver.parse(currentBeta.format())!.inc('prerelease', 'beta')
  : Semver.parse(currentRegular.format())!.inc('prerelease', 'beta')


console.log('current:', currentRegular.format())
console.log('current beta:', currentBeta ? currentBeta.format() : 'no beta published')
console.log()
console.log('next patch:', regularNextPatch.format())
console.log('next minor:', regularNextMinor.format())
console.log('next major:', regularNextMajor.format())
console.log('next beta:', nextBeta.format())

program
  .option('--beta')
  .option('--patch')
  .option('--minor')
  .option('--major')

program.parse()

const options = program.opts()

if (options.beta) {
  packageJson.version = nextBeta.format()
} else if (options.patch) {
  packageJson.version = regularNextPatch.format()
} else if (options.minor) {
  packageJson.version = regularNextMinor.format()
} else if (options.major) {
  packageJson.version = regularNextMajor.format()
}

await fs.writeFile('./package.json', JSON.stringify(packageJson, null, 2))
