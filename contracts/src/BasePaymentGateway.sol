// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract BasePaymentGateway is Ownable2Step, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    mapping(bytes32 => bool) public orderFulfilled;

    event PaymentReceived(address indexed buyer, string orderId, uint256 amount);

    error ZeroAmount();
    error EmptyOrderId();
    error OrderAlreadyPaid(string orderId);

    constructor(address _usdc) Ownable(msg.sender) {
        require(_usdc!= address(0), "USDC zero");
        usdc = IERC20(_usdc);
    }

    function payForOrder(uint256 amount, string calldata orderId) external whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (bytes(orderId).length == 0) revert EmptyOrderId();

        bytes32 id = keccak256(bytes(orderId));
        if (orderFulfilled[id]) revert OrderAlreadyPaid(orderId);

        orderFulfilled[id] = true;
        usdc.safeTransferFrom(msg.sender, owner(), amount);

        emit PaymentReceived(msg.sender, orderId, amount);
    }

    // ─── View helper que usa tu test ───────────────
    function checkAllowance(address user) external view returns (uint256) {
        return usdc.allowance(user, address(this));
    }

    // ─── Admin ─────────────────────────────────────
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}