// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title Factory
 * @notice A contract that creates other contracts during function execution
 */
contract Factory {
    // Created contract addresses are stored here
    address[] private createdContracts;
    
    /**
     * @notice Creates a new SimpleContract with the given value
     * @param initialValue The initial value to set in the created contract
     * @return The address of the newly created contract
     */
    function createContract(uint256 initialValue) external returns (address) {
        SimpleContract newContract = new SimpleContract(initialValue);
        createdContracts.push(address(newContract));
        return address(newContract);
    }
    
    /**
     * @notice Get all contracts created by this factory
     * @return Array of created contract addresses
     */
    function getCreatedContracts() external view returns (address[] memory) {
        return createdContracts;
    }
}

/**
 * @title SimpleContract
 * @notice A simple contract created by the Factory
 */
contract SimpleContract {
    uint256 private value;
    
    constructor(uint256 initialValue) {
        value = initialValue;
    }
    
    function setValue(uint256 newValue) external {
        value = newValue;
    }

    function getValue() external view returns (uint256) {
        return value;
    }
}
