// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/BasePaymentGateway.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {
        _mint(msg.sender, 1_000_000e6);
    }
    function decimals() public pure override returns (uint8) { return 6; }
}

contract GatewayTest is Test {
    event OrderCreated(string orderId, address buyer, uint256 amount);
    event PaymentReceived(address indexed buyer, string orderId, uint256 amount);
    event OrderShipped(string orderId);
    event OrderRefunded(string orderId, uint256 amount);

    BasePaymentGateway gateway;
    MockUSDC usdc;
    address owner = address(this);
    address buyer = address(0x456);
    address other = address(0x789);

    function setUp() public {
        usdc = new MockUSDC();
        gateway = new BasePaymentGateway(address(usdc));
        
        usdc.transfer(buyer, 1000e6);
        vm.prank(buyer);
        usdc.approve(address(gateway), type(uint256).max);
    }

    function test_CreateOrderOnlyOwner() public {
        vm.prank(other);
        vm.expectRevert();
        gateway.createOrder("ORDER-1", 24e6, buyer);
    }

    function test_CreateOrderSuccess() public {
        vm.expectEmit(false, false, false, true);
        emit OrderCreated("ORDER-1", buyer, 24e6);
        
        gateway.createOrder("ORDER-1", 24e6, buyer);
        
        (address b, uint256 a, BasePaymentGateway.Status s,) = gateway.orders(keccak256(bytes("ORDER-1")));
        assertEq(b, buyer);
        assertEq(a, 24e6);
        assertEq(uint(s), uint(BasePaymentGateway.Status.Created));
    }

    function test_PayForOrderHappyPath() public {
        gateway.createOrder("ORDER-1", 24e6, buyer);
        
        uint256 balBefore = usdc.balanceOf(address(gateway));
        
        vm.expectEmit(true, false, false, true);
        emit PaymentReceived(buyer, "ORDER-1", 24e6);
        
        vm.prank(buyer);
        gateway.payForOrder(24e6, "ORDER-1");
        
        (, , BasePaymentGateway.Status s, uint64 paidAt) = gateway.orders(keccak256(bytes("ORDER-1")));
        assertEq(uint(s), uint(BasePaymentGateway.Status.Paid));
        assertGt(paidAt, 0);
        assertEq(usdc.balanceOf(address(gateway)) - balBefore, 24e6);
    }

    function test_RevertWrongAmount() public {
        gateway.createOrder("ORDER-1", 24e6, buyer);
        
        vm.prank(buyer);
        vm.expectRevert(BasePaymentGateway.WrongAmount.selector);
        gateway.payForOrder(1, "ORDER-1");
    }

    function test_RevertNotBuyer() public {
        gateway.createOrder("ORDER-1", 24e6, buyer);
        
        vm.prank(other);
        vm.expectRevert(BasePaymentGateway.NotBuyer.selector);
        gateway.payForOrder(24e6, "ORDER-1");
    }

    function test_MarkShippedTransfersToOwner() public {
        gateway.createOrder("ORDER-1", 24e6, buyer);
        vm.prank(buyer);
        gateway.payForOrder(24e6, "ORDER-1");
        
        uint256 ownerBefore = usdc.balanceOf(owner);
        
        vm.expectEmit(false, false, false, true);
        emit OrderShipped("ORDER-1");
        gateway.markShipped("ORDER-1");
        
        (, , BasePaymentGateway.Status s,) = gateway.orders(keccak256(bytes("ORDER-1")));
        assertEq(uint(s), uint(BasePaymentGateway.Status.Shipped));
        assertEq(usdc.balanceOf(owner) - ownerBefore, 24e6);
    }

    function test_RefundReturnsToBuyer() public {
        gateway.createOrder("ORDER-1", 24e6, buyer);
        vm.prank(buyer);
        gateway.payForOrder(24e6, "ORDER-1");
        
        uint256 buyerBefore = usdc.balanceOf(buyer);
        
        vm.expectEmit(false, false, false, true);
        emit OrderRefunded("ORDER-1", 24e6);
        gateway.refund("ORDER-1");
        
        (, , BasePaymentGateway.Status s,) = gateway.orders(keccak256(bytes("ORDER-1")));
        assertEq(uint(s), uint(BasePaymentGateway.Status.Refunded));
        assertEq(usdc.balanceOf(buyer) - buyerBefore, 24e6);
    }

    function test_PauseBlocksPay() public {
        gateway.createOrder("ORDER-1", 24e6, buyer);
        gateway.pause();
        
        vm.prank(buyer);
        vm.expectRevert();
        gateway.payForOrder(24e6, "ORDER-1");
    }

    function test_RevertCreateZeroAmount() public {
        vm.expectRevert(BasePaymentGateway.ZeroAmount.selector);
        gateway.createOrder("ORDER-1", 0, buyer);
    }

    function test_RevertCreateEmptyId() public {
        vm.expectRevert(BasePaymentGateway.EmptyOrderId.selector);
        gateway.createOrder("", 24e6, buyer);
    }
}