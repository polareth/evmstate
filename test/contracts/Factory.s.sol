// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;
/**
 * @title Factory
 * @notice A contract that creates other contracts during function execution
 */
contract Factory {
    // Created contract addresses are stored here
    address[] private createdContracts;

    // Bytecode for deterministic metadata regardless of the environment (metadata part might differ)
    bytes private constant SIMPLE_CONTRACT_BYTECODE = hex"6080604052348015600e575f5ffd5b506040516101c73803806101c78339818101604052810190602e9190606b565b805f81905550506091565b5f5ffd5b5f819050919050565b604d81603d565b81146056575f5ffd5b50565b5f815190506065816046565b92915050565b5f60208284031215607d57607c6039565b5b5f6088848285016059565b91505092915050565b6101298061009e5f395ff3fe6080604052348015600e575f5ffd5b50600436106030575f3560e01c8063209652551460345780635524107714604e575b5f5ffd5b603a6066565b60405160459190608d565b60405180910390f35b606460048036038101906060919060cd565b606e565b005b5f5f54905090565b805f8190555050565b5f819050919050565b6087816077565b82525050565b5f602082019050609e5f8301846080565b92915050565b5f5ffd5b60af816077565b811460b8575f5ffd5b50565b5f8135905060c78160a8565b92915050565b5f6020828403121560df5760de60a4565b5b5f60ea8482850160bb565b9150509291505056fea2646970667358221220587a82a5cd5d6ac106b4cd4612863e3e1d4be092d681218aa1abd6b9104a77bb64736f6c634300081c0033";
    
    /**
     * @notice Creates a new SimpleContract with the given value
     * @param initialValue The initial value to set in the created contract
     * @return The address of the newly created contract
     */
    function createContract(uint256 initialValue) external returns (address) {
        bytes memory encodedParams = abi.encode(initialValue);
        bytes memory deploymentBytecode = abi.encodePacked(SIMPLE_CONTRACT_BYTECODE, encodedParams);
        
        address newContract;
        assembly {
            newContract := create(0, add(deploymentBytecode, 0x20), mload(deploymentBytecode))
            if iszero(extcodesize(newContract)) { revert(0, 0) }
        }
        
        createdContracts.push(newContract);
        return newContract;
    }
    
    /**
     * @notice Get all contracts created by this factory
     * @return Array of created contract addresses
     */
    function getCreatedContracts() external view returns (address[] memory) {
        return createdContracts;
    }
}

/**
 * @title SimpleContract
 * @notice A simple contract created by the Factory
 */
contract SimpleContract {
    uint256 private value;
    
    constructor(uint256 initialValue) {
        value = initialValue;
    }
    
    function setValue(uint256 newValue) external {
        value = newValue;
    }

    function getValue() external view returns (uint256) {
        return value;
    }
}
