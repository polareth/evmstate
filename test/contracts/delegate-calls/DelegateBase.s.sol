// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

contract DelegateBase {
    address public implementation;
    uint256 private value;
    mapping(address => uint256) private balances;
    
    function setValue(uint256 newValue) public {
        value = newValue;
    }
    
    function getValue() public view returns (uint256) {
        return value;
    }
    
    function setBalance(address user, uint256 amount) public {
        balances[user] = amount;
    }
    
    function getBalance(address user) public view returns (uint256) {
        return balances[user];
    }
    
    function delegateToImplementation(bytes memory data) public returns (bytes memory) {
        require(implementation != address(0), "Implementation not set");
        
        (bool success, bytes memory returnData) = implementation.delegatecall(data);
        require(success, "Delegate call failed");
        
        return returnData;
    }
    
    function setImplementation(address newImplementation) public {
        implementation = newImplementation;
    }
}