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

    enum Status { None, Created, Paid, Shipped, Refunded }
    struct Order { address buyer; uint256 amount; Status status; uint64 paidAt; }
    mapping(bytes32 => Order) public orders;

    event OrderCreated(string orderId, address buyer, uint256 amount);
    event PaymentReceived(address indexed buyer, string orderId, uint256 amount);
    event OrderShipped(string orderId);
    event OrderRefunded(string orderId, uint256 amount);

    error ZeroAmount(); error EmptyOrderId(); error OrderAlreadyExists();
    error WrongAmount(); error NotBuyer(); error InvalidStatus();

    constructor(address _usdc) Ownable(msg.sender) { usdc = IERC20(_usdc); }

    // --- 2. BACKEND CREA LA ORDEN CON PRECIO FIJO ---
    function createOrder(string calldata orderId, uint256 amount, address buyer) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        if (bytes(orderId).length == 0) revert EmptyOrderId();
        bytes32 id = keccak256(bytes(orderId));
        if (orders[id].status!= Status.None) revert OrderAlreadyExists();

        orders[id] = Order(buyer, amount, Status.Created, 0);
        emit OrderCreated(orderId, buyer, amount);
    }

    function payForOrder(uint256 amount, string calldata orderId) external whenNotPaused nonReentrant {
        _pay(amount, orderId);
    }

    function payWithPermit(
        uint256 amount,
        string calldata orderId,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external whenNotPaused nonReentrant {
        // Si no hay allowance suficiente, intenta el permit
        // Si falla porque el nonce ya se usó, no reviertas
        if (usdc.allowance(msg.sender, address(this)) < amount) {
            try IERC20Permit(address(usdc)).permit(
                msg.sender,
                address(this),
                amount,
                deadline,
                v,
                r,
                s
            ) {} catch {}
        }
        _pay(amount, orderId);
    }

    function _pay(uint256 amount, string calldata orderId) internal {
        bytes32 id = keccak256(bytes(orderId));
        Order storage o = orders[id];

        // 2. VALIDA PRECIO Y BUYER
        if (o.status!= Status.Created) revert InvalidStatus();
        if (o.amount!= amount) revert WrongAmount(); // ← no más 1 wei
        if (msg.sender!= o.buyer) revert NotBuyer(); // ← cierra #3

        o.status = Status.Paid;
        o.paidAt = uint64(block.timestamp);
        emit PaymentReceived(msg.sender, orderId, amount);

        // 1. ESCROW: dinero se queda en el contrato
        usdc.safeTransferFrom(msg.sender, address(this), amount);
    }

    // --- admin ---
    function markShipped(string calldata orderId) external onlyOwner nonReentrant {
        bytes32 id = keccak256(bytes(orderId));
        Order storage o = orders[id];
        if (o.status!= Status.Paid) revert InvalidStatus();
        o.status = Status.Shipped;
        emit OrderShipped(orderId);
        usdc.safeTransfer(owner(), o.amount);
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