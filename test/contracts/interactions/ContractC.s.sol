// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

contract ContractC {
    uint256 private valueC;
    
    function setValueC(uint256 newValue) public {
        valueC = newValue;
    }
    
    function getValueC() public view returns (uint256) {
        return valueC;
    }
    
    function incrementValueC() public {
        valueC++;
    }
}