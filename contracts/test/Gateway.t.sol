// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/BasePaymentGateway.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Mock USDC token with 6 decimals for testing
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {
        _mint(msg.sender, 1_000_000e6);
    }
    
    function decimals() public pure override returns (uint8) { 
        return 6; 
    }
}

contract GatewayTest is Test {
    // Re-declare events for expectEmit (Foundry requires local definition)
    event PaymentReceived(address indexed buyer, string orderId, uint256 amount);
    event OrderShipped(string orderId);
    event OrderRefunded(string orderId, uint256 amount);

    BasePaymentGateway gateway;
    MockUSDC usdc;
    address buyer = address(0x456);

    function setUp() public {
        // Deploy mock USDC
        usdc = new MockUSDC();
        
        // Deploy gateway - constructor takes only USDC address
        gateway = new BasePaymentGateway(address(usdc));
        
        // Fund buyer and approve gateway
        usdc.transfer(buyer, 1000e6);
        vm.prank(buyer);
        usdc.approve(address(gateway), type(uint256).max);
    }

    function test_PayForOrder() public {
        string memory orderId = "ORDER-001";
        uint256 amount = 24e6;

        // Execute payment
        vm.prank(buyer);
        gateway.payForOrder(amount, orderId);

        // Read order from public mapping
        // Order struct: (address buyer, uint256 amount, Status status, uint64 paidAt)
        (address orderBuyer, uint256 orderAmount, BasePaymentGateway.Status status, uint64 paidAt) = 
            gateway.orders(keccak256(bytes(orderId)));
        
        // Verify order state
        assertEq(orderBuyer, buyer);
        assertEq(orderAmount, amount);
        assertEq(uint(status), uint(BasePaymentGateway.Status.Paid));
        assertGt(paidAt, 0);
    }

    function test_RevertIfAlreadyPaid() public {
        string memory orderId = "ORDER-001";
        
        vm.prank(buyer);
        gateway.payForOrder(24e6, orderId);

        // Expect revert with custom error (no arguments)
        vm.expectRevert(BasePaymentGateway.OrderAlreadyPaid.selector);
        vm.prank(buyer);
        gateway.payForOrder(24e6, orderId);
    }

    function test_PaymentEmitsEvent() public {
        string memory orderId = "ORDER-002";
        uint256 amount = 50e6;

        // Expect the PaymentReceived event
        // First param is indexed (buyer), so set first true
        vm.expectEmit(true, false, false, true);
        emit PaymentReceived(buyer, orderId, amount);

        vm.prank(buyer);
        gateway.payForOrder(amount, orderId);
    }

    function test_RevertOnZeroAmount() public {
        vm.expectRevert(BasePaymentGateway.ZeroAmount.selector);
        vm.prank(buyer);
        gateway.payForOrder(0, "ORDER-003");
    }

    function test_RevertOnEmptyOrderId() public {
        vm.expectRevert(BasePaymentGateway.EmptyOrderId.selector);
        vm.prank(buyer);
        gateway.payForOrder(10e6, "");
    }
}