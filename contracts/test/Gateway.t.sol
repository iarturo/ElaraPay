// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/BasePaymentGateway.sol";

/// @dev Mock USDC token for testing
contract MockUSDC {
    string public name = "USD Coin";
    string public symbol = "USDC";
    uint8  public decimals = 6;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (allowance[from][msg.sender] < amount) return false;
        if (balanceOf[from] < amount) return false;
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to]   += amount;
        return true;
    }
}

contract GatewayTest is Test {
    BasePaymentGateway public gateway;
    MockUSDC public usdc;

    address admin  = address(0xAD);
    address buyer  = address(0xB0);

    uint256 constant TEN_USDC = 10_000_000; // 10 USDC (6 decimals)

    // Re-declare event to use with vm.expectEmit (Solidity 0.8.20 compatibility)
    event PaymentReceived(address indexed buyer, string orderId, uint256 amount);

    function setUp() public {
        usdc = new MockUSDC();

        // Deploy gateway as admin
        vm.prank(admin);
        gateway = new BasePaymentGateway(address(usdc));

        // Give USDC to the buyer
        usdc.mint(buyer, 100_000_000); // 100 USDC
    }

    // ─── Positive tests ──────────────────────────────────────────────

    function test_ownerIsDeployer() public view {
        assertEq(gateway.owner(), admin);
    }

    function test_usdcAddressIsCorrect() public view {
        assertEq(address(gateway.usdc()), address(usdc));
    }

    function test_payForOrder_success() public {
        // Buyer approves the gateway
        vm.prank(buyer);
        usdc.approve(address(gateway), TEN_USDC);

        // Buyer pays
        vm.prank(buyer);
        vm.expectEmit(true, false, false, true);
        emit PaymentReceived(buyer, "ORDER-001", TEN_USDC);
        gateway.payForOrder(TEN_USDC, "ORDER-001");

        // Verify balances
        assertEq(usdc.balanceOf(admin), TEN_USDC);
        assertEq(usdc.balanceOf(buyer), 90_000_000);

        // Verify order is marked as fulfilled
        assertTrue(gateway.orderFulfilled(keccak256(bytes("ORDER-001"))));
    }

    function test_multiplePurchases_differentOrders() public {
        vm.startPrank(buyer);
        usdc.approve(address(gateway), 30_000_000); // 30 USDC

        gateway.payForOrder(TEN_USDC, "ORDER-001");
        gateway.payForOrder(TEN_USDC, "ORDER-002");
        gateway.payForOrder(TEN_USDC, "ORDER-003");
        vm.stopPrank();

        assertEq(usdc.balanceOf(admin), 30_000_000);
        assertEq(usdc.balanceOf(buyer), 70_000_000);
    }

    function test_checkAllowance() public {
        vm.prank(buyer);
        usdc.approve(address(gateway), TEN_USDC);

        assertEq(gateway.checkAllowance(buyer), TEN_USDC);
    }

    // ─── Negative tests ──────────────────────────────────────────────

    function test_revert_zeroAmount() public {
        vm.prank(buyer);
        vm.expectRevert(BasePaymentGateway.ZeroAmount.selector);
        gateway.payForOrder(0, "ORDER-001");
    }

    function test_revert_emptyOrderId() public {
        vm.prank(buyer);
        vm.expectRevert(BasePaymentGateway.EmptyOrderId.selector);
        gateway.payForOrder(TEN_USDC, "");
    }

    function test_revert_insufficientAllowance() public {
        // No approve was made
        vm.prank(buyer);
        // Since SafeERC20 is used, it will revert with SafeERC20FailedOperation if transferFrom returns false
        vm.expectRevert();
        gateway.payForOrder(TEN_USDC, "ORDER-001");
    }

    function test_revert_insufficientBalance() public {
        address poorBuyer = address(0xC0);
        // Has allowance but no balance
        vm.prank(poorBuyer);
        usdc.approve(address(gateway), TEN_USDC);

        vm.prank(poorBuyer);
        vm.expectRevert();
        gateway.payForOrder(TEN_USDC, "ORDER-001");
    }

    // ─── Replay protection tests ─────────────────────────────────────

    function test_revert_orderAlreadyPaid() public {
        vm.startPrank(buyer);
        usdc.approve(address(gateway), 20_000_000); // enough for 2

        // First payment succeeds
        gateway.payForOrder(TEN_USDC, "ORDER-001");

        // Second payment with SAME orderId reverts
        vm.expectRevert(
            abi.encodeWithSelector(
                BasePaymentGateway.OrderAlreadyPaid.selector,
                "ORDER-001"
            )
        );
        gateway.payForOrder(TEN_USDC, "ORDER-001");
        vm.stopPrank();

        // Only one payment went through
        assertEq(usdc.balanceOf(admin), TEN_USDC);
    }

    function test_differentBuyers_sameOrder_reverts() public {
        address buyer2 = address(0xB1);
        usdc.mint(buyer2, 100_000_000);

        // First buyer pays
        vm.prank(buyer);
        usdc.approve(address(gateway), TEN_USDC);
        vm.prank(buyer);
        gateway.payForOrder(TEN_USDC, "ORDER-SHARED");

        // Second buyer tries same orderId — reverts
        vm.prank(buyer2);
        usdc.approve(address(gateway), TEN_USDC);
        vm.prank(buyer2);
        vm.expectRevert(
            abi.encodeWithSelector(
                BasePaymentGateway.OrderAlreadyPaid.selector,
                "ORDER-SHARED"
            )
        );
        gateway.payForOrder(TEN_USDC, "ORDER-SHARED");
    }
}
