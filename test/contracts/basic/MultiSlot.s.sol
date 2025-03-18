// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

contract MultiSlot {
    // Each of these variables occupies a different storage slot
    uint256 private value1;
    uint256 private value2;
    uint256 private value3;
    bytes32 private data;
    bool private flag;

    function setValue1(uint256 newValue) public {
        value1 = newValue;
    }

    function setValue2(uint256 newValue) public {
        value2 = newValue;
    }

    function setValue3(uint256 newValue) public {
        value3 = newValue;
    }

    function setData(bytes32 newData) public {
        data = newData;
    }

    function setFlag(bool newFlag) public {
        flag = newFlag;
    }

    function setMultipleValues(uint256 val1, uint256 val2, uint256 val3) public {
        value1 = val1;
        value2 = val2;
        value3 = val3;
    }

    function getValue1() public view returns (uint256) {
        return value1;
    }

    function getValue2() public view returns (uint256) {
        return value2;
    }

    function getValue3() public view returns (uint256) {
        return value3;
    }

    function getData() public view returns (bytes32) {
        return data;
    }

    function getFlag() public view returns (bool) {
        return flag;
    }
}