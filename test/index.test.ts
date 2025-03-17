import { Counter } from './Counter.s.sol';
import { mainnet } from 'tevm/common';
import { createTevmNode } from 'tevm/node';
import { createAddress } from 'tevm/address';
import { createMemoryClient, http } from 'tevm';
import { generatePrivateKey, privateKeyToAddress } from 'viem/accounts';
import { describe, it, beforeAll, expect } from 'vitest';
import { Vm } from 'tevm/vm';

/* -------------------------------- CONSTANTS ------------------------------- */
const account = privateKeyToAddress(generatePrivateKey());
const rpcUrl = 'https://eth.llamarpc.com';
const contractAddress = createAddress(
  '0x1111111111111111111111111111111111111111',
);
const contract = Counter.withAddress(contractAddress.toString());

const node = createTevmNode({
  common: mainnet,
  fork: {
    transport: http(rpcUrl),
    blockTag: 'latest',
  },
});
const provider = createMemoryClient({
  account,
  common: mainnet,
  fork: {
    transport: http(rpcUrl),
    blockTag: 'latest',
  },
});

/* -------------------------------- FUNCTION -------------------------------- */
describe('Counter', () => {
  let vm: Vm;

  beforeAll(async () => {
    vm = await node.getVm();
    await provider.tevmSetAccount(contract);
  });

  it('should increment', async () => {
    const txTevm = await provider.tevmContract({
      ...contract.write.setNumber(10n),
      caller: account,
      createAccessList: true,
      createTransaction: true,
    });
    await provider.mine({ blocks: 1 });

    const slot = txTevm.accessList?.[contractAddress.toString()]
      .entries()
      .next().value?.[0];

    console.log(
      await provider.getStorageAt({
        address: contractAddress.toString(),
        slot: slot ?? '0x',
      }),
    );

    const storageValue = await provider.getStorageAt({
      address: contractAddress.toString(),
      slot: slot ?? '0x',
    });

    const contractValue = (
      await provider.tevmContract(contract.read.getNumber())
    ).data;

    expect(storageValue).toBe('0x0a');
    expect(contractValue).toEqual(10n);
  });
});
