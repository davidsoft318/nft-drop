const Chibis = artifacts.require("Chibis");
const ChibiApes = artifacts.require("ChibiApes");
const ChibiGalaxies = artifacts.require("ChibiGalaxies");

const {expect} = require('chai');
const web3 = require('web3');
const utils = require("./helpers/utils");
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');


contract("ChibiGalaxies", (accounts) => {

	let owner, addr1, addr2, addr3, addr4, addr5, addr6, addr7;
	let chibisContractInstance;
	let chibiApesContractInstance;
	let chibiGalaxiesContractInstance;
	let whitelistMerkleTree;
	let specialEventMerkleTree;
	let gen1HoldersMerkleTree;

	const testPreMintPrice = 0.06;
	const testPublicMintPrice = 0.08;

	const setupContractAddresses = async () => {
		await chibiGalaxiesContractInstance.setGeneration1ContractAddress(chibisContractInstance.address);
		await chibiGalaxiesContractInstance.setGeneration2ContractAddress(chibiApesContractInstance.address);
	}
	const mintGen1 = async ({addr = addr1} = {}) => {
		// console.log(`mintGen1 called for ${addr}`)
		await chibisContractInstance.mint(addr);
	}
	const mintGen2 = async ({addr = addr1} = {}) => {
		// console.log(`mintGen2 called for ${addr}`)
		const chibiApesMintPrice = await chibiApesContractInstance.mintPrice();
		await chibiApesContractInstance.publicMint({from: addr, value: chibiApesMintPrice});
	}
	const setupPreMintForToday = async () => {
		await chibiGalaxiesContractInstance.unpause();
		await chibiGalaxiesContractInstance.setPreMintPaused(false);
	}
	const setupPublicMint = async () => {
		await chibiGalaxiesContractInstance.unpause();
		const list = [owner, addr1, addr2, addr3, addr4, addr5, addr6];
		whitelistMerkleTree = new MerkleTree(list, keccak256, { hashLeaves: true, sortPairs: true });
		await chibiGalaxiesContractInstance.setPublicMintInfo(false, true, whitelistMerkleTree.getHexRoot());
	}
	const setupSpecialMint = async () => {
		await chibiGalaxiesContractInstance.unpause();
		const list = [addr1, addr2, addr3];
		specialEventMerkleTree = new MerkleTree(list, keccak256, { hashLeaves: true, sortPairs: true });
		await chibiGalaxiesContractInstance.setSpecialEventMintInfo(false, 2, specialEventMerkleTree.getHexRoot());
	}
	const setUpGen1Holders = async () => {
		const list = [addr1, addr2, addr3, addr4, addr5, addr6];
		gen1HoldersMerkleTree = new MerkleTree(list, keccak256, { hashLeaves: true, sortPairs: true });
		await chibiGalaxiesContractInstance.setGeneration1HoldersMerkleRoot(gen1HoldersMerkleTree.getHexRoot());
	}
	beforeEach(async () => {
		// console.log(accounts);
		[owner, addr1, addr2, addr3, addr4, addr5, addr6, addr7] = accounts.slice(0, 8);
		chibisContractInstance = await Chibis.new();
		chibiApesContractInstance = await ChibiApes.new();
		chibiApesContractInstance.setPublicMintPaused(false);
		chibiGalaxiesContractInstance = await ChibiGalaxies.new();
	});
	xit("print addresses", async () => {
		console.log(JSON.stringify({chibisContractAddress: chibisContractInstance.address, chibiApesContractAddress: chibiGalaxiesContractInstance.address}, null, 4));
	})
	xit("print estimates", async () => {
		const amountOfGas = await ChibiGalaxies.new.estimateGas();
		console.log(`Estimated cost to deploy ChibiGalaxies: ${web3.utils.fromWei(`${amountOfGas}`, 'ether')} eth`);
	});
	describe("setup", async () => {
		it("should update max items.", async () => {
			const testMaxItems = web3.utils.toBN('6000');
			await chibiGalaxiesContractInstance.setCollectionSize(testMaxItems);
			const maxItems = await chibiGalaxiesContractInstance.collectionSize();
			// console.log(JSON.stringify({testMaxItems: testMaxItems.toString(), maxItems: maxItems.toString()}, null, 4));
			expect(maxItems.toString()).to.be.equal(testMaxItems.toString(), `max items did not update to ${testMaxItems}`);
		});
		it("token uri", async () => {
			await setupContractAddresses();

			const baseURI = "https://chibis.io/collection/";
			await chibiGalaxiesContractInstance.setBaseTokenURI(baseURI);

			const tokenId = 101;
			const testTokenURI = `${baseURI}${tokenId}`;
			const tokenURI = await chibiGalaxiesContractInstance.tokenURI(tokenId);
			// console.log({testTokenURI, tokenURI}, null, 4);
			expect(tokenURI).to.equal(testTokenURI, `tokenURI is not ${tokenURI}`);
		});
	})
	it ("should giveaway of 3 tokens.", async () => {
		const { logs } = await chibiGalaxiesContractInstance.giveawayMint(addr1, 3);
		const tokenIdsMinted = logs.map(log => log.event === 'Mint' ? parseInt(log.args.tokenId) : undefined).filter(item => item !== undefined);
		// console.log(tokenIdsMinted);
		expect(tokenIdsMinted).with.length(3, `did not give away 3 tokens`);
		const owner = await chibiGalaxiesContractInstance.ownerOf(tokenIdsMinted[0]);
		expect(addr1).to.equal(owner, "first token not owned by test account");
		expect(Math.max(...tokenIdsMinted)).to.be.below(101, "max giveaway token not below 101");
	});
	describe("mint rare", async () => {
		const runMintRareTokens = async () => {
			await chibiGalaxiesContractInstance.unpause();
			const { logs } = await chibiGalaxiesContractInstance.rareMint(150);
			const tokenIdsMinted = logs.map(log => log.event === 'Mint' ? parseInt(log.args.tokenId) : undefined).filter(item => item !== undefined);
			const tokenOwner = await chibiGalaxiesContractInstance.ownerOf(tokenIdsMinted[0]);
			expect(chibiGalaxiesContractInstance.address).to.equal(tokenOwner, "first token not owned by test account");
			return tokenIdsMinted;
		}
		it("should mint 150 rare tokens", async () => {
			const tokens = await runMintRareTokens();
			expect(tokens).with.length(150, "did not mint 150 tokens");
			const rareTokenIds = tokens.filter(tokenId => tokenId >= 101 && tokenId <= 250);
			expect(rareTokenIds).with.length(150, `did not mint 150 rare tokens`);
			await utils.shouldThrow(chibiGalaxiesContractInstance.rareMint(150));
		});
		it("should claim 2 rare tokens for gen 1 (2) + gen 2 (3) holder.", async () => {
			await runMintRareTokens();
			await setupContractAddresses();
			await mintGen1();
			await mintGen1();
			await mintGen2();
			await mintGen2();
			await mintGen2();
			await setUpGen1Holders();
			const proof = gen1HoldersMerkleTree.getHexProof(keccak256(addr1));
			const {logs} = await chibiGalaxiesContractInstance.claimRareToken(proof, {from: addr1});
			// console.log(JSON.stringify({logs}, null, 4));
			const tokensTransferred = logs.map(log => log.event === 'Transfer' ? parseInt(log.args.tokenId) : undefined).filter(item => item !== undefined);
			// console.log(`tokensTransferred: ${tokensTransferred}`);
			expect(tokensTransferred).with.length(2, "did not claim 2 token");
			const rareTokenIds = tokensTransferred.filter(tokenId => tokenId >= 101 && tokenId <= 250);
			expect(rareTokenIds).with.length(2, `did not claim 2 rare tokens`);
			const owner = await chibiGalaxiesContractInstance.ownerOf(rareTokenIds[0]);
			expect(addr1 === owner, "first token not owned by test account");
			await utils.shouldThrow(chibiGalaxiesContractInstance.claimRareToken(proof, {from: addr1}));
		});
		it("should claim 1 rare token for each of 3 addresses.", async () => {
			await runMintRareTokens();
			await setUpGen1Holders();
			await setupContractAddresses();
			const test = async ({index, addr} = {}) => {
				return new Promise(async (resolve, reject) => {
					try {
						if (!addr){
							reject(new Error("address not specified"));
							return;
						}
						await mintGen1({addr});
						await mintGen2({addr});
						const proof = gen1HoldersMerkleTree.getHexProof(keccak256(addr));
						const {logs} = await chibiGalaxiesContractInstance.claimRareToken(proof, {from: addr});
						// console.log(JSON.stringify({logs}, null, 4));
						const tokensTransferred = logs.map(log => log.event === 'Transfer' ? parseInt(log.args.tokenId) : undefined).filter(item => item !== undefined);
						// console.log(`tokensTransferred: ${tokensTransferred}`);
						expect(tokensTransferred).with.length(1, "did not claim 1 token");
						const rareTokenIds = tokensTransferred.filter(tokenId => tokenId >= 101 && tokenId <= 250);
						expect(rareTokenIds).with.length(1, `did not claim 1 rare token`);
						const owner = await chibiGalaxiesContractInstance.ownerOf(rareTokenIds[0]);
						expect(addr1 === owner, "first token not owned by test account");
						await utils.shouldThrow(chibiGalaxiesContractInstance.claimRareToken(proof, {from: addr1}));
						resolve(tokensTransferred);
					} catch (error){
						console.error(error);
						reject(error);
					}
				})
			}
			const addrs = [addr1, addr2, addr3];
			const promises = addrs.map((addr, index) => test({index, addr}));
			const results = await Promise.all(promises);
			// console.log(JSON.stringify({results}, null, 4));
			const success = results.filter(result => result.length === 1 && result[0] >= 101 && result[0] <= 250).length === 3;
			expect(success, "error minting 3 rare tokens").to.be.true
		});
		it("should not claim rare token for non gen 2 holder.", async () => {
			await runMintRareTokens();
			await setUpGen1Holders();
			await setupContractAddresses();
			await mintGen1();
			const proof = gen1HoldersMerkleTree.getHexProof(keccak256(addr7));
			await utils.shouldThrow(chibiGalaxiesContractInstance.claimRareToken(proof, {from: addr7}));
		});
		it("should not clain rare token for non gen 1 holder.", async () => {
			await runMintRareTokens();
			await setUpGen1Holders();
			await setupContractAddresses();
			await mintGen2();
			const proof = gen1HoldersMerkleTree.getHexProof(keccak256(addr7));
			await utils.shouldThrow(chibiGalaxiesContractInstance.claimRareToken(proof, {from: addr7}));
		});
	});
	describe("pre mint", async () => {
		const runPreMintTest = async ({addr = addr1} = {}) => {
			await setupPreMintForToday();
			const numChibisOwned = parseInt(await chibiGalaxiesContractInstance.numGeneration1sOwned({from: addr}));
			// console.log(`numChibisOwned: ${numChibisOwned}`);
			const numChibiApesOwned = parseInt(await chibiGalaxiesContractInstance.numGeneration2sOwned({from: addr}));
			// console.log(`numChibiApesOwned: ${numChibiApesOwned}`);
			const numToMint = (numChibisOwned * 3) + numChibiApesOwned;
			// console.log(`numToMint: ${numToMint}`);
			expect(numToMint).to.be.above(0, "number of tokens to min is 0");
			const testValueInEther = web3.utils.toWei(`${(testPreMintPrice*numToMint)}`, "ether");
			const { logs } = await chibiGalaxiesContractInstance.preMint({from: addr, value: testValueInEther});
			// console.log(JSON.stringify({result}, null, 4));
			const tokenIdsMintedDuringPre = logs.map(log => log.event === 'Mint' ? parseInt(log.args.tokenId) : undefined).filter(item => item !== undefined);
			// console.log(`tokenIdsMintedDuringPre: ${tokenIdsMintedDuringPre}`);
			expect(tokenIdsMintedDuringPre).with.length(numToMint, `did not mint ${numToMint}`);
			const owner = await chibiGalaxiesContractInstance.ownerOf(tokenIdsMintedDuringPre[0]);
			expect(addr).to.equal(owner, "first token not owned by test account");
			return tokenIdsMintedDuringPre;
		}
		it("should not mint when contract paused.", async () => {
			await utils.shouldThrow(chibiGalaxiesContractInstance.preMint({from: addr1, value: web3.utils.toWei(`${testPreMintPrice}`, "ether")}));
		});
		it("should mint 4 regular tokens for gen 1 + gen 2 holder.", async () => {
			await setupContractAddresses();
			await mintGen1();
			await mintGen2();
			const tokens = await runPreMintTest();
			expect(tokens).with.length(4, "did not mint 4 tokens");
			const regularTokenIds = tokens.filter(tokenId => tokenId >= 251);
			expect(regularTokenIds).with.length(4, `did not mint 4 reg tokens`);
			await utils.shouldThrow(chibiGalaxiesContractInstance.preMint({from: addr1, value: web3.utils.toWei(`${testPreMintPrice}`, "ether")}));
		});
		it("should mint 10 regular tokens for wallet with 2 gen 1 + 4 gen 2.", async () => {
			await setupContractAddresses();
			await mintGen1();
			await mintGen1();
			await mintGen2();
			await mintGen2();
			await mintGen2();
			await mintGen2();
			const tokens = await runPreMintTest();
			expect(tokens).with.length(10, "did not mint 10 tokens");
			const regularTokenIds = tokens.filter(tokenId => tokenId >= 251);
			expect(regularTokenIds).with.length(10, `did not mint 10 reg tokens`);
			await utils.shouldThrow(chibiGalaxiesContractInstance.preMint({from: addr1, value: web3.utils.toWei(`${testPreMintPrice}`, "ether")}));
		});
		it("should mint 3 regular tokens for gen 1 holder.", async () => {
			await setupContractAddresses();
			await mintGen1();
			const tokens = await runPreMintTest();
			const regularTokenIds = tokens.filter(tokenId => tokenId >= 251);
			expect(regularTokenIds).with.length(3, `did not mint 3 regular tokens`);
			await utils.shouldThrow(chibiGalaxiesContractInstance.preMint({from: addr1, value: web3.utils.toWei(`${testPreMintPrice}`, "ether")}));
		});
		it("should mint 1 regular token for gen 2 holder.", async () => {
			await setupContractAddresses();
			await mintGen2({addr: addr7});
			const tokens = await runPreMintTest({addr: addr7});
			const regularTokenIds = tokens.filter(tokenId => tokenId >= 251);
			expect(regularTokenIds).with.length(1, `did not mint 3 regular tokens`);
			await utils.shouldThrow(chibiGalaxiesContractInstance.preMint({from: addr7, value: web3.utils.toWei(`${testPreMintPrice}`, "ether")}));
		});
	})
	describe("public mint", async () => {
		it("should not mint when contract paused", async () => {
			const proof = [];
			await utils.shouldThrow(chibiGalaxiesContractInstance.publicMint(proof, {from: addr1, value: web3.utils.toWei(`${testPublicMintPrice}`, "ether")}));
		});
		it("should not allow un-whitelisted", async () => {
			await setupContractAddresses();
			await setupPublicMint();
			const proof = whitelistMerkleTree.getHexProof(keccak256(addr7));
			await utils.shouldThrow(chibiGalaxiesContractInstance.publicMint(proof, {from: addr7, value: web3.utils.toWei(`${(testPublicMintPrice)}`, "ether")}));
		});
		it("should allow whitelisted", async () => {
			await setupContractAddresses();
			await setupPublicMint();
			const proof = whitelistMerkleTree.getHexProof(keccak256(addr1));
			let testValueInEther = web3.utils.toWei(`0.08`, "ether");
			const {logs} = await chibiGalaxiesContractInstance.publicMint(proof, {from: addr1, value: testValueInEther})
			const tokenIdsMinted = logs.map(log => log.event === 'Mint' ? parseInt(log.args.tokenId) : undefined).filter(item => item !== undefined);
			// console.log(`tokenIdsMinted: ${tokenIdsMinted}`);
			expect(tokenIdsMinted).with.length(1, `did not mint 1`);
			const owner = await chibiGalaxiesContractInstance.ownerOf(tokenIdsMinted[0]);
			expect(owner).to.be.equal(addr1, "first token not owned by test account");
		});
		it("should allow all", async () => {
			await setupContractAddresses();
			await chibiGalaxiesContractInstance.unpause();
			await chibiGalaxiesContractInstance.setPublicMintInfo(false, false, whitelistMerkleTree.getHexRoot());
			let testValueInEther = web3.utils.toWei(`${testPublicMintPrice}`, "ether");
			const proof = whitelistMerkleTree.getHexProof(keccak256(addr7));
			const { logs} = await chibiGalaxiesContractInstance.publicMint(proof, {from: addr7, value: testValueInEther})
			const tokenIdsMinted = logs.map(log => log.event === 'Mint' ? parseInt(log.args.tokenId) : undefined).filter(item => item !== undefined);
			// console.log(`tokenIdsMinted: ${tokenIdsMinted}`);
			expect(tokenIdsMinted).with.length(1, `did not mint 1`);
			const owner = await chibiGalaxiesContractInstance.ownerOf(tokenIdsMinted[0]);
			expect(owner).to.be.equal(addr7, "first token not owned by test account");
		});
	});
	describe("special event mint", async () => {
		it("should not mint when contract paused", async () => {
			const proof = [];
			await utils.shouldThrow(chibiGalaxiesContractInstance.specialEventMint(proof, {from: addr1, value: web3.utils.toWei(`${testPublicMintPrice}`, "ether")}));
		});
		it("should not allow un-whitelisted", async () => {
			await setupContractAddresses();
			await setupSpecialMint();
			const proof = specialEventMerkleTree.getHexProof(keccak256(addr7));
			await utils.shouldThrow(chibiGalaxiesContractInstance.specialEventMint(proof, {from: addr7, value: web3.utils.toWei(`${(testPublicMintPrice)}`, "ether")}));
		});
		it("should allow whitelisted", async () => {
			await setupContractAddresses();
			await setupSpecialMint();
			const proof = specialEventMerkleTree.getHexProof(keccak256(addr1));
			let testValueInEther = web3.utils.toWei(`${testPublicMintPrice}`, "ether");
			const {logs} = await chibiGalaxiesContractInstance.specialEventMint(proof, {from: addr1, value: testValueInEther})
			const tokenIdsMinted = logs.map(log => log.event === 'Mint' ? parseInt(log.args.tokenId) : undefined).filter(item => item !== undefined);
			// console.log(`tokenIdsMinted: ${tokenIdsMinted}`);
			expect(tokenIdsMinted).with.length(1, `did not mint 1`);
			const owner = await chibiGalaxiesContractInstance.ownerOf(tokenIdsMinted[0]);
			expect(owner).to.be.equal(addr1, "first token not owned by test account");
		});
		it("should not allow mint more than 2", async () => {
			await setupContractAddresses();
			await setupSpecialMint();
			const proof = specialEventMerkleTree.getHexProof(keccak256(addr1));
			let testValueInEther = web3.utils.toWei(`${testPublicMintPrice*3}`, "ether");
			await utils.shouldThrow(chibiGalaxiesContractInstance.specialEventMint(proof, {from: addr1, value: testValueInEther}));
		});
	});
});