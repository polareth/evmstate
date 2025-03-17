import { Counter } from './Counter.sol';
import { mainnet, abstractTestnet } from 'tevm/common';
import { createTevmNode } from 'tevm/node';
import {
  bytesToHex,
  bytesToUnprefixedHex,
  encodeFunctionData,
  EthjsAddress,
  keccak256,
  serializeTransaction,
  setLengthLeft,
  toBytes,
} from 'tevm/utils';
import { createAddress } from 'tevm/address';
import {
  createImpersonatedTx,
  FeeMarketEIP1559Transaction,
  TransactionType,
  AccessListEIP2930Transaction,
} from 'tevm/tx';
import { abi, counterBytecode } from '../test/constants';
import { createMemoryClient, http } from 'tevm';
import { generatePrivateKey, privateKeyToAddress } from 'viem/accounts';

/* ---------------------------------- UTILS --------------------------------- */
const createImpersonatedTxAccessList = (
  tx: AccessListEIP2930Transaction,
  impersonatedAddress: EthjsAddress,
) => {
  return new Proxy(tx, {
    get(target, prop) {
      if (prop === 'isImpersonated') {
        return true;
      }
      if (prop === 'hash') {
        return () => {
          try {
            return target.hash();
          } catch (e) {
            return keccak256(target.getHashedMessageToSign(), 'bytes');
          }
        };
      }
      if (prop === 'isSigned') {
        return () => true;
      }
      if (prop === 'getSenderAddress') {
        return () => impersonatedAddress;
      }
      return Reflect.get(target, prop);
    },
  });
};
function padToEven(a: string): string {
  return a.length % 2 ? `0${a}` : a;
}

const bigIntToBytes = (num: bigint, littleEndian = false): Uint8Array => {
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  const bytes = toBytes(`0x${padToEven(num.toString(16))}`);

  return littleEndian ? bytes.reverse() : bytes;
};

function utf8ToBytes(utf: string): Uint8Array {
  return new TextEncoder().encode(utf);
}

/* -------------------------------- CONSTANTS ------------------------------- */
const account = privateKeyToAddress(generatePrivateKey());
const rpcUrl = 'https://eth.llamarpc.com';
const contractAddress = createAddress(
  '0x1111111111111111111111111111111111111111',
);

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
const loadStorage = async () => {
  try {
    const vm = await node.getVm();
    // console.log(await vm.stateManager.getContractCode(contractAddress));
    // console.log(
    //   await vm.stateManager.getContractStorage(
    //     contractAddress,
    //     setLengthLeft(bigIntToBytes(1n), 32),
    //   ),
    // );
    // console.log(
    //   'Initial storage',
    //   await vm.stateManager.dumpStorage(contractAddress),
    // );
    // await vm.stateManager.putContractStorage(
    //   contractAddress,
    //   setLengthLeft(bigIntToBytes(2n), 32),
    //   utf8ToBytes('abcd'),
    // );
    // console.log(
    //   'Storage after put',
    //   await vm.stateManager.dumpStorage(contractAddress),
    // );
    // const txData = {
    //   account,
    //   to: contractAddress.toString(),
    //   data: encodeFunctionData({
    //     abi,
    //     functionName: 'increment',
    //     args: [],
    //   }),
    // };

    const token = Counter.withAddress(`0x${'0721'.repeat(10)}`);
    await provider.tevmSetAccount(token);
    console.log(
      await provider.getCode({ address: contractAddress.toString() }),
    );

    console.log(
      await vm.stateManager.getContractStorage(
        contractAddress,
        // first storage slot
        setLengthLeft(bigIntToBytes(0n), 32),
      ),
    );

    // Run tx
    const txTevm = await provider.tevmCall({
      to: contractAddress.toString(),
      data: encodeFunctionData({
        abi,
        functionName: 'increment',
        args: [],
      }),
      createAccessList: true,
      createTrace: true,
    });
    console.log(txTevm);

    // const tx = await vm.runTx({
    //   reportAccessList: true,
    //   //   tx: createImpersonatedTx({
    //   //     impersonatedAddress: createAddress(account),
    //   //     to: contractAddress.toString(),
    //   //     data: encodeFunctionData({
    //   //       abi,
    //   //       functionName: 'increment',
    //   //       args: [],
    //   //     }),
    //   //     gasLimit: 1_000_000,
    //   //     maxFeePerGas: 1_000_000_000,
    //   //   }),
    //   tx: createImpersonatedTxAccessList(
    //     new AccessListEIP2930Transaction({
    //       to: contractAddress.toString(),
    //       data: encodeFunctionData({
    //         abi,
    //         functionName: 'increment',
    //         args: [],
    //       }),
    //       gasLimit: 1_000_000,
    //       gasPrice: 1_000_000_000,
    //     }),
    //     createAddress(account),
    //   ),
    //   skipBalance: true,
    // });
    if (txTevm.txHash)
      await provider.waitForTransactionReceipt({ hash: txTevm.txHash });
    // console.log(tx);

    console.log(
      await vm.stateManager.getContractStorage(
        contractAddress,
        setLengthLeft(bigIntToBytes(0n), 32),
      ),
    );
    console.log(await provider.tevmDumpState());

    console.log(
      await provider.tevmContract({
        abi,
        functionName: 'number22',
        deployedBytecode: counterBytecode,
        args: [],
      }),
    );
  } catch (error) {
    console.error('Failed to load storage:', error);
  }
};

loadStorage();

// 1. Run tx and see affected accounts
// 2. Backward fork, dump storage of these accounts
// 3. Run tx with tevm, dump storage of these accounts
// 4. Compare for each and interpret
