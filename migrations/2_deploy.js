// migrations/2_deploy.js
// SPDX-License-Identifier: MIT
const Chibis = artifacts.require("Chibis");
const ChibiGalaxies = artifacts.require("ChibiGalaxies");

module.exports = function (deployer) {
	// deployer.deploy(Chibis);
	deployer.deploy(ChibiGalaxies);
};
