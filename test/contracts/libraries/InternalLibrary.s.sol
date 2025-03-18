// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

library InternalLibrary {
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        return a + b;
    }
    
    function subtract(uint256 a, uint256 b) internal pure returns (uint256) {
        require(a >= b, "Underflow");
        return a - b;
    }
    
    function multiply(uint256 a, uint256 b) internal pure returns (uint256) {
        return a * b;
    }
    
    function divide(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b > 0, "Division by zero");
        return a / b;
    }
}