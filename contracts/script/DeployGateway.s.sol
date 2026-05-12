// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/BasePaymentGateway.sol";

contract DeployGateway is Script {
    function run() external {
        // Read the private key from the environment variable
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        // USDC address on Base Mainnet
        // Change to 0x036CbD53842c5426634e7929541eC2318f3dCF7e for Base Sepolia
        address usdcAddress = vm.envAddress("USDC_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        BasePaymentGateway gateway = new BasePaymentGateway(usdcAddress);

        vm.stopBroadcast();

        console.log("=== Deploy successful ===");
        console.log("Gateway deployed at:", address(gateway));
        console.log("Owner (admin):", gateway.owner());
        console.log("USDC:", address(gateway.usdc()));
    }
}
