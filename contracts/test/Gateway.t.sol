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

contract MockYieldVault is IERC4626 {
    IERC20 public immutable assetToken;
    uint256 public totalAssetsValue;
    uint256 public totalSharesIssued;
    
    mapping(address => uint256) public shareBalances;
    mapping(address => mapping(address => uint256)) public allowances;
    
    constructor(address _assetToken) {
        assetToken = IERC20(_assetToken);
    }
    
    function name() external pure returns (string memory) { return "Mock Vault Share"; }
    function symbol() external pure returns (string memory) { return "mVS"; }
    function decimals() external pure returns (uint8) { return 6; }
    function totalSupply() external view returns (uint256) { return totalSharesIssued; }
    function balanceOf(address account) external view returns (uint256) { return shareBalances[account]; }
    
    function transfer(address to, uint256 amount) external returns (bool) {
        shareBalances[msg.sender] -= amount;
        shareBalances[to] += amount;
        return true;
    }
    
    function allowance(address owner, address spender) external view returns (uint256) {
        return allowances[owner][spender];
    }
    
    function approve(address spender, uint256 amount) external returns (bool) {
        allowances[msg.sender][spender] = amount;
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (from != msg.sender) {
            allowances[from][msg.sender] -= amount;
        }
        shareBalances[from] -= amount;
        shareBalances[to] += amount;
        return true;
    }

    function asset() external view returns (address) { return address(assetToken); }
    
    function deposit(uint256 assets, address receiver) external returns (uint256) {
        assetToken.transferFrom(msg.sender, address(this), assets);
        uint256 shares = (totalSharesIssued == 0) ? assets : (assets * totalSharesIssued) / totalAssetsValue;
        totalAssetsValue += assets;
        totalSharesIssued += shares;
        shareBalances[receiver] += shares;
        return shares;
    }
    
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256) {
        uint256 shares = (assets * totalSharesIssued) / totalAssetsValue;
        if (msg.sender != owner) {
            allowances[owner][msg.sender] -= shares;
        }
        totalAssetsValue -= assets;
        totalSharesIssued -= shares;
        shareBalances[owner] -= shares;
        assetToken.transfer(receiver, assets);
        return shares;
    }
    
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256) {
        uint256 assets = (shares * totalAssetsValue) / totalSharesIssued;
        if (msg.sender != owner) {
            allowances[owner][msg.sender] -= shares;
        }
        totalAssetsValue -= assets;
        totalSharesIssued -= shares;
        shareBalances[owner] -= shares;
        assetToken.transfer(receiver, assets);
        return assets;
    }
    
    function convertToAssets(uint256 shares) external view returns (uint256) {
        if (totalSharesIssued == 0) return shares;
        return (shares * totalAssetsValue) / totalSharesIssued;
    }
    
    function accrueYield(uint256 amount) external {
        totalAssetsValue += amount;
    }
}

contract GatewayTest is Test {
    event OrderCreated(string orderId, address buyer, uint256 amount);
    event PaymentReceived(address indexed buyer, string orderId, uint256 amount);
    event OrderShipped(string orderId);
    event OrderRefunded(string orderId, uint256 amount);
    event YieldClaimed(address indexed receiver, uint256 amount);

    BasePaymentGateway gateway;
    MockUSDC usdc;
    MockYieldVault yieldVault;
    
    address owner = address(this);
    address buyer = address(0x456);
    address other = address(0x789);
    address treasury = address(0xABC);

    function setUp() public {
        usdc = new MockUSDC();
        yieldVault = new MockYieldVault(address(usdc));
        gateway = new BasePaymentGateway(address(usdc), address(yieldVault));
        
        usdc.transfer(buyer, 1000e6);
        vm.prank(buyer);
        usdc.approve(address(gateway), type(uint256).max);
        
        // Approve vault in USDC for mock yield transfers
        usdc.transfer(address(yieldVault), 10000e6);
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

    function test_PayForOrderHappyPathAndVaultDeposit() public {
        gateway.createOrder("ORDER-1", 24e6, buyer);
        
        uint256 gatewaySharesBefore = yieldVault.balanceOf(address(gateway));
        
        vm.expectEmit(true, false, false, true);
        emit PaymentReceived(buyer, "ORDER-1", 24e6);
        
        vm.prank(buyer);
        gateway.payForOrder(24e6, "ORDER-1");
        
        (, , BasePaymentGateway.Status s, uint64 paidAt) = gateway.orders(keccak256(bytes("ORDER-1")));
        assertEq(uint(s), uint(BasePaymentGateway.Status.Paid));
        assertEq(gateway.pendingEscrowPrincipal(), 24e6);
        assertGt(paidAt, 0);
        
        // Assert that USDC is in the yield vault, and shares were minted to the gateway
        assertEq(yieldVault.balanceOf(address(gateway)) - gatewaySharesBefore, 24e6);
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

    function test_MarkShippedWithdrawsPrincipal() public {
        gateway.createOrder("ORDER-1", 24e6, buyer);
        vm.prank(buyer);
        gateway.payForOrder(24e6, "ORDER-1");
        
        uint256 ownerBefore = usdc.balanceOf(owner);
        uint256 gatewaySharesBefore = yieldVault.balanceOf(address(gateway));
        
        vm.expectEmit(false, false, false, true);
        emit OrderShipped("ORDER-1");
        gateway.markShipped("ORDER-1");
        
        (, , BasePaymentGateway.Status s,) = gateway.orders(keccak256(bytes("ORDER-1")));
        assertEq(uint(s), uint(BasePaymentGateway.Status.Shipped));
        assertEq(gateway.pendingEscrowPrincipal(), 0);
        assertEq(usdc.balanceOf(owner) - ownerBefore, 24e6);
        assertEq(gatewaySharesBefore - yieldVault.balanceOf(address(gateway)), 24e6);
    }

    function test_RefundWithdrawsPrincipal() public {
        gateway.createOrder("ORDER-1", 24e6, buyer);
        vm.prank(buyer);
        gateway.payForOrder(24e6, "ORDER-1");
        
        uint256 buyerBefore = usdc.balanceOf(buyer);
        uint256 gatewaySharesBefore = yieldVault.balanceOf(address(gateway));
        
        vm.expectEmit(false, false, false, true);
        emit OrderRefunded("ORDER-1", 24e6);
        gateway.refund("ORDER-1");
        
        (, , BasePaymentGateway.Status s,) = gateway.orders(keccak256(bytes("ORDER-1")));
        assertEq(uint(s), uint(BasePaymentGateway.Status.Refunded));
        assertEq(gateway.pendingEscrowPrincipal(), 0);
        assertEq(usdc.balanceOf(buyer) - buyerBefore, 24e6);
        assertEq(gatewaySharesBefore - yieldVault.balanceOf(address(gateway)), 24e6);
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

    // Since our limit checks revert with InvalidAmount, let's keep it simple
    function test_RevertCreateEmptyId() public {
        vm.expectRevert(BasePaymentGateway.EmptyOrderId.selector);
        gateway.createOrder("", 24e6, buyer);
    }

    function test_EscrowYieldAccrualAndClaim() public {
        gateway.createOrder("ORDER-1", 100e6, buyer);
        vm.prank(buyer);
        gateway.payForOrder(100e6, "ORDER-1");
        
        // Assert initial yield is 0
        assertEq(gateway.getAccumulatedYield(), 0);
        
        // Simulate DeFi yield generation in vault: accrue 10 USDC
        yieldVault.accrueYield(10e6);
        
        // Assert accumulated yield is 10 USDC
        assertEq(gateway.getAccumulatedYield(), 10e6);
        
        // Release order to merchant: they must get exactly their 100 USDC principal
        uint256 ownerBefore = usdc.balanceOf(owner);
        gateway.markShipped("ORDER-1");
        assertEq(usdc.balanceOf(owner) - ownerBefore, 100e6);
        
        // Platform yield remains in the vault and is claimable
        assertEq(gateway.getAccumulatedYield(), 10e6);
        
        // Claim yield to the platform treasury address
        uint256 treasuryBefore = usdc.balanceOf(treasury);
        
        vm.expectEmit(true, false, false, true);
        emit YieldClaimed(treasury, 10e6);
        
        gateway.claimYield(treasury);
        
        assertEq(usdc.balanceOf(treasury) - treasuryBefore, 10e6);
        assertEq(gateway.getAccumulatedYield(), 0);
    }
}