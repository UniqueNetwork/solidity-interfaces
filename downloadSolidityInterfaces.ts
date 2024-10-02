import path from 'node:path'
import {createWriteStream} from 'node:fs'
import fs from 'node:fs/promises'
import childProcess from 'node:child_process'
import {promisify} from 'node:util'
import https from 'node:https'
import type {OutgoingHttpHeaders} from 'node:http'

export const fetchJson = async <T = any>(url: string, headers: OutgoingHttpHeaders): Promise<T> => {
  return new Promise((resolve) => {
    https.get(url, {headers}, function (response) {
      let data = ''

      response.on('data', chunk => data += chunk)

      response.on('end', () => resolve(JSON.parse(data)))
    })
  })
}

export const downloadFile = async (destination: string, url: string, headers: OutgoingHttpHeaders): Promise<void> => {
  return new Promise((resolve, reject) => {
    const fileWriteStream = createWriteStream(destination)

    console.log(`Loading file ${destination} from ${url}`)

    https.get(url, {headers}, function (response) {
      response.pipe(fileWriteStream)

      fileWriteStream.on("finish", () => {
        fileWriteStream.close()
        resolve()
      })

      fileWriteStream.on("error", (err) => {
        fileWriteStream.close()
        reject(err)
      })
    })
  })
}

const exec = promisify(childProcess.exec)

const DEFAULT_BRANCH = `release-v10030070`
const getGithubRepoTreeUrl = (branch: string = DEFAULT_BRANCH) =>
  `https://api.github.com/repos/UniqueNetwork/unique-chain/git/trees/${branch}?recursive=1`
const getGithubRawFileUrl = (filepath: string, branch: string = DEFAULT_BRANCH) =>
  `https://raw.githubusercontent.com/UniqueNetwork/unique-chain/${branch}/${filepath}`

// const REPO_STUBS_PATH = 'tests/src/eth/api'
const REPO_STUBS_PATH = 'js-packages/tests/eth/api'
const GITHUB_HEADERS = {
  'User-Agent': 'Awesome-Octocat-App',
}

interface GithubTree {
  sha: string
  url: string
  truncated: string
  tree: Array<{
    path: string
    mode: string
    type: string
    sha: string
    size?: number
    url: string
  }>
}

const typesToExtract = ['CrossAddress'];

const downloadStubs = async (contractsPath: string) => {
  console.log('\n')
  console.log('=======================================')
  console.log('STEP 1: DOWNLOADING SOLIDITY INTERFACES')
  console.log('=======================================\n')

  const githubTree = await fetchJson<GithubTree>(getGithubRepoTreeUrl(), GITHUB_HEADERS)

  const stubs = githubTree.tree
    .filter(elem => elem.path.startsWith(REPO_STUBS_PATH) && elem.path.endsWith('.sol'))
    .map(stub => {
      return {
        name: stub.path.split('/').slice(-1)[0],
        path: stub.path,
      }
    })

  console.log('Stubs:')
  console.dir(stubs, {depth: 100})

  await Promise.all(stubs.map(stub => {
    const destinationPath = path.join(contractsPath, stub.name)
    return downloadFile(destinationPath, getGithubRawFileUrl(stub.path), GITHUB_HEADERS)
  }))
  console.log(`Smart contracts (${stubs.length}) loaded: ${stubs.map(stub => stub.name).join(', ')}`)
}

const extractTypes = async (contractsPath: string, typesToExtract: string[]): Promise<void> => {
  console.log('\n')
  console.log('===================================')
  console.log('STEP 2: EXTRACTING TYPES')
  console.log('===================================\n')

  const smartContractsFolderContents = (await fs.readdir(contractsPath)).filter(fileName => fileName.endsWith('.sol'))

  // Object to store type definitions with their comments
  const typeDefinitions: { [typeName: string]: string } = {}
  const typeFoundInFiles: { [typeName: string]: string[] } = {}

  for (const fileName of smartContractsFolderContents) {
    const filePath = path.join(contractsPath, fileName)
    let fileContents = await fs.readFile(filePath, 'utf8')

    let fileModified = false

    for (const typeName of typesToExtract) {
      const typePattern = `(?:\\s*(?://[^\n]*\\n|/\\*[\\s\\S]*?\\*/))*\\s*(struct|enum)\\s+${typeName}\\s*\\{[\\s\\S]*?\\}`
      const typeRegex = new RegExp(typePattern, 'g')

      const matches = []
      let match
      while ((match = typeRegex.exec(fileContents)) !== null) {
        matches.push({
          fullMatch: match[0],
          index: match.index,
          type: match[1],
        })
      }

      for (const m of matches) {
        const typeDefinition = m.fullMatch

        if (!typeDefinitions[typeName]) {
          typeDefinitions[typeName] = typeDefinition.trim()
          typeFoundInFiles[typeName] = [fileName]
        } else {
          if (typeDefinitions[typeName] !== typeDefinition.trim()) {
            console.warn(`Type ${typeName} in file ${fileName} differs from the previously found definition.`)
            // Handle as needed, e.g., throw an error, or pick one definition.
          } else {
            typeFoundInFiles[typeName].push(fileName)
          }
        }

        // Remove the type definition from the file
        fileContents = fileContents.slice(0, m.index) + fileContents.slice(m.index + m.fullMatch.length)
        fileModified = true
      }
    }

    if (fileModified) {
      // Add 'import "./types.sol";' after the pragma statements if not already present
      if (!fileContents.includes('import "./types.sol";')) {
        const pragmaRegex = /((?:\s*pragma\s+[^;]+;\s*)+)/g
        const match = pragmaRegex.exec(fileContents)
        let indexToInsertImport = 0
        if (match) {
          indexToInsertImport = match.index + match[0].length
        }

        const beforeImport = fileContents.slice(0, indexToInsertImport)
        const afterImport = fileContents.slice(indexToInsertImport)
        const importStatement = '\nimport "./types.sol";\n\n'
        fileContents = beforeImport + importStatement + afterImport
      }

      // Write the modified file back
      await fs.writeFile(filePath, fileContents, 'utf8')

      console.log(`Updated ${fileName} to import types from types.sol`)
    }
  }

  if (Object.keys(typeDefinitions).length > 0) {
    // Write the type definitions into types.sol
    const typesSolPath = path.join(contractsPath, 'types.sol')
    // Collect unique pragma directives
    const pragmaDirectives = new Set<string>()

    // Collect pragma directives from the original files
    for (const fileName of smartContractsFolderContents) {
      const filePath = path.join(contractsPath, fileName)
      const fileContents = await fs.readFile(filePath, 'utf8')
      const pragmaRegex = /pragma\s+[^;]+;/g
      const pragmaMatches = fileContents.match(pragmaRegex)
      if (pragmaMatches) {
        for (const pragma of pragmaMatches) {
          pragmaDirectives.add(pragma)
        }
      }
    }

    // Prepare the content of types.sol
    let typesSolContent = '// SPDX-License-Identifier: OTHER\n// This code is automatically generated\n'
    typesSolContent += Array.from(pragmaDirectives).join('\n') + '\n\n'
    typesSolContent += Object.values(typeDefinitions).join('\n\n') + '\n'

    await fs.writeFile(typesSolPath, typesSolContent, 'utf8')
    console.log(`Created types.sol with types: ${Object.keys(typeDefinitions).join(', ')}`)
  } else {
    console.log('No specified types found in any of the Solidity files.')
  }
}

const compileSmartContracts = async (contractsPath: string, abiPath: string) => {
  console.log('\n')
  console.log('=====================================')
  console.log('STEP 3: COMPILING SOLIDITY INTERFACES')
  console.log('=====================================\n')

  const smartContractsFolderContents = (await fs.readdir(contractsPath))


  await Promise.all(smartContractsFolderContents.map(async (fileName) => {
    const filePath = path.join(contractsPath, fileName)

    const start = Date.now()
    const {
      stdout,
      stderr
    } = await exec(`solcjs ${filePath} --abi --base-path ${contractsPath} -o ${abiPath}`)
    const finish = Date.now()
    console.log(`Compiled ${fileName} in ${finish - start}ms`, stdout)
    if (stderr) {
      throw new Error(`Compiling ${fileName}, something went wrong: ${stderr}`)
    }
  }))
}

const shrinkAbis = async (abiPath: string) => {
  console.log('\n')
  console.log('============================')
  console.log('STEP 4: SHRINKING EXTRA ABIS')
  console.log('============================\n')

  const abiFolderContents = (await fs.readdir(abiPath)).filter(f => f.endsWith('.abi'))

  const toRemain: string[] = []
  const toDelete: string[] = []

  for (const fileName of abiFolderContents) {
    const parts = path.basename(fileName, '.abi').split('_sol_')
    ;(parts[0] === parts[1])
      ? toRemain.push(fileName)
      : toDelete.push(fileName)
  }

  for (const fileName of toDelete) {
    await fs.unlink(path.join(abiPath, fileName))
  }

  const newNames: string[] = []

  for (const fileName of toRemain) {
    const parts = path.basename(fileName, '.abi').split('_sol_')
    const renameTo = path.join(abiPath, `${parts[0]}.json`)
    await fs.rename(path.join(abiPath, fileName), renameTo)
    newNames.push(`${parts[0]}.json`)

    const contents = (await fs.readFile(renameTo)).toString()
    await fs.writeFile(renameTo, JSON.stringify(JSON.parse(contents), null, 2))
  }

  console.log(`Generated ABIs (${newNames.length}): ${newNames.join(', ')}`)
}

const typeChainEthers = async (abiPath: string, ethersTypesPath: string) => {
  console.log('\n')
  console.log('===============================')
  console.log('STEP 5: GENERATING ETHERS TYPES')
  console.log('===============================\n')

  const start = Date.now()
  const {stdout, stderr} = await exec(`typechain --target ethers-v6 --out-dir ${ethersTypesPath} '${abiPath}/*.json'`)
  const finish = Date.now()
  console.log(`Generated ethers.js typings in ${finish - start}ms:`, stdout)
  if (stderr) {
    console.error(stderr)
  }
}

const typeChainWeb3 = async (abiPath: string, web3TypesPath: string) => {
  console.log('\n')
  console.log('=============================')
  console.log('STEP 6: GENERATING WEB3 TYPES')
  console.log('=============================\n')

  const start = Date.now()
  const {stdout, stderr} = await exec(`typechain --target web3-v1 --out-dir ${web3TypesPath} '${abiPath}/*.json'`)
  const finish = Date.now()
  console.log(`Generated web3.js typings in ${finish - start}ms:`, stdout)
  if (stderr) {
    console.error(stderr)
  }
}

const cleanDir = async (dirPath: string) => {
  try {
    await fs.stat(dirPath)
  } catch {
    await fs.mkdir(dirPath)
    return
  }
  const contents = await fs.readdir(dirPath)
  await Promise.all(contents.map(fileName =>
    fs.rm(path.join(dirPath, fileName), {recursive: true, force: true}))
  )
}

const main = async () => {
  // const indexOfDataFolderParam = process.argv.indexOf('--data-path')
  // const dataRootPath = indexOfDataFolderParam > -1
  //   ? process.argv[indexOfDataFolderParam + 1]
  //   : path.join(process.cwd(), 'data')

  const dataRootPath = path.join(process.cwd())
  console.log(`Data root path is "${dataRootPath}"`)

  const distPath = path.join(dataRootPath, 'dist')
  await cleanDir(distPath)

  const contractsPath = path.join(distPath, 'contracts')
  await fs.mkdir(contractsPath)
  const abiPath = path.join(distPath, 'abi')
  await fs.mkdir(abiPath)

  const ethersTypesPath = path.join(distPath, 'ethers')
  await fs.mkdir(ethersTypesPath)
  const web3TypesPath = path.join(distPath, 'web3')
  await fs.mkdir(web3TypesPath)

  await downloadStubs(contractsPath)

  await extractTypes(contractsPath, typesToExtract)

  await compileSmartContracts(contractsPath, abiPath)

  await shrinkAbis(abiPath)

  await typeChainEthers(abiPath, ethersTypesPath)

  await typeChainWeb3(abiPath, web3TypesPath)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
