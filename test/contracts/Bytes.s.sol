// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Bytes
 * @notice A contract for testing storage access patterns of string and bytes types.
 */
contract Bytes {
    string public myString; // slot 0
    bytes public myBytes;   // slot 1

    /**
     * @notice Sets the value of the public string variable `myString`.
     * @param _value The new string value.
     */
    function setString(string memory _value) public {
        myString = _value;
    }

    /**
     * @notice Gets the value of the public string variable `myString`.
     * @return The current string value.
     */
    function getString() public view returns (string memory) {
        return myString;
    }

    /**
     * @notice Sets the value of the public bytes variable `myBytes`.
     * @param _value The new bytes value.
     */
    function setBytes(bytes memory _value) public {
        myBytes = _value;
    }

    /**
     * @notice Gets the value of the public bytes variable `myBytes`.
     * @return The current bytes value.
     */
    function getBytes() public view returns (bytes memory) {
        return myBytes;
    }

    /**
     * @notice Clears the string variable `myString` (sets it to empty).
     */
    function clearString() public {
        myString = "";
    }

    /**
     * @notice Clears the bytes variable `myBytes` (sets it to empty).
     */
    function clearBytes() public {
        myBytes = "";
    }
}