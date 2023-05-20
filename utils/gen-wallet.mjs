
const {
  randomBytes
} = await import('node:crypto');
const { Mnemonic, isBytesLike } = await import('ethers');


const buffer = randomBytes(32);
const uint8array = new Uint8Array(buffer);
if (!isBytesLike(uint8array)) {
  throw new Error('Not a Uint8Array');
}
const mnemonic = Mnemonic.fromEntropy(uint8array);
console.log(mnemonic.phrase);
