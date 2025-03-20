// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

contract DelegateLogic {
    // Storage layout must match DelegateBase
    address public implementation;
    uint256 private value;
    mapping(address => uint256) private balances;
    
    function doubleValue() public {
        value = value * 2;
    }
    
    function addToValue(uint256 amount) public {
        value += amount;
    }
    
    function incrementBalance(address user) public {
        balances[user] += 1;
    }
    
    function addToBalance(address user, uint256 amount) public {
        balances[user] += amount;
    }
    
    function transferBalance(address from, address to, uint256 amount) public {
        require(balances[from] >= amount, "Insufficient balance");
        balances[from] -= amount;
        balances[to] += amount;
    }
    
    // This function will manipulate multiple storage slots
    function multiUpdate(address user1, address user2, uint256 amount) public {
        value += amount;
        balances[user1] += amount / 2;
        balances[user2] += amount / 2;
    }
}