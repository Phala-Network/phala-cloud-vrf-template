import { readFileSync, writeFileSync } from 'fs';
import { compile } from 'solc';

const source = readFileSync('./contracts/VRFCoordinator.sol', 'utf-8');

const input = {
  language: 'Solidity',
  sources: { 'VRFCoordinator.sol': { content: source } },
  settings: { outputSelection: { '*': { '*': ['*'] } } }
};
const output = JSON.parse(compile(JSON.stringify(input)));
const contract = output.contracts['VRFCoordinator.sol']['VRFCoordinator'];

writeFileSync('./artifacts/VRFCoordinatorAbi.json', JSON.stringify(contract.abi, null, 2));
writeFileSync('./artifacts/VRFCoordinatorBytecode.txt', contract.evm.bytecode.object);

console.log('Contract compiled !');