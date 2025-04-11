// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

contract StoragePacking {
    // These variables will be packed into a single storage slot
    // uint8 (1 byte) + uint8 (1 byte) + bool (1 byte) + address (20 bytes) = 23 bytes < 32 bytes
    uint8 private smallValue1;
    uint8 private smallValue2;
    bool private flag;
    address private someAddress;
    
    // These will each occupy their own slots
    uint256 private largeValue1;
    bytes32 private data;
    
    // These variables will be packed into another single slot
    // uint16 (2 bytes) + uint32 (4 bytes) + uint64 (8 bytes) = 14 bytes < 32 bytes
    uint16 private mediumValue1;
    uint32 private mediumValue2;
    uint64 private mediumValue3;
    
    function setSmallValues(uint8 _value1, uint8 _value2, bool _flag, address _addr) public {
        smallValue1 = _value1;
        smallValue2 = _value2;
        flag = _flag;
        someAddress = _addr;
    }
    
    function setData(bytes32 _data) public {
        data = _data;
    }
    
    function getData() public view returns (bytes32) {
        return data;
    }
    
    function setSmallValue1(uint8 _value) public {
        smallValue1 = _value;
    }
    
    function setMediumValues(uint16 _value1, uint32 _value2, uint64 _value3) public {
        mediumValue1 = _value1;
        mediumValue2 = _value2;
        mediumValue3 = _value3;
    }
    
    function setMediumValue1(uint16 _value) public {
        mediumValue1 = _value;
    }
    
    function setLargeValue1(uint256 _value) public {
        largeValue1 = _value;
    }
    
    function getSmallValues() public view returns (uint8, uint8, bool, address) {
        return (smallValue1, smallValue2, flag, someAddress);
    }
    
    function getMediumValues() public view returns (uint16, uint32, uint64) {
        return (mediumValue1, mediumValue2, mediumValue3);
    }
    
    function getLargeValue1() public view returns (uint256) {
        return largeValue1;
    }

    // Function that modifies values in multiple slots
    function updateAllValues(
        uint8 _small1, 
        uint8 _small2, 
        uint16 _medium1, 
        uint32 _medium2,
        uint256 _large1
    ) public {
        smallValue1 = _small1;
        smallValue2 = _small2;
        mediumValue1 = _medium1;
        mediumValue2 = _medium2;
        largeValue1 = _large1;
    }
}