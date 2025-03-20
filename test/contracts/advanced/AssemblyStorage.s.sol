// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

contract AssemblyStorage {
    uint256 private value;
    mapping(address => uint256) private balances;
    
    // Standard Solidity function
    function setValue(uint256 newValue) public {
        value = newValue;
    }
    
    // Assembly to read storage directly
    function getValueAssembly() public view returns (uint256 result) {
        // The value is at slot 0
        assembly {
            result := sload(0)
        }
    }
    
    // Assembly to write storage directly
    function setValueAssembly(uint256 newValue) public {
        assembly {
            sstore(0, newValue)
        }
    }
    
    // Standard Solidity function for comparison
    function getValue() public view returns (uint256) {
        return value;
    }
    
    // Set balance using standard Solidity
    function setBalance(address user, uint256 amount) public {
        balances[user] = amount;
    }
    
    // Get balance using standard Solidity
    function getBalance(address user) public view returns (uint256) {
        return balances[user];
    }
    
    // Set balance using assembly
    function setBalanceAssembly(address user, uint256 amount) public {
        // For mappings, the slot is keccak256(key . mappingSlot)
        bytes32 slot;
        assembly {
            // Store user address in scratch space
            mstore(0, user)
            // Store mapping slot (1) in the next 32 bytes
            mstore(32, 1)
            // Calculate hash to get the storage slot
            slot := keccak256(0, 64)
            // Store the amount at the calculated slot
            sstore(slot, amount)
        }
    }
    
    // Get balance using assembly
    function getBalanceAssembly(address user) public view returns (uint256 result) {
        bytes32 slot;
        assembly {
            mstore(0, user)
            mstore(32, 1)
            slot := keccak256(0, 64)
            result := sload(slot)
        }
    }
    
    // Function that accesses multiple storage slots using assembly
    function batchUpdateAssembly(uint256 newValue, address[] calldata users, uint256[] calldata amounts) public {
        require(users.length == amounts.length, "Array length mismatch");
        
        // Update the main value
        assembly {
            sstore(0, newValue)
        }
        
        // Update balances for multiple users
        for (uint i = 0; i < users.length; i++) {
            bytes32 slot;
            assembly {
                // Get the address at index i
                let user := calldataload(add(users.offset, mul(i, 32)))
                
                // Calculate storage slot
                mstore(0, user)
                mstore(32, 1)
                slot := keccak256(0, 64)
                
                // Get the amount at index i
                let amount := calldataload(add(amounts.offset, mul(i, 32)))
                
                // Store the amount
                sstore(slot, amount)
            }
        }
    }
}