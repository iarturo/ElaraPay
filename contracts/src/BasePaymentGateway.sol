// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract BasePaymentGateway is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    IERC20 public immutable usdc;

    enum Status { None, Paid, Shipped, Refunded }
    struct Order { address buyer; uint256 amount; Status status; uint64 paidAt; }
    mapping(bytes32 => Order) public orders;

    event PaymentReceived(address indexed buyer, string orderId, uint256 amount);
    event OrderShipped(string orderId);
    event OrderRefunded(string orderId, uint256 amount);

    error ZeroAmount(); error EmptyOrderId(); error OrderAlreadyPaid(); error InvalidStatus();

    constructor(address _usdc) Ownable(msg.sender) { usdc = IERC20(_usdc); }

    function payForOrder(uint256 amount, string calldata orderId) public whenNotPaused {
        _pay(amount, orderId);
    }

    function payWithPermit(uint256 amount, string calldata orderId, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external whenNotPaused {
        IERC20Permit(address(usdc)).permit(msg.sender, address(this), amount, deadline, v, r, s);
        _pay(amount, orderId);
    }

    function _pay(uint256 amount, string calldata orderId) internal nonReentrant {
        if (amount==0) revert ZeroAmount();
        if (bytes(orderId).length==0) revert EmptyOrderId();
        bytes32 id = keccak256(bytes(orderId));
        if (orders[id].status!= Status.None) revert OrderAlreadyPaid();
        orders[id] = Order(msg.sender, amount, Status.Paid, uint64(block.timestamp));
        emit PaymentReceived(msg.sender, orderId, amount);
        usdc.safeTransferFrom(msg.sender, owner(), amount);
    }

    // --- admin ---
    function markShipped(string calldata orderId) external onlyOwner {
        bytes32 id = keccak256(bytes(orderId));
        if (orders[id].status!= Status.Paid) revert InvalidStatus();
        orders[id].status = Status.Shipped;
        emit OrderShipped(orderId);
    }
    function refund(string calldata orderId) external onlyOwner nonReentrant {
        bytes32 id = keccak256(bytes(orderId));
        Order storage o = orders[id];
        if (o.status!= Status.Paid) revert InvalidStatus();
        o.status = Status.Refunded;
        emit OrderRefunded(orderId, o.amount);
        usdc.safeTransfer(o.buyer, o.amount);
    }
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}