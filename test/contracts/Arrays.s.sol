// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

contract Arrays {
    // Fixed-size array
    uint256[5] private fixedArray;
    
    // Dynamic array
    uint256[] private dynamicArray;
    
    // Array of structs
    struct Item {
        uint256 id;
        string name;
        bool active;
    }
    Item[] private items;
    
    // Nested arrays
    uint256[][] private nestedArrays;

    function setFixedArrayValue(uint256 index, uint256 value) public {
        require(index < 5, "Index out of bounds");
        fixedArray[index] = value;
    }
    
    function getFixedArrayValue(uint256 index) public view returns (uint256) {
        require(index < 5, "Index out of bounds");
        return fixedArray[index];
    }
    
    function pushToDynamicArray(uint256 value) public {
        dynamicArray.push(value);
    }
    
    function updateDynamicArray(uint256 index, uint256 value) public {
        require(index < dynamicArray.length, "Index out of bounds");
        dynamicArray[index] = value;
    }
    
    function getDynamicArrayValue(uint256 index) public view returns (uint256) {
        require(index < dynamicArray.length, "Index out of bounds");
        return dynamicArray[index];
    }
    
    function getDynamicArrayLength() public view returns (uint256) {
        return dynamicArray.length;
    }
    
    function addItem(uint256 id, string memory name) public {
        items.push(Item(id, name, true));
    }
    
    function updateItem(uint256 index, uint256 id, string memory name, bool active) public {
        require(index < items.length, "Index out of bounds");
        items[index] = Item(id, name, active);
    }
    
    function toggleItemActive(uint256 index) public {
        require(index < items.length, "Index out of bounds");
        items[index].active = !items[index].active;
    }
    
    function getItem(uint256 index) public view returns (Item memory) {
        require(index < items.length, "Index out of bounds");
        return items[index];
    }
    
    function addNestedArray() public {
        nestedArrays.push();
    }
    
    function pushToNestedArray(uint256 outerIndex, uint256 value) public {
        require(outerIndex < nestedArrays.length, "Outer index out of bounds");
        nestedArrays[outerIndex].push(value);
    }
    
    function updateNestedArray(uint256 outerIndex, uint256 innerIndex, uint256 value) public {
        require(outerIndex < nestedArrays.length, "Outer index out of bounds");
        require(innerIndex < nestedArrays[outerIndex].length, "Inner index out of bounds");
        nestedArrays[outerIndex][innerIndex] = value;
    }
    
    function getNestedArrayValue(uint256 outerIndex, uint256 innerIndex) public view returns (uint256) {
        require(outerIndex < nestedArrays.length, "Outer index out of bounds");
        require(innerIndex < nestedArrays[outerIndex].length, "Inner index out of bounds");
        return nestedArrays[outerIndex][innerIndex];
    }
}