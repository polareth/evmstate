// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title NativeTransfer
 * @notice A contract that demonstrates native ETH transfers
 */
contract NativeTransfer {
    // Track ETH transfer destinations
    mapping(address => uint256) public transferHistory;
    
    // Allow the contract to receive ETH
    receive() external payable {}
    
    /**
     * @notice Transfer ETH to a recipient using the transfer method
     * @param recipient The address to send ETH to
     * @param amount The amount of ETH to send (in wei)
     */
    function transferEth(address payable recipient, uint256 amount) external {
        require(address(this).balance >= amount, "Insufficient balance");
        recipient.transfer(amount);
        transferHistory[recipient] += amount;
    }
    
    /**
     * @notice Transfer ETH to a recipient using the send method
     * @param recipient The address to send ETH to
     * @param amount The amount of ETH to send (in wei)
     * @return success Whether the transfer succeeded
     */
    function sendEth(address payable recipient, uint256 amount) external returns (bool success) {
        require(address(this).balance >= amount, "Insufficient balance");
        success = recipient.send(amount);
        if (success) {
            transferHistory[recipient] += amount;
        }
        return success;
    }
    
    /**
     * @notice Transfer ETH to a recipient using the call method
     * @param recipient The address to send ETH to
     * @param amount The amount of ETH to send (in wei)
     * @return success Whether the transfer succeeded
     */
    function callEth(address payable recipient, uint256 amount) external returns (bool success) {
        require(address(this).balance >= amount, "Insufficient balance");
        (success, ) = recipient.call{value: amount}("");
        if (success) {
            transferHistory[recipient] += amount;
        }
        return success;
    }
    
    /**
     * @notice Get the contract's current ETH balance
     * @return The contract's balance in wei
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}

/**
 * @title ETHReceiver
 * @notice A contract that can receive ETH and store count of times it received ETH
 */
contract ETHReceiver {
    uint256 public receivedCount;
    uint256 public totalReceived;
    
    // Allow the contract to receive ETH
    receive() external payable {
        receivedCount++;
        totalReceived += msg.value;
    }
    
    // Fallback function in case receive is not matched
    fallback() external payable {
        receivedCount++;
        totalReceived += msg.value;
    }
    
    /**
     * @notice Get the contract's current ETH balance
     * @return The contract's balance in wei
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}