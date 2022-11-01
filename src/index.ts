import {constants, Address} from '@unique-nft/utils/index'
export {constants}

import type {ethers as _Ethers, Signer} from 'ethers'
type Ethers = typeof _Ethers
type SignerOrProvider = Signer | _Ethers.providers.Provider

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
  return typeof collectionIdOrAddress === 'string'
    ? collectionIdOrAddress
    : Address.collection.idToAddress(collectionIdOrAddress)
}

export type RefungibleTokenCollectionAndTokenId = {
  collectionIdOrAddress: number | string
  tokenId: number
}
const tokenIdOrAddressToAddress = (tokenIdOrAddress: RefungibleTokenCollectionAndTokenId | string): string => {
  if (typeof tokenIdOrAddress === 'string') {
    return tokenIdOrAddress
  }
  const collectionId = typeof tokenIdOrAddress.collectionIdOrAddress === 'number'
    ? tokenIdOrAddress.collectionIdOrAddress
    : Address.collection.addressToId(tokenIdOrAddress.collectionIdOrAddress)

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
    (await import('../dist/abi/UniqueRefungible.json')).default,
    signerOrProvider
  ) as UniqueFungible
}
