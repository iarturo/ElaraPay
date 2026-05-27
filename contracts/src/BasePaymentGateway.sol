// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IERC4626 is IERC20 {
    function asset() external view returns (address assetTokenAddress);
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
    function convertToAssets(uint256 shares) external view returns (uint256 assets);
}

contract BasePaymentGateway is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    IERC20 public immutable usdc;
    IERC4626 public immutable yieldVault;

    enum Status { None, Created, Paid, Shipped, Refunded }
    struct Order { address buyer; uint256 amount; Status status; uint64 paidAt; }
    mapping(bytes32 => Order) public orders;

    // --- M-02: Límites ---
    uint256 public minOrder = 1e6; // 1 USDC
    uint256 public maxOrder = 10_000e6; // 10,000 USDC

    // --- Yield Escrow State ---
    uint256 public pendingEscrowPrincipal;

    event OrderCreated(string orderId, address buyer, uint256 amount);
    event PaymentReceived(address indexed buyer, string orderId, uint256 amount);
    event OrderShipped(string orderId);
    event OrderRefunded(string orderId, uint256 amount);
    event LimitsUpdated(uint256 minOrder, uint256 maxOrder);
    event Rescued(address token, uint256 amount); // I-03
    event YieldClaimed(address indexed receiver, uint256 amount);

    error ZeroAmount();
    error EmptyOrderId();
    error OrderAlreadyExists();
    error WrongAmount();
    error NotBuyer();
    error InvalidStatus();
    error InvalidAmount();
    error InsufficientAllowance(); // M-04
    error ZeroAddress();

    constructor(address _usdc, address _yieldVault) Ownable(msg.sender) {
        if (_usdc == address(0) || _yieldVault == address(0)) revert ZeroAddress();
        usdc = IERC20(_usdc);
        yieldVault = IERC4626(_yieldVault);
    }

    // --- M-02: Admin set limits ---
    /// @notice Sets the minimum and maximum order amount allowed.
    function setLimits(uint256 _min, uint256 _max) external onlyOwner {
        if (_min == 0 || _max < _min) revert InvalidAmount();
        minOrder = _min;
        maxOrder = _max;
        emit LimitsUpdated(_min, _max);
    }

    // --- 2. BACKEND CREA LA ORDEN CON PRECIO FIJO ---
    /// @notice Creates a new order on-chain with a fixed price and bound to a specific buyer.
    function createOrder(string calldata orderId, uint256 amount, address buyer) external onlyOwner whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (bytes(orderId).length == 0) revert EmptyOrderId();
        if (amount < minOrder || amount > maxOrder) revert InvalidAmount(); // M-02

        bytes32 id = keccak256(bytes(orderId));
        if (orders[id].status != Status.None) revert OrderAlreadyExists();

        orders[id] = Order(buyer, amount, Status.Created, 0);
        emit OrderCreated(orderId, buyer, amount);
    }

    /// @notice Pays for an existing order if the user has already approved USDC allowance.
    function payForOrder(uint256 amount, string calldata orderId) external whenNotPaused nonReentrant {
        _pay(amount, orderId);
    }

    /// @notice Pays for an existing order utilizing EIP-2612 permit for a gasless approval step.
    function payWithPermit(
        uint256 amount,
        string calldata orderId,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external whenNotPaused nonReentrant {
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
            // M-04: Ensure allowance is sufficient after try block
            if (usdc.allowance(msg.sender, address(this)) < amount) {
                revert InsufficientAllowance();
            }
        }
        _pay(amount, orderId);
    }

    function _pay(uint256 amount, string calldata orderId) internal {
        bytes32 id = keccak256(bytes(orderId));
        Order storage o = orders[id];

        if (o.status != Status.Created) revert InvalidStatus();
        if (o.amount != amount) revert WrongAmount();
        if (msg.sender != o.buyer) revert NotBuyer();

        o.status = Status.Paid;
        o.paidAt = uint64(block.timestamp);
        pendingEscrowPrincipal += amount;
        emit PaymentReceived(msg.sender, orderId, amount);

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        usdc.approve(address(yieldVault), amount);
        yieldVault.deposit(amount, address(this));
    }

    // --- admin ---
    /// @notice Marks an order as shipped and releases the funds to the owner.
    function markShipped(string calldata orderId) external onlyOwner nonReentrant {
        bytes32 id = keccak256(bytes(orderId));
        Order storage o = orders[id];
        if (o.status != Status.Paid) revert InvalidStatus();
        o.status = Status.Shipped;
        pendingEscrowPrincipal -= o.amount;
        emit OrderShipped(orderId);
        
        yieldVault.withdraw(o.amount, address(this), address(this));
        usdc.safeTransfer(owner(), o.amount);
    }

    /// @notice Refunds a paid order, returning the USDC back to the buyer.
    function refund(string calldata orderId) external onlyOwner nonReentrant {
        bytes32 id = keccak256(bytes(orderId));
        Order storage o = orders[id];
        if (o.status != Status.Paid) revert InvalidStatus();
        o.status = Status.Refunded;
        pendingEscrowPrincipal -= o.amount;
        emit OrderRefunded(orderId, o.amount);

        yieldVault.withdraw(o.amount, address(this), address(this));
        usdc.safeTransfer(o.buyer, o.amount);
    }

    /// @notice Returns the accumulated surplus yield from the escrow vault.
    function getAccumulatedYield() public view returns (uint256) {
        uint256 totalAssetsInVault = yieldVault.convertToAssets(yieldVault.balanceOf(address(this)));
        if (totalAssetsInVault <= pendingEscrowPrincipal) {
            return 0;
        }
        return totalAssetsInVault - pendingEscrowPrincipal;
    }

    /// @notice Claims the accumulated surplus yield to the receiver address.
    function claimYield(address receiver) external onlyOwner nonReentrant {
        if (receiver == address(0)) revert ZeroAddress();
        uint256 accumulatedYield = getAccumulatedYield();
        if (accumulatedYield == 0) revert ZeroAmount();

        yieldVault.withdraw(accumulatedYield, receiver, address(this));
        emit YieldClaimed(receiver, accumulatedYield);
    }

    // --- M-03: Rescue tokens atascados ---
    /// @notice Rescues stuck ERC20 tokens from the contract.
    function rescueERC20(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
        emit Rescued(token, amount); // I-03
    }

    /// @notice Pauses contract interactions (except owner administrative functions).
    function pause() external onlyOwner { _pause(); }
    /// @notice Unpauses contract interactions.
    function unpause() external onlyOwner { _unpause(); }

    // --- I-01: View helper ---
    /// @notice Returns the order details for a given order ID.
    function getOrder(string calldata orderId) external view returns (Order memory) {
        return orders[keccak256(bytes(orderId))];
    }

    // --- M-05: Reject unexpected ETH ---
    receive() external payable {
        revert("ETH not accepted");
    }
}