// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "./InternalLibrary.s.sol";
import "./ExternalLibrary.s.sol";

contract LibraryUser {
    using InternalLibrary for uint256;
    using ExternalLibrary for ExternalLibrary.Data;
    
    uint256 private internalValue;
    ExternalLibrary.Data private externalData;
    
    function initializeExternalData(uint256 initialValue) public {
        externalData.initialize(initialValue);
    }
    
    function setExternalValue(uint256 newValue) public {
        externalData.setValue(newValue);
    }
    
    function getExternalValue() public view returns (uint256) {
        return externalData.getValue();
    }
    
    function incrementExternalValue() public {
        externalData.increment();
    }
    
    function decrementExternalValue() public {
        externalData.decrement();
    }
    
    function setInternalValue(uint256 newValue) public {
        internalValue = newValue;
    }
    
    function addToInternalValue(uint256 amount) public {
        internalValue = internalValue.add(amount);
    }
    
    function subtractFromInternalValue(uint256 amount) public {
        internalValue = internalValue.subtract(amount);
    }
    
    function multiplyInternalValue(uint256 factor) public {
        internalValue = internalValue.multiply(factor);
    }
    
    function divideInternalValue(uint256 divisor) public {
        internalValue = internalValue.divide(divisor);
    }
    
    function getInternalValue() public view returns (uint256) {
        return internalValue;
    }
    
    function performComplexOperation(uint256 a, uint256 b, uint256 c) public {
        uint256 temp = a.add(b);
        temp = temp.multiply(c);
        internalValue = temp;
        externalData.setValue(temp);
    }
}