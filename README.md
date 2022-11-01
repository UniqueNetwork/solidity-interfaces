# Unique Solidity interfaces

## Usage

```ts
import {ethers} from 'ethers'
import {Address} from '@unique-nft/utils'
import {
  CollectionHelpersFactory,
  UniqueNFTFactory,
} from '@unique-nft/solidity-interfaces'

const provider = new ethers.providers.JsonRpcProvider('https://rpc-opal.unique.network')
const wallet = new ethers.Wallet('<Private key>', provider)

// or, with browser extension:
// const provider = new ethers.providers.Web3Provider(window.ethereum)
// const wallet = provider.getSigner()

const collectionHelpers = await CollectionHelpersFactory(wallet, ethers) // ethers parameter is optional
//when ethers not provided, it's been asynchronously loaded on demand to reduce package size and TTFP

const txCreateCollection = await (await collectionHelpers.createNFTCollection(
  'My Collection', // collection name
  'Fancy collection description', // collection description
  'MYCL', // token prefix - short, up to 4 letters string
  {value: await collectionHelpers.collectionCreationFee()}
)).wait()

const collectionAddress = txCreateCollection.events?.[0].args?.collectionId as string

// make collection ERC721Metadata compatible, to create necessary properties and activate
// corresponding supportsInterface and enable mintWithTokenURI and tokenURI methods 
//
// Actually it's optional but if we want to make it compatible with 
// common ethereum-world NFT collections, it's better to enable this compatibility.
// anyway, it just improves the collection and doesn't brake or mangle anything. 
const txMakeCompatible = await (await collectionHelpers.makeCollectionERC721MetadataCompatible(
  collectionAddress,
  '' // baseURI
)).wait()
console.log(`Collection #${collectionId} (address ${collectionAddress}) is now ERC721Compatible`)

const collection = await UniqueNFTFactory(collectionAddress, wallet, ethers)

const txMintToken = await (await collection.mintWithTokenURI(
  wallet.address,
  'ipfs://QmZ8Syn28bEhZJKYeZCxUTM5Ut74ccKKDbQCqk5AuYsEnp'
)).wait()

// this .toNumber() type casting is safe because tokenId upper boundary is 2**32
const tokenId = txMintToken.events?.[0].args?.tokenId.toNumber()
const tokenUri = await collection.tokenURI(tokenId)

console.log(`Successfully minted token #${tokenId}, it's URI is: ${tokenUri}`)
```

## Exports

### Solidity interfaces and smart contracts and ABI:

`import {...} from '@unique-nft/solidity-abi/contracts'`

`import {...} from '@unique-nft/solidity-abi/abi'`

Unique interfaces and smart contracts solidity sources:

- CollectionHelpers.sol / .json
- ContractHelpers.sol / .json
- UniqueFungible.sol / .json
- UniqueNFT.sol / .json
- UniqueRefungible.sol / .json
- UniqueRefungibleToken.sol / .json

### Ethers ready-to-use factories and typescript types

```ts
import {
  CollectionHelpers__factory,
  ContractHelpers__factory,
  UniqueFungible__factory,
  UniqueNFT__factory,
  UniqueRefungible__factory,
  UniqueRefungibleToken__factory,
  //typescript types:
  CollectionHelpers,
  ContractHelpers,
  UniqueNFT,
  UniqueFungible,
  UniqueRefungible,
  UniqueRefungibleToken,
} from '@unique-nft/solidity/factory/ethers'
```

### Web3.js typescript types

```ts
import {
  CollectionHelpers,
  ContractHelpers,
  UniqueNFT,
  UniqueFungible,
  UniqueRefungible,
  UniqueRefungibleToken,
} from '@unique-nft/solidity/factory/web3'
```

_note: it requires web3.js installed on your own, web3.js is a peer dependency for this project_

### Static addresses for Helpers interfaces:

|Interface|Address|
|---|---|
|collectionHelpers|0x6C4E9fE1AE37a41E93CEE429e8E1881aBdcbb54F|
|contractHelpers|0x842899ECF380553E8a4de75bF534cdf6fBF64049|

```ts
import {constants} from '@unique-nft/solidity'

console.log(constants.STATIC_ADDRESSES.collectionHelpers)
console.log(constants.STATIC_ADDRESSES.contractHelpers)
```
