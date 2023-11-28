import {constants, Address} from '@unique-nft/utils'
export {constants}

import type {ethers as _Ethers, Signer} from 'ethers'
type Ethers = typeof _Ethers
type SignerOrProvider = Signer | _Ethers.Provider | _Ethers.Wallet

import type {
  CollectionHelpers,
  ContractHelpers,
  UniqueNFT,
  UniqueFungible,
  UniqueRefungible,
  UniqueRefungibleToken,
} from '../dist/ethers'

export type {
  CollectionHelpers,
  ContractHelpers,
  UniqueNFT,
  UniqueFungible,
  UniqueRefungible,
  UniqueRefungibleToken,
}

const getEthers = async (ethers?: Ethers): Promise<Ethers> => {
  if (ethers) return ethers
  return (await import('ethers')).ethers
}

const collectionIdOrAddressToAddress = (collectionIdOrAddress: number | string | unknown): string => {
  if (typeof collectionIdOrAddress === 'number') {
    return Address.collection.idToAddress(collectionIdOrAddress)
  } else if (typeof collectionIdOrAddress === 'string') {
    Address.validate.collectionAddress(collectionIdOrAddress)
    return collectionIdOrAddress
  } else {
    throw new Error('Collection ID or address must be a number or a string')
  }
}

export type RefungibleTokenCollectionAndTokenId = {
  collectionId: number | string
  tokenId: number
}
const tokenIdOrAddressToAddress = (tokenIdOrAddress: RefungibleTokenCollectionAndTokenId | string): string => {
  if (typeof tokenIdOrAddress === 'string') {
    Address.validate.collectionAddress(tokenIdOrAddress)
    return tokenIdOrAddress
  }
  if (typeof tokenIdOrAddress !== 'object' || tokenIdOrAddress === null) {
    throw new Error('tokenIdOrAddress must be a string or a valid object with collectionId and tokenId')
  }
  let collectionId = typeof tokenIdOrAddress.collectionId === 'number'
    ? tokenIdOrAddress.collectionId
    : Address.collection.addressToId(tokenIdOrAddress.collectionId)

  return Address.nesting.idsToAddress(collectionId, tokenIdOrAddress.tokenId)
}



export const CollectionHelpersFactory = async (signerOrProvider: SignerOrProvider, ethers?: Ethers) => {
  const ethersLib = await getEthers(ethers)

  return new ethersLib.Contract(
    constants.STATIC_ADDRESSES.collectionHelpers,
    (await import('../dist/abi/CollectionHelpers.json')).default,
    signerOrProvider,
  ) as unknown as CollectionHelpers
}

export const ContractHelpersFactory = async (signerOrProvider: SignerOrProvider, ethers?: Ethers) => {
  const ethersLib = await getEthers(ethers)

  return new ethersLib.Contract(
    constants.STATIC_ADDRESSES.contractHelpers,
    (await import('../dist/abi/ContractHelpers.json')).default,
    signerOrProvider
  ) as unknown as ContractHelpers
}

export const UniqueNFTFactory = async (collectionIdOrAddress: number | string, signerOrProvider: SignerOrProvider, ethers?: Ethers) => {
  const ethersLib = await getEthers(ethers)

  return new ethersLib.Contract(
    collectionIdOrAddressToAddress(collectionIdOrAddress),
    (await import('../dist/abi/UniqueNFT.json')).default,
    signerOrProvider
  ) as unknown as UniqueNFT
}

export const UniqueFungibleFactory = async (collectionIdOrAddress: number | string, signerOrProvider: SignerOrProvider, ethers?: Ethers) => {
  const ethersLib = await getEthers(ethers)

  return new ethersLib.Contract(
    collectionIdOrAddressToAddress(collectionIdOrAddress),
    (await import('../dist/abi/UniqueFungible.json')).default,
    signerOrProvider
  ) as unknown as UniqueFungible
}

export const UniqueRefungibleFactory = async (collectionIdOrAddress: number | string, signerOrProvider: SignerOrProvider, ethers?: Ethers) => {
  const ethersLib = await getEthers(ethers)

  return new ethersLib.Contract(
    collectionIdOrAddressToAddress(collectionIdOrAddress),
    (await import('../dist/abi/UniqueRefungible.json')).default,
    signerOrProvider
  ) as unknown as UniqueFungible
}

export const UniqueRefungibleTokenFactory = async (tokenIdOrAddress: RefungibleTokenCollectionAndTokenId | string, signerOrProvider: SignerOrProvider, ethers?: Ethers) => {
  const ethersLib = await getEthers(ethers)

  const address = tokenIdOrAddressToAddress(tokenIdOrAddress)

  return new ethersLib.Contract(
    collectionIdOrAddressToAddress(address),
    (await import('../dist/abi/UniqueRefungibleToken.json')).default,
    signerOrProvider
  ) as unknown as UniqueRefungibleToken
}

import type {ContractTransactionReceipt, EventLog, Log} from 'ethers'

const isEventLog = (log: Log | EventLog): log is EventLog => {
  return !!(log as EventLog).fragment
}

export const parseEthersV6TxReceipt = <ParsedEvents extends Record<string, any>>(tx: ContractTransactionReceipt, options = {decimals: 18}) => {
  const eventLogs = (tx.logs || []).filter(isEventLog);

  const events = Object.fromEntries(eventLogs.map((event, index) => {
    const name = event.fragment?.name || `event_${index.toString().padStart(4, '0')}`
    const args = event.args ? event.args.toObject() : {}

    return [name, args];
  })) as ParsedEvents

  const rawPrice = tx.gasUsed * tx.gasPrice
  const priceStr = rawPrice.toString().padStart(options.decimals + 1, '0')
  const price = parseFloat([priceStr.slice(0, -options.decimals), '.', priceStr.slice(-options.decimals)].join(''))

  return {
    get tx() {
      return tx
    },
    from: tx.from,
    to: tx.to,
    rawPrice,
    price,
    rawEvents: tx.logs || [],
    events,
    gasUsed: tx.gasUsed,
    cumulativeGasUsed: tx.cumulativeGasUsed,
    effectiveGasPrice: tx.gasPrice,
  }
}

