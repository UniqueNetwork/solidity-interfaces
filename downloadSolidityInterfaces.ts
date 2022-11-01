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
    })
  })
}

const exec = promisify(childProcess.exec)

const DEFAULT_BRANCH = `release-v930032`
const getGithubRepoTreeUrl = (branch: string = DEFAULT_BRANCH) =>
  `https://api.github.com/repos/UniqueNetwork/unique-chain/git/trees/${branch}?recursive=1`
const getGithubRawFileUrl = (filepath: string, branch: string = DEFAULT_BRANCH) =>
  `https://raw.githubusercontent.com/UniqueNetwork/unique-chain/${branch}/${filepath}`

const REPO_STUBS_PATH = 'tests/src/eth/api'
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

  await Promise.all(stubs.map(stub => {
    const destinationPath = path.join(contractsPath, stub.name)
    return downloadFile(destinationPath, getGithubRawFileUrl(stub.path), GITHUB_HEADERS)
  }))
  console.log(`Smart contracts (${stubs.length}) loaded: ${stubs.map(stub => stub.name).join(', ')}`)
}

const compileSmartContracts = async (contractsPath: string, abiPath: string) => {
  console.log('\n')
  console.log('=====================================')
  console.log('STEP 2: COMPILING SOLIDITY INTERFACES')
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
  console.log('STEP 3: SHRINKING EXTRA ABIS')
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
  console.log('STEP 4: GENERATING ETHERS TYPES')
  console.log('===============================\n')

  const start = Date.now()
  const {stdout, stderr} = await exec(`typechain --target ethers-v5 --out-dir ${ethersTypesPath} '${abiPath}/*.json'`)
  const finish = Date.now()
  console.log(`Generated ethers.js typings in ${finish - start}ms:`, stdout)
  if (stderr) {
    console.error(stderr)
  }
}

const typeChainWeb3 = async (abiPath: string, web3TypesPath: string) => {
  console.log('\n')
  console.log('=============================')
  console.log('STEP 5: GENERATING WEB3 TYPES')
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

  await compileSmartContracts(contractsPath, abiPath)

  await shrinkAbis(abiPath)

  await typeChainEthers(abiPath, ethersTypesPath)

  await typeChainWeb3(abiPath, web3TypesPath)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
