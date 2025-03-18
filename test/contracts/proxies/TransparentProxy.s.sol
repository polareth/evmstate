// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

// Implementation contract
contract CounterImpl {
    // Storage layout must be compatible across upgrades
    uint256 private _count;
    
    function getCount() public view returns (uint256) {
        return _count;
    }
    
    function increment() public {
        _count += 1;
    }
    
    function setCount(uint256 newCount) public {
        _count = newCount;
    }
}

// Enhanced implementation with additional functionality
contract CounterImplV2 {
    // Storage layout must match the previous version
    uint256 private _count;
    
    // New storage variables must be added after existing ones
    bool private _paused;
    
    function getCount() public view returns (uint256) {
        return _count;
    }
    
    function increment() public {
        require(!_paused, "Contract is paused");
        _count += 1;
    }
    
    function setCount(uint256 newCount) public {
        require(!_paused, "Contract is paused");
        _count = newCount;
    }
    
    function setPaused(bool paused) public {
        _paused = paused;
    }
    
    function isPaused() public view returns (bool) {
        return _paused;
    }
}

// Proxy contract that delegates calls to the implementation
contract TransparentProxy {
    address private _implementation;
    address private _admin;
    
    // Storage gap to avoid storage collision with implementation
    uint256[50] private __gap;
    
    constructor(address implementation_, address admin_) {
        _implementation = implementation_;
        _admin = admin_;
    }
    
    // Admin functions
    function changeImplementation(address newImplementation) public {
        require(msg.sender == _admin, "Only admin can change implementation");
        _implementation = newImplementation;
    }
    
    function getImplementation() public view returns (address) {
        return _implementation;
    }
    
    // Fallback function to delegate calls to the implementation
    fallback() external payable {
        address implementation = _implementation;
        require(implementation != address(0), "Implementation not set");
        
        assembly {
            // Copy calldata to memory
            calldatacopy(0, 0, calldatasize())
            
            // Delegate call to the implementation
            let result := delegatecall(gas(), implementation, 0, calldatasize(), 0, 0)
            
            // Copy the returned data
            returndatacopy(0, 0, returndatasize())
            
            // Return or revert based on the delegatecall result
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }
    
    // Required to receive ETH
    receive() external payable {}
}