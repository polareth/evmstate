// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./ContractB.s.sol";

contract ContractA {
    uint256 private valueA;
    ContractB private contractB;
    
    constructor(address _contractB) {
        contractB = ContractB(_contractB);
    }
    
    function setValueA(uint256 newValue) public {
        valueA = newValue;
    }
    
    function getValueA() public view returns (uint256) {
        return valueA;
    }
    
    function setValueB(uint256 newValue) public {
        contractB.setValueB(newValue);
    }
    
    function getValueB() public view returns (uint256) {
        return contractB.getValueB();
    }
    
    function incrementBoth() public {
        valueA++;
        contractB.incrementValueB();
    }
    
    function updateBoth(uint256 newValueA, uint256 newValueB) public {
        valueA = newValueA;
        contractB.setValueB(newValueB);
    }
}