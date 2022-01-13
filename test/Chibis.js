const Chibis = artifacts.require("Chibis");
const {expect} = require('chai');
const utils = require("./helpers/utils");

contract("Chibis", (accounts) => {
	let contractInstance;
	beforeEach(async () => {
		contractInstance = await Chibis.new();
	});

	it("mint new items", async () => {
		const to = accounts[2];
		const result = await contractInstance.mint(to, {from: accounts[0]});
		// console.log(JSON.stringify({result}, null, 4));
		const tokenId = parseInt(result.receipt.logs[0].args.tokenId);
		const tokenOwner = result.receipt.logs[0].args.to;
		// console.log(JSON.stringify({newTokenId, newTokenOwner, to}, null, 4));
		expect(tokenId).to.be.above(0, "mint count did not increase");
		expect(tokenOwner).to.be.equal(to, "token did not mint to the correct account");
	});

	it("non contract owner can not mint new items", async () => {
		await utils.shouldThrow(contractInstance.mint(accounts[2], {from: accounts[1]}));
	});

	it("contract owner should set base token uri", async () => {
		const baseURI = "https://chibis.io/collection/";
		await contractInstance.setBaseURI(baseURI, {from: accounts[0]});
		const currentBaseURI = await contractInstance.baseURI()
		expect(currentBaseURI).to.equal(baseURI, `baseURI is not ${baseURI}`);
	});

	it("non contract owner can not set base token uri", async () => {
		const baseURI = "https://chibis.io/collection/";
		await utils.shouldThrow(contractInstance.setBaseURI(baseURI, {from: accounts[1]}));
	});

	it("get token uri", async () => {
		const baseURI = "https://chibis.io/collection/";
		const to = accounts[2];
		await contractInstance.setBaseURI(baseURI, {from: accounts[0]});
		const result = await contractInstance.mint(to, {from: accounts[0]});
		const tokenOwner = result.receipt.logs[0].args.to;
		const tokenId = parseInt(result.receipt.logs[0].args.tokenId);
		expect(tokenId).to.be.above(0, "mint count did not increase");
		expect(tokenOwner).to.be.equal(to, "token did not mint to the correct account");

		const testTokenURI = `${baseURI}${tokenId}`;
		const tokenURI = await contractInstance.tokenURI(tokenId);
		// console.log(`testTokenURI: ${testTokenURI}, tokenURI: ${tokenURI}`);
		expect(tokenURI).to.equal(testTokenURI, `tokenURI is not ${tokenURI}`);
	})
});