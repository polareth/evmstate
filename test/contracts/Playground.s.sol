// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title Playground
 * @notice A comprehensive contract demonstrating various Solidity storage patterns
 */
contract Playground {
    // --- Value Types ---
    uint256 public counter;                // Simple counter (slot 0)
    bool public isActive;                  // Boolean flag (slot 1)
    address public owner;                  // Address (slot 2)
    
    // --- Packed Storage ---
    // All packed into a single slot (slot 3)
    uint8 public smallCounter;             // 1 byte
    uint16 public mediumCounter;           // 2 bytes
    uint32 public largeCounter;            // 4 bytes
    bool public isLocked;                  // 1 byte
    address public operator;               // 20 bytes (total: 28 bytes < 32)
    
    // --- Strings and Bytes ---
    string public name;                    // Short string (slot 4)
    bytes public data;                     // Dynamic bytes (slot 5)
    
    // --- Mappings ---
    mapping(address => uint256) public balances;                // Simple mapping (slot 6)
    mapping(address => mapping(address => uint256)) public allowances;  // Nested mapping (slot 7)
    
    // --- Arrays ---
    uint256[] public values;               // Dynamic array (length at slot 8, data at keccak256(8))
    uint256[3] public fixedValues;         // Fixed array (slots 9, 10, 11)
    
    // --- Structs ---
    struct User {
        uint256 id;
        string username;
        bool active;
    }
    
    User public admin;                     // Struct (starts at slot 12)
    mapping(address => User) public users; // Mapping to struct (slot 13)
    User[] public userList;                // Array of structs (length at slot 14, data at keccak256(14))
    
    // --- Nested Types ---
    mapping(uint256 => uint256[]) public userTransactions; // Mapping to array (slot 15)
    
    /**
     * @notice Initialize the contract with basic values
     * @param _owner The owner address
     * @param _name The contract name
     */
    constructor(address _owner, string memory _name) {
        owner = _owner;
        name = _name;
        isActive = true;
        
        // Initialize admin
        admin = User(1, "admin", true);
    }
    
    /**
     * @notice Update basic value types
     * @param _counter New counter value
     * @param _isActive New active state
     */
    function updateBasicValues(uint256 _counter, bool _isActive) external {
        counter = _counter;
        isActive = _isActive;
    }
    
    /**
     * @notice Update packed storage values
     * @param _small Small counter value
     * @param _medium Medium counter value
     * @param _large Large counter value
     * @param _locked Locked state
     */
    function updatePackedValues(uint8 _small, uint16 _medium, uint32 _large, bool _locked) external {
        smallCounter = _small;
        mediumCounter = _medium;
        largeCounter = _large;
        isLocked = _locked;
    }
    
    /**
     * @notice Set string and bytes values
     * @param _name New name string
     * @param _data New bytes data
     */
    function setStringAndBytes(string memory _name, bytes memory _data) external {
        name = _name;
        data = _data;
    }
    
    /**
     * @notice Update balance for an address
     * @param _user User address
     * @param _amount New balance amount
     */
    function setBalance(address _user, uint256 _amount) external {
        balances[_user] = _amount;
    }
    
    /**
     * @notice Set allowance between two addresses
     * @param _owner Owner address
     * @param _spender Spender address
     * @param _amount Allowance amount
     */
    function setAllowance(address _owner, address _spender, uint256 _amount) external {
        allowances[_owner][_spender] = _amount;
    }
    
    /**
     * @notice Add a value to the dynamic array
     * @param _value Value to add
     */
    function addValue(uint256 _value) external {
        values.push(_value);
    }
    
    /**
     * @notice Update a value in the fixed array
     * @param _index Array index
     * @param _value New value
     */
    function setFixedValue(uint256 _index, uint256 _value) external {
        require(_index < 3, "Index out of bounds");
        fixedValues[_index] = _value;
    }
    
    /**
     * @notice Add a new user
     * @param _user User address
     * @param _id User ID
     * @param _username Username
     */
    function addUser(address _user, uint256 _id, string memory _username) external {
        users[_user] = User(_id, _username, true);
        userList.push(User(_id, _username, true));
    }
    
    /**
     * @notice Toggle user active status
     * @param _user User address
     */
    function toggleUserActive(address _user) external {
        users[_user].active = !users[_user].active;
    }
    
    /**
     * @notice Add a transaction for a user
     * @param _userId User ID
     * @param _amount Transaction amount
     */
    function addTransaction(uint256 _userId, uint256 _amount) external {
        userTransactions[_userId].push(_amount);
    }
    
    /**
     * @notice Get user transactions
     * @param _userId User ID
     * @return Array of transaction amounts
     */
    function getUserTransactions(uint256 _userId) external view returns (uint256[] memory) {
        return userTransactions[_userId];
    }
    
    /**
     * @notice Get user details
     * @param _user User address
     * @return User struct
     */
    function getUserDetails(address _user) external view returns (User memory) {
        return users[_user];
    }
}