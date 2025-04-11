// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title NativeTransfer
 * @notice A contract that demonstrates native ETH transfers
 */
contract NativeTransfer {    
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
    // Allow the contract to receive ETH
    receive() external payable {}
    
    /**
     * @notice Get the contract's current ETH balance
     * @return The contract's balance in wei
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}