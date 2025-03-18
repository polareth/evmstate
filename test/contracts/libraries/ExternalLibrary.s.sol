// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

library ExternalLibrary {
    struct Data {
        uint256 value;
        bool initialized;
    }
    
    function initialize(Data storage data, uint256 initialValue) external returns (bool) {
        require(!data.initialized, "Already initialized");
        data.value = initialValue;
        data.initialized = true;
        return true;
    }
    
    function setValue(Data storage data, uint256 newValue) external {
        require(data.initialized, "Not initialized");
        data.value = newValue;
    }
    
    function getValue(Data storage data) external view returns (uint256) {
        require(data.initialized, "Not initialized");
        return data.value;
    }
    
    function increment(Data storage data) external {
        require(data.initialized, "Not initialized");
        data.value += 1;
    }
    
    function decrement(Data storage data) external {
        require(data.initialized, "Not initialized");
        require(data.value > 0, "Value already 0");
        data.value -= 1;
    }
}