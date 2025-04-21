// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

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
    // EIP-1967 implementation slot: bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1)
    bytes32 private constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    // EIP-1967 admin slot: bytes32(uint256(keccak256("eip1967.proxy.admin")) - 1)
    bytes32 private constant _ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e019b2c8e8cbb2a6e0a23387fdaa12345;

    constructor(address implementation_, address admin_) {
        _setAdmin(admin_);
        _setImplementation(implementation_);
    }
    
    // Internal functions to set the implementation and admin using unstructured storage.
    function _setImplementation(address newImplementation) internal {
        require(newImplementation != address(0), "Invalid implementation");
        bytes32 slot = _IMPLEMENTATION_SLOT;
        assembly {
            sstore(slot, newImplementation)
        }
    }
    
    function _setAdmin(address newAdmin) internal {
        require(newAdmin != address(0), "Invalid admin");
        bytes32 slot = _ADMIN_SLOT;
        assembly {
            sstore(slot, newAdmin)
        }
    }
    
    function _getImplementation() internal view returns (address impl) {
        bytes32 slot = _IMPLEMENTATION_SLOT;
        assembly {
            impl := sload(slot)
        }
    }
    
    function _getAdmin() internal view returns (address adm) {
        bytes32 slot = _ADMIN_SLOT;
        assembly {
            adm := sload(slot)
        }
    }
    
    // Admin functions: Only the admin can change the implementation.
    function changeImplementation(address newImplementation) public {
        require(msg.sender == _getAdmin(), "Only admin can change implementation");
        _setImplementation(newImplementation);
    }
    
    function getImplementation() public view returns (address) {
        return _getImplementation();
    }
    
    function getAdmin() public view returns (address) {
        return _getAdmin();
    }
    
    // Fallback function that delegates calls to the implementation.
    fallback() external payable {
        address implementation = _getImplementation();
        require(implementation != address(0), "Implementation not set");
        
        assembly {
            // Copy the calldata into memory starting at position 0.
            calldatacopy(0, 0, calldatasize())
            // Delegate call to the implementation.
            let result := delegatecall(gas(), implementation, 0, calldatasize(), 0, 0)
            // Retrieve the size of the returned data.
            let size := returndatasize()
            // Copy the returned data.
            returndatacopy(0, 0, size)
            // Forward the returned data or revert.
            switch result
            case 0 { revert(0, size) }
            default { return(0, size) }
        }
    }
    
    // Receive function to accept ETH.
    receive() external payable {}
}