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

    // Fixed-size packed array (uint128 = 16 bytes)
    // Elements 0, 1 occupy Slot 8
    // Elements 2, 3 occupy Slot 9
    uint128[4] private packedFixedArray;

    // Dynamic bytes array
    // Length occupies Slot 10
    // Data starts at keccak256(slot(10))
    bytes[] private bytesDynamicArray;

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

    /**
     * @notice Sets a value in the fixed-size packed array (uint128[4]).
     * @param indexes The indexes to set (0-3).
     * @param values The uint128 values to set.
     */
    function setPackedFixed(uint256[] memory indexes, uint128[] memory values) public {
        require(indexes.length == values.length, "Indexes and values length mismatch");
        for (uint256 i = 0; i < indexes.length; i++) {
            require(indexes[i] < 4, "Index out of bounds");
            packedFixedArray[indexes[i]] = values[i];
        }
    }

    /**
     * @notice Gets a value from the fixed-size packed array (uint128[4]).
     * @param index The index to get (0-3).
     * @return The uint128 value at the index.
     */
    function getPackedFixed(uint256 index) public view returns (uint128) {
        require(index < 4, "Index out of bounds");
        return packedFixedArray[index];
    }

    /**
     * @notice Set a bytes value to the dynamic bytes array.
     * @param value The bytes value to set.
     */
    function setBytesDynamic(uint256 index, bytes memory value) public {
        if (index >= bytesDynamicArray.length) {
            bytesDynamicArray.push(value);
        } else {
            bytesDynamicArray[index] = value;
        }
    }

    /**
     * @notice Gets a bytes value from the dynamic bytes array.
     * @param index The index to get.
     * @return The bytes value at the index.
     */
    function getBytesDynamic(uint256 index) public view returns (bytes memory) {
        require(index < bytesDynamicArray.length, "Index out of bounds");
        return bytesDynamicArray[index];
    }

    /**
     * @notice Gets the length of the dynamic bytes array.
     * @return The length of the array.
     */
    function getBytesDynamicLength() public view returns (uint256) {
        return bytesDynamicArray.length;
    }
}