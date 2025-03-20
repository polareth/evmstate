// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./ContractC.s.sol";

contract ContractB {
    uint256 private valueB;
    ContractC private contractC;
    
    constructor(address _contractC) {
        contractC = ContractC(_contractC);
    }
    
    function setValueB(uint256 newValue) public {
        valueB = newValue;
    }
    
    function getValueB() public view returns (uint256) {
        return valueB;
    }
    
    function incrementValueB() public {
        valueB++;
    }
    
    function setValueC(uint256 newValue) public {
        contractC.setValueC(newValue);
    }
    
    function getValueC() public view returns (uint256) {
        return contractC.getValueC();
    }
    
    function updateBAndC(uint256 newValueB, uint256 newValueC) public {
        valueB = newValueB;
        contractC.setValueC(newValueC);
    }
    
    function callFromAToC(uint256 newValueC) public {
        contractC.setValueC(newValueC);
    }
}