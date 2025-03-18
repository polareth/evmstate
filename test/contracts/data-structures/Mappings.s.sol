// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

contract Mappings {
    // Simple mapping
    mapping(address => uint256) private balances;
    
    // Nested mapping
    mapping(address => mapping(address => uint256)) private allowances;
    
    // Mapping to a struct
    struct UserInfo {
        uint256 balance;
        uint256 lastUpdate;
        bool isActive;
    }
    mapping(address => UserInfo) private userInfo;

    function setBalance(address user, uint256 amount) public {
        balances[user] = amount;
    }

    function getBalance(address user) public view returns (uint256) {
        return balances[user];
    }

    function setAllowance(address owner, address spender, uint256 amount) public {
        allowances[owner][spender] = amount;
    }

    function getAllowance(address owner, address spender) public view returns (uint256) {
        return allowances[owner][spender];
    }

    function setUserInfo(address user, uint256 balance, uint256 lastUpdate, bool isActive) public {
        userInfo[user] = UserInfo(balance, lastUpdate, isActive);
    }

    function getUserInfo(address user) public view returns (UserInfo memory) {
        return userInfo[user];
    }

    function updateUserBalance(address user, uint256 newBalance) public {
        UserInfo storage info = userInfo[user];
        info.balance = newBalance;
        info.lastUpdate = block.timestamp;
    }
}