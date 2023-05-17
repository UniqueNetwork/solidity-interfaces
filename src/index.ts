import {constants, Address} from '@unique-nft/utils'
export {constants}

import type {ethers as _Ethers, Signer} from 'ethers'
type Ethers = typeof _Ethers
type SignerOrProvider = Signer | _Ethers.providers.Provider | _Ethers.Wallet

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


const collectionIdOrAddressToAddress = (collectionIdOrAddress: number | string): string => {
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
    signerOrProvider
  ) as CollectionHelpers
}

export const ContractHelpersFactory = async (signerOrProvider: SignerOrProvider, ethers?: Ethers) => {
  const ethersLib = await getEthers(ethers)

  return new ethersLib.Contract(
    constants.STATIC_ADDRESSES.contractHelpers,
    (await import('../dist/abi/ContractHelpers.json')).default,
    signerOrProvider
  ) as ContractHelpers
}

export const UniqueNFTFactory = async (collectionIdOrAddress: number | string, signerOrProvider: SignerOrProvider, ethers?: Ethers) => {
  const ethersLib = await getEthers(ethers)

  return new ethersLib.Contract(
    collectionIdOrAddressToAddress(collectionIdOrAddress),
    (await import('../dist/abi/UniqueNFT.json')).default,
    signerOrProvider
  ) as UniqueNFT
}

export const UniqueFungibleFactory = async (collectionIdOrAddress: number | string, signerOrProvider: SignerOrProvider, ethers?: Ethers) => {
  const ethersLib = await getEthers(ethers)

  return new ethersLib.Contract(
    collectionIdOrAddressToAddress(collectionIdOrAddress),
    (await import('../dist/abi/UniqueFungible.json')).default,
    signerOrProvider
  ) as UniqueFungible
}

export const UniqueRefungibleFactory = async (collectionIdOrAddress: number | string, signerOrProvider: SignerOrProvider, ethers?: Ethers) => {
  const ethersLib = await getEthers(ethers)

  return new ethersLib.Contract(
    collectionIdOrAddressToAddress(collectionIdOrAddress),
    (await import('../dist/abi/UniqueRefungible.json')).default,
    signerOrProvider
  ) as UniqueFungible
}

export const UniqueRefungibleTokenFactory = async (tokenIdOrAddress: RefungibleTokenCollectionAndTokenId | string, signerOrProvider: SignerOrProvider, ethers?: Ethers) => {
  const ethersLib = await getEthers(ethers)

  const address = tokenIdOrAddressToAddress(tokenIdOrAddress)

  return new ethersLib.Contract(
    collectionIdOrAddressToAddress(address),
    (await import('../dist/abi/UniqueRefungibleToken.json')).default,
    signerOrProvider
  ) as UniqueRefungibleToken
}

import type {ContractReceipt, Event} from 'ethers'

export const parseEthersV5TxReceipt = <ParsedEvents = any>(tx: ContractReceipt, options = {decimals: 18}) => {
  const events = (tx.events || []).filter(event => !!event.event).map((event: Event, index) => {
    const args = event.args
    return {
      name: event.event || `event_${index.toString().padStart(4, '0')}`,
      // args: event.args!,
      events: !args ? {} : Object.keys(args)
        .filter(key => isNaN(parseInt(key)))
        .reduce((acc, key) => {
          const rawValue = args[key]
          const value = (typeof rawValue === 'object' && rawValue?._isBigNumber)
            ? rawValue.toBigInt()
            : rawValue
          acc[key] = value
          return acc
        }, {} as {[K: string]: any})
    }
  }).reduce((acc, elem) => {
    acc[elem.name] = elem.events
    return acc
  }, {} as {[K: string]: any}) as ParsedEvents

  const rawPrice = tx.gasUsed.toBigInt() * tx.effectiveGasPrice.toBigInt()
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
    rawEvents: tx.events || [],
    events,
    gasUsed: tx.gasUsed.toBigInt(),
    cumulativeGasUsed: tx.cumulativeGasUsed.toBigInt(),
    effectiveGasPrice: tx.effectiveGasPrice.toBigInt(),
  }
}

