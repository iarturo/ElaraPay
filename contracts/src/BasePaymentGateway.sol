// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

contract BasePaymentGateway {
    address public immutable owner;
    IERC20 public immutable usdc;
    mapping(bytes32 => bool) public orderFulfilled;

    event PaymentReceived(address indexed buyer, string orderId, uint256 amount);

    error ZeroAmount();
    error EmptyOrderId();
    error OrderAlreadyPaid(string orderId);
    error InsufficientAllowance(uint256 required, uint256 actual);
    error TransferFailed();

    constructor(address _usdcAddress) {
        require(_usdcAddress!= address(0), "USDC zero");
        owner = msg.sender;
        usdc = IERC20(_usdcAddress);
    }

    function payForOrder(uint256 amount, string calldata orderId) external {
        if (amount == 0) revert ZeroAmount();
        if (bytes(orderId).length == 0) revert EmptyOrderId();

        bytes32 id = keccak256(bytes(orderId));
        if (orderFulfilled[id]) revert OrderAlreadyPaid(orderId);

        uint256 allowed = usdc.allowance(msg.sender, address(this));
        if (allowed < amount) revert InsufficientAllowance(amount, allowed);

        orderFulfilled[id] = true;

        bool success = usdc.transferFrom(msg.sender, owner, amount);
        if (!success) revert TransferFailed();

        emit PaymentReceived(msg.sender, orderId, amount);
    }

    function checkAllowance(address user) external view returns (uint256) {
        return usdc.allowance(user, address(this));
    }
}
